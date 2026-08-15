import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'
import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

/**
 * Identificação da versão, gravada no código no momento do build.
 *
 * São três informações, porque cada uma responde uma pergunta diferente:
 *
 *   versao   "que etapa do projeto é esta?"  — vem do package.json
 *   build    "meu celular está no build de hoje?" — data e hora do build
 *   commit   "exatamente qual código é este?" — hash curto do commit
 *
 * O número de build é a data em formato compacto, e não um contador: ele
 * sempre cresce, funciona igual na sua máquina e na Vercel, e não depende do
 * histórico do Git — que a Vercel clona raso, então contar commits lá daria
 * número errado.
 */
function identificarVersao() {
  const pacote = JSON.parse(readFileSync('./package.json', 'utf8')) as {
    version: string
  }

  const agora = new Date()
  const doisDigitos = (n: number) => String(n).padStart(2, '0')

  const build =
    `${agora.getFullYear()}` +
    `${doisDigitos(agora.getMonth() + 1)}` +
    `${doisDigitos(agora.getDate())}.` +
    `${doisDigitos(agora.getHours())}${doisDigitos(agora.getMinutes())}`

  // Na Vercel o hash vem por variável de ambiente; na máquina local, do Git.
  let commit = process.env['VERCEL_GIT_COMMIT_SHA']?.slice(0, 7) ?? ''

  if (commit === '') {
    try {
      commit = execSync('git rev-parse --short HEAD').toString().trim()
    } catch {
      // Sem Git disponível (build a partir de um zip, por exemplo).
      commit = 'local'
    }
  }

  return {
    versao: pacote.version,
    build,
    commit,
    dataBuild: agora.toISOString(),
  }
}

const VERSAO = identificarVersao()

export default defineConfig({
  plugins: [react(), tailwindcss()],
  define: {
    __VERSAO__: JSON.stringify(VERSAO.versao),
    __BUILD__: JSON.stringify(VERSAO.build),
    __COMMIT__: JSON.stringify(VERSAO.commit),
    __DATA_BUILD__: JSON.stringify(VERSAO.dataBuild),
  },
  server: {
    // Expõe o servidor na rede local, para abrir o app no celular durante o
    // desenvolvimento. Só vale dentro do Wi-Fi — não é acesso pela internet.
    host: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/testes/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/dominio/**/*.ts'],
    },
  },
})
