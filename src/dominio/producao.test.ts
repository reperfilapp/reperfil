import { describe, it, expect } from 'vitest'
import {
  unidadesProduziveis,
  cortesAtendidos,
  chaveDoCorte,
  type SobraDisponivel,
} from './producao'
import { CONFIGURACAO_CORTE_PADRAO } from './corte'

const CONFIG = CONFIGURACAO_CORTE_PADRAO

const MARCO = 'perfil-marco'
const FOLHA = 'perfil-folha'
const BRANCO = 'acab-branco'
const PRETO = 'acab-preto'

/** Janela 1,50 × 1,00: dois marcos de 1500 e dois de 1000. */
const JANELA = [
  { modelo_perfil_id: MARCO, comprimento_mm: 1500, quantidade: 2 },
  { modelo_perfil_id: MARCO, comprimento_mm: 1000, quantidade: 2 },
]

function sobra(
  modelo: string,
  comprimento: number,
  quantidade: number,
  acabamento = BRANCO,
): SobraDisponivel {
  return {
    modelo_perfil_id: modelo,
    acabamento_id: acabamento,
    comprimento_mm: comprimento,
    quantidade,
  }
}

describe('quantas unidades saem das sobras', () => {
  it('conta as unidades que cabem', () => {
    // Quatro peças de 6 m: cada uma tira 1500+1500+1000+1000 = 5000 + serra,
    // então cada peça faz uma janela inteira e sobra material.
    const resultado = unidadesProduziveis(
      JANELA,
      [sobra(MARCO, 6000, 4)],
      CONFIG,
    )

    expect(resultado.unidades).toBe(4)
    expect(resultado.acabamento_id).toBe(BRANCO)
  })

  it('aproveita várias peças curtas', () => {
    // Nenhuma peça sozinha faz a janela: são quatro cortes em quatro peças.
    const resultado = unidadesProduziveis(
      JANELA,
      [sobra(MARCO, 1600, 2), sobra(MARCO, 1100, 2)],
      CONFIG,
    )

    expect(resultado.unidades).toBe(1)
  })

  it('não promete unidade que não fecha', () => {
    // Sobra para os dois cortes de 1500, mas só um de 1000.
    const resultado = unidadesProduziveis(
      JANELA,
      [sobra(MARCO, 1600, 2), sobra(MARCO, 1100, 1)],
      CONFIG,
    )

    expect(resultado.unidades).toBe(0)
    expect(resultado.faltas).toEqual([
      { modelo_perfil_id: MARCO, comprimento_mm: 1000, faltam: 1 },
    ])
  })

  it('diz o que falta, e não só que não dá', () => {
    const resultado = unidadesProduziveis(
      JANELA,
      [sobra(MARCO, 900, 5)],
      CONFIG,
    )

    // Peça de 900 não atende corte nenhum: 1500 nem 1000 cabem nela.
    expect(resultado.unidades).toBe(0)
    expect(resultado.faltas).toHaveLength(2)
    expect(resultado.faltas.map((f) => f.faltam)).toEqual([2, 2])
  })

  it('não mistura acabamentos na mesma unidade', () => {
    // Material sobra: são 2 peças brancas e 2 pretas, o bastante em metros
    // para uma janela. Mas ninguém entrega janela metade branca.
    const resultado = unidadesProduziveis(
      JANELA,
      [sobra(MARCO, 1600, 2, BRANCO), sobra(MARCO, 1100, 2, PRETO)],
      CONFIG,
    )

    expect(resultado.unidades).toBe(0)
  })

  it('escolhe o acabamento que rende mais', () => {
    const resultado = unidadesProduziveis(
      JANELA,
      [sobra(MARCO, 6000, 1, BRANCO), sobra(MARCO, 6000, 3, PRETO)],
      CONFIG,
    )

    expect(resultado.unidades).toBe(3)
    expect(resultado.acabamento_id).toBe(PRETO)
  })

  it('exige todos os perfis da lista, não só o que tem em casa', () => {
    const lista = [
      { modelo_perfil_id: MARCO, comprimento_mm: 1000, quantidade: 2 },
      { modelo_perfil_id: FOLHA, comprimento_mm: 900, quantidade: 2 },
    ]

    const resultado = unidadesProduziveis(
      lista,
      [sobra(MARCO, 6000, 10)],
      CONFIG,
    )

    expect(resultado.unidades).toBe(0)
    expect(resultado.faltas).toEqual([
      { modelo_perfil_id: FOLHA, comprimento_mm: 900, faltam: 2 },
    ])
  })

  it('desconta a serra entre cortes na mesma peça', () => {
    // Dois cortes de 3000 numa peça de 6000: com disco de 3 mm, o segundo
    // corte não cabe. Ignorar a serra prometeria uma janela que não sai.
    const resultado = unidadesProduziveis(
      [{ modelo_perfil_id: MARCO, comprimento_mm: 3000, quantidade: 2 }],
      [sobra(MARCO, 6000, 1)],
      CONFIG,
    )

    expect(resultado.unidades).toBe(0)
  })

  it('devolve zero quando não há lista técnica', () => {
    // Produto cadastrado e ainda sem receita: dizer "dá para fazer 99" seria
    // pior do que dizer que não dá.
    expect(unidadesProduziveis([], [sobra(MARCO, 6000, 10)], CONFIG)).toEqual({
      unidades: 0,
      acabamento_id: null,
      faltas: [],
    })
  })

  it('devolve zero quando o depósito está vazio', () => {
    const resultado = unidadesProduziveis(JANELA, [], CONFIG)

    expect(resultado.unidades).toBe(0)
    expect(resultado.acabamento_id).toBeNull()
  })

  it('respeita o teto de segurança', () => {
    // Sem teto, estoque grande diante de lista pequena giraria o laço por
    // muito tempo à toa — a resposta útil é "dá de sobra", não o número
    // exato.
    const resultado = unidadesProduziveis(
      [{ modelo_perfil_id: MARCO, comprimento_mm: 100, quantidade: 1 }],
      [sobra(MARCO, 6000, 50)],
      CONFIG,
      10,
    )

    expect(resultado.unidades).toBe(10)
  })

  it('atende o corte longo antes do curto', () => {
    // Uma peça de 1600 e uma de 1100, precisando de um corte de 1500 e um de
    // 1000. Atendendo o curto primeiro, ele tomaria a peça de 1600 e o corte
    // de 1500 ficaria sem lugar.
    const resultado = unidadesProduziveis(
      [
        { modelo_perfil_id: MARCO, comprimento_mm: 1000, quantidade: 1 },
        { modelo_perfil_id: MARCO, comprimento_mm: 1500, quantidade: 1 },
      ],
      [sobra(MARCO, 1600, 1), sobra(MARCO, 1100, 1)],
      CONFIG,
    )

    expect(resultado.unidades).toBe(1)
  })
})

