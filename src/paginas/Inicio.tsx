import { Link } from 'react-router-dom'
import { PackagePlus, Package, Clock, Ruler } from 'lucide-react'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { podeMovimentarEstoque } from '@/autenticacao/contexto'
import { useResumoEstoque } from '@/dados/sobras'
import { useConfiguracoes } from '@/dados/configuracoes'
import { MarcaRePerfil } from '@/componentes/MarcaRePerfil'

export default function Inicio() {
  const { perfil } = useAutenticacao()
  const { data: resumo, isPending } = useResumoEstoque()
  const { data: config } = useConfiguracoes()

  const metros =
    resumo === undefined
      ? null
      : (resumo.milimetrosDisponiveis / 1000).toLocaleString('pt-BR', {
          maximumFractionDigits: 1,
        })

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-6">
      <header className="mb-6 flex items-center gap-3">
        <MarcaRePerfil className="size-11" />
        <div className="min-w-0">
          <p className="truncate text-lg leading-tight font-bold">
            Olá, {perfil?.nome.split(' ')[0]}
          </p>
          <p className="text-texto-suave truncate text-sm capitalize">
            {perfil?.papel}
          </p>
        </div>
      </header>

      {/* Aviso enquanto os parâmetros de corte não foram confirmados. Sem
          isso, todo cálculo de aproveitamento usa números presumidos. */}
      {config && !config.confirmado_pelo_administrador && (
        <Link
          to="/configuracoes"
          className="bg-atencao-50 text-atencao-700 hover:bg-atencao-100 mb-5 block rounded-xl p-4 text-sm"
        >
          <strong>Confirme os parâmetros de corte.</strong> A espessura da serra
          e o mínimo de sobra ainda são valores presumidos.
        </Link>
      )}

      <section
        aria-label="Resumo do estoque"
        className="mb-6 grid grid-cols-3 gap-3"
      >
        <Indicador
          Icone={Package}
          rotulo="Disponíveis"
          valor={isPending ? '—' : String(resumo?.pecasDisponiveis ?? 0)}
        />
        <Indicador
          Icone={Ruler}
          rotulo="Metros"
          valor={isPending ? '—' : (metros ?? '0')}
        />
        <Indicador
          Icone={Clock}
          rotulo="Reservadas"
          valor={isPending ? '—' : String(resumo?.pecasReservadas ?? 0)}
        />
      </section>

      {podeMovimentarEstoque(perfil) && (
        <Link
          to="/cadastrar"
          className="bg-acao-600 hover:bg-acao-700 flex min-h-24 items-center justify-center gap-3 rounded-2xl px-6 text-xl font-bold text-white"
        >
          <PackagePlus aria-hidden="true" className="size-8" />
          Cadastrar sobra
        </Link>
      )}

      <Link
        to="/sobras"
        className="border-borda bg-superficie hover:bg-superficie-2 mt-3 flex min-h-16 items-center justify-center gap-2 rounded-2xl border-2 font-semibold"
      >
        <Package aria-hidden="true" className="size-5" />
        Ver estoque de sobras
      </Link>
    </div>
  )
}

function Indicador({
  Icone,
  rotulo,
  valor,
}: {
  Icone: typeof Package
  rotulo: string
  valor: string
}) {
  return (
    <div className="bg-superficie rounded-xl p-4 text-center shadow-sm">
      <Icone aria-hidden="true" className="text-acao-600 mx-auto mb-1 size-5" />
      <p className="text-2xl font-bold tabular-nums">{valor}</p>
      <p className="text-texto-suave text-xs">{rotulo}</p>
    </div>
  )
}
