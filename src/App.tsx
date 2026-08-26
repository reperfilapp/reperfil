import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { GuardaConexao } from '@/componentes/GuardaConexao'
import { ProvedorAutenticacao } from '@/autenticacao/ContextoAutenticacao'
import { RotaProtegida } from '@/autenticacao/RotaProtegida'
import { LayoutApp } from '@/componentes/LayoutApp'
import { AvisoNovaVersao } from '@/componentes/AvisoNovaVersao'
import { clienteConsultas } from '@/lib/consultas'
import Entrar from '@/paginas/Entrar'
import RecuperarSenha from '@/paginas/RecuperarSenha'
import DefinirSenha from '@/paginas/DefinirSenha'
import PrimeiroAcesso from '@/paginas/PrimeiroAcesso'
import CriarEmpresa from '@/paginas/CriarEmpresa'
import ConfirmarEmail from '@/paginas/ConfirmarEmail'
import CompletarCadastro from '@/paginas/CompletarCadastro'
import Inicio from '@/paginas/Inicio'
import Sobras from '@/paginas/Sobras'
import CadastrarSobra from '@/paginas/CadastrarSobra'
import PesquisarSobras from '@/paginas/PesquisarSobras'
import Reservas from '@/paginas/Reservas'
import Mais from '@/paginas/Mais'
import Configuracoes from '@/paginas/Configuracoes'
import Relatorios from '@/paginas/Relatorios'
import ModelosPerfil from '@/paginas/cadastros/ModelosPerfil'
import Linhas from '@/paginas/cadastros/Linhas'
import AdministrarLinhasEmpresas from '@/paginas/cadastros/AdministrarLinhasEmpresas'
import IdentificarPerfil from '@/paginas/IdentificarPerfil'
import PerfilDetalhe from '@/paginas/PerfilDetalhe'
import SobraDetalhe from '@/paginas/SobraDetalhe'
import ClienteDetalhe from '@/paginas/detalhes/ClienteDetalhe'
import AcabamentoDetalhe from '@/paginas/detalhes/AcabamentoDetalhe'
import LocalizacaoDetalhe from '@/paginas/detalhes/LocalizacaoDetalhe'
import Acabamentos from '@/paginas/cadastros/Acabamentos'
import Localizacoes from '@/paginas/cadastros/Localizacoes'
import Clientes from '@/paginas/cadastros/Clientes'
import Colaboradores from '@/paginas/cadastros/Colaboradores'
import ColaboradorDetalhe from '@/paginas/detalhes/ColaboradorDetalhe'
import Produtos from '@/paginas/cadastros/Produtos'
import ProdutoDetalhe from '@/paginas/detalhes/ProdutoDetalhe'
import AcrescentarMaterial from '@/paginas/AcrescentarMaterial'
import OQueProduzir from '@/paginas/OQueProduzir'
import LotesRepetidos from '@/paginas/LotesRepetidos'
import DadosEmpresa from '@/paginas/DadosEmpresa'
import ModelosAcessorio from '@/paginas/cadastros/ModelosAcessorio'
import Acessorios from '@/paginas/Acessorios'
import AcessorioDetalhe from '@/paginas/AcessorioDetalhe'
import CadastrarAcessorio from '@/paginas/CadastrarAcessorio'
import Inventario from '@/paginas/Inventario'
import NovoInventario from '@/paginas/NovoInventario'
import SessaoInventarioDetalhe from '@/paginas/SessaoInventarioDetalhe'
import Sobre from '@/paginas/Sobre'
import TermosDeUso from '@/paginas/TermosDeUso'
import PoliticaPrivacidade from '@/paginas/PoliticaPrivacidade'

/**
 * Casca da aplicação.
 *
 * A ordem das camadas importa. A guarda de conexão fica por fora de tudo:
 * sem rede não adianta restaurar sessão nem consultar o banco, só
 * produziria erros confusos em vez de uma mensagem clara.
 */
