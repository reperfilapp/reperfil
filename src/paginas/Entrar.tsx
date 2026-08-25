import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Building2 } from 'lucide-react'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { supabase, traduzirErro } from '@/lib/supabase'
import { Botao } from '@/componentes/ui/Botao'
import { CampoTexto } from '@/componentes/ui/CampoTexto'
import { CampoSenha } from '@/componentes/ui/CampoSenha'
import { APLICACAO } from '@/config/aplicacao'
import { MarcaRePerfil } from '@/componentes/MarcaRePerfil'
import { SeloVersao } from '@/componentes/SeloVersao'

/** Uma linha do resultado de `resolver_email_login`. */
interface CandidatoLogin {
  email: string
  organizacao_nome: string
}

export default function Entrar() {
  const { sessao, entrar } = useAutenticacao()
  const [identificador, setIdentificador] = useState('')
  const [senha, setSenha] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)
  /*
   * Nickname é único POR EMPRESA, não no sistema inteiro — de propósito,
   * porque cada empresa não tem por que saber o nickname que as outras já
   * usaram. Isso quer dizer que o mesmo nickname pode existir em mais de
   * uma, e só aqui, no momento de entrar, é que a ambiguidade aparece. Nulo
   * é "não há escolha a fazer"; uma lista é "escolha entre estas empresas".
   */
  const [candidatos, setCandidatos] = useState<CandidatoLogin[] | null>(null)

  if (sessao) {
    return <Navigate to="/" replace />
  }

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)

    if (identificador.trim() === '' || senha === '') {
      setErro('Informe o e-mail (ou nickname) e a senha.')
      return
    }

    setEnviando(true)

    try {
      await tentarEntrar(identificador.trim(), senha)
    } catch (e) {
      setErro(traduzirErro(e))
    } finally {
      setEnviando(false)
    }
  }

  /**
   * Um e-mail é reconhecido pelo "@" e vai direto ao Supabase, como sempre
   * foi. Sem "@", é tratado como nickname: primeiro se descobre o e-mail
   * correspondente (ou os e-mails, se mais de uma empresa usa o mesmo
   * nickname), e só depois se tenta a senha.
   */
  async function tentarEntrar(texto: string, senhaDigitada: string) {
    if (texto.includes('@')) {
      await entrar(texto, senhaDigitada)
      return
    }

    const { data, error } = await supabase.rpc('resolver_email_login', {
      p_identificador: texto,
    })

    if (error) throw error

    const encontrados = (data ?? []) as CandidatoLogin[]

    if (encontrados.length === 0) {
      // Mesma mensagem genérica de senha errada — não é para dar a quem
      // está tentando adivinhar se dizer "esse nickname existe ou não".
      throw new Error('E-mail, nickname ou senha incorretos.')
    }

    if (encontrados.length === 1) {
      await entrar(encontrados[0]!.email, senhaDigitada)
      return
    }

    // Mais de uma empresa usa este nickname — só agora se pede para
    // escolher qual delas, sem ainda ter confirmado a senha.
    setCandidatos(encontrados)
  }

  async function entrarComCandidato(candidato: CandidatoLogin) {
    setErro(null)
    setEnviando(true)

    try {
      await entrar(candidato.email, senha)
    } catch (e) {
      setErro(traduzirErro(e))
    } finally {
      setEnviando(false)
    }
  }

  if (candidatos) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-6 py-12">
        <header className="flex flex-col items-center gap-4 text-center">
          <MarcaRePerfil
            variante="completa"
            className="max-w-56 rounded-xl bg-white p-4"
          />
          <div>
            <h1 className="text-xl font-bold">Qual é a sua empresa?</h1>
            <p className="text-texto-suave mt-1 text-sm">
              Esse nickname existe em mais de uma empresa cadastrada.
            </p>
          </div>
        </header>

        <div className="flex flex-col gap-3">
          {candidatos.map((candidato) => (
            <button
              key={candidato.email}
              type="button"
              disabled={enviando}
              onClick={() => void entrarComCandidato(candidato)}
              className="border-borda bg-superficie hover:bg-superficie-2 flex min-h-16 items-center gap-3 rounded-xl border-2 px-4 text-left disabled:opacity-50"
            >
              <Building2
                aria-hidden="true"
                className="text-acao-600 size-5 shrink-0"
              />
              <span className="font-medium">{candidato.organizacao_nome}</span>
            </button>
          ))}
        </div>

        {erro && (
          <p
            role="alert"
            className="bg-erro-50 text-erro-700 rounded-xl px-4 py-3"
          >
            {erro}
          </p>
        )}

        <Botao
          variante="contorno"
          tamanho="largura_total"
          onClick={() => {
            setCandidatos(null)
            setErro(null)
          }}
        >
          Voltar
        </Botao>

        <SeloVersao />
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-6 py-12">
      <header className="flex flex-col items-center gap-4 text-center">
        {/* O logotipo já traz o nome e a assinatura, então repeti-los em
            texto ao lado seria redundante. O título fica só para leitores
            de tela. */}
        <MarcaRePerfil
          variante="completa"
          className="max-w-56 rounded-xl bg-white p-4"
        />
        <h1 className="sr-only">
          {APLICACAO.nome} — {APLICACAO.slogan}
        </h1>
      </header>

      <form onSubmit={aoEnviar} className="flex flex-col gap-5" noValidate>
        <CampoTexto
          rotulo="E-mail ou nickname"
          type="text"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          value={identificador}
          onChange={(e) => setIdentificador(e.target.value)}
          disabled={enviando}
          required
        />

        <CampoSenha
          rotulo="Senha"
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
        Foi convidado por uma <strong>empresa cadastrada</strong> e ainda não
        tem senha?{' '}
        <Link
          to="/primeiro-acesso"
          className="text-acao-600 underline-offset-4 hover:underline"
        >
          Primeiro acesso
        </Link>
        .
      </p>

      <p className="text-texto-suave text-center text-sm">
        Sua empresa ainda não usa o RePerfil?{' '}
        <Link
          to="/criar-empresa"
          className="text-acao-600 underline-offset-4 hover:underline"
        >
          Cadastrar minha empresa
        </Link>
        .
      </p>

      <SeloVersao />
    </main>
  )
}
