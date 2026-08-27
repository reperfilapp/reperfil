/**
 * "há 26 minutos", "há 2 dias" — quando algo aconteceu, em linguagem de
 * conversa.
 *
 * ── POR QUE NÃO A DATA CRUA ──────────────────────────────────────────────
 *
 * A pergunta que o administrador faz olhando a lista de acessos é "esta
 * pessoa ainda usa o sistema?". Para responder isso, "25/08/26 11:12" exige
 * uma conta de cabeça contra o dia de hoje; "há 10 minutos" já é a resposta.
 * A data exata continua disponível ao expandir a pessoa, que é quando ela
 * passa a importar.
 *
 * ── POR QUE NÃO `Intl.RelativeTimeFormat` ────────────────────────────────
 *
 * Ele existe e formata bem, mas obriga a escolher a unidade ANTES de
 * chamar — que é justamente a parte difícil. A escolha da unidade é a
 * regra de negócio aqui, e ela cabe em vinte linhas testáveis.
 */

const MINUTO = 60_000
const HORA = 60 * MINUTO
const DIA = 24 * HORA

/**
 * `agora` é parâmetro, e não `Date.now()` lá dentro, para o teste poder
 * fixar o instante — função de tempo que lê o relógio sozinha só é
 * testável com truque.
 */
export function tempoRelativo(quando: Date | string, agora: Date): string {
  const instante = typeof quando === 'string' ? new Date(quando) : quando
  const diferenca = agora.getTime() - instante.getTime()

  if (Number.isNaN(diferenca)) return ''

  // Relógio do celular adiantado em relação ao servidor põe o "último
  // acesso" alguns segundos no futuro. Dizer "em 8 segundos" assustaria
  // sem motivo — para quem lê, é agora.
  if (diferenca < MINUTO) return 'agora mesmo'

  if (diferenca < HORA) {
    const minutos = Math.floor(diferenca / MINUTO)
    return `há ${minutos} ${minutos === 1 ? 'minuto' : 'minutos'}`
  }

  if (diferenca < DIA) {
    const horas = Math.floor(diferenca / HORA)
    return `há ${horas} ${horas === 1 ? 'hora' : 'horas'}`
  }

  const dias = Math.floor(diferenca / DIA)

  if (dias === 1) return 'ontem'
  if (dias < 30) return `há ${dias} dias`

  const meses = Math.floor(dias / 30)

  if (meses < 12) return `há ${meses} ${meses === 1 ? 'mês' : 'meses'}`

  const anos = Math.floor(dias / 365)

  return `há ${anos} ${anos === 1 ? 'ano' : 'anos'}`
}
