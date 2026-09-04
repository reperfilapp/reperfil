/**
 * Importa o JSON gerado por `scripts/extrair-catalogo-componentes.py` para
 * `modelos_acessorio` + `arquivos_vetoriais`.
 *
 * Mais simples que `scripts/importar-acessorios.mjs` (Gold/Suprema): este
 * catálogo não tem variação de cor — um código só por produto — então não
 * há família/variação para separar, nem `codigos_fabricante_acessorio`
 * para preencher. Cada linha do JSON já É um `modelos_acessorio`.
 *
 * Mesmo contrato dos outros scripts de importação deste projeto: sem
 * `--confirmar`, só mostra o que faria.
 *
 * Uso:
 *   node scripts/importar-componentes.mjs <pasta-com-catalogo-componentes.json>
 *   node scripts/importar-componentes.mjs <pasta> --confirmar
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

/** Um só por código — mantém a primeira ocorrência, descarta as demais.
 *  Alguns códigos do catálogo se repetem de propósito (o mesmo "kit" vende
 *  para vários modelos, ex.: "KITMBOLT"); outros são duplicata exata da
 *  extração. Nos dois casos, uma linha por código já basta. */
function deduplicarPorCodigo(produtos) {
  const vistos = new Set()
  const descartados = []
  const unicos = produtos.filter((p) => {
    if (vistos.has(p.codigo)) {
      descartados.push(p)
      return false
    }
    vistos.add(p.codigo)
    return true
  })
  return { unicos, descartados }
}

async function importar(supabase, organizacaoId, produtos, pastaEntradaAbsoluta) {
  console.log('\n════ GRAVANDO ════\n')

  const { data: existentes } = await supabase
    .from('modelos_acessorio')
    .select('codigo')
    .eq('organizacao_id', organizacaoId)
  const codigosExistentes = new Set((existentes ?? []).map((e) => e.codigo))

  let novos = 0
  let jaExistiam = 0
  let imagensEnviadas = 0

  for (const produto of produtos) {
    if (codigosExistentes.has(produto.codigo)) {
      jaExistiam += 1
      continue
    }

    const observacoes = produto.versoes_dir_esq
      ? 'Vendido em versões direita/esquerda.'
      : null

    const { data: modelo, error: erroModelo } = await supabase
      .from('modelos_acessorio')
      .insert({
        organizacao_id: organizacaoId,
        codigo: produto.codigo,
        descricao: produto.nome,
        fabricante: FABRICANTE,
        categoria: produto.categoria,
        unidade_medida: UNIDADE_PADRAO,
        observacoes,
      })
      .select('id')
      .single()

    if (erroModelo) {
      console.error(`  falhou (${produto.nome} · ${produto.codigo}): ${erroModelo.message}`)
      continue
    }

    novos += 1

    const caminhoImagem = path.resolve(pastaEntradaAbsoluta, produto.imagem)

    if (fs.existsSync(caminhoImagem)) {
      const bytes = fs.readFileSync(caminhoImagem)
      const caminhoNoBalde = `${organizacaoId}/${crypto.randomUUID()}.png`

      const { error: erroEnvio } = await supabase.storage
        .from(BALDE_DESENHOS)
        .upload(caminhoNoBalde, bytes, { contentType: 'image/png', upsert: false })

      if (erroEnvio) {
        console.error(`  imagem falhou (${produto.codigo}): ${erroEnvio.message}`)
      } else {
        const { error: erroArquivo } = await supabase.from('arquivos_vetoriais').insert({
          modelo_acessorio_id: modelo.id,
          tipo: 'imagem',
          arquivo_url: caminhoNoBalde,
          legenda: produto.categoria,
          ordem: 0,
          sanitizado: true,
        })

        if (erroArquivo) {
          console.error(`  registro da imagem falhou (${produto.codigo}): ${erroArquivo.message}`)
        } else {
          imagensEnviadas += 1
        }
      }
    } else {
      console.error(`  imagem não encontrada: ${caminhoImagem}`)
    }
  }

  console.log(
    `\n════ CONCLUÍDO: ${novos} produtos novos, ${jaExistiam} já existiam, ` +
      `${imagensEnviadas} desenhos enviados ════`,
  )
}

// ── Início ──────────────────────────────────────────────────────────────

const pastaEntrada = process.argv[2]
const confirmar = process.argv.includes('--confirmar')

if (!pastaEntrada) {
  console.error('Informe a pasta com catalogo-componentes.json (gerada pelo script de extração).')
  process.exit(1)
}

const caminhoJson = path.join(pastaEntrada, 'catalogo-componentes.json')
if (!fs.existsSync(caminhoJson)) {
  console.error(`Não encontrei ${caminhoJson}.`)
  process.exit(1)
}

const produtos = JSON.parse(fs.readFileSync(caminhoJson, 'utf8'))
const { unicos, descartados } = deduplicarPorCodigo(produtos)

console.log(`\n════ PRÉVIA — nada foi gravado ════\n`)
console.log(`PRODUTOS NO ARQUIVO: ${produtos.length}`)
console.log(
  `CÓDIGOS ÚNICOS: ${unicos.length} (${descartados.length} descartados por código repetido)`,
)

const categorias = new Map()
for (const p of unicos) {
  categorias.set(p.categoria, (categorias.get(p.categoria) ?? 0) + 1)
}
console.log('\nPor categoria:')
for (const [categoria, qtd] of [...categorias.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${categoria}: ${qtd}`)
}

if (!confirmar) {
  console.log('\nNada foi gravado. Para importar de verdade, repita com --confirmar.')
  process.exit(0)
}

const supabase = await entrar()
const organizacaoId = await organizacaoDoUsuario(supabase)
await importar(supabase, organizacaoId, unicos, path.resolve(pastaEntrada))
