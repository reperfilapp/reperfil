-- =============================================================================
-- RePerfil — Estoque: lotes de sobras, reservas e movimentações
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Lotes de sobras
-- -----------------------------------------------------------------------------
-- Peças IDÊNTICAS (mesmo modelo, acabamento, comprimento e localização) são
-- cadastradas juntas como lote, informando a quantidade uma única vez. Mas o
-- consumo é sempre unitário: ao cortar uma peça, a quantidade do lote cai em
-- uma e a sobra resultante vira um lote novo, com o comprimento restante.
create type status_lote as enum (
  'disponivel',
  'reservada',      -- toda a quantidade está reservada
  'consumida',
  'descartada',
  'em_conferencia'
);

create type estado_conservacao as enum (
  'bom',
  'regular',
  'ruim'
);

create table lotes_sobras (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes (id) on delete cascade,
  codigo text not null,

  modelo_perfil_id uuid not null references modelos_perfil (id) on delete restrict,
  acabamento_id uuid not null references acabamentos (id) on delete restrict,
  localizacao_id uuid references localizacoes (id) on delete set null,

  comprimento_mm integer not null,
  quantidade integer not null default 1,
  quantidade_reservada integer not null default 0,

  estado estado_conservacao not null default 'bom',
  status status_lote not null default 'disponivel',
  foto_url text,

  origem text,                     -- de onde veio a ponta
  obra_origem text,

  -- Rastreia a peça de onde este resto saiu, formando a corrente de
  -- reaproveitamento: barra nova → sobra → sobra menor.
  lote_origem_id uuid references lotes_sobras (id) on delete set null,

  observacoes text,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfis_usuario (id),
  -- Detecta edição concorrente: quem gravar com versão velha é rejeitado.
  versao integer not null default 1,

  constraint lotes_sobras_codigo_unico unique (organizacao_id, codigo),
  constraint lotes_sobras_comprimento_valido
    check (comprimento_mm > 0 and comprimento_mm <= 18000),
  constraint lotes_sobras_quantidade_valida
    check (quantidade >= 0 and quantidade <= 9999),
  -- A trava central contra reserva dupla: nunca dá para reservar mais do que
  -- existe, nem número negativo. Mesmo que a aplicação erre, o banco recusa.
  constraint lotes_sobras_reserva_coerente
    check (quantidade_reservada >= 0 and quantidade_reservada <= quantidade)
);

comment on table lotes_sobras is
  'Sobras em estoque, agrupadas por peças idênticas. Consumo sempre unitário.';
comment on column lotes_sobras.quantidade_reservada is
  'Quantas unidades do lote estão reservadas. Disponível = quantidade - esta.
   A restrição de integridade impede reservar mais do que existe.';
comment on column lotes_sobras.lote_origem_id is
  'Lote de onde este resto saiu, formando a corrente de reaproveitamento.';

create index idx_lotes_organizacao on lotes_sobras (organizacao_id);
create index idx_lotes_codigo on lotes_sobras (organizacao_id, codigo);
create index idx_lotes_modelo on lotes_sobras (organizacao_id, modelo_perfil_id);
create index idx_lotes_acabamento on lotes_sobras (organizacao_id, acabamento_id);
create index idx_lotes_localizacao on lotes_sobras (localizacao_id);
create index idx_lotes_status on lotes_sobras (organizacao_id, status);
-- Índice da pesquisa mais frequente: peças disponíveis de um modelo e
-- acabamento, com comprimento suficiente, da mais curta para a mais longa
-- (para gastar as pontas ruins antes das boas).
create index idx_lotes_pesquisa on lotes_sobras
  (organizacao_id, modelo_perfil_id, acabamento_id, comprimento_mm)
  where status = 'disponivel';

-- -----------------------------------------------------------------------------
-- Reservas
-- -----------------------------------------------------------------------------
create type status_reserva as enum (
  'ativa',
  'retirada',       -- peça já saiu da prateleira
  'consumida',      -- corte confirmado
  'cancelada',
  'expirada'
);

