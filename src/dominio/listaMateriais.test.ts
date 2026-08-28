import { describe, it, expect } from 'vitest'
import { calcularListaMateriais } from './listaMateriais'
import { CONFIGURACAO_CORTE_PADRAO } from './corte'
import type { SobraDisponivel } from './producao'

/**
 * Esta lista vira pedido ao fornecedor e número no orçamento do cliente.
 * Errar para MENOS trava o serviço no meio; errar para MAIS faz comprar
 * barra que já estava no cavalete. Os dois custam, e por isso cada conta
 * aqui é conferida com número redondo e verificável à mão.
 *
 * Com a configuração padrão (serra 3 mm, sem margem, último corte sem
 * perda), uma barra de 6.000 mm rende 5 cortes de 1.000 mm:
 * 5×1.000 + 4×3 = 5.012 ≤ 6.000, e o sexto pediria 6.015.
 */

const CONFIG = CONFIGURACAO_CORTE_PADRAO
const BARRA_6M = new Map([['perfil-a', 6000]])

function sobra(ajustes: Partial<SobraDisponivel> = {}): SobraDisponivel {
  return {
    modelo_perfil_id: 'perfil-a',
    acabamento_id: 'branco',
    comprimento_mm: 6000,
    quantidade: 1,
    ...ajustes,
  }
}

