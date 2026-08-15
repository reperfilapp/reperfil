-- ============================================================================
-- RePerfil — Esquema completo do banco (Fase 1)
-- ============================================================================
--
-- Arquivo GERADO automaticamente juntando as migrations em ordem.
-- Não edite este arquivo: edite os arquivos em supabase/migrations/ e
-- gere novamente com  npm run banco:consolidar
--
-- Como aplicar: cole o conteúdo inteiro no SQL Editor do Supabase e execute.
-- ============================================================================


-- <<< 20260815120000_fundacao.sql >>>

-- =============================================================================
-- RePerfil — Fundação: organizações, usuários e funções de apoio
-- =============================================================================
--
-- Convenções de todo o banco (ver docs/decisoes.md):
--
--  D1  Tudo em português: tabelas, colunas, tipos, funções e políticas.
--  D2  Chave primária UUID interna + coluna `codigo` curta e legível, única
--      por organização, que é o que aparece na tela, no QR Code e na etiqueta.
--  --  Todo comprimento é INTEIRO em milímetros. Nunca decimal.
--  --  `organizacao_id` desde o início, para múltiplas empresas depois sem
--      migração dolorosa. Toda tabela operacional carrega essa coluna e é
--      isolada por Row Level Security.
-- =============================================================================

-- gen_random_uuid() e afins.
create extension if not exists "pgcrypto";
-- Busca por semelhança em código e descrição de perfil (autocomplete).
create extension if not exists "pg_trgm";

-- -----------------------------------------------------------------------------
-- Geração de código curto e legível
-- -----------------------------------------------------------------------------
-- Alfabeto sem caracteres que se confundem à mão ou sob luz ruim de depósito:
-- sem O e 0, sem I, 1 e L, sem U (que vira V escrito à mão).
create or replace function gerar_sufixo_codigo(p_tamanho int default 4)
returns text
language plpgsql
volatile
as $$
declare
  v_alfabeto constant text := '23456789ABCDEFGHJKMNPQRSTVWXYZ';
  v_resultado text := '';
  i int;
begin
  for i in 1..p_tamanho loop
    v_resultado := v_resultado ||
      substr(v_alfabeto, floor(random() * length(v_alfabeto) + 1)::int, 1);
  end loop;

  return v_resultado;
end;
$$;

comment on function gerar_sufixo_codigo is
  'Sufixo aleatório para códigos curtos, sem caracteres ambíguos (O/0, I/1/L, U/V).';

-- -----------------------------------------------------------------------------
-- Organizações
-- -----------------------------------------------------------------------------
create table organizacoes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,

  nome_fantasia text not null,
  razao_social text,
  cnpj text,
  inscricao_estadual text,

  telefone text,
  whatsapp text,
  email text,
  site text,

  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  estado char(2),
  cep text,

  ativo boolean not null default true,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table organizacoes is
  'Empresas que usam o sistema. Uma no início, várias depois, sem migração.';

-- -----------------------------------------------------------------------------
-- Perfis de usuário
-- -----------------------------------------------------------------------------
-- Espelha auth.users acrescentando organização e papel. O cadastro público
-- fica desabilitado no painel do Supabase: usuários são criados ou convidados
-- pelo administrador.
create type papel_usuario as enum (
  'administrador',  -- configura o sistema, gerencia usuários, corrige estoque
  'estoque',        -- cadastra e movimenta sobras, confirma reservas
  'serralheiro'     -- pesquisa, reserva e confirma utilização
);

create table perfis_usuario (
  id uuid primary key references auth.users (id) on delete cascade,
  organizacao_id uuid not null references organizacoes (id) on delete restrict,

  nome text not null,
  email text not null,
  telefone text,
  papel papel_usuario not null default 'serralheiro',

  -- O administrador decide se o serralheiro pode informar o comprimento da
  -- sobra que resultou do corte, ou se isso é exclusividade do estoque.
  pode_informar_sobra_resultante boolean not null default false,

  ativo boolean not null default true,

  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

comment on table perfis_usuario is
  'Dados de aplicação do usuário. A autenticação em si vive em auth.users.';

create index idx_perfis_usuario_organizacao on perfis_usuario (organizacao_id);

-- -----------------------------------------------------------------------------
-- Funções de contexto — a base de toda a segurança
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER é obrigatório aqui: estas funções leem perfis_usuario, que
-- por sua vez tem RLS baseada nelas. Sem o DEFINER, a política se consultaria
-- em recursão infinita.
create or replace function organizacao_atual()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select organizacao_id
  from perfis_usuario
  where id = auth.uid() and ativo
$$;

comment on function organizacao_atual is
  'Organização do usuário autenticado. Base de todas as políticas de RLS.';

create or replace function papel_atual()
returns papel_usuario
language sql
stable
security definer
set search_path = public
as $$
  select papel
  from perfis_usuario
  where id = auth.uid() and ativo
$$;

create or replace function e_administrador()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select papel = 'administrador' from perfis_usuario
     where id = auth.uid() and ativo),
    false
  )
