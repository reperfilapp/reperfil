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

## 1.6.15 — 17/08/2026

**Renomear linha agora sugere as linhas existentes.**

O campo "Nome da linha" da tela de renomeação era texto puro. Para
juntar duas linhas era preciso reproduzir a grafia exata da outra — e
"Linha Gold / 32" não perdoa um espaço a mais. Errar significava criar
uma terceira linha em vez de juntar.

Agora o campo sugere as demais linhas cadastradas: escolher da lista
garante o nome certo, e digitar um nome novo continua funcionando. A
própria linha fica de fora da lista, porque renomeá-la para si mesma não
faria nada.

Junto, um ajuste no campo de sugestões (`CampoSugestao`, usado também no
cadastro de perfil): a lista só filtra depois que a pessoa digita. Antes,
abrir a lista num campo já preenchido mostrava apenas o que se parecia
com o valor atual — exatamente o contrário do que se quer ao abrir a
lista para trocar de valor.

Verificado no navegador: lista abre completa (14 linhas), filtra ao
digitar ("Gold" → "Linha Gold / 32"), e a linha em edição não aparece
entre as opções.

## 1.6.14 — 17/08/2026

**Sugestões que funcionam, catálogo agrupado por linha e tela de linhas.**

**Correção: as sugestões nunca apareciam.** Os campos "Aplicação",
"Linha" e "Fabricante" usavam `<datalist>` para sugerir o que a empresa
já digitou. A lista era montada certa — dava para ver as 17 sugestões no
código da página — mas nunca aparecia na tela. Causa: esses campos ficam
dentro do modal de cadastro, que é um `<dialog>` aberto com
`showModal()`, e o Chromium desenha o menu do datalist ABAIXO da camada
do modal. A setinha aparecia no campo, a lista ficava invisível.

Substituído por um campo próprio (`CampoSugestao`), que desenha a lista
em vez de pedir ao navegador: filtra conforme se digita, navega por
setas, escolhe com Enter ou toque, e tem um botão para abrir a lista
inteira. Continua texto livre — digitar algo novo funciona sempre, que é
como a lista cresce. De quebra, resolve o iPhone, onde o suporte a
datalist é irregular.

Agora os três campos sugerem: linha e fabricante entraram junto com
aplicação, que já era para funcionar desde a 1.6.1.

**Catálogo por linha.** A tela "Modelos de perfil" abria uma lista
corrida com os 82 perfis. Agora abre na lista de linhas (Suprema, Linha
25, Fachada…), cada uma com a contagem de perfis; tocar numa linha lista
os perfis dela, e há um botão "Ver todos os perfis" para quem prefere
tudo de uma vez. A busca continua procurando no catálogo inteiro, esteja
onde estiver — quem digita um código quer achá-lo, não descobrir depois
que a peça existia noutra linha.

**Tela de linhas e sistemas** (em Mais). A importação da planilha trouxe
variações que são a mesma linha escrita diferente: "Fachada" e
"Fachada?", "Lambril" e "Lambril?". A tela nova lista as linhas com a
contagem e permite renomear — e renomear para um nome que já existe
junta as duas, com aviso antes de confirmar. Não há "criar" nem
"excluir" ali de propósito: a linha nasce quando alguém a digita num
perfil e some quando o último perfil deixa de usá-la.

Verificado no navegador: sugestões abrindo, filtrando e aceitando texto
novo; agrupamento, abertura de linha, "ver todos" e busca cruzando
linhas; e o aviso de fusão na tela de linhas.

## 1.6.13 — 17/08/2026

**Zoom de verdade nas imagens, e fim do verde na interface.**

**Zoom.** Tocar no desenho técnico ou na foto já abria a imagem em tela
cheia, mas ela ficava só do tamanho da tela — e a cota de um desenho é
impressa pequena. Quem precisava saber se a medida era 22 ou 27
desistia e ia medir a peça na mão, que é justamente o trabalho que o
desenho existe para evitar.

Agora a imagem ampliada tem zoom até 8×, com as três formas de uso que
fazem sentido em cada aparelho: pinça de dois dedos e arrastar no
celular; roda do mouse e arrastar no computador; e botões de mais,
menos e "ajustar à tela" nos dois — porque com luva a pinça falha, e no
computador nem todo mundo descobre sozinho que a roda funciona ali.
Fecha com Esc, com o X ou tocando no fundo (arrastar a imagem para fora
não fecha mais sem querer).

