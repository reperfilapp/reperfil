/**
 * Tipos das tabelas do banco.
 *
 * Escritos à mão, espelhando `supabase/migrations/`. Quando uma migration
 * mudar, este arquivo precisa mudar junto — o TypeScript não descobre isso
 * sozinho.
 *
 * Nomes idênticos aos do banco, em português (decisão D1), para que não
 * exista camada de tradução entre a consulta e o tipo.
 */

/**
 * Cargo do colaborador.
 *
 * `estoque` é legado do modelo antigo: continua válido no banco, some do
 * cadastro e vale como auxiliar. Ver a migração
 * `20260818100000_cargos_de_colaborador.sql`.
 */
export type PapelUsuario =
  | 'administrador'
  | 'gerente'
  | 'financeiro'
  | 'vendedor'
  | 'serralheiro'
  | 'auxiliar'
  | 'estoque'

export type StatusLote =
  'disponivel' | 'reservada' | 'consumida' | 'descartada' | 'em_conferencia'

export type StatusReserva =
  'ativa' | 'retirada' | 'consumida' | 'cancelada' | 'expirada'

export type EstadoConservacao =
  | 'excelente'
  | 'bom'
  | 'pequenos_arranhoes'
  | 'muito_avariado'
  | 'novo_embalado'

export type TipoAcabamento = 'natural' | 'anodizado' | 'pintura' | 'outro'

export type TipoMovimentacao =
  | 'entrada'
  | 'edicao'
  | 'reserva'
  | 'cancelamento_reserva'
  | 'expiracao_reserva'
  | 'retirada'
  | 'corte'
  | 'devolucao'
  | 'transferencia'
  | 'ajuste'
  | 'descarte'

export type PrioridadeSobra =
  'menor_sobra' | 'mais_antiga' | 'menor_deslocamento'

export interface Organizacao {
  id: string
  codigo: string

  nome_fantasia: string
  razao_social: string | null
  cnpj: string | null
  inscricao_estadual: string | null

  telefone: string | null
  whatsapp: string | null
  email: string | null
  site: string | null

  logradouro: string | null
  numero: string | null
  complemento: string | null
  bairro: string | null
  cidade: string | null
  estado: string | null
  cep: string | null

  logo_caminho: string | null

  ativo: boolean
  criado_em: string
  atualizado_em: string
}

export interface PerfilUsuario {
  id: string
  organizacao_id: string
  nome: string
  email: string
  telefone: string | null
  cpf: string | null
  /** Caminho no balde privado, não endereço público. */
  foto_url: string | null
  papel: PapelUsuario
  pode_informar_sobra_resultante: boolean
  /**
   * Permissões efetivas. Começam no padrão do cargo e depois vivem por
   * conta própria — quem gerencia colaboradores pode ajustá-las pessoa a
   * pessoa sem trocar o cargo de ninguém.
   */
  pode_movimentar_estoque: boolean
  pode_gerenciar_cadastros: boolean
  pode_gerenciar_colaboradores: boolean
  ativo: boolean
  criado_em: string
}

/** Convite aberto: quem o administrador autorizou a criar conta. */
export interface ConviteColaborador {
  id: string
  organizacao_id: string
  email: string
  nome: string
  papel: PapelUsuario
  telefone: string | null
  criado_por: string | null
  criado_em: string
  aceito_em: string | null
}

export interface ModeloPerfil {
  id: string
  organizacao_id: string
  codigo: string
  descricao: string
  fabricante: string | null
  linha: string | null
  categoria: string | null
  /** Onde o perfil é usado na esquadria: "lateral da porta", "montante". */
  aplicacao: string | null
  /**
   * Medidas da seção, DERIVADAS do peso e do desenho (script
   * `scripts/calcular-secao.mjs`), não digitadas. Aproximadas em ±5%:
   * servem para achar o perfil com uma trena, nunca para calcular corte.
   *
   * Opcionais no tipo porque a migração que as cria pode ainda não ter sido
   * aplicada — nesse caso o banco não devolve as colunas, e a tela precisa
   * continuar funcionando.
   */
  largura_secao_mm?: number | null
  altura_secao_mm?: number | null
  /**
   * Cotas internas (aba, câmara, encaixe), informadas à mão. Não saem do
   * desenho como as duas acima — só medindo a peça. Opcionais.
   */
  medida_3_secao_mm?: number | null
  medida_4_secao_mm?: number | null
  imagem_url: string | null
  codigo_barras: string | null
  comprimento_barra_mm: number
  peso_por_metro_g: number | null
  preco_por_metro_centavos: number | null
  observacoes: string | null
  revisado: boolean
  ativo: boolean
  criado_em: string
}

