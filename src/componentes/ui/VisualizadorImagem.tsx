import { useLayoutEffect, useRef, useState, type PointerEvent } from 'react'
import { X, ZoomIn, ZoomOut, Maximize, Share2, Copy } from 'lucide-react'

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

  const [processando, setProcessando] = useState<'exportar' | 'copiar' | null>(
    null,
  )
  const [erroAcao, setErroAcao] = useState<string | null>(null)

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

  async function baixarComoBlob(): Promise<Blob> {
    const resposta = await fetch(src)
    if (!resposta.ok) throw new Error('Não foi possível baixar a imagem.')
    return resposta.blob()
  }

  /**
   * Só para copiar: o Clipboard API dá suporte confiável a PNG em todo
   * navegador — JPEG varia. Reconverter aqui evita "não foi possível
   * copiar" numa foto que é JPEG só porque o navegador é mais restrito.
   */
  async function paraPng(origem: Blob): Promise<Blob> {
    if (origem.type === 'image/png') return origem

    const bitmap = await createImageBitmap(origem)
    const tela = document.createElement('canvas')
    tela.width = bitmap.width
    tela.height = bitmap.height
    const contexto = tela.getContext('2d')
    bitmap.close()

    if (!contexto) {
      throw new Error('Não foi possível processar a imagem neste navegador.')
    }

    contexto.drawImage(bitmap, 0, 0)

    return new Promise((resolve, reject) => {
      tela.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Falha ao converter a imagem.'))),
        'image/png',
      )
    })
  }

  async function exportar() {
    setErroAcao(null)
    setProcessando('exportar')
    try {
      const blob = await baixarComoBlob()
      const extensao = blob.type.split('/')[1] ?? 'jpg'
      const nome = `${(titulo ?? alt).replace(/[^\w-]+/g, '-')}.${extensao}`
      const arquivo = new File([blob], nome, { type: blob.type })

      // Com suporte a compartilhar arquivo (celular, principalmente): abre
      // o menu do sistema — salvar em Arquivos, mandar por WhatsApp, etc.
      if (navigator.canShare?.({ files: [arquivo] })) {
        await navigator.share({ files: [arquivo], title: nome })
        return
      }

      // Sem esse suporte (comum em navegador de computador): baixa direto,
      // como qualquer download.
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = nome
      link.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      // Cancelar o menu de compartilhar não é erro — é desistência.
      if (e instanceof DOMException && e.name === 'AbortError') return
      setErroAcao(
        e instanceof Error ? e.message : 'Não foi possível exportar a imagem.',
      )
    } finally {
      setProcessando(null)
    }
  }

  async function copiar() {
    setErroAcao(null)
    setProcessando('copiar')
    try {
      const blob = await paraPng(await baixarComoBlob())
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })])
    } catch (e) {
      setErroAcao(
        e instanceof Error ? e.message : 'Não foi possível copiar a imagem.',
      )
    } finally {
      setProcessando(null)
    }
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
      <div className="pointer-events-none absolute inset-x-0 bottom-6 flex flex-col items-center gap-2">
        {erroAcao && (
          <p
            role="alert"
            className="pointer-events-auto max-w-[85vw] rounded-lg bg-white/95 px-3 py-1.5 text-center text-sm text-erro-700"
          >
            {erroAcao}
          </p>
        )}

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

          <div aria-hidden="true" className="bg-grafite-900/15 mx-0.5 h-6 w-px" />

          <button
            type="button"
            onClick={() => void copiar()}
            disabled={processando !== null}
            aria-label="Copiar imagem"
            className="text-grafite-900 rounded-lg p-3 hover:bg-black/10 disabled:opacity-30"
          >
            <Copy aria-hidden="true" className="size-5" />
          </button>

          <button
            type="button"
            onClick={() => void exportar()}
            disabled={processando !== null}
            aria-label="Exportar imagem"
            className="text-grafite-900 rounded-lg p-3 hover:bg-black/10 disabled:opacity-30"
          >
            <Share2 aria-hidden="true" className="size-5" />
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
