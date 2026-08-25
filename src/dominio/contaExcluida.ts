/**
 * O código de rastreio de uma conta excluída.
 *
 * `excluir_propria_conta`, no banco, troca o e-mail por
 * "conta-excluida-{8 primeiros caracteres do id}@reperfil.local" — os
 * dados pessoais somem, mas esse código continua identificando a LINHA
 * (não a pessoa) de forma única. Quem precisar mesmo saber quem foi busca
 * esse código — ou o id inteiro — direto no painel do Supabase, em
 * Authentication → Users: o e-mail original de login não é apagado lá,
 * só aqui dentro do cadastro.
 */
const PADRAO_EMAIL_CONTA_EXCLUIDA = /^conta-excluida-([0-9a-f]{8})@reperfil\.local$/

export function codigoDeContaExcluida(email: string | null): string | null {
  const encontrado = email?.match(PADRAO_EMAIL_CONTA_EXCLUIDA)

  return encontrado ? encontrado[1]!.toUpperCase() : null
}

/**
 * O nome para exibir no histórico — com o código de rastreio junto, quando
 * a conta já foi excluída. "Conta excluída" sozinho não ajuda ninguém a
 * responder "quem foi?"; com o código, a resposta está a uma busca no
 * painel do Supabase de distância.
 */
export function nomeParaHistorico(
  usuario: { nome: string; email: string } | null,
): string | null {
  if (!usuario) return null

  const codigo = codigoDeContaExcluida(usuario.email)

  return codigo ? `${usuario.nome} (cód. ${codigo})` : usuario.nome
}