$$;

create or replace function pode_movimentar_estoque()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select papel in ('administrador', 'estoque') from perfis_usuario
     where id = auth.uid() and ativo),
    false
  )
$$;

-- -----------------------------------------------------------------------------
-- Manutenção automática de atualizado_em
-- -----------------------------------------------------------------------------
create or replace function tocar_atualizado_em()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em := now();
  return new;
end;
$$;

create trigger trg_organizacoes_atualizado_em
  before update on organizacoes
  for each row execute function tocar_atualizado_em();

create trigger trg_perfis_usuario_atualizado_em
  before update on perfis_usuario
  for each row execute function tocar_atualizado_em();


-- <<< 20260815120100_cadastros.sql >>>

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


-- <<< 20260815120200_estoque.sql >>>

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


-- <<< 20260815120300_configuracoes_auditoria.sql >>>

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


-- <<< 20260815120400_rls.sql >>>

-- =============================================================================
-- RePerfil — Row Level Security
-- =============================================================================
--
-- Princípio: NENHUMA linha é visível ou gravável fora da organização do
-- usuário autenticado. Esta é a única barreira real entre os dados de duas
-- empresas — a chave `anon` do Supabase é pública, então filtrar no código do
-- navegador não protege nada.
--
-- Papéis:
--   administrador  tudo, incluindo correção de estoque e gestão de usuários
--   estoque        cadastra e movimenta sobras
--   serralheiro    consulta e reserva; não cadastra nem corrige
--
-- Histórico (movimentacoes_estoque, registros_auditoria) não tem política de
-- UPDATE nem DELETE. A ausência é intencional: sem política, a operação é
-- negada para todos. Erro se corrige com uma movimentação de ajuste.
-- =============================================================================

alter table organizacoes                enable row level security;
alter table perfis_usuario              enable row level security;
alter table modelos_perfil              enable row level security;
alter table acabamentos                 enable row level security;
alter table compatibilidades_acabamento enable row level security;
alter table localizacoes                enable row level security;
alter table clientes                    enable row level security;
alter table arquivos_vetoriais          enable row level security;
alter table lotes_sobras                enable row level security;
alter table reservas                    enable row level security;
alter table movimentacoes_estoque       enable row level security;
alter table configuracoes_aplicacao     enable row level security;
alter table registros_auditoria         enable row level security;

-- -----------------------------------------------------------------------------
-- Organizações — cada um enxerga apenas a própria
-- -----------------------------------------------------------------------------
create policy "ver a própria organização"
  on organizacoes for select
  to authenticated
  using (id = organizacao_atual());

create policy "administrador edita a própria organização"
  on organizacoes for update
  to authenticated
  using (id = organizacao_atual() and e_administrador())
  with check (id = organizacao_atual());

-- -----------------------------------------------------------------------------
-- Perfis de usuário
-- -----------------------------------------------------------------------------
create policy "ver colegas da mesma organização"
  on perfis_usuario for select
  to authenticated
  using (organizacao_id = organizacao_atual());

create policy "administrador cria usuário na própria organização"
  on perfis_usuario for insert
  to authenticated
  with check (organizacao_id = organizacao_atual() and e_administrador());

-- O usuário pode editar o próprio cadastro (nome, telefone); o administrador
-- edita qualquer um. A troca de papel é barrada por gatilho, mais abaixo.
create policy "editar o próprio perfil ou, sendo administrador, qualquer um"
  on perfis_usuario for update
  to authenticated
  using (
    organizacao_id = organizacao_atual()
    and (id = auth.uid() or e_administrador())
  )
  with check (organizacao_id = organizacao_atual());

-- Impede que alguém se promova a administrador editando o próprio perfil.
create or replace function impedir_autopromocao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.papel is distinct from old.papel
      or new.pode_informar_sobra_resultante is distinct from old.pode_informar_sobra_resultante
      or new.ativo is distinct from old.ativo)
     and not e_administrador() then
    raise exception 'Somente o administrador altera papel, permissões ou situação de um usuário.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger trg_impedir_autopromocao
  before update on perfis_usuario
  for each row execute function impedir_autopromocao();

