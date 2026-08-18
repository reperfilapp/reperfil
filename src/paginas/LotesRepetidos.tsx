import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CopyCheck, Merge, CheckCircle2 } from 'lucide-react'
import { useSobras, useJuntarLotes } from '@/dados/sobras'
import { useAcabamentos } from '@/dados/acabamentos'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { podeMovimentarEstoque } from '@/autenticacao/contexto'
import { duplicadosNoEstoque, podeSerJuntado } from '@/dominio/duplicidade'
import { formatarComprimento } from '@/dominio/medidas'
import { Botao } from '@/componentes/ui/Botao'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { PaginaLista } from '@/componentes/ui/PaginaLista'

/**
 * Lotes que são a mesma coisa cadastrada duas vezes.
 *
 * ── POR QUE ISTO PRECISA EXISTIR ─────────────────────────────────────────
 *
 * O aviso no cadastro resolve daqui para a frente. Mas o estoque atual foi
 * montado antes dele — por importação de planilha, por duas pessoas
 * lançando a mesma remessa, ou por quem cadastrou de novo em vez de aumentar
 * a quantidade. Quem procura material vê "8 peças" e "51 peças" em vez de
 * 59, e desiste de um corte que caberia.
 *
 * ── JUNTAR NÃO APAGA NADA ────────────────────────────────────────────────
 *
 * As peças passam para o lote mais antigo — o que já está etiquetado na
 * prateleira — e o lote esvaziado vai para "consumida", com o histórico
 * intacto. Nenhuma movimentação some, e dá para reconstituir o que aconteceu
 * olhando o histórico dos dois.
 */
export default function LotesRepetidos() {
  const { perfil } = useAutenticacao()
  const podeJuntar = podeMovimentarEstoque(perfil)

  const { data: sobras, isPending } = useSobras()
  const { data: acabamentos } = useAcabamentos()
  const juntarLotes = useJuntarLotes()

  const [erro, setErro] = useState<string | null>(null)
  const [juntando, setJuntando] = useState<string | null>(null)

  const grupos = duplicadosNoEstoque(sobras ?? [])

  const nomeAcabamento = (id: string) =>
    acabamentos?.find((a) => a.id === id)?.nome ?? 'acabamento removido'

  async function juntar(grupoIndice: number) {
    const grupo = grupos[grupoIndice]

    if (!grupo) return

    const [destino, ...outros] = grupo.lotes

    if (!destino) return

    setErro(null)
    setJuntando(destino.id)

    try {
      // Um de cada vez, e não em paralelo: cada junção soma ao mesmo lote
      // de destino, e em paralelo duas somas partiriam da mesma quantidade
      // antiga.
      for (const lote of outros) {
        if (!podeSerJuntado(lote)) continue

        await juntarLotes.mutateAsync({
          destinoId: destino.id,
          origemId: lote.id,
        })
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível juntar.')
    } finally {
      setJuntando(null)
    }
  }

  return (
    <PaginaLista
      className="max-w-2xl"
      cabecalho={
        <>
          <BotaoVoltar para="/sobras" rotulo="Sobras" className="mb-4" />

          <header className="mb-4">
            <h1 className="text-2xl font-bold">Lotes repetidos</h1>
            <p className="text-texto-suave mt-1">
              Lotes disponíveis com o mesmo perfil, acabamento e comprimento — o
              mesmo material contado em dois lugares.
            </p>
          </header>

          {isPending && <p className="text-texto-suave">Procurando…</p>}

          {erro && (
            <p
              role="alert"
              className="bg-erro-50 text-erro-700 mb-4 rounded-xl px-4 py-3"
            >
              {erro}
            </p>
          )}
        </>
      }
    >
      {!isPending && grupos.length === 0 && (
        <div className="bg-superficie-2 flex items-start gap-3 rounded-xl p-6">
          <CheckCircle2
            aria-hidden="true"
            className="text-texto-suave mt-0.5 size-6 shrink-0"
          />
          <p className="text-texto-suave">
            Nenhum lote repetido. Peças do mesmo perfil com comprimentos
            diferentes não contam: 5 m não substitui 6 m na hora do corte.
          </p>
        </div>
      )}

      <ul className="flex flex-col gap-3">
        {grupos.map((grupo, indice) => {
          const destino = grupo.lotes[0]
          const travados = grupo.lotes.filter((l) => !podeSerJuntado(l))

          if (!destino) return null

          return (
            <li
              key={destino.id}
              className="bg-superficie rounded-xl p-4 shadow-sm"
            >
              <p className="font-semibold">
                <span className="text-acao-600 font-mono">
                  {destino.modelo?.codigo}
                </span>{' '}
                {destino.modelo?.descricao}
              </p>
              <p className="text-texto-suave text-sm">
                {nomeAcabamento(destino.acabamento_id)} ·{' '}
                {formatarComprimento(destino.comprimento_mm)} ·{' '}
                <strong>{grupo.pecas} peças no total</strong>
              </p>

              <ul className="mt-3 flex flex-col gap-1">
                {grupo.lotes.map((lote, posicao) => (
                  <li
                    key={lote.id}
                    className="border-borda flex items-center gap-2 border-b py-1.5 text-sm last:border-0"
                  >
                    <Link
                      to={`/sobras/${lote.id}`}
                      className="text-acao-600 font-mono"
                    >
                      {lote.codigo}
                    </Link>
                    <span className="text-texto-suave flex-1">
                      {lote.quantidade}{' '}
                      {lote.quantidade === 1 ? 'peça' : 'peças'}
                      {lote.quantidade_reservada > 0 &&
                        ` · ${lote.quantidade_reservada} reservada${lote.quantidade_reservada === 1 ? '' : 's'}`}
                    </span>
                    {posicao === 0 && (
                      <span className="bg-superficie-2 text-texto-suave rounded px-2 py-0.5 text-xs">
                        fica com tudo
                      </span>
                    )}
                  </li>
                ))}
              </ul>

              {travados.length > 0 && (
                <p className="text-atencao-700 mt-2 text-sm">
                  {travados.length === 1 ? 'Um lote tem' : 'Alguns lotes têm'}{' '}
                  peça reservada e {travados.length === 1 ? 'fica' : 'ficam'} de
                  fora: a reserva aponta para o lote, e mover as peças a
                  deixaria apontando para o vazio. Cancele ou conclua a reserva
                  antes.
                </p>
              )}

              {podeJuntar && (
                <Botao
                  variante="secundaria"
                  onClick={() => void juntar(indice)}
                  carregando={juntando === destino.id}
                  className="mt-3 w-full"
                >
                  <Merge aria-hidden="true" className="size-5" />
                  Juntar em {destino.codigo}
                </Botao>
              )}
            </li>
          )
        })}
      </ul>

      {!isPending && grupos.length > 0 && (
        <p className="text-texto-suave mt-4 flex items-start gap-2 text-sm">
          <CopyCheck aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          Juntar não apaga nada: as peças passam para o lote mais antigo, e o
          outro fica registrado como consumido, com o histórico inteiro.
        </p>
      )}
    </PaginaLista>
  )
}
