/**
 * Busca de endereço pelo CEP.
 *
 * ── POR QUE O ViaCEP ─────────────────────────────────────────────────────
 *
 * É o serviço público mais usado no Brasil para isto, não exige cadastro
 * nem chave, e responde em JSON simples. A alternativa seria embarcar a
 * base dos Correios no app — dezenas de megabytes que envelhecem, para uma
 * tela que se preenche uma vez na vida da empresa.
 *
 * ── O QUE ACONTECE QUANDO FALHA ──────────────────────────────────────────
 *
 * Nada trava. O CEP é uma CONVENIÊNCIA: preenche os campos para poupar
 * digitação, e os campos continuam editáveis à mão. Sem rede, CEP
 * inexistente ou serviço fora do ar, a pessoa digita o endereço como
 * sempre digitou — por isso esta função devolve `null` em vez de lançar,
 * e por isso há um tempo-limite curto: esperar dez segundos por um
 * preenchimento automático é pior do que digitar.
 */

/** Endereço como o ViaCEP devolve, já com os nomes que o formulário usa. */
export interface EnderecoDoCep {
  logradouro: string
  bairro: string
  cidade: string
  estado: string
}

/** Só os dígitos. "74.000-000" e "74000000" são o mesmo CEP. */
export function apenasDigitosCep(texto: string): string {
  return texto.replace(/\D/g, '')
}

/** CEP brasileiro tem exatamente 8 dígitos. */
export function cepCompleto(texto: string): boolean {
  return apenasDigitosCep(texto).length === 8
}

/** "74000000" → "74000-000". Formato como se escreve. */
export function formatarCep(texto: string): string {
  const digitos = apenasDigitosCep(texto).slice(0, 8)

  return digitos.length > 5
    ? `${digitos.slice(0, 5)}-${digitos.slice(5)}`
    : digitos
}

/** Quanto vale a pena esperar antes de deixar a pessoa digitar sozinha. */
const LIMITE_MS = 5000

export async function buscarEnderecoPorCep(
  cep: string,
): Promise<EnderecoDoCep | null> {
  const digitos = apenasDigitosCep(cep)

  if (digitos.length !== 8) return null

  // `AbortController` em vez de deixar a promessa pendurada: sem isto, um
  // serviço lento deixaria o campo em "buscando…" para sempre, e a pessoa
  // não saberia se espera ou digita.
  const controle = new AbortController()
  const relogio = setTimeout(() => controle.abort(), LIMITE_MS)

  try {
    const resposta = await fetch(
      `https://viacep.com.br/ws/${digitos}/json/`,
      { signal: controle.signal },
    )

    if (!resposta.ok) return null

    const dados: unknown = await resposta.json()

    if (typeof dados !== 'object' || dados === null) return null

    const registro = dados as Record<string, unknown>

    // CEP inexistente não dá erro HTTP: o ViaCEP responde 200 com
    // `{ "erro": true }`. Sem esta checagem, o formulário seria limpo com
    // campos vazios como se a busca tivesse dado certo.
    if (registro.erro) return null

    const texto = (valor: unknown) =>
      typeof valor === 'string' ? valor.trim() : ''

    return {
      logradouro: texto(registro.logradouro),
      bairro: texto(registro.bairro),
      cidade: texto(registro.localidade),
      estado: texto(registro.uf),
    }
  } catch {
    // Rede caiu, tempo esgotou, resposta veio quebrada — todos dão no
    // mesmo para quem está preenchendo: digita à mão.
    return null
  } finally {
    clearTimeout(relogio)
  }
}
