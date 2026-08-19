import { cn } from '@/lib/utilitarios'

/**
 * A bolinha que mostra a cor de um acabamento.
 *
 * ── POR QUE UMA BOLINHA E NÃO SÓ O NOME ──────────────────────────────────
 *
 * "Bronze", "Amadeirado marrom" e "Preto fosco" são nomes que se confundem
 * na pressa, e quem está lançando uma sobra tem a peça na mão: a cor da
 * amostra decide mais rápido do que a leitura. É conferência visual contra o
 * material, não enfeite.
 *
 * ── O NOME CONTINUA AO LADO, SEMPRE ──────────────────────────────────────
 *
 * A bolinha nunca aparece sozinha. Cor não distingue para quem não enxerga
 * diferença entre tons, e dois acabamentos podem ter o mesmo hexadecimal
 * cadastrado — o nome é a informação, a bolinha é o atalho.
 */
export function PontoCor({
  cor,
  className,
}: {
  cor: string | null | undefined
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'border-borda inline-block size-4 shrink-0 rounded-full border align-middle',
        className,
      )}
      // Sem cor cadastrada fica transparente, mostrando só a borda: um
      // círculo cinza sugeriria que a cor É cinza.
      style={{ backgroundColor: cor ?? 'transparent' }}
    />
  )
}
