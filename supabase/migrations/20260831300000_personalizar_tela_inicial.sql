-- =============================================================================
-- RePerfil — Personalização dos cards da tela inicial
-- =============================================================================
--
-- Os 7 cards de "Início" (3 de resumo + 4 atalhos) eram 100% fixos no
-- código: mesmo rótulo, mesma cor, sempre os 7. Esta migração dá a cada
-- organização o controle sobre quais mostrar e a cor de fundo de cada um —
-- self-service da PRÓPRIA empresa, não uma função da central (por isso o
-- padrão aqui é o mesmo de `configuracoes_aplicacao`: uma linha por
-- organização, RLS por `organizacao_atual()`, não um singleton central como
-- `textos_institucionais`).
--
-- As cores são um conjunto FECHADO de nomes de token (não hex livre) — este
-- projeto proíbe cor literal em componente. Os atalhos (fundo escuro, texto
-- branco) não incluem vermelho de propósito: o comentário em
-- `--color-erro-*` reserva essa cor só para erro/exclusão.
-- =============================================================================

create table configuracoes_tela_inicial (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null unique references organizacoes (id) on delete cascade,

  card_disponiveis_visivel boolean not null default true,
  card_disponiveis_cor text not null default 'padrao'
    check (card_disponiveis_cor in ('padrao', 'azul', 'verde', 'amarelo', 'lilas')),
  card_metros_visivel boolean not null default true,
  card_metros_cor text not null default 'padrao'
    check (card_metros_cor in ('padrao', 'azul', 'verde', 'amarelo', 'lilas')),
  card_perfis_visivel boolean not null default true,
  card_perfis_cor text not null default 'padrao'
    check (card_perfis_cor in ('padrao', 'azul', 'verde', 'amarelo', 'lilas')),

  atalho_cadastrar_visivel boolean not null default true,
  atalho_cadastrar_cor text not null default 'azul'
    check (atalho_cadastrar_cor in ('azul', 'azul-escuro', 'grafite', 'verde', 'amarelo', 'lilas')),
  atalho_utilizar_visivel boolean not null default true,
  atalho_utilizar_cor text not null default 'azul-escuro'
    check (atalho_utilizar_cor in ('azul', 'azul-escuro', 'grafite', 'verde', 'amarelo', 'lilas')),
  atalho_perfis_visivel boolean not null default true,
  atalho_perfis_cor text not null default 'grafite'
    check (atalho_perfis_cor in ('azul', 'azul-escuro', 'grafite', 'verde', 'amarelo', 'lilas')),
  atalho_produtos_visivel boolean not null default true,
  atalho_produtos_cor text not null default 'verde'
    check (atalho_produtos_cor in ('azul', 'azul-escuro', 'grafite', 'verde', 'amarelo', 'lilas')),

  atualizado_em timestamptz not null default now()
);

comment on table configuracoes_tela_inicial is
  'Uma linha por organização: quais cards da tela inicial aparecem e a cor
   de cada um. Os valores padrão reproduzem exatamente o visual fixo de
   antes desta migração, então nenhuma empresa vê mudança até configurar.';

create trigger trg_configuracoes_tela_inicial_atualizado_em
  before update on configuracoes_tela_inicial
  for each row execute function tocar_atualizado_em();

alter table configuracoes_tela_inicial enable row level security;

create policy "ver config tela inicial da organização"
  on configuracoes_tela_inicial for select
  to authenticated
  using (organizacao_id = organizacao_atual());

create policy "administrador altera config tela inicial"
  on configuracoes_tela_inicial for update
  to authenticated
  using (organizacao_id = organizacao_atual() and e_administrador())
  with check (organizacao_id = organizacao_atual());

create policy "administrador cria config tela inicial"
  on configuracoes_tela_inicial for insert
  to authenticated
  with check (organizacao_id = organizacao_atual() and e_administrador());

-- Toda organização já existente ganha a linha com os valores padrão, sem
-- precisar de ação manual.
insert into configuracoes_tela_inicial (organizacao_id)
select id from organizacoes;

