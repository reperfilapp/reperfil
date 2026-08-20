/**
 * Importa o catálogo de perfis Poliformas para o RePerfil.
 *
 * ── SEMPRE mostra uma prévia antes de gravar ─────────────────────────────
 *
 * Mesmo contrato de `importar-planilha.mjs`: sem `--confirmar`, o script lê,
 * compara com o que já está no banco e imprime o que faria. Nada é gravado.
 *
 * Uso:
 *   node scripts/importar-catalogo.mjs importar/perfis-poliformas.csv
 *   node scripts/importar-catalogo.mjs importar/perfis-poliformas.csv --confirmar
 *
 * Os desenhos ficam na pasta `desenhos/`, ao lado do CSV.
 *
 * ── O que ele NÃO faz ────────────────────────────────────────────────────
 *
 * Não sobrescreve dado de perfil que já existe. O código do fabricante e o
 * código interno da empresa não são a mesma coisa, e um catálogo de 342 itens
 * importado por cima de 82 cadastros conferidos à mão estragaria mais do que
 * resolveria. Perfil já cadastrado só RECEBE o desenho, como imagem adicional
 * da galeria — o que já existe continua onde está.
 */
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

/**
 * Carrega o `.env` do projeto.
 *
 * O Node não lê `.env` sozinho — quem lê é o Vite, e por isso as variáveis
 * existem quando o aplicativo roda e somem quando um script roda. Ler aqui
 * evita ter de lembrar do `--env-file` toda vez.
 *
 * O `.env.local` vem depois de propósito: quando os dois definem a mesma
 * variável, quem manda é o local, que é a convenção do próprio Vite.
 */
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

const FABRICANTE = 'Poliformas'
const LEGENDA = 'Seção — catálogo Poliformas'

/**
 * Colunas das quatro medidas da seção, na tabela `modelos_perfil`.
 *
 * ⚠ CONFIRA ANTES DE RODAR. As duas últimas vieram da migração
 * `20260818...medidas_extras_da_secao`; as duas primeiras nasceram em
 * `20260817200000_dimensoes_da_secao` e podem ter outro nome no seu esquema.
 * Rodar com nome errado não corrompe nada — o PostgREST recusa a gravação
 * inteira e o script para no primeiro perfil —, mas é chato descobrir isso
 * depois de autenticar.
 */
const COLUNAS_MEDIDA = [
  'largura_secao_mm',
  'altura_secao_mm',
  'medida_3_secao_mm',
  'medida_4_secao_mm',
]

/** Compara códigos como as pessoas os leem: MN-003 e mn 003 são o mesmo. */
function chave(codigo) {
  return String(codigo ?? '')
    .toUpperCase()
    .replace(/[\s-]/g, '')
}

function lerCsv(caminho) {
  const bruto = fs.readFileSync(caminho, 'utf8').replace(/^\uFEFF/, '')
  const linhas = bruto.split(/\r?\n/).filter((l) => l.trim())
  const cabecalho = linhas.shift().split(';')

  return linhas.map((linha) => {
    // Campos com ponto e vírgula vêm entre aspas.
    const campos = linha.match(/("([^"]|"")*"|[^;]*)(;|$)/g).slice(0, cabecalho.length)
    const registro = {}

    cabecalho.forEach((nome, i) => {
      const valor = (campos[i] ?? '')
        .replace(/;$/, '')
        .replace(/^"|"$/g, '')
        .replace(/""/g, '"')
        .trim()
      registro[nome] = valor === '' ? null : valor
    })

    return registro
  })
}

/**
 * Medidas da seção, lidas do desenho.
 *
 * Medida em branco é gravada como nula, e não omitida: nulo quer dizer "o
 * desenho não cotava isso", e é o que a ficha do perfil mostra como travessão.
 * Omitir deixaria o campo com o valor antigo, que é justamente o defeito
 * corrigido na versão 1.6.40.
 */
