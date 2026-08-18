import { useEffect, useState, type FormEvent } from 'react'
import { Botao } from '@/componentes/ui/Botao'
import { CampoTexto } from '@/componentes/ui/CampoTexto'
import { CampoFoto } from '@/componentes/ui/CampoFoto'
import {
  enviarFotoProduto,
  enviarDesenhoProduto,
  obterLinkTemporario,
  BALDE_IMAGENS_PRODUTO,
} from '@/lib/armazenamento'
import type { DadosProduto } from '@/dados/produtos'

/** Aceita vírgula e devolve inteiro em mm, ou nulo. */
function inteiroDe(texto: string): number | null {
  const n = Number(texto.replace(',', '.'))

  return texto.trim() !== '' && Number.isFinite(n) && n > 0
    ? Math.round(n)
    : null
}

/**
 * Os campos do produto, usados no cadastro e na edição.
 *
 * Um componente só para os dois lugares porque são o MESMO formulário: quem
 * corrigiu a medida de uma janela espera encontrar os campos que usou para
 * criá-la. Duas cópias divergiriam na primeira mudança — um campo novo
 * entraria no cadastro e faltaria na edição, e ninguém notaria até alguém
 * precisar corrigir justamente aquele campo.
 *
 * A lista técnica NÃO está aqui. Ela vive na tela do produto, onde cada
 * corte é gravado no ato: um produto que ainda não existe não tem onde
 * pendurar cortes, e guardá-los em memória para gravar depois criaria dois
 * caminhos diferentes para a mesma coisa.
 */
export function FormularioProduto({
  form,
  aoMudar,
  aoSalvar,
  aoCancelar,
  salvando,
  erro,
}: {
  form: DadosProduto
  aoMudar: (dados: DadosProduto) => void
  aoSalvar: (evento: FormEvent) => void
  aoCancelar: () => void
  salvando: boolean
  erro: string | null
}) {
  const [previaFoto, setPreviaFoto] = useState<string | null>(null)
  const [previaDesenho, setPreviaDesenho] = useState<string | null>(null)

  // O balde é privado: não existe endereço fixo para a imagem, é preciso
  // pedir um link temporário a cada exibição.
  useEffect(() => {
    if (form.foto_url === null) {
      setPreviaFoto(null)
      return
    }

    void obterLinkTemporario(BALDE_IMAGENS_PRODUTO, form.foto_url).then(
      setPreviaFoto,
    )
  }, [form.foto_url])

  useEffect(() => {
    if (form.desenho_url === null) {
      setPreviaDesenho(null)
      return
    }

    void obterLinkTemporario(BALDE_IMAGENS_PRODUTO, form.desenho_url).then(
      setPreviaDesenho,
    )
  }, [form.desenho_url])

  return (
    <form onSubmit={aoSalvar} className="flex flex-col gap-4" noValidate>
      <CampoTexto
        rotulo="Código"
        value={form.codigo}
        onChange={(e) => aoMudar({ ...form, codigo: e.target.value })}
        ajuda="Curto e único, como JAN-INT-150."
        required
      />

      <CampoTexto
        rotulo="Nome"
        value={form.nome}
        onChange={(e) => aoMudar({ ...form, nome: e.target.value })}
        ajuda="Como se fala na empresa, ex.: Janela integrada 2 folhas."
        required
      />

      <div className="grid grid-cols-2 gap-4">
        <CampoTexto
          rotulo="Largura (mm)"
          inputMode="numeric"
          value={form.largura_mm === null ? '' : String(form.largura_mm)}
          onChange={(e) =>
            aoMudar({ ...form, largura_mm: inteiroDe(e.target.value) })
          }
        />
        <CampoTexto
          rotulo="Altura (mm)"
          inputMode="numeric"
          value={form.altura_mm === null ? '' : String(form.altura_mm)}
          onChange={(e) =>
            aoMudar({ ...form, altura_mm: inteiroDe(e.target.value) })
          }
        />
      </div>

      {/* Medida do produto ACABADO. Os cortes nunca batem com ela — há folga,
          encaixe e sobreposição no meio. */}
      <p className="text-texto-suave -mt-2 text-sm">
        Medida do produto pronto, como o cliente pede. Os cortes ficam na lista
        técnica.
      </p>

      <CampoTexto
        rotulo="Descrição"
        value={form.descricao ?? ''}
        onChange={(e) =>
          aoMudar({ ...form, descricao: e.target.value || null })
        }
      />

      {/* Duas imagens, porque respondem a perguntas diferentes: a foto é o
          que se mostra ao cliente no balcão, o desenho é o que se consulta na
          bancada. Ambas opcionais — não vale travar o cadastro de uma janela
          por falta de retrato dela. */}
      <fieldset className="border-borda rounded-xl border-2 p-4">
        <legend className="px-2 font-medium">Imagens (opcional)</legend>

        <div className="flex flex-col gap-4">
          <CampoFoto
            rotulo="Foto do produto pronto"
            ajuda="Como o cliente vai ver."
            aoEnviar={enviarFotoProduto}
            caminho={form.foto_url}
            previa={previaFoto}
            aoRemover={() => aoMudar({ ...form, foto_url: null })}
            aoConcluir={(foto_url) => aoMudar({ ...form, foto_url })}
          />

          <div className="border-borda border-t pt-4">
            <CampoFoto
              rotulo="Desenho técnico"
              rotuloBotao="Fotografar desenho"
              ajuda="O esquema com as cotas, para quem monta."
              aoEnviar={enviarDesenhoProduto}
              caminho={form.desenho_url}
              previa={previaDesenho}
              aoRemover={() => aoMudar({ ...form, desenho_url: null })}
              aoConcluir={(desenho_url) => aoMudar({ ...form, desenho_url })}
            />
          </div>
        </div>
      </fieldset>

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
          onClick={aoCancelar}
          className="flex-1"
        >
          Cancelar
        </Botao>
        <Botao type="submit" carregando={salvando} className="flex-1">
          Salvar
        </Botao>
      </div>
    </form>
  )
}
