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
