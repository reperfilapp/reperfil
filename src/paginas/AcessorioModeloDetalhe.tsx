import { useParams } from 'react-router-dom'
import { useModeloAcessorio } from '@/dados/modelosAcessorio'
import { GaleriaDesenhos } from '@/componentes/GaleriaDesenhos'
import { EstadoConsulta } from '@/componentes/EstadoConsulta'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'

/**
 * Ficha do acessório (o item de catálogo, não um lote de estoque — esse é
 * `AcessorioDetalhe.tsx`, em `/estoque-acessorios/:id`) — código, descrição
 * e a galeria de foto/desenho técnico, no mesmo padrão de `PerfilDetalhe.tsx`.
 *
 * Editar os campos continua no modal de `ModelosAcessorio.tsx` por
 * enquanto; esta tela é onde a foto/desenho técnico ganham espaço, que um
 * modal não tem.
 */
export default function AcessorioModeloDetalhe() {
  const { id } = useParams<{ id: string }>()
  const {
    data: acessorio,
    isPending,
    error,
    refetch,
  } = useModeloAcessorio(id ?? null)

  const entidade = id ? { tipo: 'acessorio' as const, id } : null

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-6">
      <BotaoVoltar para="/acessorios" rotulo="Acessórios" className="mb-4" />

      <EstadoConsulta
        carregando={isPending}
        erro={error}
        vazio={!isPending && !error && !acessorio}
        mensagemVazio="Acessório não encontrado."
        aoTentarNovamente={() => void refetch()}
      />

      {acessorio && (
        <>
          <header className="mb-6">
            <p className="text-acao-600 font-mono text-sm font-medium">
              {acessorio.codigo}
            </p>
            <h1 className="text-2xl font-bold">{acessorio.descricao}</h1>
            {acessorio.categoria && (
              <p className="text-texto-suave mt-1">{acessorio.categoria}</p>
            )}
            {!acessorio.ativo && (
              <span className="bg-superficie-2 text-texto-suave mt-2 inline-block rounded px-2 py-0.5 text-xs">
                inativo
              </span>
            )}
          </header>

          {entidade && (
            <div className="flex flex-col gap-6">
              <GaleriaDesenhos entidade={entidade} tipo="imagem" />
              <div className="border-borda border-t pt-6">
                <GaleriaDesenhos entidade={entidade} tipo="foto" />
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