describe('lista de materiais', () => {
  it('multiplica a lista técnica pela quantidade a produzir', () => {
    const resultado = calcularListaMateriais(
      [{ modelo_perfil_id: 'perfil-a', comprimento_mm: 1000, quantidade: 2 }],
      5,
      [],
      BARRA_6M,
      CONFIG,
      'tudo_novo',
    )

    expect(resultado.linhas[0]?.cortes[0]?.quantidade).toBe(10)
    // 10 cortes a 5 por barra.
    expect(resultado.totalBarras).toBe(2)
  })

  it('ignora o depósito no modo tudo_novo', () => {
    // Sobra de 6 m parada e disponível: o orçamento cheio não a desconta.
    const resultado = calcularListaMateriais(
      [{ modelo_perfil_id: 'perfil-a', comprimento_mm: 1000, quantidade: 10 }],
      1,
      [sobra({ quantidade: 4 })],
      BARRA_6M,
      CONFIG,
      'tudo_novo',
    )

    expect(resultado.totalBarras).toBe(2)
    expect(resultado.linhas[0]?.cortes[0]?.deSobra).toBe(0)
    expect(resultado.acabamento_id).toBeNull()
  })

  it('desconta as sobras e compra só a diferença', () => {
    /*
     * Sobra de 3.000 mm comporta 2 cortes de 1.000 (2.003 mm), não 3
     * (3.006 mm). Sobram 8 dos 10, que cabem em 2 barras.
     */
    const resultado = calcularListaMateriais(
      [{ modelo_perfil_id: 'perfil-a', comprimento_mm: 1000, quantidade: 10 }],
      1,
      [sobra({ comprimento_mm: 3000 })],
      BARRA_6M,
      CONFIG,
      'aproveitar_sobras',
    )

    expect(resultado.linhas[0]?.cortes[0]?.deSobra).toBe(2)
    expect(resultado.linhas[0]?.cortes[0]?.deBarraNova).toBe(8)
    expect(resultado.totalBarras).toBe(2)
    expect(resultado.acabamento_id).toBe('branco')
  })

  it('não compra nada quando as sobras cobrem tudo', () => {
    const resultado = calcularListaMateriais(
      [{ modelo_perfil_id: 'perfil-a', comprimento_mm: 1000, quantidade: 4 }],
      1,
      [sobra({ comprimento_mm: 6000 })],
      BARRA_6M,
      CONFIG,
      'aproveitar_sobras',
    )

    expect(resultado.totalBarras).toBe(0)
    expect(resultado.linhas[0]?.cortes[0]?.deBarraNova).toBe(0)
  })

  it('não soma sobras de acabamentos diferentes', () => {
    /*
     * Uma peça sai toda da mesma cor. Duas sobras de 3 m, uma branca e uma
     * preta, cobrem 2 cortes — não 4 —, porque só uma das cores entra.
     */
    const resultado = calcularListaMateriais(
      [{ modelo_perfil_id: 'perfil-a', comprimento_mm: 1000, quantidade: 10 }],
      1,
      [
        sobra({ acabamento_id: 'branco', comprimento_mm: 3000 }),
        sobra({ acabamento_id: 'preto', comprimento_mm: 3000 }),
      ],
      BARRA_6M,
      CONFIG,
      'aproveitar_sobras',
    )

    expect(resultado.linhas[0]?.cortes[0]?.deSobra).toBe(2)
  })

  it('escolhe o acabamento que cobre mais cortes', () => {
    const resultado = calcularListaMateriais(
      [{ modelo_perfil_id: 'perfil-a', comprimento_mm: 1000, quantidade: 10 }],
      1,
      [
        sobra({ acabamento_id: 'branco', comprimento_mm: 2000 }),
        sobra({ acabamento_id: 'preto', comprimento_mm: 6000 }),
      ],
      BARRA_6M,
      CONFIG,
      'aproveitar_sobras',
    )

    // Preto rende 5; branco renderia 1 (2.000 comporta 1 corte, 2 pediriam 2.003).
    expect(resultado.acabamento_id).toBe('preto')
    expect(resultado.linhas[0]?.cortes[0]?.deSobra).toBe(5)
  })

  it('marca como impossível o corte maior que a barra', () => {
    const resultado = calcularListaMateriais(
      [{ modelo_perfil_id: 'perfil-a', comprimento_mm: 7000, quantidade: 3 }],
      1,
      [],
      BARRA_6M,
      CONFIG,
      'tudo_novo',
    )

    expect(resultado.linhas[0]?.cortesImpossiveis).toBe(3)
    expect(resultado.totalBarras).toBe(0)
  })

  it('não inventa compra para perfil sem barra cadastrada', () => {
    const resultado = calcularListaMateriais(
      [{ modelo_perfil_id: 'perfil-a', comprimento_mm: 1000, quantidade: 4 }],
      1,
      [],
      new Map(),
      CONFIG,
      'tudo_novo',
    )

    expect(resultado.linhas[0]?.comprimento_barra_mm).toBe(0)
    expect(resultado.linhas[0]?.cortesImpossiveis).toBe(4)
    expect(resultado.totalBarras).toBe(0)
  })

  it('separa uma linha por perfil', () => {
    const resultado = calcularListaMateriais(
      [
        { modelo_perfil_id: 'perfil-a', comprimento_mm: 1000, quantidade: 4 },
        { modelo_perfil_id: 'perfil-b', comprimento_mm: 2000, quantidade: 2 },
      ],
      1,
      [],
      new Map([
        ['perfil-a', 6000],
        ['perfil-b', 6000],
      ]),
      CONFIG,
      'tudo_novo',
    )

    expect(resultado.linhas).toHaveLength(2)
    expect(resultado.totalBarras).toBe(2)
  })

  it('devolve lista vazia sem lista técnica', () => {
    const resultado = calcularListaMateriais(
      [],
      3,
      [sobra()],
      BARRA_6M,
      CONFIG,
      'aproveitar_sobras',
    )

    expect(resultado.linhas).toEqual([])
    expect(resultado.totalBarras).toBe(0)
  })

  it('trata quantidade zero como uma unidade, em vez de zerar a lista', () => {
    // A tela não deixa chegar em zero, mas uma lista de compras vazia por
    // causa de um campo mal digitado seria pior do que a de uma unidade.
    const resultado = calcularListaMateriais(
      [{ modelo_perfil_id: 'perfil-a', comprimento_mm: 1000, quantidade: 4 }],
      0,
      [],
      BARRA_6M,
      CONFIG,
      'tudo_novo',
    )

    expect(resultado.linhas[0]?.cortes[0]?.quantidade).toBe(4)
  })

  it('conta o resto que fica dentro das barras compradas', () => {
    /*
     * Cada corte custa 1.000 mm mais a passada de serra que separa o resto
     * da barra — 1.003 mm. Quatro cortes tiram 4.012 e deixam 1.988, resto
     * grande o bastante para voltar ao estoque como sobra nova.
     */
    const resultado = calcularListaMateriais(
      [{ modelo_perfil_id: 'perfil-a', comprimento_mm: 1000, quantidade: 4 }],
      1,
      [],
      BARRA_6M,
      CONFIG,
      'tudo_novo',
    )

    expect(resultado.linhas[0]?.restoDasBarrasMm).toBe(1988)
  })
})
