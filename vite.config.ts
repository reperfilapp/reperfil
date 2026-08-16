import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
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
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['icones/*.png', 'logo.png', 'marca-rp.png'],
      manifest: {
        name: 'RePerfil: Estoque e Orçamento',
        short_name: 'RePerfil',
        description:
          'Controle de sobras de perfis de alumínio e orçamento de esquadrias.',
        lang: 'pt-BR',
        dir: 'ltr',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#ffffff',
        theme_color: '#2b3a5e',
        categories: ['business', 'productivity'],
        icons: [
          {
            src: '/icones/icone-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icones/icone-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icones/icone-maskable-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/icones/icone-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Cadastrar sobra',
            url: '/cadastrar',
            icons: [{ src: '/icones/icone-192.png', sizes: '192x192' }],
          },
          {
            name: 'Procurar sobra',
            url: '/procurar',
            icons: [{ src: '/icones/icone-192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        // Só o esqueleto da aplicação é guardado: HTML, JavaScript, CSS,
        // fontes e ícones. NENHUM dado de estoque.
        globPatterns: ['**/*.{js,css,html,woff2}', 'icones/*.png'],

        /*
         * DECISÃO D3 — o aplicativo não funciona sem conexão.
         *
         * É tentador deixar o service worker guardar as respostas do Supabase:
         * o app abriria instantâneo e "funcionaria" no fundo do galpão. Seria
         * um erro grave. Mostrar uma sobra como disponível depois de outra
         * pessoa tê-la reservado manda o serralheiro até a prateleira atrás de
         * uma peça que não está lá — exatamente o problema que este sistema
         * existe para eliminar.
         *
         * Por isso qualquer requisição ao Supabase é sempre de rede, sem
         * cache. Sem conexão, a tela de aguardando conexão aparece, que é a
         * resposta honesta.
         */
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/.*\.supabase\.co\/.*/i,
            handler: 'NetworkOnly',
          },
        ],

        // Toda navegação cai no index.html, porque o roteamento é no
        // navegador. Exceto as chamadas ao Supabase, tratadas acima.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/],
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        // Desligado em desenvolvimento: service worker guardando arquivo
        // antigo enquanto se edita código é fonte garantida de confusão.
        enabled: false,
      },
    }),
  ],
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
