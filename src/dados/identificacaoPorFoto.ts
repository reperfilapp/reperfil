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
