import { useState } from 'react'
import { Building2, RefreshCw, ShieldOff } from 'lucide-react'
import {
  useOrganizacao,
  useEmpresasParaCentral,
  type EmpresaNaCentral,
} from '@/dados/organizacao'
import {
  useSincronizarCatalogoCentralPara,
  useSincronizarProdutosPara,
  useSincronizarAcessoriosCentralPara,
  useSincronizarAcabamentosCentralPara,
} from '@/dados/sincronizacaoCentral'
import { Botao } from '@/componentes/ui/Botao'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { PaginaLista } from '@/componentes/ui/PaginaLista'
import { cn } from '@/lib/utilitarios'

/**
 * Painel só da organização central: sincroniza as 4 entidades (perfis,
 * produtos, acessórios, acabamentos) para várias empresas de uma vez, sem
 * precisar entrar em cada uma das 4 telas de administração por empresa.
 *
 * Só entra na lista de "sincronizar tudo" quem ligou o próprio interruptor
 * em `DadosEmpresa.tsx` (`organizacoes.sincronizacao_automatica`) — a
 * central não mexe no cadastro de ninguém sem essa autorização, mesmo
 * sendo dona do catálogo. O botão por empresa respeita a mesma regra.
 *
 * As 4 chamadas de uma mesma empresa rodam em SEQUÊNCIA, nesta ordem —
 * produtos depende de perfis já terem sido copiados (a lista técnica só
 * vincula item cujo perfil já existe localmente); rodar em paralelo
 * deixaria essa contagem errada na primeira sincronização.
 */
export default function SincronizarCatalogosCentral() {
  const { data: organizacao } = useOrganizacao()
  const souCentral = Boolean(organizacao?.eh_catalogo_central)

  const { data: empresas, isPending, error } = useEmpresasParaCentral()

  const sincronizarPerfis = useSincronizarCatalogoCentralPara()
  const sincronizarProdutos = useSincronizarProdutosPara()
  const sincronizarAcessorios = useSincronizarAcessoriosCentralPara()
  const sincronizarAcabamentos = useSincronizarAcabamentosCentralPara()

  const [processando, setProcessando] = useState<string | null>(null)
  const [progresso, setProgresso] = useState<string | null>(null)
  const [resultados, setResultados] = useState<Record<string, string>>({})
  const [erros, setErros] = useState<Record<string, string | undefined>>({})

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

  async function sincronizarUma(empresa: EmpresaNaCentral) {
    setProcessando(empresa.organizacao_id)
    setErros((atual) => ({ ...atual, [empresa.organizacao_id]: undefined }))

    try {
      const perfis = await sincronizarPerfis.mutateAsync(empresa.organizacao_id)
      const produtos = await sincronizarProdutos.mutateAsync(
        empresa.organizacao_id,
      )
      const acessorios = await sincronizarAcessorios.mutateAsync(
        empresa.organizacao_id,
      )
      const acabamentos = await sincronizarAcabamentos.mutateAsync(
        empresa.organizacao_id,
      )

      const resumo = [
        `Perfis: ${perfis.perfis_novos} novos · ${perfis.perfis_atualizados} atualizados`,
        `Produtos: ${produtos.produtos_novos + produtos.produtos_vinculados} novos · ${produtos.produtos_atualizados} atualizados`,
        `Acessórios: ${acessorios.acessorios_novos} novos · ${acessorios.acessorios_atualizados} atualizados`,
        `Acabamentos: ${acabamentos.acabamentos_novos} novos · ${acabamentos.acabamentos_atualizados} atualizados`,
      ].join(' — ')

      setResultados((atual) => ({ ...atual, [empresa.organizacao_id]: resumo }))
    } catch (e) {
      setErros((atual) => ({
        ...atual,
        [empresa.organizacao_id]:
          e instanceof Error ? e.message : 'Não foi possível sincronizar.',
      }))
    } finally {
      setProcessando(null)
    }
  }

  async function sincronizarTodasParticipantes() {
    const participantes = (empresas ?? []).filter(
      (e) => e.sincronizacao_automatica,
    )

    for (let i = 0; i < participantes.length; i++) {
      setProgresso(`Sincronizando ${i + 1} de ${participantes.length}…`)
      await sincronizarUma(participantes[i]!)
    }

    setProgresso(null)
  }

  const participantes = (empresas ?? []).filter(
    (e) => e.sincronizacao_automatica,
  )
  const sincronizandoTudo = progresso !== null

  return (
    <PaginaLista
      className="max-w-3xl"
      cabecalho={
        <>
          <BotaoVoltar para="/mais" rotulo="Mais" className="mb-4" />

          <header className="mb-5">
            <h1 className="text-2xl font-bold">Sincronizar catálogos</h1>
            <p className="text-texto-suave mt-1">
              Perfis, produtos, acessórios e acabamentos, para várias
              empresas de uma vez.
            </p>
          </header>

          <Botao
            onClick={() => void sincronizarTodasParticipantes()}
            disabled={participantes.length === 0}
            carregando={sincronizandoTudo}
            className="w-full"
          >
            <RefreshCw aria-hidden="true" className="size-5" />
            Sincronizar tudo agora ({participantes.length}{' '}
            {participantes.length === 1 ? 'empresa' : 'empresas'})
          </Botao>

          {progresso && (
            <p className="text-texto-suave mt-2 text-sm">{progresso}</p>
          )}

          {participantes.length === 0 && !isPending && (
            <p className="text-texto-suave mt-2 text-sm">
              Nenhuma empresa ligou "Receber a sincronização em lote" ainda —
              o interruptor fica na tela de dados da própria empresa.
            </p>
          )}

          {isPending && <p className="text-texto-suave mt-4">Carregando…</p>}
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
              'flex flex-col gap-2 rounded-xl border-2 p-4 shadow-sm',
              empresa.sincronizacao_automatica
                ? 'bg-celula border-borda'
                : 'border-borda bg-superficie',
            )}
          >
            <div className="flex items-center gap-3">
              <Building2
                aria-hidden="true"
                className="text-acao-600 size-5 shrink-0"
              />

              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{empresa.nome_fantasia}</p>
                <p className="text-texto-suave truncate text-xs">
                  {empresa.sincronizacao_automatica
                    ? 'Participa da sincronização em lote'
                    : 'Não participa — ela precisa ligar isso na própria tela'}
                </p>
              </div>

              <Botao
                tamanho="pequeno"
                variante="secundaria"
                disabled={!empresa.sincronizacao_automatica}
                carregando={processando === empresa.organizacao_id}
                onClick={() => void sincronizarUma(empresa)}
              >
                Sincronizar agora
              </Botao>
            </div>

            {resultados[empresa.organizacao_id] && (
              <p className="text-texto-suave text-xs">
                {resultados[empresa.organizacao_id]}
              </p>
            )}

            {erros[empresa.organizacao_id] && (
              <p role="alert" className="text-erro-600 text-xs">
                {erros[empresa.organizacao_id]}
              </p>
            )}
          </li>
        ))}
      </ul>
    </PaginaLista>
  )
}
