import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  MapPin,
  ChevronRight,
  History,
  PackageMinus,
  Puzzle,
  Pencil,
  TriangleAlert,
} from 'lucide-react'
import {
  useLoteAcessorio,
  useHistoricoLoteAcessorio,
  useUsarAcessorio,
  useDescartarAcessorio,
  useAjustarQuantidadeAcessorio,
} from '@/dados/acessorios'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { podeMovimentarEstoque } from '@/autenticacao/contexto'
import { nomeParaHistorico } from '@/dominio/contaExcluida'
import { PaginaDetalhe, FichaDados } from '@/componentes/PaginaDetalhe'
import { Secao } from '@/componentes/ui/Secao'
import { EstadoConsulta } from '@/componentes/EstadoConsulta'
import { Botao } from '@/componentes/ui/Botao'
import { Modal } from '@/componentes/ui/Modal'
import { AmostraCor } from '@/componentes/ui/AmostraCor'
import type { EstadoConservacao, StatusLote } from '@/tipos/banco'

const ROTULO_STATUS: Record<StatusLote, string> = {
  disponivel: 'disponível',
  reservada: 'reservada',
  consumida: 'consumida',
  descartada: 'descartada',
  em_conferencia: 'em conferência',
}

const COR_STATUS: Record<StatusLote, string> = {
  disponivel: 'bg-aluminio-200 text-grafite-900',
  reservada: 'bg-atencao-100 text-atencao-700',
  consumida: 'bg-superficie-2 text-texto-suave',
  descartada: 'bg-erro-50 text-erro-700',
  em_conferencia: 'bg-atencao-50 text-atencao-700',
}

const ROTULO_ESTADO: Record<EstadoConservacao, string> = {
  novo_embalado: 'Novo/Embalado',
  excelente: 'Excelente',
  bom: 'Bom',
  pequenos_arranhoes: 'Pequenos arranhões',
  muito_avariado: 'Muito avariado',
}

const ROTULO_MOVIMENTO: Record<string, string> = {
  entrada: 'Cadastrado',
  uso: 'Usado',
  ajuste: 'Ajuste de estoque',
  descarte: 'Descartado',
  transferencia: 'Transferido de local',
}

