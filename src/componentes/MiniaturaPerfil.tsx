import { Ruler } from 'lucide-react'
import { cn } from '@/lib/utilitarios'

interface PropsMiniatura {
  link: string | null | undefined
  codigo: string
  className?: string
}

/**
 * Miniatura do desenho técnico, para listas.
 *
 * O quadro tem tamanho fixo mesmo sem imagem. Sem isso, a lista se desloca
 * conforme as imagens chegam — e no celular a pessoa toca no item errado
 * porque a linha se moveu debaixo do dedo.
 *
 * Fundo branco porque desenho de catálogo é traço preto sobre branco: no tema
 * escuro, sem fundo, o desenho simplesmente some.
 */
export function MiniaturaPerfil({ link, codigo, className }: PropsMiniatura) {
  return (
    <div
      className={cn(
        'border-borda flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-white',
        className,
      )}
    >
      {link ? (
        <img
          src={link}
          alt={`Desenho técnico do perfil ${codigo}`}
          loading="lazy"
          className="size-full object-contain p-0.5"
        />
      ) : (
        <Ruler
          aria-label="Sem desenho técnico"
          className="text-grafite-300 size-6"
        />
      )}
    </div>
  )
}
