import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Package, Layers } from 'lucide-react'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { podeMovimentarEstoque } from '@/autenticacao/contexto'
import { useResumoEstoque } from '@/dados/sobras'
import { useModelosPerfil } from '@/dados/modelosPerfil'
import { useProdutos } from '@/dados/produtos'
import { useModelosAcessorio } from '@/dados/modelosAcessorio'
import { useConfiguracoes } from '@/dados/configuracoes'
import { useCardsTelaInicial } from '@/dados/cardsTelaInicial'
import { useOrganizacao, useLogoOrganizacao } from '@/dados/organizacao'
import {
  CATALOGO_RESUMO,
  CATALOGO_ATALHO,
  ITEM_ATALHO_RESTRITO,
  PADRAO_RESUMO,
  PADRAO_ATALHO,
  classeCardResumo,
  classeAtalho,
  type ItemResumo,
  type ItemAtalho,
} from '@/dominio/telaInicial'
import { MarcaRePerfil } from '@/componentes/MarcaRePerfil'
import { SeloVersao } from '@/componentes/SeloVersao'
import { LogoEmpresa } from '@/componentes/LogoEmpresa'
import { VisualizadorImagem } from '@/componentes/ui/VisualizadorImagem'
import { cn } from '@/lib/utilitarios'

