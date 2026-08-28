import {
  anguloDoCorte,
  type PontaCorte,
  type SentidoMontagem,
  type TipoCorte,
} from '@/dominio/corteMontagem'
import { cn } from '@/lib/utilitarios'

/**
 * O perfil desenhado, com o corte de cada ponta.
 *
 * ── POR QUE DESENHO, E NÃO TEXTO ─────────────────────────────────────────
 *
 * "45° cima" só quer dizer alguma coisa para quem já decorou a convenção. O
 * desenho é a convenção: quem monta esquadria reconhece a inclinação de
 * relance, e escolhe sem ler.
 *
 * ── POR QUE UMA PEÇA SÓ, E NÃO UMA POR PONTA ─────────────────────────────
 *
 * Duas miniaturas lado a lado — uma da ponta esquerda, outra da direita —
 * mostravam DUAS peças onde existe uma. Ninguém corta metade de um montante
 * e vai buscar outro pedaço para a outra metade: a peça é inteira, e é
 * comparando as duas pontas da MESMA barra que se percebe se a esquadria
 * fecha. Agora o desenho é um só, e cada ponta muda de forma conforme o seu
 * corte.
 *
 * ── POR QUE UMA GEOMETRIA SÓ ─────────────────────────────────────────────
 *
 * O perfil em pé é o mesmo desenho com os eixos trocados, e a ponta direita é
 * a esquerda espelhada. Definir os quatro casos à mão seria quatro lugares
 * para errar um traço; aqui existe UMA descrição — a ponta esquerda de um
 * perfil deitado — e o resto sai de duas transformações.
 */

type Ponto = readonly [number, number]

/*
 * O espaço de desenho da peça DEITADA: 200 de comprimento por 40 de altura.
 *
 * A barra é longa e fina porque é isso que ela é. Desenhada num quadrado,
 * com a ponta ocupando um terço, ela parecia um bloco — e a inclinação do
 * corte, que é a informação toda, virava um detalhe.
 */
const COMPRIMENTO = 200

/*
 * O quadro é APERTADO na espessura: 20 de altura para uma barra de 12.
 *
 * Era 40, e a barra ocupava só 12 — sobravam 28 de margem invisível, que na
 * tela viram espaço morto empurrando tudo que vem depois para baixo. A barra
 * tem a mesma espessura de antes; o que sumiu foi o vazio em volta dela.
 */
const ALTURA = 20

/* Margem do quadro, para o traço não encostar na borda. O fim da barra é
   calculado no componente, porque o comprimento pode ser encurtado. */
const A0 = 4
const T0 = 4
const T1 = 16

/*
 * A zona de corte tem exatamente a espessura da barra (12). É o que faz a
 * inclinação sair a 45° de verdade, e não a um ângulo qualquer que só diz
 * "torto".
 */
const ESPESSURA = T1 - T0

/**
 * A cunha que a serra tira na ponta ESQUERDA de um perfil deitado.
 *
 * O corte reto não tem cunha: a peça simplesmente termina em pé. Só a
 * meia-esquadria tira material, e o lado de onde ela sai é o que distingue
 * as duas.
 */
function cunhaDaPonta(corte: TipoCorte): readonly Ponto[] {
  if (corte === 'reto') return []

  const fim = A0 + ESPESSURA

  return corte === 'meia_cima'
    ? [
        [A0, T0],
        [fim, T0],
        [A0, T1],
      ]
    : [
        [A0, T0],
        [fim, T1],
        [A0, T1],
      ]
}

/**
 * Espelha no comprimento para a ponta da direita, e troca os eixos para o
 * perfil em pé. Nesta ordem: espelhar depois de girar inverteria a ponta.
 */
function transformar(
  [x, y]: Ponto,
  sentido: SentidoMontagem,
  ponta: PontaCorte,
  comprimento: number,
): Ponto {
  const espelhado: Ponto = ponta === 'fim' ? [comprimento - x, y] : [x, y]

  return sentido === 'v' ? [espelhado[1], espelhado[0]] : espelhado
}

const paraPontos = (
  pontos: readonly Ponto[],
  sentido: SentidoMontagem,
  ponta: PontaCorte,
  comprimento: number,
) =>
  pontos
    .map((p) => transformar(p, sentido, ponta, comprimento))
    .map(([x, y]) => `${x},${y}`)
    .join(' ')

