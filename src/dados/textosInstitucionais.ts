import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { chaves } from '@/lib/consultas'
import type { TextosInstitucionais } from '@/tipos/banco'

/**
 * Os textos da tela "Sobre" — registro único, comum a toda organização.
 * Ver a migração `textos_institucionais` para o porquê de não morar em
 * `configuracoes_aplicacao` (que é uma linha POR organização).
 */
export function useTextosInstitucionais() {
  return useQuery({
    queryKey: chaves.textosInstitucionais,
    queryFn: async (): Promise<TextosInstitucionais | null> => {
      const { data, error } = await supabase
        .from('textos_institucionais')
        .select('*')
        .maybeSingle()

      if (error) throw new Error(error.message)

      return data as TextosInstitucionais | null
    },
    // Muda raramente — só quando o administrador da central edita.
    staleTime: 5 * 60_000,
  })
}

/**
 * Só o administrador da organização central consegue de fato gravar — a
 * política de RLS recusa qualquer outra organização. O campo é um dos dois
 * textos da tabela, nunca os dois de uma vez: cada cartão da tela "Sobre"
 * edita o seu, sem mexer no outro.
 */
export function useSalvarTextoInstitucional() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      campo,
      valor,
    }: {
      id: string
      campo: 'texto_sobre_app' | 'texto_equipe_tecnica'
      valor: string
    }) => {
      const { error } = await supabase
        .from('textos_institucionais')
        .update({ [campo]: valor })
        .eq('id', id)

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.textosInstitucionais })
    },
  })
}