export default function Inicio() {
  const { perfil, sair } = useAutenticacao()
  const { data: resumo, isPending } = useResumoEstoque()
  const { data: config } = useConfiguracoes()
  const { data: cards } = useCardsTelaInicial()
  const { data: org } = useOrganizacao()
  const { data: logoUrl } = useLogoOrganizacao(org?.logo_caminho)
  const { data: modelos, isPending: perfisCarregando } = useModelosPerfil()
  const { data: produtos, isPending: produtosCarregando } = useProdutos()
  const { data: acessorios, isPending: acessoriosCarregando } =
    useModelosAcessorio()
  const [logoAmpliado, setLogoAmpliado] = useState(false)

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
  const totalProdutos = produtos?.length ?? 0
  const totalAcessorios = acessorios?.length ?? 0

  // Enquanto a configuração não chega (ou para a rara organização sem
  // linha ainda), o visual de hoje continua valendo — os mesmos 7 cards.
  const resumoCards = cards
    ? cards.filter((c) => c.grupo === 'resumo')
    : PADRAO_RESUMO
  const atalhosEscolhidos = (cards ? cards.filter((c) => c.grupo === 'atalho') : PADRAO_ATALHO)
    // "Cadastrar estoque" some para quem não pode movimentar estoque, mesmo
    // que a empresa tenha escolhido esse card.
    .filter((c) => c.item !== ITEM_ATALHO_RESTRITO || podeMovimentarEstoque(perfil))

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-6">
      {/* O logo da empresa assume a posição principal se existir,
          mas mantemos a marca do aplicativo visível para reforço. Ela é o
          link para "Sobre": quem desenvolveu, contato e documentos legais. */}
      <div className="mb-6 flex items-center justify-center gap-4">
        {org ? (
          <>
            {logoUrl ? (
              <button
                type="button"
                onClick={() => setLogoAmpliado(true)}
                aria-label={`Ampliar logo de ${org.nome_fantasia}`}
                className="focus-visible:ring-acao-500 rounded-lg transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:outline-none"
              >
                <LogoEmpresa
                  logoUrl={logoUrl}
                  nomeFantasia={org.nome_fantasia}
                  tamanho="gigante"
                  className="size-36"
                />
              </button>
            ) : (
              <LogoEmpresa
                logoUrl={logoUrl}
                nomeFantasia={org.nome_fantasia}
                tamanho="gigante"
                className="size-36"
              />
            )}
            <div className="bg-borda/50 h-10 w-px" aria-hidden="true" />
            <Link to="/sobre" aria-label="Sobre o RePerfil">
              <MarcaRePerfil
                variante="simbolo"
                className="h-36 w-36 shrink-0 rounded-xl bg-white p-4"
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

      {resumoCards.length > 0 && (
        <section
          aria-label="Resumo do estoque"
          className="mb-6 grid grid-cols-3 gap-3"
        >
          {resumoCards.map(({ item, cor }) => {
            const def = CATALOGO_RESUMO[item as ItemResumo]
            if (!def) return null

            switch (item) {
              case 'disponiveis':
                return (
                  <Indicador
                    key={item}
                    Icone={def.Icone}
                    rotulo={def.rotulo}
                    valor={isPending ? '—' : String(resumo?.pecasDisponiveis ?? 0)}
                    para={def.para}
                    cor={classeCardResumo(cor)}
                  />
                )
              case 'metros':
                return (
                  <Indicador
                    key={item}
                    Icone={def.Icone}
                    rotulo={def.rotulo}
                    valor={isPending ? '—' : (metros ?? '0')}
                    para={def.para}
                    cor={classeCardResumo(cor)}
                  />
                )
              case 'perfis':
                return (
                  <Link
                    key={item}
                    to="/perfis"
                    className={cn(
                      'border-borda block rounded-xl border-2 p-4 text-center shadow-sm transition-colors',
                      classeCardResumo(cor),
                    )}
                  >
                    <Layers
                      aria-hidden="true"
                      className="text-acao-600 mx-auto mb-1 size-5"
                    />
                    <p className="text-texto text-xl font-bold tabular-nums">
                      {perfisCarregando ? '—' : totalPerfis}
                    </p>
                    {/* "Perfis" e a contagem de linhas em DUAS linhas de
                        texto, com a segunda entre parênteses.

                        Antes era "Perfis · 25 linhas" numa linha só, que
                        quebrava sozinha no meio em tela estreita e virava
                        "Perfis · 25" / "linhas" — lido assim, o 25 parecia
                        qualificar o número grande logo acima. Separado e
                        entre parênteses, não há como confundir: 363
                        perfis, distribuídos em 25 linhas. */}
                    <p className="text-texto-suave text-xs">Perfis</p>
                    {!perfisCarregando && (
                      <p className="text-texto-suave text-xs">
                        ({totalLinhas} linhas)
                      </p>
                    )}
                  </Link>
                )
              case 'linhas':
                return (
                  <Indicador
                    key={item}
                    Icone={def.Icone}
                    rotulo={def.rotulo}
                    valor={perfisCarregando ? '—' : String(totalLinhas)}
                    para={def.para}
                    cor={classeCardResumo(cor)}
                  />
                )
              case 'produtos':
                return (
                  <Indicador
                    key={item}
                    Icone={def.Icone}
                    rotulo={def.rotulo}
                    valor={produtosCarregando ? '—' : String(totalProdutos)}
                    para={def.para}
                    cor={classeCardResumo(cor)}
                  />
                )
              case 'acessorios':
                return (
                  <Indicador
                    key={item}
                    Icone={def.Icone}
                    rotulo={def.rotulo}
                    valor={acessoriosCarregando ? '—' : String(totalAcessorios)}
                    para={def.para}
                    cor={classeCardResumo(cor)}
                  />
                )
              default:
                return null
            }
          })}
        </section>
      )}

      {/*
       * Os caminhos principais, todos do mesmo tamanho — cada empresa
       * escolhe quais e quantos (ver "Personalizar tela inicial" em Mais).
       *
       * A cor distingue o que cada um faz. Por padrão todos escuros, com
       * matizes próximos: são atalhos da mesma família, e cores berrantes e
       * distintas fariam a tela inicial parecer um painel de alertas.
       */}
      {atalhosEscolhidos.length > 0 && (
        <nav aria-label="Atalhos" className="grid grid-cols-2 gap-3">
          {atalhosEscolhidos.map(({ item, cor }) => {
            const def = CATALOGO_ATALHO[item as ItemAtalho]
            if (!def) return null

            return (
              <Atalho
                key={item}
                para={def.para}
                Icone={def.Icone}
                rotulo={def.rotulo}
                subrotulo={'subrotulo' in def ? def.subrotulo : undefined}
                cor={classeAtalho(cor)}
              />
            )
          })}
        </nav>
      )}

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

      <div className="mt-3 flex justify-center">
        <button
          type="button"
          onClick={() => void sair()}
          className="bg-erro-50 text-erro-700 hover:bg-erro-100 rounded-full px-3 py-1 text-xs font-medium"
        >
          Sair
        </button>
      </div>

      {logoAmpliado && logoUrl && org && (
        <VisualizadorImagem
          src={logoUrl}
          alt={`Logo de ${org.nome_fantasia}, ampliado`}
          aoFechar={() => setLogoAmpliado(false)}
        />
      )}
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
  subrotulo?: string | undefined
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
  cor,
}: {
  Icone: typeof Package
  rotulo: string
  valor: string
  para?: string
  /** Classes de fundo/hover. Sem elas, mantém o cinza de sempre. */
  cor?: string
}) {
  const conteudo = (
    <>
      <Icone aria-hidden="true" className="text-acao-600 mx-auto mb-1 size-5" />
      <p className="text-texto text-xl font-bold tabular-nums">{valor}</p>
      <p className="text-texto-suave text-xs">{rotulo}</p>
    </>
  )

  const classes = cn(
    'border-2 border-borda rounded-xl p-4 text-center shadow-sm block transition-colors',
    cor ?? 'bg-celula hover:bg-superficie-2',
  )

  if (para) {
    return (
      <Link to={para} className={classes}>
        {conteudo}
      </Link>
    )
  }

  return <div className={classes}>{conteudo}</div>
}
