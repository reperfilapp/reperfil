import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { chaves } from '@/lib/consultas'
import type { CardTelaInicial, GrupoCardTelaInicial } from '@/tipos/banco'

export function useCardsTelaInicial() {
  return useQuery({
    queryKey: chaves.cardsTelaInicial,
    queryFn: async (): Promise<CardTelaInicial[]> => {
      const { data, error } = await supabase
        .from('cards_tela_inicial')
        .select('*')
        .order('grupo')
        .order('ordem')

      if (error) throw new Error(error.message)

      return data as CardTelaInicial[]
    },
    // Muda raramente; não faz sentido revalidar a toda hora.
    staleTime: 5 * 60_000,
  })
}

export interface CardEscolhido {
  item: string
  cor: string
}

/**
 * Substitui TODOS os cards de um grupo pela lista escolhida agora — mais
 * simples do que calcular diferença (o que entrou, o que saiu, o que só
 * mudou de cor) para uma lista curta que a pessoa está vendo inteira na
 * tela. A ordem do array vira a ordem de exibição.
 */
export function useSalvarCardsTelaInicial() {
  const cliente = useQueryClient()
  const { perfil } = useAutenticacao()

  return useMutation({
    mutationFn: async ({
      grupo,
      itens,
    }: {
      grupo: GrupoCardTelaInicial
      itens: CardEscolhido[]
    }): Promise<void> => {
      const organizacaoId = perfil?.organizacao_id
      if (!organizacaoId) throw new Error('Sessão expirada. Entre novamente.')

      const { error: erroRemover } = await supabase
        .from('cards_tela_inicial')
        .delete()
        .eq('organizacao_id', organizacaoId)
        .eq('grupo', grupo)

      if (erroRemover) throw new Error(erroRemover.message)

      if (itens.length === 0) return

      const { error: erroInserir } = await supabase.from('cards_tela_inicial').insert(
        itens.map((item, ordem) => ({
          organizacao_id: organizacaoId,
          grupo,
          item: item.item,
          cor: item.cor,
          ordem,
        })),
      )

      if (erroInserir) throw new Error(erroInserir.message)
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.cardsTelaInicial })
    },
  })
}
