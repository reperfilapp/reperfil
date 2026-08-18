import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  Plus,
  Trash2,
  ListChecks,
  PackageCheck,
  Pencil,
  ChevronRight,
} from 'lucide-react'
import {
  useProduto,
  useListaTecnica,
  useAdicionarItemLista,
  useRemoverItemLista,
  useEditarProduto,
  type DadosProduto,
} from '@/dados/produtos'
import { useModelosPerfil } from '@/dados/modelosPerfil'
import { useCapasDesenhos } from '@/dados/desenhosTecnicos'
import { MiniaturaPerfil } from '@/componentes/MiniaturaPerfil'
import { VisualizadorImagem } from '@/componentes/ui/VisualizadorImagem'
import { useSobras } from '@/dados/sobras'
import { useAcabamentos } from '@/dados/acabamentos'
import { useConfiguracoes, paraConfiguracaoCorte } from '@/dados/configuracoes'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { podeGerenciarCadastros } from '@/autenticacao/contexto'
import { unidadesProduziveis } from '@/dominio/producao'
import { resumirPorPerfil, resumoDe } from '@/dominio/estoqueResumo'
import { sobrasDisponiveis } from '@/dominio/estoqueParaProducao'
import { formatarMedidaProduto } from '@/dominio/produto'
import { formatarComprimento } from '@/dominio/medidas'
import { CONFIGURACAO_CORTE_PADRAO } from '@/dominio/corte'
import { obterLinkTemporario, BALDE_IMAGENS_PRODUTO } from '@/lib/armazenamento'
import { PaginaDetalhe, FichaDados } from '@/componentes/PaginaDetalhe'
import { EstadoConsulta } from '@/componentes/EstadoConsulta'
import { Botao } from '@/componentes/ui/Botao'
import { CampoTexto } from '@/componentes/ui/CampoTexto'
import { CampoSelecao } from '@/componentes/ui/CampoSelecao'
import { CampoQuantidade } from '@/componentes/ui/CampoQuantidade'
import { cn } from '@/lib/utilitarios'
import { Modal } from '@/componentes/ui/Modal'
import { Veredito } from '@/componentes/Veredito'
import { FormularioProduto } from '@/componentes/produto/FormularioProduto'

