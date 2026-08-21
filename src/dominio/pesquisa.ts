import { planejarCorte, comprimentoNecessario, type ConfiguracaoCorte } from './corte'

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
 *
 * ── Semântica de quantidade ──────────────────────────────────────────────
 *
 * O usuário informa QUANTOS CORTES de X mm ele precisa — por exemplo,
 * "5 cortes de 1 m". O sistema calcula quantos LOTES FÍSICOS são necessários
 * para produzir esses cortes.
 *
 * Um lote de 6 m comporta 5 cortes de 1 m (5×1000 + 4×3 = 5012 mm < 6000 mm),
 * então apenas 1 lote físico precisa ser reservado.
 *
 * Só são listados lotes que INDIVIDUALMENTE comportam todos os cortes pedidos.
 * Quando nenhum lote único comporta a quantidade total, retorna vazio.
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
  /** Quanto resta da peça depois de todos os cortes, já descontando serras. */
  sobraResultanteMm: number
  /** Para onde vai esse resto. */
  destinoResto: 'sobra' | 'descarte' | 'sem-resto'
  /**
   * Quantas peças físicas deste lote precisam ser reservadas para
   * produzir todos os cortes pedidos.
   *
   * Exemplo: 5 cortes de 1 m de um lote com peças de 6 m → pecasNecessarias = 1,
   * porque 1 peça de 6 m comporta os 5 cortes.
   */
  pecasNecessarias: number
}

export interface FiltroPesquisa {
  /** Comprimento de cada corte necessário, em milímetros. */
  corteMm: number
  /** Quantidade de cortes necessários. */
  quantidadeCortes: number
  /** Acabamento exigido. Só peças com este acabamento entram… */
  acabamentoId: string
  /** …ou com um destes, quando o administrador criou regra de compatibilidade. */
  acabamentosCompativeis?: readonly string[]
  /** Filtra por localização, quando informada. */
  localizacaoCodigo?: string | null
}

/**
 * Calcula quantos cortes de `corteMm` cabem em uma peça de `comprimentoMm`.
 *
 * A lógica segue o modelo físico da serra: cada corte (exceto o último,
 * quando não há sobra) consome uma passada de serra. Isso significa que
 * k cortes numa peça consomem k×corteMm + (k-1)×serra de material.
 *
 * A abordagem binária (planejarCorte com k cortes) é robusta porque reutiliza
 * exatamente o mesmo cálculo que determina se um corte cabe — garantindo
 * que pesquisa e confirmação de corte nunca discordem.
 */
export function cortesQueUmLoteComporta(
  comprimentoMm: number,
  corteMm: number,
  config: ConfiguracaoCorte,
): number {
  if (corteMm <= 0 || comprimentoMm <= 0) return 0

  // Verifica se ao menos 1 corte cabe antes de entrar no loop.
  if (comprimentoNecessario([corteMm], config) > comprimentoMm) return 0

  // Começa por 1 e vai subindo até não caber mais.
  // Na prática, o limite é o comprimento da barra dividido pelo corte (~18),
  // então este loop é sempre curto.
  let k = 1
  while (true) {
    const necessario = comprimentoNecessario(
      Array.from({ length: k + 1 }, () => corteMm),
      config,
    )
    if (necessario > comprimentoMm) break
    k++
  }
  return k
}

/**
 * Seleciona e ordena as sobras que servem para o conjunto de cortes.
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

  const quantidadeCortes = filtro.quantidadeCortes ?? 1

  const resultados: ResultadoPesquisa<T>[] = []

  for (const sobra of candidatas) {
    if (!acabamentosAceitos.has(sobra.acabamentoId)) continue

    if (
      filtro.localizacaoCodigo != null &&
      filtro.localizacaoCodigo !== '' &&
      sobra.localizacaoCodigo !== filtro.localizacaoCodigo
    ) {
      continue
    }

    // Quantos cortes cabem neste lote?
    const cortesNesteLote = cortesQueUmLoteComporta(
      sobra.comprimentoMm,
      filtro.corteMm,
      config,
    )

    if (cortesNesteLote <= 0) continue

    // Quantas peças físicas do lote são necessárias para produzir todos os cortes?
    // Exemplo: 5 cortes de 1 m, lote com peças de 6 m (5 cortes/peça) → 1 peça.
    const pecasNecessarias = Math.ceil(quantidadeCortes / cortesNesteLote)

    // Há peças livres suficientes no lote?
    if (sobra.quantidadeDisponivel < pecasNecessarias) continue

    // Planeja o que sobra da PRIMEIRA peça após os cortes que ela absorverá.
    // Se 1 peça comporta todos os cortes, planeja todos de uma vez.
    // Se forem necessárias múltiplas peças, planeja só os cortes da primeira.
    const cortesNaPrimeiraPeca = Math.min(cortesNesteLote, quantidadeCortes)
    const cortesParaPlanejamento = Array.from(
      { length: cortesNaPrimeiraPeca },
      () => filtro.corteMm,
    )

    const plano = planejarCorte(sobra.comprimentoMm, cortesParaPlanejamento, config)

    if (!plano.cabe) continue

    resultados.push({
      sobra,
      sobraResultanteMm: plano.restoMm,
      destinoResto: plano.destinoResto,
      pecasNecessarias,
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
