import { describe, it, expect } from 'vitest'
import {
  codigoCombina,
  medidasDigitadas,
  filtrarPerfis,
  semZerosAEsquerda,
} from './buscaPerfil'

function perfil(
  codigo: string,
  medidas: (number | null)[] = [],
  descricao = 'Descrição qualquer',
) {
  return {
    codigo,
    descricao,
    linha: 'Suprema',
    aplicacao: null,
    largura_secao_mm: medidas[0] ?? null,
    altura_secao_mm: medidas[1] ?? null,
    medida_3_secao_mm: medidas[2] ?? null,
    medida_4_secao_mm: medidas[3] ?? null,
  }
}

/** O caso real que motivou a busca por medida: 35 × 25 × 20. */
const SU079 = perfil('SU-079', [35, 25, 20], 'Marco Maxim Ar')
const SU001 = perfil('SU-001', [71, 33], 'Trilho superior de correr')
const CATALOGO = [
  SU001,
  SU079,
  perfil('SU-011', [40, 20]),
  perfil('SU-100', [90, 90]),
  perfil('MN-039', [213, 20, 10]),
]

describe('codigoCombina', () => {
  it('acha o SU-001 do jeito que se digita', () => {
    for (const digitado of ['su001', 'SU 001', 'su1', 'su-001', 'SU-001']) {
      expect(codigoCombina('SU-001', digitado)).toBe(true)
    }
  })

  it('continua achando enquanto se digita, sem piscar vazio', () => {
    for (const parcial of ['s', 'su', 'su0', 'su00']) {
      expect(codigoCombina('SU-001', parcial)).toBe(true)
    }
  })

  it('"su1" não arrasta os vizinhos junto', () => {
    // Por trecho, "su1" casaria com SU-011 e SU-013 — e o perfil procurado
    // se perderia no meio deles. É por isso que a forma sem zeros compara
    // por igualdade.
    expect(codigoCombina('SU-011', 'su1')).toBe(false)
    expect(codigoCombina('SU-013', 'su1')).toBe(false)
  })

  it('"su1" ainda serve de começo para a faixa SU-1xx', () => {
    expect(codigoCombina('SU-100', 'su1')).toBe(true)
  })

  it('não confunde zero à esquerda com zero no meio', () => {
    expect(codigoCombina('SU-100', 'su100')).toBe(true)
    expect(codigoCombina('SU-001', 'su100')).toBe(false)
  })
})

describe('semZerosAEsquerda', () => {
  it('some só com o zero que não conta', () => {
    expect(semZerosAEsquerda('su001')).toBe('su1')
    expect(semZerosAEsquerda('su100')).toBe('su100')
    expect(semZerosAEsquerda('su010')).toBe('su10')
  })
})

describe('medidasDigitadas', () => {
  it('lê os números em qualquer ordem e com os separadores da oficina', () => {
    expect(medidasDigitadas('35 25 20')).toEqual([35, 25, 20])
    expect(medidasDigitadas('20 25')).toEqual([20, 25])
    expect(medidasDigitadas('35x25')).toEqual([35, 25])
    expect(medidasDigitadas('35 × 25')).toEqual([35, 25])
  })

  it('ignora termo com letra: é busca de código, não de medida', () => {
    expect(medidasDigitadas('su 25')).toEqual([])
    expect(medidasDigitadas('su001')).toEqual([])
  })

  it('ignora um número só, ambíguo demais', () => {
    expect(medidasDigitadas('25')).toEqual([])
  })
})

describe('filtrarPerfis', () => {
  it('acha o SU-079 por qualquer combinação das medidas dele', () => {
    for (const digitado of [
      '35 25 20',
      '25 35',
      '20 25',
      '20 25 35',
      '20 35',
      '25 20 35',
    ]) {
      expect(
        filtrarPerfis(CATALOGO, digitado),
        `busca "${digitado}"`,
      ).toContain(SU079)
    }
  })

  it('acha o SU-001 pelo código digitado sem hífen', () => {
    for (const digitado of ['su001', 'SU 001', 'su1']) {
      expect(
        filtrarPerfis(CATALOGO, digitado),
        `busca "${digitado}"`,
      ).toContain(SU001)
    }
  })

  it('a medida estreita a lista em vez de devolver o catálogo', () => {
    const achados = filtrarPerfis(CATALOGO, '35 25 20')

    expect(achados).toContain(SU079)
    expect(achados.length).toBeLessThan(CATALOGO.length)
  })

  it('termo vazio devolve tudo', () => {
    expect(filtrarPerfis(CATALOGO, '   ')).toHaveLength(CATALOGO.length)
  })

  it('continua achando pela descrição', () => {
    expect(filtrarPerfis(CATALOGO, 'maxim')).toContain(SU079)
  })
})
