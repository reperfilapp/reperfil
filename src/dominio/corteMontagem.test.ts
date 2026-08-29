import { describe, it, expect } from 'vitest'
import {
  CORTES,
  CORTE_PADRAO,
  anguloDoCorte,
  corteValido,
  cortesPorPecaValidos,
  descreverCorte,
  descreverCortes,
  descreverCortesDaLinha,
  linhasDaPonta,
  outroSentido,
  proximoCorte,
  redimensionarCortesPorPeca,
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
    expect(descreverCortes('v', 'meia_cima', 'reto')).toBe('LC 45° · LB 90°')
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

/**
 * Os cartões de "corte por peça" na tela de acrescentar material. Errar
 * aqui troca de dono um corte já ajustado à mão — silenciosamente, porque
 * do ponto de vista de quem preenche a tela nada pareceu errado.
 */
describe('redimensionar cartões de peça', () => {
  const PADRAO = {
    sentido: 'h',
    corte_inicio: 'reto',
    corte_fim: 'reto',
  } as const
  const A = {
    sentido: 'v',
    corte_inicio: 'meia_cima',
    corte_fim: 'reto',
  } as const
  const B = {
    sentido: 'h',
    corte_inicio: 'meia_baixo',
    corte_fim: 'meia_baixo',
  } as const

  it('corta a lista ao diminuir, sem tocar no que sobra', () => {
    expect(redimensionarCortesPorPeca([A, B], 1, PADRAO)).toEqual([A])
  })

  it('some com a lista ao chegar em zero peças', () => {
    expect(redimensionarCortesPorPeca([A, B], 0, PADRAO)).toEqual([])
  })

  it('preenche peça nova copiando a ÚLTIMA existente, não o padrão', () => {
    // O caso comum é "mais uma igual à anterior" — quem já ajustou as
    // primeiras não quer reajustar a última à mão de novo.
    expect(redimensionarCortesPorPeca([A, B], 3, PADRAO)).toEqual([A, B, B])
  })

  it('usa o padrão quando a lista começa vazia', () => {
    expect(redimensionarCortesPorPeca([], 2, PADRAO)).toEqual([PADRAO, PADRAO])
  })

  it('mantém a lista como está quando o tamanho não muda', () => {
    expect(redimensionarCortesPorPeca([A, B], 2, PADRAO)).toEqual([A, B])
  })

  it('as cópias são independentes — mudar uma não muda as outras', () => {
    const resultado = redimensionarCortesPorPeca([A], 3, PADRAO)

    resultado[1]!.sentido = 'h'

    expect(resultado[2]!.sentido).toBe('v')
  })
})

/**
 * O que vem do banco em `cortes_por_peca` é JSONB solto — `unknown` de
 * verdade, sem garantia nenhuma de formato. Um elemento quebrado precisa
 * derrubar a lista INTEIRA, não só aquele elemento: mostrar 2 de 3 peças
 * certas e inventar a terceira é pior do que voltar ao comportamento de
 * antes do recurso existir.
 */
describe('validar cortes por peça vindos do banco', () => {
  const PECA_A = { sentido: 'v', corte_inicio: 'meia_cima', corte_fim: 'reto' }
  const PECA_B = { sentido: 'h', corte_inicio: 'reto', corte_fim: 'meia_baixo' }

  it('aceita um array bem formado', () => {
    expect(cortesPorPecaValidos([PECA_A, PECA_B])).toEqual([PECA_A, PECA_B])
  })

  it('rejeita quando não é array', () => {
    expect(cortesPorPecaValidos(null)).toBeNull()
    expect(cortesPorPecaValidos(undefined)).toBeNull()
    expect(cortesPorPecaValidos({ sentido: 'h' })).toBeNull()
    expect(cortesPorPecaValidos('h')).toBeNull()
  })

  it('rejeita array vazio — cai no comportamento uniforme, não em zero peças', () => {
    expect(cortesPorPecaValidos([])).toBeNull()
  })

  it('um elemento quebrado derruba a lista inteira', () => {
    expect(
      cortesPorPecaValidos([PECA_A, { sentido: 'x', corte_inicio: 'reto' }]),
    ).toBeNull()
    expect(cortesPorPecaValidos([PECA_A, null])).toBeNull()
    expect(
      cortesPorPecaValidos([PECA_A, { ...PECA_B, corte_fim: 'invertido' }]),
    ).toBeNull()
  })
})

describe('descrever o corte de uma linha inteira', () => {
  it('sem corte por peça, descreve como sempre foi', () => {
    expect(descreverCortesDaLinha('h', 'reto', 'reto', null)).toBe(
      descreverCortes('h', 'reto', 'reto'),
    )
  })

  it('com corte por peça, numera cada uma — não concatena solto', () => {
    // Concatenar sem número ("LE 90 · LD 90 · LC 45 · LB 45") confundiria
    // qual ponta pertence a qual peça.
    const resultado = descreverCortesDaLinha('h', 'reto', 'reto', [
      { sentido: 'h', corte_inicio: 'reto', corte_fim: 'reto' },
      { sentido: 'v', corte_inicio: 'meia_cima', corte_fim: 'meia_baixo' },
    ])

    expect(resultado).toBe(
      `1) ${descreverCortes('h', 'reto', 'reto')} · 2) ${descreverCortes('v', 'meia_cima', 'meia_baixo')}`,
    )
  })
})
