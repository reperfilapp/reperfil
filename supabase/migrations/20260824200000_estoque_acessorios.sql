-- =============================================================================
-- RePerfil — Estoque de acessórios (dobradiça, roldana, puxador, borracha...)
-- =============================================================================
--
-- POR QUE NÃO REAPROVEITAR `lotes_sobras` DIRETO
--
-- Toda a tabela de sobras gira em torno de CORTE: `comprimento_mm` não aceita
-- nulo, existe para calcular quanto cabe numa barra e o que sobra depois de
-- cortada. Um acessório não tem comprimento e não se corta — forçá-lo ali
-- significaria inventar um número que não quer dizer nada, e ele apareceria
-- em toda tela que hoje mostra "comprimento" (etiqueta, busca, ficha).
--
-- Por isso a estrutura é paralela: mesmo padrão de organização por empresa,
-- mesma ideia de lote e localização, mas sem nada de comprimento ou corte.
-- Acessório TEM cor (um puxador branco e um preto são estoques diferentes),
-- por isso `acabamento_id` continua aqui — só que opcional, porque nem todo
-- acessório tem cor relevante (um parafuso, por exemplo).
--
-- A baixa do dia a dia é DIRETA — digita quanto usou, confirma — e não passa
-- por reserva: reserva existe nas sobras por causa do corte, que aqui não
-- existe.
-- =============================================================================

create table modelos_acessorio (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes (id) on delete cascade,
  codigo text not null,

  descricao text not null,
  fabricante text,
  categoria text,          -- "dobradiça", "roldana", "puxador", "borracha"...
  unidade_medida text not null default 'peça',

  imagem_url text,
  codigo_barras text,

  preco_unitario_centavos integer,

  observacoes text,
  ativo boolean not null default true,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfis_usuario (id),

  constraint modelos_acessorio_codigo_unico unique (organizacao_id, codigo),
  constraint modelos_acessorio_preco_positivo
    check (preco_unitario_centavos is null or preco_unitario_centavos >= 0)
);

comment on table modelos_acessorio is
  'Catálogo de acessórios — paralelo a modelos_perfil, sem os campos de
   comprimento/seção que só fazem sentido para perfil de alumínio.';

create index idx_modelos_acessorio_organizacao on modelos_acessorio (organizacao_id);
create index idx_modelos_acessorio_codigo on modelos_acessorio (organizacao_id, codigo);
create index idx_modelos_acessorio_ativo
  on modelos_acessorio (organizacao_id, ativo) where ativo;
