import { useState } from 'react'
import { SeletorCortes } from '@/componentes/produto/SeletorCortes'
import {
  CORTE_PADRAO,
  SENTIDO_PADRAO,
  type SentidoMontagem,
  type TipoCorte,
} from '@/dominio/corteMontagem'

/**
 * ARQUIVO TEMPORÁRIO — apagar junto com a rota `/previa-cortes`.
 *
 * Existe só para conferir o leiaute do seletor de cortes sem passar pelo
 * login. Não faz parte do aplicativo.
 */
export default function PreviaCortes() {
  const [sentido, setSentido] = useState<SentidoMontagem>(SENTIDO_PADRAO)
  const [inicio, setInicio] = useState<TipoCorte>(CORTE_PADRAO)
  const [fim, setFim] = useState<TipoCorte>(CORTE_PADRAO)

  return (
    <div className="mx-auto w-full max-w-lg px-5 py-6">
      <SeletorCortes
        sentido={sentido}
        corteInicio={inicio}
        corteFim={fim}
        aoMudarSentido={setSentido}
        aoMudarInicio={setInicio}
        aoMudarFim={setFim}
      />
    </div>
  )
}
