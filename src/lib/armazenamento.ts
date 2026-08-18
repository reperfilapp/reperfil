import { supabase } from './supabase'
import {
  comprimirImagem,
  COMPRESSAO_FOTO,
  COMPRESSAO_DESENHO,
  type OpcoesCompressao,
} from './imagens'

/**
 * Envio e leitura de imagens no Supabase Storage.
 *
 * Os baldes são PRIVADOS, então não existe endereço permanente para a imagem:
 * é preciso pedir um link temporário a cada exibição. Isso é o preço de não
 * deixar foto de depósito e desenho de catálogo abertos na internet.
 *
 * Todo caminho começa com o id da organização — é isso que as políticas do
 * Storage conferem. O aplicativo não escolhe esse prefixo por confiança: se
 * mandar outro, o banco recusa.
 */

export const BALDE_FOTOS = 'fotos-sobras'
export const BALDE_DESENHOS = 'desenhos-tecnicos'
/** Fotografia da peça real, separada do desenho de catálogo. */
export const BALDE_FOTOS_PERFIL = 'fotos-perfis'
/** Retrato do colaborador. Rosto de pessoa não se mistura com catálogo. */
export const BALDE_FOTOS_COLABORADOR = 'fotos-colaboradores'
/** Foto e desenho do produto acabado — a janela pronta, não o perfil. */
export const BALDE_IMAGENS_PRODUTO = 'imagens-produtos'

/** Quanto tempo o link temporário vale. Uma hora cobre qualquer sessão. */
const VALIDADE_LINK_SEGUNDOS = 3600

async function organizacaoAtual(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Sessão expirada. Entre novamente.')
  }

  // O filtro por `id` é obrigatório, não redundante: o RLS permite enxergar
  // os COLEGAS da mesma organização, então sem ele a consulta devolve uma
  // linha por usuário da empresa e `single()` falha. Foi exatamente o que
  // aconteceu assim que a organização passou a ter duas contas.
  const { data, error } = await supabase
    .from('perfis_usuario')
    .select('organizacao_id')
    .eq('id', user.id)
    .single<{ organizacao_id: string }>()

  if (error || !data) {
    throw new Error('Não foi possível identificar a sua organização.')
  }

  return data.organizacao_id
}

/**
 * Nome de arquivo sem colisão e sem depender do nome original.
 *
 * Nome vindo do celular costuma ser "IMG_0042.jpg" e repete entre aparelhos;
 * além disso pode conter acento e espaço, que complicam o endereço.
 */
function gerarNomeArquivo(extensao = 'jpg'): string {
  const aleatorio = crypto.randomUUID()

  return `${aleatorio}.${extensao}`
}

interface ResultadoEnvio {
  caminho: string
  tamanhoBytes: number
}

async function enviar(
  balde: string,
  arquivo: File,
  compressao: OpcoesCompressao,
): Promise<ResultadoEnvio> {
  const organizacaoId = await organizacaoAtual()
  const comprimido = await comprimirImagem(arquivo, compressao)
  const caminho = `${organizacaoId}/${gerarNomeArquivo()}`

  const { error } = await supabase.storage
    .from(balde)
    .upload(caminho, comprimido, {
      contentType: 'image/jpeg',
      upsert: false,
    })

  if (error) {
    throw new Error(`Falha ao enviar a imagem: ${error.message}`)
  }

  return { caminho, tamanhoBytes: comprimido.size }
}

export function enviarFotoSobra(arquivo: File): Promise<ResultadoEnvio> {
  return enviar(BALDE_FOTOS, arquivo, COMPRESSAO_FOTO)
}

export function enviarDesenhoTecnico(arquivo: File): Promise<ResultadoEnvio> {
  return enviar(BALDE_DESENHOS, arquivo, COMPRESSAO_DESENHO)
}

/**
 * Foto do perfil real.
 *
 * Usa a compressão do desenho, não a da sobra: a foto do perfil serve para
 * comparar detalhe de encaixe e tom do acabamento, e precisa de mais
 * resolução do que a foto de uma ponta na prateleira.
 */
export function enviarFotoPerfil(arquivo: File): Promise<ResultadoEnvio> {
  return enviar(BALDE_FOTOS_PERFIL, arquivo, COMPRESSAO_DESENHO)
}

/**
 * Retrato do colaborador.
 *
 * Compressão de foto comum, não a de desenho: aqui ninguém vai dar zoom
 * procurando cota — a imagem é vista pequena, ao lado do nome.
 */
export function enviarFotoColaborador(arquivo: File): Promise<ResultadoEnvio> {
  return enviar(BALDE_FOTOS_COLABORADOR, arquivo, COMPRESSAO_FOTO)
}

export function enviarFotoProduto(arquivo: File): Promise<ResultadoEnvio> {
  return enviar(BALDE_IMAGENS_PRODUTO, arquivo, COMPRESSAO_FOTO)
}

/**
 * Desenho do produto, com a compressão dos desenhos técnicos.
 *
 * Mais resolução que a foto: aqui há cota para ler, e quem lê está com a
 * peça na bancada dando zoom. Comprimir como foto comum apagaria justamente
 * o número.
 */
export function enviarDesenhoProduto(arquivo: File): Promise<ResultadoEnvio> {
  return enviar(BALDE_IMAGENS_PRODUTO, arquivo, COMPRESSAO_DESENHO)
}

/**
 * Gera o link temporário para exibir uma imagem de balde privado.
 *
 * Devolve `null` em vez de lançar erro: uma imagem que sumiu não pode
 * derrubar a tela inteira — o cadastro continua válido sem ela.
 */
export async function obterLinkTemporario(
  balde: string,
  caminho: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(balde)
    .createSignedUrl(caminho, VALIDADE_LINK_SEGUNDOS)

  if (error || !data) {
    console.error('Não foi possível gerar o link da imagem:', error?.message)
    return null
  }

  return data.signedUrl
}

/** Vários links de uma vez, para galerias — uma ida ao servidor em vez de N. */
export async function obterLinksTemporarios(
  balde: string,
  caminhos: readonly string[],
): Promise<Map<string, string>> {
  const mapa = new Map<string, string>()

  if (caminhos.length === 0) return mapa

  const { data, error } = await supabase.storage
    .from(balde)
    .createSignedUrls([...caminhos], VALIDADE_LINK_SEGUNDOS)

  if (error || !data) {
    console.error(
      'Não foi possível gerar os links das imagens:',
      error?.message,
    )
    return mapa
  }

  for (const item of data) {
    if (item.signedUrl && item.path) {
      mapa.set(item.path, item.signedUrl)
    }
  }

  return mapa
}

export async function apagarImagem(
  balde: string,
  caminho: string,
): Promise<void> {
  const { error } = await supabase.storage.from(balde).remove([caminho])

  if (error) {
    throw new Error(`Falha ao apagar a imagem: ${error.message}`)
  }
}
