// Edge Function "excluir-empresa"
//
// Encerra uma empresa por completo. Só o administrador da organização
// central chama — quem confere isso é a própria função SQL, com a sessão
// de quem pediu.
//
// ── POR QUE UMA EDGE FUNCTION, E NÃO SÓ UMA RPC ──────────────────────────
//
// A exclusão tem três partes, e SQL comum só alcança uma:
//
//   1. As LINHAS do banco       → `excluir_organizacao()`, uma RPC normal
//   2. Os ARQUIVOS no Storage   → fotos de perfil, desenhos técnicos,
//      imagens de produto, logo, retratos dos colaboradores. Nenhum é
//      apagado por cascade: sem esta função, ficariam para sempre nos
//      baldes, ocupando espaço de dados que já não existem.
//   3. As CONTAS em `auth.users` → sem apagá-las, as pessoas continuariam
//      conseguindo entrar (caindo em "acesso não liberado") e, pior, os
//      e-mails ficariam ocupados para sempre — quem quisesse recomeçar do
//      zero com o mesmo endereço não conseguiria.
//
// As partes 2 e 3 exigem a chave de serviço, que não pode viajar dentro do
// aplicativo. Daí esta função existir: ela tem a chave, o app não. Mesmo
// desenho da `excluir-conta`.
//
// ── A ORDEM IMPORTA ──────────────────────────────────────────────────────
//
// Os caminhos dos arquivos e os ids das contas são lidos ANTES de apagar as
// linhas — depois do delete, não haveria mais como saber quais eram.
import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

/**
 * Todo balde guarda os arquivos em `{organizacao_id}/nome`, sem exceção —
 * é a mesma convenção que as políticas de Storage usam para isolar uma
 * empresa da outra (`caminho_e_da_organizacao`). Por isso dá para limpar
 * a empresa inteira listando uma pasta por balde.
 */
const BALDES = [
  'fotos-perfis',
  'desenhos-tecnicos',
  'imagens-produtos',
  'logos-organizacoes',
  'fotos-colaboradores',
]

const cabecalhosCors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
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

  let organizacaoId: string | undefined
  let confirmacao: string | undefined

  try {
    const corpo = await req.json()
    organizacaoId = corpo?.organizacaoId
    confirmacao = corpo?.confirmacao
  } catch {
    return resposta({ ok: false, error: 'Pedido malformado.' }, 400)
  }

  if (!organizacaoId) {
    return resposta({ ok: false, error: 'Empresa não informada.' }, 400)
  }

  // Cliente com a SESSÃO de quem chamou. É ele que faz as chamadas de
  // banco, para o RLS e as checagens de `e_administrador()` valerem — usar
  // a chave de serviço aqui pularia justamente a autorização que a
  // função SQL faz.
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

  // 1. O que existe, ANTES de apagar. A função recusa quem não for
  //    administrador da organização central — é aqui que a autorização
  //    acontece de verdade, no banco, e não neste arquivo.
  const { data: dados, error: erroDados } = await clienteDoUsuario.rpc(
    'dados_para_excluir_organizacao',
    { p_organizacao_id: organizacaoId },
  )

  if (erroDados) {
    return resposta({ ok: false, error: erroDados.message }, 403)
  }

  // Confirmação por digitação do nome: a última barreira antes do
  // irreversível, conferida no servidor e não só na tela — assim vale
  // mesmo para quem chamar a função por fora do aplicativo.
  const nome = (dados as { nome_fantasia: string }).nome_fantasia

  if (confirmacao?.trim() !== nome.trim()) {
    return resposta(
      {
        ok: false,
        error: `Para confirmar, digite exatamente o nome da empresa: ${nome}`,
      },
      400,
    )
  }

  const usuarios = (dados as { usuarios: string[] }).usuarios ?? []

  const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

  // 2. As linhas do banco. Vem antes do Storage e do auth de propósito: se
  //    esta parte falhar, nada foi perdido e o pedido pode ser repetido.
  //    Falhando as seguintes, o que sobra é lixo sem dono — ruim, mas não
  //    é perda de dado de ninguém.
  const { error: erroExclusao } = await clienteDoUsuario.rpc(
    'excluir_organizacao',
    { p_organizacao_id: organizacaoId },
  )

  if (erroExclusao) {
    return resposta({ ok: false, error: erroExclusao.message }, 400)
  }

  // 3. Os arquivos. Uma pasta por balde, com o id da empresa.
  const arquivosApagados: Record<string, number> = {}

  for (const balde of BALDES) {
    try {
      const { data: lista } = await supabaseAdmin.storage
        .from(balde)
        .list(organizacaoId, { limit: 1000 })

      const caminhos = (lista ?? []).map((a) => `${organizacaoId}/${a.name}`)

      if (caminhos.length > 0) {
        await supabaseAdmin.storage.from(balde).remove(caminhos)
      }

      arquivosApagados[balde] = caminhos.length
    } catch (e) {
      // Um balde que falha não pode impedir a limpeza dos outros nem
      // fazer a operação inteira parecer fracassada: o banco já foi
      // apagado, e é ele que define se a empresa existe.
      console.error(`[excluir-empresa] Falha ao limpar ${balde}:`, e)
      arquivosApagados[balde] = -1
    }
  }

  // 4. As contas de login. Por último porque é o que libera os e-mails —
  //    e, se algo aqui falhar, a pessoa cai numa conta sem empresa, que a
  //    tela já sabe tratar.
  let contasApagadas = 0

  for (const usuarioId of usuarios) {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(usuarioId)

    if (error) {
      console.error(
        `[excluir-empresa] Conta ${usuarioId} não foi apagada:`,
        error.message,
      )
    } else {
      contasApagadas += 1
    }
  }

  return resposta({
    ok: true,
    nomeFantasia: nome,
    contasApagadas,
    arquivosApagados,
  })
})
