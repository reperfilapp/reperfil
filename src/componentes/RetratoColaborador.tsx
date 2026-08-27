import { useEffect, useState } from 'react'
import {
  obterLinkTemporario,
  BALDE_FOTOS_COLABORADOR,
} from '@/lib/armazenamento'
import { cn } from '@/lib/utilitarios'

/**
 * Foto da pessoa, com as iniciais como reserva.
 *
 * As iniciais existem porque um ícone igual para todos não distingue
 * ninguém, enquanto duas letras já separam a Ana do Bruno numa lista.
 *
 * O balde é privado, então o endereço precisa ser assinado a cada exibição
 * — daí o efeito em vez de um `<img src={caminho}>` direto.
 *
 * Vivia dentro de `ColaboradorDetalhe.tsx`; saiu de lá quando o painel da
 * equipe, na tela inicial, passou a precisar do mesmo desenho. Duas cópias
 * divergiriam na primeira mudança de estilo.
 */
export function RetratoColaborador({
  caminho,
  nome,
  tamanho = 'grande',
  className,
}: {
  caminho: string | null
  nome: string
  /** `pequeno` para listas, `grande` para a ficha da pessoa. */
  tamanho?: 'pequeno' | 'grande'
  className?: string
}) {
  const [link, setLink] = useState<string | null>(null)

  useEffect(() => {
    if (caminho === null) {
      setLink(null)
      return
    }

    let ativo = true

    void obterLinkTemporario(BALDE_FOTOS_COLABORADOR, caminho).then((novo) => {
      // Sem a guarda, trocar de pessoa rápido numa lista faz a foto da
      // anterior chegar depois e sobrescrever a certa.
      if (ativo) setLink(novo)
    })

    return () => {
      ativo = false
    }
  }, [caminho])

  const medida = tamanho === 'pequeno' ? 'size-9' : 'size-16'
  const fonte = tamanho === 'pequeno' ? 'text-xs' : 'text-xl'

  const iniciais = nome
    .split(' ')
    .filter((parte) => parte.length > 2)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? '')
    .join('')

  if (link) {
    return (
      <img
        src={link}
        alt={`Foto de ${nome}`}
        className={cn(
          'bg-superficie-2 shrink-0 rounded-full object-cover',
          medida,
          className,
        )}
      />
    )
  }

  return (
    <div
      aria-hidden="true"
      className={cn(
        'bg-superficie-2 text-texto-suave flex shrink-0 items-center justify-center rounded-full font-bold',
        medida,
        fonte,
        className,
      )}
    >
      {iniciais}
    </div>
  )
}
