import { Link } from 'react-router-dom'
import {
  PackagePlus,
  Package,
  Ruler,
  Layers,
  Boxes,
  Scissors,
} from 'lucide-react'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { podeMovimentarEstoque } from '@/autenticacao/contexto'
import { useResumoEstoque } from '@/dados/sobras'
import { useModelosPerfil } from '@/dados/modelosPerfil'
import { useConfiguracoes } from '@/dados/configuracoes'
import { useOrganizacao, useLogoOrganizacao } from '@/dados/organizacao'
import { MarcaRePerfil } from '@/componentes/MarcaRePerfil'
import { SeloVersao } from '@/componentes/SeloVersao'
import { LogoEmpresa } from '@/componentes/LogoEmpresa'
import { cn } from '@/lib/utilitarios'

export default function Inicio() {
  const { perfil } = useAutenticacao()
  const { data: resumo, isPending } = useResumoEstoque()
  const { data: config } = useConfiguracoes()
  const { data: org } = useOrganizacao()
  const { data: logoUrl } = useLogoOrganizacao(org?.logo_caminho)
  const { data: modelos, isPending: perfisCarregando } = useModelosPerfil()

  const metros =
    resumo === undefined
      ? null
      : (resumo.milimetrosDisponiveis / 1000).toLocaleString('pt-BR', {
          maximumFractionDigits: 1,
        })

  const totalPerfis = modelos?.length ?? 0
  // `linha` é texto livre, sem tabela própria — a contagem é de valores
  // distintos e não vazios entre os perfis cadastrados.
  const totalLinhas = new Set(
    (modelos ?? []).map((m) => m.linha).filter((l): l is string => Boolean(l)),
  ).size

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-6">
      {/* O logo da empresa assume a posição principal se existir,
          mas mantemos a marca do aplicativo visível para reforço. Ela é o
          link para "Sobre": quem desenvolveu, contato e documentos legais. */}
      <div className="mb-6 flex items-center justify-center gap-4">
        {org ? (
          <>
            <LogoEmpresa
              logoUrl={logoUrl}
              nomeFantasia={org.nome_fantasia}
              tamanho="gigante"
            />
            <div className="bg-borda/50 h-10 w-px" aria-hidden="true" />
            <Link to="/sobre" aria-label="Sobre o RePerfil">
              <MarcaRePerfil
                variante="simbolo"
                className="h-28 w-28 shrink-0 rounded-xl bg-white p-4"
              />
            </Link>
          </>
        ) : (
          <Link to="/sobre" aria-label="Sobre o RePerfil">
            <MarcaRePerfil
              variante="completa"
              className="max-w-48 rounded-xl bg-white p-3"
            />
          </Link>
        )}
      </div>

      <header className="mb-6 text-center">
        {org && (
          <h2 className="text-acao-600 mb-1 text-sm font-semibold tracking-wider uppercase">
            {org.nome_fantasia}
          </h2>
        )}
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
          e o mínimo de material ainda são valores presumidos.
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
          para="/sobras"
        />
        <Indicador
          Icone={Ruler}
          rotulo="Metros"
          valor={isPending ? '—' : (metros ?? '0')}
          para="/sobras"
        />
        <Link
          to="/perfis"
          className="bg-celula border-borda hover:bg-superficie-2 block rounded-xl border-2 p-4 text-center shadow-sm transition-colors"
        >
          <Layers aria-hidden="true" className="text-acao-600 mx-auto mb-1 size-5" />
          <p className="text-xl font-bold tabular-nums">
            {perfisCarregando ? '—' : totalPerfis}
          </p>
          <p className="text-texto-suave text-xs">
            {perfisCarregando ? 'Perfis' : `Perfis · ${totalLinhas} linhas`}
          </p>
        </Link>
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
            rotulo="Cadastrar estoque"
            cor="bg-acao-600 hover:bg-acao-700"
          />
        )}

        <Atalho
          para="/sobras"
          Icone={Scissors}
          rotulo="Utilizar material"
          subrotulo="(estoque)"
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

      <nav
        aria-label="Sobre e documentos legais"
        className="text-texto-suave mt-2 flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-xs"
      >
        <Link to="/sobre" className="hover:underline">
          Sobre
        </Link>
        <span aria-hidden="true">·</span>
        <Link to="/termos-de-uso" className="hover:underline">
          Termos de uso
        </Link>
        <span aria-hidden="true">·</span>
        <Link to="/politica-privacidade" className="hover:underline">
          Política de privacidade
        </Link>
      </nav>
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
  subrotulo,
  cor,
}: {
  para: string
  Icone: typeof Package
  rotulo: string
  subrotulo?: string
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
      <span className="flex flex-col items-center">
        <span>{rotulo}</span>
        {subrotulo && (
          <span className="mt-0.5 text-[0.65rem] leading-tight font-medium opacity-75">
            {subrotulo}
          </span>
        )}
      </span>
    </Link>
  )
}

function Indicador({
  Icone,
  rotulo,
  valor,
  para,
}: {
  Icone: typeof Package
  rotulo: string
  valor: string
  para?: string
}) {
  const conteudo = (
    <>
      <Icone aria-hidden="true" className="text-acao-600 mx-auto mb-1 size-5" />
      <p className="text-xl font-bold tabular-nums">{valor}</p>
      <p className="text-texto-suave text-xs">{rotulo}</p>
    </>
  )

  const classes =
    'bg-celula border-2 border-borda rounded-xl p-4 text-center shadow-sm block transition-colors'

  if (para) {
    return (
      <Link to={para} className={`${classes} hover:bg-superficie-2`}>
        {conteudo}
      </Link>
    )
  }

  return <div className={classes}>{conteudo}</div>
}
