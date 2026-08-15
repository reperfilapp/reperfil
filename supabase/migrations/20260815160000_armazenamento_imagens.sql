-- =============================================================================
-- RePerfil — Armazenamento de imagens
-- =============================================================================
--
-- Cria dois depósitos de arquivos e as políticas que os isolam por empresa.
--
--   fotos-sobras        foto da ponta guardada no depósito
--   desenhos-tecnicos   desenho ou página de catálogo do perfil, com cotas
--
-- ── Por que PRIVADOS ─────────────────────────────────────────────────────
--
-- Balde público no Supabase significa que qualquer pessoa com o endereço do
-- arquivo o acessa, sem login. Foto de depósito revela layout, volume de
-- material e obra de cliente; desenho de catálogo pode ser material
-- licenciado do fabricante. Nada disso deveria estar aberto na internet.
--
-- Privado exige gerar um link temporário para exibir, o que o aplicativo já
-- faz em `src/lib/armazenamento.ts`.
--
-- ── Isolamento ───────────────────────────────────────────────────────────
--
-- O caminho de todo arquivo começa com o id da organização:
--
--     {organizacao_id}/{nome-do-arquivo}
--
-- e as políticas comparam essa primeira pasta com a organização de quem está
-- autenticado. É o mesmo princípio do RLS das tabelas — e precisa ser
-- declarado aqui separadamente, porque políticas de Storage são um sistema
-- à parte: banco protegido não implica imagens protegidas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Baldes
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'fotos-sobras',
    'fotos-sobras',
    false,
    3145728,  -- 3 MB: o aplicativo comprime antes de enviar, então sobra folga
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'desenhos-tecnicos',
    'desenhos-tecnicos',
    false,
    5242880,  -- 5 MB: desenho com cota precisa de mais resolução para o zoom
    array['image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = excluded.public;

-- -----------------------------------------------------------------------------
-- Função de apoio
-- -----------------------------------------------------------------------------
-- Confere se o caminho do arquivo começa com a organização de quem está
-- autenticado. Concentrar isto numa função evita repetir a mesma expressão em
-- oito políticas e errar em uma delas.
create or replace function caminho_e_da_organizacao(p_caminho text)
returns boolean
language sql
stable
security definer
set search_path = public, storage
as $$
  select coalesce(
    (storage.foldername(p_caminho))[1] = organizacao_atual()::text,
    false
  )
$$;

comment on function caminho_e_da_organizacao is
  'Verdadeiro quando a primeira pasta do caminho é a organização do usuário.';

-- -----------------------------------------------------------------------------
-- Fotos de sobras
-- -----------------------------------------------------------------------------
drop policy if exists "ver fotos de sobras da organização" on storage.objects;
create policy "ver fotos de sobras da organização"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'fotos-sobras'
    and caminho_e_da_organizacao(name)
  );

drop policy if exists "estoque envia foto de sobra" on storage.objects;
create policy "estoque envia foto de sobra"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'fotos-sobras'
    and caminho_e_da_organizacao(name)
    and pode_movimentar_estoque()
  );

drop policy if exists "estoque substitui foto de sobra" on storage.objects;
create policy "estoque substitui foto de sobra"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'fotos-sobras'
    and caminho_e_da_organizacao(name)
    and pode_movimentar_estoque()
  );

drop policy if exists "estoque apaga foto de sobra" on storage.objects;
create policy "estoque apaga foto de sobra"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'fotos-sobras'
    and caminho_e_da_organizacao(name)
    and pode_movimentar_estoque()
  );

-- -----------------------------------------------------------------------------
-- Desenhos técnicos
-- -----------------------------------------------------------------------------
-- Leitura liberada a todos os papéis: o serralheiro precisa consultar a cota
-- do perfil justamente na hora de conferir a peça.
drop policy if exists "ver desenhos técnicos da organização" on storage.objects;
create policy "ver desenhos técnicos da organização"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'desenhos-tecnicos'
    and caminho_e_da_organizacao(name)
  );

drop policy if exists "estoque envia desenho técnico" on storage.objects;
create policy "estoque envia desenho técnico"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'desenhos-tecnicos'
    and caminho_e_da_organizacao(name)
    and pode_movimentar_estoque()
  );

drop policy if exists "estoque apaga desenho técnico" on storage.objects;
create policy "estoque apaga desenho técnico"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'desenhos-tecnicos'
    and caminho_e_da_organizacao(name)
    and pode_movimentar_estoque()
  );

-- -----------------------------------------------------------------------------
-- Campos novos em arquivos_vetoriais
-- -----------------------------------------------------------------------------
-- A tabela foi criada na Etapa 1 preparada para a Fase 2. Aqui ela ganha o
-- que faltava para o uso imediato: legenda e ordem de exibição. Nenhuma
-- tabela nova — a Fase 2 vai usar esta mesma, com `tipo` diferente.
alter table arquivos_vetoriais
  add column if not exists legenda text,
  add column if not exists ordem integer not null default 0;

comment on column arquivos_vetoriais.legenda is
  'Qual vista a imagem mostra: "frontal", "corte A-A", "detalhe do encaixe".';
comment on column arquivos_vetoriais.ordem is
  'Ordem de exibição na galeria do perfil. Menor aparece primeiro.';

create index if not exists idx_arquivos_vetoriais_ordem
  on arquivos_vetoriais (modelo_perfil_id, ordem);

-- Faltava a política de exclusão: sem ela, uma imagem enviada por engano
-- ficaria para sempre.
drop policy if exists "estoque remove arquivo vetorial" on arquivos_vetoriais;
create policy "estoque remove arquivo vetorial"
  on arquivos_vetoriais for delete
  to authenticated
  using (organizacao_id = organizacao_atual() and pode_movimentar_estoque());

drop policy if exists "estoque edita arquivo vetorial" on arquivos_vetoriais;
create policy "estoque edita arquivo vetorial"
  on arquivos_vetoriais for update
  to authenticated
  using (organizacao_id = organizacao_atual() and pode_movimentar_estoque())
  with check (organizacao_id = organizacao_atual());