-- -----------------------------------------------------------------------------
-- Cadastros — todos leem; só administrador e estoque escrevem
-- -----------------------------------------------------------------------------
create policy "ver modelos da organização"
  on modelos_perfil for select
  to authenticated
  using (organizacao_id = organizacao_atual());

create policy "estoque cadastra modelos"
  on modelos_perfil for insert
  to authenticated
  with check (organizacao_id = organizacao_atual() and pode_movimentar_estoque());

create policy "estoque edita modelos"
  on modelos_perfil for update
  to authenticated
  using (organizacao_id = organizacao_atual() and pode_movimentar_estoque())
  with check (organizacao_id = organizacao_atual());

create policy "ver acabamentos da organização"
  on acabamentos for select
  to authenticated
  using (organizacao_id = organizacao_atual());

create policy "estoque cadastra acabamentos"
  on acabamentos for insert
  to authenticated
  with check (organizacao_id = organizacao_atual() and pode_movimentar_estoque());

create policy "estoque edita acabamentos"
  on acabamentos for update
  to authenticated
  using (organizacao_id = organizacao_atual() and pode_movimentar_estoque())
  with check (organizacao_id = organizacao_atual());

-- Compatibilidade de acabamento afrouxa a regra de ouro do sistema, então
-- só o administrador cria ou remove.
create policy "ver compatibilidades da organização"
  on compatibilidades_acabamento for select
  to authenticated
  using (organizacao_id = organizacao_atual());

create policy "administrador cria compatibilidade"
  on compatibilidades_acabamento for insert
  to authenticated
  with check (organizacao_id = organizacao_atual() and e_administrador());

create policy "administrador remove compatibilidade"
  on compatibilidades_acabamento for delete
  to authenticated
  using (organizacao_id = organizacao_atual() and e_administrador());

create policy "ver localizações da organização"
  on localizacoes for select
  to authenticated
  using (organizacao_id = organizacao_atual());

create policy "estoque cadastra localizações"
  on localizacoes for insert
  to authenticated
  with check (organizacao_id = organizacao_atual() and pode_movimentar_estoque());

create policy "estoque edita localizações"
  on localizacoes for update
  to authenticated
  using (organizacao_id = organizacao_atual() and pode_movimentar_estoque())
  with check (organizacao_id = organizacao_atual());

-- -----------------------------------------------------------------------------
-- Clientes — dado pessoal sob a LGPD
-- -----------------------------------------------------------------------------
create policy "ver clientes da organização"
  on clientes for select
  to authenticated
  using (organizacao_id = organizacao_atual());

create policy "estoque cadastra clientes"
  on clientes for insert
  to authenticated
  with check (organizacao_id = organizacao_atual() and pode_movimentar_estoque());

create policy "estoque edita clientes"
  on clientes for update
  to authenticated
  using (organizacao_id = organizacao_atual() and pode_movimentar_estoque())
  with check (organizacao_id = organizacao_atual());

-- -----------------------------------------------------------------------------
-- Arquivos vetoriais (Fase 2)
-- -----------------------------------------------------------------------------
create policy "ver arquivos vetoriais da organização"
  on arquivos_vetoriais for select
  to authenticated
  using (organizacao_id = organizacao_atual());

create policy "estoque envia arquivos vetoriais"
  on arquivos_vetoriais for insert
  to authenticated
  with check (organizacao_id = organizacao_atual() and pode_movimentar_estoque());

-- -----------------------------------------------------------------------------
-- Lotes de sobras
-- -----------------------------------------------------------------------------
create policy "ver sobras da organização"
  on lotes_sobras for select
  to authenticated
  using (organizacao_id = organizacao_atual());

create policy "estoque cadastra sobras"
  on lotes_sobras for insert
  to authenticated
  with check (organizacao_id = organizacao_atual() and pode_movimentar_estoque());

-- Atenção: reserva e consumo NÃO passam por aqui. Vão pelas funções
-- transacionais da migration seguinte, que travam a linha antes de alterar.
create policy "estoque edita sobras"
  on lotes_sobras for update
  to authenticated
  using (organizacao_id = organizacao_atual() and pode_movimentar_estoque())
  with check (organizacao_id = organizacao_atual());

-- -----------------------------------------------------------------------------
-- Reservas — o serralheiro reserva, e é para isso que ele usa o sistema
-- -----------------------------------------------------------------------------
create policy "ver reservas da organização"
  on reservas for select
  to authenticated
  using (organizacao_id = organizacao_atual());

