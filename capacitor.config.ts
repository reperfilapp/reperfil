import type { CapacitorConfig } from '@capacitor/cli'

/**
 * Configuração do aplicativo Android.
 *
 * ── Por que os arquivos vão EMBUTIDOS, e não carregados do servidor ──────
 *
 * Seria possível apontar o aplicativo para https://reperfil.vercel.app e ter
 * atualização instantânea, sem republicar na loja. Duas razões para não
 * fazer isso:
 *
 * 1. A Google Play rejeita aplicativos que são apenas uma janela apontando
 *    para um site — a política exige funcionalidade própria.
 * 2. Uma queda do servidor deixaria o aplicativo com tela branca, em vez da
 *    tela de "aguardando conexão", que ao menos explica o que houve.
 *
 * Os arquivos vêm de `dist/`, gerados por `npm run build`. Rodar
 * `npx cap sync android` copia a versão mais recente para dentro do projeto
 * Android.
 */
const config: CapacitorConfig = {
  appId: 'br.com.reperfil.app',
  appName: 'RePerfil',
  webDir: 'dist',

  android: {
    // Sem isto, o WebView não permite a câmera para leitura de QR Code.
    allowMixedContent: false,
    // O app exige conexão (decisão D3); um indicador de carregamento nativo
    // evita a tela branca enquanto o WebView inicia.
    backgroundColor: '#ffffff',
  },

  plugins: {
    // A barra de status usa o azul-marinho da marca, com ícones claros.
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#2b3a5e',
      overlaysWebView: false,
    },
  },
}

export default config
