import { LIMITES, type UnidadeMedida } from '@/config/aplicacao'

/**
 * Medidas — conversão e validação.
 *
 * REGRA INEGOCIÁVEL DO SISTEMA: todo comprimento é armazenado como número
 * INTEIRO de milímetros. Nenhuma medida trafega como decimal, em nenhuma
 * camada. Decimal em medida é a origem clássica de erro de vírgula — o
 * serralheiro digita 1,5 pensando em metros, o sistema entende 1,5 mm, e a
 * peça errada é cortada.
 *
 * A interface aceita mm, cm ou m e converte AQUI, na entrada. Depois disso,
 * o resto do sistema só conhece milímetros.
 */

/** Quantos milímetros vale uma unidade de cada tipo. */
const FATOR_PARA_MM: Record<UnidadeMedida, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
}

/**
 * Converte um valor da unidade informada para milímetros inteiros.
 *
 * O arredondamento é necessário por causa da aritmética de ponto flutuante:
 * `1.15 * 1000` resulta em `1149.9999999999998` em JavaScript. Sem arredondar,
 * 1,15 m viraria 1.149 mm — um milímetro a menos, silenciosamente.
 *
 * Frações de milímetro são arredondadas para o inteiro mais próximo, porque
 * nenhuma serra de esquadria trabalha abaixo dessa precisão.
 */
export function converterParaMilimetros(
  valor: number,
  unidade: UnidadeMedida,
): number {
  if (!Number.isFinite(valor)) {
    throw new Error(`Valor de comprimento inválido: ${valor}`)
  }

  return Math.round(valor * FATOR_PARA_MM[unidade])
}

/** Converte milímetros para a unidade informada. Só para exibição. */
export function converterDeMilimetros(
  milimetros: number,
  unidade: UnidadeMedida,
): number {
  return milimetros / FATOR_PARA_MM[unidade]
}

/**
 * Interpreta o que o usuário digitou, aceitando vírgula como separador
 * decimal — que é como se escreve número no Brasil e como o teclado do
 * celular oferece.
 *
 * Retorna `null` quando o texto não é um número válido, para que a tela
 * possa mostrar a mensagem de erro em vez de gravar lixo.
 */
export function interpretarMedidaDigitada(
  texto: string,
  unidade: UnidadeMedida,
): number | null {
  const limpo = texto.trim().replace(',', '.')

  if (limpo === '') {
    return null
  }

  // Recusa "12mm", "1.2.3" e afins: só número puro, com sinal opcional.
  if (!/^-?\d*\.?\d+$/.test(limpo)) {
    return null
  }

  const valor = Number(limpo)

  if (!Number.isFinite(valor)) {
    return null
  }

  return converterParaMilimetros(valor, unidade)
}

/** Motivo pelo qual um comprimento foi recusado. */
export type ErroComprimento =
  'nao-inteiro' | 'zero-ou-negativo' | 'acima-do-limite'

export type ValidacaoComprimento =
  { valido: true } | { valido: false; erro: ErroComprimento; mensagem: string }

/**
 * Valida um comprimento em milímetros contra os limites físicos de sanidade.
 *
 * Estes limites não são regra de negócio configurável — servem para barrar
 * erro de digitação (um zero a mais) e valor impossível. O comprimento
 * mínimo de sobra APROVEITÁVEL é outra coisa, é configurável pelo
 * administrador, e vive em `configuracoes_aplicacao`.
 */
export function validarComprimento(milimetros: number): ValidacaoComprimento {
  if (!Number.isInteger(milimetros)) {
    return {
      valido: false,
      erro: 'nao-inteiro',
      mensagem: 'O comprimento precisa ser um número inteiro de milímetros.',
    }
  }

  if (milimetros < LIMITES.comprimentoMinimoMm) {
    return {
      valido: false,
      erro: 'zero-ou-negativo',
      mensagem: 'Informe um comprimento maior que zero.',
    }
  }

  if (milimetros > LIMITES.comprimentoMaximoMm) {
    const maximoEmMetros = LIMITES.comprimentoMaximoMm / 1000
    return {
      valido: false,
      erro: 'acima-do-limite',
      mensagem: `Comprimento acima do limite de ${maximoEmMetros} m. Confira se digitou um zero a mais.`,
    }
  }

  return { valido: true }
}

/**
 * Formata um comprimento para leitura.
 *
 * Metros só quando o valor é redondo em centímetros: 6000 vira "6 m" e 1800
 * vira "1,8 m", que é como se fala na oficina. Qualquer valor com milímetro
 * quebrado sai em milímetros — 1803 vira "1.803 mm", nunca "1,803 m".
 *
 * O motivo é evitar confusão de vírgula, o mesmo perigo que faz o sistema
 * guardar tudo como inteiro. Escrito "1,803 m", o número é lido como mil e
 * oitocentos e três por quem está acostumado a ver medida em milímetro — e
 * a diferença entre 1.803 mm e 1,803 mm é a peça inteira.
 */
export function formatarComprimento(milimetros: number): string {
  const emMilimetros = `${milimetros.toLocaleString('pt-BR')} mm`

  if (milimetros < 1000) {
    return emMilimetros
  }

  // Milímetro quebrado: mostrar em metros esconderia a precisão que importa
  // na hora de cortar.
  if (milimetros % 10 !== 0) {
    return emMilimetros
  }

  if (milimetros % 1000 === 0) {
    return `${milimetros / 1000} m`
  }

  const metros = (milimetros / 1000).toFixed(2).replace(/0$/, '')

  return `${metros.replace('.', ',')} m`
}
