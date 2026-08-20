import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Search,
  PackagePlus,
  ScanLine,
  Tag,
  ChevronRight,
  Layers,
  Copy,
} from 'lucide-react'
import { useSobras, type SobraDetalhada } from '@/dados/sobras'
import { useCapasDesenhos } from '@/dados/desenhosTecnicos'
import { MiniaturaPerfil } from '@/componentes/MiniaturaPerfil'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { podeMovimentarEstoque } from '@/autenticacao/contexto'
import { formatarComprimento } from '@/dominio/medidas'
import { SEM_LINHA } from '@/dados/modelosPerfil'
import { duplicadosNoEstoque } from '@/dominio/duplicidade'
import {
  resumirPorLinha,
  resumirPorPerfil,
  resumoDe,
  formatarResumo,
  maiorPrimeiro,
} from '@/dominio/estoqueResumo'
import { Botao } from '@/componentes/ui/Botao'
import { AlternadorOrdenacao } from '@/componentes/ui/AlternadorOrdenacao'
import { useNiveisNaUrl } from '@/componentes/useNiveisNaUrl'
import { ORDENACAO_PADRAO } from '@/dominio/ordenacaoListas'
/*
 * Carregamento tardio: o leitor de QR traz a biblioteca de decodificação e a
 * etiqueta traz a de geração — juntas, boa parte do JavaScript da aplicação.
 * Nenhuma das duas é usada ao abrir a tela, e o Lighthouse apontou esse peso
 * como JavaScript não utilizado no carregamento inicial.
 */
const LeitorQrCode = lazy(() =>
  import('@/componentes/LeitorQrCode').then((m) => ({
    default: m.LeitorQrCode,
  })),
)
const EtiquetaSobra = lazy(() =>
  import('@/componentes/EtiquetaSobra').then((m) => ({
    default: m.EtiquetaSobra,
  })),
)
import { EstadoConsulta } from '@/componentes/EstadoConsulta'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { PaginaLista } from '@/componentes/ui/PaginaLista'
import { VisualizadorImagem } from '@/componentes/ui/VisualizadorImagem'
import type { StatusLote } from '@/tipos/banco'

/** Valor de `linhaAberta` que significa "ignorar o agrupamento". */
const TODAS = '__todas__'

const ROTULO_STATUS: Record<StatusLote, string> = {
  disponivel: 'disponível',
  reservada: 'reservada',
  consumida: 'consumida',
  descartada: 'descartada',
  em_conferencia: 'em conferência',
}

/*
 * Cinza sólido para o que dá para usar, âmbar para o que está preso,
 * cinza apagado para o que saiu do estoque. Vermelho fica reservado a
 * descarte.
 *
 * "Disponível" e "consumida" são os dois cinzas, então precisam de peso
 * diferente para não se confundirem de relance: o disponível tem fundo e
 * texto fortes, o consumido é apagado — o que saiu do estoque deve
 * desaparecer da vista, não competir com o que está na prateleira.
 */
const COR_STATUS: Record<StatusLote, string> = {
  disponivel: 'bg-aluminio-200 text-grafite-900',
  reservada: 'bg-atencao-100 text-atencao-700',
  consumida: 'bg-superficie-2 text-texto-suave',
  descartada: 'bg-erro-50 text-erro-700',
  em_conferencia: 'bg-atencao-50 text-atencao-700',
}

function combina(sobra: SobraDetalhada, termo: string): boolean {
  const busca = termo.trim().toLowerCase()

  if (busca === '') return true

  return (
    sobra.codigo.toLowerCase().includes(busca) ||
    (sobra.modelo?.codigo.toLowerCase().includes(busca) ?? false) ||
    (sobra.modelo?.descricao.toLowerCase().includes(busca) ?? false) ||
    (sobra.acabamento?.nome.toLowerCase().includes(busca) ?? false) ||
    (sobra.localizacao?.codigo.toLowerCase().includes(busca) ?? false)
  )
}

