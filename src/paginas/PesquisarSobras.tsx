import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Search,
  CheckCircle2,
  AlertTriangle,
  PackageCheck,
  Scissors,
} from 'lucide-react'
import { useSobras } from '@/dados/sobras'
import { useAcabamentos } from '@/dados/acabamentos'
import { useConfiguracoes, paraConfiguracaoCorte } from '@/dados/configuracoes'
import { useReservarSobra } from '@/dados/reservas'
import { useCapasDesenhos } from '@/dados/desenhosTecnicos'
import { SEM_LINHA } from '@/dados/modelosPerfil'
import { MiniaturaPerfil } from '@/componentes/MiniaturaPerfil'
import { CampoMedida } from '@/componentes/ui/CampoMedida'
import { CampoSelecao } from '@/componentes/ui/CampoSelecao'
import { Botao } from '@/componentes/ui/Botao'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { AmostraCor } from '@/componentes/ui/AmostraCor'
import {
  pesquisarSobras,
  classificarAproveitamento,
  type CandidataSobra,
} from '@/dominio/pesquisa'
import {
  formatarComprimento,
  interpretarMedidaDigitada,
} from '@/dominio/medidas'
import { CONFIGURACAO_CORTE_PADRAO } from '@/dominio/corte'
import { cn } from '@/lib/utilitarios'
import type { UnidadeMedida } from '@/config/aplicacao'
import { formatarMedidasSecao } from '@/dominio/secao'

/**
 * Pesquisa de sobras para um corte.
 *
 * A pergunta que a tela responde é a do serralheiro no chão da oficina: "eu
 * preciso de N cortes de X mm, deste perfil, nesta cor — tem alguma ponta
 * que serve?".
 *
 * ── Semântica de quantidade ──────────────────────────────────────────────
 *
 * O usuário informa QUANTOS CORTES precisa e com qual comprimento.
 * O sistema calcula quantas PEÇAS FÍSICAS do lote serão necessárias:
 *
 * Exemplo: "5 cortes de 1 m" de um lote com peças de 6 m
 *   → 1 peça de 6 m comporta 5 cortes (5×1000 + 4×3 = 5012 mm < 6000 mm)
 *   → reserva apenas 1 peça do lote, não 5
 */

interface CandidataComDados extends CandidataSobra {
  modeloId: string
  modeloCodigo: string
  modeloDescricao: string
  modeloLinha: string | null
  modeloObj: any // Tipo flexível para aceitar as junções do Supabase
  acabamentoNome: string
  acabamentoCor: string | null
  quantidadeTotal: number
}

