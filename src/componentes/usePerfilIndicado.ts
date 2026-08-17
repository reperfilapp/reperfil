import { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useModelosPerfil } from '@/dados/modelosPerfil'
import type { ModeloPerfil } from '@/tipos/banco'

/**
 * Recebe o perfil escolhido na tela de identificação.
 *
 * O atalho da câmera, dentro do campo de busca, leva para "Identificar
 * perfil" carregando de onde veio. Ao tocar num candidato, a pessoa volta
 * para cá com `?perfil=<id>` — e este gancho transforma isso na seleção,
 * para que ela não precise procurar de novo o perfil que acabou de
 * identificar.
 *
 * O parâmetro é apagado da URL logo depois. Sem isso, "trocar perfil"
 * ficaria impossível: qualquer nova renderização voltaria a selecionar o
 * mesmo perfil, e a tela pareceria travada.
 */
export function usePerfilIndicado(aoIndicar: (modelo: ModeloPerfil) => void) {
  const [parametros, definirParametros] = useSearchParams()
  const { data: modelos } = useModelosPerfil()

  const idIndicado = parametros.get('perfil')

  useEffect(() => {
    if (!idIndicado || !modelos) return

    const encontrado = modelos.find((m) => m.id === idIndicado)

    // Some com o parâmetro mesmo quando o perfil não existe mais: deixá-lo
    // na barra de endereços faria a tela tentar de novo a cada renderização.
    definirParametros({}, { replace: true })

    if (encontrado) aoIndicar(encontrado)
    // `aoIndicar` costuma ser uma função nova a cada renderização; incluí-la
    // aqui refaria o efeito à toa. O que importa é o id e a lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idIndicado, modelos])
}
