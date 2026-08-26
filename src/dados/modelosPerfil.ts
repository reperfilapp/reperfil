import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { chaves } from '@/lib/consultas'
import { filtrarPerfis } from '@/dominio/buscaPerfil'
import { compararPorOrdemLinha } from '@/dominio/ordenacaoListas'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import type { ModeloPerfil } from '@/tipos/banco'

export interface DadosModeloPerfil {
  codigo: string
  descricao: string
  fabricante: string | null
  linha: string | null
  categoria: string | null
  aplicacao: string | null
  comprimento_barra_mm: number
  peso_por_metro_g: number | null
  preco_por_metro_centavos: number | null
  codigo_barras: string | null
  observacoes: string | null
  /**
   * Medidas da seção, em mm. As duas primeiras vêm calculadas do peso e do
   * desenho (`scripts/calcular-secao.mjs`) and podem ser corrigidas à mão; as
   * outras duas são cotas internas, que só saem medindo a peça.
   */
  largura_secao_mm: number | null
  altura_secao_mm: number | null
  medida_3_secao_mm: number | null
  medida_4_secao_mm: number | null
}

export const VAZIO: DadosModeloPerfil = {
  codigo: '',
  descricao: '',
  fabricante: null,
  linha: null,
  categoria: null,
  aplicacao: null,
  comprimento_barra_mm: 6000,
  peso_por_metro_g: null,
  preco_por_metro_centavos: null,
  codigo_barras: null,
  observacoes: null,
  largura_secao_mm: null,
  altura_secao_mm: null,
  medida_3_secao_mm: null,
  medida_4_secao_mm: null,
}

export function useModelosPerfil(incluirInativos = false) {
  const { perfil } = useAutenticacao()
  const organizacaoId = perfil?.organizacao_id ?? null

  return useQuery({
    queryKey: [...chaves.modelosPerfil, { incluirInativos, organizacaoId }],
    // Desde que a organização central passou a ficar visível por RLS (para
    // quem sincroniza o catálogo), o RLS sozinho não basta mais para isolar
    // "meus perfis" — sem o `.eq` explícito, esta consulta trazia também os
    // perfis do catálogo central inteiro, dobrando a contagem para quem já
    // copiou boa parte dele.
    enabled: organizacaoId !== null,
    queryFn: async (): Promise<ModeloPerfil[]> => {
      let consulta = supabase
        .from('modelos_perfil')
        .select('*')
        .eq('organizacao_id', organizacaoId as string)
        .order('codigo')

      if (!incluirInativos) {
        consulta = consulta.eq('ativo', true)
      }

      const { data, error } = await consulta

      if (error) throw new Error(error.message)

      return data as ModeloPerfil[]
    },
  })
}

/** Campos de texto livre que sugerem o que a organização já digitou. */
export type CampoSugerivel = 'aplicacao' | 'linha' | 'fabricante'

/**
 * Valores já usados num campo, nos perfis desta organização, sem repetir.
 *
 * Autoexpansível de propósito: em vez de um cadastro à parte para
 * administrar linhas e fabricantes, a lista de sugestões cresce sozinha
 * conforme as pessoas digitam. Ninguém precisa lembrar de cadastrar
 * "Suprema" antes de usar — usa uma vez, e a partir da segunda vez ela já
 * sugere. Continua sendo texto livre: digitar algo novo funciona sempre,
 * que é o que permite a lista crescer.
 */
export function useValoresUsados(campo: CampoSugerivel) {
  const { perfil } = useAutenticacao()
  const organizacaoId = perfil?.organizacao_id ?? null

  return useQuery({
    queryKey: [...chaves.modelosPerfil, 'valores-usados', campo, organizacaoId],
    enabled: organizacaoId !== null,
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('modelos_perfil')
        .select(campo)
        .eq('organizacao_id', organizacaoId as string)
        .not(campo, 'is', null)

      if (error) throw new Error(error.message)

      const distintos = new Set(
        (data as Record<string, string>[])
          .map((registro) => registro[campo]?.trim() ?? '')
          .filter((valor) => valor !== ''),
      )

      return [...distintos].sort((a, b) => a.localeCompare(b, 'pt-BR'))
    },
    // Muda pouco; não vale revalidar a cada troca de tela.
    staleTime: 5 * 60_000,
  })
}

