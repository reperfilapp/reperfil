import { useState } from 'react'
import { Users, ChevronDown, ChevronRight } from 'lucide-react'
import {
  useColaboradores,
  useResumoAcessosEquipe,
  useAcessos,
} from '@/dados/colaboradores'
import { rotuloCargo } from '@/dominio/cargos'
import { tempoRelativo } from '@/dominio/tempoRelativo'
import { RetratoColaborador } from './RetratoColaborador'
import { cn } from '@/lib/utilitarios'
import type { PerfilUsuario } from '@/tipos/banco'

/**
 * Histórico de acessos da equipe, consolidado — no fim da tela de Equipe.
 *
 * ── POR QUE UMA SEGUNDA LISTA NA MESMA TELA ──────────────────────────────
 *
 * A lista de cima é de GESTÃO: quem existe, qual o cargo, quem tem acesso
 * ligado. Esta é de USO: quem andou entrando, quando, quantas vezes — e,
 * abrindo a pessoa, as últimas entradas com data e hora, sem precisar
 * abrir a ficha de cada um.
 *
 * As duas perguntas são vizinhas mas diferentes, e a de uso não vale o
 * espaço permanente da tela: por isso vem RECOLHIDA e no fim, depois da
 * lista que se usa todo dia.
 *
 * ── O QUE ESTE PAINEL NÃO É ──────────────────────────────────────────────
 *
 * Não é monitoramento de jornada. Mostra quando alguém ENTROU, que é o
 * único dado que o sistema guarda de propósito — ver o cabeçalho da
 * migração `20260818120000_acessos_ao_sistema.sql`, que recusa
 * explicitamente registrar aparelho, endereço de rede ou localização.
 *
 * Em particular, "entrou há 10 minutos" NÃO quer dizer "está online
 * agora": a pessoa pode ter entrado e fechado o aplicativo em seguida.
 * Dizer o contrário exigiria o aplicativo avisando de tempos em tempos que
 * continua aberto — tráfego constante, na rede ruim do depósito, para uma
 * informação que se olha uma vez por mês.
 */
export function PainelAcessosEquipe() {
  const [aberto, setAberto] = useState(false)
  // `true` inclui quem está desativado: é justamente de quem parou de
  // entrar que se quer saber quando foi a última vez.
  const { data: equipe } = useColaboradores(true)
  const { data: resumo } = useResumoAcessosEquipe()

  const pessoas = equipe ?? []

  if (pessoas.length === 0) return null

  const agora = new Date()

  // Mais recentes primeiro: a pergunta é "quem anda usando", e quem parou
  // de usar é justamente o que se procura no fim da lista.
  const ordenadas = [...pessoas].sort((a, b) => {
    const ultimoA = resumo?.porPessoa.get(a.id)?.ultimoAcesso ?? ''
    const ultimoB = resumo?.porPessoa.get(b.id)?.ultimoAcesso ?? ''

    return ultimoB.localeCompare(ultimoA)
  })

  const maisRecente = ordenadas
    .map((p) => resumo?.porPessoa.get(p.id)?.ultimoAcesso)
    .find((quando): quando is string => Boolean(quando))

  return (
    <section className="border-borda bg-celula overflow-hidden rounded-xl border-2 shadow-sm">
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        className="hover:bg-superficie-2 flex min-h-12 w-full items-center gap-2 px-3 py-2 text-left"
      >
        <Users aria-hidden="true" className="text-acao-600 size-5 shrink-0" />

        {/* Quebra em duas linhas em vez de truncar: cortado, o que some é
            justamente o fim, que é onde está a informação nova. */}
        <span className="min-w-0 flex-1 text-sm leading-tight">
          <strong>Histórico de acessos</strong>
          {maisRecente && (
            <span className="text-texto-suave">
              {` · última entrada ${tempoRelativo(maisRecente, agora)}`}
            </span>
          )}
        </span>

        <ChevronDown
          aria-hidden="true"
          className={cn(
            'text-texto-suave size-4 shrink-0 transition-transform',
            aberto && 'rotate-180',
          )}
        />
      </button>

      {aberto && (
        <div className="border-borda border-t">
          {/* Rola por dentro, com teto de altura.
              O painel vive no rodapé FIXO da tela, que não encolhe: sem o
              teto, uma equipe de vinte pessoas — ou uma pessoa com as oito
              entradas abertas — empurraria a lista de colaboradores para
              fora da tela. */}
          <ul className="flex max-h-72 flex-col overflow-y-auto">
            {ordenadas.map((pessoa) => (
              <LinhaPessoa
                key={pessoa.id}
                pessoa={pessoa}
                acessos={resumo?.porPessoa.get(pessoa.id)?.acessos ?? 0}
                ultimoAcesso={
                  resumo?.porPessoa.get(pessoa.id)?.ultimoAcesso ?? null
                }
                agora={agora}
              />
            ))}
          </ul>

          {/* Aparece só no caso improvável de a organização ter mais
              acessos do que o teto da consulta — melhor dizer que o número
              está incompleto do que mostrar um menor como se fosse o total. */}
          {resumo?.atingiuTeto && (
            <p className="text-texto-suave border-borda border-t px-3 py-2 text-xs">
              Contagem limitada aos acessos mais recentes.
            </p>
          )}
        </div>
      )}
    </section>
  )
}

