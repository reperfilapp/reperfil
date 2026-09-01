-- =============================================================================
-- RePerfil — Acessórios no catálogo de cards da tela inicial
-- =============================================================================
--
-- Dois cards novos, um em cada grupo: quantos acessórios estão cadastrados
-- (resumo) e o atalho para o catálogo de acessórios (`/acessorios`). O
-- atalho não pode reaproveitar a chave `acessorios` que já existe em
-- `atalho` — aquela aponta para o ESTOQUE (`/estoque-acessorios`), esta
-- aponta para o CADASTRO (o catálogo de modelos). Por isso a chave nova é
-- `catalogoAcessorios`.
--
-- O catálogo de itens válidos é um `check`, não uma tabela — precisa
-- recriar a constraint para aceitar as duas chaves novas.
-- =============================================================================

-- A constraint já tinha sido recriada uma vez depois da migração original
-- (`20260831500000_atalho_linhas_e_sistemas.sql`, que acrescentou `linhas`
-- ao grupo 'atalho') — parte daqui, não do texto de `20260831400000`, senão
-- este `alter` desfaria aquela mudança.
alter table cards_tela_inicial drop constraint if exists item_do_catalogo;

alter table cards_tela_inicial add constraint item_do_catalogo check (
  (grupo = 'resumo' and item in ('disponiveis', 'metros', 'perfis', 'linhas', 'produtos', 'acessorios'))
  or
  (grupo = 'atalho' and item in (
    'cadastrar', 'utilizar', 'perfis', 'produtos',
    'procurar', 'identificar', 'inventario', 'acessorios', 'linhas', 'catalogoAcessorios'
  ))
);
