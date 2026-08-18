-- Colaboradores: permissões por pessoa, convites e quem pode administrar.
--
-- Roda DEPOIS de 20260818100000_cargos_de_colaborador.sql, que acrescenta os
-- cargos novos ao enum. Ver lá o porquê da separação.

-- -----------------------------------------------------------------------------
-- Permissões, uma a uma
-- -----------------------------------------------------------------------------
-- Guardadas no próprio perfil, e não numa tabela à parte, porque são poucas
-- e conhecidas: uma coluna por permissão deixa a política de segurança
-- legível (`pode_gerenciar_colaboradores()`) e sem junção nenhuma no meio do
-- caminho crítico de toda consulta.
alter table perfis_usuario
  add column if not exists pode_movimentar_estoque boolean,
  add column if not exists pode_gerenciar_cadastros boolean,
  add column if not exists pode_gerenciar_colaboradores boolean;

comment on column perfis_usuario.pode_movimentar_estoque is
  'Cadastrar sobras, dar baixa, corrigir quantidade.';
comment on column perfis_usuario.pode_gerenciar_cadastros is
  'Mexer no catálogo: perfis, linhas, acabamentos, localizações, clientes.';
comment on column perfis_usuario.pode_gerenciar_colaboradores is
  'Convidar colega, mudar cargo, ligar e desligar acesso.';

-- O padrão de cada cargo, num lugar só. É consultado no convite e ao
-- preencher as colunas de quem já existe, logo abaixo.
create or replace function permissoes_do_cargo(p_papel papel_usuario)
returns table (
  movimentar_estoque boolean,
  gerenciar_cadastros boolean,
  gerenciar_colaboradores boolean
)
language sql
immutable
as $$
  select
    p_papel in ('administrador', 'gerente', 'auxiliar', 'estoque'),
    p_papel in ('administrador', 'gerente'),
    p_papel = 'administrador'
$$;

comment on function permissoes_do_cargo is
  'Permissões INICIAIS de um cargo. Só vale no momento do convite: depois
   disso quem manda é a coluna no perfil, que o administrador pode ajustar.';

-- Quem já existe recebe o padrão do próprio cargo. Sem isto, as colunas
-- ficariam nulas e todo mundo perderia acesso na primeira consulta.
update perfis_usuario p
set pode_movimentar_estoque =
      (select movimentar_estoque from permissoes_do_cargo(p.papel)),
    pode_gerenciar_cadastros =
      (select gerenciar_cadastros from permissoes_do_cargo(p.papel)),
    pode_gerenciar_colaboradores =
      (select gerenciar_colaboradores from permissoes_do_cargo(p.papel))
where p.pode_movimentar_estoque is null;

alter table perfis_usuario
  alter column pode_movimentar_estoque set not null,
  alter column pode_gerenciar_cadastros set not null,
  alter column pode_gerenciar_colaboradores set not null,
  alter column pode_movimentar_estoque set default false,
  alter column pode_gerenciar_cadastros set default false,
  alter column pode_gerenciar_colaboradores set default false;

-- -----------------------------------------------------------------------------
-- As funções que a segurança consulta
-- -----------------------------------------------------------------------------
-- `pode_movimentar_estoque` existia e perguntava pelo cargo. Agora pergunta
-- pela permissão. As políticas que a chamam continuam iguais — era esse o
-- ponto de ter a pergunta atrás de uma função.
create or replace function pode_movimentar_estoque()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select pode_movimentar_estoque from perfis_usuario
     where id = auth.uid() and ativo),
    false
  )
$$;

create or replace function pode_gerenciar_colaboradores()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select pode_gerenciar_colaboradores from perfis_usuario
     where id = auth.uid() and ativo),
    false
  )
$$;

-- -----------------------------------------------------------------------------
-- Convites
-- -----------------------------------------------------------------------------
-- POR QUE CONVITE, E NÃO CRIAR O USUÁRIO DIRETO
--
-- Criar conta em auth.users exige a chave de administração do projeto. Ela
-- não pode viajar dentro do aplicativo: qualquer pessoa a extrairia do
-- celular e teria o banco inteiro na mão. Então o caminho se inverte — o
-- administrador registra o convite, e é o próprio colaborador quem cria a
-- conta, com a senha que só ele conhece. O gatilho mais abaixo é a ponte.
create table if not exists convites_colaborador (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes (id) on delete cascade,

  -- Guardado em minúsculas e sem espaços: é a chave que casa com o e-mail
  -- do cadastro, e "Joao@ " não pode virar pessoa diferente de "joao@".
  email text not null,
  nome text not null,
  papel papel_usuario not null,
  telefone text,

  criado_por uuid references perfis_usuario (id) on delete set null,
  criado_em timestamptz not null default now(),
  aceito_em timestamptz,

  constraint email_em_minusculas check (email = lower(trim(email)))
);

