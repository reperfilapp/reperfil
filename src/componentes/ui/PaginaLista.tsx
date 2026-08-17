import type { ReactNode } from 'react'
import { cn } from '@/lib/utilitarios'

interface PropsPaginaLista {
  /** Volta, título, busca — tudo que não deve sair da vista ao rolar. */
  cabecalho: ReactNode
  /** A lista. Só ela rola. */
  children: ReactNode
  /** Ação que precisa ficar sempre alcançável, como "ver todos". */
  rodape?: ReactNode
  /** Moldura em volta da área que rola. */
  comMoldura?: boolean
  className?: string
}

/**
 * Tela de lista: cabeçalho parado, lista rolando por dentro.
 *
 * ── POR QUE NÃO DEIXAR A PÁGINA INTEIRA ROLAR ────────────────────────────
 *
 * Numa lista de 80 perfis, rolar a página leva embora o campo de busca, o
 * botão de voltar e o "ver todos" — justamente o que a pessoa procura
 * quando a lista não trouxe o que ela queria. Ela então rola tudo de volta
 * para cima. No depósito, de pé e com uma peça na mão, isso é caro.
 *
 * Aqui a moldura é a área que rola; o resto fica onde está.
 *
 * ── O CÁLCULO DA ALTURA ──────────────────────────────────────────────────
 *
 * `100dvh - 4rem` é a tela menos a barra de navegação inferior. O `-mb-24`
 * anula o `pb-24` que o `main` reserva para essa mesma barra: sem isso, os
 * dois se somam, 32px de conteúdo saem para fora e a página passa a rolar
 * justamente o que este componente existe para evitar.
 *
 * No computador (`md:`) nada disso vale: o menu é lateral, não há barra
 * inferior, e a página rola normalmente.
 */
export function PaginaLista({
  cabecalho,
  children,
  rodape,
  comMoldura = true,
  className,
}: PropsPaginaLista) {
  return (
    <div
      className={cn(
        'mx-auto flex h-[calc(100dvh-4rem)] w-full flex-col px-5 py-4',
        '-mb-24 md:mb-0 md:h-auto md:min-h-dvh md:py-6',
        className ?? 'max-w-2xl',
      )}
    >
      <div className="shrink-0">{cabecalho}</div>

      {/* `min-h-0` é o que permite este bloco encolher dentro da coluna e
          sobrar espaço real para rolar — sem ele, o conteúdo empurra a
          lista para fora da tela em vez de rolar dentro dela. */}
      <div
        className={cn(
          'min-h-0 flex-1 overflow-y-auto',
          comMoldura && 'border-borda rounded-xl border-2 p-2',
        )}
      >
        {children}
      </div>

      {rodape && <div className="mt-3 shrink-0">{rodape}</div>}
    </div>
  )
}
