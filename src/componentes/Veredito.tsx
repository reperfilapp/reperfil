import { CheckCircle2, XCircle, HelpCircle } from 'lucide-react'
import { formatarComprimento } from '@/dominio/medidas'

interface Falta {
  perfil: string
  comprimento_mm: number
  faltam: number
}

/**
 * A resposta em uma frase: dá ou não dá, e por quê.
 *
 * ── POR QUE O "NÃO DÁ" LISTA O QUE FALTA ─────────────────────────────────
 *
 * "Não é possível" encerra a conversa e não ajuda ninguém. "Faltam 2 peças de
 * 1,50 m do perfil SU-002" é uma lista de compras — e às vezes a pessoa olha
 * e lembra que tem aquela barra guardada em outro canto.
 *
 * ── POR QUE O NÚMERO É UM PISO ───────────────────────────────────────────
 *
 * O cálculo nunca promete o que não cabe, mas pode deixar de achar um arranjo
 * melhor. Então "dá para 2" quer dizer "2 com certeza", e o texto diz "pelo
 * menos" para não transformar uma garantia num limite.
 */
export function Veredito({
  unidades,
  desejada,
  atendePedido,
  soFaltaAcabamento,
  acabamento,
  semReceita,
  faltas,
}: {
  /** Quantas unidades saem do estoque, no total. */
  unidades: number
  /** Quantas se quer produzir. */
  desejada: number
  /** O estoque cobre a quantidade desejada? */
  atendePedido: boolean
  /** Há material para todos os cortes, mas espalhado em acabamentos? */
  soFaltaAcabamento: boolean
  acabamento: string | null
  semReceita: boolean
  faltas: readonly Falta[]
}) {
  if (semReceita) {
    return (
      <section className="bg-superficie-2 flex items-start gap-3 rounded-xl p-4">
        <HelpCircle
          aria-hidden="true"
          className="text-texto-suave mt-0.5 size-6 shrink-0"
        />
        <p className="text-sm">
          Monte a lista técnica para o sistema poder responder se dá para
          fabricar com as sobras.
        </p>
      </section>
    )
  }

  if (atendePedido) {
    return (
      <section className="bg-destaque border-destaque-borda flex items-start gap-3 rounded-xl border p-4">
        <CheckCircle2
          aria-hidden="true"
          className="text-destaque-texto mt-0.5 size-6 shrink-0"
        />
        <div>
          <p className="text-destaque-texto text-2xl font-bold">
            {desejada === 1
              ? 'Dá para fazer'
              : `Dá para fazer as ${desejada} unidades`}
          </p>

          {/* O total também, quando sobra: quem pediu 3 e pode fazer 7 tem
              margem para o cliente aumentar o pedido — e essa é a
              informação que faz a sobra virar venda. */}
          {unidades > desejada && (
            <p className="text-destaque-texto mt-1 text-sm opacity-80">
              O estoque de hoje dá para até {unidades} no total.
            </p>
          )}
          {acabamento && (
            <p className="text-destaque-texto mt-1 text-sm opacity-80">
              Com as sobras em <strong>{acabamento}</strong>. Uma unidade sai
              toda do mesmo acabamento.
            </p>
          )}
        </div>
      </section>
    )
  }

  return (
    <section className="bg-atencao-50 flex items-start gap-3 rounded-xl p-4">
      <XCircle
        aria-hidden="true"
        className="text-atencao-700 mt-0.5 size-6 shrink-0"
      />
      <div className="min-w-0">
        <p className="text-atencao-700 font-semibold">
          {desejada === 1
            ? 'Não dá com as sobras de hoje.'
            : `Não dá para as ${desejada} unidades com as sobras de hoje.`}
        </p>

        {/* Quantas dariam, quando dá alguma: "não dá para 5, mas dá para 2"
            é resposta melhor do que "não dá", e às vezes resolve o pedido
            pela metade enquanto o material novo não chega. */}
        {unidades > 0 && (
          <p className="text-texto-suave mt-1 text-sm">
            Dá para {unidades} {unidades === 1 ? 'unidade' : 'unidades'}.
          </p>
        )}

        {soFaltaAcabamento ? (
          /* Tudo verde na lista e "não dá" aqui em cima seria
             incompreensível sem esta frase. */
          <p className="text-texto-suave mt-1 text-sm">
            Há material para todos os cortes, mas em acabamentos diferentes — e
            uma peça sai toda do mesmo acabamento. Junte o que falta num
            acabamento só, ou confira se as sobras estão cadastradas com o
            acabamento certo.
          </p>
        ) : faltas.length === 0 ? (
          <p className="text-texto-suave mt-1 text-sm">
            Não há sobra disponível dos perfis desta lista.
          </p>
        ) : (
          <>
            <p className="text-texto-suave mt-1 text-sm">Falta:</p>
            <ul className="mt-1 flex flex-col gap-1 text-sm">
              {faltas.map((falta, i) => (
                <li key={i} className="tabular-nums">
                  {falta.faltam} × {formatarComprimento(falta.comprimento_mm)}{' '}
                  de <span className="font-medium">{falta.perfil}</span>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  )
}
