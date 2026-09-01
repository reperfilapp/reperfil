import { useState } from 'react'
import { Building2, TriangleAlert, ShieldOff, Trash2 } from 'lucide-react'
import {
  useOrganizacao,
  useEmpresasParaCentral,
  useExcluirEmpresa,
  type EmpresaNaCentral,
} from '@/dados/organizacao'
import { tempoRelativo } from '@/dominio/tempoRelativo'
import { Botao } from '@/componentes/ui/Botao'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { Modal } from '@/componentes/ui/Modal'
import { PaginaLista } from '@/componentes/ui/PaginaLista'
import { cn } from '@/lib/utilitarios'

/**
 * As empresas que usam o RePerfil, vistas pela organização central — e o
 * encerramento de uma delas.
 *
 * ── POR QUE O ENCERRAMENTO MORA AQUI, E NÃO NA PRÓPRIA EMPRESA ───────────
 *
 * A empresa PEDE (na sua tela de dados); a central EXECUTA. Deixar o
 * próprio administrador apagar direto seria menos código, mas apagar uma
 * empresa é irreversível e não tem backup dentro do aplicativo: um
 * administrador irritado, ou alguém que conseguiu a senha dele, encerraria
 * anos de cadastro num toque, sem ninguém a quem recorrer.
 *
 * O caminho mais longo é a única rede de segurança que existe.
 */
