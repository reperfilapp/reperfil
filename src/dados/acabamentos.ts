import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { chaves } from '@/lib/consultas'
import type { Acabamento, TipoAcabamento } from '@/tipos/banco'

export interface DadosAcabamento {
  codigo: string
  nome: string
  tipo: TipoAcabamento
  codigo_ral: string | null
  descricao: string | null
  cor_hex: string | null
}

/**
 * Acabamentos da organização.
 *
 * Nenhuma consulta filtra por `organizacao_id`: o Row Level Security já faz
 * isso no banco. Filtrar aqui também daria falsa sensação de que a proteção
 * está no aplicativo — e convidaria alguém a "otimizar" removendo o filtro
 * de lá um dia.
 */
export function useAcabamentos(incluirInativos = false) {
  return useQuery({
    queryKey: [...chaves.acabamentos, { incluirInativos }],
    queryFn: async (): Promise<Acabamento[]> => {
      let consulta = supabase.from('acabamentos').select('*').order('nome')

      if (!incluirInativos) {
        consulta = consulta.eq('ativo', true)
      }

      const { data, error } = await consulta

      if (error) throw new Error(error.message)

      return data as Acabamento[]
    },
  })
}

export function useCriarAcabamento() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async (dados: DadosAcabamento): Promise<Acabamento> => {
      // `organizacao_id` e `criado_por` são preenchidos pelo banco, a partir
      // de quem está autenticado. O aplicativo não os informa — assim não
      // tem como informá-los errado.
      const { data, error } = await supabase
        .from('acabamentos')
        .insert(dados)
        .select()
        .single()

      if (error) {
        // 23505 é violação de unicidade — aqui, código repetido.
        if (error.code === '23505') {
          throw new Error(
            `Já existe um acabamento com o código ${dados.codigo}.`,
          )
        }
        throw new Error(error.message)
      }

      return data as Acabamento
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.acabamentos })
    },
  })
}

export function useEditarAcabamento() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      dados,
    }: {
      id: string
      dados: Partial<DadosAcabamento>
    }): Promise<Acabamento> => {
      const { data, error } = await supabase
        .from('acabamentos')
        .update(dados)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          throw new Error('Já existe um acabamento com este código.')
        }
        throw new Error(error.message)
      }

      return data as Acabamento
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.acabamentos })
    },
  })
}

/* ── Catálogo central de acabamentos ──────────────────────────────────────
 *
 * Mesmo padrão da liberação de acessório em `src/dados/modelosAcessorio.ts`
 * — ver `20260901100000_sincronizacao_central_acessorios_acabamentos.sql`
 * para as funções do banco. Mais simples que acessório: sem imagem, sem
 * tabela filha.
 */

export interface OrganizacaoLiberacaoAcabamento {
  organizacao_id: string
  nome_fantasia: string
  liberada: boolean
}

export function useOrganizacoesParaLiberacaoAcabamento(
  acabamentoId: string | null,
) {
  return useQuery({
    queryKey: ['organizacoes-liberacao-acabamento', acabamentoId],
    enabled: acabamentoId !== null,
    queryFn: async (): Promise<OrganizacaoLiberacaoAcabamento[]> => {
      const { data, error } = await supabase.rpc(
        'organizacoes_para_liberacao_acabamento',
        { p_acabamento_id: acabamentoId },
      )

      if (error) throw new Error(error.message)

      return data as OrganizacaoLiberacaoAcabamento[]
    },
  })
}

export function useDefinirLiberacaoAcabamento() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({
      acabamentoId,
      organizacaoId,
      liberada,
    }: {
      acabamentoId: string
      organizacaoId: string
      liberada: boolean
    }) => {
      const { error } = await supabase.rpc('definir_liberacao_acabamento', {
        p_acabamento_id: acabamentoId,
        p_organizacao_id: organizacaoId,
        p_liberada: liberada,
      })

      if (error) throw new Error(error.message)
    },
    onSuccess: (_dados, variaveis) => {
      void cliente.invalidateQueries({
        queryKey: ['organizacoes-liberacao-acabamento', variaveis.acabamentoId],
      })
      void cliente.invalidateQueries({ queryKey: ['acabamentos-organizacao'] })
    },
  })
}

export function useDefinirLiberacaoAcabamentoTodas() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({
      acabamentoId,
      liberada,
    }: {
      acabamentoId: string
      liberada: boolean
    }) => {
      const { error } = await supabase.rpc('definir_liberacao_acabamento_todas', {
        p_acabamento_id: acabamentoId,
        p_liberada: liberada,
      })

      if (error) throw new Error(error.message)
    },
    onSuccess: (_dados, variaveis) => {
      void cliente.invalidateQueries({
        queryKey: ['organizacoes-liberacao-acabamento', variaveis.acabamentoId],
      })
      void cliente.invalidateQueries({ queryKey: ['acabamentos-organizacao'] })
    },
  })
}

/** Um acabamento do central e se a empresa escolhida pode importá-lo. */
export interface AcabamentoParaOrganizacao {
  acabamento_id: string
  codigo: string
  nome: string
  liberada: boolean
}

export function useAcabamentosParaOrganizacao(organizacaoId: string | null) {
  return useQuery({
    queryKey: ['acabamentos-organizacao', organizacaoId],
    enabled: organizacaoId !== null,
    queryFn: async (): Promise<AcabamentoParaOrganizacao[]> => {
      const { data, error } = await supabase.rpc(
        'acabamentos_para_organizacao',
        { p_organizacao_id: organizacaoId },
      )

      if (error) throw new Error(error.message)

      return data as AcabamentoParaOrganizacao[]
    },
  })
}

export function useDefinirLiberacaoTodosAcabamentosOrganizacao() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({
      organizacaoId,
      liberada,
    }: {
      organizacaoId: string
      liberada: boolean
    }) => {
      const { error } = await supabase.rpc(
        'definir_liberacao_todos_acabamentos_organizacao',
        { p_organizacao_id: organizacaoId, p_liberada: liberada },
      )

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: ['acabamentos-organizacao'] })
      void cliente.invalidateQueries({
        queryKey: ['organizacoes-liberacao-acabamento'],
      })
    },
  })
}

/** Importa do catálogo central os acabamentos liberados para esta empresa. */
export interface ResultadoSincronizarAcabamentos {
  acabamentos_novos: number
  acabamentos_atualizados: number
}

export function useSincronizarAcabamentosCentral() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async (): Promise<ResultadoSincronizarAcabamentos> => {
      const { data, error } = await supabase.rpc('sincronizar_acabamentos_central')

      if (error) throw new Error(error.message)

      const linhas = (data ?? []) as ResultadoSincronizarAcabamentos[]

      return (
        linhas[0] ?? { acabamentos_novos: 0, acabamentos_atualizados: 0 }
      )
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.acabamentos })
    },
  })
}

/**
 * Desativa em vez de apagar.
 *
 * Um acabamento pode estar referenciado por sobras já consumidas e por
 * movimentações históricas. Apagar quebraria o histórico, que é imutável
 * por decisão de projeto.
 */
export function useDesativarAcabamento() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('acabamentos')
        .update({ ativo })
        .eq('id', id)

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.acabamentos })
    },
  })
}
