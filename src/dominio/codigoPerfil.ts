import type { ModeloPerfil } from '@/tipos/banco'

/**
 * O código interno do perfil: já existe? quais se parecem com este?
 *
 * ── POR QUE IGNORAR MAIÚSCULAS ───────────────────────────────────────────
 *
 * O banco distingue "MN-003" de "mn-003" e aceitaria os dois. Para quem usa,
 * porém, são o mesmo perfil — e ter os dois no catálogo é pior do que ter um
 * código repetido às claras: a busca por "MN-003" acha um, a sobra é
 * lançada no outro, e o estoque fica dividido entre dois cadastros que
 * ninguém percebe serem iguais.
 *
 * Espaços nas pontas idem: "MN-003 " é erro de digitação, não código novo.
 */

function normalizar(codigo: string): string {
  return codigo.trim().toLowerCase()
}

/**
 * O perfil que já usa este código, se houver.
 *
 * `ignorarId` é o perfil em edição: ao corrigir a descrição de um perfil sem
 * mexer no código, ele encontraria a si mesmo e acusaria duplicidade.
 */
export function perfilComMesmoCodigo(
  modelos: readonly ModeloPerfil[],
  codigo: string,
  ignorarId?: string,
): ModeloPerfil | null {
  const procurado = normalizar(codigo)

  if (procurado === '') return null

  return (
    modelos.find(
      (modelo) =>
        modelo.id !== ignorarId && normalizar(modelo.codigo) === procurado,
    ) ?? null
  )
}

/**
 * Códigos que começam com o que já foi digitado.
 *
 * Aparecem ENQUANTO se digita, e não depois de errar: quem cadastra o
 * terceiro perfil da série MN vê os dois que já existem antes de escolher o
 * número, e não precisa sair da tela para conferir. É a mesma ideia do
 * catálogo aberto ao lado da bancada.
 *
 * Ordenados alfabeticamente, e não por estoque: aqui a pergunta é "qual
 * número está livre nesta série?", e para responder isso a sequência é o que
 * importa.
 */
export function codigosParecidos(
  modelos: readonly ModeloPerfil[],
  codigo: string,
  ignorarId?: string,
  limite = 6,
): ModeloPerfil[] {
  const inicio = normalizar(codigo)

  // Menos de dois caracteres traria meio catálogo: não é sugestão, é ruído.
  if (inicio.length < 2) return []

  return modelos
    .filter(
      (modelo) =>
        modelo.id !== ignorarId && normalizar(modelo.codigo).startsWith(inicio),
    )
    .sort((a, b) => a.codigo.localeCompare(b.codigo, 'pt-BR'))
    .slice(0, limite)
}
