/**
 * Avisos de falha em operações disparadas "de lado".
 *
 * ── O PROBLEMA QUE ISTO RESOLVE ──────────────────────────────────────────
 *
 * A maioria das gravações do app acontece dentro de um formulário, com
 * `await ... mutateAsync()` num `try/catch` que escreve o erro na própria
 * tela. Mas há um segundo grupo — os botões de ação direta: desativar,
 * reativar, mover de posição, liberar linha, remover item. Esses eram
 * disparados com `void mutacao.mutateAsync(...)`, sem `catch` nenhum.
 *
 * Quando davam certo, tudo bem. Quando falhavam — RLS negando, rede caindo
 * no depósito, sessão expirada —, a promessa rejeitava sozinha, o erro
 * morria no console e a tela não mudava NADA. A pessoa tocava em
 * "Desativar", nada acontecia, tocava de novo, nada. Sem mensagem, sem
 * pista, sem forma de saber que o servidor tinha recusado.
 *
 * ── POR QUE UM HELPER, E NÃO UM `onError` GLOBAL ─────────────────────────
 *
 * O React Query permite um `onError` no `MutationCache`, que pegaria todas
 * as mutações de uma vez. Mas ele dispara TAMBÉM nas que já são tratadas
 * pelas telas de formulário — e o erro apareceria duas vezes: uma no
 * formulário, outra flutuando por cima.
 *
 * Marcar quem quer o aviso global é explícito e não engana: quem lê
 * `disparar(...)` no código sabe que aquela falha tem tratamento, e quem
 * lê `await` dentro de `try` sabe que a tela cuida. Não há terceiro caso
 * escondido.
 */

type Ouvinte = () => void

const ouvintes = new Set<Ouvinte>()
let mensagemAtual: string | null = null

function publicar(mensagem: string | null) {
  mensagemAtual = mensagem
  for (const ouvir of ouvintes) ouvir()
}

/** Para o `useSyncExternalStore` do componente de aviso. */
export function assinarAvisoErro(ouvinte: Ouvinte): () => void {
  ouvintes.add(ouvinte)

  return () => {
    ouvintes.delete(ouvinte)
  }
}

export function lerAvisoErro(): string | null {
  return mensagemAtual
}

export function limparAvisoErro(): void {
  publicar(null)
}

/**
 * Dispara uma operação sem esperar por ela, mas SEM perder o erro.
 *
 * Substitui o antigo `void mutacao.mutateAsync(...)`. A operação continua
 * não bloqueando a interface; a diferença é que, falhando, a pessoa fica
 * sabendo.
 *
 * `mensagem` sobrescreve o texto técnico do servidor quando existe algo
 * mais útil a dizer ("Não foi possível mover a linha"), mas o padrão já
 * serve: a mensagem do banco costuma ser específica o bastante.
 */
export function disparar<T>(promessa: Promise<T>, mensagem?: string): void {
  void promessa.catch((e: unknown) => {
    publicar(
      mensagem ??
        (e instanceof Error
          ? e.message
          : 'Não foi possível concluir a operação.'),
    )
  })
}
