import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Check, ZoomIn, X, ChevronRight } from 'lucide-react'
import { useModelosPerfil, filtrarModelos } from '@/dados/modelosPerfil'
import { useCapasDesenhos } from '@/dados/desenhosTecnicos'
import { MiniaturaPerfil } from './MiniaturaPerfil'
import { cn } from '@/lib/utilitarios'
import type { ModeloPerfil } from '@/tipos/banco'

interface PropsSeletorPerfil {
  selecionado: ModeloPerfil | null
  aoSelecionar: (modelo: ModeloPerfil) => void
}

/**
 * Escolha do modelo de perfil, com busca e desenho técnico.
 *
 * O desenho aparece em dois momentos, e cada um tem uma função:
 *
 * • Na LISTA, como miniatura — ajuda a achar o perfil certo entre códigos
 *   parecidos, que numa serralheria são a regra (25-002, 25-016, 25-026…).
 *
 * • No SELECIONADO, grande — é a conferência final. O serralheiro compara a
 *   seção do desenho com a ponta que tem na mão antes de gravar. Cadastrar a
 *   peça no perfil errado é pior do que não cadastrar: ela vai aparecer em
 *   buscas de outro perfil e mandar alguém à prateleira à toa.
 */
export function SeletorPerfil({
  selecionado,
  aoSelecionar,
}: PropsSeletorPerfil) {
  const navegar = useNavigate()
  const { data: modelos, isPending } = useModelosPerfil()
  const { data: capas } = useCapasDesenhos('imagem')
  const { data: fotos } = useCapasDesenhos('foto')
  const [busca, setBusca] = useState('')
  const [ampliado, setAmpliado] = useState<string | null>(null)

  const encontrados = filtrarModelos(modelos ?? [], busca)

  if (selecionado) {
    const desenho = capas?.get(selecionado.id)
    const foto = fotos?.get(selecionado.id)

    /*
     * O card inteiro abre a ficha completa do perfil — mesma convenção de
     * qualquer outro registro do sistema (decisão D9). Os botões de ampliar
     * desenho e foto ficam por cima e cortam a propagação do clique, senão
     * "ver a foto grande" acabaria navegando para outra tela sem querer.
     */
    return (
      <>
        <div
          role="button"
          tabIndex={0}
          onClick={() => navegar(`/perfis/${selecionado.id}`)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              navegar(`/perfis/${selecionado.id}`)
            }
          }}
          aria-label={`Ver ficha completa do perfil ${selecionado.codigo}`}
          className="border-economia-500 bg-economia-50 hover:bg-economia-100 flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3"
        >
          {/* Desenho e foto lado a lado: a geometria e a peça real. É a
              conferência mais rápida possível contra a ponta na mão. */}
          <div className="flex shrink-0 gap-2">
            {desenho ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setAmpliado(desenho)
                }}
                className="border-borda relative overflow-hidden rounded-lg border bg-white"
                aria-label="Ampliar desenho técnico"
              >
                <img
                  src={desenho}
                  alt={`Desenho técnico do perfil ${selecionado.codigo}`}
                  className="size-24 object-contain p-1"
                />
                <span className="bg-grafite-900/70 absolute right-1 bottom-1 rounded-full p-1 text-white">
                  <ZoomIn aria-hidden="true" className="size-3" />
                </span>
              </button>
            ) : (
              <MiniaturaPerfil
                link={null}
                codigo={selecionado.codigo}
                className="size-24"
              />
            )}

            {foto && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setAmpliado(foto)
                }}
                className="border-borda relative overflow-hidden rounded-lg border"
                aria-label="Ampliar foto do perfil"
              >
                <img
                  src={foto}
                  alt={`Foto do perfil ${selecionado.codigo}`}
                  className="size-24 object-cover"
                />
                <span className="bg-grafite-900/70 absolute right-1 bottom-1 rounded-full p-1 text-white">
                  <ZoomIn aria-hidden="true" className="size-3" />
                </span>
              </button>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-1.5">
              <Check
                aria-hidden="true"
                className="text-economia-700 size-5 shrink-0"
              />
              <span className="text-economia-700 text-sm font-medium">
                Perfil escolhido
              </span>
            </div>

            <p className="text-grafite-900 font-mono font-bold">
              {selecionado.codigo}
            </p>
            <p className="text-grafite-800 text-sm">{selecionado.descricao}</p>
            {selecionado.linha && (
              <p className="text-grafite-600 truncate text-sm">
                {selecionado.linha}
              </p>
            )}

            {/* Sem truncate de propósito: "lateral da porta de correr de 8
                folhas com barra antipânico" não pode virar "lateral da
                porta…" — é justamente o texto que confirma a peça certa. */}
            {selecionado.aplicacao && (
              <p className="text-acao-700 bg-acao-100 mt-1 inline-block rounded px-2 py-0.5 text-xs break-words">
                {selecionado.aplicacao}
              </p>
            )}

            {(desenho || foto) && (
              <p className="text-grafite-600 mt-1 text-xs">
                {desenho && foto
                  ? 'Compare o desenho e a foto com a peça antes de salvar.'
                  : desenho
                    ? 'Confira o desenho antes de salvar.'
                    : 'Confira a foto antes de salvar.'}
              </p>
            )}

            <p className="text-acao-700 mt-1.5 flex items-center gap-0.5 text-xs font-medium">
              Ver ficha completa do perfil
              <ChevronRight aria-hidden="true" className="size-3.5" />
            </p>
          </div>
        </div>

        {ampliado && (
          <div
            role="dialog"
            aria-label="Desenho ampliado"
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
            onClick={() => setAmpliado(null)}
          >
            <img
              src={ampliado}
              alt="Desenho técnico ampliado"
              className="max-h-full max-w-full object-contain"
            />
            <button
              type="button"
              onClick={() => setAmpliado(null)}
              aria-label="Fechar"
              className="text-grafite-900 absolute top-4 right-4 rounded-full bg-white/90 p-3"
            >
              <X aria-hidden="true" className="size-5" />
            </button>
          </div>
        )}
      </>
    )
  }

  return (
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
          placeholder="Código ou descrição do perfil"
          aria-label="Buscar perfil"
          autoFocus
          className="border-borda bg-superficie min-h-16 w-full rounded-xl border-2 pr-4 pl-12 text-lg"
        />
      </div>

      {isPending && <p className="text-texto-suave">Carregando perfis…</p>}

      {!isPending && encontrados.length === 0 && (
        <p className="bg-superficie-2 text-texto-suave flex flex-1 items-center justify-center rounded-xl p-5 text-center">
          {busca
            ? 'Nenhum perfil com esse termo.'
            : 'Nenhum perfil cadastrado. Cadastre em Mais → Modelos de perfil.'}
        </p>
      )}

      {/* min-h-0 é o que permite este container encolher dentro da coluna
          flexível da tela e sobrar espaço real para rolar — sem ele, o
          conteúdo empurra a lista para além da tela em vez de rolar nela.
          Só existe quando há itens: com a lista vazia, quem preenche o
          espaço é a mensagem acima, não uma lista vazia disputando o
          mesmo espaço com ela. */}
      {encontrados.length > 0 && (
        <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
          {encontrados.map((modelo) => (
            <li key={modelo.id}>
              <button
                type="button"
                onClick={() => aoSelecionar(modelo)}
                className={cn(
                  'border-borda flex min-h-16 w-full items-center gap-3 rounded-xl border-2',
                  'bg-superficie hover:border-acao-500 hover:bg-superficie-2 p-2 text-left',
                )}
              >
                <MiniaturaPerfil
                  link={capas?.get(modelo.id)}
                  codigo={modelo.codigo}
                />

                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    <span className="text-acao-600 font-mono">
                      {modelo.codigo}
                    </span>{' '}
                    {modelo.descricao}
                  </span>
                  {modelo.linha && (
                    <span className="text-texto-suave block truncate text-sm">
                      {modelo.linha}
                    </span>
                  )}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
