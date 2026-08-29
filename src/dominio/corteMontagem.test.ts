import { describe, it, expect } from 'vitest'
import {
  CORTES,
  CORTE_PADRAO,
  anguloDoCorte,
  corteValido,
  criarGrupoUnico,
  descreverCorte,
  descreverCortes,
  descreverGruposDaLinha,
  dividirGrupo,
  gruposDeCorteValidos,
  linhasDaPonta,
  outroSentido,
  proximoCorte,
  redimensionarGrupos,
  removerGrupo,
  rotuloDaPonta,
  sentidoValido,
  somaQuantidades,
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
 * Os grupos de "corte por peça" na tela de acrescentar material. Errar aqui
 * troca de dono um corte já ajustado à mão, ou perde peças da conta —
 * silenciosamente, porque do ponto de vista de quem preenche a tela nada
 * pareceu errado.
 */
describe('redimensionar grupos de corte', () => {
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

  it('cria um grupo só, com toda a quantidade, ao ligar a exceção', () => {
    expect(criarGrupoUnico(4, A)).toEqual([{ ...A, quantidade: 4 }])
  })

  it('soma as quantidades de todos os grupos', () => {
    expect(
      somaQuantidades([
        { ...A, quantidade: 2 },
        { ...B, quantidade: 3 },
      ]),
    ).toBe(5)
  })

  it('ao crescer, o ÚLTIMO grupo absorve a diferença', () => {
    // O caso comum é "mais uma igual à anterior" — a peça nova repete o
    // último grupo, não o primeiro.
    const grupos = [
      { ...A, quantidade: 2 },
      { ...B, quantidade: 2 },
    ]

    expect(redimensionarGrupos(grupos, 5)).toEqual([
      { ...A, quantidade: 2 },
      { ...B, quantidade: 3 },
    ])
  })

  it('ao encolher dentro do último grupo, só ele diminui', () => {
    const grupos = [
      { ...A, quantidade: 2 },
      { ...B, quantidade: 3 },
    ]

    expect(redimensionarGrupos(grupos, 3)).toEqual([
      { ...A, quantidade: 2 },
      { ...B, quantidade: 1 },
    ])
  })

  it('ao encolher além do último grupo, ele some e o anterior perde o resto', () => {
    const grupos = [
      { ...A, quantidade: 2 },
      { ...B, quantidade: 1 },
    ]

    expect(redimensionarGrupos(grupos, 1)).toEqual([{ ...A, quantidade: 1 }])
  })

  it('nunca fica vazio: encolher a zero deixa um grupo com a nova quantidade', () => {
    // Aqui a redução varre os DOIS grupos por completo (nenhum sobra) — o
    // caso em que o resultado normal ficaria vazio, e a função devolve um
    // grupo com o corte do ÚLTIMO grupo original em vez disso.
    const grupos = [
      { ...A, quantidade: 2 },
      { ...B, quantidade: 2 },
    ]

    expect(redimensionarGrupos(grupos, 0)).toEqual([{ ...B, quantidade: 1 }])
  })

  it('lista vazia continua vazia — não há "último grupo" para crescer', () => {
    expect(redimensionarGrupos([], 4)).toEqual([])
  })

  it('mantém os grupos como estão quando o total não muda', () => {
    const grupos = [
      { ...A, quantidade: 2 },
      { ...B, quantidade: 2 },
    ]

    expect(redimensionarGrupos(grupos, 4)).toEqual(grupos)
  })

  it('as cópias são independentes — mudar uma não muda a original', () => {
    const grupos = [{ ...A, quantidade: 2 }]
    const resultado = redimensionarGrupos(grupos, 5)

    resultado[0]!.quantidade = 99

    expect(grupos[0]!.quantidade).toBe(2)
  })
})

describe('dividir e remover grupos', () => {
  const A = {
    sentido: 'v',
    corte_inicio: 'meia_cima',
    corte_fim: 'reto',
  } as const

  it('tira quantidadeNoNovo peças do grupo, num grupo novo logo depois', () => {
    const grupos = [{ ...A, quantidade: 4 }]

    expect(dividirGrupo(grupos, 0, 1)).toEqual([
      { ...A, quantidade: 3 },
      { ...A, quantidade: 1 },
    ])
  })

  it('o grupo novo nasce com o MESMO corte do original', () => {
    // Só muda o que a pessoa tocar depois — dividir sozinho não decide
    // nenhum corte diferente.
    const grupos = [{ ...A, quantidade: 4 }]
    const [, novo] = dividirGrupo(grupos, 0, 2)

    expect(novo).toEqual({ ...A, quantidade: 2 })
  })

  it('não divide em 0, no total, ou além do total', () => {
    const grupos = [{ ...A, quantidade: 4 }]

    expect(dividirGrupo(grupos, 0, 0)).toEqual(grupos)
    expect(dividirGrupo(grupos, 0, 4)).toEqual(grupos)
    expect(dividirGrupo(grupos, 0, 5)).toEqual(grupos)
  })

  it('ao remover, a quantidade volta para o grupo ANTERIOR', () => {
    const grupos = [
      { ...A, quantidade: 2 },
      { ...A, quantidade: 2 },
    ]

    expect(removerGrupo(grupos, 1)).toEqual([{ ...A, quantidade: 4 }])
  })

  it('sem anterior (é o primeiro), a quantidade vai para o de depois', () => {
    const grupos = [
      { ...A, quantidade: 2 },
      { ...A, quantidade: 2 },
    ]

    expect(removerGrupo(grupos, 0)).toEqual([{ ...A, quantidade: 4 }])
  })

  it('não remove o único grupo restante', () => {
    const grupos = [{ ...A, quantidade: 4 }]

    expect(removerGrupo(grupos, 0)).toEqual(grupos)
  })
})

/**
 * O que vem do banco em `grupos_de_corte` é JSONB solto — `unknown` de
 * verdade, sem garantia nenhuma de formato. Um grupo quebrado precisa
 * derrubar a lista INTEIRA, não só aquele grupo: mostrar parte dos grupos
 * certos e inventar o resto é pior do que voltar ao comportamento de antes
 * do recurso existir.
 */
describe('validar grupos de corte vindos do banco', () => {
  const GRUPO_A = {
    quantidade: 2,
    sentido: 'v',
    corte_inicio: 'meia_cima',
    corte_fim: 'reto',
  }
  const GRUPO_B = {
    quantidade: 2,
    sentido: 'h',
    corte_inicio: 'reto',
    corte_fim: 'meia_baixo',
  }

  it('aceita um array bem formado', () => {
    expect(gruposDeCorteValidos([GRUPO_A, GRUPO_B])).toEqual([GRUPO_A, GRUPO_B])
  })

  it('rejeita quando não é array', () => {
    expect(gruposDeCorteValidos(null)).toBeNull()
    expect(gruposDeCorteValidos(undefined)).toBeNull()
    expect(gruposDeCorteValidos({ sentido: 'h' })).toBeNull()
    expect(gruposDeCorteValidos('h')).toBeNull()
  })

  it('rejeita array vazio — cai no comportamento uniforme, não em zero peças', () => {
    expect(gruposDeCorteValidos([])).toBeNull()
  })

  it('rejeita quantidade ausente, zero, negativa ou não inteira', () => {
    expect(
      gruposDeCorteValidos([{ ...GRUPO_A, quantidade: undefined }]),
    ).toBeNull()
    expect(gruposDeCorteValidos([{ ...GRUPO_A, quantidade: 0 }])).toBeNull()
    expect(gruposDeCorteValidos([{ ...GRUPO_A, quantidade: -1 }])).toBeNull()
    expect(gruposDeCorteValidos([{ ...GRUPO_A, quantidade: 1.5 }])).toBeNull()
  })

  it('um grupo quebrado derruba a lista inteira', () => {
    expect(
      gruposDeCorteValidos([GRUPO_A, { ...GRUPO_B, sentido: 'x' }]),
    ).toBeNull()
    expect(gruposDeCorteValidos([GRUPO_A, null])).toBeNull()
    expect(
      gruposDeCorteValidos([GRUPO_A, { ...GRUPO_B, corte_fim: 'invertido' }]),
    ).toBeNull()
  })
})

describe('descrever o corte de uma linha inteira', () => {
  it('sem grupos, descreve como sempre foi', () => {
    expect(descreverGruposDaLinha('h', 'reto', 'reto', null)).toBe(
      descreverCortes('h', 'reto', 'reto'),
    )
  })

  it('com grupos, prefixa a quantidade quando é mais de uma peça', () => {
    const resultado = descreverGruposDaLinha('h', 'reto', 'reto', [
      { quantidade: 2, sentido: 'h', corte_inicio: 'reto', corte_fim: 'reto' },
      {
        quantidade: 2,
        sentido: 'v',
        corte_inicio: 'meia_cima',
        corte_fim: 'meia_baixo',
      },
    ])

    expect(resultado).toBe(
      `2× ${descreverCortes('h', 'reto', 'reto')} · 2× ${descreverCortes('v', 'meia_cima', 'meia_baixo')}`,
    )
  })

  it('grupo de 1 peça não ganha prefixo "1×"', () => {
    const resultado = descreverGruposDaLinha('h', 'reto', 'reto', [
      { quantidade: 1, sentido: 'h', corte_inicio: 'reto', corte_fim: 'reto' },
      {
        quantidade: 3,
        sentido: 'v',
        corte_inicio: 'meia_cima',
        corte_fim: 'meia_baixo',
      },
    ])

    expect(resultado).toBe(
      `${descreverCortes('h', 'reto', 'reto')} · 3× ${descreverCortes('v', 'meia_cima', 'meia_baixo')}`,
    )
  })
})
