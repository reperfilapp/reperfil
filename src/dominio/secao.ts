/**
 * Seção transversal do perfil, derivada do peso.
 *
 * ── DE ONDE VEM ESTE CÁLCULO ─────────────────────────────────────────────
 *
 * O peso por metro de um perfil de alumínio não é um número solto: ele é
 * consequência direta de quanto metal existe na seção. Tomando um metro de
 * perfil com seção de área A:
 *
 *   volume = A mm² × 1.000 mm = 1.000·A mm³ = A cm³
 *   peso   = volume × densidade = A × 2,70 g
 *
 * Ou seja, `peso por metro (g/m) = 2,70 × área (mm²)`. Invertendo, a área da
 * seção sai do peso que já está cadastrado — sem paquímetro e sem digitar
 * ficha nenhuma.
 *
 * ── PARA QUE SERVE ───────────────────────────────────────────────────────
 *
 * 1. Identificar uma ponta sem etiqueta: pesar a peça e dividir pelo
 *    comprimento dá o g/m, que aponta o perfil (ou um punhado deles).
 * 2. Desempatar perfis de mesma forma e tamanhos diferentes — que é
 *    justamente onde o olho erra, numa linha como a 25.
 * 3. Conferir cadastro: peso que destoa da família costuma ser dígito
 *    trocado na importação.
 *
 * ── O QUE ESTE CÁLCULO NÃO É ─────────────────────────────────────────────
 *
 * A área é do METAL, não do retângulo que envolve o perfil. Um tubo 50×38 e
 * uma chapa dobrada podem ter a mesma área e tamanhos externos muito
 * diferentes. Por isso a área desempata, mas não substitui o desenho: a
 * conferência final continua sendo visual.
 */

/**
 * Densidade das ligas de alumínio usadas em esquadria (6060, 6063, 6061).
 *
 * Todas ficam em 2,70 g/cm³, variando na terceira casa — diferença menor do
 * que a tolerância de fabricação do próprio perfil, e muito menor do que a
 * balança de oficina consegue medir.
 */
export const DENSIDADE_ALUMINIO_G_CM3 = 2.7

/**
 * Área da seção transversal, em mm², a partir do peso por metro.
 *
 * Devolve `null` quando não há peso cadastrado — a ausência é informação, e
 * inventar zero faria o perfil parecer ter seção nula.
 */
export function areaSecaoMm2(pesoPorMetroG: number | null): number | null {
  if (pesoPorMetroG === null || pesoPorMetroG <= 0) return null

  return pesoPorMetroG / DENSIDADE_ALUMINIO_G_CM3
}

/** Caminho inverso: quanto pesaria por metro um perfil com esta área. */
export function pesoPorMetroG(areaMm2: number): number {
  return areaMm2 * DENSIDADE_ALUMINIO_G_CM3
}

/**
 * Peso por metro de uma peça real, a partir do que a balança mostrou.
 *
 * É o que permite identificar uma ponta sem etiqueta: 1,5 m que pesa 700 g
 * são 467 g/m, e isso já reduz 82 perfis a dois ou três.
 */
export function pesoPorMetroDePeca(
  pesoG: number,
  comprimentoMm: number,
): number | null {
  if (pesoG <= 0 || comprimentoMm <= 0) return null

  return pesoG / (comprimentoMm / 1000)
}

export interface CandidatoPorPeso<T> {
  perfil: T
  pesoPorMetroG: number
  /** Quanto o perfil se afasta do peso medido, em porcento. */
  diferencaPercentual: number
}

/**
 * Perfis compatíveis com um peso por metro medido, do mais próximo ao mais
 * distante.
 *
 * A tolerância existe porque a medição real nunca bate exata: a balança de
 * oficina erra alguns gramas, o comprimento é medido com trena, e o próprio
 * perfil tem tolerância de fabricação (a norma admite variação de espessura
 * de parede). 5% cobre isso com folga sem escancarar a lista.
 *
 * Devolve LISTA, nunca um só: dois perfis podem ter o mesmo peso por metro e
 * formas completamente diferentes. Quem decide é quem está com a peça na
 * mão, olhando o desenho.
 */
export function candidatosPorPeso<
  T extends { peso_por_metro_g: number | null },
>(
  perfis: readonly T[],
  pesoPorMetroMedidoG: number,
  toleranciaPercentual = 5,
): CandidatoPorPeso<T>[] {
  if (pesoPorMetroMedidoG <= 0) return []

  return perfis
    .flatMap((perfil) => {
      const peso = perfil.peso_por_metro_g

      if (peso === null || peso <= 0) return []

      const diferenca =
        (Math.abs(peso - pesoPorMetroMedidoG) / pesoPorMetroMedidoG) * 100

      if (diferenca > toleranciaPercentual) return []

      return [{ perfil, pesoPorMetroG: peso, diferencaPercentual: diferenca }]
    })
    .sort((a, b) => a.diferencaPercentual - b.diferencaPercentual)
}

/** "167 mm²" — a área da seção, arredondada, como se lê numa ficha. */
export function formatarAreaSecao(areaMm2: number): string {
  return `${Math.round(areaMm2).toLocaleString('pt-BR')} mm²`
}

export interface CandidatoPorMedida<T> {
  perfil: T
  /** Maior desvio entre as medidas informadas e as do perfil, em porcento. */
  desvioPercentual: number
}

