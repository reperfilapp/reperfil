import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { chaves } from '@/lib/consultas'
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
