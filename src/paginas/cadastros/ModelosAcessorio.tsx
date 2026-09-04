import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus,
  Pencil,
  Search,
  Archive,
  ArchiveRestore,
  Trash2,
  Building2,
  DownloadCloud,
  Puzzle,
  ChevronRight,
} from 'lucide-react'
import { useNiveisNaUrl } from '@/componentes/useNiveisNaUrl'
import {
  useModelosAcessorio,
  useCriarModeloAcessorio,
  useEditarModeloAcessorio,
  useDesativarModeloAcessorio,
  useExcluirModeloAcessorio,
  useSincronizarAcessoriosCentral,
  agruparPorCategoria,
  SEM_CATEGORIA,
  VAZIO_ACESSORIO,
  type DadosModeloAcessorio,
} from '@/dados/modelosAcessorio'
import { useLotesAcessorio } from '@/dados/acessorios'
import { useCapasDesenhos } from '@/dados/desenhosTecnicos'
import { useOrganizacao } from '@/dados/organizacao'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { podeGerenciarCadastros } from '@/autenticacao/contexto'
import { MiniaturaPerfil } from '@/componentes/MiniaturaPerfil'
import { Botao } from '@/componentes/ui/Botao'
import { VisualizadorImagem } from '@/componentes/ui/VisualizadorImagem'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { CampoTexto } from '@/componentes/ui/CampoTexto'
import { CampoSelecao } from '@/componentes/ui/CampoSelecao'
import { Modal } from '@/componentes/ui/Modal'
import { PaginaLista } from '@/componentes/ui/PaginaLista'
import type { ModeloAcessorio } from '@/tipos/banco'
import { disparar } from '@/lib/avisoErro'

const UNIDADES = ['peça', 'metro', 'kg', 'conjunto', 'par', 'caixa']

/** Valor de `categoriaAberta` que significa "ignorar o agrupamento". */
const TODAS = '__todas__'

