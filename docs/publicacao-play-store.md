# Publicar na Google Play Store

> **O aplicativo ainda NÃO foi enviado.** Este documento é o caminho.
>
> **Já feito:** conta de desenvolvedor criada e liberada pela Google
> (13/08/2026, verificação aprovada) · organização de demonstração removida
> do banco (28/08/2026).
>
> **Falta:** gerar a chave de assinatura, configurá-la, desativar a conta
> de teste, gerar o AAB e enviar.

## O que já está pronto

O projeto Android existe em `android/`, configurado e **compilando**.
Conferido em 28/08/2026:

| Item | Valor |
| --- | --- |
| Identificador do pacote | `br.com.reperfil.app` |
| Nome exibido | RePerfil |
| Versão | vem do `package.json` — hoje 1.6.84 (versionCode 10684) |
| SDK mínimo | 24 (Android 7.0) |
| SDK alvo | 36 (Android 16) — acima do mínimo exigido pela Google |
| Permissões | Internet, estado da rede, câmera |
| Ícone adaptativo e tela de abertura | Gerados da logo da empresa |
| Ícone 512×512 para a loja | `public/icones/icone-512.png` |
| Política de privacidade | **Existe** — `/politica-privacidade`, pública |
| Exclusão de conta pelo app | **Existe** — exigência da Google desde 2024 |

O **APK de depuração** foi compilado com sucesso e está em:

```
android\app\build\outputs\apk\debug\app-debug.apk
```

8,4 MB. Serve para instalar no celular e testar — **não serve para a loja**,
porque é assinado com uma chave de depuração pública.

## Gerar o APK de depuração de novo

Sua máquina já tem tudo: o JDK 21 vem embutido no Android Studio e o SDK está
instalado. O `java -version` do sistema responde 8 porque o PATH aponta para
um JRE antigo — por isso o JDK é indicado no próprio comando.

```bash
npm run android:apk
```

Para instalar no celular ligado por USB, com depuração USB ativada:

```bash
npm run android:instalar
```

## ~~Passo 1 — Conta de desenvolvedor~~ ✅ FEITO

Criada em **13/08/2026** com a conta **reperfilapp@gmail.com**, taxa paga e
verificação de identidade aprovada pela Google.

## Passo 2 — Criar a chave de assinatura

**Este comando gera um arquivo que não pode ser perdido nem versionado.**

A Google identifica o aplicativo por essa chave. Perdê-la significa nunca mais
conseguir publicar uma atualização deste aplicativo — seria preciso criar
outro, com outro identificador, e pedir a todos os usuários que reinstalem.

```bash
"/c/Program Files/Android/Android Studio/jbr/bin/keytool" -genkeypair -v -keystore reperfil-release.jks -keyalg RSA -keysize 2048 -validity 10000 -alias reperfil
```

Ele pergunta uma senha e alguns dados (nome, empresa, cidade, país "BR").

Depois de gerar:

- **Guarde o arquivo `.jks` e a senha em lugar seguro**, fora do computador —
  gerenciador de senhas, cofre, ou pelo menos um backup em nuvem privada
- **Não coloque na pasta do projeto.** O `.gitignore` já bloqueia `*.jks` e
  `*.keystore`, mas o mais seguro é o arquivo nem estar por perto
- Considere ativar a **Assinatura de app pela Play** (*Play App Signing*), em
  que a Google guarda a chave definitiva e você mantém apenas a de envio. Se
  perder a de envio, dá para pedir reposição — sem ela, não

## Passo 3 — Configurar a assinatura

**O `build.gradle` já está pronto** (feito em 28/08/2026). Você só precisa
criar um arquivo:

1. Copie `android/keystore.properties.exemplo` para
   `android/keystore.properties` (mesma pasta, sem o `.exemplo`)
2. Preencha os quatro campos com o caminho do `.jks` e as senhas

Pronto. O `build.gradle` detecta o arquivo sozinho e assina o release.

