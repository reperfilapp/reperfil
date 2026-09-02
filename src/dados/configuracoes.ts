import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { chaves } from '@/lib/consultas'
import {
  obterLinkTemporario,
  enviarLogoDesenvolvedor,
  BALDE_LOGOS,
} from '@/lib/armazenamento'
import type { ConfiguracoesAplicacao } from '@/tipos/banco'
import type { ConfiguracaoCorte } from '@/dominio/corte'

export function useConfiguracoes() {
  return useQuery({
    queryKey: chaves.configuracoes,
    queryFn: async (): Promise<ConfiguracoesAplicacao | null> => {
      const { data, error } = await supabase
        .from('configuracoes_aplicacao')
        .select('*')
        .maybeSingle()

      if (error) throw new Error(error.message)

      return data as ConfiguracoesAplicacao | null
    },
    // Configuração muda raramente; não faz sentido revalidar a toda hora.
    staleTime: 5 * 60_000,
  })
}

/**
 * Converte as configurações do banco para o formato que o motor de corte usa.
 *
 * A tradução existe para que `src/dominio/corte.ts` continue sendo função
 * pura, sem conhecer banco nem nome de coluna — é o que permite testá-lo
 * sem servidor nenhum.
 */
export function paraConfiguracaoCorte(
  config: ConfiguracoesAplicacao,
): ConfiguracaoCorte {
  return {
    espessuraSerraMm: config.espessura_serra_mm,
    margemLimpezaMm: config.margem_limpeza_mm,
    comprimentoMinimoSobraMm: config.comprimento_minimo_sobra_mm,
    ultimoCorteGeraPerda: config.ultimo_corte_gera_perda,
  }
}

export interface DadosConfiguracoes {
  comprimento_barra_padrao_mm: number
  espessura_serra_mm: number
  margem_limpeza_mm: number
  comprimento_minimo_sobra_mm: number
  ultimo_corte_gera_perda: boolean
  prazo_reserva_horas: number
  limite_semelhanca_desenho_percentual: number
}

export function useSalvarConfiguracoes() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      dados,
      confirmar,
    }: {
      id: string
      dados: DadosConfiguracoes
      confirmar: boolean
    }): Promise<ConfiguracoesAplicacao> => {
      // Ao confirmar, registra quem confirmou e quando. Isso é o que libera
      // o cálculo para uso em produção: até então os valores de serra e
      // mínimo de sobra são presumidos, não medidos na oficina.
      const atualizacao = confirmar
        ? {
            ...dados,
            confirmado_pelo_administrador: true,
            confirmado_em: new Date().toISOString(),
          }
        : dados

      const { data, error } = await supabase
        .from('configuracoes_aplicacao')
        .update(atualizacao)
        .eq('id', id)
        .select()
        .single()

      if (error) throw new Error(error.message)

      return data as ConfiguracoesAplicacao
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.configuracoes })
    },
  })
}

/**
 * Logo da empresa desenvolvedora, para a página "Sobre".
 *
 * Vive em `configuracoes_aplicacao`, e não em `organizacoes`: é informação
 * sobre quem fez o sistema, não sobre a empresa que o usa.
 */
export function useEnviarLogoDesenvolvedor() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      arquivo,
    }: {
      id: string
      arquivo: File
    }): Promise<string> => {
      const { caminho } = await enviarLogoDesenvolvedor(arquivo)

      const { error } = await supabase
        .from('configuracoes_aplicacao')
        .update({ logo_desenvolvedor_caminho: caminho })
        .eq('id', id)

      if (error) throw new Error(error.message)

      return caminho
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.configuracoes })
    },
  })
}

export function useLogoDesenvolvedor(caminho: string | null | undefined) {
  return useQuery({
    queryKey: ['logo-desenvolvedor', caminho],
    queryFn: async (): Promise<string | null> => {
      if (!caminho) return null
      return obterLinkTemporario(BALDE_LOGOS, caminho)
    },
    enabled: Boolean(caminho),
    staleTime: 55 * 60_000,
  })
}
