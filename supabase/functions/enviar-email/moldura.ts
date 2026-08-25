/**
 * Casca visual comum aos e-mails desta função — mesma identidade dos
 * templates em `supabase/emails/` (confirmar-cadastro.html), só que aqueles
 * são colados no painel do Supabase (troca `{{ .SiteURL }}` sozinho) e
 * estes são montados aqui, então o endereço de produção vem fixo.
 */
export const APP_URL = 'https://reperfil.vercel.app'
const LOGO_URL = `${APP_URL}/logo-otimizada.png`

export function moldura(titulo: string, corpoHtml: string): string {
  return `
<meta name="viewport" content="width=device-width, initial-scale=1" />
<table
  role="presentation"
  width="100%"
  cellpadding="0"
  cellspacing="0"
  style="background-color: #f1f5f9; margin: 0; padding: 24px 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;"
>
  <tr>
    <td align="center">
      <table
        role="presentation"
        width="100%"
        cellpadding="0"
        cellspacing="0"
        style="max-width: 480px; background-color: #ffffff; border-radius: 16px; padding: 32px 28px;"
      >
        <tr>
          <td align="center" style="padding-bottom: 8px;">
            <img
              src="${LOGO_URL}"
              alt="RePerfil"
              width="180"
              style="display: block; width: 180px; max-width: 70%; height: auto;"
            />
          </td>
        </tr>
        <tr>
          <td align="center" style="font-size: 13px; color: #64748b; padding-bottom: 24px;">
            RePerfil — Gestão de corte e sobras
          </td>
        </tr>
        <tr>
          <td align="center" style="font-size: 20px; font-weight: bold; color: #0f172a; padding-bottom: 12px;">
            ${titulo}
          </td>
        </tr>
        ${corpoHtml}
      </table>
    </td>
  </tr>
</table>`
}

/**
 * Botão de destaque — alvo generoso, porque muita gente toca no celular.
 *
 * `.trim()` em todas estas funções por um motivo bem específico: sem ele, a
 * linha em branco que sobra na junção de dois blocos concatenados (o `\n`
 * final de um mais o `\n` inicial do outro) vira uma linha só de espaço —
 * e o quoted-printable do e-mail transforma isso num "=20" solto e visível
 * no meio do texto. HTML ignora espaço em branco extra; o codificador de
 * e-mail, não.
 */
export function botao(texto: string, href: string): string {
  return `
        <tr>
          <td align="center" style="padding: 4px 0 24px;">
            <a
              href="${href}"
              style="display: inline-block; background-color: #1e3a8a; color: #ffffff; font-size: 17px; font-weight: bold; text-decoration: none; padding: 16px 32px; border-radius: 12px;"
            >
              ${texto}
            </a>
          </td>
        </tr>`.trim()
}

export function paragrafo(html: string): string {
  return `
        <tr>
          <td style="font-size: 16px; line-height: 1.6; color: #334155; padding-bottom: 24px;">
            ${html}
          </td>
        </tr>`.trim()
}

export function linkTextoAlternativo(href: string): string {
  return `
        <tr>
          <td style="font-size: 14px; line-height: 1.6; color: #64748b; padding-bottom: 8px;">
            Se o botão não funcionar, copie e cole este endereço no navegador:
          </td>
        </tr>
        <tr>
          <td style="font-size: 13px; line-height: 1.5; color: #1e3a8a; word-break: break-all; padding-bottom: 24px;">
            ${href}
          </td>
        </tr>`.trim()
}

export function rodape(html: string): string {
  return `
        <tr>
          <td style="font-size: 14px; line-height: 1.6; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 20px;">
            ${html}
          </td>
        </tr>`.trim()
}
