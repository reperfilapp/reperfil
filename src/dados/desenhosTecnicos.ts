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
 * As duas representações do perfil (ou do acessório), guardadas na mesma
 * tabela e distinguidas pelo `tipo`:
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
 * `arquivos_vetoriais` guarda imagens de mais de uma entidade — perfil e,
 * desde a galeria de acessórios, também acessório — cada uma na sua
 * própria coluna de FK (nunca as duas preenchidas na mesma linha, ver
 * `arquivo_de_uma_entidade_so` na migração). `EntidadeArquivo` diz qual das
 * duas, e para qual id, sem `GaleriaDesenhos` precisar conhecer os nomes
 * de coluna.
 */
export type TipoEntidadeArquivo = 'perfil' | 'acessorio'

export interface EntidadeArquivo {
  tipo: TipoEntidadeArquivo
  id: string
}

const COLUNA_FK: Record<TipoEntidadeArquivo, 'modelo_perfil_id' | 'modelo_acessorio_id'> = {
  perfil: 'modelo_perfil_id',
  acessorio: 'modelo_acessorio_id',
}

export interface DesenhoTecnico {
  id: string
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
  entidade: EntidadeArquivo | null,
  tipo: TipoImagemPerfil = 'imagem',
) {
  return useQuery({
    queryKey: ['imagens-arquivo', entidade?.tipo, entidade?.id, tipo],
    enabled: entidade !== null,
    queryFn: async (): Promise<DesenhoTecnico[]> => {
      const coluna = COLUNA_FK[entidade!.tipo]

      const { data, error } = await supabase
        .from('arquivos_vetoriais')
        .select(
          'id, arquivo_url, legenda, ordem, largura_mm, altura_mm, criado_em, embedding_ok, embedding_erro',
        )
        .eq(coluna, entidade!.id)
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
      entidade,
      caminho,
      legenda,
      ordem,
      tipo,
    }: {
      entidade: EntidadeArquivo
      caminho: string
      legenda: string | null
      ordem: number
      tipo: TipoImagemPerfil
    }) => {
      const { data, error } = await supabase
        .from('arquivos_vetoriais')
        .insert({
          [COLUNA_FK[entidade.tipo]]: entidade.id,
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
      // sem embedding até o próximo backfill manual. Acessório também
      // entra: a Edge Function já lida com os dois tipos de entidade.
      void supabase.functions
        .invoke('calcular-embedding-perfil', { body: { arquivoId: data.id } })
        .then(({ error: erroEmbedding }) => {
          if (erroEmbedding) {
            console.error('Não foi possível calcular o embedding do arquivo:', erroEmbedding)
          }
          // A função grava o status (ok ou erro) na própria linha — só
          // falta a galeria buscar de novo para mostrar o marcador certo.
          void cliente.invalidateQueries({ queryKey: ['imagens-arquivo'] })
        })
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: ['imagens-arquivo'] })
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
      void cliente.invalidateQueries({ queryKey: ['imagens-arquivo'] })
      void cliente.invalidateQueries({ queryKey: ['capas-perfil'] })
    },
  })
}

/**
 * Capa (primeiro desenho) de TODOS os perfis (ou acessórios), numa
 * consulta só.
 *
 * Buscar o desenho item a item na lista geraria uma ida ao servidor por
 * linha — dezenas por tela, na rede do depósito. Aqui é uma consulta para
 * os registros e um único pedido de links assinados para o lote inteiro
 * de imagens.
 */
