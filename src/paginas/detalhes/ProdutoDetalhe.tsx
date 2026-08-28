import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  Plus,
  Trash2,
  ListChecks,
  PackageCheck,
  Pencil,
  ChevronRight,
  ChevronDown,
  FileText,
  GripVertical,
  ArrowDownUp,
  Calculator,
  ClipboardList,
  EyeOff,
} from 'lucide-react'
import {
  useProduto,
  useListaTecnica,
  useRemoverItemLista,
  useEditarItemLista,
  useReordenarLista,
  useEditarProduto,
  type DadosProduto,
} from '@/dados/produtos'
import { useModelosPerfil } from '@/dados/modelosPerfil'
import { useCapasDesenhos } from '@/dados/desenhosTecnicos'
import { MiniaturaPerfil } from '@/componentes/MiniaturaPerfil'
import { VisualizadorImagem } from '@/componentes/ui/VisualizadorImagem'
import { useSobras } from '@/dados/sobras'
import { useAcabamentos } from '@/dados/acabamentos'
import { useConfiguracoes, paraConfiguracaoCorte } from '@/dados/configuracoes'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { podeGerenciarCadastros } from '@/autenticacao/contexto'
import {
  unidadesProduziveis,
  cortesAtendidos,
  chaveDoCorte,
} from '@/dominio/producao'
import { resumirPorPerfil, resumoDe } from '@/dominio/estoqueResumo'
import {
  ordenarLista,
  CRITERIOS,
  type CriterioOrdenacao,
} from '@/dominio/ordenacaoListaTecnica'
import {
  sobrasDisponiveis,
  type FonteMaterial,
} from '@/dominio/estoqueParaProducao'
import {
  calcularListaMateriais,
  type ListaMateriais,
  type ModoCompra,
} from '@/dominio/listaMateriais'
import {
  CORTE_PADRAO,
  SENTIDO_PADRAO,
  corteValido,
  descreverCortes,
  sentidoValido,
  type SentidoMontagem,
  type TipoCorte,
} from '@/dominio/corteMontagem'
import { SeletorCortes } from '@/componentes/produto/SeletorCortes'
import { formatarMedidaProduto, nomeDoArquivo } from '@/dominio/produto'
import {
  formatarComprimento,
  interpretarMedidaDigitada,
  validarComprimento,
} from '@/dominio/medidas'
import { CONFIGURACAO_CORTE_PADRAO } from '@/dominio/corte'
import { obterLinkTemporario, BALDE_IMAGENS_PRODUTO } from '@/lib/armazenamento'
import { imprimirFolha, imprimeNoNativo } from '@/lib/impressao'
import { PaginaDetalhe, FichaDados } from '@/componentes/PaginaDetalhe'
import { EstadoConsulta } from '@/componentes/EstadoConsulta'
import { Botao } from '@/componentes/ui/Botao'
import { CampoTexto } from '@/componentes/ui/CampoTexto'
import { CampoSugestao } from '@/componentes/ui/CampoSugestao'
import { CampoQuantidade } from '@/componentes/ui/CampoQuantidade'
import { useArrastarParaOrdenar } from '@/componentes/ui/useArrastarParaOrdenar'
import { cn } from '@/lib/utilitarios'
import { Modal } from '@/componentes/ui/Modal'
import { Veredito } from '@/componentes/Veredito'
import { FormularioProduto } from '@/componentes/produto/FormularioProduto'
import { FolhaProduto } from '@/componentes/produto/FolhaProduto'
import { FolhaListaMateriais } from '@/componentes/produto/FolhaListaMateriais'
import type { ItemListaTecnica } from '@/tipos/banco'
import { APLICACAO } from '@/config/aplicacao'
import { disparar } from '@/lib/avisoErro'

