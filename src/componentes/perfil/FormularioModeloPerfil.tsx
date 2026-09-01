import type { FormEvent } from 'react'
import { Botao } from '@/componentes/ui/Botao'
import { CampoTexto } from '@/componentes/ui/CampoTexto'
import { CampoSugestao } from '@/componentes/ui/CampoSugestao'
import { GaleriaDesenhos } from '@/componentes/GaleriaDesenhos'
import {
  useValoresUsados,
  useModelosPerfil,
  type DadosModeloPerfil,
} from '@/dados/modelosPerfil'
import { perfilComMesmoCodigo, codigosParecidos } from '@/dominio/codigoPerfil'
import type { ModeloPerfil } from '@/tipos/banco'

/**
 * Sugestões iniciais para o campo Aplicação.
 *
 * O campo é texto livre — a nomenclatura varia entre fabricantes e entre
 * empresas, então travar numa lista fechada obrigaria a digitar "outro" toda
 * hora. A `datalist` sugere sem impedir: digitar algo fora da lista continua
 * funcionando normalmente.
 *
 * Esta lista é só o ponto de partida, para quem ainda não cadastrou nada.
 * A partir daí a lista de sugestões passa a crescer sozinha: ver
 * `useAplicacoesUsadas`, que traz o que a própria empresa já digitou. Não há
 * uma tela de administração porque não precisa — usar uma aplicação nova já
 * é o cadastro dela.
 */
const SUGESTOES_INICIAIS = [
  'Lateral da porta',
  'Base da janela',
  'Travessa superior',
  'Travessa inferior',
  'Montante',
  'Marco',
  'Contramarco',
  'Folha móvel',
  'Folha fixa',
  'Batente',
  'Requadro',
  'Soleira',
  'Peitoril',
  'Puxador',
  'Trilho de correr',
  'Perfil de vedação',
] as const

/**
 * Id do `<form>`, para o botão "Salvar" do cabeçalho do modal — fora do
 * formulário — poder submetê-lo mesmo assim (atributo `form` do HTML). Só
 * um destes formulários abre por vez no app inteiro, então uma string fixa
 * não colide.
 */
export const ID_FORMULARIO_MODELO_PERFIL = 'formulario-modelo-perfil'

/**
 * Aceita vírgula: quem digita medida escreve 35,7, não 35.7. Zero e negativo
 * viram nulo — medida de perfil não é nem uma coisa nem outra, e guardar
 * zero faria a identificação por trena procurar um perfil de 0 mm.
 */
function numeroDe(texto: string): number | null {
  const n = Number(texto.replace(',', '.'))

  return texto.trim() !== '' && Number.isFinite(n) && n > 0 ? n : null
}

/** Mostra 35,7 e não 35.7 — o campo é lido por quem escreve com vírgula. */
function textoDe(valor: number | null): string {
  return valor === null ? '' : String(valor).replace('.', ',')
}

/**
 * O formulário do perfil, usado no catálogo e na ficha.
 *
 * Um componente só para os dois lugares porque são o MESMO formulário: quem
 * corrige uma medida pela ficha espera os campos que usou para cadastrar.
 * Duas cópias divergiriam na primeira mudança — um campo novo entraria num
 * lado e faltaria no outro, e ninguém notaria até precisar dele.
 *
 * `modelo` nulo significa cadastro novo. É ele que decide se as galerias de
 * desenho e foto aparecem: elas precisam de um perfil já existente para ter
 * onde pendurar a imagem.
 */
