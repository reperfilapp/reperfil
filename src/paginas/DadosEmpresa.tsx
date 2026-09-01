import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  Building2,
  Camera,
  CheckCircle2,
  ImagePlus,
  Loader2,
  RefreshCw,
  TriangleAlert,
  X,
} from 'lucide-react'
import {
  useOrganizacao,
  useEditarOrganizacao,
  useLogoOrganizacao,
  useEnviarLogo,
  useSolicitarExclusao,
  useCancelarExclusao,
  useDefinirSincronizacaoAutomatica,
  type DadosOrganizacao,
} from '@/dados/organizacao'
import { useZerarEstoqueOrganizacao } from '@/dados/sobras'
import { Botao } from '@/componentes/ui/Botao'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { CampoTexto } from '@/componentes/ui/CampoTexto'
import { CampoMascarado } from '@/componentes/ui/CampoMascarado'
import {
  buscarEnderecoPorCep,
  cepCompleto,
  formatarCep,
} from '@/lib/cep'
import { disparar } from '@/lib/avisoErro'
import { LogoEmpresa } from '@/componentes/LogoEmpresa'
import { Modal } from '@/componentes/ui/Modal'

const UFs = [
  'AC',
  'AL',
  'AP',
  'AM',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MT',
  'MS',
  'MG',
  'PA',
  'PB',
  'PR',
  'PE',
  'PI',
  'RJ',
  'RN',
  'RS',
  'RO',
  'RR',
  'SC',
  'SP',
  'SE',
  'TO',
]

const VAZIO: DadosOrganizacao = {
  nome_fantasia: '',
  razao_social: '',
  cnpj: '',
  inscricao_estadual: '',
  telefone: '',
  whatsapp: '',
  email: '',
  site: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  cep: '',
}

