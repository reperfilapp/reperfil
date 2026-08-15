import { useId, type SelectHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utilitarios'

interface PropsCampoSelecao extends SelectHTMLAttributes<HTMLSelectElement> {
  rotulo: string
  erro?: string | undefined
  children: ReactNode
}

export function CampoSelecao({
  rotulo,
  erro,
  className,
  id,
  children,
  ...resto
}: PropsCampoSelecao) {
  const idGerado = useId()
  const idCampo = id ?? idGerado
  const idErro = `${idCampo}-erro`
  const temErro = erro !== undefined && erro !== ''

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={idCampo} className="font-medium">
        {rotulo}
      </label>

      <select
        id={idCampo}
        aria-invalid={temErro}
        aria-describedby={temErro ? idErro : undefined}
        className={cn(
          'bg-superficie min-h-12 rounded-xl border-2 px-3 text-base',
          temErro ? 'border-erro-500' : 'border-borda',
          className,
        )}
        {...resto}
      >
        {children}
      </select>

      {temErro && (
        <p id={idErro} role="alert" className="text-erro-600 text-sm">
          {erro}
        </p>
      )}
    </div>
  )
}
