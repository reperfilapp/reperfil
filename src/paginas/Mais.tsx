import { Link } from 'react-router-dom'
import {
  Layers,
  Palette,
  MapPin,
  Settings,
  LogOut,
  ChevronRight,
  Package,
  Users,
  FileSpreadsheet,
  Sun,
  Moon,
  SunMoon,
  Search,
  RefreshCw,
  Building2,
  Ruler,
  UsersRound,
  PackageSearch,
  Boxes,
  Puzzle,
  ClipboardList,
  Info,
  UserCircle2,
  LayoutGrid,
} from 'lucide-react'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import {
  eAdministrador,
  podeMovimentarEstoque,
  podeGerenciarColaboradores,
} from '@/autenticacao/contexto'
import { rotuloCargo } from '@/dominio/cargos'
import { useOrganizacao } from '@/dados/organizacao'
import { Botao } from '@/componentes/ui/Botao'
import { SeloVersao } from '@/componentes/SeloVersao'
import { useTema, type Tema } from '@/tema/useTema'
import { cn } from '@/lib/utilitarios'

const OPCOES_TEMA: { valor: Tema; rotulo: string; Icone: typeof Sun }[] = [
  { valor: 'automatico', rotulo: 'Automático', Icone: SunMoon },
  { valor: 'claro', rotulo: 'Claro', Icone: Sun },
  { valor: 'escuro', rotulo: 'Escuro', Icone: Moon },
]

/**
 * Menu de cadastros e configurações.
 *
 * Os itens somem conforme o papel — mas isso é organização de tela, não
 * segurança. Quem barra de fato é o Row Level Security no banco: um
 * serralheiro que digitar /configuracoes na barra de endereços vê a tela,
 * e o banco recusa qualquer gravação.
 */
