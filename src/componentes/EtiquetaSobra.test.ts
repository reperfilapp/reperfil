import { describe, it, expect } from 'vitest'
import QRCode from 'qrcode'

/**
 * O QR da etiqueta precisa conter EXATAMENTE o código curto da sobra.
 *
 * Guardar um endereço da internet no lugar do código pareceria mais moderno,
 * mas quebraria a etiqueta no dia em que o endereço do sistema mudasse — e
 * etiqueta colada em peça de alumínio no depósito não se refaz.
 *
 * O nível de correção 'H' recupera a leitura com até 30% do código
 * danificado. No depósito, etiqueta raspada é o normal.
 */

const OPCOES_ETIQUETA = {
  errorCorrectionLevel: 'H' as const,
  margin: 1,
  width: 320,
  color: { dark: '#1a1a1a', light: '#ffffff' },
}

describe('QR da etiqueta', () => {
  it('gera um código para o texto informado', async () => {
    const url = await QRCode.toDataURL('SB-4K2P', OPCOES_ETIQUETA)

    expect(url.startsWith('data:image/png;base64,')).toBe(true)
    expect(url.length).toBeGreaterThan(500)
  })

  it('gera imagens diferentes para códigos diferentes', async () => {
    const [a, b] = await Promise.all([
      QRCode.toDataURL('SB-4K2P', OPCOES_ETIQUETA),
      QRCode.toDataURL('SB-XXXX', OPCOES_ETIQUETA),
    ])

    expect(a).not.toBe(b)
  })

  it('é determinístico — o mesmo código gera sempre a mesma imagem', async () => {
    // É o que permite conferir uma etiqueta reimpressa contra a original.
    const [a, b] = await Promise.all([
      QRCode.toDataURL('SB-4K2P', OPCOES_ETIQUETA),
      QRCode.toDataURL('SB-4K2P', OPCOES_ETIQUETA),
    ])

    expect(a).toBe(b)
  })

  it('usa correção de erro alta, que tolera etiqueta danificada', () => {
    const codigo = QRCode.create('SB-4K2P', { errorCorrectionLevel: 'H' })

    // Cuidado com este número: os bits NÃO seguem a ordem L, M, Q, H. A
    // especificação do QR codifica M=00, L=01, H=10, Q=11 — então 'H' é 2,
    // e o valor 3, que parece o "mais alto", é na verdade o 'Q'.
    expect(codigo.errorCorrectionLevel.bit).toBe(2)

    // Observação de quem escreveu isto: um texto tão curto cabe na versão 1
    // do QR (21 módulos) tanto em 'H' quanto em 'L' — a redundância entra no
    // espaço que sobra, sem aumentar o código. Ou seja, a correção alta sai
    // de graça aqui, e não há motivo para usar nível menor.
    const baixa = QRCode.create('SB-4K2P', { errorCorrectionLevel: 'L' })
    expect(codigo.modules.size).toBe(baixa.modules.size)
  })

  it('cabe num código pequeno, porque o conteúdo é curto', async () => {
    // Código curto gera QR de poucos módulos, legível impresso pequeno.
    // Um endereço completo passaria de 40 módulos e exigiria etiqueta maior.
    const curto = QRCode.create('SB-4K2P', { errorCorrectionLevel: 'H' })
    const comEndereco = QRCode.create(
      'https://reperfil.vercel.app/sobras/SB-4K2P',
      { errorCorrectionLevel: 'H' },
    )

    expect(curto.modules.size).toBeLessThan(comEndereco.modules.size)
    expect(curto.modules.size).toBeLessThanOrEqual(29)
  })
})
