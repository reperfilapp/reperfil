import { useEffect, useState, type FormEvent } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import {
  useConfiguracoes,
  useSalvarConfiguracoes,
  type DadosConfiguracoes,
} from '@/dados/configuracoes'
import { Botao } from '@/componentes/ui/Botao'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { CampoTexto } from '@/componentes/ui/CampoTexto'
import { CampoSelecao } from '@/componentes/ui/CampoSelecao'
import { planejarCorte } from '@/dominio/corte'
import { formatarComprimento } from '@/dominio/medidas'

export default function Configuracoes() {
  const { data: config, isPending } = useConfiguracoes()
  const salvar = useSalvarConfiguracoes()

  const [form, setForm] = useState<DadosConfiguracoes | null>(null)
  const [salvo, setSalvo] = useState(false)

  useEffect(() => {
    if (config && form === null) {
      setForm({
        comprimento_barra_padrao_mm: config.comprimento_barra_padrao_mm,
        espessura_serra_mm: config.espessura_serra_mm,
        margem_limpeza_mm: config.margem_limpeza_mm,
        comprimento_minimo_sobra_mm: config.comprimento_minimo_sobra_mm,
        ultimo_corte_gera_perda: config.ultimo_corte_gera_perda,
        prazo_reserva_horas: config.prazo_reserva_horas,
      })
    }
  }, [config, form])

  if (isPending || !form || !config) {
    return <p className="text-texto-suave p-6">Carregando configurações…</p>
  }

  function alterar<C extends keyof DadosConfiguracoes>(
    campo: C,
    valor: DadosConfiguracoes[C],
  ) {
    setSalvo(false)
    setForm((atual) => (atual ? { ...atual, [campo]: valor } : atual))
  }

  async function aoEnviar(evento: FormEvent) {
    evento.preventDefault()
    if (!form || !config) return

    await salvar.mutateAsync({ id: config.id, dados: form, confirmar: true })
    setSalvo(true)
  }

  // Demonstração ao vivo da regra, com os valores que a pessoa está vendo.
  // O caso é o do teste obrigatório da especificação.
  const exemplo = planejarCorte(1800, [1200, 600], {
    espessuraSerraMm: form.espessura_serra_mm,
    margemLimpezaMm: form.margem_limpeza_mm,
    comprimentoMinimoSobraMm: form.comprimento_minimo_sobra_mm,
    ultimoCorteGeraPerda: form.ultimo_corte_gera_perda,
  })

  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8">
      <BotaoVoltar para="/mais" rotulo="Mais" className="mb-4" />

      <header className="mb-6">
        <h1 className="text-2xl font-bold">Configurações do cálculo</h1>
        <p className="text-texto-suave mt-1">
          Estes valores decidem se uma sobra serve ou não para um corte. Errar
          aqui faz o sistema prometer peças que não cabem.
        </p>
      </header>

      {!config.confirmado_pelo_administrador && (
        <div
          role="alert"
          className="bg-atencao-50 text-atencao-700 mb-6 flex gap-3 rounded-xl p-4"
        >
          <AlertTriangle aria-hidden="true" className="size-5 shrink-0" />
          <p className="text-sm">
            <strong>Valores ainda não confirmados.</strong> Os números abaixo
            são presumidos, não medidos na sua oficina. Meça a espessura real do
            disco da serra e defina o menor pedaço que vale a pena guardar,
            depois salve para confirmar.
          </p>
        </div>
      )}

      <form onSubmit={aoEnviar} className="flex flex-col gap-5">
        <CampoTexto
          rotulo="Espessura do disco da serra (mm)"
          type="number"
          inputMode="numeric"
          min={0}
          max={50}
          value={form.espessura_serra_mm}
          onChange={(e) =>
            alterar('espessura_serra_mm', Number(e.target.value))
          }
          ajuda="Quanto de material o disco consome a cada passada. Meça, não estime."
          required
        />

        <CampoTexto
          rotulo="Comprimento mínimo de sobra aproveitável (mm)"
          type="number"
          inputMode="numeric"
          min={0}
          max={6000}
          value={form.comprimento_minimo_sobra_mm}
          onChange={(e) =>
            alterar('comprimento_minimo_sobra_mm', Number(e.target.value))
          }
          ajuda="Abaixo disso o resto vira descarte em vez de voltar à prateleira."
          required
        />

        <CampoTexto
          rotulo="Margem de limpeza da ponta (mm)"
          type="number"
          inputMode="numeric"
          min={0}
          max={500}
          value={form.margem_limpeza_mm}
          onChange={(e) => alterar('margem_limpeza_mm', Number(e.target.value))}
          ajuda="Material descartado na ponta suja, antes do primeiro corte."
          required
        />

        <CampoTexto
          rotulo="Comprimento da barra nova (mm)"
          type="number"
          inputMode="numeric"
          min={1}
          max={18000}
          value={form.comprimento_barra_padrao_mm}
          onChange={(e) =>
            alterar('comprimento_barra_padrao_mm', Number(e.target.value))
          }
          ajuda="Normalmente 6000 mm."
          required
        />

        <CampoTexto
          rotulo="Validade da reserva (horas)"
          type="number"
          inputMode="numeric"
          min={1}
          max={8760}
          value={form.prazo_reserva_horas}
          onChange={(e) =>
            alterar('prazo_reserva_horas', Number(e.target.value))
          }
          ajuda="Depois deste prazo a peça volta sozinha para o estoque."
          required
        />

        <CampoSelecao
          rotulo="Perda de serra no último corte"
          value={form.ultimo_corte_gera_perda ? 'sim' : 'nao'}
          onChange={(e) =>
            alterar('ultimo_corte_gera_perda', e.target.value === 'sim')
          }
        >
          <option value="nao">
            O último corte não gera perda quando termina no fim da peça
          </option>
          <option value="sim">Toda passada de serra gera perda</option>
        </CampoSelecao>

        {/* Mostra a regra funcionando com os valores atuais, para a pessoa
            conferir contra o que ela sabe da própria oficina. */}
        <section className="bg-superficie-2 rounded-xl p-4 text-sm">
          <h2 className="mb-2 font-semibold">Conferindo com um exemplo</h2>
          <p className="text-texto-suave">
            Uma sobra de 1,8 m, cortes de 1.200 mm e 600 mm:
          </p>
          <p className="mt-2">
            precisa de{' '}
            <strong>
              {formatarComprimento(exemplo.comprimentoNecessarioMm)}
            </strong>{' '}
            e{' '}
            {exemplo.cabe ? (
              <strong className="text-economia-700">cabe</strong>
            ) : (
              <strong className="text-erro-600">não cabe</strong>
            )}
            .
          </p>
        </section>

        {salvar.isError && (
          <p
            role="alert"
            className="bg-erro-50 text-erro-700 rounded-xl px-4 py-3"
          >
            {salvar.error.message}
          </p>
        )}

        {salvo && (
          <p
            role="status"
            className="bg-economia-50 text-economia-700 flex items-center gap-2 rounded-xl px-4 py-3"
          >
            <CheckCircle2 aria-hidden="true" className="size-5" />
            Configurações salvas e confirmadas.
          </p>
        )}

        <Botao
          type="submit"
          tamanho="largura_total"
          carregando={salvar.isPending}
        >
          {config.confirmado_pelo_administrador
            ? 'Salvar alterações'
            : 'Salvar e confirmar valores'}
        </Botao>
      </form>
    </div>
  )
}
