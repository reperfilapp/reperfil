import { useRef, useState } from 'react'
import { Camera, ImagePlus, X, Loader2 } from 'lucide-react'
import { formatarTamanho } from '@/lib/imagens'
import { cn } from '@/lib/utilitarios'

interface PropsCampoFoto {
  /** Omitir quando a seção já tem título próprio — rótulo vazio no HTML
   *  atrapalha leitor de tela. */
  rotulo?: string
  ajuda?: string
  /** Chamado com o arquivo escolhido; deve enviar e devolver o caminho. */
  aoEnviar: (
    arquivo: File,
  ) => Promise<{ caminho: string; tamanhoBytes: number }>
  /** Caminho já enviado, se houver. */
  caminho: string | null
  /** Link temporário para pré-visualizar o que já foi enviado. */
  previa: string | null
  aoRemover: () => void
  aoConcluir: (caminho: string) => void
  /**
   * Abre a câmera frontal em vez da traseira.
   *
   * Para retrato de pessoa: com a traseira, quem se fotografa não vê o
   * próprio enquadramento e sai meio rosto na foto.
   */
  cameraFrontal?: boolean
  /** Texto do botão. "Tirar foto" nem sempre é o que se está fazendo. */
  rotuloBotao?: string
}

/**
 * Escolha de uma imagem, por câmera ou galeria.
 *
 * São dois botões separados, e não um só, por um motivo prático: no celular,
 * `capture="environment"` abre a câmera traseira direto, sem passar pelo
 * seletor de arquivos — três toques a menos por peça. Mas no computador esse
 * atributo é ignorado e o usuário precisa da galeria, então o segundo botão
 * cobre os dois casos.
 *
 * O envio acontece na hora da escolha, não no salvamento do formulário: assim
 * a espera pela rede se dilui enquanto a pessoa preenche o resto, em vez de
 * concentrar tudo num clique final que parece travado.
 */
export function CampoFoto({
  rotulo,
  ajuda,
  aoEnviar,
  caminho,
  previa,
  aoRemover,
  aoConcluir,
  cameraFrontal = false,
  rotuloBotao = 'Tirar foto',
}: PropsCampoFoto) {
  const entradaCamera = useRef<HTMLInputElement>(null)
  const entradaGaleria = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [tamanho, setTamanho] = useState<number | null>(null)

  async function escolheu(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0]

    // Limpa o valor para que escolher o MESMO arquivo de novo dispare o evento.
    evento.target.value = ''

    if (!arquivo) return

    setErro(null)
    setEnviando(true)

    try {
      const resultado = await aoEnviar(arquivo)
      setTamanho(resultado.tamanhoBytes)
      aoConcluir(resultado.caminho)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {rotulo && <p className="font-medium">{rotulo}</p>}

      <input
        ref={entradaCamera}
        type="file"
        accept="image/*"
        capture={cameraFrontal ? 'user' : 'environment'}
        onChange={(e) => void escolheu(e)}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
      <input
        ref={entradaGaleria}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={(e) => void escolheu(e)}
        className="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />

      {caminho && previa ? (
        <figure className="border-borda relative overflow-hidden rounded-xl border-2">
          {/* Altura na caixa, não na imagem: o Safari do iPhone corta a
              imagem quando decide a altura antes de saber a proporção. */}
          <div className="bg-superficie-2 h-64 w-full overflow-hidden">
            <img
              src={previa}
              alt="Imagem enviada"
              className="h-full w-full object-contain"
            />
          </div>
          <button
            type="button"
            onClick={() => {
              setTamanho(null)
              aoRemover()
            }}
            aria-label="Remover imagem"
            className="bg-grafite-900/80 absolute top-2 right-2 rounded-full p-2 text-white"
          >
            <X aria-hidden="true" className="size-4" />
          </button>
          {tamanho !== null && (
            <figcaption className="bg-superficie-2 text-texto-suave px-3 py-1.5 text-xs">
              enviada · {formatarTamanho(tamanho)}
            </figcaption>
          )}
        </figure>
      ) : (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => entradaCamera.current?.click()}
            disabled={enviando}
            className={cn(
              'flex min-h-16 flex-1 items-center justify-center gap-2 rounded-xl',
              'border-borda bg-superficie border-2 font-medium disabled:opacity-50',
            )}
          >
            {enviando ? (
              <Loader2 aria-hidden="true" className="size-5 animate-spin" />
            ) : (
              <Camera aria-hidden="true" className="size-5" />
            )}
            {enviando ? 'Enviando…' : rotuloBotao}
          </button>

          <button
            type="button"
            onClick={() => entradaGaleria.current?.click()}
            disabled={enviando}
            aria-label="Escolher da galeria"
            className={cn(
              'flex min-h-16 w-16 items-center justify-center rounded-xl',
              'border-borda bg-superficie border-2 disabled:opacity-50',
            )}
          >
            <ImagePlus aria-hidden="true" className="size-5" />
          </button>
        </div>
      )}

      {erro && (
        <p role="alert" className="text-erro-600 text-sm">
          {erro}
        </p>
      )}

      {!erro && ajuda && <p className="text-texto-suave text-sm">{ajuda}</p>}
    </div>
  )
}
