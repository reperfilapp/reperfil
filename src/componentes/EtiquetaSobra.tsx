import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { Printer } from 'lucide-react'
import { Botao } from './ui/Botao'
import { Modal } from './ui/Modal'
import { formatarComprimento } from '@/dominio/medidas'
import type { SobraDetalhada } from '@/dados/sobras'

interface PropsEtiqueta {
  sobra: SobraDetalhada | null
  aoFechar: () => void
}

/**
 * Etiqueta da sobra, para colar na peça.
 *
 * O QR guarda apenas o código curto (`SB-4K2P`), não um endereço da internet.
 * Duas razões: o código é curto, o que gera um QR de poucos módulos, legível
 * mesmo impresso pequeno, sujo de pó de alumínio ou amassado; e a etiqueta
 * continua funcionando se o endereço do sistema mudar um dia.
 *
 * A `correctionLevel: 'H'` recupera a leitura com até 30% do código
 * danificado — no depósito, etiqueta raspada é o normal, não a exceção.
 *
 * O código também vai impresso em texto grande: quando o QR estiver
 * ilegível, ainda dá para digitar.
 */
export function EtiquetaSobra({ sobra, aoFechar }: PropsEtiqueta) {
  const [qr, setQr] = useState<string | null>(null)

  useEffect(() => {
    if (!sobra) {
      setQr(null)
      return
    }

    let cancelado = false

    void QRCode.toDataURL(sobra.codigo, {
      errorCorrectionLevel: 'H',
      margin: 1,
      width: 320,
      color: { dark: '#1a1a1a', light: '#ffffff' },
    }).then((url) => {
      if (!cancelado) setQr(url)
    })

    return () => {
      cancelado = true
    }
  }, [sobra])

  if (!sobra) return null

  return (
    <Modal aberto={sobra !== null} aoFechar={aoFechar} titulo="Etiqueta">
      <div className="flex flex-col gap-4">
        {/* Área impressa. `id` usado pela folha de estilo de impressão. */}
        <div
          id="etiqueta-impressao"
          className="border-grafite-900 text-grafite-900 rounded-xl border-2 bg-white p-4"
        >
          <div className="flex items-center gap-4">
            {qr ? (
              <img
                src={qr}
                alt={`QR Code da sobra ${sobra.codigo}`}
                className="size-28 shrink-0"
              />
            ) : (
              <div className="bg-grafite-100 size-28 shrink-0 animate-pulse rounded" />
            )}

            <div className="min-w-0 flex-1">
              <p className="font-mono text-2xl leading-none font-bold">
                {sobra.codigo}
              </p>
              <p className="mt-1.5 text-lg leading-tight font-semibold">
                {formatarComprimento(sobra.comprimento_mm)}
              </p>
              <p className="mt-1 truncate text-sm">
                {sobra.modelo?.codigo} · {sobra.acabamento?.nome}
              </p>
              {sobra.localizacao && (
                <p className="truncate text-sm">
                  local: {sobra.localizacao.codigo}
                </p>
              )}
            </div>
          </div>
        </div>

        <p className="text-texto-suave text-sm">
          O QR guarda só o código da peça, então continua válido mesmo que o
          endereço do sistema mude.
        </p>

        <Botao onClick={() => window.print()} tamanho="largura_total">
          <Printer aria-hidden="true" className="size-5" />
          Imprimir etiqueta
        </Botao>
      </div>
    </Modal>
  )
}
