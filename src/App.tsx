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
import Inicio from '@/paginas/Inicio'
import Sobras from '@/paginas/Sobras'
import CadastrarSobra from '@/paginas/CadastrarSobra'
import PesquisarSobras from '@/paginas/PesquisarSobras'
import Reservas from '@/paginas/Reservas'
import Mais from '@/paginas/Mais'
import Configuracoes from '@/paginas/Configuracoes'
import Relatorios from '@/paginas/Relatorios'
import ModelosPerfil from '@/paginas/cadastros/ModelosPerfil'
import Acabamentos from '@/paginas/cadastros/Acabamentos'
import Localizacoes from '@/paginas/cadastros/Localizacoes'
import Clientes from '@/paginas/cadastros/Clientes'

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

              <Route
                element={
                  <RotaProtegida>
                    <LayoutApp />
                  </RotaProtegida>
                }
              >
                <Route path="/" element={<Inicio />} />
                <Route path="/sobras" element={<Sobras />} />
                <Route path="/cadastrar" element={<CadastrarSobra />} />
                <Route path="/procurar" element={<PesquisarSobras />} />
                <Route path="/reservas" element={<Reservas />} />
                <Route path="/perfis" element={<ModelosPerfil />} />
                <Route path="/acabamentos" element={<Acabamentos />} />
                <Route path="/localizacoes" element={<Localizacoes />} />
                <Route path="/clientes" element={<Clientes />} />
                <Route path="/mais" element={<Mais />} />
                <Route path="/relatorios" element={<Relatorios />} />
                <Route path="/configuracoes" element={<Configuracoes />} />
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
