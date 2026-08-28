import { describe, it, expect } from 'vitest'
import { sobrasDisponiveis } from './estoqueParaProducao'

/**
 * Este filtro decide o que a tela "O que dá para produzir" enxerga do
 * depósito. Errar para MAIS é o caro: prometer uma janela contando com
 * peça que já tem dono, ou que foi descartada, manda a oficina começar um
 * serviço que trava no meio.
 */
function lote(ajustes: Partial<Parameters<typeof sobrasDisponiveis>[0][number]> = {}) {
  return {
    modelo_perfil_id: 'perfil-a',
    acabamento_id: 'acab-a',
    comprimento_mm: 6000,
    quantidade: 4,
    quantidade_reservada: 0,
    status: 'disponivel',
    ...ajustes,
  }
}

describe('sobras disponíveis para produção', () => {
  it('desconta o que está reservado', () => {
    // 4 peças, 3 prometidas para outra obra: só 1 conta.
    const resultado = sobrasDisponiveis([
      lote({ quantidade: 4, quantidade_reservada: 3 }),
    ])

    expect(resultado).toHaveLength(1)
    expect(resultado[0]?.quantidade).toBe(1)
  })

  it('exclui o lote inteiramente reservado', () => {
    expect(
      sobrasDisponiveis([lote({ quantidade: 2, quantidade_reservada: 2 })]),
    ).toEqual([])
  })

  it.each(['consumida', 'descartada', 'em_conferencia', 'reservada'])(
    'exclui lote com status %s',
    (status) => {
      expect(sobrasDisponiveis([lote({ status })])).toEqual([])
    },
  )

  it('mantém apenas os lotes disponíveis quando há mistura', () => {
    const resultado = sobrasDisponiveis([
      lote({ modelo_perfil_id: 'fica', status: 'disponivel' }),
      lote({ modelo_perfil_id: 'sai-status', status: 'consumida' }),
      lote({ modelo_perfil_id: 'sai-reserva', quantidade_reservada: 4 }),
    ])

    expect(resultado.map((s) => s.modelo_perfil_id)).toEqual(['fica'])
  })

  it('preserva perfil, acabamento e comprimento — é o que casa com a receita', () => {
    const resultado = sobrasDisponiveis([
      lote({
        modelo_perfil_id: 'mn-007',
        acabamento_id: 'branco',
        comprimento_mm: 1455,
      }),
    ])

    expect(resultado[0]).toEqual({
      modelo_perfil_id: 'mn-007',
      acabamento_id: 'branco',
      comprimento_mm: 1455,
      quantidade: 4,
    })
  })

  it('não quebra com depósito vazio', () => {
    expect(sobrasDisponiveis([])).toEqual([])
  })

  it('trata reserva maior que a quantidade como zero, não como negativo', () => {
    // Não deveria acontecer, mas se acontecer o lote some da conta em vez
    // de SUBTRAIR de outro lote do mesmo perfil.
    expect(
      sobrasDisponiveis([lote({ quantidade: 1, quantidade_reservada: 5 })]),
    ).toEqual([])
  })
})

/**
 * "Dá para fazer sem gastar barra nova?" é uma pergunta diferente de "dá
 * para fazer?" — e é a que justifica o aplicativo. Sem este filtro, uma
 * barra inteira recém-comprada respondia sim às duas.
 */
describe('origem do material', () => {
  it('conta barra nova e sobra por padrão', () => {
    const resultado = sobrasDisponiveis([
      lote({ tipo_material: 'novo' }),
      lote({ tipo_material: 'sobra' }),
    ])

    expect(resultado).toHaveLength(2)
  })

  it('exclui barra nova quando a pergunta é só sobre sobras', () => {
    const resultado = sobrasDisponiveis(
      [
        lote({ tipo_material: 'novo', comprimento_mm: 6000 }),
        lote({ tipo_material: 'sobra', comprimento_mm: 1455 }),
      ],
      'so_sobras',
    )

    expect(resultado).toHaveLength(1)
    expect(resultado[0]?.comprimento_mm).toBe(1455)
  })

  it('trata lote antigo, sem tipo gravado, como sobra', () => {
    // O campo nasceu depois do cadastro de estoque. O que veio antes dele é
    // retalho, e sumir com esse material seria pior do que classificá-lo.
    expect(sobrasDisponiveis([lote()], 'so_sobras')).toHaveLength(1)
  })
})
