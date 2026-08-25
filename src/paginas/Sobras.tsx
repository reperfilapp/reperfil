import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Search,
  PackagePlus,
  ScanLine,
  ChevronRight,
  Layers,
  Copy,
} from 'lucide-react'
import { useSobras, type SobraDetalhada } from '@/dados/sobras'
import { useCapasDesenhos } from '@/dados/desenhosTecnicos'
import { MiniaturaPerfil } from '@/componentes/MiniaturaPerfil'
import { AmostraCor } from '@/componentes/ui/AmostraCor'
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
import { formatarMedidasSecao } from '@/dominio/secao'
import { filtrarPerfis } from '@/dominio/buscaPerfil'

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

/*
 * O texto próprio da sobra (código, acabamento, local, cliente/obra,
 * observações) É comparado aqui. O que é do PERFIL (código sem hífen,
 * descrição, e as medidas digitadas "35 25") passa por `filtrarPerfis` —
 * mesma regra usada no catálogo e na busca de sobras por medida —, e chega
 * pronto no conjunto `codigosDeModeloCorrespondentes`, calculado uma vez só
 * para todos os modelos em estoque, não sobra por sobra.
 */
function combina(
  sobra: SobraDetalhada,
  termo: string,
  codigosDeModeloCorrespondentes: ReadonlySet<string>,
): boolean {
  const busca = termo.trim().toLowerCase()

  if (busca === '') return true

  return (
    sobra.codigo.toLowerCase().includes(busca) ||
    (sobra.acabamento?.nome.toLowerCase().includes(busca) ?? false) ||
    (sobra.localizacao?.codigo.toLowerCase().includes(busca) ?? false) ||
    (sobra.cliente_obra?.toLowerCase().includes(busca) ?? false) ||
    (sobra.observacoes?.toLowerCase().includes(busca) ?? false) ||
    (sobra.modelo !== null &&
      codigosDeModeloCorrespondentes.has(sobra.modelo.codigo))
  )
}

