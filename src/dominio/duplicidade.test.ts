import { describe, it, expect } from 'vitest'
import {
  loteEquivalente,
  duplicadosNoEstoque,
  podeSerJuntado,
  type LoteComparavel,
} from './duplicidade'

const PERFIL = 'perfil-su079'
const BRANCO = 'acab-branco'
const PRETO = 'acab-preto'

function lote(ajustes: Partial<LoteComparavel> = {}): LoteComparavel {
  return {
    id: 'lote-1',
    codigo: 'SB-0001',
    modelo_perfil_id: PERFIL,
    acabamento_id: BRANCO,
    comprimento_mm: 6000,
    quantidade: 1,
    quantidade_reservada: 0,
    status: 'disponivel',
    criado_em: '2026-08-01T10:00:00Z',
    ...ajustes,
  }
}

describe('lote equivalente ao que está sendo cadastrado', () => {
  it('encontra pelo trio perfil, acabamento e comprimento', () => {
    const existente = lote({ id: 'a', codigo: 'SB-AAAA' })

    expect(
      loteEquivalente([existente], {
        modelo_perfil_id: PERFIL,
        acabamento_id: BRANCO,
        comprimento_mm: 6000,
      })?.codigo,
    ).toBe('SB-AAAA')
  })

  it('não confunde acabamentos diferentes', () => {
    // Ninguém entrega uma janela metade branca: peças de acabamentos
    // diferentes não são intercambiáveis.
    expect(
      loteEquivalente([lote({ acabamento_id: PRETO })], {
        modelo_perfil_id: PERFIL,
        acabamento_id: BRANCO,
        comprimento_mm: 6000,
      }),
    ).toBeNull()
  })

  it('não confunde comprimentos parecidos', () => {
    // 5.980 não é 6.000. Quem contar com os 20 mm a mais descobre no meio
    // do corte, que é o pior momento.
    expect(
      loteEquivalente([lote({ comprimento_mm: 5980 })], {
        modelo_perfil_id: PERFIL,
        acabamento_id: BRANCO,
        comprimento_mm: 6000,
      }),
    ).toBeNull()
  })

  it('ignora lote que não está disponível', () => {
    expect(
      loteEquivalente([lote({ status: 'consumida' })], {
        modelo_perfil_id: PERFIL,
        acabamento_id: BRANCO,
        comprimento_mm: 6000,
      }),
    ).toBeNull()
  })

  it('havendo vários, escolhe o mais antigo', () => {
    // O antigo é o que já está etiquetado na prateleira e conhecido pela
    // equipe; somar ao recém-criado espalharia o material.
    const antigo = lote({
      id: 'a',
      codigo: 'SB-ANTIGO',
      criado_em: '2026-01-05T08:00:00Z',
    })
    const novo = lote({
      id: 'b',
      codigo: 'SB-NOVO',
      criado_em: '2026-08-10T08:00:00Z',
    })

    expect(
      loteEquivalente([novo, antigo], {
        modelo_perfil_id: PERFIL,
        acabamento_id: BRANCO,
        comprimento_mm: 6000,
      })?.codigo,
    ).toBe('SB-ANTIGO')
  })

  it('devolve nulo quando o estoque está vazio', () => {
    expect(
      loteEquivalente([], {
        modelo_perfil_id: PERFIL,
        acabamento_id: BRANCO,
        comprimento_mm: 6000,
      }),
    ).toBeNull()
  })
})

describe('duplicidades já existentes no estoque', () => {
  it('agrupa lotes iguais', () => {
    const grupos = duplicadosNoEstoque([
      lote({ id: 'a', quantidade: 51 }),
      lote({ id: 'b', quantidade: 8 }),
    ])

    expect(grupos).toHaveLength(1)
    expect(grupos[0]?.pecas).toBe(59)
  })

  it('não considera lote sozinho uma duplicidade', () => {
    expect(duplicadosNoEstoque([lote()])).toEqual([])
  })

  it('não junta o que é legitimamente diferente', () => {
    // O caso real do depósito: mesmo perfil, comprimentos diferentes. São
    // dois lotes porque 5 m não substitui 6 m.
    const grupos = duplicadosNoEstoque([
      lote({ id: 'a', comprimento_mm: 6000 }),
      lote({ id: 'b', comprimento_mm: 5000 }),
    ])

    expect(grupos).toEqual([])
  })

  it('põe o mais antigo em primeiro dentro do grupo', () => {
    const grupos = duplicadosNoEstoque([
      lote({ id: 'b', codigo: 'SB-NOVO', criado_em: '2026-08-10T00:00:00Z' }),
      lote({ id: 'a', codigo: 'SB-ANTIGO', criado_em: '2026-02-10T00:00:00Z' }),
    ])

    expect(grupos[0]?.lotes[0]?.codigo).toBe('SB-ANTIGO')
  })

  it('ordena os grupos pelo tamanho', () => {
    const grupos = duplicadosNoEstoque([
      lote({ id: 'a', comprimento_mm: 3000, quantidade: 1 }),
      lote({ id: 'b', comprimento_mm: 3000, quantidade: 1 }),
      lote({ id: 'c', comprimento_mm: 6000, quantidade: 40 }),
      lote({ id: 'd', comprimento_mm: 6000, quantidade: 40 }),
    ])

    expect(grupos[0]?.pecas).toBe(80)
  })

  it('ignora os não disponíveis', () => {
    const grupos = duplicadosNoEstoque([
      lote({ id: 'a' }),
      lote({ id: 'b', status: 'consumida' }),
    ])

    expect(grupos).toEqual([])
  })
})

describe('pode ser juntado', () => {
  it('aceita lote livre', () => {
    expect(podeSerJuntado(lote())).toBe(true)
  })

  it('recusa lote com peça reservada', () => {
    // A reserva aponta para o lote; mover as peças deixaria a reserva
    // apontando para material que não está mais ali.
    expect(podeSerJuntado(lote({ quantidade_reservada: 1 }))).toBe(false)
  })
})
