/**
 * Deriva as dimensões da seção de cada perfil, a partir do peso e do desenho.
 *
 * ── COMO FUNCIONA ────────────────────────────────────────────────────────
 *
 * Ninguém digita estas medidas. Elas saem do cruzamento de dois dados que já
 * existem no cadastro:
 *
 *   1. O peso por metro dá a área REAL de metal na seção, porque
 *      peso/m = área × densidade do alumínio (2,70 g/cm³).
 *      450 g/m ÷ 2,7 = 166,7 mm² de metal.
 *
 *   2. O desenho técnico mostra essa mesma seção, em pixels.
 *
 * Sabendo quantos pixels a seção ocupa e quantos mm² ela vale, sai a escala
 * do desenho — e com a escala, a altura e a largura em milímetros.
 *
 * ── A PARTE DIFÍCIL: ACHAR A SEÇÃO NO DESENHO ────────────────────────────
 *
 * O desenho não tem só o perfil: tem cotas, setas, números e o carimbo do
 * fabricante, tudo em preto também. Contar todo pixel escuro daria uma área
 * inflada e uma escala errada.
 *
 * A separação é por componentes conexos: manchas de pixels escuros que se
 * tocam. A seção é, de longe, a maior delas — no 25-016 são 4.038 pixels
 * contra 305 da maior linha de cota. As cotas são finas e compridas, os
 * números são manchas pequenas e espalhadas.
 *
 * ── CONFERÊNCIA ──────────────────────────────────────────────────────────
 *
 * O 25-002 tem as cotas 30 e 37 impressas no próprio desenho. O cálculo dá
 * 29,0 × 35,7 mm — 3% abaixo, provavelmente porque a espessura do traço do
 * contorno entra na contagem de pixels e infla um pouco a área. Folgado para
 * o uso pretendido, que é estreitar candidatos com uma trena na mão.
 *
 * ── USO ──────────────────────────────────────────────────────────────────
 *
 *   node scripts/calcular-secao.mjs              (só mostra, não grava)
 *   node scripts/calcular-secao.mjs --confirmar  (grava no banco)
 *
 * Credenciais: duas linhas no .env (ou variáveis de ambiente de mesmo nome).
 *   REPERFIL_EMAIL   e-mail de um administrador
 *   REPERFIL_SENHA   senha
 */
import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { readFileSync } from 'node:fs'

const DENSIDADE_ALUMINIO = 2.7
/** Abaixo deste brilho o pixel conta como traço do desenho. */
const LIMIAR_ESCURO = 100
/** Dimensões fora desta faixa denunciam cálculo errado, não perfil exótico. */
const MINIMO_PLAUSIVEL_MM = 5
const MAXIMO_PLAUSIVEL_MM = 400

const confirmar = process.argv.includes('--confirmar')

function lerEnv() {
  const texto = readFileSync('.env', 'utf8')
  const env = {}

  for (const linha of texto.split('\n')) {
    const [chave, ...resto] = linha.split('=')
    if (chave && resto.length) env[chave.trim()] = resto.join('=').trim()
  }

  return env
}

/**
 * Maior mancha conexa de pixels escuros — a seção do perfil.
 *
 * Varredura iterativa, não recursiva: um desenho de 660×660 tem 435 mil
 * pixels, e recursão nessa escala estoura a pilha do Node.
 */
function maiorComponente(escuro, largura, altura) {
  const rotulo = new Int32Array(largura * altura).fill(-1)
  const pilha = new Int32Array(largura * altura)
  let melhor = null

  for (let inicio = 0; inicio < largura * altura; inicio++) {
    if (!escuro[inicio] || rotulo[inicio] !== -1) continue

    let topo = 0
    pilha[topo++] = inicio
    rotulo[inicio] = 1

    let area = 0
    let minX = largura
    let maxX = -1
    let minY = altura
    let maxY = -1

    while (topo > 0) {
      const p = pilha[--topo]
      const x = p % largura
      const y = (p / largura) | 0

      area++
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y

      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx
          const ny = y + dy

          if (nx < 0 || ny < 0 || nx >= largura || ny >= altura) continue

          const q = ny * largura + nx

          if (escuro[q] && rotulo[q] === -1) {
            rotulo[q] = 1
            pilha[topo++] = q
          }
        }
      }
    }

    if (!melhor || area > melhor.area) {
      melhor = {
        area,
        largura: maxX - minX + 1,
        altura: maxY - minY + 1,
      }
    }
  }

  return melhor
}

async function dimensoesDoDesenho(bytes, pesoPorMetroG) {
  const { data, info } = await sharp(bytes)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const escuro = new Uint8Array(info.width * info.height)
  for (let i = 0; i < escuro.length; i++) {
    escuro[i] = data[i * info.channels] < LIMIAR_ESCURO ? 1 : 0
  }

  const secao = maiorComponente(escuro, info.width, info.height)
  if (!secao || secao.area < 100) return null

  const areaRealMm2 = pesoPorMetroG / DENSIDADE_ALUMINIO
  const escala = Math.sqrt(areaRealMm2 / secao.area)

  return {
    larguraMm: Number((secao.largura * escala).toFixed(1)),
    alturaMm: Number((secao.altura * escala).toFixed(1)),
    areaMm2: Number(areaRealMm2.toFixed(1)),
    pixelsSecao: secao.area,
  }
}

