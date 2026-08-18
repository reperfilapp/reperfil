import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { chaves } from '@/lib/consultas'
import { permissoesIniciais, type Permissoes } from '@/dominio/cargos'
import type {
  ConviteColaborador,
  PapelUsuario,
  PerfilUsuario,
} from '@/tipos/banco'

/** A equipe, com quem está desligado por último. */
export function useColaboradores() {
  return useQuery({
    queryKey: chaves.colaboradores,
    queryFn: async (): Promise<PerfilUsuario[]> => {
      const { data, error } = await supabase
        .from('perfis_usuario')
        .select('*')
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
