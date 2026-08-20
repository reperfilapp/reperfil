import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Layers, ChevronRight, AlertTriangle } from 'lucide-react'
import {
  useModelosPerfil,
  useRenomearLinha,
  agruparPorLinha,
  SEM_LINHA,
} from '@/dados/modelosPerfil'
import { useAutenticacao } from '@/autenticacao/useAutenticacao'
import { podeGerenciarCadastros } from '@/autenticacao/contexto'
import { useSobras } from '@/dados/sobras'
import {
  resumirPorLinha,
  resumoDe,
  formatarResumo,
  maiorPrimeiro,
} from '@/dominio/estoqueResumo'
import { Botao } from '@/componentes/ui/Botao'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { AlternadorOrdenacao } from '@/componentes/ui/AlternadorOrdenacao'
import { ORDENACAO_PADRAO } from '@/dominio/ordenacaoListas'
import { CampoSugestao } from '@/componentes/ui/CampoSugestao'
import { Modal } from '@/componentes/ui/Modal'
import { PaginaLista } from '@/componentes/ui/PaginaLista'

/**
 * Revisão das linhas (ou sistemas) usadas pelos perfis.
 *
 * Não é um cadastro no sentido comum: não existe tabela de linhas, e não há
 * "criar" nem "excluir" aqui. A linha nasce quando alguém a digita no
 * cadastro do perfil, e desaparece quando o último perfil deixa de usá-la.
 *
 * O que esta tela resolve é o outro lado disso: o catálogo importado veio
 * com variações que são a mesma linha escrita de formas diferentes
 * ("Fachada" e "Fachada?"), e sem uma tela assim a única saída seria abrir
 * perfil por perfil. Renomear para um nome que já existe funde as duas.
 */
/** "1 perfil desta linha" / "7 perfis desta linha", sem erro de concordância. */
function textoAlcance(quantidade: number): string {
  return quantidade === 1
    ? 'Vale para o 1 perfil desta linha.'
    : `Vale para os ${quantidade} perfis desta linha.`
}

