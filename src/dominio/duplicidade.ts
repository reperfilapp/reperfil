/**
 * Lotes que são a mesma coisa contada duas vezes.
 *
 * ── O QUE TORNA DOIS LOTES EQUIVALENTES ──────────────────────────────────
 *
 * Perfil, acabamento e comprimento. Nada além disso: é o que decide se as
 * peças são intercambiáveis na hora do corte. Duas pontas de 6 m do SU-079
 * em branco servem para o mesmo serviço, tenham vindo de obras diferentes ou
 * de meses diferentes.
 *
 * Comprimento é comparação EXATA, não aproximada. Uma peça de 5.980 mm não é
 * uma de 6.000: quem contar com os 20 mm a mais descobre o erro no meio do
 * corte, que é o pior momento possível.
 *
 * ── O QUE NÃO ENTRA NA COMPARAÇÃO ────────────────────────────────────────
 *
 * Localização fica de fora de propósito. Peças iguais em prateleiras
 * diferentes ainda são a mesma coisa para quem procura material — e manter
 * dois lotes só porque estão em corredores diferentes é justamente o que faz
 * alguém achar 8 peças quando existem 59.
 */

export interface LoteComparavel {
  id: string
  codigo: string
  modelo_perfil_id: string
  acabamento_id: string
  comprimento_mm: number
  quantidade: number
  quantidade_reservada: number
  status: string
  criado_em: string
}

/** A identidade de um lote para efeito de duplicidade. */
export function chaveDoLote(lote: {
  modelo_perfil_id: string
  acabamento_id: string
  comprimento_mm: number
}): string {
  return `${lote.modelo_perfil_id}|${lote.acabamento_id}|${lote.comprimento_mm}`
}

/**
 * O lote disponível que já guarda peças iguais às que estão sendo lançadas.
 *
 * Devolve o MAIS ANTIGO quando há vários: ele é o que provavelmente já está
 * etiquetado na prateleira e conhecido pela equipe. Somar ao recém-criado
 * espalharia o material entre lotes em vez de juntar.
 */
export function loteEquivalente<T extends LoteComparavel>(
  lotes: readonly T[],
  procurado: {
    modelo_perfil_id: string
    acabamento_id: string
    comprimento_mm: number
  },
): T | null {
  const chave = chaveDoLote(procurado)

  const candidatos = lotes
    .filter((lote) => lote.status === 'disponivel')
    .filter((lote) => chaveDoLote(lote) === chave)
    .sort((a, b) => a.criado_em.localeCompare(b.criado_em))

  return candidatos[0] ?? null
}

export interface GrupoDuplicado<T> {
  lotes: T[]
  /** Peças somadas dos lotes do grupo. */
  pecas: number
}

/**
 * Grupos de lotes repetidos que já existem no estoque.
 *
 * Só grupos com dois ou mais: um lote sozinho não é duplicidade. E só
 * disponíveis — lote consumido não atrapalha quem procura material hoje, e
 * juntá-lo ao histórico de outro reescreveria o passado.
 */
export function duplicadosNoEstoque<T extends LoteComparavel>(
  lotes: readonly T[],
): GrupoDuplicado<T>[] {
  const grupos = new Map<string, T[]>()

  for (const lote of lotes) {
    if (lote.status !== 'disponivel') continue

    const chave = chaveDoLote(lote)
    const atual = grupos.get(chave) ?? []

    atual.push(lote)
    grupos.set(chave, atual)
  }

  return (
    [...grupos.values()]
      .filter((lotesDoGrupo) => lotesDoGrupo.length > 1)
      .map((lotesDoGrupo) => ({
        // Mais antigo primeiro: é para ele que os outros serão somados.
        lotes: [...lotesDoGrupo].sort((a, b) =>
          a.criado_em.localeCompare(b.criado_em),
        ),
        pecas: lotesDoGrupo.reduce((total, lote) => total + lote.quantidade, 0),
      }))
      // Mais peças primeiro: são as juntadas que mais mudam o que se vê.
      .sort((a, b) => b.pecas - a.pecas)
  )
}

/**
 * Um lote pode ser juntado a outro?
 *
 * Peça reservada é o impedimento: a reserva aponta para o lote, e mover as
 * peças deixaria a reserva apontando para material que não está mais ali.
 * Quem quiser juntar precisa antes cancelar ou concluir a reserva.
 */
export function podeSerJuntado(lote: LoteComparavel): boolean {
  return lote.status === 'disponivel' && lote.quantidade_reservada === 0
}
