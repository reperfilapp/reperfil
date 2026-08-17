import { Link } from 'react-router-dom'
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
 * ficha de detalhe (sempre aberta a partir da lista dela) ou um cadastro
 * dentro de "Mais" (só se chega ali por "Mais") — mostra um jeito de
 * voltar para ESSA origem, visível no topo, sem depender de gesto do
 * navegador. Não é para as 5 telas da navegação inferior (Início,
 * Procurar, Cadastrar, Reservas, Mais): essas não têm uma única tela
 * anterior — chegam de lugares diferentes — e a barra inferior já leva a
 * qualquer uma delas a qualquer momento. Um botão fixo apontando sempre
 * para o Início nelas seria redundante e, pior, errado sempre que a
 * pessoa veio de outro lugar.
 *
 * De propósito compacto: é um coadjuvante de navegação, não uma ação — não
 * compete por atenção com o título da tela nem com os botões de verdade.
 *
 * Duas formas de uso: `para` navega para uma rota (a maioria dos casos);
 * `onClick` desfaz uma escolha feita na própria tela sem trocar de rota
 * (ex.: trocar o perfil escolhido num formulário).
 */
export function BotaoVoltar(props: PropsBotaoVoltar) {
  const classe = cn(CLASSE_BASE, props.className)
  const conteudo = (
    <>
      <ArrowLeft aria-hidden="true" className="size-3.5" />
      {props.rotulo}
    </>
  )

  if (props.para) {
    return (
      <Link to={props.para} className={classe}>
        {conteudo}
      </Link>
    )
  }

  return (
    <button type="button" onClick={props.onClick} className={classe}>
      {conteudo}
    </button>
  )
}
