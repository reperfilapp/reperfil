import { useState } from 'react'
import { Search, Check } from 'lucide-react'
import { useModelosPerfil, filtrarModelos } from '@/dados/modelosPerfil'
import { cn } from '@/lib/utilitarios'
import type { ModeloPerfil } from '@/tipos/banco'

interface PropsSeletorPerfil {
  selecionado: ModeloPerfil | null
  aoSelecionar: (modelo: ModeloPerfil) => void
}

/**
 * Escolha do modelo de perfil, com busca por código, descrição ou linha.
 *
 * A busca filtra a lista já carregada, sem ir ao servidor a cada tecla: o
 * catálogo de uma serralheria cabe na memória, e resposta instantânea importa
 * mais do que economia de memória quando a pessoa está de pé no depósito com
 * a peça na mão.
 */
export function SeletorPerfil({
  selecionado,
  aoSelecionar,
}: PropsSeletorPerfil) {
  const { data: modelos, isPending } = useModelosPerfil()
  const [busca, setBusca] = useState('')

  const encontrados = filtrarModelos(modelos ?? [], busca)

  if (selecionado) {
    return (
      <div className="border-economia-500 bg-economia-50 flex items-center gap-3 rounded-xl border-2 p-4">
        <Check
          aria-hidden="true"
          className="text-economia-700 size-6 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="text-grafite-900 truncate font-semibold">
            <span className="font-mono">{selecionado.codigo}</span>{' '}
            {selecionado.descricao}
          </p>
          {selecionado.linha && (
            <p className="text-grafite-600 truncate text-sm">
              {selecionado.linha}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Search
          aria-hidden="true"
          className="text-texto-suave pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2"
        />
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Código ou descrição do perfil"
          aria-label="Buscar perfil"
          autoFocus
          className="border-borda bg-superficie min-h-16 w-full rounded-xl border-2 pr-4 pl-12 text-lg"
        />
      </div>

      {isPending && <p className="text-texto-suave">Carregando perfis…</p>}

      {!isPending && encontrados.length === 0 && (
        <p className="bg-superficie-2 text-texto-suave rounded-xl p-5 text-center">
          {busca
            ? 'Nenhum perfil com esse termo.'
            : 'Nenhum perfil cadastrado. Cadastre em Mais → Modelos de perfil.'}
        </p>
      )}

      <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
        {encontrados.map((modelo) => (
          <li key={modelo.id}>
            <button
              type="button"
              onClick={() => aoSelecionar(modelo)}
              className={cn(
                'border-borda flex min-h-16 w-full items-center gap-3 rounded-xl border-2',
                'bg-superficie hover:border-acao-500 hover:bg-superficie-2 px-4 text-left',
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">
                  <span className="text-acao-600 font-mono">
                    {modelo.codigo}
                  </span>{' '}
                  {modelo.descricao}
                </span>
                {modelo.linha && (
                  <span className="text-texto-suave block truncate text-sm">
                    {modelo.linha}
                  </span>
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
