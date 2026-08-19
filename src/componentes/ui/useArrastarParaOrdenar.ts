import { useCallback, useRef, useState } from 'react'

/**
 * Arrastar para reordenar uma lista, com o dedo ou com o mouse.
 *
 * ── POR QUE NÃO O ARRASTAR NATIVO DO HTML ────────────────────────────────
 *
 * A API `draggable` do HTML não existe no toque: no celular, segurar e
 * mover uma linha rola a página ou seleciona texto, e nada acontece. Como
 * este aplicativo é usado principalmente no celular do depósito, ela estaria
 * fora justamente onde precisa funcionar.
 *
 * Eventos de ponteiro tratam dedo, caneta e mouse pelo mesmo caminho, e é o
 * que permite a mesma implementação servir aos três.
 *
 * ── COMO A POSIÇÃO É DECIDIDA ────────────────────────────────────────────
 *
 * Pela posição vertical do dedo contra o MEIO de cada linha, medido no
 * momento em que o arrasto começa. Medir a cada movimento pareceria mais
 * exato e seria pior: as linhas se deslocam enquanto se arrasta, e a conta
 * passaria a perseguir um alvo que ela mesma move.
 */
export function useArrastarParaOrdenar<T>({
  itens,
  chave,
  aoSoltar,
}: {
  itens: readonly T[]
  chave: (item: T) => string
  /** Recebe a nova sequência de chaves. Só é chamado se algo mudou. */
  aoSoltar: (chavesNaOrdem: string[]) => void
}) {
  /** Índice do item sendo arrastado, ou null quando ninguém está. */
  const [arrastando, setArrastando] = useState<number | null>(null)
  /** Onde ele cairia se fosse solto agora. */
  const [destino, setDestino] = useState<number | null>(null)

  /** Meio vertical de cada linha, congelado no início do arrasto. */
  const meios = useRef<number[]>([])
  const elementos = useRef(new Map<string, HTMLElement>())

  const registrar = useCallback(
    (id: string) => (elemento: HTMLElement | null) => {
      if (elemento) {
        elementos.current.set(id, elemento)
      } else {
        elementos.current.delete(id)
      }
    },
    [],
  )

  const comecar = useCallback(
    (indice: number) => (evento: React.PointerEvent) => {
      // `setPointerCapture` mantém os eventos vindo para este elemento mesmo
      // quando o dedo sai de cima dele — sem isso, o arrasto morre no
      // primeiro pixel fora da alça.
      evento.currentTarget.setPointerCapture(evento.pointerId)

      meios.current = itens.map((item) => {
        const el = elementos.current.get(chave(item))
        const r = el?.getBoundingClientRect()

        return r ? r.top + r.height / 2 : 0
      })

      setArrastando(indice)
      setDestino(indice)
    },
    [itens, chave],
  )

  const mover = useCallback(
    (evento: React.PointerEvent) => {
      if (arrastando === null) return

      // Sem isto, o navegador interpreta o gesto como rolagem da página e o
      // arrasto some no meio.
      evento.preventDefault()

      const y = evento.clientY
      let novo = meios.current.findIndex((meio) => y < meio)

      if (novo === -1) novo = itens.length - 1

      setDestino(novo)
    },
    [arrastando, itens.length],
  )

  const soltar = useCallback(() => {
    if (arrastando === null || destino === null) {
      setArrastando(null)
      setDestino(null)
      return
    }

    if (arrastando !== destino) {
      const ordem = itens.map(chave)
      const [movido] = ordem.splice(arrastando, 1)

      if (movido !== undefined) {
        ordem.splice(destino, 0, movido)
        aoSoltar(ordem)
      }
    }

    setArrastando(null)
    setDestino(null)
  }, [arrastando, destino, itens, chave, aoSoltar])

  /**
   * A lista na ordem em que deve aparecer AGORA, com o item arrastado já na
   * posição de destino. É o que dá o efeito de as linhas abrirem espaço
   * enquanto o dedo se move.
   */
  const itensVisiveis =
    arrastando === null || destino === null || arrastando === destino
      ? itens
      : (() => {
          const copia = [...itens]
          const [movido] = copia.splice(arrastando, 1)

          if (movido !== undefined) copia.splice(destino, 0, movido)

          return copia
        })()

  return {
    itensVisiveis,
    /** Chave do item em movimento, para a tela destacá-lo. */
    emMovimento: arrastando === null ? null : chave(itens[arrastando] as T),
    registrar,
    comecar,
    mover,
    soltar,
  }
}