export default function AcessorioDetalhe() {
  const { id } = useParams<{ id: string }>()
  const { perfil } = useAutenticacao()
  const podeMovimentar = podeMovimentarEstoque(perfil)
  const { data: item, isPending, error, refetch } = useLoteAcessorio(id ?? null)
  const { data: historico } = useHistoricoLoteAcessorio(id ?? null)
  const usar = useUsarAcessorio()
  const descartar = useDescartarAcessorio()
  const ajustar = useAjustarQuantidadeAcessorio()

  const [usando, setUsando] = useState(false)
  const [quantidadeUsar, setQuantidadeUsar] = useState(1)
  const [erroUsar, setErroUsar] = useState<string | null>(null)

  /*
   * Descartar e corrigir são telas SEPARADAS de propósito.
   *
   * As duas mudam o mesmo número, mas querem dizer coisas opostas — e o
   * campo que cada uma pede é o inverso do outro:
   *
   *   Descartar → QUANTAS saíram   ("quebrei 5" de 20 → sobram 15)
   *   Corrigir  → QUANTAS ficaram  ("o certo é 15", venha de onde vier)
   *
   * Num formulário só, com um seletor de motivo, o mesmo campo mudaria de
   * significado conforme a escolha — e digitar 5 querendo dizer "perdi 5"
   * num campo que espera "restaram 5" zeraria quase o lote inteiro sem
   * pedir confirmação. Dois caminhos com texto próprio custam algumas
   * linhas a mais e não têm esse buraco.
   */
  const [descartando, setDescartando] = useState(false)
  const [quantidadeDescartar, setQuantidadeDescartar] = useState(1)
  const [motivoDescarte, setMotivoDescarte] = useState('')
  const [erroDescarte, setErroDescarte] = useState<string | null>(null)

  const [corrigindo, setCorrigindo] = useState(false)
  const [quantidadeCerta, setQuantidadeCerta] = useState('')
  const [motivoCorrecao, setMotivoCorrecao] = useState('')
  const [erroCorrecao, setErroCorrecao] = useState<string | null>(null)

  if (isPending || error || !item) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-6">
        <EstadoConsulta
          carregando={isPending}
          erro={error}
          vazio={!isPending && !item}
          mensagemVazio="Acessório não encontrado."
          aoTentarNovamente={() => void refetch()}
        />
      </div>
    )
  }

  function abrirUsar() {
    setQuantidadeUsar(1)
    setErroUsar(null)
    setUsando(true)
  }

  async function confirmarUso() {
    if (!item) return

    setErroUsar(null)

    try {
      await usar.mutateAsync({ loteId: item.id, quantidade: quantidadeUsar })
      setUsando(false)
    } catch (e) {
      setErroUsar(
        e instanceof Error ? e.message : 'Não foi possível dar baixa.',
      )
    }
  }

  function abrirDescarte() {
    setQuantidadeDescartar(1)
    setMotivoDescarte('')
    setErroDescarte(null)
    setDescartando(true)
  }

  async function confirmarDescarte() {
    if (!item) return

    setErroDescarte(null)

    // Barrado aqui também, e não só no banco: a mensagem do servidor
    // chega depois de a pessoa ter digitado tudo e tocado em confirmar.
    if (motivoDescarte.trim().length < 5) {
      setErroDescarte('Descreva o que aconteceu — pelo menos 5 letras.')
      return
    }

    try {
      await descartar.mutateAsync({
        loteId: item.id,
        quantidade: quantidadeDescartar,
        justificativa: motivoDescarte.trim(),
      })
      setDescartando(false)
    } catch (e) {
      setErroDescarte(
        e instanceof Error ? e.message : 'Não foi possível descartar.',
      )
    }
  }

  function abrirCorrecao() {
    // Começa com a quantidade ATUAL, não vazio: quem vai corrigir 100 para
    // 10 muda um dígito; quem abriu sem querer fecha sem estrago.
    setQuantidadeCerta(String(item?.quantidade ?? ''))
    setMotivoCorrecao('')
    setErroCorrecao(null)
    setCorrigindo(true)
  }

  async function confirmarCorrecao() {
    if (!item) return

    setErroCorrecao(null)

    const nova = Number(quantidadeCerta)

    if (!Number.isInteger(nova) || nova < 0) {
      setErroCorrecao('Informe um número inteiro de unidades (0 ou mais).')
      return
    }

    if (nova === item.quantidade) {
      setErroCorrecao('Esta já é a quantidade atual — nada para corrigir.')
      return
    }

    if (motivoCorrecao.trim().length < 5) {
      setErroCorrecao('Descreva o motivo — pelo menos 5 letras.')
      return
    }

    try {
      await ajustar.mutateAsync({
        loteId: item.id,
        novaQuantidade: nova,
        justificativa: motivoCorrecao.trim(),
      })
      setCorrigindo(false)
    } catch (e) {
      setErroCorrecao(
        e instanceof Error ? e.message : 'Não foi possível corrigir.',
      )
    }
  }

  return (
    <PaginaDetalhe
      voltarPara="/estoque-acessorios"
      rotuloVoltar="Acessórios"
      codigo={item.codigo}
      titulo={item.modelo?.descricao ?? ''}
      subtitulo={`${item.quantidade} ${item.modelo?.unidade_medida ?? 'peça'}${item.quantidade === 1 ? '' : 's'} em estoque`}
      selo={
        <span
          className={`rounded px-2 py-1 text-xs font-medium ${COR_STATUS[item.status]}`}
        >
          {ROTULO_STATUS[item.status]}
        </span>
      }
      acoes={
        podeMovimentar && (
          <div className="flex w-full flex-col gap-2">
            {/* "Usar" em destaque e sozinho na linha: é a ação do dia a
                dia, a única que acontece toda semana. Corrigir e descartar
                são exceções — dividem a linha de baixo, discretas, para
                não competirem com ela nem serem tocadas por engano. */}
            {item.quantidade > 0 && (
              <Botao onClick={abrirUsar} className="w-full">
                <PackageMinus aria-hidden="true" className="size-4" />
                Usar
              </Botao>
            )}

            <div className="flex gap-2">
              <Botao
                variante="secundaria"
                tamanho="pequeno"
                onClick={abrirCorrecao}
                className="flex-1"
              >
                <Pencil aria-hidden="true" className="size-4" />
                Corrigir
              </Botao>

              {item.quantidade > 0 && (
                <Botao
                  variante="secundaria"
                  tamanho="pequeno"
                  onClick={abrirDescarte}
                  className="border-erro-200 text-erro-700 hover:bg-erro-50 flex-1"
                >
                  <TriangleAlert aria-hidden="true" className="size-4" />
                  Descartar
                </Botao>
              )}
            </div>
          </div>
        )
      }
    >
      <section>
        <h2 className="mb-2 font-semibold">Acessório</h2>
        <Link
          to={`/acessorios`}
          className="bg-superficie hover:bg-superficie-2 flex items-center gap-3 rounded-xl p-3 shadow-sm"
        >
          <div className="border-borda bg-superficie-2 flex size-16 shrink-0 items-center justify-center rounded-lg border">
            <Puzzle aria-hidden="true" className="text-texto-suave size-7" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <p className="text-[0.8rem] leading-snug">
              <strong className="text-acao-600 font-bold">
                {item.modelo?.codigo}
              </strong>
              <span className="font-bold"> — {item.modelo?.descricao}</span>
            </p>
            {item.modelo?.categoria && (
              <p className="text-texto-suave mt-0.5 text-xs">
                {item.modelo.categoria}
              </p>
            )}
          </div>
          <ChevronRight
            aria-hidden="true"
            className="text-texto-suave size-5 shrink-0"
          />
        </Link>
      </section>

      <section className="bg-destaque border-destaque-borda flex items-center justify-center rounded-xl border py-4">
        <div className="flex flex-col items-center">
          <span className="text-destaque-texto mb-1 text-sm font-medium opacity-80">
            Quantidade
          </span>
          <span className="text-destaque-texto text-center text-3xl leading-none font-bold tabular-nums">
            {item.quantidade}
            <span className="ml-1 text-base font-medium">
              {item.modelo?.unidade_medida}
              {item.quantidade === 1 ? '' : 's'}
            </span>
          </span>
        </div>
      </section>

      <FichaDados
        titulo="Dados do lote"
        linhas={[
          {
            rotulo: 'Acabamento',
            valor: item.acabamento ? (
              <AmostraCor
                corHex={item.acabamento.cor_hex}
                nome={item.acabamento.nome}
              />
            ) : (
              'sem cor definida'
            ),
          },
          {
            rotulo: 'Localização',
            valor: item.localizacao ? (
              <Link
                to="/localizacoes"
                className="text-acao-600 inline-flex items-center gap-1 hover:underline"
              >
                <MapPin aria-hidden="true" className="size-3.5" />
                {item.localizacao.codigo}
              </Link>
            ) : null,
          },
          { rotulo: 'Estado', valor: ROTULO_ESTADO[item.estado] },
          { rotulo: 'Observações', valor: item.observacoes },
          {
            rotulo: 'Cadastrado em',
            valor: new Date(item.criado_em).toLocaleString('pt-BR'),
          },
        ]}
      />

      <Secao titulo="Histórico" icone={History}>
        {!historico || historico.length === 0 ? (
          <p className="bg-superficie-2 text-texto-suave rounded-xl p-4 text-sm">
            Sem movimentações registradas.
          </p>
        ) : (
          <ol className="flex flex-col gap-2">
            {historico.map((m) => (
              <li key={m.id} className="bg-superficie rounded-xl p-3 text-sm">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="font-medium">
                    {ROTULO_MOVIMENTO[m.tipo] ?? m.tipo}
                  </span>
                  <span className="text-texto-suave shrink-0 text-xs">
                    {new Date(m.criado_em).toLocaleString('pt-BR')}
                  </span>
                </div>
                <p className="text-texto-suave">
                  {m.quantidade}{' '}
                  {nomeParaHistorico(m.usuario)
                    ? ` · ${nomeParaHistorico(m.usuario)}`
                    : ''}
                </p>
                {m.justificativa && (
                  <p className="text-texto-suave mt-1 text-xs italic">
                    {m.justificativa}
                  </p>
                )}
              </li>
            ))}
          </ol>
        )}
      </Secao>

      <Modal aberto={usando} aoFechar={() => setUsando(false)} titulo="Usar">
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            Baixa direta de{' '}
            <strong className="font-mono">{item.codigo}</strong> — sem
            reserva, porque não há corte a calcular.
          </p>

          <div>
            <p className="mb-1 font-medium">Quantas unidades foram usadas?</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  setQuantidadeUsar((q) => Math.max(1, q - 1))
                }
                aria-label="Diminuir quantidade"
                className="border-destaque-borda bg-destaque text-destaque-texto hover:bg-destaque-hover min-h-14 w-14 shrink-0 rounded-xl border-2 text-2xl font-bold"
              >
                −
              </button>
              <input
                type="text"
                inputMode="numeric"
                value={quantidadeUsar}
                onChange={(e) => {
                  const n = Number(e.target.value.replace(/\D/g, ''))
                  setQuantidadeUsar(Number.isFinite(n) && n >= 1 ? n : 1)
                }}
                aria-label="Quantidade usada"
                className="border-borda bg-superficie min-h-14 min-w-0 flex-1 rounded-xl border-2 text-center text-2xl font-semibold tabular-nums"
              />
              <button
                type="button"
                onClick={() =>
                  setQuantidadeUsar((q) => Math.min(item.quantidade, q + 1))
                }
                aria-label="Aumentar quantidade"
                className="border-destaque-borda bg-destaque text-destaque-texto hover:bg-destaque-hover min-h-14 w-14 shrink-0 rounded-xl border-2 text-2xl font-bold"
              >
                +
              </button>
            </div>
            <p className="text-texto-suave mt-1 text-xs">
              {item.quantidade} disponível
              {item.quantidade === 1 ? '' : 'is'} agora.
            </p>
          </div>

          {erroUsar && (
            <p
              role="alert"
              className="bg-erro-50 text-erro-700 rounded-xl px-4 py-3 text-sm font-medium"
            >
              {erroUsar}
            </p>
          )}

          <div className="flex gap-3">
            <Botao
              variante="contorno"
              onClick={() => setUsando(false)}
              className="flex-1"
            >
              Cancelar
            </Botao>
            <Botao
              onClick={() => void confirmarUso()}
              carregando={usar.isPending}
              className="flex-1"
            >
              <PackageMinus aria-hidden="true" className="size-4" />
              Confirmar
            </Botao>
          </div>
        </div>
      </Modal>

      {/* ── DESCARTAR: a peça existiu e se perdeu ─────────────────────── */}
      <Modal
        aberto={descartando}
        aoFechar={() => setDescartando(false)}
        titulo="Descartar"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            Para peça que <strong>quebrou, sumiu ou estragou</strong> — saiu
            do estoque sem virar produto. Se foi usada numa janela, o certo é{' '}
            <strong>Usar</strong>; se o número cadastrado é que estava
            errado, é <strong>Corrigir</strong>.
          </p>

          <div>
            <p className="mb-1 font-medium">Quantas unidades se perderam?</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setQuantidadeDescartar((q) => Math.max(1, q - 1))}
                aria-label="Diminuir quantidade"
                className="border-destaque-borda bg-destaque text-destaque-texto hover:bg-destaque-hover min-h-14 w-14 shrink-0 rounded-xl border-2 text-2xl font-bold"
              >
                −
              </button>
              <input
                type="text"
                inputMode="numeric"
                value={quantidadeDescartar}
                onChange={(e) => {
                  const n = Number(e.target.value.replace(/\D/g, ''))
                  setQuantidadeDescartar(
                    Number.isFinite(n) && n >= 1
                      ? Math.min(item.quantidade, n)
                      : 1,
                  )
                }}
                aria-label="Quantidade descartada"
                className="border-borda bg-superficie min-h-14 min-w-0 flex-1 rounded-xl border-2 text-center text-2xl font-semibold tabular-nums"
              />
              <button
                type="button"
                onClick={() =>
                  setQuantidadeDescartar((q) => Math.min(item.quantidade, q + 1))
                }
                aria-label="Aumentar quantidade"
                className="border-destaque-borda bg-destaque text-destaque-texto hover:bg-destaque-hover min-h-14 w-14 shrink-0 rounded-xl border-2 text-2xl font-bold"
              >
                +
              </button>
            </div>
            {/* Mostra o que SOBRA, não só o que sai: é a conta que a pessoa
                faria de cabeça para conferir se digitou certo. */}
            <p className="text-texto-suave mt-1 text-xs">
              Sobram {item.quantidade - quantidadeDescartar} de{' '}
              {item.quantidade}.
            </p>
          </div>

          <div>
            <label
              htmlFor="motivo-descarte"
              className="mb-1 block font-medium"
            >
              O que aconteceu?
            </label>
            <input
              id="motivo-descarte"
              type="text"
              value={motivoDescarte}
              onChange={(e) => setMotivoDescarte(e.target.value)}
              placeholder="Ex.: caixa caiu e quebrou na montagem"
              className="border-borda bg-superficie min-h-12 w-full rounded-xl border-2 px-4"
            />
            <p className="text-texto-suave mt-1 text-xs">
              Fica no histórico. Meses depois, é o que distingue quebra de
              furto — e o que decide se vale mudar de fornecedor.
            </p>
          </div>

          {erroDescarte && (
            <p
              role="alert"
              className="bg-erro-50 text-erro-700 rounded-xl px-4 py-3 text-sm font-medium"
            >
              {erroDescarte}
            </p>
          )}

          <div className="flex gap-3">
            <Botao
              variante="contorno"
              onClick={() => setDescartando(false)}
              className="flex-1"
            >
              Cancelar
            </Botao>
            <Botao
              variante="destrutiva"
              onClick={() => void confirmarDescarte()}
              carregando={descartar.isPending}
              className="flex-1"
            >
              <TriangleAlert aria-hidden="true" className="size-4" />
              Descartar
            </Botao>
          </div>
        </div>
      </Modal>

      {/* ── CORRIGIR: o número nunca esteve certo ─────────────────────── */}
      <Modal
        aberto={corrigindo}
        aoFechar={() => setCorrigindo(false)}
        titulo="Corrigir quantidade"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            Para quando o <strong>número cadastrado está errado</strong> —
            digitou 100 onde eram 10. Nada saiu do estoque; o registro é que
            nunca esteve certo. Se a peça se perdeu de verdade, use{' '}
            <strong>Descartar</strong>.
          </p>

          <div>
            <label
              htmlFor="quantidade-certa"
              className="mb-1 block font-medium"
            >
              Qual é a quantidade certa?
            </label>
            <input
              id="quantidade-certa"
              type="text"
              inputMode="numeric"
              value={quantidadeCerta}
              onChange={(e) =>
                setQuantidadeCerta(e.target.value.replace(/\D/g, ''))
              }
              aria-label="Quantidade correta"
              className="border-borda bg-superficie min-h-14 w-full rounded-xl border-2 text-center text-2xl font-semibold tabular-nums"
            />
            {/* O contraste com o valor atual é o que evita o engano de
                digitar aqui "quanto saiu" em vez de "quanto tem". */}
            <p className="text-texto-suave mt-1 text-xs">
              Hoje o sistema diz {item.quantidade}. Este campo é o total que
              deve ficar, não quanto saiu.
            </p>
          </div>

          <div>
            <label
              htmlFor="motivo-correcao"
              className="mb-1 block font-medium"
            >
              Por que estava errado?
            </label>
            <input
              id="motivo-correcao"
              type="text"
              value={motivoCorrecao}
              onChange={(e) => setMotivoCorrecao(e.target.value)}
              placeholder="Ex.: erro de digitação no cadastro"
              className="border-borda bg-superficie min-h-12 w-full rounded-xl border-2 px-4"
            />
            <p className="text-texto-suave mt-1 text-xs">
              Fica no histórico, junto com o número antigo e o novo.
            </p>
          </div>

          {erroCorrecao && (
            <p
              role="alert"
              className="bg-erro-50 text-erro-700 rounded-xl px-4 py-3 text-sm font-medium"
            >
              {erroCorrecao}
            </p>
          )}

          <div className="flex gap-3">
            <Botao
              variante="contorno"
              onClick={() => setCorrigindo(false)}
              className="flex-1"
            >
              Cancelar
            </Botao>
            <Botao
              onClick={() => void confirmarCorrecao()}
              carregando={ajustar.isPending}
              className="flex-1"
            >
              <Pencil aria-hidden="true" className="size-4" />
              Corrigir
            </Botao>
          </div>
        </div>
      </Modal>
    </PaginaDetalhe>
  )
}
