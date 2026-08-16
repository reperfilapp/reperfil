import { Link, useParams } from 'react-router-dom'
import { ChevronRight, MapPin } from 'lucide-react'
import { useLocalizacoes, descreverLocalizacao } from '@/dados/localizacoes'
import { useSobras } from '@/dados/sobras'
import { PaginaDetalhe, FichaDados } from '@/componentes/PaginaDetalhe'
import { EstadoConsulta } from '@/componentes/EstadoConsulta'
import { formatarComprimento } from '@/dominio/medidas'

/**
 * Ficha da localização.
 *
 * O que importa aqui não é o cadastro — é a **lista de separação**: o que
 * está guardado nesta prateleira. É a tela que se abre antes de ir até lá.
 */
export default function LocalizacaoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const { data: locais, isPending, error, refetch } = useLocalizacoes(true)
  const { data: sobras } = useSobras()

  const local = locais?.find((l) => l.id === id)

  if (isPending || error || !local) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-6">
        <EstadoConsulta
          carregando={isPending}
          erro={error}
          vazio={!isPending && !local}
          mensagemVazio="Localização não encontrada."
          aoTentarNovamente={() => void refetch()}
        />
      </div>
    )
  }

  const guardadas = (sobras ?? [])
    .filter(
      (s) =>
        s.localizacao_id === local.id &&
        (s.status === 'disponivel' || s.status === 'reservada'),
    )
    .sort((a, b) => a.comprimento_mm - b.comprimento_mm)

  const pecas = guardadas.reduce(
    (t, l) => t + (l.quantidade - l.quantidade_reservada),
    0,
  )
  const milimetros = guardadas.reduce(
    (t, l) => t + (l.quantidade - l.quantidade_reservada) * l.comprimento_mm,
    0,
  )

  return (
    <PaginaDetalhe
      voltarPara="/localizacoes"
      rotuloVoltar="Localizações"
      codigo={local.codigo}
      titulo={descreverLocalizacao(local)}
      selo={
        !local.ativo ? (
          <span className="bg-superficie-2 text-texto-suave rounded px-2 py-1 text-xs">
            inativa
          </span>
        ) : null
      }
    >
      <section>
        <h2 className="mb-2 font-semibold">Guardado aqui</h2>
        <div className="bg-economia-50 text-economia-700 flex items-baseline gap-4 rounded-xl p-4">
          <p className="text-3xl font-bold tabular-nums">{pecas}</p>
          <div className="text-sm">
            <p>{pecas === 1 ? 'peça' : 'peças'}</p>
            <p>{formatarComprimento(milimetros)} no total</p>
          </div>
        </div>
      </section>

      <section>
        <h2 className="mb-2 font-semibold">
          Peças nesta posição
          {guardadas.length > 0 && (
            <span className="text-texto-suave font-normal">
              {' '}
              ({guardadas.length})
            </span>
          )}
        </h2>

        {guardadas.length === 0 ? (
          <p className="bg-superficie-2 text-texto-suave rounded-xl p-4 text-sm">
            Nada guardado nesta posição.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {guardadas.map((s) => (
              <li key={s.id}>
                <Link
                  to={`/sobras/${s.id}`}
                  className="bg-superficie hover:bg-superficie-2 flex items-center gap-3 rounded-xl p-3 text-sm"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate">
                      <span className="font-mono">{s.codigo}</span> ·{' '}
                      {s.modelo?.codigo}
                    </span>
                    <span className="text-texto-suave block truncate text-xs">
                      {s.acabamento?.nome}
                    </span>
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold tabular-nums">
                      {formatarComprimento(s.comprimento_mm)}
                    </span>
                    <span className="text-texto-suave text-xs">
                      {s.quantidade - s.quantidade_reservada} livre
                      {s.quantidade - s.quantidade_reservada === 1 ? '' : 's'}
                    </span>
                  </span>
                  <ChevronRight
                    aria-hidden="true"
                    className="text-texto-suave size-4 shrink-0"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <FichaDados
        titulo="Endereço no depósito"
        linhas={[
          { rotulo: 'Código', valor: local.codigo },
          { rotulo: 'Depósito', valor: local.deposito },
          { rotulo: 'Setor', valor: local.setor },
          { rotulo: 'Corredor', valor: local.corredor },
          { rotulo: 'Estante', valor: local.estante },
          { rotulo: 'Prateleira', valor: local.prateleira },
          { rotulo: 'Posição', valor: local.posicao },
          { rotulo: 'Observação', valor: local.observacao },
        ]}
      />

      <p className="text-texto-suave flex items-start gap-2 text-sm">
        <MapPin aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
        Todos os níveis são opcionais — cada galpão se organiza de um jeito.
      </p>
    </PaginaDetalhe>
  )
}
