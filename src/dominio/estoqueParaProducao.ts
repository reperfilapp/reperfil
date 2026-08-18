import type { SobraDisponivel } from './producao'

interface LoteParaProducao {
  modelo_perfil_id: string
  acabamento_id: string
  comprimento_mm: number
  quantidade: number
  quantidade_reservada: number
  status: string
}

/**
 * O que do depósito pode virar produto agora.
 *
 * ── DUAS EXCLUSÕES QUE MUDAM A RESPOSTA ──────────────────────────────────
 *
 * Peça RESERVADA não conta. Ela já tem dono: prometer uma janela com o
 * material que outra obra está esperando é criar o conflito na oficina, não
 * evitá-lo. Por isso a conta é `quantidade − quantidade_reservada`.
 *
 * Lote que não está DISPONÍVEL não conta. Consumido, descartado ou em
 * conferência são estados em que a peça não está na prateleira pronta para
 * cortar — e "em conferência" é justamente o estado de quem ainda não sabe se
 * a peça existe como está cadastrada.
 */
export function sobrasDisponiveis(
  lotes: readonly LoteParaProducao[],
): SobraDisponivel[] {
  return lotes
    .filter((lote) => lote.status === 'disponivel')
    .map((lote) => ({
      modelo_perfil_id: lote.modelo_perfil_id,
      acabamento_id: lote.acabamento_id,
      comprimento_mm: lote.comprimento_mm,
      quantidade: lote.quantidade - lote.quantidade_reservada,
    }))
    .filter((sobra) => sobra.quantidade > 0)
}
