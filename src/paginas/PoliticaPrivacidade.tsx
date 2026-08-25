import { ShieldCheck } from 'lucide-react'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { APLICACAO } from '@/config/aplicacao'

const ATUALIZADO_EM = '25 de agosto de 2026'

/** Política de privacidade. */
export default function PoliticaPrivacidade() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8">
      <BotaoVoltar para="/sobre" rotulo="Sobre" className="mb-4" />

      <header className="mb-6 flex items-center gap-3">
        <ShieldCheck
          aria-hidden="true"
          className="text-acao-600 size-6 shrink-0"
        />
        <div>
          <h1 className="text-2xl font-bold">Política de privacidade</h1>
          <p className="text-texto-suave text-sm">
            Última atualização: {ATUALIZADO_EM}
          </p>
        </div>
      </header>

      <article className="flex flex-col gap-6 text-sm leading-relaxed">
        <Secao titulo="1. Quem somos">
          <p>
            O {APLICACAO.nome} é desenvolvido por Fernando S. Carvalho
            ("desenvolvedor", "nós"), empresa de desenvolvimento de software
            localizada em Rio Verde, GO. Esta política explica quais dados o
            aplicativo coleta, para quê, e quais direitos você tem sobre
            eles.
          </p>
        </Secao>

        <Secao titulo="2. Quem é responsável por cada dado">
          <p>
            O RePerfil é usado por empresas ("organizações") para controlar
            o próprio estoque e equipe. Nessa relação:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>A empresa cliente</strong> é a controladora dos dados
              que ela mesma insere — cadastro dos seus colaboradores,
              estoque, clientes. É ela quem decide o que cadastrar e quem
              tem acesso.
            </li>
            <li>
              <strong>Nós</strong> operamos a infraestrutura que armazena e
              processa esses dados, seguindo as instruções técnicas da
              própria aplicação (isolamento entre empresas, controle de
              acesso por permissão).
            </li>
          </ul>
        </Secao>

        <Secao titulo="3. Quais dados coletamos">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              <strong>Dados de conta:</strong> nome, e-mail, telefone,
              nickname de acesso, foto e, quando aplicável, CPF do
              colaborador.
            </li>
            <li>
              <strong>Dados da empresa:</strong> razão social, CNPJ,
              endereço, logo — informados por quem cadastra a organização.
            </li>
            <li>
              <strong>Dados de operação:</strong> estoque de perfis e
              acessórios, movimentações, cadastros de produtos e clientes,
              histórico de uso.
            </li>
            <li>
              <strong>Dados técnicos:</strong> registros de acesso (data,
              hora) para segurança e auditoria.
            </li>
          </ul>
        </Secao>

        <Secao titulo="4. Para que usamos os dados">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Viabilizar o controle de estoque e as funções do sistema;</li>
            <li>
              Identificar quem realizou cada movimentação de estoque
              (rastreabilidade);
            </li>
            <li>Autenticação e controle de acesso por permissão;</li>
            <li>Suporte técnico, quando solicitado;</li>
            <li>Cumprir obrigações legais.</li>
          </ul>
        </Secao>

        <Secao titulo="5. Compartilhamento com terceiros">
          <p>
            Não vendemos nem compartilhamos seus dados para fins de
            publicidade. Os dados são armazenados em infraestrutura de
            nuvem de terceiro (provedor de banco de dados e hospedagem),
            contratado como operador — ele processa os dados seguindo
            nossas instruções e políticas de segurança, sem acesso
            independente a eles para outros fins.
          </p>
        </Secao>

        <Secao titulo="6. Segurança">
          <p>
            O acesso aos dados é isolado por empresa: um usuário de uma
            organização não enxerga dados de outra. Dentro da empresa, o
            que cada pessoa vê e pode alterar depende da permissão que o
            administrador dela concede. A comunicação entre o aplicativo e
            o servidor é criptografada.
          </p>
        </Secao>

        <Secao titulo="7. Por quanto tempo guardamos os dados">
          <p>
            Os dados são mantidos enquanto a conta da empresa estiver
            ativa. Ao solicitar o encerramento, os dados podem ser
            apagados ou anonimizados, exceto o que a lei exigir manter por
            período determinado (por exemplo, registros fiscais).
          </p>
        </Secao>

        <Secao titulo="8. Seus direitos">
          <p>
            Conforme a Lei Geral de Proteção de Dados (LGPD), você pode
            solicitar:
          </p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>Confirmação de quais dados seus tratamos;</li>
            <li>Acesso e cópia desses dados;</li>
            <li>Correção de dados incompletos ou desatualizados;</li>
            <li>
              Exclusão dos dados, quando não houver obrigação legal de
              retê-los;
            </li>
            <li>Informação sobre com quem os dados são compartilhados.</li>
          </ul>
          <p>
            Editar seus próprios dados (nome, telefone, foto, nickname) e
            excluí-los é self-service: dentro do aplicativo, em Mais → Minha
            conta, com a opção "Excluir minha conta". A exclusão apaga seus
            dados pessoais e desliga seu acesso imediatamente, sem precisar
            pedir a ninguém — só fica bloqueada se você for o único
            administrador ativo da empresa, caso em que é preciso promover
            outra pessoa antes.
          </p>
          <p>
            Para outras solicitações — acesso, correção ou dúvidas que não
            se resolvem por ali — escreva para{' '}
            <a
              href="mailto:reperfilapp@gmail.com"
              className="text-acao-600 hover:underline"
            >
              reperfilapp@gmail.com
            </a>
            .
          </p>
        </Secao>

        <Secao titulo="9. Menores de idade">
          <p>
            O RePerfil é uma ferramenta de uso empresarial (B2B), não
            destinada a menores de idade.
          </p>
        </Secao>

        <Secao titulo="10. Alterações desta política">
          <p>
            Podemos atualizar esta política conforme o serviço evolui.
            Mudanças relevantes serão comunicadas dentro do aplicativo.
          </p>
        </Secao>

        <Secao titulo="11. Contato">
          <p>
            Dúvidas ou solicitações sobre privacidade:
            reperfilapp@gmail.com ou WhatsApp (64) 98180-8090.
          </p>
        </Secao>
      </article>
    </div>
  )
}

function Secao({
  titulo,
  children,
}: {
  titulo: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="mb-2 font-semibold">{titulo}</h2>
      <div className="text-texto flex flex-col gap-2">{children}</div>
    </section>
  )
}
