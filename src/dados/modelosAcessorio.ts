import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { chaves } from '@/lib/consultas'
import type { ModeloAcessorio } from '@/tipos/banco'

/**
 * Catálogo de acessórios — paralelo a `modelosPerfil.ts`, sem os campos de
 * comprimento e seção que só fazem sentido para perfil de alumínio. Ver a
 * migração `20260824200000_estoque_acessorios.sql` para o porquê de existir
 * uma tabela própria em vez de reaproveitar `modelos_perfil`.
 */
export interface DadosModeloAcessorio {
  codigo: string
  descricao: string
  fabricante: string | null
  categoria: string | null
  unidade_medida: string
  codigo_barras: string | null
  preco_unitario_centavos: number | null
  imagem_url: string | null
  observacoes: string | null
}

export const VAZIO_ACESSORIO: DadosModeloAcessorio = {
  codigo: '',
  descricao: '',
  fabricante: null,
  categoria: null,
  unidade_medida: 'peça',
  codigo_barras: null,
  preco_unitario_centavos: null,
  imagem_url: null,
  observacoes: null,
}

export function useModelosAcessorio(incluirInativos = false) {
  return useQuery({
    queryKey: [...chaves.modelosAcessorio, { incluirInativos }],
    queryFn: async (): Promise<ModeloAcessorio[]> => {
      let consulta = supabase
        .from('modelos_acessorio')
        .select('*')
        .order('codigo')

      if (!incluirInativos) {
        consulta = consulta.eq('ativo', true)
      }

      const { data, error } = await consulta

      if (error) throw new Error(error.message)

      return data as ModeloAcessorio[]
    },
  })
}

/**
 * As categorias já usadas, para agrupar a lista — mesmo papel que "linha"
 * cumpre para perfis. Acessório não tem "linha de janela": tem categoria
 * ("dobradiça", "roldana", "puxador"...).
 */
export const SEM_CATEGORIA = 'Sem categoria'

export function agruparPorCategoria(
  modelos: readonly ModeloAcessorio[],
): { categoria: string; modelos: ModeloAcessorio[] }[] {
  const grupos = new Map<string, ModeloAcessorio[]>()

  for (const modelo of modelos) {
    const chave = modelo.categoria?.trim() || SEM_CATEGORIA
    const lista = grupos.get(chave) ?? []

    lista.push(modelo)
    grupos.set(chave, lista)
  }

  return [...grupos.entries()]
    .map(([categoria, lista]) => ({ categoria, modelos: lista }))
    .sort((a, b) => {
      if (a.categoria === SEM_CATEGORIA) return 1
      if (b.categoria === SEM_CATEGORIA) return -1
      return a.categoria.localeCompare(b.categoria, 'pt-BR')
    })
}

export function useCriarModeloAcessorio() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async (
      dados: DadosModeloAcessorio,
    ): Promise<ModeloAcessorio> => {
      const { data, error } = await supabase
        .from('modelos_acessorio')
        .insert(dados)
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          throw new Error(
            `Já existe um acessório com o código ${dados.codigo}.`,
          )
        }
        throw new Error(error.message)
      }

      return data as ModeloAcessorio
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.modelosAcessorio })
    },
  })
}

export function useEditarModeloAcessorio() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      dados,
    }: {
      id: string
      dados: Partial<DadosModeloAcessorio>
    }): Promise<ModeloAcessorio> => {
      const { data, error } = await supabase
        .from('modelos_acessorio')
        .update(dados)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          throw new Error('Já existe um acessório com este código.')
        }
        throw new Error(error.message)
      }

      return data as ModeloAcessorio
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.modelosAcessorio })
    },
  })
}

export function useDesativarModeloAcessorio() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('modelos_acessorio')
        .update({ ativo })
        .eq('id', id)

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.modelosAcessorio })
    },
  })
}

/** Apaga o acessório de verdade — só funciona se nenhum lote apontar para ele. */
export function useExcluirModeloAcessorio() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('modelos_acessorio')
        .delete()
        .eq('id', id)

      if (error) {
        if (error.code === '23503') {
          throw new Error(
            'Este acessório está em uso no estoque e não pode ser apagado. Desative-o em vez disso.',
          )
        }
        throw new Error(error.message)
      }
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.modelosAcessorio })
    },
  })
}
