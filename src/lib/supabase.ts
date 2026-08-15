import { createClient } from '@supabase/supabase-js'
import { AMBIENTE } from '@/config/ambiente'

/**
 * Cliente único do Supabase.
 *
 * Um só para toda a aplicação: cada instância mantém a própria sessão e o
 * próprio canal de renovação de token, e ter duas causa disputa silenciosa
 * pelo `localStorage`.
 *
 * A chave usada é a `anon`, pública por design. Quem protege os dados é o
 * Row Level Security no banco, verificado em `supabase/testes/verificar-rls.sql`.
 */
export const supabase = createClient(
  AMBIENTE.VITE_SUPABASE_URL,
  AMBIENTE.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      // O app não usa links mágicos nem OAuth por redirecionamento, exceto na
      // redefinição de senha, tratada explicitamente pela tela correspondente.
      detectSessionInUrl: true,
    },
  },
)

/**
 * Traduz erros do Supabase para português claro.
 *
 * As mensagens originais vêm em inglês e falam de "credentials" e "rate
 * limit" — vocabulário de quem escreveu o serviço, não de quem está no
 * depósito com o celular na mão.
 */
export function traduzirErro(erro: unknown): string {
  if (!(erro instanceof Error)) {
    return 'Algo deu errado. Tente novamente.'
  }

  const mensagem = erro.message.toLowerCase()

  if (mensagem.includes('invalid login credentials')) {
    return 'E-mail ou senha incorretos.'
  }

  if (mensagem.includes('email not confirmed')) {
    return 'Este e-mail ainda não foi confirmado. Verifique sua caixa de entrada.'
  }

  if (mensagem.includes('rate limit') || mensagem.includes('too many')) {
    return 'Muitas tentativas seguidas. Aguarde alguns minutos e tente de novo.'
  }

  if (mensagem.includes('failed to fetch') || mensagem.includes('network')) {
    return 'Não foi possível falar com o servidor. Verifique sua conexão.'
  }

  if (mensagem.includes('user not found')) {
    return 'Não encontramos uma conta com este e-mail.'
  }

  if (mensagem.includes('new password should be different')) {
    return 'A nova senha precisa ser diferente da atual.'
  }

  if (mensagem.includes('password should be at least')) {
    return 'A senha precisa ter pelo menos 8 caracteres.'
  }

  return erro.message
}
