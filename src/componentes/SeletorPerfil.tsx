import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Check, ZoomIn, ChevronRight } from 'lucide-react'
import { useModelosPerfil, filtrarModelos } from '@/dados/modelosPerfil'
import { useCapasDesenhos } from '@/dados/desenhosTecnicos'
import { MiniaturaPerfil } from './MiniaturaPerfil'
import { VisualizadorImagem } from './ui/VisualizadorImagem'
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
          className="border-marca-cinza bg-aluminio-100 hover:bg-aluminio-200 flex cursor-pointer flex-col gap-3 rounded-xl border-2 p-3"
        >
          {/* Desenho e foto lado a lado: a geometria e a peça real. É a
              conferência mais rápida possível contra a ponta na mão. */}
          <div className="flex gap-2">
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

          <div className="min-w-0">
            <div className="flex items-center justify-between gap-2">
              <p className="text-grafite-900 flex items-center gap-1.5 font-mono font-bold">
                <Check
                  aria-hidden="true"
                  className="text-grafite-700 size-4 shrink-0"
                />
                {selecionado.codigo}
              </p>
              {/* Ícone sozinho, sem texto: o card inteiro já é clicável e
                  já tem o rótulo "Ver ficha completa" no aria-label. */}
              <ChevronRight
                aria-hidden="true"
                className="text-acao-600 size-4 shrink-0"
              />
            </div>

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
          </div>
        </div>

        {ampliado && (
          <VisualizadorImagem
            src={ampliado}
            alt={`Desenho do perfil ${selecionado.codigo}, ampliado`}
            aoFechar={() => setAmpliado(null)}
          />
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
        <ul className="border-borda flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-xl border-2 p-2">
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
