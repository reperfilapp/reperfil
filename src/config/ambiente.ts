import { z } from 'zod'

/**
 * Variáveis de ambiente, validadas na inicialização.
 *
 * Falhar aqui, alto e claro, é melhor do que descobrir a chave faltando
 * no meio de um cadastro no depósito. Só entram variáveis com prefixo
 * `VITE_`, que o Vite expõe ao navegador — ou seja, tudo aqui é PÚBLICO.
 *
 * A chave `anon` do Supabase é pública por design: quem protege os dados
 * é o Row Level Security, não o segredo da chave. A chave `service_role`
 * NUNCA pode aparecer neste arquivo nem em qualquer código do navegador.
 */
const esquemaAmbiente = z.object({
  VITE_SUPABASE_URL: z.url(
    'VITE_SUPABASE_URL precisa ser uma URL válida (https://xxx.supabase.co)',
  ),
  VITE_SUPABASE_ANON_KEY: z
    .string()
    .min(20, 'VITE_SUPABASE_ANON_KEY parece inválida ou está vazia'),
})

function carregarAmbiente() {
  const resultado = esquemaAmbiente.safeParse(import.meta.env)

  if (!resultado.success) {
    const problemas = resultado.error.issues
      .map((p) => `  • ${p.path.join('.')}: ${p.message}`)
      .join('\n')

    throw new Error(
      `Configuração de ambiente inválida:\n${problemas}\n\n` +
        'Copie o arquivo .env.example para .env e preencha os valores do ' +
        'seu projeto Supabase (Project Settings → API).',
    )
  }

  return resultado.data
}

export const AMBIENTE = carregarAmbiente()

/** `true` durante `npm run dev`. */
export const EM_DESENVOLVIMENTO = import.meta.env.DEV
