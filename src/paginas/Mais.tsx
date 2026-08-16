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
} from 'lucide-react'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { eAdministrador, podeMovimentarEstoque } from '@/autenticacao/contexto'
import { Botao } from '@/componentes/ui/Botao'
import { SeloVersao } from '@/componentes/SeloVersao'

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

  const itens = [
    {
      para: '/sobras',
      rotulo: 'Estoque de sobras',
      descricao: 'Todas as peças, com etiqueta e QR Code',
      Icone: Package,
      visivel: true,
    },
    {
      para: '/clientes',
      rotulo: 'Clientes',
      descricao: 'Serão usados nos orçamentos da Fase 3',
      Icone: Users,
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
    {
      para: '/relatorios',
      rotulo: 'Relatórios',
      descricao: 'Estoque, sobras paradas e movimentações em CSV',
      Icone: FileSpreadsheet,
      visivel: true,
    },
    {
      para: '/configuracoes',
      rotulo: 'Configurações do cálculo',
      descricao: 'Serra, margem e mínimo de sobra',
      Icone: Settings,
      visivel: eAdministrador(perfil),
    },
  ].filter((item) => item.visivel)

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">Mais</h1>
        <p className="text-texto-suave mt-1">
          {perfil?.nome} · <span className="capitalize">{perfil?.papel}</span>
        </p>
      </header>

      <nav className="mb-8 flex flex-col gap-2">
        {itens.map(({ para, rotulo, descricao, Icone }) => (
          <Link
            key={para}
            to={para}
            className="bg-superficie hover:bg-superficie-2 flex min-h-16 items-center gap-4 rounded-xl p-4 shadow-sm"
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

      {!podeMovimentarEstoque(perfil) && (
        <p className="bg-superficie-2 text-texto-suave mb-6 rounded-xl px-4 py-3 text-sm">
          Seu perfil consulta e reserva sobras. Cadastros e correções de estoque
          são feitos por quem tem perfil de estoque ou administrador.
        </p>
      )}

      <Botao
        variante="contorno"
        tamanho="largura_total"
        onClick={() => void sair()}
      >
        <LogOut aria-hidden="true" className="size-5" />
        Sair
      </Botao>

      <SeloVersao className="mt-6" />
    </div>
  )
}
