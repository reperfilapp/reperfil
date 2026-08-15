import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { Botao } from '@/componentes/ui/Botao'
import { MarcaRePerfil } from '@/componentes/MarcaRePerfil'
import { APLICACAO } from '@/config/aplicacao'

/**
 * Tela inicial provisória. O painel de verdade — sobras disponíveis, metragem
 * total, reservados, cadastros recentes e o botão grande de cadastro rápido —
 * é a Etapa 7. Por ora ela serve para confirmar que a autenticação e o carregamento
 * do perfil funcionam de ponta a ponta.
 */
export default function Inicio() {
  const { perfil, sair } = useAutenticacao()

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center gap-3">
        <MarcaRePerfil className="text-acao-600 size-10" />
        <div>
          <h1 className="text-2xl font-bold">{APLICACAO.nome}</h1>
          <p className="text-texto-suave text-sm">{APLICACAO.slogan}</p>
        </div>
      </header>

      <section className="bg-superficie rounded-2xl p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Você está conectado</h2>

        <dl className="grid gap-3 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-texto-suave">Nome</dt>
            <dd className="font-medium">{perfil?.nome}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-texto-suave">E-mail</dt>
            <dd className="font-medium">{perfil?.email}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-texto-suave">Perfil de acesso</dt>
            <dd className="font-medium capitalize">{perfil?.papel}</dd>
          </div>
        </dl>
      </section>

      <p className="bg-superficie-2 text-texto-suave rounded-xl px-4 py-3 text-sm">
        Etapa 3 — autenticação e perfis de acesso. O painel com estoque,
        pesquisa e cadastro rápido vem nas próximas etapas.
      </p>

      <Botao variante="contorno" onClick={() => void sair()}>
        Sair
      </Botao>
    </main>
  )
}
