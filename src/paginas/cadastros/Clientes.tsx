import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus,
  Pencil,
  Search,
  ChevronRight,
  Archive,
  ArchiveRestore,
} from 'lucide-react'
import {
  useClientes,
  useCriarCliente,
  useEditarCliente,
  useDesativarCliente,
  filtrarClientes,
  type DadosCliente,
} from '@/dados/clientes'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { podeGerenciarCadastros } from '@/autenticacao/contexto'
import { Botao } from '@/componentes/ui/Botao'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { CampoTexto } from '@/componentes/ui/CampoTexto'
import { CampoMascarado } from '@/componentes/ui/CampoMascarado'
import { Modal } from '@/componentes/ui/Modal'
import { PaginaLista } from '@/componentes/ui/PaginaLista'
import type { Cliente } from '@/tipos/banco'

const VAZIO: DadosCliente = {
  nome: '',
  nome_fantasia: null,
  cpf_cnpj: null,
  cidade: null,
  estado: null,
  telefone: null,
  whatsapp: null,
  email: null,
  contato_principal: null,
  observacoes: null,
}

export default function Clientes() {
  const { perfil } = useAutenticacao()
  // Esconder o que o banco recusaria: um botão que sempre devolve
  // erro ensina a pessoa a desconfiar da tela inteira.
  const podeEditar = podeGerenciarCadastros(perfil)

  const { data: clientes, isPending } = useClientes(true)
  const criar = useCriarCliente()
  const editar = useEditarCliente()
  const desativar = useDesativarCliente()

  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState<Cliente | null>(null)
  const [form, setForm] = useState<DadosCliente>(VAZIO)
  const [erro, setErro] = useState<string | null>(null)

  const visiveis = filtrarClientes(clientes ?? [], busca)

  function abrirNovo() {
    setEditando(null)
    setForm(VAZIO)
    setErro(null)
    setAberto(true)
  }

  function abrirEdicao(cliente: Cliente) {
    setEditando(cliente)
    setForm({
      nome: cliente.nome,
      nome_fantasia: cliente.nome_fantasia,
      cpf_cnpj: cliente.cpf_cnpj,
      cidade: cliente.cidade,
      estado: cliente.estado,
      telefone: cliente.telefone,
      whatsapp: cliente.whatsapp,
      email: cliente.email,
      contato_principal: cliente.contato_principal,
      observacoes: cliente.observacoes,
    })
    setErro(null)
    setAberto(true)
  }

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)

    if (form.nome.trim() === '') {
      setErro('O nome ou razão social é obrigatório.')
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
              <h1 className="text-2xl font-bold">Clientes</h1>
              <p className="text-texto-suave mt-1">
                Serão reaproveitados nos orçamentos da Fase 3.
              </p>
            </div>
            {podeEditar && (
              <Botao onClick={abrirNovo}>
                <Plus aria-hidden="true" className="size-5" />
                Novo
              </Botao>
            )}
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
              placeholder="Buscar por nome, documento ou cidade"
              aria-label="Buscar cliente"
              className="border-borda bg-superficie min-h-12 w-full rounded-xl border-2 pr-4 pl-12"
            />
          </div>

          {isPending && <p className="text-texto-suave">Carregando…</p>}
        </>
      }
    >
      {!isPending && visiveis.length === 0 && (
        <p className="bg-superficie-2 text-texto-suave rounded-xl p-6 text-center">
          {busca
            ? 'Nenhum cliente encontrado com esse termo.'
            : 'Nenhum cliente cadastrado ainda.'}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {visiveis.map((cliente) => (
          <li
            key={cliente.id}
            className="bg-superficie flex items-center gap-3 rounded-xl p-4 shadow-sm"
          >
            <Link
              to={`/clientes/${cliente.id}`}
              className="flex min-w-0 flex-1 items-center gap-2"
              aria-label={`Ver detalhes de ${cliente.nome}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {cliente.nome}
                  {!cliente.ativo && (
                    <span className="bg-superficie-2 text-texto-suave ml-2 rounded px-2 py-0.5 text-xs">
                      inativo
                    </span>
                  )}
                </span>
                <span className="text-texto-suave block truncate text-sm">
                  <span className="font-mono">{cliente.codigo}</span>
                  {cliente.cidade && ` · ${cliente.cidade}`}
                  {cliente.telefone && ` · ${cliente.telefone}`}
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
                  onClick={() => abrirEdicao(cliente)}
                  aria-label={`Editar ${cliente.nome}`}
                >
                  <Pencil aria-hidden="true" className="size-4" />
                </Botao>

                <Botao
                  variante="contorno"
                  onClick={() =>
                    void desativar.mutateAsync({
                      id: cliente.id,
                      ativo: !cliente.ativo,
                    })
                  }
                  aria-label={`${cliente.ativo ? 'Desativar' : 'Reativar'} ${cliente.nome}`}
                  title={cliente.ativo ? 'Desativar' : 'Reativar'}
                >
                  {/* Só o ícone: com o texto, em tela estreita, o botão comia a
                      largura do nome do registro — que é o que se procura na
                      lista. O rótulo continua no `aria-label` e na dica. */}
                  {cliente.ativo ? (
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
        titulo={editando ? 'Editar cliente' : 'Novo cliente'}
      >
        <form onSubmit={aoEnviar} className="flex flex-col gap-4" noValidate>
          <CampoTexto
            rotulo="Nome ou razão social"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            required
          />

          <CampoTexto
            rotulo="Nome fantasia"
            value={form.nome_fantasia ?? ''}
            onChange={(e) =>
              setForm({ ...form, nome_fantasia: e.target.value || null })
            }
          />

          <CampoMascarado
            rotulo="CPF ou CNPJ"
            tipo="cpf_cnpj"
            value={form.cpf_cnpj ?? ''}
            onChange={(cpf_cnpj) =>
              setForm({ ...form, cpf_cnpj: cpf_cnpj || null })
            }
          />

          <div className="grid grid-cols-[1fr_5rem] gap-4">
            <CampoTexto
              rotulo="Cidade"
              value={form.cidade ?? ''}
              onChange={(e) =>
                setForm({ ...form, cidade: e.target.value || null })
              }
            />
            <CampoTexto
              rotulo="UF"
              maxLength={2}
              value={form.estado ?? ''}
              onChange={(e) =>
                setForm({
                  ...form,
                  estado: e.target.value.toUpperCase() || null,
                })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <CampoMascarado
              rotulo="Telefone"
              tipo="telefone"
              value={form.telefone ?? ''}
              onChange={(telefone) =>
                setForm({ ...form, telefone: telefone || null })
              }
            />
            <CampoMascarado
              rotulo="WhatsApp"
              tipo="telefone"
              value={form.whatsapp ?? ''}
              onChange={(whatsapp) =>
                setForm({ ...form, whatsapp: whatsapp || null })
              }
            />
          </div>

          <CampoMascarado
            rotulo="E-mail"
            tipo="email"
            value={form.email ?? ''}
            onChange={(email) => setForm({ ...form, email: email || null })}
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
    </PaginaLista>
  )
}