O visualizador virou um componente único (`VisualizadorImagem`), usado
tanto na ficha do perfil quanto no cartão de perfil escolhido — antes
eram duas cópias do mesmo overlay, cada uma com seu comportamento.

**Verde.** O verde saiu da interface, substituído pelo cinza-alumínio da
marca: o cartão do perfil escolhido, os painéis de "Disponível no
depósito" (perfil, acabamento e localização), as confirmações de
cadastro e reserva, o aviso de configurações salvas e o selo de status
"disponível".

Um cuidado nesse último: "disponível" e "consumida" agora são os dois
cinzas, então ganharam pesos diferentes para não se confundirem de
relance — o disponível com fundo e texto fortes, o consumido apagado,
já que o que saiu do estoque deve sumir da vista, não competir com o
que está na prateleira. Âmbar (reservada) e vermelho (descartada)
continuam como estavam.

Verificado no navegador, nos dois temas e em celular/computador: zoom,
arrasto, pinça, botões, Esc e clique no fundo; e as telas afetadas pela
troca de cor.

## 1.6.12 — 17/08/2026

**Correção: campos de acabamento e localização continuavam estreitos no
iPhone.**

A padronização de altura da versão 1.6.10 funcionou no Android e no
computador, mas não no iPhone: lá os campos de acabamento e localização
continuavam com cerca de 48px, enquanto os vizinhos tinham 64px.

Causa: no iOS o Safari desenha o `<select>` com o controle nativo do
sistema e ignora a altura pedida pelo CSS — por isso o defeito só
aparecia lá. A correção é remover a aparência nativa
(`appearance: none`), o que faz a altura passar a valer nos três
lugares. Em troca, a seta do menu deixa de ser desenhada pelo sistema e
passou a ser desenhada pelo app (o mesmo ícone nos três), garantindo
que fique igual em qualquer aparelho.

Verificado no navegador, nos dois temas: altura de 64px igual à dos
campos vizinhos, largura cheia, seta centralizada, e o menu continua
abrindo e selecionando normalmente. A correção precisa ser conferida no
iPhone depois de publicada — é lá que o defeito aparecia.

## 1.6.11 — 17/08/2026

**Aplicação do perfil aparece na ficha da sobra.**

Na tela de detalhe de uma sobra (estoque → tocar numa peça), a seção
"Dados da peça" não mostrava a aplicação do perfil — o campo criado na
versão 1.6.0, que diz onde aquela peça entra na esquadria.

Não era só falta de exibir: a consulta que carrega a sobra buscava
apenas código, descrição e linha do perfil, então o dado nem chegava na
tela. Corrigido nos dois lugares (lista e detalhe) e exibido logo abaixo
de "Acabamento" — é ali que se procura, com a ponta na mão.

Verificado no navegador com um perfil que tem aplicação preenchida: a
linha aparece com o texto certo; o dado de teste foi revertido ao
valor original depois.

## 1.6.10 — 17/08/2026

**Todos os campos com a mesma altura.**

Os campos de acabamento e localização tinham 48px de altura, enquanto
os campos vizinhos no mesmo formulário (comprimento, quantidade) tinham
64px. Lado a lado, o campo mais baixo parecia secundário — e era um
alvo de toque pior para quem usa luva no depósito.

Padronizados em 64px: `CampoSelecao` (acabamento, localização, tipo,
período de relatório) e `CampoTexto` (todos os formulários de cadastro),
mais o campo de quantidade de "Procurar sobra", que ainda estava em
56px. Agora todo campo do app tem a mesma altura.

Verificado no navegador, em todas as telas afetadas: "Cadastrar sobra"
e "Procurar sobra" (campos alinhados com os de medida) e os
formulários de cadastro em modal (acabamentos, perfis, clientes,
localizações).

## 1.6.9 — 17/08/2026

**Tema claro/escuro à escolha, menu do computador fixo, e busca de
perfil em "Procurar sobra" igual à de "Cadastrar sobra".**

**Tema escolhido pelo usuário.** O app já tinha as duas paletas, mas
seguia obrigatoriamente o tema do sistema. Agora há um seletor em
"Mais" com três opções: Automático (segue o sistema, como era antes),
Claro e Escuro. A escolha fica no aparelho, não na conta — a mesma
pessoa pode preferir escuro no celular do depósito e claro no
computador do escritório. Um trecho curto no `index.html` aplica o tema
antes de a tela aparecer, senão quem escolhe o contrário do sistema
veria a cor errada piscar a cada abertura.

