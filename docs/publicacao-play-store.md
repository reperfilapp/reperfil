# Publicar na Google Play Store

> **O aplicativo ainda NÃO foi enviado.** Este documento é o caminho.
>
> **Já feito:** conta de desenvolvedor criada e liberada pela Google
> (13/08/2026, verificação aprovada) · organização de demonstração removida
> do banco (28/08/2026) · chave de assinatura gerada, configurada e
> testada (27/08/2026, `.aab` assinado com sucesso) · pacote
> `br.com.reperfil.app` registrado na Verificação de desenvolvedor Android,
> com a impressão digital SHA-256 da chave (27/08/2026) · app criado no
> Play Console, ficha da loja preenchida (textos, ícone, capturas, imagem
> de destaque, vídeo, política de privacidade, segurança dos dados,
> classificação de conteúdo, declarações) e **Teste interno funcionando**
> — versão 10686 (1.6.86) disponível para os 4 testadores cadastrados,
> login por e-mail e por nickname confirmados na versão instalada pelo
> link de teste (27/08/2026).
>
> **Falta:** enviar as mudanças pendentes para revisão da Google (botão
> "Enviar mudanças para revisão" na Visão geral da publicação) e, depois
> de aprovado, avançar para Teste fechado e Produção.
>
> **Atenção ao prazo do teste fechado.** A conta é pessoal e foi criada
> depois de novembro de 2023, então a Google exige **12 testadores por 14
> dias corridos** em teste fechado antes de liberar em produção. Os 14 dias
> só começam a contar quando o teste fechado estiver rodando com os 12 —
> não quando o app foi criado. É o item de maior prazo do processo inteiro,
> e o único que não depende de código: vale começar a juntar os 12 e-mails
> agora, em paralelo com o resto.

## ⚠️ Cuidado ao gerar o `.aab` para a loja

**Nunca gere o pacote de release rodando `bundleRelease`/`assembleRelease`
direto.** Sempre use `npm run android:aab` (ou `npm run android:apk` para
teste local). Só esses comandos rodam `npm run build && cap sync android`
antes de empacotar — sem isso, o Android empacota os arquivos web que já
estavam sincronizados de ANTES, que podem ser de dias atrás.

**Isso já aconteceu uma vez** (27/08/2026): o primeiro `.aab` enviado à
Play Store tinha a versão certa no nome (`1.6.85`, porque isso vem direto
do `package.json` no momento do empacotamento Android), mas o site
empacotado dentro dele era de 22/08 — 5 dias desatualizado. O sintoma foi
enganoso: login por e-mail funcionava (recurso antigo), mas login por
nickname não (recurso adicionado depois de 22/08) — parecia um bug do
código ou da Play Store, e não era nenhum dos dois.

## O que já está pronto

O projeto Android existe em `android/`, configurado, **compilando e
assinado**. Conferido em 28/08/2026:

| Item | Valor |
| --- | --- |
| Identificador do pacote | `br.com.reperfil.app` |
| Nome exibido | RePerfil |
| Nome na loja | RePerfil Sobras e Estoque |
| Versão | vem do `package.json` — o `versionCode` é derivado dela |
| SDK mínimo | 24 (Android 7.0) |
| SDK alvo | 36 (Android 16) — acima do mínimo exigido pela Google |
| Permissões | Internet, estado da rede, câmera |
| Assinatura de release | **Pronta** — `android/keystore.properties` |
| Assinatura de app pela Play | **Ativa** — a Google re-assina com a chave dela |
| Ícone adaptativo e tela de abertura | Gerados da logo da empresa |
| Ícone 512×512 para a loja | `public/icones/icone-512.png` |
| Política de privacidade | **Existe** — `/politica-privacidade`, pública |
| Exclusão de conta pelo app | **Existe** — exigência da Google desde 2024 |
| Categoria na loja | Produtividade |
| Tags | Empresa · Ferramentas · Produtividade |

> A versão não é fixada aqui de propósito: ela sobe a cada `publicarrp`, e
> um número escrito neste documento envelheceria em horas. O valor corrente
> está no `package.json` e na tela do aplicativo (selo de versão).