describe('cortes atendidos, um perfil de cada vez', () => {
  it('marca o corte que tem material, mesmo em outro acabamento', () => {
    // O caso que motivou a função: uma janela precisa de dois perfis, e cada
    // um só existe num acabamento diferente. A peça inteira não sai — mas
    // dizer que FALTA material para os dois cortes é mentira: os dois estão
    // na prateleira.
    const lista = [
      { modelo_perfil_id: MARCO, comprimento_mm: 1455, quantidade: 1 },
      { modelo_perfil_id: FOLHA, comprimento_mm: 1455, quantidade: 1 },
    ]

    const estoque = [
      sobra(MARCO, 6000, 1, BRANCO),
      sobra(FOLHA, 3870, 1, PRETO),
    ]

    const atendidos = cortesAtendidos(lista, estoque, CONFIG)

    expect(atendidos.get(chaveDoCorte(lista[0]!))).toBe(true)
    expect(atendidos.get(chaveDoCorte(lista[1]!))).toBe(true)

    // E a peça inteira continua não saindo, porque ninguém entrega janela
    // metade branca — as duas respostas convivem.
    expect(unidadesProduziveis(lista, estoque, CONFIG).unidades).toBe(0)
  })

  it('marca como falta o corte sem material nenhum', () => {
    const lista = [
      { modelo_perfil_id: MARCO, comprimento_mm: 1455, quantidade: 1 },
    ]

    expect(
      cortesAtendidos(lista, [], CONFIG).get(chaveDoCorte(lista[0]!)),
    ).toBe(false)
  })

  it('resolve juntos os cortes do mesmo perfil', () => {
    // Duas peças de 3 m pedidas de uma barra de 6 m: com a serra no meio, a
    // segunda não cabe. Perguntar corte a corte, isolado, diria que sim.
    const lista = [
      { modelo_perfil_id: MARCO, comprimento_mm: 3000, quantidade: 2 },
    ]

    expect(
      cortesAtendidos(lista, [sobra(MARCO, 6000, 1)], CONFIG).get(
        chaveDoCorte(lista[0]!),
      ),
    ).toBe(false)
  })

  it('escolhe o acabamento que atende mais cortes do perfil', () => {
    const lista = [
      { modelo_perfil_id: MARCO, comprimento_mm: 2000, quantidade: 1 },
      { modelo_perfil_id: MARCO, comprimento_mm: 1000, quantidade: 1 },
    ]

    // Branco cobre os dois; preto cobriria só o curto.
    const atendidos = cortesAtendidos(
      lista,
      [sobra(MARCO, 6000, 1, BRANCO), sobra(MARCO, 1100, 1, PRETO)],
      CONFIG,
    )

    expect(atendidos.get(chaveDoCorte(lista[0]!))).toBe(true)
    expect(atendidos.get(chaveDoCorte(lista[1]!))).toBe(true)
  })
})
