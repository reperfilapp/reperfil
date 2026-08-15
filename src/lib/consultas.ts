import { QueryClient } from '@tanstack/react-query'

/**
 * Configuração central do cache de dados do servidor.
 *
 * O app exige conexão (decisão D3), então nada aqui é substituto de banco:
 * o cache existe para não repetir a mesma consulta a cada troca de tela, e
 * para revalidar quando o usuário volta ao aplicativo.
 *
 * `staleTime` curto de propósito. Estoque de depósito muda o tempo todo, e
 * mostrar uma sobra como disponível depois de outra pessoa reservá-la é
 * exatamente o erro que o RePerfil existe para eliminar.
 */
export const clienteConsultas = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
})

/**
 * Chaves de cache, centralizadas.
 *
 * Espalhar strings de chave pelo código é como o cache passa a mentir: uma
 * tela grava e invalida `['acabamentos']` enquanto outra lê
 * `['acabamento']`, e a segunda nunca atualiza.
 */
export const chaves = {
  acabamentos: ['acabamentos'] as const,
  localizacoes: ['localizacoes'] as const,
  modelosPerfil: ['modelos-perfil'] as const,
  clientes: ['clientes'] as const,
  configuracoes: ['configuracoes'] as const,
  organizacao: ['organizacao'] as const,
} as const