export interface Acabamento {
  id: string
  organizacao_id: string
  codigo: string
  nome: string
  tipo: TipoAcabamento
  codigo_ral: string | null
  descricao: string | null
  cor_hex: string | null
  ativo: boolean
}

export interface Localizacao {
  id: string
  organizacao_id: string
  codigo: string
  deposito: string | null
  setor: string | null
  corredor: string | null
  estante: string | null
  prateleira: string | null
  posicao: string | null
  observacao: string | null
  ativo: boolean
}

export interface LoteSobra {
  id: string
  organizacao_id: string
  codigo: string
  modelo_perfil_id: string
  acabamento_id: string
  localizacao_id: string | null
  comprimento_mm: number
  quantidade: number
  quantidade_reservada: number
  estado: EstadoConservacao
  status: StatusLote
  foto_url: string | null
  origem: string | null
  obra_origem: string | null
  lote_origem_id: string | null
  observacoes: string | null
  /** Tipo de entrada: 'novo' = direto do fornecedor, 'sobra' = saiu de um corte/obra. */
  tipo_material: 'novo' | 'sobra'
  /** Nome do cliente ou da obra de onde veio o material (texto livre). */
  cliente_obra: string | null
  criado_em: string
  atualizado_em: string
  criado_por: string | null
  versao: number
}

export interface Reserva {
  id: string
  organizacao_id: string
  codigo: string
  lote_id: string
  quantidade: number
  status: StatusReserva
  expira_em: string
  comprimento_utilizado_mm: number | null
  lote_resultante_id: string | null
  observacoes: string | null
  motivo_cancelamento: string | null
  criado_em: string
  criado_por: string | null
  retirada_em: string | null
  consumida_em: string | null
}

export interface Cliente {
  id: string
  organizacao_id: string
  codigo: string
  nome: string
  nome_fantasia: string | null
  cpf_cnpj: string | null
  cidade: string | null
  estado: string | null
  telefone: string | null
  whatsapp: string | null
  email: string | null
  contato_principal: string | null
  observacoes: string | null
  ativo: boolean
}

export interface ConfiguracoesAplicacao {
  id: string
  organizacao_id: string
  comprimento_barra_padrao_mm: number
  espessura_serra_mm: number
  margem_limpeza_mm: number
  comprimento_minimo_sobra_mm: number
  ultimo_corte_gera_perda: boolean
  prazo_reserva_horas: number
  prioridade_utilizacao: PrioridadeSobra
  considerar_perfis_equivalentes: boolean
  confirmado_pelo_administrador: boolean
  confirmado_em: string | null
}

export interface MovimentacaoEstoque {
  id: string
  organizacao_id: string
  lote_id: string
  reserva_id: string | null
  tipo: TipoMovimentacao
  quantidade: number
  comprimento_mm: number | null
  justificativa: string | null
  criado_em: string
  criado_por: string | null
}

/**
 * Item pronto que a serralheria fabrica.
 *
 * As medidas são do produto ACABADO, não de corte: é assim que o cliente
 * pede ("janela 1,50 por 1,00") e é assim que se procura na lista.
 */
export interface Produto {
  id: string
  organizacao_id: string
  codigo: string
  nome: string
  descricao: string | null
  largura_mm: number | null
  altura_mm: number | null
  observacoes: string | null
  /** Caminhos no balde privado, não endereços públicos. */
  foto_url: string | null
  desenho_url: string | null
  ativo: boolean
  criado_em: string
}

/** Uma linha da lista técnica: um corte que entra numa unidade do produto. */
export interface ItemListaTecnica {
  id: string
  organizacao_id: string
  produto_id: string
  modelo_perfil_id: string
  comprimento_mm: number
  /** Peças deste corte por UMA unidade do produto. */
  quantidade: number
  /**
   * Posição na lista, começando em 1 — a sequência de montagem.
   *
   * Opcional no tipo porque a migração que a criou pode não ter sido
   * aplicada ainda; nesse caso o banco não devolve a coluna.
   */
  ordem?: number | null
  observacao: string | null
  criado_em: string
}
