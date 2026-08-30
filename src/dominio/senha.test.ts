import { describe, it, expect } from 'vitest'
import { erroSenha, apenasDigitosSenha } from './senha'

describe('validar senha (só números, 6 a 8 dígitos)', () => {
  it('aceita senha numérica dentro do tamanho', () => {
    expect(erroSenha('123456')).toBeNull()
    expect(erroSenha('12345678')).toBeNull()
  })

  it('rejeita senha com letra ou símbolo', () => {
    expect(erroSenha('123abc')).toMatch(/só pode ter números/i)
    expect(erroSenha('12345!')).toMatch(/só pode ter números/i)
  })

  it('rejeita curta demais', () => {
    expect(erroSenha('12345')).toMatch(/entre 6 e 8/i)
  })

  it('rejeita longa demais', () => {
    expect(erroSenha('123456789')).toMatch(/entre 6 e 8/i)
  })

  it('vazia conta como curta demais, não como "sem letra"', () => {
    // Uma string vazia passa no teste de "só dígitos" (regex com `*`), então
    // sem essa ordem ela cairia certo no erro de tamanho — é o que se espera
    // ao abrir o campo pela primeira vez, antes de digitar qualquer coisa.
    expect(erroSenha('')).toMatch(/entre 6 e 8/i)
  })
})

describe('filtrar dígitos da senha ao digitar', () => {
  it('remove tudo que não é dígito', () => {
    expect(apenasDigitosSenha('12a3b4!')).toBe('1234')
  })

  it('trava no tamanho máximo', () => {
    expect(apenasDigitosSenha('123456789')).toBe('12345678')
  })

  it('mantém uma senha já válida como está', () => {
    expect(apenasDigitosSenha('123456')).toBe('123456')
  })
})
