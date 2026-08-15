import { useId } from 'react'
import { cn } from '@/lib/utilitarios'
import {
  interpretarMedidaDigitada,
  validarComprimento,
  formatarComprimento,
} from '@/dominio/medidas'
import { UNIDADES_MEDIDA, type UnidadeMedida } from '@/config/aplicacao'

interface PropsCampoMedida {
  rotulo: string
  /** Texto cru digitado. O componente não guarda estado próprio. */
  texto: string
  unidade: UnidadeMedida
  aoMudarTexto: (texto: string) => void
  aoMudarUnidade: (unidade: UnidadeMedida) => void
  autoFocus?: boolean
}

/**
 * Entrada de comprimento com escolha de unidade.
 *
 * Três decisões que existem para evitar peça cortada errada:
 *
 * 1. A unidade é escolhida por botões grandes, não por menu. No depósito, de
 *    luva, abrir menu e acertar item pequeno é onde o erro acontece.
 *
 * 2. O valor convertido aparece embaixo, sempre. Quem digita "1800" com a
 *    unidade em metros vê na hora que isso daria 1.800 metros, e corrige
 *    antes de gravar.
 *
 * 3. `inputMode="decimal"` abre o teclado numérico com vírgula no celular.
 *
 * O componente é totalmente controlado — não guarda o texto internamente. A
 * versão anterior guardava, e o resultado foi um bug real: ao limpar o
 * comprimento após salvar, o pai zerava o valor mas o texto continuava na
 * tela, e o campo passava a exibir "digite apenas números" sobre um número
 * perfeitamente válido. Duas fontes de verdade para o mesmo dado sempre
 * divergem em algum caminho.
 */
export function CampoMedida({
  rotulo,
  texto,
  unidade,
  aoMudarTexto,
  aoMudarUnidade,
  autoFocus = false,
}: PropsCampoMedida) {
  const idCampo = useId()
  const idAjuda = `${idCampo}-ajuda`

  const valorMm = interpretarMedidaDigitada(texto, unidade)
  const validacao = valorMm === null ? null : validarComprimento(valorMm)
  const erro =
    validacao !== null && !validacao.valido ? validacao.mensagem : undefined
  const textoNaoNumerico = texto.trim() !== '' && valorMm === null
  const invalido = erro !== undefined || textoNaoNumerico

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={idCampo} className="font-medium">
        {rotulo}
      </label>

      <div className="flex gap-2">
        <input
          id={idCampo}
          type="text"
          inputMode="decimal"
          autoFocus={autoFocus}
          value={texto}
          onChange={(e) => aoMudarTexto(e.target.value)}
          aria-invalid={invalido}
          aria-describedby={idAjuda}
          placeholder="0"
          className={cn(
            'bg-superficie min-h-16 flex-1 rounded-xl border-2 px-4 text-2xl font-semibold tabular-nums',
            invalido ? 'border-erro-500' : 'border-borda',
          )}
        />

        <div
          role="group"
          aria-label="Unidade da medida"
          className="flex shrink-0 gap-1"
        >
          {UNIDADES_MEDIDA.map((opcao) => (
            <button
              key={opcao}
              type="button"
              onClick={() => aoMudarUnidade(opcao)}
              aria-pressed={unidade === opcao}
              className={cn(
                'min-h-16 w-14 rounded-xl border-2 font-semibold',
                unidade === opcao
                  ? 'border-acao-600 bg-acao-600 text-white'
                  : 'border-borda bg-superficie text-texto-suave',
              )}
            >
              {opcao}
            </button>
          ))}
        </div>
      </div>

      {/* Confirmação do valor entendido. É aqui que o erro de vírgula
          aparece, antes de virar peça cortada errada. */}
      <p
        id={idAjuda}
        role={invalido ? 'alert' : undefined}
        className={cn(
          'text-sm',
          invalido ? 'text-erro-600' : 'text-texto-suave',
        )}
      >
        {textoNaoNumerico
          ? 'Digite apenas números.'
          : erro !== undefined
            ? erro
            : valorMm !== null
              ? `Será gravado como ${formatarComprimento(valorMm)}`
              : 'Informe o comprimento da peça.'}
      </p>
    </div>
  )
}
