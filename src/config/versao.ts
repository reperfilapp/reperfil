/**
 * Identificação da versão em execução.
 *
 * Os valores são gravados no código durante o build, por `vite.config.ts`.
 * Não são lidos em tempo de execução — o que está aqui é exatamente o que
 * foi compilado, e é por isso que serve para responder "o celular já pegou a
 * versão nova?".
 *
 * ── Como a numeração funciona ────────────────────────────────────────────
 *
 * `versao` segue MAIOR.MENOR.CORREÇÃO e é definida à mão em `package.json`:
 *
 *   0.X.0   etapa X da Fase 1 concluída
 *   1.0.0   Fase 1 completa e aprovada
 *   2.0.0   Fase 2 (desenho paramétrico), e assim por diante
 *
 * `build` é a data e hora do build, no formato AAAAMMDD.HHMM. Sempre cresce,
 * a cada publicação, sem ninguém precisar lembrar de incrementar nada.
 *
 * `commit` é o hash curto do commit — a identificação exata do código, para
 * quando "a versão está certa mas o comportamento está estranho".
 */

declare const __VERSAO__: string
declare const __BUILD__: string
declare const __COMMIT__: string
declare const __DATA_BUILD__: string

export const VERSAO = {
  numero: __VERSAO__,
  build: __BUILD__,
  commit: __COMMIT__,
  dataBuild: __DATA_BUILD__,
} as const

/** "0.5.0 · build 20260815.1432" — o suficiente na maioria das telas. */
export function versaoResumida(): string {
  return `${VERSAO.numero} · build ${VERSAO.build}`
}

/** Data e hora do build, no formato brasileiro. */
export function dataBuildFormatada(): string {
  const data = new Date(VERSAO.dataBuild)

  if (Number.isNaN(data.getTime())) {
    return VERSAO.build
  }

  return data.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