export function FormularioModeloPerfil({
  form,
  aoMudar,
  modelo,
  aoSalvar,
  aoCancelar,
  salvando,
  erro,
}: {
  form: DadosModeloPerfil
  aoMudar: (dados: DadosModeloPerfil) => void
  modelo: ModeloPerfil | null
  aoSalvar: (evento: FormEvent) => void
  aoCancelar: () => void
  salvando: boolean
  erro: string | null
}) {
  /*
   * As sugestões são buscadas AQUI, e não recebidas por prop: são três
   * consultas que existem só por causa destes campos, e passá-las de fora
   * obrigaria cada tela que usa o formulário a saber disso. O cache do React
   * Query evita que abrir de dois lugares consulte duas vezes.
   */
  const { data: linhasUsadas } = useValoresUsados('linha')
  const { data: fabricantesUsados } = useValoresUsados('fabricante')
  const { data: aplicacoesUsadas } = useValoresUsados('aplicacao')

  const sugestoesAplicacao = [
    ...new Set([...SUGESTOES_INICIAIS, ...(aplicacoesUsadas ?? [])]),
  ].sort((a, b) => a.localeCompare(b, 'pt-BR'))

  /*
   * O catálogo inteiro já está em memória para o agrupamento das telas de
   * perfil, então conferir o código não custa ida ao servidor: dá para
   * responder a cada tecla.
   *
   * `true` inclui os inativos: um perfil desativado continua ocupando o
   * código, e deixar cadastrar outro igual criaria dois registros que a
   * busca não distingue.
   */
  const { data: catalogo } = useModelosPerfil(true)

  const duplicado = perfilComMesmoCodigo(
    catalogo ?? [],
    form.codigo,
    modelo?.id,
  )

  const parecidos = codigosParecidos(catalogo ?? [], form.codigo, modelo?.id)

  return (
    <form
      id={ID_FORMULARIO_MODELO_PERFIL}
      onSubmit={aoSalvar}
      className="flex flex-col gap-4"
      noValidate
    >
      <div>
        <CampoTexto
          rotulo="Código interno"
          value={form.codigo}
          onChange={(e) => aoMudar({ ...form, codigo: e.target.value })}
          erro={
            duplicado
              ? `Já existe: ${duplicado.codigo} — ${duplicado.descricao}`
              : undefined
          }
          ajuda="O código que a sua empresa já usa para este perfil."
          required
        />

        {/* Os códigos já usados que começam pelo que foi digitado. Aparecem
            ENQUANTO se digita, e não depois de errar: quem cadastra o
            terceiro perfil da série MN vê os dois existentes antes de
            escolher o número, sem sair da tela para conferir. */}
        {parecidos.length > 0 && (
          <div className="mt-2">
            <p className="text-texto-suave text-sm">Já existem nesta série:</p>
            <ul className="mt-1 flex flex-wrap gap-1.5">
              {parecidos.map((existente) => (
                <li
                  key={existente.id}
                  title={existente.descricao}
                  className="bg-superficie-2 text-texto-suave rounded px-2 py-1 font-mono text-xs"
                >
                  {existente.codigo}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <CampoTexto
        rotulo="Descrição"
        value={form.descricao}
        onChange={(e) => aoMudar({ ...form, descricao: e.target.value })}
        required
      />

      <div className="grid grid-cols-2 gap-4">
        <CampoSugestao
          rotulo="Linha ou sistema"
          valor={form.linha ?? ''}
          aoMudar={(v) => aoMudar({ ...form, linha: v || null })}
          sugestoes={linhasUsadas ?? []}
          ajuda="Escolha uma já usada ou digite uma nova."
        />
        <CampoSugestao
          rotulo="Fabricante"
          valor={form.fabricante ?? ''}
          aoMudar={(v) => aoMudar({ ...form, fabricante: v || null })}
          sugestoes={fabricantesUsados ?? []}
          ajuda="Escolha um já usado ou digite um novo."
        />
      </div>

      <CampoSugestao
        rotulo="Aplicação"
        valor={form.aplicacao ?? ''}
        aoMudar={(v) => aoMudar({ ...form, aplicacao: v || null })}
        sugestoes={sugestoesAplicacao}
        ajuda="Onde este perfil é usado na esquadria: lateral da porta, base da janela, montante…"
      />

      <CampoTexto
        rotulo="Comprimento da barra nova (mm)"
        type="number"
        inputMode="numeric"
        min={1}
        max={18000}
        value={form.comprimento_barra_mm}
        onChange={(e) =>
          aoMudar({
            ...form,
            comprimento_barra_mm: Number(e.target.value),
          })
        }
        ajuda="Normalmente 6000 mm."
        required
      />

      <CampoTexto
        rotulo="Peso por metro em gramas (opcional)"
        type="number"
        inputMode="numeric"
        min={1}
        value={form.peso_por_metro_g ?? ''}
        onChange={(e) =>
          aoMudar({
            ...form,
            peso_por_metro_g: e.target.value ? Number(e.target.value) : null,
          })
        }
        ajuda="Em gramas, número inteiro. Ex.: 1180 para 1,18 kg/m."
      />

      {/* Medidas da seção — as que a trena alcança.
            As duas primeiras chegam calculadas do peso e do desenho, e
            ficam editáveis porque o cálculo erra uns 3 a 5%: quem tiver a
            peça na mão corrige e o valor melhora. As duas últimas são
            cotas internas, que não saem do desenho de jeito nenhum — só
            medindo. Todas opcionais; quanto mais preenchidas, mais fácil
            identificar a ponta depois. */}
      <fieldset className="border-borda rounded-xl border-2 p-4">
        <legend className="px-2 font-medium">Medidas da seção (mm)</legend>

        <div className="grid grid-cols-2 gap-4">
          <CampoTexto
            rotulo="Medida 1"
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={textoDe(form.largura_secao_mm)}
            onChange={(e) =>
              aoMudar({
                ...form,
                largura_secao_mm: numeroDe(e.target.value),
              })
            }
          />
          <CampoTexto
            rotulo="Medida 2"
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={textoDe(form.altura_secao_mm)}
            onChange={(e) =>
              aoMudar({
                ...form,
                altura_secao_mm: numeroDe(e.target.value),
              })
            }
          />
          <CampoTexto
            rotulo="Medida 3"
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={textoDe(form.medida_3_secao_mm)}
            onChange={(e) =>
              aoMudar({
                ...form,
                medida_3_secao_mm: numeroDe(e.target.value),
              })
            }
          />
          <CampoTexto
            rotulo="Medida 4"
            type="text"
            inputMode="decimal"
            placeholder="0"
            value={textoDe(form.medida_4_secao_mm)}
            onChange={(e) =>
              aoMudar({
                ...form,
                medida_4_secao_mm: numeroDe(e.target.value),
              })
            }
          />
        </div>
      </fieldset>

      {/* Desenho e foto no mesmo lugar do resto do cadastro: eram uma
            tela à parte, e ninguém edita "o texto" numa hora e "a imagem"
            noutra — edita o perfil. Só na edição: o perfil precisa existir
            para ter onde pendurar a imagem. */}
      {modelo && (
        <div className="flex flex-col gap-6">
          <GaleriaDesenhos entidade={{ tipo: 'perfil', id: modelo.id }} tipo="imagem" />
          <div className="border-borda border-t pt-6">
            <GaleriaDesenhos entidade={{ tipo: 'perfil', id: modelo.id }} tipo="foto" />
          </div>
        </div>
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
          onClick={aoCancelar}
          className="flex-1"
        >
          Cancelar
        </Botao>
        {/* Barrado aqui, e não só ao salvar: o banco recusa o código
            repetido, mas a mensagem chega depois de a pessoa ter preenchido
            o resto do formulário. */}
        <Botao
          type="submit"
          carregando={salvando}
          disabled={duplicado !== null}
          className="flex-1"
        >
          Salvar
        </Botao>
      </div>
    </form>
  )
}
