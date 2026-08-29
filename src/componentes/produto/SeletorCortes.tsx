import type { ReactNode } from 'react'
import {
  linhasDaPonta,
  outroSentido,
  proximoCorte,
  rotuloDaPontaPorExtenso,
  rotuloDoSentido,
  descreverCorte,
  type PontaCorte,
  type SentidoMontagem,
  type TipoCorte,
} from '@/dominio/corteMontagem'
import { DesenhoPerfil, SeloAngulo } from './DesenhoCorte'
import { cn } from '@/lib/utilitarios'

/**
 * Posição de montagem e corte das duas pontas.
 *
 * ── POR QUE BOTÕES QUE ALTERNAM, E NÃO LISTAS ────────────────────────────
 *
 * São três escolhas de poucas opções, feitas dezenas de vezes seguidas ao
 * montar uma receita. Uma lista suspensa custa dois toques e cobre a tela; o
 * rodízio custa um toque e mostra o resultado no próprio botão — e não tira
 * os olhos do desenho, que é o que se está comparando.
 *
 * ── POR QUE O DESENHO É UM SÓ, FORA DOS BOTÕES ───────────────────────────
 *
 * A peça é inteira: é comparando as duas pontas da MESMA barra que se
 * percebe se a esquadria fecha. Então o desenho fica no cartão, mostrando as
 * duas pontas de uma vez, e os botões ficam com o que é de cada ponta — o
 * nome e o ângulo. Tocar num deles muda a ponta correspondente do desenho,
 * que é onde a pessoa está olhando.
 */

function BotaoPonta({
  sentido,
  corte,
  ponta,
  aoMudar,
  className,
}: {
  sentido: SentidoMontagem
  corte: TipoCorte
  ponta: PontaCorte
  aoMudar: (corte: TipoCorte) => void
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={() => aoMudar(proximoCorte(corte))}
      /* O estado inteiro no rótulo acessível: quem usa leitor de tela não vê
         o desenho, e "botão" sozinho não diz o que está escolhido nem o que
         acontece ao tocar. */
      aria-label={`Corte do ${rotuloDaPontaPorExtenso(sentido, ponta)}: ${descreverCorte(corte)}. Tocar para trocar.`}
      title={descreverCorte(corte)}
      className={cn(
        'hover:bg-superficie-2 flex min-w-0 flex-1 rounded-xl p-2',
        /*
         * Deitado, o rótulo fica ACIMA do selo; em pé, AO LADO.
         *
         * Não é capricho de arranjo: deitada, a peça está em cima e as duas
         * pontas dividem a largura, então cada coluna é estreita e o par só
         * cabe empilhado. Em pé, a peça ocupa a esquerda e sobra largura,
         * mas não altura — e aí é o contrário. Cada arranjo segue a forma do
         * espaço que a peça deixou.
         */
        /*
         * Alinhado ao TOPO, não centralizado.
         *
         * O botão ocupa toda a altura que sobra no cartão, e com o conteúdo
         * centralizado nela o rótulo e o selo desciam para longe da peça de
         * que falam. Alinhando ao topo, eles sobem para junto dela e a sobra
         * fica no rodapé — só o conteúdo muda de lugar, nenhum tamanho muda.
         */
        sentido === 'h'
          ? 'flex-col items-center justify-start gap-1'
          : 'flex-row items-start justify-between gap-2',
        className,
      )}
    >
      {/* Por extenso e em duas linhas: "L. ESQ." é abreviação que só quem já
          usa o sistema decifra, e sobra espaço no cartão. */}
      <span
        className={cn(
          'text-texto min-w-0 text-sm leading-tight',
          sentido === 'h' ? 'text-center' : 'text-left',
        )}
      >
        {linhasDaPonta(sentido, ponta).map((linha) => (
          <span key={linha} className="block">
            {linha}
          </span>
        ))}
      </span>

      <SeloAngulo corte={corte} ponta={ponta} sentido={sentido} />
    </button>
  )
}

