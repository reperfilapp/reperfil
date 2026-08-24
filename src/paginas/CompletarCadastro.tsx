import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { useEditarColaborador } from '@/dados/colaboradores'
import {
  enviarFotoColaborador,
  obterLinkTemporario,
  BALDE_FOTOS_COLABORADOR,
} from '@/lib/armazenamento'
import { rotuloCargo } from '@/dominio/cargos'
import { Botao } from '@/componentes/ui/Botao'
import { CampoTexto } from '@/componentes/ui/CampoTexto'
import { CampoMascarado } from '@/componentes/ui/CampoMascarado'
import { CampoFoto } from '@/componentes/ui/CampoFoto'
import { MarcaRePerfil } from '@/componentes/MarcaRePerfil'

/**
 * Última etapa do primeiro acesso: conferir o cadastro e pôr o rosto.
 *
 * ── POR QUE A FOTO É EXIGIDA AQUI ────────────────────────────────────────
 *
 * O histórico de uma peça diz "quem cadastrou: J. Silva". Numa empresa com
 * dois Silvas isso não identifica ninguém — e é justamente quando algo deu
 * errado que se vai olhar. Pedir a foto depois, num cadastro que já
 * funciona, seria pedir para nunca: ninguém volta a uma tela que não
 * precisa. Aqui, ela é o passo que falta para começar a trabalhar.
 *
 * ── POR QUE OS DADOS APARECEM PARA CONFERÊNCIA ───────────────────────────
 *
 * Nome e telefone foram digitados pelo administrador, de cabeça, no momento
 * do convite. Quem sabe se está certo é o dono deles, e este é o único
 * momento em que ele olha para esses campos com atenção.
 */
export default function CompletarCadastro() {
  const { perfil, recarregarPerfil } = useAutenticacao()
  const editar = useEditarColaborador()
  const navegar = useNavigate()

  const [form, setForm] = useState({ nome: '', telefone: '', cpf: '' })
  const [foto, setFoto] = useState<string | null>(null)
  const [previa, setPrevia] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [concluido, setConcluido] = useState(false)

  useEffect(() => {
    if (perfil) {
      setForm({
        nome: perfil.nome,
        telefone: perfil.telefone ?? '',
        cpf: perfil.cpf ?? '',
      })
    }
  }, [perfil])

  useEffect(() => {
    if (foto === null) {
      setPrevia(null)
      return
    }

    void obterLinkTemporario(BALDE_FOTOS_COLABORADOR, foto).then(setPrevia)
  }, [foto])

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)

    if (perfil === null) return

    if (form.nome.trim() === '') {
      setErro('O nome não pode ficar vazio.')
      return
    }

    if (foto === null) {
      setErro('A foto é necessária para concluir o cadastro.')
      return
    }

    try {
      await editar.mutateAsync({
        id: perfil.id,
        dados: {
          nome: form.nome,
          telefone: form.telefone.trim() || null,
          cpf: form.cpf.trim() || null,
          foto_url: foto,
        },
      })

      // Sem isto a tela continuaria exigindo a foto que acabou de ser
      // enviada: quem decide se o cadastro está completo é o perfil em
      // memória, e ele ainda é o de antes do salvamento.
      await recarregarPerfil()

      // Só a mensagem — a navegação para o início espera o toque em "OK".
      // Sem isto, o salvamento acontecia certo mas a tela continuava exibindo
      // o mesmo formulário, sem nenhum sinal de que deu certo.
      setConcluido(true)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível concluir.')
    }
  }

  if (concluido) {
    return (
      <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-6 px-6 py-10 text-center">
        <div className="bg-economia-50 text-economia-700 rounded-full p-6">
          <CheckCircle2 aria-hidden="true" className="size-12" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Cadastro concluído</h1>
          <p className="text-texto-suave text-balance">
            Seus dados foram salvos com sucesso.
          </p>
        </div>

        <Botao
          tamanho="largura_total"
          onClick={() => navegar('/', { replace: true })}
        >
          OK
        </Botao>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col gap-6 px-6 py-10">
      <header className="flex flex-col items-center gap-4 text-center">
        <MarcaRePerfil
          variante="completa"
          className="max-w-44 rounded-xl bg-white p-3"
        />
        <div>
          <h1 className="text-2xl font-bold">Falta pouco</h1>
          <p className="text-texto-suave mt-1">
            Confira seus dados e coloque uma foto sua. É por ela que seus
            colegas vão reconhecer quem mexeu em cada peça.
          </p>
        </div>
      </header>

      <form onSubmit={aoEnviar} className="flex flex-col gap-5" noValidate>
        <CampoFoto
          rotulo="Sua foto"
          cameraFrontal
          rotuloBotao="Tirar foto"
          ajuda="Enquadre o rosto, como numa foto de crachá."
          aoEnviar={enviarFotoColaborador}
          caminho={foto}
          previa={previa}
          aoRemover={() => setFoto(null)}
          aoConcluir={setFoto}
        />

        <CampoTexto
          rotulo="Nome"
          value={form.nome}
          onChange={(e) => setForm({ ...form, nome: e.target.value })}
          required
        />

        <CampoMascarado
          rotulo="Telefone (opcional)"
          tipo="telefone"
          value={form.telefone}
          onChange={(telefone) => setForm({ ...form, telefone })}
        />

        <CampoMascarado
          rotulo="CPF (opcional)"
          tipo="cpf_cnpj"
          value={form.cpf}
          onChange={(cpf) => setForm({ ...form, cpf })}
        />

        {/* E-mail e cargo aparecem para conferência, e não para edição: o
            e-mail é o login, e o cargo é decisão de quem administra. */}
        <div className="bg-superficie-2 rounded-xl p-4 text-sm">
          <p className="flex justify-between gap-3">
            <span className="text-texto-suave">E-mail</span>
            <span className="truncate">{perfil?.email}</span>
          </p>
          <p className="mt-1 flex justify-between gap-3">
            <span className="text-texto-suave">Cargo</span>
            <span>{perfil && rotuloCargo(perfil.papel)}</span>
          </p>
          <p className="text-texto-suave mt-2">
            Algo errado aqui? Fale com quem convidou você.
          </p>
        </div>

        {erro && (
          <p
            role="alert"
            className="bg-erro-50 text-erro-700 rounded-xl px-4 py-3"
          >
            {erro}
          </p>
        )}

        <Botao
          type="submit"
          tamanho="largura_total"
          carregando={editar.isPending}
        >
          Concluir cadastro
        </Botao>
      </form>
    </main>
  )
}
