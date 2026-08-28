import { planejarCorte, type ConfiguracaoCorte } from './corte'

/**
 * Quantas unidades de um produto dá para fabricar com as sobras do depósito.
 *
 * ── O QUE ESTE CÁLCULO RESPONDE ──────────────────────────────────────────
 *
 * "Chegou um pedido de janela integrada 1,50 × 1,00. Dá para fazer com o que
 * está na prateleira, ou preciso comprar barra?" É a pergunta que justifica
 * o RePerfil existir: sobra que ninguém sabe que serve é sobra que vira
 * sucata.
 *
 * ── POR QUE O ACABAMENTO SEPARA TUDO ─────────────────────────────────────
 *
 * Ninguém entrega uma janela com o marco branco e a folha preta. Então não
 * basta ter metros suficientes: eles precisam estar no MESMO acabamento. O
 * cálculo roda uma vez por acabamento e devolve o melhor resultado — e é por
 * isso que a resposta pode ser "dá para fazer 2 em branco" mesmo havendo
 * material de sobra em preto.
 *
 * ── POR QUE É GULOSO, E O QUE ISSO CUSTA ─────────────────────────────────
 *
 * Distribuir cortes entre peças da melhor forma possível é o problema do
 * empacotamento, que não tem solução rápida e exata. Aqui as peças
 * necessárias são atendidas da maior para a menor, cada uma consumindo a
 * MENOR sobra em que ela ainda cabe — a heurística que preserva as peças
 * longas para os cortes longos.
 *
 * O resultado é honesto num sentido específico: ele nunca promete o que não
 * cabe. Pode, em casos raros, deixar de encontrar um arranjo melhor que
 * existiria — então "dá para fazer 2" significa "2 com certeza", não "no
 * máximo 2". Prometer a mais seria muito pior: alguém corta a primeira peça
 * e descobre no meio do serviço que falta material.
 */

/** Uma linha da lista técnica: o que entra em UMA unidade do produto. */
export interface ItemNecessario {
  modelo_perfil_id: string
  comprimento_mm: number
  quantidade: number
}

/** Uma sobra do depósito, como o cálculo precisa dela. */
export interface SobraDisponivel {
  modelo_perfil_id: string
  acabamento_id: string
  comprimento_mm: number
  /** Peças livres, já descontadas as reservadas. */
  quantidade: number
}

export interface FaltaMaterial {
  modelo_perfil_id: string
  comprimento_mm: number
  /** Quantas peças faltaram para completar a unidade seguinte. */
  faltam: number
}

export interface ResultadoProducao {
  /** Unidades garantidas com o que está no depósito. */
  unidades: number
  /** Acabamento em que esse número foi alcançado. Nulo se nenhum serve. */
  acabamento_id: string | null
  /** O que impediu de fazer mais uma unidade. Vazio quando não há sobras. */
  faltas: FaltaMaterial[]
}

/**
 * Peça de estoque enquanto está sendo consumida pelo cálculo.
 *
 * Exportada junto com `consumirCorte` porque a lista de materiais precisa da
 * MESMA heurística: se lá o encaixe fosse calculado de outro jeito, a tela
 * diria "dá para fazer" e a lista de compras pediria barra para o mesmo
 * corte — duas respostas do mesmo sistema se contradizendo.
 */
export interface PecaEmUso {
  comprimento_mm: number
  restante_mm: number
}

/**
 * Tenta tirar um corte das peças disponíveis, consumindo a menor que serve.
 *
 * Devolve `false` quando não cabe em nenhuma — e nesse ponto o cálculo para
 * de contar unidades, porque a unidade seguinte já não fecha.
 */
export function consumirCorte(
  pecas: PecaEmUso[],
  corteMm: number,
  config: ConfiguracaoCorte,
): boolean {
  let escolhida: PecaEmUso | null = null
  let sobraEscolhida = Infinity

  for (const peca of pecas) {
    // `planejarCorte` já desconta serra e margem de limpeza, e sabe se o
    // último corte gera perda. Refazer essa conta aqui deixaria dois lugares
    // discordando sobre o mesmo milímetro.
    const plano = planejarCorte(peca.restante_mm, [corteMm], config)

    if (!plano.cabe) continue

    if (plano.restoMm < sobraEscolhida) {
      escolhida = peca
      sobraEscolhida = plano.restoMm
    }
  }

  if (escolhida === null) return false

  escolhida.restante_mm = sobraEscolhida

  return true
}

