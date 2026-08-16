# Publicar na Google Play Store

> **O aplicativo NÃO está publicado.** Este documento é o caminho para
> publicá-lo. Nenhuma conta de desenvolvedor foi criada, nenhuma chave de
> assinatura foi gerada, e nada foi enviado à Google.

## O que já está pronto

O projeto Android existe em `android/`, configurado e **compilando**.
Verificado em 15/08/2026:

| Item | Valor |
| --- | --- |
| Identificador do pacote | `br.com.reperfil.app` |
| Nome exibido | RePerfil |
| Versão | 0.8.0 (versionCode 800) |
| SDK mínimo | 24 (Android 7.0) |
| SDK alvo | 36 (Android 16) |
| Permissões | Internet, estado da rede, câmera |
| Ícone adaptativo e tela de abertura | Gerados da logo da empresa |

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

## Passo 1 — Conta de desenvolvedor

Só você pode fazer isto.

1. [play.google.com/console](https://play.google.com/console) com a conta
   **reperfilapp@gmail.com**
2. Taxa única de US$ 25
3. A Google exige verificação de identidade e endereço; para conta de empresa,
   pede também o CNPJ. Pode levar alguns dias

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

Crie `android/keystore.properties` (já está no `.gitignore`):

```properties
storeFile=C:/caminho/seguro/reperfil-release.jks
storePassword=SUA_SENHA
keyAlias=reperfil
keyPassword=SUA_SENHA
```

E acrescente ao `android/app/build.gradle`, dentro do bloco `android { }`:

```gradle
    def propsAssinatura = new Properties()
    def arquivoProps = rootProject.file('keystore.properties')
    if (arquivoProps.exists()) {
        propsAssinatura.load(new FileInputStream(arquivoProps))
    }

    signingConfigs {
        release {
            if (arquivoProps.exists()) {
                storeFile file(propsAssinatura['storeFile'])
                storePassword propsAssinatura['storePassword']
                keyAlias propsAssinatura['keyAlias']
                keyPassword propsAssinatura['keyPassword']
            }
        }
    }
```

E dentro de `buildTypes { release { … } }`:

```gradle
            signingConfig signingConfigs.release
```

> Deixei isto como instrução em vez de já aplicado no projeto de propósito: um
> `build.gradle` que referencia uma configuração de assinatura inexistente
> quebra o build de depuração para quem clonar o repositório.

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

- [ ] **Apagar a conta de teste** `teste@reperfil.invalido`, que é
      administradora e tem senha conhecida — ver decisão D8 em
      `docs/decisoes.md`
- [ ] Confirmar os parâmetros de corte em Mais → Configurações; a espessura da
      serra ainda é valor presumido
- [ ] Remover a organização de demonstração:
      `delete from organizacoes where codigo = 'DEMO';`
- [ ] Publicar a política de privacidade num endereço acessível
- [ ] Testar em teste interno com pelo menos duas pessoas reais
- [ ] Guardar a chave de assinatura em local seguro e com backup

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

A Google exige um endereço público. O aplicativo trata dado pessoal de
terceiros — a tabela `clientes` guarda CPF/CNPJ, endereço e telefone —, então
a política precisa dizer o que é coletado, por quê e por quanto tempo.

Ainda não existe. Quando for redigi-la, ela precisa ser acessível de dentro do
aplicativo também, não só na loja.

## O que este documento NÃO cobre

- Publicação efetiva: depende de conta de desenvolvedor e pagamento
- Chave de assinatura: não foi gerada, de propósito. Chave de produção nunca
  deve ser criada nem guardada por outra pessoa que não o dono do aplicativo
- Capturas de tela e textos da loja: dependem de decisão sua sobre como
  apresentar o produto
