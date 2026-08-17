import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, ChevronRight } from 'lucide-react'
import {
  useLocalizacoes,
  useCriarLocalizacao,
  useEditarLocalizacao,
  useDesativarLocalizacao,
  descreverLocalizacao,
  type DadosLocalizacao,
} from '@/dados/localizacoes'
import { Botao } from '@/componentes/ui/Botao'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { CampoTexto } from '@/componentes/ui/CampoTexto'
import { Modal } from '@/componentes/ui/Modal'
import { PaginaLista } from '@/componentes/ui/PaginaLista'
import type { Localizacao } from '@/tipos/banco'

const VAZIO: DadosLocalizacao = {
  codigo: '',
  deposito: null,
  setor: null,
  corredor: null,
  estante: null,
  prateleira: null,
  posicao: null,
  observacao: null,
}

export default function Localizacoes() {
  const { data: locais, isPending } = useLocalizacoes(true)
  const criar = useCriarLocalizacao()
  const editar = useEditarLocalizacao()
  const desativar = useDesativarLocalizacao()

  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState<Localizacao | null>(null)
  const [form, setForm] = useState<DadosLocalizacao>(VAZIO)
  const [erro, setErro] = useState<string | null>(null)

  function abrirNovo() {
    setEditando(null)
    setForm(VAZIO)
    setErro(null)
    setAberto(true)
  }

  function abrirEdicao(local: Localizacao) {
    setEditando(local)
    setForm({
      codigo: local.codigo,
      deposito: local.deposito,
      setor: local.setor,
      corredor: local.corredor,
      estante: local.estante,
      prateleira: local.prateleira,
      posicao: local.posicao,
      observacao: local.observacao,
    })
    setErro(null)
    setAberto(true)
  }

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)

    if (form.codigo.trim() === '') {
      setErro('O código é obrigatório — é ele que o serralheiro procura.')
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

          <header className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Localizações</h1>
              <p className="text-texto-suave mt-1">
                Onde a peça está no depósito. Todos os níveis são opcionais.
              </p>
            </div>
            <Botao onClick={abrirNovo}>
              <Plus aria-hidden="true" className="size-5" />
              Nova
            </Botao>
          </header>

          {isPending && <p className="text-texto-suave">Carregando…</p>}
        </>
      }
    >
      {locais?.length === 0 && (
        <p className="bg-superficie-2 text-texto-suave rounded-xl p-6 text-center">
          Nenhuma localização cadastrada ainda.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {locais?.map((local) => (
          <li
            key={local.id}
            className="bg-superficie flex items-center gap-3 rounded-xl p-4 shadow-sm"
          >
            <Link
              to={`/localizacoes/${local.id}`}
              className="flex min-w-0 flex-1 items-center gap-2"
              aria-label={`Ver detalhes de ${local.codigo}`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {local.codigo}
                  {!local.ativo && (
                    <span className="bg-superficie-2 text-texto-suave ml-2 rounded px-2 py-0.5 text-xs">
                      inativa
                    </span>
                  )}
                </span>
                <span className="text-texto-suave block truncate text-sm">
                  {descreverLocalizacao(local)}
                </span>
              </span>
              <ChevronRight
                aria-hidden="true"
                className="text-texto-suave size-4 shrink-0"
              />
            </Link>

            <Botao
              variante="secundaria"
              onClick={() => abrirEdicao(local)}
              aria-label={`Editar ${local.codigo}`}
            >
              <Pencil aria-hidden="true" className="size-4" />
            </Botao>

            <Botao
              variante="contorno"
              onClick={() =>
                void desativar.mutateAsync({
                  id: local.id,
                  ativo: !local.ativo,
                })
              }
            >
              {local.ativo ? 'Desativar' : 'Reativar'}
            </Botao>
          </li>
        ))}
      </ul>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo={editando ? 'Editar localização' : 'Nova localização'}
      >
        <form onSubmit={aoEnviar} className="flex flex-col gap-4" noValidate>
          <CampoTexto
            rotulo="Código"
            value={form.codigo}
            onChange={(e) => setForm({ ...form, codigo: e.target.value })}
            ajuda="Curto e único, como A1-01. É o que se procura na prateleira."
            required
          />

          <div className="grid grid-cols-2 gap-4">
            <CampoTexto
              rotulo="Depósito"
              value={form.deposito ?? ''}
              onChange={(e) =>
                setForm({ ...form, deposito: e.target.value || null })
              }
            />
            <CampoTexto
              rotulo="Setor"
              value={form.setor ?? ''}
              onChange={(e) =>
                setForm({ ...form, setor: e.target.value || null })
              }
            />
            <CampoTexto
              rotulo="Corredor"
              value={form.corredor ?? ''}
              onChange={(e) =>
                setForm({ ...form, corredor: e.target.value || null })
              }
            />
            <CampoTexto
              rotulo="Estante"
              value={form.estante ?? ''}
              onChange={(e) =>
                setForm({ ...form, estante: e.target.value || null })
              }
            />
            <CampoTexto
              rotulo="Prateleira"
              value={form.prateleira ?? ''}
              onChange={(e) =>
                setForm({ ...form, prateleira: e.target.value || null })
              }
            />
            <CampoTexto
              rotulo="Posição"
              value={form.posicao ?? ''}
              onChange={(e) =>
                setForm({ ...form, posicao: e.target.value || null })
              }
            />
          </div>

          <CampoTexto
            rotulo="Observação"
            value={form.observacao ?? ''}
            onChange={(e) =>
              setForm({ ...form, observacao: e.target.value || null })
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
    </PaginaLista>
  )
}
