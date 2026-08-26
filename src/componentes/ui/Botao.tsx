import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utilitarios'

/**
 * Botão da aplicação.
 *
 * As alturas mínimas seguem o uso real: depósito, celular na mão, muitas
 * vezes de luva. Alvo de toque nunca abaixo de 48 px, e o botão principal
 * com 64 px.
 */
const estilos = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold ' +
    'transition-colors disabled:cursor-not-allowed disabled:opacity-50 ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2',
  {
    variants: {
      variante: {
        primaria:
          'bg-acao-600 text-white hover:bg-acao-700 focus-visible:outline-acao-600',
        // Moldura na mesma intensidade do botão "Voltar" (`BotaoVoltar.tsx`):
        // borda de 1px, cor `border-borda` — sem ela, este botão se
        // confundia com o fundo de cartões e seções ao redor.
        secundaria:
          'bg-superficie-2 text-texto border border-borda hover:bg-borda focus-visible:outline-acao-600',
        contorno:
          'border-2 border-borda bg-transparent text-texto hover:bg-superficie-2',
        // Vermelho é reservado a erro e descarte — não usar para "salvar".
        destrutiva:
          'bg-erro-600 text-white hover:bg-erro-700 focus-visible:outline-erro-600',
        texto: 'bg-transparent text-acao-600 hover:underline',
      },
      tamanho: {
        pequeno: 'min-h-10 px-3 text-sm',
        icone_pequeno: 'size-9 p-0',
        medio: 'min-h-12 px-4 text-base',
        grande: 'min-h-16 px-6 text-lg',
        largura_total: 'min-h-16 w-full px-6 text-lg',
      },
    },
    defaultVariants: {
      variante: 'primaria',
      tamanho: 'medio',
    },
  },
)

interface PropsBotao
  extends
    ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof estilos> {
  /** Mostra girador e bloqueia cliques repetidos. */
  carregando?: boolean
  children: ReactNode
}

export function Botao({
  variante,
  tamanho,
  carregando = false,
  disabled,
  className,
  children,
  ...resto
}: PropsBotao) {
  return (
    <button
      className={cn(estilos({ variante, tamanho }), className)}
      disabled={disabled === true || carregando}
      aria-busy={carregando}
      {...resto}
    >
      {carregando && (
        <Loader2 aria-hidden="true" className="size-5 animate-spin" />
      )}
      {children}
    </button>
  )
}
