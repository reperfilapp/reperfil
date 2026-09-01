import { useState } from 'react'
import { ChevronRight, ShieldOff, Building2, Palette } from 'lucide-react'
import { useEmpresasParaAdministrarLinhas } from '@/dados/modelosPerfil'
import {
  useAcabamentosParaOrganizacao,
  useDefinirLiberacaoAcabamento,
  useDefinirLiberacaoTodosAcabamentosOrganizacao,
} from '@/dados/acabamentos'
import { useOrganizacao } from '@/dados/organizacao'
import { Botao } from '@/componentes/ui/Botao'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { PaginaLista } from '@/componentes/ui/PaginaLista'
import { cn } from '@/lib/utilitarios'
import { disparar } from '@/lib/avisoErro'

/**
 * Gêmea de `AdministrarAcessoriosEmpresas.tsx` — mesma mecânica de
 * liberação, agora para acabamento. Mais simples: sem desenho/foto, então
 * sem miniatura na lista.
 */
export default function AdministrarAcabamentosEmpresas() {
  const { data: organizacao } = useOrganizacao()
  const souCentral = Boolean(organizacao?.eh_catalogo_central)

  const {
    data: empresas,
    isPending,
    error,
  } = useEmpresasParaAdministrarLinhas()
  const [empresaSelecionada, setEmpresaSelecionada] = useState<{
    id: string
    nome: string
  } | null>(null)

  const { data: acabamentos, isPending: acabamentosCarregando } =
    useAcabamentosParaOrganizacao(empresaSelecionada?.id ?? null)
  const liberarAcabamento = useDefinirLiberacaoAcabamento()
  const liberarTodos = useDefinirLiberacaoTodosAcabamentosOrganizacao()

  if (!souCentral || error) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-6">
        <BotaoVoltar para="/acabamentos" rotulo="Acabamentos" className="mb-4" />
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-xl p-8 text-center"
        >
          <ShieldOff aria-hidden="true" className="text-texto-suave size-10" />
          <p className="text-texto-suave">
            Só quem administra o catálogo central acessa esta tela.
          </p>
        </div>
      </div>
    )
  }

  return (
    <PaginaLista
      className="max-w-3xl"
      cabecalho={
        <>
          {empresaSelecionada ? (
            <BotaoVoltar
              onClick={() => setEmpresaSelecionada(null)}
              rotulo="Empresas"
              className="mb-4"
            />
          ) : (
            <BotaoVoltar
              para="/acabamentos"
              rotulo="Acabamentos"
              className="mb-4"
            />
          )}

          <header className="mb-5">
            <h1 className="text-2xl font-bold">
              {empresaSelecionada
                ? empresaSelecionada.nome
                : 'Administrar acabamentos por empresa'}
            </h1>
            <p className="text-texto-suave mt-1">
              {empresaSelecionada
                ? 'Quais acabamentos do catálogo central esta empresa pode importar.'
                : 'Escolha uma empresa para liberar todos os acabamentos de uma vez, ou um por um.'}
            </p>
          </header>

          {empresaSelecionada && (
            <div className="mb-4 flex gap-2">
              <Botao
                variante="secundaria"
                tamanho="pequeno"
                onClick={() =>
                  disparar(
                    liberarTodos.mutateAsync({
                      organizacaoId: empresaSelecionada.id,
                      liberada: true,
                    }),
                  )
                }
                carregando={liberarTodos.isPending}
                className="flex-1"
              >
                Liberar todos
              </Botao>
              <Botao
                variante="secundaria"
                tamanho="pequeno"
                onClick={() =>
                  disparar(
                    liberarTodos.mutateAsync({
                      organizacaoId: empresaSelecionada.id,
                      liberada: false,
                    }),
                  )
                }
                carregando={liberarTodos.isPending}
                className="flex-1"
              >
                Bloquear todos
              </Botao>
            </div>
          )}

          {(isPending || (empresaSelecionada && acabamentosCarregando)) && (
            <p className="text-texto-suave">Carregando…</p>
          )}
        </>
      }
    >
      {!empresaSelecionada && !isPending && empresas?.length === 0 && (
        <p className="bg-superficie-2 text-texto-suave rounded-xl p-6 text-center">
          Nenhuma outra empresa cadastrada ainda.
        </p>
      )}

      {!empresaSelecionada && !isPending && (
        <ul className="flex flex-col gap-2">
          {empresas?.map((empresa) => (
            <li key={empresa.organizacao_id}>
              <button
                type="button"
                onClick={() =>
                  setEmpresaSelecionada({
                    id: empresa.organizacao_id,
                    nome: empresa.nome_fantasia,
                  })
                }
                className="bg-celula hover:bg-superficie-2 border-borda flex min-h-16 w-full items-center gap-3 rounded-xl border-2 p-4 text-left shadow-sm"
              >
                <Building2
                  aria-hidden="true"
                  className="text-acao-600 size-5 shrink-0"
                />
                <span className="min-w-0 flex-1 truncate font-medium">
                  {empresa.nome_fantasia}
                </span>
                <ChevronRight
                  aria-hidden="true"
                  className="text-texto-suave size-4 shrink-0"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      {empresaSelecionada &&
        !acabamentosCarregando &&
        acabamentos?.length === 0 && (
          <p className="bg-superficie-2 text-texto-suave rounded-xl p-6 text-center">
            O catálogo central ainda não tem acabamentos para liberar.
          </p>
        )}

      {empresaSelecionada && !acabamentosCarregando && (
        <ul className="flex flex-col gap-1.5">
          {acabamentos?.map((a) => (
            <li
              key={a.acabamento_id}
              className="bg-celula border-borda flex items-center gap-3 rounded-xl border-2 px-3 py-2.5"
            >
              <div className="border-borda bg-superficie-2 flex size-10 shrink-0 items-center justify-center rounded-lg border">
                <Palette aria-hidden="true" className="text-texto-suave size-5" />
              </div>
              <span className="min-w-0 flex-1 font-medium">{a.nome}</span>
              <button
                type="button"
                onClick={() =>
                  disparar(
                    liberarAcabamento.mutateAsync({
                      acabamentoId: a.acabamento_id,
                      organizacaoId: empresaSelecionada.id,
                      liberada: !a.liberada,
                    }),
                  )
                }
                disabled={liberarAcabamento.isPending}
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
                  a.liberada
                    ? 'bg-economia-50 text-economia-700 hover:bg-economia-100'
                    : 'bg-atencao-50 text-atencao-700 hover:bg-atencao-100',
                )}
              >
                {a.liberada ? 'Liberado' : 'Bloqueado'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </PaginaLista>
  )
}