**A Assinatura de app pela Play está ativa**, e é por isso que o `.aab`
enviado é re-assinado pela Google antes de chegar aos celulares. Efeito
prático: um APK instalado direto por `adb` tem assinatura DIFERENTE do
instalado pela loja, e o Android recusa atualizar um por cima do outro
(`INSTALL_FAILED_UPDATE_INCOMPATIBLE`). Para trocar entre os dois é preciso
desinstalar antes — não é defeito.

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

## ~~Passo 2 — Criar a chave de assinatura~~ ✅ FEITO

Gerada em **27/08/2026**, válida até 2054, alias `reperfil`. A impressão
digital SHA-256 dela está registrada na Verificação de desenvolvedor Android
para o pacote `br.com.reperfil.app`.

**O que continua valendo como cuidado permanente:**

- **Guarde o `.jks` e a senha fora deste computador** — gerenciador de
  senhas, cofre, ou ao menos um backup em nuvem privada. Perder qualquer um
  dos dois é perder os dois.
- A **Assinatura de app pela Play está ativa**, então esta é a chave de
  *envio*: se ela se perder, dá para pedir reposição à Google. Sem esse
  recurso, perder a chave significaria nunca mais publicar atualização
  deste aplicativo.

Para gerar outra um dia (aplicativo novo, ou reposição), o comando é este —
no PowerShell:

```powershell
& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -genkeypair -v -keystore "C:\caminho\seguro\nome.jks" -keyalg RSA -keysize 2048 -validity 10000 -alias reperfil
```

Para conferir a impressão digital de uma chave existente:

```powershell
& "C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -list -v -keystore "C:\caminho\seguro\nome.jks" -alias reperfil
```

## ~~Passo 3 — Configurar a assinatura~~ ✅ FEITO

O `build.gradle` e o `android/keystore.properties` estão prontos desde
27/08/2026, e o `.aab` sai assinado.

Se um dia for preciso refazer isso — outra máquina, ou o arquivo se perder:

1. Copie `android/keystore.properties.exemplo` para
   `android/keystore.properties` (mesma pasta, sem o `.exemplo`)
2. Preencha os quatro campos com o caminho do `.jks` e as senhas

O `build.gradle` detecta o arquivo sozinho e assina o release.

> **Barra normal no caminho, mesmo no Windows.** O arquivo é lido no formato
> `.properties` do Java, onde `\` é caractere de escape e some — foi o que
> derrubou o primeiro build com
> `Keystore file ...C:SoftsAppReperfil_Diversos... not found`.

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

## ~~Passo 5 — Criar o app e a ficha da loja~~ ✅ FEITO

Criado em 27/08/2026 como **RePerfil Sobras e Estoque**, pacote
`br.com.reperfil.app`, português (Brasil), aplicativo gratuito. A ficha está
preenchida: descrições, ícone, capturas, imagem de destaque 1024×500, vídeo,
política de privacidade, segurança dos dados, classificação, público-alvo e
as declarações de ID de publicidade e apps de saúde.

O que foi respondido, para não ter de redescobrir na próxima atualização:

| Pergunta | Resposta | Por quê |
| --- | --- | --- |
| Público-alvo | Só maiores de 18 | É ferramenta de trabalho; marcar faixa de menor traz obrigações extras sem público real |
| Dados coletados | Nome, e-mail, telefone, fotos, endereço, CPF/CNPJ | Declarados como **coletados**, nunca "compartilhados" |
| Compartilhados com terceiros | Não | O provedor de banco é operador, não terceiro que usa os dados |
| Atividade em apps | Nada | Não há analytics nem rastreamento no projeto |
| Mensagens | Nada | O app guarda o *endereço* de e-mail, não lê caixa de entrada |
| ID de publicidade | Não usa | Nenhum SDK de anúncios |
| Apps de saúde | Nada se aplica | — |
| Recursos gerados com IA | Não rotular | A imagem de destaque é composição do logo real, não geração sintética |

## Passo 6 — Enviar a versão

1. `npm run android:aab` (ver o aviso no topo deste documento)
2. Play Console → **Testar e lançar → Teste interno → Criar nova versão**
3. Envie o `.aab` — ou, se o pacote já tiver sido enviado antes, use
   **Adicionar da biblioteca** em vez de subir de novo
4. Avance até **Visualizar e confirmar** e confirme: parar na primeira etapa
   deixa o pacote como "Inativo" e a faixa continua na versão anterior
5. Na **Visão geral da publicação**, envie as mudanças para revisão

O **link de teste é fixo** e não muda a cada versão:
`https://play.google.com/apps/internaltest/4700446141496803400`