export function useCapasDesenhos(
  tipo: TipoImagemPerfil = 'imagem',
  entidadeTipo: TipoEntidadeArquivo = 'perfil',
) {
  const { perfil } = useAutenticacao()
  const organizacaoId = perfil?.organizacao_id ?? null
  const coluna = COLUNA_FK[entidadeTipo]

  return useQuery({
    queryKey: ['capas-perfil', entidadeTipo, tipo, organizacaoId],
    enabled: organizacaoId !== null,
    queryFn: async (): Promise<Map<string, string>> => {
      // `.eq('organizacao_id', ...)` explícito pelo mesmo motivo de
      // `useModelosPerfil`: o catálogo central ficou visível por RLS para
      // quem sincroniza, e sem isto esta consulta trazia também as imagens
      // de lá, misturadas com as da própria organização.
      //
      // `.not(coluna, 'is', null)` filtra do lado do banco a entidade que
      // NÃO é esta — `arquivos_vetoriais` guarda perfil e acessório na
      // mesma tabela, e sem este filtro a consulta de perfil também
      // carregava (e contava para o limite de linhas) toda imagem de
      // acessório, e vice-versa.
      //
      // A PAGINAÇÃO existe porque o PostgREST devolve no máximo 1000 linhas
      // por página, sem avisar que cortou o resto. Uma organização com mais
      // de 1000 imagens perdia, em silêncio, a capa de quem ficasse fora da
      // primeira página — foi o que aconteceu depois que o catálogo de
      // acessórios passou de mil imagens: perfis sem nenhuma relação com
      // acessório ficaram sem miniatura, porque a paginação implícita do
      // servidor cortava a lista antes de chegar neles.
      const PAGINA = 1000
      const registros: { arquivo_url: string; [key: string]: string | null }[] =
        []

      for (let desde = 0; ; desde += PAGINA) {
        const { data, error } = await supabase
          .from('arquivos_vetoriais')
          .select(`${coluna}, arquivo_url, ordem`)
          .eq('organizacao_id', organizacaoId as string)
          .eq('tipo', tipo)
          .not(coluna, 'is', null)
          .order('ordem')
          .range(desde, desde + PAGINA - 1)

        if (error) throw new Error(error.message)

        const pagina = data as unknown as {
          arquivo_url: string
          [key: string]: string | null
        }[]

        registros.push(...pagina)

        if (pagina.length < PAGINA) break
      }

      /*
       * Todos os arquivos de cada item, na ordem — não só o primeiro.
       *
       * A capa continua sendo o primeiro, mas guardar a fila inteira
       * permite cair para o seguinte quando o primeiro não resolve. Um
       * registro pode apontar para arquivo que não existe mais (foi o que
       * aconteceu na Alumifort: a sincronização copia o registro com o
       * caminho da pasta do central, e apagar o perfil lá deixou as cópias
       * apontando para o vazio). Antes, um arquivo morto na frente escondia
       * um desenho bom logo atrás, e o item aparecia sem imagem nenhuma.
       */
      const filaDeCada = new Map<string, string[]>()
      for (const r of registros) {
        const entidadeId = r[coluna]
        if (!entidadeId) continue

        const fila = filaDeCada.get(entidadeId) ?? []
        fila.push(r.arquivo_url)
        filaDeCada.set(entidadeId, fila)
      }

      const capas = new Map<string, string>()
      /*
       * Uma rodada por posição da fila, e não uma por item: assinar tudo
       * de uma vez custaria links à toa para as galerias inteiras, e um
       * pedido por item seriam centenas de idas ao servidor. Na prática
       * a primeira rodada resolve quase tudo, e as seguintes só acontecem
       * enquanto sobrar item sem capa — nenhuma, quando não há arquivo
       * morto.
       */
      for (let posicao = 0; filaDeCada.size > capas.size; posicao++) {
        const candidatos = new Map<string, string>()

        for (const [itemId, fila] of filaDeCada) {
          const caminho = fila[posicao]
          if (!capas.has(itemId) && caminho) {
            candidatos.set(itemId, caminho)
          }
        }

        // Ninguém tem arquivo nesta posição: as filas acabaram.
        if (candidatos.size === 0) break

        const links = await obterLinksTemporarios(BALDE_DE[tipo], [
          ...candidatos.values(),
        ])

        for (const [itemId, caminho] of candidatos) {
          const link = links.get(caminho)
          if (link) capas.set(itemId, link)
        }
      }

      return capas
    },
    // O link assinado vale uma hora; renovar antes evita imagem quebrada.
    staleTime: 45 * 60_000,
  })
}
