import { useCallback, useEffect, useState } from 'react'

export type Tema = 'automatico' | 'claro' | 'escuro'

const CHAVE = 'reperfil:tema'

/**
 * O `index.css` já sabe reagir a `data-tema` no elemento raiz:
 *
 *   sem atributo      segue o sistema (`prefers-color-scheme`)
 *   data-tema=claro   força claro mesmo com o sistema no escuro
 *   data-tema=escuro  força escuro mesmo com o sistema no claro
 *
 * Aqui só gravamos esse atributo e lembramos da escolha. "Automático" é a
 * ausência do atributo — por isso é o padrão de quem nunca escolheu.
 */
function aplicar(tema: Tema) {
  const raiz = document.documentElement

  if (tema === 'automatico') {
    raiz.removeAttribute('data-tema')
  } else {
    raiz.setAttribute('data-tema', tema)
  }
}

function lerSalvo(): Tema {
  const salvo = localStorage.getItem(CHAVE)

  return salvo === 'claro' || salvo === 'escuro' ? salvo : 'automatico'
}

export function useTema() {
  const [tema, definirEstado] = useState<Tema>(lerSalvo)

  // Reaplica ao montar porque o app pode ter sido recarregado: o atributo
  // no HTML não sobrevive ao recarregamento, mas a escolha no localStorage
  // sim.
  useEffect(() => {
    aplicar(tema)
  }, [tema])

  const definirTema = useCallback((novo: Tema) => {
    if (novo === 'automatico') {
      localStorage.removeItem(CHAVE)
    } else {
      localStorage.setItem(CHAVE, novo)
    }

    definirEstado(novo)
  }, [])

  return { tema, definirTema }
}