/**
 * Linhas cadastradas, para agrupar a lista de perfis.
 *
 * Perfil sem linha não fica de fora: ele entra num grupo "Sem linha", senão
 * some da tela agrupada e a pessoa conclui que o cadastro se perdeu.
 */
export const SEM_LINHA = 'Sem linha'

/**
 * `ordemLinhas`, quando informada, é a ordem manual que o administrador
 * definiu em "Linhas e sistemas" — sem ela, cai no alfabético de sempre.
 */
export function agruparPorLinha(
  modelos: readonly ModeloPerfil[],
  ordemLinhas?: ReadonlyMap<string, number>,
): { linha: string; modelos: ModeloPerfil[] }[] {
  const grupos = new Map<string, ModeloPerfil[]>()

  for (const modelo of modelos) {
    const chave = modelo.linha?.trim() || SEM_LINHA
    const lista = grupos.get(chave) ?? []

    lista.push(modelo)
    grupos.set(chave, lista)
  }

  return [...grupos.entries()]
    .map(([linha, lista]) => ({ linha, modelos: lista }))
    .sort((a, b) => {
      // "Sem linha" por último: é o resto, não uma linha de verdade.
      if (a.linha === SEM_LINHA) return 1
      if (b.linha === SEM_LINHA) return -1

      return ordemLinhas
        ? compararPorOrdemLinha(a.linha, b.linha, ordemLinhas)
        : a.linha.localeCompare(b.linha, 'pt-BR')
    })
}

/**
 * Ordem manual GLOBAL das linhas — só a organização central define (em
 * "Linhas e sistemas"), e vale para o catálogo de qualquer empresa. Não é
 * "a minha ordem", é "a ordem do catálogo"; por isso a tabela não tem
 * `organizacao_id` nenhum. Base de toda ordenação por linha no app (a
 * lista de linhas em si; não mexe na ordem dos perfis dentro de uma linha
 * já aberta).
 */
export function useOrdemLinhas() {
  return useQuery({
    queryKey: ['ordem-linhas'],
    queryFn: async (): Promise<Map<string, number>> => {
      const { data, error } = await supabase
        .from('linhas_ordem')
        .select('linha, ordem')

      if (error) {
        // Antes da migração a tabela nem existe: cai no alfabético, que já
        // era o comportamento de sempre.
        if (error.code === '42P01') return new Map()
        throw new Error(error.message)
      }

      return new Map(
        (data as { linha: string; ordem: number }[]).map((r) => [
          r.linha,
          r.ordem,
        ]),
      )
    },
    staleTime: 60_000,
  })
}

/**
 * Grava a nova sequência de linhas, ao mover uma com as setas. Reescreve a
 * posição de TODAS as linhas passadas, e não só da que moveu — mas num
 * pedido só (upsert em lote), não um por linha: é o que faz isto responder
 * na hora mesmo num catálogo com muitas linhas.
 */
export function useReordenarLinhas() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async (linhasNaOrdem: readonly string[]) => {
      const { error } = await supabase.from('linhas_ordem').upsert(
        linhasNaOrdem.map((linha, indice) => ({ linha, ordem: indice + 1 })),
        { onConflict: 'linha' },
      )

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: ['ordem-linhas'] })
    },
  })
}

/**
 * Filtra modelos pelo que foi digitado, sem ir ao servidor.
 *
 * O catálogo de uma serralheria tem dezenas a poucas centenas de itens,
 * então cabe inteiro na memória. Filtrar localmente responde
 * instantaneamente enquanto a pessoa digita — importante no depósito, onde a
 * rede móvel costuma ser ruim.
 *
 * A REGRA de o que casa com o quê mora em `dominio/buscaPerfil`: código sem
 * hífen, código sem os zeros à esquerda e medidas em qualquer ordem. Fica
 * separada daqui porque é regra de negócio testável, e este arquivo é o que
 * fala com o banco.
 *
 * Se um dia um catálogo passar de alguns milhares, isto vira busca no banco
 * usando o índice `idx_modelos_perfil_busca`, que já existe.
 */
