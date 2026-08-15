import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

/**
 * Junta classes do Tailwind resolvendo conflitos — a última vence.
 * `cn('p-2', condicao && 'p-4')` resulta em `p-4` quando a condição é verdadeira.
 */
export function cn(...entradas: ClassValue[]): string {
  return twMerge(clsx(entradas))
}
