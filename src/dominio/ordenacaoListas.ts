/**
 * Estado do alternador de ordenação usado nas telas que agrupam perfis ou
 * linhas: estoque ou nome, cada um com sua própria direção.
 *
 * `'manual'` só existe para a LISTA DE LINHAS em "Linhas e sistemas" — é o
 * estado inicial da tela, antes de tocar em qualquer um dos dois botões
 * (que só conhecem 'estoque' e 'nome'; `AlternadorOrdenacao` mostra os dois
 * apagados quando o critério é 'manual', porque nenhum dos dois está
 * ativo). Representa "a ordem que o administrador definiu arrastando".
 *
 * Fica fora de `AlternadorOrdenacao.tsx` para o React Refresh não reclamar de
 * um arquivo de componente exportando também um tipo e uma constante.
 */
export type CriterioOrdenacaoLista = 'estoque' | 'nome' | 'manual'

export interface EstadoOrdenacaoLista {
  criterio: CriterioOrdenacaoLista
  /** Estoque: maior primeiro (padrão) quando true. Nome: Z→A quando true. */
  decrescente: boolean
}

/** Mais estoque primeiro — o padrão de toda lista de perfil do app. */
export const ORDENACAO_PADRAO: EstadoOrdenacaoLista = {
  criterio: 'estoque',
  decrescente: true,
}

/**
 * Compara duas linhas pela ordem manual que o administrador definiu — a
 * que não tem posição definida entra depois de todas as que têm, em ordem
 * alfabética entre si.
 *
 * Não decide "sem linha": quem chama já tira esse caso antes, à parte —
 * "sem linha" não é uma linha de verdade, sempre vai por último em
 * qualquer critério.
 */
export function compararPorOrdemLinha(
  a: string,
  b: string,
  ordem: ReadonlyMap<string, number>,
): number {
  const posA = ordem.get(a)
  const posB = ordem.get(b)

  if (posA !== undefined && posB !== undefined) return posA - posB
  if (posA !== undefined) return -1
  if (posB !== undefined) return 1

  return a.localeCompare(b, 'pt-BR')
}