export function SeletorCortes({
  sentido,
  corteInicio,
  corteFim,
  aoMudarSentido,
  aoMudarInicio,
  aoMudarFim,
  /*
   * Trocável para "Peça N de M": quando o cartão é um entre vários (corte
   * por peça), "Posição / Tipo de corte" repetido em cada um não diz qual é
   * qual — é o número da peça que a pessoa precisa ler para saber onde
   * está.
   */
  titulo = 'Posição / Tipo de corte',
  /**
   * Ação extra ao lado do título — "dividir"/"remover" de um grupo, no
   * bloco de corte por peça. Não cabe dentro do próprio título porque essas
   * ações pertencem ao GRUPO, não ao seletor de posição/corte em si.
   */
  acoes,
  className,
}: {
  sentido: SentidoMontagem
  corteInicio: TipoCorte
  corteFim: TipoCorte
  aoMudarSentido: (sentido: SentidoMontagem) => void
  aoMudarInicio: (corte: TipoCorte) => void
  aoMudarFim: (corte: TipoCorte) => void
  titulo?: string
  acoes?: ReactNode
  className?: string
}) {
  const deitado = sentido === 'h'

  return (
    <section className={cn('flex flex-col gap-2', className)}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{titulo}</h2>
        {acoes}
      </div>

      {/*
       * Fundo âmbar, e não o cinza dos demais cartões.
       *
       * Este bloco é o único da tela que grava INSTRUÇÃO DE SERRA — o resto
       * é medida e quantidade. A cor separa as duas coisas de relance, e
       * âmbar por ser a única família quente do sistema que não significa
       * erro (vermelho) nem disponibilidade (verde), que já têm sentido
       * próprio na lista técnica logo abaixo.
       */}
      {/*
       * ALTURA FIXA, e não a que o conteúdo pedir.
       *
       * Deitado e em pé têm arranjos diferentes por dentro — a peça em cima
       * ou à esquerda —, e deixar cada um definir a própria altura fazia o
       * bloco pular de tamanho a cada toque no botão de posição. Um controle
       * que muda de tamanho quando se mexe nele empurra o resto do
       * formulário para cima e para baixo debaixo do dedo.
       */}
      <div className="border-aviso-borda bg-aviso flex h-40 items-stretch gap-2 rounded-2xl border p-2 sm:gap-3 sm:p-3">
        {/*
         * O sentido primeiro, e à esquerda, porque ele comanda o resto:
         * trocar deitado por em pé renomeia as pontas e gira o desenho.
         */}
        <button
          type="button"
          onClick={() => aoMudarSentido(outroSentido(sentido))}
          aria-label={`Posição de montagem: ${rotuloDoSentido(sentido).toLowerCase()}. Tocar para trocar.`}
          className={cn(
            // A largura é a MESMA nos dois casos, pelo mesmo motivo da
            // altura fixa do bloco: o botão não pode mudar de tamanho
            // quando se toca nele.
            'border-destaque-borda bg-destaque text-destaque-texto hover:bg-destaque-hover flex w-24 shrink-0 rounded-2xl border-2 p-2 sm:w-32 sm:p-3',
            // Em pé, a letra e a peça ficam lado a lado, como a peça está;
            // deitada, empilhadas. O arranjo do botão repete o que o botão
            // está dizendo.
            deitado
              ? 'flex-col items-center justify-center gap-2'
              : 'flex-row items-center justify-center gap-2',
          )}
        >
          <span
            className={cn(
              'flex flex-col items-center gap-1',
              !deitado && 'shrink-0',
            )}
          >
            <span className="text-4xl leading-none font-bold sm:text-5xl">
              {deitado ? 'H' : 'V'}
            </span>

            {/* O nome por extenso embaixo da letra: "H" sozinho é inicial de
                uma palavra que ninguém explicou, e quem abre esta tela pela
                primeira vez não tem como adivinhar qual. */}
            <span className="text-xs leading-tight opacity-70">
              posição
              <br />
              {deitado ? 'horizontal' : 'vertical'}
            </span>
          </span>

          {/* A MESMA peça do cartão ao lado, no mesmo desenho: o botão
              mostra o que se está prestes a girar, com os cortes já
              escolhidos — e não uma barra genérica que ignora a esquadria. */}
          {/* Ajustamos o comprimento do viewbox para que a espessura visual 
              da barra (largura) fique padronizada em todos os desenhos,
              compensando a diferença de tamanho dos contêineres. */}
          <DesenhoPerfil
            sentido={sentido}
            corteInicio={corteInicio}
            corteFim={corteFim}
            comprimento={deitado ? 80 : 130}
            className={deitado ? 'w-full' : 'h-full'}
          />
        </button>

        <div className="border-aviso-borda bg-superficie flex min-w-0 flex-1 gap-2 rounded-2xl border p-2 sm:gap-3 sm:p-3">
          {/*
           * Deitada, a peça fica em cima e as duas pontas embaixo, lado a
           * lado — esquerda à esquerda, direita à direita, cada rótulo
           * debaixo da ponta de que fala. Em pé, a peça fica à esquerda e as
           * pontas empilhadas à direita, de cima para baixo. Em ambos os
           * casos a posição do controle na tela repete a posição da ponta na
           * peça, e é isso que dispensa decorar qual botão é qual.
           */}
          <div
            className={cn(
              'flex min-h-0 min-w-0 flex-1',
              deitado ? 'flex-col gap-2' : 'flex-row items-stretch gap-3',
            )}
          >
            {deitado ? (
              <>
                <DesenhoPerfil
                  sentido={sentido}
                  corteInicio={corteInicio}
                  corteFim={corteFim}
                  className="w-full shrink-0"
                />

                <div className="flex min-h-0 flex-1 items-stretch gap-2">
                  <BotaoPonta
                    sentido={sentido}
                    corte={corteInicio}
                    ponta="inicio"
                    aoMudar={aoMudarInicio}
                  />

                  {/* Divisória: sem ela os dois pares de rótulo e selo
                      viram uma fileira só de quatro coisas. */}
                  <span
                    aria-hidden="true"
                    className="bg-borda w-px shrink-0 self-stretch"
                  />

                  <BotaoPonta
                    sentido={sentido}
                    corte={corteFim}
                    ponta="fim"
                    aoMudar={aoMudarFim}
                  />
                </div>
              </>
            ) : (
              <>
                <DesenhoPerfil
                  sentido={sentido}
                  corteInicio={corteInicio}
                  corteFim={corteFim}
                  comprimento={140}
                  className="h-full shrink-0"
                />

                <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
                  <BotaoPonta
                    sentido={sentido}
                    corte={corteInicio}
                    ponta="inicio"
                    aoMudar={aoMudarInicio}
                  />

                  <span
                    aria-hidden="true"
                    className="bg-borda h-px shrink-0 self-stretch"
                  />

                  <BotaoPonta
                    sentido={sentido}
                    corte={corteFim}
                    ponta="fim"
                    aoMudar={aoMudarFim}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
