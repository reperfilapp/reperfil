import { useState } from 'react'
import { CheckCircle2, PackagePlus } from 'lucide-react'
import {
  useCadastrarLoteAcessorio,
  type DadosNovoLoteAcessorio,
} from '@/dados/acessorios'
import { useModelosAcessorio } from '@/dados/modelosAcessorio'
import { useAcabamentos } from '@/dados/acabamentos'
import { useLocalizacoes, descreverLocalizacao } from '@/dados/localizacoes'
import { PontoCor } from '@/componentes/ui/PontoCor'
import { CampoSelecao } from '@/componentes/ui/CampoSelecao'
import { Botao } from '@/componentes/ui/Botao'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import type { EstadoConservacao } from '@/tipos/banco'

const ROTULO_ESTADO: Record<EstadoConservacao, string> = {
  novo_embalado: 'Novo/Embalado',
  excelente: 'Excelente',
  bom: 'Bom',
  pequenos_arranhoes: 'Pequenos arranhões',
  muito_avariado: 'Muito avariado',
}

export default function CadastrarAcessorio() {
  const cadastrar = useCadastrarLoteAcessorio()
  const { data: modelos } = useModelosAcessorio()
  const { data: acabamentos } = useAcabamentos()
  const { data: locais } = useLocalizacoes()

  const [modeloId, setModeloId] = useState('')
  const [acabamentoId, setAcabamentoId] = useState('')
  const [localizacaoId, setLocalizacaoId] = useState('')
  const [quantidade, setQuantidade] = useState(1)
  const [estado, setEstado] = useState<EstadoConservacao>('novo_embalado')
  const [observacoes, setObservacoes] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [ultimoCodigo, setUltimoCodigo] = useState<string | null>(null)

  const modelo = modelos?.find((m) => m.id === modeloId)
  const acabamentoEscolhido = acabamentos?.find((a) => a.id === acabamentoId)

  const prontoParaSalvar = modeloId !== '' && quantidade >= 1

  async function salvar(continuarCadastrando: boolean) {
    if (modeloId === '') return

    setErro(null)

    const dados: DadosNovoLoteAcessorio = {
      modelo_acessorio_id: modeloId,
      quantidade,
      acabamento_id: acabamentoId === '' ? null : acabamentoId,
      localizacao_id: localizacaoId === '' ? null : localizacaoId,
      estado,
      observacoes: observacoes.trim() === '' ? null : observacoes.trim(),
      foto_url: null,
    }

    try {
      const criado = await cadastrar.mutateAsync(dados)
      setUltimoCodigo(criado.codigo)

      setQuantidade(1)
      setObservacoes('')

      if (!continuarCadastrando) {
        setModeloId('')
        setAcabamentoId('')
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Não foi possível salvar.')
    }
  }

  return (
    <div className="mx-auto w-full max-w-lg px-5 py-6">
      <BotaoVoltar para="/estoque-acessorios" rotulo="Acessórios" className="mb-4" />

      <header className="mb-6 flex items-center gap-3">
        <PackagePlus aria-hidden="true" className="text-acao-600 size-7" />
        <h1 className="text-2xl font-bold">Cadastrar acessório</h1>
      </header>

      {ultimoCodigo && (
        <div
          role="status"
          className="bg-aluminio-100 text-grafite-800 mb-5 flex items-center gap-3 rounded-xl p-4"
        >
          <CheckCircle2 aria-hidden="true" className="size-5 shrink-0" />
          <p className="flex-1 text-sm">
            <strong>{ultimoCodigo}</strong> cadastrado.
          </p>
        </div>
      )}

      <div className="flex flex-col gap-6">
        <section>
          <h2 className="mb-2 font-semibold">1. Qual acessório?</h2>
          <CampoSelecao
            rotulo="Acessório"
            value={modeloId}
            onChange={(e) => setModeloId(e.target.value)}
          >
            <option value="">Selecione…</option>
            {modelos?.map((m) => (
              <option key={m.id} value={m.id}>
                {m.codigo} — {m.descricao}
              </option>
            ))}
          </CampoSelecao>
        </section>

        {modelo && (
          <>
            <section>
              <h2 className="mb-2 font-semibold">
                2. Cor ou acabamento{' '}
                <span className="text-texto-suave font-normal">(opcional)</span>
              </h2>
              <CampoSelecao
                rotulo="Acabamento"
                value={acabamentoId}
                onChange={(e) => setAcabamentoId(e.target.value)}
              >
                <option value="">Sem cor definida</option>
                {acabamentos?.map((acabamento) => (
                  <option key={acabamento.id} value={acabamento.id}>
                    {acabamento.nome}
                    {acabamento.codigo_ral && ` (${acabamento.codigo_ral})`}
                  </option>
                ))}
              </CampoSelecao>

              {acabamentoEscolhido && (
                <p className="text-texto-suave mt-2 flex items-center gap-2 text-sm">
                  <PontoCor cor={acabamentoEscolhido.cor_hex} />
                  {acabamentoEscolhido.nome}
                </p>
              )}
            </section>

            <section>
              <h2 className="mb-2 font-semibold">
                3. Quantas unidades ({modelo.unidade_medida})?
              </h2>
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
                  onClick={() =>
                    setQuantidade((q) => Math.min(9999, q + 1))
                  }
                  aria-label="Aumentar quantidade"
                  className="border-destaque-borda bg-destaque text-destaque-texto hover:bg-destaque-hover min-h-16 w-16 shrink-0 rounded-xl border-2 text-2xl font-bold"
                >
                  +
                </button>
              </div>
            </section>

            <section>
              <h2 className="mb-2 font-semibold">4. Estado</h2>
              <CampoSelecao
                rotulo="Condição"
                value={estado}
                onChange={(e) => setEstado(e.target.value as EstadoConservacao)}
              >
                {Object.entries(ROTULO_ESTADO).map(([valor, rotulo]) => (
                  <option key={valor} value={valor}>
                    {rotulo}
                  </option>
                ))}
              </CampoSelecao>
            </section>

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

            <section>
              <h2 className="mb-2 font-semibold">
                6. Observação{' '}
                <span className="text-texto-suave font-normal">(opcional)</span>
              </h2>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Anotações sobre este lote…"
                rows={3}
                className="border-borda bg-superficie focus:border-acao-500 focus:ring-acao-500 w-full resize-none rounded-xl border-2 px-4 py-3 text-sm outline-none focus:ring-1"
              />
            </section>

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
                Salvar e cadastrar outro
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
          </>
        )}
      </div>
    </div>
  )
}
