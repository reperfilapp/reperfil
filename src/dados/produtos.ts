import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { chaves } from '@/lib/consultas'
import type { Produto, ItemListaTecnica } from '@/tipos/banco'

export function useProdutos(incluirInativos = false) {
  return useQuery({
    queryKey: [...chaves.produtos, { incluirInativos }],
    queryFn: async (): Promise<Produto[]> => {
      let consulta = supabase.from('produtos').select('*').order('nome')

      if (!incluirInativos) consulta = consulta.eq('ativo', true)

      const { data, error } = await consulta

      if (error) {
        // Antes da migração a tabela nem existe. A tela mostra "nenhum
        // produto cadastrado", que é verdade, em vez de um erro de banco
        // sobre relação inexistente — que não diz nada a quem só queria ver
        // o que a empresa fabrica.
        if (error.code === '42P01') return []
        throw new Error(error.message)
      }

      return data as Produto[]
    },
  })
}

export function useProduto(id: string | null) {
  return useQuery({
    queryKey: [...chaves.produtos, 'um', id],
    enabled: id !== null,
    queryFn: async (): Promise<Produto | null> => {
      const { data, error } = await supabase
        .from('produtos')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error) {
        if (error.code === '42P01') return null
        throw new Error(error.message)
      }

      return data as Produto | null
    },
  })
}

async function buscarListaTecnica(
  produtoId: string | null,
): Promise<ItemListaTecnica[]> {
  /*
   * Pela ordem escolhida, e não pelo comprimento: a lista é lida na bancada
   * de cima para baixo, na sequência da montagem. `criado_em` desempata os
   * que ainda não têm ordem — banco sem a migração aplicada, ou linha
   * lançada por uma versão anterior do aplicativo.
   */
  let consulta = supabase
    .from('itens_lista_tecnica')
    .select('*')
    .order('ordem', { ascending: true, nullsFirst: false })
    .order('criado_em', { ascending: true })

  if (produtoId !== null) consulta = consulta.eq('produto_id', produtoId)

  const { data, error } = await consulta

  if (error) {
    // Antes da migração as tabelas nem existem. A tela avisa que o cadastro
    // está vazio, em vez de mostrar um erro de banco.
    if (error.code === '42P01') return []
    throw new Error(error.message)
  }

  return data as ItemListaTecnica[]
}

/**
 * A lista técnica de UM produto.
 *
 * Fica desabilitada enquanto o id não chegou. São dois hooks, e não um com
 * parâmetro opcional, porque `null` significaria duas coisas opostas: "ainda
 * não sei qual produto" e "todos os produtos" — e a tela de detalhe, com o
 * produto ainda carregando, acabaria mostrando a receita da empresa inteira.
 */
export function useListaTecnica(produtoId: string | null) {
  return useQuery({
    queryKey: [...chaves.listaTecnica, produtoId],
    enabled: produtoId !== null,
    queryFn: () => buscarListaTecnica(produtoId),
  })
}

/**
 * A lista técnica de todos os produtos, numa consulta.
 *
 * É o que a tela de viabilidade precisa: ela compara o depósito com o
 * catálogo inteiro de uma vez, e uma consulta por produto seria uma ida ao
 * servidor por linha da lista — no depósito, com rede ruim, é a diferença
 * entre responder e parecer travado.
 */
export function useListaTecnicaCompleta() {
  return useQuery({
    queryKey: [...chaves.listaTecnica, 'todos'],
    queryFn: () => buscarListaTecnica(null),
  })
}

export interface DadosProduto {
  codigo: string
  nome: string
  descricao: string | null
  largura_mm: number | null
  altura_mm: number | null
  observacoes: string | null
  foto_url: string | null
  desenho_url: string | null
}

export function useCriarProduto() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async (dados: DadosProduto): Promise<Produto> => {
      const { data, error } = await supabase
        .from('produtos')
        .insert(dados)
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          throw new Error(
            `Já existe um produto com o código ${dados.codigo}. O código precisa ser único.`,
          )
        }
        throw new Error(error.message)
      }

      return data as Produto
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.produtos })
    },
  })
}

export function useEditarProduto() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, dados }: { id: string; dados: DadosProduto }) => {
      const { error } = await supabase
        .from('produtos')
        .update(dados)
        .eq('id', id)

      if (error) {
        if (error.code === '23505') {
          throw new Error('Já existe um produto com este código.')
        }
        throw new Error(error.message)
      }
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.produtos })
    },
  })
}

export function useDesativarProduto() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('produtos')
        .update({ ativo })
        .eq('id', id)

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.produtos })
    },
  })
}

export interface DadosItemLista {
  produto_id: string
  modelo_perfil_id: string
  comprimento_mm: number
  quantidade: number
  observacao: string | null
}

export function useAdicionarItemLista() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async (dados: DadosItemLista) => {
      const { error } = await supabase.from('itens_lista_tecnica').insert(dados)

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.listaTecnica })
    },
  })
}

/**
 * Corrige um corte já lançado.
 *
 * Errar a quantidade ou o comprimento ao montar a receita é comum — são
 * números digitados um atrás do outro. Sem isto, corrigir significava
 * remover a linha e lançá-la de novo, e quem fizesse isso no meio de uma
 * lista longa perdia a posição.
 */
export function useEditarItemLista() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      dados,
    }: {
      id: string
      dados: Omit<DadosItemLista, 'produto_id'>
    }) => {
      const { error } = await supabase
        .from('itens_lista_tecnica')
        .update(dados)
        .eq('id', id)

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.listaTecnica })
    },
  })
}

/**
 * Remove de verdade, sem desativar.
 *
 * Linha de receita não é histórico de nada: é a receita de hoje. Corrigir
 * uma lista técnica errada não pode deixar rastro que atrapalhe a leitura —
 * diferente de sobra e movimentação, onde o passado importa.
 */
export function useRemoverItemLista() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('itens_lista_tecnica')
        .delete()
        .eq('id', id)

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.listaTecnica })
    },
  })
}

/**
 * Grava a nova sequência dos cortes.
 *
 * Reescreve a posição de TODOS os itens da lista, e não só dos que mudaram:
 * arrastar um item do fim para o começo desloca todos os outros, e calcular
 * quais no aplicativo seria refazer, com menos informação, a conta que o
 * banco faz num comando. A lista tem dezenas de linhas, não milhares.
 */
export function useReordenarLista() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async (idsNaOrdem: readonly string[]) => {
      // Um `update` por item: o Postgres não tem "atualize cada linha com um
      // valor diferente" numa chamada só pela API REST. São poucas linhas, e
      // acontece uma vez por arrastar.
      for (const [posicao, id] of idsNaOrdem.entries()) {
        const { error } = await supabase
          .from('itens_lista_tecnica')
          .update({ ordem: posicao + 1 })
          .eq('id', id)

        if (error) throw new Error(error.message)
      }
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.listaTecnica })
    },
  })
}
