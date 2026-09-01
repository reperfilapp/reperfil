/**
 * Importa o JSON gerado por `scripts/extrair-catalogo-acessorios.py` para
 * `modelos_acessorio` + `arquivos_vetoriais` + `codigos_fabricante_acessorio`.
 *
 * ── SEMPRE mostra uma prévia antes de gravar ─────────────────────────────
 *
 * Mesmo contrato dos outros scripts de importação deste projeto: sem
 * `--confirmar`, só mostra o que faria. Nada é gravado.
 *
 * Uso:
 *   node scripts/importar-acessorios.mjs <pasta-com-catalogo-acessorios.json>
 *   node scripts/importar-acessorios.mjs <pasta> --confirmar
 *
 * ── MAPEAMENTO DE COR — POR QUE É UM ARQUIVO SEPARADO ────────────────────
 *
 * A tabela do catálogo tem uma coluna "Cor" (BCO, PTF, INX...), mas nem todo
 * valor ali é de verdade uma cor — algumas tabelas do PDF têm outra coisa
 * nessa posição (medida, código de outro produto), e decidir isso sozinho
 * seria arriscado. Na primeira vez que este script roda, ele CRIA
 * `mapa-cores-acessorios.json` ao lado do JSON de entrada, com todo valor de
 * "cor" encontrado — alguns já sugeridos (batendo com acabamento já
 * cadastrado), o resto em branco (`null`). Revise esse arquivo, preencha o
 * que fizer sentido com o CÓDIGO do acabamento (ex.: "ACB-BRAN"), e deixe
 * `null` o que não for cor de verdade — a variação ainda é importada, só
 * sem acabamento vinculado.
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

function carregarEnv() {
  for (const nome of ['.env', '.env.local']) {
    const caminho = path.resolve(process.cwd(), nome)
    if (!fs.existsSync(caminho)) continue

    for (const linha of fs.readFileSync(caminho, 'utf8').split(/\r?\n/)) {
      const m = linha.match(/^\s*([\w.-]+)\s*=\s*(.*)$/)
      if (!m || linha.trim().startsWith('#')) continue

      const valor = m[2].trim().replace(/^["']|["']$/g, '')
      process.env[m[1]] = valor
    }
  }
}

carregarEnv()

const BALDE_DESENHOS = 'desenhos-tecnicos'
const FABRICANTE = 'Udinese'
const UNIDADE_PADRAO = 'peça'

// Sugestão inicial — só para as abreviações mais óbvias, contra o que já
// está cadastrado nesta organização hoje. Tudo mais fica `null` de
// propósito: é a pessoa quem decide, não o script.
const SUGESTOES_INICIAIS = {
  BCO: 'ACB-BRAN',
  PTF: 'ACB-PT',
  PRT: 'ACB-PRET',
  CR: 'ACB-CROM',
}

async function entrar() {
  const url = process.env['VITE_SUPABASE_URL']
  const chaveAnon = process.env['VITE_SUPABASE_ANON_KEY']
  const email = process.env['REPERFIL_EMAIL']
  const senha = process.env['REPERFIL_SENHA']

  if (!url || !chaveAnon) {
    throw new Error(
      'Faltam VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.\n' +
        `Procurei em ${path.resolve(process.cwd(), '.env')} e no .env.local.\n` +
        'Rode o comando a partir da raiz do repositório.',
    )
  }
  if (!email || !senha) {
    throw new Error(
      'Faltam REPERFIL_EMAIL e REPERFIL_SENHA.\n' +
        'Acrescente as duas linhas ao .env (que já está no .gitignore), ou\n' +
        'defina só nesta sessão do PowerShell:\n' +
        '  $env:REPERFIL_EMAIL="voce@exemplo.com"\n' +
        '  $env:REPERFIL_SENHA="sua-senha"',
    )
  }

  const supabase = createClient(url, chaveAnon, { auth: { persistSession: false } })
  const { error } = await supabase.auth.signInWithPassword({ email, password: senha })
  if (error) throw new Error(`Não foi possível entrar: ${error.message}`)

  return supabase
}

async function organizacaoDoUsuario(supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from('perfis_usuario')
    .select('organizacao_id')
    .eq('id', user.id)
    .single()

  if (error) throw new Error(`Não consegui identificar a organização: ${error.message}`)

  return data.organizacao_id
}

/** Todo valor de "cor" distinto no JSON, e quantas variações usam cada um. */
function coresEncontradas(familias) {
  const contagem = new Map()
  for (const familia of familias) {
    for (const v of familia.variacoes) {
      contagem.set(v.cor, (contagem.get(v.cor) ?? 0) + 1)
    }
  }
  return contagem
}

