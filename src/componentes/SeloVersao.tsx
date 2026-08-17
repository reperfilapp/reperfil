import { useState } from 'react'
import { Info, Check, Copy, RefreshCw } from 'lucide-react'
import { VERSAO, dataBuildFormatada } from '@/config/versao'
import { APLICACAO } from '@/config/aplicacao'
import { cn } from '@/lib/utilitarios'

type EstadoVerificacao = 'ocioso' | 'verificando' | 'sem_novidade'

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
  const [verificacao, setVerificacao] = useState<EstadoVerificacao>('ocioso')

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

  /*
   * Verificação manual, para quando a automática não é suficiente — é o
   * caso do app instalado no iPhone, onde o sistema suspende os
   * temporizadores em segundo plano e a checagem periódica quase nunca
   * chega a rodar. Não decide sozinho se há versão nova: só pede ao
   * navegador para checar. Se houver, o aviso "Nova versão disponível"
   * aparece sozinho em qualquer tela — quem checa e quem decide atualizar
   * são componentes diferentes de propósito.
   */
  async function verificarAtualizacao() {
    if (!('serviceWorker' in navigator)) return

    setVerificacao('verificando')

    try {
      const registro = await navigator.serviceWorker.getRegistration()
      await registro?.update()

      // Dá tempo do navegador baixar e instalar um service worker novo
      // antes de decidir se não achou nada — a checagem em si é rápida,
      // mas instalar não é instantâneo.
      await new Promise((resolver) => setTimeout(resolver, 1500))

      if (!registro?.waiting) {
        setVerificacao('sem_novidade')
        setTimeout(() => setVerificacao('ocioso'), 3000)
      } else {
        setVerificacao('ocioso')
      }
    } catch {
      setVerificacao('ocioso')
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

          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <button
              type="button"
              onClick={() => void verificarAtualizacao()}
              disabled={verificacao === 'verificando'}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-medium hover:underline disabled:opacity-60"
            >
              <RefreshCw
                aria-hidden="true"
                className={cn(
                  'size-3.5',
                  verificacao === 'verificando' && 'animate-spin',
                )}
              />
              {verificacao === 'verificando'
                ? 'Verificando…'
                : 'Verificar atualização'}
            </button>

            <button
              type="button"
              onClick={() => void copiar()}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 font-medium hover:underline"
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

          {/* Some sozinho depois de 3s — não precisa de botão para fechar
              um recado tão pequeno, e "você já está na mais recente" é
              informação, não algo que exija confirmação. */}
          {verificacao === 'sem_novidade' && (
            <p role="status" className="mt-2">
              Você já está na versão mais recente.
            </p>
          )}
        </div>
      )}
    </div>
  )
}
