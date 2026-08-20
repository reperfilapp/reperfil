import {
  ArrowDownAZ,
  ArrowUpZA,
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
} from 'lucide-react'
import { cn } from '@/lib/utilitarios'
import type {
  CriterioOrdenacaoLista,
  EstadoOrdenacaoLista,
} from '@/dominio/ordenacaoListas'

/**
 * Alterna o critério de ordenação — estoque ou nome — e, tocando de novo no
 * que já está ativo, inverte a direção.
 *
 * Dois botões, e não um só que gira por quatro estados: os dois lados da
 * escolha (estoque vs. nome) continuam sempre visíveis, e só o toque repetido
 * no mesmo lado inverte — descobrir "toque nele de novo para inverter" é
 * natural quando o botão já está aceso, e não seria se o mesmo toque também
 * trocasse de critério.
 */
export function AlternadorOrdenacao({
  estado,
  aoMudar,
  className,
}: {
  estado: EstadoOrdenacaoLista
  aoMudar: (estado: EstadoOrdenacaoLista) => void
  className?: string
}) {
  function tocar(criterio: CriterioOrdenacaoLista) {
    if (estado.criterio === criterio) {
      aoMudar({ criterio, decrescente: !estado.decrescente })
      return
    }

    // Cada critério tem seu próprio ponto de partida ao ser escolhido pela
    // primeira vez: estoque começa do maior, nome começa de A.
    aoMudar({ criterio, decrescente: criterio === 'estoque' })
  }

  const noEstoque = estado.criterio === 'estoque'
  const noNome = estado.criterio === 'nome'

  return (
    <div
      role="group"
      aria-label="Ordenar lista"
      className={cn('flex shrink-0 gap-1', className)}
    >
      <button
        type="button"
        onClick={() => tocar('estoque')}
        aria-pressed={noEstoque}
        aria-label={
          noEstoque
            ? `Ordenado por estoque, ${estado.decrescente ? 'do maior para o menor' : 'do menor para o maior'} — toque para inverter`
            : 'Ordenar por estoque, o que tem mais peças primeiro'
        }
        title={
          noEstoque && !estado.decrescente
            ? 'Menos estoque primeiro'
            : 'Mais estoque primeiro'
        }
        className={cn(
          'flex size-9 items-center justify-center rounded-lg border-2',
          noEstoque
            ? 'border-acao-600 bg-acao-600 text-white'
            : 'border-borda bg-superficie text-texto-suave',
        )}
      >
        {noEstoque && !estado.decrescente ? (
          <ArrowUpWideNarrow aria-hidden="true" className="size-4" />
        ) : (
          <ArrowDownWideNarrow aria-hidden="true" className="size-4" />
        )}
      </button>
      <button
        type="button"
        onClick={() => tocar('nome')}
        aria-pressed={noNome}
        aria-label={
          noNome
            ? `Ordenado por nome, ${estado.decrescente ? 'de Z a A' : 'de A a Z'} — toque para inverter`
            : 'Ordenar por nome, em ordem alfabética'
        }
        title={noNome && estado.decrescente ? 'Z → A' : 'A → Z'}
        className={cn(
          'flex size-9 items-center justify-center rounded-lg border-2',
          noNome
            ? 'border-acao-600 bg-acao-600 text-white'
            : 'border-borda bg-superficie text-texto-suave',
        )}
      >
        {noNome && estado.decrescente ? (
          <ArrowUpZA aria-hidden="true" className="size-4" />
        ) : (
          <ArrowDownAZ aria-hidden="true" className="size-4" />
        )}
      </button>
    </div>
  )
}
