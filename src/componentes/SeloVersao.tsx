import { useState } from 'react'
import { Info, Check, Copy } from 'lucide-react'
import { VERSAO, dataBuildFormatada } from '@/config/versao'
import { APLICACAO } from '@/config/aplicacao'
import { cn } from '@/lib/utilitarios'

/**
 * Mostra a versão em execução.
 *
 * Existe para responder uma pergunta prática do dia a dia: "o celular do
 * depósito já está com a correção que subiu hoje?". Comparar o número de
 * build entre dois aparelhos responde na hora, sem adivinhação.
 *
 * Tocar no selo revela o hash do commit e permite copiar tudo — útil para
 * relatar um problema dizendo exatamente qual código estava rodando.
 */
export function SeloVersao({ className }: { className?: string }) {
  const [expandido, setExpandido] = useState(false)
  const [copiado, setCopiado] = useState(false)

  const detalhes =
    `${APLICACAO.nome} ${VERSAO.numero}\n` +
    `build ${VERSAO.build}\n` +
    `commit ${VERSAO.commit}\n` +
    `publicado em ${dataBuildFormatada()}`

  async function copiar() {
    try {
      await navigator.clipboard.writeText(detalhes)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 2000)
    } catch {
      // Área de transferência bloqueada; o texto continua visível na tela.
    }
  }

  return (
    <div className={cn('text-center', className)}>
      <button
        type="button"
        onClick={() => setExpandido((v) => !v)}
        aria-expanded={expandido}
        className="text-texto-suave inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs hover:underline"
      >
        <Info aria-hidden="true" className="size-3.5" />
        versão {VERSAO.numero} · build {VERSAO.build}
      </button>

      {expandido && (
        <div className="text-texto-suave bg-superficie-2 mt-2 rounded-xl p-3 text-left text-xs">
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
            <dt>Versão</dt>
            <dd className="font-mono">{VERSAO.numero}</dd>
            <dt>Build</dt>
            <dd className="font-mono">{VERSAO.build}</dd>
            <dt>Commit</dt>
            <dd className="font-mono">{VERSAO.commit}</dd>
            <dt>Publicado</dt>
            <dd>{dataBuildFormatada()}</dd>
          </dl>

          <button
            type="button"
            onClick={() => void copiar()}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-medium hover:underline"
          >
            {copiado ? (
              <>
                <Check aria-hidden="true" className="size-3.5" />
                Copiado
              </>
            ) : (
              <>
                <Copy aria-hidden="true" className="size-3.5" />
                Copiar para relatar um problema
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
