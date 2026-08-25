import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle2, FileText, Layers, Puzzle } from 'lucide-react'
import {
  useSessaoInventario,
  useItensInventario,
  useContarItemInventario,
  useAplicarItemInventario,
  useAplicarSessaoInventario,
  useCancelarSessaoInventario,
  type ItemInventarioDetalhado,
} from '@/dados/inventario'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { podeMovimentarEstoque } from '@/autenticacao/contexto'
import { useCapasDesenhos } from '@/dados/desenhosTecnicos'
import { EstadoConsulta } from '@/componentes/EstadoConsulta'
import { Botao } from '@/componentes/ui/Botao'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { AmostraCor } from '@/componentes/ui/AmostraCor'
import { MiniaturaPerfil } from '@/componentes/MiniaturaPerfil'
import { VisualizadorImagem } from '@/componentes/ui/VisualizadorImagem'
import { FolhaInventario } from '@/componentes/inventario/FolhaInventario'
import { formatarComprimento } from '@/dominio/medidas'
import { formatarMedidasSecao } from '@/dominio/secao'
import { imprimirFolha, imprimeNoNativo } from '@/lib/impressao'
import { APLICACAO } from '@/config/aplicacao'
import type { StatusSessaoInventario } from '@/tipos/banco'

const ROTULO_STATUS: Record<StatusSessaoInventario, string> = {
  em_andamento: 'em andamento',
  concluida: 'concluída',
  cancelada: 'cancelada',
}

export default function SessaoInventarioDetalhe() {
  const { id } = useParams<{ id: string }>()
  const { perfil } = useAutenticacao()
  const podeMovimentar = podeMovimentarEstoque(perfil)

  const { data: sessao, isPending, error, refetch } = useSessaoInventario(
    id ?? null,
  )
  const { data: itens } = useItensInventario(id ?? null)
  const { data: capas } = useCapasDesenhos()
  const contar = useContarItemInventario()
  const aplicarItem = useAplicarItemInventario()
  const aplicarSessao = useAplicarSessaoInventario()
  const cancelar = useCancelarSessaoInventario()

  const [imprimindo, setImprimindo] = useState(false)
  const [erroGeral, setErroGeral] = useState<string | null>(null)
  const [resultado, setResultado] = useState<string | null>(null)
  const [ampliado, setAmpliado] = useState<{
    link: string
    titulo: string
  } | null>(null)

  // Espera as imagens (o logo) antes de imprimir — sem isso, o diálogo
  // fotografa a página com o espaço da imagem ainda em branco.
  useEffect(() => {
    if (!imprimindo) return

    let cancelado = false

    const folha = document.getElementById('folha-impressao')
    const imagens = folha ? [...folha.querySelectorAll('img')] : []

    const prontas = imagens.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            img.onload = () => resolve()
            img.onerror = () => resolve()
          }),
    )

    const nome = sessao ? `inventario-${sessao.codigo}` : 'inventario'

    void Promise.all(prontas).then(() => {
      if (cancelado || !folha) return

      void imprimirFolha(folha, nome).finally(() => {
        if (imprimeNoNativo()) setImprimindo(false)
      })
    })

    const aoTerminar = () => setImprimindo(false)
    window.addEventListener('afterprint', aoTerminar)

    return () => {
      cancelado = true
      window.removeEventListener('afterprint', aoTerminar)
    }
  }, [imprimindo, sessao])

  if (isPending || error || !sessao) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-6">
        <EstadoConsulta
          carregando={isPending}
          erro={error}
          vazio={!isPending && !sessao}
          mensagemVazio="Inventário não encontrado."
          aoTentarNovamente={() => void refetch()}
        />
      </div>
    )
  }

  const lista = itens ?? []
  const contados = lista.filter((i) => i.contagem_quantidade !== null)
  const naoAplicados = contados.filter((i) => i.aplicado_em === null)

  async function aplicarTudo() {
    if (!sessao) return

    setErroGeral(null)

    try {
      const r = await aplicarSessao.mutateAsync(sessao.id)
      setResultado(
        `${r.total ?? 0} item(ns) aplicado(s), ${r.alterados ?? 0} com diferença gravada no estoque.`,
      )
    } catch (e) {
      setErroGeral(
        e instanceof Error ? e.message : 'Não foi possível aplicar.',
      )
    }
  }

  async function cancelarSessao() {
    if (!sessao) return

    setErroGeral(null)

    try {
      await cancelar.mutateAsync(sessao.id)
    } catch (e) {
      setErroGeral(
        e instanceof Error ? e.message : 'Não foi possível cancelar.',
      )
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-6">
      <BotaoVoltar para="/inventario" rotulo="Inventário" className="mb-4" />

      <header className="mb-4 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {sessao.tipo_item === 'perfil' ? (
            <Layers aria-hidden="true" className="text-acao-600 size-7" />
          ) : (
            <Puzzle aria-hidden="true" className="text-acao-600 size-7" />
          )}
          <div>
            <h1 className="text-xl font-bold">
              {sessao.titulo ||
                (sessao.tipo_item === 'perfil' ? 'Perfis' : 'Acessórios')}
            </h1>
            <p className="text-texto-suave text-sm">
              <span className="font-mono">{sessao.codigo}</span> ·{' '}
              {ROTULO_STATUS[sessao.status]}
            </p>
          </div>
        </div>
      </header>

      <p className="text-texto-suave mb-4 text-sm">
        {contados.length} de {lista.length} contados
      </p>

      <div className="mb-5 flex flex-wrap gap-2">
        <Botao
          variante="contorno"
          onClick={() => setImprimindo(true)}
          carregando={imprimindo && !imprimeNoNativo()}
        >
          <FileText aria-hidden="true" className="size-4" />
          Gerar folha para contar na prancheta
        </Botao>

        {podeMovimentar &&
          sessao.status === 'em_andamento' &&
          naoAplicados.length > 0 && (
            <Botao
              onClick={() => void aplicarTudo()}
              carregando={aplicarSessao.isPending}
            >
              <CheckCircle2 aria-hidden="true" className="size-4" />
              Aplicar {naoAplicados.length} contado(s) ao estoque
            </Botao>
          )}

        {podeMovimentar && sessao.status === 'em_andamento' && (
          <Botao
            variante="contorno"
            onClick={() => void cancelarSessao()}
            carregando={cancelar.isPending}
          >
            Cancelar inventário
          </Botao>
        )}
      </div>

      {resultado && (
        <p
          role="status"
          className="bg-economia-50 text-economia-700 mb-4 rounded-xl px-4 py-3 text-sm"
        >
          {resultado}
        </p>
      )}

      {erroGeral && (
        <p
          role="alert"
          className="bg-erro-50 text-erro-700 mb-4 rounded-xl px-4 py-3 text-sm"
        >
          {erroGeral}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {lista.map((item) => (
          <ItemContagem
            key={item.id}
            item={item}
            ehPerfil={sessao.tipo_item === 'perfil'}
            podeMovimentar={podeMovimentar && sessao.status === 'em_andamento'}
            usuarioId={perfil?.id ?? ''}
            desenho={
              item.lote_sobra
                ? (capas?.get(item.lote_sobra.modelo_perfil_id) ?? null)
                : null
            }
            aoAmpliar={setAmpliado}
            aoContar={contar}
            aoAplicar={aplicarItem}
          />
        ))}
      </ul>

      {imprimindo && (
        <FolhaInventario sessao={sessao} itens={lista} empresa={APLICACAO.nome} />
      )}

      {ampliado && (
        <VisualizadorImagem
          src={ampliado.link}
          alt={`Desenho técnico de ${ampliado.titulo}`}
          titulo={ampliado.titulo}
          aoFechar={() => setAmpliado(null)}
        />
      )}
    </div>
  )
}

