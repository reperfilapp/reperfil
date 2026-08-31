import { useEffect, useState, type FormEvent } from 'react'
import {
  useCardsTelaInicial,
  useSalvarCardsTelaInicial,
} from '@/dados/cardsTelaInicial'
import {
  CATALOGO_RESUMO,
  CATALOGO_ATALHO,
  CORES_CARD_RESUMO,
  CORES_ATALHO,
  CORES_RESUMO_PADRAO,
  CORES_ATALHO_PADRAO,
} from '@/dominio/telaInicial'
import type { GrupoCardTelaInicial } from '@/tipos/banco'
import { Botao } from '@/componentes/ui/Botao'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { CampoSelecao } from '@/componentes/ui/CampoSelecao'

interface EstadoLinha {
  selecionado: boolean
  cor: string
}

type Estado = Record<string, EstadoLinha>

function estadoInicial(
  cards: { grupo: GrupoCardTelaInicial; item: string; cor: string }[],
  grupo: GrupoCardTelaInicial,
  catalogo: Record<string, unknown>,
  corPadrao: string,
): Estado {
  const linhas = cards.filter((c) => c.grupo === grupo)
  const mapa: Estado = {}

  for (const item of Object.keys(catalogo)) {
    const existente = linhas.find((l) => l.item === item)
    mapa[item] = {
      selecionado: existente !== undefined,
      cor: existente?.cor ?? corPadrao,
    }
  }

  return mapa
}

/**
 * Personalização dos cards da tela inicial — cada empresa escolhe QUAIS
 * cards mostrar (de um catálogo, não mais 7 posições fixas) e a cor de
 * cada um. Ver `src/dominio/telaInicial.ts` (o catálogo e as cores) e
 * `src/paginas/Inicio.tsx` (onde o resultado é consumido).
 */
export default function PersonalizarInicio() {
  const {
    data: cards,
    isPending,
    isError,
    error: erroCarregar,
  } = useCardsTelaInicial()
  const salvar = useSalvarCardsTelaInicial()

  const [resumo, setResumo] = useState<Estado | null>(null)
  const [atalho, setAtalho] = useState<Estado | null>(null)
  const [salvo, setSalvo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    if (cards && resumo === null && atalho === null) {
      setResumo(estadoInicial(cards, 'resumo', CATALOGO_RESUMO, CORES_RESUMO_PADRAO))
      setAtalho(estadoInicial(cards, 'atalho', CATALOGO_ATALHO, CORES_ATALHO_PADRAO))
    }
  }, [cards, resumo, atalho])

  if (isError) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-8">
        <BotaoVoltar para="/mais" rotulo="Mais" className="mb-4" />
        <p role="alert" className="text-erro-600">
          {erroCarregar instanceof Error
            ? erroCarregar.message
            : 'Não foi possível carregar.'}
        </p>
      </div>
    )
  }

  if (isPending || !resumo || !atalho) {
    return <p className="text-texto-suave p-6">Carregando…</p>
  }

  function alterar(
    grupo: 'resumo' | 'atalho',
    item: string,
    mudanca: Partial<EstadoLinha>,
  ) {
    setSalvo(false)
    const atualizar = grupo === 'resumo' ? setResumo : setAtalho
    atualizar((atual) =>
      atual ? { ...atual, [item]: { ...atual[item]!, ...mudanca } } : atual,
    )
  }

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    if (!resumo || !atalho) return

    setErro(null)

    try {
      await salvar.mutateAsync({
        grupo: 'resumo',
        itens: Object.entries(resumo)
          .filter(([, v]) => v.selecionado)
          .map(([item, v]) => ({ item, cor: v.cor })),
      })
      await salvar.mutateAsync({
        grupo: 'atalho',
        itens: Object.entries(atalho)
          .filter(([, v]) => v.selecionado)
          .map(([item, v]) => ({ item, cor: v.cor })),
      })
      setSalvo(true)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.')
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8">
      <BotaoVoltar para="/mais" rotulo="Mais" className="mb-4" />

      <header className="mb-6">
        <h1 className="text-2xl font-bold">Personalizar tela inicial</h1>
        <p className="text-texto-suave mt-1">
          Escolha quais cards aparecem na tela inicial, quantos, e a cor de
          cada um.
        </p>
      </header>

      <form onSubmit={(e) => void aoEnviar(e)} className="flex flex-col gap-6">
        <fieldset className="min-w-0 flex flex-col gap-2">
          <legend className="mb-1 font-semibold">Cards de resumo</legend>
          {Object.entries(CATALOGO_RESUMO).map(([item, { rotulo }]) => (
            <LinhaCard
              key={item}
              nome={rotulo}
              estado={resumo[item]!}
              aoMudar={(mudanca) => alterar('resumo', item, mudanca)}
              opcoes={CORES_CARD_RESUMO}
            />
          ))}
        </fieldset>

        <fieldset className="min-w-0 flex flex-col gap-2">
          <legend className="mb-1 font-semibold">Atalhos</legend>
          {Object.entries(CATALOGO_ATALHO).map(([item, { rotulo }]) => (
            <LinhaCard
              key={item}
              nome={rotulo}
              estado={atalho[item]!}
              aoMudar={(mudanca) => alterar('atalho', item, mudanca)}
              opcoes={CORES_ATALHO}
            />
          ))}
        </fieldset>

        {erro && (
          <p role="alert" className="text-erro-600 text-sm">
            {erro}
          </p>
        )}

        <Botao type="submit" carregando={salvar.isPending}>
          {salvo ? '✓ Salvo' : 'Salvar'}
        </Botao>
      </form>
    </div>
  )
}

function LinhaCard({
  nome,
  estado,
  aoMudar,
  opcoes,
}: {
  nome: string
  estado: EstadoLinha
  aoMudar: (mudanca: Partial<EstadoLinha>) => void
  opcoes: Record<string, { rotulo: string }>
}) {
  return (
    <div className="border-borda flex items-center gap-3 rounded-xl border-2 p-3">
      <label className="flex min-w-0 flex-1 items-center gap-2">
        <input
          type="checkbox"
          checked={estado.selecionado}
          onChange={(e) => aoMudar({ selecionado: e.target.checked })}
          className="size-5 shrink-0"
        />
        <span className="truncate font-medium">{nome}</span>
      </label>

      <CampoSelecao
        rotulo={`Cor do card ${nome}`}
        rotuloOculto
        value={estado.cor}
        disabled={!estado.selecionado}
        onChange={(e) => aoMudar({ cor: e.target.value })}
        className="h-11 w-32 shrink-0 pr-8 text-sm disabled:opacity-40"
      >
        {Object.entries(opcoes).map(([valor, { rotulo }]) => (
          <option key={valor} value={valor}>
            {rotulo}
          </option>
        ))}
      </CampoSelecao>
    </div>
  )
}
