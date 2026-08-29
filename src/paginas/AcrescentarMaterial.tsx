import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PackagePlus, PackageCheck, CheckCircle2 } from 'lucide-react'
import { useProduto, useAdicionarItemLista } from '@/dados/produtos'
import { SeletorPerfil } from '@/componentes/SeletorPerfil'
import { Botao } from '@/componentes/ui/Botao'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { CampoTexto } from '@/componentes/ui/CampoTexto'
import { CampoQuantidade } from '@/componentes/ui/CampoQuantidade'
import { SeletorCortes } from '@/componentes/produto/SeletorCortes'
import { CartaoGrupoCorte } from '@/componentes/produto/CartaoGrupoCorte'
import {
  interpretarMedidaDigitada,
  validarComprimento,
} from '@/dominio/medidas'
import {
  CORTE_PADRAO,
  SENTIDO_PADRAO,
  criarGrupoUnico,
  descreverCortes,
  dividirGrupo,
  redimensionarGrupos,
  removerGrupo,
  somaQuantidades,
  type CorteDaPeca,
  type GrupoCorte,
  type SentidoMontagem,
  type TipoCorte,
} from '@/dominio/corteMontagem'
import type { DadosItemLista } from '@/dados/produtos'
import { cn } from '@/lib/utilitarios'
import type { ModeloPerfil } from '@/tipos/banco'

/**
 * Acrescentar um material (corte) à lista técnica de um produto.
 *
 * Tela própria, e não mais um modal por cima da ficha do produto: escolher
 * o perfil precisa da mesma busca da tela de Estoque — por linha, código ou
 * medida —, e isso não cabe direito numa janela pequena. Reaproveita o
 * `SeletorPerfil` já usado em Cadastrar estoque, com o mesmo comportamento:
 * a lista de linhas ocupa a tela toda até escolher um perfil; depois disso,
 * ele fica fixo (só "Trocar perfil" desfaz) enquanto se lança comprimento e
 * quantidade um atrás do outro — é assim que se monta uma lista técnica de
 * verdade, vários cortes do mesmo perfil em sequência.
 */
