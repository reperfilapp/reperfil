import { formatarMedidaProduto } from '@/dominio/produto'
import { formatarComprimento } from '@/dominio/medidas'
import type { ItemListaTecnica, ModeloPerfil, Produto } from '@/tipos/banco'

/**
 * A folha do produto, para imprimir ou salvar em PDF.
 *
 * ── POR QUE IMPRESSÃO, E NÃO UMA BIBLIOTECA DE PDF ───────────────────────
 *
 * "Salvar como PDF" já existe no diálogo de impressão do Android, do iPhone
 * e do computador — é o mesmo caminho da etiqueta da sobra, que a oficina já
 * usa. Uma biblioteca como jsPDF somaria centenas de kilobytes ao pacote
 * para refazer, pior, o que o sistema faz de graça: fontes, quebra de
 * página, margens.
 *
 * Em troca, quem quiser o arquivo precisa escolher "Salvar como PDF" no
 * diálogo em vez de receber o download direto. É o preço, e é pequeno perto
 * de carregar a biblioteca em toda visita.
 *
 * ── ESTA FOLHA É PARA A BANCADA ──────────────────────────────────────────
 *
 * Ela sai da tela do produto e vai para a mão de quem vai montar. Por isso o
 * desenho de cada perfil aparece GRANDE na tabela: quem confere o corte
 * compara o desenho com a barra, e uma miniatura de 40 px não serve para
 * isso — foi o motivo de esta folha existir separada da tela.
 */
