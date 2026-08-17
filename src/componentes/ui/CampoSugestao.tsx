import { useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utilitarios'

/** Altura de uma opção da lista, em pixels. Usada para dimensionar. */
const ALTURA_OPCAO = 48
/** Quantas opções mostrar de uma vez, quando houver espaço. */
const OPCOES_VISIVEIS = 6
/** Respiro até a borda da tela, para a lista não encostar. */
const MARGEM_TELA = 12

interface PropsCampoSugestao {
  rotulo: string
  valor: string
  aoMudar: (valor: string) => void
  /** O que a organização já usou neste campo. Pode vir vazio. */
  sugestoes: readonly string[]
  ajuda?: ReactNode
  className?: string
}

/**
 * Campo de texto livre que sugere o que já foi usado antes.
 *
 * POR QUE NÃO É UM `<datalist>`: era, e não funcionava. Estes campos vivem
 * dentro do modal de cadastro, que é um `<dialog>` aberto com
 * `showModal()`, e o Chromium desenha o menu do datalist ABAIXO da camada
 * do modal — a setinha aparecia no campo, mas a lista ficava invisível.
 * Resultado: as sugestões existiam, ninguém nunca as via. Desenhar a lista
 * aqui resolve isso e, de quebra, dá o mesmo comportamento no iPhone, onde
 * o suporte a datalist é irregular.
 *
 * Continua sendo texto livre: digitar algo fora da lista funciona sempre —
 * é assim que a lista cresce.
 */
export function CampoSugestao({
  rotulo,
  valor,
  aoMudar,
  sugestoes,
  ajuda,
  className,
}: PropsCampoSugestao) {
  const idCampo = useId()
  const idLista = `${idCampo}-lista`
  const idAjuda = `${idCampo}-ajuda`

  const [aberto, setAberto] = useState(false)
  const [destacado, setDestacado] = useState(-1)
  /*
   * Só filtra depois que a pessoa digita. Abrir a lista com um valor já
   * preenchido — ao editar um cadastro, por exemplo — mostraria apenas o
   * que se parece com o valor atual, e quem abriu a lista queria
   * justamente ver as outras opções.
   */
  const [filtrando, setFiltrando] = useState(false)
  const container = useRef<HTMLDivElement>(null)
  const campo = useRef<HTMLInputElement>(null)

  /*
   * A lista é posicionada em coordenadas de tela (`fixed`), não dentro do
   * campo. Motivo: estes campos aparecem dentro do modal, cujo conteúdo
   * tem rolagem própria — e tudo que é posicionado lá dentro é RECORTADO
   * na borda dele. Era o que acontecia: por mais alta que a lista fosse,
   * apareciam duas opções e o resto sumia no corte. Em `fixed` ela sai
   * desse recorte e usa a tela inteira.
   */
  const [posicao, setPosicao] = useState<{
    esquerda: number
    largura: number
    topo?: number
    base?: number
    altura: number
  } | null>(null)

  const termo = valor.trim().toLowerCase()
  const filtradas =
    filtrando && termo !== ''
      ? sugestoes.filter((s) => s.toLowerCase().includes(termo))
      : [...sugestoes]
  const mostrando = aberto && filtradas.length > 0

  /*
   * Mede o campo e decide onde cabe a lista. Abre para baixo por padrão; se
   * lá embaixo couber menos do que em cima — teclado do celular aberto,
   * campo no rodapé —, abre para cima. Recalcula ao rolar e ao redimensionar
   * porque a lista, sendo `fixed`, não acompanha sozinha.
   */
  useLayoutEffect(() => {
    if (!mostrando) {
      setPosicao(null)
      return
    }

    function medir() {
      const alvo = campo.current
      if (!alvo) return

      const r = alvo.getBoundingClientRect()
      const desejada = filtradas.length * ALTURA_OPCAO
      const teto = OPCOES_VISIVEIS * ALTURA_OPCAO
      const abaixo = window.innerHeight - r.bottom - MARGEM_TELA
      const acima = r.top - MARGEM_TELA
      const paraCima = abaixo < Math.min(desejada, teto) && acima > abaixo
      const disponivel = paraCima ? acima : abaixo

      setPosicao({
        esquerda: r.left,
        largura: r.width,
        altura: Math.min(desejada, teto, disponivel),
        ...(paraCima
          ? { base: window.innerHeight - r.top + 4 }
          : { topo: r.bottom + 4 }),
      })
    }

    medir()

    // `true` na captura: pega a rolagem do conteúdo do modal também, que
    // não borbulha até a janela.
    window.addEventListener('scroll', medir, true)
    window.addEventListener('resize', medir)

    return () => {
      window.removeEventListener('scroll', medir, true)
      window.removeEventListener('resize', medir)
    }
  }, [mostrando, filtradas.length])

  function escolher(sugestao: string) {
    aoMudar(sugestao)
    setAberto(false)
    setDestacado(-1)
    setFiltrando(false)
  }

  function aoTeclar(evento: React.KeyboardEvent<HTMLInputElement>) {
    if (evento.key === 'Escape') {
      setAberto(false)
      setDestacado(-1)
      return
    }

    if (evento.key === 'ArrowDown' || evento.key === 'ArrowUp') {
      evento.preventDefault()

      if (!aberto) {
        setAberto(true)
        return
      }

      const passo = evento.key === 'ArrowDown' ? 1 : -1
      const total = filtradas.length

      setDestacado((atual) => (atual + passo + total) % total)
      return
    }

    if (evento.key === 'Enter' && mostrando && destacado >= 0) {
      evento.preventDefault()
      escolher(filtradas[destacado]!)
    }
  }

  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={idCampo} className="font-medium">
        {rotulo}
      </label>

      <div
        ref={container}
        className="relative"
        // Fecha ao sair do campo E da lista. O `relatedTarget` diz para onde
        // o foco foi: se continua dentro daqui, é porque a pessoa clicou
        // numa sugestão — fechar agora cancelaria o próprio clique.
        onBlur={(e) => {
          if (!container.current?.contains(e.relatedTarget as Node)) {
            setAberto(false)
            setDestacado(-1)
          }
        }}
      >
        <input
          ref={campo}
          id={idCampo}
          type="text"
          role="combobox"
          aria-expanded={mostrando}
          aria-controls={idLista}
          aria-autocomplete="list"
          aria-describedby={ajuda ? idAjuda : undefined}
          autoComplete="off"
          value={valor}
          onChange={(e) => {
            aoMudar(e.target.value)
            setAberto(true)
            setDestacado(-1)
            setFiltrando(true)
          }}
          onFocus={() => setAberto(true)}
          onKeyDown={aoTeclar}
          className="border-borda bg-superficie h-16 w-full rounded-xl border-2 pr-11 pl-4 text-base"
        />

        {sugestoes.length > 0 && (
          <button
            type="button"
            // Abre e fecha a lista inteira, para quem prefere escolher a
            // digitar. `tabIndex={-1}` porque o campo ao lado já faz isso
            // pelo teclado — dois paradas de tabulação para o mesmo campo
            // só atrapalha.
            tabIndex={-1}
            onClick={() => {
              setFiltrando(false)
              setAberto((v) => !v)
            }}
            aria-label={`Ver opções de ${rotulo.toLowerCase()}`}
            className="text-texto-suave absolute top-1/2 right-2 -translate-y-1/2 rounded-lg p-2"
          >
            <ChevronDown
              aria-hidden="true"
              className={cn(
                'size-5 transition-transform',
                aberto && 'rotate-180',
              )}
            />
          </button>
        )}

        {mostrando && posicao && (
          <ul
            id={idLista}
            role="listbox"
            style={{
              left: posicao.esquerda,
              width: posicao.largura,
              maxHeight: posicao.altura,
              ...(posicao.topo !== undefined
                ? { top: posicao.topo }
                : { bottom: posicao.base }),
            }}
            className="border-borda bg-superficie fixed z-50 overflow-y-auto rounded-xl border-2 shadow-lg"
          >
            {filtradas.map((sugestao, indice) => (
              <li key={sugestao}>
                <button
                  type="button"
                  role="option"
                  aria-selected={indice === destacado}
                  onMouseEnter={() => setDestacado(indice)}
                  onClick={() => escolher(sugestao)}
                  className={cn(
                    'flex min-h-12 w-full items-center px-4 text-left',
                    indice === destacado
                      ? 'bg-superficie-2'
                      : 'hover:bg-superficie-2',
                  )}
                >
                  {sugestao}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {ajuda && (
        <p id={idAjuda} className="text-texto-suave text-sm">
          {ajuda}
        </p>
      )}
    </div>
  )
}
