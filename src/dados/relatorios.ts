import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { nomeParaHistorico } from '@/dominio/contaExcluida'
import type { TipoMovimentacao } from '@/tipos/banco'

/**
 * Consultas dos relatórios.
 *
 * A agregação acontece no aplicativo, não no banco, por uma razão de escala:
 * o estoque de uma serralheria tem centenas a poucos milhares de lotes, o que
 * cabe folgado na memória. Criar visões e funções de agregação no PostgreSQL
 * para esse volume seria complexidade sem retorno — e cada relatório novo
 * exigiria uma migration.
 *
 * Se um dia o volume crescer a ponto de incomodar, o caminho é mover as somas
 * para o banco. Até lá, isto é mais simples de mudar e de testar.
 */

export interface LinhaEstoque {
  modeloCodigo: string
  modeloDescricao: string
  modeloLinha: string | null
  acabamentoNome: string
  acabamentoCor: string | null
  localizacaoCodigo: string
  comprimentoMm: number
  quantidade: number
  quantidadeReservada: number
  status: string
  criadoEm: string
  diasParado: number
}

export function useRelatorioEstoque() {
  return useQuery({
    queryKey: ['relatorio', 'estoque'],
    queryFn: async (): Promise<LinhaEstoque[]> => {
      const { data, error } = await supabase
        .from('lotes_sobras')
        .select(
          `comprimento_mm, quantidade, quantidade_reservada, status, criado_em,
           modelo:modelos_perfil (codigo, descricao, linha),
           acabamento:acabamentos (nome, cor_hex),
           localizacao:localizacoes (codigo)`,
        )
        .order('criado_em', { ascending: false })

      if (error) throw new Error(error.message)

      const agora = Date.now()

      return (data as unknown as RegistroEstoque[]).map((linha) => ({
        modeloCodigo: linha.modelo?.codigo ?? '',
        modeloDescricao: linha.modelo?.descricao ?? '',
        modeloLinha: linha.modelo?.linha ?? null,
        acabamentoNome: linha.acabamento?.nome ?? '',
        acabamentoCor: linha.acabamento?.cor_hex ?? null,
        localizacaoCodigo: linha.localizacao?.codigo ?? 'sem local',
        comprimentoMm: linha.comprimento_mm,
        quantidade: linha.quantidade,
        quantidadeReservada: linha.quantidade_reservada,
        status: linha.status,
        criadoEm: linha.criado_em,
        diasParado: Math.floor(
          (agora - new Date(linha.criado_em).getTime()) / 86_400_000,
        ),
      }))
    },
  })
}

interface RegistroEstoque {
  comprimento_mm: number
  quantidade: number
  quantidade_reservada: number
  status: string
  criado_em: string
  modelo: { codigo: string; descricao: string; linha: string | null } | null
  acabamento: { nome: string; cor_hex: string | null } | null
  localizacao: { codigo: string } | null
}

export interface LinhaMovimentacao {
  data: string
  tipo: TipoMovimentacao
  loteCodigo: string
  modeloCodigo: string
  quantidade: number
  comprimentoMm: number | null
  justificativa: string | null
  usuarioNome: string
}

export function useRelatorioMovimentacoes(diasAtras: number) {
  return useQuery({
    queryKey: ['relatorio', 'movimentacoes', diasAtras],
    queryFn: async (): Promise<LinhaMovimentacao[]> => {
      const desde = new Date(Date.now() - diasAtras * 86_400_000).toISOString()

      const { data, error } = await supabase
        .from('movimentacoes_estoque')
        .select(
          `criado_em, tipo, quantidade, comprimento_mm, justificativa,
           lote:lotes_sobras (codigo, modelo:modelos_perfil (codigo)),
           usuario:perfis_usuario (nome, email)`,
        )
        .gte('criado_em', desde)
        .order('criado_em', { ascending: false })

      if (error) throw new Error(error.message)

      return (data as unknown as RegistroMovimentacao[]).map((linha) => ({
        data: linha.criado_em,
        tipo: linha.tipo,
        loteCodigo: linha.lote?.codigo ?? '',
        modeloCodigo: linha.lote?.modelo?.codigo ?? '',
        quantidade: linha.quantidade,
        comprimentoMm: linha.comprimento_mm,
        justificativa: linha.justificativa,
        usuarioNome: nomeParaHistorico(linha.usuario) ?? 'não identificado',
      }))
    },
  })
}

interface RegistroMovimentacao {
  criado_em: string
  tipo: TipoMovimentacao
  quantidade: number
  comprimento_mm: number | null
  justificativa: string | null
  lote: { codigo: string; modelo: { codigo: string } | null } | null
  usuario: { nome: string; email: string } | null
}

/** Agrupa somando quantidade e metragem. Usado pelos resumos da tela. */
export function agrupar<T>(
  linhas: readonly T[],
  chave: (linha: T) => string,
  quantidade: (linha: T) => number,
  milimetros: (linha: T) => number,
): { grupo: string; pecas: number; milimetros: number }[] {
  const mapa = new Map<string, { pecas: number; milimetros: number }>()

  for (const linha of linhas) {
    const nome = chave(linha)
    const atual = mapa.get(nome) ?? { pecas: 0, milimetros: 0 }

    atual.pecas += quantidade(linha)
    atual.milimetros += milimetros(linha)
    mapa.set(nome, atual)
  }

  return [...mapa.entries()]
    .map(([grupo, valores]) => ({ grupo, ...valores }))
    .sort((a, b) => b.milimetros - a.milimetros)
}
