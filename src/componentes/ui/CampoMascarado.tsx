import { useState } from 'react'
import { CampoTexto } from './CampoTexto'
import {
  formatarCpfCnpj,
  erroCpfCnpj,
  formatarTelefone,
  erroTelefone,
  erroEmail,
} from '@/dominio/documentos'

const MASCARAS = {
  cpf_cnpj: { formatar: formatarCpfCnpj, verificar: erroCpfCnpj },
  telefone: { formatar: formatarTelefone, verificar: erroTelefone },
  // E-mail não tem máscara: qualquer coisa que o campo fizesse com o texto
  // atrapalharia quem digita. Entra aqui só pela conferência ao sair.
  email: { formatar: (v: string) => v, verificar: erroEmail },
} as const

interface PropsCampoMascarado {
  rotulo: string
  tipo: keyof typeof MASCARAS
  /** Valor cru, como está no banco: só os dígitos ou já pontuado. */
  value: string
  /** Recebe o valor JÁ formatado — é ele que vai para o banco. */
  onChange: (valor: string) => void
  ajuda?: string
  disabled?: boolean
}

/**
 * Campo que se formata sozinho e avisa quando o número não existe.
 *
 * ── O ERRO SÓ APARECE AO SAIR DO CAMPO ───────────────────────────────────
 *
 * Validar a cada tecla acusaria "CPF inválido" desde o primeiro dígito, e
 * quem está digitando ficaria olhando um erro vermelho durante todo o
 * preenchimento — treinando a pessoa a ignorar o aviso justamente quando ele
 * passa a valer. Por isso a conferência espera o campo perder o foco.
 *
 * ── O CAMPO NÃO TRAVA ────────────────────────────────────────────────────
 *
 * O aviso não impede salvar. Quem cadastra costuma estar copiando de um
 * papel, e às vezes o papel está errado ou incompleto — travar faria a
 * pessoa inventar um número para conseguir seguir, o que é pior do que
 * deixar o campo vazio.
 */
export function CampoMascarado({
  rotulo,
  tipo,
  value,
  onChange,
  ajuda,
  disabled,
}: PropsCampoMascarado) {
  const { formatar, verificar } = MASCARAS[tipo]
  const [erro, setErro] = useState<string | null>(null)

  return (
    <CampoTexto
      rotulo={rotulo}
      type={tipo === 'email' ? 'email' : 'text'}
      inputMode={tipo === 'email' ? 'email' : 'numeric'}
      autoCapitalize={tipo === 'email' ? 'none' : undefined}
      spellCheck={tipo === 'email' ? false : undefined}
      value={formatar(value)}
      erro={erro ?? undefined}
      ajuda={ajuda}
      disabled={disabled}
      onChange={(e) => {
        // Some assim que a pessoa volta a mexer: manter o vermelho enquanto
        // ela corrige é acusar de novo o erro que está sendo consertado.
        if (erro) setErro(null)
        onChange(formatar(e.target.value))
      }}
      onBlur={(e) => setErro(verificar(e.target.value))}
    />
  )
}
