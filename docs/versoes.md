# Histórico de versões

## Como ler o número

O app mostra duas informações na tela de entrada e em **Mais**:

```
versão 0.5.0 · build 20260815.1432
```

**Versão** (`0.5.0`) marca o progresso do projeto e é definida à mão:

| Faixa | Significado |
| --- | --- |
| `0.X.0` | Etapa X da Fase 1 concluída |
| `0.X.Y` | Correção de defeito dentro da etapa X |
| `1.0.0` | Fase 1 completa e aprovada |
| `2.0.0` | Fase 2 — tipologias e desenho paramétrico |
| `3.0.0` | Fase 3 — orçamentos e PDF |
| `4.0.0` | Fase 4 — obras e plano de corte |

**Build** (`20260815.1432`) é a data e hora do build, no formato
AAAAMMDD.HHMM. Cresce sozinho a cada publicação, sem ninguém precisar
lembrar de nada.

## Para que serve na prática

**"O celular do depósito já pegou a correção?"** Compare o número de build no
aparelho com o do computador. Se for menor, o celular está com versão antiga —
feche o app e abra de novo.

**"Qual código exatamente deu esse erro?"** Toque no número da versão: aparece
o hash do commit e um botão para copiar tudo. Isso identifica a linha exata do
código, sem depender de memória.

## Como subir a versão

```bash
npm run versao:correcao   # 0.5.0 → 0.5.1
npm run versao:etapa      # 0.5.1 → 0.6.0
npm run versao:fase       # 0.6.0 → 1.0.0
```

Depois descreva a mudança aqui embaixo e faça o commit. O build sobe sozinho.

---

## 1.0.0 — 15/08/2026

**Fase 1 completa.**

Etapa 8: aplicativo Android via Capacitor.

- Projeto Android configurado: pacote `br.com.reperfil.app`, SDK alvo 36,
  ícone adaptativo e tela de abertura gerados da logo da empresa
- Permissões mínimas: internet, estado da rede e câmera. A câmera é declarada
  como opcional, para o app continuar instalável em aparelho sem ela
- Versão e versionCode vêm do `package.json`, para não existirem dois lugares
  dizendo em que versão o aplicativo está
- **APK de depuração compilado com sucesso**, 8,4 MB
- `docs/publicacao-play-store.md` com o caminho até a loja

Nenhuma chave de assinatura de produção foi gerada, e o aplicativo **não está
publicado** — ambas as coisas dependem da conta de desenvolvedor e devem ficar
com o dono do aplicativo.

## 0.8.0 — 15/08/2026

**Etapa 7: relatórios e PWA.**

- Relatórios de estoque por perfil, acabamento e localização; sobras paradas
  há mais de 90 dias; movimentações e descartes por período
- Exportação em CSV que abre certo no Excel brasileiro: ponto e vírgula como
  separador, vírgula decimal e marca de bytes para os acentos não quebrarem
- PWA instalável, com manifesto, ícones, atalhos e aviso de nova versão
- O service worker guarda só o esqueleto da aplicação; nenhuma resposta do
  Supabase entra em cache, conforme a decisão D3

Lighthouse no build de produção: desempenho 95–97, acessibilidade 100, boas
práticas 100. A primeira medição deu desempenho 72, por causa do logotipo de
614 KB e das bibliotecas de QR carregando sempre. Ver `docs/lighthouse.md`.

O SEO é 66 de propósito: o `robots.txt` bloqueia buscadores, e o Lighthouse
desconta por isso. Subir a nota exigiria expor a tela de entrada em
resultados de pesquisa, o que pioraria o produto.

## 0.7.0 — 15/08/2026

**Etapa 6: pesquisa, reserva e corte.**

- Tela "Procurar sobra": informa perfil, acabamento e comprimento do corte, e
  vê o que serve, com o aproveitamento calculado
