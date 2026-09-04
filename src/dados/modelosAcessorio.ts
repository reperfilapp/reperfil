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

/** Um acessório só, para a ficha de detalhe — sem o filtro de "ativo" da lista. */
export function useModeloAcessorio(id: string | null) {
  return useQuery({
    queryKey: [...chaves.modelosAcessorio, 'um', id],
    enabled: id !== null,
    queryFn: async (): Promise<ModeloAcessorio> => {
      const { data, error } = await supabase
        .from('modelos_acessorio')
        .select('*')
        .eq('id', id as string)
        .single()

      if (error) throw new Error(error.message)

      return data as ModeloAcessorio
    },
  })
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

/* ── Catálogo central de acessórios ───────────────────────────────────────
 *
 * Mesmo padrão de `useOrganizacoesParaLiberacaoProduto`/`useSincronizarProdutos`
 * em `src/dados/produtos.ts` — ver `20260901100000_sincronizacao_central_
 * acessorios_acabamentos.sql` para as funções do banco.
 */

export interface OrganizacaoLiberacaoAcessorio {
  organizacao_id: string
  nome_fantasia: string
  liberada: boolean
}

export function useOrganizacoesParaLiberacaoAcessorio(
  modeloAcessorioId: string | null,
) {
  return useQuery({
    queryKey: ['organizacoes-liberacao-acessorio', modeloAcessorioId],
    enabled: modeloAcessorioId !== null,
    queryFn: async (): Promise<OrganizacaoLiberacaoAcessorio[]> => {
      const { data, error } = await supabase.rpc(
        'organizacoes_para_liberacao_acessorio',
        { p_modelo_acessorio_id: modeloAcessorioId },
      )

      if (error) throw new Error(error.message)

      return data as OrganizacaoLiberacaoAcessorio[]
    },
  })
}

export function useDefinirLiberacaoAcessorio() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({
      modeloAcessorioId,
      organizacaoId,
      liberada,
    }: {
      modeloAcessorioId: string
      organizacaoId: string
      liberada: boolean
    }) => {
      const { error } = await supabase.rpc('definir_liberacao_acessorio', {
        p_modelo_acessorio_id: modeloAcessorioId,
        p_organizacao_id: organizacaoId,
        p_liberada: liberada,
      })

      if (error) throw new Error(error.message)
    },
    onSuccess: (_dados, variaveis) => {
      void cliente.invalidateQueries({
        queryKey: ['organizacoes-liberacao-acessorio', variaveis.modeloAcessorioId],
      })
      void cliente.invalidateQueries({ queryKey: ['acessorios-organizacao'] })
    },
  })
}

export function useDefinirLiberacaoAcessorioTodas() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({
      modeloAcessorioId,
      liberada,
    }: {
      modeloAcessorioId: string
      liberada: boolean
    }) => {
      const { error } = await supabase.rpc('definir_liberacao_acessorio_todas', {
        p_modelo_acessorio_id: modeloAcessorioId,
        p_liberada: liberada,
      })

      if (error) throw new Error(error.message)
    },
    onSuccess: (_dados, variaveis) => {
      void cliente.invalidateQueries({
        queryKey: ['organizacoes-liberacao-acessorio', variaveis.modeloAcessorioId],
      })
      void cliente.invalidateQueries({ queryKey: ['acessorios-organizacao'] })
    },
  })
}

/** Um acessório do central e se a empresa escolhida pode importá-lo. */
export interface AcessorioParaOrganizacao {
  modelo_acessorio_id: string
  codigo: string
  descricao: string
  liberada: boolean
}

export function useAcessoriosParaOrganizacao(organizacaoId: string | null) {
  return useQuery({
    queryKey: ['acessorios-organizacao', organizacaoId],
    enabled: organizacaoId !== null,
    queryFn: async (): Promise<AcessorioParaOrganizacao[]> => {
      const { data, error } = await supabase.rpc('acessorios_para_organizacao', {
        p_organizacao_id: organizacaoId,
      })

      if (error) throw new Error(error.message)

      return data as AcessorioParaOrganizacao[]
    },
  })
}

export function useDefinirLiberacaoTodosAcessoriosOrganizacao() {
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
        'definir_liberacao_todos_acessorios_organizacao',
        { p_organizacao_id: organizacaoId, p_liberada: liberada },
      )

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: ['acessorios-organizacao'] })
      void cliente.invalidateQueries({
        queryKey: ['organizacoes-liberacao-acessorio'],
      })
    },
  })
}

/** Importa do catálogo central os acessórios liberados para esta empresa. */
export interface ResultadoSincronizarAcessorios {
  acessorios_novos: number
  acessorios_atualizados: number
  imagens_novas: number
  codigos_novos: number
}

export function useSincronizarAcessoriosCentral() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async (): Promise<ResultadoSincronizarAcessorios> => {
      const { data, error } = await supabase.rpc('sincronizar_acessorios_central')

      if (error) throw new Error(error.message)

      const linhas = (data ?? []) as ResultadoSincronizarAcessorios[]

      return (
        linhas[0] ?? {
          acessorios_novos: 0,
          acessorios_atualizados: 0,
          imagens_novas: 0,
          codigos_novos: 0,
        }
      )
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.modelosAcessorio })
      void cliente.invalidateQueries({ queryKey: ['imagens-arquivo'] })
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
            'Este acessório está em uso (no estoque ou na lista técnica de algum produto) e não pode ser apagado. Desative-o em vez disso.',
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
