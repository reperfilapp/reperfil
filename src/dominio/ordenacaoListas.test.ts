import { describe, it, expect } from 'vitest'
import { compararPorOrdemLinha } from './ordenacaoListas'

/**
 * A ordem manual das linhas é definida pela organização central e vale
 * para o catálogo de todas as empresas. Errar aqui não quebra nada
 * visivelmente — só embaralha a lista, que é o tipo de defeito que
 * ninguém reporta e todo mundo sente.
 */
const ordem = new Map([
  ['Suprema', 1],
  ['Gold / 32', 2],
  ['Fachada', 3],
])

describe('comparação pela ordem manual das linhas', () => {
  it('respeita a posição definida, não o alfabeto', () => {
    // Alfabeticamente seria Fachada < Gold < Suprema — exatamente o
    // inverso do que o administrador definiu.
    const linhas = ['Fachada', 'Gold / 32', 'Suprema']

    expect(
      [...linhas].sort((a, b) => compararPorOrdemLinha(a, b, ordem)),
    ).toEqual(['Suprema', 'Gold / 32', 'Fachada'])
  })

  it('põe linha sem posição definida DEPOIS de todas as ordenadas', () => {
    const linhas = ['Veneziana', 'Suprema', 'Tubular']

    expect(
      [...linhas].sort((a, b) => compararPorOrdemLinha(a, b, ordem)),
    ).toEqual(['Suprema', 'Tubular', 'Veneziana'])
  })

  it('desempata alfabeticamente entre linhas sem posição', () => {
    // Duas linhas novas, nenhuma posicionada: o alfabeto é a única ordem
    // que não parece aleatória.
    expect(compararPorOrdemLinha('Tubular', 'Veneziana', ordem)).toBeLessThan(0)
    expect(compararPorOrdemLinha('Veneziana', 'Tubular', ordem)).toBeGreaterThan(
      0,
    )
  })

  it('mapa vazio equivale a ordenar por alfabeto', () => {
    const vazio = new Map<string, number>()
    const linhas = ['Suprema', 'Fachada', 'Gold / 32']

    expect(
      [...linhas].sort((a, b) => compararPorOrdemLinha(a, b, vazio)),
    ).toEqual(['Fachada', 'Gold / 32', 'Suprema'])
  })

  it('compara a mesma linha como igual', () => {
    expect(compararPorOrdemLinha('Suprema', 'Suprema', ordem)).toBe(0)
  })

  it('ordena por número de posição, não pela ordem de inserção no mapa', () => {
    // Mapa montado fora de ordem de propósito: quem grava a ordem manual
    // faz upsert em lote, e a volta do banco não garante sequência.
    const foraDeOrdem = new Map([
      ['C', 3],
      ['A', 1],
      ['B', 2],
    ])

    expect(
      ['B', 'C', 'A'].sort((a, b) => compararPorOrdemLinha(a, b, foraDeOrdem)),
    ).toEqual(['A', 'B', 'C'])
  })
})
