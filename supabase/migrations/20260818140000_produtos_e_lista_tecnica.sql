-- Produtos prontos e a lista técnica de cada um.
--
-- ── O QUE ISTO RESPONDE ──────────────────────────────────────────────────
--
-- "Chegou um pedido de janela integrada 1,50 × 1,00. Dá para fazer com o que
-- está na prateleira, ou preciso comprar barra?" Sem isto, a resposta exige
-- alguém que conheça a receita de cabeça E lembre do que existe no depósito
-- — duas memórias que raramente estão na mesma pessoa no mesmo dia.
--
-- ── RELAÇÃO COM AS TIPOLOGIAS DA FASE 2 ──────────────────────────────────
--
-- A Fase 2 prevê tipologias PARAMÉTRICAS: informa-se largura e altura, e
-- fórmulas versionadas calculam os cortes. Isto aqui é o degrau anterior — a
-- lista é digitada à mão, para uma medida fixa. Não é desperdício: quando as
-- fórmulas existirem, elas passam a GERAR estas linhas, e a tela de
-- viabilidade continua a mesma. O caminho contrário (começar pelas fórmulas)
-- exigiria acertar o motor de regras antes de a empresa ter usado a coisa
-- mais simples uma vez.

create table if not exists produtos (
  id uuid primary key default gen_random_uuid(),
  -- Preenchida pelo banco, como nos demais cadastros: o aplicativo não
  -- informa, então não tem como informar errado.
  organizacao_id uuid not null default organizacao_atual()
    references organizacoes (id) on delete cascade,

  codigo text not null,
  nome text not null,
  descricao text,

  -- Medidas do produto ACABADO, não de corte: é assim que o cliente pede
  -- ("janela 1,50 por 1,00") e é assim que se procura na lista.
  largura_mm integer,
  altura_mm integer,

  observacoes text,
  ativo boolean not null default true,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),

  constraint codigo_unico_por_organizacao unique (organizacao_id, codigo)
);

comment on table produtos is
  'Itens prontos que a serralheria fabrica: portas, janelas, portões. A
   receita de cada um está em itens_lista_tecnica.';

create index if not exists idx_produtos_organizacao on produtos (organizacao_id);

-- -----------------------------------------------------------------------------
-- A lista técnica
-- -----------------------------------------------------------------------------
-- Uma linha por corte necessário. `quantidade` é POR UNIDADE do produto — ela
-- responde "quantas peças destas entram em uma janela?", nunca "quantas
-- comprar". Guardar o total de um pedido aqui misturaria a receita com a
-- encomenda, e a receita seria reescrita a cada venda.
create table if not exists itens_lista_tecnica (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null default organizacao_atual()
    references organizacoes (id) on delete cascade,
  produto_id uuid not null references produtos (id) on delete cascade,

  -- `restrict`, não `cascade`: apagar um perfil do catálogo não pode
  -- esvaziar silenciosamente a receita de uma janela.
  modelo_perfil_id uuid not null references modelos_perfil (id) on delete restrict,

  comprimento_mm integer not null check (comprimento_mm > 0),
  quantidade integer not null check (quantidade > 0),

  observacao text,
  criado_em timestamptz not null default now()
);

comment on column itens_lista_tecnica.quantidade is
  'Peças deste corte por UMA unidade do produto.';
comment on column itens_lista_tecnica.comprimento_mm is
  'Comprimento do corte, já com os descontos técnicos que a oficina aplica —
   o sistema não calcula folga nem sobreposição nesta fase.';

create index if not exists idx_lista_tecnica_produto
  on itens_lista_tecnica (produto_id);

-- -----------------------------------------------------------------------------
-- Segurança
-- -----------------------------------------------------------------------------
alter table produtos enable row level security;
alter table itens_lista_tecnica enable row level security;

create policy "ver produtos da organização"
  on produtos for select
  to authenticated
  using (organizacao_id = organizacao_atual());

create policy "quem gerencia cadastros cria produtos"
  on produtos for insert
  to authenticated
  with check (organizacao_id = organizacao_atual() and pode_gerenciar_cadastros());

create policy "quem gerencia cadastros edita produtos"
  on produtos for update
  to authenticated
  using (organizacao_id = organizacao_atual() and pode_gerenciar_cadastros())
  with check (organizacao_id = organizacao_atual());

create policy "ver lista técnica da organização"
  on itens_lista_tecnica for select
  to authenticated
  using (organizacao_id = organizacao_atual());

create policy "quem gerencia cadastros monta a lista técnica"
  on itens_lista_tecnica for insert
  to authenticated
  with check (organizacao_id = organizacao_atual() and pode_gerenciar_cadastros());

create policy "quem gerencia cadastros edita a lista técnica"
  on itens_lista_tecnica for update
  to authenticated
  using (organizacao_id = organizacao_atual() and pode_gerenciar_cadastros())
  with check (organizacao_id = organizacao_atual());

-- Linha de receita se apaga de verdade, diferente de sobra e movimentação:
-- ela não é histórico de nada, é a receita de hoje. Corrigir uma lista
-- técnica errada não pode deixar rastro que atrapalhe a leitura.
create policy "quem gerencia cadastros remove item da lista técnica"
  on itens_lista_tecnica for delete
  to authenticated
  using (organizacao_id = organizacao_atual() and pode_gerenciar_cadastros());

create trigger tocar_produtos
  before update on produtos
  for each row
  execute function tocar_atualizado_em();
