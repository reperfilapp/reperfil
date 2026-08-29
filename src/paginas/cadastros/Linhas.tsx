import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  Pencil,
  Layers,
  ChevronRight,
  AlertTriangle,
  ChevronUp,
  ChevronDown,
} from 'lucide-react'
import {
  useModelosPerfil,
  useRenomearLinha,
  useOrganizacoesParaLiberacao,
  useDefinirLiberacaoLinha,
  useDefinirLiberacaoLinhaTodas,
  useOrdemLinhas,
  useReordenarLinhas,
  agruparPorLinha,
  SEM_LINHA,
} from '@/dados/modelosPerfil'
import { useOrganizacao } from '@/dados/organizacao'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { podeGerenciarCadastros } from '@/autenticacao/contexto'
import { useSobras } from '@/dados/sobras'
import {
  resumirPorLinha,
  resumoDe,
  formatarResumo,
  maiorPrimeiro,
} from '@/dominio/estoqueResumo'
import { Botao } from '@/componentes/ui/Botao'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { AlternadorOrdenacao } from '@/componentes/ui/AlternadorOrdenacao'
import {
  compararPorOrdemLinha,
  type EstadoOrdenacaoLista,
} from '@/dominio/ordenacaoListas'
import { CampoSugestao } from '@/componentes/ui/CampoSugestao'
import { Modal } from '@/componentes/ui/Modal'
import { PaginaLista } from '@/componentes/ui/PaginaLista'
import { cn } from '@/lib/utilitarios'
import { disparar } from '@/lib/avisoErro'

/**
 * Revisão das linhas (ou sistemas) usadas pelos perfis.
 *
 * Não é um cadastro no sentido comum: não existe tabela de linhas, e não há
 * "criar" nem "excluir" aqui. A linha nasce quando alguém a digita no
 * cadastro do perfil, e desaparece quando o último perfil deixa de usá-la.
 *
 * O que esta tela resolve é o outro lado disso: o catálogo importado veio
 * com variações que são a mesma linha escrita de formas diferentes
 * ("Fachada" e "Fachada?"), e sem uma tela assim a única saída seria abrir
 * perfil por perfil. Renomear para um nome que já existe funde as duas.
 */
/** "1 perfil desta linha" / "7 perfis desta linha", sem erro de concordância. */
function textoAlcance(quantidade: number): string {
  return quantidade === 1
    ? 'Vale para o 1 perfil desta linha.'
    : `Vale para os ${quantidade} perfis desta linha.`
}

