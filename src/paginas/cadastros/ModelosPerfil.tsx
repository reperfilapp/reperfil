import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus,
  Pencil,
  Search,
  Images,
  ChevronRight,
  Layers,
} from 'lucide-react'
import {
  useModelosPerfil,
  useCriarModeloPerfil,
  useEditarModeloPerfil,
  useDesativarModeloPerfil,
  useValoresUsados,
  filtrarModelos,
  agruparPorLinha,
  SEM_LINHA,
  type DadosModeloPerfil,
} from '@/dados/modelosPerfil'
import { Botao } from '@/componentes/ui/Botao'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { CampoTexto } from '@/componentes/ui/CampoTexto'
import { CampoSugestao } from '@/componentes/ui/CampoSugestao'
import { Modal } from '@/componentes/ui/Modal'
import { GaleriaDesenhos } from '@/componentes/GaleriaDesenhos'
import { MiniaturaPerfil } from '@/componentes/MiniaturaPerfil'
import { useCapasDesenhos } from '@/dados/desenhosTecnicos'
import { formatarComprimento } from '@/dominio/medidas'
import type { ModeloPerfil } from '@/tipos/banco'

/** Valor de `linhaAberta` que significa "ignorar o agrupamento". */
const TODAS = '__todas__'

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
}

/**
 * Sugestões iniciais para o campo Aplicação.
 *
 * O campo é texto livre — a nomenclatura varia entre fabricantes e entre
 * empresas, então travar numa lista fechada obrigaria a digitar "outro" toda
 * hora. A `datalist` sugere sem impedir: digitar algo fora da lista continua
 * funcionando normalmente.
 *
 * Esta lista é só o ponto de partida, para quem ainda não cadastrou nada.
 * A partir daí a lista de sugestões passa a crescer sozinha: ver
 * `useAplicacoesUsadas`, que traz o que a própria empresa já digitou. Não há
 * uma tela de administração porque não precisa — usar uma aplicação nova já
 * é o cadastro dela.
 */
const SUGESTOES_INICIAIS = [
  'Lateral da porta',
  'Base da janela',
  'Travessa superior',
  'Travessa inferior',
  'Montante',
  'Marco',
  'Contramarco',
  'Folha móvel',
  'Folha fixa',
  'Batente',
  'Requadro',
  'Soleira',
  'Peitoril',
  'Puxador',
  'Trilho de correr',
  'Perfil de vedação',
] as const

