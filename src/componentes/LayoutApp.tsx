import { NavLink, Outlet } from 'react-router-dom'
import {
  Home,
  Scissors,
  Search,
  PackagePlus,
  Clock,
  Box,
  Menu as MenuIcone,
} from 'lucide-react'
import { MarcaRePerfil } from './MarcaRePerfil'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { useOrganizacao } from '@/dados/organizacao'
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
  { para: '/sobras', rotulo: 'Utilizar', Icone: Scissors, exato: false },
  { para: '/procurar', rotulo: 'Procurar', Icone: Search, exato: false },
  { para: '/cadastrar', rotulo: 'Cadastrar', Icone: PackagePlus, exato: false },
  { para: '/reservas', rotulo: 'Reservas', Icone: Clock, exato: false },
  { para: '/produtos', rotulo: 'Produtos', Icone: Box, exato: false },
  { para: '/mais', rotulo: 'Mais', Icone: MenuIcone, exato: false },
] as const

/** O cadastro é a ação mais frequente, então ganha destaque na barra. */
const ROTA_DESTACADA = '/cadastrar'

export function LayoutApp() {
  const { perfil } = useAutenticacao()
  const { data: org } = useOrganizacao()
  // Razão social é o "nome completo" de quem licenciou o uso — nome
  // fantasia (a marca) é o que já aparece em destaque no resto do app.
  // Falta uma das duas, usa a outra: empresa recém-criada às vezes só tem
  // o nome fantasia preenchido.
  const nomeLicenciado = org?.razao_social?.trim() || org?.nome_fantasia

  return (
    <div className="min-h-dvh md:flex">
      {/* Menu lateral — apenas no computador. Fixo (sticky) para não rolar
          junto com o conteúdo em páginas mais longas. */}
      <aside className="border-borda bg-superficie hidden w-60 shrink-0 flex-col gap-1 overflow-y-auto border-r p-4 md:sticky md:top-0 md:flex md:h-dvh">
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

        {/* `mt-auto` empurra para o fim da barra lateral fixa — mesmo
            texto de licença que aparece no celular, ver mais abaixo. */}
        {nomeLicenciado && (
          <p className="text-texto-suave mt-auto pt-4 text-center text-[0.65rem] leading-tight">
            Licenciado para: {nomeLicenciado}
          </p>
        )}
      </aside>

      {/* Conteúdo. O espaço embaixo evita que a navegação inferior cubra
          o fim da página no celular — 5,5rem, não os 4rem de antes: a barra
          cresceu com a linha "Licenciado para" por cima dos ícones. Mesmo
          número usado em `PaginaLista.tsx` e `CadastrarSobra.tsx`, que
          cancelam este `pb` para medir a própria altura até a barra —
          mudou aqui, muda nos três. */}
      <main className="flex-1 pb-[5.5rem] md:pb-0">
        <Outlet />
      </main>

      {/* Rodapé inferior — apenas no celular. A linha de licença fica
          FORA do grid dos ícones (que é `grid-cols-7`): um filho a mais
          ali dentro quebraria a grade, por isso os dois vivem em blocos
          separados dentro do mesmo contêiner fixo. */}
      <div className="border-borda bg-superficie fixed inset-x-0 bottom-0 z-10 border-t md:hidden">
        {nomeLicenciado && (
          <p className="text-texto-suave border-borda truncate border-b px-2 py-1 text-center text-[0.6rem] leading-tight">
            Licenciado para: {nomeLicenciado}
          </p>
        )}

        <nav
          aria-label="Navegação principal"
          className="grid grid-cols-7"
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
                    'flex min-h-16 flex-col items-center justify-start gap-0.5 px-0.5 pt-2.5 pb-1 text-center text-[0.65rem] leading-tight sm:text-xs',
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
    </div>
  )
}