**Nada quebra sem ele.** A configuração inteira é condicional: sem o
`keystore.properties`, o bloco de assinatura nem é criado, e quem clonar o
repositório sem a chave continua compilando em depuração normalmente. O
preço é que `bundleRelease` sem a chave gera um pacote não assinado — e
para isso não ser descoberto só no envio, o build imprime um aviso em
moldura antes de começar:

```
┌─────────────────────────────────────────────────────────────┐
│  ATENÇÃO: build de release SEM assinatura.                  │
│  Falta o arquivo android/keystore.properties. O pacote vai  │
│  ser gerado, mas a Play Store vai RECUSAR.                  │
└─────────────────────────────────────────────────────────────┘
```

> O `.gitignore` bloqueia `keystore.properties` **e** `*.jks`. Antes
> bloqueava só o `.jks` — o arquivo com as senhas dele passava batido, e
> um bloqueio pela metade não serve para nada. O `.exemplo` continua
> versionado de propósito: é ele que documenta o formato.

## Passo 4 — Gerar o pacote para a loja

A Play Store exige **AAB**, não APK.

```bash
npm run android:aab
```

O arquivo sai em `android\app\build\outputs\bundle\release\app-release.aab`.

## Passo 5 — Enviar

1. Play Console → **Criar app**
   - Nome: **RePerfil: Estoque e Orçamento**
   - Idioma padrão: Português (Brasil)
   - Tipo: Aplicativo · Gratuito
2. Envie o AAB em **Teste interno** primeiro, nunca direto em produção
3. Preencha o que a Google exige antes de liberar:
   - Política de privacidade (endereço público — ver observação abaixo)
   - Classificação indicativa (questionário)
   - Público-alvo e conteúdo
   - Segurança de dados: declarar que coleta e-mail, nome e dados de clientes
   - Capturas de tela: ao menos 2, de celular
   - Ícone 512×512 (use `public/icones/icone-512.png`)
   - Imagem de destaque 1024×500

## Checklist antes de liberar em produção

- [x] ~~Neutralizar a conta de teste~~ — **já está**, verificado em
      28/08/2026: `ativo = false`, e `organizacao_atual()`,
      `e_administrador()` e `pode_movimentar_estoque()` filtram por
      `ativo`. Mesmo com a senha, não lê nem escreve nada — o RLS barra.
      **Não apague essa conta** (ver abaixo)
- [ ] Confirmar os parâmetros de corte em Mais → Configurações; a espessura da
      serra ainda é valor presumido
- [x] ~~Remover a organização de demonstração~~ — feito em 28/08/2026
- [x] ~~Publicar a política de privacidade num endereço acessível~~ — está em
      `/politica-privacidade`, acessível sem login. **Continua sem revisão
      de advogado** (ver `docs/pendencias.md`): o app trata CPF/CNPJ,
      endereço e telefone de CLIENTES, que são terceiros que nunca usaram
      o aplicativo
- [ ] Testar em teste interno com pelo menos duas pessoas reais
- [ ] Guardar a chave de assinatura em local seguro e com backup

## Não apague a conta `teste@reperfil.invalido`

Verificado em 28/08/2026: apesar do nome "Usuário de Teste (apagar
depois)", ela **não é lixo**. Pertence à Alumifort e é a autora de 515
registros reais:

| O que | Quantos |
| --- | --- |
| Registros de auditoria | 209 |
| Movimentações de estoque | 94 |
| Lotes de sobra | 86 |
| Modelos de perfil | 78 |
| Imagens de perfil | 36 |
| Acabamentos, reservas, cliente, localização | 12 |

Apagá-la exigiria apagar tudo isso antes — parte do catálogo e do estoque
da empresa. **O `Delete user` não funcionar é o banco protegendo esses
dados**, não um defeito.

