import { Loader2, WifiOff, Inbox } from 'lucide-react'
import { Botao } from './ui/Botao'

interface PropsEstadoConsulta {
  carregando: boolean
  erro: Error | null
  vazio: boolean
  mensagemVazio: string
  aoTentarNovamente?: () => void
}

/**
 * Estados de uma consulta ao servidor: carregando, com erro, ou sem dados.
 *
 * Existe porque a alternativa apareceu na prática e foi ruim: uma consulta
 * quebrou e a tela ficou completamente em branco — sem lista, sem erro, sem
 * "nenhum resultado". Quem estivesse usando concluiria que o estoque está
 * vazio, que é a interpretação errada mais perigosa possível num sistema de
 * controle de estoque.
 *
 * Devolve `null` quando há dados para mostrar, e a tela segue normalmente.
 */
export function EstadoConsulta({
  carregando,
  erro,
  vazio,
  mensagemVazio,
  aoTentarNovamente,
}: PropsEstadoConsulta) {
  if (carregando) {
    return (
      <div className="text-texto-suave flex items-center justify-center gap-2 py-10">
        <Loader2 aria-hidden="true" className="size-5 animate-spin" />
        Carregando…
      </div>
    )
  }

  if (erro) {
    return (
      <div
        role="alert"
        className="bg-erro-50 text-erro-700 flex flex-col items-center gap-3 rounded-xl p-6 text-center"
      >
        <WifiOff aria-hidden="true" className="size-8" />
        <div>
          <p className="font-semibold">Não foi possível carregar</p>
          {/* A mensagem técnica fica visível de propósito: sem ela, relatar o
              problema vira adivinhação. */}
          <p className="mt-1 text-sm opacity-90">{erro.message}</p>
        </div>
        {aoTentarNovamente && (
          <Botao variante="contorno" onClick={aoTentarNovamente}>
            Tentar novamente
          </Botao>
        )}
      </div>
    )
  }

  if (vazio) {
    return (
      <div className="bg-superficie-2 text-texto-suave flex flex-col items-center gap-2 rounded-xl p-8 text-center">
        <Inbox aria-hidden="true" className="size-7" />
        <p>{mensagemVazio}</p>
      </div>
    )
  }

  return null
}
