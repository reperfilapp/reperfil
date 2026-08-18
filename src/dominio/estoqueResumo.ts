/**
 * Quanto há de cada coisa no depósito, para ordenar o que se vê primeiro.
 *
 * ── POR QUE ORDENAR POR TAMANHO DE ESTOQUE ───────────────────────────────
 *
 * Em ordem alfabética, a linha com duas pontas esquecidas aparece antes da
 * que tem quarenta peças. Quem abre o estoque quase sempre quer o que há em
 * quantidade — é ali que existe o que aproveitar. A ordem alfabética serve a
 * quem procura um item específico, e para isso existe a busca.
 *
 * ── O QUE ENTRA NA CONTA ─────────────────────────────────────────────────
 *
 * Só o que está DISPONÍVEL: peça reservada tem dono, e consumida ou
 * descartada não está mais na prateleira. Contá-las inflaria o número e
 * mandaria alguém procurar material que não existe.
 *
 * As peças continuam todas visíveis nas listas — o que muda aqui é só a
 * conta que decide a ordem e o resumo.
 */

export interface SobraParaResumo {
  modelo_perfil_id: string
  comprimento_mm: number
  quantidade: number
  quantidade_reservada: number
  status: string
}

export interface Resumo {
  /** Peças livres. */
  pecas: number
  /** Soma dos comprimentos das peças livres, em mm. */
  milimetros: number
}

const VAZIO: Resumo = { pecas: 0, milimetros: 0 }

function livres(sobra: SobraParaResumo): number {
  if (sobra.status !== 'disponivel') return 0

  return Math.max(0, sobra.quantidade - sobra.quantidade_reservada)
}

/** Soma por perfil: quanto há de cada modelo do catálogo. */
export function resumirPorPerfil(
  sobras: readonly SobraParaResumo[],
): Map<string, Resumo> {
  const mapa = new Map<string, Resumo>()

  for (const sobra of sobras) {
    const pecas = livres(sobra)

    if (pecas === 0) continue

    const atual = mapa.get(sobra.modelo_perfil_id) ?? VAZIO

    mapa.set(sobra.modelo_perfil_id, {
      pecas: atual.pecas + pecas,
      milimetros: atual.milimetros + pecas * sobra.comprimento_mm,
    })
  }

  return mapa
}

/**
 * Soma por linha, usando a função que diz a linha de cada sobra.
 *
 * A linha vem de fora porque ela mora no PERFIL, não na sobra: quem chama já
 * tem o modelo em mãos e sabe resolver isso sem uma segunda consulta.
 */
export function resumirPorLinha<T extends SobraParaResumo>(
  sobras: readonly T[],
  linhaDe: (sobra: T) => string,
): Map<string, Resumo> {
  const mapa = new Map<string, Resumo>()

  for (const sobra of sobras) {
    const pecas = livres(sobra)

    if (pecas === 0) continue

    const linha = linhaDe(sobra)
    const atual = mapa.get(linha) ?? VAZIO

    mapa.set(linha, {
      pecas: atual.pecas + pecas,
      milimetros: atual.milimetros + pecas * sobra.comprimento_mm,
    })
  }

  return mapa
}

export function resumoDe(mapa: Map<string, Resumo>, chave: string): Resumo {
  return mapa.get(chave) ?? VAZIO
}

/**
 * "12,5 m · 4 peças" — o estoque numa linha de texto.
 *
 * Os dois números juntos porque um sozinho engana: 30 metros podem ser uma
 * barra inteira ou dez pontas de três metros, e a diferença decide se dá
 * para fazer a janela.
 */
export function formatarResumo(resumo: Resumo): string {
  const metros = (resumo.milimetros / 1000).toFixed(1).replace('.', ',')

  return `${metros} m · ${resumo.pecas} ${resumo.pecas === 1 ? 'peça' : 'peças'}`
}

/**
 * Compara dois resumos, do maior para o menor.
 *
 * Pelos METROS, não pelas peças: é o metro que diz se cabe o corte. Empate
 * em metros desempata por peças — mais peças significa mais chance de
 * encaixar um corte sem sobrar retalho inútil.
 */
export function maiorPrimeiro(a: Resumo, b: Resumo): number {
  if (b.milimetros !== a.milimetros) return b.milimetros - a.milimetros

  return b.pecas - a.pecas
}
