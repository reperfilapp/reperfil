import { useRegisterSW } from 'virtual:pwa-register/react'
import { RefreshCw, X } from 'lucide-react'
import { Botao } from './ui/Botao'

/**
 * Aviso de versão nova disponível.
 *
 * Aplicativo instalado guarda os arquivos e continua rodando a versão antiga
 * até o service worker ser trocado. Sem este aviso, alguém no depósito pode
 * usar por semanas uma versão com um defeito já corrigido — e reclamar de um
 * problema que não existe mais.
 *
 * A atualização é oferecida, não imposta: recarregar sozinho no meio de um
 * cadastro perderia o que a pessoa digitou. Ela decide quando.
 */
export function AvisoNovaVersao() {
  const {
    needRefresh: [precisaAtualizar, setPrecisaAtualizar],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registro) {
      if (!registro) return

      const verificar = () => void registro.update()

      // Verifica assim que registra — cobre o caso mais comum, que é abrir
      // o app depois de alguém ter publicado uma correção.
      verificar()

      // E de novo toda vez que o app volta a ficar visível. No iPhone, o
      // app instalado fica dias em segundo plano e o sistema pausa
      // temporizadores nesse meio tempo — o setInterval abaixo sozinho
      // quase nunca chega a rodar de fato lá. Retomar a tela é o momento
      // real em que vale a pena checar.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') verificar()
      })

      // Ainda assim mantém a verificação periódica, para quem deixa o app
      // aberto no computador por muitas horas seguidas.
      setInterval(verificar, 60 * 60 * 1000)
    },
  })

  if (!precisaAtualizar) return null

  return (
    <div
      role="status"
      className="border-acao-300 bg-superficie fixed inset-x-3 bottom-20 z-40 flex items-center gap-3 rounded-xl border-2 p-4 shadow-lg md:inset-x-auto md:right-4 md:bottom-4 md:max-w-sm"
    >
      <RefreshCw aria-hidden="true" className="text-acao-600 size-5 shrink-0" />

      <p className="flex-1 text-sm">
        <strong>Nova versão disponível.</strong> Atualize quando terminar o que
        está fazendo.
      </p>

      <Botao onClick={() => void updateServiceWorker(true)}>Atualizar</Botao>

      <button
        type="button"
        onClick={() => setPrecisaAtualizar(false)}
        aria-label="Agora não"
        className="hover:bg-superficie-2 rounded-lg p-2"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  )
}
