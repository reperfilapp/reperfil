# Publicar na Vercel

O projeto já está configurado (`vercel.json`). Falta apenas ligar o
repositório do GitHub à sua conta da Vercel — o que precisa ser feito por
você, porque a publicação precisa sair da conta `re-perfil`, criada com o
e-mail do projeto.

## Passo 1 — Importar o repositório

1. Entre em [vercel.com](https://vercel.com) com a conta **reperfilapp@gmail.com**
2. Clique em **Add New… → Project**
3. Em *Import Git Repository*, encontre **reperfilapp/reperfil**
   - Se o repositório não aparecer, clique em **Adjust GitHub App Permissions**
     e autorize a Vercel a enxergar a conta `reperfilapp`
4. Clique em **Import**

A Vercel detecta Vite sozinha. Não altere os campos de build — o
`vercel.json` já define tudo.

## Passo 2 — Variáveis de ambiente

**Antes de clicar em Deploy**, abra *Environment Variables* e adicione as duas:

| Nome | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://dvwzpdhlfjzriqmdtceu.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | a mesma chave que está no seu `.env` |

Os valores estão no arquivo `.env` da pasta do projeto. Copie de lá.

> Sem essas duas variáveis o build até termina, mas o app abre com erro de
> configuração — ele valida o ambiente na inicialização de propósito, para
> falhar alto em vez de quebrar no meio de um cadastro.

Deixe as três caixas marcadas (Production, Preview, Development).

## Passo 3 — Deploy

Clique em **Deploy** e aguarde. Ao final aparece um endereço parecido com
`https://reperfil.vercel.app`.

## Passo 4 — Liberar o endereço no Supabase

O Supabase só aceita redirecionamento de autenticação para endereços que ele
conhece. Sem isto, o link de recuperação de senha não funciona no site
publicado.

1. No painel do Supabase: **Authentication → URL Configuration**
2. Em **Site URL**, coloque o endereço da Vercel
3. Em **Redirect URLs**, acrescente:
   - `https://SEU-ENDERECO.vercel.app/definir-senha`
   - `http://localhost:5173/definir-senha` (para continuar testando local)

## Depois disso

Cada `git push` para o ramo `main` publica sozinho. Não é preciso repetir
nada disso.

Ramos diferentes de `main` geram endereços de pré-visualização, úteis para
testar algo arriscado sem mexer no que está no ar.

## O que muda com o HTTPS

Coisas que só funcionam no endereço da Vercel, e não pelo IP da rede local:

- **Instalar como aplicativo** no Android ("Adicionar à tela de início")
- **Câmera**, necessária para a leitura de QR Code das sobras (Etapa 6)
- **Service worker** da PWA, que é a Etapa 7

## Segurança

O endereço é público: qualquer pessoa com o link chega à tela de entrada. Os
dados continuam protegidos por autenticação e pelo Row Level Security,
verificado em `supabase/testes/verificar-rls.sql`.

Mas isso torna urgente uma coisa: **apague a conta de teste** antes ou logo
depois de publicar. Ela é administradora e tem senha conhecida.

```sql
delete from auth.users where email = 'teste@reperfil.invalido';
```

Se der erro de chave estrangeira, é porque a conta já gerou movimentações de
estoque — que são imutáveis. Nesse caso, desative em vez de apagar:

```sql
update perfis_usuario set ativo = false
 where email = 'teste@reperfil.invalido';
```
