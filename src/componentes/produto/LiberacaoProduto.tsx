import {
  useOrganizacoesParaLiberacaoProduto,
  useDefinirLiberacaoProduto,
  useDefinirLiberacaoProdutoTodas,
} from '@/dados/produtos'
import { Botao } from '@/componentes/ui/Botao'
import { cn } from '@/lib/utilitarios'
import { disparar } from '@/lib/avisoErro'

/**
 * Quais empresas podem importar este produto do catálogo central.
 *
 * Gêmeo do bloco "Liberada para" de Linhas e sistemas, e de propósito: quem
 * já sabe liberar uma linha não precisa aprender nada novo aqui.
 *
 * ── POR QUE PRODUTO NOVO NASCE BLOQUEADO ─────────────────────────────────
 *
 * Um produto do catálogo central é uma receita pronta, e receita pronta é o
 * que a organização central negocia com cada cliente. Liberar sozinho ao
 * cadastrar entregaria de graça, e sem ninguém perceber, o trabalho que
 * justifica o catálogo existir. A tela de administração por empresa tem o
 * atalho para liberar tudo de uma vez, para quem não quer esse controle.
 */
export function LiberacaoProduto({ produtoId }: { produtoId: string }) {
  const { data: organizacoes, isPending } =
    useOrganizacoesParaLiberacaoProduto(produtoId)
  const liberar = useDefinirLiberacaoProduto()
  const liberarTodas = useDefinirLiberacaoProdutoTodas()

  return (
    <section className="bg-erro-50 rounded-xl p-4">
      <h2 className="font-semibold">Liberado para</h2>
      <p className="text-texto-suave mt-0.5 mb-3 text-sm">
        Quais empresas podem importar este produto do catálogo central.
      </p>

      <div className="mb-3 flex gap-2">
        <Botao
          variante="secundaria"
          tamanho="pequeno"
          onClick={() =>
            disparar(liberarTodas.mutateAsync({ produtoId, liberada: true }))
          }
          carregando={liberarTodas.isPending}
          className="flex-1"
        >
          Liberar para todas
        </Botao>
        <Botao
          variante="secundaria"
          tamanho="pequeno"
          onClick={() =>
            disparar(liberarTodas.mutateAsync({ produtoId, liberada: false }))
          }
          carregando={liberarTodas.isPending}
          className="flex-1"
        >
          Bloquear todas
        </Botao>
      </div>

      {isPending ? (
        <p className="text-texto-suave text-sm">Carregando…</p>
      ) : (
        /* Rola por dentro: a lista cresce com o número de empresas, e sem
           limite ela empurraria o resto da ficha para fora da tela. */
        <ul className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
          {organizacoes?.map((o) => (
            <li
              key={o.organizacao_id}
              className="bg-superficie border-erro-100 flex items-center justify-between gap-2 rounded-lg border px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-sm">
                {o.nome_fantasia}
              </span>
              <button
                type="button"
                onClick={() =>
                  disparar(
                    liberar.mutateAsync({
                      produtoId,
                      organizacaoId: o.organizacao_id,
                      liberada: !o.liberada,
                    }),
                  )
                }
                disabled={liberar.isPending}
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
                  o.liberada
                    ? 'bg-economia-50 text-economia-700 hover:bg-economia-100'
                    : 'bg-atencao-50 text-atencao-700 hover:bg-atencao-100',
                )}
              >
                {o.liberada ? 'Liberado' : 'Bloqueado'}
              </button>
            </li>
          ))}

          {organizacoes?.length === 0 && (
            <li className="text-texto-suave text-sm">
              Nenhuma outra empresa cadastrada ainda.
            </li>
          )}
        </ul>
      )}
    </section>
  )
}
