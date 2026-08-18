import { useEffect, useState, type FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { Pencil, KeyRound, Power, PowerOff, Mail, Clock } from 'lucide-react'
import {
  useColaborador,
  useAcessos,
  useEditarColaborador,
  useTrocarCargo,
  useAtivarColaborador,
  useAjustarPermissoes,
  useEnviarRedefinicaoDeSenha,
} from '@/dados/colaboradores'
import {
  CARGOS_ATIVOS,
  rotuloCargo,
  permissoesEfetivas,
  permissoesIniciais,
  PERMISSOES_EXPLICADAS,
} from '@/dominio/cargos'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { podeGerenciarColaboradores } from '@/autenticacao/contexto'
import { PaginaDetalhe, FichaDados } from '@/componentes/PaginaDetalhe'
import { EstadoConsulta } from '@/componentes/EstadoConsulta'
import { Secao } from '@/componentes/ui/Secao'
import { Botao } from '@/componentes/ui/Botao'
import { CampoTexto } from '@/componentes/ui/CampoTexto'
import { CampoSelecao } from '@/componentes/ui/CampoSelecao'
import { CampoMascarado } from '@/componentes/ui/CampoMascarado'
import { CampoFoto } from '@/componentes/ui/CampoFoto'
import {
  enviarFotoColaborador,
  obterLinkTemporario,
  BALDE_FOTOS_COLABORADOR,
} from '@/lib/armazenamento'
import { formatarCpfCnpj, formatarTelefone } from '@/dominio/documentos'
import type { PapelUsuario } from '@/tipos/banco'

export default function ColaboradorDetalhe() {
  const { id = null } = useParams()
  const { perfil: eu } = useAutenticacao()
  const consulta = useColaborador(id)
  const pessoa = consulta.data ?? null

  const administra = podeGerenciarColaboradores(eu)
  const souEu = pessoa !== null && pessoa.id === eu?.id
  // O próprio colaborador corrige nome e telefone; cargo, permissões, senha
  // e acesso são de quem administra. Duas perguntas diferentes, e juntá-las
  // numa só faria o cadastro ficar trancado para o dono dele.
  const podeEditarDados = administra || souEu

  const editar = useEditarColaborador()
  const trocarCargo = useTrocarCargo()
  const ativar = useAtivarColaborador()
  const ajustar = useAjustarPermissoes()
  const redefinir = useEnviarRedefinicaoDeSenha()

  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState({ nome: '', telefone: '', cpf: '' })
  const [foto, setFoto] = useState<string | null>(null)
  const [previaFoto, setPreviaFoto] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)
  const [avisoSenha, setAvisoSenha] = useState<string | null>(null)

  useEffect(() => {
    if (foto === null) {
      setPreviaFoto(null)
      return
    }

    void obterLinkTemporario(BALDE_FOTOS_COLABORADOR, foto).then(setPreviaFoto)
  }, [foto])

  function abrirEdicao() {
    if (pessoa === null) return

    setForm({
      nome: pessoa.nome,
      telefone: pessoa.telefone ?? '',
      cpf: pessoa.cpf ?? '',
    })
    setFoto(pessoa.foto_url)
    setErro(null)
    setEditando(true)
  }

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)

    if (pessoa === null) return

    if (form.nome.trim() === '') {
      setErro('O nome não pode ficar vazio.')
      return
    }

    try {
      await editar.mutateAsync({
        id: pessoa.id,
        dados: {
          nome: form.nome,
          telefone: form.telefone.trim() || null,
          cpf: form.cpf.trim() || null,
          foto_url: foto,
        },
      })
      setEditando(false)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.')
    }
  }

  async function pedirNovaSenha() {
    if (pessoa === null) return

    setAvisoSenha(null)

    try {
      await redefinir.mutateAsync(pessoa.email)
      setAvisoSenha(
        `Enviamos para ${pessoa.email} o link para criar uma senha nova. O link vale por uma hora.`,
      )
    } catch (e) {
      setAvisoSenha(
        e instanceof Error ? e.message : 'Não foi possível enviar o e-mail.',
      )
    }
  }

  if (consulta.isPending || consulta.error || pessoa === null) {
    return (
      <PaginaDetalhe
        voltarPara="/colaboradores"
        rotuloVoltar="Colaboradores"
        titulo="Colaborador"
      >
        <EstadoConsulta
          carregando={consulta.isPending}
          erro={consulta.error}
          vazio={pessoa === null}
          mensagemVazio="Colaborador não encontrado."
        />
      </PaginaDetalhe>
    )
  }

  const efetivas = permissoesEfetivas(pessoa)
  const ativas = PERMISSOES_EXPLICADAS.filter(({ chave }) => efetivas[chave])

  return (
    <PaginaDetalhe
      voltarPara="/colaboradores"
      rotuloVoltar="Colaboradores"
      titulo={pessoa.nome}
      subtitulo={pessoa.email}
      avatar={<Retrato caminho={pessoa.foto_url} nome={pessoa.nome} />}
      selo={
        !pessoa.ativo && (
          <span className="bg-superficie-2 text-texto-suave rounded-full px-3 py-1 text-sm">
            sem acesso
          </span>
        )
      }
      acoes={
        !editando && (
          // Uma linha só, com botões menores: em tela estreita os três
          // quebravam, e o terceiro ficava numa fileira sozinha parecendo
          // outra coisa. Aqui eles se apertam e continuam sendo um conjunto.
          <div className="flex w-full flex-nowrap gap-2 [&_button]:min-h-11 [&_button]:px-3 [&_button]:text-sm">
            {podeEditarDados && (
              <Botao variante="secundaria" onClick={abrirEdicao}>
                <Pencil aria-hidden="true" className="size-4 shrink-0" />
                Editar
              </Botao>
            )}

            {administra && (
              <>
                <Botao
                  variante="contorno"
                  onClick={() => void pedirNovaSenha()}
                  carregando={redefinir.isPending}
                >
                  <Mail aria-hidden="true" className="size-4 shrink-0" />
                  Senha
                </Botao>

                {/* Ninguém tira o próprio acesso: sairia do sistema no
                    clique e, se fosse o único administrador, não haveria
                    quem o devolvesse. */}
                {!souEu && (
                  <Botao
                    variante="contorno"
                    onClick={() =>
                      void ativar.mutateAsync({
                        id: pessoa.id,
                        ativo: !pessoa.ativo,
                      })
                    }
                  >
                    {pessoa.ativo ? (
                      <PowerOff
                        aria-hidden="true"
                        className="size-4 shrink-0"
                      />
                    ) : (
                      <Power aria-hidden="true" className="size-4 shrink-0" />
                    )}
                    {pessoa.ativo ? 'Desligar' : 'Religar'}
                  </Botao>
                )}
              </>
            )}
          </div>
        )
      }
    >
      {avisoSenha && (
        <p className="bg-superficie-2 rounded-xl p-4 text-sm">{avisoSenha}</p>
      )}

      {editando ? (
        <form onSubmit={aoEnviar} className="flex flex-col gap-4" noValidate>
          <CampoTexto
            rotulo="Nome"
            value={form.nome}
            onChange={(e) => setForm({ ...form, nome: e.target.value })}
            required
          />

          <CampoFoto
            rotulo="Foto"
            cameraFrontal
            ajuda="Enquadre o rosto, como numa foto de crachá."
            aoEnviar={enviarFotoColaborador}
            caminho={foto}
            previa={previaFoto}
            aoRemover={() => setFoto(null)}
            aoConcluir={setFoto}
          />

          <CampoMascarado
            rotulo="Telefone"
            tipo="telefone"
            value={form.telefone}
            onChange={(telefone) => setForm({ ...form, telefone })}
          />

          <CampoMascarado
            rotulo="CPF"
            tipo="cpf_cnpj"
            value={form.cpf}
            onChange={(cpf) => setForm({ ...form, cpf })}
          />

          {/* O e-mail não é editável: ele é a identidade da conta no
              Supabase, e trocá-lo aqui deixaria o cadastro apontando para
              um login que não existe. */}
          <CampoTexto
            rotulo="E-mail"
            value={pessoa.email}
            ajuda="O e-mail é o login e não muda por aqui."
            disabled
          />

          {administra && (
            <CampoSelecao
              rotulo="Cargo"
              value={pessoa.papel}
              disabled={souEu || trocarCargo.isPending}
              ajuda={
                souEu
                  ? 'Ninguém muda o próprio cargo.'
                  : 'Trocar o cargo redefine as permissões pelo padrão dele.'
              }
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
              {pessoa.papel === 'estoque' && (
                <option value="estoque">{rotuloCargo('estoque')}</option>
              )}
            </CampoSelecao>
          )}

          {administra && (
            <fieldset className="border-borda rounded-xl border-2 p-4">
              <legend className="flex items-center gap-2 px-2 font-medium">
                <KeyRound aria-hidden="true" className="size-4" />
                Permissões
              </legend>

              <div className="flex flex-col gap-2">
                {PERMISSOES_EXPLICADAS.map(({ chave, rotulo, detalhe }) => {
                  const fogeDoPadrao =
                    efetivas[chave] !== permissoesIniciais(pessoa.papel)[chave]

                  return (
                    <label key={chave} className="flex items-start gap-3">
                      {/* Grava no clique, sem esperar o Salvar: permissão é
                          decisão avulsa, e amarrá-la ao formulário faria
                          fechar a tela sem salvar desfazer o que se acabou
                          de conceder. */}
                      <input
                        type="checkbox"
                        className="mt-1 size-5 shrink-0"
                        checked={efetivas[chave]}
                        disabled={souEu || ajustar.isPending}
                        onChange={(e) =>
                          void ajustar.mutateAsync({
                            id: pessoa.id,
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
              </div>

              <p className="text-texto-suave mt-2 text-sm">
                {souEu
                  ? 'Ninguém muda as próprias permissões.'
                  : 'Procurar peça, reservar e confirmar o que usou não está aqui: todo colaborador ativo faz isso.'}
              </p>
            </fieldset>
          )}

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
              onClick={() => setEditando(false)}
              className="flex-1"
            >
              Cancelar
            </Botao>
            <Botao
              type="submit"
              carregando={editar.isPending}
              className="flex-1"
            >
              Salvar
            </Botao>
          </div>
        </form>
      ) : (
        <FichaDados
          titulo="Cadastro"
          linhas={[
            { rotulo: 'Nome', valor: pessoa.nome },
            { rotulo: 'E-mail', valor: pessoa.email },
            {
              rotulo: 'Telefone',
              valor: pessoa.telefone && formatarTelefone(pessoa.telefone),
            },
            {
              rotulo: 'CPF',
              valor: pessoa.cpf && formatarCpfCnpj(pessoa.cpf),
            },
            { rotulo: 'Cargo', valor: rotuloCargo(pessoa.papel) },
            {
              rotulo: 'Acesso',
              valor: pessoa.ativo ? 'ativo' : 'desligado',
            },
            {
              rotulo: 'Cadastrado em',
              valor: new Date(pessoa.criado_em).toLocaleDateString('pt-BR'),
            },
          ]}
        />
      )}

      {/* Fora da edição, isto é informação: uma lista curta do que a
          pessoa pode. Caixas marcáveis à mostra o tempo todo convidam ao
          clique acidental numa tela que se abre para consultar — e mudar
          permissão de colega não é coisa que se faça sem querer. */}
      {administra && !editando && (
        <section>
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <KeyRound aria-hidden="true" className="size-4" />
            Permissões
          </h2>

          {ativas.length === 0 ? (
            <p className="bg-superficie text-texto-suave rounded-xl p-4 text-sm">
              Só o uso normal: procurar peça, reservar e confirmar o que usou.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {ativas.map(({ chave, rotulo, detalhe }) => (
                <li key={chave} className="bg-superficie rounded-xl p-4">
                  <p className="font-medium">
                    {rotulo}
                    {efetivas[chave] !==
                      permissoesIniciais(pessoa.papel)[chave] && (
                      <span className="text-atencao-700 ml-2 text-xs">
                        diferente do cargo
                      </span>
                    )}
                  </p>
                  <p className="text-texto-suave text-sm">{detalhe}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {(administra || souEu) && <UltimosAcessos usuarioId={pessoa.id} />}
    </PaginaDetalhe>
  )
}

/**
 * Histórico de entradas, recolhido.
 *
 * Recolhido porque responde a uma pergunta ocasional — "esta pessoa ainda
 * usa o sistema?" —, não ao trabalho do dia. Aberto por padrão, empurraria
 * o cadastro para fora da tela em troca de uma informação que quase nunca
 * está sendo procurada.
 */
function UltimosAcessos({ usuarioId }: { usuarioId: string }) {
  const { data: acessos, isPending } = useAcessos(usuarioId)

  return (
    <Secao titulo="Últimos acessos" icone={Clock}>
      {isPending ? (
        <p className="text-texto-suave text-sm">Carregando…</p>
      ) : acessos && acessos.length > 0 ? (
        <ol className="flex flex-col gap-1 text-sm">
          {acessos.map((acesso) => (
            <li
              key={acesso.id}
              className="border-borda flex justify-between border-b py-1.5 last:border-0"
            >
              <span>
                {new Date(acesso.criado_em).toLocaleDateString('pt-BR', {
                  weekday: 'short',
                  day: '2-digit',
                  month: '2-digit',
                })}
              </span>
              <span className="text-texto-suave tabular-nums">
                {new Date(acesso.criado_em).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="text-texto-suave text-sm">
          Nenhuma entrada registrada ainda. O histórico começa a partir da
          próxima vez que esta pessoa entrar.
        </p>
      )}
    </Secao>
  )
}

/**
 * O rosto, ou as iniciais enquanto ele não existe.
 *
 * Iniciais em vez de um ícone genérico de pessoa: num cadastro sem foto, o
 * ícone igual para todos não distingue ninguém, enquanto duas letras já
 * separam a Ana do Bruno numa lista.
 */
function Retrato({ caminho, nome }: { caminho: string | null; nome: string }) {
  const [link, setLink] = useState<string | null>(null)

  useEffect(() => {
    if (caminho === null) {
      setLink(null)
      return
    }

    void obterLinkTemporario(BALDE_FOTOS_COLABORADOR, caminho).then(setLink)
  }, [caminho])

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
        className="bg-superficie-2 size-16 rounded-full object-cover"
      />
    )
  }

  return (
    <div
      aria-hidden="true"
      className="bg-superficie-2 text-texto-suave flex size-16 items-center justify-center rounded-full text-xl font-bold"
    >
      {iniciais}
    </div>
  )
}
