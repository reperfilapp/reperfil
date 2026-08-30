import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase, traduzirErro } from '@/lib/supabase'
import { Botao } from '@/componentes/ui/Botao'
import { CampoSenha } from '@/componentes/ui/CampoSenha'
import {
  TAMANHO_MINIMO_SENHA,
  TAMANHO_MAXIMO_SENHA,
  apenasDigitosSenha,
  erroSenha,
} from '@/dominio/senha'

/**
 * Tela alcançada pelo link enviado por e-mail. O Supabase já trocou o código
 * do link por uma sessão temporária antes de chegar aqui, então basta gravar
 * a senha nova.
 */
export default function DefinirSenha() {
  const navegar = useNavigate()
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [salvando, setSalvando] = useState(false)

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

    setSalvando(true)

    const { error } = await supabase.auth.updateUser({ password: senha })

    setSalvando(false)

    if (error) {
      setErro(traduzirErro(error))
      return
    }

    navegar('/', { replace: true })
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-6 py-12">
      <header className="space-y-2">
        <h1 className="text-2xl font-bold">Criar senha nova</h1>
        <p className="text-texto-suave">
          Escolha uma senha de {TAMANHO_MINIMO_SENHA} a {TAMANHO_MAXIMO_SENHA}{' '}
          números.
        </p>
      </header>

      <form onSubmit={aoEnviar} className="flex flex-col gap-5" noValidate>
        <CampoSenha
          rotulo="Nova senha"
          autoComplete="new-password"
          inputMode="numeric"
          maxLength={TAMANHO_MAXIMO_SENHA}
          value={senha}
          onChange={(e) => setSenha(apenasDigitosSenha(e.target.value))}
          disabled={salvando}
          required
        />

        <CampoSenha
          rotulo="Repita a nova senha"
          autoComplete="new-password"
          inputMode="numeric"
          maxLength={TAMANHO_MAXIMO_SENHA}
          value={confirmacao}
          onChange={(e) => setConfirmacao(apenasDigitosSenha(e.target.value))}
          disabled={salvando}
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

        <Botao type="submit" tamanho="largura_total" carregando={salvando}>
          {salvando ? 'Salvando…' : 'Salvar senha'}
        </Botao>
      </form>
    </main>
  )
}