export default function ProdutoDetalhe() {
  const { id = null } = useParams()
  const { perfil } = useAutenticacao()
  const podeEditar = podeGerenciarCadastros(perfil)

  const consulta = useProduto(id)
  const produto = consulta.data ?? null

  const { data: itens } = useListaTecnica(id)
  const { data: modelos } = useModelosPerfil()
  const { data: capas } = useCapasDesenhos('imagem')
  const { data: sobras } = useSobras()
  const { data: acabamentos } = useAcabamentos()
  const { data: config } = useConfiguracoes()

  const adicionar = useAdicionarItemLista()
  const remover = useRemoverItemLista()
  const editar = useEditarProduto()

  const [editando, setEditando] = useState(false)
  const [formProduto, setFormProduto] = useState<DadosProduto | null>(null)
  const [erroProduto, setErroProduto] = useState<string | null>(null)

  const [aberto, setAberto] = useState(false)
  const [form, setForm] = useState({
    modelo_perfil_id: '',
    comprimento_mm: '',
    quantidade: '1',
  })
  const [erro, setErro] = useState<string | null>(null)
  const [ampliado, setAmpliado] = useState<string | null>(null)
  /*
   * Quantas unidades se quer produzir. Padrão 1 porque a pergunta mais
   * comum é "dá para fazer esta janela?" — só quando a resposta é sim é que
   * se pergunta "e três?".
   */
  const [desejada, setDesejada] = useState(1)

  // `?montar=1` chega de quem acabou de cadastrar o produto: o formulário do
  // primeiro corte já abre. O parâmetro sai da URL em seguida, senão
  // recarregar a página — ou voltar a ela pelo histórico — reabriria o
  // formulário sem ninguém ter pedido.
  const [parametros, definirParametros] = useSearchParams()

  useEffect(() => {
    if (parametros.get('montar') !== '1') return

    setAberto(true)
    definirParametros({}, { replace: true })
  }, [parametros, definirParametros])

  function abrirEdicao() {
    if (produto === null) return

    setFormProduto({
      codigo: produto.codigo,
      nome: produto.nome,
      descricao: produto.descricao,
      largura_mm: produto.largura_mm,
      altura_mm: produto.altura_mm,
      observacoes: produto.observacoes,
      foto_url: produto.foto_url,
      desenho_url: produto.desenho_url,
    })
    setErroProduto(null)
    setEditando(true)
  }

  async function salvarProduto(evento: FormEvent) {
    evento.preventDefault()
    setErroProduto(null)

    if (produto === null || formProduto === null) return

    if (formProduto.codigo.trim() === '' || formProduto.nome.trim() === '') {
      setErroProduto('Código e nome são obrigatórios.')
      return
    }

    try {
      await editar.mutateAsync({ id: produto.id, dados: formProduto })
      setEditando(false)
    } catch (e) {
      setErroProduto(
        e instanceof Error ? e.message : 'Não foi possível salvar.',
      )
    }
  }

  const nomeDoPerfil = (modeloId: string) => {
    const modelo = modelos?.find((m) => m.id === modeloId)

    return modelo ? `${modelo.codigo} ${modelo.descricao}` : 'perfil removido'
  }

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)

    const comprimento = Number(form.comprimento_mm.replace(',', '.'))
    const quantidade = Number(form.quantidade)

    if (form.modelo_perfil_id === '') {
      setErro('Escolha o perfil.')
      return
    }

    if (!Number.isFinite(comprimento) || comprimento <= 0) {
      setErro('Informe o comprimento do corte, em milímetros.')
      return
    }

    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      setErro('A quantidade por unidade precisa ser um número inteiro.')
      return
    }

    if (id === null) return

    try {
      await adicionar.mutateAsync({
        produto_id: id,
        modelo_perfil_id: form.modelo_perfil_id,
        comprimento_mm: Math.round(comprimento),
        quantidade,
        observacao: null,
      })

      // Só o comprimento e a quantidade são zerados: montando uma receita,
      // os cortes seguintes costumam ser do MESMO perfil, e reescolhê-lo a
      // cada linha seria trabalho repetido.
      setForm({ ...form, comprimento_mm: '', quantidade: '1' })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível adicionar.')
    }
  }

  if (consulta.isPending || consulta.error || produto === null) {
    return (
      <PaginaDetalhe
        voltarPara="/produtos"
        rotuloVoltar="Produtos"
        titulo="Produto"
      >
        <EstadoConsulta
          carregando={consulta.isPending}
          erro={consulta.error}
          vazio={produto === null}
          mensagemVazio="Produto não encontrado."
        />
      </PaginaDetalhe>
    )
  }

  const configCorte = config
    ? paraConfiguracaoCorte(config)
    : CONFIGURACAO_CORTE_PADRAO

  const disponiveis = sobrasDisponiveis(sobras ?? [])

  const lista = (itens ?? []).map((item) => ({
    modelo_perfil_id: item.modelo_perfil_id,
    comprimento_mm: item.comprimento_mm,
    quantidade: item.quantidade,
  }))

  // Quantas unidades saem no total — é o que o veredito anuncia.
  const resultado = unidadesProduziveis(lista, disponiveis, configCorte)

  /*
   * O pedido inteiro tratado como UMA unidade grande: cada corte
   * multiplicado pela quantidade desejada, e o cálculo perguntado se fecha
   * uma vez.
   *
   * É o que dá as FALTAS certas. Perguntar "quantas unidades saem" devolve
   * o que faltou para a unidade seguinte — informação boa para "dá para mais
   * uma?", inútil para "dá para as cinco que o cliente pediu?".
   */
  const pedido = unidadesProduziveis(
    lista.map((item) => ({
      ...item,
      quantidade: item.quantidade * desejada,
    })),
    disponiveis,
    configCorte,
    1,
  )

  const atendePedido = pedido.unidades >= 1

  /** Os perfis que não fecham o pedido — usados para colorir as linhas. */
  const faltando = new Set(
    pedido.faltas.map(
      (falta) => `${falta.modelo_perfil_id}|${falta.comprimento_mm}`,
    ),
  )

  const estoquePorPerfil = resumirPorPerfil(sobras ?? [])

  const acabamentoDoResultado = acabamentos?.find(
    (a) => a.id === resultado.acabamento_id,
  )

  return (
    <PaginaDetalhe
      voltarPara="/produtos"
      rotuloVoltar="Produtos"
      codigo={produto.codigo}
      titulo={produto.nome}
      subtitulo={formatarMedidaProduto(produto)}
      acoes={
        // A quantidade fica encostada na margem direita, e o Editar na
        // esquerda: são coisas de natureza diferente — uma muda o cadastro,
        // a outra só faz uma pergunta ao estoque.
        <div className="flex w-full items-center justify-between gap-3">
          {podeEditar ? (
            <Botao variante="secundaria" onClick={abrirEdicao}>
              <Pencil aria-hidden="true" className="size-4" />
              Editar
            </Botao>
          ) : (
            <span />
          )}

          <label className="flex items-center gap-2">
            <span className="text-texto-suave text-sm">Produzir</span>
            <CampoQuantidade
              valor={desejada}
              aoMudar={setDesejada}
              rotulo="Quantidade a produzir"
              compacto
            />
          </label>
        </div>
      }
    >
      <Veredito
        unidades={resultado.unidades}
        desejada={desejada}
        atendePedido={atendePedido}
        acabamento={acabamentoDoResultado?.nome ?? null}
        semReceita={(itens ?? []).length === 0}
        faltas={pedido.faltas.map((falta) => ({
          ...falta,
          perfil: nomeDoPerfil(falta.modelo_perfil_id),
        }))}
      />

      <section>
        <h2 className="mb-2 flex items-center gap-2 font-semibold">
          <ListChecks aria-hidden="true" className="size-4" />
          Lista técnica
        </h2>

        <p className="text-texto-suave mb-2 text-sm">
          O que entra em UMA unidade. Os comprimentos são de corte, já com os
          descontos que a oficina aplica.
        </p>

        {(itens ?? []).length === 0 ? (
          <p className="bg-superficie-2 text-texto-suave rounded-xl p-4 text-sm">
            Sem lista técnica ainda. Sem ela o sistema não tem como dizer se dá
            para fabricar este produto com as sobras.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {itens?.map((item) => {
              const desenho = capas?.get(item.modelo_perfil_id)
              const estoque = resumoDe(estoquePorPerfil, item.modelo_perfil_id)
              const falta = faltando.has(
                `${item.modelo_perfil_id}|${item.comprimento_mm}`,
              )

              return (
                <li
                  key={item.id}
                  className={cn(
                    'flex items-center gap-3 rounded-xl border p-2',
                    // Verde e vermelho claros, não fortes: a lista inteira
                    // fica colorida, e cor forte em tudo cansa a vista e
                    // deixa de significar alguma coisa.
                    // `economia` é o verde do tema — "economia,
                    // aproveitamento, disponível" —, que é exatamente o que
                    // uma linha atendida significa aqui.
                    falta
                      ? 'border-erro-100 bg-erro-50'
                      : 'border-economia-100 bg-economia-50',
                  )}
                >
                  {/* O desenho amplia; a linha abre a ficha. São dois
                      destinos diferentes no mesmo item, então o desenho
                      precisa ser um botão próprio e parar a propagação —
                      senão "ver a seção de perto" viraria uma navegação
                      para outra tela sem ninguém ter pedido. */}
                  <button
                    type="button"
                    onClick={() => desenho && setAmpliado(desenho)}
                    disabled={!desenho}
                    aria-label={`Ampliar desenho de ${nomeDoPerfil(item.modelo_perfil_id)}`}
                    className="shrink-0 disabled:cursor-default"
                  >
                    <MiniaturaPerfil
                      link={desenho ?? null}
                      codigo={
                        modelos?.find((m) => m.id === item.modelo_perfil_id)
                          ?.codigo ?? ''
                      }
                    />
                  </button>

                  <Link
                    to={`/perfis/${item.modelo_perfil_id}?de=${encodeURIComponent(`/produtos/${produto.id}`)}&rotulo=${encodeURIComponent('Lista técnica')}`}
                    className="flex min-w-0 flex-1 items-center gap-2"
                    aria-label={`Ver ficha de ${nomeDoPerfil(item.modelo_perfil_id)}`}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {nomeDoPerfil(item.modelo_perfil_id)}
                      </span>
                      <span className="text-texto-suave block text-sm tabular-nums">
                        {item.quantidade} ×{' '}
                        {formatarComprimento(item.comprimento_mm)}{' '}
                        {/* O estoque do PERFIL, somando comprimentos e
                            acabamentos. É contexto: diz se há matéria-prima
                            por perto, enquanto a cor da linha responde se ela
                            serve para este corte nesta quantidade. */}
                        <span className="whitespace-nowrap">
                          ({estoque.pecas} pç /{' '}
                          {(estoque.milimetros / 1000)
                            .toFixed(1)
                            .replace('.', ',')}{' '}
                          m)
                        </span>
                      </span>
                    </span>
                    <ChevronRight
                      aria-hidden="true"
                      className="text-texto-suave size-4 shrink-0"
                    />
                  </Link>

                  {podeEditar && (
                    <Botao
                      variante="contorno"
                      onClick={() => void remover.mutateAsync(item.id)}
                      aria-label={`Remover ${nomeDoPerfil(item.modelo_perfil_id)} da lista técnica`}
                      title="Remover"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </Botao>
                  )}
                </li>
              )
            })}
          </ul>
        )}

        {podeEditar && (
          <Botao
            variante="secundaria"
            onClick={() => {
              setErro(null)
              setAberto(true)
            }}
            className="mt-3 w-full"
          >
            <Plus aria-hidden="true" className="size-5" />
            Acrescentar corte
          </Botao>
        )}
      </section>

      <Imagens
        foto={produto.foto_url}
        desenho={produto.desenho_url}
        nome={produto.nome}
      />

      <FichaDados
        titulo="Cadastro"
        linhas={[
          { rotulo: 'Código', valor: produto.codigo },
          { rotulo: 'Medida', valor: formatarMedidaProduto(produto) },
          { rotulo: 'Descrição', valor: produto.descricao },
          { rotulo: 'Cortes na lista', valor: (itens ?? []).length },
        ]}
      />

      <Modal
        aberto={editando && formProduto !== null}
        aoFechar={() => setEditando(false)}
        titulo="Editar produto"
      >
        {formProduto && (
          <FormularioProduto
            form={formProduto}
            aoMudar={setFormProduto}
            aoSalvar={salvarProduto}
            aoCancelar={() => setEditando(false)}
            salvando={editar.isPending}
            erro={erroProduto}
          />
        )}
      </Modal>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Acrescentar corte"
      >
        <form onSubmit={aoEnviar} className="flex flex-col gap-4" noValidate>
          <CampoSelecao
            rotulo="Perfil"
            value={form.modelo_perfil_id}
            onChange={(e) =>
              setForm({ ...form, modelo_perfil_id: e.target.value })
            }
          >
            <option value="">Escolha…</option>
            {modelos?.map((modelo) => (
              <option key={modelo.id} value={modelo.id}>
                {modelo.codigo} — {modelo.descricao}
              </option>
            ))}
          </CampoSelecao>

          <div className="grid grid-cols-2 gap-4">
            <CampoTexto
              rotulo="Comprimento (mm)"
              inputMode="numeric"
              value={form.comprimento_mm}
              onChange={(e) =>
                setForm({ ...form, comprimento_mm: e.target.value })
              }
              required
            />
            <CampoTexto
              rotulo="Quantidade"
              inputMode="numeric"
              value={form.quantidade}
              onChange={(e) => setForm({ ...form, quantidade: e.target.value })}
              ajuda="Por unidade."
              required
            />
          </div>

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
              Fechar
            </Botao>
            <Botao
              type="submit"
              carregando={adicionar.isPending}
              className="flex-1"
            >
              <PackageCheck aria-hidden="true" className="size-5" />
              Acrescentar
            </Botao>
          </div>
        </form>
      </Modal>

      {ampliado && (
        <VisualizadorImagem
          src={ampliado}
          alt="Desenho técnico do perfil"
          aoFechar={() => setAmpliado(null)}
        />
      )}
    </PaginaDetalhe>
  )
}

