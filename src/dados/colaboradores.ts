import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { chaves } from '@/lib/consultas'
import { permissoesIniciais, type Permissoes } from '@/dominio/cargos'
import { apenasDigitos } from '@/dominio/documentos'
import type {
  ConviteColaborador,
  PapelUsuario,
  PerfilUsuario,
} from '@/tipos/banco'

/**
 * A equipe.
 *
 * Quem está desligado fica FORA por padrão: a lista serve para o dia a dia,
 * e ex-colaborador no meio dela é ruído que cresce com o tempo. A tela tem
 * um botão para trazê-los quando a pergunta for outra.
 */
export function useColaboradores(incluirInativos = false) {
  return useQuery({
    queryKey: [...chaves.colaboradores, { incluirInativos }],
    queryFn: async (): Promise<PerfilUsuario[]> => {
      let consulta = supabase.from('perfis_usuario').select('*')

      if (!incluirInativos) consulta = consulta.eq('ativo', true)

      const { data, error } = await consulta
        .order('ativo', { ascending: false })
        .order('nome')

      if (error) throw new Error(error.message)

      return data as PerfilUsuario[]
    },
  })
}

/** Convites que ainda não viraram conta. */
export function useConvitesAbertos() {
  return useQuery({
    queryKey: chaves.convites,
    queryFn: async (): Promise<ConviteColaborador[]> => {
      const { data, error } = await supabase
        .from('convites_colaborador')
        .select('*')
        .is('aceito_em', null)
        .order('criado_em', { ascending: false })

      if (error) throw new Error(error.message)

      return data as ConviteColaborador[]
    },
  })
}

export interface DadosConvite {
  /** Vem do perfil de quem está convidando — a tela já o tem em mãos. */
  organizacao_id: string
  nome: string
  email: string
  papel: PapelUsuario
  telefone: string | null
}

/**
 * Registra o convite. Quem cria a conta é o colaborador.
 *
 * Criar usuário direto exigiria a chave de administração do projeto, que
 * não pode viajar dentro do aplicativo — extraída do celular, ela abre o
 * banco inteiro. Então o convite é a autorização, e o gatilho
 * `vincular_convite` no banco é quem transforma o cadastro do colaborador
 * em acesso à organização certa, no cargo certo.
 */
export function useConvidarColaborador() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async (dados: DadosConvite): Promise<ConviteColaborador> => {
      const email = dados.email.trim().toLowerCase()

      const { data, error } = await supabase
        .from('convites_colaborador')
        .insert({
          organizacao_id: dados.organizacao_id,
          nome: dados.nome.trim(),
          email,
          papel: dados.papel,
          telefone: dados.telefone,
        })
        .select()
        .single()

      if (error) {
        // 23505 é a unicidade do índice de convite aberto por e-mail.
        if (error.code === '23505') {
          throw new Error(
            `Já existe um convite aberto para ${email}. Cancele o antigo se quiser mudar o cargo.`,
          )
        }
        throw new Error(error.message)
      }

      return data as ConviteColaborador
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.convites })
    },
  })
}

export function useCancelarConvite() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('convites_colaborador')
        .delete()
        .eq('id', id)

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.convites })
    },
  })
}

/**
 * Reenvia um convite pendente — ou corrige e-mail, nome, telefone ou cargo
 * antes de reenviar.
 *
 * "Reenviar" não é mandar o mesmo e-mail de novo: é apagar o convite antigo
 * e criar outro com os dados (iguais ou corrigidos), porque o e-mail de
 * convite só dispara no INSERT da tabela. A função `reenviar_convite` no
 * banco faz as duas partes na mesma transação, então nunca fica sem convite
 * nenhum no meio do caminho.
 */
export function useReenviarConvite() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      dados,
    }: {
      id: string
      dados: Omit<DadosConvite, 'organizacao_id'>
    }): Promise<ConviteColaborador> => {
      const { data, error } = await supabase.rpc('reenviar_convite', {
        p_id: id,
        p_nome: dados.nome.trim(),
        p_email: dados.email.trim().toLowerCase(),
        p_papel: dados.papel,
        p_telefone: dados.telefone,
      })

      if (error) throw new Error(error.message)

      return data as ConviteColaborador
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.convites })
    },
  })
}

