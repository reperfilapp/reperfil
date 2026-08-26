import { useEffect, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface PropsModal {
  aberto: boolean
  aoFechar: () => void
  titulo: string
  /**
   * Ação extra no cabeçalho FIXO, ao lado do título — para formulários
   * longos, onde repetir "Salvar" só no fim do conteúdo que rola obriga a
   * rolar tudo de volta mesmo já tendo terminado de editar lá em cima.
   */
  acoes?: ReactNode
  children: ReactNode
}

/**
 * Janela modal sobre a tela.
 *
 * Usa o elemento `<dialog>` nativo, que resolve de graça o que costuma ser
 * feito errado à mão: prender o foco dentro da janela, devolvê-lo ao fechar,
 * esconder o resto da página de leitores de tela e responder ao Esc.
 */
export function Modal({
  aberto,
  aoFechar,
  titulo,
  acoes,
  children,
}: PropsModal) {
  const referencia = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialogo = referencia.current
    if (!dialogo) return

    if (aberto && !dialogo.open) {
      dialogo.showModal()
    } else if (!aberto && dialogo.open) {
      dialogo.close()
    }
  }, [aberto])

  return (
    <dialog
      ref={referencia}
      onCancel={(evento) => {
        // O Esc dispara `cancel`; deixamos o React fechar, para o estado não
        // ficar dizendo "aberto" com a janela já fechada.
        evento.preventDefault()
        aoFechar()
      }}
      onClick={(evento) => {
        // Clique no fundo escuro fecha. O alvo só é o próprio dialog quando
        // o clique cai fora do conteúdo.
        if (evento.target === referencia.current) {
          aoFechar()
        }
      }}
      className="bg-superficie text-texto m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl p-0 backdrop:bg-black/50"
    >
      <div className="border-borda flex items-center justify-between gap-4 border-b px-5 py-4">
        <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">
          {titulo}
        </h2>
        <div className="flex shrink-0 items-center gap-2">
          {acoes}
          <button
            type="button"
            onClick={aoFechar}
            aria-label="Fechar"
            className="hover:bg-superficie-2 rounded-lg p-2"
          >
            <X aria-hidden="true" className="size-5" />
          </button>
        </div>
      </div>

      <div className="max-h-[70vh] overflow-y-auto px-5 py-5">{children}</div>
    </dialog>
  )
}
