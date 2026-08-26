import { useState, type FormEvent } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Search, ZoomIn, ExternalLink, Pencil, RefreshCw } from 'lucide-react'
import {
  useModelosPerfil,
  useEditarModeloPerfil,
  useMarcarRevisaoPerfil,
  useSincronizarCatalogoCentral,
  useRevisaoCentralAtual,
  type DadosModeloPerfil,
} from '@/dados/modelosPerfil'
import { useColaborador } from '@/dados/colaboradores'
import { useDesenhosTecnicos } from '@/dados/desenhosTecnicos'
import { useSobras } from '@/dados/sobras'
import { EstadoConsulta } from '@/componentes/EstadoConsulta'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { podeGerenciarCadastros } from '@/autenticacao/contexto'
import { Botao } from '@/componentes/ui/Botao'
import { Modal } from '@/componentes/ui/Modal'
import {
  FormularioModeloPerfil,
  ID_FORMULARIO_MODELO_PERFIL,
} from '@/componentes/perfil/FormularioModeloPerfil'
import type { ModeloPerfil } from '@/tipos/banco'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { VisualizadorImagem } from '@/componentes/ui/VisualizadorImagem'
import { formatarComprimento } from '@/dominio/medidas'
import {
  areaSecaoMm2,
  formatarAreaSecao,
  formatarMedidasSecao,
} from '@/dominio/secao'
import { cn } from '@/lib/utilitarios'

/**
 * Ficha do perfil: o que ele é, como é a seção, e quanto existe no depósito.
 *
 * Responde a pergunta que o serralheiro faz com a peça na mão: "é este mesmo
 * perfil?". Por isso o desenho vem primeiro e grande, e o estoque logo
 * abaixo, agrupado por acabamento e comprimento — que é como ele procura.
 */
