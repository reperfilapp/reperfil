import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ClipboardList, Plus, ChevronRight, Layers, Puzzle } from 'lucide-react'
import { useSessoesInventario } from '@/dados/inventario'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { podeMovimentarEstoque } from '@/autenticacao/contexto'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { EstadoConsulta } from '@/componentes/EstadoConsulta'
import { PaginaLista } from '@/componentes/ui/PaginaLista'
import type { StatusSessaoInventario } from '@/tipos/banco'

const ROTULO_STATUS: Record<StatusSessaoInventario, string> = {
  em_andamento: 'em andamento',
  concluida: 'concluída',
  cancelada: 'cancelada',
}

const COR_STATUS: Record<StatusSessaoInventario, string> = {
  em_andamento: 'bg-atencao-100 text-atencao-700',
  concluida: 'bg-economia-50 text-economia-700',
  cancelada: 'bg-superficie-2 text-texto-suave',
}

export default function Inventario() {
  const { data: sessoes, isPending, error, refetch } = useSessoesInventario()
  const { perfil } = useAutenticacao()
  const podeCriar = podeMovimentarEstoque(perfil)
  const [mostrarCancelados, setMostrarCancelados] = useState(false)

  const canceladas = (sessoes ?? []).filter((s) => s.status === 'cancelada')
  const visiveis = mostrarCancelados
    ? (sessoes ?? [])
    : (sessoes ?? []).filter((s) => s.status !== 'cancelada')

  return (
    <PaginaLista
      cabecalho={
        <>
          <BotaoVoltar para="/mais" rotulo="Mais" className="mb-4" />

          <header className="mb-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <ClipboardList
                aria-hidden="true"
                className="text-acao-600 size-7"
              />
              <h1 className="text-2xl font-bold">Inventário</h1>
            </div>
            {podeCriar && (
              <Link
                to="/inventario/novo"
                className="bg-acao-600 flex min-h-12 items-center gap-2 rounded-xl px-4 font-semibold text-white"
              >
                <Plus aria-hidden="true" className="size-5" />
                Novo
              </Link>
            )}
          </header>

          <p className="text-texto-suave mb-4 text-sm">
            Contar não altera o estoque — só a opção "Aplicar", dentro de
            cada sessão, grava a diferença de volta.
          </p>

          <EstadoConsulta
            carregando={isPending}
            erro={error}
            vazio={!isPending && visiveis.length === 0}
            mensagemVazio={
              mostrarCancelados || canceladas.length === (sessoes?.length ?? 0)
                ? 'Nenhum inventário criado ainda.'
                : 'Nenhum inventário em andamento ou concluído — veja os cancelados no fim da lista.'
            }
            aoTentarNovamente={() => void refetch()}
          />
        </>
      }
      rodape={
        !isPending && canceladas.length > 0 ? (
          <button
            type="button"
            onClick={() => setMostrarCancelados((v) => !v)}
            className="text-acao-600 mx-auto block shrink-0 pb-2 text-sm font-medium hover:underline"
          >
            {mostrarCancelados
              ? 'Ocultar cancelados'
              : `Mostrar cancelados (${canceladas.length})`}
          </button>
        ) : undefined
      }
    >
      <ul className="flex flex-col gap-2">
        {visiveis.map((sessao) => (
          <li key={sessao.id}>
            <Link
              to={`/inventario/${sessao.id}`}
              className="bg-celula hover:bg-superficie-2 border-borda flex min-h-16 items-center gap-3 rounded-xl border-2 p-4 shadow-sm"
            >
              {sessao.tipo_item === 'perfil' ? (
                <Layers aria-hidden="true" className="text-acao-600 size-5 shrink-0" />
              ) : (
                <Puzzle aria-hidden="true" className="text-acao-600 size-5 shrink-0" />
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {sessao.titulo ||
                    (sessao.tipo_item === 'perfil' ? 'Perfis' : 'Acessórios')}
                </p>
                <p className="text-texto-suave text-sm">
                  <span className="font-mono">{sessao.codigo}</span> ·{' '}
                  {new Date(sessao.criado_em).toLocaleDateString('pt-BR')}
                </p>
              </div>

              <span
                className={`rounded-full px-2.5 py-1 text-xs font-medium ${COR_STATUS[sessao.status]}`}
              >
                {ROTULO_STATUS[sessao.status]}
              </span>

              <ChevronRight
                aria-hidden="true"
                className="text-texto-suave size-4 shrink-0"
              />
            </Link>
          </li>
        ))}
      </ul>
    </PaginaLista>
  )
}
