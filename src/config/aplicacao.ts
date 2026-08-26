/**
 * Identidade e configuração central do RePerfil.
 *
 * Nome, slogan, package ID, contatos e textos institucionais ficam TODOS
 * aqui. Nenhum componente deve escrever esses valores literalmente — quando
 * a empresa mudar telefone, cor ou razão social, este é o único arquivo a
 * tocar.
 *
 * Valores realmente sensíveis (chaves, senhas, tokens) nunca entram aqui:
 * vão para variáveis de ambiente, ver `src/config/ambiente.ts`.
 */

export const APLICACAO = {
  nome: 'RePerfil',
  slogan: 'Orce, projete e reaproveite.',
  tituloPlayStore: 'RePerfil: Estoque e Orçamento',
  descricaoCurta:
    'Controle de sobras de perfis de alumínio e orçamento de esquadrias.',
  /** Identificador do pacote Android. Alterar exige recriar o app na Play Console. */
  packageId: 'br.com.reperfil.app',
  versao: '0.1.0',
  /** Incrementar a cada envio para a Play Store. */
  versionCode: 1,
  idioma: 'pt-BR',
  moeda: 'BRL',
} as const

/*
 * `EMPRESA_PADRAO` viveu aqui até 28/08/2026, com os dados iniciais da
 * instalação. Removida por já não ser lida em lugar nenhum: desde que
 * cada organização passou a guardar os próprios dados em `organizacoes`
 * (tabela criada na Fase 1), quem responde "qual é a empresa?" é o banco,
 * via `useOrganizacao`. O que restava aqui era um molde vazio que ninguém
 * consultava — e um molde vazio que sobrevive vira, mais cedo ou mais
 * tarde, o valor que alguém copia achando que ainda vale.
 */

/**
 * Unidades aceitas na entrada de medidas. O armazenamento é SEMPRE em
 * milímetros inteiros; estas opções existem só para a conversão na tela.
 */
export const UNIDADES_MEDIDA = ['mm', 'cm', 'm'] as const
export type UnidadeMedida = (typeof UNIDADES_MEDIDA)[number]

/**
 * Limites físicos de sanidade.
 *
 * O teto é o comprimento da barra: uma sobra é o que restou de uma barra, e
 * não existe resto maior do que a peça de onde ele veio. Barra de alumínio é
 * vendida em 6 metros, então nada no estoque passa disso.
 *
 * Quando um perfil tem barra de comprimento diferente, o limite que vale é o
 * dele — ver `comprimentoMaximoDoPerfil`. Este valor aqui é a última barreira,
 * para o caso de não haver perfil escolhido ainda.
 */
export const LIMITES = {
  /** Nenhuma peça útil tem menos de 1 mm. */
  comprimentoMinimoMm: 1,
  /** 6 metros: o comprimento da barra inteira. */
  comprimentoMaximoMm: 6_000,
  quantidadeMinima: 1,
  quantidadeMaxima: 9_999,
} as const
