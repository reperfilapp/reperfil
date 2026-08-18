/**
 * Como o produto acabado se apresenta na tela.
 *
 * Fica separado de `producao.ts` de propósito: aquele arquivo é o cálculo de
 * viabilidade, e formatação de texto não tem por que ser recarregada junto
 * com ele nem testada junto dele.
 */

interface ComMedidas {
  largura_mm?: number | null
  altura_mm?: number | null
}

/**
 * "1,50 × 1,00 m" — como se fala no balcão.
 *
 * Em metros, e não nos milímetros do banco: o cliente pede "janela de um e
 * meio por um", e mostrar "1500 × 1000 mm" obriga quem lê a converter de
 * cabeça toda vez. Milímetro é a unidade do corte, não a da conversa.
 *
 * Devolve nulo quando falta uma das medidas — meia medida ("1,50 × ?") não
 * ajuda ninguém e ocupa a linha.
 */
export function formatarMedidaProduto(produto: ComMedidas): string | null {
  const { largura_mm: largura, altura_mm: altura } = produto

  if (largura == null || altura == null) return null

  const metros = (mm: number) => (mm / 1000).toFixed(2).replace('.', ',')

  return `${metros(largura)} × ${metros(altura)} m`
}
