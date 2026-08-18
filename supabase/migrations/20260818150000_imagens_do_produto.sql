-- Foto e desenho técnico do produto.
--
-- ── DUAS IMAGENS, E NÃO UMA ──────────────────────────────────────────────
--
-- Elas respondem a perguntas diferentes. A FOTO é a janela pronta, do jeito
-- que o cliente vai ver — serve para mostrar no balcão e para conferir se o
-- que saiu da oficina é o que foi combinado. O DESENHO é o esquema com as
-- cotas, que quem monta consulta na bancada.
--
-- Guardar as duas no mesmo campo obrigaria a escolher qual perder.

alter table produtos
  add column if not exists foto_url text,
  add column if not exists desenho_url text;

comment on column produtos.foto_url is
  'Caminho no balde imagens-produtos. NÃO é endereço público: o balde é
   privado e a exibição pede um link temporário.';
comment on column produtos.desenho_url is
  'Esquema com as cotas, para quem monta. Mesmo balde da foto.';

-- -----------------------------------------------------------------------------
-- O balde
-- -----------------------------------------------------------------------------
-- Limite maior que o das fotos de sobra: desenho com cota precisa de
-- resolução para o zoom, senão a medida fica ilegível justamente para quem
-- está com a peça na bancada.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'imagens-produtos',
  'imagens-produtos',
  false,
  5242880,  -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = excluded.public;

drop policy if exists "ver imagens de produto da organização" on storage.objects;
create policy "ver imagens de produto da organização"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'imagens-produtos'
    and caminho_e_da_organizacao(name)
  );

drop policy if exists "quem gerencia cadastros envia imagem de produto" on storage.objects;
create policy "quem gerencia cadastros envia imagem de produto"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'imagens-produtos'
    and caminho_e_da_organizacao(name)
    and pode_gerenciar_cadastros()
  );

drop policy if exists "quem gerencia cadastros apaga imagem de produto" on storage.objects;
create policy "quem gerencia cadastros apaga imagem de produto"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'imagens-produtos'
    and caminho_e_da_organizacao(name)
    and pode_gerenciar_cadastros()
  );
