import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { chaves } from '@/lib/consultas'
import type { Localizacao } from '@/tipos/banco'

export interface DadosLocalizacao {
  codigo: string
  deposito: string | null
  setor: string | null
  corredor: string | null
  estante: string | null
  prateleira: string | null
  posicao: string | null
  observacao: string | null
}

/**
 * Monta o endereço legível a partir dos níveis preenchidos.
 *
 * Todos os níveis são opcionais porque cada galpão é organizado de um jeito:
 * alguns têm corredor e estante, outros só um cavalete no canto. Mostrar
 * "Depósito 1 · Setor A · Estante 1" é mais útil do que campos vazios.
 */
export function descreverLocalizacao(local: Localizacao): string {
  const partes = [
    local.deposito,
    local.setor,
    local.corredor,
    local.estante,
    local.prateleira,
    local.posicao,
  ].filter((parte): parte is string => parte !== null && parte.trim() !== '')

  return partes.length > 0 ? partes.join(' · ') : local.codigo
}

export function useLocalizacoes(incluirInativas = false) {
  return useQuery({
    queryKey: [...chaves.localizacoes, { incluirInativas }],
    queryFn: async (): Promise<Localizacao[]> => {
      let consulta = supabase.from('localizacoes').select('*').order('codigo')

      if (!incluirInativas) {
        consulta = consulta.eq('ativo', true)
      }

      const { data, error } = await consulta

      if (error) throw new Error(error.message)

      return data as Localizacao[]
    },
  })
}

export function useCriarLocalizacao() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async (dados: DadosLocalizacao): Promise<Localizacao> => {
      const { data, error } = await supabase
        .from('localizacoes')
        .insert(dados)
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          throw new Error(
            `Já existe uma localização com o código ${dados.codigo}.`,
          )
        }
        throw new Error(error.message)
      }

      return data as Localizacao
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.localizacoes })
    },
  })
}

export function useEditarLocalizacao() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      dados,
    }: {
      id: string
      dados: Partial<DadosLocalizacao>
    }): Promise<Localizacao> => {
      const { data, error } = await supabase
        .from('localizacoes')
        .update(dados)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          throw new Error('Já existe uma localização com este código.')
        }
        throw new Error(error.message)
      }

      return data as Localizacao
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.localizacoes })
    },
  })
}

export function useDesativarLocalizacao() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('localizacoes')
        .update({ ativo })
        .eq('id', id)

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.localizacoes })
    },
  })
}
