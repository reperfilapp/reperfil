import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
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
} from 'lucide-react'
import {
  useModelosPerfil,
  useCriarModeloPerfil,
  useEditarModeloPerfil,
  useDesativarModeloPerfil,
  useExcluirModeloPerfil,
  filtrarModelos,
  agruparPorLinha,
  SEM_LINHA,
  type DadosModeloPerfil,
} from '@/dados/modelosPerfil'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { podeGerenciarCadastros } from '@/autenticacao/contexto'
import { Botao } from '@/componentes/ui/Botao'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { AlternadorOrdenacao } from '@/componentes/ui/AlternadorOrdenacao'
import { ORDENACAO_PADRAO } from '@/dominio/ordenacaoListas'
import { Modal } from '@/componentes/ui/Modal'
import { FormularioModeloPerfil } from '@/componentes/perfil/FormularioModeloPerfil'
import { PaginaLista } from '@/componentes/ui/PaginaLista'
import { MiniaturaPerfil } from '@/componentes/MiniaturaPerfil'
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

  const { data: modelos, isPending } = useModelosPerfil(true)
  const criar = useCriarModeloPerfil()
  const editar = useEditarModeloPerfil()
  const desativar = useDesativarModeloPerfil()
  const excluir = useExcluirModeloPerfil()
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
   */
  const [linhaAberta, setLinhaAberta] = useState<string | null>(null)
  const [ordenacao, setOrdenacao] = useState(ORDENACAO_PADRAO)
  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState<ModeloPerfil | null>(null)
  const [form, setForm] = useState<DadosModeloPerfil>(VAZIO)
  const [erro, setErro] = useState<string | null>(null)
  const [apagando, setApagando] = useState<ModeloPerfil | null>(null)
  const [erroApagar, setErroApagar] = useState<string | null>(null)

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

      const porTamanho = maiorPrimeiro(a.resumo, b.resumo)

      return porTamanho !== 0
        ? porTamanho
        : a.linha.localeCompare(b.linha, 'pt-BR')
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

  // Cópia antes de ordenar: `visiveis` sai de `filtrarModelos`, e ordenar no
  // lugar mexeria no array guardado pelo React Query.
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

          <header className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Modelos de perfil</h1>
              <p className="text-texto-suave mt-1">
                O catálogo que as sobras, os orçamentos e as obras usam.
              </p>
            </div>
            {podeEditar && (
              <Botao onClick={abrirNovo}>
                <Plus aria-hidden="true" className="size-5" />
                Novo
              </Botao>
            )}
          </header>

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
                onClick={() => setLinhaAberta(null)}
                rotulo="Linhas"
                className="shrink-0"
              />
            </div>
          )}
        </>
      }
      rodape={
        // Só na lista de linhas: dentro de uma delas o atalho de voltar já
        // está no cabeçalho, e um botão a mais aqui embaixo tomaria altura
        // que a lista quer.
        !isPending && mostrandoLinhas && grupos.length > 0 ? (
          <Botao
            variante="contorno"
            tamanho="largura_total"
            onClick={() => setLinhaAberta(TODAS)}
          >
            Ver todos os perfis
          </Botao>
        ) : undefined
      }
    >
      {/* Lista de linhas: a porta de entrada do catálogo. */}
      {!isPending && mostrandoLinhas && grupos.length > 0 && (
        <ul className="flex flex-col gap-2">
          {grupos.map(({ linha, modelos: daLinha, resumo }) => (
            <li key={linha}>
              <button
                type="button"
                onClick={() => setLinhaAberta(linha)}
                className="bg-superficie hover:bg-superficie-2 flex min-h-16 w-full items-center gap-3 rounded-xl p-4 text-left shadow-sm"
              >
                <Layers
                  aria-hidden="true"
                  className="text-acao-600 size-5 shrink-0"
                />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {linha}
                </span>
                <span className="text-texto-suave shrink-0 text-sm">
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

      {!isPending && !mostrandoLinhas && visiveis.length === 0 && (
        <p className="bg-superficie-2 text-texto-suave rounded-xl p-6 text-center">
          {busca
            ? 'Nenhum perfil encontrado com esse termo.'
            : 'Nenhum perfil nesta linha.'}
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
            className="bg-superficie flex items-center gap-3 rounded-xl p-4 shadow-sm"
          >
            <Link
              to={`/perfis/${modelo.id}`}
              className="flex min-w-0 flex-1 items-center gap-3"
              aria-label={`Ver ficha do perfil ${modelo.codigo}`}
            >
              <MiniaturaPerfil
                link={capas?.get(modelo.id)}
                codigo={modelo.codigo}
              />

              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1 truncate font-medium">
                  <span className="text-acao-600 font-mono">
                    {modelo.codigo}
                  </span>{' '}
                  {modelo.descricao}
                  {!modelo.ativo && (
                    <span className="bg-superficie-2 text-texto-suave ml-2 rounded px-2 py-0.5 text-xs">
                      inativo
                    </span>
                  )}
                  <ChevronRight
                    aria-hidden="true"
                    className="text-texto-suave size-4 shrink-0"
                  />
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
              </span>
            </Link>

            {podeEditar && (
              <>
                <Botao
                  variante="secundaria"
                  onClick={() => abrirEdicao(modelo)}
                  aria-label={`Editar ${modelo.codigo}`}
                >
                  <Pencil aria-hidden="true" className="size-4" />
                </Botao>

                <Botao
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
                  {/* Só o ícone: com o texto, em tela estreita, o botão comia a
                      largura do nome do registro — que é o que se procura na
                      lista. O rótulo continua no `aria-label` e na dica. */}
                  {modelo.ativo ? (
                    <Archive aria-hidden="true" className="size-4" />
                  ) : (
                    <ArchiveRestore aria-hidden="true" className="size-4" />
                  )}
                </Botao>

                {/* Só aparece quando dá para apagar de verdade — na maioria
                    das linhas, com sobra ou lista técnica, o botão nem
                    existe, em vez de existir desabilitado explicando por quê. */}
                {podeApagar(modelo) && (
                  <Botao
                    variante="contorno"
                    onClick={() => {
                      setApagando(modelo)
                      setErroApagar(null)
                    }}
                    aria-label={`Apagar ${modelo.codigo}`}
                    title="Apagar"
                  >
                    <Trash2 aria-hidden="true" className="size-4" />
                  </Botao>
                )}
              </>
            )}
          </li>
        ))}
      </ul>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={editando ? 'Editar perfil' : 'Novo perfil'}
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
            <p role="alert" className="bg-erro-50 text-erro-700 rounded-xl px-4 py-3 text-sm">
              {erroApagar}
            </p>
          )}

          <div className="flex gap-3">
            <Botao variante="contorno" onClick={() => setApagando(null)} className="flex-1">
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
    </PaginaLista>
  )
}
