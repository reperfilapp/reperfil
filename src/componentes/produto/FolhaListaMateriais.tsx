import { formatarComprimento } from '@/dominio/medidas'
import { formatarMedidaProduto } from '@/dominio/produto'
import type { ListaMateriais } from '@/dominio/listaMateriais'
import type { ModeloPerfil, Produto } from '@/tipos/banco'

/**
 * A lista de materiais, para imprimir ou salvar em PDF.
 *
 * ── PARA QUEM ESTA FOLHA VAI ─────────────────────────────────────────────
 *
 * A folha do produto vai para a bancada; esta vai para o telefone com o
 * fornecedor e para o orçamento do cliente. São duas folhas porque são duas
 * conversas — aqui o que importa é QUANTA barra comprar, não como cortar.
 *
 * O desenho de cada perfil aparece assim mesmo, menor que na folha do
 * produto: quem confere um pedido de vinte perfis reconhece a seção de
 * relance, e "MN-001" contra "MN-002" não se distinguem lendo. Menor
 * porque aqui ele serve para identificar, não para conferir corte.
 *
 * ── POR QUE O MODO APARECE EM DESTAQUE ───────────────────────────────────
 *
 * "3 barras" significa coisas opostas conforme o modo: no orçamento cheio é
 * o que o cliente paga; na lista de compras é o que falta depois do
 * depósito. Uma folha que não diga qual dos dois é vira erro de pedido —
 * então o modo fica no cabeçalho, não numa nota de rodapé.
 */
