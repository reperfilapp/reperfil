import { useState } from 'react'
import {
  CheckCircle2,
  Copy,
  PackagePlus,
  Package,
  Scissors,
} from 'lucide-react'
import {
  useCadastrarSobra,
  useSomarAoLote,
  useSobras,
  type DadosNovaSobra,
} from '@/dados/sobras'
import { loteEquivalente } from '@/dominio/duplicidade'
import { useAcabamentos } from '@/dados/acabamentos'
import { PontoCor } from '@/componentes/ui/PontoCor'
import { useLocalizacoes, descreverLocalizacao } from '@/dados/localizacoes'
import { useClientes } from '@/dados/clientes'
import { SeletorPerfil } from '@/componentes/SeletorPerfil'
import { usePerfilIndicado } from '@/componentes/usePerfilIndicado'
import { CampoMedida } from '@/componentes/ui/CampoMedida'
import { CampoSelecao } from '@/componentes/ui/CampoSelecao'
import { CampoFoto } from '@/componentes/ui/CampoFoto'
import { Botao } from '@/componentes/ui/Botao'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import {
  formatarComprimento,
  interpretarMedidaDigitada,
} from '@/dominio/medidas'
import { cn } from '@/lib/utilitarios'
import {
  enviarFotoSobra,
  obterLinkTemporario,
  BALDE_FOTOS,
} from '@/lib/armazenamento'
import type { UnidadeMedida } from '@/config/aplicacao'
import type { EstadoConservacao, ModeloPerfil } from '@/tipos/banco'

/**
 * Cadastro rápido de estoque — a função mais usada do sistema.
 *
 * O cenário real: pessoa de pé no depósito, peça numa mão, celular na outra,
 * às vezes de luva, com dez pontas para lançar. Cada toque a mais multiplica
 * por dez. Daí as escolhas:
 *
 * • Acabamento e localização PERMANECEM preenchidos após salvar. Quem está
 *   lançando as sobras de uma obra normalmente tem várias peças da mesma cor
 *   indo para a mesma prateleira.
 *
 * • "Salvar e cadastrar outra" é o botão principal, não o secundário.
 *
 * • Há um botão para repetir o último lançamento inteiro, para o caso de
 *   peças idênticas cadastradas separadamente.
 *
 * • O resumo antes de salvar mostra o comprimento já convertido, porque é o
 *   último momento de perceber uma vírgula no lugar errado.
 */

interface UltimoLancamento {
  modelo: ModeloPerfil
  dados: DadosNovaSobra
  codigoGerado: string
}

const ROTULO_ESTADO: Record<EstadoConservacao, string> = {
  novo_embalado: 'Novo/Embalado',
  excelente: 'Excelente',
  bom: 'Bom',
  pequenos_arranhoes: 'Pequenos arranhões',
  muito_avariado: 'Muito avariado',
}

