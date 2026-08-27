import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import {
  UserPlus,
  MailX,
  Mail,
  Power,
  PowerOff,
  ChevronRight,
  CheckCircle2,
  Loader2,
} from 'lucide-react'
import {
  useColaboradores,
  useConvitesAbertos,
  useConvidarColaborador,
  useCancelarConvite,
  useReenviarConvite,
  useAtivarColaborador,
  aguardarConfirmacaoDeEnvio,
} from '@/dados/colaboradores'
import { RetratoColaborador } from '@/componentes/RetratoColaborador'
import { PainelAcessosEquipe } from '@/componentes/PainelAcessosEquipe'
import {
  CARGOS_ATIVOS,
  rotuloCargo,
  permissoesAjustadas,
} from '@/dominio/cargos'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { podeGerenciarColaboradores } from '@/autenticacao/contexto'
import { Botao } from '@/componentes/ui/Botao'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { CampoTexto } from '@/componentes/ui/CampoTexto'
import { CampoMascarado } from '@/componentes/ui/CampoMascarado'
import { CampoSelecao } from '@/componentes/ui/CampoSelecao'
import { Modal } from '@/componentes/ui/Modal'
import { PaginaLista } from '@/componentes/ui/PaginaLista'
import type { ConviteColaborador, PapelUsuario } from '@/tipos/banco'
import { disparar } from '@/lib/avisoErro'

const VAZIO = {
  nome: '',
  email: '',
  telefone: '',
  papel: 'serralheiro' as PapelUsuario,
}

