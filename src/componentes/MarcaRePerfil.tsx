import { cn } from '@/lib/utilitarios'

/**
 * Marca do RePerfil.
 *
 * Usa o logotipo da empresa, em `public/`. São dois arquivos com finalidades
 * diferentes:
 *
 *   marca-rp.png  só o símbolo — cabeçalhos, menu, espaços apertados
 *   logo.png      símbolo + nome + assinatura — tela de entrada, PDF, capa
 *
 * O logotipo tem fundo branco, não transparente. No tema escuro isso
 * apareceria como um retângulo branco, então a versão de símbolo ganha um
 * fundo branco arredondado de propósito — fica parecendo um selo, e não um
 * erro de recorte.
 */

interface PropsMarca {
  className?: string
  /** `completa` inclui o nome e a assinatura; `simbolo` é só o RP. */
  variante?: 'simbolo' | 'completa'
}

export function MarcaRePerfil({ className, variante = 'simbolo' }: PropsMarca) {
  if (variante === 'completa') {
    return (
      <img
        src="/logo.png"
        alt="RePerfil — Gestão de corte e sobras"
        className={cn('h-auto w-full max-w-xs', className)}
      />
    )
  }

  return (
    <img
      src="/marca-rp.png"
      alt="RePerfil"
      className={cn(
        'aspect-square rounded-lg bg-white object-contain p-0.5',
        className,
      )}
    />
  )
}
