/**
 * Regras do nickname de login — espelham a `check constraint` do banco
 * (`apelido_formato_valido`), para avisar antes de ir ao servidor em vez de
 * só depois que ele recusar.
 */
const FORMATO_APELIDO = /^[a-z0-9._-]{3,30}$/

export function normalizarApelido(texto: string): string {
  return texto.trim().toLowerCase()
}

export function apelidoValido(texto: string): boolean {
  return FORMATO_APELIDO.test(normalizarApelido(texto))
}