export default function PesquisarSobras() {
  const { data: sobras, isPending } = useSobras()
  const { data: acabamentos } = useAcabamentos()
  const { data: config } = useConfiguracoes()
  const reservar = useReservarSobra()
  const { data: capas } = useCapasDesenhos('imagem')

  const [linhasSelecionadas, setLinhasSelecionadas] = useState<string[]>([])
  const [buscaExecutada, setBuscaExecutada] = useState(false)
  
  const [acabamentoId, setAcabamentoId] = useState('')
  const [textoMedida, setTextoMedida] = useState('')
  const [unidade, setUnidade] = useState<UnidadeMedida>('mm')
  const [quantidadeCortes, setQuantidadeCortes] = useState(1)
  const [reservadaCodigo, setReservadaCodigo] = useState<string | null>(null)
  const [reservadaInfo, setReservadaInfo] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const corteMm = interpretarMedidaDigitada(textoMedida, unidade)
  const configCorte = config
    ? paraConfiguracaoCorte(config)
    : CONFIGURACAO_CORTE_PADRAO

  const podePesquisar =
    corteMm !== null && corteMm > 0

  const linhasDisponiveis = useMemo(() => {
    if (!sobras) return []
    const linhas = new Set<string>()
    for (const s of sobras) {
      if (s.status === 'disponivel' && s.quantidade - s.quantidade_reservada > 0) {
        linhas.add(s.modelo?.linha?.trim() || SEM_LINHA)
      }
    }
    return Array.from(linhas).sort((a, b) => {
      if (a === SEM_LINHA) return 1
      if (b === SEM_LINHA) return -1
      return a.localeCompare(b, 'pt-BR')
    })
  }, [sobras])

  const candidatasSemFiltroAcabamento = useMemo(() => {
    return (sobras ?? []).filter((s) => {
      const disponivel = s.status === 'disponivel' && s.quantidade - s.quantidade_reservada > 0
      if (!disponivel) return false
      const linha = s.modelo?.linha?.trim() || SEM_LINHA
      return linhasSelecionadas.length === 0 || linhasSelecionadas.includes(linha)
    })
  }, [sobras, linhasSelecionadas])

  const candidatas: CandidataComDados[] = candidatasSemFiltroAcabamento
    .filter((s) => acabamentoId === '' || s.acabamento_id === acabamentoId)
    .map((s) => ({
      id: s.id,
      codigo: s.codigo,
      comprimentoMm: s.comprimento_mm,
      quantidadeDisponivel: s.quantidade - s.quantidade_reservada,
      quantidadeTotal: s.quantidade,
      acabamentoId: s.acabamento_id,
      localizacaoCodigo: s.localizacao?.codigo ?? null,
      criadoEm: s.criado_em,
      modeloId: s.modelo_perfil_id,
      modeloCodigo: s.modelo?.codigo ?? '',
      modeloDescricao: s.modelo?.descricao ?? '',
      modeloLinha: s.modelo?.linha ?? null,
      modeloObj: s.modelo ?? null,
      acabamentoNome: s.acabamento?.nome ?? '',
      acabamentoCor: s.acabamento?.cor_hex ?? null,
    }))

  const acabamentosDisponiveisIds = new Set(
    candidatasSemFiltroAcabamento.map((s) => s.acabamento_id)
  )

  const opcoesAcabamento = acabamentos?.filter((a) => acabamentosDisponiveisIds.has(a.id))

  // Só pesquisa quando não há reserva confirmada (evita mensagem contraditória).
  const achados =
    podePesquisar && buscaExecutada && !reservadaCodigo
      ? pesquisarSobras(
          candidatas,
          { corteMm, acabamentoId, quantidadeCortes },
          configCorte,
        )
      : []

  async function reservarPeca(
    loteId: string,
    codigo: string,
    pecasNecessarias: number,
  ) {
    setErro(null)

    try {
      await reservar.mutateAsync({
        loteId,
        // Reserva apenas as peças físicas necessárias do lote, não a quantidade de cortes.
        quantidade: pecasNecessarias,
        comprimentoCorteMm: corteMm ?? null,
        quantidadeCortes,
      })
      setReservadaCodigo(codigo)
      // Mensagem clara: quantos cortes de que tamanho, usando quantas peças.
      setReservadaInfo(
        pecasNecessarias === 1
          ? `${quantidadeCortes} ${quantidadeCortes === 1 ? 'corte' : 'cortes'} de ${formatarComprimento(corteMm!)} a partir de 1 peça do lote ${codigo}`
          : `${quantidadeCortes} ${quantidadeCortes === 1 ? 'corte' : 'cortes'} de ${formatarComprimento(corteMm!)} a partir de ${pecasNecessarias} peças do lote ${codigo}`,
      )
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível reservar.')
    }
  }

  function aoCancelar() {
    setBuscaExecutada(false)
    setReservadaCodigo(null)
    setReservadaInfo(null)
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-6">
      <header className="mb-5 flex items-center gap-3">
        {buscaExecutada ? (
          <BotaoVoltar rotulo="Nova reserva" onClick={aoCancelar} />
        ) : (
          <BotaoVoltar para="/" rotulo="Início" />
        )}
        <h1 className="text-2xl font-bold">Procurar material</h1>
      </header>

      {config && !config.confirmado_pelo_administrador && (
        <p className="bg-atencao-50 text-atencao-700 mb-5 rounded-xl p-4 text-sm">
          <strong>Atenção:</strong> a espessura da serra ainda é um valor
          presumido. O cálculo de aproveitamento abaixo pode estar errado.
        </p>
      )}

      {!buscaExecutada && (
        <div className="mb-6 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className="font-medium">Linhas (opcional)</label>
            <p className="text-texto-suave text-xs">
              Selecione uma ou mais linhas. Deixe em branco para procurar em todas.
            </p>
            {isPending && (!sobras || (sobras as any[]).length === 0) ? (
              <p className="text-texto-suave text-sm mt-2">Carregando estoque...</p>
            ) : linhasDisponiveis.length === 0 ? (
              <p className="text-texto-suave text-sm mt-2">Nenhum material disponível no estoque.</p>
            ) : (
              <div className="flex flex-wrap gap-2 mt-2">
                {linhasDisponiveis.map(linha => {
                  const selecionada = linhasSelecionadas.includes(linha)
                  return (
                    <button
                      key={linha}
                      type="button"
                      onClick={() => {
                        setBuscaExecutada(false)
                        setLinhasSelecionadas(prev => 
                          selecionada ? prev.filter(l => l !== linha) : [...prev, linha]
                        )
                      }}
                      className={cn(
                        "rounded-full px-3 py-1.5 text-sm font-medium border-2 transition-colors",
                        selecionada 
                          ? "bg-acao-600 border-acao-600 text-white" 
                          : "bg-superficie border-borda text-texto-suave hover:bg-superficie-2"
                      )}
                    >
                      {linha === SEM_LINHA ? 'Sem linha' : linha}
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <CampoSelecao
            rotulo="Cor ou acabamento (opcional)"
            value={acabamentoId}
            onChange={(e) => {
              setAcabamentoId(e.target.value)
              setBuscaExecutada(false)
            }}
          >
            <option value="">Todas as cores e acabamentos</option>
            {opcoesAcabamento?.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nome}
              </option>
            ))}
          </CampoSelecao>

          <CampoMedida
            rotulo="Comprimento de cada corte"
            texto={textoMedida}
            unidade={unidade}
            aoMudarTexto={(t) => {
              setTextoMedida(t)
              setBuscaExecutada(false)
            }}
            aoMudarUnidade={(u) => {
              setUnidade(u)
              setBuscaExecutada(false)
            }}
          />

          <div>
            <p className="mb-1 font-medium">Quantos cortes?</p>
            <p className="text-texto-suave mb-2 text-xs">
              Número de peças do tamanho acima que você precisa produzir.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setQuantidadeCortes((q) => Math.max(1, q - 1))
                  setBuscaExecutada(false)
                }}
                aria-label="Diminuir quantidade de cortes"
                className="border-destaque-borda bg-destaque text-destaque-texto hover:bg-destaque-hover min-h-16 w-16 shrink-0 rounded-xl border-2 text-2xl font-bold"
              >
                −
              </button>
              <input
                type="text"
                inputMode="numeric"
                value={quantidadeCortes}
                onChange={(e) => {
                  const n = Number(e.target.value.replace(/\D/g, ''))
                  setQuantidadeCortes(Number.isFinite(n) && n >= 1 ? n : 1)
                  setBuscaExecutada(false)
                }}
                aria-label="Quantidade de cortes"
                className="border-borda bg-superficie min-h-16 min-w-0 flex-1 rounded-xl border-2 text-center text-2xl font-semibold tabular-nums"
              />
              <button
                type="button"
                onClick={() => {
                  setQuantidadeCortes((q) => Math.min(999, q + 1))
                  setBuscaExecutada(false)
                }}
                aria-label="Aumentar quantidade de cortes"
                className="border-destaque-borda bg-destaque text-destaque-texto hover:bg-destaque-hover min-h-16 w-16 shrink-0 rounded-xl border-2 text-2xl font-bold"
              >
                +
              </button>
            </div>
          </div>
          
          <Botao
            className="w-full h-12 text-base font-semibold"
            disabled={!podePesquisar || isPending}
            onClick={() => setBuscaExecutada(true)}
          >
            <Search aria-hidden="true" className="size-5" />
            Buscar materiais
          </Botao>
        </div>
      )}

      {reservadaCodigo && (
        <div
          role="status"
          className="bg-aluminio-100 text-grafite-800 mb-5 flex items-start gap-3 rounded-xl p-4"
        >
          <PackageCheck aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
          <div className="text-sm">
            <p className="font-semibold">Reserva confirmada!</p>
            <p>{reservadaInfo}</p>
            <p className="text-texto-suave mt-1">
              Veja em <strong>Reservas</strong> para confirmar a retirada e o corte.
            </p>
          </div>
        </div>
      )}

      {erro && (
        <p
          role="alert"
          className="bg-erro-50 text-erro-700 mb-5 rounded-xl px-4 py-3"
        >
          {erro}
        </p>
      )}

      {podePesquisar && buscaExecutada && !reservadaCodigo && (
        <section aria-live="polite">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Resultados</h2>
            <span className="bg-superficie-2 text-texto-suave min-w-8 rounded-full px-2.5 py-0.5 text-center text-sm font-semibold tabular-nums">
              {achados.length === 0
                ? 'Nenhum material serve'
                : `${achados.length} ${achados.length === 1 ? 'material serve' : 'materiais servem'}`}
            </span>
          </div>

          {achados.length === 0 && (
            <div className="bg-superficie-2 text-texto-suave rounded-xl p-5 text-sm">
              <p className="mb-2">
                Nenhuma peça de perfil compatível comporta{' '}
                {quantidadeCortes > 1
                  ? `${quantidadeCortes} cortes de ${formatarComprimento(corteMm)}`
                  : `1 corte de ${formatarComprimento(corteMm)}`}
                .
              </p>
              <p>
                O sistema não sugere material de acabamento diferente — duas peças
                da mesma cor, de lotes de pintura distintos, ficam visivelmente
                diferentes na mesma esquadria.
              </p>
            </div>
          )}

          <ul className="flex flex-col gap-3">
            {achados.map((resultado) => {
              const aproveitamento = classificarAproveitamento(resultado)
              const s = resultado.sobra as CandidataComDados

              return (
                <li
                  key={s.id}
                  className="bg-superficie rounded-xl p-4 shadow-sm"
                >
                  <div className="mb-3 flex items-start gap-3">
                    <div className="shrink-0 flex flex-col items-center gap-1.5 w-[4.5rem]">
                      <div className="w-[4.5rem] h-[4.5rem] flex items-center justify-center border border-borda rounded-lg bg-white">
                        {capas?.get(s.modeloId) ? (
                          <img
                            src={capas.get(s.modeloId)!}
                            alt={s.modeloCodigo}
                            className="max-w-[3.5rem] max-h-[3.5rem] object-contain"
                          />
                        ) : (
                          <MiniaturaPerfil
                            link={null}
                            codigo={s.modeloCodigo}
                          />
                        )}
                      </div>
                      <span className="bg-aluminio-200 text-grafite-900 rounded-md px-1.5 py-0.5 text-[0.65rem] font-semibold leading-tight">
                        disponível
                      </span>
                    </div>

                    <Link
                      to={`/sobras/${s.id}`}
                      className="flex min-w-0 flex-1 flex-col gap-0.5"
                      aria-label={`Ver detalhes do material ${s.codigo}`}
                    >
                      <p className="text-[15px] leading-snug">
                        <strong className="text-acao-600 font-mono text-lg font-bold">{s.modeloCodigo}</strong>
                        <span className="font-bold"> — {s.modeloDescricao}</span>
                      </p>
                      <p className="text-xs text-texto-suave">
                        {s.modeloObj && formatarMedidasSecao(s.modeloObj)
                          ? `Medida: ${formatarMedidasSecao(s.modeloObj)}`
                          : `Medida: ----`}
                      </p>
                      <hr className="border-borda my-1" />
                      <div className="flex items-center gap-x-3 text-xs mt-0.5">
                        <span>
                          Qt. Peças:{' '}
                          <strong className="text-acao-600 font-bold">
                            {String(s.quantidadeDisponivel).padStart(2, '0')}
                          </strong>
                        </span>
                        <span>
                          Med.:{' '}
                          <strong className="text-acao-600 font-bold">
                            {formatarComprimento(s.comprimentoMm)}
                          </strong>
                        </span>
                      </div>
                      <div className="flex items-center gap-1 text-xs min-w-0 mt-0.5">
                        <span className="shrink-0">Acab.:</span>
                        <AmostraCor corHex={s.acabamentoCor} tamanho="pequeno" />
                        <strong className="text-acao-600 font-bold truncate">
                          {s.acabamentoNome}
                        </strong>
                      </div>
                    </Link>
                  </div>

                  <div className="bg-superficie-2 mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
                    <Scissors aria-hidden="true" className="text-texto-suave size-4 shrink-0" />
                    <span>
                      {resultado.pecasNecessarias === 1
                        ? `1 peça deste lote basta para ${quantidadeCortes} ${quantidadeCortes === 1 ? 'corte' : 'cortes'} de ${formatarComprimento(corteMm!)}`
                        : `${resultado.pecasNecessarias} peças deste lote para ${quantidadeCortes} cortes de ${formatarComprimento(corteMm!)}`}
                    </span>
                  </div>

                  <div
                    className={`mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                      aproveitamento === 'gera-descarte'
                        ? 'bg-atencao-50 text-atencao-700'
                        : 'bg-aluminio-100 text-grafite-800'
                    }`}
                  >
                    {aproveitamento === 'gera-descarte' ? (
                      <AlertTriangle aria-hidden="true" className="size-4" />
                    ) : (
                      <CheckCircle2 aria-hidden="true" className="size-4" />
                    )}
                    <span>
                      {aproveitamento === 'exato' &&
                        'A peça é consumida por inteiro, sem desperdício.'}
                      {aproveitamento === 'ideal' &&
                        `Sobram ${formatarComprimento(resultado.sobraResultanteMm)} da primeira peça — volta ao estoque.`}
                      {aproveitamento === 'gera-descarte' &&
                        `Sobram ${formatarComprimento(resultado.sobraResultanteMm)} — vira descarte.`}
                    </span>
                  </div>

                  <Botao
                    tamanho="largura_total"
                    carregando={reservar.isPending}
                    onClick={() =>
                      void reservarPeca(s.id, s.codigo, resultado.pecasNecessarias)
                    }
                  >
                    {resultado.pecasNecessarias === 1
                      ? `Reservar 1 peça (${quantidadeCortes} ${quantidadeCortes === 1 ? 'corte' : 'cortes'} de ${formatarComprimento(corteMm!)})`
                      : `Reservar ${resultado.pecasNecessarias} peças (${quantidadeCortes} cortes de ${formatarComprimento(corteMm!)})`}
                  </Botao>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {(!podePesquisar || !buscaExecutada) && !reservadaCodigo && (
        <p className="bg-superficie-2 text-texto-suave rounded-xl p-5 text-center text-sm">
          {podePesquisar
            ? 'Clique em "Buscar sobras" para ver as peças disponíveis.'
            : 'Informe o comprimento do corte para buscar.'}
        </p>
      )}
    </div>
  )
}
