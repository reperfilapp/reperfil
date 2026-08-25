import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { chaves } from '@/lib/consultas'
import type {
  ItemInventario,
  SessaoInventario,
  TipoItemInventario,
} from '@/tipos/banco'

/**
 * Inventário — contagem física decolada do estoque de verdade.
 *
 * Contar não altera nada: `itens_inventario` só guarda o que foi visto.
 * Só `aplicar_item_inventario` / `aplicar_sessao_inventario` gravam a
 * diferença de volta em `lotes_sobras` ou `lotes_acessorio` — ver a migração
 * `20260824210000_inventario.sql` para o desenho completo.
 */

export function useSessoesInventario() {
  return useQuery({
    queryKey: chaves.inventario,
    queryFn: async (): Promise<SessaoInventario[]> => {
      const { data, error } = await supabase
        .from('sessoes_inventario')
        .select('*')
        .order('criado_em', { ascending: false })

      if (error) throw new Error(error.message)

      return data as SessaoInventario[]
    },
  })
}

export function useSessaoInventario(id: string | null) {
  return useQuery({
    queryKey: [...chaves.inventario, 'uma', id],
    enabled: id !== null,
    queryFn: async (): Promise<SessaoInventario | null> => {
      const { data, error } = await supabase
        .from('sessoes_inventario')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error) throw new Error(error.message)

      return data as SessaoInventario | null
    },
  })
}

/** Um item de inventário com os dados do lote (perfil ou acessório) juntos. */
export interface ItemInventarioDetalhado extends ItemInventario {
  lote_sobra: {
    codigo: string
    comprimento_mm: number
    quantidade: number
    quantidade_reservada: number
    modelo_perfil_id: string
    modelo: {
      codigo: string
      descricao: string
      linha: string | null
      largura_secao_mm?: number | null
      altura_secao_mm?: number | null
      medida_3_secao_mm?: number | null
      medida_4_secao_mm?: number | null
    } | null
    acabamento: { nome: string; cor_hex: string | null } | null
    localizacao: { codigo: string } | null
  } | null
  lote_acessorio: {
    codigo: string
    quantidade: number
    modelo: {
      codigo: string
      descricao: string
      categoria: string | null
      unidade_medida: string
    } | null
    acabamento: { nome: string; cor_hex: string | null } | null
    localizacao: { codigo: string } | null
  } | null
}

export function useItensInventario(sessaoId: string | null) {
  return useQuery({
    queryKey: [...chaves.inventario, 'itens', sessaoId],
    enabled: sessaoId !== null,
    queryFn: async (): Promise<ItemInventarioDetalhado[]> => {
      const { data, error } = await supabase
        .from('itens_inventario')
        .select(
          `*,
           lote_sobra:lotes_sobras!itens_inventario_lote_sobra_id_fkey (
             codigo, comprimento_mm, quantidade, quantidade_reservada, modelo_perfil_id,
             modelo:modelos_perfil (
               codigo, descricao, linha,
               largura_secao_mm, altura_secao_mm, medida_3_secao_mm, medida_4_secao_mm
             ),
             acabamento:acabamentos (nome, cor_hex),
             localizacao:localizacoes (codigo)
           ),
           lote_acessorio:lotes_acessorio!itens_inventario_lote_acessorio_id_fkey (
             codigo, quantidade,
             modelo:modelos_acessorio (codigo, descricao, categoria, unidade_medida),
             acabamento:acabamentos (nome, cor_hex),
             localizacao:localizacoes (codigo)
           )`,
        )
        .eq('sessao_id', sessaoId)
        .order('criado_em', { ascending: true })

      if (error) throw new Error(error.message)

      return data as unknown as ItemInventarioDetalhado[]
    },
  })
}

function useInvalidarInventario() {
  const cliente = useQueryClient()

  return () => {
    void cliente.invalidateQueries({ queryKey: chaves.inventario })
    void cliente.invalidateQueries({ queryKey: chaves.sobras })
    void cliente.invalidateQueries({ queryKey: chaves.lotesAcessorio })
  }
}

export function useCriarSessaoInventario() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({
      tipoItem,
      titulo,
      criterios,
      loteIds,
    }: {
      tipoItem: TipoItemInventario
      titulo: string | null
      criterios: Record<string, unknown>
      loteIds: readonly string[]
    }): Promise<SessaoInventario> => {
      const { data, error } = await supabase.rpc('criar_sessao_inventario', {
        p_tipo_item: tipoItem,
        p_titulo: titulo,
        p_criterios: criterios,
        p_lote_ids: loteIds,
      })

      if (error) throw new Error(error.message)

      return data as SessaoInventario
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.inventario })
    },
  })
}

export function useCancelarSessaoInventario() {
  const atualizar = useInvalidarInventario()

  return useMutation({
    mutationFn: async (sessaoId: string) => {
      const { error } = await supabase.rpc('cancelar_sessao_inventario', {
        p_sessao_id: sessaoId,
      })

      if (error) throw new Error(error.message)
    },
    onSuccess: atualizar,
  })
}

/**
 * Grava a contagem — "Confirmar" (copia o esperado) ou um valor novo. Não
 * passa por função: é só registro de conferência, sem tocar no estoque de
 * verdade, então uma atualização direta (sob a mesma permissão de sempre)
 * basta.
 */
export function useContarItemInventario() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({
      itemId,
      contagemQuantidade,
      contagemComprimentoMm,
      confirmadoSemAlteracao,
      usuarioId,
    }: {
      itemId: string
      contagemQuantidade: number
      contagemComprimentoMm: number | null
      confirmadoSemAlteracao: boolean
      usuarioId: string
    }) => {
      const { error } = await supabase
        .from('itens_inventario')
        .update({
          contagem_quantidade: contagemQuantidade,
          contagem_comprimento_mm: contagemComprimentoMm,
          confirmado_sem_alteracao: confirmadoSemAlteracao,
          contado_em: new Date().toISOString(),
          contado_por: usuarioId,
        })
        .eq('id', itemId)

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.inventario })
    },
  })
}

export interface ResultadoAplicacao {
  mudou?: boolean
  total?: number
  alterados?: number
}

export function useAplicarItemInventario() {
  const atualizar = useInvalidarInventario()

  return useMutation({
    mutationFn: async (itemId: string): Promise<ResultadoAplicacao> => {
      const { data, error } = await supabase.rpc('aplicar_item_inventario', {
        p_item_id: itemId,
      })

      if (error) throw new Error(error.message)

      return data as ResultadoAplicacao
    },
    onSuccess: atualizar,
  })
}

export function useAplicarSessaoInventario() {
  const atualizar = useInvalidarInventario()

  return useMutation({
    mutationFn: async (sessaoId: string): Promise<ResultadoAplicacao> => {
      const { data, error } = await supabase.rpc('aplicar_sessao_inventario', {
        p_sessao_id: sessaoId,
      })

      if (error) throw new Error(error.message)

      return data as ResultadoAplicacao
    },
    onSuccess: atualizar,
  })
}