export default function PerfilDetalhe() {
  const { id } = useParams<{ id: string }>()

  /*
   * De onde a pessoa veio, para o "voltar" devolvê-la ao mesmo lugar.
   *
   * A ficha do perfil é aberta de vários pontos — do catálogo, da lista
   * técnica de um produto, de uma sobra. Um "voltar" fixo para /perfis
   * mandaria quem estava montando uma receita para o catálogo, e a receita
   * ficaria para trás no meio do trabalho.
   *
   * Vai na URL, e não no state da navegação, porque assim sobrevive a
   * recarregar a página e a compartilhar o endereço.
   */
  const [parametros] = useSearchParams()
  const voltarPara = parametros.get('de') ?? '/perfis'
  const rotuloVoltar = parametros.get('rotulo') ?? 'Perfis'
  const { data: modelos, isPending, error } = useModelosPerfil(true)
  const { data: desenhos } = useDesenhosTecnicos(id ?? null, 'imagem')
  const { data: fotos } = useDesenhosTecnicos(id ?? null, 'foto')
  const { data: sobras } = useSobras()
  const [ampliado, setAmpliado] = useState<string | null>(null)

  const { perfil: usuario } = useAutenticacao()
  const podeEditar = podeGerenciarCadastros(usuario)
  const editar = useEditarModeloPerfil()

  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState<DadosModeloPerfil | null>(null)
  const [erroEdicao, setErroEdicao] = useState<string | null>(null)

  // ── Revisão e sincronização com o catálogo central ─────────────────────
  const modeloAtual = modelos?.find((m) => m.id === id)
  const origemPerfilId = modeloAtual?.origem_perfil_id ?? null
  const { data: revisaoCentralAtual } = useRevisaoCentralAtual(origemPerfilId)
  const { data: revisor } = useColaborador(modeloAtual?.revisado_por ?? null)
  const marcarRevisao = useMarcarRevisaoPerfil()
  const sincronizar = useSincronizarCatalogoCentral()
  const [mensagemCentral, setMensagemCentral] = useState<string | null>(null)
  const [erroCentral, setErroCentral] = useState<string | null>(null)
  const [detalheRevisaoAberto, setDetalheRevisaoAberto] = useState(false)

  async function aoMarcarRevisao() {
    if (!id) return
    setErroCentral(null)
    setMensagemCentral(null)

    try {
      await marcarRevisao.mutateAsync(id)
      setMensagemCentral(
        modeloAtual?.revisado
          ? 'Nova revisão marcada — quem já copiou este perfil vai ver o aviso de atualização.'
          : 'Perfil marcado como revisado.',
      )
    } catch (e) {
      setErroCentral(e instanceof Error ? e.message : 'Não foi possível marcar a revisão.')
    }
  }

  async function aoAtualizarDoCentral() {
    setErroCentral(null)
    setMensagemCentral(null)

    try {
      await sincronizar.mutateAsync()
      setMensagemCentral('Perfil atualizado com os dados do catálogo central.')
    } catch (e) {
      setErroCentral(e instanceof Error ? e.message : 'Não foi possível atualizar.')
    }
  }

  const modelo = modelos?.find((m) => m.id === id)

  if (isPending || error || !modelo) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-6">
        <EstadoConsulta
          carregando={isPending}
          erro={error}
          vazio={!isPending && !modelo}
          mensagemVazio="Perfil não encontrado."
        />
      </div>
    )
  }

  // Só o que está fisicamente no depósito.
  const lotes = (sobras ?? []).filter(
    (s) =>
      s.modelo_perfil_id === modelo.id &&
      (s.status === 'disponivel' || s.status === 'reservada'),
  )

  const pecasLivres = lotes.reduce(
    (t, l) => t + (l.quantidade - l.quantidade_reservada),
    0,
  )
  const milimetrosLivres = lotes.reduce(
    (t, l) => t + (l.quantidade - l.quantidade_reservada) * l.comprimento_mm,
    0,
  )

  // Agrupa por acabamento e comprimento — é como se procura uma peça.
  const porAcabamento = new Map<
    string,
    { comprimentoMm: number; livres: number; total: number }[]
  >()

  for (const lote of lotes) {
    const nome = lote.acabamento?.nome ?? 'sem acabamento'
    const lista = porAcabamento.get(nome) ?? []

    lista.push({
      comprimentoMm: lote.comprimento_mm,
      livres: lote.quantidade - lote.quantidade_reservada,
      total: lote.quantidade,
    })

    porAcabamento.set(nome, lista)
  }

  for (const lista of porAcabamento.values()) {
    lista.sort((a, b) => a.comprimentoMm - b.comprimentoMm)
  }

  // Recebe o modelo por parâmetro em vez de fechar sobre a variável: o
  // TypeScript não mantém, dentro de uma função, a garantia de que `modelo`
  // existe — garantia essa que vem do `return` mais acima.
  function abrirEdicao(perfilAtual: ModeloPerfil) {
    setForm({
      codigo: perfilAtual.codigo,
      descricao: perfilAtual.descricao,
      fabricante: perfilAtual.fabricante,
      linha: perfilAtual.linha,
      categoria: perfilAtual.categoria,
      aplicacao: perfilAtual.aplicacao,
      comprimento_barra_mm: perfilAtual.comprimento_barra_mm,
      peso_por_metro_g: perfilAtual.peso_por_metro_g,
      preco_por_metro_centavos: perfilAtual.preco_por_metro_centavos,
      codigo_barras: perfilAtual.codigo_barras,
      observacoes: perfilAtual.observacoes,
      // `?? null` porque estas colunas chegaram em migrações posteriores:
      // num banco ainda sem elas, o campo vem AUSENTE, e ausente não é o
      // mesmo que vazio para quem vai gravar.
      largura_secao_mm: perfilAtual.largura_secao_mm ?? null,
      altura_secao_mm: perfilAtual.altura_secao_mm ?? null,
      medida_3_secao_mm: perfilAtual.medida_3_secao_mm ?? null,
      medida_4_secao_mm: perfilAtual.medida_4_secao_mm ?? null,
    })
    setErroEdicao(null)
    setEditando(true)
  }

  const idDoPerfil = modelo.id

  // Só compara quando as duas pontas existem: perfil veio de uma cópia
  // (tem origem) e a leitura da revisão central já chegou.
  const desatualizado =
    modelo.origem_perfil_id != null &&
    modelo.origem_revisao_catalogo != null &&
    revisaoCentralAtual != null &&
    revisaoCentralAtual > modelo.origem_revisao_catalogo

  async function salvarEdicao(evento: FormEvent) {
    evento.preventDefault()
    setErroEdicao(null)

    if (form === null) return

    if (form.codigo.trim() === '' || form.descricao.trim() === '') {
      setErroEdicao('Código e descrição são obrigatórios.')
      return
    }

    try {
      await editar.mutateAsync({ id: idDoPerfil, dados: form })
      setEditando(false)
    } catch (e) {
      setErroEdicao(e instanceof Error ? e.message : 'Não foi possível salvar.')
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-6">
      {/* Congelado no topo ao rolar: é o que orienta a pessoa a qualquer
          altura da ficha — de onde voltar, se pode editar, e se o perfil já
          foi conferido. O fundo próprio (`bg-fundo`, igual ao da página) e a
          margem negativa cancelando o `px-5 py-6` do contêiner pai são o que
          fazem a faixa "colar" sem deixar vão nem cortar a borda lateral. */}
      <div className="bg-fundo sticky top-0 z-10 -mx-5 -mt-6 px-5 pt-6 pb-2">
        <div className="mb-4 flex items-center justify-between gap-3">
          <BotaoVoltar para={voltarPara} rotulo={rotuloVoltar} />

          {/* Editar aqui, e não só no catálogo: quem chegou pela lista técnica
              de um produto ou por uma sobra está justamente olhando o dado que
              quer corrigir, e voltar ao catálogo para achá-lo de novo é
              trabalho que a ficha pode poupar. */}
          {podeEditar && (
            <Botao variante="secundaria" onClick={() => abrirEdicao(modelo)}>
              <Pencil aria-hidden="true" className="size-4" />
              Editar
            </Botao>
          )}
        </div>

        {/* Revisão: uma AÇÃO só, com o rótulo mudando conforme a situação —
            antes eram dois lugares diferentes (o checkbox dentro de "Editar"
            e o botão "Marcar nova revisão", só no catálogo central). "Nova
            revisão" só aparece depois de uma primeira revisão já ter
            acontecido; até lá, a mesma ação marca a primeira. Quem revisou e
            quando fica escondido por padrão — é o dado que menos gente
            precisa, então não paga espaço à toa. */}
        <section
          className={cn(
            'rounded-lg px-3 py-1.5',
            modelo.revisado ? 'bg-economia-50' : 'bg-atencao-50',
          )}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDetalheRevisaoAberto((v) => !v)}
              disabled={!modelo.revisado}
              className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left disabled:cursor-default"
            >
              <span aria-hidden="true" className="shrink-0 text-2xl leading-none">
                {modelo.revisado ? '✅' : '⚠️'}
              </span>
              <span className="flex min-w-0 flex-col">
                <span
                  className={cn(
                    'truncate text-xs font-medium',
                    modelo.revisado ? 'text-economia-700' : 'text-atencao-700',
                  )}
                >
                  {modelo.revisado
                    ? `Revisado${modelo.revisao_catalogo != null ? ` · rev. ${modelo.revisao_catalogo}` : ''}`
                    : 'Ainda não revisado'}
                </span>
                <span
                  className={cn(
                    'truncate text-[0.7rem]',
                    modelo.revisado
                      ? 'text-economia-700/80'
                      : 'text-atencao-700/80',
                  )}
                >
                  {modelo.revisado
                    ? 'Medidas e desenho conferidos'
                    : 'Confirme medidas e desenho'}
                </span>
              </span>
            </button>

            {podeEditar && (
              <Botao
                variante="secundaria"
                tamanho="pequeno"
                onClick={() => void aoMarcarRevisao()}
                carregando={marcarRevisao.isPending}
                className="bg-economia-50 text-economia-700 hover:bg-economia-100 border-economia-500 shrink-0 border"
              >
                {modelo.revisado ? '✓ Nova revisão' : '✓ Marcar revisado'}
              </Botao>
            )}
          </div>

          {detalheRevisaoAberto && modelo.revisado && modelo.revisado_em && (
            <p className="text-economia-700/80 mt-0.5 pb-1 pl-[1.375rem] text-xs">
              {revisor && `${revisor.nome} · `}
              {new Date(modelo.revisado_em).toLocaleDateString('pt-BR')} às{' '}
              {new Date(modelo.revisado_em).toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
          )}
        </section>
      </div>

      {/* Aparece só em perfil COPIADO do catálogo central, quando a
          origem avançou de revisão desde a última cópia/atualização. */}
      {desatualizado && (
        <div className="border-destaque-borda bg-destaque text-destaque-texto mb-5 flex flex-col gap-2 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            Existe uma atualização deste perfil no catálogo central.
          </p>
          {podeEditar && (
            <Botao
              variante="secundaria"
              onClick={() => void aoAtualizarDoCentral()}
              carregando={sincronizar.isPending}
              className="shrink-0"
            >
              <RefreshCw aria-hidden="true" className="size-4" />
              Atualizar
            </Botao>
          )}
        </div>
      )}

      {mensagemCentral && (
        <p
          role="status"
          className="bg-superficie-2 mb-5 rounded-xl px-4 py-3 text-sm"
        >
          {mensagemCentral}
        </p>
      )}

      {erroCentral && (
        <p
          role="alert"
          className="bg-erro-50 text-erro-700 mb-5 rounded-xl px-4 py-3 text-sm"
        >
          {erroCentral}
        </p>
      )}

      <header className="mb-5">
        <p className="text-acao-600 font-mono text-lg font-bold">
          {modelo.codigo}
        </p>
        <h1 className="text-2xl font-bold">{modelo.descricao}</h1>
        {modelo.linha && (
          <p className="text-texto-suave mt-1">{modelo.linha}</p>
        )}
        {modelo.aplicacao && (
          <p className="text-acao-700 bg-acao-50 mt-2 inline-block rounded-lg px-2 py-1 text-sm">
            {modelo.aplicacao}
          </p>
        )}
      </header>

      {/* Desenhos primeiro: é o que identifica a peça. */}
      {desenhos && desenhos.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 font-semibold">Desenho técnico</h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {desenhos.map((d) =>
              d.link ? (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setAmpliado(d.link)}
                  className="border-borda relative shrink-0 overflow-hidden rounded-xl border-2 bg-white"
                  aria-label={`Ampliar ${d.legenda ?? 'desenho'}`}
                >
                  <img
                    src={d.link}
                    alt={d.legenda ?? `Desenho de ${modelo.codigo}`}
                    className="h-40 w-56 object-contain p-1"
                  />
                  <span className="bg-grafite-900/70 absolute right-1.5 bottom-1.5 rounded-full p-1.5 text-white">
                    <ZoomIn aria-hidden="true" className="size-4" />
                  </span>
                </button>
              ) : null,
            )}
          </div>
          <p className="text-texto-suave mt-1 text-xs">
            Toque para ampliar e ler as cotas.
          </p>
        </section>
      )}

      {/* Fotos da peça real, logo abaixo do desenho: juntos permitem a
          conferência que o desenho sozinho não dá — cor, brilho, estado. */}
      {fotos && fotos.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 font-semibold">Fotos do perfil</h2>
          <div className="flex gap-3 overflow-x-auto pb-1">
            {fotos.map((f) =>
              f.link ? (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setAmpliado(f.link)}
                  className="border-borda bg-superficie-2 relative shrink-0 overflow-hidden rounded-xl border-2"
                  aria-label={`Ampliar ${f.legenda ?? 'foto'}`}
                >
                  <img
                    src={f.link}
                    alt={f.legenda ?? `Foto do perfil ${modelo.codigo}`}
                    className="h-40 w-56 object-cover"
                  />
                  <span className="bg-grafite-900/70 absolute right-1.5 bottom-1.5 rounded-full p-1.5 text-white">
                    <ZoomIn aria-hidden="true" className="size-4" />
                  </span>
                  {f.legenda && (
                    <span className="bg-grafite-900/70 absolute inset-x-0 bottom-0 truncate px-2 py-1 text-left text-xs text-white">
                      {f.legenda}
                    </span>
                  )}
                </button>
              ) : null,
            )}
          </div>
        </section>
      )}

      {/* Estoque */}
      <section className="mb-6">
        <h2 className="mb-2 font-semibold">Disponível no depósito</h2>

        {lotes.length === 0 ? (
          <p className="bg-superficie-2 text-texto-suave rounded-xl p-5 text-center text-sm">
            Nenhuma peça deste perfil em estoque.
          </p>
        ) : (
          <>
            <div className="bg-aluminio-100 text-grafite-800 mb-3 flex items-baseline gap-4 rounded-xl p-4">
              <p className="text-3xl font-bold tabular-nums">{pecasLivres}</p>
              <div className="text-sm">
                <p>{pecasLivres === 1 ? 'peça livre' : 'peças livres'}</p>
                <p>{formatarComprimento(milimetrosLivres)} no total</p>
              </div>
            </div>

            <div className="flex flex-col gap-3">
              {[...porAcabamento.entries()].map(([acabamento, linhas]) => (
                <div key={acabamento} className="bg-superficie rounded-xl p-3">
                  <p className="mb-1.5 font-medium">{acabamento}</p>
                  <ul className="flex flex-col gap-1">
                    {linhas.map((l, i) => (
                      <li
                        key={`${l.comprimentoMm}-${i}`}
                        className="flex items-baseline justify-between gap-3 text-sm"
                      >
                        <span className="tabular-nums">
                          {formatarComprimento(l.comprimentoMm)}
                        </span>
                        <span className="text-texto-suave">
                          {l.livres} de {l.total}{' '}
                          {l.total === 1 ? 'livre' : 'livres'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <Link
              to="/procurar"
              className="border-borda bg-superficie hover:bg-superficie-2 mt-3 flex min-h-14 items-center justify-center gap-2 rounded-xl border-2 font-semibold"
            >
              <Search aria-hidden="true" className="size-5" />
              Procurar peça para um corte
            </Link>
          </>
        )}
      </section>

      {/* Ficha técnica */}
      <section>
        <h2 className="mb-2 font-semibold">Ficha técnica</h2>
        <dl className="bg-superficie grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl p-4 text-sm">
          <dt className="text-texto-suave">Código</dt>
          <dd className="text-right font-mono">{modelo.codigo}</dd>

          <dt className="text-texto-suave">Linha</dt>
          <dd className="text-right">{modelo.linha ?? '—'}</dd>

          <dt className="text-texto-suave">Aplicação</dt>
          <dd className="text-right">{modelo.aplicacao ?? '—'}</dd>

          <dt className="text-texto-suave">Fabricante</dt>
          <dd className="text-right">{modelo.fabricante ?? '—'}</dd>

          {/* As quatro medidas numa linha só. As duas primeiras são
              derivadas do peso e do desenho, não digitadas — aproximadas de
              propósito, porque servem para achar o perfil com uma trena. */}
          {formatarMedidasSecao(modelo) && (
            <>
              <dt className="text-texto-suave">Medidas (aprox.)</dt>
              <dd className="text-right tabular-nums">
                {formatarMedidasSecao(modelo)}
              </dd>
            </>
          )}

          <dt className="text-texto-suave">Barra padrão</dt>
          <dd className="text-right tabular-nums">
            {formatarComprimento(modelo.comprimento_barra_mm)}
          </dd>

          <dt className="text-texto-suave">Peso por metro</dt>
          <dd className="text-right tabular-nums">
            {modelo.peso_por_metro_g
              ? `${(modelo.peso_por_metro_g / 1000).toFixed(3).replace('.', ',')} kg/m`
              : '—'}
          </dd>

          {modelo.peso_por_metro_g && (
            <>
              <dt className="text-texto-suave">Peso da barra</dt>
              <dd className="text-right tabular-nums">
                {(
                  (modelo.peso_por_metro_g * modelo.comprimento_barra_mm) /
                  1_000_000
                )
                  .toFixed(2)
                  .replace('.', ',')}{' '}
                kg
              </dd>

              {/* Não é um dado digitado: sai do peso, porque peso por metro
                  é área da seção × densidade do alumínio. Serve para
                  comparar perfis parecidos e para identificar uma ponta sem
                  etiqueta na balança. */}
              <dt className="text-texto-suave">Área da seção</dt>
              <dd className="text-right tabular-nums">
                {formatarAreaSecao(areaSecaoMm2(modelo.peso_por_metro_g)!)}
              </dd>
            </>
          )}
        </dl>

        {modelo.observacoes && (
          <div className="bg-superficie-2 text-texto-suave mt-3 rounded-xl p-4 text-sm">
            {modelo.observacoes.split('\n').map((linha, i) => {
              const url = linha.match(/https?:\/\/\S+/)?.[0]

              return (
                <p key={i} className="mb-1 last:mb-0">
                  {url ? (
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-acao-600 inline-flex items-center gap-1 hover:underline"
                    >
                      Ficha do fabricante
                      <ExternalLink aria-hidden="true" className="size-3.5" />
                    </a>
                  ) : (
                    linha
                  )}
                </p>
              )
            })}
          </div>
        )}
      </section>

      {ampliado && (
        <VisualizadorImagem
          src={ampliado}
          alt={`Imagem do perfil ${modelo.codigo}, ampliada`}
          aoFechar={() => setAmpliado(null)}
        />
      )}

      <Modal
        aberto={editando && form !== null}
        aoFechar={() => setEditando(false)}
        titulo="Editar perfil"
        acoes={
          <Botao
            type="submit"
            form={ID_FORMULARIO_MODELO_PERFIL}
            variante="secundaria"
            tamanho="pequeno"
            carregando={editar.isPending}
          >
            Salvar
          </Botao>
        }
      >
        {form && (
          <FormularioModeloPerfil
            form={form}
            aoMudar={setForm}
            modelo={modelo}
            aoSalvar={salvarEdicao}
            aoCancelar={() => setEditando(false)}
            salvando={editar.isPending}
            erro={erroEdicao}
          />
        )}
      </Modal>
    </div>
  )
}