export default function AcrescentarMaterial() {
  const { id = null } = useParams()
  const navegar = useNavigate()
  const { data: produto } = useProduto(id)
  const adicionar = useAdicionarItemLista()

  const [modelo, setModelo] = useState<ModeloPerfil | null>(null)
  const [comprimentoMm, setComprimentoMm] = useState('')
  const [quantidade, setQuantidade] = useState(1)
  /*
   * Sentido e cortes NÃO são zerados a cada peça acrescentada — ao contrário
   * do comprimento. Numa receita real os cortes se repetem em blocos (os
   * quatro perfis do marco saem todos em meia-esquadria), e voltar ao reto a
   * cada linha faria a pessoa refazer a mesma escolha quatro vezes seguidas.
   */
  const [sentido, setSentido] = useState<SentidoMontagem>(SENTIDO_PADRAO)
  const [corteInicio, setCorteInicio] = useState<TipoCorte>(CORTE_PADRAO)
  const [corteFim, setCorteFim] = useState<TipoCorte>(CORTE_PADRAO)
  /*
   * "Dividir em grupos de corte": só faz sentido com mais de uma peça, e
   * existe porque nem toda receita é uniforme — um marco pode ter três
   * montantes retos e um só em meia-esquadria, e forçar todos ao mesmo
   * corte obrigaria a lançar essa peça separada, fora da sequência.
   *
   * Desligado por padrão porque o caso comum É o uniforme: a maioria das
   * peças da mesma medida sai com o mesmo corte, e ligar isto para toda
   * peça pediria uma divisão onde nenhuma era precisa.
   */
  const [porGrupos, setPorGrupos] = useState(false)
  const [grupos, setGrupos] = useState<GrupoCorte[]>([])
  const [erro, setErro] = useState<string | null>(null)
  const [ultimoAdicionado, setUltimoAdicionado] = useState<string | null>(null)

  function mudarQuantidade(nova: number) {
    setQuantidade(nova)

    if (porGrupos) {
      setGrupos((atual) => redimensionarGrupos(atual, nova))
    }
  }

  function alternarPorGrupos() {
    const ligar = !porGrupos

    setPorGrupos(ligar)

    // Ao ligar, nasce um grupo só, com o corte único já escolhido e toda a
    // quantidade — quem ligou para ajustar só uma fração não quer redigitar
    // o resto.
    if (ligar) {
      setGrupos((atual) =>
        atual.length === 0
          ? criarGrupoUnico(quantidade, {
              sentido,
              corte_inicio: corteInicio,
              corte_fim: corteFim,
            })
          : redimensionarGrupos(atual, quantidade),
      )
    }
  }

  function mudarCorteDoGrupo(indice: number, corte: CorteDaPeca) {
    setGrupos((atual) =>
      atual.map((g, i) => (i === indice ? { ...g, ...corte } : g)),
    )
  }

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    setErro(null)

    if (modelo === null) {
      setErro('Escolha o perfil.')
      return
    }

    /*
     * Pelo domínio de medidas, não à mão.
     *
     * Esta tela fazia o próprio `Number(texto.replace(',','.'))` +
     * `Math.round()`, sem passar por `interpretarMedidaDigitada` nem por
     * `validarComprimento` — as duas únicas telas que gravam corte de
     * lista técnica eram, justamente, as que ignoravam a regra do
     * sistema. O resultado: dava para cadastrar um corte de 50 metros num
     * perfil de barra de 6, e nada reclamava. O produto virava
     * impossível de fabricar sem que a tela de viabilidade soubesse
     * explicar por quê.
     *
     * O limite é o comprimento da barra DESTE perfil: um corte não pode
     * ser maior do que a peça de onde ele sai.
     */
    const comprimento = interpretarMedidaDigitada(comprimentoMm, 'mm')
    const qtd = quantidade

    if (comprimento === null) {
      setErro('Informe o comprimento do corte, em milímetros.')
      return
    }

    const validacao = validarComprimento(
      comprimento,
      modelo.comprimento_barra_mm,
    )

    if (!validacao.valido) {
      setErro(validacao.mensagem)
      return
    }

    if (!Number.isInteger(qtd) || qtd <= 0) {
      setErro('A quantidade por unidade precisa ser um número inteiro.')
      return
    }

    // Salvaguarda: o comum é `mudarQuantidade`/`alternarPorGrupos` manterem
    // a soma dos grupos em sincronia sozinhos, mas um envio não pode
    // confiar nisso — uma linha onde a soma não bate com a quantidade viola
    // a regra do próprio banco (`grupos_de_corte_valido`), e é melhor
    // travar aqui, com uma frase, do que devolver o erro cru do Postgres.
    if (porGrupos && somaQuantidades(grupos) !== qtd) {
      setErro('Defina o corte de todas as peças antes de acrescentar.')
      return
    }

    if (id === null) return

    try {
      /*
       * Continua UMA linha, quantidade N — "corte por peça" não divide a
       * lista técnica, só anexa a exceção. `grupos_de_corte` guarda o corte
       * de cada grupo quando ligado; as colunas soltas (`sentido`,
       * `corte_inicio`, `corte_fim`) recebem o do primeiro grupo, como valor
       * de referência para quem olhar a linha sem entender o array — nunca
       * são o que decide a instrução quando o array existe.
       */
      const dados: DadosItemLista = {
        produto_id: id,
        modelo_perfil_id: modelo.id,
        comprimento_mm: comprimento,
        quantidade: qtd,
        sentido: porGrupos ? grupos[0]!.sentido : sentido,
        corte_inicio: porGrupos ? grupos[0]!.corte_inicio : corteInicio,
        corte_fim: porGrupos ? grupos[0]!.corte_fim : corteFim,
        grupos_de_corte: porGrupos ? grupos : null,
        observacao: null,
      }

      await adicionar.mutateAsync(dados)

      // Só o comprimento e a quantidade são zerados: o perfil escolhido e os
      // cortes normalmente se repetem no próximo corte da mesma receita.
      setUltimoAdicionado(
        porGrupos
          ? `${modelo.codigo} — ${comprimento} mm × ${qtd} peças, em ${grupos.length} grupos de corte`
          : `${modelo.codigo} — ${comprimento} mm × ${qtd} · ${descreverCortes(sentido, corteInicio, corteFim)}`,
      )

      setComprimentoMm('')
      setQuantidade(1)
      // "Corte por peça" é uma decisão desta entrada, não sticky como
      // sentido e corte — a próxima peça volta ao caso comum (uniforme).
      setPorGrupos(false)
      setGrupos([])
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.')
    }
  }

  return (
    <div
      className={cn(
        'mx-auto w-full max-w-lg px-5',
        modelo && 'py-6',
        // Mesma ideia de Cadastrar estoque: sem perfil escolhido ainda, a
        // tela vira uma coluna até a barra de navegação, e a lista de
        // linhas cresce para preencher o espaço de verdade.
        !modelo &&
          '-mb-[5.5rem] flex h-[calc(100dvh-5.5rem)] flex-col py-4 md:mb-0 md:h-auto md:py-6',
      )}
    >
      <BotaoVoltar
        para={`/produtos/${id}`}
        rotulo={produto?.nome ?? 'Produto'}
        // `self-start`: sem perfil escolhido, o contêiner vira `flex-col`
        // (para a lista de linhas crescer até a barra inferior) — e um
        // filho `inline-flex` dentro de `flex-col` estica para a largura
        // toda por padrão, virando uma faixa em vez do botão compacto de
        // sempre.
        className="mb-4 shrink-0 self-start"
      />

      <header className="mb-6 flex shrink-0 items-center gap-3">
        <PackagePlus aria-hidden="true" className="text-acao-600 size-7" />
        <h1 className="text-2xl font-bold">Acrescentar material</h1>
      </header>

      {ultimoAdicionado && (
        <div
          role="status"
          className="bg-aluminio-100 text-grafite-800 mb-5 flex shrink-0 items-center gap-2 rounded-xl p-4 text-sm"
        >
          <CheckCircle2 aria-hidden="true" className="size-5 shrink-0" />
          <p>
            <strong>{ultimoAdicionado}</strong> acrescentado à lista técnica.
          </p>
        </div>
      )}

      <div className={cn('flex flex-col gap-6', !modelo && 'min-h-0 flex-1')}>
        <section className={cn(!modelo && 'flex min-h-0 flex-1 flex-col')}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="font-semibold">Qual perfil?</h2>
            {modelo && (
              <BotaoVoltar
                onClick={() => setModelo(null)}
                rotulo="Trocar perfil"
              />
            )}
          </div>
          <SeletorPerfil selecionado={modelo} aoSelecionar={setModelo} />
        </section>

        {modelo && (
          <form onSubmit={aoEnviar} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-4">
              <CampoTexto
                rotulo="Comprimento (mm)"
                inputMode="numeric"
                value={comprimentoMm}
                onChange={(e) => setComprimentoMm(e.target.value)}
                className="h-11 min-h-11 text-lg"
                rotuloClassName="text-sm whitespace-nowrap tracking-tight"
                required
              />

              {/* Mais e menos, como no resto do aplicativo: a quantidade de
                  um corte quase sempre é 1, 2 ou 4, e para isso tocar num
                  botão é mais rápido do que abrir o teclado do celular —
                  que ainda por cima cobre metade da tela. */}
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium tracking-tight whitespace-nowrap">
                  Quantidade
                </span>
                <CampoQuantidade
                  valor={quantidade}
                  aoMudar={mudarQuantidade}
                  rotulo="Quantidade por unidade"
                  compacto
                />
              </div>
            </div>

            {/* Só aparece com mais de uma peça — com uma só, dividir em
                grupos não teria o que decidir. */}
            {quantidade > 1 && (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={porGrupos}
                  onChange={alternarPorGrupos}
                />
                Dividir em grupos de corte diferentes
              </label>
            )}

            {/* Antes do botão de acrescentar, e não depois: o corte faz parte
                da peça que está sendo lançada, e quem chega no botão sem ter
                passado por aqui lançaria a peça sem a instrução. */}
            {porGrupos ? (
              <div className="flex flex-col gap-3">
                {grupos.map((grupo, indice) => (
                  <CartaoGrupoCorte
                    key={indice}
                    grupo={grupo}
                    indice={indice}
                    totalGrupos={grupos.length}
                    aoMudarCorte={(corte) => mudarCorteDoGrupo(indice, corte)}
                    aoDividir={(quantidadeNoNovo) =>
                      setGrupos((atual) =>
                        dividirGrupo(atual, indice, quantidadeNoNovo),
                      )
                    }
                    aoRemover={() =>
                      setGrupos((atual) => removerGrupo(atual, indice))
                    }
                  />
                ))}
              </div>
            ) : (
              <SeletorCortes
                sentido={sentido}
                corteInicio={corteInicio}
                corteFim={corteFim}
                aoMudarSentido={setSentido}
                aoMudarInicio={setCorteInicio}
                aoMudarFim={setCorteFim}
              />
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
                onClick={() => navegar(`/produtos/${id}`)}
                className="flex-1"
              >
                Concluir
              </Botao>
              <Botao
                type="submit"
                carregando={adicionar.isPending}
                className="flex-1"
              >
                <PackageCheck aria-hidden="true" className="size-5" />
                Acrescentar
              </Botao>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
