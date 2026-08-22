import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  Tag,
  MapPin,
  ChevronRight,
  History,
  Layers,
  PackageMinus,
  PackageCheck,
  Pencil,
} from 'lucide-react'
import {
  useSobra,
  useHistoricoDoLote,
} from '@/dados/sobras'
import { useReservarSobra } from '@/dados/reservas'
import { useCapasDesenhos } from '@/dados/desenhosTecnicos'
import { obterLinkTemporario, BALDE_FOTOS } from '@/lib/armazenamento'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { podeMovimentarEstoque } from '@/autenticacao/contexto'
import { PaginaDetalhe, FichaDados } from '@/componentes/PaginaDetalhe'
import { Secao } from '@/componentes/ui/Secao'
import { EstadoConsulta } from '@/componentes/EstadoConsulta'
import { MiniaturaPerfil } from '@/componentes/MiniaturaPerfil'
import { EtiquetaSobra } from '@/componentes/EtiquetaSobra'
import { Botao } from '@/componentes/ui/Botao'
import { Modal } from '@/componentes/ui/Modal'
import { CampoMedida } from '@/componentes/ui/CampoMedida'
import { ModalEditarSobra } from '@/componentes/ModalEditarSobra'
import { AmostraCor } from '@/componentes/ui/AmostraCor'
import {
  formatarComprimento,
  interpretarMedidaDigitada,
} from '@/dominio/medidas'
import { cortesQueUmLoteComporta } from '@/dominio/pesquisa'
import { useConfiguracoes, paraConfiguracaoCorte } from '@/dados/configuracoes'
import { CONFIGURACAO_CORTE_PADRAO } from '@/dominio/corte'
import {
  areaSecaoMm2,
  formatarAreaSecao,
  formatarMedidasSecao,
} from '@/dominio/secao'
import type { UnidadeMedida } from '@/config/aplicacao'
import type { StatusLote, EstadoConservacao } from '@/tipos/banco'

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

/** Nomes legíveis dos tipos de movimentação, para o histórico. */
const ROTULO_MOVIMENTO: Record<string, string> = {
  entrada: 'Cadastrada',
  edicao: 'Editada',
  reserva: 'Reservada',
  cancelamento_reserva: 'Reserva cancelada',
  expiracao_reserva: 'Reserva vencida',
  retirada: 'Retirada da prateleira',
  corte: 'Cortada',
  devolucao: 'Devolvida',
  transferencia: 'Transferida de local',
  ajuste: 'Ajuste de estoque',
  descarte: 'Descartada',
}

