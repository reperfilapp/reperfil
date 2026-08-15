import { useEffect, useState, type ReactNode } from 'react'
import { WifiOff, RefreshCw } from 'lucide-react'
import { APLICACAO } from '@/config/aplicacao'

/**
 * O RePerfil é um sistema online por decisão de projeto: todo o estoque e
 * os cadastros vivem no banco na nuvem. Operar com dados velhos num
 * depósito — reservando uma sobra que outra pessoa já consumiu — causa
 * mais estrago do que simplesmente não abrir.
 *
 * Por isso não existe modo offline. Sem conexão, o aplicativo mostra esta
 * tela e nada mais, voltando sozinho ao normal quando a rede retorna.
 *
 * `navigator.onLine` só garante que existe uma interface de rede ativa,
 * não que a internet funciona. Basta para o aviso imediato; a validação
 * de verdade acontece quando o Supabase responde (Etapa 1).
 */
export function GuardaConexao({ children }: { children: ReactNode }) {
  const [online, setOnline] = useState(() => navigator.onLine)

  useEffect(() => {
    const ficouOnline = () => setOnline(true)
    const ficouOffline = () => setOnline(false)

    window.addEventListener('online', ficouOnline)
    window.addEventListener('offline', ficouOffline)

    return () => {
      window.removeEventListener('online', ficouOnline)
      window.removeEventListener('offline', ficouOffline)
    }
  }, [])

  if (!online) {
    return <TelaSemConexao />
  }

  return <>{children}</>
}

function TelaSemConexao() {
  return (
    <div
      role="alert"
      aria-live="assertive"
      className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center"
    >
      <div className="bg-atencao-100 text-atencao-700 rounded-full p-6">
        <WifiOff aria-hidden="true" className="size-12" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold">Aguardando conexão</h1>
        <p className="text-texto-suave max-w-sm text-balance">
          O {APLICACAO.nome} precisa de internet para consultar o estoque. Assim
          que o sinal voltar, esta tela sai sozinha.
        </p>
      </div>

      <div className="text-texto-suave flex items-center gap-2 text-sm">
        <RefreshCw aria-hidden="true" className="size-4 animate-spin" />
        <span>Verificando a rede…</span>
      </div>
    </div>
  )
}
