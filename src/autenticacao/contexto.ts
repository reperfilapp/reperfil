import { createContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import type { PapelUsuario, PerfilUsuario } from '@/tipos/banco'

/**
 * Contexto e regras de permissão da autenticação.
 *
 * Sem componentes neste arquivo, de propósito: o Fast Refresh do Vite só
 * funciona quando um módulo exporta apenas componentes ou apenas valores
 * comuns. Misturar os dois faz a atualização em tempo real recarregar a
 * página inteira e perder o estado a cada salvamento.
 */

export interface EstadoAutenticacao {
  /** Sessão do Supabase, ou null se ninguém entrou. */
  sessao: Session | null
  /** Dados de aplicação do usuário: nome, papel, organização. */
  perfil: PerfilUsuario | null
  /** Verdadeiro enquanto a sessão inicial ainda está sendo restaurada. */
  carregando: boolean
  /**
   * Usuário autenticado mas sem linha em `perfis_usuario`, ou com o cadastro
   * desativado. Não é erro de programação: acontece quando o administrador
   * ainda não vinculou a conta a uma organização, ou desligou o acesso.
   */
  semAcesso: boolean
  entrar: (email: string, senha: string) => Promise<void>
  sair: () => Promise<void>
  recarregarPerfil: () => Promise<void>
}

export const ContextoAutenticacao = createContext<EstadoAutenticacao | null>(
  null,
)

/** Papéis que podem cadastrar e movimentar estoque. */
const PAPEIS_DE_ESTOQUE: readonly PapelUsuario[] = ['administrador', 'estoque']

/**
 * Estas funções decidem o que APARECE na tela. Elas não protegem dado algum
 * — quem faz isso é o Row Level Security no banco, e cada regra daqui tem
 * uma correspondente lá.
 */
export function podeMovimentarEstoque(perfil: PerfilUsuario | null): boolean {
  return perfil !== null && PAPEIS_DE_ESTOQUE.includes(perfil.papel)
}

export function eAdministrador(perfil: PerfilUsuario | null): boolean {
  return perfil?.papel === 'administrador'
}
