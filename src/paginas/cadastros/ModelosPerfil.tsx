import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  Plus,
  Pencil,
  Search,
  ChevronRight,
  Layers,
  Camera,
  Archive,
  ArchiveRestore,
  Trash2,
  RefreshCw,
} from 'lucide-react'
import {
  useModelosPerfil,
  useCriarModeloPerfil,
  useEditarModeloPerfil,
  useDesativarModeloPerfil,
  useExcluirModeloPerfil,
  useSincronizarCatalogoCentral,
  useLinhasCatalogoCentral,
  useOrdemLinhas,
  filtrarModelos,
  agruparPorLinha,
  SEM_LINHA,
  type DadosModeloPerfil,
} from '@/dados/modelosPerfil'
import { useOrganizacao } from '@/dados/organizacao'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { podeGerenciarCadastros } from '@/autenticacao/contexto'
import { Botao } from '@/componentes/ui/Botao'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { AlternadorOrdenacao } from '@/componentes/ui/AlternadorOrdenacao'
import { useNiveisNaUrl } from '@/componentes/useNiveisNaUrl'
import { ORDENACAO_PADRAO, compararPorOrdemLinha } from '@/dominio/ordenacaoListas'
import { Modal } from '@/componentes/ui/Modal'
import {
  FormularioModeloPerfil,
  ID_FORMULARIO_MODELO_PERFIL,
} from '@/componentes/perfil/FormularioModeloPerfil'
import { PaginaLista } from '@/componentes/ui/PaginaLista'
import { MiniaturaPerfil } from '@/componentes/MiniaturaPerfil'
import { VisualizadorImagem } from '@/componentes/ui/VisualizadorImagem'
import { useCapasDesenhos } from '@/dados/desenhosTecnicos'
import { useSobras } from '@/dados/sobras'
import { useListaTecnicaCompleta } from '@/dados/produtos'
import {
  resumirPorLinha,
  resumirPorPerfil,
  resumoDe,
  formatarResumo,
  maiorPrimeiro,
} from '@/dominio/estoqueResumo'
import { formatarMedidasSecao } from '@/dominio/secao'
import type { ModeloPerfil } from '@/tipos/banco'

/** Valor de `linhaAberta` que significa "ignorar o agrupamento". */
const TODAS = '__todas__'

/** Campo vazio é ausência de medida, não zero. Vírgula vale como decimal. */
const VAZIO: DadosModeloPerfil = {
  codigo: '',
  descricao: '',
  fabricante: null,
  linha: null,
  categoria: null,
  aplicacao: null,
  comprimento_barra_mm: 6000,
  peso_por_metro_g: null,
  preco_por_metro_centavos: null,
  codigo_barras: null,
  observacoes: null,
  largura_secao_mm: null,
  altura_secao_mm: null,
  medida_3_secao_mm: null,
  medida_4_secao_mm: null,
}

