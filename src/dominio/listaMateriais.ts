import { type ConfiguracaoCorte } from './corte'
import {
  chaveDoCorte,
  consumirCorte,
  type ItemNecessario,
  type PecaEmUso,
  type SobraDisponivel,
} from './producao'

/**
 * Quanto material comprar para produzir N unidades de um produto.
 *
 * ── QUE PERGUNTA ISTO RESPONDE ───────────────────────────────────────────
 *
 * O veredito responde "dá para fazer com o que tenho?". Esta função responde
 * a pergunta seguinte, que é a do orçamento: "não dá — então quanto preciso
 * comprar?". Uma é para decidir se começa o serviço; a outra é para ligar
 * para o fornecedor.
 *
 * ── OS DOIS MODOS SÃO DUAS PERGUNTAS DIFERENTES ──────────────────────────
 *
 * `tudo_novo` ignora o depósito de propósito: é o custo cheio do serviço,
 * o número que vai para o orçamento do cliente. Descontar sobra de um
 * orçamento é regalar material que já foi pago noutra obra.
 *
 * `aproveitar_sobras` é a lista de compras de verdade — o que falta DEPOIS
 * de raspar o depósito. É menor, e é a que evita comprar barra para um corte
 * que já existe cortado no cavalete.
 *
 * ── POR QUE O ACABAMENTO ESCOLHE UM SÓ ───────────────────────────────────
 *
 * Somar sobra branca com sobra preta daria uma lista de compras menor e uma
 * janela de duas cores. Então, ao aproveitar o depósito, o cálculo escolhe UM
 * acabamento — o que cobre mais cortes — e ignora o resto. Errar para menos
 * custa uma barra a mais no pedido; errar para mais para o serviço no meio.
 */

/** Como a lista trata o que já está no depósito. */
export type ModoCompra = 'tudo_novo' | 'aproveitar_sobras'

export interface CorteNecessario {
  comprimento_mm: number
  /** Cortes pedidos, já multiplicados pela quantidade a produzir. */
  quantidade: number
  /** Quantos saem de sobra do depósito. Sempre 0 no modo `tudo_novo`. */
  deSobra: number
  /** Quantos precisam sair de barra nova. */
  deBarraNova: number
}

export interface LinhaMaterial {
  modelo_perfil_id: string
  comprimento_barra_mm: number
  cortes: CorteNecessario[]
  /** Barras inteiras a comprar para atender o que a sobra não cobre. */
  barrasNovas: number
  /**
   * Cortes mais longos que a barra do catálogo. Nenhuma compra resolve — ou
   * a medida está errada, ou o perfil está cadastrado com a barra errada.
   */
  cortesImpossiveis: number
  /** Metros lineares de corte pedidos, sem contar serra nem perda. */
  metrosDeCorte: number
  /** Material que sobra dentro das barras compradas, em mm. */
  restoDasBarrasMm: number
}

export interface ListaMateriais {
  modo: ModoCompra
  /** Quantas unidades do produto esta lista atende. */
  unidades: number
  linhas: LinhaMaterial[]
  /** Acabamento de onde as sobras foram tiradas. Nulo no modo `tudo_novo`. */
  acabamento_id: string | null
  /** Soma das barras novas de todas as linhas. */
  totalBarras: number
}

/** Peças físicas de um lote, uma por unidade em estoque. */
function pecasDe(sobras: readonly SobraDisponivel[]): PecaEmUso[] {
  const pecas: PecaEmUso[] = []

  for (const sobra of sobras) {
    for (let i = 0; i < sobra.quantidade; i++) {
      pecas.push({
        comprimento_mm: sobra.comprimento_mm,
        restante_mm: sobra.comprimento_mm,
      })
    }
  }

  return pecas
}

/**
 * Quantos cortes de cada tipo as sobras de UM acabamento cobrem.
 *
 * Do corte mais longo para o mais curto, pelo mesmo motivo do resto do
 * sistema: peça longa é a difícil de encaixar, e deixá-la por último é o
 * jeito certo de não conseguir.
 */
function atenderComSobras(
  cortes: readonly ItemNecessario[],
  sobras: readonly SobraDisponivel[],
  config: ConfiguracaoCorte,
): Map<string, number> {
  const estoque = new Map<string, PecaEmUso[]>()

  for (const perfilId of new Set(sobras.map((s) => s.modelo_perfil_id))) {
    estoque.set(
      perfilId,
      pecasDe(sobras.filter((s) => s.modelo_perfil_id === perfilId)),
    )
  }

  const atendidos = new Map<string, number>()
  const ordenados = [...cortes].sort(
    (a, b) => b.comprimento_mm - a.comprimento_mm,
  )

  for (const item of ordenados) {
    const pecas = estoque.get(item.modelo_perfil_id) ?? []
    let contados = 0

    for (let i = 0; i < item.quantidade; i++) {
      if (consumirCorte(pecas, item.comprimento_mm, config)) contados++
    }

    atendidos.set(chaveDoCorte(item), contados)
  }

  return atendidos
}

