import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Camera,
  ImagePlus,
  Loader2,
  Mail,
  Phone,
  MapPin,
  X,
} from 'lucide-react'
import {
  useConfiguracoes,
  useEnviarLogoDesenvolvedor,
  useLogoDesenvolvedor,
} from '@/dados/configuracoes'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { eAdministrador } from '@/autenticacao/contexto'
import { LogoEmpresa } from '@/componentes/LogoEmpresa'
import { MarcaRePerfil } from '@/componentes/MarcaRePerfil'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { SeloVersao } from '@/componentes/SeloVersao'

const NOME_DESENVOLVEDOR = 'Fernando S. Carvalho'
const EMAIL_CONTATO = 'reperfilapp@gmail.com'
const WHATSAPP_NUMERO = '5564981808090'
const WHATSAPP_EXIBICAO = '(64) 98180-8090'

export default function Sobre() {
  const { perfil } = useAutenticacao()
  const podeEditar = eAdministrador(perfil)

  const { data: config } = useConfiguracoes()
  const { data: logoUrl } = useLogoDesenvolvedor(
    config?.logo_desenvolvedor_caminho,
  )
  const enviarLogo = useEnviarLogoDesenvolvedor()

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
      setErro(e instanceof Error ? e.message : 'Não foi possível enviar o logo.')
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
        <h2 className="mb-3 font-semibold">O RePerfil</h2>
        <div className="text-texto flex flex-col gap-3 text-sm leading-relaxed">
          <p>
            Somos uma empresa de desenvolvimento de software localizada em
            Rio Verde, GO. O RePerfil nasceu para resolver um problema
            concreto de oficina: sobra de perfil de alumínio que não volta a
            ser usada porque ninguém sabe onde ela está, ou de que tamanho é.
          </p>
          <p>
            O aplicativo controla essas sobras e permite reaproveitá-las de
            verdade em novos cortes — além de controlar o estoque de material
            novo, seja perfil ou acessório (dobradiça, roldana, puxador e
            afins).
          </p>
          <p>
            Tem uma necessidade específica que o RePerfil ainda não atende?
            Fale com a gente pelo e-mail ou WhatsApp acima — vamos avaliar a
            possibilidade de atender sua demanda.
          </p>
        </div>
      </section>

      {/* ── Equipe técnica ────────────────────────────────────────────────── */}
      <section className="bg-superficie mb-6 rounded-xl p-5 shadow-sm">
        <h2 className="mb-3 font-semibold">Nossa equipe técnica</h2>
        <p className="text-texto text-sm leading-relaxed">
          Nossa equipe é formada por profissionais com ampla experiência em
          serralheria de alumínio — somos proprietários de uma empresa de
          esquadrias e vidros temperados, especializada em montagens de todo
          tipo de esquadria de alumínio, ACM e projetos com vidro temperado.
          O RePerfil é feito por quem também trabalha no depósito.
        </p>
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
    </div>
  )
}