create index idx_modelos_acessorio_busca on modelos_acessorio
  using gin ((codigo || ' ' || descricao) gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- Lotes de acessório
-- -----------------------------------------------------------------------------
create table lotes_acessorio (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes (id) on delete cascade,
  codigo text not null,

  modelo_acessorio_id uuid not null references modelos_acessorio (id) on delete restrict,
  -- Opcional: nem todo acessório tem cor que importa rastrear separado.
  acabamento_id uuid references acabamentos (id) on delete restrict,
  localizacao_id uuid references localizacoes (id) on delete set null,

  quantidade integer not null default 1,
  estado estado_conservacao not null default 'bom',
  status status_lote not null default 'disponivel',
  foto_url text,

  observacoes text,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfis_usuario (id),
  versao integer not null default 1,

  constraint lotes_acessorio_codigo_unico unique (organizacao_id, codigo),
  constraint lotes_acessorio_quantidade_valida check (quantidade >= 0)
);

comment on table lotes_acessorio is
  'Estoque de acessórios — paralelo a lotes_sobras, sem comprimento nem
   reserva: a baixa do dia a dia é direta (ver usar_acessorio).';

create index idx_lotes_acessorio_organizacao on lotes_acessorio (organizacao_id);
create index idx_lotes_acessorio_modelo on lotes_acessorio (modelo_acessorio_id);
create index idx_lotes_acessorio_localizacao on lotes_acessorio (localizacao_id);
create index idx_lotes_acessorio_status
  on lotes_acessorio (organizacao_id, status);

create trigger trg_lotes_acessorio_atualizado_em
  before update on lotes_acessorio
  for each row execute function tocar_atualizado_em();

-- Mesma proteção contra edição concorrente que lotes_sobras já usa.
create trigger trg_lotes_acessorio_versao
  before update on lotes_acessorio
  for each row execute function incrementar_versao_lote();

-- -----------------------------------------------------------------------------
-- Histórico de movimentações do acessório
-- -----------------------------------------------------------------------------
-- Tipos próprios, e não os de `tipo_movimentacao`: não existe reserva, corte
-- ou retirada aqui — só entrada, uso direto, ajuste e descarte.
create type tipo_movimentacao_acessorio as enum (
  'entrada',
  'uso',
  'ajuste',
  'descarte',
  'transferencia'
);

create table movimentacoes_acessorio (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes (id) on delete cascade,
  lote_id uuid not null references lotes_acessorio (id) on delete restrict,
  tipo tipo_movimentacao_acessorio not null,
  quantidade integer not null,
  justificativa text,
  detalhes jsonb,

  criado_em timestamptz not null default now(),
  criado_por uuid references perfis_usuario (id)
);

comment on table movimentacoes_acessorio is
  'Histórico de acessórios — só gravado pelas funções abaixo, nunca por
   escrita direta da tela (mesma regra de movimentacoes_estoque).';

create index idx_movimentacoes_acessorio_lote on movimentacoes_acessorio (lote_id);
create index idx_movimentacoes_acessorio_organizacao
  on movimentacoes_acessorio (organizacao_id, criado_em desc);

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table modelos_acessorio enable row level security;
alter table lotes_acessorio enable row level security;
alter table movimentacoes_acessorio enable row level security;

create policy "ver acessorios da organizacao"
  on modelos_acessorio for select
  to authenticated
  using (organizacao_id = organizacao_atual());

create policy "estoque cadastra modelos de acessorio"
  on modelos_acessorio for insert
  to authenticated
  with check (organizacao_id = organizacao_atual() and pode_movimentar_estoque());

create policy "estoque edita modelos de acessorio"
  on modelos_acessorio for update
  to authenticated
  using (organizacao_id = organizacao_atual() and pode_movimentar_estoque())
  with check (organizacao_id = organizacao_atual());

create policy "estoque apaga modelos de acessorio sem uso"
  on modelos_acessorio for delete
  to authenticated
  using (organizacao_id = organizacao_atual() and pode_movimentar_estoque());

create policy "ver lotes de acessorio da organizacao"
  on lotes_acessorio for select
  to authenticated
  using (organizacao_id = organizacao_atual());

create policy "estoque cadastra lotes de acessorio"
  on lotes_acessorio for insert
  to authenticated
  with check (organizacao_id = organizacao_atual() and pode_movimentar_estoque());

-- A quantidade só muda pelas funções abaixo (travam a linha antes de
-- alterar); esta política cobre os demais campos (localização, estado,
-- observações, foto).
create policy "estoque edita lotes de acessorio"
  on lotes_acessorio for update
  to authenticated
  using (organizacao_id = organizacao_atual() and pode_movimentar_estoque())
  with check (organizacao_id = organizacao_atual());

create policy "ver movimentacoes de acessorio da organizacao"
  on movimentacoes_acessorio for select
  to authenticated
  using (organizacao_id = organizacao_atual());

-- -----------------------------------------------------------------------------
-- Cadastrar lote de acessório
-- -----------------------------------------------------------------------------
create or replace function cadastrar_lote_acessorio(
  p_modelo_acessorio_id uuid,
  p_quantidade integer default 1,
  p_acabamento_id uuid default null,
  p_localizacao_id uuid default null,
  p_estado estado_conservacao default 'bom',
  p_foto_url text default null,
  p_observacoes text default null
)
returns lotes_acessorio
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid := organizacao_atual();
  v_lote lotes_acessorio;
begin
  if v_organizacao_id is null then
    raise exception 'Usuário sem organização ativa.'
      using errcode = 'insufficient_privilege';
  end if;

  if not pode_movimentar_estoque() then
    raise exception 'Seu perfil não permite cadastrar acessórios.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_quantidade is null or p_quantidade < 1 then
    raise exception 'A quantidade precisa ser pelo menos 1.'
      using errcode = 'check_violation';
  end if;

  if not exists (
    select 1 from modelos_acessorio
    where id = p_modelo_acessorio_id and organizacao_id = v_organizacao_id
  ) then
    raise exception 'Acessório não encontrado nesta organização.'
      using errcode = 'foreign_key_violation';
  end if;

  if p_acabamento_id is not null and not exists (
    select 1 from acabamentos
    where id = p_acabamento_id and organizacao_id = v_organizacao_id
  ) then
    raise exception 'Acabamento não encontrado nesta organização.'
      using errcode = 'foreign_key_violation';
  end if;

  insert into lotes_acessorio (
    organizacao_id, codigo, modelo_acessorio_id, acabamento_id, localizacao_id,
    quantidade, estado, foto_url, observacoes, criado_por
  )
  values (
    v_organizacao_id,
    gerar_codigo_unico(v_organizacao_id, 'AC', 'lotes_acessorio'),
    p_modelo_acessorio_id, p_acabamento_id, p_localizacao_id,
    p_quantidade, p_estado, p_foto_url, p_observacoes, auth.uid()
  )
  returning * into v_lote;

  insert into movimentacoes_acessorio (
    organizacao_id, lote_id, tipo, quantidade, criado_por
  )
  values (v_organizacao_id, v_lote.id, 'entrada', p_quantidade, auth.uid());

  return v_lote;
end;
$$;

comment on function cadastrar_lote_acessorio is
  'Cadastra estoque de acessório e registra a entrada no histórico.';

grant execute on function cadastrar_lote_acessorio to authenticated;

-- -----------------------------------------------------------------------------
-- Usar acessório — baixa direta, sem reserva
-- -----------------------------------------------------------------------------
create or replace function usar_acessorio(
  p_lote_id uuid,
  p_quantidade integer,
  p_justificativa text default null
)
returns lotes_acessorio
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid := organizacao_atual();
  v_lote lotes_acessorio;
begin
  if not pode_movimentar_estoque() then
    raise exception 'Seu perfil não permite dar baixa em acessórios.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_lote
  from lotes_acessorio
  where id = p_lote_id and organizacao_id = v_organizacao_id
  for update;

  if not found then
    raise exception 'Acessório não encontrado.' using errcode = 'no_data_found';
  end if;

  if p_quantidade is null or p_quantidade < 1 then
    raise exception 'A quantidade usada precisa ser pelo menos 1.'
      using errcode = 'check_violation';
  end if;

  if p_quantidade > v_lote.quantidade then
    raise exception 'Só há % unidade(s) disponível(is).', v_lote.quantidade
      using errcode = 'check_violation';
  end if;

  update lotes_acessorio
  set quantidade = quantidade - p_quantidade,
      status = case
        when quantidade - p_quantidade <= 0 then 'consumida'::status_lote
        else 'disponivel'::status_lote
      end
  where id = p_lote_id
  returning * into v_lote;

  insert into movimentacoes_acessorio (
    organizacao_id, lote_id, tipo, quantidade, justificativa, criado_por
  )
  values (v_organizacao_id, p_lote_id, 'uso', p_quantidade, p_justificativa, auth.uid());

  return v_lote;
end;
$$;

comment on function usar_acessorio is
  'Baixa direta de acessório — sem reserva, porque não há corte a calcular.';

grant execute on function usar_acessorio to authenticated;

-- -----------------------------------------------------------------------------
-- Corrigir a quantidade de um lote de acessório já cadastrado
-- -----------------------------------------------------------------------------
create or replace function ajustar_quantidade_acessorio(
  p_lote_id uuid,
  p_nova_quantidade integer,
  p_justificativa text
)
returns lotes_acessorio
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid := organizacao_atual();
  v_lote lotes_acessorio;
  v_quantidade_anterior integer;
begin
  if not pode_movimentar_estoque() then
    raise exception 'Seu perfil não permite ajustar o estoque.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_nova_quantidade is null or p_nova_quantidade < 0 then
    raise exception 'A quantidade não pode ser negativa.'
      using errcode = 'check_violation';
  end if;

  if p_justificativa is null or length(trim(p_justificativa)) < 5 then
    raise exception
      'Descreva o motivo do ajuste (pelo menos 5 letras) — fica registrado no histórico.'
      using errcode = 'check_violation';
  end if;

  select * into v_lote
  from lotes_acessorio
  where id = p_lote_id and organizacao_id = v_organizacao_id
  for update;

  if not found then
    raise exception 'Acessório não encontrado.' using errcode = 'no_data_found';
  end if;

  if p_nova_quantidade = v_lote.quantidade then
    raise exception 'A quantidade informada já é a atual — nada para ajustar.'
      using errcode = 'check_violation';
  end if;

  v_quantidade_anterior := v_lote.quantidade;

  update lotes_acessorio
  set quantidade = p_nova_quantidade,
      status = case
        when p_nova_quantidade = 0 then 'descartada'::status_lote
        else 'disponivel'::status_lote
      end
  where id = p_lote_id
  returning * into v_lote;

  insert into movimentacoes_acessorio (
    organizacao_id, lote_id, tipo, quantidade, justificativa, detalhes, criado_por
  )
  values (
    v_organizacao_id, v_lote.id, 'ajuste', p_nova_quantidade - v_quantidade_anterior,
    p_justificativa,
    jsonb_build_object(
      'quantidade_anterior', v_quantidade_anterior,
      'quantidade_nova', p_nova_quantidade
    ),
    auth.uid()
  );

  return v_lote;
end;
$$;

comment on function ajustar_quantidade_acessorio is
  'Corrige a quantidade de um lote de acessório já cadastrado — para erro de
   digitação, não para consumo (que é usar_acessorio).';

grant execute on function ajustar_quantidade_acessorio to authenticated;
