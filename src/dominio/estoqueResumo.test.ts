import { describe, it, expect } from 'vitest'
import {
  resumirPorPerfil,
  resumirPorLinha,
  resumoDe,
  formatarResumo,
  maiorPrimeiro,
  type SobraParaResumo,
} from './estoqueResumo'

function sobra(ajustes: Partial<SobraParaResumo> = {}): SobraParaResumo {
  return {
    modelo_perfil_id: 'perfil-a',
    comprimento_mm: 6000,
    quantidade: 1,
    quantidade_reservada: 0,
    status: 'disponivel',
    ...ajustes,
  }
}

describe('resumo por perfil', () => {
  it('soma peças e metros do mesmo perfil', () => {
    const mapa = resumirPorPerfil([
      sobra({ comprimento_mm: 6000, quantidade: 2 }),
      sobra({ comprimento_mm: 3000, quantidade: 1 }),
    ])

    expect(resumoDe(mapa, 'perfil-a')).toEqual({
      pecas: 3,
      milimetros: 15000,
    })
  })

  it('separa perfis diferentes', () => {
    const mapa = resumirPorPerfil([
      sobra({ modelo_perfil_id: 'perfil-a' }),
      sobra({ modelo_perfil_id: 'perfil-b', quantidade: 4 }),
    ])

    expect(resumoDe(mapa, 'perfil-a').pecas).toBe(1)
    expect(resumoDe(mapa, 'perfil-b').pecas).toBe(4)
  })

  it('desconta as peças reservadas', () => {
    // Reservada tem dono. Contá-la mandaria alguém à prateleira atrás de
    // material que outra obra está esperando.
    const mapa = resumirPorPerfil([
      sobra({ quantidade: 5, quantidade_reservada: 2 }),
    ])

    expect(resumoDe(mapa, 'perfil-a').pecas).toBe(3)
  })

  it('ignora o que não está disponível', () => {
    const mapa = resumirPorPerfil([
      sobra({ status: 'consumida', quantidade: 9 }),
      sobra({ status: 'descartada', quantidade: 9 }),
      sobra({ status: 'em_conferencia', quantidade: 9 }),
      sobra({ status: 'disponivel', quantidade: 1 }),
    ])

    expect(resumoDe(mapa, 'perfil-a').pecas).toBe(1)
  })

  it('não cria entrada para lote inteiramente reservado', () => {
    // Sem isto, o perfil apareceria na lista com "0 m · 0 peças" — ocupando
    // espaço para dizer que não há nada.
    const mapa = resumirPorPerfil([
      sobra({ quantidade: 2, quantidade_reservada: 2 }),
    ])

    expect(mapa.size).toBe(0)
  })

  it('devolve zero para perfil sem estoque', () => {
    expect(resumoDe(new Map(), 'qualquer')).toEqual({
      pecas: 0,
      milimetros: 0,
    })
  })
})

describe('resumo por linha', () => {
  it('agrupa pelos perfis de cada linha', () => {
    const linhas: Record<string, string> = {
      'perfil-a': 'Suprema',
      'perfil-b': 'Suprema',
      'perfil-c': 'Linha 25',
    }

    const mapa = resumirPorLinha(
      [
        sobra({ modelo_perfil_id: 'perfil-a', comprimento_mm: 6000 }),
        sobra({ modelo_perfil_id: 'perfil-b', comprimento_mm: 2000 }),
        sobra({ modelo_perfil_id: 'perfil-c', comprimento_mm: 1000 }),
      ],
      (s) => linhas[s.modelo_perfil_id] ?? 'Sem linha',
    )

    expect(resumoDe(mapa, 'Suprema')).toEqual({ pecas: 2, milimetros: 8000 })
    expect(resumoDe(mapa, 'Linha 25')).toEqual({ pecas: 1, milimetros: 1000 })
  })
})

describe('formatação do resumo', () => {
  it('mostra metros e peças juntos', () => {
    // Um número sozinho engana: 30 metros podem ser uma barra inteira ou dez
    // pontas de três metros, e a diferença decide se cabe o corte.
    expect(formatarResumo({ pecas: 4, milimetros: 12500 })).toBe(
      '12,5 m · 4 peças',
    )
  })

  it('usa o singular com uma peça só', () => {
    expect(formatarResumo({ pecas: 1, milimetros: 6000 })).toBe(
      '6,0 m · 1 peça',
    )
  })
})

describe('ordenação', () => {
  it('põe quem tem mais metros primeiro', () => {
    const ordenados = [
      { pecas: 9, milimetros: 1000 },
      { pecas: 1, milimetros: 9000 },
    ].sort(maiorPrimeiro)

    expect(ordenados[0]?.milimetros).toBe(9000)
  })

  it('empatado em metros, mais peças vem primeiro', () => {
    // Mais peças é mais chance de encaixar um corte sem sobrar retalho.
    const ordenados = [
      { pecas: 1, milimetros: 6000 },
      { pecas: 3, milimetros: 6000 },
    ].sort(maiorPrimeiro)

    expect(ordenados[0]?.pecas).toBe(3)
  })
})
