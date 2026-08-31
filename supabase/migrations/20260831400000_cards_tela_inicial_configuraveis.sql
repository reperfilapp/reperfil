-- =============================================================================
-- RePerfil — Cards da tela inicial: catálogo livre, não mais 7 posições fixas
-- =============================================================================
--
-- A migração anterior (`20260831300000`) tratava os 7 cards como 7 colunas
-- fixas — cada uma só liga/desliga O MESMO destino de sempre. Na prática a
-- empresa quer mais que isso: escolher QUAL destino aparece (de um
-- catálogo maior, incluindo itens hoje só na tela "Mais"), e quantos —
-- não sempre 3 e 4. Uma linha por card fixo não modela "quantidade
-- variável" nem "qualquer item do catálogo"; substituída aqui por uma
-- linha POR CARD ESCOLHIDO (zero linhas = nenhum card daquele grupo).
--
-- `configuracoes_tela_inicial` foi criada hoje mesmo, sem dado real além
-- dos padrões — descartada sem perda.
-- =============================================================================

drop trigger if exists trg_configuracoes_tela_inicial_atualizado_em on configuracoes_tela_inicial;
drop table if exists configuracoes_tela_inicial;

create type grupo_card_tela_inicial as enum ('resumo', 'atalho');

create table cards_tela_inicial (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes (id) on delete cascade,

  grupo grupo_card_tela_inicial not null,
  -- Chave do catálogo (ver `src/dominio/telaInicial.ts`) — não é uma FK
  -- porque o catálogo é fixo no código, não uma tabela.
  item text not null,
  cor text not null,
  -- Ordem de exibição dentro do grupo. Menor aparece primeiro.
  ordem integer not null default 0,

  criado_em timestamptz not null default now(),

  unique (organizacao_id, grupo, item),

  constraint item_do_catalogo check (
    (grupo = 'resumo' and item in ('disponiveis', 'metros', 'perfis', 'linhas', 'produtos'))
    or
    (grupo = 'atalho' and item in (
      'cadastrar', 'utilizar', 'perfis', 'produtos',
      'procurar', 'identificar', 'inventario', 'acessorios'
    ))
  ),
  constraint cor_do_grupo check (
    (grupo = 'resumo' and cor in ('padrao', 'azul', 'verde', 'amarelo', 'lilas'))
    or
    (grupo = 'atalho' and cor in ('azul', 'azul-escuro', 'grafite', 'verde', 'amarelo', 'lilas'))
  )
);

comment on table cards_tela_inicial is
  'Um card escolhido pela organização para a tela inicial, por linha —
   zero linhas de um grupo (resumo/atalho) significa nenhum card daquele
   grupo aparece. Item e cor são chaves do catálogo fixo em
   src/dominio/telaInicial.ts, nunca texto livre.';

create index idx_cards_tela_inicial_organizacao
  on cards_tela_inicial (organizacao_id, grupo, ordem);

alter table cards_tela_inicial enable row level security;

create policy "ver cards da tela inicial da organização"
  on cards_tela_inicial for select
  to authenticated
  using (organizacao_id = organizacao_atual());

create policy "administrador escolhe cards da tela inicial"
  on cards_tela_inicial for insert
  to authenticated
  with check (organizacao_id = organizacao_atual() and e_administrador());

create policy "administrador remove cards da tela inicial"
  on cards_tela_inicial for delete
  to authenticated
  using (organizacao_id = organizacao_atual() and e_administrador());

-- -----------------------------------------------------------------------------
-- Padrão: reproduz exatamente os 7 cards fixos de antes desta migração —
-- nenhuma empresa vê qualquer mudança até entrar e escolher outra coisa.
-- -----------------------------------------------------------------------------
insert into cards_tela_inicial (organizacao_id, grupo, item, cor, ordem)
select id, 'resumo', v.item, v.cor, v.ordem
from organizacoes
cross join (values
  ('disponiveis', 'padrao', 0),
  ('metros',      'padrao', 1),
  ('perfis',      'padrao', 2)
) as v(item, cor, ordem);

insert into cards_tela_inicial (organizacao_id, grupo, item, cor, ordem)
select id, 'atalho', v.item, v.cor, v.ordem
from organizacoes
cross join (values
  ('cadastrar', 'azul',        0),
  ('utilizar',  'azul-escuro', 1),
  ('perfis',    'grafite',     2),
  ('produtos',  'verde',       3)
) as v(item, cor, ordem);

-- -----------------------------------------------------------------------------
-- Nova organização (cadastro self-service) já nasce com os mesmos padrões
-- -----------------------------------------------------------------------------
-- Mesmo corpo de `vincular_convite()`, trocando o insert em
-- `configuracoes_tela_inicial` (que não existe mais) pelos inserts acima,
-- linha a linha, para a organização recém-criada.
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

  insert into cards_tela_inicial (organizacao_id, grupo, item, cor, ordem) values
    (v_organizacao_id, 'resumo', 'disponiveis', 'padrao', 0),
    (v_organizacao_id, 'resumo', 'metros',      'padrao', 1),
    (v_organizacao_id, 'resumo', 'perfis',      'padrao', 2),
    (v_organizacao_id, 'atalho', 'cadastrar', 'azul',        0),
    (v_organizacao_id, 'atalho', 'utilizar',  'azul-escuro', 1),
    (v_organizacao_id, 'atalho', 'perfis',    'grafite',     2),
    (v_organizacao_id, 'atalho', 'produtos',  'verde',       3);

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
