import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Camera, ImagePlus, X, ChevronRight, Info, Search } from 'lucide-react'
import {
  useModelosPerfil,
  useOrdemLinhas,
  agruparPorLinha,
  SEM_LINHA,
} from '@/dados/modelosPerfil'
import { useCapasDesenhos } from '@/dados/desenhosTecnicos'
import {
  useIdentificarPorFoto,
  useCompararDesenhosTecnicos,
} from '@/dados/identificacaoPorFoto'
import { useConfiguracoes } from '@/dados/configuracoes'
import { MiniaturaPerfil } from '@/componentes/MiniaturaPerfil'
import { Botao } from '@/componentes/ui/Botao'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { CampoTexto } from '@/componentes/ui/CampoTexto'
import { CampoSelecao } from '@/componentes/ui/CampoSelecao'
import { CampoMedida } from '@/componentes/ui/CampoMedida'
import { VisualizadorImagem } from '@/componentes/ui/VisualizadorImagem'
import { ComparacaoFotoDesenho } from '@/componentes/ui/ComparacaoFotoDesenho'
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
 * A tela junta os caminhos que a pessoa tem à mão, um card por caminho:
 *
 * • A FOTO da ponta, comparada por IA com o catálogo.
 * • A TRENA — mede-se a seção da ponta e o app estreita os 82 perfis a
 *   poucos. Só funciona porque as medidas da seção foram DERIVADAS do peso
 *   e do desenho de cada perfil (ver `scripts/calcular-secao.mjs`) —
 *   ninguém digitou 82 fichas. O PESO mora dentro deste mesmo card,
 *   recolhido, como outro jeito de medir a mesma coisa para quem tem
 *   balança.
 * • A LINHA, sozinha já filtra, mesmo sem nenhuma medida.
 *
 * A busca só roda quando a pessoa aperta "Buscar" — preencher um campo (ou
 * escolher a foto) não dispara nada sozinho. Antes disparava a cada
 * digitação, e a lista pulando embaixo do dedo enquanto ainda se está
 * pensando no que digitar não parecia busca, parecia a tela com pressa.
 *
 * Em nenhum caso o app decide sozinho: ele estreita a lista e mostra o
 * desenho. Cadastrar sobra no perfil errado é pior do que não cadastrar — a
 * peça aparece na busca de outro perfil e manda alguém à prateleira à toa.
 */
