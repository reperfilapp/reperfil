/**
 * Estado do alternador de ordenação usado nas telas que agrupam perfis ou
 * linhas: estoque ou nome, cada um com sua própria direção.
 *
 * Fica fora de `AlternadorOrdenacao.tsx` para o React Refresh não reclamar de
 * um arquivo de componente exportando também um tipo e uma constante.
 */
export type CriterioOrdenacaoLista = 'estoque' | 'nome'

export interface EstadoOrdenacaoLista {
  criterio: CriterioOrdenacaoLista
  /** Estoque: maior primeiro (padrão) quando true. Nome: Z→A quando true. */
  decrescente: boolean
}

/** Mais estoque primeiro — o padrão de toda lista de perfil ou linha do app. */
export const ORDENACAO_PADRAO: EstadoOrdenacaoLista = {
  criterio: 'estoque',
  decrescente: true,
}
