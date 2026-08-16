-- =============================================================================
-- RePerfil — Fotos reais do perfil
-- =============================================================================
--
-- O desenho técnico mostra a geometria e as cotas; a foto mostra a peça como
-- ela é de fato — a cor do anodizado, o estado do acabamento, o encaixe real.
-- São informações diferentes e complementares, e por isso ficam separadas.
--
-- Tiradas no mesmo ângulo do desenho, foto e desenho lado a lado permitem a
-- conferência mais rápida possível: a pessoa compara a ponta que tem na mão
-- com as duas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Novo tipo de arquivo
-- -----------------------------------------------------------------------------
-- `arquivos_vetoriais` já guarda o desenho de catálogo com tipo 'imagem'.
-- 'foto' é a fotografia da peça real. Continuam na MESMA tabela: são ambos
-- representações do perfil, e a Fase 2 vai acrescentar 'secao_svg' e
-- 'secao_dxf' ao lado deles.
alter type tipo_arquivo_vetorial add value if not exists 'foto';

-- -----------------------------------------------------------------------------
-- Balde das fotos
-- -----------------------------------------------------------------------------
-- Separado dos desenhos por clareza: um balde chamado "desenhos-tecnicos"
-- cheio de fotografias confundiria quem for olhar o armazenamento depois.
-- As regras de acesso são as mesmas.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fotos-perfis',
  'fotos-perfis',
  false,
  3145728,  -- 3 MB; o aplicativo comprime antes de enviar
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = excluded.public;

drop policy if exists "ver fotos de perfil da organização" on storage.objects;
create policy "ver fotos de perfil da organização"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'fotos-perfis'
    and caminho_e_da_organizacao(name)
  );

drop policy if exists "estoque envia foto de perfil" on storage.objects;
create policy "estoque envia foto de perfil"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'fotos-perfis'
    and caminho_e_da_organizacao(name)
    and pode_movimentar_estoque()
  );

drop policy if exists "estoque apaga foto de perfil" on storage.objects;
create policy "estoque apaga foto de perfil"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'fotos-perfis'
    and caminho_e_da_organizacao(name)
    and pode_movimentar_estoque()
  );
