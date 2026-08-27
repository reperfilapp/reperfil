import { describe, expect, it } from 'vitest'
import { FunctionsHttpError } from '@supabase/supabase-js'
import { mensagemDeErroDaFuncao } from './erroDeFuncao'

const PADRAO = 'Não foi possível encerrar a empresa.'

function erroHttp(corpo: unknown, status = 400) {
  return new FunctionsHttpError(
    new Response(JSON.stringify(corpo), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  )
}

describe('mensagemDeErroDaFuncao', () => {
  it('devolve a mensagem que a função escreveu', async () => {
    const erro = erroHttp({
      ok: false,
      error: 'Para confirmar, digite exatamente o nome da empresa: Alumifort',
    })

    await expect(mensagemDeErroDaFuncao(erro, PADRAO)).resolves.toBe(
      'Para confirmar, digite exatamente o nome da empresa: Alumifort',
    )
  })

  it('usa o padrão quando o corpo não tem campo error', async () => {
    const erro = erroHttp({ ok: false })

    await expect(mensagemDeErroDaFuncao(erro, PADRAO)).resolves.toBe(PADRAO)
  })

  it('usa o padrão quando o campo error é vazio ou só espaços', async () => {
    const erro = erroHttp({ ok: false, error: '   ' })

    await expect(mensagemDeErroDaFuncao(erro, PADRAO)).resolves.toBe(PADRAO)
  })

  it('usa o padrão quando o corpo não é JSON', async () => {
    const erro = new FunctionsHttpError(
      new Response('502 Bad Gateway', { status: 502 }),
    )

    await expect(mensagemDeErroDaFuncao(erro, PADRAO)).resolves.toBe(PADRAO)
  })

  // Rede fora, função inexistente: não há resposta HTTP de onde tirar texto.
  it('usa o padrão quando o erro nem é de HTTP', async () => {
    await expect(
      mensagemDeErroDaFuncao(new Error('Failed to fetch'), PADRAO),
    ).resolves.toBe(PADRAO)
  })
})
