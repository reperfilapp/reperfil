import type { ItemListaTecnica, ModeloPerfil } from '@/tipos/banco'

/**
 * Ordenações automáticas para a lista técnica.
 *
 * ── POR QUE ORDENAR AUTOMÁTICO SE JÁ DÁ PARA ARRASTAR ────────────────────
 *
 * Arrastar serve para a sequência de montagem, que só quem monta conhece.
 * Mas uma lista recém-digitada, com vinte cortes lançados na ordem em que
 * vieram à cabeça, precisa primeiro de uma organização qualquer — e aí
 * arrastar vinte linhas uma a uma é trabalho que uma regra faz num toque.
 *
 * Um serve ao outro: ordena-se por linha para agrupar o que é do mesmo
 * sistema, e depois arrasta-se o que ficou fora de lugar.
 *
 * ── A ORDEM ESCOLHIDA VIRA A ORDEM GRAVADA ───────────────────────────────
 *
 * Aplicar um critério não é um filtro de exibição: reescreve as posições. Se
 * fosse só visual, a folha impressa e a tela mostrariam ordens diferentes, e
 * a lista voltaria ao estado antigo ao recarregar — desfazendo, sem avisar,
 * o que a pessoa acabou de organizar.
 */

export type CriterioOrdenacao = 'codigo' | 'linha' | 'comprimento' | 'estoque'

export const CRITERIOS: { valor: CriterioOrdenacao; rotulo: string }[] = [
  { valor: 'codigo', rotulo: 'Código do perfil (A→Z)' },
  { valor: 'linha', rotulo: 'Linha e depois código' },
  { valor: 'comprimento', rotulo: 'Do corte mais longo ao mais curto' },
  { valor: 'estoque', rotulo: 'O que tem sobra em estoque primeiro' },
]

interface Contexto {
  modelos: readonly ModeloPerfil[]
  /** Peças livres por perfil. Zero, ou ausente, é "não tem". */
  pecasPorPerfil: Map<string, number>
}

function perfilDe(
  item: ItemListaTecnica,
  modelos: readonly ModeloPerfil[],
): ModeloPerfil | undefined {
  return modelos.find((m) => m.id === item.modelo_perfil_id)
}

/**
 * A lista reordenada pelo critério, sem alterar a original.
 *
 * Todo critério desempata pelo CÓDIGO do perfil, e depois pelo comprimento.
 * Sem isso, dois itens equivalentes trocariam de lugar a cada aplicação —
 * a lista pareceria embaralhar sozinha, e ninguém confiaria nela.
 */
export function ordenarLista(
  itens: readonly ItemListaTecnica[],
  criterio: CriterioOrdenacao,
  { modelos, pecasPorPerfil }: Contexto,
): ItemListaTecnica[] {
  const codigo = (item: ItemListaTecnica) =>
    perfilDe(item, modelos)?.codigo ?? ''

  const linha = (item: ItemListaTecnica) =>
    perfilDe(item, modelos)?.linha?.trim() ?? ''

  const pecas = (item: ItemListaTecnica) =>
    pecasPorPerfil.get(item.modelo_perfil_id) ?? 0

  const desempate = (a: ItemListaTecnica, b: ItemListaTecnica) =>
    codigo(a).localeCompare(codigo(b), 'pt-BR') ||
    b.comprimento_mm - a.comprimento_mm

  const comparar: Record<
    CriterioOrdenacao,
    (a: ItemListaTecnica, b: ItemListaTecnica) => number
  > = {
    codigo: desempate,

    linha: (a, b) => {
      // Perfil sem linha vai para o fim: é o resto, não um grupo.
      const semA = linha(a) === ''
      const semB = linha(b) === ''

      if (semA !== semB) return semA ? 1 : -1

      return linha(a).localeCompare(linha(b), 'pt-BR') || desempate(a, b)
    },

    comprimento: (a, b) =>
      b.comprimento_mm - a.comprimento_mm || desempate(a, b),

    estoque: (a, b) => {
      // Só "tem ou não tem", e não quantas peças: a pergunta aqui é por onde
      // começar a montar, e cinco peças não são melhores que duas quando as
      // duas bastam. Ordenar pela quantidade colocaria o perfil abundante
      // antes do que está no limite, que é o que merece atenção.
      const temA = pecas(a) > 0
      const temB = pecas(b) > 0

      if (temA !== temB) return temA ? -1 : 1

      return desempate(a, b)
    },
  }

  return [...itens].sort(comparar[criterio])
}
