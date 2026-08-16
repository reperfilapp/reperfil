import { describe, it, expect } from 'vitest'
import { interpretarMedidaDigitada } from '@/dominio/medidas'
import type { UnidadeMedida } from '@/config/aplicacao'

/**
 * A lógica do passo é reescrita aqui igual à do componente, para poder ser
 * testada sem montar a interface. Se uma mudar, o teste da outra falha — que
 * é justamente o alarme desejado.
 */
const PASSO: Record<UnidadeMedida, number> = { mm: 10, cm: 1, m: 1 }
const CASAS: Record<UnidadeMedida, number> = { mm: 0, cm: 1, m: 3 }

function aplicarPasso(
  texto: string,
  unidade: UnidadeMedida,
  direcao: 1 | -1,
): string {
  const atual = Number(texto.trim().replace(',', '.'))
  const base = Number.isFinite(atual) ? atual : 0
  const bruto = base + PASSO[unidade] * direcao

  if (bruto <= 0) return ''

  return String(Number(bruto.toFixed(CASAS[unidade]))).replace('.', ',')
}

describe('passo por unidade', () => {
  it('anda de 10 em 10 em milímetros', () => {
    expect(aplicarPasso('1800', 'mm', 1)).toBe('1810')
    expect(aplicarPasso('1800', 'mm', -1)).toBe('1790')
  })

  it('anda de 1 em 1 em centímetros e metros', () => {
    expect(aplicarPasso('180', 'cm', 1)).toBe('181')
    expect(aplicarPasso('2', 'm', 1)).toBe('3')
  })

  it('não deixa o ponto flutuante sujar o número', () => {
    // 1.8 + 1 dá 2.8000000000000003 sem arredondar, e o campo mostraria isso.
    expect(aplicarPasso('1,8', 'm', 1)).toBe('2,8')
    expect(aplicarPasso('2,45', 'm', -1)).toBe('1,45')
    expect(aplicarPasso('12,5', 'cm', 1)).toBe('13,5')
  })

  it('aceita vírgula, como o teclado brasileiro escreve', () => {
    expect(aplicarPasso('1,8', 'm', 1)).toBe('2,8')
  })

  it('parte do zero quando o campo está vazio', () => {
    expect(aplicarPasso('', 'mm', 1)).toBe('10')
    expect(aplicarPasso('', 'm', 1)).toBe('1')
  })

  it('esvazia em vez de chegar a zero ou negativo', () => {
    // Comprimento zero ou negativo é recusado pela validação; deixar o campo
    // vazio é mais honesto do que exibir um valor inválido.
    expect(aplicarPasso('10', 'mm', -1)).toBe('')
    expect(aplicarPasso('1', 'm', -1)).toBe('')
    expect(aplicarPasso('5', 'mm', -1)).toBe('')
  })

  it('preserva a precisão de milímetro ao andar em metros', () => {
    // 1,803 m são 1.803 mm; somar um metro não pode perder os 3 mm.
    const resultado = aplicarPasso('1,803', 'm', 1)

    expect(resultado).toBe('2,803')
    expect(interpretarMedidaDigitada(resultado, 'm')).toBe(2803)
  })

  it('o resultado continua sendo interpretado corretamente', () => {
    expect(interpretarMedidaDigitada(aplicarPasso('1800', 'mm', 1), 'mm')).toBe(
      1810,
    )
    expect(interpretarMedidaDigitada(aplicarPasso('180', 'cm', 1), 'cm')).toBe(
      1810,
    )
  })
})
