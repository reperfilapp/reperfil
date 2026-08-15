import { describe, it, expect, vi } from 'vitest'

// O cliente do Supabase é criado ao importar o módulo e exige as variáveis de
// ambiente. Aqui só interessa a tradução de erros, então evitamos a criação.
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({}),
}))

vi.mock('@/config/ambiente', () => ({
  AMBIENTE: {
    VITE_SUPABASE_URL: 'https://exemplo.supabase.co',
    VITE_SUPABASE_ANON_KEY: 'chave-de-teste-suficientemente-longa',
  },
  EM_DESENVOLVIMENTO: false,
}))

const { traduzirErro } = await import('./supabase')

describe('traduzirErro', () => {
  it('traduz credenciais inválidas sem revelar se o e-mail existe', () => {
    const traduzido = traduzirErro(new Error('Invalid login credentials'))

    expect(traduzido).toBe('E-mail ou senha incorretos.')
    // Não pode dizer "e-mail não cadastrado": isso permitiria descobrir
    // quais e-mails têm conta no sistema.
    expect(traduzido).not.toMatch(/não cadastrado|não existe/i)
  })

  it('traduz falha de rede', () => {
    expect(traduzirErro(new Error('Failed to fetch'))).toBe(
      'Não foi possível falar com o servidor. Verifique sua conexão.',
    )
  })

  it('traduz excesso de tentativas', () => {
    expect(traduzirErro(new Error('Email rate limit exceeded'))).toMatch(
      /muitas tentativas/i,
    )
  })

  it('traduz senha curta demais', () => {
    expect(
      traduzirErro(new Error('Password should be at least 8 characters')),
    ).toMatch(/pelo menos 8 caracteres/i)
  })

  it('devolve mensagem genérica para o que não é erro', () => {
    expect(traduzirErro('algo estranho')).toBe(
      'Algo deu errado. Tente novamente.',
    )
    expect(traduzirErro(null)).toBe('Algo deu errado. Tente novamente.')
  })

  it('repassa mensagens desconhecidas em vez de engolir', () => {
    expect(traduzirErro(new Error('Erro muito específico do servidor'))).toBe(
      'Erro muito específico do servidor',
    )
  })
})
