import { describe, it, expect } from 'vitest'
import { classeCardResumo, classeAtalho } from './telaInicial'

describe('cor do card de resumo', () => {
  it('usa o padrão quando não há cor salva', () => {
    expect(classeCardResumo(null)).toBe('bg-celula hover:bg-superficie-2')
    expect(classeCardResumo(undefined)).toBe('bg-celula hover:bg-superficie-2')
  })

  it('resolve uma cor válida', () => {
    expect(classeCardResumo('azul')).toBe('bg-acao-50 hover:bg-acao-100')
  })

  it('cai no padrão para um valor desconhecido, em vez de quebrar', () => {
    expect(classeCardResumo('cor-que-nao-existe')).toBe(
      'bg-celula hover:bg-superficie-2',
    )
  })
})

describe('cor do atalho', () => {
  it('usa o padrão (azul) quando não há cor salva', () => {
    expect(classeAtalho(null)).toBe('bg-acao-600 hover:bg-acao-700')
    expect(classeAtalho(undefined)).toBe('bg-acao-600 hover:bg-acao-700')
  })

  it('resolve uma cor válida', () => {
    expect(classeAtalho('verde')).toBe('bg-economia-700 hover:bg-economia-600')
  })

  it('cai no padrão para um valor desconhecido, em vez de quebrar', () => {
    expect(classeAtalho('vermelho')).toBe('bg-acao-600 hover:bg-acao-700')
  })
})
