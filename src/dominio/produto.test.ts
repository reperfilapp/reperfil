import { describe, it, expect } from 'vitest'
import { formatarMedidaProduto, nomeDoArquivo } from './produto'

describe('medida do produto para leitura', () => {
  it('mostra em metros, com vírgula — como se fala no balcão', () => {
    expect(
      formatarMedidaProduto({ largura_mm: 1500, altura_mm: 1200 }),
    ).toBe('1,50 × 1,20 m')
  })

  it('mantém duas casas mesmo em medida redonda', () => {
    // "2 × 1 m" pareceria estimativa; "2,00 × 1,00 m" é medida.
    expect(formatarMedidaProduto({ largura_mm: 2000, altura_mm: 1000 })).toBe(
      '2,00 × 1,00 m',
    )
  })

  it('devolve nulo com meia medida — não ocupa linha para não informar', () => {
    expect(formatarMedidaProduto({ largura_mm: 1500, altura_mm: null })).toBe(
      null,
    )
    expect(formatarMedidaProduto({ largura_mm: null, altura_mm: 1200 })).toBe(
      null,
    )
  })

  it('trata campo AUSENTE igual a nulo — produto sem medida cadastrada', () => {
    // `== null` na implementação cobre os dois de uma vez, e é o que
    // permite a coluna chegar ausente num banco sem a migração aplicada.
    expect(formatarMedidaProduto({})).toBe(null)
    expect(formatarMedidaProduto({ largura_mm: 1500 })).toBe(null)
  })
})

describe('nome do arquivo PDF', () => {
  it('começa pelo app e termina na data que ordena sozinha', () => {
    const nome = nomeDoArquivo({ codigo: 'JAN-INT-1500', nome: 'Janela' })

    expect(nome).toMatch(/^RePerfil - JAN-INT-1500 - Janela - \d{4}-\d{2}-\d{2}$/)
  })

  it('tira acento — o nome atravessa Android, Windows e e-mail', () => {
    expect(
      nomeDoArquivo({ codigo: 'PRT-01', nome: 'Porta pivotante à francesa' }),
    ).toContain('Porta pivotante a francesa')
  })

  it('troca o que o Windows proíbe em nome de arquivo', () => {
    // Barra e dois-pontos derrubariam o download inteiro.
    const nome = nomeDoArquivo({ codigo: 'GOLD/32', nome: 'Kit: pia' })

    expect(nome).toContain('GOLD 32')
    expect(nome).toContain('Kit pia')
    expect(nome).not.toContain('/')
    expect(nome).not.toContain(':')
  })

  it('não deixa espaço dobrado nem sobrando nas pontas', () => {
    const nome = nomeDoArquivo({ codigo: '  AP-103  ', nome: 'Perfil   guia ' })

    expect(nome).toContain('- AP-103 - Perfil guia -')
  })

  it('preserva hífen e sublinhado, que são válidos e usados nos códigos', () => {
    expect(nomeDoArquivo({ codigo: 'JAN_INT-2F', nome: 'x' })).toContain(
      'JAN_INT-2F',
    )
  })
})
