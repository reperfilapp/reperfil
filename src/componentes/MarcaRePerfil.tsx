import { cn } from '@/lib/utilitarios'

/**
 * Marca do RePerfil.
 *
 * Três arquivos, com finalidades diferentes:
 *
 *   marca-rp.png          só o símbolo — cabeçalhos, menu, espaços apertados
 *   logo-otimizada.webp   símbolo + nome, leve, para a tela de entrada
 *   logo.png              original em alta, guardado como fonte dos demais
 *
 * A versão otimizada existe por medição, não por precaução: o Lighthouse
 * mostrou o arquivo original de 614 KB empurrando o "maior conteúdo visível"
 * da tela de entrada para 6,2 segundos. A versão WebP tem 26 KB.
 *
 * O logotipo tem fundo branco, não transparente. No tema escuro isso
 * apareceria como um retângulo, então a versão de símbolo ganha um fundo
 * branco arredondado de propósito — fica parecendo um selo, não um recorte
 * malfeito.
 */

interface PropsMarca {
  className?: string
  /** `completa` inclui o nome e a assinatura; `simbolo` é só o RP. */
  variante?: 'simbolo' | 'completa'
}

export function MarcaRePerfil({ className, variante = 'simbolo' }: PropsMarca) {
  if (variante === 'completa') {
    return (
      // <picture> entrega WebP a quem aceita e PNG ao resto, sem depender de
      // detecção no JavaScript.
      <picture>
        <source srcSet="/logo-otimizada.webp" type="image/webp" />
        <img
          src="/logo-otimizada.png"
          alt="RePerfil — Gestão de corte e sobras"
          width={560}
          height={610}
          // A logo é o maior elemento da tela de entrada; avisar o navegador
          // faz ele buscá-la antes do resto.
          fetchPriority="high"
          className={cn('h-auto w-full max-w-xs', className)}
        />
      </picture>
    )
  }

  return (
    <img
      src="/marca-rp.png"
      alt="RePerfil"
      width={256}
      height={223}
      className={cn(
        'aspect-square rounded-lg bg-white object-contain p-0.5',
        className,
      )}
    />
  )
}
