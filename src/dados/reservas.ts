import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { chaves } from '@/lib/consultas'
import type { Reserva, StatusReserva } from '@/tipos/banco'

/**
 * Reservas.
 *
 * Nenhuma destas operações é um `update` comum. Todas passam por funções do
 * banco que travam a linha do lote com `SELECT … FOR UPDATE` antes de mexer.
 * Isso não é preciosismo: duas pessoas no depósito abrindo a mesma peça no
 * celular e tocando em "Reservar" ao mesmo tempo é o cenário normal, não o
 * excepcional. Sem a trava, as duas sairiam achando que a peça é delas.
 *
 * A verificação disso está em `supabase/testes/verificar-rls.sql`.
 */

export interface ReservaDetalhada extends Reserva {
  lote: {
    codigo: string
    comprimento_mm: number
    modelo: { codigo: string; descricao: string } | null
    acabamento: { nome: string } | null
    localizacao: { codigo: string } | null
  } | null
}

/** Reservas que ainda exigem alguma ação. */
const STATUS_EM_ABERTO: StatusReserva[] = ['ativa', 'retirada']

export function useReservas(apenasEmAberto = true) {
  return useQuery({
    queryKey: [...chaves.reservas, { apenasEmAberto }],
    queryFn: async (): Promise<ReservaDetalhada[]> => {
      let consulta = supabase
        .from('reservas')
        .select(
          // O nome da chave estrangeira é obrigatório aqui: `reservas` aponta
          // para `lotes_sobras` DUAS vezes — o lote reservado e o lote que
          // resultou do corte. Sem dizer qual, o PostgREST recusa a consulta.
          `*,
           lote:lotes_sobras!reservas_lote_id_fkey (
             codigo, comprimento_mm,
             modelo:modelos_perfil (codigo, descricao),
             acabamento:acabamentos (nome),
             localizacao:localizacoes (codigo)
           )`,
        )
        .order('criado_em', { ascending: false })

      if (apenasEmAberto) {
        consulta = consulta.in('status', STATUS_EM_ABERTO)
      }

      const { data, error } = await consulta

      if (error) throw new Error(error.message)

      return data as unknown as ReservaDetalhada[]
    },
    // Curto de propósito: reserva alheia e expiração mudam o que está livre.
    staleTime: 10_000,
  })
}

/** Invalida tudo que a mudança de uma reserva afeta. */
function useAtualizarDepois() {
  const cliente = useQueryClient()

  return () => {
    void cliente.invalidateQueries({ queryKey: chaves.reservas })
    void cliente.invalidateQueries({ queryKey: chaves.sobras })
  }
}

export function useReservarSobra() {
  const atualizar = useAtualizarDepois()

  return useMutation({
    mutationFn: async ({
      loteId,
      quantidade,
      observacoes,
    }: {
      loteId: string
      quantidade: number
      observacoes?: string | null
    }): Promise<Reserva> => {
      const { data, error } = await supabase.rpc('reservar_sobra', {
        p_lote_id: loteId,
        p_quantidade: quantidade,
        p_observacoes: observacoes ?? null,
      })

      if (error) throw new Error(error.message)

      return data as Reserva
    },
    onSuccess: atualizar,
  })
}

export function useCancelarReserva() {
  const atualizar = useAtualizarDepois()

  return useMutation({
    mutationFn: async ({
      reservaId,
      motivo,
    }: {
      reservaId: string
      motivo: string
    }) => {
      const { error } = await supabase.rpc('cancelar_reserva', {
        p_reserva_id: reservaId,
        p_motivo: motivo,
      })

      if (error) throw new Error(error.message)
    },
    onSuccess: atualizar,
  })
}

export function useConfirmarRetirada() {
  const atualizar = useAtualizarDepois()

  return useMutation({
    mutationFn: async (reservaId: string) => {
      const { error } = await supabase.rpc('confirmar_retirada', {
        p_reserva_id: reservaId,
      })

      if (error) throw new Error(error.message)
    },
    onSuccess: atualizar,
  })
}

export interface ResultadoCorte {
  lote_resultante_codigo: string | null
  comprimento_restante_mm: number
  destino_resto: 'sobra' | 'descarte' | 'sem-resto'
}

/**
 * Confirma o corte.
 *
 * O comprimento restante é calculado no aplicativo, por `dominio/corte.ts`, e
 * enviado pronto. O banco não recalcula de propósito: ter a mesma fórmula em
 * dois lugares é receita para os dois discordarem, e aí ninguém sabe qual
 * está certo.
 */
export function useConfirmarCorte() {
  const atualizar = useAtualizarDepois()

  return useMutation({
    mutationFn: async ({
      reservaId,
      comprimentoUtilizadoMm,
      comprimentoRestanteMm,
    }: {
      reservaId: string
      comprimentoUtilizadoMm: number
      comprimentoRestanteMm: number
    }): Promise<ResultadoCorte> => {
      const { data, error } = await supabase.rpc('confirmar_corte', {
        p_reserva_id: reservaId,
        p_comprimento_utilizado_mm: comprimentoUtilizadoMm,
        p_comprimento_restante_mm: comprimentoRestanteMm,
      })

      if (error) throw new Error(error.message)

      return data as ResultadoCorte
    },
    onSuccess: atualizar,
  })
}