export default function Linhas() {
  const { perfil } = useAutenticacao()
  // Renomear linha reescreve o campo em TODOS os perfis que a usam.
  // É edição de catálogo, e obedece à mesma permissão.
  const podeEditar = podeGerenciarCadastros(perfil)

  const { data: modelos, isPending } = useModelosPerfil(true)
  const { data: sobras } = useSobras()
  const renomear = useRenomearLinha()

  // Liberação por empresa: só existe de verdade na organização central —
  // é ela quem decide, linha a linha, quem mais pode importar/atualizar.
  const { data: organizacao } = useOrganizacao()
  const souCentral = Boolean(organizacao?.eh_catalogo_central)

  const [editando, setEditando] = useState<string | null>(null)
  const [novoNome, setNovoNome] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<string | null>(null)

  const { data: organizacoesLiberacao } = useOrganizacoesParaLiberacao(
    souCentral ? editando : null,
  )
  const liberar = useDefinirLiberacaoLinha()
  const liberarTodas = useDefinirLiberacaoLinhaTodas()

  // 'manual' é o padrão: a ordem que o administrador definiu arrastando,
  // aqui mesmo. Os dois botões de ordenar continuam existindo, mas como
  // troca TEMPORÁRIA — o estado vive só nesta tela (`useState`), então sair
  // e voltar restaura a ordem manual sozinho.
  const [ordenacao, setOrdenacao] = useState<EstadoOrdenacaoLista>({
    criterio: 'manual',
    decrescente: false,
  })
  const { data: ordemLinhas } = useOrdemLinhas()
  const reordenar = useReordenarLinhas()

  // Mesma ordem do resto do app: quem tem mais estoque primeiro. Aqui a
  // lista serve para faxina de nomes repetidos, e a linha com material é a
  // que mais dói ver duplicada.
  const porLinha = resumirPorLinha(
    sobras ?? [],
    (sobra) => sobra.modelo?.linha?.trim() || SEM_LINHA,
  )

  const grupos = agruparPorLinha(modelos ?? [])
    .map((grupo) => ({ ...grupo, resumo: resumoDe(porLinha, grupo.linha) }))
    .sort((a, b) => {
      if (a.linha === SEM_LINHA) return 1
      if (b.linha === SEM_LINHA) return -1

      if (ordenacao.criterio === 'nome') {
        const porNome = a.linha.localeCompare(b.linha, 'pt-BR')
        return ordenacao.decrescente ? -porNome : porNome
      }

      if (ordenacao.criterio === 'estoque') {
        const porTamanho = maiorPrimeiro(a.resumo, b.resumo)
        const porEstoque = ordenacao.decrescente ? porTamanho : -porTamanho

        return porEstoque !== 0
          ? porEstoque
          : a.linha.localeCompare(b.linha, 'pt-BR')
      }

      // 'manual': a ordem definida pelas setas de mover.
      return compararPorOrdemLinha(a.linha, b.linha, ordemLinhas ?? new Map())
    })
  // "Sem linha" não é uma linha: é a ausência dela. Renomear ali significaria
  // atribuir linha a perfis que não têm, que é trabalho do cadastro do
  // perfil, um a um, com o desenho à vista.
  const renomeaveis = grupos.filter((g) => g.linha !== SEM_LINHA)

  /*
   * Mover sempre define uma ordem manual nova, mesmo que a tela esteja
   * temporariamente mostrando por nome ou por estoque — o clique grava a
   * sequência atual (a que se está vendo), com a linha já na posição
   * nova, como a nova ordem manual, e a tela volta a mostrá-la sozinha
   * (troca de volta para 'manual').
   *
   * Setas em vez de arrastar: arrastar exige medir a posição de cada linha
   * e acompanhar o dedo em tempo real, o que fica frágil dentro de uma
   * lista que já rola por conta própria (esta tela usa `PaginaLista`) — em
   * celular de verdade, os dois gestos disputam o toque. Duas setas não
   * têm ambiguidade nenhuma: um toque, uma troca, sempre — mas suba de
   * pouco em pouco não ajuda quem precisa levar a linha 100 para a
   * primeira posição. O seletor de posição, entre as duas setas, resolve
   * esse salto grande num toque só.
   */
  function moverLinhaPara(indiceAtual: number, destino: number) {
    if (destino < 0 || destino >= renomeaveis.length || destino === indiceAtual)
      return

    const ordem = renomeaveis.map((g) => g.linha)
    const [linha] = ordem.splice(indiceAtual, 1)
    if (linha === undefined) return
    ordem.splice(destino, 0, linha)

    setOrdenacao({ criterio: 'manual', decrescente: false })
    disparar(reordenar.mutateAsync(ordem))
  }

  function moverLinha(indice: number, direcao: -1 | 1) {
    moverLinhaPara(indice, indice + direcao)
  }

  const nomesExistentes = new Set(renomeaveis.map((g) => g.linha))
  const alvo = novoNome.trim()
  const quantidadeEditando =
    renomeaveis.find((g) => g.linha === editando)?.modelos.length ?? 0
  // A própria linha fica de fora: escolhê-la seria renomear para o mesmo
  // nome, que não faz nada.
  const outrasLinhas = renomeaveis
    .map((g) => g.linha)
    .filter((nome) => nome !== editando)
  const vaiFundir =
    editando !== null && alvo !== editando && nomesExistentes.has(alvo)
  const quantidadeAlvo = vaiFundir
    ? (renomeaveis.find((g) => g.linha === alvo)?.modelos.length ?? 0)
    : 0

  function abrirEdicao(linha: string) {
    setEditando(linha)
    setNovoNome(linha)
    setErro(null)
    setResultado(null)
  }

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)

    if (editando === null) return

    if (alvo === '') {
      setErro('O nome da linha não pode ficar vazio.')
      return
    }

    if (alvo === editando) {
      setEditando(null)
      return
    }

    try {
      const afetados = await renomear.mutateAsync({ de: editando, para: alvo })

      setResultado(
        `${afetados} ${afetados === 1 ? 'perfil passou' : 'perfis passaram'} para "${alvo}".`,
      )
      setEditando(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível renomear.')
    }
  }

  return (
    <PaginaLista
      className="max-w-3xl"
      cabecalho={
        <>
          <BotaoVoltar para="/mais" rotulo="Mais" className="mb-4" />

          <header className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Linhas e sistemas</h1>
              <p className="text-texto-suave mt-1">
                Como os perfis estão agrupados. Renomear para um nome que já
                existe junta as duas linhas.
              </p>
            </div>
            <AlternadorOrdenacao
              estado={ordenacao}
              aoMudar={setOrdenacao}
              className="mt-1"
            />
          </header>

          {/* Outro ângulo da mesma liberação de "Editar linha": aqui se
              escolhe a EMPRESA e se decide quais linhas ela vê; lá se
              escolhe a LINHA e se decide quais empresas veem. Só faz
              sentido para quem administra o catálogo central. */}
          {souCentral && (
            <Link
              to="/linhas/empresas"
              className="border-borda bg-superficie hover:bg-superficie-2 mb-4 flex min-h-12 items-center justify-center gap-2 rounded-xl border-2 text-sm font-semibold"
            >
              Administrar linhas por empresa
            </Link>
          )}

          {resultado && (
            <p
              role="status"
              className="bg-aluminio-100 text-grafite-800 mb-4 rounded-xl px-4 py-3 text-sm"
            >
              {resultado}
            </p>
          )}

          {isPending && <p className="text-texto-suave">Carregando…</p>}
        </>
      }
    >
      {!isPending && renomeaveis.length === 0 && (
        <p className="bg-superficie-2 text-texto-suave rounded-xl p-6 text-center">
          Nenhuma linha cadastrada ainda. A linha aparece aqui quando algum
          perfil passa a usá-la.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {renomeaveis.map(({ linha, modelos: daLinha, resumo }, indice) => (
          <li
            key={linha}
            className="bg-celula border-borda flex items-center gap-2 rounded-xl border-2 p-4 shadow-sm"
          >
            {/* Só a organização central define a ordem — ela vale para o
                catálogo de todas as empresas, e só faria sentido uma
                empresa comum reordenar o PRÓPRIO catálogo se a ordem
                fosse dela. Não é: é do catálogo central, então só quem o
                administra decide. */}
            {souCentral && podeEditar && (
              <div className="flex shrink-0 flex-col items-center gap-0.5">
                {/*
                 * A ALTURA de cada peça continua a mesma de antes — quem
                 * define a altura da célula é o texto ao lado (nome +
                 * resumo, duas linhas), e esticar este controle esticaria a
                 * célula à toa. O que cresce é a LARGURA: alvo de toque mais
                 * largo ajuda a acertar no celular sem empurrar a linha
                 * para baixo.
                 */}
                {/*
                 * O botão cresce (h-3.5 → h-6), mas a margem negativa
                 * cancela o crescimento na conta da coluna: `-mt-2.5`
                 * empurra os 10px extras para CIMA, para dentro do próprio
                 * `p-4` da célula (espaço vazio, 16px disponíveis) — a
                 * margem de baixo continua 0, então o lado que encosta na
                 * pílula não muda nem 1px. O alvo de toque real cresce; a
                 * altura que a coluna ocupa no layout, não.
                 */}
                <button
                  type="button"
                  onClick={() => moverLinha(indice, -1)}
                  disabled={indice === 0 || reordenar.isPending}
                  aria-label={`Mover ${linha} para cima`}
                  title="Mover para cima"
                  className="text-acao-700 hover:text-acao-800 -mt-2.5 flex h-6 w-10 items-center justify-center disabled:opacity-30"
                >
                  <ChevronUp
                    aria-hidden="true"
                    className="size-5"
                    strokeWidth={2.5}
                  />
                </button>

                {/* Pular direto para uma posição — as setas resolvem mover
                    uma casa, mas levar a linha 100 para a primeira não devia
                    exigir 99 toques. O `<select>` de verdade cobre a
                    pílula INTEIRA (transparente, por cima do número e da
                    setinha) — clicar em qualquer ponto dela abre a roda de
                    seleção do sistema; número e seta são só o desenho por
                    baixo, sem clique próprio (`pointer-events-none`). Sem
                    isso, só clicar exatamente sobre o número abria. */}
                <div className="bg-acao-100 relative flex items-center gap-0.5 rounded-full px-2 py-0.5">
                  <select
                    value={indice + 1}
                    onChange={(e) =>
                      moverLinhaPara(indice, Number(e.target.value) - 1)
                    }
                    disabled={reordenar.isPending}
                    aria-label={`Posição de ${linha} na lista, de ${renomeaveis.length}`}
                    className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 disabled:cursor-default"
                  >
                    {renomeaveis.map((_, i) => (
                      <option key={i} value={i + 1}>
                        {i + 1}
                      </option>
                    ))}
                  </select>
                  <span className="text-acao-800 pointer-events-none w-5 text-center text-base leading-none font-semibold">
                    {indice + 1}
                  </span>
                  <ChevronDown
                    aria-hidden="true"
                    className="text-acao-700 pointer-events-none size-2.5 shrink-0"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => moverLinha(indice, 1)}
                  disabled={
                    indice === renomeaveis.length - 1 || reordenar.isPending
                  }
                  aria-label={`Mover ${linha} para baixo`}
                  title="Mover para baixo"
                  className="text-acao-700 hover:text-acao-800 -mb-2.5 flex h-6 w-10 items-center justify-center disabled:opacity-30"
                >
                  <ChevronDown
                    aria-hidden="true"
                    className="size-5"
                    strokeWidth={2.5}
                  />
                </button>
              </div>
            )}

            <Layers
              aria-hidden="true"
              className="text-acao-600 size-5 shrink-0"
            />

            <div className="min-w-0 flex-1">
              <Link
                to={`/perfis?linha=${encodeURIComponent(linha)}`}
                className="block text-lg font-medium hover:underline"
              >
                {linha}
              </Link>
              <p className="text-texto-suave mt-0.5 truncate text-sm tabular-nums">
                {formatarResumo(resumo)} · {daLinha.length}{' '}
                {daLinha.length === 1 ? 'perfil' : 'perfis'}
              </p>
            </div>

            {podeEditar && (
              <Botao
                variante="secundaria"
                onClick={() => abrirEdicao(linha)}
                aria-label={`Editar ${linha}`}
              >
                <Pencil aria-hidden="true" className="size-4" />
              </Botao>
            )}
          </li>
        ))}
      </ul>

      {/* Perfis sem linha: não dá para renomear, mas esconder faria a conta
          não fechar com o total do catálogo. */}
      {grupos.some((g) => g.linha === SEM_LINHA) && (
        <Link
          to={`/perfis?linha=${SEM_LINHA}`}
          className="bg-superficie-2 text-texto-suave mt-3 flex items-center gap-3 rounded-xl p-4 text-sm"
        >
          <span className="flex-1">
            {grupos.find((g) => g.linha === SEM_LINHA)?.modelos.length} perfis
            sem linha definida — abra cada um para atribuir.
          </span>
          <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
        </Link>
      )}

      <Modal
        aberto={editando !== null}
        aoFechar={() => setEditando(null)}
        titulo="Editar linha"
      >
        <form onSubmit={aoEnviar} className="flex flex-col gap-4" noValidate>
          {/* Sugere as outras linhas: para juntar duas, escolher da lista é
              mais seguro do que tentar reproduzir a grafia exata — "Linha
              Gold / 32" não perdoa um espaço a mais. Digitar um nome novo
              continua valendo. */}
          <CampoSugestao
            rotulo="Nome da linha"
            valor={novoNome}
            aoMudar={setNovoNome}
            sugestoes={outrasLinhas}
            ajuda={editando ? textoAlcance(quantidadeEditando) : undefined}
          />

          {vaiFundir && (
            <p
              role="alert"
              className="bg-atencao-50 text-atencao-700 flex gap-3 rounded-xl p-4 text-sm"
            >
              <AlertTriangle aria-hidden="true" className="size-5 shrink-0" />
              <span>
                <strong>"{alvo}" já existe</strong> com {quantidadeAlvo}{' '}
                {quantidadeAlvo === 1 ? 'perfil' : 'perfis'}. Salvar junta as
                duas numa só — o que é útil para corrigir duplicadas, mas não dá
                para separar depois sem editar perfil por perfil.
              </span>
            </p>
          )}

          {erro && (
            <p
              role="alert"
              className="bg-erro-50 text-erro-700 rounded-xl px-4 py-3"
            >
              {erro}
            </p>
          )}

          <div className="flex gap-3">
            <Botao
              type="button"
              variante="contorno"
              onClick={() => setEditando(null)}
              className="flex-1"
            >
              Cancelar
            </Botao>
            <Botao
              type="submit"
              carregando={renomear.isPending}
              className="flex-1"
            >
              {vaiFundir ? 'Juntar' : 'Salvar'}
            </Botao>
          </div>
        </form>

        {/* Só a organização central negocia isto — quais empresas podem
            importar/atualizar esta linha do catálogo central. Fora daqui,
            uma linha nova ou uma empresa nova começam SEM liberação: quem
            administra o central decide caso a caso. */}
        {souCentral && editando && (
          <div className="border-borda mt-5 border-t pt-4">
            <p className="font-medium">Liberada para</p>
            <p className="text-texto-suave mt-0.5 mb-3 text-sm">
              Quais empresas podem importar ou atualizar esta linha do catálogo
              central.
            </p>

            <div className="mb-3 flex gap-2">
              <Botao
                variante="secundaria"
                tamanho="pequeno"
                onClick={() =>
                  disparar(
                    liberarTodas.mutateAsync({
                      linha: editando,
                      liberada: true,
                    }),
                  )
                }
                carregando={liberarTodas.isPending}
                className="flex-1"
              >
                Liberar para todas
              </Botao>
              <Botao
                variante="secundaria"
                tamanho="pequeno"
                onClick={() =>
                  disparar(
                    liberarTodas.mutateAsync({
                      linha: editando,
                      liberada: false,
                    }),
                  )
                }
                carregando={liberarTodas.isPending}
                className="flex-1"
              >
                Bloquear todas
              </Botao>
            </div>

            <ul className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
              {organizacoesLiberacao?.map((o) => (
                <li
                  key={o.organizacao_id}
                  className="bg-superficie-2 flex items-center justify-between gap-2 rounded-lg px-3 py-2"
                >
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {o.nome_fantasia}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      disparar(
                        liberar.mutateAsync({
                          linha: editando,
                          organizacaoId: o.organizacao_id,
                          liberada: !o.liberada,
                        }),
                      )
                    }
                    disabled={liberar.isPending}
                    className={cn(
                      'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
                      o.liberada
                        ? 'bg-economia-50 text-economia-700 hover:bg-economia-100'
                        : 'bg-atencao-50 text-atencao-700 hover:bg-atencao-100',
                    )}
                  >
                    {o.liberada ? 'Liberada' : 'Bloqueada'}
                  </button>
                </li>
              ))}
              {organizacoesLiberacao?.length === 0 && (
                <li className="text-texto-suave text-sm">
                  Nenhuma outra empresa cadastrada ainda.
                </li>
              )}
            </ul>
          </div>
        )}
      </Modal>
    </PaginaLista>
  )
}
