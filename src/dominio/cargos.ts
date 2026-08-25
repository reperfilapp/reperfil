import type { PapelUsuario } from '@/tipos/banco'

/**
 * Cargos e o que cada um pode fazer ao entrar.
 *
 * ── CARGO NÃO É PERMISSÃO ────────────────────────────────────────────────
 *
 * O cargo diz o que a pessoa FAZ na serralheria; a permissão diz o que o
 * sistema deixa ela fazer. Parecem a mesma coisa e não são: o financeiro de
 * uma empresa cadastra colaborador, o de outra não encosta nisso.
 *
 * Por isso o cargo aqui só define o PONTO DE PARTIDA — o que fica marcado
 * quando o convite é criado. Dali em diante, quem manda é a permissão
 * gravada no perfil da pessoa, que o administrador ajusta sem trocar o
 * cargo de ninguém. É o mesmo desenho do banco: as políticas de segurança
 * perguntam pela permissão, nunca pelo cargo.
 */
export interface Permissoes {
  pode_movimentar_estoque: boolean
  pode_gerenciar_cadastros: boolean
  pode_gerenciar_colaboradores: boolean
}

interface DescricaoCargo {
  rotulo: string
  /** O que a pessoa faz na empresa — não o que o sistema libera. */
  resumo: string
  padrao: Permissoes
}

const permissoes = (
  estoque: boolean,
  cadastros: boolean,
  colaboradores: boolean,
): Permissoes => ({
  pode_movimentar_estoque: estoque,
  pode_gerenciar_cadastros: cadastros,
  pode_gerenciar_colaboradores: colaboradores,
})

export const CARGOS: Record<PapelUsuario, DescricaoCargo> = {
  administrador: {
    rotulo: 'Admin',
    resumo: 'Responde pelo sistema: configura, corrige e libera acessos.',
    padrao: permissoes(true, true, true),
  },
  gerente: {
    rotulo: 'Gerente',
    resumo: 'Toca a operação: estoque e catálogo.',
    padrao: permissoes(true, true, false),
  },
  auxiliar: {
    rotulo: 'Auxiliar',
    resumo: 'Cadastra e movimenta peças no depósito.',
    padrao: permissoes(true, false, false),
  },
  serralheiro: {
    rotulo: 'Serralheiro',
    resumo: 'Procura peça, cadastra estoque, reserva e confirma o que usou.',
    padrao: permissoes(true, false, false),
  },
  vendedor: {
    rotulo: 'Vendedor',
    resumo: 'Consulta o estoque para atender o cliente.',
    padrao: permissoes(false, false, false),
  },
  financeiro: {
    rotulo: 'Financeiro',
    resumo: 'Consulta números e relatórios.',
    padrao: permissoes(false, false, false),
  },
  // Legado do modelo antigo. Não aparece no cadastro; existe para que um
  // perfil gravado antes desta mudança continue tendo rótulo na tela.
  estoque: {
    rotulo: 'Estoque',
    resumo: 'Cargo antigo, equivalente a auxiliar.',
    padrao: permissoes(true, false, false),
  },
}

/** Os cargos que o cadastro oferece, na ordem em que aparecem. */
export const CARGOS_ATIVOS: readonly PapelUsuario[] = [
  'serralheiro',
  'auxiliar',
  'vendedor',
  'financeiro',
  'gerente',
  'administrador',
]

export function rotuloCargo(papel: PapelUsuario): string {
  return CARGOS[papel].rotulo
}

export function permissoesIniciais(papel: PapelUsuario): Permissoes {
  return CARGOS[papel].padrao
}

/** Perfil como ele chega do banco: as permissões podem nem vir. */
export interface ComCargo extends Partial<Permissoes> {
  papel: PapelUsuario
}

/**
 * O que a pessoa pode, de fato.
 *
 * Enquanto a migração das permissões não é aplicada, o banco NÃO DEVOLVE
 * essas colunas e elas chegam ausentes — não falsas. Tratar ausente como
 * "não pode" trancaria o administrador para fora da própria tela de
 * colaboradores, no momento em que ele mais precisa dela. Ausente quer
 * dizer "ninguém decidiu ainda", e aí quem decide é o cargo.
 */
export function permissoesEfetivas(perfil: ComCargo): Permissoes {
  const padrao = permissoesIniciais(perfil.papel)

  return {
    pode_movimentar_estoque:
      perfil.pode_movimentar_estoque ?? padrao.pode_movimentar_estoque,
    pode_gerenciar_cadastros:
      perfil.pode_gerenciar_cadastros ?? padrao.pode_gerenciar_cadastros,
    pode_gerenciar_colaboradores:
      perfil.pode_gerenciar_colaboradores ??
      padrao.pode_gerenciar_colaboradores,
  }
}

/**
 * As permissões descritas para quem lê a tela.
 *
 * "Sem permissões extras" em vez de lista vazia: vazio parece defeito de
 * carregamento, e a maioria dos cargos é exatamente assim — consulta,
 * reserva e nada mais, que já é o suficiente para o dia a dia.
 */
export function descreverPermissoes(p: Permissoes): string {
  const partes: string[] = []

  if (p.pode_movimentar_estoque) partes.push('movimenta estoque')
  if (p.pode_gerenciar_cadastros) partes.push('mexe nos cadastros')
  if (p.pode_gerenciar_colaboradores) partes.push('gerencia colaboradores')

  return partes.length === 0 ? 'Sem permissões extras' : partes.join(' · ')
}

/**
 * Cada permissão como ela aparece na tela de ajuste.
 *
 * O texto diz o que a pessoa PASSA A PODER, não o nome técnico da coluna.
 * Quem marca a caixa está decidindo sobre trabalho — "cadastrar a peça que
 * chegou" —, não sobre um campo de banco de dados.
 */
export const PERMISSOES_EXPLICADAS: {
  chave: keyof Permissoes
  rotulo: string
  detalhe: string
}[] = [
  {
    chave: 'pode_movimentar_estoque',
    rotulo: 'Movimentar estoque',
    detalhe: 'Cadastrar a peça que chegou, dar baixa, corrigir quantidade.',
  },
  {
    chave: 'pode_gerenciar_cadastros',
    rotulo: 'Mexer nos cadastros',
    detalhe:
      'Catálogo de perfis, linhas, acabamentos, localizações e clientes.',
  },
  {
    chave: 'pode_gerenciar_colaboradores',
    rotulo: 'Gerenciar colaboradores',
    detalhe: 'Convidar colega, mudar cargo, ligar e desligar acesso.',
  },
]

/**
 * As permissões que fogem do padrão do cargo.
 *
 * Serve para a tela dizer "ajustado" em quem foi mexido à mão. Sem isso,
 * dois colaboradores com o mesmo cargo podem ter poderes diferentes e nada
 * na tela denuncia — e aí ninguém confia no que o cargo diz.
 */
export function permissoesAjustadas(perfil: ComCargo): (keyof Permissoes)[] {
  const padrao = permissoesIniciais(perfil.papel)
  const efetivas = permissoesEfetivas(perfil)

  return PERMISSOES_EXPLICADAS.map(({ chave }) => chave).filter(
    (chave) => efetivas[chave] !== padrao[chave],
  )
}