> **Aviso de "arquivo de desofuscação ausente" é normal.** Só existiria com
> ofuscação ligada (`minifyEnabled`), que está desligada de propósito. Não
> impede o envio.

### Se o celular instalar uma versão antiga pelo link

Aconteceu em 27/08/2026 e custou horas: o link instalava 1.6.67 enquanto a
loja mostrava 1.6.85 na ficha. A causa NÃO era a Play Store — era o `.aab`
enviado, empacotado sem `cap sync` (ver o aviso no topo). O número da versão
vinha do `package.json` e estava certo; o site dentro do pacote é que era
antigo.

Antes de culpar cache do celular, **confira o selo de versão na tela de
login do app instalado**. Se ele mostrar uma versão antiga com um `.aab`
recém-gerado, o problema é o pacote, não o aparelho.

## Formatos dos arquivos da ficha

Já entregues, mas anotados porque toda atualização de material pede de novo:

- **Capturas de tela:** PNG ou JPEG, **sem transparência**, lado entre 320 e
  3840 px, e o lado maior no máximo o dobro do menor. Print de celular já
  serve. Mínimo 2, máximo 8.
- **Ícone da loja:** 512×512 — `public/icones/icone-512.png`
- **Imagem de destaque:** 1024×500, PNG ou JPEG, até 15 MB
- **Vídeo:** opcional, e só link do YouTube — público ou **não listado**,
  com monetização desligada e sem restrição de idade

Para gravar a tela do celular ligado por USB, sem instalar nada:

```bash
adb shell screenrecord --time-limit 150 --bit-rate 8000000 /sdcard/demo.mp4
```

Depois `adb pull /sdcard/demo.mp4` para trazer o arquivo, e `adb shell rm`
para limpar. No Git Bash é preciso `MSYS_NO_PATHCONV=1` antes do comando —
sem isso ele converte `/sdcard/...` num caminho do Windows e falha.

## Checklist antes de liberar em produção

- [x] ~~Neutralizar a conta de teste~~ — **já está**, verificado em
      28/08/2026: `ativo = false`, e `organizacao_atual()`,
      `e_administrador()` e `pode_movimentar_estoque()` filtram por
      `ativo`. Mesmo com a senha, não lê nem escreve nada — o RLS barra.
      **Não apague essa conta** (ver abaixo)
- [ ] **Confirmar a espessura da serra** em Mais → Configurações. Continua
      sendo valor presumido, e é o parâmetro que decide se "dá para
      fabricar" — errar aqui erra todo cálculo de aproveitamento
- [x] ~~Remover a organização de demonstração~~ — feito em 28/08/2026
- [x] ~~Publicar a política de privacidade num endereço acessível~~ — está em
      `/politica-privacidade`, acessível sem login. **Continua sem revisão
      de advogado** (ver `docs/pendencias.md`): o app trata CPF/CNPJ,
      endereço e telefone de CLIENTES, que são terceiros que nunca usaram
      o aplicativo
- [x] ~~Guardar a chave de assinatura em local seguro e com backup~~ —
      gerada em 27/08/2026, fora da pasta do projeto. **Confira o backup
      fora deste computador**, se ainda não fez: é o único item da lista
      sem conserto possível
- [x] ~~Testar em teste interno~~ — feito em 27/08/2026: instalação pelo
      link, login por e-mail e por nickname
- [ ] **Juntar 12 testadores para o teste fechado** — são 14 dias corridos
      de exigência da Google, e é o item de maior prazo. Começar cedo
- [ ] Enviar as mudanças pendentes para revisão, na Visão geral da
      publicação
- [ ] Rodar um teste real de ponta a ponta na Alumifort depois de cada
      publicação grande: cadastrar sobra, montar lista técnica, calcular
      viabilidade e gerar a lista de materiais

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
