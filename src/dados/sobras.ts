import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { chaves } from '@/lib/consultas'
import type { EstadoConservacao, LoteSobra } from '@/tipos/banco'

/** Sobra com os cadastros relacionados já carregados, para exibir na lista. */
export interface SobraDetalhada extends LoteSobra {
  modelo: {
    codigo: string
    descricao: string
    linha: string | null
    aplicacao: string | null
  } | null
  acabamento: { codigo: string; nome: string; cor_hex: string | null } | null
  localizacao: { codigo: string } | null
}

/**
 * O perfil como a tela de detalhe da peça precisa dele.
 *
 * A LISTA continua trazendo só quatro campos do perfil, de propósito: são
 * centenas de linhas, e cada coluna a mais é peso na rede do depósito, que
 * é ruim. Aqui é UMA peça — cabe trazer a ficha inteira, porque quem abriu
 * esta tela está com a ponta na mão querendo conferir se é mesmo este
 * perfil.
 */
export interface PerfilDaSobra {
  codigo: string
  descricao: string
  linha: string | null
  aplicacao: string | null
  fabricante: string | null
  comprimento_barra_mm: number
  peso_por_metro_g: number | null
  largura_secao_mm: number | null
  altura_secao_mm: number | null
  medida_3_secao_mm: number | null
  medida_4_secao_mm: number | null
}

export interface SobraCompleta extends Omit<SobraDetalhada, 'modelo'> {
  modelo: PerfilDaSobra | null
}

export interface DadosNovaSobra {
  modelo_perfil_id: string
  acabamento_id: string
  comprimento_mm: number
  quantidade: number
  localizacao_id: string | null
  estado: EstadoConservacao
  origem: string | null
  observacoes: string | null
  /** Caminho no Storage, não endereço público: o balde é privado. */
  foto_url: string | null
}

/**
 * Lista as sobras com os nomes dos cadastros relacionados.
 *
 * Uma consulta só, com junções, em vez de buscar as sobras e depois os
 * modelos e acabamentos: no depósito a rede é ruim, e três idas ao servidor
 * custam três vezes mais espera.
 */
export function useSobras() {
  return useQuery({
    queryKey: chaves.sobras,
    queryFn: async (): Promise<SobraDetalhada[]> => {
      const { data, error } = await supabase
        .from('lotes_sobras')
        .select(
          `*,
           modelo:modelos_perfil (codigo, descricao, linha, aplicacao),
           acabamento:acabamentos (codigo, nome, cor_hex),
           localizacao:localizacoes (codigo)`,
        )
        .order('criado_em', { ascending: false })

      if (error) throw new Error(error.message)

      return data as unknown as SobraDetalhada[]
    },
  })
}

/**
 * Cadastra uma sobra pela função transacional do banco.
 *
 * Não é um `insert` comum: `cadastrar_sobra` valida o comprimento, confere
 * que modelo e acabamento pertencem à organização, gera o código curto e
 * grava a movimentação de entrada — tudo na mesma transação. Fazer isso em
 * quatro chamadas do aplicativo deixaria estoque e histórico discordando
 * sempre que a rede caísse no meio.
 */
export function useCadastrarSobra() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async (dados: DadosNovaSobra): Promise<LoteSobra> => {
      const { data, error } = await supabase.rpc('cadastrar_sobra', {
        p_modelo_perfil_id: dados.modelo_perfil_id,
        p_acabamento_id: dados.acabamento_id,
        p_comprimento_mm: dados.comprimento_mm,
        p_quantidade: dados.quantidade,
        p_localizacao_id: dados.localizacao_id,
        p_estado: dados.estado,
        p_origem: dados.origem,
        p_observacoes: dados.observacoes,
        p_foto_url: dados.foto_url,
      })

      if (error) throw new Error(error.message)

      return data as LoteSobra
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.sobras })
    },
  })
}

/** Totais do painel: quantas peças e quantos metros estão disponíveis. */
export function useResumoEstoque() {
  return useQuery({
    queryKey: [...chaves.sobras, 'resumo'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lotes_sobras')
        .select('comprimento_mm, quantidade, quantidade_reservada, status')

      if (error) throw new Error(error.message)

      const linhas = data as Pick<
        LoteSobra,
        'comprimento_mm' | 'quantidade' | 'quantidade_reservada' | 'status'
      >[]

      let pecasDisponiveis = 0
      let milimetrosDisponiveis = 0
      let pecasReservadas = 0

      for (const linha of linhas) {
        if (linha.status === 'consumida' || linha.status === 'descartada') {
          continue
        }

        const livres = linha.quantidade - linha.quantidade_reservada

        pecasDisponiveis += livres
        milimetrosDisponiveis += livres * linha.comprimento_mm
        pecasReservadas += linha.quantidade_reservada
      }

      return { pecasDisponiveis, milimetrosDisponiveis, pecasReservadas }
    },
  })
}

/**
 * Histórico de um lote.
 *
 * As movimentações são imutáveis — não há política de exclusão no banco — e
 * é isso que torna esta tela confiável: o que está aqui aconteceu, e ninguém
 * apagou depois.
 */
export interface MovimentacaoDetalhada {
  id: string
  tipo: string
  quantidade: number
  comprimento_mm: number | null
  justificativa: string | null
  criado_em: string
  usuario: { nome: string } | null
}

export function useHistoricoDoLote(loteId: string | null) {
  return useQuery({
    queryKey: [...chaves.sobras, 'historico', loteId],
    enabled: loteId !== null,
    queryFn: async (): Promise<MovimentacaoDetalhada[]> => {
      const { data, error } = await supabase
        .from('movimentacoes_estoque')
        .select(
          `id, tipo, quantidade, comprimento_mm, justificativa, criado_em,
           usuario:perfis_usuario (nome)`,
        )
        .eq('lote_id', loteId)
        .order('criado_em', { ascending: false })

      if (error) throw new Error(error.message)

      return data as unknown as MovimentacaoDetalhada[]
    },
  })
}

/** Uma sobra específica, com tudo que a tela de detalhe precisa. */
export function useSobra(id: string | null) {
  return useQuery({
    queryKey: [...chaves.sobras, 'uma', id],
    enabled: id !== null,
    queryFn: async (): Promise<SobraCompleta | null> => {
      const { data, error } = await supabase
        .from('lotes_sobras')
        .select(
          `*,
           modelo:modelos_perfil (
             codigo, descricao, linha, aplicacao, fabricante,
             comprimento_barra_mm, peso_por_metro_g,
             largura_secao_mm, altura_secao_mm,
             medida_3_secao_mm, medida_4_secao_mm
           ),
           acabamento:acabamentos (codigo, nome, cor_hex),
           localizacao:localizacoes (codigo)`,
        )
        .eq('id', id)
        .maybeSingle()

      if (error) throw new Error(error.message)

      return data as unknown as SobraCompleta | null
    },
  })
}
