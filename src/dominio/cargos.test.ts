import { describe, it, expect } from 'vitest'
import {
  CARGOS,
  CARGOS_ATIVOS,
  rotuloCargo,
  permissoesIniciais,
  descreverPermissoes,
} from './cargos'
import type { PapelUsuario } from '@/tipos/banco'

describe('cargos', () => {
  it('tem rótulo para todo cargo que o banco aceita', () => {
    // Se um cargo entrar no enum e não aqui, a tela mostra o valor cru do
    // banco — "administrador" onde deveria dizer "Admin".
    const doBanco: PapelUsuario[] = [
      'administrador',
      'gerente',
      'financeiro',
      'vendedor',
      'serralheiro',
      'auxiliar',
      'estoque',
    ]

    for (const papel of doBanco) {
      expect(rotuloCargo(papel)).toBeTruthy()
    }
  })

  it('não oferece o cargo legado no cadastro', () => {
    // 'estoque' continua válido no banco, para os perfis já gravados, mas
    // ninguém novo deve ser cadastrado nele.
    expect(CARGOS_ATIVOS).not.toContain('estoque')
    expect(CARGOS['estoque']).toBeDefined()
  })

  it('oferece todos os outros', () => {
    const oferecidos = new Set(CARGOS_ATIVOS)
    const todos = Object.keys(CARGOS) as PapelUsuario[]

    for (const papel of todos) {
      if (papel !== 'estoque') expect(oferecidos.has(papel)).toBe(true)
    }
  })
})

describe('permissões iniciais do cargo', () => {
  it('dá tudo ao administrador', () => {
    expect(permissoesIniciais('administrador')).toEqual({
      pode_movimentar_estoque: true,
      pode_gerenciar_cadastros: true,
      pode_gerenciar_colaboradores: true,
    })
  })

  it('só o administrador gerencia colaboradores por padrão', () => {
    // Liberar isso para outro cargo é decisão de quem administra, feita na
    // tela de permissões — não um padrão que o sistema impõe.
    for (const papel of CARGOS_ATIVOS) {
      if (papel === 'administrador') continue
      expect(permissoesIniciais(papel).pode_gerenciar_colaboradores).toBe(false)
    }
  })

  it('quem mexe no depósito movimenta estoque', () => {
    expect(permissoesIniciais('gerente').pode_movimentar_estoque).toBe(true)
    expect(permissoesIniciais('auxiliar').pode_movimentar_estoque).toBe(true)
  })

  it('quem só consulta não movimenta estoque', () => {
    // O serralheiro reserva e confirma o que usou — isso não é movimentar
    // estoque no sentido de cadastrar peça e corrigir quantidade.
    expect(permissoesIniciais('serralheiro').pode_movimentar_estoque).toBe(
      false,
    )
    expect(permissoesIniciais('vendedor').pode_movimentar_estoque).toBe(false)
    expect(permissoesIniciais('financeiro').pode_movimentar_estoque).toBe(false)
  })

  it('mantém o cargo legado equivalente a auxiliar', () => {
    expect(permissoesIniciais('estoque')).toEqual(
      permissoesIniciais('auxiliar'),
    )
  })
})

describe('descrição das permissões', () => {
  it('lista o que a pessoa pode', () => {
    expect(
      descreverPermissoes({
        pode_movimentar_estoque: true,
        pode_gerenciar_cadastros: true,
        pode_gerenciar_colaboradores: false,
      }),
    ).toBe('movimenta estoque · mexe nos cadastros')
  })

  it('diz que não há extras em vez de devolver vazio', () => {
    // Texto vazio na lista parece falha de carregamento; e este é o caso
    // mais comum, não uma exceção.
    expect(
      descreverPermissoes({
        pode_movimentar_estoque: false,
        pode_gerenciar_cadastros: false,
        pode_gerenciar_colaboradores: false,
      }),
    ).toBe('Sem permissões extras')
  })
})
