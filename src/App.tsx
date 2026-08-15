import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { GuardaConexao } from '@/componentes/GuardaConexao'
import { ProvedorAutenticacao } from '@/autenticacao/ContextoAutenticacao'
import { RotaProtegida } from '@/autenticacao/RotaProtegida'
import Entrar from '@/paginas/Entrar'
import RecuperarSenha from '@/paginas/RecuperarSenha'
import DefinirSenha from '@/paginas/DefinirSenha'
import Inicio from '@/paginas/Inicio'

/**
 * Casca da aplicação.
 *
 * A ordem importa: a guarda de conexão fica por fora de tudo. Sem rede não
 * adianta tentar restaurar sessão nem carregar perfil — só produziria erros
 * confusos em vez de uma mensagem clara.
 */
export default function App() {
  return (
    <GuardaConexao>
      <ProvedorAutenticacao>
        <BrowserRouter>
          <Routes>
            <Route path="/entrar" element={<Entrar />} />
            <Route path="/recuperar-senha" element={<RecuperarSenha />} />
            <Route path="/definir-senha" element={<DefinirSenha />} />

            <Route
              path="/"
              element={
                <RotaProtegida>
                  <Inicio />
                </RotaProtegida>
              }
            />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </ProvedorAutenticacao>
    </GuardaConexao>
  )
}
