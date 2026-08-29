import { SeletorCortes } from './SeletorCortes'
import type { CorteDaPeca, TipoCorte } from '@/dominio/corteMontagem'

/**
 * Uma peça numerada, dentro do bloco "corte por peça".
 *
 * Numerada porque é a única forma de saber, ao preencher, qual cartão é
 * qual — sem número, "o terceiro card de cima para baixo" é a única
 * referência que existe, e ela muda se a pessoa rolar a tela.
 */
export function CartaoCortePorPeca({
  numero,
  total,
  corte,
  aoMudar,
}: {
  numero: number
  total: number
  corte: CorteDaPeca
  aoMudar: (corte: CorteDaPeca) => void
}) {
  return (
    <SeletorCortes
      titulo={`Peça ${numero} de ${total}`}
      sentido={corte.sentido}
      corteInicio={corte.corte_inicio}
      corteFim={corte.corte_fim}
      aoMudarSentido={(sentido) => aoMudar({ ...corte, sentido })}
      aoMudarInicio={(corte_inicio: TipoCorte) =>
        aoMudar({ ...corte, corte_inicio })
      }
      aoMudarFim={(corte_fim: TipoCorte) => aoMudar({ ...corte, corte_fim })}
    />
  )
}
