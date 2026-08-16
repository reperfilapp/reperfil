import { useParams } from 'react-router-dom'
import { Phone, MessageCircle, Mail, Pencil } from 'lucide-react'
import { useClientes } from '@/dados/clientes'
import { PaginaDetalhe, FichaDados } from '@/componentes/PaginaDetalhe'
import { EstadoConsulta } from '@/componentes/EstadoConsulta'
import { Botao } from '@/componentes/ui/Botao'

/** Só os dígitos, para montar o link do WhatsApp. */
function apenasNumeros(texto: string): string {
  return texto.replace(/\D/g, '')
}

export default function ClienteDetalhe() {
  const { id } = useParams<{ id: string }>()
  const { data: clientes, isPending, error, refetch } = useClientes(true)

  const cliente = clientes?.find((c) => c.id === id)

  if (isPending || error || !cliente) {
    return (
      <div className="mx-auto w-full max-w-2xl px-5 py-6">
        <EstadoConsulta
          carregando={isPending}
          erro={error}
          vazio={!isPending && !cliente}
          mensagemVazio="Cliente não encontrado."
          aoTentarNovamente={() => void refetch()}
        />
      </div>
    )
  }

  const whatsapp = cliente.whatsapp ?? cliente.telefone

  return (
    <PaginaDetalhe
      voltarPara="/clientes"
      rotuloVoltar="Clientes"
      codigo={cliente.codigo}
      titulo={cliente.nome}
      subtitulo={cliente.nome_fantasia}
      selo={
        !cliente.ativo ? (
          <span className="bg-superficie-2 text-texto-suave rounded px-2 py-1 text-xs">
            inativo
          </span>
        ) : null
      }
      /*
       * Contato em um toque. No celular, `tel:` e `https://wa.me` abrem o
       * aplicativo direto — digitar o número à mão a partir da tela é onde
       * se erra um dígito e se liga para a pessoa errada.
       */
      acoes={
        <>
          {cliente.telefone && (
            <a href={`tel:${apenasNumeros(cliente.telefone)}`}>
              <Botao variante="contorno">
                <Phone aria-hidden="true" className="size-4" />
                Ligar
              </Botao>
            </a>
          )}

          {whatsapp && (
            <a
              href={`https://wa.me/55${apenasNumeros(whatsapp)}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Botao variante="contorno">
                <MessageCircle aria-hidden="true" className="size-4" />
                WhatsApp
              </Botao>
            </a>
          )}

          {cliente.email && (
            <a href={`mailto:${cliente.email}`}>
              <Botao variante="contorno">
                <Mail aria-hidden="true" className="size-4" />
                E-mail
              </Botao>
            </a>
          )}
        </>
      }
    >
      <FichaDados
        titulo="Dados"
        linhas={[
          { rotulo: 'Nome ou razão social', valor: cliente.nome },
          { rotulo: 'Nome fantasia', valor: cliente.nome_fantasia },
          { rotulo: 'CPF ou CNPJ', valor: cliente.cpf_cnpj },
          { rotulo: 'Contato principal', valor: cliente.contato_principal },
        ]}
      />

      <FichaDados
        titulo="Contato"
        linhas={[
          { rotulo: 'Telefone', valor: cliente.telefone },
          { rotulo: 'WhatsApp', valor: cliente.whatsapp },
          { rotulo: 'E-mail', valor: cliente.email },
          {
            rotulo: 'Cidade',
            valor: cliente.cidade
              ? `${cliente.cidade}${cliente.estado ? ` — ${cliente.estado}` : ''}`
              : null,
          },
        ]}
      />

      {cliente.observacoes && (
        <FichaDados
          titulo="Observações"
          linhas={[{ rotulo: 'Anotações', valor: cliente.observacoes }]}
        />
      )}

      <p className="text-texto-suave bg-superficie-2 rounded-xl p-4 text-sm">
        Os orçamentos deste cliente aparecerão aqui na Fase 3.
      </p>

      <a href="/clientes" className="text-acao-600 text-sm hover:underline">
        <span className="inline-flex items-center gap-1">
          <Pencil aria-hidden="true" className="size-3.5" />
          Editar na lista de clientes
        </span>
      </a>
    </PaginaDetalhe>
  )
}
