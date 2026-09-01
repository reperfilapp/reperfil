import { useState } from 'react'
import { Trash2, ZoomIn, X, TriangleAlert } from 'lucide-react'
import {
  useDesenhosTecnicos,
  useAdicionarDesenho,
  useRemoverDesenho,
} from '@/dados/desenhosTecnicos'
import type {
  TipoImagemPerfil,
  DesenhoTecnico,
  EntidadeArquivo,
} from '@/dados/desenhosTecnicos'
import { enviarDesenhoTecnico, enviarFotoPerfil } from '@/lib/armazenamento'
import { CampoFoto } from './ui/CampoFoto'
import { Botao } from './ui/Botao'
import { Modal } from './ui/Modal'
import { cn } from '@/lib/utilitarios'

/** Textos e comportamento de cada tipo de imagem. */
const CONFIGURACAO = {
  imagem: {
    titulo: 'Desenhos técnicos',
    descricao:
      'Fotos do desenho ou do catálogo, de vários ângulos, com as medidas de cada face.',
    exemploLegenda: 'Legenda, ex.: vista frontal, corte A-A',
    ajuda: 'A legenda acima é aplicada à imagem que você enviar agora.',
    enviar: enviarDesenhoTecnico,
    // Desenho é traço preto sobre branco: sem fundo branco, some no escuro.
    fundoBranco: true,
  },
  foto: {
    titulo: 'Fotos do perfil',
    descricao:
      'Fotografias da peça real. Tirar no mesmo ângulo do desenho facilita a conferência.',
    exemploLegenda: 'Legenda, ex.: topo, encaixe, acabamento branco',
    ajuda: 'Enquadre a ponta do perfil como no desenho técnico.',
    enviar: enviarFotoPerfil,
    fundoBranco: false,
  },
} as const

/**
 * Galeria de imagens de um perfil — desenhos técnicos ou fotos reais.
 *
 * Serve para o serralheiro conferir, no depósito, se a peça da prateleira é
 * mesmo aquele perfil. O desenho dá a geometria e as cotas; a foto dá a peça
 * como ela é, com a cor e o estado do acabamento. Juntos, e no mesmo ângulo,
 * a conferência é imediata.
 *
 * O visualizador ampliado não é enfeite: cota em milímetro dentro de uma
 * miniatura de 100 px é ilegível, e a cota é o que a pessoa foi consultar.
 */
export function GaleriaDesenhos({
  entidade,
  tipo = 'imagem',
}: {
  entidade: EntidadeArquivo
  tipo?: TipoImagemPerfil
}) {
  const config = CONFIGURACAO[tipo]
  const { data: desenhos, isPending } = useDesenhosTecnicos(entidade, tipo)
  const adicionar = useAdicionarDesenho()
  const remover = useRemoverDesenho()

  const [legenda, setLegenda] = useState('')
  const [ampliado, setAmpliado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  // Remoção aqui é IMEDIATA — não existe um "salvar" depois que junta as
  // mudanças da tela. Sem confirmação, um toque errado no lixo apagava o
  // desenho na hora, sem chance de desfazer fechando a tela sem salvar
  // (não havia o que "não salvar": já tinha ido para o banco).
  const [removendo, setRemovendo] = useState<DesenhoTecnico | null>(null)
  const [erroRemover, setErroRemover] = useState<string | null>(null)

  async function enviou(caminho: string) {
    setErro(null)

    try {
      await adicionar.mutateAsync({
        entidade,
        caminho,
        legenda: legenda.trim() === '' ? null : legenda.trim(),
        ordem: desenhos?.length ?? 0,
        tipo,
      })
      setLegenda('')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível gravar.')
    }
  }

  async function confirmarRemocao() {
    if (!removendo) return

    setErroRemover(null)

    try {
      await remover.mutateAsync({
        id: removendo.id,
        caminho: removendo.arquivo_url,
        tipo,
      })
      setRemovendo(null)
    } catch (e) {
      setErroRemover(
        e instanceof Error ? e.message : 'Não foi possível remover.',
      )
    }
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <div>
          <h3 className="font-semibold">{config.titulo}</h3>
          <p className="text-texto-suave text-sm">{config.descricao}</p>
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
                      className={cn(
                        'aspect-square w-full object-contain',
                        config.fundoBranco ? 'bg-white' : 'bg-superficie-2',
                      )}
                    />
                    <span className="bg-grafite-900/70 absolute right-1.5 bottom-1.5 rounded-full p-1.5 text-white">
                      <ZoomIn aria-hidden="true" className="size-4" />
                    </span>

                    {/* Marcador da busca visual por foto: se já entra na
                        busca (verde) ou ainda não (vermelho — falhou ou o
                        cálculo ainda não terminou). */}
                    {desenho.embedding_ok ? (
                      <span className="bg-economia-50 text-economia-700 absolute top-1.5 right-1.5 rounded-full px-2 py-0.5 text-[0.65rem] font-medium whitespace-nowrap">
                        <span className="font-bold">✓</span> Processado por IA
                      </span>
                    ) : (
                      <span
                        title={desenho.embedding_erro ?? undefined}
                        className="bg-erro-50 text-erro-700 absolute top-1.5 right-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.65rem] font-medium whitespace-nowrap"
                      >
                        <TriangleAlert aria-hidden="true" className="size-3" />
                        Aguardando processamento IA
                      </span>
                    )}
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
                    onClick={() => {
                      setRemovendo(desenho)
                      setErroRemover(null)
                    }}
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
            placeholder={config.exemploLegenda}
            aria-label="Legenda da próxima imagem"
            className="border-borda bg-superficie min-h-12 rounded-xl border-2 px-3"
          />

          <CampoFoto
            ajuda={config.ajuda}
            aoEnviar={config.enviar}
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

      <Modal
        aberto={removendo !== null}
        aoFechar={() => setRemovendo(null)}
        titulo="Remover desenho"
      >
        <div className="flex flex-col gap-4">
          <p>
            Remover <strong>{removendo?.legenda ?? 'este desenho'}</strong>? A
            imagem some do perfil — não tem como desfazer depois.
          </p>

          {erroRemover && (
            <p role="alert" className="text-erro-600 text-sm">
              {erroRemover}
            </p>
          )}

          <div className="flex gap-3">
            <Botao
              type="button"
              variante="secundaria"
              onClick={() => setRemovendo(null)}
              className="flex-1"
            >
              Cancelar
            </Botao>
            <Botao
              type="button"
              variante="destrutiva"
              onClick={() => void confirmarRemocao()}
              carregando={remover.isPending}
              className="flex-1"
            >
              <Trash2 aria-hidden="true" className="size-4" />
              Remover
            </Botao>
          </div>
        </div>
      </Modal>
    </>
  )
}
