-- =============================================================================
-- RePerfil — Cadastros: perfis, acabamentos, localizações, clientes
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Modelos de perfil
-- -----------------------------------------------------------------------------
-- O `codigo` aqui é o código INTERNO da empresa, informado por ela (não é
-- gerado pelo sistema), porque o serralheiro já conhece os perfis por esse
-- código e trocá-lo por um número novo só criaria confusão.
create table modelos_perfil (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes (id) on delete cascade,
  codigo text not null,

  descricao text not null,
  fabricante text,
  linha text,              -- "PERFETTA 35", "GOLD", "TUBULAR"
  categoria text,

  imagem_url text,         -- upload simples nesta fase; DXF/SVG é Fase 2
  codigo_barras text,

  comprimento_barra_mm integer not null default 6000,
  peso_por_metro_g integer,        -- gramas por metro, inteiro
  preco_por_metro_centavos integer, -- centavos, para não usar float em dinheiro

  observacoes text,
  ativo boolean not null default true,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfis_usuario (id),

  constraint modelos_perfil_codigo_unico unique (organizacao_id, codigo),
  constraint modelos_perfil_barra_positiva
    check (comprimento_barra_mm > 0 and comprimento_barra_mm <= 18000),
  constraint modelos_perfil_peso_positivo
    check (peso_por_metro_g is null or peso_por_metro_g > 0),
  constraint modelos_perfil_preco_positivo
    check (preco_por_metro_centavos is null or preco_por_metro_centavos >= 0)
);

comment on table modelos_perfil is
  'Catálogo de perfis. Entidade única, reaproveitada por sobras, orçamentos e obras.';
comment on column modelos_perfil.peso_por_metro_g is
  'Gramas por metro. Inteiro, para não usar ponto flutuante em cálculo físico.';
comment on column modelos_perfil.preco_por_metro_centavos is
  'Centavos. Dinheiro nunca é float — 0.1 + 0.2 não dá 0.3 em binário.';

create index idx_modelos_perfil_organizacao on modelos_perfil (organizacao_id);
create index idx_modelos_perfil_codigo on modelos_perfil (organizacao_id, codigo);
create index idx_modelos_perfil_ativo
  on modelos_perfil (organizacao_id, ativo) where ativo;
