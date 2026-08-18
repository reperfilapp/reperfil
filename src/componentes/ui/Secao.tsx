import type { ComponentType, ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

interface PropsSecao {
  titulo: string
  /** Ícone do lucide-react, à esquerda do título. */
  icone?: ComponentType<{
    className?: string
    'aria-hidden'?: boolean | 'true'
  }>
  /** Começa aberta? Só para o que a pessoa veio ver. */
  abertaPorPadrao?: boolean
  children: ReactNode
}

/**
 * Bloco que abre e fecha, com o título sempre visível.
 *
 * ── POR QUE `<details>` E NÃO ESTADO EM REACT ────────────────────────────
 *
 * O elemento nativo já abre e fecha sem JavaScript, é anunciado como
 * "expandido/recolhido" pelo leitor de tela e responde ao teclado — três
 * coisas que uma div com `onClick` só tem se alguém lembrar de escrever, e
 * quase ninguém lembra.
 *
 * ── POR QUE RECOLHIDO POR PADRÃO ─────────────────────────────────────────
 *
 * Numa tela de celular, tudo aberto empurra para fora justamente o que se
 * veio ver. Recolher o secundário deixa o principal na primeira dobra, e o
 * título continua ali dizendo que a informação existe — que é diferente de
 * escondê-la.
 */
export function Secao({
  titulo,
  icone: Icone,
  abertaPorPadrao = false,
  children,
}: PropsSecao) {
  return (
    <details open={abertaPorPadrao} className="group">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 font-semibold">
        {Icone && <Icone aria-hidden="true" className="size-4" />}
        <span className="flex-1">{titulo}</span>
        <ChevronDown
          aria-hidden="true"
          className="text-texto-suave size-5 transition-transform group-open:rotate-180"
        />
      </summary>

      <div className="mt-2">{children}</div>
    </details>
  )
}