export default function Sobras() {
  const { data: sobras, isPending, error, refetch } = useSobras()
  const { data: capas } = useCapasDesenhos()
  const { perfil } = useAutenticacao()
  const [busca, setBusca] = useState('')
  const [lendoQr, setLendoQr] = useState(false)
  const [etiqueta, setEtiqueta] = useState<SobraDetalhada | null>(null)
  const [ampliado, setAmpliado] = useState<{
    id: string
    codigo: string
    descricao: string
  } | null>(null)
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

  // Um perfil por código — a mesma regra de busca do catálogo (código sem
  // hífen, medidas em qualquer ordem) roda uma vez sobre eles, não sobra
  // por sobra.
  const modelosUnicos = [
    ...new Map(
      (sobras ?? [])
        .filter((s) => s.modelo !== null)
        .map((s) => [s.modelo!.codigo, s.modelo!] as const),
    ).values(),
  ]
  const codigosDeModeloCorrespondentes = new Set(
    filtrarPerfis(modelosUnicos, busca).map((m) => m.codigo),
  )

  const encontradas = (sobras ?? []).filter((sobra) =>
    combina(sobra, busca, codigosDeModeloCorrespondentes),
  )
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

  // Buscando, o resultado fica dentro da linha aberta (`daLinha` já é
  // `encontradas` inteiro quando não há linha, ou for "todas") — digitar
  // dentro de "Suprema" não deve trazer sobra de outra linha.
  const visiveis = buscando
    ? daLinha
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
            <h1 className="text-2xl font-bold">Estoque</h1>
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
                placeholder="Código, medidas, perfil, acabamento ou local"
                aria-label="Buscar material"
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

          {/* Continua à mostra buscando: confirma que o resultado está
              restrito a esta linha, e "Voltar" segue disponível. */}
          {!isPending && linhaAberta !== null && (
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="flex min-w-0 items-baseline truncate font-semibold">
                {perfilEmFoco ? (
                  <span className="text-acao-600 font-mono text-2xl font-bold">
                    {perfilEmFoco.modelo?.codigo ?? ''}
                  </span>
                ) : linhaAberta === TODAS ? (
                  'Todos os materiais'
                ) : (
                  linhaAberta
                )}
                <span className="text-texto-suave ml-2 text-base font-normal">
                  ({perfilEmFoco ? visiveis.length : perfis.length})
                </span>
              </p>

              {!perfilEmFoco && (
                <AlternadorOrdenacao
                  estado={ordenacao}
                  aoMudar={setOrdenacao}
                />
              )}

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
                ? 'Nenhum material encontrado com esse termo.'
                : 'Nenhum material nesta linha.'
            }
            aoTentarNovamente={() => void refetch()}
          />
        </>
      }
      rodape={
        !isPending && mostrandoLinhas && grupos.length > 0 ? (
          <button
            type="button"
            onClick={() => abrir({ linha: TODAS, perfil: null })}
            className="text-acao-600 mx-auto block shrink-0 pb-2 text-sm font-medium hover:underline"
          >
            Ver todas as sobras
          </button>
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
                className="bg-celula hover:bg-celula border-borda flex min-h-16 w-full items-center gap-3 rounded-xl border-2 p-4 text-left shadow-sm"
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
          {perfis.map(({ id, modelo, resumo }) => {
            const qtdLotes = daLinha.filter(
              (s) => s.modelo_perfil_id === id,
            ).length
            return (
              <li
                key={id}
                className="bg-celula border-borda flex min-h-16 w-full items-center overflow-hidden rounded-xl border-2 shadow-sm"
              >
                {capas?.get(id) ? (
                  <button
                    type="button"
                    onClick={() =>
                      modelo &&
                      setAmpliado({
                        id,
                        codigo: modelo.codigo,
                        descricao: modelo.descricao,
                      })
                    }
                    aria-label={`Ampliar desenho técnico de ${modelo?.descricao}`}
                    className="shrink-0 py-4 pl-4 transition-opacity hover:opacity-80"
                  >
                    <MiniaturaPerfil
                      link={capas.get(id)}
                      codigo={modelo?.codigo ?? ''}
                    />
                  </button>
                ) : (
                  <div className="shrink-0 py-4 pl-4">
                    <MiniaturaPerfil
                      link={null}
                      codigo={modelo?.codigo ?? ''}
                    />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => abrir({ perfil: id })}
                  className="hover:bg-superficie-2 flex min-w-0 flex-1 items-center justify-between gap-2 self-stretch py-3 pr-3 pl-2 text-left transition-colors"
                >
                  <span className="min-w-0 flex-1">
                    <span className="line-clamp-2 block text-[15px] leading-snug font-medium">
                      <span className="text-acao-600 font-mono text-lg font-bold">
                        {modelo?.codigo}
                      </span>{' '}
                      {modelo?.descricao}
                    </span>
                    <span className="text-texto-suave mt-0.5 block text-xs tabular-nums">
                      {formatarResumo(resumo)} · {qtdLotes}{' '}
                      {qtdLotes === 1 ? 'lote' : 'lotes'}
                    </span>
                    {modelo && formatarMedidasSecao(modelo) && (
                      <span className="text-texto-suave mt-0.5 block truncate text-xs">
                        {formatarMedidasSecao(modelo)}
                      </span>
                    )}
                  </span>

                  <ChevronRight
                    aria-hidden="true"
                    className="text-texto-suave size-4 shrink-0"
                  />
                </button>
              </li>
            )
          })}
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
              className="bg-celula border-borda mb-2 flex flex-col overflow-hidden rounded-xl border-2 shadow-sm"
            >
              <div className="flex items-start gap-3 px-3 pt-3">
                {/* Esquerda: desenho técnico pequeno + selo de status */}
                <div className="flex w-[4.5rem] shrink-0 flex-col items-center gap-1.5">
                  {capas?.get(sobra.modelo_perfil_id) ? (
                    <button
                      type="button"
                      onClick={() =>
                        sobra.modelo &&
                        setAmpliado({
                          id: sobra.modelo_perfil_id,
                          codigo: sobra.modelo.codigo,
                          descricao: sobra.modelo.descricao,
                        })
                      }
                      aria-label={`Ampliar desenho técnico de ${sobra.modelo?.descricao}`}
                      className="border-borda flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-lg border bg-white transition-opacity hover:opacity-80"
                    >
                      <img
                        src={capas.get(sobra.modelo_perfil_id)!}
                        alt={sobra.modelo?.codigo ?? ''}
                        className="max-h-[3.5rem] max-w-[3.5rem] object-contain"
                      />
                    </button>
                  ) : (
                    <div className="border-borda flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-lg border bg-white">
                      <MiniaturaPerfil
                        link={null}
                        codigo={sobra.modelo?.codigo ?? ''}
                      />
                    </div>
                  )}
                  <span
                    className={`rounded-md px-1.5 py-0.5 text-[0.65rem] leading-tight font-semibold ${COR_STATUS[sobra.status]}`}
                  >
                    {ROTULO_STATUS[sobra.status]}
                  </span>
                </div>

                {/* Direita: informações compactas */}
                <Link
                  to={`/sobras/${sobra.id}`}
                  className="flex min-w-0 flex-1 flex-col gap-0.5"
                  aria-label={`Ver detalhes do material ${sobra.codigo}`}
                >
                  <p className="text-[15px] leading-snug">
                    <strong className="text-acao-600 font-mono text-lg font-bold">
                      {sobra.modelo?.codigo}
                    </strong>
                    <span className="font-bold">
                      {' '}
                      — {sobra.modelo?.descricao}
                    </span>
                  </p>
                  <p className="text-texto-suave text-xs">
                    {sobra.modelo && formatarMedidasSecao(sobra.modelo)
                      ? `Medida: ${formatarMedidasSecao(sobra.modelo)}`
                      : `Medida: ----`}
                  </p>
                  <hr className="border-borda my-1" />
                  <div className="mt-0.5 flex items-center gap-x-3 text-xs">
                    <span>
                      Qt. Peças:{' '}
                      <strong className="text-acao-600 font-bold">
                        {String(disponivel).padStart(2, '0')}
                      </strong>
                    </span>
                    <span>
                      Med.:{' '}
                      <strong className="text-acao-600 font-bold">
                        {formatarComprimento(sobra.comprimento_mm)}
                      </strong>
                    </span>
                  </div>
                  {sobra.acabamento && (
                    <div className="flex min-w-0 items-center gap-1 text-xs">
                      <span className="shrink-0">Acab.:</span>
                      <AmostraCor
                        corHex={sobra.acabamento.cor_hex}
                        tamanho="pequeno"
                      />
                      <strong className="text-acao-600 truncate font-bold">
                        {sobra.acabamento.nome}
                      </strong>
                    </div>
                  )}
                </Link>
              </div>

              {/* Rodapé com as informações adicionais solicitadas */}
              <Link
                to={`/sobras/${sobra.id}`}
                className="border-borda divide-borda text-acao-700 hover:bg-superficie-2 mt-2 flex items-center divide-x border-t py-2 text-[0.8rem] font-bold transition-colors"
              >
                <div
                  className={
                    sobra.cliente_obra || sobra.localizacao
                      ? 'shrink-0 truncate px-3 text-center uppercase'
                      : 'flex-1 truncate px-2 text-center uppercase'
                  }
                >
                  {sobra.tipo_material === 'novo' ? 'NOVO' : 'SOBRA'}
                </div>
                {sobra.cliente_obra && (
                  <div className="flex-1 truncate px-2 text-center">
                    {sobra.cliente_obra}
                  </div>
                )}
                {sobra.localizacao && (
                  <div className="shrink-0 truncate px-3 text-center">
                    {sobra.localizacao.codigo}
                  </div>
                )}
              </Link>
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