/**
 * Foto e desenho do produto, quando existem.
 *
 * Some por inteiro se não houver nenhuma das duas: um quadro cinza com
 * "sem imagem" ocuparia a tela para dizer que não há nada a ver.
 */
function Imagens({
  foto,
  desenho,
  nome,
}: {
  foto: string | null
  desenho: string | null
  nome: string
}) {
  const [links, setLinks] = useState<{
    foto: string | null
    desenho: string | null
  }>({ foto: null, desenho: null })

  useEffect(() => {
    void Promise.all([
      foto ? obterLinkTemporario(BALDE_IMAGENS_PRODUTO, foto) : null,
      desenho ? obterLinkTemporario(BALDE_IMAGENS_PRODUTO, desenho) : null,
    ]).then(([umaFoto, umDesenho]) =>
      setLinks({ foto: umaFoto, desenho: umDesenho }),
    )
  }, [foto, desenho])

  if (foto === null && desenho === null) return null

  return (
    <section className="grid gap-3 sm:grid-cols-2">
      {links.foto && (
        <figure>
          <img
            src={links.foto}
            alt={`Foto de ${nome}`}
            className="bg-superficie-2 max-h-56 w-full rounded-xl object-contain"
          />
          <figcaption className="text-texto-suave mt-1 text-sm">
            Produto pronto
          </figcaption>
        </figure>
      )}

      {links.desenho && (
        <figure>
          <img
            src={links.desenho}
            alt={`Desenho técnico de ${nome}`}
            className="bg-superficie-2 max-h-56 w-full rounded-xl object-contain"
          />
          <figcaption className="text-texto-suave mt-1 text-sm">
            Desenho técnico
          </figcaption>
        </figure>
      )}
    </section>
  )
}
