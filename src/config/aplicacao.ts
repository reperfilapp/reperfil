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

/**
 * Dados da empresa que usa o sistema. Estes valores são apenas o padrão
 * inicial da instalação — a partir da Fase 1 cada organização guarda os
 * seus próprios dados na tabela `organizacoes`, e o que vale é o do banco.
 */
export const EMPRESA_PADRAO = {
  nomeFantasia: 'Sua Empresa',
  razaoSocial: '',
  cnpj: '',
  telefone: '',
  email: '',
  site: '',
  endereco: {
    logradouro: '',
    numero: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
  },
} as const

/**
 * Unidades aceitas na entrada de medidas. O armazenamento é SEMPRE em
 * milímetros inteiros; estas opções existem só para a conversão na tela.
 */
export const UNIDADES_MEDIDA = ['mm', 'cm', 'm'] as const
export type UnidadeMedida = (typeof UNIDADES_MEDIDA)[number]

/**
 * Limites físicos de sanidade, independentes de configuração do usuário.
 * A barra padrão é 6.000 mm, mas perfis especiais podem ser maiores —
 * por isso o teto é generoso. O objetivo aqui é barrar erro de digitação
 * (um zero a mais), não impor regra de negócio.
 */
export const LIMITES = {
  /** Nenhuma peça útil tem menos de 1 mm. */
  comprimentoMinimoMm: 1,
  /** 18 metros: acima disso é certamente erro de digitação. */
  comprimentoMaximoMm: 18_000,
  quantidadeMinima: 1,
  quantidadeMaxima: 9_999,
} as const
