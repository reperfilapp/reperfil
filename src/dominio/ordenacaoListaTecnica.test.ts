import { describe, it, expect } from 'vitest'
import { ordenarLista } from './ordenacaoListaTecnica'
import type { ItemListaTecnica, ModeloPerfil } from '@/tipos/banco'

function perfil(
  id: string,
  codigo: string,
  linha: string | null = null,
): ModeloPerfil {
  return {
    id,
    organizacao_id: 'org',
    codigo,
    descricao: `Perfil ${codigo}`,
    fabricante: null,
    linha,
    categoria: null,
    aplicacao: null,
    imagem_url: null,
    codigo_barras: null,
    comprimento_barra_mm: 6000,
    peso_por_metro_g: null,
    preco_por_metro_centavos: null,
    observacoes: null,
    ativo: true,
    revisado: false,
    criado_em: '2026-01-01T00:00:00Z',
  }
}

function item(
  id: string,
  modeloId: string,
  comprimento: number,
): ItemListaTecnica {
  return {
    id,
    organizacao_id: 'org',
    produto_id: 'prod',
    modelo_perfil_id: modeloId,
    comprimento_mm: comprimento,
    quantidade: 1,
    ordem: null,
    observacao: null,
    criado_em: '2026-01-01T00:00:00Z',
  }
}

const MODELOS = [
  perfil('m1', 'SU-079', 'Suprema'),
  perfil('m2', 'MN-001', 'Integrada'),
  perfil('m3', 'AT-001', null),
]

const CONTEXTO = {
  modelos: MODELOS,
  pecasPorPerfil: new Map([
    ['m1', 5],
    ['m3', 2],
  ]),
}

const ITENS = [
  item('i1', 'm1', 1000),
  item('i2', 'm2', 3000),
  item('i3', 'm3', 2000),
]

const codigos = (lista: ItemListaTecnica[]) =>
  lista.map((i) => MODELOS.find((m) => m.id === i.modelo_perfil_id)?.codigo)

describe('ordenar por código', () => {
  it('põe em ordem alfabética', () => {
    expect(codigos(ordenarLista(ITENS, 'codigo', CONTEXTO))).toEqual([
      'AT-001',
      'MN-001',
      'SU-079',
    ])
  })

  it('não altera a lista original', () => {
    const original = [...ITENS]

    ordenarLista(ITENS, 'codigo', CONTEXTO)

    expect(ITENS).toEqual(original)
  })
})

describe('ordenar por linha', () => {
  it('agrupa por linha e depois pelo código', () => {
    expect(codigos(ordenarLista(ITENS, 'linha', CONTEXTO))).toEqual([
      'MN-001', // Integrada
      'SU-079', // Suprema
      'AT-001', // sem linha, por último
    ])
  })

  it('manda quem não tem linha para o fim', () => {
    // Sem linha é o resto, não um grupo — e alfabeticamente "" viria antes
    // de tudo, empurrando o que interessa para baixo.
    const resultado = ordenarLista(ITENS, 'linha', CONTEXTO)

    expect(codigos(resultado).at(-1)).toBe('AT-001')
  })
})

describe('ordenar por comprimento', () => {
  it('põe o corte mais longo primeiro', () => {
    const resultado = ordenarLista(ITENS, 'comprimento', CONTEXTO)

    expect(resultado.map((i) => i.comprimento_mm)).toEqual([3000, 2000, 1000])
  })
})

describe('ordenar por estoque', () => {
  it('põe quem tem sobra antes de quem não tem', () => {
    const resultado = codigos(ordenarLista(ITENS, 'estoque', CONTEXTO))

    // m1 (SU-079) e m3 (AT-001) têm peças; m2 (MN-001) não tem.
    expect(resultado.slice(0, 2).sort()).toEqual(['AT-001', 'SU-079'])
    expect(resultado.at(-1)).toBe('MN-001')
  })

  it('não ordena pela quantidade dentro do grupo que tem', () => {
    // Cinco peças não são melhores que duas quando as duas bastam. Dentro
    // do grupo, manda o código — ordem previsível.
    const resultado = codigos(ordenarLista(ITENS, 'estoque', CONTEXTO))

    expect(resultado[0]).toBe('AT-001')
  })

  it('trata perfil ausente do mapa como sem estoque', () => {
    const resultado = ordenarLista(ITENS, 'estoque', {
      modelos: MODELOS,
      pecasPorPerfil: new Map(),
    })

    // Ninguém tem: sobra o desempate por código.
    expect(codigos(resultado)).toEqual(['AT-001', 'MN-001', 'SU-079'])
  })
})

describe('estabilidade', () => {
  it('aplicar duas vezes dá o mesmo resultado', () => {
    // Sem desempate firme, itens equivalentes trocariam de lugar a cada
    // aplicação e a lista pareceria embaralhar sozinha.
    const uma = ordenarLista(ITENS, 'estoque', CONTEXTO)
    const duas = ordenarLista(uma, 'estoque', CONTEXTO)

    expect(codigos(duas)).toEqual(codigos(uma))
  })

  it('desempata dois cortes do mesmo perfil pelo comprimento', () => {
    const dois = [item('a', 'm1', 500), item('b', 'm1', 1500)]

    expect(
      ordenarLista(dois, 'codigo', CONTEXTO).map((i) => i.comprimento_mm),
    ).toEqual([1500, 500])
  })
})
