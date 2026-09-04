import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus,
  Pencil,
  Archive,
  ArchiveRestore,
  Trash2,
  Building2,
  DownloadCloud,
} from 'lucide-react'
import {
  useProdutos,
  useCapasProdutos,
  useCriarProduto,
  useEditarProduto,
  useDesativarProduto,
  useExcluirProduto,
  useSincronizarProdutos,
  type DadosProduto,
} from '@/dados/produtos'
import { useOrganizacao } from '@/dados/organizacao'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { podeGerenciarCadastros } from '@/autenticacao/contexto'
import { Botao } from '@/componentes/ui/Botao'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { Modal } from '@/componentes/ui/Modal'
import { PaginaLista } from '@/componentes/ui/PaginaLista'
import { FormularioProduto } from '@/componentes/produto/FormularioProduto'
import { MiniaturaPerfil } from '@/componentes/MiniaturaPerfil'
import { VisualizadorImagem } from '@/componentes/ui/VisualizadorImagem'
import { formatarMedidaProduto } from '@/dominio/produto'
import type { Produto } from '@/tipos/banco'
import { disparar } from '@/lib/avisoErro'

const VAZIO: DadosProduto = {
  codigo: '',
  nome: '',
  descricao: null,
  largura_mm: null,
  altura_mm: null,
  observacoes: null,
  foto_url: null,
  desenho_url: null,
}

