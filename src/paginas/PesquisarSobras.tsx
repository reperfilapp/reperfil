import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Search,
  MapPin,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  PackageCheck,
  Scissors,
} from 'lucide-react'
import { useSobras } from '@/dados/sobras'
import { useAcabamentos } from '@/dados/acabamentos'
import { useConfiguracoes, paraConfiguracaoCorte } from '@/dados/configuracoes'
import { useReservarSobra } from '@/dados/reservas'
import { SeletorPerfil } from '@/componentes/SeletorPerfil'
import { usePerfilIndicado } from '@/componentes/usePerfilIndicado'
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
import type { ModeloPerfil } from '@/tipos/banco'

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
  modeloCodigo: string
  modeloDescricao: string
  acabamentoNome: string
  acabamentoCor: string | null
  quantidadeTotal: number
}

export default function PesquisarSobras() {
  const { data: sobras } = useSobras()
  const { data: acabamentos } = useAcabamentos()
  const { data: config } = useConfiguracoes()
  const reservar = useReservarSobra()

  const [modelo, setModelo] = useState<ModeloPerfil | null>(null)
  // Volta da tela de identificação já com o perfil escolhido.
  usePerfilIndicado(setModelo)
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
    modelo !== null && acabamentoId !== '' && corteMm !== null && corteMm > 0

  // Só peças do modelo escolhido, disponíveis, com unidade livre.
  const candidatas: CandidataComDados[] = (sobras ?? [])
    .filter(
      (s) =>
        s.modelo_perfil_id === modelo?.id &&
        s.status === 'disponivel' &&
        s.quantidade - s.quantidade_reservada > 0,
    )
    .map((s) => ({
      id: s.id,
      codigo: s.codigo,
      comprimentoMm: s.comprimento_mm,
      quantidadeDisponivel: s.quantidade - s.quantidade_reservada,
      quantidadeTotal: s.quantidade,
      acabamentoId: s.acabamento_id,
      localizacaoCodigo: s.localizacao?.codigo ?? null,
      criadoEm: s.criado_em,
      modeloCodigo: s.modelo?.codigo ?? '',
      modeloDescricao: s.modelo?.descricao ?? '',
      acabamentoNome: s.acabamento?.nome ?? '',
      acabamentoCor: s.acabamento?.cor_hex ?? null,
    }))

  const acabamentosDisponiveisIds = new Set(
    candidatas.map((s) => s.acabamentoId)
  )

  const opcoesAcabamento = modelo
    ? acabamentos?.filter((a) => acabamentosDisponiveisIds.has(a.id))
    : acabamentos

  // Só pesquisa quando não há reserva confirmada (evita mensagem contraditória).
  const achados =
    podePesquisar && !reservadaCodigo
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

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-6">
      <header className="mb-5 flex items-center gap-3">
        <Search aria-hidden="true" className="text-acao-600 size-7" />
        <h1 className="text-2xl font-bold">Procurar sobra</h1>
      </header>

      {config && !config.confirmado_pelo_administrador && (
        <p className="bg-atencao-50 text-atencao-700 mb-5 rounded-xl p-4 text-sm">
          <strong>Atenção:</strong> a espessura da serra ainda é um valor
          presumido. O cálculo de aproveitamento abaixo pode estar errado.
        </p>
      )}

      <div className="mb-6 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between gap-3">
            <label className="font-medium">Perfil</label>
            {modelo && (
              <BotaoVoltar
                onClick={() => {
                  setModelo(null)
                  setAcabamentoId('')
                }}
                rotulo="Trocar perfil"
              />
            )}
          </div>
          {/* Mesmo campo de busca da tela "Cadastrar sobra": digitar em
              vez de rolar um menu comprido, com desenho e foto para
              conferir antes de escolher. A altura fixa só se aplica
              enquanto a lista está aberta — com o perfil escolhido, o
              cartão de confirmação assume a altura natural dele. */}
          <div className={cn(!modelo && 'flex h-96 flex-col')}>
            <SeletorPerfil
              selecionado={modelo}
              aoSelecionar={(m) => {
                setModelo(m)
                setAcabamentoId('')
              }}
            />
          </div>
        </div>

        <CampoSelecao
          rotulo="Cor ou acabamento"
          value={acabamentoId}
          onChange={(e) => setAcabamentoId(e.target.value)}
        >
          <option value="">Selecione o acabamento…</option>
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
          aoMudarTexto={setTextoMedida}
          aoMudarUnidade={setUnidade}
        />

        <div>
          <p className="mb-1 font-medium">Quantos cortes?</p>
          <p className="text-texto-suave mb-2 text-xs">
            Número de peças do tamanho acima que você precisa produzir.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQuantidadeCortes((q) => Math.max(1, q - 1))}
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
              }}
              aria-label="Quantidade de cortes"
              className="border-borda bg-superficie min-h-16 min-w-0 flex-1 rounded-xl border-2 text-center text-2xl font-semibold tabular-nums"
            />
            <button
              type="button"
              onClick={() => setQuantidadeCortes((q) => Math.min(999, q + 1))}
              aria-label="Aumentar quantidade de cortes"
              className="border-destaque-borda bg-destaque text-destaque-texto hover:bg-destaque-hover min-h-16 w-16 shrink-0 rounded-xl border-2 text-2xl font-bold"
            >
              +
            </button>
          </div>
        </div>
      </div>

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

      {podePesquisar && !reservadaCodigo && (
        <section aria-live="polite">
          <h2 className="mb-3 font-semibold">
            {achados.length === 0
              ? 'Nenhuma sobra serve'
              : `${achados.length} ${achados.length === 1 ? 'sobra serve' : 'sobras servem'}`}
          </h2>

          {achados.length === 0 && (
            <div className="bg-superficie-2 text-texto-suave rounded-xl p-5 text-sm">
              <p className="mb-2">
                Nenhuma peça deste perfil e acabamento comporta{' '}
                {quantidadeCortes > 1
                  ? `${quantidadeCortes} cortes de ${formatarComprimento(corteMm)}`
                  : `1 corte de ${formatarComprimento(corteMm)}`}
                .
              </p>
              <p>
                O sistema não sugere sobra de acabamento diferente — duas peças
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
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <Link
                      to={`/sobras/${s.id}`}
                      className="flex min-w-0 items-center gap-2"
                      aria-label={`Ver detalhes da sobra ${s.codigo}`}
                    >
                      <span className="min-w-0">
                        <span className="block font-mono font-bold">
                          {s.codigo}
                        </span>
                        <span className="block truncate text-sm flex items-center gap-1">
                          {s.modeloCodigo} ·{' '}
                          <AmostraCor
                            corHex={s.acabamentoCor}
                            nome={s.acabamentoNome}
                          />
                        </span>
                        {s.localizacaoCodigo && (
                          <span className="text-texto-suave flex items-center gap-1 text-sm">
                            <MapPin aria-hidden="true" className="size-3.5" />
                            {s.localizacaoCodigo}
                          </span>
                        )}
                      </span>
                      <ChevronRight
                        aria-hidden="true"
                        className="text-texto-suave size-4 shrink-0"
                      />
                    </Link>

                    <p className="shrink-0 text-right">
                      <span className="block text-xl font-bold tabular-nums">
                        {formatarComprimento(s.comprimentoMm)}
                      </span>
                      <span className="text-texto-suave text-xs">
                        {s.quantidadeDisponivel} de {s.quantidadeTotal}{' '}
                        {s.quantidadeTotal === 1 ? 'livre' : 'livres'}
                      </span>
                    </p>
                  </div>

                  {/* Resumo do plano de corte */}
                  <div className="bg-superficie-2 mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
                    <Scissors aria-hidden="true" className="text-texto-suave size-4 shrink-0" />
                    <span>
                      {resultado.pecasNecessarias === 1
                        ? `1 peça deste lote basta para ${quantidadeCortes} ${quantidadeCortes === 1 ? 'corte' : 'cortes'} de ${formatarComprimento(corteMm!)}`
                        : `${resultado.pecasNecessarias} peças deste lote para ${quantidadeCortes} cortes de ${formatarComprimento(corteMm!)}`}
                    </span>
                  </div>

                  {/* O que acontece com a peça se este corte for feito */}
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

      {!podePesquisar && !reservadaCodigo && (
        <p className="bg-superficie-2 text-texto-suave rounded-xl p-5 text-center text-sm">
          Escolha o perfil, o acabamento e o comprimento do corte.
        </p>
      )}
    </div>
  )
}
