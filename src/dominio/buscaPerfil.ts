/**
 * Como o serralheiro procura um perfil na caixa de busca.
 *
 * ── O CÓDIGO, DO JEITO QUE SE DIGITA ─────────────────────────────────────
 *
 * No catálogo o código é "SU-001", mas ninguém digita o hífen com a mão suja
 * e o celular numa mão só. Digita "su001", "SU 001" ou, quem já decorou a
 * linha, só "su1". Antes, nenhuma dessas três achava nada — a busca comparava
 * o texto cru, e "su001" não está contido em "SU-001" por causa do hífen.
 * Quem não achava concluía que o perfil não estava cadastrado.
 *
 * São duas regras, e cada uma resolve um caso:
 *
 * • Sem os separadores, comparando por trecho — faz "su001", "SU 001" e
 *   "su-001" caírem todas em "su001", e mantém a busca funcionando enquanto
 *   se digita ("s", "su", "su0"…), que é o que evita a lista piscar vazia.
 *
 * • Sem os zeros à esquerda, comparando por IGUALDADE — é o que faz "su1"
 *   achar o SU-001. A igualdade aqui não é preciosismo: por trecho, "su1"
 *   passaria a casar com SU-011, SU-013 e mais uma dúzia, e o perfil
 *   procurado se perderia no meio deles.
 *
 * ── AS MEDIDAS, EM QUALQUER ORDEM ────────────────────────────────────────
 *
 * Com a ponta na mão, o serralheiro mede o que dá para medir e digita os
 * números: "35 25 20", "25 35", "20 25". A ordem é a que ele mediu, não a
 * que o catálogo guardou — cobrar uma ordem seria cobrar que ele adivinhasse
 * qual medida o cadastro chama de largura.
 *
 * Só entra em ação com DOIS números ou mais. Um número só é ambíguo demais:
 * "25" é medida, mas também é a linha 25 e um pedaço de meia dúzia de
 * códigos — e a busca por texto já dá conta disso.
 */
import { candidatosPorMedida } from './secao'

/** Só letras e algarismos, sem acento: "SU-001" e "su 001" viram "su001". */
export function normalizarCodigo(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

/** "su001" vira "su1"; "su100" continua "su100". */
export function semZerosAEsquerda(texto: string): string {
  return texto.replace(/\d+/g, (digitos) => String(Number(digitos)))
}

/** O código responde a este termo? */
export function codigoCombina(codigo: string, termo: string): boolean {
  const procurado = normalizarCodigo(termo)

  if (procurado === '') return false

  const alvo = normalizarCodigo(codigo)

  return (
    alvo.includes(procurado) ||
    semZerosAEsquerda(alvo) === semZerosAEsquerda(procurado)
  )
}

/**
 * Os números que o termo traz, quando ele é uma sequência de MEDIDAS.
 *
 * Devolve vazio se houver qualquer letra — "su 25" é busca de código, não de
 * medida — ou se houver um número só, que é ambíguo demais para valer.
 *
 * Aceita os separadores que aparecem na prática: espaço, "x" e "×", que é
 * como a medida vem escrita em desenho e em conversa ("35x25").
 */
export function medidasDigitadas(termo: string): number[] {
  const limpo = termo.trim().toLowerCase().replace(/[x×]/g, ' ')

  if (limpo === '' || /[^\d\s,.]/.test(limpo)) return []

  const numeros = limpo
    .split(/\s+/)
    .map((parte) => Number(parte.replace(',', '.')))
    .filter((n) => Number.isFinite(n) && n > 0)

  return numeros.length >= 2 ? numeros : []
}

interface PerfilBuscavel {
  codigo: string
  descricao: string
  linha?: string | null
  aplicacao?: string | null
  largura_secao_mm?: number | null
  altura_secao_mm?: number | null
  medida_3_secao_mm?: number | null
  medida_4_secao_mm?: number | null
}

/**
 * Tolerância da busca por medida, mais apertada que a da tela de identificar.
 *
 * Lá a pessoa está com trena numa ponta cortada e 12% é pouco; aqui ela
 * digita números que leu ou decorou, e 12% devolvia vinte perfis para "20
 * 25" — uma lista que não estreita nada. Seis por cento ainda cobre o erro
 * de 3 a 5% das duas primeiras medidas do catálogo, que são derivadas do
 * peso, e corta a lista pela metade.
 */
const TOLERANCIA_BUSCA = 6

/** Os perfis que respondem ao termo digitado. */
export function filtrarPerfis<T extends PerfilBuscavel>(
  perfis: readonly T[],
  termo: string,
): T[] {
  const busca = termo.trim().toLowerCase()

  if (busca === '') return [...perfis]

  const medidas = medidasDigitadas(termo)

  if (medidas.length > 0) {
    /*
     * União com a busca por texto, e não substituição: "25 35" é medida,
     * mas alguém pode ter cadastrado exatamente isso na descrição de um
     * perfil, e escondê-lo seria esconder um acerto.
     */
    const porMedida = new Set(
      candidatosPorMedida(perfis, medidas, TOLERANCIA_BUSCA).map(
        (candidato) => candidato.perfil,
      ),
    )

    return perfis.filter(
      (perfil) => porMedida.has(perfil) || combinaTexto(perfil, busca),
    )
  }

  return perfis.filter(
    (perfil) =>
      codigoCombina(perfil.codigo, termo) || combinaTexto(perfil, busca),
  )
}

/** Descrição, linha e aplicação — texto corrido, comparado como se lê. */
function combinaTexto(perfil: PerfilBuscavel, busca: string): boolean {
  return (
    perfil.descricao.toLowerCase().includes(busca) ||
    (perfil.linha?.toLowerCase().includes(busca) ?? false) ||
    (perfil.aplicacao?.toLowerCase().includes(busca) ?? false)
  )
}