/**
 * Quantas unidades saem das sobras informadas.
 *
 * As sobras devem ser TODAS as disponíveis; o filtro por acabamento acontece
 * aqui dentro, porque é o próprio cálculo que escolhe qual acabamento rende
 * mais.
 */
export function unidadesProduziveis(
  lista: readonly ItemNecessario[],
  sobras: readonly SobraDisponivel[],
  config: ConfiguracaoCorte,
  /** Teto de segurança: sem ele, lista vazia daria laço infinito. */
  maximo = 99,
): ResultadoProducao {
  const necessarios = lista.filter(
    (item) => item.quantidade > 0 && item.comprimento_mm > 0,
  )

  if (necessarios.length === 0) {
    return { unidades: 0, acabamento_id: null, faltas: [] }
  }

  const acabamentos = [...new Set(sobras.map((s) => s.acabamento_id))]
  let melhor: ResultadoProducao = {
    unidades: 0,
    acabamento_id: null,
    faltas: [],
  }

  for (const acabamento of acabamentos) {
    const resultado = calcularParaAcabamento(
      necessarios,
      sobras.filter((s) => s.acabamento_id === acabamento),
      acabamento,
      config,
      maximo,
    )

    if (resultado.unidades > melhor.unidades) melhor = resultado
  }

  // Nenhum acabamento fecha uma unidade: mostra o que falta no acabamento
  // que chegou mais perto, para a resposta ser "faltam 2 peças de X", e não
  // apenas "não dá".
  if (melhor.unidades === 0 && acabamentos.length > 0) {
    const tentativas = acabamentos.map((acabamento) =>
      calcularParaAcabamento(
        necessarios,
        sobras.filter((s) => s.acabamento_id === acabamento),
        acabamento,
        config,
        maximo,
      ),
    )

    melhor = tentativas.reduce((a, b) =>
      somarFaltas(a.faltas) <= somarFaltas(b.faltas) ? a : b,
    )
  }

  return melhor
}

function somarFaltas(faltas: readonly FaltaMaterial[]): number {
  return faltas.reduce((total, falta) => total + falta.faltam, 0)
}

function calcularParaAcabamento(
  lista: readonly ItemNecessario[],
  sobras: readonly SobraDisponivel[],
  acabamentoId: string,
  config: ConfiguracaoCorte,
  maximo: number,
): ResultadoProducao {
  // Uma peça por unidade em estoque: duas sobras iguais de 6 m são duas
  // peças de 6 m, não uma de 12.
  const estoque = new Map<string, PecaEmUso[]>()

  for (const sobra of sobras) {
    const pecas = estoque.get(sobra.modelo_perfil_id) ?? []

    for (let i = 0; i < sobra.quantidade; i++) {
      pecas.push({
        comprimento_mm: sobra.comprimento_mm,
        restante_mm: sobra.comprimento_mm,
      })
    }

    estoque.set(sobra.modelo_perfil_id, pecas)
  }

  let unidades = 0
  let faltas: FaltaMaterial[] = []

  while (unidades < maximo) {
    const faltasDaVez = tentarUmaUnidade(lista, estoque, config)

    if (faltasDaVez.length > 0) {
      faltas = faltasDaVez
      break
    }

    unidades++
  }

  return { unidades, acabamento_id: unidades > 0 ? acabamentoId : null, faltas }
}

/**
 * Consome de `estoque` o necessário para uma unidade.
 *
 * Devolve o que faltou. IMPORTANTE: em caso de falta, o que já foi consumido
 * NÃO é devolvido — e não precisa ser, porque o laço para na primeira
 * unidade que não fecha. Devolver exigiria copiar o estoque inteiro a cada
 * tentativa, e o resultado seria o mesmo.
 */
function tentarUmaUnidade(
  lista: readonly ItemNecessario[],
  estoque: Map<string, PecaEmUso[]>,
  config: ConfiguracaoCorte,
): FaltaMaterial[] {
  const faltas: FaltaMaterial[] = []

  // Do corte mais longo para o mais curto: peça longa é a difícil de
  // encaixar, e deixá-la por último é o jeito certo de não conseguir.
  const cortes = [...lista].sort((a, b) => b.comprimento_mm - a.comprimento_mm)

  for (const item of cortes) {
    const pecas = estoque.get(item.modelo_perfil_id) ?? []
    let atendidos = 0

    for (let i = 0; i < item.quantidade; i++) {
      if (consumirCorte(pecas, item.comprimento_mm, config)) {
        atendidos++
      }
    }

    if (atendidos < item.quantidade) {
      faltas.push({
        modelo_perfil_id: item.modelo_perfil_id,
        comprimento_mm: item.comprimento_mm,
        faltam: item.quantidade - atendidos,
      })
    }
  }

  return faltas
}

