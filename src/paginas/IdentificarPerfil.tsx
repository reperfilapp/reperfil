import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Camera, ImagePlus, X, ChevronRight, Info } from 'lucide-react'
import {
  useModelosPerfil,
  useOrdemLinhas,
  agruparPorLinha,
  SEM_LINHA,
} from '@/dados/modelosPerfil'
import { useCapasDesenhos } from '@/dados/desenhosTecnicos'
import { useIdentificarPorFoto } from '@/dados/identificacaoPorFoto'
import { MiniaturaPerfil } from '@/componentes/MiniaturaPerfil'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { CampoTexto } from '@/componentes/ui/CampoTexto'
import { CampoSelecao } from '@/componentes/ui/CampoSelecao'
import { CampoMedida } from '@/componentes/ui/CampoMedida'
import { VisualizadorImagem } from '@/componentes/ui/VisualizadorImagem'
import {
  pesoPorMetroDePeca,
  candidatosPorPeso,
  candidatosPorMedida,
  formatarAreaSecao,
  formatarMedidasSecao,
  areaSecaoMm2,
} from '@/dominio/secao'
import { combinarCandidatos } from '@/dominio/identificacaoPerfil'
import { interpretarMedidaDigitada } from '@/dominio/medidas'
import type { UnidadeMedida } from '@/config/aplicacao'
import type { ModeloPerfil } from '@/tipos/banco'

/**
 * Identifica a ponta que perdeu a etiqueta.
 *
 * Sobra antiga achada no fundo do depósito, retalho que veio do fornecedor,
 * peça que perdeu a identificação: para essas o QR Code não serve — não
 * existe — e procurar de olho entre 82 perfis parecidos é onde o erro
 * acontece.
 *
 * A tela junta os caminhos que a pessoa tem à mão, nesta ordem:
 *
 * • A TRENA, que é o instrumento que a oficina realmente tem. Mede-se a
 *   seção da ponta e o app estreita os 82 perfis a poucos. Só funciona
 *   porque as medidas da seção foram DERIVADAS do peso e do desenho de cada
 *   perfil (ver `scripts/calcular-secao.mjs`) — ninguém digitou 82 fichas.
 *
 * • A FOTO da ponta. Hoje ela NÃO é reconhecida automaticamente: fica lado
 *   a lado com os desenhos dos candidatos, resolvendo a comparação que antes
 *   obrigava a ir e voltar de tela com a peça na mão. É também o lugar onde
 *   o reconhecimento automático entra quando existir, sem mudar o fluxo.
 *
 * • O PESO, recolhido, para o dia em que houver balança. Peso por metro de
 *   alumínio É a área da seção vezes a densidade do metal, então a balança
 *   mede indiretamente quanto metal tem na seção.
 *
 * Em nenhum caso o app decide sozinho: ele estreita a lista e mostra o
 * desenho. Cadastrar sobra no perfil errado é pior do que não cadastrar — a
 * peça aparece na busca de outro perfil e manda alguém à prateleira à toa.
 */
