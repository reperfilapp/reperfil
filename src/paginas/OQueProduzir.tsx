import { Link } from 'react-router-dom'
import { ChevronRight, PackageSearch } from 'lucide-react'
import { useProdutos, useListaTecnicaCompleta } from '@/dados/produtos'
import { useSobras } from '@/dados/sobras'
import { useAcabamentos } from '@/dados/acabamentos'
import { useConfiguracoes, paraConfiguracaoCorte } from '@/dados/configuracoes'
import { unidadesProduziveis } from '@/dominio/producao'
import { sobrasDisponiveis } from '@/dominio/estoqueParaProducao'
import { formatarMedidaProduto } from '@/dominio/produto'
import { CONFIGURACAO_CORTE_PADRAO } from '@/dominio/corte'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { PaginaLista } from '@/componentes/ui/PaginaLista'

/**
 * A pergunta invertida: em vez de "dá para fazer esta janela?", "o que dá
 * para fazer com o que está na prateleira?".
 *
 * É a tela que transforma o estoque de sobras em oportunidade. Sobra que
 * ninguém sabe que serve é sucata; aqui ela aparece como duas janelas
 * prontas para vender.
 */
export default function OQueProduzir() {
  const { data: produtos, isPending } = useProdutos()
  const { data: listaToda } = useListaTecnicaCompleta()
  const { data: sobras } = useSobras()
  const { data: acabamentos } = useAcabamentos()
  const { data: config } = useConfiguracoes()

  const configCorte = config
    ? paraConfiguracaoCorte(config)
    : CONFIGURACAO_CORTE_PADRAO

  const disponiveis = sobrasDisponiveis(sobras ?? [])

  const avaliados = (produtos ?? [])
    .map((produto) => {
      const lista = (listaToda ?? [])
        .filter((item) => item.produto_id === produto.id)
        .map((item) => ({
          modelo_perfil_id: item.modelo_perfil_id,
          comprimento_mm: item.comprimento_mm,
          quantidade: item.quantidade,
        }))

      return {
        produto,
        temReceita: lista.length > 0,
        resultado: unidadesProduziveis(lista, disponiveis, configCorte),
      }
    })
    // Do que rende mais para o que rende menos: quem abre esta tela quer
    // saber o que PODE fazer, e a lista de impossíveis fica no fim.
    .sort((a, b) => b.resultado.unidades - a.resultado.unidades)

  const possiveis = avaliados.filter((a) => a.resultado.unidades > 0)

  return (
    <PaginaLista
      className="max-w-2xl"
      cabecalho={
        <>
          <BotaoVoltar para="/mais" rotulo="Mais" className="mb-4" />

          <header className="mb-4">
            <h1 className="text-2xl font-bold">O que dá para produzir</h1>
            <p className="text-texto-suave mt-1">
              Comparando a lista técnica de cada produto com as sobras
              disponíveis agora.
            </p>
          </header>

          {isPending && <p className="text-texto-suave">Carregando…</p>}

          {!isPending && possiveis.length > 0 && (
            <p className="bg-destaque text-destaque-texto border-destaque-borda mb-4 rounded-xl border p-4 font-medium">
              {possiveis.length}{' '}
              {possiveis.length === 1
                ? 'produto pode sair'
                : 'produtos podem sair'}{' '}
              das sobras de hoje.
            </p>
          )}
        </>
      }
    >
      {!isPending && avaliados.length === 0 && (
        <p className="bg-superficie-2 text-texto-suave rounded-xl p-6 text-center">
          Nenhum produto cadastrado. Cadastre uma janela ou porta em{' '}
          <Link to="/produtos" className="text-acao-600 underline">
            Produtos
          </Link>{' '}
          e monte a lista técnica dela.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {avaliados.map(({ produto, temReceita, resultado }) => {
          const acabamento = acabamentos?.find(
            (a) => a.id === resultado.acabamento_id,
          )

          return (
            <li key={produto.id}>
              <Link
                to={`/produtos/${produto.id}`}
                className="bg-celula border-borda flex items-center gap-3 rounded-xl border-2 p-4 shadow-sm"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {produto.nome}
                  </span>
                  <span className="text-texto-suave block truncate text-sm">
                    {formatarMedidaProduto(produto) ?? produto.codigo}
                    {acabamento && ` · ${acabamento.nome}`}
                  </span>
                </span>

                {/* O número é o que se procura, então ele é o que se lê de
                    longe. "Sem lista" não é zero: é uma pergunta que o
                    sistema ainda não tem como responder. */}
                <span className="shrink-0 text-right">
                  {!temReceita ? (
                    <span className="text-texto-suave text-xs">sem lista</span>
                  ) : resultado.unidades > 0 ? (
                    <span className="text-acao-700 text-2xl font-bold tabular-nums">
                      {resultado.unidades}
                    </span>
                  ) : (
                    <span className="text-texto-suave text-xl font-bold">
                      —
                    </span>
                  )}
                </span>

                <ChevronRight
                  aria-hidden="true"
                  className="text-texto-suave size-4 shrink-0"
                />
              </Link>
            </li>
          )
        })}
      </ul>

      {!isPending && avaliados.length > 0 && possiveis.length === 0 && (
        <p className="bg-superficie-2 text-texto-suave mt-3 rounded-xl p-4 text-sm">
          <PackageSearch aria-hidden="true" className="mr-2 inline size-4" />
          Nenhum produto fecha com as sobras de hoje. Abra um deles para ver
          exatamente o que falta.
        </p>
      )}
    </PaginaLista>
  )
}
