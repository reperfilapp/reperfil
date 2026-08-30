import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { supabase, traduzirErro } from '@/lib/supabase'
import { Botao } from '@/componentes/ui/Botao'
import { CampoTexto } from '@/componentes/ui/CampoTexto'
import { CampoMascarado } from '@/componentes/ui/CampoMascarado'
import { CampoSenha } from '@/componentes/ui/CampoSenha'
import { MarcaRePerfil } from '@/componentes/MarcaRePerfil'
import { SeloVersao } from '@/componentes/SeloVersao'
import {
  apenasDigitos,
  erroCpfCnpj,
  erroTelefone,
  erroEmail,
} from '@/dominio/documentos'
import {
  TAMANHO_MINIMO_SENHA,
  TAMANHO_MAXIMO_SENHA,
  apenasDigitosSenha,
  erroSenha,
} from '@/dominio/senha'

/**
 * Onde uma empresa nova entra sozinha, sem depender do desenvolvedor.
 *
 * ── POR QUE ISTO NÃO É "CADASTRO ABERTO" ──────────────────────────────────
 *
 * O gatilho `vincular_convite` no banco só cria a organização quando o
 * cadastro chega com os metadados certos (`criar_organizacao`,
 * `nome_empresa`, `nome`) — mandados só por este formulário. Qualquer outra
 * tentativa de criar conta sem convite continua recusada, como sempre foi.
 * Esta porta é estreita de propósito: só cria empresa NOVA, nunca deixa
 * entrar numa que já existe.
 */
export default function CriarEmpresa() {
  const { sessao } = useAutenticacao()
  const [nomeEmpresa, setNomeEmpresa] = useState('')
  const [nome, setNome] = useState('')
  const [cnpjCpf, setCnpjCpf] = useState('')
  const [telefone, setTelefone] = useState('')
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

    if (nomeEmpresa.trim() === '') {
      setErro('Informe o nome da empresa.')
      return
    }

    if (nome.trim() === '') {
      setErro('Informe seu nome.')
      return
    }

    if (apenasDigitos(cnpjCpf) === '') {
      setErro('Informe o CNPJ ou o CPF da empresa.')
      return
    }

    const erroDocumento = erroCpfCnpj(cnpjCpf)
    if (erroDocumento) {
      setErro(erroDocumento)
      return
    }

    if (apenasDigitos(telefone) === '') {
      setErro('Informe um telefone de contato.')
      return
    }

    const erroFone = erroTelefone(telefone)
    if (erroFone) {
      setErro(erroFone)
      return
    }

    if (email.trim() === '') {
      setErro('Informe o e-mail.')
      return
    }

    const erroDoEmail = erroEmail(email)
    if (erroDoEmail) {
      setErro(erroDoEmail)
      return
    }

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
          data: {
            criar_organizacao: 'true',
            nome_empresa: nomeEmpresa.trim(),
            nome: nome.trim(),
            cnpj: apenasDigitos(cnpjCpf),
            telefone: apenasDigitos(telefone),
          },
          // Mesmo motivo do primeiro acesso: sem isto, o link de
          // confirmação apontaria para o "Site URL" do projeto, não para
          // onde a pessoa realmente está.
          emailRedirectTo: `${window.location.origin}/entrar`,
        },
      })

      if (error) throw error

      // Confirmação de e-mail desligada no projeto: o cadastro já devolve
      // sessão, e o redesenho das rotas leva para dentro sozinho — a tela
      // de "falta pouco" cuida do resto (foto e conferência dos dados).
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
        <div>
          <h1 className="text-2xl font-bold">Criar minha empresa</h1>
          <p className="text-texto-suave mt-1 text-sm">
            Sua empresa ainda não usa o RePerfil? Comece por aqui.
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
            rotulo="Nome da empresa"
            autoComplete="organization"
            value={nomeEmpresa}
            onChange={(e) => setNomeEmpresa(e.target.value)}
            disabled={enviando}
            required
          />

          <CampoTexto
            rotulo="Seu nome"
            autoComplete="name"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            disabled={enviando}
            required
          />

          <CampoMascarado
            rotulo="CNPJ ou CPF"
            tipo="cpf_cnpj"
            value={cnpjCpf}
            onChange={setCnpjCpf}
            disabled={enviando}
          />

          <CampoMascarado
            rotulo="Telefone de contato"
            tipo="telefone"
            value={telefone}
            onChange={setTelefone}
            disabled={enviando}
          />

          <CampoMascarado
            rotulo="E-mail"
            tipo="email"
            value={email}
            onChange={setEmail}
            disabled={enviando}
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
            {enviando ? 'Criando…' : 'Criar minha empresa'}
          </Botao>

          <p className="text-texto-suave text-center text-xs">
            Ao criar sua empresa, você concorda com os{' '}
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

      <p className="text-texto-suave text-center text-sm">
        Foi convidado por uma empresa que já usa o RePerfil?{' '}
        <Link to="/primeiro-acesso" className="text-acao-600 hover:underline">
          Primeiro acesso
        </Link>
        .
      </p>

      <SeloVersao />
    </main>
  )
}
