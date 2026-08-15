/**
 * Corte — "cabe ou não cabe" e o que sobra depois.
 *
 * Esta é a regra mais importante do sistema. Se ela errar, o serralheiro
 * separa uma peça, vai até a serra e descobre que não dá — que é exatamente
 * o problema que o RePerfil existe para eliminar.
 *
 * ── O modelo físico ──────────────────────────────────────────────────────
 *
 * Uma peça de comprimento L, da qual se tiram n cortes:
 *
 *   ┌─ margem de limpeza ─┬─ corte 1 ─┬ serra ┬─ corte 2 ─┬ serra ┬─ resto ─┐
 *   └─────────────────────┴───────────┴───────┴───────────┴───────┴─────────┘
 *
 * • A margem de limpeza é descontada UMA vez, na ponta suja da peça.
 * • Cada corte precisa de uma passada de serra para se separar do restante —
 *   EXCETO o último, quando ele termina justamente no fim da peça, porque aí
 *   não há nada de que separá-lo. Esta é a convenção D4, definida pelo
 *   cliente conforme a prática da oficina.
 * • Consequência sutil: se sobrar material depois do último corte, aquela
 *   passada de serra volta a existir, porque foi preciso separar o resto.
 *   Ignorar isso faria o sistema anunciar uma sobra alguns milímetros maior
 *   do que a peça que realmente está no depósito.
 *
 * Conferindo o caso obrigatório da especificação — peça de 1.800 mm, cortes
 * de 1.200 e 600 mm, serra de 3 mm:
 *
 *   1200 + 3 + 600 = 1803 mm  >  1800 mm  →  NÃO CABE
 *
 * É o erro de arredondamento clássico que a especificação manda acertar.
 */

/**
 * Parâmetros do cálculo. Vêm da tabela `configuracoes_aplicacao`, definidos
 * pelo administrador — nunca fixos no código. O administrador é obrigado a
 * confirmar a espessura real da serra antes do primeiro cálculo em produção.
 */
export interface ConfiguracaoCorte {
  /** Espessura do disco da serra, em mm. Cada passada consome isto. */
  espessuraSerraMm: number
  /** Material descartado na ponta da peça antes do primeiro corte, em mm. */
  margemLimpezaMm: number
  /** Abaixo deste comprimento, o resto é descarte e não volta ao estoque. */
  comprimentoMinimoSobraMm: number
  /**
   * Convenção de perda. `false` (padrão) segue a prática da oficina: o
   * último corte não gera perda quando termina no fim da peça. `true` cobra
   * uma passada de serra por corte, sempre — usar se a oficina mudar o
   * método.
   */
  ultimoCorteGeraPerda: boolean
}

export const CONFIGURACAO_CORTE_PADRAO: ConfiguracaoCorte = {
  espessuraSerraMm: 3,
  margemLimpezaMm: 0,
  comprimentoMinimoSobraMm: 300,
  ultimoCorteGeraPerda: false,
}

/** O que fazer com o material que sobrou depois dos cortes. */
export type DestinoResto = 'sobra' | 'descarte' | 'sem-resto'

export interface ResultadoCorte {
  /** Se os cortes pedidos cabem na peça. */
  cabe: boolean
  /** Comprimento mínimo de peça necessário para atender os cortes, em mm. */
  comprimentoNecessarioMm: number
  /** Quantas passadas de serra o plano consome. */
  passadasSerra: number
  /** Material que sobra e volta ao estoque ou vira descarte, em mm. */
  restoMm: number
  /** Para onde vai o resto. */
  destinoResto: DestinoResto
  /** Material perdido: margem de limpeza, serra e resto descartado, em mm. */
  desperdicioMm: number
}

/**
 * Calcula quantas passadas de serra um conjunto de cortes consome, supondo
 * que o último corte termina no fim da peça.
 */
function passadasMinimas(
  quantidadeCortes: number,
  config: ConfiguracaoCorte,
): number {
  if (quantidadeCortes <= 0) {
    return 0
  }

  return config.ultimoCorteGeraPerda ? quantidadeCortes : quantidadeCortes - 1
}

