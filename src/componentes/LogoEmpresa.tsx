import { cn } from '@/lib/utilitarios'

interface PropsLogoEmpresa {
  /** URL temporária assinada do logo. `null` mostra as iniciais. */
  logoUrl: string | null | undefined
  /** Nome fantasia da empresa, usado para gerar as iniciais. */
  nomeFantasia: string
  tamanho?: 'pequeno' | 'medio' | 'grande' | 'gigante'
  className?: string
}

const TAMANHOS = {
  pequeno: { container: 'size-8 text-xs', img: 'size-8' },
  medio: { container: 'size-12 text-sm', img: 'size-12' },
  grande: { container: 'size-20 text-xl', img: 'size-20' },
  gigante: { container: 'size-28 text-3xl', img: 'size-28' },
}

/**
 * Exibe o logo da empresa, com fallback de iniciais.
 *
 * Quando não há logo cadastrado (ou enquanto carrega), mostra as duas
 * primeiras iniciais do nome fantasia num círculo colorido — em vez de
 * um quadrado vazio ou um ícone genérico, que pareceriam erro.
 */
export function LogoEmpresa({
  logoUrl,
  nomeFantasia,
  tamanho = 'medio',
  className,
}: PropsLogoEmpresa) {
  const { container, img } = TAMANHOS[tamanho]

  const iniciais = nomeFantasia
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')

  if (logoUrl) {
    return (
      <img
        src={logoUrl}
        alt={`Logo de ${nomeFantasia}`}
        className={cn(
          img,
          'rounded-lg object-contain bg-white',
          className,
        )}
      />
    )
  }

  return (
    <div
      aria-label={`Iniciais de ${nomeFantasia}`}
      className={cn(
        container,
        'rounded-lg bg-acao-600 text-white font-bold flex items-center justify-center shrink-0 select-none',
        className,
      )}
    >
      {iniciais || '?'}
    </div>
  )
}