/** A peça inteira, com o corte das duas pontas. */
export function DesenhoPerfil({
  sentido,
  corteInicio,
  corteFim,
  comprimento = COMPRIMENTO,
  impressao = false,
  className,
}: {
  sentido: SentidoMontagem
  corteInicio: TipoCorte
  corteFim: TipoCorte
  /**
   * Comprimento da peça no espaço de desenho. Encurtar isto encurta a BARRA
   * sem afiná-la.
   *
   * Existe para o botão de posição, que é estreito: lá o desenho reduzido
   * pela largura do quadro ficava com metade da espessura do desenho do
   * cartão ao lado, e a mesma peça em duas grossuras parece duas peças. Com
   * um quadro mais curto, a escala volta a bater e só o comprimento muda.
   */
  comprimento?: number
  /**
   * Cores fixas em vez das do tema.
   *
   * A folha impressa é sempre branca com traço preto, e os tokens do tema
   * seguem o tema DA TELA: no modo escuro o desenho sairia branco sobre
   * branco — invisível justamente no papel que vai para a serra.
   */
  impressao?: boolean
  className?: string
}) {
  const fim = comprimento - 4

  const corpo = paraPontos(
    [
      [A0, T0],
      [fim, T0],
      [fim, T1],
      [A0, T1],
    ],
    sentido,
    'inicio',
    comprimento,
  )

  const cunhas = (['inicio', 'fim'] as const).map((ponta) => ({
    ponta,
    pontos: paraPontos(
      cunhaDaPonta(ponta === 'inicio' ? corteInicio : corteFim),
      sentido,
      ponta,
      comprimento,
    ),
  }))

  return (
    <svg
      viewBox={
        sentido === 'h'
          ? `0 0 ${comprimento} ${ALTURA}`
          : `0 0 ${ALTURA} ${comprimento}`
      }
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      <polygon
        points={corpo}
        className={
          impressao
            ? 'fill-white stroke-black'
            : 'fill-superficie stroke-texto-suave'
        }
        strokeWidth={1.4}
      />

      {/* A cunha em cinza cheio — é o que distingue as variações de relance,
          mais do que a linha da serra. */}
      {cunhas.map(
        ({ ponta, pontos }) =>
          pontos !== '' && (
            <polygon
              key={ponta}
              points={pontos}
              className={impressao ? 'fill-black/40' : 'fill-texto-suave/45'}
              stroke="none"
            />
          ),
      )}
    </svg>
  )
}

/**
 * O selo do ângulo — "90°" ou "45°" — com a linha tracejada da serra.
 *
 * Fica ao lado do rótulo da ponta, e não dentro do desenho da peça: na peça
 * a inclinação é pequena, e a bancada confere pelo número. Repetir o ângulo
 * em texto é o que torna a escolha conferível sem apertar os olhos.
 */
export function SeloAngulo({
  corte,
  ponta,
}: {
  corte: TipoCorte
  /* A ponta importa: a mesma inclinação vista da outra extremidade corre
     para o lado contrário, e o selo tem de concordar com o desenho. */
  ponta: PontaCorte
}) {
  const angulo = anguloDoCorte(corte)

  /*
   * A tracejada corre na inclinação do corte, atravessando o selo de canto a
   * canto — e o número foge para o canto oposto ao da linha.
   *
   * Centralizado, o traço riscava os algarismos, num selo que existe
   * justamente para conferir o ângulo de relance.
   */
  const desce =
    corte === 'reto' ? null : (corte === 'meia_cima') === (ponta === 'inicio')

  /*
   * No corte reto a tracejada é VERTICAL, e por isso encosta na BEIRADA, do
   * lado da ponta que está sendo cortada — nunca no meio. Centralizada, ela
   * cai exatamente sobre os algarismos do "90°", que é o que o selo existe
   * para mostrar. As meias correm de canto a canto e o número foge para o
   * canto que a diagonal não passa.
   */
  const traco =
    desce === null
      ? ponta === 'inicio'
        ? { x1: 8, y1: 3, x2: 8, y2: 37 }
        : { x1: 32, y1: 3, x2: 32, y2: 37 }
      : desce
        ? { x1: 4, y1: 4, x2: 36, y2: 36 }
        : { x1: 4, y1: 36, x2: 36, y2: 4 }

  const fuga =
    desce === null
      ? ponta === 'inicio'
        ? 'items-center justify-end pr-2'
        : 'items-center justify-start pl-2'
      : desce
        ? 'items-end justify-start pb-1 pl-1'
        : 'items-start justify-start pt-1 pl-1'

  return (
    <span
      className={cn(
        'border-borda bg-superficie relative inline-flex size-12 shrink-0 rounded-xl border',
        fuga,
      )}
    >
      <svg
        viewBox="0 0 40 40"
        aria-hidden="true"
        className="absolute inset-0 size-full"
      >
        <line
          {...traco}
          className="stroke-texto-suave"
          strokeWidth={1.4}
          strokeDasharray="3 2.5"
        />
      </svg>

      <span className="text-texto relative text-base font-bold">{angulo}°</span>
    </span>
  )
}
