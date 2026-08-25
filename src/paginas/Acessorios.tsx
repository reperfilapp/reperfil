import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, PackagePlus, ChevronRight, Puzzle } from 'lucide-react'
import { useLotesAcessorio, type AcessorioDetalhado } from '@/dados/acessorios'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { podeMovimentarEstoque } from '@/autenticacao/contexto'
import { AmostraCor } from '@/componentes/ui/AmostraCor'
import { EstadoConsulta } from '@/componentes/EstadoConsulta'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { PaginaLista } from '@/componentes/ui/PaginaLista'

const ROTULO_STATUS: Record<string, string> = {
  disponivel: 'disponível',
  consumida: 'consumida',
  descartada: 'descartada',
  em_conferencia: 'em conferência',
}

const COR_STATUS: Record<string, string> = {
  disponivel: 'bg-aluminio-200 text-grafite-900',
  consumida: 'bg-superficie-2 text-texto-suave',
  descartada: 'bg-erro-50 text-erro-700',
  em_conferencia: 'bg-atencao-50 text-atencao-700',
}

const SEM_CATEGORIA = 'Sem categoria'

function combina(item: AcessorioDetalhado, termo: string): boolean {
  const busca = termo.trim().toLowerCase()
  if (busca === '') return true

  return (
    item.codigo.toLowerCase().includes(busca) ||
    (item.modelo?.codigo.toLowerCase().includes(busca) ?? false) ||
    (item.modelo?.descricao.toLowerCase().includes(busca) ?? false) ||
    (item.acabamento?.nome.toLowerCase().includes(busca) ?? false) ||
    (item.localizacao?.codigo.toLowerCase().includes(busca) ?? false)
  )
}

export default function Acessorios() {
  const { data: itens, isPending, error, refetch } = useLotesAcessorio()
  const { perfil } = useAutenticacao()
  const [busca, setBusca] = useState('')

  const encontrados = (itens ?? []).filter((item) => combina(item, busca))

  const grupos = new Map<string, AcessorioDetalhado[]>()
  for (const item of encontrados) {
    const chave = item.modelo?.categoria?.trim() || SEM_CATEGORIA
    grupos.set(chave, [...(grupos.get(chave) ?? []), item])
  }
  const ordenados = [...grupos.entries()].sort(([a], [b]) => {
    if (a === SEM_CATEGORIA) return 1
    if (b === SEM_CATEGORIA) return -1
    return a.localeCompare(b, 'pt-BR')
  })

  return (
    <PaginaLista
      cabecalho={
        <>
          <BotaoVoltar para="/" rotulo="Início" className="mb-4" />

          <header className="mb-4 flex items-center justify-between gap-4">
            <h1 className="text-2xl font-bold">Estoque de acessórios</h1>
            {podeMovimentarEstoque(perfil) && (
              <Link
                to="/cadastrar-acessorio"
                className="bg-acao-600 flex min-h-12 items-center gap-2 rounded-xl px-4 font-semibold text-white"
              >
                <PackagePlus aria-hidden="true" className="size-5" />
                Nova
              </Link>
            )}
          </header>

          <div className="relative mb-4">
            <Search
              aria-hidden="true"
              className="text-texto-suave pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2"
            />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Código, acessório, acabamento ou local"
              aria-label="Buscar acessório em estoque"
              className="border-borda bg-superficie min-h-12 w-full rounded-xl border-2 pr-4 pl-12"
            />
          </div>

          <EstadoConsulta
            carregando={isPending}
            erro={error}
            vazio={encontrados.length === 0}
            mensagemVazio={
              busca
                ? 'Nenhum acessório encontrado com esse termo.'
                : 'Nenhum acessório cadastrado ainda.'
            }
            aoTentarNovamente={() => void refetch()}
          />
        </>
      }
    >
      <div className="flex flex-col gap-6">
        {ordenados.map(([categoria, daCategoria]) => (
          <section key={categoria}>
            <h2 className="text-texto-suave mb-2 text-xs font-semibold tracking-wide uppercase">
              {categoria} ({daCategoria.length})
            </h2>

            <ul className="flex flex-col gap-2">
              {daCategoria.map((item) => (
                <li
                  key={item.id}
                  className="bg-celula border-borda flex items-center overflow-hidden rounded-xl border-2 shadow-sm"
                >
                  <div className="flex w-16 shrink-0 items-center justify-center self-stretch">
                    <Puzzle
                      aria-hidden="true"
                      className="text-texto-suave size-7"
                    />
                  </div>

                  <Link
                    to={`/estoque-acessorios/${item.id}`}
                    className="hover:bg-superficie-2 flex min-w-0 flex-1 items-center justify-between gap-2 self-stretch py-3 pr-3 pl-2 text-left transition-colors"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="line-clamp-2 block text-[15px] leading-snug font-medium">
                        <span className="text-acao-600 font-mono font-bold">
                          {item.modelo?.codigo}
                        </span>{' '}
                        {item.modelo?.descricao}
                      </span>
                      <span className="text-texto-suave mt-0.5 flex items-center gap-2 text-xs tabular-nums">
                        <span>
                          {item.quantidade} {item.modelo?.unidade_medida}
                          {item.quantidade === 1 ? '' : 's'}
                        </span>
                        {item.acabamento && (
                          <AmostraCor
                            corHex={item.acabamento.cor_hex}
                            nome={item.acabamento.nome}
                            tamanho="pequeno"
                          />
                        )}
                        {item.localizacao && (
                          <span>· {item.localizacao.codigo}</span>
                        )}
                      </span>
                      <span
                        className={`mt-1 inline-block rounded-md px-1.5 py-0.5 text-[0.65rem] leading-tight font-semibold ${COR_STATUS[item.status]}`}
                      >
                        {ROTULO_STATUS[item.status]}
                      </span>
                    </span>

                    <ChevronRight
                      aria-hidden="true"
                      className="text-texto-suave size-4 shrink-0"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </PaginaLista>
  )
}
