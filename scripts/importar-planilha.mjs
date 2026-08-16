/**
 * Importa o catálogo de perfis e o inventário de sobras de uma planilha.
 *
 * ── SEMPRE mostra uma prévia antes de gravar ─────────────────────────────
 *
 * Sem `--confirmar`, o script apenas lê, valida e imprime o que faria. Nada
 * é gravado. Importar centenas de registros errados é muito pior do que
 * digitar dez à mão, e desfazer depois dá bem mais trabalho do que conferir
 * antes.
 *
 * Uso:
 *   node scripts/importar-planilha.mjs importar/planilha.xlsx
 *   node scripts/importar-planilha.mjs importar/planilha.xlsx --confirmar
 *
 * Credenciais, por variável de ambiente:
 *   REPERFIL_EMAIL   e-mail de um usuário administrador ou de estoque
 *   REPERFIL_SENHA   senha
 */
import XLSX from 'xlsx'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

// ── Estrutura da planilha ───────────────────────────────────────────────
// Linha 1 título, linha 2 descrição, linha 3 cabeçalhos, dados a partir da 4.
const PRIMEIRA_LINHA_DADOS = 4
const ABA_CATALOGO = 'Catálogo técnico'
const ABA_INVENTARIO = 'Inventário consolidado'
const COLUNA_DESENHO = 7

/** Barra padrão. A planilha não informa, e 6 m é o padrão do mercado. */
const COMPRIMENTO_BARRA_MM = 6000

/**
 * Acabamentos indefinidos vão todos para um só, sinalizado.
 *
 * O sistema nunca sugere sobra de acabamento diferente do pedido, então um
 * lote com acabamento errado fica invisível na prática. Melhor um acabamento
 * "A conferir" bem visível do que espalhar peças por cores adivinhadas.
 */
const ACABAMENTO_INDEFINIDO = 'A conferir'

function ehIndefinido(nome) {
  const t = String(nome ?? '').toLowerCase()

  return (
    t === '' ||
    t.includes('não informado') ||
    t.includes('confirmar') ||
    t.includes('provável')
  )
}

/** Código curto e estável a partir do nome do acabamento. */
function codigoAcabamento(nome) {
  const limpo = nome
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '')

  return `ACB-${limpo.slice(0, 4) || 'XX'}`
}

/**
 * Metros decimais para milímetros inteiros.
 *
 * `Math.round` é obrigatório: 3.87 * 1000 dá 3869.9999999999995 em ponto
 * flutuante, e truncar produziria uma peça 1 mm menor — em silêncio.
 */
function metrosParaMm(metros) {
  return Math.round(Number(metros) * 1000)
}

function texto(valor) {
  if (valor === null || valor === undefined) return null

  // Célula com hiperlink vira objeto no ExcelJS.
  const bruto =
    typeof valor === 'object' && valor !== null
      ? (valor.text ?? valor.result ?? valor.hyperlink ?? '')
      : valor

  const limpo = String(bruto).trim()

  return limpo === '' ? null : limpo
}

// ── Leitura ─────────────────────────────────────────────────────────────

