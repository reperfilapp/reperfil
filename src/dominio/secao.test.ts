import { describe, it, expect } from 'vitest'
import {
  areaSecaoMm2,
  pesoPorMetroG,
  pesoPorMetroDePeca,
  candidatosPorPeso,
  candidatosPorMedida,
  formatarAreaSecao,
  formatarSecao,
  formatarMedidasSecao,
  DENSIDADE_ALUMINIO_G_CM3,
} from './secao'

describe('área da seção a partir do peso', () => {
  it('converte pelo peso específico do alumínio', () => {
    // 450 g/m ÷ 2,7 = 166,67 mm² de metal na seção.
    expect(areaSecaoMm2(450)).toBeCloseTo(166.67, 1)
  })

  it('devolve nulo quando o perfil não tem peso cadastrado', () => {
    // Ausência é informação: 18 dos 82 perfis do catálogo estão assim, e
    // mostrar "0 mm²" faria parecer que o perfil não tem metal.
    expect(areaSecaoMm2(null)).toBeNull()
  })

  it('recusa peso inválido em vez de inventar área negativa', () => {
    expect(areaSecaoMm2(0)).toBeNull()
    expect(areaSecaoMm2(-100)).toBeNull()
  })

  it('vai e volta sem perder valor', () => {
    const area = areaSecaoMm2(698)

    expect(area).not.toBeNull()
    expect(pesoPorMetroG(area!)).toBeCloseTo(698, 6)
  })

  it('usa a densidade das ligas de esquadria', () => {
    expect(DENSIDADE_ALUMINIO_G_CM3).toBe(2.7)
  })
})

describe('peso por metro de uma peça medida na balança', () => {
  it('calcula a partir do peso e do comprimento', () => {
    // Sobra de 1,5 m que pesa 700 g na balança da oficina.
    expect(pesoPorMetroDePeca(700, 1500)).toBeCloseTo(466.67, 1)
  })

  it('trata peça de 6 m inteira', () => {
    expect(pesoPorMetroDePeca(2700, 6000)).toBe(450)
  })

  it('recusa medições impossíveis', () => {
    expect(pesoPorMetroDePeca(0, 1500)).toBeNull()
    expect(pesoPorMetroDePeca(700, 0)).toBeNull()
  })
})

describe('candidatos por peso', () => {
  // Pesos reais do catálogo importado.
  const catalogo = [
    { codigo: '25-016', peso_por_metro_g: 450 },
    { codigo: '25-026', peso_por_metro_g: 520 },
    { codigo: '25-540', peso_por_metro_g: 565 },
    { codigo: '25-508', peso_por_metro_g: 698 },
    { codigo: 'P-2501', peso_por_metro_g: 1180 },
    { codigo: 'SEM-PESO', peso_por_metro_g: null },
  ]

  it('acha o perfil certo a partir de uma peça pesada', () => {
    // 1,5 m pesando 675 g dá 450 g/m — o 25-016 exato.
    const medido = pesoPorMetroDePeca(675, 1500)!
    const achados = candidatosPorPeso(catalogo, medido)

    expect(achados[0]?.perfil.codigo).toBe('25-016')
    expect(achados[0]?.diferencaPercentual).toBeCloseTo(0, 6)
  })

  it('ordena do mais próximo ao mais distante', () => {
    // 540 g/m fica entre o 25-026 (520) e o 25-540 (565).
    const achados = candidatosPorPeso(catalogo, 540)

    expect(achados.map((c) => c.perfil.codigo)).toEqual(['25-026', '25-540'])
  })

  it('respeita a tolerância de medição', () => {
    // A balança de oficina erra alguns gramas e a trena erra alguns
    // milímetros: 460 g/m ainda deve encontrar o perfil de 450.
    const achados = candidatosPorPeso(catalogo, 460)

    expect(achados.map((c) => c.perfil.codigo)).toContain('25-016')
  })

  it('não devolve perfil fora da tolerância', () => {
    // 1180 g/m está longe de tudo abaixo dele: só o P-2501 responde.
    const achados = candidatosPorPeso(catalogo, 1180)

    expect(achados).toHaveLength(1)
    expect(achados[0]?.perfil.codigo).toBe('P-2501')
  })

  it('ignora perfis sem peso cadastrado em vez de quebrar', () => {
    const achados = candidatosPorPeso(catalogo, 450)

    expect(achados.every((c) => c.perfil.codigo !== 'SEM-PESO')).toBe(true)
  })

  it('devolve vazio quando nada bate', () => {
    expect(candidatosPorPeso(catalogo, 5000)).toEqual([])
  })

  it('devolve vazio para medição inválida', () => {
    expect(candidatosPorPeso(catalogo, 0)).toEqual([])
  })

  it('aceita tolerância mais folgada quando se quer ver mais opções', () => {
    // Com 30%, 540 g/m alcança também o 25-016 (450) e o 25-508 (698).
    const estreito = candidatosPorPeso(catalogo, 540)
    const folgado = candidatosPorPeso(catalogo, 540, 30)

    expect(folgado.length).toBeGreaterThan(estreito.length)
  })
})

