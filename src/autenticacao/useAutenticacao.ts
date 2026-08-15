import { useContext } from 'react'
import { ContextoAutenticacao, type EstadoAutenticacao } from './contexto'

/**
 * Acessa o estado de autenticação.
 *
 * O nome começa com `use`, e não com `usar`, apesar do resto do código estar
 * em português: o React identifica hooks pelo prefixo `use`, e as regras do
 * `rules-of-hooks` e do compilador dependem disso. A decisão D1 (tudo em
 * português) vale para o banco de dados; aqui a convenção do React vence,
 * porque brigar com ela desliga verificações que pegam bugs de verdade.
 *
 * Fica em arquivo separado do provedor porque o Fast Refresh do Vite exige
 * que um módulo exporte apenas componentes ou apenas funções comuns — não os
 * dois misturados, ou a atualização em tempo real quebra.
 */
export function useAutenticacao(): EstadoAutenticacao {
  const contexto = useContext(ContextoAutenticacao)

  if (contexto === null) {
    throw new Error(
      'useAutenticacao precisa estar dentro de <ProvedorAutenticacao>.',
    )
  }

  return contexto
}