function lerPlanilha(caminho) {
  /*
   * SheetJS em vez do ExcelJS por um motivo concreto: esta planilha escreve
   * o XML com prefixo de namespace (`<x:workbook>`, `<x:sheet>`), e o
   * ExcelJS procura as tags sem prefixo — não encontra nada e devolve um
   * workbook vazio. O SheetJS é tolerante a isso.
   *
   * `bookFiles` mantém as entradas do zip acessíveis, que é como chegamos às
   * imagens: o SheetJS não as expõe por conta própria.
   */
  const wb = XLSX.readFile(caminho, { bookFiles: true, cellDates: false })

  const catalogo = wb.Sheets[ABA_CATALOGO]
  const inventario = wb.Sheets[ABA_INVENTARIO]

  if (!catalogo || !inventario) {
    throw new Error(
      `A planilha precisa ter as abas "${ABA_CATALOGO}" e "${ABA_INVENTARIO}".`,
    )
  }

  const imagensPorLinha = lerImagens(wb)

  const linhasCatalogo = XLSX.utils.sheet_to_json(catalogo, {
    header: 1,
    range: PRIMEIRA_LINHA_DADOS - 1,
    defval: null,
    raw: true,
  })

  const perfis = []

  linhasCatalogo.forEach((linha, indice) => {
    const codigo = texto(linha[0])
    if (!codigo) return

    // +1 porque `range` é base zero e a planilha é base um.
    const numeroLinha = PRIMEIRA_LINHA_DADOS + indice
    const pesoKgM = Number(linha[9])

    perfis.push({
      codigo,
      descricao: texto(linha[3]) ?? codigo,
      linhaPerfil: texto(linha[2]),
      status: texto(linha[4]),
      observacao: texto(linha[5]),
      fonte: texto(linha[8]),
      pesoGramasPorMetro:
        Number.isFinite(pesoKgM) && pesoKgM > 0
          ? Math.round(pesoKgM * 1000)
          : null,
      imagem: imagensPorLinha.get(numeroLinha) ?? null,
    })
  })

  const linhasInventario = XLSX.utils.sheet_to_json(inventario, {
    header: 1,
    range: PRIMEIRA_LINHA_DADOS - 1,
    defval: null,
    raw: true,
  })

  const lotes = []
  const pendentes = []

  for (const linha of linhasInventario) {
    const tipo = texto(linha[0])
    if (!tipo) continue

    const codigo = texto(linha[1])
    const acabamento = texto(linha[3]) ?? ''
    const comprimentoM = Number(linha[4])
    const situacao = texto(linha[5])
    const quantidade = Number(linha[6])
    const descricao = texto(linha[8])

    const registro = { tipo, codigo, acabamento, situacao, descricao }

    // Riscado na lista original significa peça já baixada.
    if (situacao === 'Riscado') {
      pendentes.push({ ...registro, motivo: 'riscado na lista original' })
      continue
    }

    if (!Number.isFinite(comprimentoM) || comprimentoM <= 0) {
      pendentes.push({ ...registro, motivo: 'sem medida' })
      continue
    }

    if (!Number.isFinite(quantidade) || quantidade <= 0) {
      pendentes.push({ ...registro, motivo: 'sem quantidade' })
      continue
    }

    lotes.push({
      ...registro,
      comprimentoMm: metrosParaMm(comprimentoM),
      quantidade: Math.round(quantidade),
    })
  }

  return { perfis, lotes, pendentes }
}

/**
 * Associa cada imagem à linha da planilha em que está ancorada.
 *
 * As imagens não pertencem a células: flutuam sobre a grade, e o
 * `drawing1.xml` guarda em que linha e coluna cada uma começa. É esse arquivo
 * que permite dizer qual desenho é de qual perfil.
 */
