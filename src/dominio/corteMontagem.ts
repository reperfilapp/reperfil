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

/** O sentido e os dois cortes de UMA peça — a forma de um corte, sem quantidade. */
export interface CorteDaPeca {
  sentido: SentidoMontagem
  corte_inicio: TipoCorte
  corte_fim: TipoCorte
}

/**
 * Um GRUPO de peças que compartilham o mesmo corte — o que a linha da lista
 * técnica guarda quando não é uniforme.
 *
 * ── POR QUE GRUPO, E NÃO UMA ENTRADA POR PEÇA FÍSICA ─────────────────────
 *
 * A primeira versão deste recurso guardava uma entrada por PEÇA: quatro
 * peças, quatro entradas, mesmo quando só existiam dois cortes diferentes
 * entre elas (duas retas, duas em meia-esquadria). Isso obrigava a pessoa a
 * preencher quatro cartões repetindo o mesmo corte duas vezes, e a folha
 * impressa desenhava a mesma peça quatro vezes em vez de duas — pequeno
 * demais para conferir, e sem necessidade.
 *
 * Agora a exceção é por GRUPO: cada grupo tem o corte E quantas peças o
 * usam. A soma das quantidades dos grupos sempre bate com a quantidade da
 * linha. "4 peças, 2 retas e 2 em meia-esquadria" vira dois grupos —
 * `{quantidade: 2, ...reto}` e `{quantidade: 2, ...meia-esquadria}` — em vez
 * de quatro entradas quase iguais.
 */
export interface GrupoCorte extends CorteDaPeca {
  /** Quantas peças deste grupo usam este corte. Sempre um inteiro positivo. */
  quantidade: number
}

/** Soma das quantidades de todos os grupos — o total de peças que eles cobrem. */
export function somaQuantidades(grupos: readonly GrupoCorte[]): number {
  return grupos.reduce((soma, grupo) => soma + grupo.quantidade, 0)
}

/** O primeiro grupo, ao ligar a exceção: todas as peças, com o corte único de antes. */
export function criarGrupoUnico(
  quantidade: number,
  padrao: CorteDaPeca,
): GrupoCorte[] {
  return [{ ...padrao, quantidade }]
}

/**
 * Ajusta os grupos para uma nova quantidade TOTAL de peças da linha, sem
 * jogar fora o que a pessoa já dividiu.
 *
 * ── POR QUE O ÚLTIMO GRUPO ABSORVE A DIFERENÇA ───────────────────────────
 *
 * Aumentar a quantidade da linha (mais uma peça) é, de longe, o caso mais
 * comum — e a peça nova quase sempre repete o ÚLTIMO grupo, não o
 * primeiro. Crescer o último grupo resolve isso sem pedir nada de novo: só
 * ao dividir de propósito é que a pessoa cria um grupo diferente.
 *
 * Diminuir tira das últimas peças, removendo grupos inteiros quando a
 * redução alcança um grupo por completo — o comportamento espelha o de
 * aumentar, tirando de onde cresceria.
 */
export function redimensionarGrupos(
  atual: readonly GrupoCorte[],
  novaQuantidadeTotal: number,
): GrupoCorte[] {
  if (atual.length === 0) return []

  const diferenca = novaQuantidadeTotal - somaQuantidades(atual)
  const copia = atual.map((grupo) => ({ ...grupo }))

  if (diferenca === 0) return copia

  if (diferenca > 0) {
    copia[copia.length - 1]!.quantidade += diferenca
    return copia
  }

  let sobrando = -diferenca

  while (sobrando > 0 && copia.length > 0) {
    const ultimo = copia[copia.length - 1]!

    if (ultimo.quantidade <= sobrando) {
      sobrando -= ultimo.quantidade
      copia.pop()
    } else {
      ultimo.quantidade -= sobrando
      sobrando = 0
    }
  }

  // Nunca fica vazio: mesmo que a redução tenha varrido todos os grupos,
  // sobra um, com a nova quantidade (no mínimo 1) e o corte do último grupo
  // original — é o corte mais recentemente ajustado à mão.
  if (copia.length === 0) {
    const ultimoOriginal = atual[atual.length - 1]!
    copia.push({
      ...ultimoOriginal,
      quantidade: Math.max(novaQuantidadeTotal, 1),
    })
  }

  return copia
}

/**
 * Divide um grupo em dois, tirando `quantidadeNoNovo` peças do grupo em
 * `indice` para um grupo novo, logo depois dele — que nasce com o MESMO
 * corte do grupo de origem, para a pessoa só precisar mudar o que é
 * diferente, não preencher os três campos de novo.
 *
 * Nada acontece se o pedido não faz sentido (tirar 0, tirar tudo, ou tirar
 * mais do que o grupo tem) — dividir em um grupo vazio não seria divisão
 * nenhuma.
 */