/**
 * Espera até alguns segundos pela confirmação de que o e-mail de convite
 * realmente saiu (`email_enviado_em`), em vez de só supor que deu certo
 * porque o convite foi gravado — o envio é assíncrono, por um Database
 * Webhook. `false` no fim do prazo não é necessariamente falha: só quer
 * dizer que a confirmação não chegou a tempo.
 */
export async function aguardarConfirmacaoDeEnvio(
  conviteId: string,
  tentativas = 8,
  intervaloMs = 1000,
): Promise<boolean> {
  for (let i = 0; i < tentativas; i++) {
    const { data } = await supabase
      .from('convites_colaborador')
      .select('email_enviado_em')
      .eq('id', conviteId)
      .maybeSingle()

    if (data?.email_enviado_em) return true

    await new Promise((resolve) => setTimeout(resolve, intervaloMs))
  }

  return false
}

/**
 * Troca o cargo e, com ele, as permissões.
 *
 * Mudar o cargo REESCREVE as permissões pelo padrão do cargo novo, em vez
 * de preservar o que estava marcado. Quem promove um auxiliar a gerente
 * espera que ele passe a poder o que um gerente pode — manter os ajustes
 * antigos deixaria a pessoa num estado que ninguém escolheu e que não
 * corresponde a cargo nenhum. Ajuste fino é assunto da tela de permissões,
 * feito depois e de propósito.
 */
export function useTrocarCargo() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, papel }: { id: string; papel: PapelUsuario }) => {
      const { error } = await supabase
        .from('perfis_usuario')
        .update({ papel, ...permissoesIniciais(papel) })
        .eq('id', id)

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.colaboradores })
    },
  })
}

/**
 * Liga e desliga o acesso.
 *
 * Desligar não apaga: o histórico de movimentações aponta para o perfil, e
 * apagar a pessoa deixaria "quem cadastrou esta peça?" sem resposta. Além
 * disso, quem sai da empresa às vezes volta.
 */
export function useAtivarColaborador() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('perfis_usuario')
        .update({ ativo })
        .eq('id', id)

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.colaboradores })
    },
  })
}

/**
 * Marca e desmarca uma permissão, sem tocar no cargo.
 *
 * É o que resolve o caso concreto que originou a tela: autorizar o
 * financeiro a cadastrar colaborador sem promovê-lo a administrador do
 * sistema. O cargo continua descrevendo o que a pessoa faz na empresa; a
 * permissão descreve o que o sistema deixa ela fazer.
 */
export function useAjustarPermissoes() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      permissoes,
    }: {
      id: string
      permissoes: Partial<Permissoes>
    }) => {
      const { error } = await supabase
        .from('perfis_usuario')
        .update(permissoes)
        .eq('id', id)

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.colaboradores })
    },
  })
}

/** Um colaborador só, para a tela de detalhe. */
export function useColaborador(id: string | null) {
  return useQuery({
    queryKey: [...chaves.colaboradores, 'um', id],
    enabled: id !== null,
    queryFn: async (): Promise<PerfilUsuario | null> => {
      const { data, error } = await supabase
        .from('perfis_usuario')
        .select('*')
        .eq('id', id)
        .maybeSingle()

      if (error) throw new Error(error.message)

      return data as PerfilUsuario | null
    },
  })
}

