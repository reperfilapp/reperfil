import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { ShieldAlert, UserX, Loader2 } from 'lucide-react'
import { useAutenticacao } from './useAutenticacao'
import { Botao } from '@/componentes/ui/Botao'
import type { PapelUsuario } from '@/tipos/banco'

interface PropsRotaProtegida {
  children: ReactNode
  /** Se informado, só estes papéis entram. Vazio significa qualquer um. */
  papeisPermitidos?: readonly PapelUsuario[]
}

/**
 * Proteção de rota no navegador.
 *
 * IMPORTANTE: isto é conveniência de interface, NÃO segurança. Quem impede
 * de fato o acesso ao dado é o Row Level Security no banco — qualquer pessoa
 * pode alterar o JavaScript da própria página, mas ninguém altera a política
 * do PostgreSQL. Toda regra aqui tem uma correspondente lá.
 */
export function RotaProtegida({
  children,
  papeisPermitidos,
}: PropsRotaProtegida) {
  const { sessao, perfil, carregando, semAcesso, sair } = useAutenticacao()
  const localizacao = useLocation()

  if (carregando) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <Loader2
          aria-label="Carregando"
          className="text-texto-suave size-8 animate-spin"
        />
      </div>
    )
  }

  if (!sessao) {
    // `state` guarda de onde a pessoa veio, para voltar ao lugar certo
    // depois de entrar.
    return (
      <Navigate to="/entrar" replace state={{ de: localizacao.pathname }} />
    )
  }

  // Autenticado, mas o administrador ainda não vinculou a conta a uma
  // organização — ou desativou o acesso.
  if (semAcesso || !perfil) {
    return (
      <main
        role="alert"
        className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center"
      >
        <div className="bg-atencao-100 text-atencao-700 rounded-full p-6">
          <UserX aria-hidden="true" className="size-12" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Acesso ainda não liberado</h1>
          <p className="text-texto-suave max-w-sm text-balance">
            Sua conta existe, mas ainda não está vinculada a uma empresa. Peça
            ao administrador para liberar o seu acesso.
          </p>
        </div>

        <Botao variante="contorno" onClick={() => void sair()}>
          Sair
        </Botao>
      </main>
    )
  }

  if (papeisPermitidos && !papeisPermitidos.includes(perfil.papel)) {
    return (
      <main
        role="alert"
        className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center"
      >
        <div className="bg-atencao-100 text-atencao-700 rounded-full p-6">
          <ShieldAlert aria-hidden="true" className="size-12" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Sem permissão</h1>
          <p className="text-texto-suave max-w-sm text-balance">
            Esta área é restrita. Seu perfil no sistema é{' '}
            <strong>{perfil.papel}</strong>.
          </p>
        </div>

        <Botao variante="contorno" onClick={() => window.history.back()}>
          Voltar
        </Botao>
      </main>
    )
  }

  return <>{children}</>
}
