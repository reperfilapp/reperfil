import {
  Package,
  Ruler,
  Layers,
  Rows3,
  Boxes,
  PackagePlus,
  Scissors,
  Search,
  ClipboardList,
  Puzzle,
  type LucideIcon,
} from 'lucide-react'

/**
 * Catálogo dos cards que a empresa pode escolher para a tela inicial —
 * `Inicio.tsx` só sabe desenhar o que estiver aqui, e `PersonalizarInicio.tsx`
 * só sabe oferecer isto como opção. As chaves devem casar exatamente com os
 * `check` da migração `20260831400000_cards_tela_inicial_configuraveis.sql`.
 *
 * Dois catálogos, porque os dois grupos são coisas diferentes: "resumo" é
 * um NÚMERO do sistema (quantas peças, quantos metros); "atalho" é um
 * DESTINO para onde ir. Cada card cadastrado (`CardTelaInicial`) sempre
 * pertence a um grupo e aponta para uma chave deste catálogo — nunca texto
 * livre.
 */

export const CATALOGO_RESUMO = {
  disponiveis: { rotulo: 'Disponíveis', Icone: Package, para: '/sobras' },
  metros: { rotulo: 'Metros', Icone: Ruler, para: '/sobras' },
  perfis: { rotulo: 'Perfis', Icone: Layers, para: '/perfis' },
  linhas: { rotulo: 'Linhas cadastradas', Icone: Rows3, para: '/perfis' },
  produtos: { rotulo: 'Produtos cadastrados', Icone: Boxes, para: '/produtos' },
} satisfies Record<string, { rotulo: string; Icone: LucideIcon; para: string }>

export type ItemResumo = keyof typeof CATALOGO_RESUMO

export const CATALOGO_ATALHO = {
  cadastrar: { rotulo: 'Cadastrar estoque', Icone: PackagePlus, para: '/cadastrar' },
  utilizar: {
    rotulo: 'Utilizar material',
    subrotulo: '(estoque)',
    Icone: Scissors,
    para: '/sobras',
  },
  perfis: { rotulo: 'Modelos de perfil', Icone: Layers, para: '/perfis' },
  produtos: { rotulo: 'Produtos e listas técnicas', Icone: Boxes, para: '/produtos' },
  linhas: { rotulo: 'Linhas e sistemas', Icone: Layers, para: '/linhas' },
  procurar: { rotulo: 'Procurar sobra', Icone: Search, para: '/procurar' },
  identificar: { rotulo: 'Identificar perfil', Icone: Ruler, para: '/identificar' },
  inventario: { rotulo: 'Inventário', Icone: ClipboardList, para: '/inventario' },
  acessorios: {
    rotulo: 'Estoque de acessórios',
    Icone: Puzzle,
    para: '/estoque-acessorios',
  },
} satisfies Record<
  string,
  { rotulo: string; subrotulo?: string; Icone: LucideIcon; para: string }
>

export type ItemAtalho = keyof typeof CATALOGO_ATALHO

/**
 * Só o item "Cadastrar estoque" tem permissão própria (quem não pode
 * movimentar estoque não vê, mesmo que a empresa tenha ligado o card) —
 * os demais dependem só da escolha da empresa.
 */
export const ITEM_ATALHO_RESTRITO: ItemAtalho = 'cadastrar'

/**
 * Cores — um conjunto FECHADO de nomes de token (não hex livre): este
 * projeto proíbe cor literal em componente. Os dois grupos têm paletas
 * diferentes porque têm papéis visuais diferentes — resumo é claro com
 * texto escuro, atalho é escuro com texto branco. Atalho não inclui
 * vermelho de propósito: essa cor é reservada para erro/exclusão em todo
 * o resto do app, nunca para uma ação normal.
 */
export const CORES_CARD_RESUMO = {
  padrao: { rotulo: 'Padrão (cinza)', classe: 'bg-celula hover:bg-superficie-2' },
  azul: { rotulo: 'Azul', classe: 'bg-acao-50 hover:bg-acao-100' },
  verde: { rotulo: 'Verde', classe: 'bg-economia-50 hover:bg-economia-100' },
  amarelo: { rotulo: 'Amarelo', classe: 'bg-atencao-50 hover:bg-atencao-100' },
  lilas: { rotulo: 'Lilás', classe: 'bg-lilas-50 hover:bg-lilas-100' },
} as const

export type CorCardResumo = keyof typeof CORES_CARD_RESUMO
export const CORES_RESUMO_PADRAO: CorCardResumo = 'padrao'

export const CORES_ATALHO = {
  azul: { rotulo: 'Azul', classe: 'bg-acao-600 hover:bg-acao-700' },
  'azul-escuro': { rotulo: 'Azul escuro', classe: 'bg-acao-700 hover:bg-acao-800' },
  grafite: { rotulo: 'Grafite', classe: 'bg-grafite-700 hover:bg-grafite-800' },
  verde: { rotulo: 'Verde', classe: 'bg-economia-700 hover:bg-economia-600' },
  amarelo: { rotulo: 'Amarelo', classe: 'bg-atencao-600 hover:bg-atencao-700' },
  lilas: { rotulo: 'Lilás', classe: 'bg-lilas-600 hover:bg-lilas-700' },
} as const

export type CorAtalho = keyof typeof CORES_ATALHO
export const CORES_ATALHO_PADRAO: CorAtalho = 'azul'

export function classeCardResumo(cor: string | null | undefined): string {
  return (
    CORES_CARD_RESUMO[cor as CorCardResumo]?.classe ??
    CORES_CARD_RESUMO[CORES_RESUMO_PADRAO].classe
  )
}

export function classeAtalho(cor: string | null | undefined): string {
  return (
    CORES_ATALHO[cor as CorAtalho]?.classe ?? CORES_ATALHO[CORES_ATALHO_PADRAO].classe
  )
}

/**
 * Seleção e ordem padrão — reproduz exatamente os 7 cards fixos de antes
 * desta funcionalidade. Usada como fallback enquanto a configuração da
 * organização não chega, e é o mesmo conjunto que a migração grava para
 * toda organização (nova ou já existente).
 */
export const PADRAO_RESUMO: { item: ItemResumo; cor: CorCardResumo }[] = [
  { item: 'disponiveis', cor: 'padrao' },
  { item: 'metros', cor: 'padrao' },
  { item: 'perfis', cor: 'padrao' },
]

export const PADRAO_ATALHO: { item: ItemAtalho; cor: CorAtalho }[] = [
  { item: 'cadastrar', cor: 'azul' },
  { item: 'utilizar', cor: 'azul-escuro' },
  { item: 'perfis', cor: 'grafite' },
  { item: 'produtos', cor: 'verde' },
]