-- -----------------------------------------------------------------------------
-- Histórico — leitura livre na organização, escrita só pelas funções
-- -----------------------------------------------------------------------------
-- Sem política de INSERT direto: movimentação é gravada pelas funções
-- transacionais, que são SECURITY DEFINER. Isso garante que nenhuma
-- movimentação seja inventada sem a alteração de estoque correspondente.
create policy "ver movimentações da organização"
  on movimentacoes_estoque for select
  to authenticated
  using (organizacao_id = organizacao_atual());

-- Auditoria: só o administrador lê. Contém dados completos de todas as
-- alterações, incluindo dado pessoal de cliente.
create policy "administrador vê a auditoria"
  on registros_auditoria for select
  to authenticated
  using (organizacao_id = organizacao_atual() and e_administrador());

-- -----------------------------------------------------------------------------
-- Configurações
-- -----------------------------------------------------------------------------
create policy "ver configurações da organização"
  on configuracoes_aplicacao for select
  to authenticated
  using (organizacao_id = organizacao_atual());

create policy "administrador altera configurações"
  on configuracoes_aplicacao for update
  to authenticated
  using (organizacao_id = organizacao_atual() and e_administrador())
  with check (organizacao_id = organizacao_atual());

create policy "administrador cria configurações"
  on configuracoes_aplicacao for insert
  to authenticated
  with check (organizacao_id = organizacao_atual() and e_administrador());


-- <<< 20260815120500_funcoes_estoque.sql >>>

-- =============================================================================
-- RePerfil — Funções transacionais de estoque
-- =============================================================================
--
-- POR QUE ISTO EXISTE:
--
-- Verificar disponibilidade no aplicativo e depois gravar é uma condição de
-- corrida clássica. Duas pessoas no depósito abrem a mesma peça no celular,
-- ambas leem "disponível: 1", ambas tocam em "Reservar", e as duas saem
-- achando que a peça é delas. Uma vai até a prateleira e não encontra nada.
--
-- Nenhuma quantidade de cuidado no React resolve isso. Só o banco consegue
-- serializar as duas tentativas. Por isso reserva e consumo NÃO são UPDATE
-- comum: são estas funções, que travam a linha do lote com FOR UPDATE antes
-- de olhar a quantidade. A segunda transação fica esperando a primeira
-- terminar e então enxerga o estoque já reduzido.
--
-- A restrição `lotes_sobras_reserva_coerente` é a segunda linha de defesa:
-- mesmo que alguém contorne estas funções, o banco recusa reservar mais do
-- que existe.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Código curto e legível, único por organização
-- -----------------------------------------------------------------------------
create or replace function gerar_codigo_unico(
  p_organizacao_id uuid,
  p_prefixo text,
  p_tabela text
)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_codigo text;
  v_existe boolean;
  v_tentativa int := 0;
begin
  loop
    v_tentativa := v_tentativa + 1;
    v_codigo := p_prefixo || '-' || gerar_sufixo_codigo(4);

    execute format(
      'select exists (select 1 from %I where organizacao_id = $1 and codigo = $2)',
      p_tabela
    )
    into v_existe
    using p_organizacao_id, v_codigo;

    exit when not v_existe;

    -- Com 30 caracteres em 4 posições são 810 mil combinações; colidir 20
    -- vezes seguidas significa que o espaço encheu de verdade.
    if v_tentativa >= 20 then
      v_codigo := p_prefixo || '-' || gerar_sufixo_codigo(6);
      exit;
    end if;
  end loop;

  return v_codigo;
end;
$$;

-- -----------------------------------------------------------------------------
-- Cadastrar sobra
-- -----------------------------------------------------------------------------
create or replace function cadastrar_sobra(
  p_modelo_perfil_id uuid,
  p_acabamento_id uuid,
  p_comprimento_mm integer,
  p_quantidade integer default 1,
  p_localizacao_id uuid default null,
  p_estado estado_conservacao default 'bom',
  p_foto_url text default null,
  p_origem text default null,
  p_observacoes text default null,
  p_lote_origem_id uuid default null
)
returns lotes_sobras
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid := organizacao_atual();
  v_lote lotes_sobras;
