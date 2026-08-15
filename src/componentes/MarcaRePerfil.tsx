/**
 * Marca do RePerfil.
 *
 * Desenho original: a seção transversal de um perfil de alumínio em "U"
 * (a forma que o serralheiro reconhece de imediato ao olhar a ponta de uma
 * barra), envolvida por uma seta que retorna sobre si mesma — o
 * reaproveitamento.
 *
 * Usa `currentColor`, então herda a cor de onde for colocada e funciona em
 * tema claro e escuro sem duas versões.
 */
export function MarcaRePerfil({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="none"
      className={className}
      role="img"
      aria-label="RePerfil"
    >
      {/* Seta de reaproveitamento, contornando o perfil */}
      <path
        d="M38 14a17 17 0 1 1-6-4.6"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        opacity="0.45"
      />
      <path
        d="M31 4.5 38.5 9.5 33 16"
        stroke="currentColor"
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.45"
      />

      {/* Seção do perfil em U, vista de topo */}
      <path d="M16 15v18h16v-18h-4.5v13.5h-7V15H16Z" fill="currentColor" />
    </svg>
  )
}
