import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronRight, Puzzle } from 'lucide-react'
import {
  useModelosAcessorio,
  agruparPorCategoria,
  SEM_CATEGORIA,
} from '@/dados/modelosAcessorio'
import { useCapasDesenhos } from '@/dados/desenhosTecnicos'
import { MiniaturaPerfil } from './MiniaturaPerfil'
import { VisualizadorImagem } from './ui/VisualizadorImagem'
import { BotaoVoltar } from './ui/BotaoVoltar'
import { useNiveisNaUrl } from './useNiveisNaUrl'
import type { ModeloAcessorio } from '@/tipos/banco'

/** Valor de `categoriaAberta` que significa "ignorar o agrupamento". */
const TODAS = '__todas__'

interface PropsSeletorAcessorio {
  selecionado: ModeloAcessorio | null
  aoSelecionar: (modelo: ModeloAcessorio) => void
}

/**
 * Escolha do modelo de acessório, com busca — gêmeo de `SeletorPerfil`, mas
 * agrupado por CATEGORIA em vez de linha (acessório não tem "linha de
 * janela": tem categoria, como em `ModelosAcessorio.tsx`) e sem o resumo de
 * estoque: acessório é catálogo puro, sem controle de peças no depósito.
 */
export function SeletorAcessorio({
  selecionado,
  aoSelecionar,
}: PropsSeletorAcessorio) {
  const navegar = useNavigate()
  const { data: modelos, isPending } = useModelosAcessorio()
  const { data: capas } = useCapasDesenhos('imagem', 'acessorio')
  const [busca, setBusca] = useState('')
  const [ampliado, setAmpliado] = useState<string | null>(null)
  const [tituloAmpliado, setTituloAmpliado] = useState<string | null>(null)
  const { nivel, abrir, voltarNivel } = useNiveisNaUrl(['categoria'])
  const categoriaAberta = nivel('categoria')

  const termo = busca.trim().toLowerCase()
  const buscando = termo !== ''
  const encontrados = (modelos ?? []).filter(
    (m) =>
      termo === '' ||
      m.codigo.toLowerCase().includes(termo) ||
      m.descricao.toLowerCase().includes(termo) ||
      (m.categoria?.toLowerCase().includes(termo) ?? false),
  )

  const grupos = agruparPorCategoria(modelos ?? [])

  const visiveis = buscando
    ? encontrados
    : categoriaAberta === TODAS
      ? encontrados
      : categoriaAberta === null
        ? []
        : encontrados.filter(
            (m) => (m.categoria?.trim() || SEM_CATEGORIA) === categoriaAberta,
          )

  const mostrandoCategorias = !buscando && categoriaAberta === null

  if (selecionado) {
    const desenho = capas?.get(selecionado.id)

    return (
      <>
        <div
          role="button"
          tabIndex={0}
          onClick={() => navegar(`/acessorios/${selecionado.id}`)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              navegar(`/acessorios/${selecionado.id}`)
            }
          }}
          aria-label={`Ver ficha completa do acessório ${selecionado.codigo}`}
          className="border-borda bg-superficie hover:bg-superficie-2 flex cursor-pointer items-start gap-3 rounded-xl border-2 px-3 py-3"
        >
          <div className="border-borda flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-lg border bg-white">
            {desenho ? (
              <img
                src={desenho}
                alt={`Foto do acessório ${selecionado.codigo}`}
                className="max-h-[3.5rem] max-w-[3.5rem] object-contain"
              />
            ) : (
              <MiniaturaPerfil link={null} codigo={selecionado.codigo} />
            )}
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="line-clamp-2 text-[0.8rem] leading-snug">
              <strong className="text-acao-600 font-bold">
                {selecionado.codigo}
              </strong>
              <span className="font-bold"> — {selecionado.descricao}</span>
            </p>
            {selecionado.categoria && (
              <p className="text-texto-suave text-xs">
                {selecionado.categoria}
              </p>
            )}
          </div>

          <ChevronRight
            aria-hidden="true"
            className="text-texto-suave mt-1 size-4 shrink-0"
          />
        </div>

        {ampliado && (
          <VisualizadorImagem
            src={ampliado}
            alt={`Foto do acessório ${selecionado.codigo}, ampliada`}
            titulo={`${selecionado.codigo} — ${selecionado.descricao}`}
            aoFechar={() => setAmpliado(null)}
          />
        )}
      </>
    )
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <div className="relative shrink-0">
          <Search
            aria-hidden="true"
            className="text-texto-suave pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2"
          />
          <input
            type="search"
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Código, descrição ou categoria"
            aria-label="Buscar acessório"
            autoFocus
            className="border-borda bg-superficie min-h-12 w-full rounded-xl border-2 pr-4 pl-12"
          />
        </div>

        {isPending && <p className="text-texto-suave">Carregando acessórios…</p>}

        {!isPending && encontrados.length === 0 && (
          <p className="bg-superficie-2 text-texto-suave flex flex-1 items-center justify-center rounded-xl p-5 text-center">
            {busca
              ? 'Nenhum acessório com esse termo.'
              : 'Nenhum acessório cadastrado. Cadastre em Mais → Catálogo de acessórios.'}
          </p>
        )}

        {!isPending && mostrandoCategorias && grupos.length > 0 && (
          <ul className="border-borda flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-xl border-2 p-2">
            {grupos.map(({ categoria, modelos: daCategoria }) => (
              <li key={categoria}>
                <button
                  type="button"
                  onClick={() => abrir({ categoria })}
                  className="border-borda bg-celula hover:border-acao-500 hover:bg-celula flex min-h-16 w-full items-center gap-3 rounded-xl border-2 p-3 text-left"
                >
                  <Puzzle
                    aria-hidden="true"
                    className="text-acao-600 size-5 shrink-0"
                  />
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {categoria}
                  </span>
                  <span className="text-texto-suave shrink-0 text-sm">
                    {daCategoria.length}
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

        {!isPending && mostrandoCategorias && grupos.length > 0 && (
          <button
            type="button"
            onClick={() => abrir({ categoria: TODAS })}
            className="text-acao-600 shrink-0 text-sm font-medium hover:underline"
          >
            Ver todos os acessórios
          </button>
        )}

        {!isPending && categoriaAberta !== null && (
          <div className="flex shrink-0 items-center justify-between gap-2">
            <p className="min-w-0 truncate text-sm font-semibold">
              {categoriaAberta === TODAS ? 'Todos os acessórios' : categoriaAberta}
              <span className="text-texto-suave ml-2 font-normal">
                ({visiveis.length})
              </span>
            </p>
            <BotaoVoltar
              onClick={voltarNivel}
              rotulo="Categorias"
              className="shrink-0"
            />
          </div>
        )}

        {visiveis.length > 0 && (
          <ul className="border-borda flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-xl border-2 p-2">
            {visiveis.map((modelo) => (
              <li
                key={modelo.id}
                className="border-borda bg-celula focus-within:border-acao-500 focus-within:ring-acao-500 flex min-h-28 w-full items-center overflow-hidden rounded-xl border-2 focus-within:ring-1"
              >
                {capas?.get(modelo.id) ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      setAmpliado(capas.get(modelo.id)!)
                      setTituloAmpliado(
                        `${modelo.codigo} — ${modelo.descricao}`,
                      )
                    }}
                    className="focus-visible:ring-acao-500 relative block shrink-0 rounded-l-lg py-2 pl-2 transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:outline-none"
                    aria-label={`Ver foto do acessório ${modelo.codigo} em tela cheia`}
                  >
                    <MiniaturaPerfil
                      link={capas.get(modelo.id)}
                      codigo={modelo.codigo}
                      recorte="canto-superior-esquerdo"
                    />
                  </button>
                ) : (
                  <div className="shrink-0 py-2 pl-2">
                    <MiniaturaPerfil link={null} codigo={modelo.codigo} />
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => aoSelecionar(modelo)}
                  className="hover:bg-superficie-2 flex min-w-0 flex-1 items-center gap-3 self-stretch py-3 pr-2 pl-3 text-left transition-colors focus-visible:outline-none"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm leading-snug font-semibold">
                      <span className="text-acao-600 font-mono text-base font-bold">
                        {modelo.codigo}
                      </span>{' '}
                      {modelo.descricao}
                    </span>
                    <span className="text-texto-suave block truncate text-sm">
                      {modelo.categoria?.trim() || SEM_CATEGORIA}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {ampliado && (
        <VisualizadorImagem
          src={ampliado}
          alt="Foto ampliada"
          titulo={tituloAmpliado ?? ''}
          aoFechar={() => {
            setAmpliado(null)
            setTituloAmpliado(null)
          }}
        />
      )}
    </>
  )
}