begin
  if v_organizacao_id is null then
    raise exception 'Usuário sem organização ativa.'
      using errcode = 'insufficient_privilege';
  end if;

  if not pode_movimentar_estoque() then
    raise exception 'Seu perfil não permite cadastrar sobras.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_comprimento_mm is null or p_comprimento_mm <= 0 then
    raise exception 'Informe um comprimento maior que zero.'
      using errcode = 'check_violation';
  end if;

  if p_comprimento_mm > 18000 then
    raise exception 'Comprimento acima do limite de 18 m. Confira se digitou um zero a mais.'
      using errcode = 'check_violation';
  end if;

  if p_quantidade is null or p_quantidade < 1 then
    raise exception 'A quantidade precisa ser pelo menos 1.'
      using errcode = 'check_violation';
  end if;

  -- Garante que modelo e acabamento são da mesma organização: sem isto,
  -- alguém poderia referenciar o perfil de outra empresa por UUID.
  if not exists (
    select 1 from modelos_perfil
    where id = p_modelo_perfil_id and organizacao_id = v_organizacao_id
  ) then
    raise exception 'Modelo de perfil não encontrado nesta organização.'
      using errcode = 'foreign_key_violation';
  end if;

  if not exists (
    select 1 from acabamentos
    where id = p_acabamento_id and organizacao_id = v_organizacao_id
  ) then
    raise exception 'Acabamento não encontrado nesta organização.'
      using errcode = 'foreign_key_violation';
  end if;

  insert into lotes_sobras (
    organizacao_id, codigo, modelo_perfil_id, acabamento_id, localizacao_id,
    comprimento_mm, quantidade, estado, foto_url, origem, observacoes,
    lote_origem_id, criado_por
  )
  values (
    v_organizacao_id,
    gerar_codigo_unico(v_organizacao_id, 'SB', 'lotes_sobras'),
    p_modelo_perfil_id, p_acabamento_id, p_localizacao_id,
    p_comprimento_mm, p_quantidade, p_estado, p_foto_url, p_origem,
    p_observacoes, p_lote_origem_id, auth.uid()
  )
  returning * into v_lote;

  insert into movimentacoes_estoque (
    organizacao_id, lote_id, tipo, quantidade, comprimento_mm, criado_por
  )
  values (
    v_organizacao_id, v_lote.id, 'entrada', p_quantidade, p_comprimento_mm,
    auth.uid()
  );

  return v_lote;
end;
$$;

-- -----------------------------------------------------------------------------
-- Reservar sobra — a função crítica
-- -----------------------------------------------------------------------------
create or replace function reservar_sobra(
  p_lote_id uuid,
  p_quantidade integer default 1,
  p_observacoes text default null
)
returns reservas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid := organizacao_atual();
  v_lote lotes_sobras;
  v_disponivel integer;
  v_prazo_horas integer;
  v_reserva reservas;
begin
  if v_organizacao_id is null then
    raise exception 'Usuário sem organização ativa.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_quantidade is null or p_quantidade < 1 then
    raise exception 'A quantidade reservada precisa ser pelo menos 1.'
      using errcode = 'check_violation';
  end if;

  -- ═══════════════════════════════════════════════════════════════════════
  -- AQUI ESTÁ A PROTEÇÃO. O FOR UPDATE trava esta linha até o fim da
  -- transação. Uma segunda tentativa simultânea sobre o mesmo lote fica
  -- bloqueada nesta instrução e só prossegue depois que a primeira gravou,
  -- enxergando então a quantidade já reduzida. Sem o FOR UPDATE, as duas
  -- leriam o mesmo valor e ambas reservariam.
  -- ═══════════════════════════════════════════════════════════════════════
  select * into v_lote
  from lotes_sobras
  where id = p_lote_id and organizacao_id = v_organizacao_id
  for update;

  if not found then
    raise exception 'Sobra não encontrada.'
      using errcode = 'no_data_found';
  end if;

  if v_lote.status <> 'disponivel' then
    raise exception 'Esta sobra não está disponível (situação: %).', v_lote.status
      using errcode = 'check_violation';
  end if;

  v_disponivel := v_lote.quantidade - v_lote.quantidade_reservada;

  if v_disponivel < p_quantidade then
    raise exception
      'Restam apenas % unidade(s) desta sobra. Outra pessoa pode ter reservado agora há pouco.',
      v_disponivel
      using errcode = 'check_violation';
  end if;

  select prazo_reserva_horas into v_prazo_horas
  from configuracoes_aplicacao
  where organizacao_id = v_organizacao_id;

  v_prazo_horas := coalesce(v_prazo_horas, 48);

  update lotes_sobras
  set quantidade_reservada = quantidade_reservada + p_quantidade,
      status = case
        when quantidade_reservada + p_quantidade >= quantidade then 'reservada'::status_lote
        else status
      end
  where id = p_lote_id;

  insert into reservas (
    organizacao_id, codigo, lote_id, quantidade, expira_em, observacoes, criado_por
  )
  values (
    v_organizacao_id,
    gerar_codigo_unico(v_organizacao_id, 'RS', 'reservas'),
    p_lote_id, p_quantidade,
    now() + make_interval(hours => v_prazo_horas),
    p_observacoes, auth.uid()
  )
  returning * into v_reserva;

  insert into movimentacoes_estoque (
    organizacao_id, lote_id, reserva_id, tipo, quantidade, comprimento_mm, criado_por
  )
  values (
    v_organizacao_id, p_lote_id, v_reserva.id, 'reserva', p_quantidade,
    v_lote.comprimento_mm, auth.uid()
  );

  return v_reserva;
