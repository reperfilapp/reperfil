import { describe, it, expect } from 'vitest'
import {
  pesquisarSobras,
  classificarAproveitamento,
  cortesQueUmLoteComporta,
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

/** Filtro padrão para 1 corte de 1000 mm. */
function filtro(parcial: Partial<Parameters<typeof pesquisarSobras>[1]> = {}) {
  return {
    corteMm: 1000,
    quantidadeCortes: 1,
    acabamentoId: BRANCO,
    ...parcial,
  }
}

// ─── cortesQueUmLoteComporta ────────────────────────────────────────────────

describe('cortesQueUmLoteComporta', () => {
  it('1 corte de 1 m numa peça de 6 m', () => {
    // 1 × 1000 = 1000 mm, sem serra (último corte sem sobra). Cabe.
    expect(cortesQueUmLoteComporta(6000, 1000, config)).toBeGreaterThanOrEqual(1)
  })

  it('5 cortes de 1 m numa peça de 6 m (o caso central do sistema)', () => {
    // 5 × 1000 + 4 × 3 (serras entre cortes) = 5012 mm < 6000 mm → 5 cabem.
    // 6 × 1000 + 5 × 3 = 6015 mm > 6000 mm → 6 não cabem.
    expect(cortesQueUmLoteComporta(6000, 1000, config)).toBe(5)
  })

  it('1 corte de 6 m numa peça de 6 m — consome tudo', () => {
    // 6000 mm exatos. Cabe 1, mas não 2.
    expect(cortesQueUmLoteComporta(6000, 6000, config)).toBe(1)
  })

  it('retorna 0 quando o corte é maior que a peça', () => {
    expect(cortesQueUmLoteComporta(1000, 2000, config)).toBe(0)
  })

  it('considera a espessura da serra entre os cortes', () => {
    // Peça de 2003 mm, corte de 1000 mm, serra de 3 mm.
    // 2 × 1000 + 1 × 3 = 2003 mm → 2 cabem.
    // 3 × 1000 + 2 × 3 = 3006 mm > 2003 → 3 não cabem.
    expect(cortesQueUmLoteComporta(2003, 1000, config)).toBe(2)
  })
})

// ─── acabamento — a regra de ouro ───────────────────────────────────────────

describe('acabamento — a regra de ouro', () => {
  it('não sugere peça de acabamento diferente', () => {
    const candidatas = [
      sobra({ id: 'branca', acabamentoId: BRANCO }),
      sobra({ id: 'preta', acabamentoId: PRETO }),
    ]

    const achados = pesquisarSobras(candidatas, filtro(), config)

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
      filtro({ acabamentosCompativeis: [PRETO] }),
      config,
    )

    expect(achados).toHaveLength(2)
  })
})

// ─── peças que não servem ───────────────────────────────────────────────────

describe('peças que não servem', () => {
  it('descarta peça menor que o corte', () => {
    const achados = pesquisarSobras(
      [sobra({ comprimentoMm: 800 })],
      filtro({ corteMm: 1000 }),
      config,
    )

    expect(achados).toHaveLength(0)
  })

  it('descarta peça que só não serve por causa da margem de limpeza', () => {
    // 1000 mm de peça, corte de 1000 mm: cabe exatamente, sem sobra.
    expect(
      pesquisarSobras([sobra({ comprimentoMm: 1000 })], filtro(), config),
    ).toHaveLength(1)

    // Com margem de limpeza de 20 mm, a mesma peça deixa de servir.
    const comMargem: ConfiguracaoCorte = { ...config, margemLimpezaMm: 20 }

    expect(
      pesquisarSobras([sobra({ comprimentoMm: 1000 })], filtro(), comMargem),
    ).toHaveLength(0)
  })

  it('descarta lote quando não há quantidade disponível suficiente', () => {
    // 5 cortes de 1 m numa peça de 6 m → 1 lote basta. Se só há 0 lotes livres, rejeita.
    const achados = pesquisarSobras(
      [sobra({ comprimentoMm: 6000, quantidadeDisponivel: 0 })],
      filtro({ corteMm: 1000, quantidadeCortes: 5 }),
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
      filtro({ localizacaoCodigo: 'B2-01' }),
      config,
    )

    expect(achados.map((r) => r.sobra.id)).toEqual(['b'])
  })
})

// ─── lógica de quantidade de cortes ─────────────────────────────────────────