function carregarOuCriarMapaCores(pastaEntrada, familias) {
  const caminho = path.join(pastaEntrada, 'mapa-cores-acessorios.json')

  if (fs.existsSync(caminho)) {
    return { caminho, mapa: JSON.parse(fs.readFileSync(caminho, 'utf8')) }
  }

  const cores = coresEncontradas(familias)
  const mapa = {}
  for (const cor of [...cores.keys()].sort()) {
    mapa[cor] = SUGESTOES_INICIAIS[cor] ?? null
  }

  fs.writeFileSync(caminho, JSON.stringify(mapa, null, 2) + '\n', 'utf8')
  return { caminho, mapa, recemCriado: true }
}

async function importar(supabase, organizacaoId, familias, mapaCores, pastaEntradaAbsoluta) {
  // mapaCores: { [corDoCatalogo]: codigoDoAcabamento | null }
  console.log('\n════ GRAVANDO ════\n')

  const { data: acabamentos } = await supabase
    .from('acabamentos')
    .select('id, codigo')
  const acabamentoIdPorCodigo = new Map(acabamentos.map((a) => [a.codigo, a.id]))

  let familiasNovas = 0
  let familiasExistentes = 0
  let variacoesNovas = 0
  let imagensEnviadas = 0

  for (const familiaOriginal of familias) {
    // Algumas páginas do catálogo têm linha repetida ou mal pareada na
    // extração (mesmo codigo_fabricante duas vezes na mesma família) — sem
    // isso, o lote inteiro de códigos falha por causa de UMA linha ruim,
    // derrubando também as variações boas da mesma família. Mantém a
    // primeira ocorrência de cada código, descarta a repetida.
    const vistos = new Set()
    const variacoesUnicas = familiaOriginal.variacoes.filter((v) => {
      if (vistos.has(v.codigo_fabricante)) return false
      vistos.add(v.codigo_fabricante)
      return true
    })
    const familia = { ...familiaOriginal, variacoes: variacoesUnicas }

    if (variacoesUnicas.length < familiaOriginal.variacoes.length) {
      console.error(
        `  aviso: ${familia.nome} tinha código repetido na extração — mantida só a primeira ocorrência.`,
      )
    }

    // Uma família já existe se QUALQUER variação dela já foi importada
    // antes (de QUALQUER catálogo — Gold e Suprema compartilham ~70% dos
    // códigos). Nesse caso, só completamos as variações que faltam; não
    // criamos um modelo_acessorio duplicado para o mesmo produto físico.
    const codigosDaFamilia = familia.variacoes.map((v) => v.codigo_fabricante)

    const { data: existentes } = await supabase
      .from('codigos_fabricante_acessorio')
      .select('codigo_fabricante, modelo_acessorio_id')
      .eq('organizacao_id', organizacaoId)
      .in('codigo_fabricante', codigosDaFamilia)

    let modeloAcessorioId
    if (existentes && existentes.length > 0) {
      modeloAcessorioId = existentes[0].modelo_acessorio_id
      familiasExistentes += 1
    } else {
      const primeira = familia.variacoes[0]
      const { data: modelo, error: erroModelo } = await supabase
        .from('modelos_acessorio')
        .insert({
          organizacao_id: organizacaoId,
          codigo: primeira.codigo_fabricante,
          descricao: familia.nome,
          fabricante: FABRICANTE,
          categoria: familia.tipologia,
          unidade_medida: UNIDADE_PADRAO,
        })
        .select('id')
        .single()

      if (erroModelo) {
        console.error(`  falhou (${familia.nome}): ${erroModelo.message}`)
        continue
      }

      modeloAcessorioId = modelo.id
      familiasNovas += 1

      // Desenho técnico: um só por família, o recorte gerado pela extração.
      const caminhoImagem = path.resolve(pastaEntradaAbsoluta, familia.imagem)

      if (fs.existsSync(caminhoImagem)) {
        const bytes = fs.readFileSync(caminhoImagem)
        const caminhoNoBalde = `${organizacaoId}/${crypto.randomUUID()}.png`

        const { error: erroEnvio } = await supabase.storage
          .from(BALDE_DESENHOS)
          .upload(caminhoNoBalde, bytes, { contentType: 'image/png', upsert: false })

        if (erroEnvio) {
          console.error(`  imagem falhou (${familia.nome}): ${erroEnvio.message}`)
        } else {
          const { error: erroArquivo } = await supabase.from('arquivos_vetoriais').insert({
            modelo_acessorio_id: modeloAcessorioId,
            tipo: 'imagem',
            arquivo_url: caminhoNoBalde,
            legenda: familia.tipologia,
            ordem: 0,
            sanitizado: true,
          })

          if (erroArquivo) {
            console.error(`  registro da imagem falhou (${familia.nome}): ${erroArquivo.message}`)
          } else {
            imagensEnviadas += 1
          }
        }
      } else {
        console.error(`  imagem não encontrada: ${caminhoImagem}`)
      }
    }

    // Variações (códigos por cor) que ainda não existem para este acessório.
    const jaExistemCodigos = new Set((existentes ?? []).map((e) => e.codigo_fabricante))
    const novasVariacoes = familia.variacoes.filter(
      (v) => !jaExistemCodigos.has(v.codigo_fabricante),
    )

    if (novasVariacoes.length === 0) continue

    const { error: erroCodigos } = await supabase.from('codigos_fabricante_acessorio').insert(
      novasVariacoes.map((v) => ({
        organizacao_id: organizacaoId,
        modelo_acessorio_id: modeloAcessorioId,
        acabamento_id: acabamentoIdPorCodigo.get(mapaCores[v.cor] ?? '') ?? null,
        codigo_fabricante: v.codigo_fabricante,
        codigo_catalogo: v.codigo_catalogo,
        fabricante: FABRICANTE,
      })),
    )

    if (erroCodigos) {
      console.error(`  códigos falharam (${familia.nome}): ${erroCodigos.message}`)
      continue
    }

    variacoesNovas += novasVariacoes.length
  }

  console.log(
    `\n════ CONCLUÍDO: ${familiasNovas} acessórios novos, ${familiasExistentes} já existiam, ` +
      `${variacoesNovas} variações novas, ${imagensEnviadas} desenhos enviados ════`,
  )
}