function lerImagens(wb) {
  const arquivos = wb.files ?? {}
  const mapa = new Map()

  const rels = arquivos['xl/drawings/_rels/drawing1.xml.rels']
  const desenho = arquivos['xl/drawings/drawing1.xml']

  if (!rels || !desenho) return mapa

  const conteudoRels = lerTexto(rels)
  const conteudoDesenho = lerTexto(desenho)

  /*
   * Id da relação -> nome do arquivo de imagem.
   *
   * Cada atributo é extraído por conta própria, e não num padrão único que
   * assuma a ordem. Esta planilha escreve Type, Target e só então Id — um
   * padrão que esperasse Id antes de Target não casaria com nada, e o
   * sintoma seria "nenhum desenho encontrado", sem erro nenhum.
   */
  const alvos = new Map()
  for (const elemento of conteudoRels.match(/<Relationship[^>]*>/g) ?? []) {
    const id = elemento.match(/Id="([^"]+)"/)
    const alvo = elemento.match(/Target="([^"]+)"/)

    if (id && alvo) {
      alvos.set(id[1], alvo[1].split('/').pop())
    }
  }

  // Cada âncora traz a linha de origem e o id da imagem.
  for (const bloco of conteudoDesenho.split(/<xdr:(?:two|one)CellAnchor/)) {
    const linha = bloco.match(/<xdr:from>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>/)
    const coluna = bloco.match(/<xdr:from>[\s\S]*?<xdr:col>(\d+)<\/xdr:col>/)
    const rid = bloco.match(/r:embed="([^"]+)"/)

    if (!linha || !coluna || !rid) continue

    // A planilha conta a partir de 1; o XML, de 0.
    const numeroColuna = Number(coluna[1]) + 1
    if (numeroColuna !== COLUNA_DESENHO) continue

    const nome = alvos.get(rid[1])
    const dados = arquivos[`xl/media/${nome}`]

    if (!nome || !dados) continue

    mapa.set(Number(linha[1]) + 1, {
      buffer: lerBinario(dados),
      extensao: (nome.split('.').pop() ?? 'png').toLowerCase(),
    })
  }

  return mapa
}

function lerTexto(entrada) {
  const conteudo = entrada.content ?? entrada
  return Buffer.isBuffer(conteudo) || conteudo instanceof Uint8Array
    ? Buffer.from(conteudo).toString('utf8')
    : String(conteudo)
}

function lerBinario(entrada) {
  const conteudo = entrada.content ?? entrada
  return Buffer.isBuffer(conteudo) ? conteudo : Buffer.from(conteudo)
}

// ── Prévia ──────────────────────────────────────────────────────────────

function mostrarPrevia({ perfis, lotes, pendentes }, acabamentos) {
  const linha = (t) => console.log(t)

  linha('\n════ PRÉVIA — nada foi gravado ════\n')

  const comImagem = perfis.filter((p) => p.imagem).length
  const comPeso = perfis.filter((p) => p.pesoGramasPorMetro).length

  linha(`PERFIS: ${perfis.length}`)
  linha(`  com desenho técnico: ${comImagem}`)
  linha(`  com peso por metro:  ${comPeso}`)
  linha(`  sem peso:            ${perfis.length - comPeso}`)

  linha(`\nACABAMENTOS a garantir: ${acabamentos.length}`)
  for (const a of acabamentos) {
    linha(`  ${a.codigo.padEnd(10)} ${a.nome}`)
  }

  const pecas = lotes.reduce((t, l) => t + l.quantidade, 0)
  const metros = lotes.reduce(
    (t, l) => t + (l.quantidade * l.comprimentoMm) / 1000,
    0,
  )

  linha(`\nLOTES DE SOBRA: ${lotes.length}`)
  linha(`  peças:  ${pecas}`)
  linha(`  metros: ${metros.toFixed(1)}`)

  const porComprimento = new Map()
  for (const l of lotes) {
    porComprimento.set(
      l.comprimentoMm,
      (porComprimento.get(l.comprimentoMm) ?? 0) + l.quantidade,
    )
  }

  linha('  por comprimento:')
  for (const [mm, qtd] of [...porComprimento].sort((a, b) => a[0] - b[0])) {
    linha(`    ${String(mm).padStart(5)} mm : ${String(qtd).padStart(3)} peças`)
  }

  linha(`\nNÃO IMPORTADOS: ${pendentes.length}`)
  const porMotivo = new Map()
  for (const p of pendentes) {
    porMotivo.set(p.motivo, (porMotivo.get(p.motivo) ?? 0) + 1)
  }
  for (const [motivo, n] of porMotivo) {
    linha(`  ${n} ${motivo}`)
  }
  linha('  (exportados para importar/pendentes-para-medir.csv)')
}

