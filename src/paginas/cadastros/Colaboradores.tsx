import { useState, type FormEvent } from 'react'
import { UserPlus, MailX, Power, PowerOff, KeyRound } from 'lucide-react'
import {
  useColaboradores,
  useConvitesAbertos,
  useConvidarColaborador,
  useCancelarConvite,
  useTrocarCargo,
  useAtivarColaborador,
  useAjustarPermissoes,
} from '@/dados/colaboradores'
import {
  CARGOS_ATIVOS,
  rotuloCargo,
  descreverPermissoes,
  permissoesEfetivas,
  permissoesAjustadas,
  permissoesIniciais,
  PERMISSOES_EXPLICADAS,
} from '@/dominio/cargos'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { Botao } from '@/componentes/ui/Botao'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { CampoTexto } from '@/componentes/ui/CampoTexto'
import { CampoSelecao } from '@/componentes/ui/CampoSelecao'
import { Modal } from '@/componentes/ui/Modal'
import { PaginaLista } from '@/componentes/ui/PaginaLista'
import type { PapelUsuario, PerfilUsuario } from '@/tipos/banco'

const VAZIO = {
  nome: '',
  email: '',
  telefone: '',
  papel: 'serralheiro' as PapelUsuario,
}

export default function Colaboradores() {
  const { perfil } = useAutenticacao()
  const { data: colaboradores, isPending } = useColaboradores()
  const { data: convites } = useConvitesAbertos()

  const convidar = useConvidarColaborador()
  const cancelar = useCancelarConvite()
  const trocarCargo = useTrocarCargo()
  const ativar = useAtivarColaborador()
  const ajustar = useAjustarPermissoes()

  const [aberto, setAberto] = useState(false)
  const [form, setForm] = useState(VAZIO)
  const [erro, setErro] = useState<string | null>(null)
  const [convidado, setConvidado] = useState<string | null>(null)
  const [permissoesDe, setPermissoesDe] = useState<PerfilUsuario | null>(null)

  // Relê a pessoa da lista recarregada: o modal fica aberto enquanto se
  // marca uma caixa atrás da outra, e sem isto ele mostraria o estado
  // congelado do momento em que abriu.
  const emEdicao =
    permissoesDe === null
      ? null
      : (colaboradores?.find((p) => p.id === permissoesDe.id) ?? permissoesDe)

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
              className="bg-superficie flex flex-wrap items-center gap-3 rounded-xl p-4 shadow-sm"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {pessoa.nome}
                </span>
                <span className="text-texto-suave block truncate text-sm">
                  {pessoa.email}
                </span>
                <span className="text-texto-suave block truncate text-xs">
                  {/* Os selos vêm ANTES do texto longo: no nome, o
                      truncamento comia justamente o "você" e o "sem
                      acesso", que é o que precisa ser visto de relance. */}
                  {souEu && <span className="mr-2">você</span>}
                  {!pessoa.ativo && (
                    <span className="bg-superficie-2 mr-2 rounded px-2 py-0.5">
                      sem acesso
                    </span>
                  )}
                  {descreverPermissoes(permissoesEfetivas(pessoa))}
                  {permissoesAjustadas(pessoa).length > 0 && (
                    <span className="text-atencao-700 ml-2">· ajustado</span>
                  )}
                </span>
              </span>

              {/* O próprio cargo não é editável aqui. O banco recusaria de
                  qualquer forma (gatilho contra autopromoção), e um campo
                  que devolve erro ensina a pessoa a desconfiar da tela. */}
              <CampoSelecao
                rotulo="Cargo"
                rotuloOculto
                className="w-36 shrink-0"
                value={pessoa.papel}
                disabled={souEu}
                onChange={(e) =>
                  void trocarCargo.mutateAsync({
                    id: pessoa.id,
                    papel: e.target.value as PapelUsuario,
                  })
                }
              >
                {CARGOS_ATIVOS.map((papel) => (
                  <option key={papel} value={papel}>
                    {rotuloCargo(papel)}
                  </option>
                ))}
                {/* O cargo legado só aparece para quem ainda o tem. */}
                {pessoa.papel === 'estoque' && (
                  <option value="estoque">{rotuloCargo('estoque')}</option>
                )}
              </CampoSelecao>

              <Botao
                variante="secundaria"
                onClick={() => setPermissoesDe(pessoa)}
                aria-label={`Permissões de ${pessoa.nome}`}
                title="Permissões"
              >
                <KeyRound aria-hidden="true" className="size-4" />
              </Botao>

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

      <Modal
        aberto={emEdicao !== null}
        aoFechar={() => setPermissoesDe(null)}
        titulo={emEdicao ? `Permissões de ${emEdicao.nome}` : 'Permissões'}
      >
        {emEdicao && (
          <div className="flex flex-col gap-4">
            <p className="text-texto-suave text-sm">
              O cargo <strong>{rotuloCargo(emEdicao.papel)}</strong> define o
              ponto de partida. Aqui você libera ou tira uma tarefa desta
              pessoa, sem mudar o cargo dela.
            </p>

            {PERMISSOES_EXPLICADAS.map(({ chave, rotulo, detalhe }) => {
              const efetivas = permissoesEfetivas(emEdicao)
              const padrao = permissoesIniciais(emEdicao.papel)
              const fogeDoPadrao = efetivas[chave] !== padrao[chave]
              const souEu = emEdicao.id === perfil?.id

              return (
                <label
                  key={chave}
                  className="bg-superficie-2 flex items-start gap-3 rounded-xl p-4"
                >
                  <input
                    type="checkbox"
                    className="mt-1 size-5 shrink-0"
                    checked={efetivas[chave]}
                    /* Ninguém tira o próprio acesso: o banco recusaria pelo
                       gatilho contra autopromoção, e uma caixa que volta
                       sozinha ensina a desconfiar da tela. */
                    disabled={souEu || ajustar.isPending}
                    onChange={(e) =>
                      void ajustar.mutateAsync({
                        id: emEdicao.id,
                        permissoes: { [chave]: e.target.checked },
                      })
                    }
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">
                      {rotulo}
                      {fogeDoPadrao && (
                        <span className="text-atencao-700 ml-2 text-xs">
                          diferente do cargo
                        </span>
                      )}
                    </span>
                    <span className="text-texto-suave block text-sm">
                      {detalhe}
                    </span>
                  </span>
                </label>
              )
            })}

            <p className="text-texto-suave text-sm">
              Procurar peça, reservar e confirmar o que usou não está aqui: todo
              colaborador ativo faz isso.
            </p>

            <Botao
              variante="contorno"
              onClick={() => setPermissoesDe(null)}
              className="w-full"
            >
              Fechar
            </Botao>
          </div>
        )}
      </Modal>

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

          <CampoTexto
            rotulo="E-mail"
            type="email"
            inputMode="email"
            autoCapitalize="none"
            value={form.email}
            onChange={(e) => setForm({ ...form, email: e.target.value })}
            ajuda="Precisa ser o mesmo e-mail que ele vai usar para entrar."
            required
          />

          <CampoTexto
            rotulo="Telefone (opcional)"
            type="tel"
            inputMode="tel"
            value={form.telefone}
            onChange={(e) => setForm({ ...form, telefone: e.target.value })}
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
