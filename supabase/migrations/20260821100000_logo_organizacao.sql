-- =============================================================================
-- RePerfil — Logo da Organização
-- =============================================================================
--
-- Adiciona suporte a logo da empresa:
--   1. Coluna `logo_caminho` na tabela `organizacoes`
--   2. Bucket privado `logos-organizacoes` no Storage
--   3. Políticas de acesso isoladas por organização
--
-- O caminho no bucket segue o mesmo padrão dos outros baldes:
--   {organizacao_id}/logo.jpg
--
-- Apenas administradores podem enviar ou substituir o logo; todos os membros
-- da organização podem visualizá-lo (para a tela inicial e relatórios).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Coluna de caminho do logo
-- -----------------------------------------------------------------------------
alter table organizacoes
  add column if not exists logo_caminho text;

comment on column organizacoes.logo_caminho is
  'Caminho do logo no bucket logos-organizacoes. Formato: {org_id}/logo.jpg.';

-- -----------------------------------------------------------------------------
-- Bucket privado para logos
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'logos-organizacoes',
  'logos-organizacoes',
  false,
  2097152,  -- 2 MB: logo não precisa de alta resolução
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set file_size_limit    = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public             = excluded.public;

-- -----------------------------------------------------------------------------
-- Políticas do bucket
-- -----------------------------------------------------------------------------

-- Qualquer membro da organização pode ver o próprio logo
drop policy if exists "ver logo da organização" on storage.objects;
create policy "ver logo da organização"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'logos-organizacoes'
    and caminho_e_da_organizacao(name)
  );

-- Só administrador pode enviar um logo novo
drop policy if exists "administrador envia logo" on storage.objects;
create policy "administrador envia logo"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'logos-organizacoes'
    and caminho_e_da_organizacao(name)
    and e_administrador()
  );

-- Só administrador pode substituir o logo existente
drop policy if exists "administrador substitui logo" on storage.objects;
create policy "administrador substitui logo"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'logos-organizacoes'
    and caminho_e_da_organizacao(name)
    and e_administrador()
  );

-- Só administrador pode apagar o logo
drop policy if exists "administrador apaga logo" on storage.objects;
create policy "administrador apaga logo"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'logos-organizacoes'
    and caminho_e_da_organizacao(name)
    and e_administrador()
  );
