import { describe, it, expect } from 'vitest'
import { perfilComMesmoCodigo, codigosParecidos } from './codigoPerfil'
import type { ModeloPerfil } from '@/tipos/banco'

function modelo(codigo: string, id = codigo): ModeloPerfil {
  return {
    id,
    organizacao_id: 'org',
    codigo,
    descricao: `Perfil ${codigo}`,
    fabricante: null,
    linha: null,
    categoria: null,
    aplicacao: null,
    comprimento_barra_mm: 6000,
    peso_por_metro_g: null,
    preco_por_metro_centavos: null,
    codigo_barras: null,
    observacoes: null,
    largura_secao_mm: null,
    altura_secao_mm: null,
    medida_3_secao_mm: null,
    medida_4_secao_mm: null,
    imagem_url: null,
    ativo: true,
    revisado: false,
    criado_em: '2026-01-01T00:00:00Z',
  }
}

const CATALOGO = [
  modelo('MN-001'),
  modelo('MN-002'),
  modelo('MN-039'),
  modelo('SU-079'),
]

describe('código já usado', () => {
  it('encontra o perfil que já tem o código', () => {
    expect(perfilComMesmoCodigo(CATALOGO, 'MN-002')?.id).toBe('MN-002')
  })

  it('ignora maiúsculas e minúsculas', () => {
    // O banco aceitaria "mn-003" e "MN-003" como dois perfis. Para quem usa
    // são o mesmo, e o estoque acabaria dividido entre dois cadastros que
    // ninguém percebe serem iguais.
    expect(perfilComMesmoCodigo(CATALOGO, 'mn-002')?.id).toBe('MN-002')
  })

  it('ignora espaços nas pontas', () => {
    expect(perfilComMesmoCodigo(CATALOGO, ' MN-002 ')?.id).toBe('MN-002')
  })

  it('devolve nulo para código livre', () => {
    expect(perfilComMesmoCodigo(CATALOGO, 'MN-003')).toBeNull()
  })

  it('não reclama de campo vazio', () => {
    expect(perfilComMesmoCodigo(CATALOGO, '')).toBeNull()
    expect(perfilComMesmoCodigo(CATALOGO, '   ')).toBeNull()
  })

  it('não acusa o próprio perfil em edição', () => {
    // Corrigir a descrição sem mexer no código encontraria a si mesmo.
    expect(perfilComMesmoCodigo(CATALOGO, 'MN-002', 'MN-002')).toBeNull()
  })
})

describe('códigos parecidos', () => {
  it('lista os que começam com o que foi digitado', () => {
    expect(codigosParecidos(CATALOGO, 'MN').map((m) => m.codigo)).toEqual([
      'MN-001',
      'MN-002',
      'MN-039',
    ])
  })

  it('ignora maiúsculas', () => {
    expect(codigosParecidos(CATALOGO, 'mn-0').length).toBe(3)
  })

  it('não sugere nada com menos de dois caracteres', () => {
    // Uma letra traria meio catálogo: não é sugestão, é ruído.
    expect(codigosParecidos(CATALOGO, 'M')).toEqual([])
  })

  it('respeita o limite', () => {
    expect(codigosParecidos(CATALOGO, 'MN', undefined, 2)).toHaveLength(2)
  })

  it('deixa de fora o perfil em edição', () => {
    expect(
      codigosParecidos(CATALOGO, 'MN', 'MN-002').map((m) => m.codigo),
    ).toEqual(['MN-001', 'MN-039'])
  })

  it('devolve vazio quando nada casa', () => {
    expect(codigosParecidos(CATALOGO, 'ZZ')).toEqual([])
  })
})
