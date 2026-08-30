/**
 * A senha do RePerfil virou só números — 6 a 8 dígitos, como um PIN.
 *
 * ── POR QUE ─────────────────────────────────────────────────────────────
 *
 * Quem digita a senha está no depósito, no celular, às vezes de luva ou com
 * a mão suja — um teclado numérico grande erra muito menos do que um
 * teclado completo tentando acertar maiúscula, símbolo e letra parecida com
 * a vizinha. A troca é uma senha mais fácil de digitar certo por uma menos
 * resistente a adivinhação — decisão do dono do sistema, não deste código.
 *
 * ── SÓ VALE PARA SENHA NOVA ───────────────────────────────────────────────
 *
 * A tela de entrada (`Entrar.tsx`) não usa nada daqui: quem já tinha senha
 * de letras de antes da mudança continua entrando com ela. Só os três
 * lugares que CRIAM ou TROCAM senha (`CriarEmpresa`, `PrimeiroAcesso`,
 * `DefinirSenha`) aplicam a regra nova — coerente com o mínimo do painel do
 * Supabase (Authentication → Providers → Email → "Minimum password
 * length"), que continua 6.
 */
export const TAMANHO_MINIMO_SENHA = 6
export const TAMANHO_MAXIMO_SENHA = 8

/**
 * Frase pronta para mostrar, ou `null` quando a senha já serve.
 *
 * Confere o dígito antes do tamanho: uma senha com letra E curta demais
 * devia reclamar do dígito primeiro — é a regra mais fácil de entender e
 * corrigir de cara, já que o campo normalmente já barra a letra sozinho (ver
 * `apenasDigitosSenha`) e só chega aqui torta se vier de fora do campo
 * (colar, autocompletar do navegador).
 */
export function erroSenha(senha: string): string | null {
  if (!/^\d*$/.test(senha)) {
    return 'A senha só pode ter números — nada de letra ou símbolo.'
  }

  if (
    senha.length < TAMANHO_MINIMO_SENHA ||
    senha.length > TAMANHO_MAXIMO_SENHA
  ) {
    return `A senha precisa ter entre ${TAMANHO_MINIMO_SENHA} e ${TAMANHO_MAXIMO_SENHA} números.`
  }

  return null
}

/**
 * Filtra o que não é dígito e trava no tamanho máximo — para o `onChange`
 * do campo, corrigindo o toque errado (ou o colar de algo que não é só
 * número) na hora, em vez de deixar aparecer o erro só no envio.
 */
export function apenasDigitosSenha(valor: string): string {
  return valor.replace(/\D/g, '').slice(0, TAMANHO_MAXIMO_SENHA)
}
