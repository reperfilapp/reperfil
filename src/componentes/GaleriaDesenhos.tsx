import { useState } from 'react'
import { Trash2, ZoomIn, X } from 'lucide-react'
import {
  useDesenhosTecnicos,
  useAdicionarDesenho,
  useRemoverDesenho,
} from '@/dados/desenhosTecnicos'
import { enviarDesenhoTecnico } from '@/lib/armazenamento'
import { CampoFoto } from './ui/CampoFoto'
import { Botao } from './ui/Botao'
import type { ModeloPerfil } from '@/tipos/banco'

/**
 * Galeria de desenhos técnicos de um perfil.
 *
 * Serve para o serralheiro conferir, no depósito, se a peça da prateleira é
 * mesmo aquele perfil — comparando a seção real com o desenho cotado, sem ir
 * atrás do catálogo impresso.
 *
 * Por isso o visualizador ampliado existe e não é enfeite: cota em milímetro
 * dentro de uma miniatura de 100 px é ilegível, e a cota é exatamente o que a
 * pessoa foi consultar.
 */
export function GaleriaDesenhos({ modelo }: { modelo: ModeloPerfil }) {
  const { data: desenhos, isPending } = useDesenhosTecnicos(modelo.id)
  const adicionar = useAdicionarDesenho()
  const remover = useRemoverDesenho()

  const [legenda, setLegenda] = useState('')
  const [ampliado, setAmpliado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  async function enviou(caminho: string) {
    setErro(null)

    try {
      await adicionar.mutateAsync({
        modeloPerfilId: modelo.id,
        caminho,
        legenda: legenda.trim() === '' ? null : legenda.trim(),
        ordem: desenhos?.length ?? 0,
      })
      setLegenda('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível gravar.')
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h3 className="font-semibold">Desenhos técnicos</h3>
        <p className="text-texto-suave text-sm">
          Fotos do desenho ou do catálogo, de vários ângulos, com as medidas de
          cada face.
        </p>
      </div>

      {isPending && <p className="text-texto-suave text-sm">Carregando…</p>}

      {desenhos && desenhos.length > 0 && (
        <ul className="grid grid-cols-2 gap-3">
          {desenhos.map((desenho) => (
            <li
              key={desenho.id}
              className="border-borda overflow-hidden rounded-xl border-2"
            >
              {desenho.link ? (
                <button
                  type="button"
                  onClick={() => setAmpliado(desenho.link)}
                  className="relative block w-full"
                  aria-label={`Ampliar ${desenho.legenda ?? 'desenho'}`}
                >
                  <img
                    src={desenho.link}
                    alt={desenho.legenda ?? 'Desenho técnico do perfil'}
                    className="bg-superficie-2 aspect-square w-full object-contain"
                  />
                  <span className="bg-grafite-900/70 absolute right-1.5 bottom-1.5 rounded-full p-1.5 text-white">
                    <ZoomIn aria-hidden="true" className="size-4" />
                  </span>
                </button>
              ) : (
                <div className="bg-superficie-2 text-texto-suave flex aspect-square items-center justify-center text-xs">
                  imagem indisponível
                </div>
              )}

              <div className="flex items-center gap-2 p-2">
                <p className="min-w-0 flex-1 truncate text-xs">
                  {desenho.legenda ?? 'sem legenda'}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    void remover.mutateAsync({
                      id: desenho.id,
                      caminho: desenho.arquivo_url,
                      modeloPerfilId: modelo.id,
                    })
                  }
                  aria-label="Remover desenho"
                  className="text-erro-600 hover:bg-erro-50 rounded p-1.5"
                >
                  <Trash2 aria-hidden="true" className="size-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="border-borda flex flex-col gap-3 rounded-xl border-2 border-dashed p-3">
        <input
          type="text"
          value={legenda}
          onChange={(e) => setLegenda(e.target.value)}
          placeholder="Legenda, ex.: vista frontal, corte A-A"
          aria-label="Legenda da próxima imagem"
          className="border-borda bg-superficie min-h-12 rounded-xl border-2 px-3"
        />

        <CampoFoto
          ajuda="A legenda acima é aplicada à imagem que você enviar agora."
          aoEnviar={enviarDesenhoTecnico}
          caminho={null}
          previa={null}
          aoRemover={() => undefined}
          aoConcluir={(caminho) => void enviou(caminho)}
        />
      </div>

      {erro && (
        <p role="alert" className="text-erro-600 text-sm">
          {erro}
        </p>
      )}

      {/* Visualizador ampliado */}
      {ampliado && (
        <div
          role="dialog"
          aria-label="Desenho ampliado"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4"
          onClick={() => setAmpliado(null)}
        >
          <img
            src={ampliado}
            alt="Desenho técnico ampliado"
            className="max-h-full max-w-full object-contain"
          />
          <Botao
            variante="secundaria"
            onClick={() => setAmpliado(null)}
            aria-label="Fechar"
            className="absolute top-4 right-4"
          >
            <X aria-hidden="true" className="size-5" />
          </Botao>
        </div>
      )}
    </div>
  )
}
