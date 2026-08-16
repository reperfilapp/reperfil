import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

interface PropsPaginaDetalhe {
  /** Para onde o "voltar" leva, e como se chama a lista de origem. */
  voltarPara: string
  rotuloVoltar: string
  /** Código curto do registro, quando houver — aparece acima do título. */
  codigo?: string | null
  titulo: string
  subtitulo?: string | null
  /** Selo de situação, à direita do título. */
  selo?: ReactNode
  acoes?: ReactNode
  children: ReactNode
}

/**
 * Casca das telas de detalhe.
 *
 * CONVENÇÃO DO PROJETO: toda linha de lista abre uma tela de detalhe. Um
 * registro clicável que não leva a lugar nenhum ensina a pessoa a não tocar,
 * e aí ela deixa de descobrir o que existe. Ter uma casca única garante que
 * todas se pareçam — voltar no mesmo lugar, código no mesmo lugar, ações no
 * mesmo lugar — para que aprender uma seja aprender todas.
 */
export function PaginaDetalhe({
  voltarPara,
  rotuloVoltar,
  codigo,
  titulo,
  subtitulo,
  selo,
  acoes,
  children,
}: PropsPaginaDetalhe) {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-6">
      <Link
        to={voltarPara}
        className="text-acao-600 mb-4 inline-flex items-center gap-1 text-sm hover:underline"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {rotuloVoltar}
      </Link>

      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          {codigo && (
            <p className="text-acao-600 font-mono text-lg font-bold">
              {codigo}
            </p>
          )}
          <h1 className="text-2xl font-bold">{titulo}</h1>
          {subtitulo && <p className="text-texto-suave mt-1">{subtitulo}</p>}
        </div>

        {selo && <div className="shrink-0">{selo}</div>}
      </header>

      {acoes && <div className="mb-5 flex flex-wrap gap-2">{acoes}</div>}

      <div className="flex flex-col gap-6">{children}</div>
    </div>
  )
}

/**
 * Bloco de dados em pares rótulo/valor.
 *
 * Valores nulos aparecem como travessão em vez de sumirem: uma linha ausente
 * faz a pessoa achar que o campo não existe, quando na verdade está vazio —
 * e vazio é informação, principalmente num cadastro que alguém precisa
 * completar.
 */
export function FichaDados({
  titulo,
  linhas,
}: {
  titulo?: string
  linhas: { rotulo: string; valor: ReactNode }[]
}) {
  return (
    <section>
      {titulo && <h2 className="mb-2 font-semibold">{titulo}</h2>}

      <dl className="bg-superficie grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl p-4 text-sm">
        {linhas.map(({ rotulo, valor }) => (
          <div key={rotulo} className="col-span-2 grid grid-cols-subgrid">
            <dt className="text-texto-suave">{rotulo}</dt>
            <dd className="text-right break-words">
              {valor === null || valor === undefined || valor === '' ? (
                <span className="text-texto-suave">—</span>
              ) : (
                valor
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
