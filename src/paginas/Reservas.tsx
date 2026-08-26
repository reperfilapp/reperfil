import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Clock,
  PackageOpen,
  Scissors,
  X,
  MapPin,
  ChevronRight,
} from 'lucide-react'
import {
  useReservas,
  useCancelarReserva,
  useConfirmarRetirada,
  useConfirmarCorte,
  type ReservaDetalhada,
} from '@/dados/reservas'
import { useConfiguracoes, paraConfiguracaoCorte } from '@/dados/configuracoes'
import { Botao } from '@/componentes/ui/Botao'
import { Modal } from '@/componentes/ui/Modal'
import { PaginaLista } from '@/componentes/ui/PaginaLista'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { AmostraCor } from '@/componentes/ui/AmostraCor'
import { CampoMedida } from '@/componentes/ui/CampoMedida'
import { EstadoConsulta } from '@/componentes/EstadoConsulta'
import {
  formatarComprimento,
  interpretarMedidaDigitada,
} from '@/dominio/medidas'
import {
  planejarCorte,
  distribuirCortes,
  CONFIGURACAO_CORTE_PADRAO,
} from '@/dominio/corte'
import type { UnidadeMedida } from '@/config/aplicacao'
import { disparar } from '@/lib/avisoErro'

/**
 * Reservas em aberto e o encerramento do ciclo.
 *
 * O fluxo é reservar → retirar → cortar. Cada passo existe porque marca um
 * momento físico diferente: a peça está guardada mas prometida; a peça saiu
 * da prateleira; a peça foi cortada e o resto voltou (ou virou descarte).
 *
 * Emendar retirada e corte num passo só pareceria mais simples, mas perderia
 * a informação de onde a peça está quando alguém a procura — que é
 * exatamente o problema que o sistema existe para resolver.
 */
