import { useId } from 'react'
import { Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utilitarios'
import {
  interpretarMedidaDigitada,
  validarComprimento,
  formatarComprimento,
} from '@/dominio/medidas'
import { UNIDADES_MEDIDA, type UnidadeMedida } from '@/config/aplicacao'

interface PropsCampoMedida {
  rotulo: string
  /**
   * Maior comprimento aceito, em milímetros. Informar a barra do perfil
   * escolhido, quando houver: sobra maior que a barra de origem não existe.
   */
  maximoMm?: number
  /** Texto cru digitado. O componente não guarda estado próprio. */
  texto: string
  unidade: UnidadeMedida
  aoMudarTexto: (texto: string) => void
  aoMudarUnidade: (unidade: UnidadeMedida) => void
  autoFocus?: boolean
}

/**
 * Passo dos botões de mais e menos, por unidade.
 *
 * Em milímetros o passo é 10: peça de alumínio não varia de 1 em 1 mm na
 * prática, e chegar a 1.800 de dez em dez já é longo demais — de um em um
 * seria inútil. Em centímetro e metro, 1 é o passo natural.
 */
const PASSO: Record<UnidadeMedida, number> = { mm: 10, cm: 1, m: 1 }

/**
 * Casas decimais que cada unidade precisa para não perder milímetro.
 * Em metros, 1 mm é 0,001; em centímetros, 0,1.
 */
const CASAS: Record<UnidadeMedida, number> = { mm: 0, cm: 1, m: 3 }

/**
 * Aplica o passo ao valor digitado.
 *
 * O arredondamento é obrigatório: 1,8 + 1 dá 2.8000000000000003 em ponto
 * flutuante, e sem tratar isso o campo passaria a exibir esse número.
 * Depois, os zeros à direita são removidos — ninguém escreve "2,800 m".
 */
function aplicarPasso(
  texto: string,
  unidade: UnidadeMedida,
  direcao: 1 | -1,
): string {
  const atual = Number(texto.trim().replace(',', '.'))
  const base = Number.isFinite(atual) ? atual : 0
  const bruto = base + PASSO[unidade] * direcao

  if (bruto <= 0) return ''

  const arredondado = Number(bruto.toFixed(CASAS[unidade]))

  return String(arredondado).replace('.', ',')
}

/**
 * Entrada de comprimento com escolha de unidade.
 *
 * Decisões que existem para evitar peça cortada errada:
 *
 * 1. A unidade é escolhida por botões grandes, não por menu. No depósito, de
 *    luva, abrir menu e acertar item pequeno é onde o erro acontece.
 *
 * 2. O valor convertido aparece embaixo, sempre. Quem digita "1800" com a
 *    unidade em metros vê na hora que isso daria 1.800 metros, e corrige
 *    antes de gravar.
 *
 * 3. Botões de mais e menos, para ajustar sem abrir o teclado — útil quando
 *    a medida sai quebrada e se quer arredondar.
 *
 * O componente é totalmente controlado — não guarda o texto internamente. A
 * versão anterior guardava, e o resultado foi um bug real: ao limpar o
 * comprimento após salvar, o pai zerava o valor mas o texto continuava na
 * tela, e o campo passava a exibir "digite apenas números" sobre um número
 * perfeitamente válido.
 */
export function CampoMedida({
  rotulo,
  maximoMm,
  texto,
  unidade,
  aoMudarTexto,
  aoMudarUnidade,
  autoFocus = false,
}: PropsCampoMedida) {
  const idCampo = useId()
  const idAjuda = `${idCampo}-ajuda`

  const valorMm = interpretarMedidaDigitada(texto, unidade)
  const validacao =
    valorMm === null ? null : validarComprimento(valorMm, maximoMm)
  const erro =
    validacao !== null && !validacao.valido ? validacao.mensagem : undefined
  const textoNaoNumerico = texto.trim() !== '' && valorMm === null
  const invalido = erro !== undefined || textoNaoNumerico

  const classeBotao =
    'border-borda bg-superficie flex min-h-16 w-16 shrink-0 items-center ' +
    'justify-center rounded-xl border-2 disabled:opacity-40'

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={idCampo} className="font-medium">
        {rotulo}
      </label>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => aoMudarTexto(aplicarPasso(texto, unidade, -1))}
          disabled={texto.trim() === ''}
          aria-label={`Diminuir ${PASSO[unidade]} ${unidade}`}
          className={classeBotao}
        >
          <Minus aria-hidden="true" className="size-6" />
        </button>

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
            'bg-superficie min-h-16 min-w-0 flex-1 rounded-xl border-2 px-2 text-center text-2xl font-semibold tabular-nums',
            invalido ? 'border-erro-500' : 'border-borda',
          )}
        />

        <button
          type="button"
          onClick={() => aoMudarTexto(aplicarPasso(texto, unidade, 1))}
          aria-label={`Aumentar ${PASSO[unidade]} ${unidade}`}
          className={classeBotao}
        >
          <Plus aria-hidden="true" className="size-6" />
        </button>
      </div>

      {/* A unidade em linha própria: com os botões de passo na mesma linha,
          os alvos ficariam pequenos demais para uso com luva. */}
      <div
        role="group"
        aria-label="Unidade da medida"
        className="grid grid-cols-3 gap-2"
      >
        {UNIDADES_MEDIDA.map((opcao) => (
          <button
            key={opcao}
            type="button"
            onClick={() => aoMudarUnidade(opcao)}
            aria-pressed={unidade === opcao}
            className={cn(
              'min-h-12 rounded-xl border-2 font-semibold',
              unidade === opcao
                ? 'border-acao-600 bg-acao-600 text-white'
                : 'border-borda bg-superficie text-texto-suave',
            )}
          >
            {opcao}
          </button>
        ))}
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