// ── Início ──────────────────────────────────────────────────────────────

const pastaEntrada = process.argv[2]
const confirmar = process.argv.includes('--confirmar')

if (!pastaEntrada) {
  console.error('Informe a pasta com catalogo-acessorios.json (gerada pelo script de extração).')
  process.exit(1)
}

const caminhoJson = path.join(pastaEntrada, 'catalogo-acessorios.json')
if (!fs.existsSync(caminhoJson)) {
  console.error(`Não encontrei ${caminhoJson}.`)
  process.exit(1)
}

const familias = JSON.parse(fs.readFileSync(caminhoJson, 'utf8'))
const totalVariacoes = familias.reduce((n, f) => n + f.variacoes.length, 0)

console.log(`\n════ PRÉVIA — nada foi gravado ════\n`)
console.log(`FAMÍLIAS NO ARQUIVO: ${familias.length}`)
console.log(`VARIAÇÕES (códigos por cor): ${totalVariacoes}`)

const { caminho: caminhoMapa, mapa, recemCriado } = carregarOuCriarMapaCores(
  pastaEntrada,
  familias,
)
const semMapeamento = Object.entries(mapa).filter(([, valor]) => valor === null)

if (recemCriado) {
  console.log(`\nCriei ${caminhoMapa} com todas as cores encontradas.`)
  console.log('Revise e preencha antes de rodar com --confirmar.')
} else {
  console.log(`\nUsando mapeamento de ${caminhoMapa}.`)
  console.log(
    `${semMapeamento.length} cores ainda sem acabamento vinculado (ficam null: ` +
      `${semMapeamento.map(([c]) => c).slice(0, 15).join(', ')}` +
      `${semMapeamento.length > 15 ? '...' : ''}) — as variações dessas cores são ` +
      'importadas mesmo assim, só sem acabamento_id.',
  )
}

if (!confirmar) {
  console.log('\nNada foi gravado. Para importar de verdade, repita com --confirmar.')
  process.exit(0)
}

const supabase = await entrar()
const organizacaoId = await organizacaoDoUsuario(supabase)
await importar(supabase, organizacaoId, familias, mapa, path.resolve(pastaEntrada))