export default function SobraDetalhe() {
  const { id } = useParams<{ id: string }>()
  const navegar = useNavigate()
  const { perfil } = useAutenticacao()
  const podeMovimentar = podeMovimentarEstoque(perfil)
  const { data: sobra, isPending, error, refetch } = useSobra(id ?? null)
  const { data: historico } = useHistoricoDoLote(id ?? null)
  const { data: capas } = useCapasDesenhos('imagem')
  const reservar = useReservarSobra()
  const { data: config } = useConfiguracoes()
  const [etiqueta, setEtiqueta] = useState(false)
  const [fotoPeca, setFotoPeca] = useState<string | null>(null)
  const [usando, setUsando] = useState(false)
  const [textoMedidaUsar, setTextoMedidaUsar] = useState('')
  const [unidadeUsar, setUnidadeUsar] = useState<UnidadeMedida>('mm')
  const [quantidadeCortes, setQuantidadeCortes] = useState(1)
  const [erroUsar, setErroUsar] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)

  // A foto da peça fica em balde privado: precisa de link temporário.
  useEffect(() => {
    if (!sobra?.foto_url) {
      setFotoPeca(null)
      return
    }

    let ativo = true

    void obterLinkTemporario(BALDE_FOTOS, sobra.foto_url).then((link) => {
      if (ativo) setFotoPeca(link)
    })

    return () => {
      ativo = false
    }
  }, [sobra?.foto_url])

  if (isPending || error || !sobra) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-6">
        <EstadoConsulta
          carregando={isPending}
          erro={error}
          vazio={!isPending && !sobra}
          mensagemVazio="Sobra não encontrada."
          aoTentarNovamente={() => void refetch()}
        />
      </div>
    )
  }

  const livres = sobra.quantidade - sobra.quantidade_reservada

  const configCorte = config
    ? paraConfiguracaoCorte(config)
    : CONFIGURACAO_CORTE_PADRAO

  const corteMmUsar = interpretarMedidaDigitada(textoMedidaUsar, unidadeUsar)

  let erroUsarCalculado: string | null = null
  let pecasNecessariasCalculadas = 0

  if (usando && corteMmUsar && corteMmUsar > 0) {
    const cortesPorPeca = cortesQueUmLoteComporta(
      sobra.comprimento_mm,
      corteMmUsar,
      configCorte,
    )

    if (cortesPorPeca <= 0) {
      erroUsarCalculado = 'Este corte não cabe nesta peça.'
    } else {
      pecasNecessariasCalculadas = Math.ceil(quantidadeCortes / cortesPorPeca)
      if (pecasNecessariasCalculadas > livres) {
        erroUsarCalculado = `São necessárias ${pecasNecessariasCalculadas} peças, mas só ${livres} ${livres === 1 ? 'está livre' : 'estão livres'}.`
      }
    }
  }

  function abrirUsar() {
    setTextoMedidaUsar('')
    setUnidadeUsar('mm')
    setQuantidadeCortes(1)
    setErroUsar(null)
    setUsando(true)
  }

  async function confirmarUso() {
    setErroUsar(null)

    if (!corteMmUsar || corteMmUsar <= 0) {
      setErroUsar('Informe o comprimento do corte.')
      return
    }

    if (erroUsarCalculado) {
      return
    }

    try {
      await reservar.mutateAsync({
        loteId: sobra.id,
        quantidade: pecasNecessariasCalculadas,
        comprimentoCorteMm: corteMmUsar,
        quantidadeCortes,
      })
      setUsando(false)
      navegar('/reservas')
    } catch (e) {
      setErroUsar(
        e instanceof Error ? e.message : 'Não foi possível reservar.',
      )
    }
  }

  return (
    <PaginaDetalhe
      voltarPara="/sobras"
      rotuloVoltar="Estoque"
      codigo={sobra.codigo}
      titulo={formatarComprimento(sobra.comprimento_mm)}
      subtitulo={`${livres} de ${sobra.quantidade} ${sobra.quantidade === 1 ? 'peça livre' : 'peças livres'}`}
      selo={
        <span
          className={`rounded px-2 py-1 text-xs font-medium ${COR_STATUS[sobra.status]}`}
        >
          {ROTULO_STATUS[sobra.status]}
        </span>
      }
      acoes={
        <>
          {podeMovimentar && sobra.status !== 'consumida' && (
            <Botao variante="contorno" onClick={() => setEditando(true)} className="flex-1 sm:flex-none">
              <Pencil aria-hidden="true" className="size-4" />
              Editar material
            </Botao>
          )}
          <Botao
            variante="contorno"
            onClick={() => setEtiqueta(true)}
            className="flex-1 sm:flex-none"
          >
            <Tag aria-hidden="true" className="size-4" />
            Ver etiqueta
          </Botao>
          {podeMovimentar && livres > 0 && (
            <Botao onClick={abrirUsar} className="w-full">
              <PackageMinus aria-hidden="true" className="size-4" />
              Usar peça
            </Botao>
          )}
        </>
      }
    >
      {/* O perfil, clicável — leva à ficha técnica completa. */}
      <section>
        <h2 className="mb-2 font-semibold">Perfil</h2>
        <Link
          to={`/perfis/${sobra.modelo_perfil_id}`}
          className="bg-superficie shadow-sm hover:bg-superficie-2 flex items-center gap-3 rounded-xl p-3"
        >
          <div className="shrink-0 flex flex-col items-center gap-1.5 w-[4.5rem]">
            {capas?.get(sobra.modelo_perfil_id) ? (
              <div className="w-[4.5rem] h-[4.5rem] flex items-center justify-center border border-borda rounded-lg bg-white">
                <img
                  src={capas.get(sobra.modelo_perfil_id)!}
                  alt={sobra.modelo?.codigo ?? ''}
                  className="max-w-[3.5rem] max-h-[3.5rem] object-contain"
                />
              </div>
            ) : (
              <div className="w-[4.5rem] h-[4.5rem] flex items-center justify-center border border-borda rounded-lg bg-white">
                <MiniaturaPerfil
                  link={null}
                  codigo={sobra.modelo?.codigo ?? ''}
                />
              </div>
            )}
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <p className="text-[0.8rem] leading-snug">
              <strong className="text-acao-600 font-bold">{sobra.modelo?.codigo}</strong>
              <span className="font-bold"> — {sobra.modelo?.descricao}</span>
            </p>
            {sobra.modelo?.linha && (
              <p className="text-xs text-texto-suave mt-0.5">
                {sobra.modelo.linha}
              </p>
            )}
            {sobra.modelo && formatarMedidasSecao(sobra.modelo) && (
              <p className="text-xs text-texto-suave mt-0.5">
                Medida: {formatarMedidasSecao(sobra.modelo)}
              </p>
            )}
            {sobra.acabamento && (
              <div className="flex items-center gap-1 text-xs min-w-0 mt-1">
                <span className="text-texto-suave shrink-0">Acab.:</span>
                <AmostraCor corHex={sobra.acabamento.cor_hex} tamanho="pequeno" />
                <strong className="text-acao-600 font-bold truncate">
                  {sobra.acabamento.nome}
                </strong>
              </div>
            )}
          </div>
          <ChevronRight
            aria-hidden="true"
            className="text-texto-suave size-5 shrink-0"
          />
        </Link>
      </section>

      {fotoPeca && (
        <section>
          <h2 className="mb-2 font-semibold">Foto desta peça</h2>
          <div className="bg-superficie-2 h-72 w-full overflow-hidden rounded-xl">
            <img
              src={fotoPeca}
              alt={`Foto do material ${sobra.codigo}`}
              className="h-full w-full object-contain"
            />
          </div>
        </section>
      )}

      <section className="bg-destaque border-destaque-borda flex items-stretch justify-center rounded-xl border py-4">
        <div className="flex flex-1 flex-col items-center justify-end px-2">
          <span className="text-destaque-texto text-sm font-medium opacity-80 mb-1">
            Quantidade
          </span>
          <span className="text-destaque-texto text-2xl sm:text-3xl font-bold tabular-nums text-center leading-none">
            {sobra.quantidade}
            <span className="ml-1 text-sm sm:text-base font-medium">
              {sobra.quantidade === 1 ? 'peça' : 'peças'}
            </span>
          </span>
        </div>
        
        <div className="border-l border-r border-destaque-borda/40 px-3 sm:px-4 flex items-center justify-center">
          <span className="text-destaque-texto text-lg font-medium opacity-80">
            de
          </span>
        </div>

        <div className="flex flex-1 flex-col items-center justify-end px-2">
          <span className="text-destaque-texto text-sm font-medium opacity-80 mb-1">
            Comprimento
          </span>
          <span className="text-destaque-texto text-2xl sm:text-3xl font-bold tabular-nums text-center leading-none">
            {formatarComprimento(sobra.comprimento_mm)}
          </span>
        </div>
      </section>
 
      <FichaDados
        titulo="Dados da peça"
        linhas={[
          { rotulo: 'Reservadas', valor: sobra.quantidade_reservada },
          { rotulo: 'Livres', valor: livres },
          { rotulo: 'Aplicação', valor: sobra.modelo?.aplicacao ?? null },
          {
            rotulo: 'Localização',
            valor: sobra.localizacao ? (
              <Link
                to="/localizacoes"
                className="text-acao-600 inline-flex items-center gap-1 hover:underline"
              >
                <MapPin aria-hidden="true" className="size-3.5" />
                {sobra.localizacao.codigo}
              </Link>
            ) : null,
          },
          { rotulo: 'Estado', valor: ROTULO_ESTADO[sobra.estado] },
          { rotulo: 'Origem', valor: sobra.origem },
          { rotulo: 'Observações', valor: sobra.observacoes },
          {
            rotulo: 'Cadastrada em',
            valor: new Date(sobra.criado_em).toLocaleString('pt-BR'),
          },
        ]}
      />

      {/* Recolhida: é conferência, não o trabalho do dia. Quem abriu a peça
          quer saber se ela serve; a ficha do perfil só entra em cena quando
          a dúvida é "este é mesmo o perfil?". Fica aqui, e não só atrás do
          link para o catálogo, porque sair da tela perde o que se estava
          comparando. */}
      <Secao titulo="Dados técnicos" icone={Layers}>
        <FichaDados
          linhas={[
            { rotulo: 'Código', valor: sobra.modelo?.codigo },
            { rotulo: 'Linha', valor: sobra.modelo?.linha },
            { rotulo: 'Fabricante', valor: sobra.modelo?.fabricante },
            {
              rotulo: 'Medidas (aprox.)',
              valor: sobra.modelo ? formatarMedidasSecao(sobra.modelo) : null,
            },
            {
              rotulo: 'Barra padrão',
              valor: sobra.modelo
                ? formatarComprimento(sobra.modelo.comprimento_barra_mm)
                : null,
            },
            {
              rotulo: 'Peso por metro',
              valor: sobra.modelo?.peso_por_metro_g
                ? `${(sobra.modelo.peso_por_metro_g / 1000)
                    .toFixed(3)
                    .replace('.', ',')} kg/m`
                : null,
            },
            // Peso DESTA peça, não o da barra nova como na ficha do perfil:
            // aqui a unidade que se pega na mão é a sobra, com o comprimento
            // que ela realmente tem.
            {
              rotulo: 'Peso da peça',
              valor: sobra.modelo?.peso_por_metro_g
                ? `${(
                    (sobra.modelo.peso_por_metro_g * sobra.comprimento_mm) /
                    1_000_000
                  )
                    .toFixed(2)
                    .replace('.', ',')} kg`
                : null,
            },
            {
              rotulo: 'Área da seção',
              valor: areaSecaoMm2(sobra.modelo?.peso_por_metro_g ?? null)
                ? formatarAreaSecao(
                    areaSecaoMm2(sobra.modelo?.peso_por_metro_g ?? null)!,
                  )
                : null,
            },
          ]}
        />
      </Secao>

      {/* Histórico: o que aconteceu com esta peça, sem nada apagado. */}
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
                  {m.quantidade} {m.quantidade === 1 ? 'peça' : 'peças'}
                  {m.comprimento_mm
                    ? ` · ${formatarComprimento(m.comprimento_mm)}`
                    : ''}
                  {m.usuario?.nome ? ` · ${m.usuario.nome}` : ''}
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

      {etiqueta && (
        <EtiquetaSobra sobra={sobra} aoFechar={() => setEtiqueta(false)} />
      )}

      {/* "Usar peça" é o primeiro passo do fluxo reservar → retirar → cortar
          (tela Reservas). Existe aqui, e não só em "Procurar sobra", porque
          quem já está com a sobra certa na mão — abriu pelo código, pela
          busca ou por um link — não deveria precisar refazer a busca por
          perfil e comprimento para chegar à mesma peça. */}
      <Modal aberto={usando} aoFechar={() => setUsando(false)} titulo="Usar peça">
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            Reserva peças de <strong className="font-mono">{sobra.codigo}</strong>{' '}
            — o próximo passo (retirar da prateleira e confirmar o corte) fica
            na tela Reservas.
          </p>

          <CampoMedida
            rotulo="Comprimento de cada corte"
            texto={textoMedidaUsar}
            unidade={unidadeUsar}
            aoMudarTexto={setTextoMedidaUsar}
            aoMudarUnidade={setUnidadeUsar}
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
                className="border-destaque-borda bg-destaque text-destaque-texto hover:bg-destaque-hover min-h-14 w-14 shrink-0 rounded-xl border-2 text-2xl font-bold"
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
                className="border-borda bg-superficie min-h-14 min-w-0 flex-1 rounded-xl border-2 text-center text-2xl font-semibold tabular-nums"
              />
              <button
                type="button"
                onClick={() => setQuantidadeCortes((q) => Math.min(999, q + 1))}
                aria-label="Aumentar quantidade de cortes"
                className="border-destaque-borda bg-destaque text-destaque-texto hover:bg-destaque-hover min-h-14 w-14 shrink-0 rounded-xl border-2 text-2xl font-bold"
              >
                +
              </button>
            </div>
          </div>

          {(erroUsar || erroUsarCalculado) && (
            <p role="alert" className="bg-erro-50 text-erro-700 rounded-xl px-4 py-3 text-sm font-medium">
              {erroUsar || erroUsarCalculado}
            </p>
          )}

          <div className="flex gap-3">
            <Botao variante="contorno" onClick={() => setUsando(false)} className="flex-1">
              Cancelar
            </Botao>
            <Botao
              onClick={() => void confirmarUso()}
              carregando={reservar.isPending}
              disabled={!!erroUsarCalculado || !corteMmUsar}
              className="flex-1"
            >
              <PackageCheck aria-hidden="true" className="size-4" />
              Reservar
            </Botao>
          </div>
        </div>
      </Modal>

      {editando && (
        <ModalEditarSobra
          sobra={sobra}
          aberto={editando}
          aoFechar={() => setEditando(false)}
        />
      )}
    </PaginaDetalhe>
  )
}
