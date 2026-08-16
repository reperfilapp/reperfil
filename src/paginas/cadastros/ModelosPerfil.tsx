import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Pencil, Search, Images, ChevronRight } from 'lucide-react'
import {
  useModelosPerfil,
  useCriarModeloPerfil,
  useEditarModeloPerfil,
  useDesativarModeloPerfil,
  filtrarModelos,
  type DadosModeloPerfil,
} from '@/dados/modelosPerfil'
import { Botao } from '@/componentes/ui/Botao'
import { CampoTexto } from '@/componentes/ui/CampoTexto'
import { Modal } from '@/componentes/ui/Modal'
import { GaleriaDesenhos } from '@/componentes/GaleriaDesenhos'
import { MiniaturaPerfil } from '@/componentes/MiniaturaPerfil'
import { useCapasDesenhos } from '@/dados/desenhosTecnicos'
import { formatarComprimento } from '@/dominio/medidas'
import type { ModeloPerfil } from '@/tipos/banco'

const VAZIO: DadosModeloPerfil = {
  codigo: '',
  descricao: '',
  fabricante: null,
  linha: null,
  categoria: null,
  comprimento_barra_mm: 6000,
  peso_por_metro_g: null,
  preco_por_metro_centavos: null,
  codigo_barras: null,
  observacoes: null,
}

export default function ModelosPerfil() {
  const { data: modelos, isPending } = useModelosPerfil(true)
  const criar = useCriarModeloPerfil()
  const editar = useEditarModeloPerfil()
  const desativar = useDesativarModeloPerfil()
  const { data: capas } = useCapasDesenhos()

  const [busca, setBusca] = useState('')
  const [aberto, setAberto] = useState(false)
  const [editando, setEditando] = useState<ModeloPerfil | null>(null)
  const [form, setForm] = useState<DadosModeloPerfil>(VAZIO)
  const [erro, setErro] = useState<string | null>(null)
  const [galeriaDe, setGaleriaDe] = useState<ModeloPerfil | null>(null)

  const visiveis = filtrarModelos(modelos ?? [], busca)

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
          placeholder="Buscar por código, descrição ou linha"
          aria-label="Buscar perfil"
          className="border-borda bg-superficie min-h-12 w-full rounded-xl border-2 pr-4 pl-12"
        />
      </div>

      {isPending && <p className="text-texto-suave">Carregando…</p>}

      {!isPending && visiveis.length === 0 && (
        <p className="bg-superficie-2 text-texto-suave rounded-xl p-6 text-center">
          {busca
            ? 'Nenhum perfil encontrado com esse termo.'
            : 'Nenhum perfil cadastrado ainda.'}
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
            <CampoTexto
              rotulo="Linha ou sistema"
              value={form.linha ?? ''}
              onChange={(e) =>
                setForm({ ...form, linha: e.target.value || null })
              }
            />
            <CampoTexto
              rotulo="Fabricante"
              value={form.fabricante ?? ''}
              onChange={(e) =>
                setForm({ ...form, fabricante: e.target.value || null })
              }
            />
          </div>

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
