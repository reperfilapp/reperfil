# Colaboradores, cargos e permissões

## O que mudou

Até a versão 1.6.25 não havia tela nenhuma para administrar quem entra no
sistema. Incluir um colaborador exigia abrir o painel do Supabase, criar o
usuário à mão e rodar um SQL — trabalho de quem construiu o sistema, não de
quem toca a serralheria. O resultado previsível era todo mundo entrando com a
mesma conta de administrador.

Agora existe **Mais → Colaboradores**, visível para quem tem a permissão de
gerenciar colaboradores.

## Cargo não é permissão

O cargo diz o que a pessoa faz na serralheria. A permissão diz o que o sistema
deixa ela fazer. Parecem a mesma coisa e não são: o financeiro de uma empresa
cadastra colaborador, o de outra não encosta nisso.

Por isso o cargo é **ponto de partida**, não regra. Ele define o que fica
marcado no momento do convite; dali em diante manda a permissão gravada no
perfil da pessoa. As políticas de segurança no banco perguntam pela permissão,
nunca pelo cargo — é isso que permite liberar uma tarefa para alguém sem
promovê-lo a um cargo que ele não tem na empresa.

### Os cargos e o que cada um já pode ao entrar

| Cargo | Movimenta estoque | Mexe nos cadastros | Gerencia colaboradores |
| --- | :---: | :---: | :---: |
| Serralheiro | | | |
| Auxiliar | ✓ | | |
| Vendedor | | | |
| Financeiro | | | |
| Gerente | ✓ | ✓ | |
| Admin | ✓ | ✓ | ✓ |

Quem não tem nenhuma permissão marcada continua fazendo o essencial: procurar
peça, reservar e confirmar o que usou. Isso não é permissão — é o uso normal do
sistema.

**Trocar o cargo reescreve as permissões** pelo padrão do cargo novo. Quem
promove um auxiliar a gerente espera que ele passe a poder o que um gerente
pode; manter os ajustes antigos deixaria a pessoa num estado que ninguém
escolheu.

O cargo `estoque` é legado do modelo antigo. Some do cadastro, continua válido
no banco e vale como auxiliar.

## Como um colaborador entra

O administrador registra o convite (nome, e-mail, cargo). O **colaborador** cria
a própria conta em **Primeiro acesso**, com o mesmo e-mail.

### Por que não é o administrador quem cria a conta

Criar usuário em `auth.users` exige a chave de administração do projeto. Ela não
pode viajar dentro do aplicativo: extraída de um celular, abre o banco inteiro.
Então o caminho se inverte — o convite é a autorização, e quem digita a senha é
o dono dela.

**Isto não é cadastro aberto.** O gatilho `vincular_convite` recusa qualquer
cadastro sem convite em aberto para aquele e-mail, e a conta nem chega a
existir.

### O convite não envia e-mail

Ninguém é avisado automaticamente. Depois de convidar, a tela mostra o que
dizer ao colega. Enviar e-mail de verdade exigiria a mesma chave de
administração, ou um serviço de envio à parte.

## Passo obrigatório no painel do Supabase

Para o "Primeiro acesso" funcionar, o registro precisa estar **habilitado**:

**Authentication → Sign In / Providers → Email → "Allow new users to sign up"**

Isso parece abrir o sistema para qualquer pessoa, e não abre: o gatilho recusa
quem não tem convite. Sem essa opção ligada, o Supabase barra o cadastro antes
mesmo de o gatilho rodar, e o colaborador convidado não consegue criar a senha.

Se "Confirm email" estiver ligado, o colaborador precisa abrir o e-mail de
confirmação antes de entrar pela primeira vez.

## Migrações

Três, **nesta ordem**. As duas primeiras são separadas de propósito: Postgres
recusa usar um valor de enum recém-criado dentro da mesma transação que o
criou.

1. `20260818100000_cargos_de_colaborador.sql` — os cargos novos.
2. `20260818100100_colaboradores_e_permissoes.sql` — permissões, convites,
   gatilho e políticas.
3. `20260818110000_permissao_de_cadastros.sql` — separa mexer no catálogo de
   movimentar estoque.

Enquanto não forem aplicadas, o aplicativo continua funcionando: as colunas de
permissão chegam ausentes e cada tela cai no padrão do cargo. O que não
funciona é convidar — a tabela de convites ainda não existe.

## Ajustar permissão de uma pessoa

Em **Colaboradores**, o ícone de chave ao lado de cada nome abre as três
permissões com uma caixa cada. Marcar libera na hora; a lista passa a mostrar
"ajustado" em quem foge do padrão do cargo, para que dois colaboradores com o
mesmo cargo e poderes diferentes não passem despercebidos.

Ninguém mexe nas próprias permissões: as caixas ficam desligadas no próprio
perfil. O banco recusaria de qualquer forma, pelo gatilho contra
autopromoção — e uma caixa que volta sozinha ensina a desconfiar da tela.

Procurar peça, reservar e confirmar o que usou não está entre as permissões:
todo colaborador ativo faz isso. Permissão aqui é só o que vai além do uso
normal.

### As três permissões

| Permissão | O que libera |
| --- | --- |
| Movimentar estoque | Cadastrar a peça que chegou, dar baixa, corrigir quantidade. |
| Mexer nos cadastros | Catálogo de perfis, linhas, acabamentos, localizações, clientes. |
| Gerenciar colaboradores | Convidar colega, mudar cargo, ligar e desligar acesso. |

Movimentar estoque e mexer nos cadastros eram a mesma chave até a versão
1.6.27, e são coisas diferentes. Movimentar estoque acontece o dia inteiro no
depósito, e erro ali se conserta com um ajuste. Mexer no catálogo é dizer que o
perfil FA-239 existe e quanto ele pesa: acontece raramente e erro ali contamina
todo orçamento futuro.

Ao separar, **ninguém perdeu acesso**: a migração concede a permissão de
cadastros a todos que já podiam fazer o trabalho. A partir dali o administrador
ajusta quem quiser.