export default function Sobras() {
  const { data: sobras, isPending, error, refetch } = useSobras()
  const { data: capas } = useCapasDesenhos()
  const { perfil } = useAutenticacao()
  const [busca, setBusca] = useState('')
  const [lendoQr, setLendoQr] = useState(false)
  const [etiqueta, setEtiqueta] = useState<SobraDetalhada | null>(null)
  const [ampliado, setAmpliado] = useState<{ id: string; codigo: string; descricao: string } | null>(null)
  /*
   * Mesma porta de entrada das outras telas de perfil: primeiro a linha,
   * depois as peças dela. O estoque cresce rápido, e rolar tudo para achar
   * uma sobra da Suprema no meio das da Linha 25 é trabalho à toa.
   *
   * A busca e o QR Code ignoram o agrupamento: quem tem o código na mão
   * quer a peça, não a linha dela.
   *
   * Dentro da linha vem a lista de PERFIS, e só depois as peças. O depósito
   * tem dezenas de peças por linha, e rolar todas para achar as do perfil
   * que interessa é o mesmo trabalho que o agrupamento por linha já veio
   * resolver um nível acima.
   *
   * Os dois níveis ficam na URL, e não em estado: descer um nível é mudar de
   * tela aos olhos de quem usa, e precisa ser navegação de verdade para o
   * "voltar" subir um degrau em vez de sair da tela. Ver `useNiveisNaUrl`.
   */
  const { nivel, abrir, voltarNivel } = useNiveisNaUrl(['linha', 'perfil'])
  const linhaAberta = nivel('linha')
  const perfilAberto = nivel('perfil')
  // Só vale na lista de perfis de uma linha — a de sobras de um perfil já
  // vem sem essa ambiguidade, não há "nome" a mais para ordenar.
  const [ordenacao, setOrdenacao] = useState(ORDENACAO_PADRAO)

  const encontradas = (sobras ?? []).filter((sobra) => combina(sobra, busca))
  const buscando = busca.trim() !== ''

  const linhaDaSobra = (sobra: SobraDetalhada) =>
    sobra.modelo?.linha?.trim() || SEM_LINHA

  // O resumo conta só o que está DISPONÍVEL, mas a lista continua mostrando
  // todas as peças: o número serve para decidir por onde começar, e uma peça
  // reservada ainda precisa poder ser aberta e consultada.
  const porLinha = resumirPorLinha(encontradas, linhaDaSobra)
  const porPerfil = resumirPorPerfil(encontradas)

  const grupos = [...new Set(encontradas.map(linhaDaSobra))]
    .map((linha) => ({ linha, resumo: resumoDe(porLinha, linha) }))
    .sort((a, b) => {
      // "Sem linha" por último: é o resto, não uma linha de verdade.
      if (a.linha === SEM_LINHA) return 1
      if (b.linha === SEM_LINHA) return -1

      const porTamanho = maiorPrimeiro(a.resumo, b.resumo)

      // Alfabético só no empate — entre duas linhas sem estoque disponível,
      // o nome é a única ordem que não parece aleatória.
      return porTamanho !== 0
        ? porTamanho
        : a.linha.localeCompare(b.linha, 'pt-BR')
    })

  const daLinha =
    linhaAberta === null || linhaAberta === TODAS
      ? encontradas
      : encontradas.filter((s) => linhaDaSobra(s) === linhaAberta)

  /** Os perfis que têm peça na linha aberta, do maior estoque para o menor. */
  const perfis = [
    ...new Map(
      daLinha.map((s) => [s.modelo_perfil_id, s.modelo] as const),
    ).entries(),
  ]
    .map(([id, modelo]) => ({ id, modelo, resumo: resumoDe(porPerfil, id) }))
    .sort((a, b) => {
      if (ordenacao.criterio === 'nome') {
        const porNome = (a.modelo?.codigo ?? '').localeCompare(
          b.modelo?.codigo ?? '',
          'pt-BR',
        )
        return ordenacao.decrescente ? -porNome : porNome
      }

      const porTamanho = maiorPrimeiro(a.resumo, b.resumo)
      const porEstoque = ordenacao.decrescente ? porTamanho : -porTamanho

      return porEstoque !== 0
        ? porEstoque
        : (a.modelo?.codigo ?? '').localeCompare(
            b.modelo?.codigo ?? '',
            'pt-BR',
          )
    })

  const visiveis = buscando
    ? encontradas
    : perfilAberto === null
      ? []
      : daLinha.filter((s) => s.modelo_perfil_id === perfilAberto)

  const repetidos = duplicadosNoEstoque(sobras ?? []).length

  const mostrandoLinhas = !buscando && linhaAberta === null
  const mostrandoPerfis =
    !buscando && linhaAberta !== null && perfilAberto === null
  const perfilEmFoco = perfis.find((p) => p.id === perfilAberto)

  return (
    <PaginaLista
      cabecalho={
        <>
          <BotaoVoltar para="/" rotulo="Início" className="mb-4" />

          <header className="mb-4 flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold">Sobras</h1>
            {podeMovimentarEstoque(perfil) && (
              <Link
                to="/cadastrar"
                className="bg-acao-600 flex min-h-12 items-center gap-2 rounded-xl px-4 font-semibold text-white"
              >
                <PackagePlus aria-hidden="true" className="size-5" />
                Nova
              </Link>
            )}
          </header>

          <div className="mb-4 flex gap-2">
            <div className="relative flex-1">
              <Search
                aria-hidden="true"
                className="text-texto-suave pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2"
              />
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Código, perfil, acabamento ou local"
                aria-label="Buscar sobra"
                className="border-borda bg-superficie min-h-12 w-full rounded-xl border-2 pr-4 pl-12"
              />
            </div>

            <button
              type="button"
              onClick={() => setLendoQr(true)}
              aria-label="Ler código pela câmera"
              className="border-borda bg-superficie flex min-h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2"
            >
              <ScanLine aria-hidden="true" className="size-5" />
            </button>
          </div>

          {/* Dentro de uma linha: diz onde se está e como voltar. Fica no
              cabeçalho, junto da busca, e não some ao rolar a lista. */}
          {!isPending && !buscando && linhaAberta !== null && (
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="min-w-0 truncate font-semibold">
                {perfilEmFoco
                  ? `${perfilEmFoco.modelo?.codigo ?? ''} ${perfilEmFoco.modelo?.descricao ?? ''}`
                  : linhaAberta === TODAS
                    ? 'Todas as sobras'
                    : linhaAberta}
                <span className="text-texto-suave ml-2 font-normal">
                  ({perfilEmFoco ? visiveis.length : perfis.length})
                </span>
              </p>

              {/* Só na lista de perfis: dentro de um perfil já aberto, as
                  sobras são a mesma peça em lotes diferentes — não há nome
                  para ordenar por ele, só o comprimento de cada lote. */}
              {!perfilEmFoco && (
                <AlternadorOrdenacao estado={ordenacao} aoMudar={setOrdenacao} />
              )}

              {/* Volta um nível de cada vez: do perfil para os perfis da
                  linha, e da linha para as linhas. Pular direto para o topo
                  obrigaria a refazer a escolha da linha só para ver outro
                  perfil dela. */}
              <BotaoVoltar
                onClick={voltarNivel}
                rotulo={perfilAberto !== null ? 'Perfis' : 'Linhas'}
                className="shrink-0"
              />
            </div>
          )}

          <EstadoConsulta
            carregando={isPending}
            erro={error}
            vazio={
              buscando
                ? visiveis.length === 0
                : mostrandoPerfis
                  ? perfis.length === 0
                  : !mostrandoLinhas && visiveis.length === 0
            }
            mensagemVazio={
              busca
                ? 'Nenhuma sobra encontrada com esse termo.'
                : 'Nenhuma sobra nesta linha.'
            }
            aoTentarNovamente={() => void refetch()}
          />
        </>
      }
      rodape={
        // Só na lista de linhas: dentro de uma delas, o atalho de voltar já
        // está no cabeçalho, e um botão a mais aqui embaixo só ocuparia
        // altura que a lista quer.
        !isPending && mostrandoLinhas && grupos.length > 0 ? (
          <Botao
            variante="contorno"
            tamanho="largura_total"
            onClick={() => abrir({ linha: TODAS, perfil: null })}
          >
            Ver todas as sobras
          </Botao>
        ) : undefined
      }
    >
      {/* Aviso de material contado duas vezes. Só na porta de entrada, e
          só quando existe: quem vê "8 peças" e "51 peças" separadas desiste
          de um corte que caberia nas 59. */}
      {!isPending && mostrandoLinhas && repetidos > 0 && (
        <Link
          to="/sobras/repetidos"
          className="bg-atencao-50 border-atencao-300 mb-3 flex items-center gap-3 rounded-xl border p-4"
        >
          <Copy
            aria-hidden="true"
            className="text-atencao-700 size-5 shrink-0"
          />
          <span className="min-w-0 flex-1 text-sm">
            <span className="text-atencao-700 block font-semibold">
              {repetidos === 1
                ? '1 material aparece em lotes repetidos'
                : `${repetidos} materiais aparecem em lotes repetidos`}
            </span>
            <span className="text-texto-suave">
              Mesmo perfil, acabamento e comprimento em cadastros separados.
            </span>
          </span>
          <ChevronRight
            aria-hidden="true"
            className="text-texto-suave size-4 shrink-0"
          />
        </Link>
      )}

      {/* Lista de linhas: a porta de entrada do estoque. */}
      {!isPending && mostrandoLinhas && grupos.length > 0 && (
        <ul className="flex flex-col gap-2">
          {grupos.map(({ linha, resumo }) => (
            <li key={linha}>
              <button
                type="button"
                onClick={() => {
                  abrir({ linha, perfil: null })
                }}
                className="bg-superficie hover:bg-superficie-2 flex min-h-16 w-full items-center gap-3 rounded-xl p-4 text-left shadow-sm"
              >
                <Layers
                  aria-hidden="true"
                  className="text-acao-600 size-5 shrink-0"
                />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {linha}
                </span>
                <span className="text-texto-suave shrink-0 text-sm tabular-nums">
                  {formatarResumo(resumo)}
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

      {/* Lista de perfis da linha: o segundo nível. Cada um com o que há
          dele em estoque, do maior para o menor — é por onde se começa a
          procurar o que aproveitar. */}
      {!isPending && mostrandoPerfis && perfis.length > 0 && (
        <ul className="flex flex-col gap-2">
          {perfis.map(({ id, modelo, resumo }) => (
            <li
              key={id}
              className="bg-superficie flex min-h-16 w-full items-center rounded-xl shadow-sm overflow-hidden"
            >
              {capas?.get(id) ? (
                <button
                  type="button"
                  onClick={() => modelo && setAmpliado({ id, codigo: modelo.codigo, descricao: modelo.descricao })}
                  aria-label={`Ampliar desenho técnico de ${modelo?.descricao}`}
                  className="pl-4 py-4 shrink-0 hover:opacity-80 transition-opacity"
                >
                  <MiniaturaPerfil
                    link={capas.get(id)}
                    codigo={modelo?.codigo ?? ''}
                  />
                </button>
              ) : (
                <div className="pl-4 py-4 shrink-0">
                  <MiniaturaPerfil
                    link={null}
                    codigo={modelo?.codigo ?? ''}
                  />
                </div>
              )}

              <button
                type="button"
                onClick={() => abrir({ perfil: id })}
                className="flex min-w-0 flex-1 items-center justify-between gap-3 text-left pl-3 pr-4 py-4 hover:bg-superficie-2 transition-colors self-stretch"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    <span className="text-acao-600 font-mono">
                      {modelo?.codigo}
                    </span>{' '}
                    {modelo?.descricao}
                  </span>
                  <span className="text-texto-suave block text-sm tabular-nums">
                    {formatarResumo(resumo)}
                  </span>
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

      {!isPending && mostrandoLinhas && grupos.length === 0 && (
        <p className="bg-superficie-2 text-texto-suave rounded-xl p-6 text-center">
          Nenhuma sobra cadastrada ainda.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {visiveis.map((sobra) => {
          const disponivel = sobra.quantidade - sobra.quantidade_reservada

          return (
            <li
              key={sobra.id}
              className="bg-superficie rounded-xl p-4 shadow-sm"
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                {/* O desenho identifica a peça mais rápido que o código. */}
                {capas?.get(sobra.modelo_perfil_id) ? (
                  <button
                    type="button"
                    onClick={() => sobra.modelo && setAmpliado({ id: sobra.modelo_perfil_id, codigo: sobra.modelo.codigo, descricao: sobra.modelo.descricao })}
                    aria-label={`Ampliar desenho técnico de ${sobra.modelo?.descricao}`}
                    className="shrink-0 hover:opacity-80 transition-opacity"
                  >
                    <MiniaturaPerfil
                      link={capas.get(sobra.modelo_perfil_id)}
                      codigo={sobra.modelo?.codigo ?? ''}
                    />
                  </button>
                ) : (
                  <div className="shrink-0">
                    <MiniaturaPerfil
                      link={null}
                      codigo={sobra.modelo?.codigo ?? ''}
                    />
                  </div>
                )}

                <Link
                  to={`/sobras/${sobra.id}`}
                  className="flex min-w-0 flex-1 flex-col"
                  aria-label={`Ver detalhes da sobra ${sobra.codigo}`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 truncate font-semibold">
                      <span className="text-acao-600 font-mono">
                        {sobra.modelo?.codigo}
                      </span>{' '}
                      {sobra.modelo?.descricao}
                      <ChevronRight
                        aria-hidden="true"
                        className="text-texto-suave size-4 shrink-0"
                      />
                    </span>
                    <span className="text-texto-suave block truncate text-sm">
                      <span className="font-mono">{sobra.codigo}</span>
                      {sobra.acabamento && ` · ${sobra.acabamento.nome}`}
                      {sobra.localizacao && ` · ${sobra.localizacao.codigo}`}
                    </span>
                  </span>
                </Link>

                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded px-2 py-1 text-xs font-medium ${COR_STATUS[sobra.status]}`}
                  >
                    {ROTULO_STATUS[sobra.status]}
                  </span>
                  <button
                    type="button"
                    onClick={() => setEtiqueta(sobra)}
                    aria-label={`Etiqueta da sobra ${sobra.codigo}`}
                    className="hover:bg-superficie-2 rounded-lg p-2"
                  >
                    <Tag aria-hidden="true" className="size-4" />
                  </button>
                </div>
              </div>

              <div className="flex items-baseline gap-4">
                <p className="text-xl font-bold tabular-nums">
                  {formatarComprimento(sobra.comprimento_mm)}
                </p>
                <p className="text-texto-suave text-sm">
                  {disponivel} de {sobra.quantidade}{' '}
                  {sobra.quantidade === 1 ? 'peça' : 'peças'} livre
                  {disponivel === 1 ? '' : 's'}
                </p>
              </div>
            </li>
          )
        })}
      </ul>

      <Suspense fallback={null}>
        {lendoQr && (
          <LeitorQrCode
            aberto={lendoQr}
            aoFechar={() => setLendoQr(false)}
            aoLer={(codigo) => {
              setBusca(codigo)
              setLendoQr(false)
            }}
          />
        )}

        {etiqueta && (
          <EtiquetaSobra sobra={etiqueta} aoFechar={() => setEtiqueta(null)} />
        )}
      </Suspense>

      {ampliado && capas?.get(ampliado.id) && (
        <VisualizadorImagem
          src={capas.get(ampliado.id)!}
          alt={`Desenho técnico do perfil ${ampliado.codigo}`}
          titulo={ampliado.descricao}
          aoFechar={() => setAmpliado(null)}
        />
      )}
    </PaginaLista>
  )
}
