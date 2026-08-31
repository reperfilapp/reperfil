/**
 * Junta os candidatos vindos da medida/peso/linha com os da busca visual
 * por foto (tela "Identificar perfil").
 *
 * As duas buscas enxergam coisas diferentes — a medida é geometria exata, a
 * foto é semelhança visual — e um perfil que aparece nas DUAS é o palpite
 * mais forte que a tela pode dar. Por isso ele vem primeiro, mesmo que a
 * medida também tenha achado outros: quem bate na foto E na medida está
 * quase certamente certo.
 */

export interface CandidatoPorFoto {
  modeloPerfilId: string
  /** 0 a 100. */
  parecenca: number
}

export interface CandidatoIdentificacao<T> {
  perfil: T
  nota: string | null
  /** Nulo quando a foto não achou este perfil (ou não foi tirada foto). */
  parecencaFoto: number | null
}

export function combinarCandidatos<T extends { id: string }>(
  daMedidaOuPeso: readonly { perfil: T; nota: string | null }[],
  daFoto: readonly CandidatoPorFoto[],
  universo: readonly T[],
): CandidatoIdentificacao<T>[] {
  const parecencaPorId = new Map(daFoto.map((c) => [c.modeloPerfilId, c.parecenca]))
  const idsDaMedidaOuPeso = new Set(daMedidaOuPeso.map((c) => c.perfil.id))
  const perfilPorId = new Map(universo.map((p) => [p.id, p]))

  const comBase = daMedidaOuPeso.map((c) => ({
    perfil: c.perfil,
    nota: c.nota,
    parecencaFoto: parecencaPorId.get(c.perfil.id) ?? null,
  }))

  const sóDaFoto = daFoto
    .filter((c) => !idsDaMedidaOuPeso.has(c.modeloPerfilId))
    .flatMap((c) => {
      const perfil = perfilPorId.get(c.modeloPerfilId)
      return perfil ? [{ perfil, nota: null, parecencaFoto: c.parecenca }] : []
    })

  const emAmbas = comBase.filter((c) => c.parecencaFoto !== null)
  const sóMedidaOuPeso = comBase.filter((c) => c.parecencaFoto === null)

  // Dentro de cada grupo que tem parecença de foto, a mais parecida primeiro
  // — a ordem original da medida/peso (mais próximo primeiro) só importa
  // para quem a foto não teve o que dizer.
  const porParecenca = (
    a: { parecencaFoto: number | null },
    b: { parecencaFoto: number | null },
  ) => (b.parecencaFoto ?? 0) - (a.parecencaFoto ?? 0)

  emAmbas.sort(porParecenca)
  const sóDaFotoOrdenado = [...sóDaFoto].sort(porParecenca)

  return [...emAmbas, ...sóMedidaOuPeso, ...sóDaFotoOrdenado]
}