E não é preciso: ela já está com `ativo = false`, e todas as funções de
permissão (`organizacao_atual`, `e_administrador`,
`pode_movimentar_estoque`) filtram por `ativo`. Quem tiver a senha
autentica, mas `organizacao_atual()` devolve nulo e o RLS barra toda
leitura e escrita.

Se um dia quiser mesmo tirá-la de circulação por completo, o caminho é
entrar com ela e usar Mais → Minha conta → excluir a conta: anonimiza os
dados pessoais e libera o e-mail **sem** apagar a linha, preservando o
histórico.

## Por que o "Delete user" do painel não funciona

Sintoma: no painel do Supabase, em Authentication → Users, o botão
**Delete** não faz nada — não apaga e não mostra erro.

**Causa.** Apagar em `auth.users` tenta apagar `perfis_usuario` junto (a
chave é `on delete cascade`). Mas dezesseis tabelas apontam para
`perfis_usuario` em colunas como `criado_por`, e nenhuma delas declara
regra de exclusão — o padrão do Postgres nesse caso é NO ACTION, que se
comporta como RESTRICT. Se a conta criou um registro que seja, o banco
recusa. O painel engole esse erro, e o botão parece morto.

Isso é deliberado, não um defeito: o histórico de estoque diz quem
cadastrou cada peça, e apagar a pessoa deixaria movimentações sem autor.

**Para ver o que está segurando**, rode `supabase/diagnostico-conta-teste.sql`
no SQL Editor — ele só consulta, não altera nada.

**O caminho certo** é o mesmo que o aplicativo oferece a qualquer usuário:
Mais → Minha conta → excluir a conta. Ele apaga os dados pessoais,
desativa o acesso e troca o e-mail de login por um sintético
(`conta-excluida-…@reperfil.local`), liberando o endereço real — sem
quebrar o histórico. Para a conta de teste, isso resolve o risco que
importa: administradora ativa com senha conhecida deixa de existir.

## Sequência de testes da Google

**Teste interno** → até 100 pessoas por e-mail, liberação imediata, sem
revisão. É onde se testa de verdade.

**Teste fechado** → grupo maior, passa por revisão. A Google exige, para
contas pessoais criadas depois de novembro de 2023, um período de teste
fechado com 12 testadores por 14 dias antes de liberar em produção. Conta de
organização não tem essa exigência — vale conferir a regra vigente ao criar a
conta, porque ela mudou algumas vezes.

**Produção** → aberto a todos.

## Sobre a política de privacidade

**Já existe** e está acessível sem login em `/politica-privacidade` — tanto
de dentro do aplicativo (rodapé da tela inicial e em "Sobre") quanto pela
web, que é o endereço a informar à Google.

**Mas continua sem revisão de advogado.** O aplicativo trata dado pessoal
de terceiros: a tabela `clientes` guarda CPF/CNPJ, endereço e telefone de
gente que nunca usou o aplicativo e nunca concordou com nada. Isso não
impede publicar — é exposição sua, não da Google.

No formulário de **Segurança de dados** (Data Safety), o que este
aplicativo coleta:

| Dado | Onde | Observação |
| --- | --- | --- |
| Nome, e-mail, telefone | `perfis_usuario` | do usuário |
| **Foto da pessoa** | `fotos-colaboradores` | a Google trata imagem de pessoa com regras próprias |
| Nome, CPF/CNPJ, endereço, telefone | `clientes` | **de terceiros** |
| Fotos de peças e desenhos | vários baldes | não são dado pessoal |

Declare também que **existe caminho de exclusão de conta pelo aplicativo**
— a Google exige desde 2024, e o RePerfil atende.

## O que este documento NÃO cobre

- Publicação efetiva: depende de conta de desenvolvedor e pagamento
- Chave de assinatura: não foi gerada, de propósito. Chave de produção nunca
  deve ser criada nem guardada por outra pessoa que não o dono do aplicativo
- Capturas de tela e textos da loja: dependem de decisão sua sobre como
  apresentar o produto
