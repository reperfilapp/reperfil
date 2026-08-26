import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { registrarAcesso } from '@/dados/colaboradores'
import type { PerfilUsuario } from '@/tipos/banco'
import { ContextoAutenticacao, type EstadoAutenticacao } from './contexto'

export function ProvedorAutenticacao({ children }: { children: ReactNode }) {
  const clienteConsultas = useQueryClient()
  const [sessao, setSessao] = useState<Session | null>(null)
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [semAcesso, setSemAcesso] = useState(false)
  const [erroPerfil, setErroPerfil] = useState<string | null>(null)

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

      // Falha ao PERGUNTAR não é o mesmo que "não tem acesso".
      //
      // Antes, qualquer erro aqui virava `semAcesso = true`, e a tela
      // acusava "sua conta não está vinculada a uma empresa — peça ao
      // administrador". Uma queda de rede de um segundo, no depósito,
      // bastava para dizer isso a quem tem acesso há meses. Pior: não
      // havia como tentar de novo, só sair e entrar.
      //
      // Agora o erro fica em `erroPerfil`, e a tela oferece "Tentar de
      // novo". `semAcesso` continua reservado ao caso real: perguntei,
      // o banco respondeu, e não existe perfil ativo.
      if (error) {
        console.error('Falha ao carregar o perfil do usuário:', error.message)
        setErroPerfil(error.message)
        return
      }

      perfilAtual.current = data
      setPerfil(data)
      setSemAcesso(data === null)
      setErroPerfil(null)

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
          setErroPerfil(null)

          // Sem isto, dado de uma empresa vaza para a próxima que entrar
          // NA MESMA aba: o React Query guarda cada consulta por uma
          // chave fixa (ex.: "a organização"), sem saber que a sessão por
          // trás mudou de gente. Uma consulta com `staleTime` alto (como
          // os dados da empresa, que "mudam raramente") continua sendo
          // servida do cache por minutos — agora seriam os dados de uma
          // empresa diferente da que acabou de entrar. Limpar tudo ao
          // sair fecha essa brecha pela raiz, em vez de caçar cada
          // consulta que algum dia ganhar um `staleTime`.
          clienteConsultas.clear()
        }
      },
    )

    return () => {
      ativo = false
      assinatura.subscription.unsubscribe()
    }
  }, [buscarPerfil, clienteConsultas])

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
      erroPerfil,
      entrar,
      sair,
      recarregarPerfil,
    }),
    [
      sessao,
      perfil,
      carregando,
      semAcesso,
      erroPerfil,
      entrar,
      sair,
      recarregarPerfil,
    ],
  )

  return (
    <ContextoAutenticacao.Provider value={valor}>
      {children}
    </ContextoAutenticacao.Provider>
  )
}
