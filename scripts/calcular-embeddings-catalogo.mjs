/**
 * Calcula o embedding (vetor de busca visual) de todo arquivo de
 * `arquivos_vetoriais` que ainda não tem — foto e desenho técnico juntos.
 *
 * Roda a Edge Function `calcular-embedding-perfil` uma vez por arquivo. É o
 * backfill do catálogo que já existia antes da busca visual por foto: daqui
 * em diante, todo upload novo já dispara isso sozinho (ver
 * `useAdicionarDesenho` em `src/dados/desenhosTecnicos.ts`) — este script só
 * cobre o que foi cadastrado ANTES.
 *
 * Mesmo contrato dos outros scripts de manutenção: sem `--confirmar`, só
 * mostra quantos arquivos faltam. Nada é calculado.
 *
 * Uso:
 *   node scripts/calcular-embeddings-catalogo.mjs
 *   node scripts/calcular-embeddings-catalogo.mjs --confirmar
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

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

const confirmar = process.argv.includes('--confirmar')

const supabase = await entrar()

const { data: pendentes, error } = await supabase
  .from('arquivos_vetoriais')
  .select('id, tipo, legenda')
  .is('embedding', null)
  .not('modelo_perfil_id', 'is', null)

if (error) throw new Error(`Não consegui listar os arquivos: ${error.message}`)

const porTipo = new Map()
for (const item of pendentes) {
  porTipo.set(item.tipo, (porTipo.get(item.tipo) ?? 0) + 1)
}

console.log(`\nArquivos sem embedding: ${pendentes.length}`)
for (const [tipo, quantidade] of porTipo) {
  console.log(`  ${tipo}: ${quantidade}`)
}

if (pendentes.length === 0) {
  console.log('\nNada para calcular.')
  process.exit(0)
}

if (!confirmar) {
  console.log('\nNada foi calculado. Para calcular de verdade, repita com --confirmar.')
  process.exit(0)
}

console.log('\n════ CALCULANDO ════\n')

let sucesso = 0
let falhas = 0

for (const arquivo of pendentes) {
  const { data, error: erroFuncao } = await supabase.functions.invoke(
    'calcular-embedding-perfil',
    { body: { arquivoId: arquivo.id } },
  )

  if (erroFuncao || !data?.ok) {
    falhas += 1
    console.error(
      `  falhou (${arquivo.tipo}${arquivo.legenda ? `, ${arquivo.legenda}` : ''}): ` +
        (erroFuncao?.message ?? data?.error ?? 'erro desconhecido'),
    )
    continue
  }

  sucesso += 1
  if (sucesso % 25 === 0) console.log(`  calculados: ${sucesso}`)
}

console.log(`\n════ CONCLUÍDO: ${sucesso} calculados, ${falhas} falharam ════`)
