export function AmostraCor({
  corHex,
  nome,
  tamanho = 'pequeno',
}: {
  corHex: string | null
  nome?: string
  tamanho?: 'pequeno' | 'grande'
}) {
  const dimensao = tamanho === 'grande' ? 'size-8' : 'size-3.5'

  return (
    <span className="inline-flex items-center gap-1.5 min-w-0">
      <span
        aria-hidden="true"
        className={`shrink-0 rounded-full ${dimensao}`}
        style={{
          backgroundColor: corHex ?? 'transparent',
          boxShadow:
            'inset 0 0 0 1px rgba(0,0,0,0.15), inset 0 0 0 1px rgba(255,255,255,0.15)',
        }}
      />
      {nome && <span className="truncate">{nome}</span>}
    </span>
  )
}
