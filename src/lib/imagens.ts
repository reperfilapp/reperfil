/**
 * Preparo de imagens antes do envio.
 *
 * POR QUE ISTO EXISTE: a câmera de um celular atual produz arquivos de 3 a
 * 8 MB. No 4G de um galpão — que costuma ser péssimo, com paredes de alvenaria
 * e telha metálica — enviar isso leva dezenas de segundos e o cadastro parece
 * travado. Comprimir no aparelho antes de subir transforma 6 MB em cerca de
 * 250 KB, e o envio passa a ser quase instantâneo.
 *
 * A perda de qualidade é irrelevante para o uso: a foto serve para reconhecer
 * a peça na prateleira e conferir o estado de conservação, não para impressão.
 * O desenho técnico usa limites maiores, porque nele a cota precisa continuar
 * legível com zoom.
 */

export interface OpcoesCompressao {
  /** Maior dimensão permitida, em pixels. */
  ladoMaximo: number
  /** Qualidade do JPEG, de 0 a 1. */
  qualidade: number
}

/** Foto da peça: serve para reconhecer, não para medir. */
export const COMPRESSAO_FOTO: OpcoesCompressao = {
  ladoMaximo: 1600,
  qualidade: 0.8,
}

/** Desenho técnico: a cota em milímetro precisa sobreviver ao zoom. */
export const COMPRESSAO_DESENHO: OpcoesCompressao = {
  ladoMaximo: 2400,
  qualidade: 0.9,
}

/** Tipos que os baldes do Storage aceitam. */
const TIPOS_ACEITOS = ['image/jpeg', 'image/png', 'image/webp']

export function ehImagemAceita(arquivo: File): boolean {
  return TIPOS_ACEITOS.includes(arquivo.type)
}

/**
 * Reduz e recomprime a imagem, devolvendo um JPEG.
 *
 * Usa `createImageBitmap`, que decodifica fora da linha principal e não trava
 * a interface enquanto processa — perceptível em celular modesto, que é
 * justamente o aparelho que anda no depósito.
 *
 * A orientação EXIF é respeitada pelo navegador ao criar o bitmap, então a
 * foto tirada de lado não sai deitada.
 */
export async function comprimirImagem(
  arquivo: File,
  opcoes: OpcoesCompressao,
): Promise<Blob> {
  if (!ehImagemAceita(arquivo)) {
    throw new Error('Formato não aceito. Envie JPEG, PNG ou WebP.')
  }

  const bitmap = await createImageBitmap(arquivo, {
    imageOrientation: 'from-image',
  })

  const maiorLado = Math.max(bitmap.width, bitmap.height)
  const escala =
    maiorLado > opcoes.ladoMaximo ? opcoes.ladoMaximo / maiorLado : 1

  const largura = Math.round(bitmap.width * escala)
  const altura = Math.round(bitmap.height * escala)

  const tela = document.createElement('canvas')
  tela.width = largura
  tela.height = altura

  const contexto = tela.getContext('2d')

  if (!contexto) {
    bitmap.close()
    throw new Error('Não foi possível processar a imagem neste navegador.')
  }

  // Fundo branco: PNG com transparência viraria preto ao converter para JPEG.
  contexto.fillStyle = '#ffffff'
  contexto.fillRect(0, 0, largura, altura)
  contexto.drawImage(bitmap, 0, 0, largura, altura)
  bitmap.close()

  const blob = await new Promise<Blob | null>((resolver) => {
    tela.toBlob(resolver, 'image/jpeg', opcoes.qualidade)
  })

  if (!blob) {
    throw new Error('Não foi possível comprimir a imagem.')
  }

  return blob
}

/** Formata bytes para leitura: 262144 vira "256 KB". */
export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`

  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} KB`
  }

  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}