export default function App() {
  return (
    <GuardaConexao>
      <QueryClientProvider client={clienteConsultas}>
        <ProvedorAutenticacao>
          <BrowserRouter>
            <Routes>
              <Route path="/entrar" element={<Entrar />} />
              <Route path="/recuperar-senha" element={<RecuperarSenha />} />
              <Route path="/definir-senha" element={<DefinirSenha />} />
              <Route path="/primeiro-acesso" element={<PrimeiroAcesso />} />
              <Route path="/criar-empresa" element={<CriarEmpresa />} />
              <Route path="/confirmar-email" element={<ConfirmarEmail />} />

              {/* Públicas de propósito — precisam abrir sem sessão, tanto
                  para quem revisa a ficha na Play Store quanto para quem
                  ainda não é cliente e quer ler antes de pedir acesso. */}
              <Route path="/sobre" element={<Sobre />} />
              <Route path="/termos-de-uso" element={<TermosDeUso />} />
              <Route
                path="/politica-privacidade"
                element={<PoliticaPrivacidade />}
              />

              <Route
                element={
                  <RotaProtegida>
                    <LayoutApp />
                  </RotaProtegida>
                }
              >
                <Route
                  path="/completar-cadastro"
                  element={<CompletarCadastro />}
                />
                <Route path="/" element={<Inicio />} />
                <Route path="/sobras" element={<Sobras />} />
                <Route path="/sobras/repetidos" element={<LotesRepetidos />} />
                <Route path="/sobras/:id" element={<SobraDetalhe />} />
                <Route path="/cadastrar" element={<CadastrarSobra />} />
                <Route path="/procurar" element={<PesquisarSobras />} />
                <Route path="/reservas" element={<Reservas />} />
                <Route path="/perfis" element={<ModelosPerfil />} />
                <Route path="/produtos" element={<Produtos />} />
                <Route path="/produtos/:id" element={<ProdutoDetalhe />} />
                <Route
                  path="/produtos/:id/acrescentar-material"
                  element={<AcrescentarMaterial />}
                />
                <Route path="/o-que-produzir" element={<OQueProduzir />} />
                <Route path="/colaboradores" element={<Colaboradores />} />
                <Route
                  path="/colaboradores/:id"
                  element={<ColaboradorDetalhe />}
                />
                <Route path="/perfis/:id" element={<PerfilDetalhe />} />
                <Route path="/linhas" element={<Linhas />} />
                <Route
                  path="/linhas/empresas"
                  element={<AdministrarLinhasEmpresas />}
                />
                <Route path="/identificar" element={<IdentificarPerfil />} />
                <Route path="/acabamentos" element={<Acabamentos />} />
                <Route
                  path="/acabamentos/:id"
                  element={<AcabamentoDetalhe />}
                />
                <Route path="/localizacoes" element={<Localizacoes />} />
                <Route
                  path="/localizacoes/:id"
                  element={<LocalizacaoDetalhe />}
                />
                <Route path="/clientes" element={<Clientes />} />
                <Route path="/clientes/:id" element={<ClienteDetalhe />} />
                <Route path="/mais" element={<Mais />} />
                <Route path="/relatorios" element={<Relatorios />} />
                <Route path="/configuracoes" element={<Configuracoes />} />
                <Route path="/empresa" element={<DadosEmpresa />} />
                <Route path="/acessorios" element={<ModelosAcessorio />} />
                <Route
                  path="/estoque-acessorios"
                  element={<Acessorios />}
                />
                <Route
                  path="/estoque-acessorios/:id"
                  element={<AcessorioDetalhe />}
                />
                <Route
                  path="/cadastrar-acessorio"
                  element={<CadastrarAcessorio />}
                />
                <Route path="/inventario" element={<Inventario />} />
                <Route path="/inventario/novo" element={<NovoInventario />} />
                <Route
                  path="/inventario/:id"
                  element={<SessaoInventarioDetalhe />}
                />
              </Route>

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>

            <AvisoNovaVersao />
          </BrowserRouter>
        </ProvedorAutenticacao>
      </QueryClientProvider>
    </GuardaConexao>
  )
}