async function principal() {
  const env = lerEnv()
  const supabase = createClient(
    env['VITE_SUPABASE_URL'],
    env['VITE_SUPABASE_ANON_KEY'],
  )

  // O .env também serve: definir variável de ambiente no PowerShell só vale
  // para AQUELA janela, e é fácil rodar o script noutra e levar o erro sem
  // entender por quê. No .env fica gravado — e ele não é versionado.
  const email = process.env['REPERFIL_EMAIL'] || env['REPERFIL_EMAIL']
  const senha = process.env['REPERFIL_SENHA'] || env['REPERFIL_SENHA']

  if (!email || !senha) {
    console.error(
      [
        'Faltam as credenciais para entrar no Supabase.',
        '',
        'Acrescente estas duas linhas no fim do arquivo .env, com o e-mail e',
        'a senha de um administrador da organização:',
        '',
        '  REPERFIL_EMAIL=voce@exemplo.com',
        '  REPERFIL_SENHA=suasenha',
        '',
        'O .env não vai para o Git. Depois rode o comando de novo.',
      ].join('\n'),
    )
    process.exit(1)
  }

  const { error: erroLogin } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  })

  if (erroLogin) {
    console.error(`Não foi possível entrar: ${erroLogin.message}`)
    process.exit(1)
  }

  const { data: perfis, error } = await supabase
    .from('modelos_perfil')
    .select('id, codigo, descricao, peso_por_metro_g')
    .not('peso_por_metro_g', 'is', null)
    .order('codigo')

  if (error) {
    console.error(error.message)
    process.exit(1)
  }

  const calculados = []
  const semDesenho = []
  const suspeitos = []

  for (const perfil of perfis) {
    const { data: arquivo } = await supabase
      .from('arquivos_vetoriais')
      .select('arquivo_url')
      .eq('modelo_perfil_id', perfil.id)
      .eq('tipo', 'imagem')
      .limit(1)
      .maybeSingle()

    if (!arquivo) {
      semDesenho.push(perfil.codigo)
      continue
    }

    const { data: blob, error: erroDownload } = await supabase.storage
      .from('desenhos-tecnicos')
      .download(arquivo.arquivo_url)

    if (erroDownload || !blob) {
      semDesenho.push(perfil.codigo)
      continue
    }

    const bytes = Buffer.from(await blob.arrayBuffer())
    const medida = await dimensoesDoDesenho(bytes, perfil.peso_por_metro_g)

    if (!medida) {
      semDesenho.push(perfil.codigo)
      continue
    }

    const forave =
      medida.larguraMm < MINIMO_PLAUSIVEL_MM ||
      medida.alturaMm < MINIMO_PLAUSIVEL_MM ||
      medida.larguraMm > MAXIMO_PLAUSIVEL_MM ||
      medida.alturaMm > MAXIMO_PLAUSIVEL_MM

    const registro = { ...perfil, ...medida }

    if (forave) suspeitos.push(registro)
    else calculados.push(registro)
  }

  console.log('')
  console.log(`Perfis com peso cadastrado: ${perfis.length}`)
  console.log(`Dimensões calculadas:       ${calculados.length}`)
  console.log(`Sem desenho utilizável:     ${semDesenho.length}`)
  console.log(`Fora da faixa plausível:    ${suspeitos.length}`)
  console.log('')

  for (const c of calculados) {
    console.log(
      `  ${c.codigo.padEnd(10)} ${String(c.larguraMm).padStart(6)} × ` +
        `${String(c.alturaMm).padStart(6)} mm   ` +
        `(${c.areaMm2} mm², ${c.pixelsSecao} px)   ${c.descricao.slice(0, 32)}`,
    )
  }

  if (suspeitos.length) {
    console.log('')
    console.log('Fora da faixa — confira o desenho destes à mão:')
    for (const s of suspeitos) {
      console.log(`  ${s.codigo.padEnd(10)} ${s.larguraMm} × ${s.alturaMm} mm`)
    }
  }

  if (semDesenho.length) {
    console.log('')
    console.log(`Sem desenho: ${semDesenho.join(', ')}`)
  }

  if (!confirmar) {
    console.log('')
    console.log('Prévia apenas. Rode com --confirmar para gravar.')
    return
  }

  let gravados = 0

  for (const c of calculados) {
    const { error: erroUpdate } = await supabase
      .from('modelos_perfil')
      .update({
        largura_secao_mm: c.larguraMm,
        altura_secao_mm: c.alturaMm,
      })
      .eq('id', c.id)

    if (erroUpdate) {
      console.error(`  ${c.codigo}: ${erroUpdate.message}`)
      continue
    }

    gravados++
  }

  console.log('')
  console.log(`${gravados} perfis atualizados.`)
}

await principal()