describe('quantidade de cortes — o caso central', () => {
  it('5 cortes de 1 m cabem em 1 peça de 6 m → pecasNecessarias = 1', () => {
    const achados = pesquisarSobras(
      [sobra({ comprimentoMm: 6000, quantidadeDisponivel: 5 })],
      filtro({ corteMm: 1000, quantidadeCortes: 5 }),
      config,
    )

    expect(achados).toHaveLength(1)
    expect(achados[0]?.pecasNecessarias).toBe(1)
  })

  it('5 cortes de 1 m com peças de 3 m exigem 3 peças do lote → pecasNecessarias = 3', () => {
    // Uma peça de 3000 mm comporta 2 cortes (2×1000 + 1×3 = 2003 < 3000).
    // 5 cortes → ceil(5/2) = 3 peças necessárias.

    // Com só 2 peças disponíveis → sem resultado.
    const achadosFaltando = pesquisarSobras(
      [sobra({ comprimentoMm: 3000, quantidadeDisponivel: 2 })],
      filtro({ corteMm: 1000, quantidadeCortes: 5 }),
      config,
    )
    expect(achadosFaltando).toHaveLength(0)

    // Com 3 peças disponíveis → aparece.
    const achadosSuficiente = pesquisarSobras(
      [sobra({ comprimentoMm: 3000, quantidadeDisponivel: 3 })],
      filtro({ corteMm: 1000, quantidadeCortes: 5 }),
      config,
    )
    expect(achadosSuficiente).toHaveLength(1)
    expect(achadosSuficiente[0]?.pecasNecessarias).toBe(3)
  })

  it('1 corte de 1 m → pecasNecessarias = 1 (padrão)', () => {
    const achados = pesquisarSobras(
      [sobra({ comprimentoMm: 6000 })],
      filtro({ corteMm: 1000, quantidadeCortes: 1 }),
      config,
    )

    expect(achados).toHaveLength(1)
    expect(achados[0]?.pecasNecessarias).toBe(1)
  })
})

// ─── ordenação ──────────────────────────────────────────────────────────────

describe('ordenação', () => {
  it('mostra primeiro a peça que gera menor sobra', () => {
    const candidatas = [
      sobra({ id: 'grande', comprimentoMm: 6000 }),
      sobra({ id: 'justa', comprimentoMm: 1100 }),
      sobra({ id: 'media', comprimentoMm: 2500 }),
    ]

    const achados = pesquisarSobras(candidatas, filtro({ corteMm: 1000 }), config)

    // Gastar a ponta curta antes evita picar a barra de 6 m por causa de um
    // corte de 1 m.
    expect(achados.map((r) => r.sobra.id)).toEqual(['justa', 'media', 'grande'])
  })

  it('empatada a sobra, agrupa por localização', () => {
    const candidatas = [
      sobra({ id: 'b', localizacaoCodigo: 'B2-01' }),
      sobra({ id: 'a', localizacaoCodigo: 'A1-01' }),
    ]

    const achados = pesquisarSobras(candidatas, filtro(), config)

    expect(achados.map((r) => r.sobra.id)).toEqual(['a', 'b'])
  })

  it('empatados sobra e local, usa a peça mais antiga', () => {
    const candidatas = [
      sobra({ id: 'nova', criadoEm: '2026-06-01T00:00:00Z' }),
      sobra({ id: 'antiga', criadoEm: '2025-01-01T00:00:00Z' }),
    ]

    const achados = pesquisarSobras(candidatas, filtro(), config)

    expect(achados.map((r) => r.sobra.id)).toEqual(['antiga', 'nova'])
  })
})

// ─── cálculo do resto ────────────────────────────────────────────────────────

describe('cálculo do resto', () => {
  it('desconta a serra que separou o resto', () => {
    const achados = pesquisarSobras(
      [sobra({ comprimentoMm: 1800 })],
      filtro({ corteMm: 1200 }),
      config,
    )

    // 1800 − 1200 = 600 no papel, menos 3 mm de serra ao separar = 597.
    expect(achados[0]?.sobraResultanteMm).toBe(597)
  })

  it('avisa quando o corte vai gerar descarte', () => {
    const achados = pesquisarSobras(
      [sobra({ comprimentoMm: 1500 })],
      filtro({ corteMm: 1300 }),
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
      filtro({ corteMm: 1200 }),
      config,
    )

    const resultado = achados[0]

    expect(resultado?.sobraResultanteMm).toBe(0)
    expect(resultado && classificarAproveitamento(resultado)).toBe('exato')
  })

  it('reconhece o resto que volta ao estoque', () => {
    const achados = pesquisarSobras(
      [sobra({ comprimentoMm: 6000 })],
      filtro({ corteMm: 2000 }),
      config,
    )

    const resultado = achados[0]

    expect(resultado?.sobraResultanteMm).toBe(3997)
    expect(resultado && classificarAproveitamento(resultado)).toBe('ideal')
  })

  it('5 cortes de 1 m de um lote de 6 m — sobraResultante correta', () => {
    // 5×1000 + 4×3 (serras entre) = 5012 mm consumidos.
    // Restam 6000 − 5012 = 988 mm, menos 3 mm da serra que separa o resto = 985 mm.
    const achados = pesquisarSobras(
      [sobra({ comprimentoMm: 6000 })],
      filtro({ corteMm: 1000, quantidadeCortes: 5 }),
      config,
    )

    expect(achados[0]?.sobraResultanteMm).toBe(985)
    expect(achados[0]?.destinoResto).toBe('sobra')
  })
})
