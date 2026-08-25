import { useState, type ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { ShieldAlert, UserX, MailWarning, Loader2 } from 'lucide-react'
import { useAutenticacao } from './useAutenticacao'
import { supabase } from '@/lib/supabase'
import { Botao } from '@/componentes/ui/Botao'
import type { PapelUsuario } from '@/tipos/banco'

/** Onde o cadastro se completa. Fora daqui, ninguém sem foto passa. */
const CAMINHO_CADASTRO = '/completar-cadastro'

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

  // Cadastro sem foto não entra. A regra vale para quem já usava o sistema
  // antes dela existir, e não só para quem chega agora: a foto serve para
  // identificar quem mexeu em cada peça, e um histórico onde metade das
  // pessoas tem rosto e a outra metade não responde à pergunta pela metade.
  //
  // Vem ANTES da confirmação de e-mail de propósito: a pessoa acabou de
  // criar a senha, é natural terminar o cadastro (foto, nickname) antes de
  // qualquer outra coisa — só depois disso, se ainda faltar, é que aparece
  // o bloqueio de confirmação.
  //
  // `=== null` de propósito, e não `== null`: antes da migração a coluna nem
  // vem do banco e o campo chega AUSENTE. Ausente quer dizer "este sistema
  // ainda não pede foto"; nulo quer dizer "pede, e esta pessoa não tem". Só
  // o segundo caso barra — senão a empresa inteira ficaria trancada no
  // instante em que o código subisse, antes de a migração ser aplicada.
  if (perfil.foto_url === null && localizacao.pathname !== CAMINHO_CADASTRO) {
    return <Navigate to={CAMINHO_CADASTRO} replace />
  }

  // E-mail não confirmado não entra — só chega aqui quem se cadastrou SEM
  // passar pelo link do e-mail de convite (endereço digitado na mão, ou
  // "Criar minha empresa"). Quem veio do link já foi confirmado na hora,
  // por `vincular_convite` no banco.
  //
  // `=== null` de propósito, e não `== null`: antes desta migração a coluna
  // nem vem do banco e o campo chega AUSENTE (undefined). Ausente quer
  // dizer "este sistema ainda não exige confirmação"; nulo quer dizer
  // "exige, e esta pessoa não confirmou". Só o segundo caso bloqueia —
  // senão todo mundo que já tinha conta ficaria trancado de uma hora para
  // a outra, sem nunca ter recebido e-mail nenhum para confirmar.
  if (perfil.email_confirmado_em === null) {
    return <TelaConfirmarEmail email={perfil.email} sair={sair} />
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

interface PropsTelaConfirmarEmail {
  email: string
  sair: () => Promise<void>
}

/**
 * Bloqueio de acesso até confirmar o e-mail — a pessoa já tem sessão (o
 * cadastro terminou), só não passa daqui. O botão de reenviar chama a Edge
 * Function `enviar-email` direto (não pelo Database Webhook, que só
 * escuta INSERT): é a mesma sessão da pessoa que prova quem ela é, sem
 * precisar de segredo nenhum.
 *
 * ── "JÁ CONFIRMEI" ────────────────────────────────────────────────────────
 *
 * Confirmar acontece numa ABA OU SESSÃO diferente (a pessoa abre o e-mail
 * no celular, ou numa segunda aba do navegador) — o clique lá não avisa
 * esta aba sozinho, porque cada aba guarda o próprio perfil em memória.
 * Este botão só chama `recarregarPerfil()`: se já confirmou, o perfil
 * novo chega com `email_confirmado_em` preenchido, `RotaProtegida`
 * reavalia sozinha e esta tela nem chega a reaparecer.
 */
function TelaConfirmarEmail({ email, sair }: PropsTelaConfirmarEmail) {
  const { recarregarPerfil } = useAutenticacao()
  const [estado, setEstado] = useState<'ocioso' | 'enviando' | 'enviado' | 'erro'>(
    'ocioso',
  )
  const [atualizando, setAtualizando] = useState(false)
  const [aindaNaoConfirmado, setAindaNaoConfirmado] = useState(false)

  async function reenviar() {
    setEstado('enviando')
    const { error } = await supabase.functions.invoke('enviar-email')
    setEstado(error ? 'erro' : 'enviado')
  }

  async function atualizar() {
    setAtualizando(true)
    setAindaNaoConfirmado(false)
    await recarregarPerfil()
    setAtualizando(false)
    // Se este componente ainda existir depois do recarregamento, é porque
    // `RotaProtegida` olhou o perfil novo e continua vendo `null` — ainda
    // não confirmou de verdade.
    setAindaNaoConfirmado(true)
  }

  return (
    <main
      role="alert"
      className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center"
    >
      <div className="bg-atencao-100 text-atencao-700 rounded-full p-6">
        <MailWarning aria-hidden="true" className="size-12" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Confirme seu e-mail</h1>
        <p className="text-texto-suave max-w-sm text-balance">
          Mandamos um link de confirmação para <strong>{email}</strong>. Abra
          a mensagem, toque nele e volte aqui para atualizar.
        </p>
      </div>

      {aindaNaoConfirmado && (
        <p className="bg-superficie-2 rounded-xl px-4 py-3 text-sm">
          Ainda não encontramos a confirmação. Se já tocou no link do
          e-mail, aguarde um instante e tente de novo.
        </p>
      )}

      {estado === 'enviado' && (
        <p className="bg-superficie-2 rounded-xl px-4 py-3 text-sm">
          Reenviado. Confira sua caixa de entrada (e o spam).
        </p>
      )}

      {estado === 'erro' && (
        <p className="bg-erro-50 text-erro-700 rounded-xl px-4 py-3 text-sm">
          Não foi possível reenviar agora. Tente de novo em instantes.
        </p>
      )}

      <div className="flex flex-col items-center gap-3">
        <div className="flex gap-3">
          <Botao onClick={() => void atualizar()} carregando={atualizando}>
            Já confirmei
          </Botao>
          <Botao
            variante="contorno"
            onClick={() => void reenviar()}
            carregando={estado === 'enviando'}
          >
            Reenviar e-mail
          </Botao>
        </div>
        <Botao variante="texto" onClick={() => void sair()}>
          Sair
        </Botao>
      </div>
    </main>
  )
}
