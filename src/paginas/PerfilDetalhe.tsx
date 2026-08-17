import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Search, ZoomIn, X, ExternalLink } from 'lucide-react'
import { useModelosPerfil } from '@/dados/modelosPerfil'
import { useDesenhosTecnicos } from '@/dados/desenhosTecnicos'
import { useSobras } from '@/dados/sobras'
import { EstadoConsulta } from '@/componentes/EstadoConsulta'
import { Botao } from '@/componentes/ui/Botao'
import { formatarComprimento } from '@/dominio/medidas'

/**
 * Ficha do perfil: o que ele é, como é a seção, e quanto existe no depósito.
 *
 * Responde a pergunta que o serralheiro faz com a peça na mão: "é este mesmo
 * perfil?". Por isso o desenho vem primeiro e grande, e o estoque logo
 * abaixo, agrupado por acabamento e comprimento — que é como ele procura.
 */
export default function PerfilDetalhe() {
  const { id } = useParams<{ id: string }>()
  const { data: modelos, isPending, error } = useModelosPerfil(true)
  const { data: desenhos } = useDesenhosTecnicos(id ?? null, 'imagem')
  const { data: fotos } = useDesenhosTecnicos(id ?? null, 'foto')
  const { data: sobras } = useSobras()
  const [ampliado, setAmpliado] = useState<string | null>(null)

  const modelo = modelos?.find((m) => m.id === id)

  if (isPending || error || !modelo) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-6">
        <EstadoConsulta
          carregando={isPending}
          erro={error}
          vazio={!isPending && !modelo}
          mensagemVazio="Perfil não encontrado."
        />
      </div>
    )
  }

  // Só o que está fisicamente no depósito.
  const lotes = (sobras ?? []).filter(
    (s) =>
      s.modelo_perfil_id === modelo.id &&
      (s.status === 'disponivel' || s.status === 'reservada'),
  )

  const pecasLivres = lotes.reduce(
    (t, l) => t + (l.quantidade - l.quantidade_reservada),
    0,
  )
  const milimetrosLivres = lotes.reduce(
    (t, l) => t + (l.quantidade - l.quantidade_reservada) * l.comprimento_mm,
    0,
  )

  // Agrupa por acabamento e comprimento — é como se procura uma peça.
  const porAcabamento = new Map<
    string,
    { comprimentoMm: number; livres: number; total: number }[]
  >()

  for (const lote of lotes) {
    const nome = lote.acabamento?.nome ?? 'sem acabamento'
    const lista = porAcabamento.get(nome) ?? []

    lista.push({
      comprimentoMm: lote.comprimento_mm,
      livres: lote.quantidade - lote.quantidade_reservada,
      total: lote.quantidade,
    })

    porAcabamento.set(nome, lista)
  }

  for (const lista of porAcabamento.values()) {
    lista.sort((a, b) => a.comprimentoMm - b.comprimentoMm)
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-6">
      <Link
        to="/perfis"
        className="border-borda bg-superficie hover:bg-superficie-2 text-texto mb-4 inline-flex min-h-10 items-center gap-1.5 rounded-lg border-2 px-3 text-sm font-semibold"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        Perfis
      </Link>

      <header className="mb-5">
        <p className="text-acao-600 font-mono text-lg font-bold">
          {modelo.codigo}
        </p>
        <h1 className="text-2xl font-bold">{modelo.descricao}</h1>
        {modelo.linha && (
          <p className="text-texto-suave mt-1">{modelo.linha}</p>
        )}
        {modelo.aplicacao && (
          <p className="text-acao-700 bg-acao-50 mt-2 inline-block rounded-lg px-2 py-1 text-sm">
            {modelo.aplicacao}
          </p>
        )}
      </header>

      {/* Desenhos primeiro: é o que identifica a peça. */}
      {desenhos && desenhos.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 font-semibold">Desenho técnico</h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {desenhos.map((d) =>
              d.link ? (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setAmpliado(d.link)}
                  className="border-borda relative shrink-0 overflow-hidden rounded-xl border-2 bg-white"
                  aria-label={`Ampliar ${d.legenda ?? 'desenho'}`}
                >
                  <img
                    src={d.link}
                    alt={d.legenda ?? `Desenho de ${modelo.codigo}`}
                    className="h-40 w-56 object-contain p-1"
                  />
                  <span className="bg-grafite-900/70 absolute right-1.5 bottom-1.5 rounded-full p-1.5 text-white">
                    <ZoomIn aria-hidden="true" className="size-4" />
                  </span>
                </button>
              ) : null,
            )}
          </div>
          <p className="text-texto-suave mt-1 text-xs">
            Toque para ampliar e ler as cotas.
          </p>
        </section>
      )}

      {/* Fotos da peça real, logo abaixo do desenho: juntos permitem a
          conferência que o desenho sozinho não dá — cor, brilho, estado. */}
      {fotos && fotos.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 font-semibold">Fotos do perfil</h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {fotos.map((f) =>
              f.link ? (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setAmpliado(f.link)}
                  className="border-borda bg-superficie-2 relative shrink-0 overflow-hidden rounded-xl border-2"
                  aria-label={`Ampliar ${f.legenda ?? 'foto'}`}
                >
                  <img
                    src={f.link}
                    alt={f.legenda ?? `Foto do perfil ${modelo.codigo}`}
                    className="h-40 w-56 object-cover"
                  />
                  <span className="bg-grafite-900/70 absolute right-1.5 bottom-1.5 rounded-full p-1.5 text-white">
                    <ZoomIn aria-hidden="true" className="size-4" />
                  </span>
                  {f.legenda && (
                    <span className="bg-grafite-900/70 absolute inset-x-0 bottom-0 truncate px-2 py-1 text-left text-xs text-white">
                      {f.legenda}
                    </span>
                  )}
                </button>
              ) : null,
            )}
          </div>
        </section>
      )}

      {/* Estoque */}
      <section className="mb-6">
        <h2 className="mb-2 font-semibold">Disponível no depósito</h2>

        {lotes.length === 0 ? (
          <p className="bg-superficie-2 text-texto-suave rounded-xl p-5 text-center text-sm">
            Nenhuma peça deste perfil em estoque.
          </p>
        ) : (
          <>
            <div className="bg-economia-50 text-economia-700 mb-3 flex items-baseline gap-4 rounded-xl p-4">
              <p className="text-3xl font-bold tabular-nums">{pecasLivres}</p>
              <div className="text-sm">
                <p>{pecasLivres === 1 ? 'peça livre' : 'peças livres'}</p>
                <p>{formatarComprimento(milimetrosLivres)} no total</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {[...porAcabamento.entries()].map(([acabamento, linhas]) => (
                <div key={acabamento} className="bg-superficie rounded-xl p-3">
                  <p className="mb-1.5 font-medium">{acabamento}</p>
                  <ul className="flex flex-col gap-1">
                    {linhas.map((l, i) => (
                      <li
                        key={`${l.comprimentoMm}-${i}`}
                        className="flex items-baseline justify-between gap-3 text-sm"
                      >
                        <span className="tabular-nums">
                          {formatarComprimento(l.comprimentoMm)}
                        </span>
                        <span className="text-texto-suave">
                          {l.livres} de {l.total}{' '}
                          {l.total === 1 ? 'livre' : 'livres'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <Link
              to="/procurar"
              className="border-borda bg-superficie hover:bg-superficie-2 mt-3 flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 font-semibold"
            >
              <Search aria-hidden="true" className="size-5" />
              Procurar peça para um corte
            </Link>
          </>
        )}
      </section>

      {/* Ficha técnica */}
      <section>
        <h2 className="mb-2 font-semibold">Ficha técnica</h2>
        <dl className="bg-superficie grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl p-4 text-sm">
          <dt className="text-texto-suave">Código</dt>
          <dd className="text-right font-mono">{modelo.codigo}</dd>

          <dt className="text-texto-suave">Linha</dt>
          <dd className="text-right">{modelo.linha ?? '—'}</dd>

          <dt className="text-texto-suave">Aplicação</dt>
          <dd className="text-right">{modelo.aplicacao ?? '—'}</dd>

          <dt className="text-texto-suave">Fabricante</dt>
          <dd className="text-right">{modelo.fabricante ?? '—'}</dd>

          <dt className="text-texto-suave">Barra padrão</dt>
          <dd className="text-right tabular-nums">
            {formatarComprimento(modelo.comprimento_barra_mm)}
          </dd>

          <dt className="text-texto-suave">Peso por metro</dt>
          <dd className="text-right tabular-nums">
            {modelo.peso_por_metro_g
              ? `${(modelo.peso_por_metro_g / 1000).toFixed(3).replace('.', ',')} kg/m`
              : '—'}
          </dd>

          {modelo.peso_por_metro_g && (
            <>
              <dt className="text-texto-suave">Peso da barra</dt>
              <dd className="text-right tabular-nums">
                {(
                  (modelo.peso_por_metro_g * modelo.comprimento_barra_mm) /
                  1_000_000
                )
                  .toFixed(2)
                  .replace('.', ',')}{' '}
                kg
              </dd>
            </>
          )}
        </dl>

        {modelo.observacoes && (
          <div className="bg-superficie-2 text-texto-suave mt-3 rounded-xl p-4 text-sm">
            {modelo.observacoes.split('\n').map((linha, i) => {
              const url = linha.match(/https?:\/\/\S+/)?.[0]

              return (
                <p key={i} className="mb-1 last:mb-0">
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-acao-600 inline-flex items-center gap-1 hover:underline"
                    >
                      Ficha do fabricante
                      <ExternalLink aria-hidden="true" className="size-3.5" />
                    </a>
                  ) : (
                    linha
                  )}
                </p>
              )
            })}
          </div>
        )}
      </section>

      {ampliado && (
        <div
          role="dialog"
          aria-label="Desenho ampliado"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setAmpliado(null)}
        >
          <img
            src={ampliado}
            alt="Desenho técnico ampliado"
            className="max-h-full max-w-full object-contain"
          />
          <Botao
            variante="secundaria"
            onClick={() => setAmpliado(null)}
            aria-label="Fechar"
            className="absolute top-4 right-4"
          >
            <X aria-hidden="true" className="size-5" />
          </Botao>
        </div>
      )}
    </div>
  )
}