-- -----------------------------------------------------------------------------
-- Nova organização (cadastro self-service) já nasce com a linha
-- -----------------------------------------------------------------------------
-- Mesmo corpo de `vincular_convite()` (última versão em
-- `20260826100000_confirmacao_via_convite.sql`), só acrescentando o insert
-- em `configuracoes_tela_inicial` logo depois do de `configuracoes_aplicacao`.
create or replace function vincular_convite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_convite convites_colaborador;
  v_permissoes record;
  v_nome_empresa text;
  v_nome_pessoa text;
  v_cnpj text;
  v_telefone text;
  v_organizacao_id uuid;
  v_veio_do_link boolean;
begin
  select * into v_convite
  from convites_colaborador
  where email = lower(trim(new.email))
    and aceito_em is null
    and expira_em > now();

  -- Caminho de sempre: alguém convidado por uma empresa que já existe.
  if found then
    select * into v_permissoes from permissoes_do_cargo(v_convite.papel);

    -- Só conta como "veio do link do convite" se o id bater com o MESMO
    -- convite encontrado agora — um id chutado, de outro convite ou
    -- inventado, não prova nada e cai no caminho que ainda exige
    -- confirmação por e-mail antes de liberar o app.
    v_veio_do_link := (new.raw_user_meta_data ->> 'convite_id') = v_convite.id::text;

    insert into perfis_usuario (
      id, organizacao_id, nome, email, telefone, papel,
      pode_movimentar_estoque, pode_gerenciar_cadastros,
      pode_gerenciar_colaboradores, email_confirmado_em
    )
    values (
      new.id, v_convite.organizacao_id, v_convite.nome, lower(trim(new.email)),
      v_convite.telefone, v_convite.papel,
      v_permissoes.movimentar_estoque, v_permissoes.gerenciar_cadastros,
      v_permissoes.gerenciar_colaboradores,
      case when v_veio_do_link then now() else null end
    );

    update convites_colaborador
    set aceito_em = now()
    where id = v_convite.id;

    return new;
  end if;

  -- Sem convite: só passa vindo da tela "Criar minha empresa", com os
  -- quatro campos preenchidos. Qualquer outra tentativa de cadastro sem
  -- convite continua recusada, como sempre.
  v_nome_empresa := nullif(trim(new.raw_user_meta_data ->> 'nome_empresa'), '');
  v_nome_pessoa := nullif(trim(new.raw_user_meta_data ->> 'nome'), '');
  v_cnpj := nullif(trim(new.raw_user_meta_data ->> 'cnpj'), '');
  v_telefone := nullif(trim(new.raw_user_meta_data ->> 'telefone'), '');

  if new.raw_user_meta_data ->> 'criar_organizacao' is distinct from 'true'
     or v_nome_empresa is null
     or v_nome_pessoa is null
     or v_cnpj is null
     or v_telefone is null
  then
    raise exception 'Não há convite aberto para %. Peça ao administrador da sua empresa.', new.email
      using errcode = 'check_violation';
  end if;

  insert into organizacoes (codigo, nome_fantasia, cnpj, telefone, email)
  values (
    'ORG-' || gerar_sufixo_codigo(4), v_nome_empresa, v_cnpj, v_telefone,
    lower(trim(new.email))
  )
  returning id into v_organizacao_id;

  insert into configuracoes_aplicacao (organizacao_id) values (v_organizacao_id);
  insert into configuracoes_tela_inicial (organizacao_id) values (v_organizacao_id);

  select * into v_permissoes from permissoes_do_cargo('administrador');

  -- Sem link nenhum para provar posse do e-mail — precisa confirmar
  -- separado, como qualquer cadastro sem convite.
  insert into perfis_usuario (
    id, organizacao_id, nome, email, telefone, papel,
    pode_movimentar_estoque, pode_gerenciar_cadastros,
    pode_gerenciar_colaboradores, email_confirmado_em
  )
  values (
    new.id, v_organizacao_id, v_nome_pessoa, lower(trim(new.email)), v_telefone,
    'administrador',
    v_permissoes.movimentar_estoque, v_permissoes.gerenciar_cadastros,
    v_permissoes.gerenciar_colaboradores, null
  );

  return new;
end;
$$;
