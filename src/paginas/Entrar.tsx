import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { traduzirErro } from '@/lib/supabase'
import { Botao } from '@/componentes/ui/Botao'
import { CampoTexto } from '@/componentes/ui/CampoTexto'
import { APLICACAO } from '@/config/aplicacao'
import { MarcaRePerfil } from '@/componentes/MarcaRePerfil'

export default function Entrar() {
  const { sessao, entrar } = useAutenticacao()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (sessao) {
    return <Navigate to="/" replace />
  }

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)

    if (email.trim() === '' || senha === '') {
      setErro('Informe o e-mail e a senha.')
      return
    }

    setEnviando(true)

    try {
      await entrar(email, senha)
      // A navegação acontece sozinha: a mudança de sessão redesenha as rotas.
    } catch (e) {
      setErro(traduzirErro(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-6 py-12">
      <header className="flex flex-col items-center gap-3 text-center">
        <MarcaRePerfil className="size-16" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {APLICACAO.nome}
          </h1>
          <p className="text-texto-suave">{APLICACAO.slogan}</p>
        </div>
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

        <CampoTexto
          rotulo="Senha"
          type="password"
          autoComplete="current-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
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
          {enviando ? 'Entrando…' : 'Entrar'}
        </Botao>

        <Link
          to="/recuperar-senha"
          className="text-acao-600 text-center underline-offset-4 hover:underline"
        >
          Esqueci minha senha
        </Link>
      </form>

      <p className="text-texto-suave text-center text-sm">
        O acesso é criado pelo administrador da sua empresa. Não há cadastro
        aberto.
      </p>
    </main>
  )
}
