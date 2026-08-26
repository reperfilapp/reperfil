-- Marca qual organização é o catálogo central, e libera a leitura das
-- imagens dela (fotos de perfil, desenhos técnicos, imagens de produto)
-- para QUALQUER organização autenticada — sem isto, mover os arquivos de
-- verdade para a pasta da central quebraria as imagens de quem os usava
-- antes (a Alumifort).
--
-- Só uma organização pode ser a central por vez — o índice único abaixo
-- garante isso.
alter table organizacoes
  add column if not exists eh_catalogo_central boolean not null default false;

create unique index if not exists idx_organizacao_catalogo_central_unico
  on organizacoes ((eh_catalogo_central))
  where eh_catalogo_central;

update organizacoes
set eh_catalogo_central = true
where nome_fantasia = 'RePerfil';

-- Mesmo princípio de `organizacao_atual()`: concentrado numa função para
-- não repetir a mesma subconsulta em cada política.
create or replace function organizacao_catalogo_central()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select id from organizacoes where eh_catalogo_central limit 1
$$;

comment on function organizacao_catalogo_central is
  'Id da organização marcada como catálogo central, ou nulo se nenhuma foi marcada ainda.';

-- Mesma ideia de `caminho_e_da_organizacao`, mas comparando com a
-- organização CENTRAL em vez da do usuário autenticado.
create or replace function caminho_e_do_catalogo_central(p_caminho text)
returns boolean
language sql
stable
security definer
set search_path = public, storage
as $$
  select coalesce(
    (storage.foldername(p_caminho))[1] = organizacao_catalogo_central()::text,
    false
  )
$$;

comment on function caminho_e_do_catalogo_central is
  'Verdadeiro quando a primeira pasta do caminho é a organização central.';

-- Uma política de SELECT a mais em cada balde — políticas permissivas se
-- somam com OU: continua valendo "vejo os arquivos da minha organização"
-- e passa a valer também "vejo os arquivos da organização central".
drop policy if exists "ver fotos de perfil do catalogo central" on storage.objects;
create policy "ver fotos de perfil do catalogo central"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'fotos-perfis'
    and caminho_e_do_catalogo_central(name)
  );

drop policy if exists "ver desenhos do catalogo central" on storage.objects;
create policy "ver desenhos do catalogo central"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'desenhos-tecnicos'
    and caminho_e_do_catalogo_central(name)
  );

drop policy if exists "ver imagens de produto do catalogo central" on storage.objects;
create policy "ver imagens de produto do catalogo central"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'imagens-produtos'
    and caminho_e_do_catalogo_central(name)
  );
