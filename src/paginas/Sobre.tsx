import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Camera,
  ImagePlus,
  Loader2,
  Mail,
  Phone,
  MapPin,
  Pencil,
  X,
} from 'lucide-react'
import {
  useConfiguracoes,
  useEnviarLogoDesenvolvedor,
  useLogoDesenvolvedor,
} from '@/dados/configuracoes'
import {
  useTextosInstitucionais,
  useSalvarTextoInstitucional,
} from '@/dados/textosInstitucionais'
import { useOrganizacao } from '@/dados/organizacao'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { eAdministrador } from '@/autenticacao/contexto'
import { LogoEmpresa } from '@/componentes/LogoEmpresa'
import { MarcaRePerfil } from '@/componentes/MarcaRePerfil'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { Botao } from '@/componentes/ui/Botao'
import { Modal } from '@/componentes/ui/Modal'
import { SeloVersao } from '@/componentes/SeloVersao'
import type { TextosInstitucionais } from '@/tipos/banco'

const NOME_DESENVOLVEDOR = 'Fernando S. Carvalho'
const EMAIL_CONTATO = 'reperfilapp@gmail.com'
const WHATSAPP_NUMERO = '5564981808090'
const WHATSAPP_EXIBICAO = '(64) 98180-8090'

const REGEX_URL = /(https?:\/\/[^\s]+)/g

/**
 * Os textos institucionais são texto simples (sem editor de rich text) —
 * mas um endereço colado ali dentro precisa continuar clicável, senão
 * "o link para acesso é: https://..." vira decoração morta na tela.
 */
function comLinks(texto: string) {
  return texto.split(REGEX_URL).map((trecho, i) =>
    /^https?:\/\//.test(trecho) ? (
      <a
        key={i}
        href={trecho}
        target="_blank"
        rel="noopener noreferrer"
        className="text-acao-600 break-all underline"
      >
        {trecho}
      </a>
    ) : (
      <span key={i}>{trecho}</span>
    ),
  )
}

