import { describe, it, expect } from 'vitest'
import {
  planejarCorte,
  comprimentoNecessario,
  classificarResto,
  sobraApos,
  CONFIGURACAO_CORTE_PADRAO,
  type ConfiguracaoCorte,
} from './corte'

/** Configuração de oficina típica: serra de 3 mm, sem margem de limpeza. */
const config: ConfiguracaoCorte = {
  ...CONFIGURACAO_CORTE_PADRAO,
  espessuraSerraMm: 3,
  margemLimpezaMm: 0,
  comprimentoMinimoSobraMm: 300,
}

describe('o caso obrigatório da especificação', () => {
  it('recusa 1.200 mm e 600 mm numa peça de 1.800 mm com serra de 3 mm', () => {
    // 1200 + 3 (serra) + 600 = 1803 mm, que não cabe em 1800 mm.
    // É o erro de arredondamento clássico: parece caber, mas não cabe.
    const resultado = planejarCorte(1800, [1200, 600], config)

    expect(resultado.cabe).toBe(false)
    expect(resultado.comprimentoNecessarioMm).toBe(1803)
  })

  it('aceita os mesmos cortes numa peça 3 mm maior', () => {
    const resultado = planejarCorte(1803, [1200, 600], config)

    expect(resultado.cabe).toBe(true)
    expect(resultado.restoMm).toBe(0)
  })
})

describe('comprimentoNecessario', () => {
  it('não cobra serra para um corte único que termina no fim da peça', () => {
    expect(comprimentoNecessario([1200], config)).toBe(1200)
  })

  it('cobra uma passada de serra a menos que o número de cortes', () => {
    expect(comprimentoNecessario([1000, 1000], config)).toBe(2003)
    expect(comprimentoNecessario([1000, 1000, 1000], config)).toBe(3006)
  })

  it('desconta a margem de limpeza uma única vez', () => {
    const comMargem: ConfiguracaoCorte = { ...config, margemLimpezaMm: 20 }

    expect(comprimentoNecessario([1000, 1000], comMargem)).toBe(2023)
  })

  it('devolve zero quando não há corte pedido', () => {
    expect(comprimentoNecessario([], config)).toBe(0)
  })

  it('cobra serra por corte quando a convenção é alterada', () => {
    const todoCortePerde: ConfiguracaoCorte = {
      ...config,
      ultimoCorteGeraPerda: true,
    }

    expect(comprimentoNecessario([1200], todoCortePerde)).toBe(1203)
    expect(comprimentoNecessario([1200, 600], todoCortePerde)).toBe(1806)
  })
})

describe('planejarCorte — o que sobra', () => {
  it('desconta a serra que separou o resto da peça', () => {
    // Peça 1800, corte 1200: sobra 600 no papel, mas foi preciso uma
    // passada de serra para separar o resto, então a peça real tem 597.
    const resultado = planejarCorte(1800, [1200], config)

    expect(resultado.cabe).toBe(true)
    expect(resultado.restoMm).toBe(597)
    expect(resultado.passadasSerra).toBe(1)
  })

  it('não deixa resto quando o corte consome a peça inteira', () => {
    const resultado = planejarCorte(1200, [1200], config)

    expect(resultado.cabe).toBe(true)
    expect(resultado.restoMm).toBe(0)
    expect(resultado.destinoResto).toBe('sem-resto')
    expect(resultado.passadasSerra).toBe(0)
  })

  it('trata folga menor que o disco como pó, não como sobra', () => {
    // Folga de 2 mm com serra de 3 mm: o disco consome tudo.
    const resultado = planejarCorte(1202, [1200], config)

    expect(resultado.cabe).toBe(true)
    expect(resultado.restoMm).toBe(0)
    expect(resultado.destinoResto).toBe('sem-resto')
  })

  it('aceita vários cortes na mesma peça', () => {
    const resultado = planejarCorte(6000, [2000, 2000, 1000], config)

    expect(resultado.cabe).toBe(true)
    expect(resultado.comprimentoNecessarioMm).toBe(5006)
    // Folga de 994, menos a serra que separou o resto: 991.
    expect(resultado.restoMm).toBe(991)
    expect(resultado.passadasSerra).toBe(3)
  })

  it('recusa corte maior que a peça', () => {
    const resultado = planejarCorte(1800, [2000], config)

    expect(resultado.cabe).toBe(false)
    expect(resultado.restoMm).toBe(0)
  })

  it('recusa corte de comprimento zero ou negativo', () => {
    expect(() => planejarCorte(1800, [0], config)).toThrow()
    expect(() => planejarCorte(1800, [-100], config)).toThrow()
  })

  it('considera a margem de limpeza da ponta suja', () => {
    const comMargem: ConfiguracaoCorte = { ...config, margemLimpezaMm: 50 }
    const resultado = planejarCorte(1800, [1750], comMargem)

    expect(resultado.cabe).toBe(true)
    expect(resultado.comprimentoNecessarioMm).toBe(1800)
    expect(resultado.restoMm).toBe(0)
  })
})

describe('classificarResto', () => {
  it('devolve ao estoque o resto maior ou igual ao mínimo', () => {
    expect(classificarResto(300, config)).toBe('sobra')
    expect(classificarResto(1200, config)).toBe('sobra')
  })

  it('descarta o resto menor que o mínimo', () => {
    expect(classificarResto(299, config)).toBe('descarte')
    expect(classificarResto(50, config)).toBe('descarte')
  })

  it('não classifica quando não sobrou nada', () => {
    expect(classificarResto(0, config)).toBe('sem-resto')
  })

  it('respeita o mínimo configurado pela empresa', () => {
    const oficinaDePecaCurta: ConfiguracaoCorte = {
      ...config,
      comprimentoMinimoSobraMm: 100,
    }

    expect(classificarResto(150, config)).toBe('descarte')
    expect(classificarResto(150, oficinaDePecaCurta)).toBe('sobra')
  })
})

describe('planejarCorte — destino do resto', () => {
  it('marca como sobra o resto aproveitável', () => {
    const resultado = planejarCorte(6000, [2000], config)

    expect(resultado.restoMm).toBe(3997)
    expect(resultado.destinoResto).toBe('sobra')
  })

  it('marca como descarte o resto curto demais', () => {
    const resultado = planejarCorte(1500, [1300], config)

    expect(resultado.restoMm).toBe(197)
    expect(resultado.destinoResto).toBe('descarte')
    // O desperdício soma a serra e o pedaço descartado.
    expect(resultado.desperdicioMm).toBe(200)
  })
})

describe('sobraApos', () => {
  it('informa quanto sobra para ordenar a pesquisa', () => {
    expect(sobraApos(6000, 2000, config)).toBe(3997)
    expect(sobraApos(1800, 1200, config)).toBe(597)
  })

  it('devolve nulo quando a peça não serve', () => {
    expect(sobraApos(1000, 1200, config)).toBeNull()
  })

  it('ordena da menor sobra para a maior, gastando as pontas ruins antes', () => {
    const pecas = [6000, 2500, 2100, 1800]
    const corte = 2000

    const ordenadas = pecas
      .map((p) => ({ peca: p, sobra: sobraApos(p, corte, config) }))
      .filter((r): r is { peca: number; sobra: number } => r.sobra !== null)
      .sort((a, b) => a.sobra - b.sobra)

    // A peça de 1800 não serve e sai da lista; a de 2100 é a mais econômica.
    expect(ordenadas.map((r) => r.peca)).toEqual([2100, 2500, 6000])
  })
})
