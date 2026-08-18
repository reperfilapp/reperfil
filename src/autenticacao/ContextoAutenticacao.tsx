import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { registrarAcesso } from '@/dados/colaboradores'
import type { PerfilUsuario } from '@/tipos/banco'
import { ContextoAutenticacao, type EstadoAutenticacao } from './contexto'

export function ProvedorAutenticacao({ children }: { children: ReactNode }) {
  const [sessao, setSessao] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [semAcesso, setSemAcesso] = useState(false)

  const buscarPerfil = useCallback(async (idUsuario: string) => {
    // `maybeSingle` em vez de `single`: usuário sem perfil é situação
    // prevista, não erro. O RLS já garante que só vem o perfil dele.
    const { data, error } = await supabase
      .from('perfis_usuario')
      .select('*')
      .eq('id', idUsuario)
      .eq('ativo', true)
      .maybeSingle<PerfilUsuario>()

    if (error) {
      console.error('Falha ao carregar o perfil do usuário:', error.message)
      setPerfil(null)
      setSemAcesso(true)
      return
    }

    setPerfil(data)
    setSemAcesso(data === null)

    return data
  }, [])

  useEffect(() => {
    let ativo = true

    // Restaura a sessão guardada antes de decidir o que mostrar, para não
    // piscar a tela de login para quem já está autenticado.
    void supabase.auth.getSession().then(async ({ data }) => {
      if (!ativo) return

      setSessao(data.session)

      if (data.session) {
        await buscarPerfil(data.session.user.id)
      }

      if (ativo) {
        setCarregando(false)
      }
    })

    const { data: assinatura } = supabase.auth.onAuthStateChange(
      (_evento, novaSessao) => {
        if (!ativo) return

        setSessao(novaSessao)

        if (novaSessao) {
          void buscarPerfil(novaSessao.user.id)
        } else {
          setPerfil(null)
          setSemAcesso(false)
        }
      },
    )

    return () => {
      ativo = false
      assinatura.subscription.unsubscribe()
    }
  }, [buscarPerfil])

  const entrar = useCallback(
    async (email: string, senha: string) => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: senha,
      })

      if (error) {
        throw error
      }

      // Anotado aqui, e não no `onAuthStateChange`: aquele evento também
      // dispara quando a sessão é apenas restaurada ou renovada, e cada
      // abertura do aplicativo viraria um "acesso" — o histórico contaria
      // aberturas de tela em vez de dias trabalhados.
      const perfilAtual = await buscarPerfil(data.user.id)

      if (perfilAtual) {
        // Sem `await`: o histórico é informação de administrador, não
        // condição para trabalhar. Falhando, a pessoa entra do mesmo jeito.
        void registrarAcesso(perfilAtual.id, perfilAtual.organizacao_id)
      }
    },
    [buscarPerfil],
  )

  const sair = useCallback(async () => {
    const { error } = await supabase.auth.signOut()

    if (error) {
      throw error
    }
  }, [])

  const recarregarPerfil = useCallback(async () => {
    if (sessao) {
      await buscarPerfil(sessao.user.id)
    }
  }, [sessao, buscarPerfil])

  const valor = useMemo<EstadoAutenticacao>(
    () => ({
      sessao,
      perfil,
      carregando,
      semAcesso,
      entrar,
      sair,
      recarregarPerfil,
    }),
    [sessao, perfil, carregando, semAcesso, entrar, sair, recarregarPerfil],
  )

  return (
    <ContextoAutenticacao.Provider value={valor}>
      {children}
    </ContextoAutenticacao.Provider>
  )
}
