-- =============================================================================
-- RePerfil — Campo "Aplicação" no cadastro de perfil
-- =============================================================================
--
-- Onde aquele perfil é usado na esquadria: "lateral da porta", "base da
-- janela", "montante", "travessa". É informação livre, porque a nomenclatura
-- varia entre fabricantes e entre empresas — não faz sentido travar numa
-- lista fechada.
--
-- Ajuda o serralheiro a confirmar a peça certa quando o código sozinho não
-- basta: dois perfis podem ter seção parecida e aplicações bem diferentes.
-- =============================================================================

alter table modelos_perfil
  add column if not exists aplicacao text;

comment on column modelos_perfil.aplicacao is
  'Onde o perfil é usado na esquadria: "lateral da porta", "base da janela",
   "montante". Texto livre — a nomenclatura varia entre fabricantes.';
