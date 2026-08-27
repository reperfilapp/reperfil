import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { chaves } from '@/lib/consultas'
import { mensagemDeErroDaFuncao } from '@/lib/erroDeFuncao'
import type { Organizacao } from '@/tipos/banco'
import {
  enviarLogoOrganizacao,
  apagarImagem,
  obterLinkTemporario,
  BALDE_LOGOS,
} from '@/lib/armazenamento'

/**
 * Dados editáveis da organização — só os campos que o formulário toca.
 *
 * `id` e `codigo` são imutáveis; `ativo`, `criado_em` e `atualizado_em`
 * são gerenciados pelo banco.
 */
export interface DadosOrganizacao {
  nome_fantasia: string
  razao_social: string
  cnpj: string
  inscricao_estadual: string
  telefone: string
  whatsapp: string
  email: string
  site: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  estado: string
  cep: string
}

/**
 * Lê os dados da organização do usuário logado.
 *
 * O RLS garante que só vem a organização correta — não é necessário
 * filtrar por id nem por organizacao_id.
 */
export function useOrganizacao() {
  return useQuery({
    queryKey: chaves.organizacao,
    queryFn: async (): Promise<Organizacao | null> => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!user) return null

      // Busca o organizacao_id do perfil do usuário...
      //
      // O `error` é checado, e não ignorado: engolindo-o, uma falha de
      // rede virava `perfil = null` e a consulta terminava "com sucesso"
      // devolvendo nulo — a tela de dados da empresa dizia "não foi
      // possível carregar" e ficava assim, porque o React Query não
      // repete uma consulta que não falhou. Lançando, o `retry` do
      // cliente entra em ação e o F5 deixa de ser a única saída.
      const { data: perfil, error: erroPerfil } = await supabase
        .from('perfis_usuario')
        .select('organizacao_id')
        .eq('id', user.id)
        .single<{ organizacao_id: string }>()

      if (erroPerfil) throw new Error(erroPerfil.message)

      if (!perfil) return null

      // ...e então busca a organização. O RLS já filtra pela correta,
      // mas o .eq garante que pegamos só a do usuário mesmo.
      const { data, error } = await supabase
        .from('organizacoes')
        .select('*')
        .eq('id', perfil.organizacao_id)
        .maybeSingle<Organizacao>()

      if (error) throw new Error(error.message)

      return data
    },
    // Dados da empresa mudam raramente; não precisa revalidar o tempo todo.
    staleTime: 5 * 60_000,
  })
}

/** Edita os dados textuais da organização. */
export function useEditarOrganizacao() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      dados,
    }: {
      id: string
      dados: DadosOrganizacao
    }): Promise<Organizacao> => {
      const { data, error } = await supabase
        .from('organizacoes')
        .update({
          nome_fantasia: dados.nome_fantasia.trim(),
          razao_social: dados.razao_social.trim() || null,
          cnpj: dados.cnpj.trim() || null,
          inscricao_estadual: dados.inscricao_estadual.trim() || null,
          telefone: dados.telefone.trim() || null,
          whatsapp: dados.whatsapp.trim() || null,
          email: dados.email.trim() || null,
          site: dados.site.trim() || null,
          logradouro: dados.logradouro.trim() || null,
          numero: dados.numero.trim() || null,
          complemento: dados.complemento.trim() || null,
          bairro: dados.bairro.trim() || null,
          cidade: dados.cidade.trim() || null,
          estado: dados.estado.trim() || null,
          cep: dados.cep.trim() || null,
        })
        .eq('id', id)
        .select()
        .single()

      if (error) throw new Error(error.message)

      return data as Organizacao
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.organizacao })
    },
  })
}

/** Envia um novo logo e salva o caminho na organização. */
export function useEnviarLogo() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      arquivo,
      caminhoAnterior,
    }: {
      id: string
      arquivo: File
      caminhoAnterior: string | null
    }): Promise<string> => {
      // Envia a imagem nova primeiro...
      const { caminho } = await enviarLogoOrganizacao(arquivo)

      // ...atualiza o registro...
      const { error } = await supabase
        .from('organizacoes')
        .update({ logo_caminho: caminho })
        .eq('id', id)

      if (error) {
        // Rollback: apaga o arquivo recém-enviado para não deixar lixo
        await apagarImagem(BALDE_LOGOS, caminho).catch(() => undefined)
        throw new Error(error.message)
      }

      // ...e remove o logo antigo, se existia.
      if (caminhoAnterior) {
        await apagarImagem(BALDE_LOGOS, caminhoAnterior).catch(() => undefined)
      }

      return caminho
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.organizacao })
    },
  })
}