export default function Sobre() {
  const { perfil } = useAutenticacao()
  const podeEditar = eAdministrador(perfil)

  const { data: config } = useConfiguracoes()
  const { data: logoUrl } = useLogoDesenvolvedor(
    config?.logo_desenvolvedor_caminho,
  )
  const enviarLogo = useEnviarLogoDesenvolvedor()

  const { data: organizacao } = useOrganizacao()
  // Textos institucionais são do RePerfil, não de cada empresa cliente —
  // só a organização central pode editá-los (a política de RLS recusa
  // qualquer outra), mesmo que o administrador logado seja de outra
  // empresa.
  const podeEditarTextos =
    podeEditar && Boolean(organizacao?.eh_catalogo_central)

  const { data: textos } = useTextosInstitucionais()
  const salvarTexto = useSalvarTextoInstitucional()
  const [campoEditando, setCampoEditando] = useState<
    | keyof Pick<
        TextosInstitucionais,
        'texto_sobre_app' | 'texto_equipe_tecnica'
      >
    | null
  >(null)
  const [rascunho, setRascunho] = useState('')
  const [erroTexto, setErroTexto] = useState<string | null>(null)

  function abrirEdicaoTexto(campo: 'texto_sobre_app' | 'texto_equipe_tecnica') {
    setCampoEditando(campo)
    setRascunho(textos?.[campo] ?? '')
    setErroTexto(null)
  }

  async function salvarTextoEditado() {
    if (!textos || !campoEditando) return

    setErroTexto(null)

    try {
      await salvarTexto.mutateAsync({
        id: textos.id,
        campo: campoEditando,
        valor: rascunho.trim(),
      })
      setCampoEditando(null)
    } catch (e) {
      setErroTexto(e instanceof Error ? e.message : 'Não foi possível salvar.')
    }
  }

  const entradaCamera = useRef<HTMLInputElement>(null)
  const entradaGaleria = useRef<HTMLInputElement>(null)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function aoEscolherLogo(evento: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = evento.target.files?.[0]
    evento.target.value = ''

    if (!arquivo || !config) return

    setErro(null)
    setEnviando(true)

    try {
      await enviarLogo.mutateAsync({ id: config.id, arquivo })
    } catch (e) {
      setErro(
        e instanceof Error ? e.message : 'Não foi possível enviar o logo.',
      )
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8">
      <BotaoVoltar para="/mais" rotulo="Mais" className="mb-4" />

      <div className="mb-8 flex justify-center">
        <MarcaRePerfil
          variante="completa"
          className="max-w-64 rounded-xl bg-white p-4"
        />
      </div>

      <h1 className="sr-only">Sobre</h1>

      {/* ── Quem desenvolveu ──────────────────────────────────────────────── */}
      <section className="bg-superficie mb-6 rounded-xl p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-4">
          <LogoEmpresa
            logoUrl={logoUrl}
            nomeFantasia={NOME_DESENVOLVEDOR}
            tamanho="grande"
          />

          <div className="min-w-0 flex-1">
            <p className="font-semibold">{NOME_DESENVOLVEDOR}</p>
            <p className="text-texto-suave text-sm">
              Desenvolvimento do RePerfil
            </p>
          </div>
        </div>

        {podeEditar && (
          <div className="flex flex-col gap-2">
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
                disabled={enviando}
                className="border-borda bg-superficie-2 flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl border-2 text-sm font-medium disabled:opacity-50"
              >
                {enviando ? (
                  <Loader2 aria-hidden="true" className="size-4 animate-spin" />
                ) : (
                  <Camera aria-hidden="true" className="size-4" />
                )}
                {enviando ? 'Enviando…' : 'Fotografar'}
              </button>

              <button
                type="button"
                onClick={() => entradaGaleria.current?.click()}
                disabled={enviando}
                aria-label="Escolher logo da galeria"
                className="border-borda bg-superficie-2 flex min-h-11 w-11 items-center justify-center rounded-xl border-2 disabled:opacity-50"
              >
                <ImagePlus aria-hidden="true" className="size-4" />
              </button>
            </div>

            {erro && (
              <p
                role="alert"
                className="text-erro-600 flex items-center gap-1 text-sm"
              >
                <X aria-hidden="true" className="size-4 shrink-0" />
                {erro}
              </p>
            )}
          </div>
        )}

        <div className="border-borda mt-4 flex flex-col gap-2 border-t pt-4 text-sm">
          <a
            href={`mailto:${EMAIL_CONTATO}`}
            className="text-acao-600 flex items-center gap-2 hover:underline"
          >
            <Mail aria-hidden="true" className="size-4 shrink-0" />
            {EMAIL_CONTATO}
          </a>
          <a
            href={`https://wa.me/${WHATSAPP_NUMERO}`}
            target="_blank"
            rel="noreferrer"
            className="text-acao-600 flex items-center gap-2 hover:underline"
          >
            <Phone aria-hidden="true" className="size-4 shrink-0" />
            WhatsApp {WHATSAPP_EXIBICAO}
          </a>
          <p className="text-texto-suave flex items-center gap-2">
            <MapPin aria-hidden="true" className="size-4 shrink-0" />
            Rio Verde, GO
          </p>
        </div>
      </section>

      {/* ── Sobre o app ───────────────────────────────────────────────────── */}
      <section className="bg-superficie mb-6 rounded-xl p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-semibold">O RePerfil</h2>
          {podeEditarTextos && (
            <button
              type="button"
              onClick={() => abrirEdicaoTexto('texto_sobre_app')}
              aria-label="Editar texto “O RePerfil”"
              title="Editar"
              className="hover:bg-superficie-2 rounded-lg p-1.5"
            >
              <Pencil aria-hidden="true" className="text-texto-suave size-4" />
            </button>
          )}
        </div>
        <div className="text-texto flex flex-col gap-3 text-sm leading-relaxed">
          {(textos?.texto_sobre_app ?? '')
            .split('\n')
            .filter(Boolean)
            .map((paragrafo, i) => (
              <p key={i}>{comLinks(paragrafo)}</p>
            ))}
        </div>
      </section>

      {/* ── Equipe técnica ────────────────────────────────────────────────── */}
      <section className="bg-superficie mb-6 rounded-xl p-5 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="font-semibold">Nossa equipe técnica</h2>
          {podeEditarTextos && (
            <button
              type="button"
              onClick={() => abrirEdicaoTexto('texto_equipe_tecnica')}
              aria-label="Editar texto “Nossa equipe técnica”"
              title="Editar"
              className="hover:bg-superficie-2 rounded-lg p-1.5"
            >
              <Pencil aria-hidden="true" className="text-texto-suave size-4" />
            </button>
          )}
        </div>
        <div className="text-texto flex flex-col gap-3 text-sm leading-relaxed">
          {(textos?.texto_equipe_tecnica ?? '')
            .split('\n')
            .filter(Boolean)
            .map((paragrafo, i) => (
              <p key={i}>{comLinks(paragrafo)}</p>
            ))}
        </div>
      </section>

      {/* ── Documentos legais ─────────────────────────────────────────────── */}
      <section className="bg-superficie-2 mb-6 rounded-xl p-5">
        <h2 className="text-texto-suave mb-2 text-xs font-semibold tracking-wide uppercase">
          Documentos
        </h2>
        <div className="flex flex-col gap-1.5">
          <Link
            to="/termos-de-uso"
            className="text-acao-600 text-sm hover:underline"
          >
            Termos de uso
          </Link>
          <Link
            to="/politica-privacidade"
            className="text-acao-600 text-sm hover:underline"
          >
            Política de privacidade
          </Link>
        </div>
      </section>

      <SeloVersao />

      <Modal
        aberto={campoEditando !== null}
        aoFechar={() => setCampoEditando(null)}
        titulo={
          campoEditando === 'texto_sobre_app'
            ? 'Editar “O RePerfil”'
            : 'Editar “Nossa equipe técnica”'
        }
      >
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Um parágrafo por linha
            <textarea
              value={rascunho}
              onChange={(e) => setRascunho(e.target.value)}
              rows={8}
              className="border-borda bg-superficie rounded-xl border-2 p-3 text-sm leading-relaxed font-normal"
            />
          </label>

          {erroTexto && (
            <p
              role="alert"
              className="bg-erro-50 text-erro-700 rounded-xl px-4 py-3 text-sm"
            >
              {erroTexto}
            </p>
          )}

          <div className="flex gap-3">
            <Botao
              type="button"
              variante="contorno"
              onClick={() => setCampoEditando(null)}
              className="flex-1"
            >
              Cancelar
            </Botao>
            <Botao
              type="button"
              onClick={() => void salvarTextoEditado()}
              carregando={salvarTexto.isPending}
              className="flex-1"
            >
              Salvar
            </Botao>
          </div>
        </div>
      </Modal>
    </div>
  )
}
