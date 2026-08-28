import { useState } from 'react'
import { ChevronRight, ShieldOff, Building2 } from 'lucide-react'
import { useEmpresasParaAdministrarLinhas } from '@/dados/modelosPerfil'
import {
  useProdutosParaOrganizacao,
  useDefinirLiberacaoProduto,
  useDefinirLiberacaoTodosProdutosOrganizacao,
} from '@/dados/produtos'
import { useOrganizacao } from '@/dados/organizacao'
import { Botao } from '@/componentes/ui/Botao'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { PaginaLista } from '@/componentes/ui/PaginaLista'
import { cn } from '@/lib/utilitarios'
import { disparar } from '@/lib/avisoErro'

/**
 * O outro ângulo da liberação criada em "Liberado para", dentro da ficha do
 * produto — lá se escolhe um PRODUTO e se decide quem pode importá-lo; aqui
 * se escolhe uma EMPRESA e se decide quais produtos ela recebe. As duas
 * mexem na mesma tabela, então uma mudança numa aparece na outra sozinha.
 *
 * Gêmea de `AdministrarLinhasEmpresas`, de propósito: quem já sabe liberar
 * linha não precisa aprender nada novo para liberar produto.
 *
 * A lista de empresas é a MESMA da tela de linhas — `empresas_para_
 * administrar_linhas` devolve "as organizações que não são a central", que
 * não tem nada de específico de linha. Duplicar a função só para trocar o
 * nome deixaria duas versões da mesma pergunta para divergirem depois.
 */
export default function AdministrarProdutosEmpresas() {
  const { data: organizacao } = useOrganizacao()
  const souCentral = Boolean(organizacao?.eh_catalogo_central)

  const {
    data: empresas,
    isPending,
    error,
  } = useEmpresasParaAdministrarLinhas()
  const [empresaSelecionada, setEmpresaSelecionada] = useState<{
    id: string
    nome: string
  } | null>(null)

  const { data: produtos, isPending: produtosCarregando } =
    useProdutosParaOrganizacao(empresaSelecionada?.id ?? null)
  const liberarProduto = useDefinirLiberacaoProduto()
  const liberarTodos = useDefinirLiberacaoTodosProdutosOrganizacao()

  if (!souCentral || error) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-6">
        <BotaoVoltar para="/produtos" rotulo="Produtos" className="mb-4" />
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-xl p-8 text-center"
        >
          <ShieldOff aria-hidden="true" className="text-texto-suave size-10" />
          <p className="text-texto-suave">
            Só quem administra o catálogo central acessa esta tela.
          </p>
        </div>
      </div>
    )
  }

  return (
    <PaginaLista
      className="max-w-3xl"
      cabecalho={
        <>
          {empresaSelecionada ? (
            <BotaoVoltar
              onClick={() => setEmpresaSelecionada(null)}
              rotulo="Empresas"
              className="mb-4"
            />
          ) : (
            <BotaoVoltar para="/produtos" rotulo="Produtos" className="mb-4" />
          )}

          <header className="mb-5">
            <h1 className="text-2xl font-bold">
              {empresaSelecionada
                ? empresaSelecionada.nome
                : 'Administrar produtos por empresa'}
            </h1>
            <p className="text-texto-suave mt-1">
              {empresaSelecionada
                ? 'Quais produtos do catálogo central esta empresa pode importar.'
                : 'Escolha uma empresa para liberar todos os produtos de uma vez, ou produto por produto.'}
            </p>
          </header>

          {empresaSelecionada && (
            <div className="mb-4 flex gap-2">
              <Botao
                variante="secundaria"
                tamanho="pequeno"
                onClick={() =>
                  disparar(
                    liberarTodos.mutateAsync({
                      organizacaoId: empresaSelecionada.id,
                      liberada: true,
                    }),
                  )
                }
                carregando={liberarTodos.isPending}
                className="flex-1"
              >
                Liberar todos
              </Botao>
              <Botao
                variante="secundaria"
                tamanho="pequeno"
                onClick={() =>
                  disparar(
                    liberarTodos.mutateAsync({
                      organizacaoId: empresaSelecionada.id,
                      liberada: false,
                    }),
                  )
                }
                carregando={liberarTodos.isPending}
                className="flex-1"
              >
                Bloquear todos
              </Botao>
            </div>
          )}

          {(isPending || (empresaSelecionada && produtosCarregando)) && (
            <p className="text-texto-suave">Carregando…</p>
          )}
        </>
      }
    >
      {!empresaSelecionada && !isPending && empresas?.length === 0 && (
        <p className="bg-superficie-2 text-texto-suave rounded-xl p-6 text-center">
          Nenhuma outra empresa cadastrada ainda.
        </p>
      )}

      {!empresaSelecionada && !isPending && (
        <ul className="flex flex-col gap-2">
          {empresas?.map((empresa) => (
            <li key={empresa.organizacao_id}>
              <button
                type="button"
                onClick={() =>
                  setEmpresaSelecionada({
                    id: empresa.organizacao_id,
                    nome: empresa.nome_fantasia,
                  })
                }
                className="bg-celula hover:bg-superficie-2 border-borda flex min-h-16 w-full items-center gap-3 rounded-xl border-2 p-4 text-left shadow-sm"
              >
                <Building2
                  aria-hidden="true"
                  className="text-acao-600 size-5 shrink-0"
                />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {empresa.nome_fantasia}
                </span>
                <ChevronRight
                  aria-hidden="true"
                  className="text-texto-suave size-4 shrink-0"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      {empresaSelecionada && !produtosCarregando && produtos?.length === 0 && (
        <p className="bg-superficie-2 text-texto-suave rounded-xl p-6 text-center">
          O catálogo central ainda não tem produtos para liberar.
        </p>
      )}

      {empresaSelecionada && !produtosCarregando && (
        <ul className="flex flex-col gap-1.5">
          {produtos?.map((p) => (
            <li
              key={p.produto_id}
              className="bg-celula border-borda flex items-center justify-between gap-2 rounded-xl border-2 px-3 py-2.5"
            >
              <span className="min-w-0 flex-1 truncate font-medium">
                {/* O código junto do nome: dois produtos podem se chamar
                    "Janela integrada" e diferir só na medida. */}
                <span className="text-texto-suave me-1.5 font-mono text-xs">
                  {p.codigo}
                </span>
                {p.nome}
              </span>
              <button
                type="button"
                onClick={() =>
                  disparar(
                    liberarProduto.mutateAsync({
                      produtoId: p.produto_id,
                      organizacaoId: empresaSelecionada.id,
                      liberada: !p.liberada,
                    }),
                  )
                }
                disabled={liberarProduto.isPending}
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
                  p.liberada
                    ? 'bg-economia-50 text-economia-700 hover:bg-economia-100'
                    : 'bg-atencao-50 text-atencao-700 hover:bg-atencao-100',
                )}
              >
                {p.liberada ? 'Liberado' : 'Bloqueado'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </PaginaLista>
  )
}
