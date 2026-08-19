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
      {/* A marca por trás de tudo, bem apagada. Identifica a folha que
          circula solta pela oficina sem disputar com o conteúdo — quem lê
          está procurando uma medida, não a logomarca. */}
      <div className="marca-dagua" aria-hidden="true">
        <img src="/marca-rp.png" alt="" />
      </div>

      {/* Repete em TODAS as páginas: uma lista longa vira duas ou três
          folhas, e a segunda sem identificação é uma tabela de números que
          ninguém sabe de que produto é. */}
      <header className="repete-cabecalho flex items-center gap-3 border-b-2 border-black pb-2">
        <img src="/marca-rp.png" alt="" className="h-10 w-10 object-contain" />
        <div className="min-w-0 flex-1">
          <p className="text-xs">{empresa}</p>
          <h1 className="text-lg leading-tight font-bold">{produto.nome}</h1>
          <p className="text-xs">
            <span className="font-mono">{produto.codigo}</span>
            {formatarMedidaProduto(produto) &&
              ` · ${formatarMedidaProduto(produto)}`}
          </p>
        </div>
      </header>

      {produto.descricao && <p className="mb-4 text-sm">{produto.descricao}</p>}

      {(fotoProduto || desenhoProduto) && (
        <section className="mb-4 flex gap-4">
          {fotoProduto && (
            <figure className="flex-1">
              <img
                src={fotoProduto}
                alt=""
                className="h-40 w-full object-contain"
              />
              <figcaption className="mt-1 text-center text-xs">
                Produto pronto
              </figcaption>
            </figure>
          )}
          {desenhoProduto && (
            <figure className="flex-1">
              <img
                src={desenhoProduto}
                alt=""
                className="h-40 w-full object-contain"
              />
              <figcaption className="mt-1 text-center text-xs">
                Desenho técnico
              </figcaption>
            </figure>
          )}
        </section>
      )}

      <h2 className="mb-2 text-lg font-bold">Lista técnica</h2>
      <p className="mb-2 text-xs">
        Quantidades por UMA unidade. Comprimentos de corte, já com os descontos
        da oficina.
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
              <th className="w-8 py-1 text-center" title="Tem sobra em estoque">
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
                    {(pecasPorPerfil.get(item.modelo_perfil_id) ?? 0) > 0
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
          ● há sobra deste perfil em estoque · ○ não há — confira antes de
          comprar barra nova.
        </p>
        Gerado pelo RePerfil em {new Date().toLocaleString('pt-BR')}.
      </footer>
    </div>
  )
}