export default function CadastrarSobra() {
  const cadastrar = useCadastrarSobra()
  const somar = useSomarAoLote()
  const { data: sobras } = useSobras()
  const { data: acabamentos } = useAcabamentos()
  const { data: locais } = useLocalizacoes()
  const { data: clientes } = useClientes()

  const [modelo, setModelo] = useState<ModeloPerfil | null>(null)
  // Volta da tela de identificação já com o perfil escolhido.
  usePerfilIndicado(setModelo)
  const [acabamentoId, setAcabamentoId] = useState('')
  const [localizacaoId, setLocalizacaoId] = useState('')
  // O texto digitado é a fonte de verdade; o valor em milímetros é derivado
  // dele. Guardar os dois separados foi o que causou o campo mostrar erro
  // sobre um número válido depois de salvar.
  const [textoMedida, setTextoMedida] = useState('')
  const [unidade, setUnidade] = useState<UnidadeMedida>('mm')
  const comprimentoMm = interpretarMedidaDigitada(textoMedida, unidade)
  const [quantidade, setQuantidade] = useState(1)
  // Tipo: 'novo' (vem do fornecedor) ou 'sobra' (saiu de corte/obra)
  const [tipoMaterial, setTipoMaterial] = useState<'novo' | 'sobra'>('sobra')
  // Quando tipo = 'novo', o estado é fixado em 'novo_embalado'
  const [estadoManual, setEstadoManual] = useState<EstadoConservacao>('bom')
  const estado: EstadoConservacao =
    tipoMaterial === 'novo' ? 'novo_embalado' : estadoManual
  const [clienteObra, setClienteObra] = useState('')
  const [observacoes, setObservacoes] = useState('')
  const [origem, setOrigem] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ultimo, setUltimo] = useState<UltimoLancamento | null>(null)
  const [fotoCaminho, setFotoCaminho] = useState<string | null>(null)
  const [fotoPrevia, setFotoPrevia] = useState<string | null>(null)

  async function fotoEnviada(caminho: string) {
    setFotoCaminho(caminho)
    setFotoPrevia(await obterLinkTemporario(BALDE_FOTOS, caminho))
  }

  /*
   * O lote que já guarda peças iguais às que estão sendo lançadas — mesmo
   * perfil, mesmo acabamento, mesmo comprimento.
   *
   * Aparece ANTES de salvar, e não como erro depois: quem está lançando uma
   * remessa tem a informação na hora de decidir, e a decisão continua sendo
   * dele. Há motivo legítimo para manter separado (uma remessa que veio com
   * defeito e vai ser devolvida, por exemplo), então o aviso não bloqueia.
   */
  const jaExiste =
    modelo !== null && acabamentoId !== '' && comprimentoMm !== null
      ? loteEquivalente(sobras ?? [], {
          modelo_perfil_id: modelo.id,
          acabamento_id: acabamentoId,
          comprimento_mm: comprimentoMm,
        })
      : null

  const prontoParaSalvar =
    modelo !== null &&
    acabamentoId !== '' &&
    comprimentoMm !== null &&
    comprimentoMm > 0 &&
    quantidade >= 1

  async function salvar(continuarCadastrando: boolean) {
    if (!modelo || comprimentoMm === null) return

    setErro(null)

    const dados: DadosNovaSobra = {
      modelo_perfil_id: modelo.id,
      acabamento_id: acabamentoId,
      comprimento_mm: comprimentoMm,
      quantidade,
      localizacao_id: localizacaoId === '' ? null : localizacaoId,
      estado,
      origem: origem.trim() === '' ? null : origem.trim(),
      observacoes: observacoes.trim() === '' ? null : observacoes.trim(),
      foto_url: fotoCaminho,
      tipo_material: tipoMaterial,
      cliente_obra: clienteObra.trim() === '' ? null : clienteObra.trim(),
    }

    try {
      const criado = await cadastrar.mutateAsync(dados)

      setUltimo({ modelo, dados, codigoGerado: criado.codigo })

      if (continuarCadastrando) {
        // Mantém acabamento, localização, estado, tipo, cliente/obra e origem:
        // quem lança as peças de uma mesma remessa repete esses campos.
        setTextoMedida('')
        setQuantidade(1)
        setObservacoes('')
        // A foto é da peça, não do lote: nunca deve ser reaproveitada.
        setFotoCaminho(null)
        setFotoPrevia(null)
      } else {
        setModelo(null)
        setTextoMedida('')
        setQuantidade(1)
        setObservacoes('')
        setFotoCaminho(null)
        setFotoPrevia(null)
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.')
    }
  }

  async function somarAoExistente(continuarCadastrando: boolean) {
    if (!modelo || jaExiste === null) return

    setErro(null)

    try {
      await somar.mutateAsync({
        loteId: jaExiste.id,
        quantidade,
        origem: origem.trim() === '' ? null : origem.trim(),
      })

      setUltimo({
        modelo,
        dados: {
          modelo_perfil_id: modelo.id,
          acabamento_id: acabamentoId,
          comprimento_mm: comprimentoMm ?? 0,
          quantidade,
          localizacao_id: localizacaoId === '' ? null : localizacaoId,
          estado,
          origem: origem.trim() === '' ? null : origem.trim(),
          observacoes: observacoes.trim() === '' ? null : observacoes.trim(),
          foto_url: fotoCaminho,
          tipo_material: tipoMaterial,
          cliente_obra: clienteObra.trim() === '' ? null : clienteObra.trim(),
        },
        codigoGerado: jaExiste.codigo,
      })

      setTextoMedida('')
      setQuantidade(1)
      setObservacoes('')
      setFotoCaminho(null)
      setFotoPrevia(null)

      if (!continuarCadastrando) setModelo(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível somar.')
    }
  }

  function repetirUltimo() {
    if (!ultimo) return

    setModelo(ultimo.modelo)
    setAcabamentoId(ultimo.dados.acabamento_id)
    setLocalizacaoId(ultimo.dados.localizacao_id ?? '')
    setUnidade('mm')
    setTextoMedida(String(ultimo.dados.comprimento_mm))
    setQuantidade(ultimo.dados.quantidade)
    setTipoMaterial(ultimo.dados.tipo_material)
    if (ultimo.dados.tipo_material !== 'novo') {
      setEstadoManual(ultimo.dados.estado)
    }
    setClienteObra(ultimo.dados.cliente_obra ?? '')
    setObservacoes(ultimo.dados.observacoes ?? '')
    setOrigem(ultimo.dados.origem ?? '')
    setErro(null)
  }

  const acabamentoEscolhido = acabamentos?.find((a) => a.id === acabamentoId)
  const localEscolhido = locais?.find((l) => l.id === localizacaoId)

  // ID do <datalist> de clientes para o campo cliente/obra
  const datalistId = 'clientes-datalist'

  return (
    <div
      className={cn(
        'mx-auto w-full max-w-lg px-5',
        modelo && 'py-6',
        // Enquanto ainda não escolheu o perfil, a tela vira uma coluna que
        // ocupa a altura disponível de verdade (até a navegação inferior),
        // e a lista de perfis cresce para preencher o resto — sem isso sobra
        // uma faixa vazia embaixo da lista em telas mais altas. Depois de
        // escolher o perfil, a tela volta ao fluxo normal: tem formulário
        // demais para caber numa tela só, e ela precisa rolar.
        //
        // `-mb-[5.5rem]` anula o `pb-[5.5rem]` que o `main` reserva para a
        // barra de navegação (ver o comentário em `PaginaLista.tsx` sobre
        // de onde vêm esses 5,5rem): aqui a altura já é medida até ela, e
        // somar os dois empurrava conteúdo para fora da tela — a página
        // rolava numa tela que não deveria rolar, e a lista perdia
        // justamente o espaço do último item. `py-4` no lugar de `py-6`
        // devolve o respiro que faltaria para sete linhas inteiras caberem.
        !modelo &&
          '-mb-[5.5rem] flex h-[calc(100dvh-5.5rem)] flex-col py-4 md:mb-0 md:h-auto md:py-6',
      )}
    >
      <header className="mb-6 flex shrink-0 items-center gap-3">
        <PackagePlus aria-hidden="true" className="text-acao-600 size-7" />
        <h1 className="text-2xl font-bold">Cadastrar estoque</h1>
      </header>

      {ultimo && (
        <div
          role="status"
          className="bg-aluminio-100 text-grafite-800 mb-5 flex items-center gap-3 rounded-xl p-4"
        >
          <CheckCircle2 aria-hidden="true" className="size-5 shrink-0" />
          <p className="flex-1 text-sm">
            <strong>{ultimo.codigoGerado}</strong> cadastrado —{' '}
            {formatarComprimento(ultimo.dados.comprimento_mm)}
            {ultimo.dados.quantidade > 1 && ` × ${ultimo.dados.quantidade}`}
          </p>
          <button
            type="button"
            onClick={repetirUltimo}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium underline-offset-2 hover:underline"
          >
            <Copy aria-hidden="true" className="size-4" />
            Repetir
          </button>
        </div>
      )}

      <div className={cn('flex flex-col gap-6', !modelo && 'min-h-0 flex-1')}>
        {/* 1 — Perfil */}
        <section className={cn(!modelo && 'flex min-h-0 flex-1 flex-col')}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="font-semibold">1. Qual perfil?</h2>
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
          <>
            {/* 2 — Acabamento */}
            <section>
              <h2 className="mb-2 font-semibold">2. Qual cor ou acabamento?</h2>
              <CampoSelecao
                rotulo="Acabamento"
                value={acabamentoId}
                onChange={(e) => setAcabamentoId(e.target.value)}
              >
                <option value="">Selecione…</option>
                {acabamentos?.map((acabamento) => (
                  <option key={acabamento.id} value={acabamento.id}>
                    {acabamento.nome}
                    {acabamento.codigo_ral && ` (${acabamento.codigo_ral})`}
                  </option>
                ))}
              </CampoSelecao>

              {/* A cor do que foi escolhido. Fica FORA do seletor porque
                  `<option>` não aceita fundo colorido de forma confiável
                  entre navegadores — e no iPhone o menu é desenhado pelo
                  próprio sistema, que ignora qualquer estilo. */}
              {acabamentoEscolhido && (
                <p className="text-texto-suave mt-2 flex items-center gap-2 text-sm">
                  <PontoCor cor={acabamentoEscolhido.cor_hex} />
                  {acabamentoEscolhido.nome}
                  {acabamentoEscolhido.codigo_ral &&
                    ` · ${acabamentoEscolhido.codigo_ral}`}
                </p>
              )}
            </section>

            {/* 3 — Medida */}
            <section>
              <h2 className="mb-2 font-semibold">3. Quanto mede?</h2>
              <CampoMedida
                rotulo="Comprimento da peça"
                // A barra do perfil escolhido é o teto: não existe material
                // maior do que a peça de onde ela saiu.
                maximoMm={modelo.comprimento_barra_mm}
                texto={textoMedida}
                unidade={unidade}
                aoMudarTexto={setTextoMedida}
                aoMudarUnidade={setUnidade}
              />
            </section>

            {/* 4 — Quantidade */}
            <section>
              <h2 className="mb-2 font-semibold">4. Quantas peças iguais?</h2>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setQuantidade((q) => Math.max(1, q - 1))}
                  aria-label="Diminuir quantidade"
                  className="border-destaque-borda bg-destaque text-destaque-texto hover:bg-destaque-hover min-h-16 w-16 shrink-0 rounded-xl border-2 text-2xl font-bold"
                >
                  −
                </button>
                <input
                  type="text"
                  inputMode="numeric"
                  value={quantidade}
                  onChange={(e) => {
                    const n = Number(e.target.value.replace(/\D/g, ''))
                    setQuantidade(Number.isFinite(n) && n >= 1 ? n : 1)
                  }}
                  aria-label="Quantidade"
                  className="border-borda bg-superficie min-h-16 min-w-0 flex-1 rounded-xl border-2 text-center text-2xl font-semibold tabular-nums"
                />
                <button
                  type="button"
                  onClick={() => setQuantidade((q) => Math.min(9999, q + 1))}
                  aria-label="Aumentar quantidade"
                  className="border-destaque-borda bg-destaque text-destaque-texto hover:bg-destaque-hover min-h-16 w-16 shrink-0 rounded-xl border-2 text-2xl font-bold"
                >
                  +
                </button>
              </div>
            </section>

            {/* 5 — Tipo de material */}
            <section>
              <h2 className="mb-2 font-semibold">5. Tipo de material</h2>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  id="tipo-sobra"
                  onClick={() => {
                    setTipoMaterial('sobra')
                    // Restaura estado padrão quando volta para sobra
                    if (estadoManual === 'novo_embalado') {
                      setEstadoManual('bom')
                    }
                  }}
                  aria-pressed={tipoMaterial === 'sobra'}
                  className={cn(
                    'flex min-h-20 flex-col items-center justify-center gap-0.5 rounded-xl border-2 pt-2 font-semibold transition-colors',
                    tipoMaterial === 'sobra'
                      ? 'border-acao-600 bg-acao-600 text-white'
                      : 'border-borda bg-superficie text-texto hover:bg-superficie-2',
                  )}
                >
                  <Scissors aria-hidden="true" className="size-6" />
                  <span>SOBRA</span>
                  <span
                    className={cn(
                      'mt-0.5 text-[0.65rem] leading-tight font-normal',
                      tipoMaterial === 'sobra'
                        ? 'text-white/75'
                        : 'text-texto-suave',
                    )}
                  >
                    saiu de um corte/obra
                  </span>
                </button>

                <button
                  type="button"
                  id="tipo-novo"
                  onClick={() => {
                    setTipoMaterial('novo')
                    // Quando novo, condição visual vira novo_embalado automaticamente
                  }}
                  aria-pressed={tipoMaterial === 'novo'}
                  className={cn(
                    'flex min-h-20 flex-col items-center justify-center gap-0.5 rounded-xl border-2 pt-2 font-semibold transition-colors',
                    tipoMaterial === 'novo'
                      ? 'border-economia-600 bg-economia-600 text-white'
                      : 'border-borda bg-superficie text-texto hover:bg-superficie-2',
                  )}
                >
                  <Package aria-hidden="true" className="size-6" />
                  <span>NOVO</span>
                  <span
                    className={cn(
                      'mt-0.5 text-[0.65rem] leading-tight font-normal',
                      tipoMaterial === 'novo'
                        ? 'text-white/75'
                        : 'text-texto-suave',
                    )}
                  >
                    direto do fornecedor
                  </span>
                </button>
              </div>

              {/* Quando é novo, exibe o estado fixado como informação */}
              {tipoMaterial === 'novo' && (
                <p className="text-economia-700 bg-economia-50 mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium">
                  <CheckCircle2
                    aria-hidden="true"
                    className="size-4 shrink-0"
                  />
                  Condição visual definida automaticamente como{' '}
                  <strong>Novo/Embalado</strong>
                </p>
              )}
            </section>

            {/* 6 — Estado de conservação (somente para sobras) */}
            {tipoMaterial === 'sobra' && (
              <section>
                <h2 className="mb-2 font-semibold">6. Estado da peça</h2>
                <CampoSelecao
                  rotulo="Condição visual"
                  value={estadoManual}
                  onChange={(e) =>
                    setEstadoManual(e.target.value as EstadoConservacao)
                  }
                >
                  <option value="novo_embalado">Novo/Embalado</option>
                  <option value="excelente">Excelente</option>
                  <option value="bom">Bom</option>
                  <option value="pequenos_arranhoes">Pequenos arranhões</option>
                  <option value="muito_avariado">Muito avariado</option>
                </CampoSelecao>
              </section>
            )}

            {/* 7 — Localização */}
            <section>
              <h2 className="mb-2 font-semibold">
                {tipoMaterial === 'sobra' ? '7' : '6'}. Onde vai guardar?
              </h2>
              <CampoSelecao
                rotulo="Localização"
                value={localizacaoId}
                onChange={(e) => setLocalizacaoId(e.target.value)}
              >
                <option value="">Sem localização definida</option>
                {locais?.map((local) => (
                  <option key={local.id} value={local.id}>
                    {local.codigo} — {descreverLocalizacao(local)}
                  </option>
                ))}
              </CampoSelecao>
            </section>

            {/* 8 — Cliente / Obra */}
            <section>
              <h2 className="mb-2 font-semibold">
                {tipoMaterial === 'sobra' ? '8' : '7'}. Cliente / Obra{' '}
                <span className="text-texto-suave font-normal">(opcional)</span>
              </h2>
              <div className="relative">
                <input
                  type="text"
                  id="campo-cliente-obra"
                  list={datalistId}
                  value={clienteObra}
                  onChange={(e) => setClienteObra(e.target.value)}
                  placeholder="Nome do cliente ou da obra…"
                  autoComplete="off"
                  className="border-borda bg-superficie focus:border-acao-500 focus:ring-acao-500 w-full rounded-xl border-2 px-4 py-3 outline-none focus:ring-1"
                />
                <datalist id={datalistId}>
                  {clientes?.map((c) => (
                    <option key={c.id} value={c.nome}>
                      {c.nome_fantasia
                        ? `${c.nome} (${c.nome_fantasia})`
                        : c.nome}
                    </option>
                  ))}
                </datalist>
              </div>
              <p className="text-texto-suave mt-1.5 text-xs">
                Digite para buscar na lista de clientes ou escreva livremente.
              </p>
            </section>

            {/* 9 — Observação */}
            <section>
              <h2 className="mb-2 font-semibold">
                {tipoMaterial === 'sobra' ? '9' : '8'}. Observação{' '}
                <span className="text-texto-suave font-normal">(opcional)</span>
              </h2>
              <textarea
                id="campo-observacao"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Anotações sobre esta peça, condição específica, referência interna…"
                rows={3}
                className="border-borda bg-superficie focus:border-acao-500 focus:ring-acao-500 w-full resize-none rounded-xl border-2 px-4 py-3 text-sm outline-none focus:ring-1"
              />
            </section>

            {/* 10 — Foto, opcional */}
            <section>
              <h2 className="mb-2 font-semibold">
                {tipoMaterial === 'sobra' ? '10' : '9'}. Foto da peça{' '}
                <span className="text-texto-suave font-normal">(opcional)</span>
              </h2>
              <CampoFoto
                ajuda="Ajuda a reconhecer a peça na prateleira e a conferir o estado."
                aoEnviar={enviarFotoSobra}
                caminho={fotoCaminho}
                previa={fotoPrevia}
                aoRemover={() => {
                  setFotoCaminho(null)
                  setFotoPrevia(null)
                }}
                aoConcluir={(c) => void fotoEnviada(c)}
              />
            </section>

            {/* Resumo: última chance de ver a vírgula no lugar errado */}
            {prontoParaSalvar && (
              <section
                aria-label="Resumo do cadastro"
                className="border-acao-300 bg-acao-50 rounded-xl border-2 p-4"
              >
                <h2 className="text-grafite-900 mb-3 font-semibold">
                  Confira antes de salvar
                </h2>
                <dl className="text-grafite-800 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  <dt className="text-grafite-600">Perfil</dt>
                  <dd className="font-medium">
                    {modelo.codigo} — {modelo.descricao}
                  </dd>

                  <dt className="text-grafite-600">Acabamento</dt>
                  <dd className="flex items-center justify-end gap-2 font-medium">
                    <PontoCor cor={acabamentoEscolhido?.cor_hex} />
                    {acabamentoEscolhido?.nome}
                  </dd>

                  <dt className="text-grafite-600">Comprimento</dt>
                  <dd className="text-base font-bold">
                    {formatarComprimento(comprimentoMm)}
                  </dd>

                  <dt className="text-grafite-600">Quantidade</dt>
                  <dd className="font-medium">
                    {quantidade} {quantidade === 1 ? 'peça' : 'peças'}
                  </dd>

                  <dt className="text-grafite-600">Tipo</dt>
                  <dd className="font-medium">
                    {tipoMaterial === 'novo' ? 'Novo' : 'Sobra'}
                  </dd>

                  <dt className="text-grafite-600">Condição</dt>
                  <dd className="font-medium">{ROTULO_ESTADO[estado]}</dd>

                  <dt className="text-grafite-600">Local</dt>
                  <dd className="font-medium">
                    {localEscolhido
                      ? descreverLocalizacao(localEscolhido)
                      : 'não definido'}
                  </dd>

                  {clienteObra.trim() && (
                    <>
                      <dt className="text-grafite-600">Cliente/Obra</dt>
                      <dd className="font-medium">{clienteObra.trim()}</dd>
                    </>
                  )}

                  {observacoes.trim() && (
                    <>
                      <dt className="text-grafite-600">Observação</dt>
                      <dd className="font-medium">{observacoes.trim()}</dd>
                    </>
                  )}
                </dl>
              </section>
            )}

            {/* Já existe lote igual: avisa e oferece somar. O aviso NÃO
                bloqueia — há motivo legítimo para manter separado, como uma
                remessa com defeito que vai voltar para o fornecedor. Quem
                decide é quem está com as peças na mão. */}
            {prontoParaSalvar && jaExiste && (
              <section
                aria-label="Lote igual já cadastrado"
                className="border-atencao-300 bg-atencao-50 rounded-xl border-2 p-4"
              >
                <p className="text-atencao-700 font-semibold">
                  Já existe um lote igual: {jaExiste.codigo}
                </p>
                <p className="text-grafite-800 mt-1 text-sm">
                  Mesmo perfil, mesmo acabamento e mesmo comprimento, com{' '}
                  {jaExiste.quantidade}{' '}
                  {jaExiste.quantidade === 1 ? 'peça' : 'peças'}. Somando, ele
                  passa a ter {jaExiste.quantidade + quantidade}.
                </p>

                <div className="mt-3 flex flex-col gap-2">
                  <Botao
                    tamanho="largura_total"
                    carregando={somar.isPending}
                    onClick={() => void somarAoExistente(true)}
                  >
                    Somar a {jaExiste.codigo} e continuar
                  </Botao>
                  <Botao
                    variante="contorno"
                    tamanho="largura_total"
                    carregando={somar.isPending}
                    onClick={() => void somarAoExistente(false)}
                  >
                    Somar a {jaExiste.codigo} e encerrar
                  </Botao>
                </div>
              </section>
            )}

            {erro && (
              <p
                role="alert"
                className="bg-erro-50 text-erro-700 rounded-xl px-4 py-3"
              >
                {erro}
              </p>
            )}

            <div className="flex flex-col gap-3">
              <Botao
                tamanho="largura_total"
                variante={jaExiste ? 'contorno' : 'primaria'}
                disabled={!prontoParaSalvar}
                carregando={cadastrar.isPending}
                onClick={() => void salvar(true)}
              >
                {jaExiste
                  ? 'Cadastrar separado e continuar'
                  : 'Salvar e cadastrar outra'}
              </Botao>

              <Botao
                variante="contorno"
                tamanho="largura_total"
                disabled={!prontoParaSalvar}
                carregando={cadastrar.isPending}
                onClick={() => void salvar(false)}
              >
                {jaExiste
                  ? 'Cadastrar separado e encerrar'
                  : 'Salvar e encerrar'}
              </Botao>
            </div>

            <p className={cn('text-texto-suave text-center text-sm')}>
              Acabamento e local continuam preenchidos para a próxima peça.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
