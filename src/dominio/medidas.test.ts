import { describe, it, expect } from 'vitest'
import {
  converterParaMilimetros,
  converterDeMilimetros,
  interpretarMedidaDigitada,
  validarComprimento,
  formatarComprimento,
} from './medidas'

describe('converterParaMilimetros', () => {
  it('converte metros para milímetros', () => {
    expect(converterParaMilimetros(6, 'm')).toBe(6000)
    expect(converterParaMilimetros(1.8, 'm')).toBe(1800)
    expect(converterParaMilimetros(0.5, 'm')).toBe(500)
  })

  it('converte centímetros para milímetros', () => {
    expect(converterParaMilimetros(180, 'cm')).toBe(1800)
    expect(converterParaMilimetros(12.5, 'cm')).toBe(125)
  })

  it('mantém milímetros inalterados', () => {
    expect(converterParaMilimetros(1800, 'mm')).toBe(1800)
  })

  it('não perde milímetro por erro de ponto flutuante', () => {
    // 1.15 * 1000 dá 1149.9999999999998 em JavaScript. Sem arredondar,
    // truncaria para 1149 e a peça sairia 1 mm menor.
    expect(converterParaMilimetros(1.15, 'm')).toBe(1150)
    expect(converterParaMilimetros(2.29, 'm')).toBe(2290)
    expect(converterParaMilimetros(1.005, 'm')).toBe(1005)
    expect(converterParaMilimetros(8.11, 'm')).toBe(8110)
  })

  it('arredonda fração de milímetro para o inteiro mais próximo', () => {
    expect(converterParaMilimetros(1800.4, 'mm')).toBe(1800)
    expect(converterParaMilimetros(1800.6, 'mm')).toBe(1801)
  })

  it('recusa valor não numérico', () => {
    expect(() => converterParaMilimetros(Number.NaN, 'm')).toThrow()
    expect(() =>
      converterParaMilimetros(Number.POSITIVE_INFINITY, 'm'),
    ).toThrow()
  })
})

describe('converterDeMilimetros', () => {
  it('faz o caminho de volta', () => {
    expect(converterDeMilimetros(6000, 'm')).toBe(6)
    expect(converterDeMilimetros(1800, 'cm')).toBe(180)
    expect(converterDeMilimetros(1800, 'mm')).toBe(1800)
  })
})

describe('interpretarMedidaDigitada', () => {
  it('aceita vírgula como separador decimal, que é como se digita no Brasil', () => {
    expect(interpretarMedidaDigitada('1,8', 'm')).toBe(1800)
    expect(interpretarMedidaDigitada('2,45', 'm')).toBe(2450)
  })

  it('aceita ponto como separador decimal', () => {
    expect(interpretarMedidaDigitada('1.8', 'm')).toBe(1800)
  })

  it('ignora espaços em volta', () => {
    expect(interpretarMedidaDigitada('  1800  ', 'mm')).toBe(1800)
  })

  it('devolve nulo para texto vazio ou inválido', () => {
    expect(interpretarMedidaDigitada('', 'mm')).toBeNull()
    expect(interpretarMedidaDigitada('   ', 'mm')).toBeNull()
    expect(interpretarMedidaDigitada('abc', 'mm')).toBeNull()
    expect(interpretarMedidaDigitada('12mm', 'mm')).toBeNull()
    expect(interpretarMedidaDigitada('1.2.3', 'm')).toBeNull()
  })

  it('interpreta valor negativo para que a validação o recuse depois', () => {
    expect(interpretarMedidaDigitada('-500', 'mm')).toBe(-500)
  })
})

describe('validarComprimento', () => {
  it('aceita comprimento normal', () => {
    expect(validarComprimento(1800).valido).toBe(true)
    expect(validarComprimento(6000).valido).toBe(true)
    expect(validarComprimento(1).valido).toBe(true)
  })

  it('recusa zero', () => {
    const resultado = validarComprimento(0)
    expect(resultado.valido).toBe(false)
    expect(resultado.valido === false && resultado.erro).toBe(
      'zero-ou-negativo',
    )
  })

  it('recusa valor negativo', () => {
    const resultado = validarComprimento(-500)
    expect(resultado.valido).toBe(false)
    expect(resultado.valido === false && resultado.erro).toBe(
      'zero-ou-negativo',
    )
  })

  it('recusa comprimento maior que a barra inteira', () => {
    // Uma sobra é o que restou de uma barra; não existe resto maior do que a
    // peça de onde ele veio.
    const resultado = validarComprimento(6001)

    expect(resultado.valido).toBe(false)
    expect(resultado.valido === false && resultado.erro).toBe('acima-do-limite')
  })

  it('aceita exatamente o comprimento da barra', () => {
    // Barra inteira ainda não cortada é estoque legítimo.
    expect(validarComprimento(6000).valido).toBe(true)
  })

  it('respeita a barra do perfil quando informada', () => {
    // Perfil com barra de 3 m: uma peça de 4 m não pode ter vindo dele.
    expect(validarComprimento(4000, 3000).valido).toBe(false)
    expect(validarComprimento(3000, 3000).valido).toBe(true)

    // E um perfil de barra maior aceita mais que o limite geral.
    expect(validarComprimento(7000, 8000).valido).toBe(true)
  })

  it('diz na mensagem qual é o limite', () => {
    const resultado = validarComprimento(6500, 6000)

    expect(resultado.valido === false && resultado.mensagem).toContain('6 m')
  })

  it('recusa comprimento fracionário', () => {
    const resultado = validarComprimento(1800.5)
    expect(resultado.valido).toBe(false)
    expect(resultado.valido === false && resultado.erro).toBe('nao-inteiro')
  })
})

describe('formatarComprimento', () => {
  it('usa metros quando o valor é redondo', () => {
    expect(formatarComprimento(6000)).toBe('6 m')
    expect(formatarComprimento(2000)).toBe('2 m')
  })

  it('usa metros com vírgula quando fecha em centímetro', () => {
    expect(formatarComprimento(1800)).toBe('1,8 m')
    expect(formatarComprimento(2450)).toBe('2,45 m')
  })

  it('usa milímetros abaixo de um metro', () => {
    expect(formatarComprimento(850)).toBe('850 mm')
    expect(formatarComprimento(120)).toBe('120 mm')
  })

  it('mantém milímetro quebrado em milímetros, para não confundir a vírgula', () => {
    // "1,803 m" seria lido como 1.803 mm por quem trabalha em milímetro,
    // e a diferença entre os dois é a peça inteira.
    expect(formatarComprimento(1803)).toBe('1.803 mm')
    expect(formatarComprimento(597)).toBe('597 mm')
    expect(formatarComprimento(3997)).toBe('3.997 mm')
  })

  it('separa milhar no padrão brasileiro', () => {
    expect(formatarComprimento(1234)).toBe('1.234 mm')
    expect(formatarComprimento(12345)).toBe('12.345 mm')
  })
})
