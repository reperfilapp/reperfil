/**
 * Executa tarefas do Gradle encontrando o JDK e o Android SDK sozinho.
 *
 * POR QUE ISTO EXISTE: nesta máquina o `java` do PATH é um JRE 8, que executa
 * mas não compila. O JDK 21 está embutido no Android Studio, e o SDK no
 * AppData. Definir `JAVA_HOME` no Windows resolveria — e trocaria o Java
 * padrão de TODOS os programas da máquina, quebrando qualquer um que dependa
 * do 8, sem nenhuma pista de que foi isso.
 *
 * Então o script procura o JDK e o SDK nos lugares conhecidos e os passa
 * apenas para o Gradle. Nada no sistema muda.
 *
 * Uso: node scripts/android.mjs assembleDebug
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import os from 'node:os'

const tarefa = process.argv[2]

if (!tarefa) {
  console.error('Informe a tarefa do Gradle. Ex.: assembleDebug')
  process.exit(1)
}

/** Locais onde um JDK costuma estar, em ordem de preferência. */
function encontrarJdk() {
  // 1. Já definido no ambiente, e válido.
  const doAmbiente = process.env['JAVA_HOME']

  if (doAmbiente && temCompilador(doAmbiente)) {
    return doAmbiente
  }

  const candidatos = [
    'C:\\Program Files\\Android\\Android Studio\\jbr',
    'C:\\Program Files\\Eclipse Adoptium',
    'C:\\Program Files\\Microsoft',
    'C:\\Program Files\\Java',
    '/usr/lib/jvm',
  ]

  for (const base of candidatos) {
    if (!existsSync(base)) continue

    if (temCompilador(base)) return base

    // Pastas como "Program Files/Java" contêm várias versões dentro.
    for (const filho of readdirSync(base)) {
      const caminho = path.join(base, filho)
      if (temCompilador(caminho)) return caminho
    }
  }

  return null
}

function temCompilador(base) {
  return (
    existsSync(path.join(base, 'bin', 'javac.exe')) ||
    existsSync(path.join(base, 'bin', 'javac'))
  )
}

function encontrarSdk() {
  const doAmbiente = process.env['ANDROID_HOME'] ?? process.env['ANDROID_SDK_ROOT']

  if (doAmbiente && existsSync(doAmbiente)) return doAmbiente

  const candidatos = [
    path.join(os.homedir(), 'AppData', 'Local', 'Android', 'Sdk'),
    path.join(os.homedir(), 'Android', 'Sdk'),
    path.join(os.homedir(), 'Library', 'Android', 'sdk'),
  ]

  return candidatos.find((c) => existsSync(c)) ?? null
}

const jdk = encontrarJdk()
const sdk = encontrarSdk()

if (!jdk) {
  console.error(
    'JDK não encontrado. O Android exige JDK 17 ou superior — o Java do\n' +
      'sistema pode ser apenas um JRE, que não compila.\n\n' +
      'A forma mais simples de obter um é instalar o Android Studio, que traz\n' +
      'um JDK embutido. Ver docs/publicacao-play-store.md.',
  )
  process.exit(1)
}

if (!sdk) {
  console.error(
    'Android SDK não encontrado. Instale pelo Android Studio, em\n' +
      'Settings → Languages & Frameworks → Android SDK.',
  )
  process.exit(1)
}

console.log(`JDK: ${jdk}`)
console.log(`SDK: ${sdk}`)
console.log(`Gradle: ${tarefa}\n`)

const pastaAndroid = path.resolve('android')

// Caminho absoluto: com nome relativo, o interpretador de comandos do Windows
// não encontra o arquivo mesmo com o diretório de trabalho correto.
const gradlew = path.join(
  pastaAndroid,
  process.platform === 'win32' ? 'gradlew.bat' : 'gradlew',
)

const resultado = spawnSync(gradlew, [tarefa], {
  cwd: pastaAndroid,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, JAVA_HOME: jdk, ANDROID_HOME: sdk },
})

process.exit(resultado.status ?? 1)