create table reservas (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes (id) on delete cascade,
  codigo text not null,

  lote_id uuid not null references lotes_sobras (id) on delete restrict,
  quantidade integer not null default 1,

  status status_reserva not null default 'ativa',
  expira_em timestamptz not null,

  -- Preenchido na confirmação do corte.
  comprimento_utilizado_mm integer,
  lote_resultante_id uuid references lotes_sobras (id) on delete set null,

  observacoes text,
  motivo_cancelamento text,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfis_usuario (id),
  retirada_em timestamptz,
  consumida_em timestamptz,

  constraint reservas_codigo_unico unique (organizacao_id, codigo),
  constraint reservas_quantidade_positiva check (quantidade > 0),
  constraint reservas_utilizado_valido
    check (comprimento_utilizado_mm is null or comprimento_utilizado_mm > 0)
);

create index idx_reservas_organizacao on reservas (organizacao_id);
create index idx_reservas_lote on reservas (lote_id);
create index idx_reservas_status on reservas (organizacao_id, status);
-- Usado pela rotina que expira reservas vencidas.
create index idx_reservas_expiracao on reservas (expira_em)
  where status = 'ativa';

-- -----------------------------------------------------------------------------
-- Movimentações de estoque — o histórico, que nunca é apagado
-- -----------------------------------------------------------------------------
create type tipo_movimentacao as enum (
  'entrada',
  'edicao',
  'reserva',
  'cancelamento_reserva',
  'expiracao_reserva',
  'retirada',
  'corte',
  'devolucao',
  'transferencia',
  'ajuste',
  'descarte'
);

create table movimentacoes_estoque (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes (id) on delete cascade,

  lote_id uuid not null references lotes_sobras (id) on delete restrict,
  reserva_id uuid references reservas (id) on delete set null,

  tipo tipo_movimentacao not null,
  quantidade integer not null default 1,
  comprimento_mm integer,

  -- Correção de estoque EXIGE justificativa. A regra é aplicada por restrição,
  -- não por confiança na tela.
  justificativa text,

  localizacao_anterior_id uuid references localizacoes (id) on delete set null,
  localizacao_nova_id uuid references localizacoes (id) on delete set null,

  detalhes jsonb,

  criado_em timestamptz not null default now(),
  criado_por uuid references perfis_usuario (id),

  constraint movimentacoes_ajuste_exige_justificativa
    check (
      tipo not in ('ajuste', 'descarte')
      or (justificativa is not null and length(trim(justificativa)) >= 5)
    )
);

comment on table movimentacoes_estoque is
  'Histórico imutável. Não há política de UPDATE nem DELETE: erro se corrige
   com uma movimentação de ajuste, nunca apagando o passado.';

create index idx_movimentacoes_organizacao on movimentacoes_estoque (organizacao_id);
create index idx_movimentacoes_lote on movimentacoes_estoque (lote_id, criado_em desc);
create index idx_movimentacoes_usuario on movimentacoes_estoque (criado_por, criado_em desc);
create index idx_movimentacoes_periodo on movimentacoes_estoque (organizacao_id, criado_em desc);

-- -----------------------------------------------------------------------------
-- Gatilhos
-- -----------------------------------------------------------------------------
create trigger trg_lotes_sobras_atualizado_em
  before update on lotes_sobras
  for each row execute function tocar_atualizado_em();

create trigger trg_reservas_atualizado_em
  before update on reservas
  for each row execute function tocar_atualizado_em();

-- Incrementa a versão a cada alteração do lote, para detectar edição
-- concorrente sem sobrescrever silenciosamente.
create or replace function incrementar_versao_lote()
returns trigger
language plpgsql
as $$
begin
  new.versao := old.versao + 1;
  return new;
end;
$$;

create trigger trg_lotes_sobras_versao
  before update on lotes_sobras
  for each row execute function incrementar_versao_lote();