export function filtrarModelos(
  modelos: readonly ModeloPerfil[],
  termo: string,
): ModeloPerfil[] {
  return filtrarPerfis(modelos, termo)
}

/**
 * Renomeia uma linha em todos os perfis que a usam.
 *
 * A linha não é uma tabela: é texto gravado em cada perfil. Isso mantém o
 * cadastro simples — usar uma linha nova já é criá-la — mas deixa a porta
 * aberta para variações que na prática são a mesma coisa ("Fachada" e
 * "Fachada?" vieram assim da planilha importada). Esta função é a faxina:
 * renomear para um nome que já existe FUNDE as duas, porque passam a ser o
 * mesmo texto. É o comportamento desejado, e por isso a tela avisa antes.
 */
export function useRenomearLinha() {
  const cliente = useQueryClient()
  const { perfil } = useAutenticacao()
  const organizacaoId = perfil?.organizacao_id ?? null

  return useMutation({
    mutationFn: async ({
      de,
      para,
    }: {
      de: string
      para: string
    }): Promise<number> => {
      const novo = para.trim()

      if (novo === '') throw new Error('O nome da linha não pode ficar vazio.')

      if (organizacaoId === null) {
        throw new Error('Sessão expirada. Entre novamente.')
      }

      /*
       * O `.eq('organizacao_id', ...)` não é redundante.
       *
       * O RLS já barra escrita fora da própria organização — sem ele, esta
       * consulta ainda assim não conseguiria renomear a linha de ninguém.
       * Mas o `update ... where linha = 'X'`, sem mais nada, é uma frase
       * larga demais para o que ela quer dizer: "renomeie esta linha DA
       * MINHA empresa". Quem ler o código precisa ir conferir a política
       * no banco para ter certeza, e uma política mexida por engano numa
       * migração futura transformaria isto num renomeador global sem que
       * nada aqui mudasse.
       *
       * Vale mais ainda desde que `modelos_perfil` ganhou leitura
       * cross-organização (catálogo central): a tabela deixou de ser
       * "só a minha empresa" por natureza.
       */
      const { data, error } = await supabase
        .from('modelos_perfil')
        .update({ linha: novo })
        .eq('organizacao_id', organizacaoId as string)
        .eq('linha', de)
        .select('id')

      if (error) throw new Error(error.message)

      return (data as { id: string }[]).length
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.modelosPerfil })
    },
  })
}

/*
 * NÃO omita campos nulos do envio.
 *
 * Houve aqui uma função que tirava `medida_3_secao_mm` e
 * `medida_4_secao_mm` do envio quando vinham vazias. Ela existia por um
 * motivo real e temporário: antes da migração que criou essas colunas,
 * mandá-las fazia o banco recusar a gravação INTEIRA, e quem só queria
 * corrigir uma descrição levava um erro sobre coluna inexistente.
 *
 * O efeito colateral, porém, era grave e silencioso: APAGAR uma medida
 * virava impossível. O campo era limpo na tela, o envio não levava a
 * coluna, o banco mantinha o valor antigo — e ele reaparecia depois de
 * salvar, como se a edição tivesse sido ignorada. Quem corrigiu uma medida
 * errada acreditava ter corrigido.
 *
 * A migração está aplicada desde 18/08/2026. Nulo agora significa nulo.
 */

/**
 * Traduz o erro de coluna inexistente para o que a pessoa pode fazer.
 *
 * Quando a migração das medidas extras ainda não foi aplicada, o Supabase
 * devolve algo como "Could not find the 'medida_3_secao_mm' column of
 * 'modelos_perfil' in the schema cache" — em inglês, falando de cache de
 * esquema. Quem está no depósito com a peça na mão não tem como saber que
 * isso quer dizer "falta rodar um SQL no banco", nem que as outras medidas
 * teriam gravado normalmente.
 */
