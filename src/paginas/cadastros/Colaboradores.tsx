import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus, MailX, Power, PowerOff, ChevronRight } from 'lucide-react'
import {
  useColaboradores,
  useConvitesAbertos,
  useConvidarColaborador,
  useCancelarConvite,
  useAtivarColaborador,
} from '@/dados/colaboradores'
import {
  CARGOS_ATIVOS,
  rotuloCargo,
  permissoesAjustadas,
} from '@/dominio/cargos'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { Botao } from '@/componentes/ui/Botao'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { CampoTexto } from '@/componentes/ui/CampoTexto'
import { CampoMascarado } from '@/componentes/ui/CampoMascarado'
import { CampoSelecao } from '@/componentes/ui/CampoSelecao'
import { Modal } from '@/componentes/ui/Modal'
import { PaginaLista } from '@/componentes/ui/PaginaLista'
import type { PapelUsuario } from '@/tipos/banco'

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
  const { data: convites } = useConvitesAbertos()

  const convidar = useConvidarColaborador()
  const cancelar = useCancelarConvite()
  const ativar = useAtivarColaborador()

  const [aberto, setAberto] = useState(false)
  const [form, setForm] = useState(VAZIO)
  const [erro, setErro] = useState<string | null>(null)
  const [convidado, setConvidado] = useState<string | null>(null)

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
              <h1 className="text-2xl font-bold">Colaboradores</h1>
              <p className="text-texto-suave mt-1">
                Quem entra no sistema e o que cada um pode fazer.
              </p>
            </div>
            <Botao onClick={() => setAberto(true)}>
              <UserPlus aria-hidden="true" className="size-5" />
              Convidar
            </Botao>
          </header>

          {/* Aparece depois de convidar, e some ao sair da tela: o convite
              não manda e-mail nenhum, então alguém precisa avisar o colega
              — e é aqui que a pessoa está quando isso passa a ser verdade. */}
          {convidado && (
            <div className="bg-superficie-2 mb-4 rounded-xl p-4 text-sm">
              <p className="font-medium">
                Convite registrado para {convidado}.
              </p>
              <p className="text-texto-suave mt-1">
                Avise seu colega: ele entra no aplicativo, toca em{' '}
                <strong>Primeiro acesso</strong> e cria a senha com esse mesmo
                e-mail. Quem não tem convite não consegue se cadastrar.
              </p>
            </div>
          )}

          {isPending && <p className="text-texto-suave">Carregando…</p>}
        </>
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
                  onClick={() => void cancelar.mutateAsync(convite.id)}
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
                  três informações que se procura de relance. */}
              <Link
                to={`/colaboradores/${pessoa.id}`}
                className="flex min-w-0 flex-1 items-center gap-2"
                aria-label={`Abrir cadastro de ${pessoa.nome}`}
              >
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
                  void ativar.mutateAsync({
                    id: pessoa.id,
                    ativo: !pessoa.ativo,
                  })
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

      {/* No fim da lista, e não no cabeçalho: desligado é exceção, e quem
          procura por um já leu a lista inteira sem achar. */}
      <div className="mt-3 flex justify-center">
        <Botao variante="texto" onClick={() => setMostrarInativos((v) => !v)}>
          {mostrarInativos ? 'Ocultar inativos' : 'Exibir inativos'}
        </Botao>
      </div>

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
    </PaginaLista>
  )
}