export default function Linhas() {
  const { perfil } = useAutenticacao()
  // Renomear linha reescreve o campo em TODOS os perfis que a usam.
  // É edição de catálogo, e obedece à mesma permissão.
  const podeEditar = podeGerenciarCadastros(perfil)

  const { data: modelos, isPending } = useModelosPerfil(true)
  const { data: sobras } = useSobras()
  const renomear = useRenomearLinha()

  const [editando, setEditando] = useState<string | null>(null)
  const [novoNome, setNovoNome] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [resultado, setResultado] = useState<string | null>(null)
  const [ordenacao, setOrdenacao] = useState(ORDENACAO_PADRAO)

  // Mesma ordem do resto do app: quem tem mais estoque primeiro. Aqui a
  // lista serve para faxina de nomes repetidos, e a linha com material é a
  // que mais dói ver duplicada.
  const porLinha = resumirPorLinha(
    sobras ?? [],
    (sobra) => sobra.modelo?.linha?.trim() || SEM_LINHA,
  )

  const grupos = agruparPorLinha(modelos ?? [])
    .map((grupo) => ({ ...grupo, resumo: resumoDe(porLinha, grupo.linha) }))
    .sort((a, b) => {
      if (a.linha === SEM_LINHA) return 1
      if (b.linha === SEM_LINHA) return -1

      if (ordenacao.criterio === 'nome') {
        const porNome = a.linha.localeCompare(b.linha, 'pt-BR')
        return ordenacao.decrescente ? -porNome : porNome
      }

      const porTamanho = maiorPrimeiro(a.resumo, b.resumo)
      const porEstoque = ordenacao.decrescente ? porTamanho : -porTamanho

      return porEstoque !== 0
        ? porEstoque
        : a.linha.localeCompare(b.linha, 'pt-BR')
    })
  // "Sem linha" não é uma linha: é a ausência dela. Renomear ali significaria
  // atribuir linha a perfis que não têm, que é trabalho do cadastro do
  // perfil, um a um, com o desenho à vista.
  const renomeaveis = grupos.filter((g) => g.linha !== SEM_LINHA)

  const nomesExistentes = new Set(renomeaveis.map((g) => g.linha))
  const alvo = novoNome.trim()
  const quantidadeEditando =
    renomeaveis.find((g) => g.linha === editando)?.modelos.length ?? 0
  // A própria linha fica de fora: escolhê-la seria renomear para o mesmo
  // nome, que não faz nada.
  const outrasLinhas = renomeaveis
    .map((g) => g.linha)
    .filter((nome) => nome !== editando)
  const vaiFundir =
    editando !== null && alvo !== editando && nomesExistentes.has(alvo)
  const quantidadeAlvo = vaiFundir
    ? (renomeaveis.find((g) => g.linha === alvo)?.modelos.length ?? 0)
    : 0

  function abrirEdicao(linha: string) {
    setEditando(linha)
    setNovoNome(linha)
    setErro(null)
    setResultado(null)
  }

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)

    if (editando === null) return

    if (alvo === '') {
      setErro('O nome da linha não pode ficar vazio.')
      return
    }

    if (alvo === editando) {
      setEditando(null)
      return
    }

    try {
      const afetados = await renomear.mutateAsync({ de: editando, para: alvo })

      setResultado(
        `${afetados} ${afetados === 1 ? 'perfil passou' : 'perfis passaram'} para "${alvo}".`,
      )
      setEditando(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível renomear.')
    }
  }

  return (
    <PaginaLista
      className="max-w-3xl"
      cabecalho={
        <>
          <BotaoVoltar para="/mais" rotulo="Mais" className="mb-4" />

          <header className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Linhas e sistemas</h1>
              <p className="text-texto-suave mt-1">
                Como os perfis estão agrupados. Renomear para um nome que já
                existe junta as duas linhas.
              </p>
            </div>
            <AlternadorOrdenacao
              estado={ordenacao}
              aoMudar={setOrdenacao}
              className="mt-1"
            />
          </header>

          {resultado && (
            <p
              role="status"
              className="bg-aluminio-100 text-grafite-800 mb-4 rounded-xl px-4 py-3 text-sm"
            >
              {resultado}
            </p>
          )}

          {isPending && <p className="text-texto-suave">Carregando…</p>}
        </>
      }
    >
      {!isPending && renomeaveis.length === 0 && (
        <p className="bg-superficie-2 text-texto-suave rounded-xl p-6 text-center">
          Nenhuma linha cadastrada ainda. A linha aparece aqui quando algum
          perfil passa a usá-la.
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {renomeaveis.map(({ linha, modelos: daLinha, resumo }) => (
          <li
            key={linha}
            className="bg-superficie flex items-center gap-3 rounded-xl p-4 shadow-sm"
          >
            <Layers
              aria-hidden="true"
              className="text-acao-600 size-5 shrink-0"
            />

            <Link
              to="/perfis"
              className="min-w-0 flex-1 truncate font-medium hover:underline"
            >
              {linha}
            </Link>

            <span className="text-texto-suave shrink-0 text-right text-sm">
              <span className="block tabular-nums">
                {formatarResumo(resumo)}
              </span>
              <span className="block text-xs">
                {daLinha.length} {daLinha.length === 1 ? 'perfil' : 'perfis'}
              </span>
            </span>

            {podeEditar && (
              <Botao
                variante="secundaria"
                onClick={() => abrirEdicao(linha)}
                aria-label={`Renomear ${linha}`}
              >
                <Pencil aria-hidden="true" className="size-4" />
              </Botao>
            )}
          </li>
        ))}
      </ul>

      {/* Perfis sem linha: não dá para renomear, mas esconder faria a conta
          não fechar com o total do catálogo. */}
      {grupos.some((g) => g.linha === SEM_LINHA) && (
        <Link
          to="/perfis"
          className="bg-superficie-2 text-texto-suave mt-3 flex items-center gap-3 rounded-xl p-4 text-sm"
        >
          <span className="flex-1">
            {grupos.find((g) => g.linha === SEM_LINHA)?.modelos.length} perfis
            sem linha definida — abra cada um para atribuir.
          </span>
          <ChevronRight aria-hidden="true" className="size-4 shrink-0" />
        </Link>
      )}

      <Modal
        aberto={editando !== null}
        aoFechar={() => setEditando(null)}
        titulo="Renomear linha"
      >
        <form onSubmit={aoEnviar} className="flex flex-col gap-4" noValidate>
          {/* Sugere as outras linhas: para juntar duas, escolher da lista é
              mais seguro do que tentar reproduzir a grafia exata — "Linha
              Gold / 32" não perdoa um espaço a mais. Digitar um nome novo
              continua valendo. */}
          <CampoSugestao
            rotulo="Nome da linha"
            valor={novoNome}
            aoMudar={setNovoNome}
            sugestoes={outrasLinhas}
            ajuda={editando ? textoAlcance(quantidadeEditando) : undefined}
          />

          {vaiFundir && (
            <p
              role="alert"
              className="bg-atencao-50 text-atencao-700 flex gap-3 rounded-xl p-4 text-sm"
            >
              <AlertTriangle aria-hidden="true" className="size-5 shrink-0" />
              <span>
                <strong>"{alvo}" já existe</strong> com {quantidadeAlvo}{' '}
                {quantidadeAlvo === 1 ? 'perfil' : 'perfis'}. Salvar junta as
                duas numa só — o que é útil para corrigir duplicadas, mas não dá
                para separar depois sem editar perfil por perfil.
              </span>
            </p>
          )}

          {erro && (
            <p
              role="alert"
              className="bg-erro-50 text-erro-700 rounded-xl px-4 py-3"
            >
              {erro}
            </p>
          )}

          <div className="flex gap-3">
            <Botao
              type="button"
              variante="contorno"
              onClick={() => setEditando(null)}
              className="flex-1"
            >
              Cancelar
            </Botao>
            <Botao
              type="submit"
              carregando={renomear.isPending}
              className="flex-1"
            >
              {vaiFundir ? 'Juntar' : 'Salvar'}
            </Botao>
          </div>
        </form>
      </Modal>
    </PaginaLista>
  )
}
