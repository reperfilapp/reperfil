import { describe, it, expect } from 'vitest'
import { podeMovimentarEstoque, eAdministrador } from './contexto'
import type { PapelUsuario, PerfilUsuario } from '@/tipos/banco'

function perfilCom(papel: PapelUsuario): PerfilUsuario {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    organizacao_id: '00000000-0000-0000-0000-000000000002',
    nome: 'Fulano',
    email: 'fulano@exemplo.invalido',
    telefone: null,
    papel,
    pode_informar_sobra_resultante: false,
    ativo: true,
    criado_em: '2026-08-15T12:00:00Z',
  }
}

describe('podeMovimentarEstoque', () => {
  it('permite administrador e estoque', () => {
    expect(podeMovimentarEstoque(perfilCom('administrador'))).toBe(true)
    expect(podeMovimentarEstoque(perfilCom('estoque'))).toBe(true)
  })

  it('nega serralheiro, que consulta e reserva mas não cadastra', () => {
    expect(podeMovimentarEstoque(perfilCom('serralheiro'))).toBe(false)
  })

  it('nega quem não tem perfil carregado', () => {
    expect(podeMovimentarEstoque(null)).toBe(false)
  })
})

describe('eAdministrador', () => {
  it('reconhece apenas o administrador', () => {
    expect(eAdministrador(perfilCom('administrador'))).toBe(true)
    expect(eAdministrador(perfilCom('estoque'))).toBe(false)
    expect(eAdministrador(perfilCom('serralheiro'))).toBe(false)
  })

  it('nega quem não tem perfil carregado', () => {
    expect(eAdministrador(null)).toBe(false)
  })
})
