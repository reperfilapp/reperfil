import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  obterLinksTemporarios,
  apagarImagem,
  BALDE_DESENHOS,
} from '@/lib/armazenamento'

/**
 * Desenhos técnicos do perfil.
 *
 * Guardados em `arquivos_vetoriais`, a tabela criada na Etapa 1 já pensando
 * na Fase 2. Aqui usamos `tipo = 'imagem'` — foto do catálogo ou do desenho
 * com cotas. Na Fase 2, a MESMA tabela receberá `secao_svg` e `secao_dxf`,
 * que são a seção vetorizada do perfil. Não criar tabela nova para aquilo.
 */

export interface DesenhoTecnico {
  id: string
  modelo_perfil_id: string | null
  arquivo_url: string
  legenda: string | null
  ordem: number
  largura_mm: number | null
  altura_mm: number | null
  criado_em: string
  /** Link temporário para exibir; o balde é privado. */
  link: string | null
}

export function useDesenhosTecnicos(modeloPerfilId: string | null) {
  return useQuery({
    queryKey: ['desenhos-tecnicos', modeloPerfilId],
    enabled: modeloPerfilId !== null,
    queryFn: async (): Promise<DesenhoTecnico[]> => {
      const { data, error } = await supabase
        .from('arquivos_vetoriais')
        .select(
          'id, modelo_perfil_id, arquivo_url, legenda, ordem, largura_mm, altura_mm, criado_em',
        )
        .eq('modelo_perfil_id', modeloPerfilId)
        .eq('tipo', 'imagem')
        .order('ordem')
        .order('criado_em')

      if (error) throw new Error(error.message)

      const registros = data as Omit<DesenhoTecnico, 'link'>[]

      // Um pedido só para todos os links, em vez de um por imagem.
      const links = await obterLinksTemporarios(
        BALDE_DESENHOS,
        registros.map((r) => r.arquivo_url),
      )

      return registros.map((registro) => ({
        ...registro,
        link: links.get(registro.arquivo_url) ?? null,
      }))
    },
  })
}

export function useAdicionarDesenho() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({
      modeloPerfilId,
      caminho,
      legenda,
      ordem,
    }: {
      modeloPerfilId: string
      caminho: string
      legenda: string | null
      ordem: number
    }) => {
      const { error } = await supabase.from('arquivos_vetoriais').insert({
        modelo_perfil_id: modeloPerfilId,
        tipo: 'imagem',
        arquivo_url: caminho,
        legenda,
        ordem,
        // `sanitizado` só importa para SVG importado, que é da Fase 2.
        // Imagem enviada pela câmera não executa nada.
        sanitizado: true,
      })

      if (error) throw new Error(error.message)
    },
    onSuccess: (_dados, variaveis) => {
      void cliente.invalidateQueries({
        queryKey: ['desenhos-tecnicos', variaveis.modeloPerfilId],
      })
    },
  })
}

export function useRemoverDesenho() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      caminho,
    }: {
      id: string
      caminho: string
      modeloPerfilId: string
    }) => {
      // Apaga o registro primeiro. Se a ordem fosse inversa e o banco
      // recusasse, ficaria um registro apontando para arquivo inexistente.
      const { error } = await supabase
        .from('arquivos_vetoriais')
        .delete()
        .eq('id', id)

      if (error) throw new Error(error.message)

      // O arquivo em si é secundário: se a remoção falhar, sobra um arquivo
      // órfão no Storage, o que é bem menos grave do que registro quebrado.
      try {
        await apagarImagem(BALDE_DESENHOS, caminho)
      } catch (e) {
        console.error('Registro removido, mas o arquivo permaneceu:', e)
      }
    },
    onSuccess: (_dados, variaveis) => {
      void cliente.invalidateQueries({
        queryKey: ['desenhos-tecnicos', variaveis.modeloPerfilId],
      })
    },
  })
}
