import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { chaves } from '@/lib/consultas'
import type { Cliente } from '@/tipos/banco'

export interface DadosCliente {
  nome: string
  nome_fantasia: string | null
  cpf_cnpj: string | null
  cidade: string | null
  estado: string | null
  telefone: string | null
  whatsapp: string | null
  email: string | null
  contato_principal: string | null
  observacoes: string | null
}

/**
 * Clientes da organização.
 *
 * Esta tabela guarda dado pessoal sob a LGPD — CPF, endereço, telefone. O
 * isolamento por organização não é conveniência de multiempresa aqui: é
 * proteção de dado de terceiro, verificada em
 * `supabase/testes/verificar-rls.sql`.
 */
export function useClientes(incluirInativos = false) {
  return useQuery({
    queryKey: [...chaves.clientes, { incluirInativos }],
    queryFn: async (): Promise<Cliente[]> => {
      let consulta = supabase.from('clientes').select('*').order('nome')

      if (!incluirInativos) {
        consulta = consulta.eq('ativo', true)
      }

      const { data, error } = await consulta

      if (error) throw new Error(error.message)

      return data as Cliente[]
    },
  })
}

export function filtrarClientes(
  clientes: readonly Cliente[],
  termo: string,
): Cliente[] {
  const busca = termo.trim().toLowerCase()

  if (busca === '') return [...clientes]

  return clientes.filter(
    (cliente) =>
      cliente.nome.toLowerCase().includes(busca) ||
      (cliente.nome_fantasia?.toLowerCase().includes(busca) ?? false) ||
      (cliente.cpf_cnpj?.includes(busca) ?? false) ||
      (cliente.cidade?.toLowerCase().includes(busca) ?? false),
  )
}

export function useCriarCliente() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async (dados: DadosCliente): Promise<Cliente> => {
      // `codigo` é gerado por gatilho no banco: ninguém decora código de
      // cliente, então não faz sentido pedir para digitar.
      const { data, error } = await supabase
        .from('clientes')
        .insert(dados)
        .select()
        .single()

      if (error) throw new Error(error.message)

      return data as Cliente
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.clientes })
    },
  })
}

export function useEditarCliente() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({
      id,
      dados,
    }: {
      id: string
      dados: Partial<DadosCliente>
    }): Promise<Cliente> => {
      const { data, error } = await supabase
        .from('clientes')
        .update(dados)
        .eq('id', id)
        .select()
        .single()

      if (error) throw new Error(error.message)

      return data as Cliente
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.clientes })
    },
  })
}

export function useDesativarCliente() {
  const cliente = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from('clientes')
        .update({ ativo })
        .eq('id', id)

      if (error) throw new Error(error.message)
    },
    onSuccess: () => {
      void cliente.invalidateQueries({ queryKey: chaves.clientes })
    },
  })
}