function traduzirErro(mensagem: string): string {
  if (/medida_[34]_secao_mm/.test(mensagem)) {
    return (
      'A terceira e a quarta medida ainda não existem no banco desta ' +
      'organização. Peça para aplicar a migração ' +
      '20260817220000_medidas_extras_da_secao.sql. Até lá, o perfil grava ' +
      'normalmente com as outras informações — deixe esses dois campos em branco.'
    )
  }

  if (
    /column "revisado" of relation "modelos_perfil" does not exist/.test(
      mensagem,
    ) ||
    /revisado/.test(mensagem)
  ) {
    return (
      'O campo de Revisão ainda não existe no banco desta organização. ' +
      'Peça para aplicar a migração 20260822134000_perfil_revisado.sql.'
    )
  }

  return mensagem
}

export function useCriarModeloPerfil() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async (dados: DadosModeloPerfil): Promise<ModeloPerfil> => {
      const { data, error } = await supabase
        .from('modelos_perfil')
        .insert(dados)
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          throw new Error(
            `Já existe um perfil com o código ${dados.codigo}. O código interno precisa ser único.`,
          )
        }
        throw new Error(traduzirErro(error.message))
      }

      return data as ModeloPerfil
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.modelosPerfil })
    },
  })
}

export function useEditarModeloPerfil() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      dados,
    }: {
      id: string
      dados: Partial<DadosModeloPerfil>
    }): Promise<ModeloPerfil> => {
      const { data, error } = await supabase
        .from('modelos_perfil')
        .update(dados)
        .eq('id', id)
        .select()
        .single()

      if (error) {
        if (error.code === '23505') {
          throw new Error('Já existe um perfil com este código.')
        }
        throw new Error(traduzirErro(error.message))
      }

      return data as ModeloPerfil
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.modelosPerfil })
    },
  })
}

export function useDesativarModeloPerfil() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('modelos_perfil')
        .update({ ativo })
        .eq('id', id)

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.modelosPerfil })
    },
  })
}

/**
 * Apaga o perfil de verdade — não desativa.
 *
 * Só faz sentido oferecer isto quando a tela já confirmou, com os dados que
 * tem em mãos, que nenhuma sobra e nenhuma lista técnica apontam para o
 * perfil: o banco tem `on delete restrict` nas duas tabelas de propósito, e a
 * mensagem de erro (código 23503) é o segundo cinto de segurança, para o caso
 * de outra pessoa ter cadastrado uma sobra no minuto entre a tela carregar e
 * o toque no botão.
 */
export function useExcluirModeloPerfil() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('modelos_perfil')
        .delete()
        .eq('id', id)

      if (error) {
        if (error.code === '23503') {
          throw new Error(
            'Este perfil está em uso — no estoque ou em uma lista técnica — e não pode ser apagado. Desative-o em vez disso.',
          )
        }
        throw new Error(error.message)
      }
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.modelosPerfil })
    },
  })
}

/**
 * Marca a revisão de um perfil — mesma ação nas duas situações, só muda o
 * que acontece por baixo:
 *
 * • Perfil ainda não revisado: vira revisado, com data e quem revisou.
 * • Perfil já revisado (uma nova revisão, depois de editar de novo):
 *   atualiza data e quem revisou, e — só quando o perfil é do catálogo
 *   CENTRAL — avança a revisão do catálogo, avisando quem já copiou.
 */
export function useMarcarRevisaoPerfil() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async (perfilId: string) => {
      const { error } = await supabase.rpc('marcar_revisao_perfil', {
        p_perfil_id: perfilId,
      })

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.modelosPerfil })
    },
  })
}

export interface ResultadoSincronizacao {
  perfis_novos: number
  perfis_atualizados: number
  imagens_novas: number
}

/**
 * Traz perfis novos do catálogo central e atualiza os já copiados que
 * ficaram para trás — os dois de uma vez. O botão "Atualizar" de um
 * perfil só e o botão "Atualização geral" da lista chamam esta mesma
 * função: sincronizar tudo de novo é inofensivo, e mais simples do que
 * manter uma versão "só este perfil".
 *
 * Desenho técnico PREVALECE o do central numa atualização (apaga
 * duplicado ou desatualizado e recoloca o de lá); foto só ACRESCENTA,
 * nunca apaga — é a empresa quem fotografa a peça por conta própria.
 */