- Ordenação por menor sobra, depois localização, depois peça mais antiga
- Reserva, retirada, confirmação de corte e cancelamento com motivo
- Prévia antes de confirmar o corte, mostrando se o resto volta ao estoque ou
  vira descarte

Verificado no banco real: corte de 1.000 mm numa peça de 1.800 gerou a sobra
SB-HEVR de 797 mm, vinculada à peça de origem; corte de 1.850 mm numa de 2.100
lançou os 247 mm restantes como descarte, sem criar sobra fantasma; e a
segunda reserva da mesma peça foi recusada.

Novo componente `EstadoConsulta`: consulta que falha passa a mostrar o erro.
Antes deixava a tela em branco — num sistema de estoque, tela vazia é lida
como "não há nada", que é a conclusão errada mais perigosa.

Corrigido: a consulta de reservas não dizia qual das duas chaves estrangeiras
para `lotes_sobras` usar (o lote reservado e o lote resultante do corte), e o
PostgREST recusava.

## 0.6.0 — 15/08/2026

**Fotos e leitura de QR Code.**

- Foto da peça no cadastro de sobras, pela câmera traseira do celular ou pela
  galeria no computador. Comprimida antes de enviar: no teste, 1.438 KB
  viraram 27 KB
- Galeria de desenhos técnicos por perfil, com legenda por imagem e
  visualizador ampliado para ler as cotas
- Leitura de QR Code na pesquisa de sobras, com saída pelo teclado sempre
  visível
- Etiqueta imprimível com QR e código curto

Armazenamento em baldes privados, isolados por organização. Verificado: acesso
público direto é recusado, link assinado funciona e a pasta de outra empresa
vem vazia.

Corrigido: a consulta que descobre a organização do usuário usava `single()`
sem filtrar por conta. Como o RLS permite enxergar os colegas da mesma
empresa, quebrou assim que a organização ganhou uma segunda conta.

## 0.5.0 — 15/08/2026

**Etapa 5: cadastro rápido de sobras.**

- Fluxo em cinco passos, com busca de perfil por código, descrição ou linha
- Campo de medida com unidades mm, cm e m, mostrando o valor convertido antes
  de gravar — a proteção contra erro de vírgula
- Acabamento e localização permanecem preenchidos entre lançamentos
- Botão para repetir o lançamento anterior
- Painel inicial com peças disponíveis, metros e reservadas
- Lista de sobras com busca

Corrigido: o campo de medida acusava "digite apenas números" sobre um número
válido depois de salvar, porque guardava o texto digitado em paralelo ao valor
do formulário.

## 0.4.0 — 15/08/2026

**Etapa 4: cadastros.**

- Modelos de perfil, cores e acabamentos, localizações e clientes
- Tela de configurações do cálculo, com exemplo ao vivo do "cabe ou não cabe"
- Código de cliente gerado pelo banco
- Organização e autoria preenchidas pelo banco, a partir de quem está
  autenticado

Corrigido: medidas com milímetro quebrado passam a ser exibidas em milímetros
(`1.803 mm`) em vez de metros (`1,803 m`), que se confundem à leitura.

## 0.3.0 — 15/08/2026

**Etapa 3: autenticação e perfis de acesso.**

- Entrada, recuperação e definição de senha
- Papéis de administrador, estoque e serralheiro
- Proteção de rotas e tela para conta ainda não vinculada a uma empresa
- Logotipo da marca e cores aplicadas ao tema

## 0.2.0 — 15/08/2026

**Etapa 2: núcleo de domínio.**

- Conversão entre milímetros, centímetros e metros
- Cálculo de "cabe ou não cabe", com serra e margem de limpeza
- Classificação do resto entre sobra aproveitável e descarte

## 0.1.0 — 15/08/2026

**Etapas 0 e 1: fundação e banco de dados.**

- Estrutura do projeto, tema e documentação
- 14 tabelas com Row Level Security e funções transacionais de reserva
- Isolamento entre empresas verificado com 16 testes
