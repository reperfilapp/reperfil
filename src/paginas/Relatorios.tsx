import { useState } from 'react'
import { Download, FileSpreadsheet } from 'lucide-react'
import {
  useRelatorioEstoque,
  useRelatorioMovimentacoes,
  agrupar,
  type LinhaEstoque,
  type LinhaMovimentacao,
} from '@/dados/relatorios'
import { EstadoConsulta } from '@/componentes/EstadoConsulta'
import { CampoSelecao } from '@/componentes/ui/CampoSelecao'
import { Botao } from '@/componentes/ui/Botao'
import { gerarCsv, baixarCsv, nomeArquivoComData } from '@/lib/csv'
import { formatarComprimento } from '@/dominio/medidas'

/**
 * Relatórios exportáveis.
 *
 * A tela mostra um resumo agrupado — o suficiente para responder "onde está
 * meu alumínio parado?" sem sair do celular — e exporta o detalhe em CSV para
 * quem quiser cruzar no Excel.
 *
 * Sobras sem movimentação é o relatório que justifica o sistema: é ele que
 * mostra o dinheiro parado na prateleira.
 */

const METROS = (mm: number) => Number((mm / 1000).toFixed(2))

export default function Relatorios() {
  const estoque = useRelatorioEstoque()
  const [dias, setDias] = useState(30)
  const movimentacoes = useRelatorioMovimentacoes(dias)

  const linhas = estoque.data ?? []

  // Só o que ainda está no estoque conta para os resumos.
  const emEstoque = linhas.filter(
    (l) => l.status === 'disponivel' || l.status === 'reservada',
  )

  const porModelo = agrupar(
    emEstoque,
    (l) => `${l.modeloCodigo} — ${l.modeloDescricao}`,
    (l) => l.quantidade,
    (l) => l.quantidade * l.comprimentoMm,
  )

  const porAcabamento = agrupar(
    emEstoque,
    (l) => l.acabamentoNome,
    (l) => l.quantidade,
    (l) => l.quantidade * l.comprimentoMm,
  )

  const porLocal = agrupar(
    emEstoque,
    (l) => l.localizacaoCodigo,
    (l) => l.quantidade,
    (l) => l.quantidade * l.comprimentoMm,
  )

  const paradas = emEstoque
    .filter((l) => l.diasParado >= 90)
    .sort((a, b) => b.diasParado - a.diasParado)

  const descartes = (movimentacoes.data ?? []).filter(
    (m) => m.tipo === 'descarte',
  )

  function exportarEstoque() {
    baixarCsv(
      gerarCsv<LinhaEstoque>(linhas, [
        { cabecalho: 'Perfil', valor: (l) => l.modeloCodigo },
        { cabecalho: 'Descrição', valor: (l) => l.modeloDescricao },
        { cabecalho: 'Acabamento', valor: (l) => l.acabamentoNome },
        { cabecalho: 'Local', valor: (l) => l.localizacaoCodigo },
        { cabecalho: 'Comprimento (mm)', valor: (l) => l.comprimentoMm },
        { cabecalho: 'Comprimento (m)', valor: (l) => METROS(l.comprimentoMm) },
        { cabecalho: 'Quantidade', valor: (l) => l.quantidade },
        { cabecalho: 'Reservadas', valor: (l) => l.quantidadeReservada },
        {
          cabecalho: 'Metros totais',
          valor: (l) => METROS(l.quantidade * l.comprimentoMm),
        },
        { cabecalho: 'Situação', valor: (l) => l.status },
        { cabecalho: 'Dias no estoque', valor: (l) => l.diasParado },
      ]),
      nomeArquivoComData('estoque', new Date()),
    )
  }

  function exportarParadas() {
    baixarCsv(
      gerarCsv<LinhaEstoque>(paradas, [
        { cabecalho: 'Perfil', valor: (l) => l.modeloCodigo },
        { cabecalho: 'Acabamento', valor: (l) => l.acabamentoNome },
        { cabecalho: 'Local', valor: (l) => l.localizacaoCodigo },
        { cabecalho: 'Comprimento (mm)', valor: (l) => l.comprimentoMm },
        { cabecalho: 'Quantidade', valor: (l) => l.quantidade },
        { cabecalho: 'Dias parada', valor: (l) => l.diasParado },
      ]),
      nomeArquivoComData('sobras-paradas', new Date()),
    )
  }

  function exportarMovimentacoes(apenasDescartes: boolean) {
    const dados = apenasDescartes ? descartes : (movimentacoes.data ?? [])

    baixarCsv(
      gerarCsv<LinhaMovimentacao>(dados, [
        {
          cabecalho: 'Data',
          valor: (m) => new Date(m.data).toLocaleString('pt-BR'),
        },
        { cabecalho: 'Tipo', valor: (m) => m.tipo },
        { cabecalho: 'Sobra', valor: (m) => m.loteCodigo },
        { cabecalho: 'Perfil', valor: (m) => m.modeloCodigo },
        { cabecalho: 'Quantidade', valor: (m) => m.quantidade },
        { cabecalho: 'Comprimento (mm)', valor: (m) => m.comprimentoMm },
        { cabecalho: 'Responsável', valor: (m) => m.usuarioNome },
        { cabecalho: 'Justificativa', valor: (m) => m.justificativa },
      ]),
      nomeArquivoComData(
        apenasDescartes ? 'descartes' : 'movimentacoes',
        new Date(),
      ),
    )
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-6">
      <header className="mb-5 flex items-center gap-3">
        <FileSpreadsheet aria-hidden="true" className="text-acao-600 size-7" />
        <h1 className="text-2xl font-bold">Relatórios</h1>
      </header>

      <EstadoConsulta
        carregando={estoque.isPending}
        erro={estoque.error}
        vazio={linhas.length === 0}
        mensagemVazio="Nenhuma sobra cadastrada ainda."
        aoTentarNovamente={() => void estoque.refetch()}
      />

      {linhas.length > 0 && (
        <div className="flex flex-col gap-6">
          <Resumo
            titulo="Estoque por perfil"
            grupos={porModelo}
            aoExportar={exportarEstoque}
            rotuloExportacao="Exportar estoque completo"
          />

          <Resumo titulo="Por acabamento" grupos={porAcabamento} />

          <Resumo titulo="Por localização" grupos={porLocal} />

          {/* O relatório que mostra dinheiro parado na prateleira. */}
          <section>
            <h2 className="mb-2 font-semibold">
              Sobras paradas há mais de 90 dias
            </h2>

            {paradas.length === 0 ? (
              <p className="bg-superficie-2 text-texto-suave rounded-xl p-4 text-sm">
                Nenhuma peça parada há mais de 90 dias.
              </p>
            ) : (
              <>
                <div className="bg-atencao-50 text-atencao-700 mb-3 rounded-xl p-4">
                  <p className="text-2xl font-bold tabular-nums">
                    {paradas.reduce((t, p) => t + p.quantidade, 0)} peças
                  </p>
                  <p className="text-sm">
                    {formatarComprimento(
                      paradas.reduce(
                        (t, p) => t + p.quantidade * p.comprimentoMm,
                        0,
                      ),
                    )}{' '}
                    de alumínio sem uso
                  </p>
                </div>

                <ul className="mb-3 flex flex-col gap-1.5">
                  {paradas.slice(0, 5).map((p, i) => (
                    <li
                      key={`${p.modeloCodigo}-${i}`}
                      className="bg-superficie flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm"
                    >
                      <span className="min-w-0 truncate">
                        {p.modeloCodigo} · {p.acabamentoNome}
                      </span>
                      <span className="text-texto-suave shrink-0 tabular-nums">
                        {p.diasParado} dias
                      </span>
                    </li>
                  ))}
                </ul>

                <Botao variante="contorno" onClick={exportarParadas}>
                  <Download aria-hidden="true" className="size-4" />
                  Exportar sobras paradas
                </Botao>
              </>
            )}
          </section>

          {/* Movimentações do período */}
          <section>
            <h2 className="mb-2 font-semibold">Movimentações</h2>

            <CampoSelecao
              rotulo="Período"
              value={String(dias)}
              onChange={(e) => setDias(Number(e.target.value))}
              className="mb-3"
            >
              <option value="7">Últimos 7 dias</option>
              <option value="30">Últimos 30 dias</option>
              <option value="90">Últimos 90 dias</option>
              <option value="365">Último ano</option>
            </CampoSelecao>

            <EstadoConsulta
              carregando={movimentacoes.isPending}
              erro={movimentacoes.error}
              vazio={(movimentacoes.data?.length ?? 0) === 0}
              mensagemVazio="Nenhuma movimentação no período."
              aoTentarNovamente={() => void movimentacoes.refetch()}
            />

            {(movimentacoes.data?.length ?? 0) > 0 && (
              <div className="flex flex-col gap-3">
                <p className="text-texto-suave text-sm">
                  {movimentacoes.data?.length} movimentações, das quais{' '}
                  {descartes.length}{' '}
                  {descartes.length === 1 ? 'descarte' : 'descartes'}.
                </p>

                <div className="flex flex-wrap gap-2">
                  <Botao
                    variante="contorno"
                    onClick={() => exportarMovimentacoes(false)}
                  >
                    <Download aria-hidden="true" className="size-4" />
                    Exportar movimentações
                  </Botao>

                  {descartes.length > 0 && (
                    <Botao
                      variante="contorno"
                      onClick={() => exportarMovimentacoes(true)}
                    >
                      <Download aria-hidden="true" className="size-4" />
                      Só descartes
                    </Botao>
                  )}
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function Resumo({
  titulo,
  grupos,
  aoExportar,
  rotuloExportacao,
}: {
  titulo: string
  grupos: { grupo: string; pecas: number; milimetros: number }[]
  aoExportar?: () => void
  rotuloExportacao?: string
}) {
  return (
    <section>
      <h2 className="mb-2 font-semibold">{titulo}</h2>

      <ul className="mb-3 flex flex-col gap-1.5">
        {grupos.map((g) => (
          <li
            key={g.grupo}
            className="bg-superficie flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm"
          >
            <span className="min-w-0 truncate">{g.grupo}</span>
            <span className="shrink-0 text-right">
              <span className="block font-semibold tabular-nums">
                {formatarComprimento(g.milimetros)}
              </span>
              <span className="text-texto-suave text-xs">
                {g.pecas} {g.pecas === 1 ? 'peça' : 'peças'}
              </span>
            </span>
          </li>
        ))}
      </ul>

      {aoExportar && (
        <Botao variante="contorno" onClick={aoExportar}>
          <Download aria-hidden="true" className="size-4" />
          {rotuloExportacao}
        </Botao>
      )}
    </section>
  )
}
