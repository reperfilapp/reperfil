import { NavLink, Outlet } from 'react-router-dom'
import {
  Home,
  Search,
  PackagePlus,
  Clock,
  Menu as MenuIcone,
} from 'lucide-react'
import { MarcaRePerfil } from './MarcaRePerfil'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { APLICACAO } from '@/config/aplicacao'
import { cn } from '@/lib/utilitarios'

/**
 * Casca das telas autenticadas.
 *
 * No celular: navegação inferior, ao alcance do polegar, porque o app é
 * usado de pé no depósito e muitas vezes com uma mão só.
 * No computador: menu lateral, onde há espaço e o trabalho é administrativo.
 */
// Clientes saiu da barra e foi para "Mais": no depósito ninguém consulta
// cliente, e o espaço vale mais para procurar e reservar. Volta ao centro na
// Fase 3, quando houver orçamento.
const ITENS_NAVEGACAO = [
  { para: '/', rotulo: 'Início', Icone: Home, exato: true },
  { para: '/procurar', rotulo: 'Procurar', Icone: Search, exato: false },
  { para: '/cadastrar', rotulo: 'Cadastrar', Icone: PackagePlus, exato: false },
  { para: '/reservas', rotulo: 'Reservas', Icone: Clock, exato: false },
  { para: '/mais', rotulo: 'Mais', Icone: MenuIcone, exato: false },
] as const

/** O cadastro é a ação mais frequente, então ganha destaque na barra. */
const ROTA_DESTACADA = '/cadastrar'

export function LayoutApp() {
  const { perfil } = useAutenticacao()

  return (
    <div className="min-h-dvh md:flex">
      {/* Menu lateral — apenas no computador */}
      <aside className="border-borda bg-superficie hidden w-60 shrink-0 flex-col gap-1 border-r p-4 md:flex">
        <div className="mb-6 flex items-center gap-2 px-2">
          <MarcaRePerfil className="text-acao-600 size-8" />
          <div>
            <p className="leading-tight font-bold">{APLICACAO.nome}</p>
            <p className="text-texto-suave text-xs">{perfil?.nome}</p>
          </div>
        </div>

        <nav aria-label="Navegação principal" className="flex flex-col gap-1">
          {ITENS_NAVEGACAO.map(({ para, rotulo, Icone, exato }) => (
            <NavLink
              key={para}
              to={para}
              end={exato}
              className={({ isActive }) =>
                cn(
                  'flex min-h-12 items-center gap-3 rounded-xl px-3 font-medium',
                  isActive
                    ? 'bg-acao-600 text-white'
                    : 'text-texto hover:bg-superficie-2',
                )
              }
            >
              <Icone aria-hidden="true" className="size-5" />
              {rotulo}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Conteúdo. O espaço embaixo evita que a navegação inferior cubra
          o fim da página no celular. */}
      <main className="flex-1 pb-24 md:pb-0">
        <Outlet />
      </main>

      {/* Navegação inferior — apenas no celular */}
      <nav
        aria-label="Navegação principal"
        className="border-borda bg-superficie fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 border-t md:hidden"
      >
        {ITENS_NAVEGACAO.map(({ para, rotulo, Icone, exato }) => {
          const destacado = para === ROTA_DESTACADA

          return (
            <NavLink
              key={para}
              to={para}
              end={exato}
              className={({ isActive }) =>
                cn(
                  'flex min-h-16 flex-col items-center justify-center gap-1 text-xs',
                  destacado
                    ? 'text-acao-600'
                    : isActive
                      ? 'text-acao-600'
                      : 'text-texto-suave',
                )
              }
            >
              <Icone
                aria-hidden="true"
                className={cn(
                  destacado
                    ? 'bg-acao-600 size-9 rounded-full p-1.5 text-white'
                    : 'size-6',
                )}
              />
              {rotulo}
            </NavLink>
          )
        })}
      </nav>
    </div>
  )
}