export default function ModelosAcessorio() {
  const navegar = useNavigate()
  const { perfil } = useAutenticacao()
  const podeEditar = podeGerenciarCadastros(perfil)

  const [mostrarInativos, setMostrarInativos] = useState(false)
  const { data: modelos, isPending } = useModelosAcessorio(mostrarInativos)
  const { data: lotes } = useLotesAcessorio()
  const { data: capas } = useCapasDesenhos('imagem', 'acessorio')
  const criar = useCriarModeloAcessorio()
  const editar = useEditarModeloAcessorio()
  const desativar = useDesativarModeloAcessorio()
  const excluir = useExcluirModeloAcessorio()

  // As duas pontas do catálogo central na mesma lista — mesmo padrão de
  // `Produtos.tsx`: quem administra o central libera; quem é empresa
  // importa. Nenhuma organização vê os dois botões.
  const { data: organizacao } = useOrganizacao()
  const souCentral = Boolean(organizacao?.eh_catalogo_central)
  const sincronizar = useSincronizarAcessoriosCentral()
  const [resultadoImportar, setResultadoImportar] = useState<string | null>(
    null,
  )

  async function importarDoCentral() {
    setResultadoImportar(null)

    try {
      const r = await sincronizar.mutateAsync()
      const partes = [
        `${r.acessorios_novos} ${r.acessorios_novos === 1 ? 'novo' : 'novos'}`,
        `${r.acessorios_atualizados} ${r.acessorios_atualizados === 1 ? 'atualizado' : 'atualizados'}`,
      ]
      if (r.imagens_novas > 0) {
        partes.push(
          `${r.imagens_novas} ${r.imagens_novas === 1 ? 'imagem nova' : 'imagens novas'}`,
        )
      }
      if (r.codigos_novos > 0) {
        partes.push(
          `${r.codigos_novos} ${r.codigos_novos === 1 ? 'código novo' : 'códigos novos'} de fabricante`,
        )
      }
      setResultadoImportar(partes.join(' · '))
    } catch (e) {
      setResultadoImportar(
        e instanceof Error ? e.message : 'Não foi possível importar.',
      )
    }
  }

  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState<ModeloAcessorio | null>(null)
  const [form, setForm] = useState<DadosModeloAcessorio>(VAZIO_ACESSORIO)
  const [erro, setErro] = useState<string | null>(null)
  const [apagando, setApagando] = useState<ModeloAcessorio | null>(null)
  const [erroApagar, setErroApagar] = useState<string | null>(null)
  const [ampliado, setAmpliado] = useState<ModeloAcessorio | null>(null)

  const termo = busca.trim().toLowerCase()
  const buscando = termo !== ''
  const encontrados = (modelos ?? []).filter(
    (m) =>
      termo === '' ||
      m.codigo.toLowerCase().includes(termo) ||
      m.descricao.toLowerCase().includes(termo) ||
      (m.categoria?.toLowerCase().includes(termo) ?? false),
  )

  /*
   * Categoria escolhida para ver, `null` na lista de categorias e 'todas'
   * quando a pessoa pediu tudo de uma vez — mesmo padrão de
   * `ModelosPerfil.tsx` (linha → perfil). Com 700+ acessórios, abrir direto
   * numa lista corrida obrigaria a rolar por categorias que não interessam.
   * A busca ignora este nível de propósito: quem digita um código quer
   * achá-lo esteja em que categoria estiver.
   */
  const { nivel, abrir, voltarNivel } = useNiveisNaUrl(['categoria'])
  const categoriaAberta = nivel('categoria')
  const mostrandoCategorias = !buscando && categoriaAberta === null

  const visiveis = buscando
    ? encontrados
    : categoriaAberta === TODAS
      ? encontrados
      : categoriaAberta === null
        ? []
        : encontrados.filter(
            (m) => (m.categoria?.trim() || SEM_CATEGORIA) === categoriaAberta,
          )

  const emUso = new Set((lotes ?? []).map((l) => l.modelo_acessorio_id))
  const podeApagar = (modelo: ModeloAcessorio) => !emUso.has(modelo.id)

  const grupos = agruparPorCategoria(modelos ?? [])

  function abrirNovo() {
    setEditando(null)
    setForm(VAZIO_ACESSORIO)
    setErro(null)
    setAberto(true)
  }

  function abrirEdicao(modelo: ModeloAcessorio) {
    setEditando(modelo)
    setForm({
      codigo: modelo.codigo,
      descricao: modelo.descricao,
      fabricante: modelo.fabricante,
      categoria: modelo.categoria,
      unidade_medida: modelo.unidade_medida,
      codigo_barras: modelo.codigo_barras,
      preco_unitario_centavos: modelo.preco_unitario_centavos,
      imagem_url: modelo.imagem_url,
      observacoes: modelo.observacoes,
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
              <h1 className="text-2xl font-bold">Acessórios</h1>
              <p className="text-texto-suave mt-1">
                Dobradiça, roldana, puxador, borracha — o catálogo, sem estoque.
              </p>
            </div>
            {podeEditar && (
              <Botao onClick={abrirNovo}>
                <Plus aria-hidden="true" className="size-5" />
                Novo
              </Botao>
            )}
          </header>

          {podeEditar && (
            <div className="mb-4">
              {souCentral ? (
                <Botao
                  variante="secundaria"
                  onClick={() => navegar('/acessorios/empresas')}
                  className="w-full"
                >
                  <Building2 aria-hidden="true" className="size-5" />
                  Administrar acessórios por empresa
                </Botao>
              ) : (
                <Botao
                  variante="secundaria"
                  onClick={() => void importarDoCentral()}
                  carregando={sincronizar.isPending}
                  className="w-full"
                >
                  <DownloadCloud aria-hidden="true" className="size-5" />
                  Importar do catálogo central
                </Botao>
              )}

              {resultadoImportar && (
                <p className="text-texto-suave mt-2 text-sm">
                  {resultadoImportar}
                </p>
              )}
            </div>
          )}

          <div className="relative mb-4">
            <Search
              aria-hidden="true"
              className="text-texto-suave pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2"
            />
            <input
              type="search"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar por código, descrição ou categoria"
              aria-label="Buscar acessório"
              className="border-borda bg-superficie min-h-12 w-full rounded-xl border-2 pr-4 pl-12"
            />
          </div>

          {isPending && <p className="text-texto-suave">Carregando…</p>}

          {/* Onde se está e como voltar — no cabeçalho, não some ao rolar. */}
          {!isPending && !buscando && categoriaAberta !== null && (
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="min-w-0 truncate font-semibold">
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
        </>
      }
      rodape={
        <div className="flex items-center justify-center gap-4">
          {!isPending && mostrandoCategorias && grupos.length > 0 && (
            <button
              type="button"
              onClick={() => abrir({ categoria: TODAS })}
              className="text-acao-600 text-sm font-medium hover:underline"
            >
              Ver todos os acessórios
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
      {/* Lista de categorias: a porta de entrada do catálogo. */}
      {!isPending && mostrandoCategorias && grupos.length > 0 && (
        <ul className="flex flex-col gap-2">
          {grupos.map(({ categoria, modelos: daCategoria }) => (
            <li key={categoria}>
              <button
                type="button"
                onClick={() => abrir({ categoria })}
                className="bg-celula hover:bg-celula border-borda flex min-h-16 w-full items-center gap-3 rounded-xl border-2 p-4 text-left shadow-sm"
              >
                <Puzzle aria-hidden="true" className="text-acao-600 size-5 shrink-0" />
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

      {!isPending && !mostrandoCategorias && visiveis.length === 0 && (
        <p className="bg-superficie-2 text-texto-suave rounded-xl p-6 text-center">
          {busca
            ? 'Nenhum acessório encontrado com esse termo.'
            : 'Nenhum acessório encontrado nesta categoria.'}
        </p>
      )}

      {!isPending && mostrandoCategorias && grupos.length === 0 && (
        <p className="bg-superficie-2 text-texto-suave rounded-xl p-6 text-center">
          Nenhum acessório cadastrado ainda.
        </p>
      )}

      {!mostrandoCategorias && (
        <ul className="flex flex-col gap-2">
          {visiveis.map((modelo) => (
                <li
                  key={modelo.id}
                  className="bg-celula border-borda flex items-center gap-3 rounded-xl border-2 p-3 shadow-sm"
                >
                  {capas?.get(modelo.id) ? (
                    <button
                      type="button"
                      onClick={() => setAmpliado(modelo)}
                      aria-label={`Ampliar desenho técnico de ${modelo.descricao}`}
                    >
                      <MiniaturaPerfil
                        link={capas.get(modelo.id)}
                        codigo={modelo.codigo}
                        alt={`Desenho técnico de ${modelo.descricao}`}
                        className="size-12"
                        recorte="canto-superior-esquerdo"
                      />
                    </button>
                  ) : (
                    <MiniaturaPerfil
                      link={null}
                      codigo={modelo.codigo}
                      className="size-12"
                    />
                  )}

                  <div className="flex min-w-0 flex-1 flex-col justify-center">
                    <Link
                      to={`/acessorios/${modelo.id}`}
                      className="flex min-w-0 flex-col"
                    >
                      <span className="flex items-center gap-1 text-base leading-tight font-medium">
                        <span className="truncate">{modelo.descricao}</span>
                        {!modelo.ativo && (
                          <span className="bg-superficie-2 text-texto-suave shrink-0 rounded px-2 py-0.5 text-xs">
                            inativo
                          </span>
                        )}
                      </span>
                      <span className="text-texto-suave block truncate text-sm">
                        {modelo.fabricante ?? 'sem fabricante'} ·{' '}
                        {modelo.unidade_medida}
                      </span>
                    </Link>

                    <div className="mt-1 flex items-center justify-between gap-2">
                      <Link
                        to={`/acessorios/${modelo.id}`}
                        className="text-acao-600 min-w-0 flex-1 truncate font-mono text-[15px] font-medium"
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
                              disparar(
                                desativar.mutateAsync({
                                  id: modelo.id,
                                  ativo: !modelo.ativo,
                                }),
                              )
                            }
                            aria-label={`${modelo.ativo ? 'Desativar' : 'Reativar'} ${modelo.codigo}`}
                            title={modelo.ativo ? 'Desativar' : 'Reativar'}
                          >
                            {modelo.ativo ? (
                              <Archive aria-hidden="true" className="size-4" />
                            ) : (
                              <ArchiveRestore
                                aria-hidden="true"
                                className="size-4"
                              />
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
      )}

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={editando ? 'Editar acessório' : 'Novo acessório'}
      >
        <form onSubmit={aoEnviar} className="flex flex-col gap-4" noValidate>
          <CampoTexto
            rotulo="Código"
            value={form.codigo}
            onChange={(e) => setForm({ ...form, codigo: e.target.value })}
            required
          />
          <CampoTexto
            rotulo="Descrição"
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            required
          />
          <CampoTexto
            rotulo="Categoria"
            value={form.categoria ?? ''}
            onChange={(e) =>
              setForm({ ...form, categoria: e.target.value || null })
            }
            ajuda='Ex.: "dobradiça", "roldana", "puxador".'
          />
          <CampoTexto
            rotulo="Fabricante"
            value={form.fabricante ?? ''}
            onChange={(e) =>
              setForm({ ...form, fabricante: e.target.value || null })
            }
          />
          <CampoSelecao
            rotulo="Unidade de medida"
            value={form.unidade_medida}
            onChange={(e) =>
              setForm({ ...form, unidade_medida: e.target.value })
            }
          >
            {UNIDADES.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </CampoSelecao>
          <CampoTexto
            rotulo="Código de barras (opcional)"
            value={form.codigo_barras ?? ''}
            onChange={(e) =>
              setForm({ ...form, codigo_barras: e.target.value || null })
            }
          />

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
              onClick={() => setAberto(false)}
              className="flex-1"
            >
              Cancelar
            </Botao>
            <Botao
              type="submit"
              carregando={criar.isPending || editar.isPending}
              className="flex-1"
            >
              Salvar
            </Botao>
          </div>
        </form>
      </Modal>

      <Modal
        aberto={apagando !== null}
        aoFechar={() => setApagando(null)}
        titulo="Apagar acessório"
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
          alt={`Desenho técnico de ${ampliado.descricao}`}
          titulo={`${ampliado.descricao} · ${ampliado.codigo}`}
          aoFechar={() => setAmpliado(null)}
        />
      )}
    </PaginaLista>
  )
}
