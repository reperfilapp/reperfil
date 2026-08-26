import { createContext } from 'react'
import type { Session } from '@supabase/supabase-js'
import { permissoesEfetivas, type Permissoes } from '@/dominio/cargos'
import type { PerfilUsuario } from '@/tipos/banco'

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
  /** Retorna o perfil recém-buscado, para checar o resultado sem esperar
   *  o próximo render (ex.: tentar de novo se ainda não confirmou). */
  recarregarPerfil: () => Promise<PerfilUsuario | null>
}

export const ContextoAutenticacao = createContext<EstadoAutenticacao | null>(
  null,
)

/**
 * Estas funções decidem o que APARECE na tela. Elas não protegem dado algum
 * — quem faz isso é o Row Level Security no banco, e cada regra daqui tem
 * uma correspondente lá.
 *
 * Todas perguntam pela PERMISSÃO, nunca pelo cargo. É o que permite ao
 * administrador liberar uma tarefa para uma pessoa sem promovê-la, e é o
 * mesmo desenho das políticas no banco.
 */
function permitido(
  perfil: PerfilUsuario | null,
  chave: keyof Permissoes,
): boolean {
  return perfil === null ? false : permissoesEfetivas(perfil)[chave]
}

export function podeMovimentarEstoque(perfil: PerfilUsuario | null): boolean {
  return permitido(perfil, 'pode_movimentar_estoque')
}

export function podeGerenciarCadastros(perfil: PerfilUsuario | null): boolean {
  return permitido(perfil, 'pode_gerenciar_cadastros')
}

export function podeGerenciarColaboradores(
  perfil: PerfilUsuario | null,
): boolean {
  return permitido(perfil, 'pode_gerenciar_colaboradores')
}

/**
 * Continua existindo para o que é do DONO do sistema, não de uma tarefa —
 * hoje, as configurações de cálculo. Não use para autorizar tarefa: para
 * isso existem as permissões acima, que podem ser concedidas.
 */
export function eAdministrador(perfil: PerfilUsuario | null): boolean {
  return perfil?.papel === 'administrador'
}