export default function ModelosPerfil() {
  const { data: modelos, isPending } = useModelosPerfil(true)
  const criar = useCriarModeloPerfil()
  const editar = useEditarModeloPerfil()
  const desativar = useDesativarModeloPerfil()
  const { data: capas } = useCapasDesenhos()
  const { data: aplicacoesUsadas } = useValoresUsados('aplicacao')
  const { data: linhasUsadas } = useValoresUsados('linha')
  const { data: fabricantesUsados } = useValoresUsados('fabricante')

  // As 16 iniciais aparecem sempre, para quem ainda não usou nenhuma; o que
  // a empresa já digitou entra junto, sem repetir.
  const sugestoesAplicacao = [
    ...new Set([...SUGESTOES_INICIAIS, ...(aplicacoesUsadas ?? [])]),
  ].sort((a, b) => a.localeCompare(b, 'pt-BR'))

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
  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState<ModeloPerfil | null>(null)
  const [form, setForm] = useState<DadosModeloPerfil>(VAZIO)
  const [erro, setErro] = useState<string | null>(null)
  const [galeriaDe, setGaleriaDe] = useState<ModeloPerfil | null>(null)

  const encontrados = filtrarModelos(modelos ?? [], busca)
  const buscando = busca.trim() !== ''
  const grupos = agruparPorLinha(modelos ?? [])

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
    <div className="mx-auto w-full max-w-3xl px-5 py-8">
      <BotaoVoltar para="/mais" rotulo="Mais" className="mb-4" />

      <header className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Modelos de perfil</h1>
          <p className="text-texto-suave mt-1">
            O catálogo que as sobras, os orçamentos e as obras usam.
          </p>
        </div>
        <Botao onClick={abrirNovo}>
          <Plus aria-hidden="true" className="size-5" />
          Novo
        </Botao>
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
          placeholder="Buscar por código, descrição, linha ou aplicação"
          aria-label="Buscar perfil"
          className="border-borda bg-superficie min-h-12 w-full rounded-xl border-2 pr-4 pl-12"
        />
      </div>

      {isPending && <p className="text-texto-suave">Carregando…</p>}

      {/* Lista de linhas: a porta de entrada do catálogo. */}
      {!isPending && mostrandoLinhas && grupos.length > 0 && (
        <>
          <ul className="mb-3 flex flex-col gap-2">
            {grupos.map(({ linha, modelos: daLinha }) => (
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
                    {daLinha.length}{' '}
                    {daLinha.length === 1 ? 'perfil' : 'perfis'}
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="text-texto-suave size-4 shrink-0"
                  />
                </button>
              </li>
            ))}
          </ul>

          <Botao
            variante="contorno"
            tamanho="largura_total"
            onClick={() => setLinhaAberta(TODAS)}
          >
            Ver todos os perfis
          </Botao>
        </>
      )}

      {/* Cabeçalho de quem está dentro de uma linha (ou vendo tudo). */}
      {!isPending && !buscando && linhaAberta !== null && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="min-w-0 truncate font-semibold">
            {linhaAberta === TODAS ? 'Todos os perfis' : linhaAberta}
            <span className="text-texto-suave ml-2 font-normal">
              ({visiveis.length})
            </span>
          </p>
          <BotaoVoltar
            onClick={() => setLinhaAberta(null)}
            rotulo="Linhas"
            className="shrink-0"
          />
        </div>
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
        {visiveis.map((modelo) => (
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
                  barra de {formatarComprimento(modelo.comprimento_barra_mm)}
                  {modelo.aplicacao && ` · ${modelo.aplicacao}`}
                </span>
              </span>
            </Link>

            <Botao
              variante="secundaria"
              onClick={() => setGaleriaDe(modelo)}
              aria-label={`Imagens de ${modelo.codigo}`}
            >
              <Images aria-hidden="true" className="size-4" />
            </Botao>

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
            >
              {modelo.ativo ? 'Desativar' : 'Reativar'}
            </Botao>
          </li>
        ))}
      </ul>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={editando ? 'Editar perfil' : 'Novo perfil'}
      >
        <form onSubmit={aoEnviar} className="flex flex-col gap-4" noValidate>
          <CampoTexto
            rotulo="Código interno"
            value={form.codigo}
            onChange={(e) => setForm({ ...form, codigo: e.target.value })}
            ajuda="O código que a sua empresa já usa para este perfil."
            required
          />

          <CampoTexto
            rotulo="Descrição"
            value={form.descricao}
            onChange={(e) => setForm({ ...form, descricao: e.target.value })}
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <CampoSugestao
              rotulo="Linha ou sistema"
              valor={form.linha ?? ''}
              aoMudar={(v) => setForm({ ...form, linha: v || null })}
              sugestoes={linhasUsadas ?? []}
              ajuda="Escolha uma já usada ou digite uma nova."
            />
            <CampoSugestao
              rotulo="Fabricante"
              valor={form.fabricante ?? ''}
              aoMudar={(v) => setForm({ ...form, fabricante: v || null })}
              sugestoes={fabricantesUsados ?? []}
              ajuda="Escolha um já usado ou digite um novo."
            />
          </div>

          <CampoSugestao
            rotulo="Aplicação"
            valor={form.aplicacao ?? ''}
            aoMudar={(v) => setForm({ ...form, aplicacao: v || null })}
            sugestoes={sugestoesAplicacao}
            ajuda="Onde este perfil é usado na esquadria: lateral da porta, base da janela, montante…"
          />

          <CampoTexto
            rotulo="Comprimento da barra nova (mm)"
            type="number"
            inputMode="numeric"
            min={1}
            max={18000}
            value={form.comprimento_barra_mm}
            onChange={(e) =>
              setForm({
                ...form,
                comprimento_barra_mm: Number(e.target.value),
              })
            }
            ajuda="Normalmente 6000 mm."
            required
          />

          <CampoTexto
            rotulo="Peso por metro em gramas (opcional)"
            type="number"
            inputMode="numeric"
            min={1}
            value={form.peso_por_metro_g ?? ''}
            onChange={(e) =>
              setForm({
                ...form,
                peso_por_metro_g: e.target.value
                  ? Number(e.target.value)
                  : null,
              })
            }
            ajuda="Em gramas, número inteiro. Ex.: 1180 para 1,18 kg/m."
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
        aberto={galeriaDe !== null}
        aoFechar={() => setGaleriaDe(null)}
        titulo={galeriaDe ? `Imagens — ${galeriaDe.codigo}` : 'Imagens'}
      >
        {galeriaDe && (
          <div className="flex flex-col gap-6">
            <GaleriaDesenhos modelo={galeriaDe} tipo="imagem" />
            <div className="border-borda border-t pt-6">
              <GaleriaDesenhos modelo={galeriaDe} tipo="foto" />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
