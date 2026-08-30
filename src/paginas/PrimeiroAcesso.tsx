import { useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { TriangleAlert } from 'lucide-react'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { supabase, traduzirErro } from '@/lib/supabase'
import { Botao } from '@/componentes/ui/Botao'
import { CampoTexto } from '@/componentes/ui/CampoTexto'
import { CampoSenha } from '@/componentes/ui/CampoSenha'
import { MarcaRePerfil } from '@/componentes/MarcaRePerfil'
import { SeloVersao } from '@/componentes/SeloVersao'
import {
  TAMANHO_MINIMO_SENHA,
  TAMANHO_MAXIMO_SENHA,
  apenasDigitosSenha,
  erroSenha,
} from '@/dominio/senha'

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
 *
 * ── O LINK DO E-MAIL DE CONVITE JÁ CONFIRMA O E-MAIL ─────────────────────
 *
 * Chegando aqui a partir do botão do e-mail de convite, a URL traz
 * `?convite=<id>&email=<endereço>` — o e-mail preenche o campo sozinho, e o
 * id vai junto no cadastro (`vincular_convite` confere que bate com o
 * convite de verdade). Clicar num link que só chega naquela caixa de
 * entrada já prova que o e-mail é da pessoa, então ela entra direto, sem
 * precisar confirmar de novo. Quem digita o endereço na mão (sem o `?convite=`)
 * ainda recebe o cadastro, mas fica bloqueada até confirmar por e-mail — ver
 * `RotaProtegida.tsx`.
 */
export default function PrimeiroAcesso() {
  const { sessao } = useAutenticacao()
  const [parametros] = useSearchParams()
  const conviteId = parametros.get('convite')
  const [email, setEmail] = useState(parametros.get('email') ?? '')
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

    const erroDaSenha = erroSenha(senha)
    if (erroDaSenha) {
      setErro(erroDaSenha)
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
          // Vai junto só se veio do link do e-mail de convite — é o que
          // `vincular_convite`, no banco, confere contra o convite de
          // verdade para decidir se confirma o e-mail na hora.
          ...(conviteId ? { data: { convite_id: conviteId } } : {}),
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

        <div className="border-erro-300 bg-erro-50 text-erro-700 flex items-start gap-2 rounded-xl border-2 p-4 text-left text-sm">
          <TriangleAlert
            aria-hidden="true"
            className="mt-0.5 size-5 shrink-0"
          />
          <p>
            Só consegue criar acesso quem foi convidado pelo administrador da
            empresa. Sua empresa ainda não usa o RePerfil?{' '}
            <Link to="/criar-empresa" className="font-medium underline">
              Criar minha empresa
            </Link>
            .
          </p>
        </div>
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
            numerico
            maxLength={TAMANHO_MAXIMO_SENHA}
            value={senha}
            onChange={(e) => setSenha(apenasDigitosSenha(e.target.value))}
            ajuda={`${TAMANHO_MINIMO_SENHA} a ${TAMANHO_MAXIMO_SENHA} números.`}
            disabled={enviando}
            required
          />

          <CampoSenha
            rotulo="Repita a senha"
            autoComplete="new-password"
            numerico
            maxLength={TAMANHO_MAXIMO_SENHA}
            value={confirmacao}
            onChange={(e) => setConfirmacao(apenasDigitosSenha(e.target.value))}
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

          <p className="text-texto-suave text-center text-xs">
            Ao criar acesso, você concorda com os{' '}
            <Link to="/termos-de-uso" className="text-acao-600 hover:underline">
              Termos de uso
            </Link>{' '}
            e a{' '}
            <Link
              to="/politica-privacidade"
              className="text-acao-600 hover:underline"
            >
              Política de privacidade
            </Link>
            .
          </p>

          <Link
            to="/entrar"
            className="text-acao-600 text-center underline-offset-4 hover:underline"
          >
            Já tenho acesso
          </Link>
        </form>
      )}

      <SeloVersao />
    </main>
  )
}
