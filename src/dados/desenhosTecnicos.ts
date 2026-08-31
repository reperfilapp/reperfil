import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import {
  obterLinksTemporarios,
  apagarImagem,
  BALDE_DESENHOS,
  BALDE_FOTOS_PERFIL,
} from '@/lib/armazenamento'

/**
 * As duas representações do perfil, guardadas na mesma tabela e distinguidas
 * pelo `tipo`:
 *
 *   imagem  desenho técnico ou página de catálogo, com as cotas
 *   foto    fotografia da peça real
 *
 * A Fase 2 acrescenta `secao_svg` e `secao_dxf` ao lado destas.
 */
export type TipoImagemPerfil = 'imagem' | 'foto'

const BALDE_DE: Record<TipoImagemPerfil, string> = {
  imagem: BALDE_DESENHOS,
  foto: BALDE_FOTOS_PERFIL,
}

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
  /** true quando a busca visual por foto já enxerga este arquivo. */
  embedding_ok: boolean
  /** Mensagem da última falha ao calcular, se houver. */
  embedding_erro: string | null
}

export function useDesenhosTecnicos(
  modeloPerfilId: string | null,
  tipo: TipoImagemPerfil = 'imagem',
) {
  return useQuery({
    queryKey: ['imagens-perfil', tipo, modeloPerfilId],
    enabled: modeloPerfilId !== null,
    queryFn: async (): Promise<DesenhoTecnico[]> => {
      const { data, error } = await supabase
        .from('arquivos_vetoriais')
        .select(
          'id, modelo_perfil_id, arquivo_url, legenda, ordem, largura_mm, altura_mm, criado_em, embedding_ok, embedding_erro',
        )
        .eq('modelo_perfil_id', modeloPerfilId)
        .eq('tipo', tipo)
        .order('ordem')
        .order('criado_em')

      if (error) throw new Error(error.message)

      const registros = data as Omit<DesenhoTecnico, 'link'>[]

      // Um pedido só para todos os links, em vez de um por imagem.
      const links = await obterLinksTemporarios(
        BALDE_DE[tipo],
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
      tipo,
    }: {
      modeloPerfilId: string
      caminho: string
      legenda: string | null
      ordem: number
      tipo: TipoImagemPerfil
    }) => {
      const { data, error } = await supabase
        .from('arquivos_vetoriais')
        .insert({
          modelo_perfil_id: modeloPerfilId,
          tipo,
          arquivo_url: caminho,
          legenda,
          ordem,
          // `sanitizado` só importa para SVG importado, que é da Fase 2.
          // Imagem enviada pela câmera não executa nada.
          sanitizado: true,
        })
        .select('id')
        .single()

      if (error) throw new Error(error.message)

      // Dispara e esquece: a busca visual por foto é um extra, não algo
      // que o cadastro do desenho deva esperar ou que possa travá-lo. Se
      // falhar (rede, Cohere fora do ar), o pior caso é este arquivo ficar
      // sem embedding até o próximo backfill manual.
      void supabase.functions
        .invoke('calcular-embedding-perfil', { body: { arquivoId: data.id } })
        .then(({ error: erroEmbedding }) => {
          if (erroEmbedding) {
            console.error('Não foi possível calcular o embedding do arquivo:', erroEmbedding)
          }
          // A função grava o status (ok ou erro) na própria linha — só
          // falta a galeria buscar de novo para mostrar o marcador certo.
          void cliente.invalidateQueries({ queryKey: ['imagens-perfil'] })
        })
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: ['imagens-perfil'] })
      void cliente.invalidateQueries({ queryKey: ['capas-perfil'] })
    },
  })
}

export function useRemoverDesenho() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      caminho,
      tipo,
    }: {
      id: string
      caminho: string
      modeloPerfilId: string
      tipo: TipoImagemPerfil
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
        await apagarImagem(BALDE_DE[tipo], caminho)
      } catch (e) {
        console.error('Registro removido, mas o arquivo permaneceu:', e)
      }
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: ['imagens-perfil'] })
      void cliente.invalidateQueries({ queryKey: ['capas-perfil'] })
    },
  })
}

