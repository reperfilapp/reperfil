import { useState } from 'react'
import { Scissors, Trash2 } from 'lucide-react'
import { SeletorCortes } from './SeletorCortes'
import { CampoQuantidade } from '@/componentes/ui/CampoQuantidade'
import { Botao } from '@/componentes/ui/Botao'
import type {
  CorteDaPeca,
  GrupoCorte,
  TipoCorte,
} from '@/dominio/corteMontagem'

/**
 * Um grupo de peças com o mesmo corte, dentro do bloco "corte por peça".
 *
 * "Grupo 1 (2 peças)" em vez de "Peça 1 de 4": a exceção passou a valer por
 * GRUPO, não por peça física — duas peças idênticas dentro do mesmo grupo
 * não têm identidade própria entre si, só o grupo tem. Ver `corteMontagem.ts`
 * para o porquê da mudança.
 */
export function CartaoGrupoCorte({
  grupo,
  indice,
  totalGrupos,
  aoMudarCorte,
  aoDividir,
  aoRemover,
}: {
  grupo: GrupoCorte
  indice: number
  totalGrupos: number
  aoMudarCorte: (corte: CorteDaPeca) => void
  aoDividir: (quantidadeNoNovo: number) => void
  aoRemover: () => void
}) {
  const [dividindo, setDividindo] = useState(false)
  const [quantidadeNoNovo, setQuantidadeNoNovo] = useState(1)

  function iniciarDivisao() {
    // Metade a metade por padrão — o caso mais comum de dividir é "a
    // primeira leva de um jeito, o resto de outro", e metade é o palpite
    // mais barato de corrigir para qualquer lado.
    setQuantidadeNoNovo(Math.max(1, Math.floor(grupo.quantidade / 2)))
    setDividindo(true)
  }

  function confirmarDivisao() {
    aoDividir(quantidadeNoNovo)
    setDividindo(false)
  }

  return (
    <div className="flex flex-col gap-2">
      {dividindo && (
        <div className="bg-superficie-2 flex flex-wrap items-center gap-3 rounded-xl p-3">
          <p className="min-w-0 flex-1 text-sm">
            Quantas dessas {grupo.quantidade} peças formam o grupo novo?
          </p>

          <CampoQuantidade
            valor={quantidadeNoNovo}
            aoMudar={setQuantidadeNoNovo}
            minimo={1}
            maximo={grupo.quantidade - 1}
            rotulo="Peças no grupo novo"
            compacto
          />

          <div className="flex gap-2">
            <Botao
              type="button"
              variante="secundaria"
              tamanho="pequeno"
              onClick={() => setDividindo(false)}
            >
              Cancelar
            </Botao>
            <Botao type="button" tamanho="pequeno" onClick={confirmarDivisao}>
              Dividir
            </Botao>
          </div>
        </div>
      )}

      <SeletorCortes
        titulo={`Grupo ${indice + 1} — ${grupo.quantidade} ${grupo.quantidade === 1 ? 'peça' : 'peças'}`}
        sentido={grupo.sentido}
        corteInicio={grupo.corte_inicio}
        corteFim={grupo.corte_fim}
        aoMudarSentido={(sentido) => aoMudarCorte({ ...grupo, sentido })}
        aoMudarInicio={(corte_inicio: TipoCorte) =>
          aoMudarCorte({ ...grupo, corte_inicio })
        }
        aoMudarFim={(corte_fim: TipoCorte) =>
          aoMudarCorte({ ...grupo, corte_fim })
        }
        acoes={
          <div className="flex shrink-0 items-center gap-1">
            {/* Só faz sentido dividir um grupo de 2 peças ou mais — de 1, não
                sobraria peça nenhuma para o grupo novo. */}
            {grupo.quantidade > 1 && !dividindo && (
              <button
                type="button"
                onClick={iniciarDivisao}
                aria-label={`Dividir o grupo ${indice + 1} em dois`}
                title="Dividir em dois grupos"
                className="text-texto-suave hover:text-texto hover:bg-superficie-2 rounded-lg p-1.5"
              >
                <Scissors aria-hidden="true" className="size-4" />
              </button>
            )}

            {/* Só some quando é o único grupo restante — nesse ponto
                "remover o grupo" seria remover a exceção inteira, uma
                decisão de fora deste cartão (o próprio checkbox "corte por
                peça"). */}
            {totalGrupos > 1 && (
              <button
                type="button"
                onClick={aoRemover}
                aria-label={`Remover o grupo ${indice + 1}`}
                title="Remover este grupo"
                className="text-texto-suave hover:text-erro-600 hover:bg-superficie-2 rounded-lg p-1.5"
              >
                <Trash2 aria-hidden="true" className="size-4" />
              </button>
            )}
          </div>
        }
      />
    </div>
  )
}
