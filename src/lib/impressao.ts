import { Capacitor } from '@capacitor/core'
import { Printer } from '@bcyesil/capacitor-plugin-printer'

/**
 * Imprimir — ou salvar em PDF — funcionando nas três plataformas.
 *
 * ── POR QUE NÃO BASTA `window.print()` ───────────────────────────────────
 *
 * No navegador (computador e PWA) ele abre o diálogo de impressão, que traz
 * "Salvar como PDF". Dentro do aplicativo instalado no Android, NÃO: o
 * WebView não implementa impressão, então a chamada não faz nada — nem erro
 * gera. Era o botão que "não acontecia nada" no APK.
 *
 * O plugin resolve chamando o serviço de impressão do próprio Android, o
 * mesmo que o Chrome usa. Ele recebe HTML, e é por isso que esta função
 * existe: montar esse HTML de forma que a folha fique idêntica à do
 * navegador.
 */

/**
 * Todo o CSS da página, em texto.
 *
 * O plugin renderiza o HTML que recebe num WebView limpo, sem as folhas de
 * estilo do aplicativo — sem isto, a folha chegaria lá como texto corrido,
 * já que todo o leiaute vem de classes.
 *
 * Regras de folhas externas (outro domínio) não são legíveis por segurança e
 * são ignoradas; as do RePerfil são do mesmo domínio, e é o que importa.
 */
function cssDaPagina(): string {
  return [...document.styleSheets]
    .map((folha) => {
      try {
        return [...folha.cssRules].map((regra) => regra.cssText).join('\n')
      } catch {
        return ''
      }
    })
    .join('\n')
}

/**
 * Converte uma imagem do próprio aplicativo em `data:` embutido.
 *
 * A logo e a marca d'água são endereços locais — "/logo-otimizada.png". O
 * plugin renderiza o HTML numa página NOVA, sem base de endereço, e ali esse
 * caminho não aponta para lugar nenhum: saía o ícone de imagem quebrada com
 * o texto alternativo ao lado.
 *
 * Embutida no próprio HTML, a imagem não depende de resolver endereço nem de
 * uma segunda ida à rede.
 */
async function embutir(url: string): Promise<string> {
  const resposta = await fetch(url)
  const arquivo = await resposta.blob()

  return new Promise((resolve, reject) => {
    const leitor = new FileReader()

    leitor.onload = () => resolve(String(leitor.result))
    leitor.onerror = () => reject(new Error(`Falha ao ler ${url}`))
    leitor.readAsDataURL(arquivo)
  })
}

/**
 * O HTML da folha, pronto para o plugin.
 *
 * As classes que a escondem da tela saem: no navegador a folha vive fora do
 * campo de visão e só aparece na impressão, mas o que vai para o plugin é
 * uma página nova, onde ela é o conteúdo inteiro e precisa estar visível.
 */
async function htmlDaFolha(elemento: HTMLElement): Promise<string> {
  const copia = elemento.cloneNode(true) as HTMLElement

  copia.classList.remove('fixed', '-left-[9999px]', 'top-0')
  copia.style.position = 'static'
  copia.style.left = '0'

  /*
   * Só as imagens do aplicativo são embutidas. As do produto e dos perfis
   * vêm do armazenamento por endereço completo, que o WebView baixa
   * sozinho — e embuti-las significaria carregar dezenas de fotos dentro do
   * texto do HTML.
   */
  await Promise.all(
    [...copia.querySelectorAll('img')].map(async (img) => {
      const src = img.getAttribute('src') ?? ''

      if (!src.startsWith('/')) return

      try {
        img.setAttribute('src', await embutir(src))
      } catch {
        // Imagem que não carrega não impede a folha de sair: o resto do
        // conteúdo é o que importa na bancada.
        img.remove()
      }
    }),
  )

  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>${cssDaPagina()}</style>
    <style>
      /* O plugin já entrega a página ao serviço de impressão, então o que
         estava sob @media print precisa valer aqui de imediato. */
      body { margin: 0; background: white; color: black; }
      #folha-impressao { position: static !important; left: 0 !important; width: 100% !important; }
      #folha-impressao thead { display: table-header-group; }
    </style>
  </head>
  <body>${copia.outerHTML}</body>
</html>`
}

/**
 * Manda a folha para a impressão, pelo caminho que a plataforma oferece.
 *
 * O nome só é respeitado no aplicativo nativo, onde o plugin o recebe como
 * parâmetro. No navegador não existe API para isso — quem chama define o
 * `document.title` antes, que é o nome sugerido no "Salvar como PDF".
 */
export async function imprimirFolha(
  elemento: HTMLElement,
  nome: string,
): Promise<void> {
  if (!Capacitor.isNativePlatform()) {
    window.print()
    return
  }

  await Printer.print({ content: await htmlDaFolha(elemento), name: nome })
}

/** Se a impressão depende do plugin — usado para saber o que esperar. */
export function imprimeNoNativo(): boolean {
  return Capacitor.isNativePlatform()
}
