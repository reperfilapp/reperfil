import { useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { X, ZoomIn, ZoomOut, Maximize } from 'lucide-react'

interface PropsVisualizador {
  src: string
  alt: string
  /**
   * Nome escrito por cima da imagem, quando saber DE QUEM é o desenho
   * importa. Na lista de produtos o nome aparece cortado na linha, e é
   * justamente ao abrir o desenho que a pessoa precisa dele inteiro para
   * ter certeza de que está olhando o produto certo.
   */
  titulo?: string
  aoFechar: () => void
}

const ESCALA_MINIMA = 1
const ESCALA_MAXIMA = 8
const PASSO = 0.5

/**
 * Imagem em tela cheia, com zoom.
 *
 * Ampliar para caber na tela não basta: a cota de um desenho técnico é
 * impressa pequena, e no depósito a pergunta é "esta medida é 22 ou 27?".
 * Sem poder aproximar de verdade, a pessoa desiste e vai medir a peça na
 * mão — que é justamente o trabalho que o desenho existe para evitar.
 *
 * Funciona nos dois cenários de uso:
 *
 * • Celular — pinça com dois dedos, e arrastar com um dedo.
 * • Computador — roda do mouse, ou os botões, e arrastar com o mouse.
 *
 * Os botões existem mesmo havendo gesto: com luva, a pinça falha, e no
 * computador nem todo mundo descobre que a roda funciona aqui.
 */
export function VisualizadorImagem({
  src,
  alt,
  titulo,
  aoFechar,
}: PropsVisualizador) {
  const [escala, setEscala] = useState(1)
  const [deslocamento, setDeslocamento] = useState({ x: 0, y: 0 })

  // Ponteiros ativos, por id: permite distinguir arrastar (um) de pinçar
  // (dois) sem depender de eventos de toque, que se comportam diferente
  // entre navegadores.
  const ponteiros = useRef(new Map<number, { x: number; y: number }>())
  const pinca = useRef<{ distancia: number; escala: number } | null>(null)
  const arrasto = useRef<{ x: number; y: number } | null>(null)
  // Distingue "clicou no fundo para fechar" de "arrastou a imagem e soltou
  // por cima do fundo" — sem isso, mover a imagem fecharia a tela.
  const moveu = useRef(false)

  const ampliado = escala > ESCALA_MINIMA

  const referencia = useRef<HTMLDialogElement>(null)

  /*
   * `<dialog>` nativo, igual ao `Modal` — e pela mesma razão de fundo: quem
   * abre este visualizador tocando no desenho de dentro de "Alterar corte"
   * já está sob OUTRO `<dialog>` aberto. Um `div` comum com `z-50`, por mais
   * alto que o número, nunca vence a "top layer" de um `<dialog>` — a
   * imagem abria atrás do modal. Dois `<dialog>` resolvem: a "top layer" os
   * empilha na ordem em que foram abertos, o mais recente por cima.
   */
  useLayoutEffect(() => {
    const dialogo = referencia.current
    dialogo?.showModal()
    return () => dialogo?.close()
  }, [])

  function aplicarEscala(nova: number) {
    const limitada = Math.min(ESCALA_MAXIMA, Math.max(ESCALA_MINIMA, nova))

    setEscala(limitada)

    // Voltando ao tamanho de tela, a imagem volta ao centro: senão ela
    // some para fora da borda e parece que sumiu.
    if (limitada === ESCALA_MINIMA) setDeslocamento({ x: 0, y: 0 })

    return limitada
  }

  function reiniciar() {
    setEscala(ESCALA_MINIMA)
    setDeslocamento({ x: 0, y: 0 })
  }

  function aoDescerPonteiro(evento: PointerEvent<HTMLDialogElement>) {
    ponteiros.current.set(evento.pointerId, {
      x: evento.clientX,
      y: evento.clientY,
    })
    moveu.current = false

    if (ponteiros.current.size === 2) {
      const [a, b] = [...ponteiros.current.values()]
      pinca.current = {
        distancia: Math.hypot(a!.x - b!.x, a!.y - b!.y),
        escala,
      }
      arrasto.current = null
      return
    }

    if (ampliado) {
      arrasto.current = {
        x: evento.clientX - deslocamento.x,
        y: evento.clientY - deslocamento.y,
      }
    }
  }

  function aoMoverPonteiro(evento: PointerEvent<HTMLDialogElement>) {
    if (!ponteiros.current.has(evento.pointerId)) return

    ponteiros.current.set(evento.pointerId, {
      x: evento.clientX,
      y: evento.clientY,
    })

    if (pinca.current && ponteiros.current.size === 2) {
      const [a, b] = [...ponteiros.current.values()]
      const distancia = Math.hypot(a!.x - b!.x, a!.y - b!.y)

      moveu.current = true
      aplicarEscala(
        pinca.current.escala * (distancia / pinca.current.distancia),
      )
      return
    }

    if (arrasto.current) {
      moveu.current = true
      setDeslocamento({
        x: evento.clientX - arrasto.current.x,
        y: evento.clientY - arrasto.current.y,
      })
    }
  }

  function aoSubirPonteiro(evento: PointerEvent<HTMLDialogElement>) {
    ponteiros.current.delete(evento.pointerId)

    if (ponteiros.current.size < 2) pinca.current = null
    if (ponteiros.current.size === 0) arrasto.current = null
  }

  return (
    <dialog
      ref={referencia}
      aria-label={alt}
      className="m-0 flex h-full max-h-none w-full max-w-none touch-none items-center justify-center overflow-hidden border-0 bg-black/90 p-0 backdrop:bg-black/90"
      onCancel={(evento) => {
        // O Esc dispara `cancel`; deixamos o React fechar, para o estado não
        // ficar dizendo "aberto" com a janela já fechada.
        evento.preventDefault()
        aoFechar()
      }}
      onPointerDown={aoDescerPonteiro}
      onPointerMove={aoMoverPonteiro}
      onPointerUp={aoSubirPonteiro}
      onPointerCancel={aoSubirPonteiro}
      onClick={(e) => {
        // Só fecha se foi um clique de verdade no fundo, não o fim de um
        // arrasto que por acaso terminou fora da imagem.
        if (e.target === e.currentTarget && !moveu.current) aoFechar()
      }}
      onDoubleClick={() =>
        ampliado ? reiniciar() : aplicarEscala(ESCALA_MAXIMA / 2)
      }
      onWheel={(e) => {
        aplicarEscala(escala + (e.deltaY < 0 ? PASSO : -PASSO))
      }}
    >
      <img
        src={src}
        alt={alt}
        draggable={false}
        style={{
          transform: `translate(${deslocamento.x}px, ${deslocamento.y}px) scale(${escala})`,
        }}
        className={`max-h-full max-w-full object-contain select-none ${
          ampliado ? 'cursor-grab' : ''
        }`}
      />

      {/* O nome, quando há. `pr-20` abre caminho para o X do canto, e
          `pointer-events-none` deixa o arrasto da imagem passar por baixo —
          senão a faixa viraria uma zona morta no alto da tela. */}
      {titulo && (
        <p className="pointer-events-none absolute inset-x-0 top-0 px-4 py-4 pr-20 text-sm font-semibold text-balance text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
          {titulo}
        </p>
      )}

      {/* Controles por cima da imagem. `pointer-events-none` no container
          para não roubar o arrasto; os botões reativam o toque. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-6 flex justify-center">
        <div className="pointer-events-auto flex items-center gap-1 rounded-xl bg-white/95 p-1 shadow-lg">
          <button
            type="button"
            onClick={() => aplicarEscala(escala - PASSO)}
            disabled={escala <= ESCALA_MINIMA}
            aria-label="Diminuir zoom"
            className="text-grafite-900 rounded-lg p-3 hover:bg-black/10 disabled:opacity-30"
          >
            <ZoomOut aria-hidden="true" className="size-5" />
          </button>

          <span className="text-grafite-900 w-14 text-center text-sm font-semibold tabular-nums">
            {Math.round(escala * 100)}%
          </span>

          <button
            type="button"
            onClick={() => aplicarEscala(escala + PASSO)}
            disabled={escala >= ESCALA_MAXIMA}
            aria-label="Aumentar zoom"
            className="text-grafite-900 rounded-lg p-3 hover:bg-black/10 disabled:opacity-30"
          >
            <ZoomIn aria-hidden="true" className="size-5" />
          </button>

          <button
            type="button"
            onClick={reiniciar}
            disabled={!ampliado}
            aria-label="Ajustar à tela"
            className="text-grafite-900 rounded-lg p-3 hover:bg-black/10 disabled:opacity-30"
          >
            <Maximize aria-hidden="true" className="size-5" />
          </button>
        </div>
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