/**
 * Quais cortes da lista têm material, olhando um perfil de cada vez.
 *
 * ── POR QUE ISTO É DIFERENTE DE `unidadesProduziveis` ────────────────────
 *
 * Aquela função responde "dá para fazer a peça inteira?", e por isso exige
 * que TUDO saia do mesmo acabamento. Esta responde outra pergunta, mais
 * simples: "tenho material para este corte?".
 *
 * As duas precisam existir porque a tela mostra as duas coisas. O veredito
 * fala da peça; cada linha da lista fala de si mesma. Colorir as linhas pela
 * primeira função produzia o absurdo de marcar em vermelho um corte com
 * material sobrando na prateleira — só porque o acabamento escolhido para a
 * peça inteira era outro.
 *
 * ── POR QUE POR PERFIL, E NÃO POR CORTE ──────────────────────────────────
 *
 * Dois cortes do mesmo perfil disputam as mesmas peças: pedir 2 × 3.000 mm e
 * 1 × 2.000 mm de um perfil que só tem uma barra de 6 m não é três perguntas
 * independentes. Então cada perfil é resolvido junto, e dentro dele escolhe-se
 * o acabamento que atende mais cortes.
 */
export function cortesAtendidos(
  lista: readonly ItemNecessario[],
  sobras: readonly SobraDisponivel[],
  config: ConfiguracaoCorte,
): Map<string, boolean> {
  const atendidos = new Map<string, boolean>()
  const perfis = new Set(lista.map((item) => item.modelo_perfil_id))

  for (const perfilId of perfis) {
    const doPerfil = lista.filter((item) => item.modelo_perfil_id === perfilId)
    const sobrasDoPerfil = sobras.filter(
      (sobra) => sobra.modelo_perfil_id === perfilId,
    )
    const acabamentos = [...new Set(sobrasDoPerfil.map((s) => s.acabamento_id))]

    let melhor: Map<string, boolean> | null = null
    let melhorAcertos = -1

    for (const acabamento of acabamentos) {
      const resultado = atenderNoAcabamento(
        doPerfil,
        sobrasDoPerfil.filter((s) => s.acabamento_id === acabamento),
        config,
      )
      const acertos = [...resultado.values()].filter(Boolean).length

      if (acertos > melhorAcertos) {
        melhor = resultado
        melhorAcertos = acertos
      }
    }

    // Perfil sem sobra nenhuma: todos os cortes dele ficam por atender.
    const resultado =
      melhor ?? new Map(doPerfil.map((item) => [chaveDoCorte(item), false]))

    for (const [chave, valor] of resultado) atendidos.set(chave, valor)
  }

  return atendidos
}

/** Identidade de um corte na lista: perfil e comprimento. */
export function chaveDoCorte(item: {
  modelo_perfil_id: string
  comprimento_mm: number
}): string {
  return `${item.modelo_perfil_id}|${item.comprimento_mm}`
}

function atenderNoAcabamento(
  itens: readonly ItemNecessario[],
  sobras: readonly SobraDisponivel[],
  config: ConfiguracaoCorte,
): Map<string, boolean> {
  const pecas: PecaEmUso[] = []

  for (const sobra of sobras) {
    for (let i = 0; i < sobra.quantidade; i++) {
      pecas.push({
        comprimento_mm: sobra.comprimento_mm,
        restante_mm: sobra.comprimento_mm,
      })
    }
  }

  const resultado = new Map<string, boolean>()

  // Do corte mais longo para o mais curto, pelo mesmo motivo de sempre: peça
  // longa é a difícil de encaixar.
  const ordenados = [...itens].sort(
    (a, b) => b.comprimento_mm - a.comprimento_mm,
  )

  for (const item of ordenados) {
    let atendidos = 0

    for (let i = 0; i < item.quantidade; i++) {
      if (consumirCorte(pecas, item.comprimento_mm, config)) atendidos++
    }

    resultado.set(chaveDoCorte(item), atendidos >= item.quantidade)
  }

  return resultado
}