export default function IdentificarPerfil() {
  const { data: modelos } = useModelosPerfil()
  const { data: capas } = useCapasDesenhos('imagem')
  const { data: ordemLinhas } = useOrdemLinhas()

  /*
   * Quem chegou aqui pelo atalho da câmera, no meio de um cadastro, volta
   * para lá com o perfil já escolhido — senão teria de refazer o caminho e
   * procurar de novo o mesmo perfil que acabou de identificar. Sem o
   * parâmetro, o toque no candidato abre a ficha dele, como antes.
   */
  const [parametros] = useSearchParams()
  const retorno = parametros.get('retorno')
  const destinoDo = (idPerfil: string) =>
    retorno
      ? `${retorno}?perfil=${encodeURIComponent(idPerfil)}`
      : `/perfis/${idPerfil}`

  const [foto, setFoto] = useState<string | null>(null)
  const [ampliada, setAmpliada] = useState<string | null>(null)
  const identificar = useIdentificarPorFoto()
  /*
   * Um campo só, com as medidas separadas por espaço — não quatro campos.
   * Quem está com a ponta na mão mede o que dá — a largura por fora, a
   * altura, a aba que sobra, o vão de uma câmara — e não tem como saber
   * quais dessas o catálogo conhece. Aceitar várias aumenta a chance de as
   * conhecidas estarem no meio, e digitar "35 25 2 1" de uma vez é mais
   * rápido do que pular entre quatro campos — o mesmo texto livre que a
   * busca por medida já aceita (`dominio/buscaPerfil.ts`).
   */
  const [medidasTexto, setMedidasTexto] = useState('')
  const [pesoTexto, setPesoTexto] = useState('')
  const [comprimentoTexto, setComprimentoTexto] = useState('')
  const [unidade, setUnidade] = useState<UnidadeMedida>('mm')
  const [linha, setLinha] = useState('')
  const [mostrarPeso, setMostrarPeso] = useState(false)

  const entradaCamera = useRef<HTMLInputElement>(null)
  const entradaGaleria = useRef<HTMLInputElement>(null)

  // A foto é de conferência, não de acervo: vive só nesta tela, não sobe
  // para o servidor. Liberar o endereço temporário evita segurar a imagem
  // na memória depois que ela sai da tela.
  useEffect(() => {
    return () => {
      if (foto) URL.revokeObjectURL(foto)
    }
  }, [foto])

  function escolherFoto(arquivo: File | undefined) {
    if (!arquivo) return

    setFoto((anterior) => {
      if (anterior) URL.revokeObjectURL(anterior)
      return URL.createObjectURL(arquivo)
    })

    // Dispara a busca visual assim que a foto é escolhida — sem precisar
    // de um botão "buscar" separado. `reset()` primeiro: sem isso, o
    // resultado da foto anterior ficaria na tela até este pedido terminar.
    identificar.reset()
    identificar.mutate(arquivo)
  }

  // Vírgula é como se escreve 23,8 aqui; "x" e "×" também separam, porque é
  // como a medida vem escrita em desenho ("35x25"). Texto vazio ou um
  // pedaço que não vira número é descartado, junto com zero e negativo.
  const medidas = medidasTexto
    .trim()
    .replace(/[x×]/g, ' ')
    .split(/\s+/)
    .map((t) => Number(t.replace(',', '.')))
    .filter((n) => Number.isFinite(n) && n > 0)
  const mediuSecao = medidas.length > 0

  const pesoG = Number(pesoTexto.replace(',', '.'))
  const comprimentoMm = interpretarMedidaDigitada(comprimentoTexto, unidade)
  const pesouPeca =
    Number.isFinite(pesoG) && pesoG > 0 && comprimentoMm !== null
  const medido = pesouPeca ? pesoPorMetroDePeca(pesoG, comprimentoMm!) : null

  const linhas = agruparPorLinha(modelos ?? [], ordemLinhas)
    .map((g) => g.linha)
    .filter((l) => l !== SEM_LINHA)

  const universo = (modelos ?? []).filter(
    (m) => linha === '' || (m.linha?.trim() || SEM_LINHA) === linha,
  )

  /*
   * A trena vem primeiro: é o instrumento que a oficina tem. O peso entra
   * como refinamento quando existir balança. A linha sozinha também vale —
   * sem nada, não há o que listar, porque mostrar os 82 de uma vez seria
   * repetir a lista de perfis, que já existe noutra tela.
   */
  const candidatosBase: { perfil: ModeloPerfil; nota: string | null }[] = mediuSecao
    ? candidatosPorMedida(universo, medidas).map((c) => ({
        perfil: c.perfil,
        nota:
          c.desvioPercentual < 2
            ? 'medida bate'
            : `${c.desvioPercentual.toFixed(0)}% de diferença`,
      }))
    : medido !== null
      ? candidatosPorPeso(universo, medido).map((c) => ({
          perfil: c.perfil,
          nota:
            c.diferencaPercentual < 0.5
              ? 'peso exato'
              : `${c.diferencaPercentual.toFixed(1).replace('.', ',')}% de diferença`,
        }))
      : linha !== ''
        ? universo.map((perfil) => ({ perfil, nota: null }))
        : []

  // A busca por foto participa mesmo sem medida nem linha escolhidas — é
  // o próprio ponto da foto ter passado a comparar de verdade.
  const candidatos = combinarCandidatos(
    candidatosBase,
    identificar.data ?? [],
    universo,
  )

  // `== null` cobre nulo e ausente: antes da migração a coluna nem vem.
  const semMedida = universo.filter((m) => m.largura_secao_mm == null).length
  const filtrouAlgo =
    mediuSecao || medido !== null || linha !== '' || foto !== null

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-6">
      <BotaoVoltar para="/mais" rotulo="Mais" className="mb-4" />

      <header className="mb-5">
        <h1 className="text-2xl font-bold">Identificar perfil</h1>
        <p className="text-texto-suave mt-1 text-sm">
          Para a ponta que perdeu a etiqueta.
        </p>
      </header>

      <div className="mb-6 flex flex-col gap-5">
        {/* 1 — Foto da ponta */}
        <section>
          <h2 className="mb-2 font-semibold">
            Foto da ponta{' '}
            <span className="text-texto-suave font-normal">(opcional)</span>
          </h2>

          {foto ? (
            <div className="flex items-start gap-3">
              <button
                type="button"
                onClick={() => setAmpliada(foto)}
                className="border-borda bg-superficie-2 shrink-0 overflow-hidden rounded-xl border-2"
                aria-label="Ampliar foto da ponta"
              >
                <img
                  src={foto}
                  alt="Ponta do perfil fotografada"
                  className="size-28 object-cover"
                />
              </button>

              <div className="flex-1">
                <p className="text-texto-suave mb-2 text-sm">
                  Ela fica na tela enquanto você compara com os desenhos abaixo.
                </p>
                {identificar.isPending && (
                  <p className="text-texto-suave mb-2 text-sm">
                    Comparando com o catálogo…
                  </p>
                )}
                {identificar.error && (
                  <p role="alert" className="text-erro-600 mb-2 text-sm">
                    {identificar.error instanceof Error
                      ? identificar.error.message
                      : 'Não foi possível comparar a foto.'}{' '}
                    A medida e a linha continuam funcionando normalmente.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    URL.revokeObjectURL(foto)
                    setFoto(null)
                    identificar.reset()
                  }}
                  className="text-acao-600 inline-flex items-center gap-1 text-sm font-medium hover:underline"
                >
                  <X aria-hidden="true" className="size-4" />
                  Trocar foto
                </button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => entradaCamera.current?.click()}
                className="border-borda bg-superficie hover:bg-superficie-2 flex min-h-16 flex-1 items-center justify-center gap-2 rounded-xl border-2 font-semibold"
              >
                <Camera aria-hidden="true" className="size-5" />
                Tirar foto
              </button>
              <button
                type="button"
                onClick={() => entradaGaleria.current?.click()}
                aria-label="Escolher da galeria"
                className="border-borda bg-superficie hover:bg-superficie-2 flex min-h-16 w-16 shrink-0 items-center justify-center rounded-xl border-2"
              >
                <ImagePlus aria-hidden="true" className="size-5" />
              </button>
            </div>
          )}

          {/* `capture` abre a câmera traseira direto no celular; no
              computador é ignorado, e por isso existe o segundo botão. */}
          <input
            ref={entradaCamera}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => escolherFoto(e.target.files?.[0])}
          />
          <input
            ref={entradaGaleria}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => escolherFoto(e.target.files?.[0])}
          />

          <p className="text-texto-suave mt-2 text-xs">
            A foto viaja até o servidor para comparar com o catálogo, mas não
            fica gravada em lugar nenhum — some assim que a comparação termina.
          </p>
        </section>

        {/* 2 — Medida da seção: o caminho principal, porque é o que a
            oficina consegue fazer — trena tem em todo banco de serra. */}
        <section>
          <h2 className="mb-2 font-semibold">
            Medida da ponta{' '}
            <span className="text-texto-suave font-normal">
              (o que mais estreita a lista)
            </span>
          </h2>

          {/* Um campo só, e não quatro: `type="text"` sem `inputMode`
              restrito, porque o teclado numérico do celular esconde a
              barra de espaço — e aqui o espaço é o separador. */}
          <CampoTexto
            rotulo="Medidas (mm)"
            type="text"
            placeholder="Ex.: 35 25 2 1"
            value={medidasTexto}
            onChange={(e) => setMedidasTexto(e.target.value)}
          />

          <p className="text-texto-suave mt-2 text-sm">
            Digite as medidas separadas por espaço — por exemplo,{' '}
            <strong>35 25 2 1</strong> para uma peça com essas quatro medidas
            de seção (não o comprimento da peça). A ordem não importa, e não
            precisa informar todas — mesmo uma medida já ajuda a estreitar a
            lista.
          </p>
        </section>

        {/* 3 — Peso: fica recolhido, porque depende de balança, que a
            oficina não tem. Continua aqui para quem tiver. */}
        <section>
          <button
            type="button"
            onClick={() => setMostrarPeso((v) => !v)}
            aria-expanded={mostrarPeso}
            className="text-acao-600 text-sm font-medium hover:underline"
          >
            {mostrarPeso
              ? 'Esconder identificação por peso'
              : 'Tenho balança: identificar pelo peso'}
          </button>

          {mostrarPeso && (
            <div className="mt-3 flex flex-col gap-4">
              <CampoTexto
                rotulo="Peso da peça (gramas)"
                type="text"
                inputMode="decimal"
                placeholder="0"
                value={pesoTexto}
                onChange={(e) => setPesoTexto(e.target.value)}
                ajuda="Pese a peça inteira, do jeito que ela está."
              />

              <CampoMedida
                rotulo="Comprimento da peça"
                texto={comprimentoTexto}
                unidade={unidade}
                aoMudarTexto={setComprimentoTexto}
                aoMudarUnidade={setUnidade}
              />
            </div>
          )}
        </section>

        {/* 3 — Linha */}
        <CampoSelecao
          rotulo="Linha (opcional, mas ajuda muito)"
          value={linha}
          onChange={(e) => setLinha(e.target.value)}
        >
          <option value="">Todas as linhas</option>
          {linhas.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </CampoSelecao>
      </div>

      {medido !== null && (
        <p className="bg-aluminio-100 text-grafite-800 mb-4 rounded-xl px-4 py-3 text-sm">
          Esta peça tem <strong>{Math.round(medido)} g por metro</strong> —
          seção de aproximadamente{' '}
          <strong>{formatarAreaSecao(areaSecaoMm2(medido)!)}</strong> de
          alumínio.
        </p>
      )}

      {filtrouAlgo && candidatos.length === 0 && (
        <div className="bg-superficie-2 text-texto-suave rounded-xl p-5 text-sm">
          <p className="mb-2">
            <strong>Nenhum perfil compatível.</strong>
          </p>
          <p>
            Confira as medidas. Se estiverem certas, pode ser um perfil ainda
            sem medida no catálogo — {semMedida}{' '}
            {semMedida === 1 ? 'está assim' : 'estão assim'} neste recorte.
            Tente escolher só a linha e conferir os desenhos.
          </p>
        </div>
      )}

      {candidatos.length > 0 && (
        <section aria-live="polite">
          <h2 className="mb-1 font-semibold">
            {candidatos.length}{' '}
            {candidatos.length === 1
              ? 'perfil compatível'
              : 'perfis compatíveis'}
          </h2>
          <p className="text-texto-suave mb-3 flex items-start gap-1.5 text-sm">
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            Compare o desenho com a ponta antes de escolher. A medida estreita a
            lista; quem decide é o desenho.
          </p>

          <ul className="flex flex-col gap-2">
            {candidatos.map(({ perfil, nota, parecencaFoto }) => (
              <li key={perfil.id}>
                <Link
                  to={destinoDo(perfil.id)}
                  className="bg-celula hover:bg-celula border-borda flex items-center gap-3 rounded-xl border-2 p-3 shadow-sm"
                >
                  {/* A foto da ponta ao lado do desenho: é a comparação que
                      antes obrigava a sair da tela com a peça na mão. */}
                  {foto && (
                    <img
                      src={foto}
                      alt=""
                      className="border-borda size-14 shrink-0 rounded-lg border object-cover"
                    />
                  )}

                  <MiniaturaPerfil
                    link={capas?.get(perfil.id)}
                    codigo={perfil.codigo}
                  />

                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      <span className="text-acao-600 font-mono">
                        {perfil.codigo}
                      </span>{' '}
                      {perfil.descricao}
                    </span>
                    <span className="text-texto-suave block truncate text-sm">
                      {perfil.linha && `${perfil.linha} · `}
                      {/* Todas as medidas conhecidas, não só as duas
                          derivadas: é exatamente aqui que a pessoa compara
                          com o que a trena deu. */}
                      {formatarMedidasSecao(perfil) ?? 'sem medida no catálogo'}
                    </span>
                    {(nota || parecencaFoto !== null) && (
                      <span className="text-texto-suave block text-xs">
                        {parecencaFoto !== null && (
                          <span className="text-acao-600 font-medium">
                            {parecencaFoto}% parecido na foto
                          </span>
                        )}
                        {nota && parecencaFoto !== null && ' · '}
                        {nota}
                      </span>
                    )}
                  </span>

                  <ChevronRight
                    aria-hidden="true"
                    className="text-texto-suave size-4 shrink-0"
                  />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!filtrouAlgo && (
        <p className="bg-superficie-2 text-texto-suave rounded-xl p-5 text-center text-sm">
          Meça a ponta com a trena e informe os dois lados, ou escolha uma
          linha, para ver os perfis compatíveis.
        </p>
      )}

      {ampliada && (
        <VisualizadorImagem
          src={ampliada}
          alt="Ponta do perfil, ampliada"
          aoFechar={() => setAmpliada(null)}
        />
      )}
    </div>
  )
}