/** Lista das pontas sem medida, para conferir no depósito. */
function exportarPendentes(pendentes, destino) {
  const cabecalho = 'Tipo;Código;Acabamento;Descrição;Motivo;Comprimento medido (mm)'
  const linhas = pendentes.map((p) =>
    [p.tipo, p.codigo, p.acabamento, p.descricao ?? '', p.motivo, ''].join(';'),
  )

  fs.writeFileSync(destino, '﻿' + [cabecalho, ...linhas].join('\r\n'))
}

// ── Gravação ────────────────────────────────────────────────────────────

async function entrar() {
  const url = process.env['VITE_SUPABASE_URL']
  const chave = process.env['VITE_SUPABASE_ANON_KEY']
  const email = process.env['REPERFIL_EMAIL']
  const senha = process.env['REPERFIL_SENHA']

  if (!url || !chave) {
    throw new Error('Faltam VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.')
  }

  if (!email || !senha) {
    throw new Error('Informe REPERFIL_EMAIL e REPERFIL_SENHA no ambiente.')
  }

  const supabase = createClient(url, chave, {
    auth: { persistSession: false },
  })

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: senha,
  })

  if (error) throw new Error(`Não foi possível entrar: ${error.message}`)

  return supabase
}

async function garantirAcabamentos(supabase, acabamentos) {
  const mapa = new Map()

  const { data: existentes } = await supabase
    .from('acabamentos')
    .select('id, nome, codigo')

  for (const a of acabamentos) {
    const achado = existentes?.find(
      (e) => e.nome.toLowerCase() === a.nome.toLowerCase(),
    )

    if (achado) {
      mapa.set(a.nome, achado.id)
      continue
    }

    const { data, error } = await supabase
      .from('acabamentos')
      .insert({ codigo: a.codigo, nome: a.nome, tipo: a.tipo })
      .select('id')
      .single()

    if (error) throw new Error(`acabamento ${a.nome}: ${error.message}`)

    mapa.set(a.nome, data.id)
  }

  return mapa
}

