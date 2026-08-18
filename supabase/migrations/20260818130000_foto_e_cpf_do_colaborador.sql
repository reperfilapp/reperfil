-- Foto e CPF no cadastro do colaborador.
--
-- ── PARA QUE A FOTO ──────────────────────────────────────────────────────
--
-- Num depósito, o histórico de uma peça diz "quem cadastrou: J. Silva". Numa
-- empresa com dois Silvas, isso não identifica ninguém — e é justamente
-- quando algo deu errado que se vai olhar. O rosto resolve em um instante o
-- que um nome repetido não resolve nunca.
--
-- ── O CPF É OPCIONAL AQUI ────────────────────────────────────────────────
--
-- Ele serve ao cadastro de pessoal da empresa, não ao funcionamento do
-- sistema: nada no RePerfil depende dele. Exigir documento de quem só vai
-- procurar uma sobra seria pedir dado sensível sem ter o que fazer com ele.

alter table perfis_usuario
  add column if not exists cpf text,
  add column if not exists foto_url text;

comment on column perfis_usuario.cpf is
  'Só dígitos, sem pontuação — a máscara é da tela. Opcional.';
comment on column perfis_usuario.foto_url is
  'Caminho no balde fotos-colaboradores. NÃO é endereço público: o balde é
   privado e a exibição pede um link temporário.';

-- -----------------------------------------------------------------------------
-- O balde
-- -----------------------------------------------------------------------------
-- Separado dos outros porque o conteúdo é diferente em natureza: peça e
-- desenho são da empresa, rosto é da pessoa. Misturá-los no mesmo balde
-- tornaria impossível dizer "apague as fotos das pessoas" sem apagar o
-- catálogo junto.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fotos-colaboradores',
  'fotos-colaboradores',
  false,
  2097152,  -- 2 MB; é um retrato pequeno, o aplicativo comprime antes
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types,
      public = excluded.public;

drop policy if exists "ver fotos de colaboradores da organização" on storage.objects;
create policy "ver fotos de colaboradores da organização"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'fotos-colaboradores'
    and caminho_e_da_organizacao(name)
  );

-- Qualquer pessoa autenticada envia: a primeira foto é enviada pelo próprio
-- colaborador ao completar o cadastro, antes de ele ter permissão nenhuma.
-- Exigir permissão aqui trancaria justamente quem precisa entrar.
drop policy if exists "enviar foto de colaborador" on storage.objects;
create policy "enviar foto de colaborador"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'fotos-colaboradores'
    and caminho_e_da_organizacao(name)
  );

drop policy if exists "apagar foto de colaborador" on storage.objects;
create policy "apagar foto de colaborador"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'fotos-colaboradores'
    and caminho_e_da_organizacao(name)
    and pode_gerenciar_colaboradores()
  );