-- Um convite aberto por e-mail. Convite já aceito não conta: a mesma pessoa
-- pode ser convidada de novo depois de ter o acesso removido.
create unique index if not exists idx_convite_aberto_por_email
  on convites_colaborador (email)
  where aceito_em is null;

comment on table convites_colaborador is
  'Quem o administrador autorizou a criar conta. Sem convite aberto, o
   cadastro é recusado pelo gatilho em auth.users.';

alter table convites_colaborador enable row level security;

create policy "ver convites da própria organização"
  on convites_colaborador for select
  to authenticated
  using (organizacao_id = organizacao_atual());

create policy "quem gerencia colaboradores convida"
  on convites_colaborador for insert
  to authenticated
  with check (
    organizacao_id = organizacao_atual() and pode_gerenciar_colaboradores()
  );

create policy "quem gerencia colaboradores cancela convite"
  on convites_colaborador for delete
  to authenticated
  using (
    organizacao_id = organizacao_atual() and pode_gerenciar_colaboradores()
  );

-- -----------------------------------------------------------------------------
-- A ponte: cadastro só entra quem foi convidado
-- -----------------------------------------------------------------------------
-- Roda depois que o Supabase grava em auth.users. Havendo convite aberto
-- para aquele e-mail, cria o perfil já na organização e no cargo certos. Não
-- havendo, LEVANTA ERRO — o cadastro inteiro é desfeito, e é isso que
-- permite deixar o registro aberto no painel sem que qualquer pessoa da
-- internet entre no sistema da serralheria.
create or replace function vincular_convite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_convite convites_colaborador;
  v_permissoes record;
begin
  select * into v_convite
  from convites_colaborador
  where email = lower(trim(new.email)) and aceito_em is null;

  if not found then
    raise exception 'Não há convite aberto para %. Peça ao administrador da sua empresa.', new.email
      using errcode = 'check_violation';
  end if;

  select * into v_permissoes from permissoes_do_cargo(v_convite.papel);

  insert into perfis_usuario (
    id, organizacao_id, nome, email, telefone, papel,
    pode_movimentar_estoque, pode_gerenciar_cadastros,
    pode_gerenciar_colaboradores
  )
  values (
    new.id, v_convite.organizacao_id, v_convite.nome, lower(trim(new.email)),
    v_convite.telefone, v_convite.papel,
    v_permissoes.movimentar_estoque, v_permissoes.gerenciar_cadastros,
    v_permissoes.gerenciar_colaboradores
  );

  update convites_colaborador
  set aceito_em = now()
  where id = v_convite.id;

  return new;
end;
$$;

drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row
  execute function vincular_convite();

-- -----------------------------------------------------------------------------
-- Quem administra colaboradores
-- -----------------------------------------------------------------------------
-- As políticas antigas perguntavam por `e_administrador()`. Passam a
-- perguntar pela permissão, que é o que a etapa das permissões vai mexer.
drop policy if exists "administrador cria usuário na própria organização"
  on perfis_usuario;
drop policy if exists "editar o próprio perfil ou, sendo administrador, qualquer um"
  on perfis_usuario;

create policy "quem gerencia colaboradores cria usuário"
  on perfis_usuario for insert
  to authenticated
  with check (
    organizacao_id = organizacao_atual() and pode_gerenciar_colaboradores()
  );

create policy "editar o próprio perfil ou, podendo, o de qualquer colega"
  on perfis_usuario for update
  to authenticated
  using (
    organizacao_id = organizacao_atual()
    and (id = auth.uid() or pode_gerenciar_colaboradores())
  )
  with check (organizacao_id = organizacao_atual());

-- O gatilho contra autopromoção continua valendo e agora precisa cobrir as
-- permissões também: sem isto, qualquer pessoa se daria acesso total
-- editando o próprio perfil, que é uma coisa que ela PODE fazer.
create or replace function impedir_autopromocao()
returns trigger
language plpgsql
as $$
begin
  if new.id = auth.uid() and not pode_gerenciar_colaboradores() then
    if new.papel is distinct from old.papel
      or new.pode_movimentar_estoque is distinct from old.pode_movimentar_estoque
      or new.pode_gerenciar_cadastros is distinct from old.pode_gerenciar_cadastros
      or new.pode_gerenciar_colaboradores is distinct from old.pode_gerenciar_colaboradores
      or new.ativo is distinct from old.ativo
    then
      raise exception 'Cargo e permissões só podem ser alterados por quem gerencia colaboradores.';
    end if;
  end if;

  return new;
end;
$$;
