import { FunctionsHttpError } from '@supabase/supabase-js'

/**
 * A mensagem que a Edge Function realmente escreveu, e não a genérica.
 *
 * ── POR QUE ISTO PRECISA EXISTIR ─────────────────────────────────────────
 *
 * `supabase.functions.invoke` não devolve o corpo da resposta quando o
 * status não é 2xx: ele põe um `FunctionsHttpError` em `error` e deixa
 * `data` nulo. O corpo continua lá, mas dentro de `error.context`, que é a
 * `Response` crua.
 *
 * O efeito disso passa despercebido com facilidade, porque o código parece
 * certo:
 *
 *     if (error) throw new Error('Não deu certo.')
 *     if (!data.ok) throw new Error(data.error)   // nunca roda
 *
 * A segunda linha é código morto. Toda resposta de erro da nossa função
 * vem com status 400, 401 ou 403 — ou seja, cai sempre na primeira. O
 * texto cuidadoso que a função escreveu ("digite exatamente o nome da
 * empresa: Alumifort") é descartado, e a pessoa recebe a mensagem genérica
 * justamente no momento em que precisava da específica.
 *
 * `padrao` é usado quando a resposta não tem corpo em JSON, não tem campo
 * `error`, ou o erro nem é de HTTP (rede fora, função inexistente).
 */
export async function mensagemDeErroDaFuncao(
  erro: unknown,
  padrao: string,
): Promise<string> {
  if (!(erro instanceof FunctionsHttpError)) return padrao

  try {
    const corpo = (await erro.context.json()) as { error?: unknown }
    return typeof corpo?.error === 'string' && corpo.error.trim() !== ''
      ? corpo.error
      : padrao
  } catch {
    return padrao
  }
}
