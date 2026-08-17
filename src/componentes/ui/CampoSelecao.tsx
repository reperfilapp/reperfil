import { useId, type SelectHTMLAttributes, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utilitarios'

interface PropsCampoSelecao extends SelectHTMLAttributes<HTMLSelectElement> {
  rotulo: string
  erro?: string | undefined
  children: ReactNode
}

/**
 * Campo de escolha entre opções.
 *
 * `appearance-none` não é enfeite: no iPhone o Safari desenha o `<select>`
 * com o controle nativo do sistema e IGNORA a altura que pedimos — o campo
 * saía com ~48px enquanto os vizinhos tinham 64px, e só no iOS. Removendo a
 * aparência nativa, a altura passa a valer nos três lugares (iOS, Android e
 * computador). Em troca, a seta nativa some e precisa ser desenhada aqui.
 */
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

      <div className="relative">
        <select
          id={idCampo}
          aria-invalid={temErro}
          aria-describedby={temErro ? idErro : undefined}
          className={cn(
            // Mesma altura dos campos de medida e quantidade (h-16): lado a
            // lado no mesmo formulário, um campo mais baixo que o outro
            // parece secundário e é um alvo de toque pior com luva.
            'bg-superficie h-16 w-full appearance-none rounded-xl border-2 pr-11 pl-3 text-base',
            temErro ? 'border-erro-500' : 'border-borda',
            className,
          )}
          {...resto}
        >
          {children}
        </select>

        {/* Substitui a seta nativa removida pelo `appearance-none`. Fica por
            cima do campo, mas sem receber o toque — quem abre é o select. */}
        <ChevronDown
          aria-hidden="true"
          className="text-texto-suave pointer-events-none absolute top-1/2 right-3 size-5 -translate-y-1/2"
        />
      </div>

      {temErro && (
        <p id={idErro} role="alert" className="text-erro-600 text-sm">
          {erro}
        </p>
      )}
    </div>
  )
}