interface ComSecao {
  /*
   * Aceita `undefined` de propósito: enquanto a migração das dimensões não
   * for aplicada, o banco nem devolve estas colunas, e o campo chega
   * ausente em vez de nulo. Tratar só `null` fazia a tela quebrar — o app
   * precisa funcionar antes e depois da migração.
   */
  largura_secao_mm?: number | null
  altura_secao_mm?: number | null
  /* Cotas internas, informadas à mão. Quase sempre ausentes. */
  medida_3_secao_mm?: number | null
  medida_4_secao_mm?: number | null
}

/** As medidas que o catálogo conhece deste perfil, sem as ausentes. */
export function medidasConhecidas(perfil: ComSecao): number[] {
  return [
    perfil.largura_secao_mm,
    perfil.altura_secao_mm,
    perfil.medida_3_secao_mm,
    perfil.medida_4_secao_mm,
  ].filter((d): d is number => d != null && d > 0)
}

/**
 * Perfis compatíveis com as medidas tiradas de trena.
 *
 * ── POR QUE ACEITA VÁRIAS MEDIDAS ────────────────────────────────────────
 *
 * Quem está com a ponta na mão mede o que é fácil de medir: a largura por
 * fora, a altura, a aba que sobra, o vão de uma câmara. Não sabe — nem tem
 * como saber — quais dessas o catálogo conhece.
 *
 * Por isso a função não pede "largura e altura": recebe o punhado de
 * medidas que a pessoa conseguiu tirar e PROCURA, dentro delas, as que o
 * catálogo conhece. Medida que não corresponde a nada não elimina o perfil,
 * porque provavelmente é uma cota interna que o catálogo ainda não tem.
 *
 * Quanto mais medidas o CATÁLOGO tiver daquele perfil, mais estreita fica a
 * lista: cada dimensão conhecida precisa achar uma medida informada que a
 * explique. Um perfil com as quatro cotas cadastradas é bem mais difícil de
 * confundir do que um com só as duas externas.
 *
 * ── A TOLERÂNCIA ─────────────────────────────────────────────────────────
 *
 * Generosa de propósito. As duas primeiras medidas do catálogo são
 * DERIVADAS do peso e do desenho, com erro de 3 a 5%, e a trena numa ponta
 * cortada erra parecido. Apertar faria o perfil certo ficar de fora — a
 * única falha cara aqui, já que quem não encontra o perfil desiste e
 * cadastra errado, ou não cadastra.
 */
export function candidatosPorMedida<T extends ComSecao>(
  perfis: readonly T[],
  medidasMm: readonly number[],
  toleranciaPercentual = 12,
): CandidatoPorMedida<T>[] {
  const medidas = medidasMm.filter((m) => Number.isFinite(m) && m > 0)

  if (medidas.length === 0) return []

  return perfis
    .flatMap((perfil) => {
      const dimensoes = medidasConhecidas(perfil)

      if (dimensoes.length === 0) return []

      /*
       * Cada dimensão conhecida precisa achar uma medida informada que a
       * explique, e cada medida só serve a uma dimensão — senão um perfil
       * quadrado casaria duas vezes com a mesma medida.
       *
       * Quando a pessoa informou menos medidas do que o perfil tem
       * dimensões, só é possível cobrar o que ela deu: uma medida só não
       * pode provar largura E altura.
       */
      const disponiveis = [...medidas]
      const aCobrir = Math.min(dimensoes.length, medidas.length)
      const desvios: number[] = []

      for (const dimensao of dimensoes) {
        let melhorIndice = -1
        let melhorDesvio = Infinity

        for (let i = 0; i < disponiveis.length; i++) {
          const desvio = (Math.abs(disponiveis[i]! - dimensao) / dimensao) * 100

          if (desvio < melhorDesvio) {
            melhorDesvio = desvio
            melhorIndice = i
          }
        }

        if (melhorIndice >= 0 && melhorDesvio <= toleranciaPercentual) {
          desvios.push(melhorDesvio)
          disponiveis.splice(melhorIndice, 1)
        }
      }

      if (desvios.length < aCobrir) return []

      return [{ perfil, desvioPercentual: Math.max(...desvios) }]
    })
    .sort((a, b) => a.desvioPercentual - b.desvioPercentual)
}

/**
 * As medidas da seção numa linha só, para a ficha do perfil.
 *
 * Junta tudo que o catálogo conhece — "125 × 125 × 452 × 52 mm" — em vez de
 * uma linha por medida. Quem confere uma ponta na mão lê a sequência e
 * compara com o que a trena deu; quatro linhas separadas obrigariam a ir e
 * voltar na tela para o mesmo trabalho.
 *
 * A ORDEM IMPORTA e é sempre a mesma: largura, altura, terceira, quarta. As
 * duas primeiras saem do peso e do desenho (aproximadas, erro de 3 a 5%); as
 * outras foram medidas na peça. Medida ausente não vira zero nem buraco —
 * simplesmente não entra, então um perfil com só duas medidas mostra duas.
 */
export function formatarMedidasSecao(perfil: ComSecao): string | null {
  const medidas = medidasConhecidas(perfil)

  if (medidas.length === 0) return null

  const formatar = (v: number) =>
    Number.isInteger(v) ? String(v) : v.toFixed(1).replace('.', ',')

  return `${medidas.map(formatar).join(' × ')} mm`
}