export default function Mais() {
  const { perfil, sair } = useAutenticacao()
  const { tema, definirTema } = useTema()
  const { data: org } = useOrganizacao()

  /** O dia a dia do depósito: o material que existe e o que fazer com ele. */
  const estoque = [
    {
      para: '/sobras',
      rotulo: 'Estoque de sobras',
      descricao: 'Todas as peças, com etiqueta e QR Code',
      Icone: Package,
      visivel: true,
    },
    {
      para: '/procurar',
      rotulo: 'Procurar sobra',
      descricao: 'Encontrar peças específicas no estoque',
      Icone: Search,
      visivel: true,
    },
    {
      para: '/estoque-acessorios',
      rotulo: 'Estoque de acessórios',
      descricao: 'Dobradiça, roldana, puxador — sem comprimento a controlar',
      Icone: Puzzle,
      visivel: true,
    },
    {
      para: '/inventario',
      rotulo: 'Inventário',
      descricao: 'Contagem física de perfis e acessórios',
      Icone: ClipboardList,
      visivel: true,
    },
    {
      para: '/o-que-produzir',
      rotulo: 'O que dá para produzir',
      descricao: 'Portas e janelas que saem das sobras de hoje',
      Icone: PackageSearch,
      visivel: true,
    },
    {
      para: '/identificar',
      rotulo: 'Identificar perfil',
      descricao: 'Descobrir o perfil de uma ponta sem etiqueta',
      Icone: Ruler,
      visivel: true,
    },
    {
      para: '/relatorios',
      rotulo: 'Relatórios',
      descricao: 'Estoque, sobras paradas e movimentações em CSV',
      Icone: FileSpreadsheet,
      visivel: true,
    },
  ].filter((item) => item.visivel)

  /** O catálogo: o que a empresa fabrica e o vocabulário por trás disso. */
  const cadastros = [
    {
      para: '/linhas',
      rotulo: 'Linhas e sistemas',
      descricao: 'Renomear e juntar linhas repetidas',
      Icone: Layers,
      visivel: true,
    },
    {
      para: '/perfis',
      rotulo: 'Modelos de perfil',
      descricao: 'O catálogo de perfis da empresa',
      Icone: Layers,
      visivel: true,
    },
    {
      para: '/produtos',
      rotulo: 'Produtos e listas técnicas',
      descricao: 'O que a empresa fabrica e o que entra em cada item',
      Icone: Boxes,
      visivel: true,
    },
    {
      para: '/acessorios',
      rotulo: 'Catálogo de acessórios',
      descricao: 'Os acessórios que a empresa usa',
      Icone: Puzzle,
      visivel: true,
    },
    {
      para: '/acabamentos',
      rotulo: 'Cores e acabamentos',
      descricao: 'Pinturas, anodizados e códigos RAL',
      Icone: Palette,
      visivel: true,
    },
    {
      para: '/localizacoes',
      rotulo: 'Localizações',
      descricao: 'Onde as peças ficam no depósito',
      Icone: MapPin,
      visivel: true,
    },
  ].filter((item) => item.visivel)

  /** O que é do app e do escritório: pessoas, empresa e papel. */
  const geral = [
    {
      para: '/configuracoes',
      rotulo: 'Configurações do cálculo',
      descricao: 'Serra, margem e mínimo de sobra',
      Icone: Settings,
      visivel: eAdministrador(perfil),
    },
    {
      para: '/personalizar-inicio',
      rotulo: 'Personalizar tela inicial',
      descricao: 'Escolha quais cards aparecem e as cores de cada um',
      Icone: LayoutGrid,
      visivel: eAdministrador(perfil),
    },
    {
      para: `/colaboradores/${perfil?.id ?? ''}`,
      rotulo: 'Minha conta',
      descricao: 'Seus dados, foto, nickname — e excluir a conta',
      Icone: UserCircle2,
      visivel: perfil !== null,
    },
    {
      para: '/empresa',
      rotulo: 'Dados da empresa',
      descricao: 'Nome, endereço e logo para orçamentos e relatórios',
      Icone: Building2,
      visivel: eAdministrador(perfil),
    },
    {
      para: '/colaboradores',
      rotulo: 'Equipe',
      descricao: 'Quem entra no sistema e o que cada um pode fazer',
      Icone: UsersRound,
      visivel: podeGerenciarColaboradores(perfil),
    },
    {
      para: '/clientes',
      rotulo: 'Clientes',
      descricao: 'Serão usados nos orçamentos da Fase 3',
      Icone: Users,
      visivel: true,
    },
    {
      // Só na organização central: é a tela de quem administra o RePerfil
      // inteiro, não uma empresa. Some para todo mundo mais.
      para: '/empresas',
      rotulo: 'Empresas',
      descricao: 'Quem usa o RePerfil, e os pedidos de encerramento',
      Icone: Building2,
      visivel: eAdministrador(perfil) && Boolean(org?.eh_catalogo_central),
    },
    {
      // Mesma condição do item acima — o mesmo tipo de tela, só da central.
      para: '/sincronizacao-central',
      rotulo: 'Sincronizar catálogos',
      descricao: 'Atualiza perfis, produtos, acessórios e acabamentos de várias empresas de uma vez',
      Icone: RefreshCw,
      visivel: eAdministrador(perfil) && Boolean(org?.eh_catalogo_central),
    },
    {
      para: '/sobre',
      rotulo: 'Sobre',
      descricao: 'Quem desenvolve, contato e documentos legais',
      Icone: Info,
      visivel: true,
    },
  ].filter((item) => item.visivel)

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Mais</h1>
        <p className="text-texto-suave mt-1">
          {perfil?.nome}
          {perfil && ` · ${rotuloCargo(perfil.papel)}`}
        </p>
      </header>

      {/* Três seções, cada uma com sua cor de fundo — o que mexe no
          estoque, o que é catálogo (cadastro) e o que é do app/escritório.
          A cor distingue à distância — no depósito, com o celular na mão,
          ninguém lê subtítulo antes de tocar. */}
      <Grupo titulo="Administração do estoque" itens={estoque} cor="azul" />

      <Grupo
        titulo="Administração de cadastros"
        itens={cadastros}
        cor="amarelo"
      />

      <Grupo titulo="Administração geral do app" itens={geral} cor="lilas" />

      {!podeMovimentarEstoque(perfil) && (
        <p className="bg-superficie-2 text-texto-suave mb-6 rounded-xl px-4 py-3 text-sm">
          Seu perfil consulta e reserva sobras. Cadastros e correções de estoque
          são feitos por quem tem perfil de estoque ou administrador.
        </p>
      )}

      {/* Fica no aparelho, não na conta: o mesmo usuário pode preferir
          escuro no celular do depósito e claro no computador do escritório. */}
      <div role="group" aria-label="Tema" className="mb-6">
        <p className="mb-2 font-medium">Tema</p>
        <div className="grid grid-cols-3 gap-2">
          {OPCOES_TEMA.map(({ valor, rotulo, Icone }) => (
            <button
              key={valor}
              type="button"
              onClick={() => definirTema(valor)}
              aria-pressed={tema === valor}
              className={cn(
                'flex min-h-12 items-center justify-center gap-1.5 rounded-xl border-2 text-sm font-semibold',
                tema === valor
                  ? 'border-acao-600 bg-acao-600 text-white'
                  : 'border-borda bg-superficie text-texto-suave',
              )}
            >
              <Icone aria-hidden="true" className="size-4" />
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      <Botao
        variante="contorno"
        tamanho="largura_total"
        onClick={() => void sair()}
        className="bg-erro-50 text-erro-700 border-erro-100 hover:bg-erro-100"
      >
        <LogOut aria-hidden="true" className="size-5" />
        Sair
      </Botao>

      <SeloVersao className="mt-6" />
    </div>
  )
}

interface ItemMenu {
  para: string
  rotulo: string
  descricao: string
  Icone: typeof Sun
}

type CorGrupo = 'azul' | 'amarelo' | 'lilas'

const CLASSES_POR_COR: Record<CorGrupo, string> = {
  azul: 'bg-grupo-azul hover:bg-grupo-azul-hover',
  amarelo: 'bg-grupo-amarelo hover:bg-grupo-amarelo-hover',
  lilas: 'bg-grupo-lilas hover:bg-grupo-lilas-hover',
}

/**
 * Uma seção do menu, com a cor de fundo própria da seção.
 *
 * A cor é o que distingue de longe: no depósito, com o celular na mão e às
 * vezes de luva, ninguém lê o subtítulo antes de tocar — mas a mancha de
 * cor diferente separa "isto é estoque" de "isto é cadastro" de "isto é do
 * app" antes da leitura.
 */
function Grupo({
  titulo,
  itens,
  cor,
}: {
  titulo: string
  itens: readonly ItemMenu[]
  cor: CorGrupo
}) {
  if (itens.length === 0) return null

  return (
    <section className="mb-6">
      <h2 className="text-texto-suave mb-2 text-xs font-semibold tracking-wide uppercase">
        {titulo}
      </h2>

      <nav className="flex flex-col gap-2">
        {itens.map(({ para, rotulo, descricao, Icone }) => (
          <Link
            key={para}
            to={para}
            className={cn(
              'flex min-h-16 items-center gap-4 rounded-xl p-4 shadow-sm',
              CLASSES_POR_COR[cor],
            )}
          >
            <Icone aria-hidden="true" className="text-acao-600 size-6" />
            <span className="flex-1">
              <span className="block font-medium">{rotulo}</span>
              <span className="text-texto-suave block text-sm">
                {descricao}
              </span>
            </span>
            <ChevronRight
              aria-hidden="true"
              className="text-texto-suave size-5"
            />
          </Link>
        ))}
      </nav>
    </section>
  )
}
