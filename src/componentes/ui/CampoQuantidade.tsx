import { cn } from '@/lib/utilitarios'

/**
 * Quantidade com botões de mais e menos.
 *
 * Os botões existem porque o teclado numérico do celular cobre metade da
 * tela e some com o contexto: para trocar 1 por 2, tocar num botão é mais
 * rápido do que abrir o teclado, apagar e digitar. O campo continua editável
 * para quem vai de 1 para 40 — aí digitar é que é mais rápido.
 *
 * `compacto` reduz a altura para quando o controle divide a linha com outros
 * elementos, como no cabeçalho de uma tela.
 */
export function CampoQuantidade({
  valor,
  aoMudar,
  rotulo = 'Quantidade',
  minimo = 1,
  maximo = 999,
  compacto = false,
  className,
}: {
  valor: number
  aoMudar: (valor: number) => void
  rotulo?: string
  minimo?: number
  maximo?: number
  compacto?: boolean
  className?: string
}) {
  const altura = compacto ? 'min-h-11' : 'min-h-16'
  const largura = compacto ? 'w-11' : 'w-16'
  const texto = compacto ? 'text-lg' : 'text-2xl'

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <button
        type="button"
        onClick={() => aoMudar(Math.max(minimo, valor - 1))}
        aria-label={`Diminuir ${rotulo.toLowerCase()}`}
        className={cn(
          'border-destaque-borda bg-destaque text-destaque-texto hover:bg-destaque-hover',
          'shrink-0 rounded-xl border-2 font-bold',
          altura,
          largura,
          texto,
        )}
      >
        −
      </button>

      <input
        type="text"
        inputMode="numeric"
        value={valor}
        onChange={(e) => {
          const n = Number(e.target.value.replace(/\D/g, ''))

          aoMudar(
            Number.isFinite(n) && n >= minimo ? Math.min(maximo, n) : minimo,
          )
        }}
        aria-label={rotulo}
        className={cn(
          'border-borda bg-superficie min-w-0 rounded-xl border-2 text-center font-semibold tabular-nums',
          altura,
          compacto ? 'w-14' : 'flex-1',
          texto,
        )}
      />

      <button
        type="button"
        onClick={() => aoMudar(Math.min(maximo, valor + 1))}
        aria-label={`Aumentar ${rotulo.toLowerCase()}`}
        className={cn(
          'border-destaque-borda bg-destaque text-destaque-texto hover:bg-destaque-hover',
          'shrink-0 rounded-xl border-2 font-bold',
          altura,
          largura,
          texto,
        )}
      >
        +
      </button>
    </div>
  )
}