async function importar(supabase, dados, acabamentos) {
  console.log('\n════ GRAVANDO ════\n')

  const mapaAcabamentos = await garantirAcabamentos(supabase, acabamentos)
  console.log(`acabamentos prontos: ${mapaAcabamentos.size}`)

  // ── Perfis ──
  const mapaPerfis = new Map()
  let criados = 0
  let reaproveitados = 0

  for (const p of dados.perfis) {
    const { data: existente } = await supabase
      .from('modelos_perfil')
      .select('id')
      .eq('codigo', p.codigo)
      .maybeSingle()

    if (existente) {
      mapaPerfis.set(p.codigo, existente.id)
      reaproveitados += 1
      continue
    }

    const observacoes = [
      p.status ? `Status: ${p.status}` : null,
      p.observacao,
      p.fonte ? `Fonte: ${p.fonte}` : null,
      'Importado da planilha de inventário.',
    ]
      .filter(Boolean)
      .join('\n')

    const { data, error } = await supabase
      .from('modelos_perfil')
      .insert({
        codigo: p.codigo,
        descricao: p.descricao,
        linha: p.linhaPerfil,
        comprimento_barra_mm: COMPRIMENTO_BARRA_MM,
        peso_por_metro_g: p.pesoGramasPorMetro,
        observacoes,
      })
      .select('id')
      .single()

    if (error) throw new Error(`perfil ${p.codigo}: ${error.message}`)

    mapaPerfis.set(p.codigo, data.id)
    criados += 1
  }

  console.log(`perfis: ${criados} criados, ${reaproveitados} já existiam`)

  // ── Desenhos técnicos ──
  const { data: perfilQualquer } = await supabase
    .from('perfis_usuario')
    .select('organizacao_id')
    .limit(1)
    .single()

  const organizacaoId = perfilQualquer.organizacao_id
  let desenhos = 0

  for (const p of dados.perfis) {
    if (!p.imagem) continue

    const perfilId = mapaPerfis.get(p.codigo)
    if (!perfilId) continue

    const { count } = await supabase
      .from('arquivos_vetoriais')
      .select('id', { count: 'exact', head: true })
      .eq('modelo_perfil_id', perfilId)
      .eq('tipo', 'imagem')

    if ((count ?? 0) > 0) continue

    const extensao = p.imagem.extensao
    const caminho = `${organizacaoId}/${crypto.randomUUID()}.${extensao}`

    const { error: erroEnvio } = await supabase.storage
      .from('desenhos-tecnicos')
      .upload(caminho, p.imagem.buffer, {
        contentType: `image/${extensao}`,
        upsert: false,
      })

    if (erroEnvio) throw new Error(`desenho ${p.codigo}: ${erroEnvio.message}`)

    const { error } = await supabase.from('arquivos_vetoriais').insert({
      modelo_perfil_id: perfilId,
      tipo: 'imagem',
      arquivo_url: caminho,
      legenda: 'Desenho de catálogo',
      ordem: 0,
      sanitizado: true,
    })

    if (error) throw new Error(`desenho ${p.codigo}: ${error.message}`)

    desenhos += 1
    if (desenhos % 20 === 0) console.log(`  desenhos enviados: ${desenhos}`)
  }

  console.log(`desenhos técnicos: ${desenhos} enviados`)

  // ── Lotes ──
  // Pela função transacional, que gera o código curto e grava a movimentação
  // de entrada na mesma transação.
  let lotes = 0

  for (const l of dados.lotes) {
    const perfilId = mapaPerfis.get(l.codigo)
    const acabamentoId = mapaAcabamentos.get(
      ehIndefinido(l.acabamento) ? ACABAMENTO_INDEFINIDO : l.acabamento,
    )

    if (!perfilId || !acabamentoId) {
      console.warn(`  pulado: ${l.codigo} / ${l.acabamento}`)
      continue
    }

    const { error } = await supabase.rpc('cadastrar_sobra', {
      p_modelo_perfil_id: perfilId,
      p_acabamento_id: acabamentoId,
      p_comprimento_mm: l.comprimentoMm,
      p_quantidade: l.quantidade,
      p_localizacao_id: null,
      p_estado: 'bom',
      p_origem:
        l.comprimentoMm >= COMPRIMENTO_BARRA_MM
          ? 'Barra inteira — inventário inicial'
          : 'Inventário inicial',
      p_observacoes: l.descricao,
      p_foto_url: null,
    })

    if (error) throw new Error(`lote ${l.codigo}: ${error.message}`)

    lotes += 1
    if (lotes % 20 === 0) console.log(`  lotes criados: ${lotes}`)
  }

  console.log(`lotes de sobra: ${lotes} criados`)
  console.log('\n════ IMPORTAÇÃO CONCLUÍDA ════')
}

// ── Início ──────────────────────────────────────────────────────────────

const arquivo = process.argv[2]
const confirmar = process.argv.includes('--confirmar')

if (!arquivo) {
  console.error('Informe o caminho da planilha.')
  process.exit(1)
}

const dados = lerPlanilha(arquivo)

// Acabamentos distintos, com os indefinidos agrupados.
const nomes = new Set()
for (const l of dados.lotes) {
  nomes.add(ehIndefinido(l.acabamento) ? ACABAMENTO_INDEFINIDO : l.acabamento)
}

const acabamentos = [...nomes].sort().map((nome) => ({
  nome,
  codigo: nome === ACABAMENTO_INDEFINIDO ? 'ACB-CONF' : codigoAcabamento(nome),
  tipo: nome === ACABAMENTO_INDEFINIDO ? 'outro' : 'pintura',
}))

mostrarPrevia(dados, acabamentos)

const destinoPendentes = path.join(
  path.dirname(arquivo),
  'pendentes-para-medir.csv',
)
exportarPendentes(dados.pendentes, destinoPendentes)

if (!confirmar) {
  console.log(
    '\nNada foi gravado. Para importar de verdade, repita com --confirmar.',
  )
  process.exit(0)
}

const supabase = await entrar()
await importar(supabase, dados, acabamentos)
