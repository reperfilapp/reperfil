import { useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'

/**
 * Níveis abertos DENTRO de uma tela — linha → perfil → peças — guardados na
 * URL, e não em estado interno.
 *
 * ── POR QUE NÃO `useState` ───────────────────────────────────────────────
 *
 * Do ponto de vista de quem usa, abrir a linha "Suprema" no catálogo É
 * mudar de tela: a lista inteira é trocada. Mas com o nível em `useState`
 * nada disso chega ao histórico do navegador — para ele, a pessoa nunca
 * saiu do catálogo. Aí "voltar" pulava o nível e caía na tela de onde o
 * catálogo tinha sido aberto, obrigando a refazer o caminho todo.
 *
 * Com o nível na URL, abrir um nível é uma navegação de verdade. Isso não
 * conserta só o botão de voltar: conserta junto o gesto de voltar do
 * navegador e o botão físico do Android, que antes saíam da tela inteira
 * quando a pessoa só queria subir um nível.
 *
 * De quebra, o endereço passa a descrever o que está na tela, então
 * recarregar a página (ou reabrir o aplicativo) devolve a pessoa ao mesmo
 * lugar em vez de jogá-la na raiz.
 */
export function useNiveisNaUrl(chaves: readonly string[]) {
  const [parametros, definirParametros] = useSearchParams()
  const navegar = useNavigate()

  /** O valor de um nível, ou null quando ele não está aberto. */
  const nivel = useCallback(
    (chave: string) => parametros.get(chave),
    [parametros],
  )

  /**
   * Abre (ou troca) níveis. Empurra no histórico de propósito: descer um
   * nível é ir adiante, e é isso que dá ao "voltar" o que desfazer.
   */
  const abrir = useCallback(
    (mudancas: Record<string, string | null>) => {
      const novos = new URLSearchParams(parametros)

      for (const [chave, valor] of Object.entries(mudancas)) {
        if (valor === null) {
          novos.delete(chave)
        } else {
          novos.set(chave, valor)
        }
      }

      definirParametros(novos)
    },
    [parametros, definirParametros],
  )

  /**
   * Sobe um nível.
   *
   * Pelo histórico quando existe tela anterior — assim o caminho de volta é
   * exatamente o de ida, sem inventar destino. Só quando a tela foi aberta
   * "do nada" (link direto, atalho salvo) é que não há o que desfazer: aí o
   * nível mais fundo é retirado da URL, sem empurrar entrada nova, senão
   * "voltar" ficaria preso indo e voltando entre os dois mesmos níveis.
   */
  const voltarNivel = useCallback(() => {
    const estadoHistorico = window.history.state as { idx?: number } | null

    if ((estadoHistorico?.idx ?? 0) > 0) {
      navegar(-1)
      return
    }

    const novos = new URLSearchParams(parametros)

    for (const chave of [...chaves].reverse()) {
      if (novos.has(chave)) {
        novos.delete(chave)
        break
      }
    }

    definirParametros(novos, { replace: true })
  }, [chaves, parametros, definirParametros, navegar])

  return { nivel, abrir, voltarNivel }
}
