import { useEffect, useRef, useState, type FormEvent } from 'react'
import {
  Building2,
  Camera,
  CheckCircle2,
  ImagePlus,
  Loader2,
  X,
} from 'lucide-react'
import {
  useOrganizacao,
  useEditarOrganizacao,
  useLogoOrganizacao,
  useEnviarLogo,
  type DadosOrganizacao,
} from '@/dados/organizacao'
import { Botao } from '@/componentes/ui/Botao'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { CampoTexto } from '@/componentes/ui/CampoTexto'
import { LogoEmpresa } from '@/componentes/LogoEmpresa'

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
  const [erro, setErro] = useState<string | null>(null)

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
            <CampoTexto
              rotulo="CNPJ"
              value={form.cnpj}
              onChange={(e) => alterar('cnpj', e.target.value)}
              placeholder="00.000.000/0000-00"
              inputMode="numeric"
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
            <CampoTexto
              rotulo="Telefone"
              value={form.telefone}
              onChange={(e) => alterar('telefone', e.target.value)}
              type="tel"
              inputMode="tel"
              autoComplete="tel"
            />
            <CampoTexto
              rotulo="WhatsApp"
              value={form.whatsapp}
              onChange={(e) => alterar('whatsapp', e.target.value)}
              type="tel"
              inputMode="tel"
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

          <CampoTexto
            rotulo="CEP"
            value={form.cep}
            onChange={(e) => alterar('cep', e.target.value)}
            placeholder="00000-000"
            inputMode="numeric"
            autoComplete="postal-code"
          />
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
    </div>
  )
}
