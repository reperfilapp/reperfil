import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { supabase, traduzirErro } from '@/lib/supabase'
import { Botao } from '@/componentes/ui/Botao'
import { CampoTexto } from '@/componentes/ui/CampoTexto'
import { CampoSenha } from '@/componentes/ui/CampoSenha'
import { MarcaRePerfil } from '@/componentes/MarcaRePerfil'
import { SeloVersao } from '@/componentes/SeloVersao'

/** Mínimo do Supabase. Repetido aqui para avisar antes de ir ao servidor. */
const MINIMO_SENHA = 6

/**
 * Onde o colaborador convidado cria a própria senha.
 *
 * ── POR QUE É O COLABORADOR QUEM SE CADASTRA ─────────────────────────────
 *
 * Criar a conta pelo administrador exigiria a chave de administração do
 * projeto dentro do aplicativo — extraída de um celular, ela abre o banco
 * inteiro. Então o caminho se inverte: o administrador registra o convite,
 * e quem digita a senha é o dono dela, que é como deveria ser de qualquer
 * forma.
 *
 * Isto NÃO é cadastro aberto. Um gatilho no banco recusa qualquer cadastro
 * sem convite em aberto para aquele e-mail, e a conta nem chega a existir.
 */
export default function PrimeiroAcesso() {
  const { sessao } = useAutenticacao()
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  const [pronto, setPronto] = useState(false)

  if (sessao) {
    return <Navigate to="/" replace />
  }

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)

    if (senha.length < MINIMO_SENHA) {
      setErro(`A senha precisa ter pelo menos ${MINIMO_SENHA} caracteres.`)
      return
    }

    if (senha !== confirmacao) {
      setErro('As duas senhas não são iguais.')
      return
    }

    setEnviando(true)

    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: senha,
        options: {
          // Sem isto, o link do e-mail de confirmação aponta para o "Site
          // URL" do projeto — que costuma estar apontando para a máquina de
          // quem desenvolve. O colaborador tocava no link do celular e caía
          // num endereço que só existe naquele computador. Mandando a origem
          // de onde a pessoa REALMENTE está, o link volta para o mesmo lugar.
          //
          // O endereço precisa estar em Authentication → URL Configuration →
          // Redirect URLs, senão o Supabase ignora e usa o Site URL de novo.
          emailRedirectTo: `${window.location.origin}/entrar`,
        },
      })

      if (error) throw error

      // Com a confirmação de e-mail desligada no projeto, o cadastro já
      // devolve sessão: mandar a pessoa para uma tela de "confirme seu
      // e-mail" que nunca vai chegar seria só um obstáculo inventado. O
      // redesenho das rotas leva ela para dentro sozinho.
      if (data.session) return

      setPronto(true)
    } catch (e) {
      setErro(traduzirErro(e))
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-6 py-12">
      <header className="flex flex-col items-center gap-4 text-center">
        <MarcaRePerfil
          variante="completa"
          className="max-w-56 rounded-xl bg-white p-4"
        />
        <h1 className="text-2xl font-bold">Primeiro acesso</h1>
      </header>

      {pronto ? (
        <div className="flex flex-col gap-5">
          <p className="bg-superficie-2 rounded-xl p-4">
            Conta criada. Abra a mensagem de confirmação que acabou de chegar no
            seu e-mail e depois entre aqui.
          </p>

          <Link
            to="/entrar"
            className="bg-acao-600 hover:bg-acao-700 flex min-h-16 w-full items-center justify-center rounded-xl px-6 text-lg font-semibold text-white"
          >
            Ir para a entrada
          </Link>
        </div>
      ) : (
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
            ajuda="O mesmo e-mail que o administrador usou no convite."
            disabled={enviando}
            required
          />

          <CampoSenha
            rotulo="Crie uma senha"
            autoComplete="new-password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            ajuda={`Pelo menos ${MINIMO_SENHA} caracteres.`}
            disabled={enviando}
            required
          />

          <CampoSenha
            rotulo="Repita a senha"
            autoComplete="new-password"
            value={confirmacao}
            onChange={(e) => setConfirmacao(e.target.value)}
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
            {enviando ? 'Criando…' : 'Criar meu acesso'}
          </Botao>

          <Link
            to="/entrar"
            className="text-acao-600 text-center underline-offset-4 hover:underline"
          >
            Já tenho acesso
          </Link>
        </form>
      )}

      <p className="text-texto-suave text-center text-sm">
        Só consegue criar acesso quem foi convidado pelo administrador da
        empresa.
      </p>

      <SeloVersao />
    </main>
  )
}