/**
 * Capa (primeiro desenho) de TODOS os perfis, numa consulta só.
 *
 * Buscar o desenho perfil a perfil na lista de estoque geraria uma ida ao
 * servidor por linha — dezenas por tela, na rede do depósito. Aqui é uma
 * consulta para os registros e um único pedido de links assinados para o
 * lote inteiro de imagens.
 */
export function useCapasDesenhos(tipo: TipoImagemPerfil = 'imagem') {
  const { perfil } = useAutenticacao()
  const organizacaoId = perfil?.organizacao_id ?? null

  return useQuery({
    queryKey: ['capas-perfil', tipo, organizacaoId],
    enabled: organizacaoId !== null,
    queryFn: async (): Promise<Map<string, string>> => {
      // `.eq('organizacao_id', ...)` explícito pelo mesmo motivo de
      // `useModelosPerfil`: o catálogo central ficou visível por RLS para
      // quem sincroniza, e sem isto esta consulta trazia também as imagens
      // de lá, misturadas com as da própria organização.
      const { data, error } = await supabase
        .from('arquivos_vetoriais')
        .select('modelo_perfil_id, arquivo_url, ordem')
        .eq('organizacao_id', organizacaoId as string)
        .eq('tipo', tipo)
        .order('ordem')

      if (error) throw new Error(error.message)

      const registros = data as {
        modelo_perfil_id: string | null
        arquivo_url: string
      }[]

      /*
       * Todos os arquivos de cada perfil, na ordem — não só o primeiro.
       *
       * A capa continua sendo o primeiro, mas guardar a fila inteira
       * permite cair para o seguinte quando o primeiro não resolve. Um
       * registro pode apontar para arquivo que não existe mais (foi o que
       * aconteceu na Alumifort: a sincronização copia o registro com o
       * caminho da pasta do central, e apagar o perfil lá deixou as cópias
       * apontando para o vazio). Antes, um arquivo morto na frente escondia
       * um desenho bom logo atrás, e o perfil aparecia sem imagem nenhuma.
       */
      const filaDeCada = new Map<string, string[]>()
      for (const r of registros) {
        if (!r.modelo_perfil_id) continue

        const fila = filaDeCada.get(r.modelo_perfil_id) ?? []
        fila.push(r.arquivo_url)
        filaDeCada.set(r.modelo_perfil_id, fila)
      }

      const capas = new Map<string, string>()
      /*
       * Uma rodada por posição da fila, e não uma por perfil: assinar tudo
       * de uma vez custaria links à toa para as galerias inteiras, e um
       * pedido por perfil seriam centenas de idas ao servidor. Na prática
       * a primeira rodada resolve quase tudo, e as seguintes só acontecem
       * enquanto sobrar perfil sem capa — nenhuma, quando não há arquivo
       * morto.
       */
      for (let posicao = 0; filaDeCada.size > capas.size; posicao++) {
        const candidatos = new Map<string, string>()

        for (const [perfilId, fila] of filaDeCada) {
          const caminho = fila[posicao]
          if (!capas.has(perfilId) && caminho) {
            candidatos.set(perfilId, caminho)
          }
        }

        // Ninguém tem arquivo nesta posição: as filas acabaram.
        if (candidatos.size === 0) break

        const links = await obterLinksTemporarios(BALDE_DE[tipo], [
          ...candidatos.values(),
        ])

        for (const [perfilId, caminho] of candidatos) {
          const link = links.get(caminho)
          if (link) capas.set(perfilId, link)
        }
      }

      return capas
    },
    // O link assinado vale uma hora; renovar antes evita imagem quebrada.
    staleTime: 45 * 60_000,
  })
}