No computador, o menu lateral rolava junto com o conteúdo — numa lista
comprida, ele desaparecia lá em cima e só voltava se a pessoa rolasse de
volta ao topo. Causa: a trava contra rolagem horizontal (`overflow-x:
hidden` em `html`/`body`, da versão 1.6.3) tem um efeito colateral do
CSS — travar só o eixo X força o eixo Y a virar um container de rolagem
próprio, e isso quebra `position: sticky`. Trocado `hidden` por `clip`,
que corta o excesso sem criar esse container — a trava contra rolagem
horizontal continua funcionando, e o menu agora fica fixo (`sticky`) na
tela inteira.

A tela "Sobras" (estoque completo) estava sem o botão de voltar — a
única tela do app nessa situação; as demais já foram revisadas e têm
botão onde faz sentido. Adicionado, voltando para o Início.

A lista de perfis do `SeletorPerfil` (usada em "Cadastrar sobra" e
"Procurar sobra") ganhou uma moldura ao redor da área que rola, para
marcar visualmente onde termina a lista e começa o resto do formulário.

Em "Procurar sobra", o campo de quantidade era só um número solto, sem
moldura — diferente de todos os outros campos da tela. Virou um campo
de verdade, com a mesma borda dos demais, e agora também aceita digitar
o número direto (antes só dava para usar os botões de mais e menos).

Ainda em "Cadastrar sobra": a faixa vazia entre o fim da lista de
perfis e a barra de navegação estava grande demais (55px). O cálculo da
altura descontava 6rem, mas a barra tem 4rem — o resto virava espaço
morto. Ajustado para o desconto certo; sobra o respiro padrão das
outras telas, e cabe mais um perfil na lista.

**Busca de perfil em "Procurar sobra", igual à de "Cadastrar sobra".**

O campo "Perfil" em "Procurar sobra" era um menu comprido (`<select>`),
que obrigava a rolar por todos os perfis cadastrados até achar o
certo — sem desenho, sem foto, só o código e a descrição em texto.

Trocado pelo mesmo `SeletorPerfil` já usado em "Cadastrar sobra": digita
o código ou parte da descrição e a lista filtra na hora, com miniatura
do desenho técnico em cada linha. Ao escolher, aparece o mesmo cartão
de confirmação (desenho, foto, código, aplicação) com o botão "Trocar
perfil" ao lado do rótulo do campo, para buscar outro sem precisar
recarregar a tela.

Verificado no navegador: busca filtra em tempo real, seleção mostra o
cartão de confirmação, "Trocar perfil" volta para a busca, e o restante
do formulário (acabamento, comprimento, quantidade) continua
funcionando normalmente depois de escolher o perfil.

## 1.6.8 — 17/08/2026

**Botão de voltar: cor visível nos dois temas, e só onde faz sentido —
mais o card do perfil escolhido bem mais enxuto.**

Continuação da 1.6.7. Duas correções depois de ver o resultado real:

