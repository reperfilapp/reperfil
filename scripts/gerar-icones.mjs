/**
 * Gera os ícones do aplicativo a partir de `public/logo.png`.
 *
 * Decisões, para quem for mexer depois:
 *
 * • Os ícones usam o símbolo RP COM as linhas de cota, mas sem o texto. As
 *   cotas se sobrepõem ao monograma na horizontal, então não há recorte
 *   retangular que as remova: cortar pelo meio deixa tocos soltos, que
 *   parecem defeito. Melhor incluí-las inteiras, com as setas das pontas,
 *   para lerem como parte do desenho.
 *
 * • O texto fica de fora. No lançador do celular o ícone aparece com cerca
 *   de 48 px, onde "Gestão de corte e sobras" vira uma mancha.
 *
 * • Fundo branco sólido, não transparente. Ícone transparente sobre papel de
 *   parede escuro no Android deixa o traço azul-marinho ilegível.
 *
 * • O ícone "maskable" leva 20% de folga em volta. O Android recorta o ícone
 *   em círculo, losango ou "squircle" conforme o aparelho, e sem essa margem
 *   as pontas do RP são cortadas.
 *
 * Uso: npm run icones
 */
import sharp from 'sharp'
import fs from 'node:fs'

const ORIGEM = 'public/logo.png'
const DESTINO = 'public/icones'

/**
 * Recorte do símbolo, medido na imagem original (992x1081) pelo script de
 * análise de conteúdo — não são valores chutados. Se a logo for substituída,
 * rode a análise de novo antes de confiar nestes números.
 */
const SIMBOLO = { left: 94, top: 39, width: 810, height: 705 }

/**
 * Recorte alternativo, fechado nas letras, para os favicons.
 *
 * A 16 ou 32 px o desenho completo vira mancha: as linhas de cota e a régua
 * da seta têm poucos pixels de espessura e somem. Fechar nas letras aumenta
 * o traço que sobra e mantém o "RP" reconhecível na aba do navegador.
 *
 * Mesmo assim, 16 px é apertado para esta marca. Se o resultado incomodar, o
 * caminho certo é uma versão simplificada do logotipo desenhada em vetor,
 * não um recorte melhor — nenhum recorte resolve.
 */
const LETRAS = { left: 255, top: 130, width: 550, height: 525 }

/** Tamanhos exigidos por PWA, Android e navegadores. */
const TAMANHOS = [
  { arquivo: 'icone-192.png', tamanho: 192, folga: 0.06 },
  { arquivo: 'icone-512.png', tamanho: 512, folga: 0.06 },
  { arquivo: 'icone-maskable-192.png', tamanho: 192, folga: 0.2 },
  { arquivo: 'icone-maskable-512.png', tamanho: 512, folga: 0.2 },
  { arquivo: 'apple-touch-icon.png', tamanho: 180, folga: 0.08 },
  { arquivo: 'favicon-32.png', tamanho: 32, folga: 0.02, recorte: LETRAS },
  { arquivo: 'favicon-16.png', tamanho: 16, folga: 0.02, recorte: LETRAS },
]

const BRANCO = { r: 255, g: 255, b: 255, alpha: 1 }

fs.mkdirSync(DESTINO, { recursive: true })

/** Recorta a origem e achata sobre branco. */
async function recortar(area) {
  return sharp(ORIGEM).extract(area).flatten({ background: BRANCO }).toBuffer()
}

const simbolo = await recortar(SIMBOLO)
const letras = await recortar(LETRAS)

for (const { arquivo, tamanho, folga, recorte } of TAMANHOS) {
  const base = recorte === LETRAS ? letras : simbolo
  const area = Math.round(tamanho * (1 - folga * 2))

  await sharp(base)
    .resize(area, area, { fit: 'contain', background: BRANCO })
    .extend({
      top: Math.round((tamanho - area) / 2),
      bottom: tamanho - area - Math.round((tamanho - area) / 2),
      left: Math.round((tamanho - area) / 2),
      right: tamanho - area - Math.round((tamanho - area) / 2),
      background: BRANCO,
    })
    .png()
    .toFile(`${DESTINO}/${arquivo}`)

  console.log(`gerado ${DESTINO}/${arquivo} (${tamanho}x${tamanho})`)
}

// Versão só do símbolo, em alta, para uso dentro da interface.
await sharp(simbolo)
  .resize(512, null, { fit: 'contain' })
  .png()
  .toFile('public/marca-rp.png')

console.log('gerado public/marca-rp.png')
