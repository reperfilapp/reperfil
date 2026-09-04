import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PackagePlus, PackageCheck, CheckCircle2 } from 'lucide-react'
import { useProduto, useAdicionarItemListaAcessorio } from '@/dados/produtos'
import { SeletorAcessorio } from '@/componentes/SeletorAcessorio'
import { Botao } from '@/componentes/ui/Botao'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { CampoQuantidade } from '@/componentes/ui/CampoQuantidade'
import type { DadosItemListaAcessorio } from '@/dados/produtos'
import { cn } from '@/lib/utilitarios'
import type { ModeloAcessorio } from '@/tipos/banco'

/**
 * Acrescentar um acessório à lista técnica de um produto.
 *
 * Gêmea de `AcrescentarMaterial.tsx`, mas bem mais simples: acessório não é
 * cortado, então não há comprimento, sentido nem grupos de corte — só
 * escolher o acessório (`SeletorAcessorio`, agrupado por categoria) e dizer
 * quantas peças dele entram em UMA unidade do produto.
 */
export default function AcrescentarAcessorio() {
  const { id = null } = useParams()
  const navegar = useNavigate()
  const { data: produto } = useProduto(id)
  const adicionar = useAdicionarItemListaAcessorio()

  const [modelo, setModelo] = useState<ModeloAcessorio | null>(null)
  const [quantidade, setQuantidade] = useState(1)
  const [erro, setErro] = useState<string | null>(null)
  const [ultimoAdicionado, setUltimoAdicionado] = useState<string | null>(null)

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)

    if (modelo === null) {
      setErro('Escolha o acessório.')
      return
    }

    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      setErro('A quantidade por unidade precisa ser um número inteiro.')
      return
    }

    if (id === null) return

    try {
      const dados: DadosItemListaAcessorio = {
        produto_id: id,
        modelo_acessorio_id: modelo.id,
        quantidade,
        observacao: null,
      }

      await adicionar.mutateAsync(dados)

      setUltimoAdicionado(`${modelo.codigo} — ${quantidade}×`)

      setQuantidade(1)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.')
    }
  }

  return (
    <div
      className={cn(
        'mx-auto w-full max-w-lg px-5',
        modelo && 'py-6',
        !modelo &&
          '-mb-[5.5rem] flex h-[calc(100dvh-5.5rem)] flex-col py-4 md:mb-0 md:h-auto md:py-6',
      )}
    >
      <BotaoVoltar
        para={`/produtos/${id}`}
        rotulo={produto?.nome ?? 'Produto'}
        className="mb-4 shrink-0 self-start"
      />

      <header className="mb-6 flex shrink-0 items-center gap-3">
        <PackagePlus aria-hidden="true" className="text-acao-600 size-7" />
        <h1 className="text-2xl font-bold">Acrescentar acessório</h1>
      </header>

      {ultimoAdicionado && (
        <div
          role="status"
          className="bg-aluminio-100 text-grafite-800 mb-5 flex shrink-0 items-center gap-2 rounded-xl p-4 text-sm"
        >
          <CheckCircle2 aria-hidden="true" className="size-5 shrink-0" />
          <p>
            <strong>{ultimoAdicionado}</strong> acrescentado à lista técnica.
          </p>
        </div>
      )}

      <div className={cn('flex flex-col gap-6', !modelo && 'min-h-0 flex-1')}>
        <section className={cn(!modelo && 'flex min-h-0 flex-1 flex-col')}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="font-semibold">Qual acessório?</h2>
            {modelo && (
              <BotaoVoltar
                onClick={() => setModelo(null)}
                rotulo="Trocar acessório"
              />
            )}
          </div>
          <SeletorAcessorio selecionado={modelo} aoSelecionar={setModelo} />
        </section>

        {modelo && (
          <form onSubmit={aoEnviar} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <span className="text-sm font-medium tracking-tight whitespace-nowrap">
                Quantidade por unidade
              </span>
              <CampoQuantidade
                valor={quantidade}
                aoMudar={setQuantidade}
                rotulo="Quantidade por unidade"
              />
            </div>

            {erro && (
              <p
                role="alert"
                className="bg-erro-50 text-erro-700 rounded-xl px-4 py-3"
              >
                {erro}
              </p>
            )}

            <div className="flex gap-3">
              <Botao
                type="button"
                variante="contorno"
                onClick={() => navegar(`/produtos/${id}`)}
                className="flex-1"
              >
                Concluir
              </Botao>
              <Botao
                type="submit"
                carregando={adicionar.isPending}
                className="flex-1"
              >
                <PackageCheck aria-hidden="true" className="size-5" />
                Acrescentar
              </Botao>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
