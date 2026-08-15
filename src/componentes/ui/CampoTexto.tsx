import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/utilitarios'

interface PropsCampoTexto extends InputHTMLAttributes<HTMLInputElement> {
  rotulo: string
  /** Mensagem de erro. Presente significa campo inválido. */
  erro?: string | undefined
  /** Texto de apoio, mostrado quando não há erro. */
  ajuda?: ReactNode
}

/**
 * Campo de texto com rótulo e erro acessíveis.
 *
 * O rótulo é sempre visível, nunca apenas dentro do campo: rótulo que some ao
 * digitar obriga a lembrar o que se estava preenchendo, e some justamente
 * para quem mais precisa dele.
 */
export function CampoTexto({
  rotulo,
  erro,
  ajuda,
  className,
  id,
  ...resto
}: PropsCampoTexto) {
  const idGerado = useId()
  const idCampo = id ?? idGerado
  const idErro = `${idCampo}-erro`
  const idAjuda = `${idCampo}-ajuda`

  const temErro = erro !== undefined && erro !== ''

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={idCampo} className="font-medium">
        {rotulo}
      </label>

      <input
        id={idCampo}
        aria-invalid={temErro}
        aria-describedby={cn(temErro && idErro, !temErro && ajuda && idAjuda)}
        className={cn(
          'bg-superficie min-h-12 rounded-xl border-2 px-4 text-base',
          'placeholder:text-texto-suave',
          temErro ? 'border-erro-500' : 'border-borda',
          className,
        )}
        {...resto}
      />

      {temErro && (
        <p id={idErro} role="alert" className="text-erro-600 text-sm">
          {erro}
        </p>
      )}

      {!temErro && ajuda && (
        <p id={idAjuda} className="text-texto-suave text-sm">
          {ajuda}
        </p>
      )}
    </div>
  )
}