/**
 * Gera o link temporário para o logo da organização.
 *
 * Separado de `useOrganizacao` para que a tela inicial carregue os dados
 * textuais rapidamente e a imagem apareça assim que o link estiver pronto —
 * em vez de bloquear o carregamento todo até o Storage responder.
 */
export function useLogoOrganizacao(caminho: string | null | undefined) {
  return useQuery({
    queryKey: ['logo-organizacao', caminho],
    queryFn: async (): Promise<string | null> => {
      if (!caminho) return null
      return obterLinkTemporario(BALDE_LOGOS, caminho)
    },
    enabled: Boolean(caminho),
    staleTime: 55 * 60_000, // link válido por 1h, revalida com 5min de folga
  })
}

/* ── Encerrar a empresa ──────────────────────────────────────────────────
 *
 * São dois papéis diferentes, e é por isso que são hooks separados:
 *
 *   O ADMINISTRADOR DA EMPRESA pede (`useSolicitarExclusao`) e pode
 *   desistir enquanto ninguém executou (`useCancelarExclusao`).
 *
 *   O ADMINISTRADOR DA CENTRAL vê os pedidos (`useEmpresasParaCentral`) e
 *   executa (`useExcluirEmpresa`).
 *
 * O pedido não apaga nada. É a única janela de arrependimento que existe:
 * depois que a central executa, não há backup dentro do aplicativo.
 */

export function useSolicitarExclusao() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async (motivo: string) => {
      const { error } = await supabase.rpc('solicitar_exclusao_organizacao', {
        p_motivo: motivo,
      })

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.organizacao })
    },
  })
}

export function useCancelarExclusao() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('cancelar_exclusao_organizacao')

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.organizacao })
    },
  })
}

/** Uma empresa como a organização central a vê. */
export interface EmpresaNaCentral {
  organizacao_id: string
  nome_fantasia: string
  criado_em: string
  colaboradores: number
  exclusao_solicitada_em: string | null
  exclusao_motivo: string | null
}

export function useEmpresasParaCentral() {
  return useQuery({
    queryKey: ['empresas-central'],
    queryFn: async (): Promise<EmpresaNaCentral[]> => {
      const { data, error } = await supabase.rpc('empresas_para_central')

      if (error) throw new Error(error.message)

      return data as EmpresaNaCentral[]
    },
  })
}

/**
 * Executa o encerramento — passa pela Edge Function, e não direto pela
 * RPC, porque apagar as linhas é só um terço do trabalho: os arquivos no
 * Storage e as contas em `auth.users` precisam da chave de serviço, que
 * não pode viver dentro do aplicativo.
 *
 * `confirmacao` é o nome da empresa digitado à mão. Conferido no servidor,
 * não só na tela: assim a barreira vale mesmo para quem chamar a função
 * por fora do app.
 */
export function useExcluirEmpresa() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({
      organizacaoId,
      confirmacao,
    }: {
      organizacaoId: string
      confirmacao: string
    }): Promise<{ contasApagadas: number }> => {
      const { data, error } = await supabase.functions.invoke<{
        ok: boolean
        error?: string
        contasApagadas: number
      }>('excluir-empresa', { body: { organizacaoId, confirmacao } })

      // A mensagem da função importa mais aqui do que em qualquer outra
      // tela: a falha mais provável é errar o nome digitado na
      // confirmação, e só a função sabe dizer qual é o nome esperado.
      if (error) {
        throw new Error(
          await mensagemDeErroDaFuncao(error, 'Não foi possível encerrar a empresa.'),
        )
      }

      if (!data?.ok) {
        throw new Error(data?.error ?? 'Não foi possível encerrar a empresa.')
      }

      return { contasApagadas: data.contasApagadas }
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: ['empresas-central'] })
    },
  })
}