export default function ModelosPerfil() {
  const { perfil } = useAutenticacao()
  // Esconder o que o banco recusaria: um botão que sempre devolve
  // erro ensina a pessoa a desconfiar da tela inteira.
  const podeEditar = podeGerenciarCadastros(perfil)

  const [mostrarInativos, setMostrarInativos] = useState(false)
  const { data: modelos, isPending } = useModelosPerfil(mostrarInativos)
  const { data: ordemLinhas } = useOrdemLinhas()
  const criar = useCriarModeloPerfil()
  const editar = useEditarModeloPerfil()
  const desativar = useDesativarModeloPerfil()
  const excluir = useExcluirModeloPerfil()

  // Sincronizar com o catálogo central: traz perfil novo e atualiza os já
  // copiados que mudaram lá. Não faz sentido a própria organização central
  // sincronizar consigo mesma.
  const { data: organizacao } = useOrganizacao()
  const podeSincronizar = podeEditar && Boolean(organizacao) && !organizacao?.eh_catalogo_central
  const sincronizar = useSincronizarCatalogoCentral()
  const { data: linhasCentral } = useLinhasCatalogoCentral()
  const [linhaParaSincronizar, setLinhaParaSincronizar] = useState('')
  const [mensagemSincronizacao, setMensagemSincronizacao] = useState<
    string | null
  >(null)
  const [erroSincronizacao, setErroSincronizacao] = useState<string | null>(
    null,
  )

  async function aoSincronizar(linha?: string) {
    setErroSincronizacao(null)
    setMensagemSincronizacao(null)

    try {
      const resultado = await sincronizar.mutateAsync(linha)
      setMensagemSincronizacao(
        linha
          ? `"${linha}": ${resultado.perfis_novos} perfis novos, ${resultado.perfis_atualizados} atualizados.`
          : `${resultado.perfis_novos} perfis novos, ${resultado.perfis_atualizados} atualizados.`,
      )
    } catch (e) {
      setErroSincronizacao(
        e instanceof Error ? e.message : 'Não foi possível sincronizar.',
      )
    }
  }
  const { data: capas } = useCapasDesenhos()
  const { data: sobras } = useSobras()
  const { data: itensListaTecnica } = useListaTecnicaCompleta()
  const [busca, setBusca] = useState('')
  /*
   * Linha escolhida para ver, `null` enquanto a pessoa está na lista de
   * linhas e 'todas' quando ela pediu tudo de uma vez.
   *
   * O catálogo tem centenas de perfis, e quem procura um já sabe de que
   * linha ele é — abrir direto numa lista corrida obriga a rolar por linhas
   * que não interessam. A BUSCA ignora este filtro de propósito: quem
   * digita um código quer achá-lo esteja onde estiver, e não descobrir
   * depois que a peça existia noutra linha.
   *
   * Fica na URL, e não em estado: abrir uma linha é mudar de tela aos olhos
   * de quem usa, e precisa ser uma navegação de verdade para o "voltar"
   * desfazer só ela. Ver `useNiveisNaUrl`.
   */
  const { nivel, abrir, voltarNivel } = useNiveisNaUrl(['linha'])
  const linhaAberta = nivel('linha')
  const [ordenacao, setOrdenacao] = useState(ORDENACAO_PADRAO)
  /*
   * Também na URL, e não em estado — mas por um motivo diferente do
   * `linha` acima: aqui não é para o "voltar" desfazer, é para o filtro
   * SOBREVIVER a entrar num perfil e voltar (troca de tela de verdade,
   * que zeraria um `useState`). `replace: true` ao trocar, então escolher
   * o filtro não empilha histórico — só a navegação para dentro/fora do
   * perfil é que deve. Sair para outro módulo do app (sem passar pelo
   * "voltar" desta tela) volta ao padrão normalmente, porque chega aqui
   * por um link sem esse parâmetro.
   */
  const [parametrosFiltro, definirParametrosFiltro] = useSearchParams()
  const filtroRevisao =
    (parametrosFiltro.get('revisao') as
      | 'todos'
      | 'revisados'
      | 'pendentes'
      | null) ?? 'todos'

  function setFiltroRevisao(valor: 'todos' | 'revisados' | 'pendentes') {
    const novos = new URLSearchParams(parametrosFiltro)

    if (valor === 'todos') {
      novos.delete('revisao')
    } else {
      novos.set('revisao', valor)
    }

    definirParametrosFiltro(novos, { replace: true })
  }
  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState<ModeloPerfil | null>(null)
  const [form, setForm] = useState<DadosModeloPerfil>(VAZIO)
  const [erro, setErro] = useState<string | null>(null)
  const [apagando, setApagando] = useState<ModeloPerfil | null>(null)
  const [erroApagar, setErroApagar] = useState<string | null>(null)
  const [ampliado, setAmpliado] = useState<ModeloPerfil | null>(null)

  const encontrados = filtrarModelos(modelos ?? [], busca)
  const buscando = busca.trim() !== ''
  /*
   * A ordem de TODA lista de linha e de perfil no app é a mesma: quem tem
   * mais estoque primeiro. Em ordem alfabética, a linha com duas pontas
   * esquecidas aparece antes da que tem 121 peças, e quem abre o catálogo
   * quase sempre quer o que há em quantidade. Para achar um item específico
   * existe a busca.
   */
  const porPerfil = resumirPorPerfil(sobras ?? [])
  const porLinha = resumirPorLinha(
    sobras ?? [],
    (sobra) => sobra.modelo?.linha?.trim() || SEM_LINHA,
  )

  /*
   * Quem pode ser apagado de verdade, e não só arquivado.
   *
   * As duas perguntas são as mesmas que o banco faz com `on delete
   * restrict`: nenhuma sobra (de qualquer status — até uma consumida ainda
   * aponta para o perfil) e nenhuma lista técnica. Calcular aqui, com o que
   * já está carregado, evita uma pergunta ao servidor por linha da lista só
   * para decidir se mostra o ícone.
   */
  const perfisComEstoque = new Set(
    (sobras ?? []).map((sobra) => sobra.modelo_perfil_id),
  )
  const perfisEmUso = new Set(
    (itensListaTecnica ?? []).map((item) => item.modelo_perfil_id),
  )
  const podeApagar = (modelo: ModeloPerfil) =>
    !perfisComEstoque.has(modelo.id) && !perfisEmUso.has(modelo.id)

  const grupos = agruparPorLinha(modelos ?? [])
    .map((grupo) => ({ ...grupo, resumo: resumoDe(porLinha, grupo.linha) }))
    .sort((a, b) => {
      if (a.linha === SEM_LINHA) return 1
      if (b.linha === SEM_LINHA) return -1

      return compararPorOrdemLinha(a.linha, b.linha, ordemLinhas ?? new Map())
    })

  // Buscando: mostra o resultado, venha de que linha vier. Senão, respeita
  // a linha aberta — e, sem linha aberta, a tela é a lista de linhas.
  const visiveis = buscando
    ? encontrados
    : linhaAberta === TODAS
      ? encontrados
      : linhaAberta === null
        ? []
        : encontrados.filter(
            (m) => (m.linha?.trim() || SEM_LINHA) === linhaAberta,
          )

  const visiveisComFiltro = visiveis.filter((m) => {
    if (filtroRevisao === 'revisados') return m.revisado
    if (filtroRevisao === 'pendentes') return !m.revisado
    return true
  })

  // Cópia antes de ordenar: `visiveis` sai de `filtrarModelos`, e ordenar no
  // lugar mexeria no array guardado pelo React Query.
  const visiveisOrdenados = [...visiveisComFiltro].sort((a, b) => {
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

  function abrirNovo() {
    setEditando(null)
    setForm(VAZIO)
    setErro(null)
    setAberto(true)
  }

  function abrirEdicao(modelo: ModeloPerfil) {
    setEditando(modelo)
    setForm({
      codigo: modelo.codigo,
      descricao: modelo.descricao,
      fabricante: modelo.fabricante,
      linha: modelo.linha,
      categoria: modelo.categoria,
      aplicacao: modelo.aplicacao,
      comprimento_barra_mm: modelo.comprimento_barra_mm,
      peso_por_metro_g: modelo.peso_por_metro_g,
      preco_por_metro_centavos: modelo.preco_por_metro_centavos,
      codigo_barras: modelo.codigo_barras,
      observacoes: modelo.observacoes,
      largura_secao_mm: modelo.largura_secao_mm ?? null,
      altura_secao_mm: modelo.altura_secao_mm ?? null,
      medida_3_secao_mm: modelo.medida_3_secao_mm ?? null,
      medida_4_secao_mm: modelo.medida_4_secao_mm ?? null,
    })
    setErro(null)
    setAberto(true)
  }

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)

    if (form.codigo.trim() === '' || form.descricao.trim() === '') {
      setErro('Código e descrição são obrigatórios.')
      return
    }

    if (form.comprimento_barra_mm <= 0 || form.comprimento_barra_mm > 18000) {
      setErro('O comprimento da barra precisa ficar entre 1 mm e 18 m.')
      return
    }

    try {
      if (editando) {
        await editar.mutateAsync({ id: editando.id, dados: form })
      } else {
        await criar.mutateAsync(form)
      }
      setAberto(false)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.')
    }
  }

  return (
    <PaginaLista
      className="max-w-3xl"
      cabecalho={
        <>
          <BotaoVoltar para="/mais" rotulo="Mais" className="mb-4" />

          <header className="mb-3 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold">Modelos de perfil</h1>
              <p className="text-texto-suave mt-1">
                O catálogo que as sobras, os orçamentos e as obras usam.
              </p>
            </div>
            {podeEditar && (
              <Botao onClick={abrirNovo} className="shrink-0">
                <Plus aria-hidden="true" className="size-5" />
                Novo
              </Botao>
            )}
          </header>

          {/* Linha própria, abaixo do cabeçalho: ao lado do título e do
              "Novo", "Atualização geral" espremia o texto explicativo em
              telas estreitas — o celular é justamente onde este botão mais
              se usa. */}
          {podeSincronizar && (
            <div className="mb-4 flex items-center gap-1.5">
              <Botao
                variante="secundaria"
                tamanho="pequeno"
                onClick={() => void aoSincronizar()}
                carregando={sincronizar.isPending && linhaParaSincronizar === ''}
                className="min-w-0 flex-1 px-2 text-xs"
              >
                <RefreshCw aria-hidden="true" className="size-3.5 shrink-0" />
                <span className="truncate">Atualização geral</span>
              </Botao>

              {/* Sincronizar uma linha só, em vez do catálogo inteiro — serve
                  tanto para atualizar uma linha que a empresa já tem quanto
                  para importar uma que ainda não tem nenhum perfil. Só lista
                  as linhas que a central liberou. Mesma largura dos botões
                  ao lado (flex-1), não uma largura fixa à parte. */}
              <select
                value={linhaParaSincronizar}
                onChange={(e) => setLinhaParaSincronizar(e.target.value)}
                className="border-borda bg-superficie hover:bg-superficie-2 min-h-10 min-w-0 flex-1 rounded-xl border-2 px-2 text-xs outline-none"
              >
                <option value="">Sincronizar linha…</option>
                {linhasCentral
                  ?.filter((l) => l.disponivel)
                  .map((l) => (
                    <option key={l.linha} value={l.linha}>
                      {l.linha}
                    </option>
                  ))}
              </select>
              <Botao
                variante="secundaria"
                tamanho="pequeno"
                disabled={linhaParaSincronizar === ''}
                carregando={sincronizar.isPending && linhaParaSincronizar !== ''}
                onClick={() => void aoSincronizar(linhaParaSincronizar)}
                className="min-w-0 flex-1 px-2 text-xs"
              >
                Atualizar
              </Botao>
            </div>
          )}

          {(mensagemSincronizacao || erroSincronizacao) && (
            <p
              role={erroSincronizacao ? 'alert' : 'status'}
              className={
                erroSincronizacao
                  ? 'bg-erro-50 text-erro-700 mb-4 rounded-xl px-4 py-3 text-sm'
                  : 'bg-superficie-2 mb-4 rounded-xl px-4 py-3 text-sm'
              }
            >
              {erroSincronizacao ?? mensagemSincronizacao}
            </p>
          )}

          {/* Busca e atalho lado a lado, como no estoque e na escolha de perfil
          ao cadastrar: onde se procura uma peça, o app funciona igual. */}
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
                placeholder="Buscar por código, descrição, linha ou aplicação"
                aria-label="Buscar perfil"
                className="border-borda bg-superficie min-h-12 w-full rounded-xl border-2 pr-4 pl-12"
              />
            </div>

            <select
              value={filtroRevisao}
              onChange={(e) => setFiltroRevisao(e.target.value as any)}
              className="border-borda bg-superficie hover:bg-superficie-2 min-h-12 shrink-0 rounded-xl border-2 px-3 text-sm font-medium outline-none"
            >
              <option value="todos">Todos</option>
              <option value="revisados">Revisados</option>
              <option value="pendentes">Pendentes</option>
            </select>

            <Link
              to="/identificar"
              aria-label="Identificar o perfil pela medida ou pela foto"
              title="Não sabe qual é? Identifique pela medida ou pela foto"
              className="border-borda bg-superficie hover:bg-superficie-2 text-acao-600 flex min-h-12 w-12 shrink-0 items-center justify-center rounded-xl border-2"
            >
              <Camera aria-hidden="true" className="size-5" />
            </Link>
          </div>

          {isPending && <p className="text-texto-suave">Carregando…</p>}

          {/* Onde se está e como voltar — no cabeçalho, não some ao rolar. */}
          {!isPending && !buscando && linhaAberta !== null && (
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="min-w-0 truncate font-semibold">
                {linhaAberta === TODAS ? 'Todos os perfis' : linhaAberta}
                <span className="text-texto-suave ml-2 font-normal">
                  ({visiveis.length})
                </span>
              </p>
              <AlternadorOrdenacao estado={ordenacao} aoMudar={setOrdenacao} />
              <BotaoVoltar
                onClick={voltarNivel}
                rotulo="Linhas"
                className="shrink-0"
              />
            </div>
          )}
        </>
      }
      rodape={
        <div className="flex items-center justify-center gap-4">
          {!isPending && mostrandoLinhas && grupos.length > 0 && (
            <button
              type="button"
              onClick={() => abrir({ linha: TODAS })}
              className="text-acao-600 text-sm font-medium hover:underline"
            >
              Ver todos os perfis
            </button>
          )}
          <button
            type="button"
            onClick={() => setMostrarInativos((v) => !v)}
            className="text-acao-600 text-sm font-medium hover:underline"
          >
            {mostrarInativos ? 'Ocultar inativos' : 'Exibir inativos'}
          </button>
        </div>
      }
    >
      {/* Lista de linhas: a porta de entrada do catálogo. */}
      {!isPending && mostrandoLinhas && grupos.length > 0 && (
        <ul className="flex flex-col gap-2">
          {grupos.map(({ linha, modelos: daLinha, resumo }) => {
            const revisados = daLinha.filter((m) => m.revisado).length
            const todosRevisados =
              daLinha.length > 0 && revisados === daLinha.length

            return (
              <li key={linha}>
                <button
                  type="button"
                  onClick={() => abrir({ linha })}
                  className="bg-celula hover:bg-celula border-borda flex min-h-16 w-full items-center gap-3 rounded-xl border-2 p-4 text-left shadow-sm"
                >
                  <div className="flex w-6 shrink-0 flex-col items-center justify-center gap-1">
                    {todosRevisados && (
                      <span
                        className="z-10 text-sm leading-none"
                        title="Todos revisados"
                      >
                        ✅
                      </span>
                    )}
                    <Layers
                      aria-hidden="true"
                      className="text-acao-600 size-5"
                    />
                  </div>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {linha}
                  </span>
                  <span className="text-texto-suave shrink-0 text-right text-sm">
                    <span className="block tabular-nums">
                      {formatarResumo(resumo)}
                    </span>
                    <span className="block text-xs">
                      Total: {daLinha.length}{' '}
                      <span className="inline-block w-2" /> Rev.: {revisados}
                    </span>
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

      {!isPending && !mostrandoLinhas && visiveisComFiltro.length === 0 && (
        <p className="bg-superficie-2 text-texto-suave rounded-xl p-6 text-center">
          {busca
            ? 'Nenhum perfil encontrado com esse termo.'
            : 'Nenhum perfil encontrado com os filtros atuais.'}
        </p>
      )}

      {!isPending && mostrandoLinhas && grupos.length === 0 && (
        <p className="bg-superficie-2 text-texto-suave rounded-xl p-6 text-center">
          Nenhum perfil cadastrado ainda.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {visiveisOrdenados.map((modelo) => (
          <li
            key={modelo.id}
            className="bg-celula border-borda flex items-center gap-3 rounded-xl border-2 p-3 shadow-sm"
          >
            <div className="flex shrink-0 flex-col items-center gap-1.5">
              {modelo.revisado && (
                <div className="-mt-1.5 mb-1 flex flex-col items-center">
                  <span className="text-xl leading-none" title="Revisado">
                    ✅
                  </span>
                  <span className="text-sucesso-700 mt-0.5 text-[10px] font-bold uppercase">
                    Revisado
                  </span>
                </div>
              )}
              {capas?.get(modelo.id) ? (
                <button
                  type="button"
                  onClick={() => setAmpliado(modelo)}
                  aria-label={`Ampliar desenho técnico de ${modelo.descricao}`}
                >
                  <MiniaturaPerfil
                    link={capas.get(modelo.id)}
                    codigo={modelo.codigo}
                  />
                </button>
              ) : (
                <MiniaturaPerfil link={null} codigo={modelo.codigo} />
              )}
            </div>

            <div className="flex min-w-0 flex-1 flex-col justify-center">
              <Link
                to={`/perfis/${modelo.id}`}
                className="flex min-w-0 flex-col"
              >
                <span className="flex items-start gap-1.5 text-base leading-tight font-medium">
                  <span className="line-clamp-2">{modelo.descricao}</span>
                  {!modelo.ativo && (
                    <span className="bg-superficie-2 text-texto-suave shrink-0 rounded px-2 py-0.5 text-xs">
                      inativo
                    </span>
                  )}
                </span>
                <span className="text-texto-suave block truncate text-sm">
                  {modelo.linha && `${modelo.linha} · `}
                  <span className="tabular-nums">
                    {resumoDe(porPerfil, modelo.id).pecas > 0
                      ? formatarResumo(resumoDe(porPerfil, modelo.id))
                      : 'sem estoque'}
                  </span>
                  {modelo.aplicacao && ` · ${modelo.aplicacao}`}
                </span>
                {formatarMedidasSecao(modelo) && (
                  <span className="text-texto-suave mt-0.5 block truncate text-sm">
                    {formatarMedidasSecao(modelo)}
                  </span>
                )}
              </Link>

              <div className="mt-2 flex items-center justify-between gap-2">
                <Link
                  to={`/perfis/${modelo.id}`}
                  className="text-acao-600 shrink-0 font-mono text-lg font-bold whitespace-nowrap"
                >
                  {modelo.codigo}
                </Link>

                {podeEditar && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Botao
                      tamanho="icone_pequeno"
                      variante="secundaria"
                      onClick={() => abrirEdicao(modelo)}
                      aria-label={`Editar ${modelo.codigo}`}
                    >
                      <Pencil aria-hidden="true" className="size-4" />
                    </Botao>

                    <Botao
                      tamanho="icone_pequeno"
                      variante="contorno"
                      onClick={() =>
                        void desativar.mutateAsync({
                          id: modelo.id,
                          ativo: !modelo.ativo,
                        })
                      }
                      aria-label={`${modelo.ativo ? 'Desativar' : 'Reativar'} ${modelo.codigo}`}
                      title={modelo.ativo ? 'Desativar' : 'Reativar'}
                    >
                      {modelo.ativo ? (
                        <Archive aria-hidden="true" className="size-4" />
                      ) : (
                        <ArchiveRestore aria-hidden="true" className="size-4" />
                      )}
                    </Botao>

                    {podeApagar(modelo) && (
                      <Botao
                        tamanho="icone_pequeno"
                        variante="contorno"
                        onClick={() => {
                          setApagando(modelo)
                          setErroApagar(null)
                        }}
                        aria-label={`Apagar ${modelo.codigo}`}
                        title="Apagar"
                        className="border-erro-200 text-erro-600 hover:bg-erro-50 hover:border-erro-300 hover:text-erro-700"
                      >
                        <Trash2 aria-hidden="true" className="size-4" />
                      </Botao>
                    )}
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={editando ? 'Editar perfil' : 'Novo perfil'}
        acoes={
          <Botao
            type="submit"
            form={ID_FORMULARIO_MODELO_PERFIL}
            variante="secundaria"
            tamanho="pequeno"
            carregando={criar.isPending || editar.isPending}
          >
            Salvar
          </Botao>
        }
      >
        <FormularioModeloPerfil
          form={form}
          aoMudar={setForm}
          modelo={editando}
          aoSalvar={aoEnviar}
          aoCancelar={() => setAberto(false)}
          salvando={criar.isPending || editar.isPending}
          erro={erro}
        />
      </Modal>

      <Modal
        aberto={apagando !== null}
        aoFechar={() => setApagando(null)}
        titulo="Apagar perfil"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            Apagar <strong className="font-mono">{apagando?.codigo}</strong>{' '}
            {apagando?.descricao} de vez — diferente de desativar, não há como
            desfazer.
          </p>

          {erroApagar && (
            <p
              role="alert"
              className="bg-erro-50 text-erro-700 rounded-xl px-4 py-3 text-sm"
            >
              {erroApagar}
            </p>
          )}

          <div className="flex gap-3">
            <Botao
              variante="contorno"
              onClick={() => setApagando(null)}
              className="flex-1"
            >
              Cancelar
            </Botao>
            <Botao
              variante="destrutiva"
              carregando={excluir.isPending}
              onClick={async () => {
                if (!apagando) return

                setErroApagar(null)

                try {
                  await excluir.mutateAsync(apagando.id)
                  setApagando(null)
                } catch (e) {
                  setErroApagar(
                    e instanceof Error ? e.message : 'Não foi possível apagar.',
                  )
                }
              }}
              className="flex-1"
            >
              <Trash2 aria-hidden="true" className="size-4" />
              Apagar
            </Botao>
          </div>
        </div>
      </Modal>
      {ampliado && capas?.get(ampliado.id) && (
        <VisualizadorImagem
          src={capas.get(ampliado.id)!}
          alt={`Desenho técnico do perfil ${ampliado.codigo}`}
          titulo={`${ampliado.descricao} · ${ampliado.codigo}`}
          aoFechar={() => setAmpliado(null)}
        />
      )}
    </PaginaLista>
  )
}