function medidasDe(item) {
  const saida = {}
  // Perfil cuja medida o peso não confirma entra sem medida nenhuma. A
  // conferência não sabe dizer QUAL das quatro está errada, só que uma está —
  // e importar as outras três daria à ficha um ar de completa que ela não tem.
  const duvidoso = Boolean(item.medidas_conferir)

  COLUNAS_MEDIDA.forEach((coluna, i) => {
    const valor = duvidoso ? null : item[`medida_${i + 1}_mm`]
    saida[coluna] = valor ? Number(valor) : null
  })
  return saida
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

async function comparar(supabase, doCatalogo) {
  const { data: existentes, error } = await supabase
    .from('modelos_perfil')
    .select('id, codigo, descricao, linha, peso_por_metro_g')

  if (error) throw new Error(`não consegui ler o catálogo atual: ${error.message}`)

  const porChave = new Map(existentes.map((p) => [chave(p.codigo), p]))

  const novos = []
  const jaExistem = []

  for (const item of doCatalogo) {
    const achado = porChave.get(chave(item.codigo))
    if (achado) jaExistem.push({ item, atual: achado })
    else novos.push(item)
  }

  // Perfis do banco que o catálogo não menciona: ou são de outro fabricante,
  // ou o código interno diverge do código Poliformas. Quem sabe é a empresa.
  const codigosCatalogo = new Set(doCatalogo.map((i) => chave(i.codigo)))
  const semCorrespondencia = existentes.filter((p) => !codigosCatalogo.has(chave(p.codigo)))

  return { novos, jaExistem, semCorrespondencia }
}

function mostrarPrevia({ novos, jaExistem, semCorrespondencia }, comDesenho) {
  console.log('\n════ PRÉVIA — nada foi gravado ════\n')

  const comQuatro = novos.filter((n) => n.medida_4_mm).length
  const semNenhuma = novos.filter((n) => !n.medida_1_mm).length
  const aConferir = novos.filter((n) => n.medidas_conferir).length

  console.log(`PERFIS NOVOS: ${novos.length}`)
  console.log(
    `  medidas da seção: ${novos.length - semNenhuma} com alguma, ` +
      `${comQuatro} com as quatro, ${semNenhuma} sem nenhuma`,
  )
  if (aConferir) {
    console.log(`  ⚠ ${aConferir} com medida que o peso não confirma — vão com o campo vazio`)
  }
  console.log('')
  const porLinha = new Map()
  for (const n of novos) porLinha.set(n.linha, (porLinha.get(n.linha) ?? 0) + 1)
  for (const [linha, n] of [...porLinha].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(3)}  ${linha}`)
  }

  console.log(`\nJÁ EXISTEM (recebem só o desenho): ${jaExistem.length}`)
  for (const { item, atual } of jaExistem.slice(0, 15)) {
    const pesoIgual = String(atual.peso_por_metro_g ?? '') === String(item.peso_por_metro_g ?? '')
    const marca = pesoIgual ? ' ' : '≠'
    console.log(
      `  ${marca} ${item.codigo.padEnd(11)} banco: ${String(atual.peso_por_metro_g ?? '—').padStart(5)} g/m` +
        `   catálogo: ${String(item.peso_por_metro_g ?? '—').padStart(5)} g/m   ${atual.descricao.slice(0, 34)}`,
    )
  }
  if (jaExistem.length > 15) console.log(`  … e mais ${jaExistem.length - 15}`)
  const divergem = jaExistem.filter(
    ({ item, atual }) =>
      atual.peso_por_metro_g && String(atual.peso_por_metro_g) !== String(item.peso_por_metro_g),
  )
  if (divergem.length) {
    console.log(`  ⚠ ${divergem.length} com peso diferente do catálogo — marcados com ≠, nada é alterado`)
  }

  console.log(`\nNO BANCO E FORA DO CATÁLOGO: ${semCorrespondencia.length}`)
  console.log('  (outro fabricante, ou código interno diferente do código Poliformas)')
  for (const p of semCorrespondencia.slice(0, 20)) {
    console.log(`    ${p.codigo.padEnd(11)} ${String(p.linha ?? '—').padEnd(18)} ${p.descricao.slice(0, 40)}`)
  }
  if (semCorrespondencia.length > 20) console.log(`    … e mais ${semCorrespondencia.length - 20}`)

  console.log(`\nDESENHOS A ENVIAR: ${comDesenho}`)
}

async function importar(supabase, { novos, jaExistem }, pastaDesenhos) {
  console.log('\n════ GRAVANDO ════\n')

  const { data: perfilUsuario } = await supabase
    .from('perfis_usuario')
    .select('organizacao_id')
    .eq('id', (await supabase.auth.getUser()).data.user.id)
    .single()

  const organizacaoId = perfilUsuario.organizacao_id
  const mapa = new Map(jaExistem.map(({ item, atual }) => [item.codigo, atual.id]))

  let criados = 0
  for (const item of novos) {
    const { data, error } = await supabase
      .from('modelos_perfil')
      .insert({
        codigo: item.codigo,
        descricao: item.descricao,
        fabricante: FABRICANTE,
        linha: item.linha,
        comprimento_barra_mm: Number(item.comprimento_barra_mm),
        peso_por_metro_g: item.peso_por_metro_g ? Number(item.peso_por_metro_g) : null,
        ...medidasDe(item),
        observacoes: `Catálogo Poliformas, ${item.categoria_catalogo}, página ${item.pagina_pdf}.`,
      })
      .select('id')
      .single()

    if (error) throw new Error(`perfil ${item.codigo}: ${error.message}`)

    mapa.set(item.codigo, data.id)
    criados += 1
    if (criados % 25 === 0) console.log(`  perfis criados: ${criados}`)
  }

  console.log(`perfis: ${criados} criados, ${jaExistem.length} já existiam`)

  let desenhos = 0
  for (const item of [...novos, ...jaExistem.map((j) => j.item)]) {
    if (!item.desenho) continue

    const perfilId = mapa.get(item.codigo)
    const arquivo = path.join(pastaDesenhos, item.desenho)
    if (!perfilId || !fs.existsSync(arquivo)) continue

    // Não duplica: se este perfil já tem o desenho do catálogo, pula.
    const { count } = await supabase
      .from('arquivos_vetoriais')
      .select('id', { count: 'exact', head: true })
      .eq('modelo_perfil_id', perfilId)
      .eq('legenda', LEGENDA)

    if ((count ?? 0) > 0) continue

    // Ordem alta para o desenho novo entrar DEPOIS do que a empresa já tinha:
    // quem conferiu a imagem atual à mão não deve perdê-la de vista.
    const { data: existentes } = await supabase
      .from('arquivos_vetoriais')
      .select('ordem')
      .eq('modelo_perfil_id', perfilId)
      .order('ordem', { ascending: false })
      .limit(1)

    const ordem = (existentes?.[0]?.ordem ?? -1) + 1
    const caminho = `${organizacaoId}/${crypto.randomUUID()}.png`

    const { error: erroEnvio } = await supabase.storage
      .from('desenhos-tecnicos')
      .upload(caminho, fs.readFileSync(arquivo), {
        contentType: 'image/png',
        upsert: false,
      })

    if (erroEnvio) throw new Error(`desenho ${item.codigo}: ${erroEnvio.message}`)

    const { error } = await supabase.from('arquivos_vetoriais').insert({
      modelo_perfil_id: perfilId,
      tipo: 'imagem',
      arquivo_url: caminho,
      legenda: LEGENDA,
      ordem,
      sanitizado: true,
    })

    if (error) throw new Error(`desenho ${item.codigo}: ${error.message}`)

    desenhos += 1
    if (desenhos % 25 === 0) console.log(`  desenhos enviados: ${desenhos}`)
  }

  console.log(`desenhos técnicos: ${desenhos} enviados`)
  console.log('\n════ IMPORTAÇÃO CONCLUÍDA ════')
}

// ── Início ──────────────────────────────────────────────────────────────

const arquivo = process.argv[2]
const confirmar = process.argv.includes('--confirmar')

if (!arquivo) {
  console.error('Informe o caminho do CSV.')
  process.exit(1)
}

const pastaDesenhos = path.join(path.dirname(arquivo), 'desenhos')
const doCatalogo = lerCsv(arquivo)
const comDesenho = doCatalogo.filter(
  (i) => i.desenho && fs.existsSync(path.join(pastaDesenhos, i.desenho)),
).length

const supabase = await entrar()
const comparacao = await comparar(supabase, doCatalogo)

mostrarPrevia(comparacao, comDesenho)

if (!confirmar) {
  console.log('\nNada foi gravado. Para importar de verdade, repita com --confirmar.')
  process.exit(0)
}

await importar(supabase, comparacao, pastaDesenhos)