end;
$$;

comment on function reservar_sobra is
  'Reserva transacional com FOR UPDATE. Duas tentativas simultâneas sobre a
   mesma peça resultam em apenas uma reserva bem-sucedida.';

-- -----------------------------------------------------------------------------
-- Cancelar reserva — devolve a peça a disponível
-- -----------------------------------------------------------------------------
create or replace function cancelar_reserva(
  p_reserva_id uuid,
  p_motivo text default null
)
returns reservas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid := organizacao_atual();
  v_reserva reservas;
  v_lote lotes_sobras;
begin
  select * into v_reserva
  from reservas
  where id = p_reserva_id and organizacao_id = v_organizacao_id
  for update;

  if not found then
    raise exception 'Reserva não encontrada.' using errcode = 'no_data_found';
  end if;

  if v_reserva.status not in ('ativa', 'retirada') then
    raise exception 'Esta reserva já foi encerrada (situação: %).', v_reserva.status
      using errcode = 'check_violation';
  end if;

  -- Só quem reservou, o estoque ou o administrador podem cancelar.
  if v_reserva.criado_por <> auth.uid() and not pode_movimentar_estoque() then
    raise exception 'Você só pode cancelar as suas próprias reservas.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_lote from lotes_sobras where id = v_reserva.lote_id for update;

  update lotes_sobras
  set quantidade_reservada = quantidade_reservada - v_reserva.quantidade,
      status = case
        when status = 'reservada' then 'disponivel'::status_lote
        else status
      end
  where id = v_reserva.lote_id;

  update reservas
  set status = 'cancelada', motivo_cancelamento = p_motivo
  where id = p_reserva_id
  returning * into v_reserva;

  insert into movimentacoes_estoque (
    organizacao_id, lote_id, reserva_id, tipo, quantidade, comprimento_mm,
    justificativa, criado_por
  )
  values (
    v_organizacao_id, v_reserva.lote_id, v_reserva.id, 'cancelamento_reserva',
    v_reserva.quantidade, v_lote.comprimento_mm, p_motivo, auth.uid()
  );

  return v_reserva;
end;
$$;

-- -----------------------------------------------------------------------------
-- Confirmar retirada da prateleira
-- -----------------------------------------------------------------------------
create or replace function confirmar_retirada(p_reserva_id uuid)
returns reservas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid := organizacao_atual();
  v_reserva reservas;
  v_lote lotes_sobras;
begin
  select * into v_reserva
  from reservas
  where id = p_reserva_id and organizacao_id = v_organizacao_id
  for update;

  if not found then
    raise exception 'Reserva não encontrada.' using errcode = 'no_data_found';
  end if;

  if v_reserva.status <> 'ativa' then
    raise exception 'Só é possível retirar uma reserva ativa (situação: %).',
      v_reserva.status using errcode = 'check_violation';
  end if;

  if v_reserva.expira_em < now() then
    raise exception 'Esta reserva venceu em %. Reserve novamente.',
      to_char(v_reserva.expira_em, 'DD/MM/YYYY HH24:MI')
      using errcode = 'check_violation';
  end if;

  select * into v_lote from lotes_sobras where id = v_reserva.lote_id;

  update reservas
  set status = 'retirada', retirada_em = now()
  where id = p_reserva_id
  returning * into v_reserva;

  insert into movimentacoes_estoque (
    organizacao_id, lote_id, reserva_id, tipo, quantidade, comprimento_mm, criado_por
  )
  values (
    v_organizacao_id, v_reserva.lote_id, v_reserva.id, 'retirada',
    v_reserva.quantidade, v_lote.comprimento_mm, auth.uid()
  );

  return v_reserva;
end;
$$;

