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

      // Procura versão nova de hora em hora. O navegador já verifica ao
      // abrir, mas aplicativo instalado no celular fica dias sem ser
      // fechado — e aí nunca verificaria.
      setInterval(
        () => {
          void registro.update()
        },
        60 * 60 * 1000,
      )
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
