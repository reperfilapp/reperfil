// Edge Function "calcular-embedding-perfil"
//
// Gera o vetor (embedding) de UMA foto ou desenho técnico já cadastrado em
// `arquivos_vetoriais`, chamando a API da Cohere (embed-v4.0, entrada
// imagem), e grava o resultado na própria linha (coluna `embedding`).
//
// Chamada automaticamente pelo app, logo depois de um upload em
// GaleriaDesenhos.tsx, e pelo script de backfill para o que já existia
// antes desta funcionalidade — nos dois casos sem o usuário perceber nada.
//
// Usa a chave de serviço para ler/gravar em `arquivos_vetoriais` e baixar
// a imagem do Storage. A permissão de mexer no estoque já foi conferida no
// momento do upload; aqui só confere que o arquivo pertence à MESMA
// organização de quem está chamando — um id de outra organização não pode
// ser usado nesta função.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const COHERE_API_KEY = Deno.env.get('COHERE_API_KEY')!

/** Mesma correspondência tipo → balde de `src/dados/desenhosTecnicos.ts'. */
const BALDE_POR_TIPO: Record<string, string> = {
  imagem: 'desenhos-tecnicos',
  foto: 'fotos-perfis',
}

// Quem chama é o navegador direto (`supabase.functions.invoke`), não outro
// servidor — sem isto o navegador bloqueia a chamada no preflight (OPTIONS).
const cabecalhosCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function resposta(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cabecalhosCors, 'content-type': 'application/json' },
  })
}

/** Em lotes: `String.fromCharCode(...bytes)` estoura a pilha em imagens grandes. */
async function paraBase64(dados: Blob): Promise<string> {
  const bytes = new Uint8Array(await dados.arrayBuffer())
  const TAMANHO_LOTE = 8192
  let binario = ''
  for (let i = 0; i < bytes.length; i += TAMANHO_LOTE) {
    binario += String.fromCharCode(...bytes.subarray(i, i + TAMANHO_LOTE))
  }
  return btoa(binario)
}

/**
 * Grava o resultado da tentativa na própria linha — sucesso ou erro. É o
 * que alimenta o marcador que a galeria mostra (`embedding_ok`,
 * `embedding_erro`); sem isto, uma falha ficaria invisível para sempre.
 */
async function marcarResultado(
  supabaseAdmin: ReturnType<typeof createClient>,
  arquivoId: string,
  resultado: { vetor: number[] } | { erro: string },
) {
  const valores =
    'vetor' in resultado
      ? { embedding: resultado.vetor, embedding_ok: true, embedding_erro: null }
      : { embedding_ok: false, embedding_erro: resultado.erro }

  const { error } = await supabaseAdmin
    .from('arquivos_vetoriais')
    .update(valores)
    .eq('id', arquivoId)

  if (error) {
    console.error('Não foi possível gravar o status do embedding:', error.message)
  }
}

async function gerarEmbedding(dataUri: string): Promise<number[]> {
  const respostaCohere = await fetch('https://api.cohere.com/v2/embed', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${COHERE_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'embed-v4.0',
      input_type: 'image',
      embedding_types: ['float'],
      output_dimension: 1024,
      images: [dataUri],
    }),
  })

  if (!respostaCohere.ok) {
    throw new Error(`Cohere: ${await respostaCohere.text()}`)
  }

  const corpo = await respostaCohere.json()
  const vetor = corpo.embeddings?.float?.[0]

  if (!Array.isArray(vetor)) {
    throw new Error('Resposta da Cohere sem vetor.')
  }

  return vetor
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cabecalhosCors })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return resposta({ ok: false, error: 'Não autenticado.' }, 401)
  }

  const clienteDoUsuario = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: erroUsuario,
  } = await clienteDoUsuario.auth.getUser()

  if (erroUsuario || !user) {
    return resposta({ ok: false, error: 'Não autenticado.' }, 401)
  }

  let arquivoId: string
  try {
    const corpo = await req.json()
    if (typeof corpo.arquivoId !== 'string' || !corpo.arquivoId) throw new Error()
    arquivoId = corpo.arquivoId
  } catch {
    return resposta({ ok: false, error: 'Informe arquivoId.' }, 400)
  }

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  const { data: perfilUsuario } = await supabaseAdmin
    .from('perfis_usuario')
    .select('organizacao_id')
    .eq('id', user.id)
    .single()

  if (!perfilUsuario) {
    return resposta({ ok: false, error: 'Organização não encontrada.' }, 403)
  }

  const { data: arquivo, error: erroArquivo } = await supabaseAdmin
    .from('arquivos_vetoriais')
    .select('id, tipo, arquivo_url, organizacao_id')
    .eq('id', arquivoId)
    .single()

  if (erroArquivo || !arquivo) {
    return resposta({ ok: false, error: 'Arquivo não encontrado.' }, 404)
  }

  if (arquivo.organizacao_id !== perfilUsuario.organizacao_id) {
    return resposta({ ok: false, error: 'Arquivo de outra organização.' }, 403)
  }

  const balde = BALDE_POR_TIPO[arquivo.tipo]
  if (!balde) {
    // Tipo da Fase 2 (secao_svg/secao_dxf) ou futuro — não é imagem
    // rasterizada, não há o que vetorizar aqui.
    return resposta({ ok: true, ignorado: true })
  }

  const { data: imagem, error: erroDownload } = await supabaseAdmin.storage
    .from(balde)
    .download(arquivo.arquivo_url)

  if (erroDownload || !imagem) {
    const erro = `Falha ao baixar a imagem: ${erroDownload?.message}`
    await marcarResultado(supabaseAdmin, arquivoId, { erro })
    return resposta({ ok: false, error: erro }, 500)
  }

  try {
    const base64 = await paraBase64(imagem)
    const dataUri = `data:${imagem.type || 'image/jpeg'};base64,${base64}`
    const vetor = await gerarEmbedding(dataUri)

    await marcarResultado(supabaseAdmin, arquivoId, { vetor })

    return resposta({ ok: true })
  } catch (e) {
    const erro = e instanceof Error ? e.message : 'Falha ao gerar o vetor.'
    await marcarResultado(supabaseAdmin, arquivoId, { erro })
    return resposta({ ok: false, error: erro }, 502)
  }
})
