import { planejarCorte, type ConfiguracaoCorte } from './corte'

/**
 * Pesquisa de sobras para um corte.
 *
 * Regras desta fase, conforme a especificação:
 *
 * • Só entram peças com o acabamento EXATO do pedido. Substituir acabamento
 *   por conta própria é o erro mais caro que o sistema poderia cometer: duas
 *   peças "brancas" de lotes de pintura diferentes ficam visivelmente
 *   distintas na mesma esquadria, e o cliente devolve a obra. A única exceção
 *   é uma regra que o administrador tenha criado de propósito.
 *
 * • Peça que não comporta o corte, depois de descontadas serra e margem de
 *   limpeza, não aparece. Mostrar peça que "quase serve" faz o serralheiro
 *   caminhar até a prateleira à toa.
 *
 * • A ordenação é MENOR SOBRA primeiro. Parece contraintuitivo — não seria
 *   melhor preservar as peças curtas? Não: gastar a ponta que sobra pouco
 *   evita picar uma barra grande por causa de um corte pequeno, e é a barra
 *   grande que serve para o próximo trabalho.
 */

export interface CandidataSobra {
  id: string
  codigo: string
  comprimentoMm: number
  quantidadeDisponivel: number
  acabamentoId: string
  localizacaoCodigo: string | null
  criadoEm: string
}

export interface ResultadoPesquisa<T extends CandidataSobra> {
  sobra: T
  /** Quanto resta da peça depois do corte, já descontando serra e margem. */
  sobraResultanteMm: number
  /** Para onde vai esse resto. */
  destinoResto: 'sobra' | 'descarte' | 'sem-resto'
}

export interface FiltroPesquisa {
  /** Comprimento do corte necessário, em milímetros. */
  corteMm: number
  /** Acabamento exigido. Só peças com este acabamento entram… */
  acabamentoId: string
  /** …ou com um destes, quando o administrador criou regra de compatibilidade. */
  acabamentosCompativeis?: readonly string[]
  /** Quantas peças são necessárias. Lotes com menos disponível saem. */
  quantidadeMinima?: number
  /** Filtra por localização, quando informada. */
  localizacaoCodigo?: string | null
}

/**
 * Seleciona e ordena as sobras que servem para o corte.
 *
 * A ordem final é: menor sobra resultante, depois localização (para agrupar a
 * separação por prateleira), depois a peça mais antiga — que é a que corre
 * risco de envelhecer no depósito.
 */
export function pesquisarSobras<T extends CandidataSobra>(
  candidatas: readonly T[],
  filtro: FiltroPesquisa,
  config: ConfiguracaoCorte,
): ResultadoPesquisa<T>[] {
  const acabamentosAceitos = new Set<string>([
    filtro.acabamentoId,
    ...(filtro.acabamentosCompativeis ?? []),
  ])

  const quantidadeMinima = filtro.quantidadeMinima ?? 1

  const resultados: ResultadoPesquisa<T>[] = []

  for (const sobra of candidatas) {
    if (!acabamentosAceitos.has(sobra.acabamentoId)) continue
    if (sobra.quantidadeDisponivel < quantidadeMinima) continue

    if (
      filtro.localizacaoCodigo != null &&
      filtro.localizacaoCodigo !== '' &&
      sobra.localizacaoCodigo !== filtro.localizacaoCodigo
    ) {
      continue
    }

    const plano = planejarCorte(sobra.comprimentoMm, [filtro.corteMm], config)

    if (!plano.cabe) continue

    resultados.push({
      sobra,
      sobraResultanteMm: plano.restoMm,
      destinoResto: plano.destinoResto,
    })
  }

  return resultados.sort((a, b) => {
    if (a.sobraResultanteMm !== b.sobraResultanteMm) {
      return a.sobraResultanteMm - b.sobraResultanteMm
    }

    const localA = a.sobra.localizacaoCodigo ?? ''
    const localB = b.sobra.localizacaoCodigo ?? ''

    if (localA !== localB) {
      return localA.localeCompare(localB, 'pt-BR')
    }

    return a.sobra.criadoEm.localeCompare(b.sobra.criadoEm)
  })
}

/**
 * Classifica o quanto uma peça é adequada, para exibição.
 *
 * "Ideal" é o resto que não vira lixo: ou a peça é consumida por inteiro, ou
 * o que sobra ainda serve para outro trabalho. "Gera descarte" merece aviso,
 * porque usar aquela peça significa jogar material fora.
 */
export type Aproveitamento = 'exato' | 'ideal' | 'gera-descarte'

export function classificarAproveitamento(
  resultado: ResultadoPesquisa<CandidataSobra>,
): Aproveitamento {
  if (resultado.destinoResto === 'sem-resto') return 'exato'

  return resultado.destinoResto === 'descarte' ? 'gera-descarte' : 'ideal'
}