/**
 * Empacota cortes em barras novas, abrindo uma nova só quando não cabe em
 * nenhuma das já abertas.
 *
 * Usa `consumirCorte` — a mesma heurística do resto do sistema — para que a
 * lista de compras e o veredito nunca discordem sobre o que cabe onde.
 */
function empacotarEmBarras(
  cortesMm: readonly number[],
  comprimentoBarraMm: number,
  config: ConfiguracaoCorte,
): { barras: PecaEmUso[]; impossiveis: number } {
  const barras: PecaEmUso[] = []
  let impossiveis = 0

  // Do mais longo para o mais curto: mesma razão de sempre.
  for (const corte of [...cortesMm].sort((a, b) => b - a)) {
    if (consumirCorte(barras, corte, config)) continue

    const nova: PecaEmUso = {
      comprimento_mm: comprimentoBarraMm,
      restante_mm: comprimentoBarraMm,
    }

    // Não cabe nem numa barra inteira: comprar mais não resolve.
    if (!consumirCorte([nova], corte, config)) {
      impossiveis++
      continue
    }

    barras.push(nova)
  }

  return { barras, impossiveis }
}

export function calcularListaMateriais(
  /** A lista técnica de UMA unidade. A multiplicação acontece aqui dentro. */
  lista: readonly ItemNecessario[],
  unidades: number,
  sobras: readonly SobraDisponivel[],
  /** Comprimento da barra de catálogo, por id de perfil. */
  barrasPorPerfil: ReadonlyMap<string, number>,
  config: ConfiguracaoCorte,
  modo: ModoCompra,
): ListaMateriais {
  const cortes = lista
    .filter((item) => item.quantidade > 0 && item.comprimento_mm > 0)
    .map((item) => ({
      ...item,
      quantidade: item.quantidade * Math.max(1, unidades),
    }))

  if (cortes.length === 0) {
    return {
      modo,
      unidades,
      linhas: [],
      acabamento_id: null,
      totalBarras: 0,
    }
  }

  /*
   * O acabamento é escolhido UMA vez, para a lista inteira — ver o cabeçalho.
   * Empate resolve pelo primeiro, que é estável: a mesma pergunta feita duas
   * vezes precisa dar a mesma resposta.
   */
  let acabamentoEscolhido: string | null = null
  let atendidos = new Map<string, number>()

  if (modo === 'aproveitar_sobras') {
    let melhorCobertura = -1

    for (const acabamento of new Set(sobras.map((s) => s.acabamento_id))) {
      const tentativa = atenderComSobras(
        cortes,
        sobras.filter((s) => s.acabamento_id === acabamento),
        config,
      )
      const cobertura = [...tentativa.values()].reduce((a, b) => a + b, 0)

      if (cobertura > melhorCobertura) {
        melhorCobertura = cobertura
        atendidos = tentativa
        acabamentoEscolhido = acabamento
      }
    }

    // Nenhuma sobra cobriu corte nenhum: não há acabamento a anunciar.
    if (melhorCobertura <= 0) {
      acabamentoEscolhido = null
      atendidos = new Map()
    }
  }

  const linhas: LinhaMaterial[] = []

  for (const perfilId of new Set(cortes.map((c) => c.modelo_perfil_id))) {
    const doPerfil = cortes.filter((c) => c.modelo_perfil_id === perfilId)
    const comprimentoBarraMm = barrasPorPerfil.get(perfilId) ?? 0

    const detalhados: CorteNecessario[] = doPerfil.map((item) => {
      const deSobra = Math.min(
        item.quantidade,
        atendidos.get(chaveDoCorte(item)) ?? 0,
      )

      return {
        comprimento_mm: item.comprimento_mm,
        quantidade: item.quantidade,
        deSobra,
        deBarraNova: item.quantidade - deSobra,
      }
    })

    const paraBarra: number[] = []

    for (const corte of detalhados) {
      for (let i = 0; i < corte.deBarraNova; i++) {
        paraBarra.push(corte.comprimento_mm)
      }
    }

    /*
     * Perfil sem barra cadastrada não vira compra inventada: os cortes ficam
     * como impossíveis, e a folha diz que falta cadastrar o comprimento da
     * barra. Chutar 6 m — o mais comum — produziria um pedido errado com
     * cara de certo.
     */
    const { barras, impossiveis } =
      comprimentoBarraMm > 0
        ? empacotarEmBarras(paraBarra, comprimentoBarraMm, config)
        : { barras: [], impossiveis: paraBarra.length }

    linhas.push({
      modelo_perfil_id: perfilId,
      comprimento_barra_mm: comprimentoBarraMm,
      cortes: detalhados.sort((a, b) => b.comprimento_mm - a.comprimento_mm),
      barrasNovas: barras.length,
      cortesImpossiveis: impossiveis,
      metrosDeCorte:
        doPerfil.reduce(
          (total, c) => total + c.comprimento_mm * c.quantidade,
          0,
        ) / 1000,
      restoDasBarrasMm: barras.reduce((total, b) => total + b.restante_mm, 0),
    })
  }

  return {
    modo,
    unidades,
    linhas,
    acabamento_id: acabamentoEscolhido,
    totalBarras: linhas.reduce((total, l) => total + l.barrasNovas, 0),
  }
}
