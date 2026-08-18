/**
 * CPF, CNPJ e telefone: máscara enquanto se digita e validação ao sair.
 *
 * ── POR QUE VALIDAR, E NÃO SÓ MASCARAR ───────────────────────────────────
 *
 * Máscara arruma a aparência e não impede nada: "111.111.111-11" tem cara de
 * CPF e não é CPF nenhum. O dígito verificador existe justamente para pegar
 * o erro de digitação na hora — um número trocado de lugar, um dígito a
 * menos. Num cadastro de cliente que vai virar nota fiscal, descobrir isso
 * meses depois custa caro.
 *
 * ── POR QUE O CAMPO ACEITA O NÚMERO INVÁLIDO ─────────────────────────────
 *
 * A validação avisa, não bloqueia. Quem cadastra costuma estar copiando de
 * um papel, e às vezes o papel está errado ou incompleto. Travar o
 * salvamento faria a pessoa inventar um número qualquer para conseguir
 * seguir — e aí o cadastro fica pior do que se tivesse ficado vazio.
 */

/** Só os dígitos, que é o que o banco guarda e o que se compara. */
export function apenasDigitos(texto: string): string {
  return texto.replace(/\D/g, '')
}

// ── CPF e CNPJ ─────────────────────────────────────────────────────────────

const TAMANHO_CPF = 11
const TAMANHO_CNPJ = 14

/**
 * Aplica a máscara conforme o tanto que já foi digitado.
 *
 * Decide entre CPF e CNPJ pelo comprimento, sem perguntar qual é: quem
 * cadastra sabe o número, não a categoria dele, e um seletor "pessoa física
 * ou jurídica" antes do campo é uma pergunta que o próprio número responde.
 */
export function formatarCpfCnpj(texto: string): string {
  const d = apenasDigitos(texto).slice(0, TAMANHO_CNPJ)

  if (d.length <= TAMANHO_CPF) {
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
  }

  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3/$4')
    .replace(/^(\d{2})\.(\d{3})\.(\d{3})\/(\d{4})(\d)/, '$1.$2.$3/$4-$5')
}

/**
 * Dígito verificador de CPF: soma ponderada, módulo 11.
 *
 * Sequências de dígito repetido (111.111.111-11) passam na conta e são
 * inválidas por convenção — são justamente o que alguém digita para "furar"
 * um campo obrigatório, então precisam ser barradas à parte.
 */
function cpfValido(d: string): boolean {
  if (d.length !== TAMANHO_CPF) return false
  if (/^(\d)\1+$/.test(d)) return false

  const digito = (ate: number): number => {
    let soma = 0

    for (let i = 0; i < ate; i++) {
      soma += Number(d[i]) * (ate + 1 - i)
    }

    const resto = (soma * 10) % 11

    return resto === 10 ? 0 : resto
  }

  return digito(9) === Number(d[9]) && digito(10) === Number(d[10])
}

/** Mesma ideia do CPF, com os pesos cíclicos de 2 a 9 que o CNPJ usa. */
function cnpjValido(d: string): boolean {
  if (d.length !== TAMANHO_CNPJ) return false
  if (/^(\d)\1+$/.test(d)) return false

  const digito = (ate: number): number => {
    let soma = 0
    let peso = 2

    for (let i = ate - 1; i >= 0; i--) {
      soma += Number(d[i]) * peso
      peso = peso === 9 ? 2 : peso + 1
    }

    const resto = soma % 11

    return resto < 2 ? 0 : 11 - resto
  }

  return digito(12) === Number(d[12]) && digito(13) === Number(d[13])
}

/**
 * Devolve o problema do documento, ou null quando está bom.
 *
 * Campo vazio não é problema: documento é opcional em todo cadastro do app.
 */
export function erroCpfCnpj(texto: string): string | null {
  const d = apenasDigitos(texto)

  if (d === '') return null

  if (d.length !== TAMANHO_CPF && d.length !== TAMANHO_CNPJ) {
    return 'Faltam dígitos: CPF tem 11 e CNPJ tem 14.'
  }

  const valido = d.length === TAMANHO_CPF ? cpfValido(d) : cnpjValido(d)

  if (!valido) {
    return d.length === TAMANHO_CPF
      ? 'Este CPF não existe. Confira os números.'
      : 'Este CNPJ não existe. Confira os números.'
  }

  return null
}

// ── Telefone ───────────────────────────────────────────────────────────────

const TAMANHO_FIXO = 10
const TAMANHO_CELULAR = 11

/**
 * Máscara de telefone brasileiro, com e sem o nono dígito.
 *
 * Fixo e celular convivem: a serralheria liga para o telefone da obra tanto
 * quanto para o celular do cliente.
 */
export function formatarTelefone(texto: string): string {
  const d = apenasDigitos(texto).slice(0, TAMANHO_CELULAR)

  if (d.length <= 2) return d.length === 0 ? '' : `(${d}`

  const ddd = d.slice(0, 2)
  const resto = d.slice(2)

  if (resto.length <= 4) return `(${ddd}) ${resto}`

  // Com 5 dígitos depois do DDD ainda não dá para saber se é fixo ou
  // celular. Quebrar em 4+resto acompanha a digitação sem pular o cursor.
  const corte = d.length >= TAMANHO_CELULAR ? 5 : 4

  return `(${ddd}) ${resto.slice(0, corte)}-${resto.slice(corte)}`
}

export function erroTelefone(texto: string): string | null {
  const d = apenasDigitos(texto)

  if (d === '') return null

  if (d.length !== TAMANHO_FIXO && d.length !== TAMANHO_CELULAR) {
    return 'Informe DDD e número: 10 dígitos no fixo, 11 no celular.'
  }

  // DDD brasileiro começa em 11. Abaixo disso é digitação sem o DDD, o erro
  // mais comum de todos — a pessoa digita o número de casa e esquece que
  // quem vai ligar pode estar noutro estado.
  if (Number(d.slice(0, 2)) < 11) {
    return 'DDD inválido. Ele vem antes do número, como em (54) 99999-0000.'
  }

  return null
}

// ── E-mail ─────────────────────────────────────────────────────────────────

/**
 * Confere o formato do e-mail, sem prometer que ele existe.
 *
 * Nenhuma expressão regular sabe se a caixa postal existe — só o envio
 * descobre isso. O que dá para pegar aqui é o erro de digitação que
 * inutiliza o convite antes de ele sair: espaço no meio, arroba faltando,
 * domínio sem ponto, o "gmail.con" do fim do dia.
 *
 * A regra é deliberadamente frouxa. Endereço válido pode ter formas
 * estranhas, e uma validação rígida rejeita e-mail legítimo — que é um erro
 * pior, porque a pessoa não tem como convencer o sistema de que o próprio
 * endereço existe.
 */
export function erroEmail(texto: string): string | null {
  const email = texto.trim()

  if (email === '') return null

  if (/\s/.test(email)) {
    return 'O e-mail não pode ter espaços.'
  }

  const partes = email.split('@')

  if (partes.length !== 2 || partes[0] === '' || partes[1] === '') {
    return 'Falta o @ ou o que vem antes ou depois dele.'
  }

  const dominio = partes[1]!

  if (
    !dominio.includes('.') ||
    dominio.startsWith('.') ||
    dominio.endsWith('.')
  ) {
    return 'O domínio parece incompleto, como em exemplo@gmail.com.'
  }

  return null
}
