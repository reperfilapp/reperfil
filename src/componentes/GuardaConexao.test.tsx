import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { GuardaConexao } from './GuardaConexao'

/**
 * `navigator.onLine` é somente-leitura, então trocamos o descritor da
 * propriedade para simular a queda de rede.
 */
function simularRede(online: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online)
}

function dispararEvento(nome: 'online' | 'offline') {
  act(() => {
    window.dispatchEvent(new Event(nome))
  })
}

describe('GuardaConexao', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('mostra o conteúdo do app quando há conexão', () => {
    simularRede(true)

    render(
      <GuardaConexao>
        <p>Estoque de sobras</p>
      </GuardaConexao>,
    )

    expect(screen.getByText('Estoque de sobras')).toBeInTheDocument()
  })

  it('esconde o conteúdo e avisa quando não há conexão', () => {
    simularRede(false)

    render(
      <GuardaConexao>
        <p>Estoque de sobras</p>
      </GuardaConexao>,
    )

    expect(screen.queryByText('Estoque de sobras')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('Aguardando conexão')
  })

  it('libera o app sozinho quando a rede volta', () => {
    simularRede(false)

    render(
      <GuardaConexao>
        <p>Estoque de sobras</p>
      </GuardaConexao>,
    )

    expect(screen.queryByText('Estoque de sobras')).not.toBeInTheDocument()

    simularRede(true)
    dispararEvento('online')

    expect(screen.getByText('Estoque de sobras')).toBeInTheDocument()
  })

  it('bloqueia o app assim que a rede cai durante o uso', () => {
    simularRede(true)

    render(
      <GuardaConexao>
        <p>Estoque de sobras</p>
      </GuardaConexao>,
    )

    expect(screen.getByText('Estoque de sobras')).toBeInTheDocument()

    simularRede(false)
    dispararEvento('offline')

    expect(screen.queryByText('Estoque de sobras')).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toBeInTheDocument()
  })
})