/**
 * Uma pessoa na lista. Expandir mostra as últimas entradas dela, com data e
 * hora — o detalhe que a faixa resumida não cabe.
 *
 * A consulta das entradas só acontece ao expandir (o hook recebe `null`
 * enquanto fechada): abrir o painel com dez pessoas não pode disparar dez
 * consultas de uma vez para um detalhe que talvez ninguém veja.
 */
function LinhaPessoa({
  pessoa,
  acessos,
  ultimoAcesso,
  agora,
}: {
  pessoa: PerfilUsuario
  acessos: number
  ultimoAcesso: string | null
  agora: Date
}) {
  const [aberta, setAberta] = useState(false)
  const { data: entradas, isPending } = useAcessos(aberta ? pessoa.id : null, 8)

  return (
    <li className="border-borda border-b last:border-0">
      <button
        type="button"
        onClick={() => setAberta((v) => !v)}
        aria-expanded={aberta}
        className="hover:bg-superficie-2 flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <RetratoColaborador
          caminho={pessoa.foto_url}
          nome={pessoa.nome}
          tamanho="pequeno"
        />

        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-medium">
            {pessoa.nome}
            {!pessoa.ativo && (
              <span className="text-texto-suave ml-2 text-xs">(inativo)</span>
            )}
          </span>
          <span className="text-texto-suave truncate text-xs">
            {rotuloCargo(pessoa.papel)}
            {ultimoAcesso
              ? ` · entrou ${tempoRelativo(ultimoAcesso, agora)}`
              : ' · nunca entrou'}
          </span>
        </span>

        {/* O número de entradas dá a noção de intensidade que o "quando"
            sozinho não dá: entrou ontem pela primeira vez é diferente de
            entrou ontem pela centésima. */}
        {acessos > 0 && (
          <span className="bg-acao-50 text-acao-700 shrink-0 rounded-full px-2 py-0.5 text-xs font-medium tabular-nums">
            {acessos}
          </span>
        )}

        <ChevronRight
          aria-hidden="true"
          className={cn(
            'text-texto-suave size-4 shrink-0 transition-transform',
            aberta && 'rotate-90',
          )}
        />
      </button>

      {aberta && (
        <div className="bg-superficie-2 px-3 pb-2">
          {isPending ? (
            <p className="text-texto-suave py-2 text-xs">Carregando…</p>
          ) : entradas && entradas.length > 0 ? (
            <ol className="flex flex-col">
              {entradas.map((entrada) => (
                <li
                  key={entrada.id}
                  className="text-texto-suave flex justify-between py-1 text-xs"
                >
                  <span>
                    {new Date(entrada.criado_em).toLocaleDateString('pt-BR', {
                      weekday: 'short',
                      day: '2-digit',
                      month: '2-digit',
                    })}
                  </span>
                  <span className="tabular-nums">
                    {new Date(entrada.criado_em).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-texto-suave py-2 text-xs">
              Nenhuma entrada registrada ainda.
            </p>
          )}
        </div>
      )}
    </li>
  )
}
