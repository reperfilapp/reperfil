// Edge Function "identificar-perfil-por-foto"
//
// Recebe a foto tirada na tela "Identificar perfil" (data URI), gera o
// embedding dela pela API da Cohere (embed-v4.0) e devolve os perfis mais
// parecidos visualmente, chamando a função `perfis_mais_parecidos` do
// banco (foto e desenho técnico entram juntos na comparação — ver a
// migração `busca_visual_por_foto`).
//
// A foto de busca NUNCA é gravada — só vira vetor, aqui, na memória da
// função, e é descartada assim que a resposta sai. Isso é diferente da
// foto de CADASTRO do perfil (essa sim persistida, em `arquivos_vetoriais`).
//
// `verify_jwt` fica ligado (padrão do projeto): quem chama precisa estar
// autenticado, e a comparação usa a organização de quem chama — a mesma
// consulta que o navegador faria sozinho, só que a geração do vetor da
// foto precisa acontecer no servidor (a chave da Cohere não pode viajar
// até o aparelho).
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const COHERE_API_KEY = Deno.env.get('COHERE_API_KEY')!

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

interface Candidato {
  modelo_perfil_id: string
  parecenca: number
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

  let foto: string
  try {
    const corpo = await req.json()
    if (typeof corpo.foto !== 'string' || !corpo.foto.startsWith('data:image/')) {
      throw new Error()
    }
    foto = corpo.foto
  } catch {
    return resposta({ ok: false, error: 'Informe a foto como data URI de imagem.' }, 400)
  }

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
      images: [foto],
    }),
  })

  if (!respostaCohere.ok) {
    return resposta({ ok: false, error: `Cohere: ${await respostaCohere.text()}` }, 502)
  }

  const corpoCohere = await respostaCohere.json()
  const vetor = corpoCohere.embeddings?.float?.[0]

  if (!Array.isArray(vetor)) {
    return resposta({ ok: false, error: 'Resposta da Cohere sem vetor.' }, 502)
  }

  const { data: candidatos, error: erroBusca } = await clienteDoUsuario.rpc(
    'perfis_mais_parecidos',
    { p_embedding: vetor, p_limite: 20 },
  )

  if (erroBusca) {
    return resposta({ ok: false, error: erroBusca.message }, 500)
  }

  return resposta({
    ok: true,
    candidatos: ((candidatos ?? []) as Candidato[]).map((c) => ({
      modeloPerfilId: c.modelo_perfil_id,
      parecenca: Math.round(c.parecenca * 100),
    })),
  })
})