describe('exibição da área', () => {
  it('arredonda e usa separador brasileiro', () => {
    expect(formatarAreaSecao(166.67)).toBe('167 mm²')
    expect(formatarAreaSecao(1234.5)).toBe('1.235 mm²')
  })
})

describe('candidatos por medida de trena', () => {
  // Dimensões derivadas dos desenhos reais destes perfis.
  const catalogo = [
    { codigo: '25-002', largura_secao_mm: 29.0, altura_secao_mm: 35.7 },
    { codigo: '25-016', largura_secao_mm: 26.4, altura_secao_mm: 41.6 },
    { codigo: '25-026', largura_secao_mm: 45.2, altura_secao_mm: 28.1 },
    { codigo: '25-508', largura_secao_mm: 61.9, altura_secao_mm: 27.6 },
    { codigo: 'SEM-MEDIDA', largura_secao_mm: null, altura_secao_mm: null },
  ]

  it('acha o perfil pela seção medida', () => {
    const achados = candidatosPorMedida(catalogo, [29, 36])

    expect(achados[0]?.perfil.codigo).toBe('25-002')
  })

  it('não se importa com a ordem das medidas', () => {
    // Quem mede não sabe qual lado o desenho chamou de altura.
    const deitado = candidatosPorMedida(catalogo, [29, 36])
    const emPe = candidatosPorMedida(catalogo, [36, 29])

    expect(emPe.map((c) => c.perfil.codigo)).toEqual(
      deitado.map((c) => c.perfil.codigo),
    )
  })

  it('perdoa o erro da trena e o da medida derivada', () => {
    // Mediu 30 × 37 onde o catálogo tem 29 × 35,7 — ainda é o mesmo perfil.
    const achados = candidatosPorMedida(catalogo, [30, 37])

    expect(achados[0]?.perfil.codigo).toBe('25-002')
  })

  it('separa perfis de seções realmente diferentes', () => {
    // 62 × 28 é a travessa larga, não o montante estreito.
    const achados = candidatosPorMedida(catalogo, [62, 28])

    expect(achados[0]?.perfil.codigo).toBe('25-508')
    expect(achados.map((c) => c.perfil.codigo)).not.toContain('25-016')
  })

  it('aceita medidas extras que o catálogo ainda não conhece', () => {
    // O serralheiro tirou quatro medidas da ponta do 25-026 (45,2 × 28,1):
    // as duas externas mais duas cotas internas. As internas não têm com o
    // que casar hoje, e não podem eliminar o perfil por isso.
    const achados = candidatosPorMedida(catalogo, [45, 28, 15, 11.6])

    expect(achados[0]?.perfil.codigo).toBe('25-026')
  })

  it('não inventa perfil quando nenhuma medida externa bate', () => {
    // Quatro cotas internas, nenhuma correspondendo a largura ou altura de
    // perfil algum: melhor não achar nada do que apontar o errado.
    const achados = candidatosPorMedida(catalogo, [15, 11.6, 9, 7])

    expect(achados).toEqual([])
  })

  it('encontra as medidas conhecidas no meio das outras', () => {
    // 29 e 36 são as do 25-002; 12 e 8 são cotas internas quaisquer.
    const achados = candidatosPorMedida(catalogo, [12, 29, 8, 36])

    expect(achados[0]?.perfil.codigo).toBe('25-002')
  })

  it('aceita uma medida só, cobrando só o que foi dado', () => {
    // Com uma medida não dá para provar largura E altura — mas serve para
    // descartar quem não tem nenhum lado parecido.
    const achados = candidatosPorMedida(catalogo, [61.9])

    expect(achados.map((c) => c.perfil.codigo)).toContain('25-508')
  })

  it('não deixa uma medida só explicar as duas dimensões', () => {
    // 30 sozinho não pode casar com largura e altura de um perfil 30 × 60.
    const quadradoFalso = [
      { codigo: 'X', largura_secao_mm: 30, altura_secao_mm: 60 },
    ]
    const achados = candidatosPorMedida(quadradoFalso, [30, 30])

    expect(achados).toEqual([])
  })

  it('ordena do mais próximo ao mais distante', () => {
    const achados = candidatosPorMedida(catalogo, [28, 38], 30)
    const desvios = achados.map((c) => c.desvioPercentual)

    expect(desvios).toEqual([...desvios].sort((a, b) => a - b))
  })

  it('ignora perfis sem medida derivada', () => {
    const achados = candidatosPorMedida(catalogo, [29, 36])

    expect(achados.every((c) => c.perfil.codigo !== 'SEM-MEDIDA')).toBe(true)
  })

  it('descarta medidas inválidas em vez de quebrar', () => {
    // Campos vazios viram NaN; zero e negativo não são medida.
    const achados = candidatosPorMedida(catalogo, [29, 36, NaN, 0, -5])

    expect(achados[0]?.perfil.codigo).toBe('25-002')
  })

  it('devolve vazio quando não há nenhuma medida utilizável', () => {
    expect(candidatosPorMedida(catalogo, [])).toEqual([])
    expect(candidatosPorMedida(catalogo, [0, NaN])).toEqual([])
  })
})

