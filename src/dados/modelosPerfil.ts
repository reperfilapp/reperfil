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
  aplicacao: string | null
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

/** Campos de texto livre que sugerem o que a organização já digitou. */
export type CampoSugerivel = 'aplicacao' | 'linha' | 'fabricante'

/**
 * Valores já usados num campo, nos perfis desta organização, sem repetir.
 *
 * Autoexpansível de propósito: em vez de um cadastro à parte para
 * administrar linhas e fabricantes, a lista de sugestões cresce sozinha
 * conforme as pessoas digitam. Ninguém precisa lembrar de cadastrar
 * "Suprema" antes de usar — usa uma vez, e a partir da segunda vez ela já
 * sugere. Continua sendo texto livre: digitar algo novo funciona sempre,
 * que é o que permite a lista crescer.
 */
export function useValoresUsados(campo: CampoSugerivel) {
  return useQuery({
    queryKey: [...chaves.modelosPerfil, 'valores-usados', campo],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('modelos_perfil')
        .select(campo)
        .not(campo, 'is', null)

      if (error) throw new Error(error.message)

      const distintos = new Set(
        (data as Record<string, string>[])
          .map((registro) => registro[campo]?.trim() ?? '')
          .filter((valor) => valor !== ''),
      )

      return [...distintos].sort((a, b) => a.localeCompare(b, 'pt-BR'))
    },
    // Muda pouco; não vale revalidar a cada troca de tela.
    staleTime: 5 * 60_000,
  })
}

/**
 * Linhas cadastradas, para agrupar a lista de perfis.
 *
 * Perfil sem linha não fica de fora: ele entra num grupo "Sem linha", senão
 * some da tela agrupada e a pessoa conclui que o cadastro se perdeu.
 */
export const SEM_LINHA = 'Sem linha'

export function agruparPorLinha(
  modelos: readonly ModeloPerfil[],
): { linha: string; modelos: ModeloPerfil[] }[] {
  const grupos = new Map<string, ModeloPerfil[]>()

  for (const modelo of modelos) {
    const chave = modelo.linha?.trim() || SEM_LINHA
    const lista = grupos.get(chave) ?? []

    lista.push(modelo)
    grupos.set(chave, lista)
  }

  return [...grupos.entries()]
    .map(([linha, lista]) => ({ linha, modelos: lista }))
    .sort((a, b) => {
      // "Sem linha" por último: é o resto, não uma linha de verdade.
      if (a.linha === SEM_LINHA) return 1
      if (b.linha === SEM_LINHA) return -1
      return a.linha.localeCompare(b.linha, 'pt-BR')
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
      (modelo.linha?.toLowerCase().includes(busca) ?? false) ||
      (modelo.aplicacao?.toLowerCase().includes(busca) ?? false),
  )
}

/**
 * Renomeia uma linha em todos os perfis que a usam.
 *
 * A linha não é uma tabela: é texto gravado em cada perfil. Isso mantém o
 * cadastro simples — usar uma linha nova já é criá-la — mas deixa a porta
 * aberta para variações que na prática são a mesma coisa ("Fachada" e
 * "Fachada?" vieram assim da planilha importada). Esta função é a faxina:
 * renomear para um nome que já existe FUNDE as duas, porque passam a ser o
 * mesmo texto. É o comportamento desejado, e por isso a tela avisa antes.
 */
export function useRenomearLinha() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({
      de,
      para,
    }: {
      de: string
      para: string
    }): Promise<number> => {
      const novo = para.trim()

      if (novo === '') throw new Error('O nome da linha não pode ficar vazio.')

      const { data, error } = await supabase
        .from('modelos_perfil')
        .update({ linha: novo })
        .eq('linha', de)
        .select('id')

      if (error) throw new Error(error.message)

      return (data as { id: string }[]).length
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.modelosPerfil })
    },
  })
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