export function FolhaProduto({
  produto,
  itens,
  modelos,
  desenhosPerfil,
  fotoProduto,
  desenhoProduto,
  empresa,
  pecasPorPerfil,
}: {
  produto: Produto
  itens: readonly ItemListaTecnica[]
  modelos: readonly ModeloPerfil[]
  /** Link temporário do desenho de cada perfil, por id do modelo. */
  desenhosPerfil: Map<string, string> | undefined
  fotoProduto: string | null
  desenhoProduto: string | null
  empresa: string
  /** Peças livres por perfil, para marcar o que já existe no depósito. */
  pecasPorPerfil: Map<string, number>
}) {
  const perfilDe = (id: string) => modelos.find((m) => m.id === id)

  /*
   * As imagens numa lista só, em vez de tratadas uma a uma no JSX.
   *
   * Hoje são duas — a foto do produto pronto e o desenho técnico —, mas o
   * arranjo (três por fileira, centralizado, quebrando no excesso) é o mesmo
   * para qualquer quantidade. Com elas em lista, acrescentar uma terceira
   * imagem no futuro não mexe no leiaute.
   */
  const imagens = [
    fotoProduto && { src: fotoProduto, legenda: 'Produto pronto' },
    desenhoProduto && { src: desenhoProduto, legenda: 'Desenho técnico' },
  ].filter((imagem): imagem is { src: string; legenda: string } =>
    Boolean(imagem),
  )

  return (
    /*
     * Fora da tela, e NÃO escondida com `display: none`.
     *
     * Elemento sem exibição não recebe layout, e o navegador adia o
     * carregamento das imagens dentro dele — na hora de imprimir não havia o
     * que fotografar. Posicionada longe, ela existe de verdade: tem largura,
     * altura e imagens já baixadas. Na impressão volta ao fluxo normal.
     *
     * A largura fixa de 210 mm é a do A4: sem ela, a folha herdaria a
     * largura da tela do celular e a tabela sairia espremida no papel.
     */
    <div
      id="folha-impressao"
      aria-hidden="true"
      className="fixed top-0 -left-[9999px] w-[210mm] bg-white text-black print:static print:left-0 print:w-full"
    >
      {/* Marca d'água em GRADE, não uma só no centro: espalhada e pequena,
          ela marca a folha inteira sem criar uma mancha atrás de um trecho
          específico do conteúdo. Inclinada, porque marca d'água alinhada com
          o texto se confunde com ele. */}
      <div className="marca-dagua" aria-hidden="true">
        <div className="marca-dagua-grade">
          {Array.from({ length: 96 }, (_, i) => (
            <img key={i} src="/marca-rp.png" alt="" />
          ))}
        </div>
      </div>

      {/*
       * TABELA envolvendo tudo, e o cabeçalho num `<thead>`.
       *
       * É a única forma que repete de verdade em todas as páginas: o
       * navegador redesenha o `thead` a cada quebra. `position: fixed`
       * deveria fazer o mesmo, e não faz — no Chrome ele sai só na primeira
       * folha, que foi o que aconteceu aqui.
       *
       * A tabela da lista técnica, mais abaixo, tem o próprio `thead` e
       * repete os títulos das colunas pelo mesmo mecanismo.
       */}
      <table className="w-full">
        <thead>
          <tr>
            <th className="p-0">
              <header className="mb-3 flex items-end justify-between gap-4 border-b-2 border-black pb-2 text-left">
                {/* Logo completo, com o nome e a assinatura: a folha circula
                    fora da empresa, e o símbolo sozinho não diz de onde
                    veio. */}
                <img
                  src="/logo-otimizada.png"
                  alt={empresa}
                  className="h-[30mm] w-auto object-contain"
                />

                <div className="min-w-0 text-right">
                  <h1 className="text-lg leading-tight font-bold">
                    {produto.nome}
                  </h1>
                  <p className="text-xs">
                    <span className="font-mono">{produto.codigo}</span>
                  </p>
                  {formatarMedidaProduto(produto) && (
                    <p className="text-xs">{formatarMedidaProduto(produto)}</p>
                  )}
                </div>
              </header>
            </th>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td className="p-0 align-top">
              {produto.descricao && (
                <p className="mb-4 text-sm">{produto.descricao}</p>
              )}

              {/*
               * Cada imagem ocupa exatamente UM TERÇO da largura útil, tenha
               * a folha uma imagem ou seis.
               *
               * Fração fixa, e não proporcional à quantidade: com `flex-1`,
               * duas imagens ficariam gigantes e três minúsculas, e o mesmo
               * desenho mudaria de tamanho conforme o produto tivesse foto
               * ou não — atrapalhando justamente quem usa a folha para
               * conferir contra a peça.
               *
               * O respiro entre elas vem do `px-3` de cada figura, por
               * dentro do terço: com `gap`, três não caberiam mais na linha.
               *
               * `justify-center` resolve os casos menores sozinho — uma fica
               * no meio, duas ficam centralizadas com o espaço entre elas.
               */}
              {imagens.length > 0 && (
                <section className="mb-4 flex flex-wrap justify-center">
                  {imagens.map((imagem) => (
                    <figure
                      key={imagem.legenda}
                      className="w-1/3 break-inside-avoid px-3"
                    >
                      <img
                        src={imagem.src}
                        alt=""
                        className="h-[62mm] w-full object-contain"
                      />
                      <figcaption className="mt-1 text-center text-xs">
                        {imagem.legenda}
                      </figcaption>
                    </figure>
                  ))}
                </section>
              )}

              <h2 className="mb-2 text-lg font-bold">Lista técnica</h2>
              <p className="mb-2 text-xs">
                Quantidades por UMA unidade. Comprimentos de corte, já com os
                descontos da oficina.
              </p>

              {itens.length === 0 ? (
                <p className="text-sm">Sem lista técnica cadastrada.</p>
              ) : (
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-black text-left">
                      {/* A numeração serve à conversa na oficina: "o item 7 está
                  errado" resolve o que "aquele marco de 1.455" não resolve
                  quando há três cortes parecidos. */}
                      <th className="w-8 py-1">#</th>
                      {/* Ponto cheio ou vazio, e não um ícone: a folha é impressa em
                  impressora comum, muitas vezes preto e branco, e um texto
                  simples sai legível em qualquer uma. */}
                      <th
                        className="w-8 py-1 text-center"
                        title="Tem sobra em estoque"
                      >
                        Est.
                      </th>
                      <th className="w-28 py-1">Desenho</th>
                      <th className="py-1">Perfil</th>
                      <th className="w-20 py-1 text-right">Qtd.</th>
                      <th className="w-28 py-1 text-right">Comprimento</th>
                    </tr>
                  </thead>
                  <tbody>
                    {itens.map((item, indice) => {
                      const perfil = perfilDe(item.modelo_perfil_id)
                      const desenho = desenhosPerfil?.get(item.modelo_perfil_id)

                      return (
                        // `break-inside-avoid`: uma linha partida entre duas páginas
                        // deixaria o desenho numa e a medida na outra.
                        <tr
                          key={item.id}
                          className="break-inside-avoid border-b border-gray-400"
                        >
                          <td className="py-2 align-middle font-bold tabular-nums">
                            {indice + 1}
                          </td>
                          <td className="py-2 text-center align-middle">
                            {(pecasPorPerfil.get(item.modelo_perfil_id) ?? 0) >
                            0
                              ? '●'
                              : '○'}
                          </td>
                          <td className="py-2">
                            {desenho && (
                              /* Grande de propósito: é por ele que se confere o
                         corte na bancada. */
                              <img
                                src={desenho}
                                alt=""
                                className="h-24 w-24 object-contain"
                              />
                            )}
                          </td>
                          <td className="py-2 align-middle">
                            <span className="font-mono font-bold">
                              {perfil?.codigo ?? '—'}
                            </span>
                            <br />
                            {perfil?.descricao}
                            {perfil?.linha && (
                              <>
                                <br />
                                <span className="text-xs">{perfil.linha}</span>
                              </>
                            )}
                          </td>
                          <td className="py-2 text-right align-middle font-bold tabular-nums">
                            {item.quantidade}
                          </td>
                          <td className="py-2 text-right align-middle tabular-nums">
                            {formatarComprimento(item.comprimento_mm)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}

              <footer className="mt-6 border-t border-gray-400 pt-2 text-xs">
                <p className="mb-1">
                  ● há sobra deste perfil em estoque · ○ não há — confira antes
                  de comprar barra nova.
                </p>
                Gerado pelo RePerfil em {new Date().toLocaleString('pt-BR')}.
              </footer>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
