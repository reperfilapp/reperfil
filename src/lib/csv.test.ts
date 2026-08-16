import { describe, it, expect } from 'vitest'
import { gerarCsv, nomeArquivoComData, type ColunaCsv } from './csv'

interface Peca {
  codigo: string
  comprimento: number
  ativo: boolean
  observacao: string | null
}

const colunas: ColunaCsv<Peca>[] = [
  { cabecalho: 'Código', valor: (p) => p.codigo },
  { cabecalho: 'Comprimento (m)', valor: (p) => p.comprimento },
  { cabecalho: 'Ativo', valor: (p) => p.ativo },
  { cabecalho: 'Observação', valor: (p) => p.observacao },
]

function linhas(csv: string): string[] {
  // Remove a marca de ordem de bytes antes de comparar.
  return csv.replace(/^﻿/, '').split('\r\n')
}

describe('gerarCsv', () => {
  it('usa ponto e vírgula, que é o que o Excel brasileiro espera', () => {
    const csv = gerarCsv(
      [{ codigo: 'SB-1', comprimento: 1.8, ativo: true, observacao: null }],
      colunas,
    )

    expect(linhas(csv)[0]).toBe('Código;Comprimento (m);Ativo;Observação')
  })

  it('começa com a marca de bytes, sem a qual o Excel estraga os acentos', () => {
    const csv = gerarCsv([], colunas)

    // Sem estes três bytes, "Alumínio" abre como "AlumÃ­nio".
    expect(csv.charCodeAt(0)).toBe(0xfeff)
  })

  it('escreve número decimal com vírgula, para o Excel somar', () => {
    const csv = gerarCsv(
      [{ codigo: 'SB-1', comprimento: 1.8, ativo: true, observacao: null }],
      colunas,
    )

    expect(linhas(csv)[1]).toContain(';1,8;')
  })

  it('traduz verdadeiro e falso', () => {
    const csv = gerarCsv(
      [
        { codigo: 'SB-1', comprimento: 1, ativo: true, observacao: null },
        { codigo: 'SB-2', comprimento: 1, ativo: false, observacao: null },
      ],
      colunas,
    )

    expect(linhas(csv)[1]).toContain(';sim;')
    expect(linhas(csv)[2]).toContain(';não;')
  })

  it('protege texto que contém o separador', () => {
    const csv = gerarCsv(
      [
        {
          codigo: 'SB-1',
          comprimento: 1,
          ativo: true,
          observacao: 'ponta torta; conferir',
        },
      ],
      colunas,
    )

    // Sem as aspas, esta observação viraria duas colunas e desalinharia tudo.
    expect(linhas(csv)[1]).toContain('"ponta torta; conferir"')
  })

  it('dobra as aspas dentro do texto', () => {
    const csv = gerarCsv(
      [
        {
          codigo: 'SB-1',
          comprimento: 1,
          ativo: true,
          observacao: 'peça "boa"',
        },
      ],
      colunas,
    )

    expect(linhas(csv)[1]).toContain('"peça ""boa"""')
  })

  it('protege texto com quebra de linha', () => {
    const csv = gerarCsv(
      [
        {
          codigo: 'SB-1',
          comprimento: 1,
          ativo: true,
          observacao: 'linha 1\nlinha 2',
        },
      ],
      colunas,
    )

    expect(csv).toContain('"linha 1\nlinha 2"')
  })

  it('deixa a célula vazia para nulo e indefinido', () => {
    const csv = gerarCsv(
      [{ codigo: 'SB-1', comprimento: 1, ativo: true, observacao: null }],
      colunas,
    )

    expect(linhas(csv)[1]).toBe('SB-1;1;sim;')
  })

  it('gera só o cabeçalho quando não há linhas', () => {
    expect(linhas(gerarCsv([], colunas))).toHaveLength(1)
  })
})

describe('nomeArquivoComData', () => {
  it('inclui a data para não sobrescrever a exportação anterior', () => {
    const nome = nomeArquivoComData('estoque', new Date('2026-08-15T10:00:00'))

    expect(nome).toBe('estoque-2026-08-15.csv')
  })

  it('preenche mês e dia com zero à esquerda', () => {
    const nome = nomeArquivoComData('estoque', new Date('2026-01-05T10:00:00'))

    expect(nome).toBe('estoque-2026-01-05.csv')
  })
})
