-- =============================================================================
-- RePerfil — Entrar por nickname, além de e-mail
-- =============================================================================
--
-- Cada colaborador pode escolher um nickname curto para entrar no lugar do
-- e-mail — mais fácil de digitar e lembrar no celular, no depósito. Único
-- POR ORGANIZAÇÃO, não globalmente: nada impede duas empresas diferentes de
-- terem cada uma o seu "joao".
--
-- Como o login é ANTES de existir sessão, a tradução de nickname para e-mail
-- não pode passar pelo RLS de sempre (que exige `organizacao_atual()`, que
-- não existe ainda). Por isso a função abaixo é concedida também a `anon` —
-- a única do sistema com esse privilégio, e ela só devolve o e-mail
-- correspondente, nada além disso.
-- =============================================================================

alter table perfis_usuario
  add column if not exists apelido text;

alter table perfis_usuario
  drop constraint if exists apelido_formato_valido;

alter table perfis_usuario
  add constraint apelido_formato_valido check (
    apelido is null or apelido ~ '^[a-z0-9._-]{3,30}$'
  );

comment on column perfis_usuario.apelido is
  'Nome de usuário alternativo para entrar, sem precisar do e-mail. Único
   por organização — a mesma palavra pode existir em empresas diferentes,
   por isso resolver_email_login pode devolver mais de uma linha.';

-- Índice parcial: ignora quem não escolheu nickname (todos os NULLs
-- convivem em paz), e garante unicidade só dentro da mesma organização.
create unique index if not exists idx_perfis_usuario_apelido
  on perfis_usuario (organizacao_id, apelido)
  where apelido is not null;

-- -----------------------------------------------------------------------------
-- A tradução de nickname para e-mail, antes do login existir
-- -----------------------------------------------------------------------------
create or replace function resolver_email_login(p_identificador text)
returns table(email text, organizacao_nome text)
language sql
stable
security definer
set search_path = public
as $$
  select p.email, o.nome_fantasia
  from perfis_usuario p
  join organizacoes o on o.id = p.organizacao_id
  where p.apelido = lower(trim(p_identificador))
    and p.ativo
$$;

comment on function resolver_email_login is
  'Traduz um nickname para o(s) e-mail(s) de login correspondentes. Pode
   devolver mais de uma linha: nickname é único por empresa, não
   globalmente, então "joao" pode existir em duas organizações diferentes —
   quem chama decide o que fazer com mais de um resultado (pedir para
   escolher a empresa). Chamada ANTES do login: por isso concedida a anon.';

grant execute on function resolver_email_login to anon, authenticated;
