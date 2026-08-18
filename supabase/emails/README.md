# E-mails do RePerfil

Os e-mails que o Supabase envia (confirmação de cadastro, redefinição de senha)
saem em inglês, sem identidade nenhuma, e a pessoa que recebe é justamente
alguém entrando no sistema pela primeira vez — o pior momento para uma mensagem
que parece golpe.

Estes arquivos substituem os originais.

## Antes de tudo: o Supabase só deixa editar com SMTP próprio

O painel mostra **"Set up custom SMTP to edit templates"** e não deixa salvar
nada. Não é defeito nem permissão faltando: quem envia os e-mails hoje é o
servidor compartilhado do Supabase, e ele manda o texto padrão dele. Para
mandar o SEU texto, o projeto precisa enviar pelo próprio remetente.

Esse mesmo servidor compartilhado tem um limite baixo de mensagens por hora —
suficiente para testar, apertado para cadastrar uma equipe numa tarde.

Há dois caminhos, e eles não competem.

### Caminho curto: desligar a confirmação de e-mail

**Authentication → Sign In / Providers → Email → desligue "Confirm email".**

O colaborador cria a senha e entra na hora, sem e-mail nenhum. Some junto o
link que ia para o endereço errado, e some a espera.

Isto não abre o sistema: quem barra estranho é o convite, não a confirmação.
Sem convite aberto para aquele e-mail, o gatilho recusa o cadastro e a conta
nem chega a existir. A confirmação só provaria que a pessoa é dona da caixa
postal — e quem disse qual é a caixa postal foi o administrador, ao convidar.

O que se perde: se alguém souber o e-mail de um convite pendente e correr na
frente, cria a conta no lugar do colega. É preciso saber o e-mail exato e agir
antes dele. Havendo suspeita, o administrador desliga o acesso e convida de
novo.

**A recuperação de senha continua enviando e-mail**, em inglês e com o limite
do servidor compartilhado. Não dá para desligar isso — e é o motivo de o
caminho longo continuar valendo a pena.

### Caminho longo: SMTP próprio

Habilita os templates abaixo, tira o limite de envio e faz os e-mails saírem
com o endereço da empresa. Serviços com plano gratuito suficiente para uma
serralheria: Resend, Brevo, Mailgun. Depois de configurar em
**Authentication → Emails → SMTP Settings**, os campos de template destravam.

## Como aplicar os templates (depois do SMTP)

Painel do Supabase → **Authentication → Emails → Templates**. Para cada um,
cole o conteúdo do arquivo em "Message body" e ajuste o assunto:

| Template no painel | Arquivo | Assunto sugerido |
| --- | --- | --- |
| Confirm signup | `confirmar-cadastro.html` | Confirme seu acesso ao RePerfil |
| Reset password | `redefinir-senha.html` | Redefinir sua senha do RePerfil |

Salve cada um separadamente.

## O link do e-mail está indo para o lugar errado

Sintoma: a pessoa toca no link pelo celular e cai em `localhost:5173`, um
endereço que só existe na máquina de quem desenvolve.

O Supabase monta o link a partir do **Site URL** do projeto. Se ele estiver
apontando para a máquina de desenvolvimento, todo e-mail sai assim — inclusive
para quem está do outro lado da cidade.

Painel → **Authentication → URL Configuration**:

- **Site URL**: o endereço publicado (o da Vercel), nunca o `localhost`.
- **Redirect URLs**: acrescente todos os endereços de onde alguém pode se
  cadastrar ou redefinir senha:
  - `https://SEU-ENDERECO.vercel.app/entrar`
  - `https://SEU-ENDERECO.vercel.app/definir-senha`
  - `http://localhost:5173/entrar` (para continuar testando local)
  - `http://localhost:5173/definir-senha`

O aplicativo já manda, no cadastro e na recuperação de senha, o endereço de
onde a pessoa está de fato (`window.location.origin`). Mas o Supabase só
respeita isso se o endereço estiver na lista de Redirect URLs — fora dela, ele
ignora e volta a usar o Site URL.

## Sobre o logo

O caminho é `{{ .SiteURL }}/logo-otimizada.png`, e não um endereço fixo:
o Supabase troca a variável pelo Site URL configurado, então a imagem acompanha
sozinha se o endereço mudar. Um endereço fixo aqui quebraria calado, e ninguém
revisa template de e-mail.

O nome "RePerfil" aparece também em texto logo abaixo do logo, de propósito:
boa parte dos programas de e-mail bloqueia imagens até a pessoa liberar, e sem
isso a mensagem chegaria sem se identificar.

## Não dá para testar sem enviar

O Supabase não tem prévia. Para conferir, salve o template e faça um cadastro
de teste com um e-mail seu. Para ver só o visual, abra o arquivo `.html` no
navegador — as variáveis `{{ }}` aparecem como texto cru, o resto é fiel.
