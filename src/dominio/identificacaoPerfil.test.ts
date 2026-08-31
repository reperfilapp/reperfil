import { describe, it, expect } from 'vitest'
import { combinarCandidatos } from './identificacaoPerfil'

describe('combinar candidatos da medida/peso com os da foto', () => {
  const universo = [
    { id: 'a', codigo: '25-016' },
    { id: 'b', codigo: '25-026' },
    { id: 'c', codigo: '25-540' },
  ]

  it('sem foto, mantém a ordem da medida/peso e parecença nula', () => {
    const daMedida = [
      { perfil: universo[0]!, nota: 'medida bate' },
      { perfil: universo[1]!, nota: '3% de diferença' },
    ]

    const resultado = combinarCandidatos(daMedida, [], universo)

    expect(resultado.map((c) => c.perfil.id)).toEqual(['a', 'b'])
    expect(resultado.every((c) => c.parecencaFoto === null)).toBe(true)
  })

  it('perfil achado nas duas buscas vem primeiro', () => {
    const daMedida = [
      { perfil: universo[0]!, nota: 'medida bate' },
      { perfil: universo[1]!, nota: '3% de diferença' },
    ]
    // A foto achou o 'b' (25-026), não o 'a' — mesmo a medida preferindo 'a'.
    const daFoto = [{ modeloPerfilId: 'b', parecenca: 91 }]

    const resultado = combinarCandidatos(daMedida, daFoto, universo)

    expect(resultado[0]?.perfil.id).toBe('b')
    expect(resultado[0]?.parecencaFoto).toBe(91)
    expect(resultado[1]?.perfil.id).toBe('a')
    expect(resultado[1]?.parecencaFoto).toBeNull()
  })

  it('perfil que só a foto achou entra no fim, com a nota da medida vazia', () => {
    const daMedida = [{ perfil: universo[0]!, nota: 'medida bate' }]
    const daFoto = [{ modeloPerfilId: 'c', parecenca: 80 }]

    const resultado = combinarCandidatos(daMedida, daFoto, universo)

    expect(resultado.map((c) => c.perfil.id)).toEqual(['a', 'c'])
    expect(resultado[1]?.nota).toBeNull()
    expect(resultado[1]?.parecencaFoto).toBe(80)
  })

  it('entre vários só-de-foto, ordena do mais parecido ao menos', () => {
    const daFoto = [
      { modeloPerfilId: 'a', parecenca: 60 },
      { modeloPerfilId: 'c', parecenca: 95 },
      { modeloPerfilId: 'b', parecenca: 75 },
    ]

    const resultado = combinarCandidatos([], daFoto, universo)

    expect(resultado.map((c) => c.perfil.id)).toEqual(['c', 'b', 'a'])
  })

  it('ignora candidato da foto que não está no universo (outra linha filtrada)', () => {
    const daFoto = [{ modeloPerfilId: 'fora-do-universo', parecenca: 99 }]

    const resultado = combinarCandidatos([], daFoto, universo)

    expect(resultado).toHaveLength(0)
  })

  it('sem nenhuma busca, devolve lista vazia', () => {
    expect(combinarCandidatos([], [], universo)).toEqual([])
  })
})
