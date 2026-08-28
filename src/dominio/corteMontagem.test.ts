import { describe, it, expect } from 'vitest'
import {
  CORTES,
  CORTE_PADRAO,
  anguloDoCorte,
  corteValido,
  descreverCorte,
  descreverCortes,
  linhasDaPonta,
  outroSentido,
  proximoCorte,
  rotuloDaPonta,
  sentidoValido,
} from './corteMontagem'

/**
 * Esta informação vai para a serra. Um corte que volta ao valor errado, ou
 * um rótulo que troca esquerda por cima, produz peça espelhada — e peça
 * espelhada em alumínio é sucata, não retrabalho.
 */

describe('rodízio do corte', () => {
  it('passa pelas três variações e volta ao começo', () => {
    const vistos = new Set<string>()
    let atual = CORTE_PADRAO

    for (let i = 0; i < CORTES.length; i++) {
      vistos.add(atual)
      atual = proximoCorte(atual)
    }

    expect(vistos.size).toBe(3)
    // Depois de três toques, está de volta onde começou.
    expect(atual).toBe(CORTE_PADRAO)
  })

  it('não repete nenhuma variação na volta completa', () => {
    expect(new Set(CORTES).size).toBe(CORTES.length)
  })

  it('cai no padrão se o valor gravado não existir mais', () => {
    expect(proximoCorte('inventado' as never)).toBe(CORTE_PADRAO)
  })
})

describe('ângulo', () => {
  it.each([
    ['reto', 90],
    ['meia_cima', 45],
    ['meia_baixo', 45],
  ] as const)('%s é %i°', (corte, esperado) => {
    expect(anguloDoCorte(corte)).toBe(esperado)
  })

  it('tem um corte reto e dois em meia-esquadria', () => {
    /*
     * O reto é UM. 90° não tem inclinação para variar, e de que lado da peça
     * ele acontece já está dito pelo botão da ponta — pedir "90° cima" ou
     * "90° baixo" seria pedir uma escolha que não muda peça nenhuma.
     */
    const retos = CORTES.filter((c) => anguloDoCorte(c) === 90)
    const meias = CORTES.filter((c) => anguloDoCorte(c) === 45)

    expect(retos).toHaveLength(1)
    expect(meias).toHaveLength(2)
  })
})

describe('nome das pontas', () => {
  it('deitado fala em esquerda e direita', () => {
    expect(rotuloDaPonta('h', 'inicio')).toBe('LE')
    expect(rotuloDaPonta('h', 'fim')).toBe('LD')
  })

  it('em pé fala em cima e baixo', () => {
    // O mesmo corte, outro nome: "45 na esquerda" não quer dizer nada para
    // quem está com um montante em pé na bancada.
    expect(rotuloDaPonta('v', 'inicio')).toBe('LC')
    expect(rotuloDaPonta('v', 'fim')).toBe('LB')
  })

  it('o sentido alterna entre dois valores', () => {
    expect(outroSentido('h')).toBe('v')
    expect(outroSentido('v')).toBe('h')
  })

  it('quebra em duas linhas deixando a palavra que distingue por último', () => {
    /*
     * A primeira linha é sempre "Lado"; a segunda é a que distingue as duas
     * pontas. Comparar "esquerdo" com "direito" é ler uma palavra — nas duas
     * linhas inteiras seria ler quatro.
     */
    expect(linhasDaPonta('h', 'inicio')).toEqual(['Lado', 'esquerdo'])
    expect(linhasDaPonta('h', 'fim')).toEqual(['Lado', 'direito'])
    expect(linhasDaPonta('v', 'inicio')).toEqual(['Lado', 'cima'])
    expect(linhasDaPonta('v', 'fim')).toEqual(['Lado', 'baixo'])
  })
})

describe('texto para a folha impressa', () => {
  it('o reto não ganha complemento', () => {
    // "90° cima" faria procurar uma diferença que não existe.
    expect(descreverCorte('reto')).toBe('90°')
  })

  it('a meia-esquadria diz apenas 45°', () => {
    expect(descreverCorte('meia_cima')).toBe('45°')
    expect(descreverCorte('meia_baixo')).toBe('45°')
  })

  it('junta as duas pontas com o nome certo do sentido', () => {
    expect(descreverCortes('v', 'meia_cima', 'reto')).toBe(
      'LC 45° · LB 90°',
    )
  })
})

describe('o que veio do banco', () => {
  it('aceita valor conhecido', () => {
    expect(corteValido('meia_cima')).toBe('meia_cima')
    expect(sentidoValido('v')).toBe('v')
  })

  it.each([null, undefined, '', 'qualquer'])(
    'devolve o padrão para %s',
    (valor) => {
      // Linha cadastrada antes das colunas existirem chega nula. Corte reto
      // é o que "1.455 mm" sempre quis dizer antes desta informação.
      expect(corteValido(valor)).toBe(CORTE_PADRAO)
      expect(sentidoValido(valor)).toBe('h')
    },
  )
})
