import { lazy, Suspense, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, PackagePlus, ScanLine, Tag, ChevronRight } from 'lucide-react'
import { useSobras, type SobraDetalhada } from '@/dados/sobras'
import { useCapasDesenhos } from '@/dados/desenhosTecnicos'
import { MiniaturaPerfil } from '@/componentes/MiniaturaPerfil'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { podeMovimentarEstoque } from '@/autenticacao/contexto'
import { formatarComprimento } from '@/dominio/medidas'
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
import type { StatusLote } from '@/tipos/banco'

const ROTULO_STATUS: Record<StatusLote, string> = {
  disponivel: 'disponível',
  reservada: 'reservada',
  consumida: 'consumida',
  descartada: 'descartada',
  em_conferencia: 'em conferência',
}

/** Verde para o que dá para usar, âmbar para o que está preso, cinza para o
 *  que saiu do estoque. Vermelho fica reservado a descarte. */
const COR_STATUS: Record<StatusLote, string> = {
  disponivel: 'bg-economia-100 text-economia-700',
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

  const visiveis = (sobras ?? []).filter((sobra) => combina(sobra, busca))

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-6">
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

      <EstadoConsulta
        carregando={isPending}
        erro={error}
        vazio={visiveis.length === 0}
        mensagemVazio={
          busca
            ? 'Nenhuma sobra encontrada com esse termo.'
            : 'Nenhuma sobra cadastrada ainda.'
        }
        aoTentarNovamente={() => void refetch()}
      />

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
                <Link
                  to={`/sobras/${sobra.id}`}
                  className="flex min-w-0 flex-1 items-start gap-3"
                  aria-label={`Ver detalhes da sobra ${sobra.codigo}`}
                >
                  <MiniaturaPerfil
                    link={capas?.get(sobra.modelo_perfil_id)}
                    codigo={sobra.modelo?.codigo ?? ''}
                  />

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
    </div>
  )
}
