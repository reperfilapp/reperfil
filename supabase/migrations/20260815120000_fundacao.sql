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
