import type { ReactNode } from 'react'
import { BotaoVoltar } from './ui/BotaoVoltar'

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
  /** Imagem redonda à esquerda do título — hoje, o rosto do colaborador. */
  avatar?: ReactNode
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
  avatar,
  acoes,
  children,
}: PropsPaginaDetalhe) {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-6">
      <BotaoVoltar para={voltarPara} rotulo={rotuloVoltar} className="mb-4" />

      <header className="mb-5 flex items-start justify-between gap-3">
        {avatar && <div className="shrink-0">{avatar}</div>}

        <div className="min-w-0 flex-1">
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
/**
 * Uma linha da ficha: ou um par rótulo/valor, ou um subtítulo que agrupa as
 * linhas seguintes.
 *
 * O subtítulo existe porque uma ficha pode juntar dados de origens
 * diferentes — o que é DESTA peça e o que vem do catálogo do perfil. Sem a
 * marca, "Comprimento 6 m" e "Barra padrão 6 m" viram a mesma coisa aos
 * olhos de quem lê, e não são.
 */
export type LinhaFicha =
  { rotulo: string; valor: ReactNode } | { grupo: string }

export function FichaDados({
  titulo,
  linhas,
}: {
  titulo?: string
  linhas: LinhaFicha[]
}) {
  return (
    <section>
      {titulo && <h2 className="mb-2 font-semibold">{titulo}</h2>}

      <dl className="bg-superficie grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl p-4 text-sm">
        {linhas.map((linha) =>
          'grupo' in linha ? (
            <p
              key={linha.grupo}
              className="border-borda text-texto-suave col-span-2 mt-2 border-t pt-3 text-xs font-semibold tracking-wide uppercase first:mt-0 first:border-0 first:pt-0"
            >
              {linha.grupo}
            </p>
          ) : (
            <div
              key={linha.rotulo}
              className="col-span-2 grid grid-cols-subgrid"
            >
              <dt className="text-texto-suave">{linha.rotulo}</dt>
              <dd className="text-right break-words">
                {linha.valor === null ||
                linha.valor === undefined ||
                linha.valor === '' ? (
                  <span className="text-texto-suave">—</span>
                ) : (
                  linha.valor
                )}
              </dd>
            </div>
          ),
        )}
      </dl>
    </section>
  )
}