export default function DadosEmpresa() {
  const { data: org, isPending } = useOrganizacao()
  const { data: logoUrl } = useLogoOrganizacao(org?.logo_caminho)
  const editar = useEditarOrganizacao()
  const enviarLogo = useEnviarLogo()

  const [form, setForm] = useState<DadosOrganizacao>(VAZIO)
  const [salvo, setSalvo] = useState(false)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [cepNaoEncontrado, setCepNaoEncontrado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  const zerarEstoque = useZerarEstoqueOrganizacao()
  const [zerando, setZerando] = useState(false)
  const [justificativaZerar, setJustificativaZerar] = useState('')
  const [textoConfirmacao, setTextoConfirmacao] = useState('')

  const solicitarExclusao = useSolicitarExclusao()
  const cancelarExclusao = useCancelarExclusao()
  const definirSincronizacaoAutomatica = useDefinirSincronizacaoAutomatica()
  const [encerrando, setEncerrando] = useState(false)
  const [motivoEncerrar, setMotivoEncerrar] = useState('')
  const [erroEncerrar, setErroEncerrar] = useState<string | null>(null)

  async function confirmarPedidoEncerramento() {
    setErroEncerrar(null)

    if (motivoEncerrar.trim().length < 10) {
      setErroEncerrar('Diga por que está encerrando — pelo menos 10 letras.')
      return
    }

    try {
      await solicitarExclusao.mutateAsync(motivoEncerrar.trim())
      setEncerrando(false)
    } catch (e) {
      setErroEncerrar(
        e instanceof Error ? e.message : 'Não foi possível enviar o pedido.',
      )
    }
  }
  const [erroZerar, setErroZerar] = useState<string | null>(null)
  const [resultadoZerar, setResultadoZerar] = useState<number | null>(null)

  const entradaCamera = useRef<HTMLInputElement>(null)
  const entradaGaleria = useRef<HTMLInputElement>(null)
  const [enviandoLogo, setEnviandoLogo] = useState(false)
  const [erroLogo, setErroLogo] = useState<string | null>(null)

  useEffect(() => {
    if (org && form.nome_fantasia === '') {
      setForm({
        nome_fantasia: org.nome_fantasia ?? '',
        razao_social: org.razao_social ?? '',
        cnpj: org.cnpj ?? '',
        inscricao_estadual: org.inscricao_estadual ?? '',
        telefone: org.telefone ?? '',
        whatsapp: org.whatsapp ?? '',
        email: org.email ?? '',
        site: org.site ?? '',
        logradouro: org.logradouro ?? '',
        numero: org.numero ?? '',
        complemento: org.complemento ?? '',
        bairro: org.bairro ?? '',
        cidade: org.cidade ?? '',
        estado: org.estado ?? '',
        cep: org.cep ?? '',
      })
    }
  }, [org, form.nome_fantasia])

  function alterar<C extends keyof DadosOrganizacao>(
    campo: C,
    valor: DadosOrganizacao[C],
  ) {
    setSalvo(false)
    setForm((atual) => ({ ...atual, [campo]: valor }))
  }

  /*
   * Preenche o endereço pelo CEP.
   *
   * Dispara sozinho ao completar os 8 dígitos, sem botão "buscar": quem
   * digitou o CEP inteiro já disse o que queria, e um botão a mais seria
   * um toque a mais para a mesma intenção.
   *
   * NÃO apaga o que já está preenchido quando a busca falha, e não mexe em
   * número nem complemento — que o CEP não conhece. Endereço já digitado
   * à mão sobrevive a alguém conferir o CEP depois.
   */
  async function preencherPeloCep(cepDigitado: string) {
    if (!cepCompleto(cepDigitado)) return

    setBuscandoCep(true)
    setCepNaoEncontrado(false)

    const endereco = await buscarEnderecoPorCep(cepDigitado)

    setBuscandoCep(false)

    if (endereco === null) {
      setCepNaoEncontrado(true)
      return
    }

    setSalvo(false)
    setForm((atual) => ({
      ...atual,
      // `||` e não `??`: o ViaCEP devolve string vazia para o que não sabe
      // (em cidade de CEP único, por exemplo, não há logradouro), e vazio
      // não pode apagar o que a pessoa já tinha escrito.
      logradouro: endereco.logradouro || atual.logradouro,
      bairro: endereco.bairro || atual.bairro,
      cidade: endereco.cidade || atual.cidade,
      estado: endereco.estado || atual.estado,
    }))
  }

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    if (!org) return

    setErro(null)
    setSalvo(false)

    try {
      await editar.mutateAsync({ id: org.id, dados: form })
      setSalvo(true)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.')
    }
  }

  async function aoEscolherLogo(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0]
    evento.target.value = ''

    if (!arquivo || !org) return

    setErroLogo(null)
    setEnviandoLogo(true)

    try {
      await enviarLogo.mutateAsync({
        id: org.id,
        arquivo,
        caminhoAnterior: org.logo_caminho,
      })
    } catch (e) {
      setErroLogo(
        e instanceof Error ? e.message : 'Não foi possível enviar o logo.',
      )
    } finally {
      setEnviandoLogo(false)
    }
  }

  if (isPending) {
    return <p className="text-texto-suave p-6">Carregando dados da empresa…</p>
  }

  if (!org) {
    return (
      <p className="text-erro-600 p-6">
        Não foi possível carregar os dados da empresa.
      </p>
    )
  }

  function abrirZerarEstoque() {
    setJustificativaZerar('')
    setTextoConfirmacao('')
    setErroZerar(null)
    setResultadoZerar(null)
    setZerando(true)
  }

  async function confirmarZerarEstoque() {
    setErroZerar(null)

    if (justificativaZerar.trim().length < 5) {
      setErroZerar('Descreva o motivo (pelo menos 5 letras).')
      return
    }

    if (textoConfirmacao !== 'CONFIRMO') {
      setErroZerar('Digite exatamente a palavra CONFIRMO para prosseguir.')
      return
    }

    try {
      const afetados = await zerarEstoque.mutateAsync(justificativaZerar)
      setResultadoZerar(afetados)
    } catch (e) {
      setErroZerar(
        e instanceof Error ? e.message : 'Não foi possível zerar o estoque.',
      )
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8">
      <BotaoVoltar para="/mais" rotulo="Mais" className="mb-4" />

      <header className="mb-6 flex items-center gap-3">
        <Building2
          aria-hidden="true"
          className="text-acao-600 size-6 shrink-0"
        />
        <h1 className="text-2xl font-bold">Dados da empresa</h1>
      </header>

      <form onSubmit={(e) => void aoEnviar(e)} className="flex flex-col gap-8">
        {/* ── Logo ──────────────────────────────────────────────────────── */}
        <section className="bg-superficie rounded-xl p-5 shadow-sm">
          <h2 className="mb-4 font-semibold">Logo</h2>

          <div className="flex items-center gap-4">
            <LogoEmpresa
              logoUrl={logoUrl}
              nomeFantasia={org.nome_fantasia}
              tamanho="grande"
            />

            <div className="flex flex-1 flex-col gap-2">
              <input
                ref={entradaCamera}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => void aoEscolherLogo(e)}
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
              />
              <input
                ref={entradaGaleria}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => void aoEscolherLogo(e)}
                className="hidden"
                aria-hidden="true"
                tabIndex={-1}
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => entradaCamera.current?.click()}
                  disabled={enviandoLogo}
                  className="border-borda bg-superficie-2 flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl border-2 text-sm font-medium disabled:opacity-50"
                >
                  {enviandoLogo ? (
                    <Loader2
                      aria-hidden="true"
                      className="size-4 animate-spin"
                    />
                  ) : (
                    <Camera aria-hidden="true" className="size-4" />
                  )}
                  {enviandoLogo ? 'Enviando…' : 'Fotografar'}
                </button>

                <button
                  type="button"
                  onClick={() => entradaGaleria.current?.click()}
                  disabled={enviandoLogo}
                  aria-label="Escolher logo da galeria"
                  className="border-borda bg-superficie-2 flex min-h-12 w-12 items-center justify-center rounded-xl border-2 disabled:opacity-50"
                >
                  <ImagePlus aria-hidden="true" className="size-4" />
                </button>
              </div>

              <p className="text-texto-suave text-xs">
                JPG, PNG ou WebP · máx. 2 MB
              </p>

              {erroLogo && (
                <p
                  role="alert"
                  className="text-erro-600 flex items-center gap-1 text-sm"
                >
                  <X aria-hidden="true" className="size-4 shrink-0" />
                  {erroLogo}
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ── Identidade ────────────────────────────────────────────────── */}
        <section className="bg-superficie flex flex-col gap-4 rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold">Identidade</h2>

          <CampoTexto
            rotulo="Nome fantasia"
            value={form.nome_fantasia}
            onChange={(e) => alterar('nome_fantasia', e.target.value)}
            required
            autoComplete="organization"
          />
          <CampoTexto
            rotulo="Razão social"
            value={form.razao_social}
            onChange={(e) => alterar('razao_social', e.target.value)}
          />
          <div className="grid grid-cols-2 gap-4">
            {/* "CNPJ/CPF", não só CNPJ: serralheria de bairro muitas vezes
                é MEI ou pessoa física, e o campo sempre aceitou os dois —
                a máscara `cpf_cnpj` troca de formato conforme o tamanho.
                Só o rótulo é que dizia o contrário. */}
            <CampoMascarado
              rotulo="CNPJ/CPF"
              tipo="cpf_cnpj"
              value={form.cnpj}
              onChange={(valor) => alterar('cnpj', valor)}
            />
            <CampoTexto
              rotulo="Inscrição estadual"
              value={form.inscricao_estadual}
              onChange={(e) => alterar('inscricao_estadual', e.target.value)}
            />
          </div>
        </section>

        {/* ── Contato ───────────────────────────────────────────────────── */}
        <section className="bg-superficie flex flex-col gap-4 rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold">Contato</h2>

          <div className="grid grid-cols-2 gap-4">
            <CampoMascarado
              rotulo="Telefone"
              tipo="telefone"
              value={form.telefone}
              onChange={(valor) => alterar('telefone', valor)}
            />
            <CampoMascarado
              rotulo="WhatsApp"
              tipo="telefone"
              value={form.whatsapp}
              onChange={(valor) => alterar('whatsapp', valor)}
            />
          </div>
          <CampoTexto
            rotulo="E-mail"
            value={form.email}
            onChange={(e) => alterar('email', e.target.value)}
            type="email"
            inputMode="email"
            autoComplete="email"
          />
          <CampoTexto
            rotulo="Site"
            value={form.site}
            onChange={(e) => alterar('site', e.target.value)}
            type="url"
            inputMode="url"
            placeholder="https://minhaempresa.com.br"
          />
        </section>

        {/* ── Endereço ──────────────────────────────────────────────────── */}
        <section className="bg-superficie flex flex-col gap-4 rounded-xl p-5 shadow-sm">
          <h2 className="font-semibold">Endereço</h2>

          {/* O CEP vem PRIMEIRO porque preenche o resto.
              Embaixo, como estava, quem seguia a ordem da tela digitava
              rua, bairro e cidade à mão e só então chegava ao campo que
              teria feito esse trabalho. */}
          <div>
            <CampoTexto
              rotulo="CEP"
              value={form.cep}
              onChange={(e) => {
                const formatado = formatarCep(e.target.value)

                alterar('cep', formatado)
                setCepNaoEncontrado(false)

                // Busca ao completar os 8 dígitos, sem botão: quem digitou
                // o CEP inteiro já disse o que queria.
                if (cepCompleto(formatado)) {
                  disparar(preencherPeloCep(formatado))
                }
              }}
              placeholder="00000-000"
              inputMode="numeric"
              autoComplete="postal-code"
              ajuda={
                buscandoCep
                  ? 'Buscando endereço…'
                  : cepNaoEncontrado
                    ? 'CEP não encontrado — preencha o endereço à mão.'
                    : 'Preenche rua, bairro e cidade sozinho.'
              }
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <CampoTexto
                rotulo="Logradouro"
                value={form.logradouro}
                onChange={(e) => alterar('logradouro', e.target.value)}
                autoComplete="street-address"
              />
            </div>
            <CampoTexto
              rotulo="Número"
              value={form.numero}
              onChange={(e) => alterar('numero', e.target.value)}
            />
          </div>

          <CampoTexto
            rotulo="Complemento"
            value={form.complemento}
            onChange={(e) => alterar('complemento', e.target.value)}
            placeholder="Apto, sala, bloco…"
          />

          <CampoTexto
            rotulo="Bairro"
            value={form.bairro}
            onChange={(e) => alterar('bairro', e.target.value)}
          />

          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <CampoTexto
                rotulo="Cidade"
                value={form.cidade}
                onChange={(e) => alterar('cidade', e.target.value)}
                autoComplete="address-level2"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium" htmlFor="uf-select">
                Estado
              </label>
              <select
                id="uf-select"
                value={form.estado}
                onChange={(e) => alterar('estado', e.target.value)}
                className="border-borda bg-superficie min-h-12 w-full rounded-xl border-2 px-3"
              >
                <option value="">—</option>
                {UFs.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </select>
            </div>
          </div>

        </section>

        {/* ── Feedback e salvar ─────────────────────────────────────────── */}
        {erro && (
          <p
            role="alert"
            className="bg-erro-50 text-erro-700 rounded-xl px-4 py-3 text-sm"
          >
            {erro}
          </p>
        )}

        {salvo && (
          <p
            role="status"
            className="bg-economia-50 text-economia-700 flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
          >
            <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
            Dados salvos com sucesso.
          </p>
        )}

        <Botao
          type="submit"
          tamanho="largura_total"
          carregando={editar.isPending}
        >
          Salvar
        </Botao>
      </form>

      {/* ── Sincronização em lote ─────────────────────────────────────────
          Não é a empresa quem dispara — é a organização central, num
          painel próprio. Isto só decide se esta empresa entra na lista
          quando ela apertar o botão. Some para a própria central: ela não
          sincroniza consigo mesma. */}
      {org && !org.eh_catalogo_central && (
        <section className="border-borda bg-superficie mt-8 flex flex-col gap-3 rounded-xl border-2 p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <RefreshCw aria-hidden="true" className="text-acao-600 size-5 shrink-0" />
            Sincronização em lote
          </h2>
          <p className="text-texto-suave text-sm">
            Quando ligado, esta empresa entra na lista quando a organização
            central disparar a sincronização de catálogos para todo mundo de
            uma vez — linhas, produtos, acessórios e acabamentos. Continua
            dando para importar manualmente a qualquer momento, do jeito de
            sempre, esteja isto ligado ou não.
          </p>
          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              className="size-5 shrink-0"
              checked={org.sincronizacao_automatica}
              disabled={definirSincronizacaoAutomatica.isPending}
              onChange={(e) =>
                disparar(
                  definirSincronizacaoAutomatica.mutateAsync({
                    id: org.id,
                    ativa: e.target.checked,
                  }),
                )
              }
            />
            <span className="font-medium">
              Receber a sincronização em lote da organização central
            </span>
          </label>
        </section>
      )}

      {/* ── Zona de perigo ────────────────────────────────────────────────
          Fora do formulário de propósito: não é um dado da empresa que se
          salva, é uma ação que acontece na hora, sem volta. */}
      <section className="border-erro-300 bg-erro-50 mt-8 flex flex-col gap-3 rounded-xl border-2 p-5">
        <h2 className="text-erro-700 flex items-center gap-2 font-semibold">
          <TriangleAlert aria-hidden="true" className="size-5 shrink-0" />
          Zona de perigo
        </h2>
        <p className="text-erro-700 text-sm">
          Zera a quantidade de toda sobra cadastrada na empresa. Usado para
          recomeçar o controle de estoque do zero — depois de um inventário
          físico muito diferente do sistema, por exemplo. Não afeta o
          catálogo de perfis, produtos ou listas técnicas.
        </p>
        <Botao
          type="button"
          variante="destrutiva"
          onClick={abrirZerarEstoque}
          className="self-start"
        >
          Zerar estoque da empresa
        </Botao>

        {/* ── Encerrar a empresa ────────────────────────────────────────
            Separado do "zerar estoque" por uma linha: zerar é recomeçar,
            encerrar é acabar. Estarem no mesmo bloco sem divisão faria o
            segundo parecer uma variação do primeiro. */}
        {!org.eh_catalogo_central && (
          <div className="border-erro-300 mt-2 border-t pt-4">
            {org.exclusao_solicitada_em ? (
              <>
                <p className="text-erro-700 text-sm">
                  <strong>Encerramento pedido.</strong> O pedido foi enviado
                  em{' '}
                  {new Date(org.exclusao_solicitada_em).toLocaleDateString(
                    'pt-BR',
                  )}{' '}
                  e está aguardando a equipe do RePerfil. Enquanto isso não
                  acontece, a empresa segue funcionando normalmente e você
                  pode desistir.
                </p>
                <Botao
                  type="button"
                  variante="secundaria"
                  onClick={() => disparar(cancelarExclusao.mutateAsync())}
                  carregando={cancelarExclusao.isPending}
                  className="mt-3 self-start"
                >
                  Desistir do encerramento
                </Botao>
              </>
            ) : (
              <>
                <p className="text-erro-700 text-sm">
                  <strong>Encerrar a empresa</strong> apaga tudo, sem volta:
                  catálogo, estoque, produtos, clientes, histórico, fotos e
                  os acessos de toda a equipe. Não há backup dentro do
                  aplicativo.
                </p>
                <p className="text-erro-700 mt-2 text-sm">
                  Por segurança, quem executa é a equipe do RePerfil — aqui
                  você faz o pedido, e pode desistir enquanto ele não for
                  atendido.
                </p>
                <Botao
                  type="button"
                  variante="destrutiva"
                  onClick={() => {
                    setMotivoEncerrar('')
                    setErroEncerrar(null)
                    setEncerrando(true)
                  }}
                  className="mt-3 self-start"
                >
                  Pedir encerramento da empresa
                </Botao>
              </>
            )}
          </div>
        )}
      </section>

      <Modal
        aberto={zerando}
        aoFechar={() => setZerando(false)}
        titulo="Zerar estoque da empresa"
      >
        {resultadoZerar !== null ? (
          <div className="flex flex-col gap-4">
            <p
              role="status"
              className="bg-economia-50 text-economia-700 flex items-center gap-2 rounded-xl px-4 py-3 text-sm"
            >
              <CheckCircle2 aria-hidden="true" className="size-4 shrink-0" />
              Estoque zerado. {resultadoZerar}{' '}
              {resultadoZerar === 1
                ? 'lote foi afetado.'
                : 'lotes foram afetados.'}
            </p>
            <Botao onClick={() => setZerando(false)} className="w-full">
              Fechar
            </Botao>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="text-erro-700 bg-erro-50 rounded-xl p-3 text-sm font-medium">
              Esta ação zera a quantidade de TODA sobra da empresa e cancela
              toda reserva em aberto. Não pode ser desfeita.
            </p>

            <CampoTexto
              rotulo="Motivo"
              value={justificativaZerar}
              onChange={(e) => setJustificativaZerar(e.target.value)}
              ajuda="Fica registrado no histórico de cada lote afetado."
              required
            />

            <CampoTexto
              rotulo='Digite CONFIRMO para prosseguir'
              value={textoConfirmacao}
              onChange={(e) => setTextoConfirmacao(e.target.value)}
              autoComplete="off"
              required
            />

            {erroZerar && (
              <p
                role="alert"
                className="bg-erro-100 text-erro-700 rounded-xl px-4 py-3 text-sm"
              >
                {erroZerar}
              </p>
            )}

            <div className="flex gap-3">
              <Botao
                type="button"
                variante="contorno"
                onClick={() => setZerando(false)}
                className="flex-1"
              >
                Cancelar
              </Botao>
              <Botao
                type="button"
                variante="destrutiva"
                onClick={() => void confirmarZerarEstoque()}
                carregando={zerarEstoque.isPending}
                disabled={
                  textoConfirmacao !== 'CONFIRMO' ||
                  justificativaZerar.trim().length < 5
                }
                className="flex-1"
              >
                Zerar estoque
              </Botao>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        aberto={encerrando}
        aoFechar={() => setEncerrando(false)}
        titulo="Pedir encerramento da empresa"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm">
            O pedido vai para a equipe do RePerfil. Nada é apagado agora, e
            você pode desistir enquanto ele não for atendido.
          </p>

          <p
            role="alert"
            className="bg-erro-50 text-erro-700 rounded-xl px-4 py-3 text-sm"
          >
            <strong>Quando for atendido, não há volta.</strong> Somem o
            catálogo, o estoque, os produtos, os clientes, o histórico, as
            fotos e os acessos de toda a equipe. Não existe backup dentro do
            aplicativo.
          </p>

          <div>
            <label htmlFor="motivo-encerrar" className="mb-1 block font-medium">
              Por que está encerrando?
            </label>
            <input
              id="motivo-encerrar"
              type="text"
              value={motivoEncerrar}
              onChange={(e) => setMotivoEncerrar(e.target.value)}
              placeholder="Ex.: empresa criada por engano"
              className="border-borda bg-superficie min-h-12 w-full rounded-xl border-2 px-4"
            />
            <p className="text-texto-suave mt-1 text-xs">
              Ajuda a equipe a conferir se é isso mesmo antes de apagar.
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
              onClick={() => setEncerrando(false)}
              className="flex-1"
            >
              Cancelar
            </Botao>
            <Botao
              variante="destrutiva"
              onClick={() => void confirmarPedidoEncerramento()}
              carregando={solicitarExclusao.isPending}
              disabled={motivoEncerrar.trim().length < 10}
              className="flex-1"
            >
              Enviar pedido
            </Botao>
          </div>
        </div>
      </Modal>
    </div>
  )
}
