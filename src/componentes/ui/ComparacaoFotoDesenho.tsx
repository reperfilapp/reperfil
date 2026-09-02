import { useLayoutEffect, useRef } from 'react'
import { X } from 'lucide-react'

interface PropsComparacao {
  foto: string
  desenho: string | null | undefined
  titulo: string
  aoFechar: () => void
}

/**
 * Foto da ponta e desenho técnico do candidato, lado a lado e em destaque —
 * a comparação que a lista de "Identificar perfil" já mostra lado a lado em
 * miniatura, só que grande o bastante para decidir de verdade.
 *
 * `<dialog>`, não `<div>`, pela mesma razão de `VisualizadorImagem.tsx`: a
 * "top layer" nativa empilha corretamente mesmo sobre outro `<dialog>` já
 * aberto, o que um `z-50` comum não garante.
 */
export function ComparacaoFotoDesenho({
  foto,
  desenho,
  titulo,
  aoFechar,
}: PropsComparacao) {
  const referencia = useRef<HTMLDialogElement>(null)

  useLayoutEffect(() => {
    const dialogo = referencia.current
    dialogo?.showModal()
    return () => dialogo?.close()
  }, [])

  return (
    <dialog
      ref={referencia}
      aria-label={`Comparar foto da ponta com o desenho técnico de ${titulo}`}
      className="m-0 flex h-full max-h-none w-full max-w-none flex-col items-stretch gap-3 border-0 bg-black/90 p-4 pt-14 backdrop:bg-black/90 sm:flex-row"
      onCancel={(evento) => {
        // O Esc dispara `cancel`; deixamos o React fechar, para o estado
        // não ficar dizendo "aberto" com a janela já fechada.
        evento.preventDefault()
        aoFechar()
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) aoFechar()
      }}
    >
      <p className="pointer-events-none absolute inset-x-0 top-0 px-4 py-4 pr-20 text-center text-sm font-semibold text-balance text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
        {titulo}
      </p>

      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl">
        <img
          src={foto}
          alt="Foto da ponta"
          className="max-h-full max-w-full object-contain"
        />
      </div>

      {/* Fundo branco: desenho de catálogo é traço preto sobre branco —
          sem isso, sobre o fundo escuro do visualizador, o desenho some. */}
      <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-xl bg-white p-3">
        {desenho ? (
          <img
            src={desenho}
            alt={`Desenho técnico de ${titulo}`}
            className="max-h-full max-w-full object-contain"
          />
        ) : (
          <p className="text-texto-suave px-4 text-center text-sm">
            Sem desenho técnico cadastrado.
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={aoFechar}
        aria-label="Fechar"
        className="text-grafite-900 absolute top-4 right-4 rounded-full bg-white/95 p-3 shadow-lg"
      >
        <X aria-hidden="true" className="size-5" />
      </button>
    </dialog>
  )
}
