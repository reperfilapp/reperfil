import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PackagePlus, PackageCheck, CheckCircle2 } from 'lucide-react'
import { useProduto, useAdicionarItemLista } from '@/dados/produtos'
import { SeletorPerfil } from '@/componentes/SeletorPerfil'
import { Botao } from '@/componentes/ui/Botao'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { CampoTexto } from '@/componentes/ui/CampoTexto'
import { cn } from '@/lib/utilitarios'
import type { ModeloPerfil } from '@/tipos/banco'

/**
 * Acrescentar um material (corte) à lista técnica de um produto.
 *
 * Tela própria, e não mais um modal por cima da ficha do produto: escolher
 * o perfil precisa da mesma busca da tela de Estoque — por linha, código ou
 * medida —, e isso não cabe direito numa janela pequena. Reaproveita o
 * `SeletorPerfil` já usado em Cadastrar estoque, com o mesmo comportamento:
 * a lista de linhas ocupa a tela toda até escolher um perfil; depois disso,
 * ele fica fixo (só "Trocar perfil" desfaz) enquanto se lança comprimento e
 * quantidade um atrás do outro — é assim que se monta uma lista técnica de
 * verdade, vários cortes do mesmo perfil em sequência.
 */
export default function AcrescentarMaterial() {
  const { id = null } = useParams()
  const navegar = useNavigate()
  const { data: produto } = useProduto(id)
  const adicionar = useAdicionarItemLista()

  const [modelo, setModelo] = useState<ModeloPerfil | null>(null)
  const [comprimentoMm, setComprimentoMm] = useState('')
  const [quantidade, setQuantidade] = useState('1')
  const [erro, setErro] = useState<string | null>(null)
  const [ultimoAdicionado, setUltimoAdicionado] = useState<string | null>(
    null,
  )

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)

    if (modelo === null) {
      setErro('Escolha o perfil.')
      return
    }

    const comprimento = Number(comprimentoMm.replace(',', '.'))
    const qtd = Number(quantidade)

    if (!Number.isFinite(comprimento) || comprimento <= 0) {
      setErro('Informe o comprimento do corte, em milímetros.')
      return
    }

    if (!Number.isInteger(qtd) || qtd <= 0) {
      setErro('A quantidade por unidade precisa ser um número inteiro.')
      return
    }

    if (id === null) return

    try {
      await adicionar.mutateAsync({
        produto_id: id,
        modelo_perfil_id: modelo.id,
        comprimento_mm: Math.round(comprimento),
        quantidade: qtd,
        observacao: null,
      })

      // Só o comprimento e a quantidade são zerados: o perfil escolhido
      // normalmente se repete no próximo corte da mesma receita.
      setUltimoAdicionado(
        `${modelo.codigo} — ${Math.round(comprimento)} mm × ${qtd}`,
      )
      setComprimentoMm('')
      setQuantidade('1')
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.')
    }
  }

  return (
    <div
      className={cn(
        'mx-auto w-full max-w-lg px-5',
        modelo && 'py-6',
        // Mesma ideia de Cadastrar estoque: sem perfil escolhido ainda, a
        // tela vira uma coluna até a barra de navegação, e a lista de
        // linhas cresce para preencher o espaço de verdade.
        !modelo &&
          '-mb-[5.5rem] flex h-[calc(100dvh-5.5rem)] flex-col py-4 md:mb-0 md:h-auto md:py-6',
      )}
    >
      <BotaoVoltar
        para={`/produtos/${id}`}
        rotulo={produto?.nome ?? 'Produto'}
        // `self-start`: sem perfil escolhido, o contêiner vira `flex-col`
        // (para a lista de linhas crescer até a barra inferior) — e um
        // filho `inline-flex` dentro de `flex-col` estica para a largura
        // toda por padrão, virando uma faixa em vez do botão compacto de
        // sempre.
        className="mb-4 shrink-0 self-start"
      />

      <header className="mb-6 flex shrink-0 items-center gap-3">
        <PackagePlus aria-hidden="true" className="text-acao-600 size-7" />
        <h1 className="text-2xl font-bold">Acrescentar material</h1>
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
            <h2 className="font-semibold">Qual perfil?</h2>
            {modelo && (
              <BotaoVoltar
                onClick={() => setModelo(null)}
                rotulo="Trocar perfil"
              />
            )}
          </div>
          <SeletorPerfil selecionado={modelo} aoSelecionar={setModelo} />
        </section>

        {modelo && (
          <form onSubmit={aoEnviar} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <CampoTexto
                rotulo="Comprimento (mm)"
                inputMode="numeric"
                value={comprimentoMm}
                onChange={(e) => setComprimentoMm(e.target.value)}
                required
              />
              <CampoTexto
                rotulo="Quantidade"
                inputMode="numeric"
                value={quantidade}
                onChange={(e) => setQuantidade(e.target.value)}
                ajuda="Por unidade."
                required
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