export default function Colaboradores() {
  const { perfil } = useAutenticacao()
  const [mostrarInativos, setMostrarInativos] = useState(false)
  const { data: colaboradores, isPending } = useColaboradores(mostrarInativos)

  /*
   * O histórico de acessos fica num painel recolhido no fim desta tela, e
   * só quem administra colaboradores o vê: para o colega, saber a que
   * horas o outro entrou não muda nada no trabalho — muda só a sensação de
   * estar sendo olhado. O banco já pensa igual (a política de
   * `acessos_sistema` exige essa mesma permissão para ver acesso alheio),
   * então esconder aqui evita pedir ao servidor o que ele recusaria.
   */
  const podeAdministrar = podeGerenciarColaboradores(perfil)
  const { data: convites } = useConvitesAbertos()

  const convidar = useConvidarColaborador()
  const cancelar = useCancelarConvite()
  const reenviar = useReenviarConvite()
  const ativar = useAtivarColaborador()

  const [aberto, setAberto] = useState(false)
  const [form, setForm] = useState(VAZIO)
  const [erro, setErro] = useState<string | null>(null)
  const [convidado, setConvidado] = useState<string | null>(null)

  // Convite em edição/reenvio — nulo quando o modal está fechado.
  const [reenviando, setReenviando] = useState<ConviteColaborador | null>(null)
  const [formReenvio, setFormReenvio] = useState(VAZIO)
  const [erroReenvio, setErroReenvio] = useState<string | null>(null)

  // Some sozinho quando outro convite é reenviado ou a tela é reaberta.
  const [statusReenvio, setStatusReenvio] = useState<{
    email: string
    situacao: 'confirmando' | 'confirmado' | 'sem_confirmacao'
  } | null>(null)

  function abrirReenvio(convite: ConviteColaborador) {
    setFormReenvio({
      nome: convite.nome,
      email: convite.email,
      telefone: convite.telefone ?? '',
      papel: convite.papel,
    })
    setErroReenvio(null)
    setReenviando(convite)
  }

  async function aoReenviar(evento: FormEvent) {
    evento.preventDefault()
    setErroReenvio(null)

    if (formReenvio.nome.trim() === '' || formReenvio.email.trim() === '') {
      setErroReenvio('Nome e e-mail são obrigatórios.')
      return
    }

    if (reenviando === null) return

    try {
      const novoConvite = await reenviar.mutateAsync({
        id: reenviando.id,
        dados: {
          nome: formReenvio.nome,
          email: formReenvio.email,
          papel: formReenvio.papel,
          telefone: formReenvio.telefone.trim() || null,
        },
      })
      setReenviando(null)

      // O envio é assíncrono (Database Webhook) — a gravação do convite
      // responde antes do e-mail sair de verdade. Em vez de já dizer
      // "enviado" no mesmo instante, espera a Edge Function confirmar.
      setStatusReenvio({ email: novoConvite.email, situacao: 'confirmando' })
      const confirmado = await aguardarConfirmacaoDeEnvio(novoConvite.id)
      setStatusReenvio({
        email: novoConvite.email,
        situacao: confirmado ? 'confirmado' : 'sem_confirmacao',
      })
    } catch (e) {
      setErroReenvio(
        e instanceof Error ? e.message : 'Não foi possível reenviar o convite.',
      )
    }
  }

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)

    if (form.nome.trim() === '' || form.email.trim() === '') {
      setErro('Nome e e-mail são obrigatórios.')
      return
    }

    if (perfil === null) return

    try {
      await convidar.mutateAsync({
        organizacao_id: perfil.organizacao_id,
        nome: form.nome,
        email: form.email,
        papel: form.papel,
        telefone: form.telefone.trim() || null,
      })

      // Guarda o e-mail para a instrução seguinte: o convite sozinho não
      // avisa ninguém, e quem convidou precisa saber o que dizer ao colega.
      setConvidado(form.email.trim().toLowerCase())
      setForm(VAZIO)
      setAberto(false)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível convidar.')
    }
  }

  return (
    <PaginaLista
      className="max-w-3xl"
      cabecalho={
        <>
          <BotaoVoltar para="/mais" rotulo="Mais" className="mb-4" />

          <header className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold">Equipe</h1>
              <p className="text-texto-suave mt-1">
                Quem entra no sistema e o que cada um pode fazer.
              </p>
            </div>
            <Botao onClick={() => setAberto(true)}>
              <UserPlus aria-hidden="true" className="size-5" />
              Convidar
            </Botao>
          </header>

          {/* Aparece depois de convidar, e some ao sair da tela. */}
          {convidado && (
            <div className="bg-superficie-2 mb-4 rounded-xl p-4 text-sm">
              <p className="font-medium">
                Convite registrado — um e-mail já foi enviado para {convidado}.
              </p>
              <p className="text-texto-suave mt-1">
                Se não chegar (foi para o spam ou o e-mail estava errado), use o
                botão de reenviar na lista abaixo.
              </p>
            </div>
          )}

          {/* Aparece depois de reenviar, com o resultado real da entrega —
              não só "a gente tentou". */}
          {statusReenvio && (
            <div className="bg-superficie-2 mb-4 flex items-start gap-2 rounded-xl p-4 text-sm">
              {statusReenvio.situacao === 'confirmando' && (
                <Loader2
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 animate-spin"
                />
              )}
              {statusReenvio.situacao === 'confirmado' && (
                <CheckCircle2
                  aria-hidden="true"
                  className="text-acao-600 mt-0.5 size-4 shrink-0"
                />
              )}
              <div>
                {statusReenvio.situacao === 'confirmando' && (
                  <p>Reenviando para {statusReenvio.email}…</p>
                )}
                {statusReenvio.situacao === 'confirmado' && (
                  <p className="font-medium">
                    E-mail reenviado com sucesso para {statusReenvio.email}.
                  </p>
                )}
                {statusReenvio.situacao === 'sem_confirmacao' && (
                  <p>
                    Convite atualizado para {statusReenvio.email} — não deu
                    tempo de confirmar o envio, mas o e-mail deve chegar em
                    instantes.
                  </p>
                )}
              </div>
            </div>
          )}

          {isPending && <p className="text-texto-suave">Carregando…</p>}
        </>
      }
      rodape={
        <div className="flex flex-col gap-2">
          {/* Fora da moldura da lista, no rodapé fixo: a lista é o cadastro
              da equipe, e o histórico é outro assunto — dentro do mesmo
              quadro, parecia mais uma linha do cadastro. */}
          {podeAdministrar && <PainelAcessosEquipe />}

          <div className="flex justify-center">
            <button
              type="button"
              onClick={() => setMostrarInativos((v) => !v)}
              className="text-acao-600 text-sm font-medium hover:underline"
            >
              {mostrarInativos ? 'Ocultar inativos' : 'Exibir inativos'}
            </button>
          </div>
        </div>
      }
    >
      {convites && convites.length > 0 && (
        <section className="mb-4">
          <h2 className="text-texto-suave mb-2 text-xs font-semibold tracking-wide uppercase">
            Convites aguardando
          </h2>

          <ul className="flex flex-col gap-2">
            {convites.map((convite) => (
              <li
                key={convite.id}
                className="bg-superficie-2 flex items-center gap-3 rounded-xl p-4"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {convite.nome}
                  </span>
                  <span className="text-texto-suave block truncate text-sm">
                    {convite.email} · {rotuloCargo(convite.papel)}
                  </span>
                </span>

                <Botao
                  variante="contorno"
                  onClick={() => abrirReenvio(convite)}
                  aria-label={`Reenviar ou corrigir convite de ${convite.nome}`}
                  title="Reenviar ou corrigir convite"
                >
                  <Mail aria-hidden="true" className="size-4" />
                </Botao>

                <Botao
                  variante="contorno"
                  onClick={() => disparar(cancelar.mutateAsync(convite.id))}
                  aria-label={`Cancelar convite de ${convite.nome}`}
                  title="Cancelar convite"
                >
                  <MailX aria-hidden="true" className="size-4" />
                </Botao>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ul className="flex flex-col gap-2">
        {colaboradores?.map((pessoa) => {
          const souEu = pessoa.id === perfil?.id

          return (
            <li
              key={pessoa.id}
              className="bg-celula border-borda flex items-center gap-3 rounded-xl border-2 p-4 shadow-sm"
            >
              {/* A linha inteira leva ao cadastro: é lá que se edita, troca
                  cargo, ajusta permissão e redefine senha. Aqui ficam só as
                  informações que se procura de relance. */}
              <Link
                to={`/colaboradores/${pessoa.id}`}
                className="flex min-w-0 flex-1 items-center gap-2"
                aria-label={`Abrir cadastro de ${pessoa.nome}`}
              >
                <RetratoColaborador
                  caminho={pessoa.foto_url}
                  nome={pessoa.nome}
                  tamanho="pequeno"
                />

                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {pessoa.nome}
                  </span>
                  <span className="text-texto-suave block truncate text-sm">
                    {pessoa.email}
                  </span>
                  <span className="text-texto-suave block truncate text-xs">
                    {souEu && <span className="mr-2">você</span>}
                    {rotuloCargo(pessoa.papel)}
                    {permissoesAjustadas(pessoa).length > 0 && (
                      <span className="text-atencao-700 ml-2">· ajustado</span>
                    )}
                  </span>

                </span>
                <ChevronRight
                  aria-hidden="true"
                  className="text-texto-suave size-4 shrink-0"
                />
              </Link>

              <Botao
                variante="contorno"
                disabled={souEu}
                onClick={() =>
                  disparar(
                    ativar.mutateAsync({
                      id: pessoa.id,
                      ativo: !pessoa.ativo,
                    }),
                  )
                }
                aria-label={`${pessoa.ativo ? 'Tirar o acesso de' : 'Devolver o acesso a'} ${pessoa.nome}`}
                title={pessoa.ativo ? 'Tirar o acesso' : 'Devolver o acesso'}
              >
                {pessoa.ativo ? (
                  <PowerOff aria-hidden="true" className="size-4" />
                ) : (
                  <Power aria-hidden="true" className="size-4" />
                )}
              </Botao>
            </li>
          )
        })}
      </ul>

      <Modal
        aberto={aberto}
        aoFechar={() => setAberto(false)}
        titulo="Convidar colaborador"
      >
        <form onSubmit={aoEnviar} className="flex flex-col gap-4" noValidate>
          <CampoTexto
            rotulo="Nome"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            required
          />

          <CampoMascarado
            rotulo="E-mail"
            tipo="email"
            value={form.email}
            onChange={(email) => setForm({ ...form, email })}
            ajuda="Precisa ser o mesmo e-mail que ele vai usar para entrar."
          />

          <CampoMascarado
            rotulo="Telefone (opcional)"
            tipo="telefone"
            value={form.telefone}
            onChange={(telefone) => setForm({ ...form, telefone })}
          />

          <CampoSelecao
            rotulo="Cargo"
            value={form.papel}
            onChange={(e) =>
              setForm({ ...form, papel: e.target.value as PapelUsuario })
            }
            ajuda="Define o que ele já pode fazer ao entrar. Dá para ajustar depois."
          >
            {CARGOS_ATIVOS.map((papel) => (
              <option key={papel} value={papel}>
                {rotuloCargo(papel)}
              </option>
            ))}
          </CampoSelecao>

          {erro && (
            <p
              role="alert"
              className="bg-erro-50 text-erro-700 rounded-xl px-4 py-3"
            >
              {erro}
            </p>
          )}

          <div className="flex gap-3">
            <Botao
              type="button"
              variante="contorno"
              onClick={() => setAberto(false)}
              className="flex-1"
            >
              Cancelar
            </Botao>
            <Botao
              type="submit"
              carregando={convidar.isPending}
              className="flex-1"
            >
              Convidar
            </Botao>
          </div>
        </form>
      </Modal>

      <Modal
        aberto={reenviando !== null}
        aoFechar={() => setReenviando(null)}
        titulo="Reenviar convite"
      >
        <form onSubmit={aoReenviar} className="flex flex-col gap-4" noValidate>
          <p className="text-texto-suave text-sm">
            Manda um novo e-mail de convite. Corrija os dados abaixo se algo
            estava errado — por exemplo, um e-mail digitado errado.
          </p>

          <CampoTexto
            rotulo="Nome"
            value={formReenvio.nome}
            onChange={(e) =>
              setFormReenvio({ ...formReenvio, nome: e.target.value })
            }
            required
          />

          <CampoMascarado
            rotulo="E-mail"
            tipo="email"
            value={formReenvio.email}
            onChange={(email) => setFormReenvio({ ...formReenvio, email })}
            ajuda="Precisa ser o mesmo e-mail que ele vai usar para entrar."
          />

          <CampoMascarado
            rotulo="Telefone (opcional)"
            tipo="telefone"
            value={formReenvio.telefone}
            onChange={(telefone) =>
              setFormReenvio({ ...formReenvio, telefone })
            }
          />

          <CampoSelecao
            rotulo="Cargo"
            value={formReenvio.papel}
            onChange={(e) =>
              setFormReenvio({
                ...formReenvio,
                papel: e.target.value as PapelUsuario,
              })
            }
          >
            {CARGOS_ATIVOS.map((papel) => (
              <option key={papel} value={papel}>
                {rotuloCargo(papel)}
              </option>
            ))}
          </CampoSelecao>

          {erroReenvio && (
            <p
              role="alert"
              className="bg-erro-50 text-erro-700 rounded-xl px-4 py-3"
            >
              {erroReenvio}
            </p>
          )}

          <div className="flex gap-3">
            <Botao
              type="button"
              variante="contorno"
              onClick={() => setReenviando(null)}
              className="flex-1"
            >
              Cancelar
            </Botao>
            <Botao
              type="submit"
              carregando={reenviar.isPending}
              className="flex-1"
            >
              <Mail aria-hidden="true" className="size-4" />
              Reenviar convite
            </Botao>
          </div>
        </form>
      </Modal>
    </PaginaLista>
  )
}
