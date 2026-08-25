import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Layers, Puzzle } from 'lucide-react'
import { useSobras, type SobraDetalhada } from '@/dados/sobras'
import {
  useLotesAcessorio,
  type AcessorioDetalhado,
} from '@/dados/acessorios'
import { useCriarSessaoInventario } from '@/dados/inventario'
import { CampoSelecao } from '@/componentes/ui/CampoSelecao'
import { CampoTexto } from '@/componentes/ui/CampoTexto'
import { Botao } from '@/componentes/ui/Botao'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { formatarComprimento } from '@/dominio/medidas'
import { cn } from '@/lib/utilitarios'
import type { EstadoConservacao, TipoItemInventario } from '@/tipos/banco'

const ROTULO_ESTADO: Record<EstadoConservacao, string> = {
  novo_embalado: 'Novo/Embalado',
  excelente: 'Excelente',
  bom: 'Bom',
  pequenos_arranhoes: 'Pequenos arranhões',
  muito_avariado: 'Muito avariado',
}

const TODOS = ''

/**
 * Seleção de itens para inventariar.
 *
 * Mesmo espírito da tela de Relatórios — filtrar por linha, localização, cor,
 * condição — só que aqui cada filtro devolve LOTES individuais para contar,
 * não um número somado. Perfil e acessório têm filtros parcialmente
 * diferentes (linha × categoria, comprimento só existe em perfil), por isso
 * a tela troca de conjunto de campos conforme o tipo escolhido.
 */
