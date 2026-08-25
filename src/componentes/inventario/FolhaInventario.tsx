import { formatarComprimento } from '@/dominio/medidas'
import type { ItemInventarioDetalhado } from '@/dados/inventario'
import type { SessaoInventario } from '@/tipos/banco'

/**
 * Folha de contagem para prancheta — mesmo mecanismo de impressão da folha
 * do produto (ver `lib/impressao.ts`): sai da tela, imprime ou vira PDF pelo
 * diálogo do próprio sistema.
 *
 * O que o sistema espera aparece impresso; o que a contagem física encontrou
 * fica em branco, para preencher à mão e depois digitar de volta no
 * aplicativo — é a opção de quem prefere separar "contar" de "usar o
 * celular no depósito".
 */
export function FolhaInventario({
  sessao,
  itens,
  empresa,
}: {
  sessao: SessaoInventario
  itens: readonly ItemInventarioDetalhado[]
  empresa: string
}) {
  const ehPerfil = sessao.tipo_item === 'perfil'

  return (
    <div
      id="folha-impressao"
      aria-hidden="true"
      className="fixed top-0 -left-[9999px] w-[210mm] bg-white text-black print:static print:left-0 print:w-full"
    >
      <table className="w-full">
        <thead>
          <tr>
            <th className="p-0">
              <header className="mb-3 flex items-end justify-between gap-4 border-b-2 border-black pb-2 text-left">
                <img
                  src="/logo-otimizada.png"
                  alt={empresa}
                  className="h-[24mm] w-auto object-contain"
                />
                <div className="min-w-0 text-right">
                  <h1 className="text-2xl leading-tight font-bold">
                    Folha de contagem
                  </h1>
                  <p className="mt-1 text-base">
                    <span className="font-mono">{sessao.codigo}</span>
                    {sessao.titulo && ` — ${sessao.titulo}`}
                  </p>
                  <p className="text-sm">
                    {ehPerfil ? 'Perfis' : 'Acessórios'} · {itens.length}{' '}
                    {itens.length === 1 ? 'item' : 'itens'}
                  </p>
                </div>
              </header>
            </th>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td className="p-0 align-top">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b-2 border-black text-left">
                    <th className="w-8 py-1">#</th>
                    <th className="py-1">Código</th>
                    <th className="py-1">Item</th>
                    <th className="py-1">Acabamento</th>
                    <th className="py-1">Local</th>
                    <th className="w-20 py-1 text-right">Estoque</th>
                    {ehPerfil && (
                      <th className="w-24 py-1 text-right">Medida</th>
                    )}
                    <th className="w-24 py-1 text-center">Contagem</th>
                    {ehPerfil && (
                      <th className="w-24 py-1 text-center">Medida contada</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {itens.map((item, indice) => {
                    const lote = item.lote_sobra ?? item.lote_acessorio
                    if (!lote) return null

                    return (
                      <tr
                        key={item.id}
                        className="break-inside-avoid border-b border-gray-400"
                      >
                        <td className="py-2 align-middle font-bold tabular-nums">
                          {indice + 1}
                        </td>
                        <td className="py-2 align-middle font-mono">
                          {lote.codigo}
                        </td>
                        <td className="py-2 align-middle">
                          <span className="font-mono font-bold">
                            {lote.modelo?.codigo}
                          </span>
                          <br />
                          {lote.modelo?.descricao}
                        </td>
                        <td className="py-2 align-middle">
                          {lote.acabamento?.nome ?? '—'}
                        </td>
                        <td className="py-2 align-middle">
                          {lote.localizacao?.codigo ?? '—'}
                        </td>
                        <td className="py-2 text-right align-middle font-bold tabular-nums">
                          {item.estoque_esperado_quantidade}
                        </td>
                        {ehPerfil && (
                          <td className="py-2 text-right align-middle tabular-nums">
                            {item.estoque_esperado_comprimento_mm
                              ? formatarComprimento(
                                  item.estoque_esperado_comprimento_mm,
                                )
                              : '—'}
                          </td>
                        )}
                        <td className="border border-gray-400 py-4 align-middle text-center">
                          &nbsp;
                        </td>
                        {ehPerfil && (
                          <td className="border border-gray-400 py-4 align-middle text-center">
                            &nbsp;
                          </td>
                        )}
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              <footer className="mt-6 border-t border-gray-400 pt-2 text-xs">
                <p className="mb-1">
                  Preencha "Contagem" (e "Medida contada", quando houver) e
                  depois digite os valores de volta no aplicativo.
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
