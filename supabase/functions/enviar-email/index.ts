// Edge Function "enviar-email"
//
// Dispara os dois e-mails que o próprio Supabase não manda porque não são
// eventos de Auth: o convite (a pessoa convidada ainda nem existe no
// sistema) e a confirmação de e-mail (token nosso, não o do Supabase — ver
// a migração `20260825400000_confirmacao_email.sql`).
//
// Quem chama é um Database Webhook (Dashboard → Database → Webhooks),
// configurado para dois eventos de INSERT — em `convites_colaborador` e em
// `perfis_usuario`. O cabeçalho `x-webhook-secret` é a única coisa que
// impede qualquer um na internet de mandar e-mail em nome do RePerfil: o
// mesmo valor fica no webhook (Dashboard) e no secret desta função.
//
// Um terceiro chamador existe: o próprio app, autenticado, pedindo para
// REENVIAR a confirmação de e-mail (sem o segredo do webhook — quem prova
// a identidade aí é a sessão da pessoa).
//
// Variáveis de ambiente necessárias (Dashboard → Edge Functions → Secrets):
//   GMAIL_USER       conta que envia (ex.: reperfilapp@gmail.com)
//   GMAIL_PASS       senha de APP do Gmail (não a senha normal da conta —
//                    ver aviso no chat sobre isto)
//   WEBHOOK_SECRET   valor qualquer, só para os dois lados baterem
//   PLAY_STORE_URL   opcional — só existe depois de publicado. Enquanto
//                    vazia, o e-mail de convite simplesmente omite o botão
//                    da loja.
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY já vêm prontas em toda Edge
// Function do Supabase — não precisam ser cadastradas à mão.
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts'
import {
  APP_URL,
  botao,
  linkTextoAlternativo,
  moldura,
  paragrafo,
  rodape,
} from './moldura.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const GMAIL_USER = Deno.env.get('GMAIL_USER') ?? ''
const GMAIL_PASS = Deno.env.get('GMAIL_PASS') ?? ''
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET') ?? ''
const PLAY_STORE_URL = Deno.env.get('PLAY_STORE_URL') ?? ''

const supabaseAdmin = createClient(
  SUPABASE_URL,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

// Quem chama pelo Database Webhook é servidor-a-servidor, sem navegador
// envolvido — não precisa de CORS. Mas o reenvio de confirmação (mais
// abaixo) é chamado direto do app, então esta função também precisa
// responder ao preflight (OPTIONS) do navegador.
const cabecalhosCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function respostaJson(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { ...cabecalhosCors, 'content-type': 'application/json' },
  })
}

interface EventoWebhook {
  type: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  record: Record<string, unknown>
}

// O denomailer precisa de RFC 2047 (`=?utf-8?Q?...?=`) para qualquer
// caractere fora do ASCII no Assunto — e quebra essa codificação para
// linhas longas (o e-mail inteiro chega cru, sem interpretar nada). Um
// travessão ("—") ou um nome de empresa acentuado já bastam para disparar
// isso. Solução mais simples: o Assunto nunca carrega nada fora do ASCII —
// o corpo do e-mail continua acentuado normalmente, só ele passa por
// `debug.encodeLB`/quoted-printable sem problema.
function paraAssuntoAscii(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/\p{Mark}/gu, '')
    .replace(/[^\x20-\x7e]/g, '-')
}

async function enviarEmail(destinatario: string, assunto: string, html: string) {
  const client = new SMTPClient({
    connection: {
      hostname: 'smtp.gmail.com',
      port: 465,
      tls: true,
      auth: { username: GMAIL_USER, password: GMAIL_PASS },
    },
    // Sem isto, o denomailer quebra a codificação de e-mails com quebra de
    // linha no HTML — o Gmail chegou a mostrar o e-mail inteiro (cabeçalhos
    // e corpo) como texto cru, sem interpretar nada. É um problema
    // conhecido da biblioteca, com esta bandeira documentada como correção.
    debug: { encodeLB: true },
  })

  try {
    await client.send({
      from: `RePerfil <${GMAIL_USER}>`,
      to: destinatario,
      subject: assunto,
      html,
    })
  } finally {
    await client.close()
  }
}

