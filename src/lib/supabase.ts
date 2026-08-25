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
    // O Supabase já manda o número certo na própria mensagem — hardcoded
    // aqui divergiria toda vez que o mínimo do projeto mudasse no painel.
    const minimo = mensagem.match(/at least (\d+)/)?.[1]
    return minimo
      ? `A senha precisa ter pelo menos ${minimo} caracteres.`
      : 'A senha é muito curta.'
  }

  // O gatilho `vincular_convite` recusa cadastro sem convite aberto. O
  // Supabase embrulha esse erro num genérico "Database error saving new
  // user", que não diz nada a quem está tentando entrar na empresa.
  if (
    mensagem.includes('convite') ||
    mensagem.includes('database error saving new user')
  ) {
    return (
      'Não há convite aberto para este e-mail. Peça ao administrador da sua ' +
      'empresa para convidar você, e confira se digitou o mesmo e-mail que ele usou.'
    )
  }

  // O registro está desligado no painel do projeto. Quem lê isto é o
  // colaborador tentando criar a senha — ele não tem como saber que existe
  // um interruptor, nem onde. A mensagem aponta para quem pode ligar.
  if (
    mensagem.includes('signups not allowed') ||
    mensagem.includes('signup is disabled')
  ) {
    return (
      'O cadastro de novos acessos está desligado no projeto. Peça ao ' +
      'administrador para ligar "Allow new users to sign up" no painel do ' +
      'Supabase, em Authentication → Sign In / Providers → Email.'
    )
  }

  if (mensagem.includes('user already registered')) {
    return 'Já existe uma conta com este e-mail. Use "Já tenho acesso".'
  }

  // Acontece quando o link de redefinição de senha "queima" antes da hora
  // — o endereço de destino não está liberado em Authentication → URL
  // Configuration → Redirect URLs, ou algum programa de e-mail abriu o
  // link sozinho antes da pessoa clicar (comum em verificadores de
  // segurança corporativos).
  if (mensagem.includes('auth session missing')) {
    return (
      'O link expirou ou já foi aberto antes. Peça uma nova redefinição de ' +
      'senha e clique nela assim que chegar.'
    )
  }

  return erro.message
}
