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

/**
 * Nome do arquivo PDF de um produto.
 *
 * "RePerfil - JAN-INT-1500 - Janela integrada padrao - 2026-08-19"
 *
 * ── POR QUE ESTE FORMATO ─────────────────────────────────────────────────
 *
 * Começa pelo aplicativo, para as folhas ficarem juntas na pasta de
 * downloads. Depois o CÓDIGO, que é o que se procura, e o nome por extenso,
 * para quem não sabe o código de cabeça. A data no fim, no formato que
 * ordena sozinho — o mesmo produto reimpresso depois de uma mudança na lista
 * técnica gera dois arquivos, e a ordem alfabética já os põe em ordem
 * cronológica.
 *
 * ── POR QUE TIRAR ACENTOS E SINAIS ───────────────────────────────────────
 *
 * O nome atravessa o sistema de arquivos do Android, do iPhone e do
 * computador, e vai por e-mail e WhatsApp. Barra e dois-pontos são proibidos
 * em nome de arquivo no Windows; acento sobrevive quase sempre, mas quebra
 * em servidores antigos que a serralheria não controla. Um nome sem graça
 * que sempre abre vale mais do que um bonito que às vezes não.
 */
export function nomeDoArquivo(produto: {
  codigo: string
  nome: string
}): string {
  const limpar = (texto: string) =>
    texto
      .normalize('NFD')
      // Tira os acentos, que a decomposição separou da letra.
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9\-_ ]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()

  const hoje = new Date().toISOString().slice(0, 10)

  return `RePerfil - ${limpar(produto.codigo)} - ${limpar(produto.nome)} - ${hoje}`
}
