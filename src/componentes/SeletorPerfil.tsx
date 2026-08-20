import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Search,
  Check,
  ZoomIn,
  ChevronRight,
  Layers,
  Camera,
} from 'lucide-react'
import {
  useModelosPerfil,
  filtrarModelos,
  agruparPorLinha,
  SEM_LINHA,
} from '@/dados/modelosPerfil'
import { useCapasDesenhos } from '@/dados/desenhosTecnicos'
import { useSobras } from '@/dados/sobras'
import {
  resumirPorLinha,
  resumirPorPerfil,
  resumoDe,
  formatarResumo,
  maiorPrimeiro,
} from '@/dominio/estoqueResumo'
import { MiniaturaPerfil } from './MiniaturaPerfil'
import { VisualizadorImagem } from './ui/VisualizadorImagem'
import { BotaoVoltar } from './ui/BotaoVoltar'
import { AlternadorOrdenacao } from './ui/AlternadorOrdenacao'
import { ORDENACAO_PADRAO } from '@/dominio/ordenacaoListas'
import { cn } from '@/lib/utilitarios'
import type { ModeloPerfil } from '@/tipos/banco'

/** Valor de `linhaAberta` que significa "ignorar o agrupamento". */
const TODAS = '__todas__'

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
  const local = useLocation()
  const { data: modelos, isPending } = useModelosPerfil()
  const { data: capas } = useCapasDesenhos('imagem')
  const { data: fotos } = useCapasDesenhos('foto')
  const { data: sobras } = useSobras()
  const [busca, setBusca] = useState('')
  const [ampliado, setAmpliado] = useState<string | null>(null)
  /*
   * Mesma ideia da tela "Modelos de perfil": o catálogo tem dezenas de
   * perfis, e quem vai lançar uma sobra já sabe de que linha ela é. Abrir
   * numa lista corrida obriga a rolar por linhas que não interessam.
   *
   * A BUSCA continua ignorando o agrupamento: quem digita um código quer
   * achá-lo esteja em que linha estiver.
   */
  const [linhaAberta, setLinhaAberta] = useState<string | null>(null)
  // Alterna a lista de perfis (não a de linhas) entre estoque e nome, e a
  // direção de cada um. Começa no padrão do app: mais estoque primeiro.
  const [ordenacao, setOrdenacao] = useState(ORDENACAO_PADRAO)

  const encontrados = filtrarModelos(modelos ?? [], busca)
  const buscando = busca.trim() !== ''

  /*
   * O estoque decide a ORDEM aqui, e não só na tela de sobras: quem lança
   * uma peça está diante do mesmo depósito, e o perfil que a empresa mais
   * tem é o que ela mais usa — logo, o mais provável de ser o próximo. Em
   * ordem alfabética, o perfil de duas pontas esquecidas aparece antes do
   * que tem quarenta peças.
   */
  const porPerfil = resumirPorPerfil(sobras ?? [])
  const porLinha = resumirPorLinha(
    sobras ?? [],
    (sobra) => sobra.modelo?.linha?.trim() || SEM_LINHA,
  )

  const grupos = agruparPorLinha(modelos ?? [])
    .map((grupo) => ({ ...grupo, resumo: resumoDe(porLinha, grupo.linha) }))
    .sort((a, b) => {
      if (a.linha === SEM_LINHA) return 1
      if (b.linha === SEM_LINHA) return -1

      const porTamanho = maiorPrimeiro(a.resumo, b.resumo)

      return porTamanho !== 0
        ? porTamanho
        : a.linha.localeCompare(b.linha, 'pt-BR')
    })

  const visiveis = buscando
    ? encontrados
    : linhaAberta === TODAS
      ? encontrados
      : linhaAberta === null
        ? []
        : encontrados.filter(
            (m) => (m.linha?.trim() || SEM_LINHA) === linhaAberta,
          )

  // Ordena uma cópia: `visiveis` vem de `filtrarModelos`, e ordenar no lugar
  // mexeria no array que o React Query guarda em cache.
  const visiveisOrdenados = [...visiveis].sort((a, b) => {
    if (ordenacao.criterio === 'nome') {
      const porNome = a.codigo.localeCompare(b.codigo, 'pt-BR')
      return ordenacao.decrescente ? -porNome : porNome
    }

    const porTamanho = maiorPrimeiro(
      resumoDe(porPerfil, a.id),
      resumoDe(porPerfil, b.id),
    )
    const porEstoque = ordenacao.decrescente ? porTamanho : -porTamanho

    return porEstoque !== 0
      ? porEstoque
      : a.codigo.localeCompare(b.codigo, 'pt-BR')
  })

  const mostrandoLinhas = !buscando && linhaAberta === null

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
      {/* Busca à esquerda, atalho ao lado: o mesmo arranjo do leitor de QR
          na tela de estoque. Botão vizinho, não dentro do campo — assim os
          dois lugares do app onde se procura uma peça funcionam igual, e o
          alvo de toque fica do tamanho do campo. */}
      <div className="flex shrink-0 gap-2">
        <div className="relative flex-1">
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

        {/* Quem não sabe o código precisa do atalho JUNTO da busca que
            acabou de falhar. Volta para cá com o perfil já escolhido — ver
            o parâmetro `retorno`. */}
        <button
          type="button"
          onClick={() =>
            navegar(
              `/identificar?retorno=${encodeURIComponent(local.pathname)}`,
            )
          }
          aria-label="Identificar o perfil pela medida ou pela foto"
          title="Não sabe qual é? Identifique pela medida ou pela foto"
          className="border-borda bg-superficie hover:bg-superficie-2 text-acao-600 flex min-h-16 w-16 shrink-0 items-center justify-center rounded-xl border-2"
        >
          <Camera aria-hidden="true" className="size-5" />
        </button>
      </div>

      {isPending && <p className="text-texto-suave">Carregando perfis…</p>}

      {!isPending && encontrados.length === 0 && (
        <p className="bg-superficie-2 text-texto-suave flex flex-1 items-center justify-center rounded-xl p-5 text-center">
          {busca
            ? 'Nenhum perfil com esse termo.'
            : 'Nenhum perfil cadastrado. Cadastre em Mais → Modelos de perfil.'}
        </p>
      )}

      {/* Lista de linhas: a porta de entrada, como em "Modelos de perfil".
          A altura é a de SETE itens inteiros, não o espaço que sobrar: com
          `flex-1` a lista terminava no meio do sétimo, e item cortado ao pé
          da tela parece defeito de renderização, não convite a rolar.
          516px = 7 × 64 (item) + 6 × 8 (respiro) + 16 (recheio) + 4 (borda).
          `max-h-full` cede em tela baixa, onde sete não cabem mesmo. */}
      {!isPending && mostrandoLinhas && grupos.length > 0 && (
        <ul className="border-borda flex h-[516px] max-h-full min-h-0 flex-col gap-2 overflow-y-auto rounded-xl border-2 p-2">
          {grupos.map(({ linha, modelos: daLinha, resumo }) => (
            <li key={linha}>
              <button
                type="button"
                onClick={() => setLinhaAberta(linha)}
                className="border-borda bg-superficie hover:border-acao-500 hover:bg-superficie-2 flex min-h-16 w-full items-center gap-3 rounded-xl border-2 p-3 text-left"
              >
                <Layers
                  aria-hidden="true"
                  className="text-acao-600 size-5 shrink-0"
                />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {linha}
                </span>
                <span className="text-texto-suave shrink-0 text-right text-sm">
                  <span className="block tabular-nums">
                    {formatarResumo(resumo)}
                  </span>
                  <span className="block text-xs">
                    {daLinha.length}{' '}
                    {daLinha.length === 1 ? 'perfil' : 'perfis'}
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

      {!isPending && mostrandoLinhas && grupos.length > 0 && (
        <button
          type="button"
          onClick={() => setLinhaAberta(TODAS)}
          className="text-acao-600 shrink-0 text-sm font-medium hover:underline"
        >
          Ver todos os perfis
        </button>
      )}

      {/* Dentro de uma linha: diz onde se está, como ordenar e como voltar. */}
      {!isPending && !buscando && linhaAberta !== null && (
        <div className="flex shrink-0 items-center justify-between gap-2">
          <p className="min-w-0 truncate text-sm font-semibold">
            {linhaAberta === TODAS ? 'Todos os perfis' : linhaAberta}
            <span className="text-texto-suave ml-2 font-normal">
              ({visiveis.length})
            </span>
          </p>
          <AlternadorOrdenacao estado={ordenacao} aoMudar={setOrdenacao} />
          <BotaoVoltar
            onClick={() => setLinhaAberta(null)}
            rotulo="Linhas"
            className="shrink-0"
          />
        </div>
      )}

      {/* min-h-0 é o que permite este container encolher dentro da coluna
          flexível da tela e sobrar espaço real para rolar — sem ele, o
          conteúdo empurra a lista para além da tela em vez de rolar nela.
          Só existe quando há itens: com a lista vazia, quem preenche o
          espaço é a mensagem acima, não uma lista vazia disputando o
          mesmo espaço com ela. */}
      {visiveisOrdenados.length > 0 && (
        <ul className="border-borda flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto rounded-xl border-2 p-2">
          {visiveisOrdenados.map((modelo) => (
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
                  <span className="text-texto-suave block truncate text-sm">
                    {modelo.linha && `${modelo.linha} · `}
                    {/* Sem estoque não é zero: é informação de que essa peça
                        não está no depósito hoje, e quem lança uma sobra
                        precisa saber que vai ser a primeira. */}
                    <span className="tabular-nums">
                      {resumoDe(porPerfil, modelo.id).pecas > 0
                        ? formatarResumo(resumoDe(porPerfil, modelo.id))
                        : 'sem estoque'}
                    </span>
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
