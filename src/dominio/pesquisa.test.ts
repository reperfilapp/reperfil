import { describe, it, expect } from 'vitest'
import {
  pesquisarSobras,
  classificarAproveitamento,
  type CandidataSobra,
} from './pesquisa'
import { CONFIGURACAO_CORTE_PADRAO, type ConfiguracaoCorte } from './corte'

const config: ConfiguracaoCorte = {
  ...CONFIGURACAO_CORTE_PADRAO,
  espessuraSerraMm: 3,
  margemLimpezaMm: 0,
  comprimentoMinimoSobraMm: 300,
}

const BRANCO = 'acab-branco'
const PRETO = 'acab-preto'

function sobra(parcial: Partial<CandidataSobra> = {}): CandidataSobra {
  return {
    id: parcial.id ?? 'id-1',
    codigo: parcial.codigo ?? 'SB-0001',
    comprimentoMm: parcial.comprimentoMm ?? 2000,
    quantidadeDisponivel: parcial.quantidadeDisponivel ?? 1,
    acabamentoId: parcial.acabamentoId ?? BRANCO,
    localizacaoCodigo: parcial.localizacaoCodigo ?? 'A1-01',
    criadoEm: parcial.criadoEm ?? '2026-01-01T00:00:00Z',
  }
}

describe('acabamento — a regra de ouro', () => {
  it('não sugere peça de acabamento diferente', () => {
    const candidatas = [
      sobra({ id: 'branca', acabamentoId: BRANCO }),
      sobra({ id: 'preta', acabamentoId: PRETO }),
    ]

    const achados = pesquisarSobras(
      candidatas,
      { corteMm: 1000, acabamentoId: BRANCO },
      config,
    )

    expect(achados).toHaveLength(1)
    expect(achados[0]?.sobra.id).toBe('branca')
  })

  it('aceita acabamento diferente apenas com regra explícita', () => {
    const candidatas = [
      sobra({ id: 'branca', acabamentoId: BRANCO }),
      sobra({ id: 'preta', acabamentoId: PRETO }),
    ]

    const achados = pesquisarSobras(
      candidatas,
      {
        corteMm: 1000,
        acabamentoId: BRANCO,
        acabamentosCompativeis: [PRETO],
      },
      config,
    )

    expect(achados).toHaveLength(2)
  })
})

describe('peças que não servem', () => {
  it('descarta peça menor que o corte', () => {
    const achados = pesquisarSobras(
      [sobra({ comprimentoMm: 800 })],
      { corteMm: 1000, acabamentoId: BRANCO },
      config,
    )

    expect(achados).toHaveLength(0)
  })

  it('descarta peça que só não serve por causa da serra', () => {
    // 1000 mm de peça, corte de 1000 mm: cabe exatamente, sem sobra.
    expect(
      pesquisarSobras(
        [sobra({ comprimentoMm: 1000 })],
        { corteMm: 1000, acabamentoId: BRANCO },
        config,
      ),
    ).toHaveLength(1)

    // Com margem de limpeza de 20 mm, a mesma peça deixa de servir.
    const comMargem: ConfiguracaoCorte = { ...config, margemLimpezaMm: 20 }

    expect(
      pesquisarSobras(
        [sobra({ comprimentoMm: 1000 })],
        { corteMm: 1000, acabamentoId: BRANCO },
        comMargem,
      ),
    ).toHaveLength(0)
  })

  it('descarta lote sem quantidade suficiente', () => {
    const achados = pesquisarSobras(
      [sobra({ quantidadeDisponivel: 2 })],
      { corteMm: 1000, acabamentoId: BRANCO, quantidadeMinima: 3 },
      config,
    )

    expect(achados).toHaveLength(0)
  })

  it('respeita o filtro de localização', () => {
    const candidatas = [
      sobra({ id: 'a', localizacaoCodigo: 'A1-01' }),
      sobra({ id: 'b', localizacaoCodigo: 'B2-01' }),
    ]

    const achados = pesquisarSobras(
      candidatas,
      { corteMm: 1000, acabamentoId: BRANCO, localizacaoCodigo: 'B2-01' },
      config,
    )

    expect(achados.map((r) => r.sobra.id)).toEqual(['b'])
  })
})

describe('ordenação', () => {
  it('mostra primeiro a peça que gera menor sobra', () => {
    const candidatas = [
      sobra({ id: 'grande', comprimentoMm: 6000 }),
      sobra({ id: 'justa', comprimentoMm: 1100 }),
      sobra({ id: 'media', comprimentoMm: 2500 }),
    ]

    const achados = pesquisarSobras(
      candidatas,
      { corteMm: 1000, acabamentoId: BRANCO },
      config,
    )

    // Gastar a ponta curta antes evita picar a barra de 6 m por causa de um
    // corte de 1 m.
    expect(achados.map((r) => r.sobra.id)).toEqual(['justa', 'media', 'grande'])
  })

  it('empatada a sobra, agrupa por localização', () => {
    const candidatas = [
      sobra({ id: 'b', localizacaoCodigo: 'B2-01' }),
      sobra({ id: 'a', localizacaoCodigo: 'A1-01' }),
    ]

    const achados = pesquisarSobras(
      candidatas,
      { corteMm: 1000, acabamentoId: BRANCO },
      config,
    )

    expect(achados.map((r) => r.sobra.id)).toEqual(['a', 'b'])
  })

  it('empatados sobra e local, usa a peça mais antiga', () => {
    const candidatas = [
      sobra({ id: 'nova', criadoEm: '2026-06-01T00:00:00Z' }),
      sobra({ id: 'antiga', criadoEm: '2025-01-01T00:00:00Z' }),
    ]

    const achados = pesquisarSobras(
      candidatas,
      { corteMm: 1000, acabamentoId: BRANCO },
      config,
    )

    expect(achados.map((r) => r.sobra.id)).toEqual(['antiga', 'nova'])
  })
})

describe('cálculo do resto', () => {
  it('desconta a serra que separou o resto', () => {
    const achados = pesquisarSobras(
      [sobra({ comprimentoMm: 1800 })],
      { corteMm: 1200, acabamentoId: BRANCO },
      config,
    )

    // 1800 − 1200 = 600 no papel, menos 3 mm de serra ao separar = 597.
    expect(achados[0]?.sobraResultanteMm).toBe(597)
  })

  it('avisa quando o corte vai gerar descarte', () => {
    const achados = pesquisarSobras(
      [sobra({ comprimentoMm: 1500 })],
      { corteMm: 1300, acabamentoId: BRANCO },
      config,
    )

    const resultado = achados[0]

    expect(resultado?.sobraResultanteMm).toBe(197)
    expect(resultado && classificarAproveitamento(resultado)).toBe(
      'gera-descarte',
    )
  })

  it('reconhece o corte que consome a peça inteira', () => {
    const achados = pesquisarSobras(
      [sobra({ comprimentoMm: 1200 })],
      { corteMm: 1200, acabamentoId: BRANCO },
      config,
    )

    const resultado = achados[0]

    expect(resultado?.sobraResultanteMm).toBe(0)
    expect(resultado && classificarAproveitamento(resultado)).toBe('exato')
  })

  it('reconhece o resto que volta ao estoque', () => {
    const achados = pesquisarSobras(
      [sobra({ comprimentoMm: 6000 })],
      { corteMm: 2000, acabamentoId: BRANCO },
      config,
    )

    const resultado = achados[0]

    expect(resultado?.sobraResultanteMm).toBe(3997)
    expect(resultado && classificarAproveitamento(resultado)).toBe('ideal')
  })
})
