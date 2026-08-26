import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
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

  // Espelho do perfil para ser lido DENTRO de `buscarPerfil` sem entrar nas
  // dependências dela. Como estado, obrigaria a recriar a função a cada
  // mudança de perfil, e o efeito que assina o Supabase — que depende dela —
  // se desmontaria e remontaria junto, derrubando a assinatura no meio do
  // uso.
  const perfilAtual = useRef<PerfilUsuario | null>(null)

  const buscarPerfil = useCallback(async (idUsuario: string) => {
    // Marcar "carregando" AQUI, e não só na restauração inicial, é o que
    // impede o aviso de "acesso não liberado" de piscar a cada login.
    //
    // O que acontecia: `onAuthStateChange` registra a sessão no mesmo
    // instante em que a senha é aceita, mas o perfil chega depois, numa
    // segunda ida ao servidor. Entre uma coisa e outra havia sessão e
    // nenhum perfil — e a tela protegida lê isso como "autenticado e sem
    // acesso", que é exatamente o estado de quem foi barrado. A pessoa
    // entrando corretamente via a acusação de um problema que não existia.
    //
    // Perfil nulo tem dois significados, e eles precisavam ser distinguidos:
    // "ainda não sei" e "procurei e não achei". Este sinalizador é o
    // primeiro; `semAcesso` continua sendo o segundo.
    //
    // Só quando AINDA NÃO HÁ perfil, porém. O Supabase renova o token de
    // hora em hora e cada renovação passa por aqui: marcar carregando
    // sempre trocaria o pisca do login por um pisca no meio do trabalho, com
    // a tela inteira virando girador sem ninguém ter pedido nada. Havendo
    // perfil, a revalidação acontece em silêncio.
    if (perfilAtual.current === null) {
      setCarregando(true)
    }

    try {
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
        perfilAtual.current = null
        setPerfil(null)
        setSemAcesso(true)
        return
      }

      perfilAtual.current = data
      setPerfil(data)
      setSemAcesso(data === null)

      return data
    } finally {
      setCarregando(false)
    }
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
          perfilAtual.current = null
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
    if (!sessao) return null

    return (await buscarPerfil(sessao.user.id)) ?? null
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