/**
 * Comprimento mínimo de peça necessário para tirar os cortes informados,
 * já contando serra e margem de limpeza.
 *
 * Este é o piso absoluto: supõe que o último corte termina exatamente no fim
 * da peça, sem deixar resto.
 */
export function comprimentoNecessario(
  cortesMm: readonly number[],
  config: ConfiguracaoCorte,
): number {
  if (cortesMm.length === 0) {
    return 0
  }

  const somaCortes = cortesMm.reduce((total, corte) => total + corte, 0)
  const perdaSerra =
    passadasMinimas(cortesMm.length, config) * config.espessuraSerraMm

  return config.margemLimpezaMm + somaCortes + perdaSerra
}

/**
 * Responde se os cortes cabem na peça e, cabendo, o que sobra.
 *
 * Aceita um único corte ou vários na mesma peça. O algoritmo de distribuir
 * cortes entre VÁRIAS peças e barras novas é o motor de aproveitamento da
 * Fase 4 — aqui a peça é uma só.
 */
export function planejarCorte(
  comprimentoPecaMm: number,
  cortesMm: readonly number[],
  config: ConfiguracaoCorte,
): ResultadoCorte {
  if (cortesMm.some((corte) => corte <= 0)) {
    throw new Error('Todo corte precisa ter comprimento maior que zero.')
  }

  const necessario = comprimentoNecessario(cortesMm, config)
  const passadas = passadasMinimas(cortesMm.length, config)

  if (cortesMm.length === 0 || necessario > comprimentoPecaMm) {
    return {
      cabe: false,
      comprimentoNecessarioMm: necessario,
      passadasSerra: passadas,
      restoMm: 0,
      destinoResto: 'sem-resto',
      desperdicioMm: 0,
    }
  }

  // Sobrou material depois do último corte? Então foi preciso mais uma
  // passada de serra para separar esse resto da peça.
  const folga = comprimentoPecaMm - necessario
  let restoMm = folga
  let passadasReais = passadas

  if (folga > 0 && !config.ultimoCorteGeraPerda) {
    passadasReais = passadas + 1
    restoMm = folga - config.espessuraSerraMm

    // A folga era menor que o próprio disco: virou pó, não sobrou peça.
    if (restoMm < 0) {
      restoMm = 0
    }
  }

  const destinoResto = classificarResto(restoMm, config)
  const perdaSerraTotal = passadasReais * config.espessuraSerraMm
  const restoDescartado = destinoResto === 'descarte' ? restoMm : 0

  return {
    cabe: true,
    comprimentoNecessarioMm: necessario,
    passadasSerra: passadasReais,
    restoMm,
    destinoResto,
    desperdicioMm: config.margemLimpezaMm + perdaSerraTotal + restoDescartado,
  }
}

/**
 * Decide se o que sobrou volta ao estoque como sobra aproveitável ou vira
 * descarte.
 *
 * O limite é configurável porque depende do que a empresa fabrica: quem faz
 * muito maxim-ar aproveita pedaços curtos que, para quem só faz porta de
 * correr, são lixo ocupando prateleira.
 */
export function classificarResto(
  restoMm: number,
  config: ConfiguracaoCorte,
): DestinoResto {
  if (restoMm <= 0) {
    return 'sem-resto'
  }

  return restoMm >= config.comprimentoMinimoSobraMm ? 'sobra' : 'descarte'
}

/**
 * Aproveitamento de uma peça para um corte único — o número que a tela de
 * pesquisa usa para ordenar os resultados.
 *
 * A ordenação padrão mostra primeiro as peças que produzem MENOR sobra,
 * para gastar as pontas ruins antes das boas e não picar uma peça grande
 * por causa de um corte pequeno.
 */
export function sobraApos(
  comprimentoPecaMm: number,
  corteMm: number,
  config: ConfiguracaoCorte,
): number | null {
  const resultado = planejarCorte(comprimentoPecaMm, [corteMm], config)

  return resultado.cabe ? resultado.restoMm : null
}
