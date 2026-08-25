-- =============================================================================
-- RePerfil — Logo da empresa desenvolvedora, para a página "Sobre"
-- =============================================================================
--
-- Guardada em `configuracoes_aplicacao`, e não em `organizacoes`: é
-- informação sobre quem FEZ o sistema, não sobre a empresa que o usa — as
-- duas coisas não podem morar na mesma linha sem confundir.
--
-- Reaproveita o bucket `logos-organizacoes` e as políticas que já existem
-- para ele (só administrador envia/substitui, qualquer membro da
-- organização vê) — o nome do arquivo é que muda, para não colidir com o
-- logo da própria organização no mesmo caminho.
-- =============================================================================

alter table configuracoes_aplicacao
  add column if not exists logo_desenvolvedor_caminho text;

comment on column configuracoes_aplicacao.logo_desenvolvedor_caminho is
  'Caminho do logo da empresa desenvolvedora no bucket logos-organizacoes.
   Formato: {org_id}/logo-desenvolvedor.jpg — mesmo bucket e políticas do
   logo da organização, arquivo diferente.';
