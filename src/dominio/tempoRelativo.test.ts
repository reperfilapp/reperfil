import { describe, it, expect } from 'vitest'
import { tempoRelativo } from './tempoRelativo'

const AGORA = new Date('2026-08-28T12:00:00')

/** Constrói um instante N milissegundos ANTES de `AGORA`. */
function atras(ms: number): Date {
  return new Date(AGORA.getTime() - ms)
}

const MINUTO = 60_000
const HORA = 60 * MINUTO
const DIA = 24 * HORA

describe('tempo relativo', () => {
  it('trata menos de um minuto como agora', () => {
    expect(tempoRelativo(atras(0), AGORA)).toBe('agora mesmo')
    expect(tempoRelativo(atras(59_000), AGORA)).toBe('agora mesmo')
  })

  it('não diz "no futuro" quando o relógio do aparelho está adiantado', () => {
    // Celular alguns segundos à frente do servidor põe o acesso no futuro.
    // "em 8 segundos" assustaria sem motivo — para quem lê, é agora.
    const futuro = new Date(AGORA.getTime() + 8_000)

    expect(tempoRelativo(futuro, AGORA)).toBe('agora mesmo')
  })

  it('conta minutos, com singular e plural', () => {
    expect(tempoRelativo(atras(MINUTO), AGORA)).toBe('há 1 minuto')
    expect(tempoRelativo(atras(26 * MINUTO), AGORA)).toBe('há 26 minutos')
  })

  it('vira horas ao completar 60 minutos', () => {
    expect(tempoRelativo(atras(HORA), AGORA)).toBe('há 1 hora')
    expect(tempoRelativo(atras(2 * HORA), AGORA)).toBe('há 2 horas')
    expect(tempoRelativo(atras(23 * HORA), AGORA)).toBe('há 23 horas')
  })

  it('diz "ontem" em vez de "há 1 dia"', () => {
    // É como se fala, e é mais curto na faixa estreita do painel.
    expect(tempoRelativo(atras(DIA), AGORA)).toBe('ontem')
    expect(tempoRelativo(atras(DIA + 5 * HORA), AGORA)).toBe('ontem')
  })

  it('conta dias até completar um mês', () => {
    expect(tempoRelativo(atras(2 * DIA), AGORA)).toBe('há 2 dias')
    expect(tempoRelativo(atras(29 * DIA), AGORA)).toBe('há 29 dias')
  })

  it('vira meses, com singular e plural', () => {
    expect(tempoRelativo(atras(30 * DIA), AGORA)).toBe('há 1 mês')
    expect(tempoRelativo(atras(90 * DIA), AGORA)).toBe('há 3 meses')
  })

  it('vira anos depois de doze meses', () => {
    expect(tempoRelativo(atras(400 * DIA), AGORA)).toBe('há 1 ano')
    expect(tempoRelativo(atras(800 * DIA), AGORA)).toBe('há 2 anos')
  })

  it('aceita texto ISO, que é como a data vem do banco', () => {
    expect(tempoRelativo('2026-08-28T11:34:00', AGORA)).toBe('há 26 minutos')
  })

  it('devolve vazio para data inválida, em vez de "NaN"', () => {
    expect(tempoRelativo('não é data', AGORA)).toBe('')
  })
})
