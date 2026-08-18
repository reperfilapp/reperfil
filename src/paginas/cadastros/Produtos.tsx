import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  Plus,
  Pencil,
  ChevronRight,
  Archive,
  ArchiveRestore,
} from 'lucide-react'
import {
  useProdutos,
  useCriarProduto,
  useEditarProduto,
  useDesativarProduto,
  type DadosProduto,
} from '@/dados/produtos'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { podeGerenciarCadastros } from '@/autenticacao/contexto'
import { Botao } from '@/componentes/ui/Botao'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { Modal } from '@/componentes/ui/Modal'
import { PaginaLista } from '@/componentes/ui/PaginaLista'
import { FormularioProduto } from '@/componentes/produto/FormularioProduto'
import { formatarMedidaProduto } from '@/dominio/produto'
import type { Produto } from '@/tipos/banco'

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

  const { data: produtos, isPending } = useProdutos(true)
  const criar = useCriarProduto()
  const editar = useEditarProduto()
  const desativar = useDesativarProduto()

  const navegar = useNavigate()

  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState<Produto | null>(null)
  const [form, setForm] = useState<DadosProduto>(VAZIO)
  const [erro, setErro] = useState<string | null>(null)
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
      navegar(`/produtos/${novo.id}?montar=1`)
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

          {isPending && <p className="text-texto-suave">Carregando…</p>}
        </>
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
            className="bg-superficie flex items-center gap-3 rounded-xl p-4 shadow-sm"
          >
            <Link
              to={`/produtos/${produto.id}`}
              className="flex min-w-0 flex-1 items-center gap-2"
              aria-label={`Ver ${produto.nome}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {produto.nome}
                  {!produto.ativo && (
                    <span className="bg-superficie-2 text-texto-suave ml-2 rounded px-2 py-0.5 text-xs">
                      inativo
                    </span>
                  )}
                </span>
                <span className="text-texto-suave block truncate text-sm">
                  <span className="font-mono">{produto.codigo}</span>
                  {formatarMedidaProduto(produto) &&
                    ` · ${formatarMedidaProduto(produto)}`}
                </span>
              </span>
              <ChevronRight
                aria-hidden="true"
                className="text-texto-suave size-4 shrink-0"
              />
            </Link>

            {podeEditar && (
              <>
                <Botao
                  variante="secundaria"
                  onClick={() => abrirEdicao(produto)}
                  aria-label={`Editar ${produto.nome}`}
                >
                  <Pencil aria-hidden="true" className="size-4" />
                </Botao>

                <Botao
                  variante="contorno"
                  onClick={() =>
                    void desativar.mutateAsync({
                      id: produto.id,
                      ativo: !produto.ativo,
                    })
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
              </>
            )}
          </li>
        ))}
      </ul>

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
    </PaginaLista>
  )
}