/**
 * `linha` omitida (ou `undefined`) sincroniza o catálogo inteiro — o botão
 * "Atualização geral". Informada, sincroniza só aquela linha: tanto para
 * atualizar uma que já existe localmente quanto para importar uma que a
 * empresa ainda não tem nenhum perfil.
 */
export function useSincronizarCatalogoCentral() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async (
      linha?: string,
    ): Promise<ResultadoSincronizacao> => {
      const { data, error } = await supabase
        .rpc('sincronizar_catalogo_central', { p_linha: linha ?? null })
        .single()

      if (error) throw new Error(error.message)

      return data as ResultadoSincronizacao
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.modelosPerfil })
    },
  })
}

/**
 * Uma linha do catálogo central e se a MINHA organização está liberada
 * para ela — o que `disponivel` significa depende de quem pergunta: para
 * a organização central, é sempre `true` (ela é a dona); para as demais,
 * é a liberação específica daquela empresa.
 */
export interface LinhaCatalogoCentral {
  linha: string
  disponivel: boolean
}

/**
 * Linhas que existem hoje no catálogo central, com a liberação de cada
 * uma para a MINHA organização — alimenta o seletor de "sincronizar esta
 * linha" nas demais empresas.
 */
export function useLinhasCatalogoCentral() {
  return useQuery({
    queryKey: ['linhas-catalogo-central'],
    queryFn: async (): Promise<LinhaCatalogoCentral[]> => {
      const { data, error } = await supabase.rpc('linhas_do_catalogo_central')

      if (error) throw new Error(error.message)

      return data as LinhaCatalogoCentral[]
    },
    staleTime: 60_000,
  })
}

/** Uma empresa e se está liberada para uma linha específica do catálogo. */
export interface OrganizacaoLiberacaoLinha {
  organizacao_id: string
  nome_fantasia: string
  liberada: boolean
}

/**
 * As empresas (menos a própria central) e se cada uma está liberada para
 * `linha` — alimenta a lista dentro de "Editar linha", em Linhas e
 * sistemas. Só quem administra a organização central chama isto de
 * verdade (a função recusa qualquer outra).
 */
export function useOrganizacoesParaLiberacao(linha: string | null) {
  return useQuery({
    queryKey: ['organizacoes-liberacao-linha', linha],
    enabled: linha !== null,
    queryFn: async (): Promise<OrganizacaoLiberacaoLinha[]> => {
      const { data, error } = await supabase.rpc('organizacoes_para_liberacao', {
        p_linha: linha,
      })

      if (error) throw new Error(error.message)

      return data as OrganizacaoLiberacaoLinha[]
    },
  })
}

/** Liga ou desliga UMA empresa para UMA linha. Só a organização central chama. */
export function useDefinirLiberacaoLinha() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({
      linha,
      organizacaoId,
      liberada,
    }: {
      linha: string
      organizacaoId: string
      liberada: boolean
    }) => {
      const { error } = await supabase.rpc('definir_liberacao_linha', {
        p_linha: linha,
        p_organizacao_id: organizacaoId,
        p_liberada: liberada,
      })

      if (error) throw new Error(error.message)
    },
    onSuccess: (_dados, variaveis) => {
      void cliente.invalidateQueries({
        queryKey: ['organizacoes-liberacao-linha', variaveis.linha],
      })
      void cliente.invalidateQueries({ queryKey: ['linhas-catalogo-central'] })
      // A mesma liberação também aparece agrupada por empresa, em
      // "Administrar linhas por empresa" — as duas telas leem e escrevem a
      // mesma tabela, então uma mudança aqui precisa aparecer lá também.
      void cliente.invalidateQueries({ queryKey: ['linhas-organizacao'] })
    },
  })
}

/**
 * Liga ou desliga TODAS as empresas de uma vez, para UMA linha — o atalho
 * "liberar/bloquear para todas" dentro de "Editar linha".
 */
