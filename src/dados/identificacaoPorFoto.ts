import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { mensagemDeErroDaFuncao } from '@/lib/erroDeFuncao'
import { comprimirImagem, COMPRESSAO_FOTO } from '@/lib/imagens'
import type { CandidatoPorFoto } from '@/dominio/identificacaoPerfil'

function paraDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader()
    leitor.onload = () => resolve(leitor.result as string)
    leitor.onerror = () => reject(new Error('Não foi possível ler a foto.'))
    leitor.readAsDataURL(blob)
  })
}

/**
 * Compara a foto tirada em "Identificar perfil" com o catálogo, via busca
 * visual (Edge Function `identificar-perfil-por-foto`).
 *
 * Comprime antes de enviar pelo mesmo motivo do upload de cadastro: a foto
 * crua da câmera do celular passa fácil de 5 MB, e nada aqui precisa de
 * resolução de zoom em cota — é comparação de forma e cor, não leitura de
 * desenho técnico.
 */
export function useIdentificarPorFoto() {
  return useMutation({
    mutationFn: async (arquivo: File): Promise<CandidatoPorFoto[]> => {
      const comprimida = await comprimirImagem(arquivo, COMPRESSAO_FOTO)
      const foto = await paraDataUri(comprimida)

      const { data, error } = await supabase.functions.invoke<{
        ok: boolean
        error?: string
        candidatos: CandidatoPorFoto[]
      }>('identificar-perfil-por-foto', { body: { foto } })

      if (error) {
        throw new Error(
          await mensagemDeErroDaFuncao(error, 'Não foi possível comparar a foto.'),
        )
      }

      if (!data?.ok) {
        throw new Error(data?.error ?? 'Não foi possível comparar a foto.')
      }

      return data.candidatos
    },
  })
}

export interface DesenhoParecido {
  modeloPerfilId: string
  /** 0 a 100. */
  parecenca: number
}

/**
 * Compara o desenho técnico de UM perfil (o de maior confiança na busca
 * por foto) com o desenho técnico de outros candidatos — ver a função
 * `desenhos_tecnicos_parecidos` (migração `20260901500000`) para o porquê
 * de ser uma comparação separada da foto-com-catálogo. Não precisa de
 * Edge Function: os dois vetores já existem no banco, é só comparar.
 */
export function useCompararDesenhosTecnicos() {
  return useMutation({
    mutationFn: async ({
      modeloPerfilId,
      candidatosIds,
    }: {
      modeloPerfilId: string
      candidatosIds: string[]
    }): Promise<DesenhoParecido[]> => {
      const { data, error } = await supabase.rpc('desenhos_tecnicos_parecidos', {
        p_modelo_perfil_id: modeloPerfilId,
        p_ids: candidatosIds,
      })

      if (error) throw new Error(error.message)

      return (
        (data ?? []) as { modelo_perfil_id: string; parecenca: number }[]
      ).map((r) => ({
        modeloPerfilId: r.modelo_perfil_id,
        parecenca: Math.round(r.parecenca * 100),
      }))
    },
  })
}
