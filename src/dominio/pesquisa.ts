import {
  cortesQueUmLoteComporta,
  distribuirCortes,
  type ConfiguracaoCorte,
  type GrupoDeCorte,
} from './corte'

/*
 * Reexportado: a função é geometria de corte e mora em `corte.ts`, mas
 * chegou aqui primeiro e é daqui que as telas e os testes a importam.
 * Mantê-la disponível neste caminho evita mexer em quem já a usa.
 */
export { cortesQueUmLoteComporta }

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
  /** Como os cortes se dividem entre as peças, e o resto de cada grupo. */
  grupos: GrupoDeCorte[]
  /** Tudo que volta ao estoque somando as peças, não só a primeira. */
  totalRestanteMm: number
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
    if (
      filtro.acabamentoId !== '' &&
      !acabamentosAceitos.has(sobra.acabamentoId)
    ) {
      continue
    }

    if (
      filtro.localizacaoCodigo != null &&
      filtro.localizacaoCodigo !== '' &&
      sobra.localizacaoCodigo !== filtro.localizacaoCodigo
    ) {
      continue
    }

    /*
     * A MESMA distribuição que a confirmação do corte vai usar, e não uma
     * conta paralela: é ela que diz quantas peças entram e quanto sobra de
     * cada uma. Duas fórmulas para a mesma pergunta acabam discordando, e aí
     * a tela promete um resto e o estoque grava outro.
     */
    const grupos = distribuirCortes(
      sobra.comprimentoMm,
      filtro.corteMm,
      quantidadeCortes,
      config,
    )

    if (grupos.length === 0) continue

    const pecasNecessarias = grupos.reduce((total, g) => total + g.pecas, 0)

    // Há peças livres suficientes no lote?
    if (sobra.quantidadeDisponivel < pecasNecessarias) continue

    /*
     * Tudo que volta para a prateleira, somando as peças. Mostrar só o resto
     * da primeira subestimava o retorno justamente no caso que mais rende: a
     * última peça costuma levar menos cortes e sobrar bem mais.
     */
    const totalRestanteMm = grupos.reduce(
      (total, g) => total + (g.destinoResto === 'sobra' ? g.restoMm * g.pecas : 0),
      0,
    )

    const primeiro = grupos[0]!

    resultados.push({
      sobra,
      sobraResultanteMm: primeiro.restoMm,
      destinoResto: primeiro.destinoResto,
      pecasNecessarias,
      grupos,
      totalRestanteMm,
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
