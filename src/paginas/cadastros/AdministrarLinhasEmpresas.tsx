import { useState } from 'react'
import { ChevronRight, ShieldOff, Building2 } from 'lucide-react'
import {
  useEmpresasParaAdministrarLinhas,
  useLinhasParaOrganizacao,
  useDefinirLiberacaoLinha,
  useDefinirLiberacaoTodasLinhasOrganizacao,
} from '@/dados/modelosPerfil'
import { useOrganizacao } from '@/dados/organizacao'
import { Botao } from '@/componentes/ui/Botao'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { PaginaLista } from '@/componentes/ui/PaginaLista'
import { cn } from '@/lib/utilitarios'

/**
 * O outro ângulo da mesma liberação de linha criada em "Editar linha"
 * (dentro de Linhas e sistemas) — lá se escolhe uma LINHA e se decide quem
 * pode vê-la; aqui se escolhe uma EMPRESA e se decide quais linhas ela
 * pode ver. As duas mexem na mesma tabela por trás, então uma mudança
 * numa aparece na outra sozinha.
 *
 * Só a organização central chega até o conteúdo de verdade — é ela quem
 * decide o que compartilha do próprio catálogo.
 */
export default function AdministrarLinhasEmpresas() {
  const { data: organizacao } = useOrganizacao()
  const souCentral = Boolean(organizacao?.eh_catalogo_central)

  const { data: empresas, isPending, error } = useEmpresasParaAdministrarLinhas()
  const [empresaSelecionada, setEmpresaSelecionada] = useState<{
    id: string
    nome: string
  } | null>(null)

  const { data: linhas, isPending: linhasCarregando } = useLinhasParaOrganizacao(
    empresaSelecionada?.id ?? null,
  )
  const liberarLinha = useDefinirLiberacaoLinha()
  const liberarTodas = useDefinirLiberacaoTodasLinhasOrganizacao()

  if (!souCentral || error) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-6">
        <BotaoVoltar para="/linhas" rotulo="Linhas" className="mb-4" />
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
            <BotaoVoltar para="/linhas" rotulo="Linhas" className="mb-4" />
          )}

          <header className="mb-5">
            <h1 className="text-2xl font-bold">
              {empresaSelecionada
                ? empresaSelecionada.nome
                : 'Administrar linhas por empresa'}
            </h1>
            <p className="text-texto-suave mt-1">
              {empresaSelecionada
                ? 'Quais linhas do catálogo central esta empresa pode importar ou atualizar.'
                : 'Escolha uma empresa para liberar todas as linhas de uma vez, ou linha por linha.'}
            </p>
          </header>

          {empresaSelecionada && (
            <div className="mb-4 flex gap-2">
              <Botao
                variante="secundaria"
                tamanho="pequeno"
                onClick={() =>
                  void liberarTodas.mutateAsync({
                    organizacaoId: empresaSelecionada.id,
                    liberada: true,
                  })
                }
                carregando={liberarTodas.isPending}
                className="flex-1"
              >
                Liberar todas as linhas
              </Botao>
              <Botao
                variante="secundaria"
                tamanho="pequeno"
                onClick={() =>
                  void liberarTodas.mutateAsync({
                    organizacaoId: empresaSelecionada.id,
                    liberada: false,
                  })
                }
                carregando={liberarTodas.isPending}
                className="flex-1"
              >
                Bloquear todas as linhas
              </Botao>
            </div>
          )}

          {(isPending || (empresaSelecionada && linhasCarregando)) && (
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
                <Building2 aria-hidden="true" className="text-acao-600 size-5 shrink-0" />
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

      {empresaSelecionada && !linhasCarregando && (
        <ul className="flex flex-col gap-1.5">
          {linhas?.map((l) => (
            <li
              key={l.linha}
              className="bg-celula border-borda flex items-center justify-between gap-2 rounded-xl border-2 px-3 py-2.5"
            >
              <span className="min-w-0 flex-1 truncate font-medium">
                {l.linha}
              </span>
              <button
                type="button"
                onClick={() =>
                  void liberarLinha.mutateAsync({
                    linha: l.linha,
                    organizacaoId: empresaSelecionada.id,
                    liberada: !l.liberada,
                  })
                }
                disabled={liberarLinha.isPending}
                className={cn(
                  'shrink-0 rounded-full px-2.5 py-1 text-xs font-medium',
                  l.liberada
                    ? 'bg-economia-50 text-economia-700 hover:bg-economia-100'
                    : 'bg-atencao-50 text-atencao-700 hover:bg-atencao-100',
                )}
              >
                {l.liberada ? 'Liberada' : 'Bloqueada'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </PaginaLista>
  )
}
