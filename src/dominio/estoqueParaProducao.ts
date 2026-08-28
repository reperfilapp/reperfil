import type { SobraDisponivel } from './producao'

interface LoteParaProducao {
  modelo_perfil_id: string
  acabamento_id: string
  comprimento_mm: number
  quantidade: number
  quantidade_reservada: number
  status: string
  tipo_material?: 'novo' | 'sobra'
}

/**
 * De onde o cálculo pode tirar material.
 *
 * `tudo` conta o depósito inteiro — é a pergunta "dá para fazer com o que eu
 * tenho?". `so_sobras` ignora as barras novas: responde "dá para fazer sem
 * gastar barra inteira?", que é outra pergunta, e a mais valiosa das duas
 * quando o objetivo é limpar o estoque de retalho antes de comprar.
 */
export type FonteMaterial = 'tudo' | 'so_sobras'

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
  fonte: FonteMaterial = 'tudo',
): SobraDisponivel[] {
  return (
    lotes
      .filter((lote) => lote.status === 'disponivel')
      /*
       * Lote sem `tipo_material` conta como sobra. O campo nasceu depois do
       * cadastro de estoque: o que foi lançado antes dele não é barra nova
       * comprada, é retalho — e sumir com esse material do cálculo por causa
       * de um campo vazio seria pior do que classificá-lo pelo passado.
       */
      .filter(
        (lote) =>
          fonte === 'tudo' || (lote.tipo_material ?? 'sobra') === 'sobra',
      )
      .map((lote) => ({
        modelo_perfil_id: lote.modelo_perfil_id,
        acabamento_id: lote.acabamento_id,
        comprimento_mm: lote.comprimento_mm,
        quantidade: lote.quantidade - lote.quantidade_reservada,
      }))
      .filter((sobra) => sobra.quantidade > 0)
  )
}