export default function NovoInventario() {
  const navegar = useNavigate()
  const { data: sobras } = useSobras()
  const { data: acessorios } = useLotesAcessorio()
  const criar = useCriarSessaoInventario()

  const [tipoItem, setTipoItem] = useState<TipoItemInventario>('perfil')
  const [titulo, setTitulo] = useState('')
  const [linha, setLinha] = useState(TODOS)
  const [localizacaoId, setLocalizacaoId] = useState(TODOS)
  const [acabamentoId, setAcabamentoId] = useState(TODOS)
  const [estado, setEstado] = useState(TODOS)
  const [comprimentoMm, setComprimentoMm] = useState(TODOS)
  const [erro, setErro] = useState<string | null>(null)

  const fontePerfil = (sobras ?? []).filter(
    (s) => s.status === 'disponivel' || s.status === 'reservada',
  )
  const fonteAcessorio = (acessorios ?? []).filter(
    (a) => a.status === 'disponivel',
  )

  const linhas = [
    ...new Set(
      fontePerfil.map((s) => s.modelo?.linha?.trim() || 'Sem linha'),
    ),
  ].sort((a, b) => a.localeCompare(b, 'pt-BR'))

  const categorias = [
    ...new Set(
      fonteAcessorio.map(
        (a) => a.modelo?.categoria?.trim() || 'Sem categoria',
      ),
    ),
  ].sort((a, b) => a.localeCompare(b, 'pt-BR'))

  const fonte = tipoItem === 'perfil' ? fontePerfil : fonteAcessorio

  const localizacoes = [
    ...new Map(
      fonte
        .filter((i) => i.localizacao_id !== null)
        .map((i) => [i.localizacao_id as string, i.localizacao?.codigo ?? '']),
    ),
  ].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))

  const acabamentosUsados = [
    ...new Map(
      fonte
        .filter((i) => i.acabamento_id !== null)
        .map((i) => [i.acabamento_id as string, i.acabamento?.nome ?? '']),
    ),
  ].sort((a, b) => a[1].localeCompare(b[1], 'pt-BR'))

  const comprimentos =
    tipoItem === 'perfil'
      ? [...new Set(fontePerfil.map((s) => s.comprimento_mm))].sort(
          (a, b) => a - b,
        )
      : []

  function combinaPerfil(s: SobraDetalhada): boolean {
    if (linha !== TODOS && (s.modelo?.linha?.trim() || 'Sem linha') !== linha) {
      return false
    }
    if (localizacaoId !== TODOS && s.localizacao_id !== localizacaoId) {
      return false
    }
    if (acabamentoId !== TODOS && s.acabamento_id !== acabamentoId) {
      return false
    }
    if (estado !== TODOS && s.estado !== estado) return false
    if (comprimentoMm !== TODOS && s.comprimento_mm !== Number(comprimentoMm)) {
      return false
    }
    return true
  }

  function combinaAcessorio(a: AcessorioDetalhado): boolean {
    if (
      linha !== TODOS &&
      (a.modelo?.categoria?.trim() || 'Sem categoria') !== linha
    ) {
      return false
    }
    if (localizacaoId !== TODOS && a.localizacao_id !== localizacaoId) {
      return false
    }
    if (acabamentoId !== TODOS && a.acabamento_id !== acabamentoId) {
      return false
    }
    if (estado !== TODOS && a.estado !== estado) return false
    return true
  }

  const selecionados =
    tipoItem === 'perfil'
      ? fontePerfil.filter(combinaPerfil)
      : fonteAcessorio.filter(combinaAcessorio)

  function trocarTipo(novo: TipoItemInventario) {
    setTipoItem(novo)
    setLinha(TODOS)
    setLocalizacaoId(TODOS)
    setAcabamentoId(TODOS)
    setEstado(TODOS)
    setComprimentoMm(TODOS)
  }

  async function criarSessao() {
    setErro(null)

    if (selecionados.length === 0) {
      setErro('Nenhum item corresponde aos filtros escolhidos.')
      return
    }

    try {
      const sessao = await criar.mutateAsync({
        tipoItem,
        titulo: titulo.trim() || null,
        criterios: {
          linha: linha || null,
          localizacaoId: localizacaoId || null,
          acabamentoId: acabamentoId || null,
          estado: estado || null,
          comprimentoMm: comprimentoMm || null,
        },
        loteIds: selecionados.map((i) => i.id),
      })

      navegar(`/inventario/${sessao.id}`, { replace: true })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível criar.')
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg px-5 py-6">
      <BotaoVoltar para="/inventario" rotulo="Inventário" className="mb-4" />

      <header className="mb-6 flex items-center gap-3">
        <ClipboardList aria-hidden="true" className="text-acao-600 size-7" />
        <h1 className="text-2xl font-bold">Novo inventário</h1>
      </header>

      <div className="flex flex-col gap-6">
        <section>
          <h2 className="mb-2 font-semibold">1. O que vai contar?</h2>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => trocarTipo('perfil')}
              aria-pressed={tipoItem === 'perfil'}
              className={cn(
                'flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border-2 font-semibold transition-colors',
                tipoItem === 'perfil'
                  ? 'border-acao-600 bg-acao-600 text-white'
                  : 'border-borda bg-superficie text-texto hover:bg-superficie-2',
              )}
            >
              <Layers aria-hidden="true" className="size-6" />
              Perfis
            </button>
            <button
              type="button"
              onClick={() => trocarTipo('acessorio')}
              aria-pressed={tipoItem === 'acessorio'}
              className={cn(
                'flex min-h-20 flex-col items-center justify-center gap-1 rounded-xl border-2 font-semibold transition-colors',
                tipoItem === 'acessorio'
                  ? 'border-acao-600 bg-acao-600 text-white'
                  : 'border-borda bg-superficie text-texto hover:bg-superficie-2',
              )}
            >
              <Puzzle aria-hidden="true" className="size-6" />
              Acessórios
            </button>
          </div>
        </section>

        <section>
          <h2 className="mb-2 font-semibold">2. Escolha o recorte</h2>
          <div className="flex flex-col gap-3">
            <CampoSelecao
              rotulo={tipoItem === 'perfil' ? 'Linha' : 'Categoria'}
              value={linha}
              onChange={(e) => setLinha(e.target.value)}
            >
              <option value={TODOS}>Todas</option>
              {(tipoItem === 'perfil' ? linhas : categorias).map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </CampoSelecao>

            <CampoSelecao
              rotulo="Localização"
              value={localizacaoId}
              onChange={(e) => setLocalizacaoId(e.target.value)}
            >
              <option value={TODOS}>Todas</option>
              {localizacoes.map(([id, codigo]) => (
                <option key={id} value={id}>
                  {codigo}
                </option>
              ))}
            </CampoSelecao>

            <CampoSelecao
              rotulo="Cor / acabamento"
              value={acabamentoId}
              onChange={(e) => setAcabamentoId(e.target.value)}
            >
              <option value={TODOS}>Todas</option>
              {acabamentosUsados.map(([id, nome]) => (
                <option key={id} value={id}>
                  {nome}
                </option>
              ))}
            </CampoSelecao>

            <CampoSelecao
              rotulo="Condição"
              value={estado}
              onChange={(e) => setEstado(e.target.value)}
            >
              <option value={TODOS}>Todas</option>
              {Object.entries(ROTULO_ESTADO).map(([valor, rotulo]) => (
                <option key={valor} value={valor}>
                  {rotulo}
                </option>
              ))}
            </CampoSelecao>

            {tipoItem === 'perfil' && (
              <CampoSelecao
                rotulo="Tamanho de barra"
                value={comprimentoMm}
                onChange={(e) => setComprimentoMm(e.target.value)}
              >
                <option value={TODOS}>Todos</option>
                {comprimentos.map((mm) => (
                  <option key={mm} value={mm}>
                    {formatarComprimento(mm)}
                  </option>
                ))}
              </CampoSelecao>
            )}
          </div>
        </section>

        <section>
          <h2 className="mb-2 font-semibold">
            3. Título{' '}
            <span className="text-texto-suave font-normal">(opcional)</span>
          </h2>
          <CampoTexto
            rotulo="Título"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Contagem de agosto — Linha Suprema"
          />
        </section>

        <section
          className={cn(
            'rounded-xl border-2 p-4',
            selecionados.length === 0
              ? 'border-atencao-300 bg-atencao-50'
              : 'border-acao-300 bg-acao-50',
          )}
        >
          <p className="text-grafite-900 font-semibold">
            {selecionados.length}{' '}
            {selecionados.length === 1 ? 'item será' : 'itens serão'}{' '}
            incluídos neste inventário
          </p>
        </section>

        {erro && (
          <p
            role="alert"
            className="bg-erro-50 text-erro-700 rounded-xl px-4 py-3"
          >
            {erro}
          </p>
        )}

        <Botao
          tamanho="largura_total"
          disabled={selecionados.length === 0}
          carregando={criar.isPending}
          onClick={() => void criarSessao()}
        >
          Criar inventário
        </Botao>
      </div>
    </div>
  )
}