export function dividirGrupo(
  grupos: readonly GrupoCorte[],
  indice: number,
  quantidadeNoNovo: number,
): GrupoCorte[] {
  const grupo = grupos[indice]

  if (!grupo || quantidadeNoNovo <= 0 || quantidadeNoNovo >= grupo.quantidade) {
    return grupos.map((g) => ({ ...g }))
  }

  const restante = { ...grupo, quantidade: grupo.quantidade - quantidadeNoNovo }
  const novo = { ...grupo, quantidade: quantidadeNoNovo }

  return [
    ...grupos.slice(0, indice).map((g) => ({ ...g })),
    restante,
    novo,
    ...grupos.slice(indice + 1).map((g) => ({ ...g })),
  ]
}

/**
 * Remove um grupo, devolvendo a quantidade dele para o VIZINHO — nunca para
 * o total desaparecer no meio da edição. O vizinho é o anterior, para o
 * grupo continuar "voltando a ser um só" ao remover o último; só o
 * primeiro grupo (sem anterior) devolve para o de depois.
 *
 * Não remove o único grupo restante: isso é "desligar a exceção", uma
 * decisão de fora desta função.
 */
export function removerGrupo(
  grupos: readonly GrupoCorte[],
  indice: number,
): GrupoCorte[] {
  if (grupos.length <= 1 || !grupos[indice]) {
    return grupos.map((g) => ({ ...g }))
  }

  const alvo = indice > 0 ? indice - 1 : indice + 1
  const copia = grupos.map((g) => ({ ...g }))

  copia[alvo]!.quantidade += copia[indice]!.quantidade
  copia.splice(indice, 1)

  return copia
}

/**
 * Lê `grupos_de_corte` como veio do banco (JSONB solto, `unknown`) e devolve
 * a lista validada, ou `null` se não servir.
 *
 * ── POR QUE `null` NO LUGAR DE CORRIGIR GRUPO A GRUPO ────────────────────
 *
 * `corteValido`/`sentidoValido` corrigem um valor solto para o padrão,
 * porque uma linha sem informação nenhuma ainda precisa de ALGUMA resposta.
 * Aqui o caso é diferente: se um grupo vier quebrado, os outros também não
 * são confiáveis — pode ser sinal de que a linha inteira foi gravada por um
 * código antigo, ou corrompida na volta. `null` cai no comportamento de
 * sempre: toda a linha usa o sentido/corte das colunas soltas, igual a
 * antes deste recurso existir.
 */
export function gruposDeCorteValidos(valor: unknown): GrupoCorte[] | null {
  if (!Array.isArray(valor) || valor.length === 0) return null

  const grupos: GrupoCorte[] = []

  for (const item of valor) {
    if (typeof item !== 'object' || item === null) return null

    const { quantidade, sentido, corte_inicio, corte_fim } = item as Record<
      string,
      unknown
    >

    if (
      typeof quantidade !== 'number' ||
      !Number.isInteger(quantidade) ||
      quantidade <= 0 ||
      (sentido !== 'h' && sentido !== 'v') ||
      !CORTES.includes(corte_inicio as TipoCorte) ||
      !CORTES.includes(corte_fim as TipoCorte)
    ) {
      return null
    }

    grupos.push({
      quantidade,
      sentido,
      corte_inicio: corte_inicio as TipoCorte,
      corte_fim: corte_fim as TipoCorte,
    })
  }

  return grupos
}

/**
 * A instrução de corte de uma linha inteira da lista técnica, incluindo
 * quando ela não é uniforme.
 *
 * ── POR QUE A QUANTIDADE NA FRENTE, E NÃO UM NÚMERO DE ORDEM ─────────────
 *
 * A versão anterior numerava peça a peça ("1) ... 2) ... 3) ... 4) ..."),
 * uma entrada por peça física. Como agora a exceção é por GRUPO, "2×" na
 * frente do corte já diz quantas peças o seguem — sem repetir a mesma
 * descrição duas vezes, e sem inventar uma ordem entre peças que, na
 * prática, são intercambiáveis dentro do próprio grupo. Grupo de 1 peça só
 * não ganha prefixo: "1× LE 90°" não diz mais que "LE 90°" sozinho.
 */
export function descreverGruposDaLinha(
  sentido: SentidoMontagem,
  corteInicio: TipoCorte,
  corteFim: TipoCorte,
  grupos: readonly GrupoCorte[] | null,
): string {
  if (grupos === null) return descreverCortes(sentido, corteInicio, corteFim)

  return grupos
    .map((grupo) => {
      const descricao = descreverCortes(
        grupo.sentido,
        grupo.corte_inicio,
        grupo.corte_fim,
      )

      return grupo.quantidade > 1
        ? `${grupo.quantidade}× ${descricao}`
        : descricao
    })
    .join(' · ')
}
