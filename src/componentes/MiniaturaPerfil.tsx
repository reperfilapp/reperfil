import { Ruler } from 'lucide-react'
import { cn } from '@/lib/utilitarios'

interface PropsMiniatura {
  link: string | null | undefined
  codigo: string
  /**
   * Substitui o texto alternativo padrão, que fala em "perfil". A lista de
   * produtos reaproveita esta miniatura — o quadro é o mesmo, só o que ele
   * representa é que muda, e quem usa leitor de tela precisa ouvir "produto"
   * ali, não "perfil".
   */
  alt?: string
  className?: string
}

/**
 * Miniatura do desenho técnico, para listas — de perfis e de produtos.
 *
 * O quadro tem tamanho fixo mesmo sem imagem. Sem isso, a lista se desloca
 * conforme as imagens chegam — e no celular a pessoa toca no item errado
 * porque a linha se moveu debaixo do dedo.
 *
 * Fundo branco porque desenho de catálogo é traço preto sobre branco: no tema
 * escuro, sem fundo, o desenho simplesmente some.
 */
export function MiniaturaPerfil({
  link,
  codigo,
  alt,
  className,
}: PropsMiniatura) {
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
          alt={alt ?? `Desenho técnico do perfil ${codigo}`}
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