export default function Produtos() {
  const { perfil } = useAutenticacao()
  const podeEditar = podeGerenciarCadastros(perfil)

  const [mostrarInativos, setMostrarInativos] = useState(false)
  const { data: produtos, isPending } = useProdutos(mostrarInativos)
  const { data: capas } = useCapasProdutos()
  const criar = useCriarProduto()
  const editar = useEditarProduto()
  const desativar = useDesativarProduto()
  const excluir = useExcluirProduto()

  const navegar = useNavigate()

  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState<Produto | null>(null)
  const [form, setForm] = useState<DadosProduto>(VAZIO)
  const [erro, setErro] = useState<string | null>(null)
  /** Produto cujo desenho está aberto em tela cheia. */
  const [ampliado, setAmpliado] = useState<Produto | null>(null)
  const [apagando, setApagando] = useState<Produto | null>(null)
  const [erroApagar, setErroApagar] = useState<string | null>(null)

  /*
   * As duas pontas do catálogo central aparecem AQUI, e não em telas
   * separadas: quem administra o central libera produto; quem é empresa
   * importa. São papéis diferentes na mesma lista, e nenhuma organização vê
   * os dois botões.
   */
  const { data: organizacao } = useOrganizacao()
  const souCentral = Boolean(organizacao?.eh_catalogo_central)
  const sincronizar = useSincronizarProdutos()
  const [resultadoImportar, setResultadoImportar] = useState<string | null>(
    null,
  )

  async function importarDoCentral() {
    setResultadoImportar(null)

    try {
      const r = await sincronizar.mutateAsync()

      const partes = [
        `${r.produtos_novos} ${r.produtos_novos === 1 ? 'produto novo' : 'produtos novos'}`,
        `${r.produtos_atualizados} ${r.produtos_atualizados === 1 ? 'atualizado' : 'atualizados'}`,
      ]

      /*
       * Adoção anunciada, nunca silenciosa: um produto que já existia aqui
       * teve a RECEITA substituída pela do central. Quem montou a receita à
       * mão precisa saber que ela mudou.
       */
      if (r.produtos_vinculados > 0) {
        partes.push(
          `${r.produtos_vinculados} que já existia${r.produtos_vinculados === 1 ? '' : 'm'} aqui ${r.produtos_vinculados === 1 ? 'foi vinculado' : 'foram vinculados'} ao central, com a lista técnica substituída`,
        )
      }

      if (r.produtos_em_conflito > 0) {
        partes.push(
          `${r.produtos_em_conflito} ${r.produtos_em_conflito === 1 ? 'ficou de fora' : 'ficaram de fora'} por código repetido — renomeie o código aqui e repita`,
        )
      }

      /*
       * O aviso dos cortes sem perfil não é enfeite: o produto chega com a
       * receita INCOMPLETA, e quem mandar cortar sem saber disso perde
       * material. A saída é importar antes a linha de perfis que falta.
       */
      if (r.itens_sem_perfil > 0) {
        partes.push(
          `${r.itens_sem_perfil} ${r.itens_sem_perfil === 1 ? 'corte ficou de fora' : 'cortes ficaram de fora'} por falta do perfil correspondente — importe as linhas de perfil e repita`,
        )
      }

      if (r.itens_sem_acessorio > 0) {
        partes.push(
          `${r.itens_sem_acessorio} ${r.itens_sem_acessorio === 1 ? 'acessório da receita ficou de fora' : 'acessórios da receita ficaram de fora'} por falta do acessório correspondente — importe o catálogo de acessórios e repita`,
        )
      }

      setResultadoImportar(partes.join(' · '))
    } catch (e) {
      setResultadoImportar(
        e instanceof Error ? e.message : 'Não foi possível importar.',
      )
    }
  }

  function abrirNovo() {
    setEditando(null)
    setForm(VAZIO)
    setErro(null)
    setAberto(true)
  }

  function abrirEdicao(produto: Produto) {
    setEditando(produto)
    setForm({
      codigo: produto.codigo,
      nome: produto.nome,
      descricao: produto.descricao,
      largura_mm: produto.largura_mm,
      altura_mm: produto.altura_mm,
      observacoes: produto.observacoes,
      foto_url: produto.foto_url,
      desenho_url: produto.desenho_url,
    })
    setErro(null)
    setAberto(true)
  }

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)

    if (form.codigo.trim() === '' || form.nome.trim() === '') {
      setErro('Código e nome são obrigatórios.')
      return
    }

    try {
      if (editando) {
        await editar.mutateAsync({ id: editando.id, dados: form })
        setAberto(false)
        return
      }

      const novo = await criar.mutateAsync(form)

      setAberto(false)

      // Produto novo cai direto na lista técnica, com o formulário do
      // primeiro corte aberto. Sem ela o produto não responde a nada — a
      // tela de viabilidade só sabe dizer "sem lista" —, e quem cadastrou
      // uma janela acabou de pensar nos perfis dela. Voltar à lista de
      // produtos aqui é interromper o raciocínio no meio.
      navegar(`/produtos/${novo.id}/acrescentar-material`)
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

          <header className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Produtos</h1>
              <p className="text-texto-suave mt-1">
                O que a empresa fabrica, e a lista técnica de cada um.
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
                  onClick={() => navegar('/produtos/empresas')}
                  className="w-full"
                >
                  <Building2 aria-hidden="true" className="size-5" />
                  Administrar produtos por empresa
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
                <p
                  role="status"
                  className="bg-superficie-2 mt-2 rounded-xl px-4 py-3 text-sm"
                >
                  {resultadoImportar}
                </p>
              )}
            </div>
          )}

          {isPending && <p className="text-texto-suave">Carregando…</p>}
        </>
      }
      rodape={
        <div className="flex justify-center">
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
      {produtos?.length === 0 && (
        <p className="bg-superficie-2 text-texto-suave rounded-xl p-6 text-center">
          Nenhum produto cadastrado ainda. Cadastre uma janela ou porta e monte
          a lista técnica dela para descobrir o que dá para fabricar com as
          sobras.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {produtos?.map((produto) => (
          <li
            key={produto.id}
            className="bg-celula border-borda flex items-center gap-3 rounded-xl border-2 p-3 shadow-sm"
          >
            {capas?.get(produto.id) ? (
              <button
                type="button"
                onClick={() => setAmpliado(produto)}
                aria-label={`Ampliar desenho técnico de ${produto.nome}`}
                className="shrink-0"
              >
                <MiniaturaPerfil
                  link={capas.get(produto.id)}
                  codigo={produto.codigo}
                  alt={`Desenho técnico de ${produto.nome}`}
                />
              </button>
            ) : (
              <MiniaturaPerfil
                link={null}
                codigo={produto.codigo}
                alt={`${produto.nome} não tem desenho técnico`}
                className="shrink-0"
              />
            )}

            <div className="flex min-w-0 flex-1 flex-col justify-center">
              <Link
                to={`/produtos/${produto.id}`}
                className="flex min-w-0 flex-col"
                aria-label={`Ver ${produto.nome}`}
              >
                <span className="flex items-center gap-1 text-base leading-tight font-medium">
                  <span className="truncate">{produto.nome}</span>
                  {!produto.ativo && (
                    <span className="bg-superficie-2 text-texto-suave shrink-0 rounded px-2 py-0.5 text-xs">
                      inativo
                    </span>
                  )}
                </span>
                <span className="text-texto-suave block truncate text-sm">
                  {formatarMedidaProduto(produto) || 'sem medidas'}
                </span>
              </Link>

              <div className="mt-1 flex items-center justify-between gap-2">
                <Link
                  to={`/produtos/${produto.id}`}
                  className="text-acao-600 min-w-0 truncate font-mono text-[15px] font-medium"
                >
                  {produto.codigo}
                </Link>

                {podeEditar && (
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Botao
                      tamanho="icone_pequeno"
                      variante="secundaria"
                      onClick={() => abrirEdicao(produto)}
                      aria-label={`Editar ${produto.nome}`}
                    >
                      <Pencil aria-hidden="true" className="size-4" />
                    </Botao>

                    <Botao
                      tamanho="icone_pequeno"
                      variante="contorno"
                      onClick={() =>
                        disparar(
                          desativar.mutateAsync({
                            id: produto.id,
                            ativo: !produto.ativo,
                          }),
                        )
                      }
                      aria-label={`${produto.ativo ? 'Desativar' : 'Reativar'} ${produto.nome}`}
                      title={produto.ativo ? 'Desativar' : 'Reativar'}
                    >
                      {produto.ativo ? (
                        <Archive aria-hidden="true" className="size-4" />
                      ) : (
                        <ArchiveRestore aria-hidden="true" className="size-4" />
                      )}
                    </Botao>

                    <Botao
                      tamanho="icone_pequeno"
                      variante="contorno"
                      onClick={() => {
                        setApagando(produto)
                        setErroApagar(null)
                      }}
                      aria-label={`Apagar ${produto.nome}`}
                      title="Apagar"
                      className="border-erro-200 text-erro-600 hover:bg-erro-50 hover:border-erro-300 hover:text-erro-700"
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </Botao>
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>

      <Modal
        aberto={apagando !== null}
        aoFechar={() => setApagando(null)}
        titulo="Apagar produto"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            Apagar <strong>{apagando?.nome}</strong> de vez — a lista técnica
            dele some junto. Diferente de desativar, não há como desfazer.
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

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={editando ? 'Editar produto' : 'Novo produto'}
      >
        <FormularioProduto
          form={form}
          aoMudar={setForm}
          aoSalvar={aoEnviar}
          aoCancelar={() => setAberto(false)}
          salvando={criar.isPending || editar.isPending}
          erro={erro}
        />
      </Modal>

      {/* O nome vai escrito por cima: na linha ele aparece cortado, e é ao
          abrir o desenho que se precisa dele inteiro para ter certeza de que
          é o produto certo. */}
      {ampliado && capas?.get(ampliado.id) && (
        <VisualizadorImagem
          src={capas.get(ampliado.id)!}
          alt={`Desenho técnico de ${ampliado.nome}`}
          titulo={`${ampliado.nome} · ${ampliado.codigo}`}
          aoFechar={() => setAmpliado(null)}
        />
      )}
    </PaginaLista>
  )
}
