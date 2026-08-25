import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CheckCircle2, XCircle } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { MarcaRePerfil } from '@/componentes/MarcaRePerfil'

type Estado = 'confirmando' | 'sucesso' | 'erro'

/**
 * Onde cai o link de "Confirme seu e-mail" mandado pela Edge Function
 * `enviar-email`. Pública de propósito — o token no `?token=` É a
 * credencial, a pessoa pode nem ter sessão aberta neste navegador.
 */
export default function ConfirmarEmail() {
  const [parametros] = useSearchParams()
  const token = parametros.get('token')
  const [estado, setEstado] = useState<Estado>('confirmando')
  const [mensagemErro, setMensagemErro] = useState('')
  const { recarregarPerfil } = useAutenticacao()

  useEffect(() => {
    if (!token) {
      setEstado('erro')
      setMensagemErro('Link incompleto — falta o código de confirmação.')
      return
    }

    supabase
      .rpc('confirmar_email', { p_token: token })
      .then(async ({ error }) => {
        if (error) {
          setEstado('erro')
          setMensagemErro(error.message)
          return
        }

        // Sem isto, quem já estava logado neste navegador continua vendo
        // o perfil antigo (com `email_confirmado_em` nulo) em memória — a
        // confirmação gravou no banco, mas a tela de bloqueio só larga
        // olhando o valor já carregado, não o banco de novo.
        await recarregarPerfil()
        setEstado('sucesso')
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-6 px-6 py-12 text-center">
      <MarcaRePerfil
        variante="completa"
        className="max-w-56 rounded-xl bg-white p-4"
      />

      {estado === 'confirmando' && (
        <p className="text-texto-suave">Confirmando seu e-mail…</p>
      )}

      {estado === 'sucesso' && (
        <>
          <CheckCircle2
            aria-hidden="true"
            className="text-acao-600 size-12"
          />
          <div>
            <h1 className="text-xl font-bold">E-mail confirmado!</h1>
            <p className="text-texto-suave mt-1 text-sm">
              Pode entrar normalmente no RePerfil.
            </p>
          </div>
        </>
      )}

      {estado === 'erro' && (
        <>
          <XCircle aria-hidden="true" className="text-erro-600 size-12" />
          <div>
            <h1 className="text-xl font-bold">Não foi possível confirmar</h1>
            <p className="text-erro-700 bg-erro-50 mt-3 rounded-xl px-4 py-3 text-sm">
              {mensagemErro}
            </p>
          </div>
        </>
      )}

      <Link
        to="/entrar"
        className="text-acao-600 underline-offset-4 hover:underline"
      >
        Ir para a entrada
      </Link>
    </main>
  )
}
