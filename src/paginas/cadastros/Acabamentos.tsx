import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus,
  Pencil,
  ChevronRight,
  Archive,
  ArchiveRestore,
} from 'lucide-react'
import {
  useAcabamentos,
  useCriarAcabamento,
  useEditarAcabamento,
  useDesativarAcabamento,
  type DadosAcabamento,
} from '@/dados/acabamentos'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { podeGerenciarCadastros } from '@/autenticacao/contexto'
import { Botao } from '@/componentes/ui/Botao'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { CampoTexto } from '@/componentes/ui/CampoTexto'
import { CampoSelecao } from '@/componentes/ui/CampoSelecao'
import { Modal } from '@/componentes/ui/Modal'
import { PaginaLista } from '@/componentes/ui/PaginaLista'
import { AmostraCor } from '@/componentes/ui/AmostraCor'
import type { Acabamento, TipoAcabamento } from '@/tipos/banco'

const VAZIO: DadosAcabamento = {
  codigo: '',
  nome: '',
  tipo: 'pintura',
  codigo_ral: null,
  descricao: null,
  cor_hex: null,
}

export default function Acabamentos() {
  const { perfil } = useAutenticacao()
  // Esconder o que o banco recusaria: um botão que sempre devolve
  // erro ensina a pessoa a desconfiar da tela inteira.
  const podeEditar = podeGerenciarCadastros(perfil)

  const { data: acabamentos, isPending } = useAcabamentos(true)
  const criar = useCriarAcabamento()
  const editar = useEditarAcabamento()
  const desativar = useDesativarAcabamento()

  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState<Acabamento | null>(null)
  const [form, setForm] = useState<DadosAcabamento>(VAZIO)
  const [erro, setErro] = useState<string | null>(null)

  function abrirNovo() {
    setEditando(null)
    setForm(VAZIO)
    setErro(null)
    setAberto(true)
  }

  function abrirEdicao(acabamento: Acabamento) {
    setEditando(acabamento)
    setForm({
      codigo: acabamento.codigo,
      nome: acabamento.nome,
      tipo: acabamento.tipo,
      codigo_ral: acabamento.codigo_ral,
      descricao: acabamento.descricao,
      cor_hex: acabamento.cor_hex,
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
      } else {
        await criar.mutateAsync(form)
      }
      setAberto(false)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.')
    }
  }

  const salvando = criar.isPending || editar.isPending

  return (
    <PaginaLista
      className="max-w-3xl"
      cabecalho={
        <>
          <BotaoVoltar para="/mais" rotulo="Mais" className="mb-4" />

          <header className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Cores e acabamentos</h1>
              <p className="text-texto-suave mt-1">
                O sistema nunca sugere uma sobra com acabamento diferente do
                pedido.
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
      {acabamentos?.length === 0 && (
        <p className="bg-superficie-2 text-texto-suave rounded-xl p-6 text-center">
          Nenhum acabamento cadastrado ainda.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {acabamentos?.map((acabamento) => (
          <li
            key={acabamento.id}
            className="bg-celula border-borda flex items-center gap-3 rounded-xl border-2 p-4 shadow-sm"
          >
            <AmostraCor corHex={acabamento.cor_hex} tamanho="grande" />
            <Link
              to={`/acabamentos/${acabamento.id}`}
              className="flex min-w-0 flex-1 items-center gap-2"
              aria-label={`Ver detalhes de ${acabamento.nome}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {acabamento.nome}
                  {!acabamento.ativo && (
                    <span className="bg-superficie-2 text-texto-suave ml-2 rounded px-2 py-0.5 text-xs">
                      inativo
                    </span>
                  )}
                </span>
                <span className="text-texto-suave block truncate text-sm">
                  {acabamento.codigo}
                  {acabamento.codigo_ral && ` · ${acabamento.codigo_ral}`}
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
                  onClick={() => abrirEdicao(acabamento)}
                  aria-label={`Editar ${acabamento.nome}`}
                >
                  <Pencil aria-hidden="true" className="size-4" />
                </Botao>

                <Botao
                  variante="contorno"
                  onClick={() =>
                    void desativar.mutateAsync({
                      id: acabamento.id,
                      ativo: !acabamento.ativo,
                    })
                  }
                  aria-label={`${acabamento.ativo ? 'Desativar' : 'Reativar'} ${acabamento.nome}`}
                  title={acabamento.ativo ? 'Desativar' : 'Reativar'}
                >
                  {/* Só o ícone: com o texto, em tela estreita, o botão comia a
                      largura do nome do registro — que é o que se procura na
                      lista. O rótulo continua no `aria-label` e na dica. */}
                  {acabamento.ativo ? (
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
        titulo={editando ? 'Editar acabamento' : 'Novo acabamento'}
      >
        <form onSubmit={aoEnviar} className="flex flex-col gap-4" noValidate>
          <CampoTexto
            rotulo="Código"
            value={form.codigo}
            onChange={(e) => setForm({ ...form, codigo: e.target.value })}
            ajuda="Curto e único, como ACB-PT."
            required
          />

          <CampoTexto
            rotulo="Nome"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            ajuda="Como aparece no orçamento, ex.: Pintura preto fosco."
            required
          />

          <CampoSelecao
            rotulo="Tipo"
            value={form.tipo}
            onChange={(e) =>
              setForm({ ...form, tipo: e.target.value as TipoAcabamento })
            }
          >
            <option value="pintura">Pintura</option>
            <option value="anodizado">Anodizado</option>
            <option value="natural">Natural</option>
            <option value="outro">Outro</option>
          </CampoSelecao>

          <CampoTexto
            rotulo="Código RAL (opcional)"
            value={form.codigo_ral ?? ''}
            onChange={(e) =>
              setForm({ ...form, codigo_ral: e.target.value || null })
            }
            ajuda="Ex.: RAL9005."
          />

          <CampoTexto
            rotulo="Cor para exibição (opcional)"
            type="color"
            value={form.cor_hex ?? '#cccccc'}
            onChange={(e) => setForm({ ...form, cor_hex: e.target.value })}
            ajuda="Só para identificar na lista. Não é a cor real da tinta."
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
            <Botao type="submit" carregando={salvando} className="flex-1">
              Salvar
            </Botao>
          </div>
        </form>
      </Modal>
    </PaginaLista>
  )
}
