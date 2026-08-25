import { Link } from 'react-router-dom'
import { FileText, TriangleAlert } from 'lucide-react'
import { BotaoVoltar } from '@/componentes/ui/BotaoVoltar'
import { APLICACAO } from '@/config/aplicacao'

const ATUALIZADO_EM = '25 de agosto de 2026'

/**
 * Termos de uso.
 *
 * Rascunho para publicação na Play Store — redigido com apoio de IA como
 * ponto de partida, NÃO revisado por advogado ainda. Ver o aviso no topo da
 * própria página: fica visível para quem publica lembrar de tirar essa
 * pendência antes de valer como termo de verdade.
 */
export default function TermosDeUso() {
  return (
    <div className="mx-auto w-full max-w-2xl px-5 py-8">
      <BotaoVoltar para="/sobre" rotulo="Sobre" className="mb-4" />

      <header className="mb-6 flex items-center gap-3">
        <FileText aria-hidden="true" className="text-acao-600 size-6 shrink-0" />
        <div>
          <h1 className="text-2xl font-bold">Termos de uso</h1>
          <p className="text-texto-suave text-sm">
            Última atualização: {ATUALIZADO_EM}
          </p>
        </div>
      </header>

      <div
        role="alert"
        className="bg-atencao-50 text-atencao-700 mb-6 flex gap-3 rounded-xl p-4 text-sm"
      >
        <TriangleAlert aria-hidden="true" className="size-5 shrink-0" />
        <p>
          <strong>Rascunho, não documento definitivo.</strong> Este texto foi
          escrito com apoio de inteligência artificial como ponto de partida
          e ainda não passou por revisão de um advogado. Revise com um
          profissional antes de considerá-lo válido para publicação.
        </p>
      </div>

      <article className="flex flex-col gap-6 text-sm leading-relaxed">
        <Secao titulo="1. Aceitação">
          <p>
            Estes Termos de Uso regem o acesso e uso do {APLICACAO.nome}{' '}
            ("RePerfil", "aplicativo" ou "sistema"), desenvolvido por Fernando
            S. Carvalho ("desenvolvedor", "nós"). Ao criar uma conta ou usar
            o aplicativo, você e a empresa que você representa ("cliente",
            "você") concordam com estes termos.
          </p>
        </Secao>

        <Secao titulo="2. O que é o RePerfil">
          <p>
            O RePerfil é um sistema de controle de estoque voltado a
            empresas de serralheria de alumínio e esquadrias: controla
            sobras de perfil para reaproveitamento em novos cortes, e
            também o estoque de material novo — perfis e acessórios
            (dobradiças, roldanas, puxadores e afins).
          </p>
        </Secao>

        <Secao titulo="3. Cadastro e conta">
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              O acesso é organizado por empresa ("organização"). Um
              administrador da empresa cliente cria e gerencia os acessos
              dos demais usuários.
            </li>
            <li>
              Você é responsável por manter sua senha em sigilo e por toda
              atividade realizada com sua conta.
            </li>
            <li>
              Os dados informados no cadastro (nome, e-mail, telefone)
              precisam ser verdadeiros.
            </li>
            <li>
              O administrador da empresa é responsável por revogar o acesso
              de quem deixa de fazer parte da equipe.
            </li>
          </ul>
        </Secao>

        <Secao titulo="4. Uso permitido">
          <p>Ao usar o RePerfil, você concorda em não:</p>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              Tentar acessar dados de outra empresa cliente ou contornar as
              permissões de acesso;
            </li>
            <li>
              Usar o sistema para fins ilícitos, fraudulentos ou que violem
              direitos de terceiros;
            </li>
            <li>
              Fazer engenharia reversa, copiar ou revender o software;
            </li>
            <li>
              Sobrecarregar deliberadamente a infraestrutura do serviço.
            </li>
          </ul>
        </Secao>

        <Secao titulo="5. Dados inseridos por você">
          <p>
            Os dados de estoque, cadastros e movimentações que sua empresa
            insere no sistema continuam sendo propriedade dela. O RePerfil
            processa e armazena esses dados para viabilizar o serviço, nos
            termos da nossa{' '}
            <Link
              to="/politica-privacidade"
              className="text-acao-600 hover:underline"
            >
              Política de Privacidade
            </Link>
            .
          </p>
        </Secao>

        <Secao titulo="6. Propriedade intelectual">
          <p>
            O software, sua marca, layout e código-fonte pertencem ao
            desenvolvedor. Estes termos não transferem nenhuma propriedade
            intelectual do sistema para o cliente — apenas o direito de
            usá-lo conforme aqui descrito.
          </p>
        </Secao>

        <Secao titulo="7. Planos e cobrança">
          <p>
            Nesta fase, o uso do RePerfil não tem custo. Se no futuro
            existirem planos pagos, isso será comunicado com antecedência,
            e o uso de recursos pagos dependerá de aceite explícito.
          </p>
        </Secao>

        <Secao titulo="8. Disponibilidade e suporte">
          <p>
            Fazemos o possível para manter o serviço disponível, mas não
            garantimos disponibilidade ininterrupta — manutenções,
            atualizações e problemas de infraestrutura de terceiros
            (provedor de hospedagem, conectividade) podem causar
            indisponibilidade temporária.
          </p>
        </Secao>

        <Secao titulo="9. Limitação de responsabilidade">
          <p>
            O RePerfil é uma ferramenta de apoio à gestão de estoque. A
            decisão final sobre o que cortar, descartar ou comprar é sempre
            de quem opera o sistema. Não nos responsabilizamos por perdas
            decorrentes de erro de cadastro, uso indevido ou decisões
            tomadas com base nas informações do sistema.
          </p>
        </Secao>

        <Secao titulo="10. Encerramento">
          <p>
            Você pode deixar de usar o sistema a qualquer momento. Podemos
            suspender ou encerrar contas que violem estes termos. Ao
            encerrar, seus dados são tratados conforme a Política de
            Privacidade.
          </p>
        </Secao>

        <Secao titulo="11. Alterações destes termos">
          <p>
            Podemos atualizar estes termos conforme o serviço evolui.
            Mudanças relevantes serão comunicadas dentro do aplicativo.
          </p>
        </Secao>

        <Secao titulo="12. Legislação e foro">
          <p>
            Estes termos são regidos pelas leis brasileiras. Fica eleito o
            foro da comarca de Rio Verde, Estado de Goiás, para dirimir
            eventuais controvérsias.
          </p>
        </Secao>

        <Secao titulo="13. Contato">
          <p>
            Dúvidas sobre estes termos: reperfilapp@gmail.com ou WhatsApp
            (64) 98180-8090.
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
