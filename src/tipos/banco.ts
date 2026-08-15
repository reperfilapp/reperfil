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

export type PapelUsuario = 'administrador' | 'estoque' | 'serralheiro'

export type StatusLote =
  'disponivel' | 'reservada' | 'consumida' | 'descartada' | 'em_conferencia'

export type StatusReserva =
  'ativa' | 'retirada' | 'consumida' | 'cancelada' | 'expirada'

export type EstadoConservacao = 'bom' | 'regular' | 'ruim'

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
  telefone: string | null
  email: string | null
  cidade: string | null
  estado: string | null
  ativo: boolean
  criado_em: string
}

export interface PerfilUsuario {
  id: string
  organizacao_id: string
  nome: string
  email: string
  telefone: string | null
  papel: PapelUsuario
  pode_informar_sobra_resultante: boolean
  ativo: boolean
  criado_em: string
}

export interface ModeloPerfil {
  id: string
  organizacao_id: string
  codigo: string
  descricao: string
  fabricante: string | null
  linha: string | null
  categoria: string | null
  imagem_url: string | null
  codigo_barras: string | null
  comprimento_barra_mm: number
  peso_por_metro_g: number | null
  preco_por_metro_centavos: number | null
  observacoes: string | null
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