export default function AdministrarEmpresas() {
  const { data: organizacao } = useOrganizacao()
  const souCentral = Boolean(organizacao?.eh_catalogo_central)

  const { data: empresas, isPending, error } = useEmpresasParaCentral()
  const excluir = useExcluirEmpresa()

  const [encerrando, setEncerrando] = useState<EmpresaNaCentral | null>(null)
  const [confirmacao, setConfirmacao] = useState('')
  const [erroEncerrar, setErroEncerrar] = useState<string | null>(null)
  const [encerrada, setEncerrada] = useState<string | null>(null)

  if (!souCentral || error) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-6">
        <BotaoVoltar para="/mais" rotulo="Mais" className="mb-4" />
        <div
          role="alert"
          className="flex flex-col items-center gap-3 rounded-xl p-8 text-center"
        >
          <ShieldOff aria-hidden="true" className="text-texto-suave size-10" />
          <p className="text-texto-suave">
            Só quem administra o catálogo central acessa esta tela.
          </p>
        </div>
      </div>
    )
  }

  async function confirmarEncerramento() {
    if (!encerrando) return

    setErroEncerrar(null)

    try {
      await excluir.mutateAsync({
        organizacaoId: encerrando.organizacao_id,
        confirmacao,
      })
      setEncerrada(encerrando.nome_fantasia)
      setEncerrando(null)
      setConfirmacao('')
    } catch (e) {
      setErroEncerrar(
        e instanceof Error ? e.message : 'Não foi possível encerrar.',
      )
    }
  }

  const agora = new Date()
  const pedidos = (empresas ?? []).filter((e) => e.exclusao_solicitada_em)

  return (
    <PaginaLista
      className="max-w-3xl"
      cabecalho={
        <>
          <BotaoVoltar para="/mais" rotulo="Mais" className="mb-4" />

          <header className="mb-5">
            <h1 className="text-2xl font-bold">Empresas</h1>
            <p className="text-texto-suave mt-1">
              Quem usa o RePerfil, e os pedidos de encerramento.
            </p>
          </header>

          {pedidos.length > 0 && (
            <p className="bg-atencao-50 text-atencao-700 mb-4 flex items-start gap-2 rounded-xl px-4 py-3 text-sm">
              <TriangleAlert
                aria-hidden="true"
                className="mt-0.5 size-4 shrink-0"
              />
              <span>
                {pedidos.length}{' '}
                {pedidos.length === 1
                  ? 'empresa pediu encerramento'
                  : 'empresas pediram encerramento'}
                . Confira antes de apagar — não há volta.
              </span>
            </p>
          )}

          {encerrada && (
            <p
              role="status"
              className="bg-superficie-2 mb-4 rounded-xl px-4 py-3 text-sm"
            >
              <strong>{encerrada}</strong> foi encerrada. Todos os registros,
              arquivos e acessos dela foram apagados.
            </p>
          )}

          {isPending && <p className="text-texto-suave">Carregando…</p>}
        </>
      }
    >
      {!isPending && empresas?.length === 0 && (
        <p className="bg-superficie-2 text-texto-suave rounded-xl p-6 text-center">
          Nenhuma outra empresa usa o RePerfil ainda.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {empresas?.map((empresa) => (
          <li
            key={empresa.organizacao_id}
            className={cn(
              'flex items-center gap-3 rounded-xl border-2 p-4 shadow-sm',
              empresa.exclusao_solicitada_em
                ? 'border-aviso-borda bg-aviso'
                : 'bg-celula border-borda',
            )}
          >
            <Building2
              aria-hidden="true"
              className="text-acao-600 size-5 shrink-0"
            />

            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{empresa.nome_fantasia}</p>
              <p className="text-texto-suave truncate text-xs">
                {empresa.colaboradores}{' '}
                {empresa.colaboradores === 1 ? 'pessoa' : 'pessoas'} · desde{' '}
                {new Date(empresa.criado_em).toLocaleDateString('pt-BR')}
              </p>

              {empresa.exclusao_solicitada_em && (
                <p className="text-aviso-texto mt-1 text-xs">
                  Pediu encerramento{' '}
                  {tempoRelativo(empresa.exclusao_solicitada_em, agora)}
                  {empresa.exclusao_motivo && ` — "${empresa.exclusao_motivo}"`}
                </p>
              )}
            </div>

            <Botao
              tamanho="icone_pequeno"
              variante="contorno"
              onClick={() => {
                setEncerrando(empresa)
                setConfirmacao('')
                setErroEncerrar(null)
              }}
              aria-label={`Encerrar ${empresa.nome_fantasia}`}
              title="Encerrar empresa"
              className="border-erro-200 text-erro-600 hover:bg-erro-50 hover:border-erro-300 hover:text-erro-700"
            >
              <Trash2 aria-hidden="true" className="size-4" />
            </Botao>
          </li>
        ))}
      </ul>

      <Modal
        aberto={encerrando !== null}
        aoFechar={() => setEncerrando(null)}
        titulo="Encerrar empresa"
      >
        <div className="flex flex-col gap-4">
          <p
            role="alert"
            className="bg-erro-50 text-erro-700 rounded-xl px-4 py-3 text-sm"
          >
            <strong>Isto não tem volta.</strong> Somem o catálogo, o estoque,
            os produtos, os clientes, o histórico, as fotos e os acessos de
            toda a equipe de <strong>{encerrando?.nome_fantasia}</strong>. Não
            existe backup dentro do aplicativo.
          </p>

          {!encerrando?.exclusao_solicitada_em && (
            <p className="bg-atencao-50 text-atencao-700 rounded-xl px-4 py-3 text-sm">
              Esta empresa <strong>não pediu</strong> para ser encerrada.
              Confirme com ela antes de continuar.
            </p>
          )}

          <div>
            <label
              htmlFor="confirmacao-empresa"
              className="mb-1 block font-medium"
            >
              Digite o nome da empresa para confirmar
            </label>
            <input
              id="confirmacao-empresa"
              type="text"
              value={confirmacao}
              onChange={(e) => setConfirmacao(e.target.value)}
              placeholder={encerrando?.nome_fantasia}
              autoComplete="off"
              className="border-borda bg-superficie min-h-12 w-full rounded-xl border-2 px-4"
            />
            {/* Digitar o nome, e não um "CONFIRMO" genérico: obriga a olhar
                QUAL empresa está prestes a sumir. Com várias na lista, um
                texto igual para todas não distingue a errada da certa. */}
            <p className="text-texto-suave mt-1 text-xs">
              Exatamente como está escrito: {encerrando?.nome_fantasia}
            </p>
          </div>

          {erroEncerrar && (
            <p
              role="alert"
              className="bg-erro-50 text-erro-700 rounded-xl px-4 py-3 text-sm font-medium"
            >
              {erroEncerrar}
            </p>
          )}

          <div className="flex gap-3">
            <Botao
              variante="contorno"
              onClick={() => setEncerrando(null)}
              className="flex-1"
            >
              Cancelar
            </Botao>
            <Botao
              variante="destrutiva"
              onClick={() => void confirmarEncerramento()}
              carregando={excluir.isPending}
              disabled={confirmacao.trim() !== encerrando?.nome_fantasia.trim()}
              className="flex-1"
            >
              <Trash2 aria-hidden="true" className="size-4" />
              Encerrar
            </Botao>
          </div>
        </div>
      </Modal>
    </PaginaLista>
  )
}