async function enviarConvite(convite: Record<string, unknown>) {
  const conviteId = convite.id as string
  const organizacaoId = convite.organizacao_id as string
  const email = convite.email as string
  const nome = convite.nome as string
  const expiraEm = convite.expira_em as string

  const { data: organizacao } = await supabaseAdmin
    .from('organizacoes')
    .select('nome_fantasia, razao_social')
    .eq('id', organizacaoId)
    .single()

  const nomeEmpresa =
    (organizacao?.razao_social as string | null)?.trim() ||
    (organizacao?.nome_fantasia as string | null) ||
    'sua empresa'

  // Com prazo de 24h, só a data (sem hora) seria vaga demais — "vale até
  // hoje" não diz até que horas. Fuso fixo em horário de Brasília: o
  // servidor roda em UTC, e sem isto a hora mostrada sairia adiantada.
  const dataExpiracao = new Date(expiraEm).toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const botaoLoja = PLAY_STORE_URL ? botao('Baixar na Play Store', PLAY_STORE_URL) : ''

  // Vai direto para Primeiro acesso, já com e-mail preenchido — e carrega
  // o id do convite. Clicar neste link específico é a prova de que a
  // pessoa tem acesso a esta caixa de entrada: `vincular_convite` casa esse
  // id com o convite de verdade e confirma o e-mail na hora, sem precisar
  // do e-mail de confirmação separado (esse só existe para quem chega sem
  // ter passado por aqui).
  const linkConvite =
    `${APP_URL}/primeiro-acesso?convite=${conviteId}` +
    `&email=${encodeURIComponent(email)}`

  const html = moldura(
    'Você foi convidado',
    paragrafo(
      `Olá, <strong>${nome}</strong>. A empresa <strong>${nomeEmpresa}</strong>, ` +
        `cadastrada no app RePerfil, convidou você para criar sua conta no ` +
        `aplicativo.`,
    ) +
      botao('Abrir o app RePerfil', linkConvite) +
      paragrafo(
        `Depois de abrir o app, na tela inicial toque em ` +
          `<strong>Primeiro acesso</strong>, crie sua senha usando o e-mail ` +
          `<strong>${email}</strong> e complete o preenchimento dos seus ` +
          `dados cadastrais. Se quiser, depois você pode cadastrar um ` +
          `apelido simples para usar no lugar do e-mail ao entrar.`,
      ) +
      paragrafo(
        `Este convite vale até <strong>${dataExpiracao}</strong>. Depois ` +
          `disso, peça a um administrador da empresa para reenviar.`,
      ) +
      linkTextoAlternativo(linkConvite) +
      botaoLoja +
      rodape(
        'Não esperava este convite? Pode ignorar esta mensagem — sem ele, ' +
          'ninguém consegue criar uma conta com este e-mail.',
      ),
  )

  await enviarEmail(
    email,
    paraAssuntoAscii(`Convite para o RePerfil - ${nomeEmpresa}`),
    html,
  )

  // Só grava depois do envio ter sucesso — é o que a tela de "reenviar"
  // fica consultando para confirmar de verdade, em vez de supor.
  await supabaseAdmin
    .from('convites_colaborador')
    .update({ email_enviado_em: new Date().toISOString() })
    .eq('id', conviteId)
}

async function enviarConfirmacaoDeEmail(perfil: Record<string, unknown>) {
  const id = perfil.id as string
  const email = perfil.email as string

  const token = crypto.randomUUID()
  const expiraEm = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()

  const { error } = await supabaseAdmin
    .from('perfis_usuario')
    .update({
      token_confirmacao_email: token,
      token_confirmacao_email_expira_em: expiraEm,
    })
    .eq('id', id)

  if (error) throw new Error(`Falha ao gravar token de confirmação: ${error.message}`)

  const link = `${APP_URL}/confirmar-email?token=${token}`

  const html = moldura(
    'Confirme seu e-mail',
    paragrafo(
      'Você criou uma conta no RePerfil, mas ainda não entrou pelo link do ' +
        'convite — falta confirmar que este e-mail é seu para liberar o ' +
        'acesso ao aplicativo.',
    ) +
      botao('Confirmar meu e-mail', link) +
      linkTextoAlternativo(link) +
      rodape(
        'Não foi você quem se cadastrou? Pode ignorar esta mensagem — sem a ' +
          'confirmação, o acesso continua bloqueado.',
      ),
  )

  await enviarEmail(email, paraAssuntoAscii('Confirme seu e-mail no RePerfil'), html)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cabecalhosCors })
  }

  if (req.headers.get('x-webhook-secret') === WEBHOOK_SECRET) {
    let evento: EventoWebhook
    try {
      evento = await req.json()
    } catch {
      return new Response('Corpo inválido.', { status: 400 })
    }

    try {
      if (evento.table === 'convites_colaborador' && evento.type === 'INSERT') {
        await enviarConvite(evento.record)
      } else if (evento.table === 'perfis_usuario' && evento.type === 'INSERT') {
        await enviarConfirmacaoDeEmail(evento.record)
      }
      // Tabela/evento que não conhecemos: responde 200 mesmo assim — não é
      // erro nosso, é o webhook cadastrado a mais no Dashboard.
      return new Response('ok')
    } catch (erro) {
      console.error('[enviar-email]', erro)
      return new Response(String(erro), { status: 500 })
    }
  }

  // Sem o segredo do webhook: só pode ser o próprio app pedindo para
  // reenviar a confirmação de e-mail (ex.: o primeiro foi para o spam).
  // Quem prova quem é a pessoa aqui é a sessão dela, não um segredo fixo.
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return respostaJson({ ok: false, error: 'Não autorizado.' }, 401)
  }

  const clienteDoUsuario = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  })

  const {
    data: { user },
    error: erroUsuario,
  } = await clienteDoUsuario.auth.getUser()

  if (erroUsuario || !user) {
    return respostaJson({ ok: false, error: 'Não autorizado.' }, 401)
  }

  const { data: perfil, error: erroPerfil } = await clienteDoUsuario
    .from('perfis_usuario')
    .select('*')
    .eq('id', user.id)
    .single()

  if (erroPerfil || !perfil) {
    return respostaJson({ ok: false, error: 'Perfil não encontrado.' }, 404)
  }

  try {
    await enviarConfirmacaoDeEmail(perfil)
    return respostaJson({ ok: true })
  } catch (erro) {
    console.error('[enviar-email] reenvio de confirmação falhou:', erro)
    return respostaJson({ ok: false, error: String(erro) }, 500)
  }
})