-- -----------------------------------------------------------------------------
-- Confirmar corte — baixa a peça e devolve o resto ao estoque
-- -----------------------------------------------------------------------------
-- O comprimento restante é calculado FORA daqui, pela regra de domínio em
-- src/dominio/corte.ts, e chega pronto. O banco não recalcula: ter a mesma
-- fórmula em dois lugares é receita para os dois discordarem.
create or replace function confirmar_corte(
  p_reserva_id uuid,
  p_comprimento_utilizado_mm integer,
  p_comprimento_restante_mm integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid := organizacao_atual();
  v_reserva reservas;
  v_lote lotes_sobras;
  v_minimo_sobra integer;
  v_lote_resultante lotes_sobras;
  v_virou_descarte boolean := false;
begin
  select * into v_reserva
  from reservas
  where id = p_reserva_id and organizacao_id = v_organizacao_id
  for update;

  if not found then
    raise exception 'Reserva não encontrada.' using errcode = 'no_data_found';
  end if;

  if v_reserva.status not in ('ativa', 'retirada') then
    raise exception 'Esta reserva já foi encerrada (situação: %).', v_reserva.status
      using errcode = 'check_violation';
  end if;

  select * into v_lote from lotes_sobras where id = v_reserva.lote_id for update;

  if p_comprimento_utilizado_mm <= 0
     or p_comprimento_utilizado_mm > v_lote.comprimento_mm then
    raise exception
      'O comprimento utilizado precisa estar entre 1 mm e % mm.', v_lote.comprimento_mm
      using errcode = 'check_violation';
  end if;

  select comprimento_minimo_sobra_mm into v_minimo_sobra
  from configuracoes_aplicacao
  where organizacao_id = v_organizacao_id;

  v_minimo_sobra := coalesce(v_minimo_sobra, 300);

  -- Baixa as unidades consumidas do lote de origem.
  update lotes_sobras
  set quantidade = quantidade - v_reserva.quantidade,
      quantidade_reservada = quantidade_reservada - v_reserva.quantidade,
      status = case
        when quantidade - v_reserva.quantidade <= 0 then 'consumida'::status_lote
        else 'disponivel'::status_lote
      end
  where id = v_lote.id;

  insert into movimentacoes_estoque (
    organizacao_id, lote_id, reserva_id, tipo, quantidade, comprimento_mm, criado_por
  )
  values (
    v_organizacao_id, v_lote.id, v_reserva.id, 'corte', v_reserva.quantidade,
    p_comprimento_utilizado_mm, auth.uid()
  );

  -- O resto volta ao estoque ou vira descarte, conforme o mínimo configurado.
  if p_comprimento_restante_mm >= v_minimo_sobra and p_comprimento_restante_mm > 0 then
    insert into lotes_sobras (
      organizacao_id, codigo, modelo_perfil_id, acabamento_id, localizacao_id,
      comprimento_mm, quantidade, estado, origem, lote_origem_id, criado_por
    )
    values (
      v_organizacao_id,
      gerar_codigo_unico(v_organizacao_id, 'SB', 'lotes_sobras'),
      v_lote.modelo_perfil_id, v_lote.acabamento_id, v_lote.localizacao_id,
      p_comprimento_restante_mm, v_reserva.quantidade, v_lote.estado,
      'Resto do corte da sobra ' || v_lote.codigo, v_lote.id, auth.uid()
    )
    returning * into v_lote_resultante;

    insert into movimentacoes_estoque (
      organizacao_id, lote_id, reserva_id, tipo, quantidade, comprimento_mm, criado_por
    )
    values (
      v_organizacao_id, v_lote_resultante.id, v_reserva.id, 'entrada',
      v_reserva.quantidade, p_comprimento_restante_mm, auth.uid()
    );

  elsif p_comprimento_restante_mm > 0 then
    v_virou_descarte := true;

    insert into movimentacoes_estoque (
      organizacao_id, lote_id, reserva_id, tipo, quantidade, comprimento_mm,
      justificativa, criado_por
    )
    values (
      v_organizacao_id, v_lote.id, v_reserva.id, 'descarte', v_reserva.quantidade,
      p_comprimento_restante_mm,
      format('Resto de %s mm menor que o mínimo aproveitável de %s mm.',
             p_comprimento_restante_mm, v_minimo_sobra),
      auth.uid()
    );
  end if;

  update reservas
  set status = 'consumida',
      consumida_em = now(),
      comprimento_utilizado_mm = p_comprimento_utilizado_mm,
      lote_resultante_id = v_lote_resultante.id
  where id = p_reserva_id;

  return jsonb_build_object(
    'reserva_id', p_reserva_id,
    'lote_consumido_id', v_lote.id,
    'lote_resultante_id', v_lote_resultante.id,
    'lote_resultante_codigo', v_lote_resultante.codigo,
    'comprimento_restante_mm', p_comprimento_restante_mm,
    'destino_resto', case
      when p_comprimento_restante_mm <= 0 then 'sem-resto'
      when v_virou_descarte then 'descarte'
      else 'sobra'
    end
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Expirar reservas vencidas
-- -----------------------------------------------------------------------------
-- Chamada por tarefa agendada (pg_cron) ou na abertura do painel.
create or replace function expirar_reservas_vencidas()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reserva reservas;
  v_total integer := 0;
begin
  for v_reserva in
    select * from reservas
    where status = 'ativa' and expira_em < now()
    for update skip locked
  loop
    update lotes_sobras
    set quantidade_reservada = quantidade_reservada - v_reserva.quantidade,
        status = case
          when status = 'reservada' then 'disponivel'::status_lote
          else status
        end
    where id = v_reserva.lote_id;

    update reservas set status = 'expirada' where id = v_reserva.id;

    insert into movimentacoes_estoque (
      organizacao_id, lote_id, reserva_id, tipo, quantidade, criado_por
    )
    values (
      v_reserva.organizacao_id, v_reserva.lote_id, v_reserva.id,
      'expiracao_reserva', v_reserva.quantidade, v_reserva.criado_por
    );

    v_total := v_total + 1;
  end loop;

  return v_total;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permissões
-- -----------------------------------------------------------------------------
grant execute on function cadastrar_sobra          to authenticated;
grant execute on function reservar_sobra           to authenticated;
grant execute on function cancelar_reserva         to authenticated;
grant execute on function confirmar_retirada       to authenticated;
grant execute on function confirmar_corte          to authenticated;
grant execute on function expirar_reservas_vencidas to authenticated;


-- <<< 20260815130000_padroes_cadastro.sql >>>

-- =============================================================================
-- RePerfil — Padrões de cadastro: organização e código automáticos
-- =============================================================================
--
-- POR QUE: sem isto, toda inserção feita pelo aplicativo precisa descobrir o
-- `organizacao_id` do usuário e mandá-lo junto. Isso significa uma consulta
-- extra por gravação, e — pior — abre espaço para o aplicativo mandar o valor
-- ERRADO. O Row Level Security recusaria, mas o erro só apareceria em tempo
-- de execução, na mão do usuário.
--
-- Com `default organizacao_atual()`, o banco preenche sozinho, a partir de
-- quem está autenticado. O aplicativo não tem como errar porque não informa.
-- =============================================================================

alter table modelos_perfil
  alter column organizacao_id set default organizacao_atual();

alter table acabamentos
  alter column organizacao_id set default organizacao_atual();

alter table compatibilidades_acabamento
  alter column organizacao_id set default organizacao_atual();

alter table localizacoes
  alter column organizacao_id set default organizacao_atual();

alter table clientes
  alter column organizacao_id set default organizacao_atual();

alter table arquivos_vetoriais
  alter column organizacao_id set default organizacao_atual();

alter table lotes_sobras
  alter column organizacao_id set default organizacao_atual();

-- Quem criou o registro também sai de graça de quem está autenticado.
alter table modelos_perfil alter column criado_por set default auth.uid();
alter table acabamentos alter column criado_por set default auth.uid();
alter table compatibilidades_acabamento alter column criado_por set default auth.uid();
alter table localizacoes alter column criado_por set default auth.uid();
alter table clientes alter column criado_por set default auth.uid();
alter table arquivos_vetoriais alter column criado_por set default auth.uid();
alter table lotes_sobras alter column criado_por set default auth.uid();

-- -----------------------------------------------------------------------------
-- Código automático para clientes
-- -----------------------------------------------------------------------------
-- Modelo de perfil, acabamento e localização têm código informado pela
-- empresa, porque são códigos que o serralheiro já conhece e usa no dia a
-- dia. Cliente não: ninguém decora código de cliente, então o sistema gera.
create or replace function preencher_codigo_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.codigo is null or trim(new.codigo) = '' then
    new.codigo := gerar_codigo_unico(new.organizacao_id, 'CLI', 'clientes');
  end if;

  return new;
end;
$$;

create trigger trg_clientes_codigo
  before insert on clientes
  for each row execute function preencher_codigo_cliente();

-- A coluna passa a aceitar nulo na entrada; o gatilho preenche antes de
-- gravar, então a restrição de unicidade continua valendo.
alter table clientes alter column codigo drop not null;