/** Os últimos acessos de uma pessoa, do mais recente para o mais antigo. */
export function useAcessos(usuarioId: string | null, quantos = 10) {
  return useQuery({
    queryKey: [...chaves.acessos, usuarioId, quantos],
    enabled: usuarioId !== null,
    queryFn: async (): Promise<{ id: string; criado_em: string }[]> => {
      const { data, error } = await supabase
        .from('acessos_sistema')
        .select('id, criado_em')
        .eq('usuario_id', usuarioId)
        .order('criado_em', { ascending: false })
        .limit(quantos)

      if (error) {
        // Antes da migração a tabela nem existe. Uma tela inteira em branco
        // por causa de uma seção secundária seria desproporcional — a lista
        // vazia já diz "sem acessos registrados".
        if (error.code === '42P01') return []
        throw new Error(error.message)
      }

      return data as { id: string; criado_em: string }[]
    },
  })
}

/** Dados que o próprio colaborador ou quem o administra podem corrigir. */
export interface DadosColaborador {
  nome: string
  telefone: string | null
  cpf: string | null
  foto_url?: string | null
  /** Nome de usuário alternativo para entrar. `undefined` = não mexe nele. */
  apelido?: string | null
}

export function useEditarColaborador() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      dados,
    }: {
      id: string
      dados: DadosColaborador
    }) => {
      const { error } = await supabase
        .from('perfis_usuario')
        .update({
          nome: dados.nome.trim(),
          telefone: dados.telefone,
          // Só dígitos: a pontuação é da tela, e guardá-la faria o mesmo
          // CPF ter duas formas diferentes no banco.
          cpf: dados.cpf ? apenasDigitos(dados.cpf) : null,
          ...(dados.foto_url === undefined ? {} : { foto_url: dados.foto_url }),
          ...(dados.apelido === undefined
            ? {}
            : {
                apelido: dados.apelido
                  ? dados.apelido.trim().toLowerCase()
                  : null,
              }),
        })
        .eq('id', id)

      if (error) {
        // 23505 é a unicidade do nickname dentro da mesma organização.
        if (error.code === '23505') {
          throw new Error(
            `Já existe um colaborador com o nickname "${dados.apelido}" nesta empresa.`,
          )
        }
        throw new Error(error.message)
      }
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.colaboradores })
    },
  })
}

/**
 * Manda ao colaborador o e-mail para ele mesmo criar uma senha nova.
 *
 * NÃO é o administrador definindo a senha de outra pessoa. Fazer isso
 * exigiria a chave de administração do projeto dentro do aplicativo — a
 * mesma que impede criar contas por aqui — e, mesmo que fosse possível,
 * significaria alguém conhecendo a senha alheia. O administrador dispara o
 * processo; quem escolhe a senha continua sendo o dono dela.
 */
export function useEnviarRedefinicaoDeSenha() {
  return useMutation({
    mutationFn: async (email: string) => {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/definir-senha`,
      })

      if (error) throw new Error(error.message)
    },
  })
}

/**
 * Anota que a pessoa entrou.
 *
 * Falha em silêncio de propósito: se o registro do acesso desse erro, a
 * pessoa seria impedida de trabalhar por causa de uma estatística. O acesso
 * em si já aconteceu — o que se perde é uma linha num histórico.
 */
export async function registrarAcesso(
  usuarioId: string,
  organizacaoId: string,
): Promise<void> {
  await supabase
    .from('acessos_sistema')
    .insert({ usuario_id: usuarioId, organizacao_id: organizacaoId })
}

/**
 * Apaga os dados pessoais da própria conta, desativa o acesso E libera o
 * e-mail de login para um convite futuro.
 *
 * Não apaga a linha (o histórico de estoque aponta para este id). Passa
 * pela Edge Function `excluir-conta` porque liberar o e-mail em
 * `auth.users` exige a API de admin do Supabase (chave de serviço, que não
 * pode viajar dentro do aplicativo) — sem isso, um novo convite para o
 * mesmo e-mail nunca completaria. Bloqueia se for o único administrador
 * ativo da organização — ver `excluir_conta_admin` no banco.
 */
export function useExcluirPropriaConta() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke<{
        ok: boolean
        error?: string
      }>('excluir-conta')

      if (error) throw new Error(error.message)
      if (!data?.ok) throw new Error(data?.error ?? 'Não foi possível excluir a conta.')
    },
  })
}
