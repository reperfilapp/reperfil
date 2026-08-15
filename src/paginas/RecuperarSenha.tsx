import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { supabase, traduzirErro } from '@/lib/supabase'
import { Botao } from '@/componentes/ui/Botao'
import { CampoTexto } from '@/componentes/ui/CampoTexto'

export default function RecuperarSenha() {
  const [email, setEmail] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [enviado, setEnviado] = useState(false)

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)

    if (email.trim() === '') {
      setErro('Informe o seu e-mail.')
      return
    }

    setEnviando(true)

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/definir-senha`,
    })

    setEnviando(false)

    if (error) {
      setErro(traduzirErro(error))
      return
    }

    setEnviado(true)
  }

  if (enviado) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
        <div className="bg-economia-100 text-economia-700 rounded-full p-6">
          <MailCheck aria-hidden="true" className="size-12" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Verifique seu e-mail</h1>
          <p className="text-texto-suave text-balance">
            Se existir uma conta para <strong>{email}</strong>, enviamos um link
            para criar uma senha nova. O link vale por uma hora.
          </p>
        </div>

        <Link to="/entrar" className="text-acao-600 hover:underline">
          Voltar para a entrada
        </Link>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-6 py-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Recuperar senha</h1>
        <p className="text-texto-suave">
          Informe o e-mail da sua conta e enviaremos um link para criar uma
          senha nova.
        </p>
      </header>

      <form onSubmit={aoEnviar} className="flex flex-col gap-5" noValidate>
        <CampoTexto
          rotulo="E-mail"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={enviando}
          required
        />

        {erro && (
          <p
            role="alert"
            className="bg-erro-50 text-erro-700 rounded-xl px-4 py-3"
          >
            {erro}
          </p>
        )}

        <Botao type="submit" tamanho="largura_total" carregando={enviando}>
          {enviando ? 'Enviando…' : 'Enviar link'}
        </Botao>

        <Link
          to="/entrar"
          className="text-acao-600 text-center underline-offset-4 hover:underline"
        >
          Voltar para a entrada
        </Link>
      </form>
    </main>
  )
}