export default function IdentificarPerfil() {
  const { data: modelos } = useModelosPerfil()
  const { data: capas } = useCapasDesenhos('imagem')
  const { data: ordemLinhas } = useOrdemLinhas()
  const { data: config } = useConfiguracoes()
  // 60 é só o retrato do padrão do banco enquanto a configuração ainda não
  // chegou — a fonte de verdade é sempre `config`, ajustável em
  // "Configurações do cálculo".
  const limiteSemelhancaDesenho =
    config?.limite_semelhanca_desenho_percentual ?? 60

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
  // Toque na foto ou no desenho de um candidato: os dois lado a lado, em
  // destaque — só o desenho muda por candidato, a foto é sempre a mesma.
  const [comparando, setComparando] = useState<{
    desenho: string | null | undefined
    titulo: string
  } | null>(null)
  const identificar = useIdentificarPorFoto()
  const compararDesenhos = useCompararDesenhosTecnicos()
  /*
   * Semelhança por DESENHO TÉCNICO com o perfil de maior confiança na
   * busca por foto — só existe quando essa confiança passa de 95%. `null`
   * quer dizer "sem esse refinamento": mostra a lista inteira, sem cortar
   * nada por desenho.
   */
  const [desenhosParecidos, setDesenhosParecidos] = useState<Map<
    string,
    number
  > | null>(null)
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

  // O arquivo da foto fica separado do preview: precisa dele intacto para
  // mandar para a IA só quando "Buscar" for apertado — escolher a foto não
  // dispara mais a comparação sozinha.
  const [arquivoFoto, setArquivoFoto] = useState<File | null>(null)

  /*
   * O que a busca de verdade usou — só existe depois do primeiro "Buscar".
   * Preencher um campo muda o que está NA TELA, não o que foi BUSCADO: os
   * resultados ficam parados com o que valia no último clique, em vez de
   * pular sozinhos a cada tecla. Segura uma cópia dos campos no momento do
   * clique, não os campos ao vivo.
   */
  const [criterios, setCriterios] = useState<{
    medidasTexto: string
    pesoTexto: string
    comprimentoTexto: string
    unidade: UnidadeMedida
    linha: string
  } | null>(null)

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
    setArquivoFoto(arquivo)

    // Só troca a foto na tela — a comparação com o catálogo espera o
    // "Buscar". `reset()` limpa qualquer resultado de uma foto anterior,
    // que senão ficaria exibido junto da nova sem fazer sentido.
    identificar.reset()
  }

  function trocarFoto() {
    if (foto) URL.revokeObjectURL(foto)
    setFoto(null)
    setArquivoFoto(null)
    identificar.reset()
  }

  function buscar() {
    setCriterios({ medidasTexto, pesoTexto, comprimentoTexto, unidade, linha })
    // Limpa o refinamento por desenho de uma busca anterior — senão, por um
    // instante, os candidatos novos ficariam filtrados pelo perfil de
    // referência de outra busca, antes de a de agora terminar.
    setDesenhosParecidos(null)

    if (arquivoFoto) {
      identificar.reset()
      identificar.mutate(arquivoFoto)
    }
  }

  function parseMedidas(texto: string): number[] {
    // Vírgula é como se escreve 23,8 aqui; "x" e "×" também separam, porque
    // é como a medida vem escrita em desenho ("35x25"). Texto vazio ou um
    // pedaço que não vira número é descartado, junto com zero e negativo.
    return texto
      .trim()
      .replace(/[x×]/g, ' ')
      .split(/\s+/)
      .map((t) => Number(t.replace(',', '.')))
      .filter((n) => Number.isFinite(n) && n > 0)
  }

  // Ao vivo, só para habilitar o botão — reflete o que está nos campos
  // agora, mesmo antes de qualquer busca.
  const pesoGDigitado = Number(pesoTexto.replace(',', '.'))
  const comprimentoMmDigitado = interpretarMedidaDigitada(
    comprimentoTexto,
    unidade,
  )
  const podeBuscar =
    parseMedidas(medidasTexto).length > 0 ||
    (Number.isFinite(pesoGDigitado) &&
      pesoGDigitado > 0 &&
      comprimentoMmDigitado !== null) ||
    linha !== '' ||
    foto !== null

  // O que a busca usou de verdade — congelado em `criterios` no momento do
  // clique, não os campos ao vivo acima.
  const medidas = criterios ? parseMedidas(criterios.medidasTexto) : []
  const mediuSecao = medidas.length > 0

  const pesoG = criterios ? Number(criterios.pesoTexto.replace(',', '.')) : NaN
  const comprimentoMm = criterios
    ? interpretarMedidaDigitada(criterios.comprimentoTexto, criterios.unidade)
    : null
  const pesouPeca =
    Number.isFinite(pesoG) && pesoG > 0 && comprimentoMm !== null
  const medido = pesouPeca ? pesoPorMetroDePeca(pesoG, comprimentoMm!) : null
  const linhaBuscada = criterios?.linha ?? ''

  const linhas = agruparPorLinha(modelos ?? [], ordemLinhas)
    .map((g) => g.linha)
    .filter((l) => l !== SEM_LINHA)

  const universo = (modelos ?? []).filter(
    (m) => linhaBuscada === '' || (m.linha?.trim() || SEM_LINHA) === linhaBuscada,
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
      : linhaBuscada !== ''
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
  // Já apertou "Buscar" pelo menos uma vez — é isso que decide entre mostrar
  // resultado e mostrar a mensagem inicial, não o que está nos campos agora.
  const buscou = criterios !== null

  /*
   * Refinamento por desenho técnico: quando a foto acerta um perfil com
   * confiança ≥95%, os OUTROS candidatos da tela são comparados pelo
   * próprio desenho técnico com esse perfil de maior confiança — só quem
   * passa de 90% de semelhança continua na lista. Sem isso, um perfil
   * levemente parecido na foto mas visualmente bem diferente no desenho
   * ficaria na lista só por ter batido na medida ou na linha.
   */
  useEffect(() => {
    if (!buscou || identificar.isPending) return

    let idReferencia: string | null = null
    let maiorParecenca = -1
    for (const c of candidatos) {
      if (c.parecencaFoto !== null && c.parecencaFoto > maiorParecenca) {
        maiorParecenca = c.parecencaFoto
        idReferencia = c.perfil.id
      }
    }

    if (idReferencia === null || maiorParecenca < 95) {
      setDesenhosParecidos(null)
      return
    }

    const outrosIds = candidatos
      .filter((c) => c.perfil.id !== idReferencia)
      .map((c) => c.perfil.id)

    if (outrosIds.length === 0) {
      setDesenhosParecidos(null)
      return
    }

    let cancelado = false

    compararDesenhos
      .mutateAsync({ modeloPerfilId: idReferencia, candidatosIds: outrosIds })
      .then((resultado) => {
        if (cancelado) return
        const mapa = new Map(resultado.map((r) => [r.modeloPerfilId, r.parecenca]))
        mapa.set(idReferencia!, 100)
        setDesenhosParecidos(mapa)
      })
      .catch(() => {
        // Não deu para comparar os desenhos — mostra a lista inteira, sem
        // cortar nada, em vez de travar a busca por causa do refinamento.
        if (!cancelado) setDesenhosParecidos(null)
      })

    return () => {
      cancelado = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [criterios, identificar.data, identificar.isPending])

  const candidatosExibidos = desenhosParecidos
    ? candidatos
        .filter(
          (c) => (desenhosParecidos.get(c.perfil.id) ?? 0) >= limiteSemelhancaDesenho,
        )
        // Com o refinamento ativo, quem decide a ordem passa a ser a
        // semelhança de DESENHO com o perfil de referência — não mais a
        // semelhança de foto que veio de `combinarCandidatos`. O perfil de
        // referência (100%) fica sempre em primeiro.
        .sort(
          (a, b) =>
            (desenhosParecidos.get(b.perfil.id) ?? 0) -
            (desenhosParecidos.get(a.perfil.id) ?? 0),
        )
    : candidatos

  // Quem foi o perfil de referência do refinamento (marcado com 100% na
  // hora de montar o mapa) — só para exibir o código dele ao lado da
  // semelhança de desenho de cada candidato.
  const referenciaDesenho = desenhosParecidos
    ? (candidatos.find((c) => desenhosParecidos.get(c.perfil.id) === 100)
        ?.perfil ?? null)
    : null

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-6">
      <BotaoVoltar para="/mais" rotulo="Mais" className="mb-4" />

      <header className="mb-5">
        <h1 className="text-2xl font-bold">Identificar perfil</h1>
        <p className="text-texto-suave mt-1 text-sm">
          Para a ponta que perdeu a etiqueta.
        </p>
      </header>

      <div className="mb-6 flex flex-col gap-4">
        {/* 1 — Foto da ponta */}
        <section className="bg-grupo-azul rounded-2xl p-4">
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
                  Ao apertar "Buscar", uma IA compara esta foto com as fotos e
                  desenhos técnicos do catálogo.
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
                  onClick={trocarFoto}
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
            Uma inteligência artificial calcula as características da foto e
            compara com as fotos e desenhos técnicos do catálogo, também já
            processados por IA. A imagem não fica gravada em lugar nenhum —
            some assim que a comparação termina.
          </p>
        </section>

        {/* 2 — Medida da seção (trena) e peso, no mesmo card: são dois
            jeitos de medir a mesma coisa. A trena é o caminho principal,
            porque é o instrumento que a oficina realmente tem. */}
        <section className="bg-grupo-amarelo rounded-2xl p-4">
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
            Digite as medidas separadas por espaço em qualquer ordem
          </p>

          {/* Peso: recolhido, porque depende de balança, que a oficina não
              tem — mas é outro jeito de medir a mesma seção, então mora
              aqui dentro, não num card à parte. */}
          <div className="border-borda mt-4 border-t pt-4">
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
          </div>
        </section>

        {/* 3 — Linha */}
        <section className="bg-grupo-lilas rounded-2xl p-4">
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
        </section>
      </div>

      <Botao
        onClick={buscar}
        disabled={!podeBuscar}
        carregando={identificar.isPending}
        tamanho="largura_total"
        className="mb-6"
      >
        <Search aria-hidden="true" className="size-5" />
        Buscar perfis compatíveis
      </Botao>

      {medido !== null && (
        <p className="bg-aluminio-100 text-grafite-800 mb-4 rounded-xl px-4 py-3 text-sm">
          Esta peça tem <strong>{Math.round(medido)} g por metro</strong> —
          seção de aproximadamente{' '}
          <strong>{formatarAreaSecao(areaSecaoMm2(medido)!)}</strong> de
          alumínio.
        </p>
      )}

      {identificar.isPending && candidatosExibidos.length === 0 && (
        <p className="text-texto-suave mb-4 text-sm">
          Comparando a foto com o catálogo…
        </p>
      )}

      {buscou && !identificar.isPending && candidatosExibidos.length === 0 && (
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

      {candidatosExibidos.length > 0 && (
        <section aria-live="polite">
          <h2 className="mb-1 font-semibold">
            {candidatosExibidos.length}{' '}
            {candidatosExibidos.length === 1
              ? 'perfil compatível'
              : 'perfis compatíveis'}
          </h2>
          <p className="text-texto-suave mb-3 flex items-start gap-1.5 text-sm">
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            {desenhosParecidos ? (
              <span>
                A foto achou um perfil com confiança alta — a lista já foi
                restrita a quem tem desenho técnico pelo menos{' '}
                {limiteSemelhancaDesenho}% parecido com o dele (ajustável em
                Configurações do cálculo). Ainda assim, compare o desenho com
                a ponta antes de escolher.
              </span>
            ) : (
              'Compare o desenho com a ponta antes de escolher. A medida estreita a lista; quem decide é o desenho.'
            )}
          </p>

          <ul className="flex flex-col gap-2">
            {candidatosExibidos.map(({ perfil, nota, parecencaFoto }) => (
              <li
                key={perfil.id}
                className="bg-celula border-borda flex items-center gap-3 rounded-xl border-2 p-3 shadow-sm"
              >
                {/* Foto e desenho ficam FORA do link que abre a ficha do
                    perfil — tocar neles compara os dois em destaque, não
                    navega. Um botão só (não dois) porque é a MESMA
                    comparação, e um alvo de toque maior erra menos. */}
                {foto ? (
                  <button
                    type="button"
                    onClick={() =>
                      setComparando({
                        desenho: capas?.get(perfil.id),
                        titulo: `${perfil.codigo} ${perfil.descricao}`,
                      })
                    }
                    aria-label={`Comparar foto da ponta com o desenho técnico de ${perfil.codigo}`}
                    className="flex shrink-0 gap-1"
                  >
                    <img
                      src={foto}
                      alt=""
                      className="border-borda size-14 shrink-0 rounded-lg border object-cover"
                    />

                    <MiniaturaPerfil
                      link={capas?.get(perfil.id)}
                      codigo={perfil.codigo}
                    />
                  </button>
                ) : (
                  <MiniaturaPerfil
                    link={capas?.get(perfil.id)}
                    codigo={perfil.codigo}
                  />
                )}

                <Link
                  to={destinoDo(perfil.id)}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
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
                    {(() => {
                      // Semelhança de DESENHO com o perfil de referência —
                      // só faz sentido mostrar para os outros perfis, não
                      // para a própria referência (seria 100% com ele mesmo).
                      const parecencaDesenho =
                        desenhosParecidos && perfil.id !== referenciaDesenho?.id
                          ? (desenhosParecidos.get(perfil.id) ?? null)
                          : null

                      if (!nota && parecencaFoto === null && parecencaDesenho === null) {
                        return null
                      }

                      return (
                        <span className="text-texto-suave block text-xs">
                          {parecencaFoto !== null && (
                            <span className="text-acao-600 font-medium">
                              {parecencaFoto}% parecido na foto
                            </span>
                          )}
                          {parecencaDesenho !== null && (
                            <>
                              {parecencaFoto !== null && ' · '}
                              <span className="text-acao-600 font-medium">
                                {parecencaDesenho}% parecido no desenho com{' '}
                                {referenciaDesenho?.codigo}
                              </span>
                            </>
                          )}
                          {nota && (parecencaFoto !== null || parecencaDesenho !== null) && ' · '}
                          {nota}
                        </span>
                      )
                    })()}
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

      {!buscou && (
        <p className="bg-superficie-2 text-texto-suave rounded-xl p-5 text-center text-sm">
          Tire uma foto, meça a ponta com a trena ou escolha uma linha — e
          aperte "Buscar perfis compatíveis".
        </p>
      )}

      {ampliada && (
        <VisualizadorImagem
          src={ampliada}
          alt="Ponta do perfil, ampliada"
          aoFechar={() => setAmpliada(null)}
        />
      )}

      {comparando && foto && (
        <ComparacaoFotoDesenho
          foto={foto}
          desenho={comparando.desenho}
          titulo={comparando.titulo}
          aoFechar={() => setComparando(null)}
        />
      )}
    </div>
  )
}
