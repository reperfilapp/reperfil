import { useState } from 'react'
import { CheckCircle2, Copy, PackagePlus } from 'lucide-react'
import { useCadastrarSobra, type DadosNovaSobra } from '@/dados/sobras'
import { useAcabamentos } from '@/dados/acabamentos'
import { useLocalizacoes, descreverLocalizacao } from '@/dados/localizacoes'
import { SeletorPerfil } from '@/componentes/SeletorPerfil'
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
 * Cadastro rápido de sobras — a função mais usada do sistema.
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

export default function CadastrarSobra() {
  const cadastrar = useCadastrarSobra()
  const { data: acabamentos } = useAcabamentos()
  const { data: locais } = useLocalizacoes()

  const [modelo, setModelo] = useState<ModeloPerfil | null>(null)
  const [acabamentoId, setAcabamentoId] = useState('')
  const [localizacaoId, setLocalizacaoId] = useState('')
  // O texto digitado é a fonte de verdade; o valor em milímetros é derivado
  // dele. Guardar os dois separados foi o que causou o campo mostrar erro
  // sobre um número válido depois de salvar.
  const [textoMedida, setTextoMedida] = useState('')
  const [unidade, setUnidade] = useState<UnidadeMedida>('mm')
  const comprimentoMm = interpretarMedidaDigitada(textoMedida, unidade)
  const [quantidade, setQuantidade] = useState(1)
  const [estado, setEstado] = useState<EstadoConservacao>('bom')
  const [origem, setOrigem] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ultimo, setUltimo] = useState<UltimoLancamento | null>(null)
  const [fotoCaminho, setFotoCaminho] = useState<string | null>(null)
  const [fotoPrevia, setFotoPrevia] = useState<string | null>(null)

  async function fotoEnviada(caminho: string) {
    setFotoCaminho(caminho)
    setFotoPrevia(await obterLinkTemporario(BALDE_FOTOS, caminho))
  }

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
      observacoes: null,
      foto_url: fotoCaminho,
    }

    try {
      const criado = await cadastrar.mutateAsync(dados)

      setUltimo({ modelo, dados, codigoGerado: criado.codigo })

      if (continuarCadastrando) {
        // Mantém acabamento, localização, estado e origem: quem lança as
        // sobras de uma obra repete esses campos peça após peça.
        setTextoMedida('')
        setQuantidade(1)
        // A foto é da peça, não do lote: nunca deve ser reaproveitada.
        setFotoCaminho(null)
        setFotoPrevia(null)
      } else {
        setModelo(null)
        setTextoMedida('')
        setQuantidade(1)
        setFotoCaminho(null)
        setFotoPrevia(null)
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.')
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
    setEstado(ultimo.dados.estado)
    setOrigem(ultimo.dados.origem ?? '')
    setErro(null)
  }

  const acabamentoEscolhido = acabamentos?.find((a) => a.id === acabamentoId)
  const localEscolhido = locais?.find((l) => l.id === localizacaoId)

  return (
    <div
      className={cn(
        'mx-auto w-full max-w-lg px-5 py-6',
        // Enquanto ainda não escolheu o perfil, a tela vira uma coluna que
        // ocupa a altura disponível de verdade (até a navegação inferior),
        // e a lista de perfis cresce para preencher o resto — sem isso sobra
        // uma faixa vazia embaixo da lista em telas mais altas. Depois de
        // escolher o perfil, a tela volta ao fluxo normal: tem formulário
        // demais para caber numa tela só, e ela precisa rolar.
        !modelo && 'flex h-[calc(100dvh-6rem)] flex-col md:h-auto',
      )}
    >
      <header className="mb-6 flex shrink-0 items-center gap-3">
        <PackagePlus aria-hidden="true" className="text-acao-600 size-7" />
        <h1 className="text-2xl font-bold">Cadastrar sobra</h1>
      </header>

      {ultimo && (
        <div
          role="status"
          className="bg-economia-50 text-economia-700 mb-5 flex items-center gap-3 rounded-xl p-4"
        >
          <CheckCircle2 aria-hidden="true" className="size-5 shrink-0" />
          <p className="flex-1 text-sm">
            <strong>{ultimo.codigoGerado}</strong> cadastrada —{' '}
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
            </section>

            {/* 3 — Medida */}
            <section>
              <h2 className="mb-2 font-semibold">3. Quanto mede?</h2>
              <CampoMedida
                rotulo="Comprimento da peça"
                // A barra do perfil escolhido é o teto: não existe sobra
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

            {/* 5 — Localização */}
            <section>
              <h2 className="mb-2 font-semibold">5. Onde vai guardar?</h2>
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

            {/* 6 — Foto, opcional */}
            <section>
              <h2 className="mb-2 font-semibold">
                6. Foto da peça{' '}
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
                  <dd className="font-medium">{acabamentoEscolhido?.nome}</dd>

                  <dt className="text-grafite-600">Comprimento</dt>
                  <dd className="text-base font-bold">
                    {formatarComprimento(comprimentoMm)}
                  </dd>

                  <dt className="text-grafite-600">Quantidade</dt>
                  <dd className="font-medium">
                    {quantidade} {quantidade === 1 ? 'peça' : 'peças'}
                  </dd>

                  <dt className="text-grafite-600">Local</dt>
                  <dd className="font-medium">
                    {localEscolhido
                      ? descreverLocalizacao(localEscolhido)
                      : 'não definido'}
                  </dd>
                </dl>
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
                disabled={!prontoParaSalvar}
                carregando={cadastrar.isPending}
                onClick={() => void salvar(true)}
              >
                Salvar e cadastrar outra
              </Botao>

              <Botao
                variante="contorno"
                tamanho="largura_total"
                disabled={!prontoParaSalvar}
                carregando={cadastrar.isPending}
                onClick={() => void salvar(false)}
              >
                Salvar e encerrar
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
