import { Link, useParams } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useAcabamentos } from '@/dados/acabamentos'
import { useSobras } from '@/dados/sobras'
import { PaginaDetalhe, FichaDados } from '@/componentes/PaginaDetalhe'
import { EstadoConsulta } from '@/componentes/EstadoConsulta'
import { formatarComprimento } from '@/dominio/medidas'
import type { TipoAcabamento } from '@/tipos/banco'

const ROTULO_TIPO: Record<TipoAcabamento, string> = {
  pintura: 'Pintura',
  anodizado: 'Anodizado',
  natural: 'Natural',
  outro: 'Outro',
}

/**
 * Ficha do acabamento.
 *
 * Além do cadastro, mostra QUANTO existe neste acabamento e em quais perfis.
 * É a informação que falta quando se pergunta "vale a pena continuar
 * comprando nessa cor?" — e a que revela acabamento cadastrado por engano,
 * que fica com estoque zero para sempre.
 */
export default function AcabamentoDetalhe() {
  const { id } = useParams<{ id: string }>()
  const { data: acabamentos, isPending, error, refetch } = useAcabamentos(true)
  const { data: sobras } = useSobras()

  const acabamento = acabamentos?.find((a) => a.id === id)

  if (isPending || error || !acabamento) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-6">
        <EstadoConsulta
          carregando={isPending}
          erro={error}
          vazio={!isPending && !acabamento}
          mensagemVazio="Acabamento não encontrado."
          aoTentarNovamente={() => void refetch()}
        />
      </div>
    )
  }

  const lotes = (sobras ?? []).filter(
    (s) =>
      s.acabamento_id === acabamento.id &&
      (s.status === 'disponivel' || s.status === 'reservada'),
  )

  const pecas = lotes.reduce(
    (t, l) => t + (l.quantidade - l.quantidade_reservada),
    0,
  )
  const milimetros = lotes.reduce(
    (t, l) => t + (l.quantidade - l.quantidade_reservada) * l.comprimento_mm,
    0,
  )

  // Agrupa por perfil, para mostrar onde esta cor está sendo usada.
  const porPerfil = new Map<
    string,
    { codigo: string; descricao: string; pecas: number }
  >()

  for (const lote of lotes) {
    const chave = lote.modelo_perfil_id
    const atual = porPerfil.get(chave) ?? {
      codigo: lote.modelo?.codigo ?? '',
      descricao: lote.modelo?.descricao ?? '',
      pecas: 0,
    }

    atual.pecas += lote.quantidade - lote.quantidade_reservada
    porPerfil.set(chave, atual)
  }

  const perfis = [...porPerfil.entries()].sort(
    (a, b) => b[1].pecas - a[1].pecas,
  )

  return (
    <PaginaDetalhe
      voltarPara="/acabamentos"
      rotuloVoltar="Acabamentos"
      codigo={acabamento.codigo}
      titulo={acabamento.nome}
      subtitulo={ROTULO_TIPO[acabamento.tipo]}
      selo={
        <div className="flex items-center gap-2">
          {acabamento.cor_hex && (
            <span
              aria-hidden="true"
              className="border-borda size-8 rounded-full border"
              style={{ backgroundColor: acabamento.cor_hex }}
            />
          )}
          {!acabamento.ativo && (
            <span className="bg-superficie-2 text-texto-suave rounded px-2 py-1 text-xs">
              inativo
            </span>
          )}
        </div>
      }
    >
      <section>
        <h2 className="mb-2 font-semibold">Em estoque</h2>
        <div className="bg-aluminio-100 text-grafite-800 flex items-baseline gap-4 rounded-xl p-4">
          <p className="text-3xl font-bold tabular-nums">{pecas}</p>
          <div className="text-sm">
            <p>{pecas === 1 ? 'peça livre' : 'peças livres'}</p>
            <p>{formatarComprimento(milimetros)} no total</p>
          </div>
        </div>
      </section>

      <FichaDados
        titulo="Cadastro"
        linhas={[
          { rotulo: 'Código', valor: acabamento.codigo },
          { rotulo: 'Nome', valor: acabamento.nome },
          { rotulo: 'Tipo', valor: ROTULO_TIPO[acabamento.tipo] },
          { rotulo: 'Código RAL', valor: acabamento.codigo_ral },
          { rotulo: 'Descrição', valor: acabamento.descricao },
        ]}
      />

      <section>
        <h2 className="mb-2 font-semibold">
          Perfis com este acabamento
          {perfis.length > 0 && (
            <span className="text-texto-suave font-normal">
              {' '}
              ({perfis.length})
            </span>
          )}
        </h2>

        {perfis.length === 0 ? (
          <p className="bg-superficie-2 text-texto-suave rounded-xl p-4 text-sm">
            Nenhuma peça em estoque com este acabamento.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {perfis.map(([perfilId, dados]) => (
              <li key={perfilId}>
                <Link
                  to={`/perfis/${perfilId}`}
                  className="bg-superficie hover:bg-superficie-2 flex items-center gap-3 rounded-xl p-3 text-sm"
                >
                  <span className="min-w-0 flex-1 truncate">
                    <span className="text-acao-600 font-mono">
                      {dados.codigo}
                    </span>{' '}
                    {dados.descricao}
                  </span>
                  <span className="text-texto-suave shrink-0 tabular-nums">
                    {dados.pecas} {dados.pecas === 1 ? 'peça' : 'peças'}
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
    </PaginaDetalhe>
  )
}