function ItemContagem({
  item,
  ehPerfil,
  podeMovimentar,
  usuarioId,
  desenho,
  aoAmpliar,
  aoContar,
  aoAplicar,
}: {
  item: ItemInventarioDetalhado
  ehPerfil: boolean
  podeMovimentar: boolean
  usuarioId: string
  /** Link do desenho técnico, só para itens de perfil. */
  desenho: string | null
  aoAmpliar: (info: { link: string; titulo: string }) => void
  aoContar: ReturnType<typeof useContarItemInventario>
  aoAplicar: ReturnType<typeof useAplicarItemInventario>
}) {
  const lote = item.lote_sobra ?? item.lote_acessorio
  const [quantidadeTexto, setQuantidadeTexto] = useState(
    String(item.estoque_esperado_quantidade),
  )
  const [comprimentoTexto, setComprimentoTexto] = useState(
    item.estoque_esperado_comprimento_mm !== null
      ? String(item.estoque_esperado_comprimento_mm)
      : '',
  )
  const [erro, setErro] = useState<string | null>(null)

  if (!lote) return null

  const jaContado = item.contagem_quantidade !== null
  const jaAplicado = item.aplicado_em !== null

  async function confirmar() {
    setErro(null)

    try {
      await aoContar.mutateAsync({
        itemId: item.id,
        contagemQuantidade: item.estoque_esperado_quantidade,
        contagemComprimentoMm: item.estoque_esperado_comprimento_mm,
        confirmadoSemAlteracao: true,
        usuarioId,
      })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível confirmar.')
    }
  }

  async function salvarNovoValor() {
    setErro(null)

    const quantidade = Number(quantidadeTexto)
    const comprimento =
      ehPerfil && comprimentoTexto.trim() !== ''
        ? Number(comprimentoTexto)
        : null

    if (!Number.isFinite(quantidade) || quantidade < 0) {
      setErro('Informe uma quantidade válida.')
      return
    }

    try {
      await aoContar.mutateAsync({
        itemId: item.id,
        contagemQuantidade: quantidade,
        contagemComprimentoMm: comprimento,
        confirmadoSemAlteracao: false,
        usuarioId,
      })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.')
    }
  }

  async function aplicar() {
    setErro(null)

    try {
      await aoAplicar.mutateAsync(item.id)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível aplicar.')
    }
  }

  return (
    <li className="bg-celula border-borda rounded-xl border-2 p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-3">
          {ehPerfil && (
            <button
              type="button"
              onClick={() =>
                desenho &&
                aoAmpliar({
                  link: desenho,
                  titulo: `${lote.modelo?.codigo} — ${lote.modelo?.descricao}`,
                })
              }
              disabled={!desenho}
              aria-label={`Ampliar desenho técnico de ${lote.modelo?.descricao}`}
              className="shrink-0 disabled:cursor-default"
            >
              <MiniaturaPerfil
                link={desenho}
                codigo={lote.modelo?.codigo ?? ''}
              />
            </button>
          )}

          <div className="min-w-0">
            <p className="text-[15px] leading-snug font-medium">
              <span className="text-acao-600 font-mono font-bold">
                {lote.modelo?.codigo}
              </span>{' '}
              {lote.modelo?.descricao}
            </p>
            <p className="text-texto-suave mt-0.5 flex flex-wrap items-center gap-x-2 text-xs">
              <span className="font-mono">{lote.codigo}</span>
              {lote.acabamento && (
                <AmostraCor
                  corHex={lote.acabamento.cor_hex}
                  nome={lote.acabamento.nome}
                  tamanho="pequeno"
                />
              )}
              {lote.localizacao && <span>· {lote.localizacao.codigo}</span>}
            </p>
            {item.lote_sobra &&
              formatarMedidasSecao(item.lote_sobra.modelo ?? {}) && (
                <p className="text-texto-suave mt-0.5 text-xs">
                  Medidas: {formatarMedidasSecao(item.lote_sobra.modelo ?? {})}
                </p>
              )}
          </div>
        </div>

        {jaAplicado && (
          <span className="bg-economia-50 text-economia-700 shrink-0 rounded-full px-2.5 py-1 text-xs font-medium">
            Aplicado
          </span>
        )}
      </div>

      <p className="bg-superficie-2 mb-3 rounded-lg px-3 py-2 text-sm">
        Estoque atual: <strong>{item.estoque_esperado_quantidade}</strong>{' '}
        {ehPerfil ? 'peça(s)' : 'unidade(s)'}
        {ehPerfil && item.estoque_esperado_comprimento_mm && (
          <>
            {' '}
            de{' '}
            <strong>
              {formatarComprimento(item.estoque_esperado_comprimento_mm)}
            </strong>
          </>
        )}
      </p>

      {jaContado ? (
        <p className="text-sm">
          Contado: <strong>{item.contagem_quantidade}</strong>
          {ehPerfil &&
            item.contagem_comprimento_mm !== null && (
              <>
                {' '}
                de{' '}
                <strong>
                  {formatarComprimento(item.contagem_comprimento_mm)}
                </strong>
              </>
            )}{' '}
          <span className="text-texto-suave">
            (
            {item.confirmado_sem_alteracao
              ? 'confirmado sem alteração'
              : 'novo valor'}
            )
          </span>
        </p>
      ) : (
        podeMovimentar && (
          <div className="flex flex-col gap-3">
            <Botao onClick={() => void confirmar()} carregando={aoContar.isPending}>
              <CheckCircle2 aria-hidden="true" className="size-4" />
              Confirmar — estoque está correto
            </Botao>

            <div className="text-texto-suave flex items-center gap-2 text-xs">
              <hr className="border-borda flex-1" />
              ou digite um valor novo
              <hr className="border-borda flex-1" />
            </div>

            <div className="flex items-end gap-2">
              <label className="flex-1 text-sm">
                <span className="text-texto-suave mb-1 block">
                  Quantidade
                </span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={quantidadeTexto}
                  onChange={(e) =>
                    setQuantidadeTexto(e.target.value.replace(/\D/g, ''))
                  }
                  className="border-borda bg-superficie min-h-11 w-full rounded-lg border-2 px-3 text-center tabular-nums"
                />
              </label>

              {ehPerfil && (
                <label className="flex-1 text-sm">
                  <span className="text-texto-suave mb-1 block">
                    Medida (mm)
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={comprimentoTexto}
                    onChange={(e) =>
                      setComprimentoTexto(e.target.value.replace(/\D/g, ''))
                    }
                    className="border-borda bg-superficie min-h-11 w-full rounded-lg border-2 px-3 text-center tabular-nums"
                  />
                </label>
              )}

              <Botao
                variante="secundaria"
                onClick={() => void salvarNovoValor()}
                carregando={aoContar.isPending}
              >
                Salvar
              </Botao>
            </div>
          </div>
        )
      )}

      {jaContado && !jaAplicado && podeMovimentar && (
        <Botao
          variante="contorno"
          className="mt-3 w-full"
          onClick={() => void aplicar()}
          carregando={aoAplicar.isPending}
        >
          Aplicar este item ao estoque
        </Botao>
      )}

      {erro && (
        <p role="alert" className="text-erro-700 mt-2 text-sm font-medium">
          {erro}
        </p>
      )}
    </li>
  )
}
