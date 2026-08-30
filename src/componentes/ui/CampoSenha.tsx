import {
  useId,
  useState,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utilitarios'

interface PropsCampoSenha extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'inputMode' | 'pattern'
> {
  rotulo: string
  erro?: string | undefined
  ajuda?: ReactNode
  /**
   * A senha é um PIN numérico (ver `dominio/senha.ts`) — troca
   * `type="password"` por `type="text"` mascarado em CSS.
   *
   * ── POR QUE NÃO BASTA `inputMode="numeric"` ──────────────────────────────
   *
   * O Safari do iOS ignora `inputMode` (e `pattern`) quando o campo é
   * `type="password"` — mostra sempre o teclado completo, não importa o que
   * se peça. A única saída é nunca usar `type="password"` num campo que
   * precisa do teclado numérico: aqui ele vira `type="text"` de verdade (o
   * que faz o iOS respeitar `inputMode`), e a classe `mascara-numerica`
   * desenha os pontinhos por cima — ver o comentário dela em `index.css`.
   */
  numerico?: boolean
}

/**
 * Campo de senha com o olho para conferir o que foi digitado.
 *
 * ── POR QUE ISTO IMPORTA MAIS AQUI DO QUE PARECE ─────────────────────────
 *
 * A senha é digitada num celular, muitas vezes no depósito, às vezes com a
 * mão suja ou de luva, num teclado que troca letra por letra vizinha. Sem
 * ver o que se digitou, o único retorno possível é "e-mail ou senha
 * incorretos" — que não diz se o erro foi na senha, no e-mail ou num toque
 * que virou dois caracteres.
 *
 * ── VOLTA A ESCONDER SOZINHO? NÃO ────────────────────────────────────────
 *
 * Alguns aplicativos escondem a senha de novo depois de alguns segundos.
 * Aqui não: quem mostrou quer conferir com calma, e o campo voltar a
 * esconder no meio da conferência obriga a mostrar de novo. Sair da tela já
 * descarta tudo.
 */
export function CampoSenha({
  rotulo,
  erro,
  ajuda,
  className,
  id,
  numerico,
  ...resto
}: PropsCampoSenha) {
  const idGerado = useId()
  const idCampo = id ?? idGerado
  const idErro = `${idCampo}-erro`
  const idAjuda = `${idCampo}-ajuda`

  const [visivel, setVisivel] = useState(false)
  const temErro = erro !== undefined && erro !== ''

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={idCampo} className="font-medium">
        {rotulo}
      </label>

      <div className="relative">
        <input
          id={idCampo}
          type={numerico ? 'text' : visivel ? 'text' : 'password'}
          {...(numerico ? { inputMode: 'numeric', pattern: '[0-9]*' } : {})}
          aria-invalid={temErro}
          aria-describedby={cn(temErro && idErro, !temErro && ajuda && idAjuda)}
          className={cn(
            // `pr-14` abre espaço para o botão do olho não cobrir o texto —
            // senha longa passaria por baixo dele.
            'bg-superficie min-h-16 w-full rounded-xl border-2 pr-14 pl-4 text-base',
            'placeholder:text-texto-suave',
            numerico && !visivel && 'mascara-numerica',
            temErro ? 'border-erro-500' : 'border-borda',
            className,
          )}
          {...resto}
        />

        {/* `tabIndex={-1}`: quem navega por teclado vai do campo direto para
            o botão de entrar, sem tropeçar num controle que só serve para
            conferir o que já está digitado. O leitor de tela continua
            alcançando por outros meios. */}
        <button
          type="button"
          onClick={() => setVisivel((v) => !v)}
          tabIndex={-1}
          aria-label={visivel ? 'Esconder a senha' : 'Mostrar a senha'}
          aria-pressed={visivel}
          className="text-texto-suave hover:text-texto absolute top-1/2 right-2 flex size-12 -translate-y-1/2 items-center justify-center rounded-lg"
        >
          {visivel ? (
            <EyeOff aria-hidden="true" className="size-5" />
          ) : (
            <Eye aria-hidden="true" className="size-5" />
          )}
        </button>
      </div>

      {temErro ? (
        <p id={idErro} role="alert" className="text-erro-600 text-sm">
          {erro}
        </p>
      ) : (
        ajuda && (
          <p id={idAjuda} className="text-texto-suave text-sm">
            {ajuda}
          </p>
        )
      )}
    </div>
  )
}
