import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { ResultadoSincronizacao } from '@/dados/modelosPerfil'
import type { ResultadoSincronizarProdutos } from '@/dados/produtos'
import type { ResultadoSincronizarAcessorios } from '@/dados/modelosAcessorio'
import type { ResultadoSincronizarAcabamentos } from '@/dados/acabamentos'

/**
 * As mesmas 4 sincronizações que cada empresa já pode puxar sozinha
 * (`useSincronizarCatalogoCentral`, `useSincronizarProdutos`,
 * `useSincronizarAcessoriosCentral`, `useSincronizarAcabamentosCentral`),
 * só que disparadas pela organização central PARA OUTRA empresa —
 * `p_organizacao_id` é aceito pelas 4 funções desde a migração
 * `20260901300000_sincronizacao_em_lote_central.sql`, que também recusa
 * quem não for administrador do catálogo central tentando isso.
 *
 * Arquivo separado dos hooks de cada entidade de propósito: aqueles
 * invalidam as queries da PRÓPRIA organização logada (quem clicou "Importar
 * do catálogo central" na sua tela) — aqui quem clica é a central, sobre o
 * catálogo de OUTRA empresa, então não há nada local para invalidar.
 */

export function useSincronizarCatalogoCentralPara() {
  return useMutation({
    mutationFn: async (organizacaoId: string): Promise<ResultadoSincronizacao> => {
      const { data, error } = await supabase.rpc('sincronizar_catalogo_central', {
        p_linha: null,
        p_organizacao_id: organizacaoId,
      })

      if (error) throw new Error(error.message)

      const linhas = (data ?? []) as ResultadoSincronizacao[]

      return (
        linhas[0] ?? { perfis_novos: 0, perfis_atualizados: 0, imagens_novas: 0 }
      )
    },
  })
}

export function useSincronizarProdutosPara() {
  return useMutation({
    mutationFn: async (
      organizacaoId: string,
    ): Promise<ResultadoSincronizarProdutos> => {
      const { data, error } = await supabase.rpc('sincronizar_produtos_central', {
        p_organizacao_id: organizacaoId,
      })

      if (error) throw new Error(error.message)

      const linhas = (data ?? []) as ResultadoSincronizarProdutos[]

      return (
        linhas[0] ?? {
          produtos_novos: 0,
          produtos_atualizados: 0,
          produtos_vinculados: 0,
          produtos_em_conflito: 0,
          itens_sem_perfil: 0,
          itens_sem_acessorio: 0,
        }
      )
    },
  })
}

export function useSincronizarAcessoriosCentralPara() {
  return useMutation({
    mutationFn: async (
      organizacaoId: string,
    ): Promise<ResultadoSincronizarAcessorios> => {
      const { data, error } = await supabase.rpc('sincronizar_acessorios_central', {
        p_organizacao_id: organizacaoId,
      })

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
  })
}

export function useSincronizarAcabamentosCentralPara() {
  return useMutation({
    mutationFn: async (
      organizacaoId: string,
    ): Promise<ResultadoSincronizarAcabamentos> => {
      const { data, error } = await supabase.rpc('sincronizar_acabamentos_central', {
        p_organizacao_id: organizacaoId,
      })

      if (error) throw new Error(error.message)

      const linhas = (data ?? []) as ResultadoSincronizarAcabamentos[]

      return linhas[0] ?? { acabamentos_novos: 0, acabamentos_atualizados: 0 }
    },
  })
}
