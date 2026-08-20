import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utilitarios'

const CLASSE_BASE =
  'border-destaque-borda bg-destaque text-destaque-texto hover:bg-destaque-hover ' +
  'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold'

type PropsComuns = {
  rotulo: string
  className?: string
}

type PropsBotaoVoltar =
  | (PropsComuns & { para: string; onClick?: never })
  | (PropsComuns & { para?: never; onClick: () => void })

/**
 * Botão de voltar, em todo lugar do app com a mesma cara.
 *
 * CONVENÇÃO DO PROJETO: toda tela que tem uma origem única e genuína — uma
 * ficha de detalhe ou um cadastro dentro de "Mais" — mostra um jeito de
 * voltar para essa origem, visível no topo, sem depender de gesto do
 * navegador. Não é para as 5 telas da navegação inferior (Início,
 * Procurar, Cadastrar, Reservas, Mais): essas não têm uma única tela
 * anterior — chegam de lugares diferentes — e a barra inferior já leva a
 * qualquer uma delas a qualquer momento.
 *
 * ── `para` É UM DESTINO DE RESERVA, NÃO O DESTINO DE VERDADE ─────────────
 *
 * Uma ficha de perfil abre a partir do catálogo, mas também de uma sobra, de
 * uma lista técnica, de uma busca — o mesmo destino, vários pontos de
 * partida. Se "voltar" sempre levasse para `para`, chegar por um caminho
 * diferente do "principal" devolvia a pessoa a um lugar errado, obrigando a
 * refazer todo o trajeto até onde estava. Por isso, havendo uma tela
 * anterior de verdade nesta aba (`history.state.idx > 0` — já navegamos ao
 * menos uma vez dentro do app), o botão volta para ELA, com
 * `navigate(-1)`, e não para `para`.
 *
 * `para` só é usado quando a tela abre "do nada": um link externo, um
 * atalho salvo, ou a primeira tela depois de abrir o aplicativo — casos em
 * que não existe navegador para onde voltar, e "para" é a melhor
 * aproximação de onde a pessoa "deveria" estar.
 *
 * ── O RÓTULO SÓ VALE QUANDO O DESTINO É `para` ───────────────────────────
 *
 * Voltando pelo histórico, o destino é a tela anterior de verdade — que pode
 * não ser a que o rótulo nomeia (a ficha do perfil sempre recebe "Perfis",
 * mas às vezes se chega a ela pela lista técnica). Um rótulo específico
 * apontando para o lugar errado é pior do que nenhum; por isso o texto vira
 * "Voltar", neutro, sempre que o destino é o histórico. O rótulo passado só
 * aparece de fato quando o destino também é `para` — aí ele é exato.
 *
 * De propósito compacto: é um coadjuvante de navegação, não uma ação — não
 * compete por atenção com o título da tela nem com os botões de verdade.
 *
 * Duas formas de uso: `para` navega para uma rota (a maioria dos casos, com
 * a ressalva acima); `onClick` desfaz uma escolha feita na própria tela sem
 * trocar de rota (ex.: trocar o perfil escolhido num formulário, ou fechar
 * um nível de agrupamento aberto na mesma tela).
 */
export function BotaoVoltar(props: PropsBotaoVoltar) {
  const navegar = useNavigate()
  const classe = cn(CLASSE_BASE, props.className)

  if (props.para) {
    const estadoHistorico = window.history.state as { idx?: number } | null
    const existeTelaAnterior = (estadoHistorico?.idx ?? 0) > 0

    if (existeTelaAnterior) {
      return (
        <button type="button" onClick={() => navegar(-1)} className={classe}>
          <ArrowLeft aria-hidden="true" className="size-3.5" />
          Voltar
        </button>
      )
    }

    return (
      <Link to={props.para} className={classe}>
        <ArrowLeft aria-hidden="true" className="size-3.5" />
        {props.rotulo}
      </Link>
    )
  }

  return (
    <button type="button" onClick={props.onClick} className={classe}>
      <ArrowLeft aria-hidden="true" className="size-3.5" />
      {props.rotulo}
    </button>
  )
}
