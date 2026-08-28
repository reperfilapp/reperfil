/**
 * Como cada perfil da lista técnica é montado e cortado.
 *
 * ── POR QUE ISTO PRECISA ESTAR NA RECEITA ────────────────────────────────
 *
 * "1.455 mm do MN-001" não é uma instrução completa de corte. A mesma medida
 * serrada em esquadria ou em topo dá duas peças diferentes, e só uma monta.
 * Quem serra pergunta isso ao montador toda vez que a lista não diz — e
 * quando o montador não está, chuta.
 *
 * ── SENTIDO: O QUE ELE MUDA ──────────────────────────────────────────────
 *
 * O sentido não muda o corte, muda o NOME das pontas. Um perfil deitado tem
 * ponta esquerda e direita; em pé tem ponta de cima e de baixo. É a mesma
 * peça — mas "corta a 45 na esquerda" é incompreensível para quem está com
 * um montante em pé na bancada.
 */

/** Deitado (h) ou em pé (v), como a peça fica montada na esquadria. */
export type SentidoMontagem = 'h' | 'v'

/**
 * O corte de UMA ponta.
 *
 * ── POR QUE SÓ TRÊS ──────────────────────────────────────────────────────
 *
 * O corte reto é um só: 90° não tem inclinação para variar, e de que lado da
 * peça ele acontece já está dito pelo botão da ponta — cada ponta tem o seu.
 * Distinguir "90° em cima" de "90° em baixo" seria pedir uma escolha que não
 * muda peça nenhuma.
 *
 * A meia-esquadria tem duas, e só duas: numa ponta, um corte a 45° só pode
 * correr para um lado ou para o outro. O que se chamava de "invertido" era a
 * mesma inclinação vista pela outra ponta — e a ponta já é escolhida à parte.
 */
export type TipoCorte = 'reto' | 'meia_cima' | 'meia_baixo'

/** Qual ponta do perfil. Os nomes que a pessoa lê dependem do sentido. */
export type PontaCorte = 'inicio' | 'fim'

/**
 * A ordem do rodízio do botão.
 *
 * O reto primeiro: é o padrão de quem ainda não parou para pensar no assunto,
 * e deixá-lo à frente faz o primeiro toque sair do lugar mais provável.
 */
export const CORTES: readonly TipoCorte[] = ['reto', 'meia_cima', 'meia_baixo']

/** O corte assumido por quem não escolheu — e pelo que já estava cadastrado. */
export const CORTE_PADRAO: TipoCorte = 'reto'

export const SENTIDO_PADRAO: SentidoMontagem = 'h'

/**
 * O próximo do rodízio, voltando ao começo no fim.
 *
 * Valor desconhecido cai no padrão em vez de travar: a coluna aceita texto,
 * e um dia alguém corrige uma linha direto no banco.
 */
export function proximoCorte(atual: TipoCorte): TipoCorte {
  const indice = CORTES.indexOf(atual)

  if (indice < 0) return CORTE_PADRAO

  return CORTES[(indice + 1) % CORTES.length] ?? CORTE_PADRAO
}

/** 90 ou 45 — o que se grita para quem está na serra. */
export function anguloDoCorte(corte: TipoCorte): 90 | 45 {
  return corte === 'reto' ? 90 : 45
}

/** O sentido alterna entre dois valores, como o botão. */
export function outroSentido(atual: SentidoMontagem): SentidoMontagem {
  return atual === 'h' ? 'v' : 'h'
}

/**
 * Como a ponta se chama, em pé ou deitada.
 *
 * Curto de propósito: o rótulo divide um botão pequeno com o desenho, e
 * "Lado esquerdo" por extenso empurraria o desenho para fora.
 */
export function rotuloDaPonta(
  sentido: SentidoMontagem,
  ponta: PontaCorte,
): string {
  if (sentido === 'h') return ponta === 'inicio' ? 'LE' : 'LD'

  return ponta === 'inicio' ? 'LC' : 'LB'
}

/**
 * O nome da ponta quebrado em duas linhas, para o botão do seletor.
 *
 * A quebra é escolhida, não deixada ao acaso do `flex-wrap`: a segunda linha
 * fica sempre com a palavra que DISTINGUE as duas pontas — "esquerdo",
 * "cima" —, e a primeira é sempre "Lado". Assim as duas pontas se comparam
 * lendo só a linha de baixo.
 */
export function linhasDaPonta(
  sentido: SentidoMontagem,
  ponta: PontaCorte,
): readonly [string, string] {
  if (sentido === 'h') {
    return ['Lado', ponta === 'inicio' ? 'esquerdo' : 'direito']
  }

  return ['Lado', ponta === 'inicio' ? 'cima' : 'baixo']
}

/** Nome por extenso, para leitor de tela e para a folha impressa. */
export function rotuloDaPontaPorExtenso(
  sentido: SentidoMontagem,
  ponta: PontaCorte,
): string {
  if (sentido === 'h')
    return ponta === 'inicio' ? 'lado esquerdo' : 'lado direito'

  return ponta === 'inicio' ? 'lado de cima' : 'lado de baixo'
}

export function rotuloDoSentido(sentido: SentidoMontagem): string {
  return sentido === 'h' ? 'Deitado' : 'Em pé'
}

/**
 * O corte em texto, para onde não cabe desenho — folha impressa e leitor de
 * tela. "45° invertido" é o que a oficina fala; inventar um código curto
 * obrigaria a decorar uma legenda.
 */
export function descreverCorte(corte: TipoCorte): string {
  // O reto não ganha complemento: "90°" já diz tudo que há para dizer sobre
  // ele, e "90° cima" faria procurar uma diferença que não existe.
  if (corte === 'reto') return '90°'

  // A direção do corte já está no desenho da barra; repetir "cima" ou "baixo"
  // em texto não acrescenta informação para quem conferirá pelo desenho.
  return '45°'
}

/** A instrução das duas pontas numa linha só, para a lista impressa. */
export function descreverCortes(
  sentido: SentidoMontagem,
  inicio: TipoCorte,
  fim: TipoCorte,
): string {
  const nomeInicio = rotuloDaPonta(sentido, 'inicio')
  const nomeFim = rotuloDaPonta(sentido, 'fim')

  return `${nomeInicio} ${descreverCorte(inicio)} · ${nomeFim} ${descreverCorte(fim)}`
}

/**
 * Aceita o que veio do banco, ou devolve o padrão.
 *
 * As colunas nasceram depois da lista técnica: tudo que foi cadastrado antes
 * chega nulo, e a tela precisa mostrar ALGO. Corte reto é a suposição menos
 * arriscada — é o que "1.455 mm" sempre quis dizer antes de existir esta
 * informação.
 */
export function corteValido(valor: string | null | undefined): TipoCorte {
  return CORTES.includes(valor as TipoCorte)
    ? (valor as TipoCorte)
    : CORTE_PADRAO
}

export function sentidoValido(
  valor: string | null | undefined,
): SentidoMontagem {
  return valor === 'h' || valor === 'v' ? valor : SENTIDO_PADRAO
}