export default function Reservas() {
  const { data: reservas, isPending, error, refetch } = useReservas(true)
  const { data: config } = useConfiguracoes()
  const cancelar = useCancelarReserva()
  const retirar = useConfirmarRetirada()
  const cortar = useConfirmarCorte()

  const [cortando, setCortando] = useState<ReservaDetalhada | null>(null)
  const [cancelando, setCancelando] = useState<ReservaDetalhada | null>(null)
  const [motivo, setMotivo] = useState('')
  const [textoUsado, setTextoUsado] = useState('')
  const [unidade, setUnidade] = useState<UnidadeMedida>('mm')
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<string | null>(null)

  const configCorte = config
    ? paraConfiguracaoCorte(config)
    : CONFIGURACAO_CORTE_PADRAO

  const usadoMm = interpretarMedidaDigitada(textoUsado, unidade)

  // Prévia do que vai acontecer com o resto, com os números reais da oficina.
  const previa =
    cortando?.lote && usadoMm !== null && usadoMm > 0
      ? planejarCorte(cortando.lote.comprimento_mm, [usadoMm], configCorte)
      : null

  /*
   * O resto de CADA grupo de peças desta reserva.
   *
   * Enche-se uma peça até o limite antes de abrir a próxima, então a última
   * quase nunca leva a mesma quantidade de cortes — e termina com um resto
   * bem maior. Mandar um número só para todas gravava o resto da primeira
   * peça na última, e a diferença sumia do estoque.
   *
   * Só vale quando a reserva guarda o plano de corte. As antigas eram "N
   * peças, um corte em cada", e ali todas terminam iguais mesmo.
   */
  const grupos =
    cortando?.lote &&
    cortando.comprimento_corte_mm !== null &&
    cortando.quantidade_cortes !== null
      ? distribuirCortes(
          cortando.lote.comprimento_mm,
          cortando.comprimento_corte_mm,
          cortando.quantidade_cortes,
          configCorte,
        )
      : []

  /*
   * Só manda a lista quando ela descreve exatamente as peças reservadas. Se
   * discordar — reserva antiga, plano alterado depois — cai no caminho de um
   * resto só, que é o comportamento de sempre, em vez de recusar o corte.
   */
  const pecasNosGrupos = grupos.reduce((total, g) => total + g.pecas, 0)
  const restosPorPeca =
    cortando !== null &&
    pecasNosGrupos === cortando.quantidade &&
    grupos.length > 1
      ? grupos.map((g) => ({
          comprimento_mm: g.restoMm,
          quantidade: g.pecas,
        }))
      : undefined

  /**
   * Calcula o comprimento total a cortar desta peça física com base nos dados
   * da reserva: quantidadeCortes × (comprimentoCorte + espessuraSerra) menos
   * a última passada de serra (o último corte não gera perda quando termina
   * no fim do material aproveitado).
   *
   * Este valor é uma sugestão — o serralheiro pode ajustar se necessário.
   */
  function calcularConsumoSugerido(reserva: ReservaDetalhada): number | null {
    if (
      reserva.comprimento_corte_mm === null ||
      reserva.quantidade_cortes === null
    ) {
      return null
    }

    const n = reserva.quantidade_cortes
    const corte = reserva.comprimento_corte_mm
    const serra = configCorte.espessuraSerraMm

    // n cortes + (n-1) serras entre eles (o último corte não precisa separar nada)
    return n * corte + (n - 1) * serra
  }

  function abrirModalCorte(reserva: ReservaDetalhada) {
    const sugerido = calcularConsumoSugerido(reserva)
    setCortando(reserva)
    setErro(null)

    if (sugerido !== null && sugerido > 0) {
      // Pré-preenche em mm para não perder precisão na conversão.
      setTextoUsado(String(sugerido))
      setUnidade('mm')
    } else {
      setTextoUsado('')
    }
  }

  async function confirmarCorte() {
    if (!cortando || usadoMm === null || !previa?.cabe) return

    setErro(null)

    try {
      const r = await cortar.mutateAsync({
        reservaId: cortando.id,
        comprimentoUtilizadoMm: usadoMm,
        comprimentoRestanteMm: previa.restoMm,
        restos: restosPorPeca,
      })

      /*
       * Com mais de uma sobra gerada, cada uma é nomeada com o seu próprio
       * comprimento e código: são peças diferentes na prateleira, e quem vai
       * guardá-las precisa saber qual é qual.
       */
      const geradas = r.sobras_geradas ?? []

      setResultado(
        geradas.length > 1
          ? `Corte registrado. Voltaram ao estoque: ${geradas
              .map(
                (sobra) =>
                  `${sobra.quantidade} × ${formatarComprimento(sobra.comprimento_mm)} (${sobra.codigo})`,
              )
              .join(' e ')}.`
          : r.destino_resto === 'sobra'
            ? `Corte registrado. Sobrou ${formatarComprimento(r.comprimento_restante_mm)}, cadastrada como ${r.lote_resultante_codigo}.`
            : r.destino_resto === 'descarte'
              ? `Corte registrado. O resto de ${formatarComprimento(r.comprimento_restante_mm)} foi lançado como descarte.`
              : 'Corte registrado. A peça foi consumida por inteiro.',
      )

      setCortando(null)
      setTextoUsado('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível registrar.')
    }
  }

  async function confirmarCancelamento() {
    if (!cancelando) return

    setErro(null)

    try {
      await cancelar.mutateAsync({
        reservaId: cancelando.id,
        motivo: motivo.trim() === '' ? 'Sem motivo informado' : motivo.trim(),
      })
      setCancelando(null)
      setMotivo('')
      setResultado('Reserva cancelada. A peça voltou para o estoque.')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível cancelar.')
    }
  }

  function venceEm(reserva: ReservaDetalhada): string {
    const restanteMs = new Date(reserva.expira_em).getTime() - Date.now()

    if (restanteMs <= 0) return 'vencida'

    const horas = Math.floor(restanteMs / 3_600_000)

    if (horas < 1) return 'vence em menos de 1 h'
    if (horas < 24) return `vence em ${horas} h`

    return `vence em ${Math.floor(horas / 24)} dia(s)`
  }

  /**
   * Linha descritiva da reserva:
   * - Reservas novas: "5 cortes de 1 m (1 peça separada)"
   * - Reservas antigas (sem dados de corte): "5 peças de 6 m"
   */
  function descricaoReserva(reserva: ReservaDetalhada): string {
    const temDadosCorte =
      reserva.comprimento_corte_mm !== null &&
      reserva.quantidade_cortes !== null

    if (temDadosCorte) {
      const cortes = reserva.quantidade_cortes!
      const tamanho = formatarComprimento(reserva.comprimento_corte_mm!)
      const pecas = reserva.quantidade
      return `${cortes} ${cortes === 1 ? 'corte' : 'cortes'} de ${tamanho} · ${pecas} ${pecas === 1 ? 'peça separada do lote' : 'peças separadas do lote'}`
    }

    // Compatibilidade com reservas antigas.
    const qtd = reserva.quantidade
    const comp = reserva.lote
      ? ` de ${formatarComprimento(reserva.lote.comprimento_mm)}`
      : ''
    return `${qtd} ${qtd === 1 ? 'peça' : 'peças'}${comp}`
  }

  return (
    <PaginaLista
      cabecalho={
        <>
          <BotaoVoltar para="/" rotulo="Início" className="mb-4" />

          <header className="mb-5 flex items-center gap-3">
            <Clock aria-hidden="true" className="text-acao-600 size-7" />
            <h1 className="text-2xl font-bold">Reservas</h1>
          </header>
        </>
      }
    >
      {resultado && (
        <p
          role="status"
          className="bg-aluminio-100 text-grafite-800 mb-5 rounded-xl px-4 py-3 text-sm"
        >
          {resultado}
        </p>
      )}

      {erro && (
        <p
          role="alert"
          className="bg-erro-50 text-erro-700 mb-5 rounded-xl px-4 py-3"
        >
          {erro}
        </p>
      )}

      <EstadoConsulta
        carregando={isPending}
        erro={error}
        vazio={reservas?.length === 0}
        mensagemVazio="Nenhuma reserva em aberto."
        aoTentarNovamente={() => void refetch()}
      />

      <ul className="flex flex-col gap-3">
        {reservas?.map((reserva) => (
          <li
            key={reserva.id}
            className="bg-celula border-borda rounded-xl border-2 p-4 shadow-sm"
          >
            <div className="mb-2 flex items-start justify-between gap-3">
              <Link
                to={`/sobras/${reserva.lote_id}`}
                className="flex min-w-0 items-center gap-2"
                aria-label={`Ver detalhes do material ${reserva.lote?.codigo}`}
              >
                <span className="min-w-0">
                  <span className="block font-mono font-bold">
                    Lote {reserva.lote?.codigo}
                  </span>
                  <span className="block flex items-center gap-1 truncate text-sm">
                    {reserva.lote?.modelo?.codigo} ·{' '}
                    <AmostraCor
                      corHex={reserva.lote?.acabamento?.cor_hex ?? null}
                      nome={reserva.lote?.acabamento?.nome ?? ''}
                    />
                  </span>
                  {reserva.lote?.localizacao && (
                    <span className="text-texto-suave flex items-center gap-1 text-sm">
                      <MapPin aria-hidden="true" className="size-3.5" />
                      {reserva.lote.localizacao.codigo}
                    </span>
                  )}
                </span>
                <ChevronRight
                  aria-hidden="true"
                  className="text-texto-suave size-4 shrink-0"
                />
              </Link>

              <div className="shrink-0 text-right">
                <p className="text-lg font-bold tabular-nums">
                  {reserva.lote &&
                    formatarComprimento(reserva.lote.comprimento_mm)}
                </p>
                <span
                  className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                    reserva.status === 'retirada'
                      ? 'bg-acao-100 text-acao-700'
                      : 'bg-atencao-100 text-atencao-700'
                  }`}
                >
                  {reserva.status === 'retirada' ? 'retirada' : 'reservada'}
                </span>
              </div>
            </div>

            {/* Descrição clara do que foi reservado e do que será cortado */}
            <p className="text-texto-suave mb-3 text-xs">
              {descricaoReserva(reserva)} · {venceEm(reserva)}
            </p>

            <div className="flex flex-wrap gap-2">
              {reserva.status === 'ativa' && (
                <Botao
                  variante="secundaria"
                  onClick={() => disparar(retirar.mutateAsync(reserva.id))}
                  className="flex-1"
                >
                  <PackageOpen aria-hidden="true" className="size-4" />
                  Retirei a peça
                </Botao>
              )}

              <Botao
                onClick={() => abrirModalCorte(reserva)}
                className="flex-1"
              >
                <Scissors aria-hidden="true" className="size-4" />
                Confirmar corte
              </Botao>

              <Botao
                variante="contorno"
                onClick={() => {
                  setCancelando(reserva)
                  setMotivo('')
                  setErro(null)
                }}
                aria-label="Cancelar reserva"
              >
                <X aria-hidden="true" className="size-4" />
              </Botao>
            </div>
          </li>
        ))}
      </ul>

      {/* Confirmação de corte */}
      <Modal
        aberto={cortando !== null}
        aoFechar={() => setCortando(null)}
        titulo="Confirmar corte"
      >
        {cortando?.lote && (
          <div className="flex flex-col gap-4">
            {/* Resumo do que foi reservado */}
            <div className="bg-superficie-2 rounded-xl p-3 text-sm">
              <p className="mb-1 font-semibold">O que foi reservado</p>
              {cortando.comprimento_corte_mm !== null &&
              cortando.quantidade_cortes !== null ? (
                <p>
                  <strong>{cortando.quantidade_cortes}</strong>{' '}
                  {cortando.quantidade_cortes === 1 ? 'corte' : 'cortes'} de{' '}
                  <strong>
                    {formatarComprimento(cortando.comprimento_corte_mm)}
                  </strong>{' '}
                  — usando <strong>{cortando.quantidade}</strong>{' '}
                  {cortando.quantidade === 1 ? 'peça' : 'peças'} de{' '}
                  <strong>
                    {formatarComprimento(cortando.lote.comprimento_mm)}
                  </strong>{' '}
                  do lote{' '}
                  <span className="font-mono">{cortando.lote.codigo}</span>.
                </p>
              ) : (
                <p>
                  Lote{' '}
                  <strong className="font-mono">{cortando.lote.codigo}</strong>{' '}
                  ({cortando.quantidade}{' '}
                  {cortando.quantidade === 1 ? 'peça' : 'peças'} de{' '}
                  {formatarComprimento(cortando.lote.comprimento_mm)}).
                </p>
              )}
            </div>

            <div>
              <CampoMedida
                rotulo="Comprimento total a consumir desta peça"
                texto={textoUsado}
                unidade={unidade}
                aoMudarTexto={setTextoUsado}
                aoMudarUnidade={setUnidade}
                autoFocus={
                  cortando.comprimento_corte_mm === null // só auto-foca quando não há pré-preenchimento
                }
              />
              {cortando.comprimento_corte_mm !== null &&
                cortando.quantidade_cortes !== null && (
                  <p className="text-texto-suave mt-1.5 text-xs">
                    Valor sugerido: {cortando.quantidade_cortes} ×{' '}
                    {formatarComprimento(cortando.comprimento_corte_mm)} +{' '}
                    {cortando.quantidade_cortes - 1} ×{' '}
                    {formatarComprimento(configCorte.espessuraSerraMm)} (serra)
                    ={' '}
                    <strong>
                      {formatarComprimento(
                        calcularConsumoSugerido(cortando) ?? 0,
                      )}
                    </strong>
                    . Ajuste se necessário.
                  </p>
                )}
            </div>

            {previa && !previa.cabe && (
              <p
                role="alert"
                className="bg-erro-50 text-erro-700 rounded-xl px-4 py-3 text-sm"
              >
                Este comprimento não cabe na peça. O máximo é{' '}
                {formatarComprimento(cortando.lote.comprimento_mm)}.
              </p>
            )}

            {previa?.cabe && (
              <div className="bg-superficie-2 rounded-xl p-4 text-sm">
                <p className="mb-1 font-semibold">
                  O que acontece ao confirmar
                </p>

                {/* Com os cortes espalhados por várias peças, a última leva
                    menos que as outras e sobra bem mais. Mostrar peça por peça
                    evita a surpresa de achar que todas rendem o mesmo — e é o
                    que de fato vai para o estoque. */}
                {restosPorPeca ? (
                  <ul className="flex flex-col gap-1">
                    {grupos.map((grupo, indice) => (
                      <li key={indice}>
                        {grupo.pecas} {grupo.pecas === 1 ? 'peça' : 'peças'} com{' '}
                        {grupo.cortesPorPeca}{' '}
                        {grupo.cortesPorPeca === 1 ? 'corte' : 'cortes'} →{' '}
                        {grupo.destinoResto === 'sobra' ? (
                          <>
                            sobra{' '}
                            <strong>
                              {formatarComprimento(grupo.restoMm)}
                            </strong>
                          </>
                        ) : grupo.destinoResto === 'descarte' ? (
                          <span className="text-atencao-700">
                            resto de {formatarComprimento(grupo.restoMm)} vira
                            descarte
                          </span>
                        ) : (
                          'consumida por inteiro'
                        )}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {!restosPorPeca && previa.destinoResto === 'sem-resto' && (
                  <p>A peça é consumida por inteiro.</p>
                )}
                {!restosPorPeca && previa.destinoResto === 'sobra' && (
                  <p>
                    Sobram{' '}
                    <strong>{formatarComprimento(previa.restoMm)}</strong>, que
                    voltam ao estoque como um material novo, com código próprio.
                  </p>
                )}
                {!restosPorPeca && previa.destinoResto === 'descarte' && (
                  <p className="text-atencao-700">
                    Sobram {formatarComprimento(previa.restoMm)}, abaixo do
                    mínimo aproveitável — será lançado como{' '}
                    <strong>descarte</strong>.
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <Botao
                variante="contorno"
                onClick={() => setCortando(null)}
                className="flex-1"
              >
                Cancelar
              </Botao>
              <Botao
                onClick={() => void confirmarCorte()}
                disabled={!previa?.cabe}
                carregando={cortar.isPending}
                className="flex-1"
              >
                Confirmar
              </Botao>
            </div>
          </div>
        )}
      </Modal>

      {/* Cancelamento */}
      <Modal
        aberto={cancelando !== null}
        aoFechar={() => setCancelando(null)}
        titulo="Cancelar reserva"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            O lote{' '}
            <strong className="font-mono">{cancelando?.lote?.codigo}</strong>{' '}
            volta para o estoque e fica disponível para outra pessoa.
          </p>

          <label className="flex flex-col gap-1.5">
            <span className="font-medium">Motivo</span>
            <input
              type="text"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: obra adiada, medida mudou"
              className="border-borda bg-superficie min-h-12 rounded-xl border-2 px-4"
            />
            <span className="text-texto-suave text-sm">
              Fica registrado no histórico, que nunca é apagado.
            </span>
          </label>

          <div className="flex gap-3">
            <Botao
              variante="contorno"
              onClick={() => setCancelando(null)}
              className="flex-1"
            >
              Voltar
            </Botao>
            <Botao
              variante="destrutiva"
              onClick={() => void confirmarCancelamento()}
              carregando={cancelar.isPending}
              className="flex-1"
            >
              Cancelar reserva
            </Botao>
          </div>
        </div>
      </Modal>
    </PaginaLista>
  )
}