- A cor usada no botão (fundo branco, borda cinza-claro) ficava ótima no
  tema escuro e praticamente invisível no tema claro — fundo quase
  branco sobre página quase branca. Só percebi porque tinha testado
  apenas no escuro. Trocado para as cores de "destaque" que o app já usa
  nos botões de mais e menos (`CampoMedida`, quantidade em "Cadastrar
  sobra") — pensadas desde o início para se destacarem em qualquer tema.
- O botão tinha ido parar também nas 5 telas da navegação inferior
  (Início, Procurar, Cadastrar, Reservas, Mais), sempre apontando para o
  Início. Errado: essas telas não têm uma única tela anterior — chegam
  de lugares diferentes — e a barra inferior já leva ao Início a
  qualquer momento; um botão fixo ali era redundante e por vezes
  enganoso. Removido dessas 5 telas. Fica só onde existe uma origem
  única de verdade: fichas de detalhe (perfil, sobra, acabamento,
  localização, cliente — voltam para a lista de origem) e os cadastros
  dentro de "Mais" (perfis, acabamentos, localizações, clientes,
  relatórios, configurações — só se chega ali por "Mais").

Criado um componente único (`BotaoVoltar`) para não repetir o mesmo
estilo em cada tela, agora bem mais compacto (borda simples, texto
pequeno) — é um coadjuvante de navegação, não deve competir com o
título da tela.

Também em "Cadastrar sobra": ao escolher um perfil, o link "Trocar
perfil" (que já existia, abaixo do cartão verde) subiu para o topo do
passo 1, ao lado do título, com a mesma cara do botão de voltar — mesma
ideia (desfazer uma escolha e voltar), mesmo lugar, mesmo estilo.

Verificado no navegador, nos dois temas e em mobile/desktop: botão
visível e compacto nas fichas de detalhe e nos cadastros de "Mais";
ausente nas 5 telas de navegação inferior; "Trocar perfil" funciona e
aparece no topo do passo 1.

**E, no mesmo espírito de economizar espaço:** o cartão verde de
confirmação (tela "Cadastrar sobra", ao escolher um perfil) tinha o
texto na vertical ao lado do desenho e da foto, e três coisas que não
agregam para quem já conhece os perfis: o rótulo "Perfil escolhido", a
dica "Compare o desenho e a foto com a peça antes de salvar" e um link
de texto "Ver ficha completa do perfil" numa linha só para ele.

Reorganizado: o texto foi para baixo do desenho/foto (horizontal, não
mais espremido do lado), e cortado o que era só apoio. O selo de
confirmação virou um "✓" pequeno junto do código, e o acesso à ficha
completa virou um ícone de seta, sem texto, compartilhando a mesma
linha do código — o cartão inteiro já é clicável e já anuncia isso pelo
`aria-label`, o ícone é só o reforço visual.

Verificado no navegador: cartão mais baixo, texto legível, clique no
corpo do cartão continua abrindo a ficha do perfil normalmente.

## 1.6.7 — 16/08/2026

**Botão de voltar mais evidente nas telas de detalhe.**

O link "← Voltar" no topo de toda tela de detalhe (perfil, sobra,
acabamento, localização, cliente) era só texto azul sublinhado ao
passar o mouse — fácil de não notar, especialmente numa tela nova.

Virou um botão de verdade: fundo, borda, cantos arredondados, alvo de
toque confortável (40px de altura). Como é a mesma casca
(`PaginaDetalhe`) usada pelas telas de sobra, acabamento, localização e
cliente, a correção vale para as quatro de uma vez; a ficha de perfil
tinha uma cópia própria do mesmo link e recebeu o mesmo ajuste.

Verificado no navegador, celular e computador: botão visível e
consistente nas duas telas testadas (perfil e acabamento), sem
mudança de comportamento — continua levando para a lista de origem.

## 1.6.6 — 16/08/2026

**Verificação de atualização mais confiável, com botão manual.**

O app já avisava sobre versão nova (`AvisoNovaVersao`), mas só verificava
de hora em hora. No iPhone isso quase nunca chegava a rodar de verdade:
o app instalado fica dias em segundo plano, e o Safari suspende
temporizadores nesse meio tempo — resultado, alguém ficava semanas numa
versão antiga sem nunca ver o aviso.

Três mudanças:

- A verificação agora roda assim que o app abre, e de novo toda vez que
  ele volta a ficar visível (`visibilitychange`) — não só de hora em
  hora. É o momento em que realmente vale a pena checar: a pessoa acabou
  de reabrir o app depois de um tempo fechado.
- Adicionado um botão "Verificar atualização" no selo de versão
  (`SeloVersao`, visível na tela inicial e na de entrada). Toque manual,
  para quem quer confirmar na hora, sem depender de nenhum temporizador.
  Se achar versão nova, o aviso de atualizar aparece sozinho; se não
  achar, mostra "Você já está na versão mais recente."
- `vercel.json` passou a mandar `Cache-Control: max-age=0,
  must-revalidate` para `sw.js`, `index.html` e `manifest.webmanifest` —
  sem isso, mesmo pedindo para checar, o servidor podia devolver uma
  cópia em cache desses arquivos e a checagem nunca via a versão nova de
  verdade.

Verificado no navegador: botão "Verificar atualização" funciona (mostra
"Verificando…", depois o resultado), sem erros no console; build e
testes passando.

Quem já tem o app instalado e travado numa versão antiga (ex.: iPhone
preso na 1.6.2) precisa de um empurrão manual uma única vez, porque o
service worker antigo é quem decide se procura por um novo — force
fechar o app (deslizar para cima no seletor de apps) e reabrir, ou
apagar o ícone da tela de início e adicionar de novo pelo Safari.

## 1.6.5 — 16/08/2026

**Logo grande na tela inicial, com a versão no rodapé.**

Depois de entrar, a tela de login some e a marca do RePerfil não
aparecia em lugar nenhum até a próxima vez que a pessoa saísse e
voltasse a entrar. A versão em execução também só ficava visível dentro
de "Mais".

Adicionada a logo completa (símbolo + nome), grande, logo no topo da
tela inicial, antes dos cartões de estoque — a primeira coisa que
aparece ao entrar. A saudação ("Olá, Nome" e o papel) ficou centralizada
em relação à logo, em vez de alinhada à esquerda. Os dados de versão
(`SeloVersao`, o mesmo componente já usado na tela de login) ficam no
rodapé da tela, abaixo dos botões: toque para expandir e ver build,
commit e data de publicação, com opção de copiar.

Verificado no navegador, celular e computador: logo aparece grande e
sem cortar, saudação centralizada sob ela, cartões continuam normais
logo abaixo, selo de versão expande corretamente no rodapé, sem
rolagem horizontal em nenhuma das duas larguras testadas.

## 1.6.4 — 16/08/2026

**Lista de perfis preenche a tela até a navegação.**

Na tela "Cadastrar sobra", a lista de perfis (passo "1. Qual perfil?")
tinha altura fixa (24rem). Em celulares mais altos, isso deixava uma
faixa vazia entre o fim da lista e a barra de navegação — espaço que
deveria mostrar mais perfis e em vez disso ficava em branco.

Corrigido: enquanto o perfil ainda não foi escolhido, a tela vira uma
coluna com a altura real disponível (até a navegação inferior), e a
lista cresce para ocupar esse espaço inteiro, rolando por dentro dela
quando há mais perfis do que cabem. A mensagem de "nenhum perfil
encontrado" também passou a ocupar o espaço todo, em vez de ficar
pequena no topo com vazio embaixo. Depois de escolher o perfil, a tela
volta ao normal — como já tem formulário demais para uma tela só, ela
rola inteira, como sempre foi.

Verificado no navegador em 375px de altura de tela: sem faixa vazia
entre a lista e a navegação, lista rola por dentro, mensagem de busca
sem resultado ocupa o espaço certo, e nada muda no computador (onde o
menu é lateral e não há esse problema).

## 1.6.3 — 16/08/2026

**Trava contra rolagem horizontal.**

Em tela estreita, o passo "4. Quantas peças iguais?" da tela "Cadastrar
sobra" cortava o botão de "+" e abria uma barra de rolagem lateral na
página inteira — o layout usava `flex-1` num campo de texto sem
`min-w-0`, e o navegador, sem conseguir encolher o campo, encolhia os
botões de lado até ficarem espremidos, e ainda assim sobrava largura
demais. O mesmo padrão existia na tela "Procurar sobra".

Corrigido nos dois lugares, seguindo o padrão que já funcionava no campo
de comprimento (`CampoMedida`): o campo do meio ganha `min-w-0` para
poder encolher, e os botões ganham `shrink-0` para nunca perderem o
tamanho. Além disso, adicionada uma trava global em `index.css`
(`overflow-x: hidden` em `html` e `body`): se algum layout futuro
calcular a largura errado, o conteúdo é cortado, mas a página nunca mais
abre rolagem lateral. Galerias que rolam de propósito (fotos, desenhos)
continuam rolando normalmente, pois usam `overflow-x-auto` no próprio
container.

Verificado no navegador em 375px e 320px de largura: sem barra de
rolagem horizontal em nenhum dos dois; botão de "+" sempre com a largura
cheia (64px/56px), mesmo com o campo mostrando "9999".

## 1.6.2 — 16/08/2026

**Card do perfil escolhido: texto completo e clicável.**

Na tela "Cadastrar sobra", o card verde do perfil escolhido tinha dois
problemas: o texto da aplicação era cortado com "…" quando ficava longo (ex.:
"lateral da porta de correr de 8 folhas…" — justamente o texto que confirma
se é a peça certa), e o card não abria a ficha completa do perfil ao ser
tocado, diferente do resto do app.

Corrigido: o texto da aplicação agora quebra linha em vez de truncar, e o
card inteiro passou a abrir a ficha do perfil (decisão D9 — todo registro
clicável abre seu detalhe). Os botões de ampliar desenho e foto continuam
funcionando por cima, sem disparar a navegação.

Verificado no navegador: aplicação com 96 caracteres exibida por inteiro, sem
corte; clique no botão de ampliar abre o desenho sem sair da tela; clique no
corpo do card navega para `/perfis/:id` e mostra a ficha correta.

## 1.6.1 — 16/08/2026

**Sugestões de aplicação autoexpansíveis.**

O campo "Aplicação" do cadastro de perfil (versão 1.6.0) tinha 16 sugestões
fixas no código. Agora a lista de sugestões cresce sozinha: soma as 16
iniciais com tudo que a própria organização já digitou em algum perfil. Usar
uma aplicação nova já é o cadastro dela — sem tela de administração.

Verificado no navegador: cadastrado um perfil com "Aplicação Personalizada
XYZ" (fora da lista inicial), recarregada a página, e o termo apareceu como
sugestão no próximo cadastro, ordenado junto com as demais.

## 1.6.0 — 16/08/2026

**Toda linha de lista abre uma tela de detalhe.**

Padrão adotado como convenção do projeto (decisão D9). Telas novas para
sobra, cliente, acabamento e localização, somando-se à do perfil.

Cada uma mostra o que não cabia na lista: a sobra ganha histórico de
movimentações e foto; o cliente, botões de ligar e WhatsApp; o acabamento,
quanto existe nessa cor e em quais perfis; a localização, a lista do que
está guardado ali.

## 1.5.0 — 16/08/2026

**Fotos do perfil e destaque nos botões de incremento.**

- Cada perfil aceita fotos da peça real, além dos desenhos técnicos. Tiradas
  no mesmo ângulo do desenho, as duas lado a lado permitem conferir a ponta
  na mão de imediato
- A foto aparece na ficha do perfil e ao lado do desenho no cadastro de sobra
- Botões de mais e menos ganham cor própria, com tokens que se adaptam ao
  tema claro e escuro

Precisa aplicar a migration `20260815190000_fotos_do_perfil.sql`.

## 1.4.0 — 15/08/2026

**Sobra não pode ser maior que a barra.**

O limite de comprimento passou de 18 m para o comprimento da barra do perfil
escolhido — 6 m em todos os perfis de hoje. Uma sobra é o que restou de uma
barra, e não existe resto maior do que a peça de onde veio.

A regra vale nos dois lados: a tela avisa na hora, e a função `cadastrar_sobra`
recusa no banco. Precisa aplicar a migration
`20260815180000_limite_comprimento_barra.sql`.

## 1.3.0 — 15/08/2026

**Desenho técnico no cadastro e ajuste de medida por botões.**

- O seletor de perfil mostra o desenho: miniatura em cada opção da busca, e
  em tamanho maior no perfil escolhido, ampliável. É a conferência que o
  serralheiro faz comparando a seção com a ponta na mão
- Botões de mais e menos no campo de comprimento, com passo por unidade:
  10 mm, 1 cm ou 1 m

## 1.2.0 — 15/08/2026

**Desenho técnico visível nas listas e ficha do perfil.**

- Miniatura do desenho em cada linha do estoque e do catálogo de perfis
- Tocar na linha abre a ficha do perfil: desenhos ampliáveis, estoque
  disponível agrupado por acabamento e comprimento, e ficha técnica com peso
  por metro, peso da barra e link do fabricante

As miniaturas usam uma consulta só para todos os perfis, com um único pedido
de links assinados, e carregamento tardio — só baixa o que entra na tela.

## 1.1.0 — 15/08/2026

**Importação da planilha de inventário.**

Importados 79 perfis com seus 79 desenhos técnicos, 6 acabamentos e 84 lotes
— 296 peças, 1.718 metros. As 39 pontas sem medida e as 2 riscadas ficaram de
fora, exportadas para uma lista de conferência.

`scripts/importar-planilha.mjs` sempre mostra uma prévia antes de gravar;
só grava com `--confirmar`.

## 1.0.0 — 15/08/2026

**Fase 1 completa.**

Etapa 8: aplicativo Android via Capacitor.

- Projeto Android configurado: pacote `br.com.reperfil.app`, SDK alvo 36,
  ícone adaptativo e tela de abertura gerados da logo da empresa
- Permissões mínimas: internet, estado da rede e câmera. A câmera é declarada
  como opcional, para o app continuar instalável em aparelho sem ela
- Versão e versionCode vêm do `package.json`, para não existirem dois lugares
  dizendo em que versão o aplicativo está
- **APK de depuração compilado, instalado e validado** num aparelho Android
  real, 8,4 MB
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
