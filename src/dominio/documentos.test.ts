import { describe, it, expect } from 'vitest'
import {
  apenasDigitos,
  formatarCpfCnpj,
  erroCpfCnpj,
  formatarTelefone,
  erroTelefone,
  erroEmail,
} from './documentos'

describe('apenasDigitos', () => {
  it('tira tudo que não é número', () => {
    expect(apenasDigitos('529.982.247-25')).toBe('52998224725')
    expect(apenasDigitos('(54) 99999-0000')).toBe('54999990000')
  })
})

describe('máscara de CPF e CNPJ', () => {
  it('acompanha a digitação sem esperar o número completo', () => {
    // A máscara é aplicada a cada tecla; se só funcionasse no fim, o campo
    // ficaria sem pontuação enquanto se digita e pularia tudo de uma vez.
    expect(formatarCpfCnpj('529')).toBe('529')
    expect(formatarCpfCnpj('5299')).toBe('529.9')
    expect(formatarCpfCnpj('529982')).toBe('529.982')
    expect(formatarCpfCnpj('52998224')).toBe('529.982.24')
  })

  it('formata CPF completo', () => {
    expect(formatarCpfCnpj('52998224725')).toBe('529.982.247-25')
  })

  it('vira CNPJ ao passar de 11 dígitos, sem perguntar nada', () => {
    // Quem cadastra sabe o número, não a categoria dele. Um seletor "pessoa
    // física ou jurídica" seria uma pergunta que o próprio número responde.
    expect(formatarCpfCnpj('11222333000181')).toBe('11.222.333/0001-81')
  })

  it('para de aceitar no tamanho do CNPJ', () => {
    expect(formatarCpfCnpj('112223330001819999')).toBe('11.222.333/0001-81')
  })

  it('aceita o número já pontuado, vindo do banco', () => {
    expect(formatarCpfCnpj('529.982.247-25')).toBe('529.982.247-25')
  })
})

describe('validação de CPF e CNPJ', () => {
  it('aceita documento válido', () => {
    expect(erroCpfCnpj('529.982.247-25')).toBeNull()
    expect(erroCpfCnpj('11.222.333/0001-81')).toBeNull()
  })

  it('não reclama de campo vazio', () => {
    // Documento é opcional em todo cadastro do app.
    expect(erroCpfCnpj('')).toBeNull()
    expect(erroCpfCnpj('   ')).toBeNull()
  })

  it('reclama de tamanho errado', () => {
    expect(erroCpfCnpj('529.982.247')).toMatch(/dígitos/)
  })

  it('pega o dígito verificador errado', () => {
    // O caso que motiva a validação: um número trocado de lugar passa
    // despercebido até virar nota fiscal.
    expect(erroCpfCnpj('529.982.247-26')).toMatch(/CPF/)
    expect(erroCpfCnpj('11.222.333/0001-82')).toMatch(/CNPJ/)
  })

  it('barra sequência de dígito repetido', () => {
    // 111.111.111-11 passa na conta do módulo 11 e é inválido por
    // convenção. É o que alguém digita para furar campo obrigatório.
    expect(erroCpfCnpj('111.111.111-11')).not.toBeNull()
    expect(erroCpfCnpj('00.000.000/0000-00')).not.toBeNull()
  })
})

describe('máscara de telefone', () => {
  it('abre o parêntese do DDD já no primeiro dígito', () => {
    expect(formatarTelefone('5')).toBe('(5')
    expect(formatarTelefone('54')).toBe('(54')
    expect(formatarTelefone('549')).toBe('(54) 9')
  })

  it('formata fixo de 10 dígitos', () => {
    expect(formatarTelefone('5432211234')).toBe('(54) 3221-1234')
  })

  it('formata celular de 11 dígitos', () => {
    expect(formatarTelefone('54999990000')).toBe('(54) 99999-0000')
  })

  it('para no tamanho do celular', () => {
    expect(formatarTelefone('549999900001111')).toBe('(54) 99999-0000')
  })
})

describe('validação de telefone', () => {
  it('aceita fixo e celular', () => {
    expect(erroTelefone('(54) 3221-1234')).toBeNull()
    expect(erroTelefone('(54) 99999-0000')).toBeNull()
  })

  it('não reclama de campo vazio', () => {
    expect(erroTelefone('')).toBeNull()
  })

  it('reclama de número incompleto', () => {
    expect(erroTelefone('(54) 9999-000')).toMatch(/dígitos/)
  })

  it('pega o número digitado sem DDD', () => {
    // O erro mais comum: a pessoa digita o número de casa e esquece que
    // quem vai ligar pode estar noutro estado. Sem DDD, os dois primeiros
    // dígitos viram um DDD que não existe.
    expect(erroTelefone('3221-1234')).not.toBeNull()
    expect(erroTelefone('09999900001')).toMatch(/DDD/)
  })
})

describe('validação de e-mail', () => {
  it('aceita endereço comum', () => {
    expect(erroEmail('fulano@gmail.com')).toBeNull()
    expect(erroEmail('fulano.silva+obra@empresa.com.br')).toBeNull()
  })

  it('não reclama de campo vazio', () => {
    expect(erroEmail('')).toBeNull()
  })

  it('pega o espaço no meio', () => {
    expect(erroEmail('fulano @gmail.com')).toMatch(/espaços/)
  })

  it('pega a falta do arroba e das partes', () => {
    expect(erroEmail('fulanogmail.com')).toMatch(/@/)
    expect(erroEmail('@gmail.com')).toMatch(/@/)
    expect(erroEmail('fulano@')).toMatch(/@/)
  })

  it('pega o domínio sem ponto', () => {
    expect(erroEmail('fulano@gmail')).toMatch(/domínio/)
    expect(erroEmail('fulano@gmail.')).toMatch(/domínio/)
  })

  it('aceita forma estranha porém válida', () => {
    // Validação rígida rejeita endereço legítimo, e aí a pessoa não tem
    // como convencer o sistema de que o próprio e-mail existe.
    expect(erroEmail("o'brien@sub.dominio.io")).toBeNull()
  })
})
