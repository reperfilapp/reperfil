-- =============================================================================
-- RePerfil — "Linhas e sistemas" também pode ser atalho da tela inicial
-- =============================================================================
--
-- Faltava no catálogo de atalhos escolhíveis (`cards_tela_inicial`, grupo
-- 'atalho') — mesmo destino (`/linhas`) e ícone que a tela "Mais" já usa.
-- =============================================================================

alter table cards_tela_inicial drop constraint item_do_catalogo;

alter table cards_tela_inicial add constraint item_do_catalogo check (
  (grupo = 'resumo' and item in ('disponiveis', 'metros', 'perfis', 'linhas', 'produtos'))
  or
  (grupo = 'atalho' and item in (
    'cadastrar', 'utilizar', 'perfis', 'produtos',
    'procurar', 'identificar', 'inventario', 'acessorios', 'linhas'
  ))
);