export function FolhaListaMateriais({
  produto,
  materiais,
  modelos,
  desenhosPerfil,
  acabamento,
  empresa,
}: {
  produto: Produto
  materiais: ListaMateriais
  modelos: readonly ModeloPerfil[]
  /** Link temporário do desenho de cada perfil, por id do modelo. */
  desenhosPerfil: Map<string, string> | undefined
  /**
   * Em que cor este material sai — já resolvido pela tela, que sabe se a
   * cor veio das sobras aproveitadas, da escolha fixa, ou de lugar nenhum.
   */
  acabamento: string
  empresa: string
}) {
  const perfilDe = (id: string) => modelos.find((m) => m.id === id)

  const aproveita = materiais.modo === 'aproveitar_sobras'
  const impossiveis = materiais.linhas.reduce(
    (total, linha) => total + linha.cortesImpossiveis,
    0,
  )

  return (
    /* Mesma técnica da folha do produto: fora da tela em vez de escondida,
       para o navegador dar layout e baixar o que houver antes de imprimir.
       Ver o comentário longo em FolhaProduto. */
    <div
      id="folha-impressao"
      aria-hidden="true"
      className="fixed top-0 -left-[9999px] w-[210mm] bg-white text-black print:static print:left-0 print:w-full"
    >
      <div className="marca-dagua" aria-hidden="true">
        <div className="marca-dagua-grade">
          {Array.from({ length: 96 }, (_, i) => (
            <img key={i} src="/marca-rp.png" alt="" />
          ))}
        </div>
      </div>

      {/* Tabela externa com `thead`: é o que repete o cabeçalho em todas as
          páginas de verdade. Ver FolhaProduto. */}
      <table className="w-full">
        <thead>
          <tr>
            <th className="p-0">
              <header className="mb-3 flex items-end justify-between gap-4 border-b-2 border-black pb-2 text-left">
                <img
                  src="/logo-otimizada.png"
                  alt={empresa}
                  className="h-[30mm] w-auto object-contain"
                />

                <div className="min-w-0 text-right">
                  <h1 className="text-3xl leading-tight font-bold">
                    Lista de materiais
                  </h1>
                  <p className="mt-1 text-lg font-semibold">{produto.nome}</p>
                  <p className="text-base">
                    <span className="font-mono">{produto.codigo}</span>
                    {formatarMedidaProduto(produto) &&
                      ` · ${formatarMedidaProduto(produto)}`}
                  </p>
                </div>
              </header>
            </th>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td className="p-0 align-top">
              {/* O contrato da folha em uma linha: para quantas peças, com
                  que critério, e o total a comprar. */}
              <section className="mb-4 border-2 border-black p-3">
                <p className="text-lg font-bold">
                  Para produzir {materiais.unidades}{' '}
                  {materiais.unidades === 1 ? 'unidade' : 'unidades'}
                </p>
                <p className="mt-1 text-sm">
                  {aproveita ? (
                    <>
                      <strong>Aproveitando as sobras do depósito.</strong> As
                      barras abaixo são só a diferença — o que falta depois de
                      usar o que já existe.
                    </>
                  ) : (
                    <>
                      <strong>Tudo com barra nova.</strong> O depósito foi
                      ignorado de propósito: este é o material cheio do serviço,
                      para orçamento.
                    </>
                  )}
                </p>
                {/* Junto do total, e não numa nota: é a cor que transforma o
                    número em pedido. Sem ela o fornecedor pergunta, e quem
                    ligou não sabe responder. */}
                <p className="mt-2 text-xl font-bold">
                  Total a comprar: {materiais.totalBarras}{' '}
                  {materiais.totalBarras === 1 ? 'barra' : 'barras'}
                </p>
                <p className="text-lg font-bold">Acabamento: {acabamento}</p>
              </section>

              {impossiveis > 0 && (
                <p className="mb-4 border-2 border-black p-2 text-sm font-bold">
                  Atenção: {impossiveis}{' '}
                  {impossiveis === 1 ? 'corte não cabe' : 'cortes não cabem'} na
                  barra do catálogo, ou o perfil está sem comprimento de barra
                  cadastrado. Confira antes de fazer o pedido — comprar mais não
                  resolve.
                </p>
              )}

              {materiais.linhas.length === 0 ? (
                <p className="text-sm">Sem lista técnica cadastrada.</p>
              ) : (
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b-2 border-black text-left">
                      <th className="w-8 py-1">#</th>
                      <th className="w-16 py-1">Desenho</th>
                      <th className="py-1">Perfil</th>
                      <th className="py-1">Cortes</th>
                      {aproveita && (
                        <th className="w-24 py-1 text-right">Do estoque</th>
                      )}
                      <th className="w-24 py-1 text-right">Barra</th>
                      <th className="w-24 py-1 text-right">Comprar</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materiais.linhas.map((linha, indice) => {
                      const perfil = perfilDe(linha.modelo_perfil_id)
                      const deSobra = linha.cortes.reduce(
                        (total, c) => total + c.deSobra,
                        0,
                      )

                      return (
                        <tr
                          key={linha.modelo_perfil_id}
                          className="break-inside-avoid border-b border-gray-400 align-top"
                        >
                          <td className="py-2 font-bold tabular-nums">
                            {indice + 1}
                          </td>

                          <td className="py-2">
                            {desenhosPerfil?.get(linha.modelo_perfil_id) && (
                              <img
                                src={desenhosPerfil.get(linha.modelo_perfil_id)}
                                alt=""
                                className="h-14 w-14 object-contain"
                              />
                            )}
                          </td>

                          <td className="py-2">
                            <span className="font-mono font-bold">
                              {perfil?.codigo ?? '—'}
                            </span>
                            <br />
                            {perfil?.descricao ?? 'perfil removido'}
                            {perfil?.linha && (
                              <>
                                <br />
                                <span className="text-xs">{perfil.linha}</span>
                              </>
                            )}
                          </td>

                          {/* Um corte por linha, e não somados: quem vai
                              serrar precisa das medidas, e quem confere o
                              pedido precisa ver de onde saiu o número de
                              barras. */}
                          <td className="py-2">
                            {linha.cortes.map((corte) => (
                              <span
                                key={corte.comprimento_mm}
                                className="block tabular-nums"
                              >
                                {corte.quantidade} ×{' '}
                                {formatarComprimento(corte.comprimento_mm)}
                              </span>
                            ))}
                            <span className="mt-1 block text-xs tabular-nums">
                              {linha.metrosDeCorte.toFixed(2).replace('.', ',')}{' '}
                              m de corte
                            </span>
                          </td>

                          {aproveita && (
                            <td className="py-2 text-right tabular-nums">
                              {deSobra > 0 ? `${deSobra} pç` : '—'}
                            </td>
                          )}

                          <td className="py-2 text-right tabular-nums">
                            {linha.comprimento_barra_mm > 0
                              ? formatarComprimento(linha.comprimento_barra_mm)
                              : '—'}
                          </td>

                          <td className="py-2 text-right text-base font-bold tabular-nums">
                            {linha.cortesImpossiveis > 0 &&
                            linha.barrasNovas === 0
                              ? '?'
                              : linha.barrasNovas}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>

                  <tfoot>
                    <tr className="border-t-2 border-black font-bold">
                      {/* Cobre tudo até a última coluna: #, desenho, perfil,
                          cortes, barra e — quando o modo aproveita o
                          depósito — também "do estoque". */}
                      <td className="py-2" colSpan={aproveita ? 6 : 5}>
                        Total
                      </td>
                      <td className="py-2 text-right text-base tabular-nums">
                        {materiais.totalBarras}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}

              <footer className="mt-6 border-t border-gray-400 pt-2 text-xs">
                <p className="mb-1">
                  As quantidades já descontam a serra e a margem de limpeza
                  configuradas. O número de barras supõe que os cortes de um
                  mesmo perfil podem ser distribuídos livremente entre elas.
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