export function useDefinirLiberacaoLinhaTodas() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({
      linha,
      liberada,
    }: {
      linha: string
      liberada: boolean
    }) => {
      const { error } = await supabase.rpc('definir_liberacao_linha_todas', {
        p_linha: linha,
        p_liberada: liberada,
      })

      if (error) throw new Error(error.message)
    },
    onSuccess: (_dados, variaveis) => {
      void cliente.invalidateQueries({
        queryKey: ['organizacoes-liberacao-linha', variaveis.linha],
      })
      void cliente.invalidateQueries({ queryKey: ['linhas-catalogo-central'] })
      void cliente.invalidateQueries({ queryKey: ['linhas-organizacao'] })
    },
  })
}

/** Uma empresa que pode receber linhas do catálogo central. */
export interface EmpresaParaAdministrarLinhas {
  organizacao_id: string
  nome_fantasia: string
}

/**
 * As empresas (menos a própria central) para a tela "Administrar linhas
 * por empresa" — o outro ângulo da mesma liberação de `useOrganizacoesParaLiberacao`,
 * agora por empresa em vez de por linha.
 */
export function useEmpresasParaAdministrarLinhas() {
  return useQuery({
    queryKey: ['empresas-administrar-linhas'],
    queryFn: async (): Promise<EmpresaParaAdministrarLinhas[]> => {
      const { data, error } = await supabase.rpc(
        'empresas_para_administrar_linhas',
      )

      if (error) throw new Error(error.message)

      return data as EmpresaParaAdministrarLinhas[]
    },
  })
}

/** Uma linha do catálogo central e se está liberada para UMA empresa específica. */
export interface LinhaParaOrganizacao {
  linha: string
  liberada: boolean
}

/**
 * Todas as linhas do catálogo central, com a liberação de UMA empresa —
 * alimenta a lista de linhas dentro de "Administrar linhas por empresa",
 * depois de escolher a empresa.
 */
export function useLinhasParaOrganizacao(organizacaoId: string | null) {
  return useQuery({
    queryKey: ['linhas-organizacao', organizacaoId],
    enabled: organizacaoId !== null,
    queryFn: async (): Promise<LinhaParaOrganizacao[]> => {
      const { data, error } = await supabase.rpc('linhas_para_organizacao', {
        p_organizacao_id: organizacaoId,
      })

      if (error) throw new Error(error.message)

      return data as LinhaParaOrganizacao[]
    },
  })
}

/**
 * Liga ou desliga TODAS as linhas de uma vez, para UMA empresa — o atalho
 * "Liberar/Bloquear todas as linhas" dentro de "Administrar linhas por
 * empresa".
 */
export function useDefinirLiberacaoTodasLinhasOrganizacao() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({
      organizacaoId,
      liberada,
    }: {
      organizacaoId: string
      liberada: boolean
    }) => {
      const { error } = await supabase.rpc(
        'definir_liberacao_todas_linhas_organizacao',
        { p_organizacao_id: organizacaoId, p_liberada: liberada },
      )

      if (error) throw new Error(error.message)
    },
    onSuccess: (_dados, variaveis) => {
      void cliente.invalidateQueries({
        queryKey: ['linhas-organizacao', variaveis.organizacaoId],
      })
      void cliente.invalidateQueries({ queryKey: ['organizacoes-liberacao-linha'] })
      void cliente.invalidateQueries({ queryKey: ['linhas-catalogo-central'] })
    },
  })
}

/**
 * A revisão ATUAL do perfil de origem, no catálogo central — para saber
 * se uma cópia local ficou desatualizada. `null` quando o perfil não veio
 * de lá (não foi copiado do catálogo central).
 */
export function useRevisaoCentralAtual(origemPerfilId: string | null) {
  return useQuery({
    queryKey: [...chaves.modelosPerfil, 'revisao-central', origemPerfilId],
    enabled: origemPerfilId !== null,
    queryFn: async (): Promise<number | null> => {
      const { data, error } = await supabase
        .from('modelos_perfil')
        .select('revisao_catalogo')
        .eq('id', origemPerfilId)
        .maybeSingle<{ revisao_catalogo: number }>()

      if (error) throw new Error(error.message)

      return data?.revisao_catalogo ?? null
    },
  })
}