-- Autocomplete por código ou descrição, tolerante a erro de digitação.
create index idx_modelos_perfil_busca on modelos_perfil
  using gin ((codigo || ' ' || descricao) gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- Acabamentos
-- -----------------------------------------------------------------------------
-- Os orçamentos reais usam designações como "PINTURA PRETO FOSCO - RAL9005F" e
-- "CINZA GRAFITE", então precisa caber código RAL e descrição livre.
create type tipo_acabamento as enum (
  'natural',
  'anodizado',
  'pintura',
  'outro'
);

create table acabamentos (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes (id) on delete cascade,
  codigo text not null,

  nome text not null,              -- "Pintura preto fosco"
  tipo tipo_acabamento not null default 'outro',
  codigo_ral text,                 -- "RAL9005F", opcional
  descricao text,
  cor_hex char(7),                 -- só para mostrar a bolinha na tela

  ativo boolean not null default true,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfis_usuario (id),

  constraint acabamentos_codigo_unico unique (organizacao_id, codigo),
  constraint acabamentos_cor_hex_valida
    check (cor_hex is null or cor_hex ~ '^#[0-9A-Fa-f]{6}$')
);

create index idx_acabamentos_organizacao on acabamentos (organizacao_id);
create index idx_acabamentos_ativo
  on acabamentos (organizacao_id, ativo) where ativo;

-- -----------------------------------------------------------------------------
-- Compatibilidade entre acabamentos
-- -----------------------------------------------------------------------------
-- REGRA DE OURO: o sistema NUNCA sugere sobra com acabamento diferente do
-- pedido. A única exceção é uma linha explícita nesta tabela, criada de
-- propósito pelo administrador. Duas peças "brancas" de lotes de pintura
-- diferentes podem não combinar na mesma esquadria, e quem sabe disso é a
-- empresa, não o sistema.
create table compatibilidades_acabamento (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes (id) on delete cascade,

  acabamento_id uuid not null references acabamentos (id) on delete cascade,
  acabamento_compativel_id uuid not null references acabamentos (id) on delete cascade,

  justificativa text not null,

  criado_em timestamptz not null default now(),
  criado_por uuid references perfis_usuario (id),

  constraint compat_acabamento_unico
    unique (organizacao_id, acabamento_id, acabamento_compativel_id),
  constraint compat_acabamento_nao_reflexiva
    check (acabamento_id <> acabamento_compativel_id)
);

comment on table compatibilidades_acabamento is
  'Exceções explícitas à regra de acabamento idêntico. Exige justificativa.';

create index idx_compat_acabamento on compatibilidades_acabamento (acabamento_id);

-- -----------------------------------------------------------------------------
-- Localizações
-- -----------------------------------------------------------------------------
create table localizacoes (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes (id) on delete cascade,
  codigo text not null,

  deposito text,
  setor text,
  corredor text,
  estante text,
  prateleira text,
  posicao text,
  observacao text,

  ativo boolean not null default true,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfis_usuario (id),

  constraint localizacoes_codigo_unico unique (organizacao_id, codigo)
);

comment on table localizacoes is
  'Endereço físico da peça no depósito. Todos os níveis são opcionais porque
   cada empresa organiza o galpão do seu jeito.';

create index idx_localizacoes_organizacao on localizacoes (organizacao_id);

-- -----------------------------------------------------------------------------
-- Clientes
-- -----------------------------------------------------------------------------
-- ATENÇÃO — LGPD: esta tabela guarda dado pessoal (CPF, endereço, telefone).
-- O isolamento por RLS não é conveniência de multi-empresa aqui, é proteção
-- de dado pessoal de terceiro.
create table clientes (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes (id) on delete cascade,
  codigo text not null,

  nome text not null,              -- nome ou razão social
  nome_fantasia text,
  cpf_cnpj text,
  inscricao_estadual text,

  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  estado char(2),
  cep text,

  telefone text,
  whatsapp text,
  email text,
  contato_principal text,

  observacoes text,
  ativo boolean not null default true,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  criado_por uuid references perfis_usuario (id),

  constraint clientes_codigo_unico unique (organizacao_id, codigo)
);

comment on table clientes is
  'Clientes. Contém dado pessoal sob a LGPD — ver política de RLS.';

create index idx_clientes_organizacao on clientes (organizacao_id);
create index idx_clientes_busca on clientes
  using gin ((nome || ' ' || coalesce(nome_fantasia, '')) gin_trgm_ops);

-- -----------------------------------------------------------------------------
-- Arquivos vetoriais — criada e preparada, uso pleno na Fase 2
-- -----------------------------------------------------------------------------
-- NÃO implementar conversão de DXF agora. A tabela existe para que a Fase 2
-- encaixe sem migração destrutiva.
create type tipo_arquivo_vetorial as enum (
  'secao_svg',      -- seção transversal vetorizada, para o navegador
  'secao_dxf',      -- arquivo técnico original preservado
  'imagem'          -- foto ou desenho de apresentação
);

create table arquivos_vetoriais (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes (id) on delete cascade,
  modelo_perfil_id uuid references modelos_perfil (id) on delete cascade,

  tipo tipo_arquivo_vetorial not null,
  arquivo_url text not null,
  nome_original text,

  -- Dimensões REAIS da seção do perfil, em mm. A seção nunca é esticada para
  -- acompanhar a esquadria — é geometria física do perfil.
  largura_mm integer,
  altura_mm integer,
  escala numeric(10, 4),

  sanitizado boolean not null default false,
  observacoes_tecnicas text,

  criado_em timestamptz not null default now(),
  criado_por uuid references perfis_usuario (id)
);

comment on table arquivos_vetoriais is
  'Preparada para a Fase 2 (seção transversal e DXF). Não usar ainda.';
comment on column arquivos_vetoriais.sanitizado is
  'SVG importado precisa ter scripts, links externos e elementos inseguros
   removidos antes de ser exibido. Falso significa: não renderizar.';

create index idx_arquivos_vetoriais_modelo on arquivos_vetoriais (modelo_perfil_id);

-- -----------------------------------------------------------------------------
-- Gatilhos de atualizado_em
-- -----------------------------------------------------------------------------
create trigger trg_modelos_perfil_atualizado_em
  before update on modelos_perfil
  for each row execute function tocar_atualizado_em();

create trigger trg_acabamentos_atualizado_em
  before update on acabamentos
  for each row execute function tocar_atualizado_em();

create trigger trg_localizacoes_atualizado_em
  before update on localizacoes
  for each row execute function tocar_atualizado_em();

create trigger trg_clientes_atualizado_em
  before update on clientes
  for each row execute function tocar_atualizado_em();
