/**
 * Move de verdade os arquivos de imagem (fotos de perfil, desenhos
 * técnicos, fotos/desenhos de produto) da Alumifort para a RePerfil —
 * não duplica: copia e depois apaga o original, para que cada arquivo
 * exista num lugar só, o catálogo central.
 *
 * Depois de mover, atualiza `arquivos_vetoriais.arquivo_url` e
 * `produtos.foto_url` / `produtos.desenho_url` para o caminho novo — nos
 * dois lados (Alumifort e RePerfil), já que os dois passam a apontar
 * para o MESMO arquivo físico, agora vivendo só na pasta da RePerfil.
 *
 * Script de UMA VEZ SÓ, não roda de novo sem risco: na segunda vez a
 * pasta de origem já estaria vazia (nada para mover) — inofensivo, mas
 * sem efeito nenhum.
 *
 * Uso:
 *   SUPABASE_URL=https://SEU-PROJETO.supabase.co ^
 *   SUPABASE_SERVICE_ROLE_KEY=cole-a-chave-aqui ^
 *   node scripts/mover-arquivos-catalogo-central.mjs
 *
 * A chave de serviço (Project Settings → API → service_role, "secret")
 * fica só na variável de ambiente do seu terminal — nunca escreva ela
 * neste arquivo nem em qualquer coisa que vá para o git.
 */
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY como variáveis de ambiente antes de rodar.',
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

async function acharOrganizacao(filtro) {
  const { data, error } = await supabase
    .from('organizacoes')
    .select('id, nome_fantasia')
    .ilike('nome_fantasia', filtro)
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) throw new Error(`Organização não encontrada: ${filtro}`)
  return data
}

/** Move todo o conteúdo de `{origemId}/` para `{destinoId}/`, arquivo a arquivo. */
async function moverPastaDoBalde(balde, origemId, destinoId) {
  const { data: arquivos, error } = await supabase.storage
    .from(balde)
    .list(origemId, { limit: 1000 })

  if (error) throw new Error(`Falha ao listar ${balde}/${origemId}: ${error.message}`)

  const substituicoes = []

  for (const arquivo of arquivos ?? []) {
    const de = `${origemId}/${arquivo.name}`
    const para = `${destinoId}/${arquivo.name}`

    const { error: erroCopia } = await supabase.storage.from(balde).copy(de, para)
    if (erroCopia) {
      console.error(`  falhou copiar ${balde}/${de}: ${erroCopia.message}`)
      continue
    }

    const { error: erroRemover } = await supabase.storage.from(balde).remove([de])
    if (erroRemover) {
      console.error(
        `  copiou mas não removeu o original ${balde}/${de}: ${erroRemover.message}`,
      )
    }

    substituicoes.push({ de, para })
    console.log(`  movido: ${balde}/${de} -> ${balde}/${para}`)
  }

  if ((arquivos ?? []).length === 0) {
    console.log(`  nada para mover em ${balde}/${origemId}`)
  }

  return substituicoes
}

/** Troca o caminho antigo pelo novo em toda linha que ainda apontar para ele. */
async function atualizarCaminhos(tabela, coluna, substituicoes) {
  for (const { de, para } of substituicoes) {
    const { error } = await supabase
      .from(tabela)
      .update({ [coluna]: para })
      .eq(coluna, de)

    if (error) {
      console.error(`  falha ao atualizar ${tabela}.${coluna} (${de}): ${error.message}`)
    }
  }
}

async function main() {
  const origem = await acharOrganizacao('%alumifort%')
  const destino = await acharOrganizacao('RePerfil')

  console.log(`Origem: ${origem.nome_fantasia} (${origem.id})`)
  console.log(`Destino: ${destino.nome_fantasia} (${destino.id})`)

  console.log('\nMovendo fotos-perfis...')
  const fotosPerfis = await moverPastaDoBalde('fotos-perfis', origem.id, destino.id)
  await atualizarCaminhos('arquivos_vetoriais', 'arquivo_url', fotosPerfis)

  console.log('\nMovendo desenhos-tecnicos...')
  const desenhos = await moverPastaDoBalde('desenhos-tecnicos', origem.id, destino.id)
  await atualizarCaminhos('arquivos_vetoriais', 'arquivo_url', desenhos)

  console.log('\nMovendo imagens-produtos...')
  const imagensProduto = await moverPastaDoBalde('imagens-produtos', origem.id, destino.id)
  await atualizarCaminhos('produtos', 'foto_url', imagensProduto)
  await atualizarCaminhos('produtos', 'desenho_url', imagensProduto)

  console.log('\nConcluído.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
