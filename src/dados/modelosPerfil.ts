import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { chaves } from '@/lib/consultas'
import { filtrarPerfis } from '@/dominio/buscaPerfil'
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
  return useQuery({
    queryKey: [...chaves.modelosPerfil, { incluirInativos }],
    queryFn: async (): Promise<ModeloPerfil[]> => {
      let consulta = supabase.from('modelos_perfil').select('*').order('codigo')

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
  return useQuery({
    queryKey: [...chaves.modelosPerfil, 'valores-usados', campo],
    queryFn: async (): Promise<string[]> => {
      const { data, error } = await supabase
        .from('modelos_perfil')
        .select(campo)
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

export function agruparPorLinha(
  modelos: readonly ModeloPerfil[],
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
      return a.linha.localeCompare(b.linha, 'pt-BR')
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

      const { data, error } = await supabase
        .from('modelos_perfil')
        .update({ linha: novo })
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
export function useSincronizarCatalogoCentral() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async (): Promise<ResultadoSincronizacao> => {
      const { data, error } = await supabase
        .rpc('sincronizar_catalogo_central')
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
