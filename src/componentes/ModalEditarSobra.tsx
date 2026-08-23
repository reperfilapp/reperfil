import { useState } from 'react'
import { useEditarSobraLote } from '@/dados/sobras'
import { useAcabamentos } from '@/dados/acabamentos'
import { Modal } from '@/componentes/ui/Modal'
import { Botao } from '@/componentes/ui/Botao'
import { CampoSelecao } from '@/componentes/ui/CampoSelecao'
import { CampoTexto } from '@/componentes/ui/CampoTexto'
import { CampoMedida } from '@/componentes/ui/CampoMedida'
import type { EstadoConservacao } from '@/tipos/banco'
import type { SobraCompleta } from '@/dados/sobras'
import type { UnidadeMedida } from '@/config/aplicacao'
import { interpretarMedidaDigitada } from '@/dominio/medidas'

interface ModalEditarSobraProps {
  sobra: SobraCompleta
  aberto: boolean
  aoFechar: () => void
}

export function ModalEditarSobra({
  sobra,
  aberto,
  aoFechar,
}: ModalEditarSobraProps) {
  const editar = useEditarSobraLote()
  const { data: acabamentos } = useAcabamentos()

  const [textoMedida, setTextoMedida] = useState(
    sobra.comprimento_mm.toString(),
  )
  const [unidade, setUnidade] = useState<UnidadeMedida>('mm')
  const comprimentoMm = interpretarMedidaDigitada(textoMedida, unidade)

  const [quantidade, setQuantidade] = useState(sobra.quantidade)
  const [acabamentoId, setAcabamentoId] = useState(sobra.acabamento_id)
  const [estado, setEstado] = useState<EstadoConservacao>(sobra.estado)
  const [origem, setOrigem] = useState(sobra.origem || '')
  const [justificativa, setJustificativa] = useState('')

  const [erro, setErro] = useState<string | null>(null)

  const quantidadeMudou = quantidade !== sobra.quantidade
  // Só exige justificativa se a quantidade mudar.
  const podeSalvar =
    comprimentoMm !== null &&
    comprimentoMm > 0 &&
    quantidade >= sobra.quantidade_reservada &&
    (!quantidadeMudou || justificativa.trim().length >= 5)

  async function salvar(e: React.FormEvent) {
    e.preventDefault()
    if (!podeSalvar || comprimentoMm === null) return

    setErro(null)

    try {
      await editar.mutateAsync({
        loteId: sobra.id,
        quantidadeAtual: sobra.quantidade,
        novaQuantidade: quantidade,
        acabamentoId,
        comprimentoMm,
        estado,
        origem,
        justificativa,
      })
      aoFechar()
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao salvar alterações.')
    }
  }

  return (
    <Modal aberto={aberto} aoFechar={aoFechar} titulo="Editar material">
      <form onSubmit={(e) => void salvar(e)} className="flex flex-col gap-6">
        <CampoMedida
          rotulo="Comprimento"
          texto={textoMedida}
          unidade={unidade}
          aoMudarTexto={setTextoMedida}
          aoMudarUnidade={setUnidade}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-qtd" className="font-semibold">
            Quantidade
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() =>
                setQuantidade((q: number) =>
                  Math.max(sobra.quantidade_reservada, q - 1),
                )
              }
              className="border-destaque-borda bg-destaque text-destaque-texto hover:bg-destaque-hover min-h-12 w-12 shrink-0 rounded-xl border-2 text-xl font-bold"
            >
              −
            </button>
            <input
              id="edit-qtd"
              type="number"
              min={sobra.quantidade_reservada}
              max="9999"
              value={quantidade}
              onChange={(e) => setQuantidade(Number(e.target.value))}
              className="border-borda bg-superficie min-h-12 min-w-0 flex-1 rounded-xl border-2 px-4 text-center text-xl font-semibold tabular-nums"
            />
            <button
              type="button"
              onClick={() =>
                setQuantidade((q: number) => Math.min(9999, q + 1))
              }
              className="border-destaque-borda bg-destaque text-destaque-texto hover:bg-destaque-hover min-h-12 w-12 shrink-0 rounded-xl border-2 text-xl font-bold"
            >
              +
            </button>
          </div>
          {sobra.quantidade_reservada > 0 && (
            <span className="text-texto-suave text-sm">
              Mínimo permitido: {sobra.quantidade_reservada} (quantidade
              reservada).
            </span>
          )}
        </div>

        <CampoSelecao
          rotulo="Acabamento / Cor"
          value={acabamentoId}
          onChange={(e) => setAcabamentoId(e.target.value)}
        >
          {acabamentos?.map((acabamento) => (
            <option key={acabamento.id} value={acabamento.id}>
              {acabamento.nome}
            </option>
          ))}
        </CampoSelecao>

        <CampoSelecao
          rotulo="Estado da peça"
          value={estado}
          onChange={(e) => setEstado(e.target.value as EstadoConservacao)}
        >
          <option value="excelente">Excelente</option>
          <option value="bom">Bom</option>
          <option value="pequenos_arranhoes">Pequenos arranhões</option>
          <option value="muito_avariado">Muito avariado</option>
        </CampoSelecao>

        <CampoTexto
          rotulo="Origem / Observação"
          value={origem}
          onChange={(e) => setOrigem(e.target.value)}
          placeholder="Ex.: obra do centro, sobrou do portão..."
        />

        {quantidadeMudou && (
          <CampoTexto
            rotulo="Justificativa (obrigatório)"
            value={justificativa}
            onChange={(e) => setJustificativa(e.target.value)}
            placeholder="Motivo da alteração de quantidade..."
          />
        )}

        {erro && (
          <p
            role="alert"
            className="bg-erro-50 text-erro-700 rounded-xl p-4 text-sm"
          >
            {erro}
          </p>
        )}

        <div className="flex gap-3">
          <Botao
            type="button"
            variante="contorno"
            onClick={aoFechar}
            className="flex-1"
          >
            Cancelar
          </Botao>
          <Botao
            type="submit"
            carregando={editar.isPending}
            disabled={!podeSalvar}
            className="flex-1"
          >
            Salvar
          </Botao>
        </div>
      </form>
    </Modal>
  )
}
