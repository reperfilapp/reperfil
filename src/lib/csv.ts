/**
 * Geração de CSV para abrir no Excel brasileiro.
 *
 * Três detalhes que decidem se o arquivo abre certo ou vira uma coluna só
 * cheia de caracteres estranhos:
 *
 * 1. **Separador ponto e vírgula.** O Excel em português usa a vírgula como
 *    separador decimal, então adota `;` como separador de colunas. Um CSV com
 *    vírgula abre com tudo amontoado numa coluna.
 *
 * 2. **Marca de ordem de bytes (BOM).** Sem ela o Excel supõe a codificação
 *    do Windows e "Alumínio" vira "AlumÃ­nio". Três bytes no início resolvem.
 *
 * 3. **Números com vírgula decimal.** 1.5 precisa sair como "1,5", ou o Excel
 *    lê como texto e não soma.
 */

export type ValorCelula = string | number | boolean | null | undefined

export interface ColunaCsv<T> {
  cabecalho: string
  valor: (linha: T) => ValorCelula
}

const SEPARADOR = ';'
const BOM = '﻿'

/**
 * Escapa um valor para uma célula.
 *
 * Aspas dentro do texto são dobradas, e qualquer célula com separador, aspas
 * ou quebra de linha vai entre aspas — senão uma observação com ponto e
 * vírgula quebraria a linha inteira em colunas erradas.
 */
function escapar(valor: ValorCelula): string {
  if (valor === null || valor === undefined) return ''

  if (typeof valor === 'boolean') return valor ? 'sim' : 'não'

  if (typeof valor === 'number') {
    if (!Number.isFinite(valor)) return ''

    // Vírgula decimal, sem separador de milhar: o separador de milhar
    // confundiria o Excel, que já entende o ponto como decimal em outros
    // idiomas.
    return String(valor).replace('.', ',')
  }

  const texto = String(valor)

  if (
    texto.includes(SEPARADOR) ||
    texto.includes('"') ||
    texto.includes('\n') ||
    texto.includes('\r')
  ) {
    return `"${texto.replaceAll('"', '""')}"`
  }

  return texto
}

export function gerarCsv<T>(
  linhas: readonly T[],
  colunas: readonly ColunaCsv<T>[],
): string {
  const cabecalho = colunas.map((c) => escapar(c.cabecalho)).join(SEPARADOR)

  const corpo = linhas.map((linha) =>
    colunas.map((coluna) => escapar(coluna.valor(linha))).join(SEPARADOR),
  )

  // Quebra de linha do Windows: é o que o Excel espera, e o Bloco de Notas
  // antigo mostra tudo numa linha só sem ela.
  return BOM + [cabecalho, ...corpo].join('\r\n')
}

/** Nome de arquivo com a data, para não sobrescrever a exportação anterior. */
export function nomeArquivoComData(prefixo: string, agora: Date): string {
  const doisDigitos = (n: number) => String(n).padStart(2, '0')

  const data =
    `${agora.getFullYear()}-` +
    `${doisDigitos(agora.getMonth() + 1)}-` +
    `${doisDigitos(agora.getDate())}`

  return `${prefixo}-${data}.csv`
}

/**
 * Entrega o arquivo ao usuário.
 *
 * Usa um link temporário em vez de abrir uma nova aba: aba nova com conteúdo
 * de texto é bloqueada por bloqueador de pop-up e, no celular, mostraria o
 * CSV cru na tela em vez de baixar.
 */
export function baixarCsv(conteudo: string, nomeArquivo: string): void {
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')

  link.href = url
  link.download = nomeArquivo
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)

  // Libera a memória do blob. Sem isto, exportar muitas vezes numa sessão
  // longa acumula os arquivos inteiros na memória do navegador.
  URL.revokeObjectURL(url)
}
