import { describe, it, expect } from 'vitest'
import {
  podeMovimentarEstoque,
  podeGerenciarCadastros,
  podeGerenciarColaboradores,
  eAdministrador,
} from './contexto'
import { permissoesIniciais } from '@/dominio/cargos'
import type { PapelUsuario, PerfilUsuario } from '@/tipos/banco'

/** Perfil no estado em que o cargo o deixa ao entrar. */
function perfilCom(
  papel: PapelUsuario,
  ajustes: Partial<PerfilUsuario> = {},
): PerfilUsuario {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    organizacao_id: '00000000-0000-0000-0000-000000000002',
    nome: 'Fulano',
    email: 'fulano@exemplo.invalido',
    apelido: null,
    telefone: null,
    cpf: null,
    foto_url: null,
    papel,
    pode_informar_sobra_resultante: false,
    ...permissoesIniciais(papel),
    ativo: true,
    criado_em: '2026-08-15T12:00:00Z',
    email_confirmado_em: null,
    ...ajustes,
  }
}

describe('podeMovimentarEstoque', () => {
  it('permite quem tem a permissão', () => {
    expect(podeMovimentarEstoque(perfilCom('administrador'))).toBe(true)
    expect(podeMovimentarEstoque(perfilCom('auxiliar'))).toBe(true)
    expect(podeMovimentarEstoque(perfilCom('gerente'))).toBe(true)
    // Está no depósito com a peça em mãos — cadastra estoque por padrão.
    expect(podeMovimentarEstoque(perfilCom('serralheiro'))).toBe(true)
  })

  it('nega quem não tem perfil carregado', () => {
    expect(podeMovimentarEstoque(null)).toBe(false)
  })

  it('segue a permissão, não o cargo', () => {
    // O ponto de todo o desenho: o administrador libera a tarefa para uma
    // pessoa sem promovê-la a um cargo que ela não tem na empresa.
    const vendedor = perfilCom('vendedor', { pode_movimentar_estoque: true })
    expect(podeMovimentarEstoque(vendedor)).toBe(true)

    const gerenteSemAcesso = perfilCom('gerente', {
      pode_movimentar_estoque: false,
    })
    expect(podeMovimentarEstoque(gerenteSemAcesso)).toBe(false)
  })
})

describe('podeGerenciarCadastros', () => {
  it('permite administrador e gerente por padrão', () => {
    expect(podeGerenciarCadastros(perfilCom('administrador'))).toBe(true)
    expect(podeGerenciarCadastros(perfilCom('gerente'))).toBe(true)
  })

  it('nega quem só movimenta peça', () => {
    expect(podeGerenciarCadastros(perfilCom('auxiliar'))).toBe(false)
  })
})

describe('podeGerenciarColaboradores', () => {
  it('só o administrador, por padrão', () => {
    expect(podeGerenciarColaboradores(perfilCom('administrador'))).toBe(true)
    expect(podeGerenciarColaboradores(perfilCom('gerente'))).toBe(false)
    expect(podeGerenciarColaboradores(perfilCom('financeiro'))).toBe(false)
  })

  it('mas pode ser concedido a quem o administrador quiser', () => {
    // O caso que originou a funcionalidade: autorizar o financeiro a
    // cadastrar colaborador sem torná-lo administrador do sistema.
    const financeiro = perfilCom('financeiro', {
      pode_gerenciar_colaboradores: true,
    })
    expect(podeGerenciarColaboradores(financeiro)).toBe(true)
    expect(eAdministrador(financeiro)).toBe(false)
  })

  it('nega quem não tem perfil carregado', () => {
    expect(podeGerenciarColaboradores(null)).toBe(false)
  })
})

describe('eAdministrador', () => {
  it('reconhece apenas o cargo de administrador', () => {
    expect(eAdministrador(perfilCom('administrador'))).toBe(true)
    expect(eAdministrador(perfilCom('gerente'))).toBe(false)
    expect(eAdministrador(perfilCom('serralheiro'))).toBe(false)
  })

  it('nega quem não tem perfil carregado', () => {
    expect(eAdministrador(null)).toBe(false)
  })
})

describe('antes da migração das permissões', () => {
  it('cai no padrão do cargo quando a coluna nem vem do banco', () => {
    // Sem a migração aplicada, o Supabase não devolve estas colunas e elas
    // chegam AUSENTES. Se ausente valesse "não pode", o administrador
    // ficaria trancado para fora da tela de colaboradores — justamente a
    // tela que ele precisa abrir.
    const semColunas = {
      ...perfilCom('administrador'),
    } as Partial<PerfilUsuario> as PerfilUsuario

    delete (semColunas as Partial<PerfilUsuario>).pode_movimentar_estoque
    delete (semColunas as Partial<PerfilUsuario>).pode_gerenciar_cadastros
    delete (semColunas as Partial<PerfilUsuario>).pode_gerenciar_colaboradores

    expect(podeGerenciarColaboradores(semColunas)).toBe(true)
    expect(podeMovimentarEstoque(semColunas)).toBe(true)
  })

  it('e continua negando quem o cargo não autoriza', () => {
    const serralheiro = {
      ...perfilCom('serralheiro'),
    } as Partial<PerfilUsuario> as PerfilUsuario

    delete (serralheiro as Partial<PerfilUsuario>).pode_gerenciar_colaboradores

    expect(podeGerenciarColaboradores(serralheiro)).toBe(false)
  })
})
