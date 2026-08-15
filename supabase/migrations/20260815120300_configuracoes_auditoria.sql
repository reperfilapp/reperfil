-- =============================================================================
-- RePerfil — Configurações de cálculo e trilha de auditoria
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Configurações do cálculo
-- -----------------------------------------------------------------------------
-- Estes valores NÃO podem ficar fixos no código: variam por oficina, por
-- serra e por tipo de produto. Uma linha por organização.
create type prioridade_sobra as enum (
  'menor_sobra',      -- gasta as pontas ruins antes das boas (padrão)
  'mais_antiga',      -- desova estoque parado
  'menor_deslocamento' -- prioriza quem está mais perto na prateleira
);

create table configuracoes_aplicacao (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null unique references organizacoes (id) on delete cascade,

  comprimento_barra_padrao_mm integer not null default 6000,

  -- A espessura real do disco. Errar aqui faz o sistema prometer cortes que
  -- não cabem — o defeito que o RePerfil existe para eliminar.
  espessura_serra_mm integer not null default 3,
  margem_limpeza_mm integer not null default 0,
  comprimento_minimo_sobra_mm integer not null default 300,

  -- Convenção D4: o último corte não gera perda quando termina no fim da
  -- peça. Se a oficina trabalhar de outro jeito, o administrador inverte.
  ultimo_corte_gera_perda boolean not null default false,

  prazo_reserva_horas integer not null default 48,
  prioridade_utilizacao prioridade_sobra not null default 'menor_sobra',
  considerar_perfis_equivalentes boolean not null default false,

  -- Antes do primeiro cálculo em produção, o administrador é obrigado a
  -- confirmar a espessura da serra e o mínimo de sobra aproveitável. Enquanto
  -- isto for falso, a interface avisa que os valores são presumidos.
  confirmado_pelo_administrador boolean not null default false,
  confirmado_em timestamptz,
  confirmado_por uuid references perfis_usuario (id),

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint config_barra_valida
    check (comprimento_barra_padrao_mm > 0 and comprimento_barra_padrao_mm <= 18000),
  constraint config_serra_valida
    check (espessura_serra_mm >= 0 and espessura_serra_mm <= 50),
  constraint config_margem_valida
    check (margem_limpeza_mm >= 0 and margem_limpeza_mm <= 500),
  constraint config_minimo_sobra_valido
    check (comprimento_minimo_sobra_mm >= 0 and comprimento_minimo_sobra_mm <= 6000),
  constraint config_prazo_valido
    check (prazo_reserva_horas > 0 and prazo_reserva_horas <= 8760)
);

comment on table configuracoes_aplicacao is
  'Parâmetros do cálculo de corte, por organização. Nunca fixos no código.';
comment on column configuracoes_aplicacao.confirmado_pelo_administrador is
  'Falso significa que a espessura da serra e o mínimo de sobra ainda são
   valores presumidos, não medidos na oficina. A interface deve avisar.';

create trigger trg_configuracoes_atualizado_em
  before update on configuracoes_aplicacao
  for each row execute function tocar_atualizado_em();

-- -----------------------------------------------------------------------------
-- Trilha de auditoria
-- -----------------------------------------------------------------------------
-- Diferente de movimentacoes_estoque, que é o histórico de negócio: esta
-- tabela registra QUEM mudou O QUÊ, para investigação. Também é imutável.
create table registros_auditoria (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes (id) on delete cascade,

  tabela text not null,
  registro_id uuid not null,
  acao text not null,              -- 'insercao', 'atualizacao', 'exclusao'

  dados_antes jsonb,
  dados_depois jsonb,

  usuario_id uuid references perfis_usuario (id),
  criado_em timestamptz not null default now()
);

comment on table registros_auditoria is
  'Quem mudou o quê. Imutável: sem política de UPDATE ou DELETE.';

create index idx_auditoria_organizacao on registros_auditoria (organizacao_id, criado_em desc);
create index idx_auditoria_registro on registros_auditoria (tabela, registro_id, criado_em desc);
create index idx_auditoria_usuario on registros_auditoria (usuario_id, criado_em desc);

-- -----------------------------------------------------------------------------
-- Gatilho genérico de auditoria
-- -----------------------------------------------------------------------------
create or replace function registrar_auditoria()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid;
  v_registro_id uuid;
begin
  if (tg_op = 'DELETE') then
    v_organizacao_id := old.organizacao_id;
    v_registro_id := old.id;
  else
    v_organizacao_id := new.organizacao_id;
    v_registro_id := new.id;
  end if;

  insert into registros_auditoria (
    organizacao_id, tabela, registro_id, acao,
    dados_antes, dados_depois, usuario_id
  )
  values (
    v_organizacao_id,
    tg_table_name,
    v_registro_id,
    lower(tg_op),
    case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end,
    case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end,
    auth.uid()
  );

  return coalesce(new, old);
end;
$$;

create trigger trg_auditoria_lotes_sobras
  after insert or update or delete on lotes_sobras
  for each row execute function registrar_auditoria();

create trigger trg_auditoria_reservas
  after insert or update or delete on reservas
  for each row execute function registrar_auditoria();

create trigger trg_auditoria_modelos_perfil
  after insert or update or delete on modelos_perfil
  for each row execute function registrar_auditoria();

create trigger trg_auditoria_acabamentos
  after insert or update or delete on acabamentos
  for each row execute function registrar_auditoria();

create trigger trg_auditoria_clientes
  after insert or update or delete on clientes
  for each row execute function registrar_auditoria();

create trigger trg_auditoria_configuracoes
  after insert or update or delete on configuracoes_aplicacao
  for each row execute function registrar_auditoria();
