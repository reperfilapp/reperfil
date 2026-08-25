// Edge Function "excluir-conta"
//
// Faz o que o app sozinho não consegue: apagar os dados pessoais do perfil
// E liberar o e-mail de LOGIN (auth.users) na mesma operação.
//
// A segunda parte é a razão de existir desta função. Trocar o e-mail pelo
// caminho normal (`supabase.auth.updateUser`) manda um e-mail de
// confirmação — e, com "Secure email change" ligado neste projeto, teria
// que confirmar TAMBÉM no endereço novo, que é `@reperfil.local` e não
// existe de verdade. A troca ficaria pendente para sempre e o e-mail real
// nunca seria liberado para um novo convite. A API de admin do Supabase
// (`auth.admin.updateUserById`) aplica na hora, sem confirmação — só que
// exige a chave de serviço, que não pode viajar dentro do app. Por isso
// esta função existe: ela tem a chave, o app não.
//
// Ao contrário da `enviar-email`, esta função MANTÉM a verificação de JWT
// padrão do Supabase (não tem `verify_jwt = false` no config.toml) — quem
// chama precisa estar de fato autenticado, e é essa mesma sessão que diz
// QUEM está pedindo a própria exclusão.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

// Quem chama é o navegador direto (`supabase.functions.invoke`), não outro
// servidor — sem isto o navegador bloqueia a chamada no preflight (OPTIONS)
// antes mesmo dela chegar aqui, e o supabase-js só relata "Failed to send a
// request to the Edge Function", sem detalhe nenhum do motivo real.
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cabecalhosCors })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return resposta({ ok: false, error: 'Não autenticado.' }, 401)
  }

  // Cliente com a sessão de quem chamou — só para confirmar quem é a
  // pessoa. O Supabase já validou a assinatura do token antes de a
  // requisição chegar aqui (verify_jwt continua ligado nesta função).
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

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // Perfil primeiro: se isto falhar (ex.: único administrador ativo), o
  // login não é tocado — a pessoa continua com acesso normal.
  const { error: erroPerfil } = await supabaseAdmin.rpc('excluir_conta_admin', {
    p_usuario_id: user.id,
  })

  if (erroPerfil) {
    return resposta({ ok: false, error: erroPerfil.message }, 400)
  }

  const emailSintetico = `conta-excluida-${user.id.slice(0, 8)}@reperfil.local`

  const { error: erroAuth } = await supabaseAdmin.auth.admin.updateUserById(
    user.id,
    { email: emailSintetico, email_confirm: true },
  )

  if (erroAuth) {
    // O perfil já foi apagado — a pessoa está desativada mesmo se esta
    // parte falhar. Só o e-mail de login continua ocupado; não é motivo
    // para fingir que a exclusão inteira falhou.
    console.error('[excluir-conta] Perfil apagado, mas o login não foi liberado:', erroAuth)
  }

  return resposta({ ok: true })
})
