import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { chaves } from '@/lib/consultas'
import type { EstadoConservacao, LoteAcessorio } from '@/tipos/banco'

/** Acessório com os cadastros relacionados já carregados, para a lista. */
export interface AcessorioDetalhado extends LoteAcessorio {
  modelo: {
    codigo: string
    descricao: string
    categoria: string | null
    unidade_medida: string
  } | null
  acabamento: { codigo: string; nome: string; cor_hex: string | null } | null
  localizacao: { codigo: string } | null
}

export interface DadosNovoLoteAcessorio {
  modelo_acessorio_id: string
  quantidade: number
  acabamento_id: string | null
  localizacao_id: string | null
  estado: EstadoConservacao
  observacoes: string | null
  foto_url: string | null
}

export function useLotesAcessorio() {
  return useQuery({
    queryKey: chaves.lotesAcessorio,
    queryFn: async (): Promise<AcessorioDetalhado[]> => {
      const { data, error } = await supabase
        .from('lotes_acessorio')
        .select(
          `*,
           modelo:modelos_acessorio (codigo, descricao, categoria, unidade_medida),
           acabamento:acabamentos (codigo, nome, cor_hex),
           localizacao:localizacoes (codigo)`,
        )
        .order('criado_em', { ascending: false })

      if (error) throw new Error(error.message)

      return data as unknown as AcessorioDetalhado[]
    },
  })
}

export function useLoteAcessorio(id: string | null) {
  return useQuery({
    queryKey: [...chaves.lotesAcessorio, 'um', id],
    enabled: id !== null,
    queryFn: async (): Promise<AcessorioDetalhado | null> => {
      const { data, error } = await supabase
        .from('lotes_acessorio')
        .select(
          `*,
           modelo:modelos_acessorio (codigo, descricao, categoria, unidade_medida),
           acabamento:acabamentos (codigo, nome, cor_hex),
           localizacao:localizacoes (codigo)`,
        )
        .eq('id', id)
        .maybeSingle()

      if (error) throw new Error(error.message)

      return data as unknown as AcessorioDetalhado | null
    },
  })
}

/**
 * Cadastra estoque de acessório pela função transacional do banco — mesma
 * razão de `cadastrar_sobra`: gera o código, confere que o acessório é da
 * organização e grava a entrada no histórico numa transação só.
 */
export function useCadastrarLoteAcessorio() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async (
      dados: DadosNovoLoteAcessorio,
    ): Promise<LoteAcessorio> => {
      const { data, error } = await supabase.rpc('cadastrar_lote_acessorio', {
        p_modelo_acessorio_id: dados.modelo_acessorio_id,
        p_quantidade: dados.quantidade,
        p_acabamento_id: dados.acabamento_id,
        p_localizacao_id: dados.localizacao_id,
        p_estado: dados.estado,
        p_foto_url: dados.foto_url,
        p_observacoes: dados.observacoes,
      })

      if (error) throw new Error(error.message)

      return data as LoteAcessorio
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.lotesAcessorio })
    },
  })
}

export interface MovimentacaoAcessorioDetalhada {
  id: string
  tipo: string
  quantidade: number
  justificativa: string | null
  criado_em: string
  /** `email` só serve para extrair o código de conta excluída — ver `dominio/contaExcluida.ts`. */
  usuario: { nome: string; email: string } | null
}

export function useHistoricoLoteAcessorio(loteId: string | null) {
  return useQuery({
    queryKey: [...chaves.lotesAcessorio, 'historico', loteId],
    enabled: loteId !== null,
    queryFn: async (): Promise<MovimentacaoAcessorioDetalhada[]> => {
      const { data, error } = await supabase
        .from('movimentacoes_acessorio')
        .select(
          `id, tipo, quantidade, justificativa, criado_em,
           usuario:perfis_usuario (nome, email)`,
        )
        .eq('lote_id', loteId)
        .order('criado_em', { ascending: false })

      if (error) throw new Error(error.message)

      return data as unknown as MovimentacaoAcessorioDetalhada[]
    },
  })
}

/**
 * Baixa direta — sem reserva. Acessório não tem corte para calcular, então o
 * fluxo de reservar → retirar → confirmar das sobras seria complexidade sem
 * necessidade: digita quanto usou, confirma.
 */
export function useUsarAcessorio() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({
      loteId,
      quantidade,
      justificativa,
    }: {
      loteId: string
      quantidade: number
      justificativa?: string | null
    }): Promise<LoteAcessorio> => {
      const { data, error } = await supabase.rpc('usar_acessorio', {
        p_lote_id: loteId,
        p_quantidade: quantidade,
        p_justificativa: justificativa ?? null,
      })

      if (error) throw new Error(error.message)

      return data as LoteAcessorio
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.lotesAcessorio })
    },
  })
}

/** Corrige a quantidade cadastrada — erro de digitação, não consumo. */
export function useAjustarQuantidadeAcessorio() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({
      loteId,
      novaQuantidade,
      justificativa,
    }: {
      loteId: string
      novaQuantidade: number
      justificativa: string
    }): Promise<LoteAcessorio> => {
      const { data, error } = await supabase.rpc(
        'ajustar_quantidade_acessorio',
        {
          p_lote_id: loteId,
          p_nova_quantidade: novaQuantidade,
          p_justificativa: justificativa,
        },
      )

      if (error) throw new Error(error.message)

      return data as LoteAcessorio
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.lotesAcessorio })
    },
  })
}
