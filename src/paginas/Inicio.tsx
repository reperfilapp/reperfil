import { Link } from 'react-router-dom'
import { PackagePlus, Package, Clock, Ruler, Layers, Boxes } from 'lucide-react'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { podeMovimentarEstoque } from '@/autenticacao/contexto'
import { useResumoEstoque } from '@/dados/sobras'
import { useConfiguracoes } from '@/dados/configuracoes'
import { MarcaRePerfil } from '@/componentes/MarcaRePerfil'
import { SeloVersao } from '@/componentes/SeloVersao'
import { cn } from '@/lib/utilitarios'

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
      {/* A logo grande é a primeira coisa que a pessoa vê ao entrar — a
          tela de entrada some assim que a sessão abre, e sem isso a marca
          nunca aparece de novo até sair e voltar a entrar. */}
      <div className="mb-6 flex justify-center">
        <MarcaRePerfil
          variante="completa"
          className="max-w-48 rounded-xl bg-white p-3"
        />
      </div>

      <header className="mb-6 text-center">
        <p className="truncate text-lg leading-tight font-bold">
          Olá, {perfil?.nome.split(' ')[0]}
        </p>
        <p className="text-texto-suave truncate text-sm capitalize">
          {perfil?.papel}
        </p>
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

      {/*
       * Os quatro caminhos principais, do mesmo tamanho.
       *
       * Antes eram dois, com tamanhos diferentes — o de cadastrar sobra era
       * o dobro do outro, porque era a ação do dia a dia. Com quatro
       * destinos, tamanhos diferentes viram hierarquia inventada: quem abre
       * o aplicativo para consultar o catálogo não está fazendo nada menos
       * importante do que quem vai lançar uma peça.
       *
       * A cor distingue o que cada um faz. Todos escuros, com matizes
       * próximos: são atalhos da mesma família, e cores berrantes e
       * distintas fariam a tela inicial parecer um painel de alertas.
       */}
      <nav aria-label="Atalhos" className="grid grid-cols-2 gap-3">
        {podeMovimentarEstoque(perfil) && (
          <Atalho
            para="/cadastrar"
            Icone={PackagePlus}
            rotulo="Cadastrar sobra"
            cor="bg-acao-600 hover:bg-acao-700"
          />
        )}

        <Atalho
          para="/sobras"
          Icone={Package}
          rotulo="Estoque de sobras"
          cor="bg-acao-700 hover:bg-acao-800"
        />

        <Atalho
          para="/perfis"
          Icone={Layers}
          rotulo="Modelos de perfil"
          cor="bg-grafite-700 hover:bg-grafite-800"
        />

        <Atalho
          para="/produtos"
          Icone={Boxes}
          rotulo="Produtos e listas técnicas"
          cor="bg-economia-700 hover:bg-economia-600"
        />
      </nav>

      <SeloVersao className="mt-8" />
    </div>
  )
}

/**
 * Um dos caminhos principais da tela inicial.
 *
 * Altura generosa e mesma medida para todos: são tocados com o celular na
 * mão, às vezes de luva, e um alvo menor que os vizinhos erra mais.
 */
function Atalho({
  para,
  Icone,
  rotulo,
  cor,
}: {
  para: string
  Icone: typeof Package
  rotulo: string
  /** Classes de fundo. Texto sempre branco — todos os tons são escuros. */
  cor: string
}) {
  return (
    <Link
      to={para}
      className={cn(
        'flex min-h-28 flex-col items-center justify-center gap-2 rounded-2xl p-3',
        'text-center leading-tight font-bold text-white',
        cor,
      )}
    >
      <Icone aria-hidden="true" className="size-7 shrink-0" />
      {rotulo}
    </Link>
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
