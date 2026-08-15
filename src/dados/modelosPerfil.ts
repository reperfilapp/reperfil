import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { chaves } from '@/lib/consultas'
import type { ModeloPerfil } from '@/tipos/banco'

export interface DadosModeloPerfil {
  codigo: string
  descricao: string
  fabricante: string | null
  linha: string | null
  categoria: string | null
  comprimento_barra_mm: number
  peso_por_metro_g: number | null
  preco_por_metro_centavos: number | null
  codigo_barras: string | null
  observacoes: string | null
}

export function useModelosPerfil(incluirInativos = false) {
  return useQuery({
    queryKey: [...chaves.modelosPerfil, { incluirInativos }],
    queryFn: async (): Promise<ModeloPerfil[]> => {
      let consulta = supabase.from('modelos_perfil').select('*').order('codigo')

      if (!incluirInativos) {
        consulta = consulta.eq('ativo', true)
      }

      const { data, error } = await consulta

      if (error) throw new Error(error.message)

      return data as ModeloPerfil[]
    },
  })
}

/**
 * Filtra modelos por código ou descrição, sem ir ao servidor.
 *
 * O catálogo de perfis de uma serralheria tem dezenas a poucas centenas de
 * itens, então cabe inteiro na memória. Filtrar localmente responde
 * instantaneamente enquanto a pessoa digita — importante no depósito, onde a
 * rede móvel costuma ser ruim.
 *
 * Se um dia um catálogo passar de alguns milhares, isto vira busca no banco
 * usando o índice `idx_modelos_perfil_busca`, que já existe.
 */
export function filtrarModelos(
  modelos: readonly ModeloPerfil[],
  termo: string,
): ModeloPerfil[] {
  const busca = termo.trim().toLowerCase()

  if (busca === '') return [...modelos]

  return modelos.filter(
    (modelo) =>
      modelo.codigo.toLowerCase().includes(busca) ||
      modelo.descricao.toLowerCase().includes(busca) ||
      (modelo.linha?.toLowerCase().includes(busca) ?? false),
  )
}

export function useCriarModeloPerfil() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async (dados: DadosModeloPerfil): Promise<ModeloPerfil> => {
      const { data, error } = await supabase
        .from('modelos_perfil')
        .insert(dados)
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          throw new Error(
            `Já existe um perfil com o código ${dados.codigo}. O código interno precisa ser único.`,
          )
        }
        throw new Error(error.message)
      }

      return data as ModeloPerfil
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.modelosPerfil })
    },
  })
}

export function useEditarModeloPerfil() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      dados,
    }: {
      id: string
      dados: Partial<DadosModeloPerfil>
    }): Promise<ModeloPerfil> => {
      const { data, error } = await supabase
        .from('modelos_perfil')
        .update(dados)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          throw new Error('Já existe um perfil com este código.')
        }
        throw new Error(error.message)
      }

      return data as ModeloPerfil
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.modelosPerfil })
    },
  })
}

export function useDesativarModeloPerfil() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('modelos_perfil')
        .update({ ativo })
        .eq('id', id)

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.modelosPerfil })
    },
  })
}
