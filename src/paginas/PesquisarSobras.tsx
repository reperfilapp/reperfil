import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Search,
  MapPin,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  PackageCheck,
} from 'lucide-react'
import { useSobras } from '@/dados/sobras'
import { useAcabamentos } from '@/dados/acabamentos'
import { useConfiguracoes, paraConfiguracaoCorte } from '@/dados/configuracoes'
import { useModelosPerfil } from '@/dados/modelosPerfil'
import { useReservarSobra } from '@/dados/reservas'
import { CampoMedida } from '@/componentes/ui/CampoMedida'
import { CampoSelecao } from '@/componentes/ui/CampoSelecao'
import { Botao } from '@/componentes/ui/Botao'
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
import type { UnidadeMedida } from '@/config/aplicacao'

/**
 * Pesquisa de sobras para um corte.
 *
 * A pergunta que a tela responde é a do serralheiro no chão da oficina: "eu
 * preciso de um pedaço de tanto, deste perfil, nesta cor — tem alguma ponta
 * que serve?".
 *
 * Por isso a ordem dos campos é essa, e não a ordem do banco: perfil, cor,
 * medida. É a sequência em que a informação chega na cabeça de quem está com
 * a lista de corte na mão.
 */

interface CandidataComDados extends CandidataSobra {
  modeloCodigo: string
  modeloDescricao: string
  acabamentoNome: string
  quantidadeTotal: number
}

export default function PesquisarSobras() {
  const { data: sobras } = useSobras()
  const { data: acabamentos } = useAcabamentos()
  const { data: modelos } = useModelosPerfil()
  const { data: config } = useConfiguracoes()
  const reservar = useReservarSobra()

  const [modeloId, setModeloId] = useState('')
  const [acabamentoId, setAcabamentoId] = useState('')
  const [textoMedida, setTextoMedida] = useState('')
  const [unidade, setUnidade] = useState<UnidadeMedida>('mm')
  const [quantidade, setQuantidade] = useState(1)
  const [reservada, setReservada] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  const corteMm = interpretarMedidaDigitada(textoMedida, unidade)
  const configCorte = config
    ? paraConfiguracaoCorte(config)
    : CONFIGURACAO_CORTE_PADRAO

  const podePesquisar =
    modeloId !== '' && acabamentoId !== '' && corteMm !== null && corteMm > 0

  // Só peças do modelo escolhido, disponíveis, com unidade livre.
  const candidatas: CandidataComDados[] = (sobras ?? [])
    .filter(
      (s) =>
        s.modelo_perfil_id === modeloId &&
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
    }))

  const achados = podePesquisar
    ? pesquisarSobras(
        candidatas,
        { corteMm, acabamentoId, quantidadeMinima: quantidade },
        configCorte,
      )
    : []

  async function reservarPeca(loteId: string, codigo: string) {
    setErro(null)

    try {
      await reservar.mutateAsync({ loteId, quantidade })
      setReservada(codigo)
    } catch (e) {
      // A mensagem vem da função do banco e já é específica: "restam apenas
      // 0 unidades — outra pessoa pode ter reservado agora há pouco".
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
        <CampoSelecao
          rotulo="Perfil"
          value={modeloId}
          onChange={(e) => setModeloId(e.target.value)}
        >
          <option value="">Selecione o perfil…</option>
          {modelos?.map((m) => (
            <option key={m.id} value={m.id}>
              {m.codigo} — {m.descricao}
            </option>
          ))}
        </CampoSelecao>

        <CampoSelecao
          rotulo="Cor ou acabamento"
          value={acabamentoId}
          onChange={(e) => setAcabamentoId(e.target.value)}
        >
          <option value="">Selecione o acabamento…</option>
          {acabamentos?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </CampoSelecao>

        <CampoMedida
          rotulo="Comprimento do corte"
          texto={textoMedida}
          unidade={unidade}
          aoMudarTexto={setTextoMedida}
          aoMudarUnidade={setUnidade}
        />

        <div>
          <p className="mb-2 font-medium">Quantas peças?</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
              aria-label="Diminuir quantidade"
              className="border-destaque-borda bg-destaque text-destaque-texto hover:bg-destaque-hover min-h-14 w-14 shrink-0 rounded-xl border-2 text-2xl font-bold"
            >
              −
            </button>
            <span className="min-h-14 min-w-0 flex-1 content-center text-center text-2xl font-semibold tabular-nums">
              {quantidade}
            </span>
            <button
              type="button"
              onClick={() => setQuantidade((q) => Math.min(999, q + 1))}
              aria-label="Aumentar quantidade"
              className="border-destaque-borda bg-destaque text-destaque-texto hover:bg-destaque-hover min-h-14 w-14 shrink-0 rounded-xl border-2 text-2xl font-bold"
            >
              +
            </button>
          </div>
        </div>
      </div>

      {reservada && (
        <div
          role="status"
          className="bg-economia-50 text-economia-700 mb-5 flex items-center gap-3 rounded-xl p-4"
        >
          <PackageCheck aria-hidden="true" className="size-5 shrink-0" />
          <p className="text-sm">
            <strong>{reservada}</strong> reservada. Veja em Reservas para
            confirmar a retirada.
          </p>
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

      {podePesquisar && (
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
                {formatarComprimento(corteMm)}
                {quantidade > 1 && ` (${quantidade} peças)`}.
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
                        <span className="block truncate text-sm">
                          {s.modeloCodigo} · {s.acabamentoNome}
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

                  {/* O que acontece com a peça se este corte for feito */}
                  <div
                    className={`mb-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
                      aproveitamento === 'gera-descarte'
                        ? 'bg-atencao-50 text-atencao-700'
                        : 'bg-economia-50 text-economia-700'
                    }`}
                  >
                    {aproveitamento === 'gera-descarte' ? (
                      <AlertTriangle aria-hidden="true" className="size-4" />
                    ) : (
                      <CheckCircle2 aria-hidden="true" className="size-4" />
                    )}
                    <span>
                      {aproveitamento === 'exato' &&
                        'Consome a peça inteira, sem desperdício.'}
                      {aproveitamento === 'ideal' &&
                        `Sobram ${formatarComprimento(resultado.sobraResultanteMm)}, que voltam ao estoque.`}
                      {aproveitamento === 'gera-descarte' &&
                        `Sobram ${formatarComprimento(resultado.sobraResultanteMm)} — vira descarte.`}
                    </span>
                  </div>

                  <Botao
                    tamanho="largura_total"
                    carregando={reservar.isPending}
                    onClick={() => void reservarPeca(s.id, s.codigo)}
                  >
                    Reservar {quantidade > 1 && `${quantidade} peças`}
                  </Botao>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {!podePesquisar && (
        <p className="bg-superficie-2 text-texto-suave rounded-xl p-5 text-center text-sm">
          Escolha o perfil, o acabamento e o comprimento do corte.
        </p>
      )}
    </div>
  )
}