describe('exibição da seção', () => {
  it('mostra medidas inteiras sem casa decimal', () => {
    expect(formatarSecao(30, 40)).toBe('30 × 40 mm')
  })

  it('usa vírgula nas quebradas', () => {
    expect(formatarSecao(29, 35.7)).toBe('29 × 35,7 mm')
  })

  it('devolve nulo quando o perfil não tem medida', () => {
    expect(formatarSecao(null, 40)).toBeNull()
  })
})

describe('as quatro medidas numa linha só', () => {
  it('junta tudo que o catálogo conhece, na ordem fixa', () => {
    expect(
      formatarMedidasSecao({
        largura_secao_mm: 125,
        altura_secao_mm: 125,
        medida_3_secao_mm: 452,
        medida_4_secao_mm: 52,
      }),
    ).toBe('125 × 125 × 452 × 52 mm')
  })

  it('mostra só o que existe, sem buraco no lugar do que falta', () => {
    // A maioria dos perfis tem apenas as duas derivadas do peso. Um traço
    // ou um zero no lugar das outras faria parecer medida de verdade.
    expect(
      formatarMedidasSecao({ largura_secao_mm: 30, altura_secao_mm: 42 }),
    ).toBe('30 × 42 mm')
  })

  it('não deixa buraco no meio quando falta a segunda', () => {
    expect(
      formatarMedidasSecao({ largura_secao_mm: 30, medida_3_secao_mm: 12 }),
    ).toBe('30 × 12 mm')
  })

  it('usa vírgula nas quebradas e nada nas inteiras', () => {
    expect(
      formatarMedidasSecao({ largura_secao_mm: 29, altura_secao_mm: 35.7 }),
    ).toBe('29 × 35,7 mm')
  })

  it('devolve nulo quando o perfil não tem medida nenhuma', () => {
    // Antes da migração as colunas nem vêm do banco: o campo chega ausente.
    expect(formatarMedidasSecao({})).toBeNull()
    expect(
      formatarMedidasSecao({ largura_secao_mm: null, altura_secao_mm: null }),
    ).toBeNull()
  })
})
