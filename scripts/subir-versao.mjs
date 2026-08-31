/**
 * Sobe o número de versão em `package.json`.
 *
 * Uso:
 *   npm run versao:correcao   0.5.0 → 0.5.1   (correção de defeito)
 *   npm run versao:etapa      0.5.1 → 0.6.0   (etapa concluída)
 *   npm run versao:fase       0.6.0 → 1.0.0   (fase concluída)
 *
 * O número de BUILD não é mexido aqui: ele é a data e hora do build, e
 * cresce sozinho a cada publicação. Este script existe só para marcar
 * mudanças com significado — quem lê "0.6.0" entende que uma etapa fechou,
 * o que nenhum contador automático conseguiria expressar.
 */
import fs from 'node:fs'

const TIPOS = { correcao: 2, etapa: 1, fase: 0 }

const tipo = process.argv[2]

if (!(tipo in TIPOS)) {
  console.error(
    `Tipo inválido: "${tipo ?? ''}". Use correcao, etapa ou fase.`,
  )
  process.exit(1)
}

const caminho = './package.json'
const pacote = JSON.parse(fs.readFileSync(caminho, 'utf8'))
const partes = pacote.version.split('.').map(Number)

if (partes.length !== 3 || partes.some(Number.isNaN)) {
  console.error(`Versão atual inválida em package.json: ${pacote.version}`)
  process.exit(1)
}

const posicao = TIPOS[tipo]
const anterior = pacote.version

partes[posicao] += 1

// Zera as posições à direita: 0.5.3 com etapa vira 0.6.0, não 0.6.3.
for (let i = posicao + 1; i < partes.length; i++) {
  partes[i] = 0
}

// Nenhuma posição, fora a primeira ("fase"), passa de 99 — ao estourar,
// soma 1 na posição à esquerda e zera esta: 1.6.99 vira 1.7.00, não
// 1.6.100. A primeira posição fica sem teto: fase é contada à mão e não
// corre o risco de chegar perto de 99.
for (let i = partes.length - 1; i > 0; i--) {
  if (partes[i] > 99) {
    partes[i] = 0
    partes[i - 1] += 1
  }
}

pacote.version = partes.join('.')

fs.writeFileSync(caminho, `${JSON.stringify(pacote, null, 2)}\n`)

console.log(`versão ${anterior} → ${pacote.version}`)
console.log('Lembre de descrever a mudança em docs/versoes.md.')
