import { useEffect, useRef, useState } from 'react'
import { BrowserQRCodeReader } from '@zxing/browser'
import { CameraOff, Keyboard, Loader2 } from 'lucide-react'
import { Botao } from './ui/Botao'
import { Modal } from './ui/Modal'

interface PropsLeitorQrCode {
  aberto: boolean
  aoFechar: () => void
  aoLer: (codigo: string) => void
}

type EstadoCamera = 'iniciando' | 'lendo' | 'sem-permissao' | 'indisponivel'

/**
 * Leitura de QR Code pela câmera.
 *
 * Três cuidados que decidem se isto é útil ou irritante no depósito:
 *
 * 1. **Sempre há saída pelo teclado.** Câmera falha por motivos fora do nosso
 *    controle — permissão negada, lente suja, escuro, aparelho sem câmera
 *    traseira. Um leitor que prende a pessoa numa tela pedindo permissão é
 *    pior do que nenhum leitor. O campo de digitação fica visível o tempo
 *    todo, não escondido atrás de um "tentar outro método".
 *
 * 2. **Câmera traseira por padrão** (`environment`). A frontal enquadra o
 *    rosto de quem segura o celular, não a etiqueta na prateleira.
 *
 * 3. **A câmera é desligada ao fechar.** Sem isso a luz do aparelho fica
 *    acesa e a bateria drena — e num depósito ninguém tem tomada por perto.
 */
export function LeitorQrCode({ aberto, aoFechar, aoLer }: PropsLeitorQrCode) {
  const video = useRef<HTMLVideoElement>(null)
  const controles = useRef<{ stop: () => void } | null>(null)
  const [estado, setEstado] = useState<EstadoCamera>('iniciando')
  const [digitado, setDigitado] = useState('')

  useEffect(() => {
    if (!aberto) return

    let cancelado = false
    const leitor = new BrowserQRCodeReader()

    async function iniciar() {
      const elemento = video.current

      if (!elemento) return

      if (!navigator.mediaDevices?.getUserMedia) {
        setEstado('indisponivel')
        return
      }

      try {
        const resultado = await leitor.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          elemento,
          (leitura) => {
            if (leitura && !cancelado) {
              aoLer(leitura.getText().trim())
            }
          },
        )

        if (cancelado) {
          resultado.stop()
          return
        }

        controles.current = resultado
        setEstado('lendo')
      } catch (e) {
        if (cancelado) return

        // NotAllowedError é recusa de permissão; o resto é câmera ausente,
        // ocupada por outro aplicativo ou bloqueada por falta de HTTPS.
        const nome = e instanceof Error ? e.name : ''
        setEstado(nome === 'NotAllowedError' ? 'sem-permissao' : 'indisponivel')
      }
    }

    void iniciar()

    return () => {
      cancelado = true
      controles.current?.stop()
      controles.current = null
      setEstado('iniciando')
    }
  }, [aberto, aoLer])

  function enviarDigitado() {
    const codigo = digitado.trim()

    if (codigo !== '') {
      aoLer(codigo.toUpperCase())
      setDigitado('')
    }
  }

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Ler código">
      <div className="flex flex-col gap-4">
        {estado !== 'sem-permissao' && estado !== 'indisponivel' && (
          <div className="bg-grafite-900 relative overflow-hidden rounded-xl">
            <video
              ref={video}
              className="aspect-square w-full object-cover"
              playsInline
              muted
            />

            {estado === 'iniciando' && (
              <div className="absolute inset-0 flex items-center justify-center gap-2 text-white">
                <Loader2 aria-hidden="true" className="size-5 animate-spin" />
                Abrindo a câmera…
              </div>
            )}

            {estado === 'lendo' && (
              <>
                {/* Moldura de mira: sem ela, a pessoa não sabe onde apontar. */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-[18%] rounded-xl border-4 border-white/70"
                />
                <p className="absolute inset-x-0 bottom-2 text-center text-sm text-white">
                  Aponte para o código da etiqueta
                </p>
              </>
            )}
          </div>
        )}

        {estado === 'sem-permissao' && (
          <div className="bg-atencao-50 text-atencao-700 flex gap-3 rounded-xl p-4">
            <CameraOff aria-hidden="true" className="size-5 shrink-0" />
            <p className="text-sm">
              <strong>Acesso à câmera negado.</strong> Libere a câmera nas
              configurações do navegador, ou digite o código abaixo.
            </p>
          </div>
        )}

        {estado === 'indisponivel' && (
          <div className="bg-atencao-50 text-atencao-700 flex gap-3 rounded-xl p-4">
            <CameraOff aria-hidden="true" className="size-5 shrink-0" />
            <p className="text-sm">
              <strong>Câmera indisponível.</strong> Pode estar em uso por outro
              aplicativo, ou o endereço não é seguro. Digite o código abaixo.
            </p>
          </div>
        )}

        {/* Sempre presente, nunca escondido atrás de um "outro método". */}
        <div className="border-borda flex flex-col gap-2 border-t pt-4">
          <div className="text-texto-suave flex items-center gap-2 text-sm">
            <Keyboard aria-hidden="true" className="size-4" />
            Ou digite o código
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              aria-label="Código da sobra"
              value={digitado}
              onChange={(e) => setDigitado(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  enviarDigitado()
                }
              }}
              placeholder="SB-4K2P"
              autoCapitalize="characters"
              autoCorrect="off"
              spellCheck={false}
              className="border-borda bg-superficie min-h-12 flex-1 rounded-xl border-2 px-4 font-mono text-base uppercase"
            />
            <Botao
              type="button"
              onClick={enviarDigitado}
              disabled={digitado.trim() === ''}
            >
              Buscar
            </Botao>
          </div>
        </div>
      </div>
    </Modal>
  )
}
