import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, PackagePlus } from 'lucide-react'
import { useSobras, type SobraDetalhada } from '@/dados/sobras'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { podeMovimentarEstoque } from '@/autenticacao/contexto'
import { formatarComprimento } from '@/dominio/medidas'
import type { StatusLote } from '@/tipos/banco'

const ROTULO_STATUS: Record<StatusLote, string> = {
  disponivel: 'disponível',
  reservada: 'reservada',
  consumida: 'consumida',
  descartada: 'descartada',
  em_conferencia: 'em conferência',
}

/** Verde para o que dá para usar, âmbar para o que está preso, cinza para o
 *  que saiu do estoque. Vermelho fica reservado a descarte. */
const COR_STATUS: Record<StatusLote, string> = {
  disponivel: 'bg-economia-100 text-economia-700',
  reservada: 'bg-atencao-100 text-atencao-700',
  consumida: 'bg-superficie-2 text-texto-suave',
  descartada: 'bg-erro-50 text-erro-700',
  em_conferencia: 'bg-atencao-50 text-atencao-700',
}

function combina(sobra: SobraDetalhada, termo: string): boolean {
  const busca = termo.trim().toLowerCase()

  if (busca === '') return true

  return (
    sobra.codigo.toLowerCase().includes(busca) ||
    (sobra.modelo?.codigo.toLowerCase().includes(busca) ?? false) ||
    (sobra.modelo?.descricao.toLowerCase().includes(busca) ?? false) ||
    (sobra.acabamento?.nome.toLowerCase().includes(busca) ?? false) ||
    (sobra.localizacao?.codigo.toLowerCase().includes(busca) ?? false)
  )
}

export default function Sobras() {
  const { data: sobras, isPending } = useSobras()
  const { perfil } = useAutenticacao()
  const [busca, setBusca] = useState('')

  const visiveis = (sobras ?? []).filter((sobra) => combina(sobra, busca))

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-6">
      <header className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Sobras</h1>
        {podeMovimentarEstoque(perfil) && (
          <Link
            to="/cadastrar"
            className="bg-acao-600 flex min-h-12 items-center gap-2 rounded-xl px-4 font-semibold text-white"
          >
            <PackagePlus aria-hidden="true" className="size-5" />
            Nova
          </Link>
        )}
      </header>

      <div className="relative mb-4">
        <Search
          aria-hidden="true"
          className="text-texto-suave pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2"
        />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Código, perfil, acabamento ou local"
          aria-label="Buscar sobra"
          className="border-borda bg-superficie min-h-12 w-full rounded-xl border-2 pr-4 pl-12"
        />
      </div>

      {isPending && <p className="text-texto-suave">Carregando…</p>}

      {!isPending && visiveis.length === 0 && (
        <p className="bg-superficie-2 text-texto-suave rounded-xl p-6 text-center">
          {busca
            ? 'Nenhuma sobra encontrada com esse termo.'
            : 'Nenhuma sobra cadastrada ainda.'}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {visiveis.map((sobra) => {
          const disponivel = sobra.quantidade - sobra.quantidade_reservada

          return (
            <li
              key={sobra.id}
              className="bg-superficie rounded-xl p-4 shadow-sm"
            >
              <div className="mb-2 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-semibold">
                    <span className="text-acao-600 font-mono">
                      {sobra.modelo?.codigo}
                    </span>{' '}
                    {sobra.modelo?.descricao}
                  </p>
                  <p className="text-texto-suave truncate text-sm">
                    <span className="font-mono">{sobra.codigo}</span>
                    {sobra.acabamento && ` · ${sobra.acabamento.nome}`}
                    {sobra.localizacao && ` · ${sobra.localizacao.codigo}`}
                  </p>
                </div>

                <span
                  className={`shrink-0 rounded px-2 py-1 text-xs font-medium ${COR_STATUS[sobra.status]}`}
                >
                  {ROTULO_STATUS[sobra.status]}
                </span>
              </div>

              <div className="flex items-baseline gap-4">
                <p className="text-xl font-bold tabular-nums">
                  {formatarComprimento(sobra.comprimento_mm)}
                </p>
                <p className="text-texto-suave text-sm">
                  {disponivel} de {sobra.quantidade}{' '}
                  {sobra.quantidade === 1 ? 'peça' : 'peças'} livre
                  {disponivel === 1 ? '' : 's'}
                </p>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
