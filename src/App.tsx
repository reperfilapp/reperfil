import { GuardaConexao } from '@/componentes/GuardaConexao'
import { APLICACAO } from '@/config/aplicacao'

/**
 * Casca da aplicação. As rotas e a navegação inferior entram na Etapa 3,
 * junto com a autenticação — antes disso não há tela protegida a rotear.
 */
export default function App() {
  return (
    <GuardaConexao>
      <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight">{APLICACAO.nome}</h1>
        <p className="text-texto-suave">{APLICACAO.slogan}</p>
        <p className="bg-superficie-2 text-texto-suave mt-8 rounded-lg px-4 py-2 text-sm">
          Etapa 0 — fundação do projeto
        </p>
      </main>
    </GuardaConexao>
  )
}