export default function ProdutoDetalhe() {
  const { id = null } = useParams()
  const navegar = useNavigate()
  const { perfil } = useAutenticacao()
  const podeEditar = podeGerenciarCadastros(perfil)

  const consulta = useProduto(id)
  const produto = consulta.data ?? null

  const { data: itens } = useListaTecnica(id)
  const { data: modelos } = useModelosPerfil()
  const { data: capas } = useCapasDesenhos('imagem')
  const { data: sobras } = useSobras()
  const { data: acabamentos } = useAcabamentos()
  const { data: config } = useConfiguracoes()

  const remover = useRemoverItemLista()
  const editarItem = useEditarItemLista()
  const reordenar = useReordenarLista()
  const editar = useEditarProduto()

  const [editando, setEditando] = useState(false)
  const [formProduto, setFormProduto] = useState<DadosProduto | null>(null)
  const [erroProduto, setErroProduto] = useState<string | null>(null)

  const [aberto, setAberto] = useState(false)
  /*
   * O corte em correção. Acrescentar um corte novo mudou para uma tela
   * própria (`AcrescentarMaterial.tsx`), com a mesma busca por linha da
   * tela de Estoque — este modal ficou só para corrigir um já lançado.
   */
  const [itemEditando, setItemEditando] = useState<ItemListaTecnica | null>(
    null,
  )
  const [form, setForm] = useState({
    modelo_perfil_id: '',
    comprimento_mm: '',
    quantidade: '1',
    sentido: SENTIDO_PADRAO as SentidoMontagem,
    corte_inicio: CORTE_PADRAO as TipoCorte,
    corte_fim: CORTE_PADRAO as TipoCorte,
  })
  const [erro, setErro] = useState<string | null>(null)
  const [ampliado, setAmpliado] = useState<string | null>(null)
  /*
   * Os links das imagens ficam AQUI, e não dentro do componente que as
   * exibe: a folha de impressão precisa dos mesmos endereços, e pedir duas
   * vezes ao armazenamento geraria dois links temporários para o mesmo
   * arquivo — o dobro de espera antes de imprimir.
   */
  const [linkFoto, setLinkFoto] = useState<string | null>(null)
  const [linkDesenho, setLinkDesenho] = useState<string | null>(null)
  /*
   * Qual folha está montada para impressão — nunca as duas, porque o efeito
   * abaixo procura `#folha-impressao` e duas folhas com o mesmo id
   * imprimiriam a que aparecesse primeiro no documento, não a pedida.
   */
  const [imprimindo, setImprimindo] = useState<'produto' | 'materiais' | null>(
    null,
  )
  /*
   * O texto digitado é guardado à parte do id escolhido: enquanto a pessoa
   * digita "MN-0", nenhum perfil está selecionado ainda, e forçar o id a
   * acompanhar cada tecla selecionaria o primeiro parecido sem ela ter
   * pedido.
   */
  const [textoPerfil, setTextoPerfil] = useState('')
  /*
   * Quantas unidades se quer produzir. Padrão 1 porque a pergunta mais
   * comum é "dá para fazer esta janela?" — só quando a resposta é sim é que
   * se pergunta "e três?".
   */
  const [desejada, setDesejada] = useState(1)
  /*
   * Ligado por padrão porque é a verdade da oficina: ninguém entrega uma
   * janela com o marco branco e a folha preta. Desligar serve para a
   * pergunta anterior — "tenho o material, independente da cor?" —, que é o
   * que se quer saber antes de decidir mandar pintar.
   */
  const [mesmaCor, setMesmaCor] = useState(true)
  /** Acabamento fixado pela pessoa. Nulo = o sistema escolhe o que rende mais. */
  const [corEscolhida, setCorEscolhida] = useState<string | null>(null)
  /*
   * De onde o cálculo pode tirar material. Começa em `tudo` porque é o que
   * o sistema sempre respondeu — e porque a pergunta do dia a dia é "dá para
   * fazer com o que eu tenho?", não "dá sem tocar nas barras novas?".
   */
  const [fonte, setFonte] = useState<FonteMaterial>('tudo')

  /*
   * O resultado do cálculo, guardado com a ASSINATURA das opções que o
   * geraram.
   *
   * ── POR QUE NÃO CALCULA SOZINHO ──────────────────────────────────────
   *
   * Antes, abrir o produto disparava a conta e a tela já dizia "não dá" —
   * mesmo quem só veio conferir uma medida levava o veredito na cara, e o
   * "não dá" de quantidade 1 dizia pouco sobre o pedido real. Agora a
   * pergunta é feita de propósito: ajusta-se quantidade, cor e origem, e
   * só então se pede a resposta.
   *
   * ── POR QUE A ASSINATURA ─────────────────────────────────────────────
   *
   * Mudar a quantidade depois de calcular deixaria na tela uma resposta
   * sobre outra pergunta — o pior dos dois mundos, porque parece atual. Com
   * a assinatura junto, qualquer opção mexida invalida o resultado sozinha,
   * sem efeito nenhum para manter em sincronia.
   */
  const [calculo, setCalculo] = useState<{
    assinaturaOpcoes: string
    assinaturaEstoque: string
    unidades: number
    acabamento_id: string | null
    atendePedido: boolean
    soFaltaAcabamento: boolean
    faltas: {
      modelo_perfil_id: string
      comprimento_mm: number
      faltam: number
    }[]
    atendidos: Map<string, boolean>
  } | null>(null)

  /** A lista de materiais aberta na janela. Nulo = janela fechada. */
  const [materiais, setMateriais] = useState<ListaMateriais | null>(null)
  const [modoCompra, setModoCompra] = useState<ModoCompra>('aproveitar_sobras')
  /*
   * A lista técnica começa RECOLHIDA. Ela pode passar de vinte cortes, e
   * quem abre o produto quase sempre quer a resposta do alto da tela — não
   * rolar três telas de perfil para chegar nos botões.
   */
  const [listaAberta, setListaAberta] = useState(true)

  useEffect(() => {
    const foto = produto?.foto_url ?? null
    const desenho = produto?.desenho_url ?? null

    void Promise.all([
      foto ? obterLinkTemporario(BALDE_IMAGENS_PRODUTO, foto) : null,
      desenho ? obterLinkTemporario(BALDE_IMAGENS_PRODUTO, desenho) : null,
    ]).then(([umaFoto, umDesenho]) => {
      setLinkFoto(umaFoto)
      setLinkDesenho(umDesenho)
    })
  }, [produto?.foto_url, produto?.desenho_url])

  /*
   * Espelho do produto para o efeito de impressão ler sem depender dele.
   *
   * O efeito abaixo precisa do produto (para nomear o arquivo), mas NÃO
   * pode reagir a ele: o React Query devolve um objeto novo a cada
   * revalidação, e `produto` nas dependências faria o efeito rodar de
   * novo no meio de uma impressão em andamento — abrindo o diálogo uma
   * segunda vez sozinho. O ref dá o valor atual sem criar essa amarra.
   */
  const produtoRef = useRef(produto)
  produtoRef.current = produto

  /*
   * Imprimir só DEPOIS que a folha existe na tela.
   *
   * `window.print()` congela a página no estado em que ela está: chamado no
   * mesmo clique que monta a folha, imprimiria a página sem ela. O efeito
   * roda depois da renderização, que é o momento certo.
   */
  useEffect(() => {
    if (!imprimindo) return

    let cancelado = false

    /*
     * Espera as imagens ANTES de imprimir.
     *
     * O diálogo fotografa a página no instante em que abre. Chamado com as
     * imagens ainda chegando — e elas vêm de links temporários do
     * armazenamento, sempre por rede —, ele imprime os buracos onde elas
     * estariam. Era o "sai em branco".
     */
    const folha = document.getElementById('folha-impressao')
    const imagens = folha ? [...folha.querySelectorAll('img')] : []

    const prontas = imagens.map((img) =>
      img.complete
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            // `onerror` também resolve: imagem que não carrega não pode
            // travar a folha inteira — o resto do conteúdo continua útil.
            img.onload = () => resolve()
            img.onerror = () => resolve()
          }),
    )

    /*
     * O nome do arquivo sai do TÍTULO DA PÁGINA.
     *
     * Não existe API para nomear o PDF: o navegador usa o `document.title`
     * como nome sugerido no "Salvar como PDF". Sem isto, todo arquivo saía
     * chamado "RePerfil" e a pasta de downloads virava uma pilha de
     * "RePerfil (1)", "RePerfil (2)" — inúteis para achar a folha de uma
     * janela específica meses depois.
     */
    const tituloOriginal = document.title
    const produtoAtual = produtoRef.current
    const nome = produtoAtual ? nomeDoArquivo(produtoAtual) : tituloOriginal

    document.title = nome

    void Promise.all(prontas).then(() => {
      if (cancelado || !folha) return

      void imprimirFolha(folha, nome)
        .catch((e) => {
          setErro(
            e instanceof Error
              ? `Não foi possível imprimir: ${e.message}`
              : 'Não foi possível imprimir.',
          )
        })
        .finally(() => {
          /*
           * No aplicativo nativo não existe `afterprint`: quem devolve o
           * controle é a promessa do plugin. Sem isto, a folha ficaria
           * montada para sempre e o botão pararia de responder.
           */
          if (imprimeNoNativo()) setImprimindo(null)
        })
    })

    /*
     * A folha só é desmontada DEPOIS que o diálogo fecha.
     *
     * `window.print()` não bloqueia em todo navegador: no Chrome recente ele
     * retorna na hora, e desmontar em seguida tirava a folha da página antes
     * de o diálogo lê-la. Daí a página em branco também no computador.
     */
    const aoTerminar = () => setImprimindo(null)

    window.addEventListener('afterprint', aoTerminar)

    return () => {
      cancelado = true
      document.title = tituloOriginal
      window.removeEventListener('afterprint', aoTerminar)
    }
  }, [imprimindo])

  function abrirEdicao() {
    if (produto === null) return

    setFormProduto({
      codigo: produto.codigo,
      nome: produto.nome,
      descricao: produto.descricao,
      largura_mm: produto.largura_mm,
      altura_mm: produto.altura_mm,
      observacoes: produto.observacoes,
      foto_url: produto.foto_url,
      desenho_url: produto.desenho_url,
    })
    setErroProduto(null)
    setEditando(true)
  }

  async function salvarProduto(evento: FormEvent) {
    evento.preventDefault()
    setErroProduto(null)

    if (produto === null || formProduto === null) return

    if (formProduto.codigo.trim() === '' || formProduto.nome.trim() === '') {
      setErroProduto('Código e nome são obrigatórios.')
      return
    }

    try {
      await editar.mutateAsync({ id: produto.id, dados: formProduto })
      setEditando(false)
    } catch (e) {
      setErroProduto(
        e instanceof Error ? e.message : 'Não foi possível salvar.',
      )
    }
  }

  /*
   * A ordem é gravada só ao SOLTAR, não a cada movimento: arrastar do fim
   * para o começo passaria por todas as posições intermediárias, e cada uma
   * viraria uma ida ao servidor.
   */
  const ordenacao = useArrastarParaOrdenar({
    itens: itens ?? [],
    chave: (item) => item.id,
    aoSoltar: (idsNaOrdem) => disparar(reordenar.mutateAsync(idsNaOrdem)),
  })

  const nomeDoPerfil = (modeloId: string) => {
    const modelo = modelos?.find((m) => m.id === modeloId)

    return modelo ? `${modelo.codigo} ${modelo.descricao}` : 'perfil removido'
  }

  /** "MN-007 — Guia da persiana": o que se lê e o que se digita. */
  function rotuloDoPerfil(modelo: { codigo: string; descricao: string }) {
    return `${modelo.codigo} — ${modelo.descricao}`
  }

  /*
   * Resolve o id a partir do texto. Só casa quando o texto é exatamente o
   * rótulo de um perfil — ou seja, quando a pessoa escolheu da lista ou
   * digitou o nome inteiro. Texto pela metade deixa o id vazio, e o envio
   * avisa que falta escolher.
   */
  function escolherPerfil(texto: string) {
    setTextoPerfil(texto)

    const escolhido = (modelos ?? []).find(
      (modelo) => rotuloDoPerfil(modelo) === texto,
    )

    setForm({ ...form, modelo_perfil_id: escolhido?.id ?? '' })
  }

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)

    // Pelo domínio de medidas, e validado contra a barra do perfil
    // escolhido — mesma correção de `AcrescentarMaterial`, pelo mesmo
    // motivo: um corte não pode ser maior que a peça de onde ele sai.
    const comprimento = interpretarMedidaDigitada(form.comprimento_mm, 'mm')
    const quantidade = Number(form.quantidade)

    if (form.modelo_perfil_id === '') {
      setErro('Escolha o perfil.')
      return
    }

    if (comprimento === null) {
      setErro('Informe o comprimento do corte, em milímetros.')
      return
    }

    const perfilEscolhido = (modelos ?? []).find(
      (m) => m.id === form.modelo_perfil_id,
    )
    const validacao = validarComprimento(
      comprimento,
      perfilEscolhido?.comprimento_barra_mm,
    )

    if (!validacao.valido) {
      setErro(validacao.mensagem)
      return
    }

    if (!Number.isInteger(quantidade) || quantidade <= 0) {
      setErro('A quantidade por unidade precisa ser um número inteiro.')
      return
    }

    if (id === null || itemEditando === null) return

    try {
      await editarItem.mutateAsync({
        id: itemEditando.id,
        dados: {
          modelo_perfil_id: form.modelo_perfil_id,
          comprimento_mm: comprimento,
          quantidade,
          sentido: form.sentido,
          corte_inicio: form.corte_inicio,
          corte_fim: form.corte_fim,
          observacao: itemEditando.observacao,
        },
      })

      fecharCorte()
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.')
    }
  }

  function abrirCorte(item: ItemListaTecnica) {
    const perfil = modelos?.find((m) => m.id === item.modelo_perfil_id)

    setItemEditando(item)
    setTextoPerfil(perfil ? rotuloDoPerfil(perfil) : '')
    setForm({
      modelo_perfil_id: item.modelo_perfil_id,
      comprimento_mm: String(item.comprimento_mm),
      quantidade: String(item.quantidade),
      // Pelo domínio: linha cadastrada antes das colunas existirem chega
      // nula, e o formulário precisa abrir com algo coerente.
      sentido: sentidoValido(item.sentido),
      corte_inicio: corteValido(item.corte_inicio),
      corte_fim: corteValido(item.corte_fim),
    })
    setErro(null)
    setAberto(true)
  }

  function fecharCorte() {
    setAberto(false)
    setItemEditando(null)
    setTextoPerfil('')
    setForm({
      modelo_perfil_id: '',
      comprimento_mm: '',
      quantidade: '1',
      sentido: SENTIDO_PADRAO,
      corte_inicio: CORTE_PADRAO,
      corte_fim: CORTE_PADRAO,
    })
    setErro(null)
  }

  if (consulta.isPending || consulta.error || produto === null) {
    return (
      <PaginaDetalhe
        voltarPara="/produtos"
        rotuloVoltar="Produtos"
        titulo="Produto"
      >
        <EstadoConsulta
          carregando={consulta.isPending}
          erro={consulta.error}
          vazio={produto === null}
          mensagemVazio="Produto não encontrado."
        />
      </PaginaDetalhe>
    )
  }

  const configCorte = config
    ? paraConfiguracaoCorte(config)
    : CONFIGURACAO_CORTE_PADRAO

  const todasDisponiveis = sobrasDisponiveis(sobras ?? [], fonte)

  /*
   * As opções da tela viram uma transformação das sobras, e não um
   * parâmetro novo no cálculo: "ignorar a cor" é o mesmo que dizer que tudo
   * está no mesmo acabamento, e "usar esta cor" é o mesmo que só existir ela
   * no depósito. O cálculo continua com uma regra só.
   */
  const disponiveis = !mesmaCor
    ? todasDisponiveis.map((sobra) => ({ ...sobra, acabamento_id: 'qualquer' }))
    : corEscolhida === null
      ? todasDisponiveis
      : todasDisponiveis.filter((s) => s.acabamento_id === corEscolhida)

  const lista = (itens ?? []).map((item) => ({
    modelo_perfil_id: item.modelo_perfil_id,
    comprimento_mm: item.comprimento_mm,
    quantidade: item.quantidade,
    /*
     * O corte não entra na conta de quantas barras cabem — para o
     * empacotamento só o comprimento importa. Viaja junto porque a folha da
     * lista de materiais também é lida na serra, e comprimento sem
     * esquadria manda a bancada perguntar.
     */
    sentido: sentidoValido(item.sentido),
    corte_inicio: corteValido(item.corte_inicio),
    corte_fim: corteValido(item.corte_fim),
  }))

  /*
   * Tudo que muda a resposta invalida o resultado — inclusive a lista
   * técnica e o depósito. Um veredito que sobrevive à mudança do estoque é
   * pior do que nenhum, porque parece atual.
   *
   * São DUAS assinaturas porque as duas causas pedem recados diferentes:
   * "você mexeu nas opções" é óbvio para quem mexeu, mas "outra pessoa
   * mexeu no estoque" é notícia — e num sistema que várias pessoas usam ao
   * mesmo tempo, dizer "as opções mudaram" quando ninguém tocou nelas seria
   * mentira.
   */
  const assinaturaOpcoes = JSON.stringify({
    desejada,
    mesmaCor,
    corEscolhida,
    fonte,
    lista,
    configCorte,
  })
  const assinaturaEstoque = JSON.stringify(disponiveis)

  const atual =
    calculo?.assinaturaOpcoes === assinaturaOpcoes &&
    calculo.assinaturaEstoque === assinaturaEstoque
      ? calculo
      : null

  /** Roda a conta e guarda a resposta junto das opções que a produziram. */
  function calcular() {
    // Quantas unidades saem no total — é o que o veredito anuncia.
    const resultado = unidadesProduziveis(lista, disponiveis, configCorte)

    /*
     * O pedido inteiro tratado como UMA unidade grande: cada corte
     * multiplicado pela quantidade desejada, e o cálculo perguntado se fecha
     * uma vez.
     *
     * É o que dá as FALTAS certas. Perguntar "quantas unidades saem" devolve
     * o que faltou para a unidade seguinte — informação boa para "dá para
     * mais uma?", inútil para "dá para as cinco que o cliente pediu?".
     */
    const doPedido = lista.map((item) => ({
      ...item,
      quantidade: item.quantidade * desejada,
    }))

    const pedido = unidadesProduziveis(doPedido, disponiveis, configCorte, 1)
    const atendePedido = pedido.unidades >= 1

    /*
     * A cor de cada linha vem do atendimento POR CORTE, não das faltas do
     * pedido. As faltas nascem do cálculo da peça inteira, que exige um
     * único acabamento — e assim um corte com material sobrando na
     * prateleira aparecia em vermelho só porque o acabamento escolhido para
     * a peça era outro. A linha responde por si; o veredito, pela peça.
     */
    const atendidos = cortesAtendidos(doPedido, disponiveis, configCorte)

    setCalculo({
      assinaturaOpcoes,
      assinaturaEstoque,
      unidades: resultado.unidades,
      acabamento_id: resultado.acabamento_id,
      atendePedido,
      faltas: pedido.faltas,
      atendidos,
      /*
       * Todo corte tem material e mesmo assim a peça não sai: é o acabamento
       * que impede. Sem dizer isso, a tela fica incompreensível — tudo verde
       * e um aviso vermelho em cima.
       */
      soFaltaAcabamento:
        mesmaCor &&
        !atendePedido &&
        lista.length > 0 &&
        lista.every((item) => atendidos.get(chaveDoCorte(item)) === true),
    })

    // A lista abre junto: a pergunta seguinte a "não dá" é sempre "o que
    // falta?", e a resposta está nas linhas vermelhas logo abaixo.
    setListaAberta(true)
  }

  /*
   * O comprimento de barra de cada perfil — o que transforma "faltam 8
   * cortes" em "compre 2 barras". Perfil fora do catálogo não tem barra, e a
   * lista de materiais prefere dizer isso a inventar 6 metros.
   */
  const barrasPorPerfil = new Map(
    (modelos ?? []).map((m) => [m.id, m.comprimento_barra_mm]),
  )

  function gerarListaMateriais(modo: ModoCompra) {
    setModoCompra(modo)
    setMateriais(
      calcularListaMateriais(
        lista,
        desejada,
        disponiveis,
        barrasPorPerfil,
        configCorte,
        modo,
      ),
    )
  }

  function imprimirProduto() {
    /*
     * Reimprimir com a folha já montada não dispara o efeito de novo — a
     * dependência não mudaria. Chamar direto cobre o caso de um navegador
     * que não emita `afterprint` e deixe o estado preso em "imprimindo".
     */
    if (imprimindo) {
      const folha = document.getElementById('folha-impressao')

      if (folha && produto) void imprimirFolha(folha, nomeDoArquivo(produto))

      return
    }

    setImprimindo('produto')
  }

  const estoquePorPerfil = resumirPorPerfil(sobras ?? [])

  const nomeAcabamento = (id: string | null | undefined) =>
    acabamentos?.find((a) => a.id === id)?.nome ?? null

  const acabamentoDoResultado = mesmaCor
    ? acabamentos?.find((a) => a.id === atual?.acabamento_id)
    : undefined

  /*
   * Em que cor este material sai — a informação que faltava para a lista
   * virar pedido. "23 barras" sem a cor é meio pedido: o fornecedor
   * pergunta, e quem ligou não sabe responder sem voltar aqui.
   *
   * A cor vem de onde ela realmente foi decidida, nesta ordem: o acabamento
   * de onde as sobras saíram (quando se aproveita o depósito), a cor fixada
   * na tela, ou nada — e nesse caso a folha diz "a definir" em vez de
   * inventar uma.
   */
  const corDaLista = (lista: ListaMateriais): string => {
    if (!mesmaCor) return 'Qualquer cor'

    return (
      nomeAcabamento(lista.acabamento_id) ??
      nomeAcabamento(corEscolhida) ??
      'Cor a definir'
    )
  }

  return (
    <PaginaDetalhe
      voltarPara="/produtos"
      rotuloVoltar="Produtos"
      codigo={produto.codigo}
      titulo={produto.nome}
      subtitulo={formatarMedidaProduto(produto)}
      /*
       * O lápis na linha do nome, e não numa faixa embaixo: editar é uma
       * ação sobre O PRODUTO, e ficava a três dedos do título sem nada a
       * ver com ele. A faixa de ações sumiu junto — com o cálculo agora no
       * cartão e o PDF no cabeçalho da lista, ela não tinha mais o que
       * segurar, e uma faixa vazia é só espaço morto no alto da tela.
       */
      selo={
        podeEditar && (
          <Botao
            variante="secundaria"
            onClick={abrirEdicao}
            aria-label="Editar produto"
            title="Editar"
          >
            <Pencil aria-hidden="true" className="size-4" />
          </Botao>
        )
      }
    >
      {/*
       * As opções ficam JUNTO do botão que as consome.
       *
       * Enquanto a conta era automática, elas viviam na faixa do topo e
       * cada toque disparava um cálculo novo. Agora que a resposta é pedida
       * de propósito, deixá-las longe do botão faria ajustar a cor aqui e
       * procurar o "Calcular" lá em cima — e a faixa do topo, aliviada,
       * volta a ser só o que a peça é.
       */}
      <section className="bg-superficie-2 flex flex-col gap-3 rounded-xl p-4">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {/* A quantidade abre a fileira porque é a primeira decisão: todas
              as outras opções, e as duas contas, respondem sobre ELA. */}
          <label className="flex items-center gap-2">
            <span className="text-texto-suave text-sm">Produzir</span>
            <CampoQuantidade
              valor={desejada}
              aoMudar={setDesejada}
              rotulo="Quantidade a produzir"
              compacto
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-5"
              checked={mesmaCor}
              onChange={(e) => {
                setMesmaCor(e.target.checked)
                // Some a cor fixada junto: ela não significa nada com a
                // regra desligada, e voltaria a valer sozinha ao religar,
                // sem ninguém ter pedido.
                if (!e.target.checked) setCorEscolhida(null)
              }}
            />
            Mesma cor
          </label>

          {/* Só aparece quando a cor importa. Um seletor inerte ao lado de
              uma opção desligada convida a mexer no que não tem efeito. */}
          {mesmaCor && (
            /* `appearance-none` mais a seta desenhada, como no CampoSelecao:
               no iPhone o Safari desenha o `<select>` com o controle nativo,
               ignora a altura pedida e mostra as duas setinhas opostas dele. */
            <div className="relative w-full sm:w-auto sm:min-w-40">
              <select
                value={corEscolhida ?? ''}
                onChange={(e) => setCorEscolhida(e.target.value || null)}
                aria-label="Cor a considerar"
                className="border-borda bg-superficie h-11 w-full appearance-none rounded-xl border-2 pr-9 pl-3 text-sm"
              >
                <option value="">Melhor cor</option>
                {acabamentos?.map((acabamento) => (
                  <option key={acabamento.id} value={acabamento.id}>
                    {acabamento.nome}
                  </option>
                ))}
              </select>

              <ChevronDown
                aria-hidden="true"
                className="text-texto-suave pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2"
              />
            </div>
          )}

          {/* "Dá para fazer sem gastar barra nova?" é outra pergunta, e a
              mais valiosa quando o objetivo é limpar o depósito de retalho
              antes de comprar. */}
          <div className="relative w-full sm:w-auto sm:min-w-48">
            <select
              value={fonte}
              onChange={(e) => setFonte(e.target.value as FonteMaterial)}
              aria-label="Material a considerar"
              className="border-borda bg-superficie h-11 w-full appearance-none rounded-xl border-2 pr-9 pl-3 text-sm"
            >
              <option value="tudo">Sobras e barras novas</option>
              <option value="so_sobras">Só sobras</option>
            </select>

            <ChevronDown
              aria-hidden="true"
              className="text-texto-suave pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Botao
            onClick={calcular}
            disabled={(itens ?? []).length === 0}
            className="flex-1"
          >
            <Calculator aria-hidden="true" className="size-5" />
            {atual ? 'Calcular de novo' : 'Dá para produzir?'}
          </Botao>

          {/* Desfaz o cálculo por inteiro — veredito, cores da lista e a
              lista aberta —, e não só esconde o quadro. Meio caminho seria
              pior: linhas verdes e vermelhas sem o veredito que as explica
              deixariam a tela afirmando algo que ninguém consegue ler. */}
          {atual && (
            <Botao
              variante="secundaria"
              onClick={() => {
                setCalculo(null)
                setListaAberta(false)
              }}
            >
              <EyeOff aria-hidden="true" className="size-5" />
              Ocultar
            </Botao>
          )}

          <Botao
            variante="secundaria"
            onClick={() => gerarListaMateriais(modoCompra)}
            disabled={(itens ?? []).length === 0}
            className="flex-1"
          >
            <ClipboardList aria-hidden="true" className="size-5" />
            Lista de materiais
          </Botao>
        </div>

        {/*
         * Sem resultado, a tela diz o que fazer em vez de mostrar um vazio.
         * Antes o veredito aparecia sozinho ao abrir o produto: quem só veio
         * conferir uma medida levava um "não dá" que nem tinha perguntado.
         */}
        {atual === null && (itens ?? []).length > 0 && (
          <p className="text-texto-suave text-sm">
            {calculo === null
              ? 'Ajuste a quantidade e as opções acima, e peça a conta.'
              : calculo.assinaturaOpcoes !== assinaturaOpcoes
                ? 'As opções mudaram desde o último cálculo. Peça a conta de novo.'
                : 'O estoque mudou desde o último cálculo. Peça a conta de novo.'}
          </p>
        )}
      </section>

      {atual && (
        <Veredito
          unidades={atual.unidades}
          desejada={desejada}
          atendePedido={atual.atendePedido}
          soFaltaAcabamento={atual.soFaltaAcabamento}
          acabamento={acabamentoDoResultado?.nome ?? null}
          semReceita={(itens ?? []).length === 0}
          faltas={atual.faltas.map((falta) => ({
            ...falta,
            perfil: nomeDoPerfil(falta.modelo_perfil_id),
          }))}
        />
      )}

      <section>
        {/*
         * Recolhida por padrão: a lista passa de vinte cortes com facilidade,
         * e quem abre o produto quase sempre quer o alto da tela — não rolar
         * três telas de perfil para chegar nos botões. A contagem no título
         * evita ter de abrir só para saber se há algo lá dentro.
         */}
        {/* Emoldurado: recolhido, o rótulo sozinho no meio da tela não
            parecia clicável — a moldura é o que diz que ali há algo a
            abrir. Aberto, ela vira o topo da lista. */}
        {/* O PDF fica FORA do botão que recolhe: um botão dentro de outro é
            HTML inválido, e o toque acabaria abrindo a lista em vez de
            imprimir. Por isso a moldura é da fileira, não do botão. */}
        <div
          className={cn(
            'border-borda bg-superficie-2 flex items-center border pr-2',
            listaAberta ? 'mb-0 rounded-t-xl' : 'mb-2 rounded-xl',
          )}
        >
          <button
            type="button"
            onClick={() => setListaAberta(!listaAberta)}
            aria-expanded={listaAberta}
            className="flex min-w-0 flex-1 items-center gap-2 p-3 text-left font-semibold"
          >
            <ListChecks aria-hidden="true" className="size-4 shrink-0" />
            <span className="min-w-0 flex-1">
              Lista técnica
              {(itens ?? []).length > 0 && (
                <span className="text-texto-suave ml-1.5 font-normal">
                  ({itens?.length}{' '}
                  {itens?.length === 1 ? 'componente' : 'componentes'})
                </span>
              )}
            </span>
            <ChevronDown
              aria-hidden="true"
              className={cn(
                'size-4 shrink-0 transition-transform',
                listaAberta && 'rotate-180',
              )}
            />
          </button>

          {/* A folha impressa É a lista técnica, com o desenho grande de
              cada perfil para conferir na bancada. O botão pertence a este
              cabeçalho mais do que pertencia ao alto da tela. */}
          <Botao
            variante="secundaria"
            tamanho="icone_pequeno"
            onClick={imprimirProduto}
            aria-label="Gerar PDF do produto"
            title="Gerar PDF"
            className="ml-2 shrink-0"
          >
            <FileText aria-hidden="true" className="size-4" />
          </Botao>
        </div>

        {listaAberta && (
          /* Continua a moldura do rótulo: sem as bordas laterais, a lista
             aberta parecia solta embaixo de um cabeçalho que não era dela. */
          <div className="border-borda rounded-b-xl border-x border-b p-3">
            <p className="text-texto-suave mb-2 text-sm">
              O que entra em UMA unidade. Os comprimentos são de corte, já com
              os descontos que a oficina aplica.
            </p>

            {/* Ordenar automático não briga com arrastar: a regra organiza uma
            lista recém-digitada de vinte cortes num toque, e o arrastar
            ajusta o que ficou fora de lugar. Reescreve a ordem GRAVADA —
            fosse só visual, a folha impressa sairia diferente da tela. */}
            {podeEditar && (itens ?? []).length > 1 && (
              <div className="mb-3 flex items-center gap-2">
                <ArrowDownUp
                  aria-hidden="true"
                  className="text-texto-suave size-4 shrink-0"
                />
                <div className="relative flex-1 sm:max-w-72">
                  <select
                    value=""
                    onChange={(e) => {
                      const criterio = e.target.value as CriterioOrdenacao

                      if (!criterio) return

                      const ordenados = ordenarLista(itens ?? [], criterio, {
                        modelos: modelos ?? [],
                        pecasPorPerfil: new Map(
                          [...estoquePorPerfil].map(([id, r]) => [id, r.pecas]),
                        ),
                      })

                      disparar(
                        reordenar.mutateAsync(ordenados.map((i) => i.id)),
                      )
                      // Volta ao rótulo neutro: o campo é um comando, não um
                      // estado — a lista pode ser arrastada depois, e deixá-lo
                      // marcado diria que ela ainda segue aquela regra.
                      e.target.value = ''
                    }}
                    aria-label="Ordenar a lista automaticamente"
                    className="border-borda bg-superficie h-11 w-full appearance-none rounded-xl border-2 pr-9 pl-3 text-sm"
                  >
                    <option value="">Ordenar automaticamente por…</option>
                    {CRITERIOS.map((c) => (
                      <option key={c.valor} value={c.valor}>
                        {c.rotulo}
                      </option>
                    ))}
                  </select>

                  <ChevronDown
                    aria-hidden="true"
                    className="text-texto-suave pointer-events-none absolute top-1/2 right-2.5 size-4 -translate-y-1/2"
                  />
                </div>
              </div>
            )}

            {(itens ?? []).length === 0 ? (
              <p className="bg-superficie-2 text-texto-suave rounded-xl p-4 text-sm">
                Sem lista técnica ainda. Sem ela o sistema não tem como dizer se
                dá para fabricar este produto com as sobras.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {ordenacao.itensVisiveis.map((item, indice) => {
                  const desenho = capas?.get(item.modelo_perfil_id)
                  const estoque = resumoDe(
                    estoquePorPerfil,
                    item.modelo_perfil_id,
                  )
                  /*
                   * Sem cálculo, a linha não opina. Verde e vermelho são a
                   * resposta de uma pergunta que ninguém fez ainda — e a lista
                   * inteira vermelha ao abrir o produto assustava sem motivo,
                   * já que o padrão de uma unidade quase nunca é o pedido real.
                   */
                  const situacao = !atual
                    ? 'neutra'
                    : atual.atendidos.get(chaveDoCorte(item)) === true
                      ? 'ok'
                      : 'falta'
                  const modeloItem = modelos?.find(
                    (m) => m.id === item.modelo_perfil_id,
                  )

                  return (
                    <li
                      key={item.id}
                      ref={ordenacao.registrar(item.id)}
                      className={cn(
                        'flex flex-col overflow-hidden rounded-xl border',
                        ordenacao.emMovimento === item.id &&
                          'relative z-10 opacity-70 shadow-lg',
                        situacao === 'neutra' && 'border-borda bg-superficie',
                        situacao === 'falta' && 'border-falta-borda bg-falta',
                        situacao === 'ok' && 'border-ok-borda bg-ok',
                      )}
                    >
                      {/* Linha superior: alça + miniatura + nome clicável */}
                      <div className="flex items-center gap-2 px-2 pt-2">
                        {podeEditar && (
                          <button
                            type="button"
                            onPointerDown={ordenacao.comecar(indice)}
                            onPointerMove={ordenacao.mover}
                            onPointerUp={ordenacao.soltar}
                            onPointerCancel={ordenacao.soltar}
                            aria-label={`Mover ${nomeDoPerfil(item.modelo_perfil_id)} na sequência`}
                            title="Arraste para reordenar"
                            className="text-texto-suave hover:text-texto flex size-8 shrink-0 cursor-grab touch-none items-center justify-center active:cursor-grabbing"
                          >
                            <GripVertical
                              aria-hidden="true"
                              className="size-5"
                            />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => desenho && setAmpliado(desenho)}
                          disabled={!desenho}
                          aria-label={`Ampliar desenho de ${nomeDoPerfil(item.modelo_perfil_id)}`}
                          className="shrink-0 disabled:cursor-default"
                        >
                          <MiniaturaPerfil
                            link={desenho ?? null}
                            codigo={modeloItem?.codigo ?? ''}
                          />
                        </button>

                        {podeEditar ? (
                          <button
                            type="button"
                            onClick={() => abrirCorte(item)}
                            className="flex min-w-0 flex-1 items-center gap-1 self-stretch text-left"
                            aria-label={`Editar ${nomeDoPerfil(item.modelo_perfil_id)} na lista técnica`}
                          >
                            <span className="line-clamp-2 flex-1 text-[15px] leading-snug font-medium">
                              <span className="bg-acao-100 text-acao-700 me-1 inline-block rounded px-1.5 py-0.5 font-mono text-xs font-bold">
                                {modeloItem?.codigo ?? ''}
                              </span>
                              {modeloItem?.descricao ?? 'perfil removido'}
                            </span>
                            <Pencil
                              aria-hidden="true"
                              className="text-texto-suave size-4 shrink-0"
                            />
                          </button>
                        ) : (
                          <Link
                            to={`/perfis/${item.modelo_perfil_id}?de=${encodeURIComponent(`/produtos/${produto.id}`)}&rotulo=${encodeURIComponent('Lista técnica')}`}
                            className="flex min-w-0 flex-1 items-center gap-1 self-stretch"
                            aria-label={`Ver ficha de ${nomeDoPerfil(item.modelo_perfil_id)}`}
                          >
                            <span className="line-clamp-2 flex-1 text-[15px] leading-snug font-medium">
                              <span className="bg-acao-100 text-acao-700 me-1 inline-block rounded px-1.5 py-0.5 font-mono text-xs font-bold">
                                {modeloItem?.codigo ?? ''}
                              </span>
                              {modeloItem?.descricao ?? 'perfil removido'}
                            </span>
                            <ChevronRight
                              aria-hidden="true"
                              className="text-texto-suave size-4 shrink-0"
                            />
                          </Link>
                        )}
                      </div>

                      {/* Linha inferior: medidas/estoque + botões */}
                      <div className="flex items-center justify-between gap-2 px-2 pt-1 pb-2">
                        <span className="text-texto-suave min-w-0 pl-1 text-sm tabular-nums leading-tight">
                          {item.quantidade} ×{' '}
                          {formatarComprimento(item.comprimento_mm)} ·{' '}
                          {estoque.pecas} pç /{' '}
                          {(estoque.milimetros / 1000)
                            .toFixed(1)
                            .replace('.', ',')}
                          &nbsp;m
                          {/* O corte em linha própria, com os desenhos: é
                              instrução de bancada, não medida — misturá-lo
                              com os metros de estoque faria ler as duas
                              coisas como uma. */}
                          <span className="mt-1 flex items-center gap-2">
                            <span className={`whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-xs font-bold ${sentidoValido(item.sentido) === 'v' ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700'}`}>
                              {sentidoValido(item.sentido) === 'v' ? 'V |' : 'H —'}
                            </span>
                            <span className="text-xs">
                              {descreverCortes(
                                sentidoValido(item.sentido),
                                corteValido(item.corte_inicio),
                                corteValido(item.corte_fim),
                              )}
                            </span>
                          </span>
                        </span>

                        {podeEditar && (
                          <div className="flex shrink-0 items-center gap-2">
                            <Botao
                              tamanho="icone_pequeno"
                              variante="contorno"
                              onClick={() =>
                                disparar(remover.mutateAsync(item.id))
                              }
                              aria-label={`Remover ${nomeDoPerfil(item.modelo_perfil_id)} da lista técnica`}
                              title="Remover"
                            >
                              <Trash2 aria-hidden="true" className="size-4" />
                            </Botao>
                          </div>
                        )}
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}

            {podeEditar && (
              <Botao
                onClick={() => navegar(`/produtos/${id}/acrescentar-material`)}
                className="mt-3 w-full"
              >
                <Plus aria-hidden="true" className="size-5" />
                Acrescentar material
              </Botao>
            )}
          </div>
        )}
      </section>

      <Imagens
        foto={linkFoto}
        desenho={linkDesenho}
        nome={produto.nome}
        aoAmpliar={setAmpliado}
      />

      {/* Fica fora da tela e só aparece na impressão. Montada apenas quando
          se pede, para não baixar imagem à toa em quem só veio consultar —
          e uma de cada vez, porque as duas dividem o mesmo id. */}
      {imprimindo === 'produto' && (
        <FolhaProduto
          produto={produto}
          itens={itens ?? []}
          modelos={modelos ?? []}
          desenhosPerfil={capas}
          fotoProduto={linkFoto}
          desenhoProduto={linkDesenho}
          empresa={APLICACAO.nome}
          pecasPorPerfil={
            new Map([...estoquePorPerfil].map(([id, r]) => [id, r.pecas]))
          }
        />
      )}

      {imprimindo === 'materiais' && materiais && (
        <FolhaListaMateriais
          produto={produto}
          materiais={materiais}
          modelos={modelos ?? []}
          desenhosPerfil={capas}
          acabamento={corDaLista(materiais)}
          empresa={APLICACAO.nome}
        />
      )}

      <FichaDados
        titulo="Cadastro"
        linhas={[
          { rotulo: 'Código', valor: produto.codigo },
          { rotulo: 'Medida', valor: formatarMedidaProduto(produto) },
          { rotulo: 'Descrição', valor: produto.descricao },
          { rotulo: 'Cortes na lista', valor: (itens ?? []).length },
        ]}
      />

      <Modal
        aberto={editando && formProduto !== null}
        aoFechar={() => setEditando(false)}
        titulo="Editar produto"
      >
        {formProduto && (
          <FormularioProduto
            form={formProduto}
            aoMudar={setFormProduto}
            aoSalvar={salvarProduto}
            aoCancelar={() => setEditando(false)}
            salvando={editar.isPending}
            erro={erroProduto}
          />
        )}
      </Modal>

      {/*
       * A lista de materiais numa janela, e não numa tela própria: ela é
       * lida, conferida e impressa em um minuto, e some. Uma rota nova
       * gastaria histórico de navegação — o "voltar" do celular deixaria de
       * levar para Produtos — por um conteúdo que ninguém quer guardar
       * aberto.
       */}
      <Modal
        aberto={materiais !== null}
        aoFechar={() => setMateriais(null)}
        titulo="Lista de materiais"
      >
        {materiais && (
          <div className="flex flex-col gap-4">
            {/*
             * O modo troca aqui dentro, com a lista à vista: é comparando os
             * dois números — o cheio e o que falta comprar — que se decide
             * usar a sobra. Trocar o modo fora daqui obrigaria a fechar,
             * mudar e reabrir só para ver o outro.
             */}
            <div className="flex flex-col gap-2">
              {(
                [
                  {
                    modo: 'aproveitar_sobras' as const,
                    titulo: 'Aproveitar as sobras',
                    ajuda:
                      'Compra só a diferença. É a lista para o fornecedor.',
                  },
                  {
                    modo: 'tudo_novo' as const,
                    titulo: 'Tudo com barra nova',
                    ajuda:
                      'Ignora o depósito. É o material cheio, para orçamento.',
                  },
                ] satisfies {
                  modo: ModoCompra
                  titulo: string
                  ajuda: string
                }[]
              ).map((opcao) => (
                <label
                  key={opcao.modo}
                  className={cn(
                    'flex cursor-pointer items-start gap-3 rounded-xl border-2 p-3',
                    modoCompra === opcao.modo
                      ? 'border-acao-600 bg-acao-50'
                      : 'border-borda',
                  )}
                >
                  <input
                    type="radio"
                    name="modo-compra"
                    className="mt-1 size-5 shrink-0"
                    checked={modoCompra === opcao.modo}
                    onChange={() => gerarListaMateriais(opcao.modo)}
                  />
                  <span className="min-w-0">
                    <span className="block font-medium">{opcao.titulo}</span>
                    <span className="text-texto-suave block text-sm">
                      {opcao.ajuda}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <div className="bg-superficie-2 rounded-xl p-3 text-sm">
              <p>
                Para <strong>{materiais.unidades}</strong>{' '}
                {materiais.unidades === 1 ? 'unidade' : 'unidades'} de{' '}
                {produto.nome}:{' '}
                <strong className="text-base">
                  {materiais.totalBarras}{' '}
                  {materiais.totalBarras === 1 ? 'barra' : 'barras'}
                </strong>{' '}
                a comprar.
              </p>

              {/* A cor entra em linha própria e destacada: é o dado que
                  transforma esta lista num pedido que o fornecedor
                  consegue atender. */}
              <p className="mt-1">
                Acabamento: <strong>{corDaLista(materiais)}</strong>
              </p>
            </div>

            <ul className="flex flex-col gap-2">
              {materiais.linhas.map((linha) => {
                const modelo = modelos?.find(
                  (m) => m.id === linha.modelo_perfil_id,
                )
                const deSobra = linha.cortes.reduce(
                  (total, c) => total + c.deSobra,
                  0,
                )

                return (
                  <li
                    key={linha.modelo_perfil_id}
                    className="border-borda flex gap-3 rounded-xl border p-3"
                  >
                    {/* O desenho identifica o perfil melhor que o código:
                        quem confere a lista antes de ligar para o
                        fornecedor reconhece a seção de relance, e
                        "MN-001" contra "MN-002" não se distinguem lendo. */}
                    <MiniaturaPerfil
                      link={capas?.get(linha.modelo_perfil_id) ?? null}
                      codigo={modelo?.codigo ?? ''}
                    />

                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 text-[15px] leading-snug font-medium">
                          <span className="bg-acao-100 text-acao-700 me-1 inline-block rounded px-1.5 py-0.5 font-mono text-xs font-bold">
                            {modelo?.codigo ?? '—'}
                          </span>
                          {modelo?.descricao ?? 'perfil removido'}
                        </span>

                        <span className="shrink-0 text-lg font-bold tabular-nums">
                          {linha.comprimento_barra_mm > 0
                            ? linha.barrasNovas
                            : '?'}
                        </span>
                      </div>

                      {/* Um corte por linha, com o desenho: agrupar tudo
                          numa frase escondia que dois cortes do mesmo
                          comprimento podem ter esquadrias diferentes — e é
                          justamente aí que a bancada erra. */}
                      {linha.cortes.map((c, i) => (
                        <span
                          key={i}
                          className="text-texto-suave flex flex-col gap-0.5 text-sm tabular-nums"
                        >
                          <span>
                            {c.quantidade} ×{' '}
                            {formatarComprimento(c.comprimento_mm)}
                          </span>
                          {c.sentido && c.corte_inicio && c.corte_fim && (
                            <span className="flex items-center gap-1">
                              <span className={`whitespace-nowrap rounded-full px-2 py-0.5 font-mono text-xs font-bold ${c.sentido === 'v' ? 'bg-amber-100 text-amber-700' : 'bg-purple-100 text-purple-700'}`}>
                                {c.sentido === 'v' ? 'V |' : 'H —'}
                              </span>
                              <span className="text-xs">
                                {descreverCortes(c.sentido, c.corte_inicio, c.corte_fim)}
                              </span>
                            </span>
                          )}
                        </span>
                      ))}

                      {deSobra > 0 && (
                        <span className="text-ok-texto text-sm">
                          {deSobra} {deSobra === 1 ? 'peça sai' : 'peças saem'}{' '}
                          das sobras.
                        </span>
                      )}

                      {linha.cortesImpossiveis > 0 && (
                        <span className="text-erro-600 text-sm">
                          {linha.comprimento_barra_mm > 0
                            ? `${linha.cortesImpossiveis} ${linha.cortesImpossiveis === 1 ? 'corte é maior' : 'cortes são maiores'} que a barra de ${formatarComprimento(linha.comprimento_barra_mm)}.`
                            : 'Perfil sem comprimento de barra cadastrado — não dá para dizer quantas comprar.'}
                        </span>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>

            <div className="flex gap-2">
              <Botao
                variante="secundaria"
                onClick={() => setMateriais(null)}
                className="flex-1"
              >
                Fechar
              </Botao>
              <Botao
                onClick={() => setImprimindo('materiais')}
                className="flex-1"
              >
                <FileText aria-hidden="true" className="size-5" />
                Imprimir / PDF
              </Botao>
            </div>
          </div>
        )}
      </Modal>

      <Modal aberto={aberto} aoFechar={fecharCorte} titulo="Alterar corte">
        <form onSubmit={aoEnviar} className="flex flex-col gap-4" noValidate>
          {/* Campo de texto com sugestões, e não uma lista fechada: o
              catálogo passa de oitenta perfis, e rolar até achar o MN-007
              numa lista suspensa de celular é pior do que digitar "MN-0".
              Quem prefere escolher continua podendo — a lista abre ao tocar
              no campo. */}
          <CampoSugestao
            rotulo="Perfil"
            valor={textoPerfil}
            aoMudar={escolherPerfil}
            sugestoes={(modelos ?? []).map(rotuloDoPerfil)}
            ajuda="Digite o código ou o nome, ou toque para ver a lista."
          />

          <div className="grid grid-cols-2 gap-4">
            <CampoTexto
              rotulo="Comprimento (mm)"
              inputMode="numeric"
              value={form.comprimento_mm}
              onChange={(e) =>
                setForm({ ...form, comprimento_mm: e.target.value })
              }
              className="min-h-11 h-11 text-lg"
              rotuloClassName="text-sm whitespace-nowrap tracking-tight"
              required
            />
            <div className="flex flex-col gap-1.5">
              <span className="font-medium text-sm whitespace-nowrap tracking-tight">Quantidade</span>
              <CampoQuantidade
                valor={Number(form.quantidade) || 1}
                aoMudar={(v) => setForm({ ...form, quantidade: String(v) })}
                rotulo="Quantidade por unidade"
                compacto
              />
            </div>
          </div>

          {/* O mesmo seletor da tela de acrescentar: corrigir um corte
              lançado errado é tão comum quanto errar a medida, e obrigar a
              apagar a linha e refazer só por causa da esquadria seria o
              motivo mais bobo para perder a posição numa lista longa. */}
          <SeletorCortes
            sentido={form.sentido}
            corteInicio={form.corte_inicio}
            corteFim={form.corte_fim}
            aoMudarSentido={(sentido) => setForm({ ...form, sentido })}
            aoMudarInicio={(corte) => setForm({ ...form, corte_inicio: corte })}
            aoMudarFim={(corte) => setForm({ ...form, corte_fim: corte })}
          />

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
              onClick={fecharCorte}
              className="flex-1"
            >
              Cancelar
            </Botao>
            <Botao
              type="submit"
              carregando={editarItem.isPending}
              className="flex-1"
            >
              <PackageCheck aria-hidden="true" className="size-5" />
              Salvar
            </Botao>
          </div>
        </form>
      </Modal>

      {ampliado && (
        <VisualizadorImagem
          src={ampliado}
          // O mesmo visualizador atende três origens agora: o desenho de um
          // perfil da lista, a foto do produto e o desenho do produto. O
          // texto fica genérico porque a imagem é que diz qual é.
          alt="Imagem ampliada"
          aoFechar={() => setAmpliado(null)}
        />
      )}
    </PaginaDetalhe>
  )
}

/**
 * Foto e desenho do produto, quando existem.
 *
 * Some por inteiro se não houver nenhuma das duas: um quadro cinza com
 * "sem imagem" ocuparia a tela para dizer que não há nada a ver.
 */
function Imagens({
  foto,
  desenho,
  nome,
  aoAmpliar,
}: {
  /** Links já resolvidos pela tela — ver o comentário lá sobre o porquê. */
  foto: string | null
  desenho: string | null
  nome: string
  aoAmpliar: (link: string) => void
}) {
  if (foto === null && desenho === null) return null

  return (
    <section className="grid gap-3 sm:grid-cols-2">
      {foto && (
        <figure>
          {/* Botão, e não imagem solta: quem toca espera ampliar, e um
              elemento clicável que não é botão fica fora do alcance de quem
              navega por teclado. */}
          {/* A ALTURA É DA CAIXA, não da imagem.
              Com `max-h` na própria imagem, o Safari do iPhone decide a
              altura antes de conhecer a proporção do arquivo e às vezes não
              refaz a conta quando ele chega — o resultado é a imagem cortada,
              de forma intermitente, no aplicativo instalado. Fixando a caixa
              e deixando a imagem preenchê-la com `object-contain`, não há
              cálculo a refazer: a foto sempre cabe inteira. */}
          <button
            type="button"
            onClick={() => foto && aoAmpliar(foto)}
            aria-label={`Ampliar a foto de ${nome}`}
            className="bg-superficie-2 block h-56 w-full overflow-hidden rounded-xl"
          >
            <img
              src={foto}
              alt={`Foto de ${nome}`}
              className="h-full w-full object-contain"
            />
          </button>
          <figcaption className="text-texto-suave mt-1 text-sm">
            Produto pronto · toque para ampliar
          </figcaption>
        </figure>
      )}

      {desenho && (
        <figure>
          <button
            type="button"
            onClick={() => desenho && aoAmpliar(desenho)}
            aria-label={`Ampliar o desenho técnico de ${nome}`}
            className="bg-superficie-2 block h-56 w-full overflow-hidden rounded-xl"
          >
            <img
              src={desenho}
              alt={`Desenho técnico de ${nome}`}
              className="h-full w-full object-contain"
            />
          </button>
          <figcaption className="text-texto-suave mt-1 text-sm">
            Desenho técnico · toque para ampliar
          </figcaption>
        </figure>
      )}
    </section>
  )
}
