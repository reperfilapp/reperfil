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
    largura_secao_mm?: number | null
    altura_secao_mm?: number | null
    medida_3_secao_mm?: number | null
    medida_4_secao_mm?: number | null
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
  /** 'novo' = direto do fornecedor, 'sobra' = saiu de um corte/obra. */
  tipo_material: 'novo' | 'sobra'
  /** Nome do cliente ou da obra de onde veio o material. */
  cliente_obra: string | null
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
           modelo:modelos_perfil (codigo, descricao, linha, aplicacao, largura_secao_mm, altura_secao_mm, medida_3_secao_mm, medida_4_secao_mm),
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
        p_tipo_material: dados.tipo_material,
        p_cliente_obra: dados.cliente_obra,
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

/**
 * Acrescenta peças a um lote existente, em vez de criar outro.
 *
 * Chama a mesma família de funções do banco que o cadastro usa: a soma e a
 * movimentação de entrada acontecem na mesma transação, e a linha do lote
 * fica travada enquanto isso. Duas pessoas lançando a mesma remessa ao mesmo
 * tempo somariam 8 e 8, não 8.
 */
export function useSomarAoLote() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({
      loteId,
      quantidade,
      origem,
    }: {
      loteId: string
      quantidade: number
      origem: string | null
    }): Promise<LoteSobra> => {
      const { data, error } = await supabase.rpc('somar_ao_lote', {
        p_lote_id: loteId,
        p_quantidade: quantidade,
        p_origem: origem,
      })

      if (error) throw new Error(error.message)

      return data as LoteSobra
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.sobras })
    },
  })
}

/**
 * Corrige a quantidade de um lote já cadastrado — para erro de digitação, e
 * não para consumo.
 *
 * Toda outra mudança de quantidade neste arquivo nasce de um evento físico:
 * cadastrar, reservar, cortar. Esta é a exceção — "digitei 5 no lugar de 2" —
 * e por isso exige justificativa: fica registrado no histórico, sem apagar o
 * valor anterior, para quem olhar depois entender o que aconteceu.
 *
 * Zero é um valor válido aqui, diferente do cadastro de uma sobra nova: uma
 * peça já cadastrada por engano precisa poder ser zerada.
 */
/**
 * Corrige os dados de um lote cadastrado.
 * Se a quantidade for alterada, chama a RPC para registrar a movimentação no histórico.
 */
export function useEditarSobraLote() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({
      loteId,
      quantidadeAtual,
      novaQuantidade,
      acabamentoId,
      comprimentoMm,
      estado,
      origem,
      justificativa,
    }: {
      loteId: string
      quantidadeAtual: number
      novaQuantidade: number
      acabamentoId: string
      comprimentoMm: number
      estado: EstadoConservacao
      origem: string
      justificativa: string
    }) => {
      // 1. Se a quantidade mudou, chama a RPC para manter histórico correto.
      if (novaQuantidade !== quantidadeAtual) {
        const { error: errQtd } = await supabase.rpc(
          'ajustar_quantidade_lote',
          {
            p_lote_id: loteId,
            p_nova_quantidade: novaQuantidade,
            p_justificativa: justificativa,
          },
        )
        if (errQtd) throw new Error(errQtd.message)
      }

      // 2. Atualiza os demais campos diretamente
      const { data, error } = await supabase
        .from('lotes_sobras')
        .update({
          acabamento_id: acabamentoId,
          comprimento_mm: comprimentoMm,
          estado: estado,
          origem: origem,
        })
        .eq('id', loteId)
        .select()
        .single()

      if (error) throw new Error(error.message)

      return data as LoteSobra
    },
    onSuccess: (_, { loteId }) => {
      void cliente.invalidateQueries({ queryKey: chaves.sobras })
      void cliente.invalidateQueries({
        queryKey: [...chaves.sobras, 'historico', loteId],
      })
    },
  })
}

/**
 * Move as peças de um lote para outro equivalente.
 *
 * Uma chamada só, e não "somar aqui, encerrar ali": se a rede caísse entre
 * as duas, o material apareceria em dobro ou sumiria do estoque — e sumir é
 * o pior tipo de erro num depósito, porque só é descoberto quando alguém vai
 * buscar a peça. O banco confere de novo o trio perfil/acabamento/
 * comprimento, porque a tela pode estar mostrando dados de um minuto atrás.
 */
export function useJuntarLotes() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({
      destinoId,
      origemId,
    }: {
      destinoId: string
      origemId: string
    }): Promise<LoteSobra> => {
      const { data, error } = await supabase.rpc('juntar_lotes', {
        p_destino_id: destinoId,
        p_origem_id: origemId,
      })

      if (error) throw new Error(error.message)

      return data as LoteSobra
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.sobras })
    },
  })
}
