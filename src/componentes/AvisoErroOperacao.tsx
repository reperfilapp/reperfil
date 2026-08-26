import { useSyncExternalStore } from 'react'
import { TriangleAlert, X } from 'lucide-react'
import {
  assinarAvisoErro,
  lerAvisoErro,
  limparAvisoErro,
} from '@/lib/avisoErro'

/**
 * Faixa de aviso para falha em ação direta (desativar, mover, remover).
 *
 * Fica por cima de tudo e não some sozinha: no depósito, uma mensagem que
 * apaga em três segundos é uma mensagem que ninguém leu — a pessoa está
 * com a peça na mão, olhando para a prateleira, não para a tela. Ela
 * fecha quando tiver lido.
 *
 * Mesma posição do aviso de nova versão, para o app ter um lugar só onde
 * "o sistema fala".
 */
export function AvisoErroOperacao() {
  const mensagem = useSyncExternalStore(
    assinarAvisoErro,
    lerAvisoErro,
    lerAvisoErro,
  )

  if (!mensagem) return null

  return (
    <div
      role="alert"
      className="border-erro-300 bg-superficie fixed inset-x-3 bottom-20 z-40 flex items-start gap-3 rounded-xl border-2 p-4 shadow-lg md:inset-x-auto md:right-4 md:bottom-4 md:max-w-sm"
    >
      <TriangleAlert
        aria-hidden="true"
        className="text-erro-600 mt-0.5 size-5 shrink-0"
      />

      <p className="flex-1 text-sm">
        <strong className="text-erro-700">Não deu certo.</strong> {mensagem}
      </p>

      <button
        type="button"
        onClick={limparAvisoErro}
        aria-label="Fechar aviso"
        className="hover:bg-superficie-2 shrink-0 rounded-lg p-2"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  )
}
