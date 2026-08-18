import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Tag, MapPin, ChevronRight, History, Layers } from 'lucide-react'
import { useSobra, useHistoricoDoLote } from '@/dados/sobras'
import { useCapasDesenhos } from '@/dados/desenhosTecnicos'
import { obterLinkTemporario, BALDE_FOTOS } from '@/lib/armazenamento'
import { PaginaDetalhe, FichaDados } from '@/componentes/PaginaDetalhe'
import { Secao } from '@/componentes/ui/Secao'
import { EstadoConsulta } from '@/componentes/EstadoConsulta'
import { MiniaturaPerfil } from '@/componentes/MiniaturaPerfil'
import { EtiquetaSobra } from '@/componentes/EtiquetaSobra'
import { Botao } from '@/componentes/ui/Botao'
import { formatarComprimento } from '@/dominio/medidas'
import {
  areaSecaoMm2,
  formatarAreaSecao,
  formatarMedidasSecao,
} from '@/dominio/secao'
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
  bom: 'bom',
  regular: 'regular',
  ruim: 'ruim',
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
  const { data: sobra, isPending, error, refetch } = useSobra(id ?? null)
  const { data: historico } = useHistoricoDoLote(id ?? null)
  const { data: capas } = useCapasDesenhos('imagem')
  const [etiqueta, setEtiqueta] = useState(false)
  const [fotoPeca, setFotoPeca] = useState<string | null>(null)

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

  return (
    <PaginaDetalhe
      voltarPara="/sobras"
      rotuloVoltar="Sobras"
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
        <Botao variante="contorno" onClick={() => setEtiqueta(true)}>
          <Tag aria-hidden="true" className="size-4" />
          Ver etiqueta
        </Botao>
      }
    >
      {/* O perfil, clicável — leva à ficha técnica completa. */}
      <section>
        <h2 className="mb-2 font-semibold">Perfil</h2>
        <Link
          to={`/perfis/${sobra.modelo_perfil_id}`}
          className="bg-superficie hover:bg-superficie-2 flex items-center gap-3 rounded-xl p-3"
        >
          <MiniaturaPerfil
            link={capas?.get(sobra.modelo_perfil_id)}
            codigo={sobra.modelo?.codigo ?? ''}
          />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">
              <span className="text-acao-600 font-mono">
                {sobra.modelo?.codigo}
              </span>{' '}
              {sobra.modelo?.descricao}
            </span>
            {sobra.modelo?.linha && (
              <span className="text-texto-suave block truncate text-sm">
                {sobra.modelo.linha}
              </span>
            )}
          </span>
          <ChevronRight
            aria-hidden="true"
            className="text-texto-suave size-5 shrink-0"
          />
        </Link>
      </section>

      {fotoPeca && (
        <section>
          <h2 className="mb-2 font-semibold">Foto desta peça</h2>
          <img
            src={fotoPeca}
            alt={`Foto da sobra ${sobra.codigo}`}
            className="bg-superficie-2 max-h-72 w-full rounded-xl object-contain"
          />
        </section>
      )}

      {/* Comprimento e quantidade fora da lista e em corpo grande: são as
          duas perguntas que trazem alguém a esta tela — "cabe o meu corte?"
          e "tem peça suficiente?". No meio de onze linhas iguais, elas
          exigiam procurar; aqui se leem de relance, de longe, no depósito. */}
      {/* `destaque` em vez de um tom fixo da paleta: os tokens do tema
          invertem os papéis no escuro — fundo azul profundo, texto claro. Com
          `acao-50` e `acao-900` fixos, o cartão ficava com texto escuro sobre
          fundo escuro e sumia justamente no tema que se usa no depósito. */}
      <section className="bg-destaque border-destaque-borda grid grid-cols-2 gap-3 rounded-xl border p-4">
        <div>
          <p className="text-destaque-texto text-sm font-medium opacity-80">
            Comprimento
          </p>
          <p className="text-destaque-texto text-3xl font-bold tabular-nums">
            {formatarComprimento(sobra.comprimento_mm)}
          </p>
        </div>
        <div>
          <p className="text-destaque-texto text-sm font-medium opacity-80">
            Quantidade
          </p>
          <p className="text-destaque-texto text-3xl font-bold tabular-nums">
            {sobra.quantidade}
            <span className="ml-1 text-base font-medium">
              {sobra.quantidade === 1 ? 'peça' : 'peças'}
            </span>
          </p>
        </div>
      </section>

      <FichaDados
        titulo="Dados da peça"
        linhas={[
          { rotulo: 'Reservadas', valor: sobra.quantidade_reservada },
          { rotulo: 'Livres', valor: livres },
          {
            rotulo: 'Acabamento',
            valor: sobra.acabamento?.nome ?? null,
          },
          // Vem do perfil, não da peça, mas é aqui que se procura: com a
          // ponta na mão, a pergunta é "onde isto entra na esquadria?".
          {
            rotulo: 'Aplicação',
            valor: sobra.modelo?.aplicacao ?? null,
          },
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
      <Secao titulo="Lista técnica" icone={Layers}>
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
      <section>
        <h2 className="mb-2 flex items-center gap-2 font-semibold">
          <History aria-hidden="true" className="size-4" />
          Histórico
        </h2>

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
      </section>

      {etiqueta && (
        <EtiquetaSobra sobra={sobra} aoFechar={() => setEtiqueta(false)} />
      )}
    </PaginaDetalhe>
  )
}
