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

## Uma entrada por PUBLICAÇÃO, não por mudança

`publicarrp` roda `npm run versao:correcao` — sobe exatamente **+1 a cada
publicação** — e não mexe neste arquivo. Então o número da próxima entrada
aqui é sempre **o do `package.json` mais um**, e várias mudanças feitas antes
da mesma publicação entram na MESMA entrada, não numa cada.

Foi assim que os dois números se separaram entre 1.6.22 e 1.6.52: cada
mudança ganhava entrada nova aqui, enquanto a versão real subia uma vez por
lote publicado — chegando a seis de diferença. Quem lia "1.6.46" no aplicativo
e vinha procurar aqui encontrava a descrição de outra coisa.

Os dois foram realinhados em 20/08/2026 subindo o `package.json` até
encontrar este arquivo. As entradas antigas ficaram como estão: reescrevê-las
exigiria fundir umas nas outras e apagaria o registro do que foi feito, e o
que serve de verdade para rastrear um erro é o número de build e o hash do
commit, não este número. Por isso 1.6.47 a 1.6.51 nunca existiram como versão
publicada — são um vão deixado de propósito.

---

## 1.7.11 — 26/08/2026

**Correção séria: dados de uma empresa vazavam para a próxima, na mesma aba.**

Trocar de conta sem fechar o navegador (sair da RePerfil, entrar como
Alumifort) mostrava o estoque e a equipe certos, mas o nome da empresa e a
logo continuavam sendo os da conta anterior. Causa: o React Query guarda
cada consulta numa "gaveta" fixa (ex.: "a organização"), sem saber que a
sessão por trás mudou de gente — e a consulta de dados da empresa tem um
`staleTime` de 5 minutos (porque "muda raramente"), então continuava
servindo do cache por esse tempo, agora com os dados errados. Corrigido
limpando todo o cache ao sair — fecha essa brecha pela raiz, não só para
esta consulta.

## 1.7.43 — 28/08/2026

**Botões de sincronizar na mesma linha, em Modelos de perfil.**

"Atualização geral", o seletor "Sincronizar uma linha" e "Atualizar"
quebravam para uma segunda linha em telas estreitas, e o seletor tinha
uma largura fixa fora do padrão dos botões ao lado. Agora os três dividem
a linha igualmente (mesma largura), com fonte um pouco menor para caber.

---

## 1.7.42 — 28/08/2026

**Corrigido: a ordem das linhas era por empresa, e devia ser só da
central.**

A ordem manual (arrastar/setas) tinha uma cópia por organização — em
teoria, qualquer empresa podia definir a própria, desconectada da
central. Não devia: é o catálogo central quem manda no que qualquer
empresa vê, sempre. Agora `linhas_ordem` é uma ordem ÚNICA e global (sem
`organizacao_id`), definida só pela organização central; as demais
empresas passam a herdar essa ordem automaticamente, e as setas/pílula de
mover somem da tela para quem não é a central — só dá pra olhar, não pra
mudar. Precisa da migração.

---

## 1.7.41 — 28/08/2026

**Ícone da barra inferior voltou a ser a tesoura.**

As duas tentativas de desenhar uma serra do zero (disco dentado, depois
serra de bancada) não ficaram parecidas com o que você tinha em mente.
Voltou a tesoura original em "Utilizar" — você vai construir o ícone
certo e mandar para eu aplicar.

---

## 1.7.40 — 28/08/2026

**Corrigido: "Administrar linhas por empresa" ficava em branco depois da
migração anterior.**

A migração 1.7.39 quebrou essa tela — a lista de linhas, depois de
escolher a empresa, não aparecia. Causa: a função `linhas_para_organizacao`
é escrita em PL/pgSQL, e declara uma coluna de saída chamada `linha`; uma
sub-consulta interna referenciava `modelos_perfil.linha` sem qualificar
com o nome da tabela, e o Postgres não sabia se era a coluna ou a
variável da própria função — erro "column reference is ambiguous".
Corrigido qualificando toda referência. Testado direto no navegador antes
de mandar, chamando a função pelo cliente Supabase da própria página.

---

## 1.7.39 — 28/08/2026

**Corrigido: ordem manual não valia dentro de "Administrar linhas por
empresa" nem no seletor de sincronizar uma linha.**

Essas duas listas (linhas do catálogo central) ainda ordenavam só por
alfabeto, ignorando a ordem manual definida em "Linhas e sistemas". Agora
respeitam — a ordem manual é da organização central (é o catálogo dela
sendo mostrado nos dois casos), então é a dela que vale, em qualquer tela
que liste essas linhas. Precisa da migração.

---

## 1.7.38 — 28/08/2026

**Redesenhado o controle de posição em "Linhas e sistemas" + ícone de
serra na barra inferior.**

As setas de mover para cima/baixo agora ficam SOLTAS, fora da pílula —
azul forte, sem fundo. A pílula azul clara envolve só o número da posição,
com uma setinha pequena ao lado indicando que é clicável (abre a lista de
posições). Tudo isso cabe na mesma altura de cartão que já existia, sem
esticar nada — conferido direto no navegador desta vez.

Corrigido também: clicar bem em cima da setinha não abria a lista, só
clicando exatamente sobre o número — o `<select>` de verdade só cobria a
área do número, a setinha ao lado era só um desenho separado. Agora o
`<select>` (invisível) cobre a pílula inteira, incluindo a seta; o que se
vê (número + seta) é só o desenho por baixo.

E o nome da linha deixou de cortar com "..." quando não cabia numa linha
só — agora quebra em duas linhas (ou mais) e mostra o nome inteiro
sempre, mesmo que o cartão cresça um pouco para acomodar.

Na barra de navegação, a tesoura de "Utilizar" virou um disco de serra —
o lucide-react não tem um ícone de serra pronto (só machado, furadeira,
martelo), então desenhei um do zero no mesmo traço dos demais ícones do
app. Fica mais fiel ao que o app faz: cortar perfil de alumínio.

---

## 1.7.37 — 28/08/2026

**Seletor de posição entre as setas — pula direto para qualquer lugar da
lista.**

As setas resolvem mover uma linha uma casa por vez, mas levar a última
posição de uma lista de 100 linhas para a primeira exigiria 99 toques.
Agora, entre as duas setas, um número mostra a posição atual — toque nele
e escolhe direto qualquer posição da lista. É um `select` nativo: no
celular abre a roda de seleção do próprio sistema, que já rola sozinha
mesmo com muitas linhas, sem nada extra para construir.

---

## 1.7.36 — 28/08/2026

**Trocado arrastar-e-soltar por setas de mover, em "Linhas e sistemas".**

O arrastar era lento pra gravar e às vezes precisava de várias tentativas
para "pegar" — dois problemas de causas diferentes:

1. Cada arrasto gravava a lista inteira em N pedidos separados ao banco,
   um por linha, em vez de um pedido só. Corrigido: agora é um upsert em
   lote, um pedido só, não importa quantas linhas existam.
2. O gesto de arrastar em si é frágil dentro de uma lista que já rola
   sozinha — celular de verdade tenta interpretar o mesmo toque como
   arrastar E como rolar a tela, e um vence o outro por sorte.

Em vez de tentar afinar o arrasto, troquei por duas setinhas em cada
linha (subir/descer uma posição por toque), sem ambiguidade nenhuma. Não
precisa de migração — mesma tabela e mesma mutação de antes, só a tela
mudou.

---

## 1.7.35 — 28/08/2026

**Rodapé das listas: "Ver todos" e "Exibir inativos" na mesma linha, mais
compacto.**

Em Modelos de perfil, os dois links do rodapé ficavam empilhados com um
vão grande entre eles — o botão de "Exibir inativos" usava um componente
com bem mais preenchimento que o link "Ver todos os perfis" ao lado.
Agora os dois ficam na mesma linha, com a mesma fonte (tamanho, peso, cor)
e só o espaço de uma linha de altura. Mesma correção nas demais telas com
"Exibir inativos" no rodapé: Produtos, Equipe, Clientes, Cores e
acabamentos, Localizações e Acessórios.

---

## 1.7.34 — 28/08/2026

**Ordem manual das linhas — arraste para reordenar em "Linhas e sistemas".**

Nova alça de arrastar (ícone ⋮⋮) em cada linha, em "Linhas e sistemas".
A sequência que você definir vira a ordem PADRÃO em toda tela do app que
agrupa por linha — catálogo, seletor de perfil, estoque, identificar
perfil. Os dois botões de ordenar (nome/estoque) continuam lá, mas agora
são uma troca temporária: escolher um deles só vale enquanto você está
na tela; sair e voltar restaura a ordem manual. Linha nova (ainda sem
posição definida) entra depois de todas as ordenadas, em ordem alfabética.

Precisa da migração.

---

## 1.7.33 — 27/08/2026

**"Exibir inativos" padronizado em todas as telas de cadastro.**

O botão vivia dentro do quadro principal da lista (às vezes sobrando
sozinho num espaço vazio, como em Produtos). Agora fica sempre no rodapé
fixo da tela, fora do quadro — igual já era em "Ver todos os perfis".
Mudou em Produtos, Equipe, Modelos de perfil, Clientes, Cores e
acabamentos, Localizações e Acessórios.

De quebra, quatro dessas telas (Clientes, Acabamentos, Localizações,
Modelos de perfil) nunca tinham esse filtro — misturavam ativos e
inativos direto na lista, sem opção de esconder. Agora escondem os
inativos por padrão, como as demais.

---

## 1.7.32 — 27/08/2026

**Nova tela "Administrar linhas por empresa" (catálogo central).**

Em "Linhas e sistemas", logo abaixo do texto explicativo, um novo botão
"Administrar linhas por empresa" (só para quem administra o catálogo
central) abre uma tela onde se escolhe a EMPRESA primeiro, e depois quais
linhas ela pode importar/atualizar — com atalho "Liberar/Bloquear todas as
linhas" de uma vez. É o mesmo mecanismo de "Editar linha" (que escolhe a
linha primeiro), só que pelo ângulo contrário; os dois mexem na mesma
liberação por trás, então uma mudança num lugar aparece automaticamente
no outro.

Confirmado também: bloquear uma linha para uma empresa nunca apaga o que
ela já copiou — só impede importar perfil novo ou receber atualização
daquela linha dali para frente. O catálogo que a empresa já trouxe
continua exatamente como estava.

---

## 1.7.31 — 27/08/2026

**Liberação de linha refeita: por empresa, não mais geral.**

O bloqueio "Disponível"/"Bloqueada" que apareceu ontem em "Modelos de
perfil" saiu de lá. Agora vive dentro de "Editar linha" (renomeado de
"Renomear linha"), em Linhas e sistemas — só visível para quem administra
o catálogo central. Em vez de ligar/desligar a linha para todo mundo de
uma vez, dá para liberar empresa por empresa (com um atalho "Liberar para
todas"/"Bloquear todas" quando fizer sentido). Precisa da migração —
substitui o mecanismo anterior por completo.

---

## 1.7.30 — 27/08/2026

**Corrigido: "Apagar produto" não apagava de verdade.**

Faltava a política de segurança que permite o comando de apagar de fato —
sem ela, o pedido rodava sem erro nenhum, mas o banco recusava
silenciosamente (zero linhas afetadas), e o produto voltava a aparecer na
lista. Precisa da migração.

---

## 1.7.29 — 27/08/2026

**Apagar produto, e arquivados escondidos por padrão.**

A tela de Produtos só tinha "desativar". Agora tem também "Apagar" de
verdade (some com a lista técnica junto — sem como desfazer, com
confirmação). Produtos desativados deixaram de aparecer na lista por
padrão; um botão "Exibir inativos" no fim da lista mostra-os quando
precisar, igual já funciona em Colaboradores e Modelos de perfil.

---

## 1.7.28 — 27/08/2026

**Cabeçalho de "Modelos de perfil" reorganizado + sincronização por linha.**

O botão "Atualização geral" espremia o título e o texto explicativo em
telas estreitas — agora ele (e o novo seletor de linha) ficam numa faixa
própria, abaixo do cabeçalho.

Além da atualização geral, agora dá para sincronizar (atualizar ou
importar) **uma linha só** do catálogo central, em vez do catálogo
inteiro. E quem administra a organização central ganhou um botão
"Disponível"/"Bloqueada" em cada linha, na lista de linhas — decide,
linha a linha, se ela pode ser importada pelas demais empresas (é
negociação comercial, não trava nada por padrão: toda linha começa
disponível).

---

## 1.7.27 — 27/08/2026

**Corrigido: "Atualização geral" quebrava na Alumifort com erro de código
duplicado.**

O catálogo central nasceu de uma cópia feita a partir da própria Alumifort,
mas o vínculo com o central só ficou marcado do lado de quem recebeu — os
368 perfis originais da Alumifort não sabiam que já tinham par lá. A
sincronização tratava todos eles como "perfil novo" e tentava recriar,
batendo no código que ela mesma já usava. A função agora nunca tenta
recriar um código já existente na organização (protege qualquer empresa de
travar por isso), e um script à parte vincula retroativamente os perfis da
Alumifort ao catálogo central.

---

## 1.7.26 — 27/08/2026

**Corrigido: reenviar convite invalidava o link de e-mail anterior.**

Reenviar um convite recriava a linha com um id novo — quem tinha recebido
o e-mail de convite ORIGINAL (de verdade, mas com o id antigo) ficava
travado na tela "Confirme seu e-mail" no cadastro, mesmo tendo entrado por
um link legítimo. Agora o reenvio mantém o mesmo id de sempre: qualquer
e-mail de convite já mandado para aquele endereço, deste envio ou de
reenvios anteriores, confirma o cadastro na hora.

---

## 1.7.25 — 27/08/2026

**Cabeçalho da ficha do perfil congelado ao rolar.**

Na tela de um perfil, a faixa com "Voltar"/"Editar" e o aviso de revisão
agora fica fixa no topo da tela enquanto o resto (desenho, estoque, ficha
técnica) rola por baixo — como no print enviado.

---

## 1.7.24 — 27/08/2026

**Moldura padronizada em todos os botões "secundária" do app.**

O botão "Editar" (e qualquer outro do mesmo estilo, em toda tela) não tinha
moldura nenhuma — só o "Voltar" tinha. Acrescentei borda de 1px na mesma
cor e intensidade do "Voltar" (`border-borda`) diretamente no componente
`Botao`, então vale para o app inteiro de uma vez. O botão verde de
revisão também ganhou uma borda mais forte — a anterior era clara demais
para aparecer.

---

## 1.7.23 — 27/08/2026

**Filtro de revisão (Todos/Revisados/Pendentes) não perde mais a seleção.**

Entrar num perfil e voltar zerava o filtro de volta para "Todos" — vivia só
num `useState`, que reinicia toda vez que a tela remonta. Passou a viver na
URL, como o agrupamento por linha já fazia: sobrevive a entrar e voltar de
um perfil, e só volta ao padrão se você sair de Modelos de perfil para
outra parte do app.

---

## 1.7.22 — 27/08/2026

**Moldura no botão de revisão.**

---

## 1.7.21 — 27/08/2026

**Botão de revisão: símbolo ✓ no rótulo, fundo verde.**

---

## 1.7.20 — 27/08/2026

**Correção: o "Salvar" do topo não aparecia de verdade.**

A versão anterior colocava o botão no início do conteúdo que rola — ainda
exigia rolar até lá para vê-lo. Agora fica no CABEÇALHO FIXO do modal, ao
lado do título, sempre visível, não importa até onde a pessoa rolou.
`Modal` ganhou um espaço reservado para isso (prop `acoes`), reaproveitável
por qualquer outro formulário longo no futuro.

---

## 1.7.19 — 27/08/2026

**Botão "Salvar" também no topo do formulário de editar perfil.**

O formulário tem desenho técnico e fotos no meio — salvar exigia rolar até
o fim mesmo já tendo terminado a edição lá em cima. O botão do fim continua
como estava.

---

## 1.7.18 — 27/08/2026

**Símbolo de revisão: emoji maior (✅/⚠️), centralizado com as duas
linhas de texto.**

---

## 1.7.17 — 27/08/2026

**Texto explicativo do card de revisão numa linha própria**, embaixo de
"Revisado"/"Ainda não revisado", em vez de espremido na mesma linha (onde
cortava antes de chegar ao fim). As duas linhas truncam exatamente até o
limite do botão, sem passar por baixo dele.

---

## 1.7.16 — 27/08/2026

**Card de revisão: cores, número da revisão, bem mais compacto.**

- Verde quando revisado, amarelo claro quando ainda não — em vez de tudo
  cinza. Botão em azul claro, separado do resto.
- Mostra o número da revisão (o contador que cada "nova revisão" avança).
- Reduzido a uma faixa fina de uma linha só; quem revisou e quando ficam
  escondidos por padrão, aparecem ao tocar na linha.

---

## 1.7.15 — 27/08/2026

**Revisão do perfil, unificada num lugar só.**

Antes existiam dois controles separados: o checkbox "Perfil verificado e
revisado" dentro do formulário de editar, e o botão "Marcar nova revisão",
visível só na organização central. Viraram uma coisa só, na própria tela
de exibição do perfil — o mesmo botão marca a primeira revisão ou uma
nova, conforme a situação, com texto explicando o que significa e,
quando já revisado, quem revisou e quando. "Marcar nova revisão" só
aparece depois de uma primeira revisão já ter acontecido; nesse caso
(e só em perfil do catálogo central), também avança a revisão que avisa
quem já copiou. Precisa da migração
`20260827300000_unificar_revisao_perfil.sql`.

---

## 1.7.14 — 27/08/2026

**Desenho técnico passa a prevalecer o do catálogo central.**

Ajuste na sincronização: numa atualização, desenho técnico agora é
SUBSTITUÍDO pelo do catálogo central (apaga duplicado ou desatualizado e
recoloca o de lá) — é dado de catálogo, deveria valer o mesmo que os
campos de texto do perfil. Foto continua só acrescentando, nunca apagando
— é a empresa quem fotografa a peça por conta própria, sem "versão
central" para prevalecer sobre ela. Precisa da migração
`20260827200000_desenho_tecnico_prevalece.sql`.

---

## 1.7.13 — 27/08/2026

**Card "Reservadas" da tela inicial virou "Perfis · linhas".**

Mostra agora o total de perfis cadastrados e, embaixo, quantas linhas
distintas existem entre eles — e continua levando para "Modelos de
perfil" ao tocar. Reservas continua alcançável pela barra de navegação
inferior, como qualquer outra tela.

---

## 1.7.12 — 27/08/2026

**Sistema de revisão do catálogo central.**

- Botão **"Marcar nova revisão"** na ficha de um perfil — só aparece na
  organização central, para sinalizar que algo mudou.
- Aviso + botão **"Atualizar"** na ficha de um perfil desatualizado, em
  qualquer empresa que já o tenha copiado.
- Botão **"Atualização geral"** na tela de perfis — traz perfis novos do
  catálogo central e atualiza os já copiados que mudaram, tudo de uma vez.
- Campos reimportados na atualização: código, descrição, fabricante,
  linha, categoria, aplicação, medidas de seção, código de barras,
  comprimento de barra, peso por metro, observações, e as imagens novas do
  central (sem apagar nenhuma que a empresa tenha adicionado por conta
  própria). **Preço por metro e o "revisado" local nunca são tocados.**

Precisa da migração `20260827100000_revisao_catalogo_central.sql`.

---

## 1.7.10 — 26/08/2026

**Base para o catálogo central da RePerfil.**

Coluna `eh_catalogo_central` em organizações (só uma pode ser a central por
vez), função para achar essa organização, e política de Storage liberando
a leitura das imagens dela (fotos de perfil, desenhos técnicos, imagens de
produto) para qualquer empresa autenticada — necessário para o passo
seguinte, que move de verdade os arquivos da Alumifort para a pasta da
RePerfil sem duplicar. Só schema e um script auxiliar (`scripts/mover-
arquivos-catalogo-central.mjs`); nenhuma tela do app mudou ainda.

---

## 1.7.9 — 25/08/2026

**"Já confirmei" agora insiste antes de desistir.**

Conferia a confirmação uma vez só — se a outra aba (onde o link do e-mail
abriu) ainda estivesse carregando o app pela primeira vez, sobre rede de
celular, o botão dizia "ainda não confirmado" mesmo a confirmação indo
acontecer um instante depois, exigindo clicar de novo. Agora tenta até 4
vezes, com 1,5s entre cada, antes de mostrar a mensagem.

---

## 1.7.8 — 25/08/2026

**Correção: botão "Voltar" esticado em "Acrescentar material".**

Só na tela nova: sem perfil escolhido, o contêiner vira `flex-col` (para a
lista de linhas crescer até a barra inferior), e isso esticava o botão —
que é `inline-flex` — para a largura toda. Conferi as outras 29 telas que
usam o mesmo botão: todas ficam dentro de um contêiner comum (bloco, não
flex) e não tinham esse problema — era isolado a esta tela nova mesmo.

---

## 1.7.7 — 25/08/2026

**"Acrescentar material" virou tela própria, com a mesma busca do Estoque.**

O modal de acrescentar corte na lista técnica só tinha um campo de texto
com sugestões — sem a busca por linha, código ou medida que a tela de
Estoque já tem. Agora é uma tela dedicada (`/produtos/:id/acrescentar-material`),
reaproveitando o mesmo seletor de perfil de Cadastrar estoque: escolhe a
linha, entra nela, busca por código ou medida. Depois de escolher, o
perfil fica fixo e dá para lançar vários cortes seguidos, sem escolher de
novo a cada um. Corrigir um corte já lançado ("Alterar corte") continua
sendo um modal simples, sem mudança.

---

## 1.7.6 — 25/08/2026

**Removido o aviso de rascunho de Termos de uso e Política de privacidade.**

---

## 1.7.5 — 25/08/2026

**Ordem corrigida: completar cadastro (foto/nickname) vem antes da
confirmação de e-mail.** Estava ao contrário — quem precisava das duas
coisas caía primeiro no bloqueio de e-mail, sem chance de terminar o
cadastro.

---

## 1.7.4 — 25/08/2026

**Botão "Já confirmei" na tela de bloqueio de e-mail.**

Confirmar acontece numa aba ou sessão diferente (o e-mail abre no celular,
por exemplo) — sem avisar a aba onde a pessoa ficou esperando. Agora tem um
botão que só recarrega o perfil; se já confirmou, a tela de bloqueio
libera sozinha, sem precisar sair e entrar de novo.

---

## 1.7.3 — 25/08/2026

**Correção: confirmar o e-mail não liberava o acesso.**

A confirmação gravava certinho no banco, mas a tela de bloqueio continuava
olhando o perfil que já estava carregado na memória do navegador — sem
recarregar, o campo `email_confirmado_em` seguia parecendo nulo mesmo
depois de confirmado. A página de confirmação agora atualiza o perfil em
memória assim que confirma.

---

## 1.7.2 — 25/08/2026

**Confirmação de e-mail passa a fazer sentido de verdade.**

Antes, a confirmação existia mas não travava nada — todo mundo tinha acesso
assim que terminava o cadastro, confirmado ou não. Agora:

- Clicar no **link do e-mail de convite** já confirma o e-mail na hora (é a
  prova de que a pessoa tem acesso àquela caixa de entrada) — o link passou
  a ir direto para "Primeiro acesso", com e-mail preenchido.
- Quem chega **sem esse link** (endereço digitado na mão, ou pela tela
  "Criar minha empresa") fica com o acesso **bloqueado** até confirmar pelo
  e-mail separado, com um botão para reenviar se precisar.
- Quem já tinha conta antes desta mudança não é afetado — foi perdoado
  automaticamente na migração, já que nunca recebeu e-mail nenhum para
  confirmar.

Precisa das migrações `20260825900000_expiracao_convite.sql` (se ainda não
tiver rodado) e `20260826100000_confirmacao_via_convite.sql`, e do deploy
da função `enviar-email`.

---

## 1.7.1 — 25/08/2026

**Prazo do convite: de 7 dias para 24 horas.** O e-mail agora mostra data e
hora exatas (fuso de Brasília), não só a data — com um prazo tão curto, só
a data seria vaga demais.

**Máscara de CPF/CNPJ e telefone em "Dados da empresa".** Os campos CNPJ,
Telefone e WhatsApp usavam texto livre; agora usam o mesmo componente
mascarado do resto do app (formata sozinho, avisa se o número não existe,
sem travar o campo).

---

## 1.7.0 — 25/08/2026

**Ajustes no e-mail de convite: texto, botão, prazo de validade.**

Corrigido um "=20" solto no meio do texto (sobra de linha em branco na
montagem do HTML). Título centralizado. Texto e botão revisados ("Abrir o
app RePerfil") e explicando o passo a passo depois de abrir o app (tocar em
"Primeiro acesso", usar o mesmo e-mail para criar a senha, e que dá pra
cadastrar um apelido depois). O convite agora tem prazo real — 7 dias — e
o e-mail informa a data exata; passado esse prazo, é como se não houvesse
convite, e o administrador precisa reenviar. Precisa da migração
`20260825900000_expiracao_convite.sql`.

---

## 1.6.99 — 25/08/2026

**"Acrescentar corte" virou "Acrescentar material" na lista técnica.**

**Serralheiro passa a cadastrar estoque por padrão.**

Está no depósito com a peça em mãos — esperar um administrador ou auxiliar
cadastrar por ele só atrasava o trabalho. Vale para convites novos a partir
de agora; quem já tem conta não muda sozinho. Precisa da migração
`20260825800000_serralheiro_cadastra_estoque.sql`.

---

## 1.6.98 — 25/08/2026

**Correção definitiva: e-mails chegavam com o layout todo quebrado.**

Não era a quebra de linha (`encodeLB`) — era o travessão e o nome da
empresa no Assunto, que obrigam uma codificação (RFC 2047) que o denomailer
faz errado em textos longos, corrompendo o e-mail inteiro. O Assunto agora
nunca leva caractere fora do ASCII; o corpo do e-mail continua acentuado
normalmente.

**Reenviar convite agora confirma de verdade que o e-mail saiu.**

O botão de reenviar mostrava sucesso assim que o convite era regravado,
mas o envio em si é assíncrono (Database Webhook) — não confirmava nada de
verdade. Agora a Edge Function grava quando o envio termina
(`email_enviado_em`), e a tela espera por essa confirmação antes de dizer
"enviado com sucesso". Precisa da migração
`20260825700000_confirmacao_envio_convite.sql`.

---

## 1.6.97 — 25/08/2026

**Reenviar (ou corrigir) convite pendente. Tela renomeada para "Equipe".**

Convites aguardando ganham um botão de reenviar, que abre um formulário
pré-preenchido — dá para corrigir nome, e-mail, telefone ou cargo antes de
mandar de novo, útil quando o colaborador não viu o e-mail ou o endereço
estava errado. Reenviar apaga o convite antigo e cria outro (é o que
dispara o e-mail de novo), tudo numa transação só. A tela "Colaboradores"
passou a se chamar "Equipe" em todo o app. Precisa da migração
`20260825600000_reenviar_convite.sql`.

---

## 1.6.96 — 25/08/2026

**Correção: e-mail de convite chegava todo desconfigurado.**

O Gmail mostrava o e-mail inteiro (cabeçalhos e HTML) como texto cru, sem
formatação — bug conhecido do denomailer com quebra de linha, corrigido com
a opção `debug.encodeLB`.

---

## 1.6.95 — 25/08/2026

**Tradução: "Auth session missing" ao redefinir senha.**

Faltava essa regra em `traduzirErro()` — a mensagem crua do Supabase
aparecia em inglês quando o link de redefinição "queimava" antes da hora.

---

## 1.6.94 — 25/08/2026

**Correção: exclusão de conta falhava com "Failed to send a request".**

Faltava CORS na Edge Function `excluir-conta` — ela é chamada direto pelo
navegador (diferente da `enviar-email`, chamada só de servidor a servidor),
e sem os cabeçalhos certos o navegador bloqueia a chamada antes de ela
chegar à função.

---

## 1.6.93 — 25/08/2026

**Excluir a própria conta agora libera o e-mail de verdade.**

A exclusão apagava os dados do perfil, mas o e-mail de login continuava
"preso" no Supabase Auth — um novo convite para o mesmo endereço nunca
completava o cadastro. Passou a usar uma Edge Function própria
(`excluir-conta`), que também libera o login, exatamente o que o aviso na
tela já promete: "peça um novo convite". Precisa da migração
`20260825500000_excluir_conta_libera_email.sql` e do deploy da nova função.

---

## 1.6.92 — 25/08/2026

**E-mail de convite e de confirmação de cadastro.**

Duas mensagens novas, mandadas por uma Edge Function própria via Gmail (sem
depender do envio compartilhado do Supabase): ao convidar um colaborador,
ele recebe um e-mail avisando qual empresa (cadastrada no sistema) o
convidou, com o link do RePerfil; e ao criar a conta, recebe um link para
confirmar que o e-mail usado é dele mesmo (`/confirmar-email`). Precisa da
migração `20260825400000_confirmacao_email.sql` e da configuração manual no
painel do Supabase (Edge Function + Database Webhooks) — ver instruções
enviadas no chat.

---

## 1.6.91 — 25/08/2026

**"Empresa cadastrada" em negrito na tela de entrar.**

---

## 1.6.90 — 25/08/2026

**Aviso de "Primeiro acesso" ganhou destaque.**

A mensagem que explica quem pode criar acesso (só quem foi convidado)
subiu para logo abaixo do título, dentro de um destaque de atenção — mesma
cor e ícone da "Zona de perigo" em Minha conta — em vez de um texto
discreto no rodapé, fácil de passar batido.

---

## 1.6.89 — 25/08/2026

**Ajuste de texto na tela de entrar.**

"Foi convidado e ainda não tem senha?" agora deixa claro que é convite de uma
empresa já cadastrada. E "Criar minha empresa" virou "Cadastrar minha
empresa", para combinar com o nome da tela que ele abre.

---

## 1.6.88 — 25/08/2026

**Lista de linhas em Cadastrar estoque agora preenche a tela, como em Estoque.**

Tinha uma altura fixa de 7 itens, decisão de quando a barra inferior era
mais baixa — sobrava um vão vazio embaixo em tela alta. Agora usa a mesma
configuração da lista de Estoque (`flex-1`, preenche o espaço disponível).

---

## 1.6.87 — 25/08/2026

**Corrigido: o rodapé de licença cortava o fim das listas.**

A barra de navegação ficou mais alta com a linha "Licenciado para", mas
`PaginaLista` (usado em Produtos, Reservas e mais doze telas) e Cadastrar
estoque ainda calculavam o espaço reservado para a barra com a altura
antiga — o fim do card/lista ficava escondido atrás da linha de licença.
Os três lugares que precisam concordar nesse número (o `main` da casca, o
`PaginaLista` e o Cadastrar estoque) foram atualizados juntos.

---

## 1.6.86 — 25/08/2026

**Linha de licença: uma linha só, com reticências, e um traço embaixo.**

No celular, "Licenciado para" agora corta com "…" em vez de quebrar em
duas linhas, e ganhou um traço por baixo separando o texto dos ícones —
igual ao que já existia por cima.

---

## 1.6.85 — 25/08/2026

**Rodapé de licença, e código de rastreio para conta excluída no histórico.**

Uma linha pequena, discreta, "Licenciado para: {nome da empresa}" —
razão social se houver, senão o nome fantasia — antes da barra de ícones
no celular e no fim do menu lateral no computador. Visível em toda tela
autenticada, sem chamar atenção.

E respondendo a uma dúvida legítima: como saber quem fez uma movimentação
antiga se a conta foi excluída? O id (chave primária) nunca é apagado, só
os dados pessoais — e agora, quando o autor de uma movimentação está com
conta excluída, o histórico mostra "Conta excluída (cód. XXXXXXXX)" em vez
de só "Conta excluída". Esse código está embutido no e-mail que a exclusão
grava (`conta-excluida-xxxxxxxx@reperfil.local`) e pode ser buscado direto
no painel do Supabase — e o e-mail ORIGINAL de login, esse nunca é
apagado, continua em Authentication → Users.

Criado também `supabase/MIGRACOES-APLICADAS.md`: um checklist simples de
quais migrações já foram coladas no Supabase, para não depender só da
memória de uma conversa para saber o que falta aplicar.

---

## 1.6.84 — 25/08/2026

**Minha conta: cada um edita e pode excluir os próprios dados.**

Novo link "Minha conta" em Mais, visível para todo mundo — antes só quem
administra colaboradores enxergava esse menu, e o dono da conta não tinha
caminho até a própria ficha (editar nome, telefone, foto, nickname já
funcionava, faltava chegar lá).

Também novo: "Excluir minha conta", na própria ficha, só para si mesmo —
apaga nome, telefone, CPF, foto e nickname, e desliga o acesso. Digite
EXCLUIR para confirmar. O histórico de estoque que a pessoa já mexeu
continua existindo, sem o nome dela. Bloqueado se for o único
administrador ativo da empresa — promova outra pessoa antes de sair.

O login em si (e-mail no Supabase Auth) não é apagado — exigiria a chave
de administração do projeto, que não pode viajar dentro do aplicativo. Sem
acesso liberado, ele não abre mais nada.

---

## 1.6.83 — 25/08/2026

**Busca dentro de uma linha fica dentro dela — em Cadastrar estoque e em Estoque.**

Antes, digitar algo na busca escapava da linha aberta e vasculhava todos os
perfis de novo. Agora, se você abriu "Suprema", a busca continua dentro de
"Suprema" — para procurar em tudo, basta não abrir nenhuma linha (ou tocar
"Ver todos os perfis"). A faixa que mostra onde você está e o botão Voltar
também continuam à mostra enquanto busca, em vez de sumir.

De quebra, corrigido: a busca em Estoque não reconhecia medida nenhuma —
digitar "35 25" não filtrava por seção. Agora usa a mesma regra do
catálogo e da busca de sobras: código sem hífen, e medidas em qualquer
ordem.

---

## 1.6.82 — 25/08/2026

**Identificar perfil: um campo só para as medidas, em vez de quatro.**

Digite as medidas separadas por espaço — "35 25 2 1", por exemplo — em vez
de pular entre quatro caixinhas. Aceita também "x" ou "×" como separador
("35x25"), do jeito que a medida costuma vir escrita em desenho. A regra
de sempre continua: a ordem não importa e não precisa informar todas.

---

## 1.6.81 — 25/08/2026

**"Criar minha empresa" agora exige CNPJ/CPF, telefone e e-mail válidos.**

Além do nome da empresa e do seu nome (já obrigatórios), a tela passa a
exigir CNPJ ou CPF (com máscara e conferência do dígito verificador),
telefone de contato (com máscara e DDD conferido) e e-mail num formato
válido — os três bloqueiam o cadastro se estiverem errados ou vazios,
diferente do resto do app, onde esses campos são só um aviso. CNPJ/CPF e
telefone já ficam salvos no cadastro da empresa.

---

## 1.6.80 — 25/08/2026

**Empresa nova cria o próprio acesso, sem depender do desenvolvedor.**

Nova tela "Criar minha empresa" (linkada de Entrar e de Primeiro acesso):
nome da empresa, seu nome, e-mail e senha — cria a organização e já entra
como administrador, na hora. Reaproveita o mesmo gatilho que já protegia o
cadastro por convite; sem os dados certos vindos dessa tela, o cadastro
continua recusado exatamente como antes. Isolamento entre empresas não
muda: essa porta só cria organização nova, nunca entra numa existente.

---

## 1.6.79 — 25/08/2026

**Links para Sobre, Termos e Privacidade na tela inicial.**

A marca do RePerfil na tela inicial agora é um link para "Sobre". Embaixo
do selo de versão, uma linha com Sobre, Termos de uso e Política de
privacidade — sempre à mão, sem precisar entrar em Mais.

---

## 1.6.78 — 25/08/2026

**Página "Sobre" e documentos legais (termos de uso, política de privacidade).**

Nova tela "Sobre" (Mais → Sobre): quem desenvolve, contato (e-mail e
WhatsApp), local, um campo para enviar a logo da empresa desenvolvedora e o
texto sobre o propósito do app. Acessível mesmo sem login — útil para quem
avalia o app antes de pedir acesso, e para a revisão da Play Store.

Junto, rascunhos de Termos de Uso e Política de Privacidade, também
públicos, linkados da tela de primeiro acesso. **Ainda não são documentos
definitivos** — precisam de revisão de um advogado antes da publicação,
principalmente pela LGPD (o sistema guarda CPF e foto de colaborador).

---

## 1.6.77 — 24/08/2026

**"Estoque por perfil" em Relatórios agora abre por linha, como o resto do app.**

Em vez de despejar todos os perfis de uma vez, a lista mostra as linhas
primeiro — cada uma com o total de metros e peças — e abre os perfis dela ao
tocar. Um link "Ver todos os perfis" no fim continua levando à lista
completa, para quem quiser ver tudo de uma vez.

---

## 1.6.76 — 24/08/2026

**Ajustes no inventário: desenho técnico na contagem, cancelados escondidos.**

Na tela de contagem, itens de perfil agora mostram o desenho técnico (toque
para ampliar) e as medidas da seção, como já acontece nas outras telas de
perfil. Na lista de inventários, sessões canceladas saem da vista por
padrão — um link "Mostrar cancelados" as traz de volta quando precisar.

---

## 1.6.75 — 24/08/2026

**Estoque de acessórios e inventário de perfis e acessórios.**

Novo estoque para dobradiça, roldana, puxador, borracha e afins — catálogo
próprio (Mais → Catálogo de acessórios) e estoque com cor/acabamento
opcional (Mais → Estoque de acessórios). A baixa do dia a dia é direta
("Usar" — digita a quantidade, confirma), sem passar por reserva: acessório
não tem corte para calcular, então esse fluxo seria complexidade à toa.

Novo módulo de Inventário (Mais → Inventário): escolhe contar perfis ou
acessórios, filtra por linha/categoria, localização, cor, condição e (nos
perfis) tamanho de barra — mesmo espírito dos filtros de Relatórios, mas
aqui cada lote entra individualmente para conferir. Contar NÃO mexe no
estoque: um botão "Confirmar" para quando bate, campos para digitar um
valor novo quando não bate, e só a opção "Aplicar" — por item ou de uma vez
— grava a diferença de volta. Também gera uma folha para imprimir e contar
na prancheta, para quem prefere não usar o celular no depósito.

---

## 1.6.74 — 24/08/2026

**Botão para promover colaborador a administrador, e login por nickname.**

Na ficha de um colaborador, um botão novo "Tornar admin" (com confirmação)
promove diretamente — antes só dava para achar isso trocando o "Cargo" dentro
de Editar, que ninguém achava. O seletor de cargo continua existindo, para as
outras trocas.

Login agora aceita e-mail OU nickname — cada colaborador escolhe o seu em
Editar (ou no primeiro acesso, tela "Falta pouco"). O nickname é único por
empresa, não no sistema inteiro; se o mesmo nickname existir em mais de uma
empresa, a tela de entrada pergunta qual delas antes de conferir a senha.

Corrigido também: a tela de criar senha nova exigia 8 caracteres, enquanto o
primeiro acesso exigia 6 — as duas passam a exigir 6, o mínimo combinado.

---

## 1.6.73 — 24/08/2026

**Corrigido: tela "Falta pouco" travava depois de concluir o cadastro.**

Salvava certo, mas a tela continuava exibindo o mesmo formulário sem
nenhum aviso. Agora mostra "Cadastro concluído" e abre a tela inicial ao
tocar em OK. Conferido também os campos obrigatórios: nome e foto já eram
exigidos de verdade; telefone e CPF são opcionais por design (bate com o
formulário de convite do colaborador) — só faltava o rótulo dizer isso.

---

## 1.6.72 — 23/08/2026

**Zerar estoque da empresa, e usar todo o estoque de uma peça de uma vez.**

Em Mais → Dados da empresa, uma "Zona de perigo" só para o administrador:
zera a quantidade de toda sobra cadastrada, cancela reservas em aberto e
exige digitar CONFIRMO. Fica registrado no histórico de cada lote.

Na tela de uma peça (Usar peça), um atalho novo: "Usar todo o estoque agora"
mostra quantas barras e de qual comprimento serão baixadas, avisa que não
gera sobra nova, e confirma com um toque — sem precisar informar
comprimento de corte e quantidade. Útil para dar baixa em material novo ou
corrigir cadastro feito no perfil errado. Afeta só a peça aberta (um
comprimento, um acabamento), nunca as outras cores do mesmo perfil.

---

## 1.6.71 — 22/08/2026

**Card da lista técnica segue o mesmo padrão do card de estoque.**

Código do perfil em azul negrito, descrição na mesma linha com quebra de até 2
linhas (sem cortar), dados de corte e estoque numa linha abaixo. Também corrigido
o código do produto na tela de Produtos que ficava cortando e escondendo os botões
de editar e arquivar.

---

## 1.6.70 — 22/08/2026

**Procurar e Produtos na barra de navegação inferior.**

Dois atalhos novos na barra do celular: "Procurar" (ao lado de Utilizar) abre a
busca de sobras por medida ou código; "Produtos" (ao lado de Reservas) abre a
lista de produtos e listas técnicas. A barra passa de 5 para 7 botões.

---

## 1.6.69 — 22/08/2026

**Corrigido: sobra aproveitável sumia do estoque quando um pedido usava mais
de uma peça.**

Quando os cortes passaram a ser contados como cortes — "preciso de 7 pedaços
de 1 m" —, o sistema começou a distribuir esses cortes entre várias peças.
Mas o fechamento do corte continuou gravando UM comprimento de resto para
todas elas.

O problema é que a última peça quase nunca leva a mesma quantidade de cortes
das anteriores. Sete cortes de 1 m em peças de 6 m: a primeira leva 5 e sobra
985 mm, a segunda leva 2 e sobra 3.994 mm. O sistema registrava 985 mm para as
duas — **3 metros de perfil bom desapareciam do estoque a cada corte assim**,
que é exatamente o desperdício que este aplicativo existe para evitar.

Agora o aplicativo calcula o resto de cada grupo de peças e o banco cria um
lote de sobra para cada um, com o seu próprio código. A tela de confirmação
mostra a divisão peça por peça antes de você confirmar, e a mensagem final
nomeia cada sobra gerada — são peças diferentes na prateleira, e quem vai
guardá-las precisa saber qual é qual.

O banco agora recusa o fechamento se os restos informados não somarem
exatamente as peças reservadas: divergência ali viraria estoque inventado ou
sumido, em silêncio.

**A tela de busca passou a mostrar o total que volta.** Ela dizia "sobram 985
mm da primeira peça" — verdade, mas subestimava o retorno em 3 metros
justamente no caso que mais rende. Agora diz "voltam ao estoque 4.979 mm no
total — 1 de 985 mm e 1 de 3.994 mm", peça por peça.

A busca e a confirmação do corte passaram a usar **o mesmo cálculo** de
distribuição. Antes eram duas contas parecidas em lugares diferentes, e era
disso que vinha a divergência entre o que a tela prometia e o que o estoque
gravava.

Reservas antigas continuam sendo fechadas como antes — no modelo delas, "N
peças com um corte cada", todas terminavam iguais mesmo.

Migração `20260822230000_resto_por_peca.sql`, já aplicada e conferida no
banco: a chamada nova (com a lista de restos) e a antiga (sem ela) respondem
as duas, então reserva antiga em aberto continua fechando normalmente.

## 1.6.53 — 20/08/2026

**Busca do jeito que se digita: código sem hífen e medidas em qualquer ordem.**

No catálogo o código é "SU-001", mas ninguém digita o hífen com a mão suja e
o celular numa mão só. Digitava-se "su001" e não vinha nada — a busca
comparava o texto cru, e "su001" não está contido em "SU-001". Quem não
achava concluía que o perfil não estava cadastrado. Agora "su001", "SU 001",
"su-001" e até "su1" chegam todos ao SU-001, e continuar digitando não faz a
lista piscar vazia no meio do caminho.

**"su1" acha o SU-001 sem arrastar meia dúzia de vizinhos junto**: a forma
sem zeros à esquerda é comparada por igualdade, não por trecho — senão
SU-011 e SU-013 entrariam na lista e o perfil procurado se perderia neles.

**Medidas em qualquer ordem.** Com a ponta na mão, o serralheiro mede o que
dá para medir e digita: "35 25 20", "25 35", "20 25" — todas encontram o
SU-079, que é 35 × 25 × 20. A ordem é a que ele mediu, não a que o cadastro
guardou; cobrar uma ordem seria cobrar que ele adivinhasse qual medida o
catálogo chama de largura. Vale também "35x25", como se escreve em desenho.

A tolerância aqui é mais apertada (6%) que a da tela de identificar (12%):
lá a pessoa está com trena numa ponta cortada, aqui ela digita números que
leu ou decorou — e 12% devolvia vinte perfis para "20 25", uma lista que não
estreita nada. Com dois números "20 25" traz 8 dos 370 perfis do catálogo.

Um número só não dispara busca por medida: "25" é medida, mas também é a
linha 25 e pedaço de vários códigos — a busca por texto já dá conta.

**O desenho do produto na linha da lista, como já era na de perfis.**

A lista de produtos mostrava só nome e código — e o código, longo, saía
cortado ("JAN-INT-1500-1200-2F-PF-P…"), deixando a linha sem nada que se
reconhecesse de relance. Agora cada produto leva o desenho técnico ao lado,
no mesmo quadro de tamanho fixo usado no catálogo de perfis.

Tocar no desenho abre ele em tela cheia, com zoom, e com o nome completo do
produto escrito por cima — é na lista que o nome aparece cortado, e é ao
abrir o desenho que se quer ter certeza de que é o produto certo. O resto da
linha continua abrindo a ficha: são dois alvos distintos, de propósito.

**Abrir uma linha dentro de uma tela virou navegação de verdade.**

Faltava metade da correção do botão voltar. Abrir a linha "Suprema" no
catálogo troca a lista inteira — é mudar de tela aos olhos de quem usa —,
mas era só estado interno: o histórico do navegador nunca soube que aquilo
aconteceu. Então "voltar", indo corretamente para a tela anterior de
verdade, pulava o nível e caía na tela de onde o catálogo tinha sido aberto.
Início → Modelos de perfil → Suprema → Voltar levava para o Início.

Agora esses níveis moram no endereço da tela, e descer um nível é uma
navegação como qualquer outra. Vale para o catálogo (linha → perfis), para o
estoque de sobras (linha → perfis → peças) e para a escolha de perfil ao
cadastrar ou procurar uma sobra.

Isso conserta junto o botão físico de voltar do Android e o gesto de voltar
do navegador, que antes abandonavam a tela inteira — ou o cadastro pela
metade — quando a pessoa só queria subir um degrau. E, como o endereço
passou a descrever o que está na tela, recarregar a página devolve a pessoa
ao mesmo lugar em vez de jogá-la na raiz.

## 1.6.52 — 20/08/2026

**O botão voltar agora volta para onde você realmente estava.**

Uma ficha de perfil abre a partir do catálogo, mas também de uma sobra, de
uma lista técnica, de uma busca — o mesmo destino, vários pontos de partida.
O botão "voltar" de cada tela apontava para um destino fixo, escolhido na
hora de programar a tela (o catálogo, no caso do perfil) — e quem chegasse
por qualquer outro caminho, ao voltar, caía nesse destino fixo em vez de
voltar para onde estava, tendo que refazer o trajeto inteiro de novo.

Agora, existindo uma tela anterior de verdade nesta aba, o botão volta para
ELA — não para o destino fixo. O destino fixo continua existindo, mas só
entra em ação quando a tela abre "do nada" (link externo, atalho salvo, a
primeira tela depois de abrir o aplicativo): aí não existe navegador para
onde voltar, e o destino fixo é a melhor aproximação de onde a pessoa
"deveria" estar.

A correção foi num único lugar — o componente `BotaoVoltar`, usado por todo
o app — porque o problema era o mesmo em toda parte.

**O texto virou "Voltar", neutro, exatamente nesse caso.** Voltando pelo
histórico o destino é a tela anterior de verdade, que pode não ser a que o
rótulo de cada tela nomeia (a ficha do perfil sempre passa "Perfis" como
rótulo, mesmo quando se chega a ela pela lista técnica ou por uma sobra) —
um texto específico apontando pro lugar errado atrapalha mais do que ajuda.
O rótulo original só aparece quando o destino também é o fixo de reserva, e
aí ele volta a ser exato.

## 1.6.51 — 20/08/2026

**A lista de faltas recolhida, e a ordenação com direção invertível.**

**"Não dá com as sobras de hoje" agora abre e fecha.** Numa lista técnica de
doze perfis sem estoque, a resposta virava uma parede de texto entre o botão
de produzir e a lista técnica de verdade. Recolhido, só o título fica à
vista — clicar nele expande a lista do que falta; clicar de novo recolhe.

**Os botões de ordenar agora invertem a direção.** Antes só alternavam entre
"mais estoque" e "A→Z"; tocar de novo no que já está ativo agora inverte —
"mais estoque" vira "menos estoque", "A→Z" vira "Z→A". O ícone de cada botão
muda para mostrar a direção atual.

## 1.6.50 — 20/08/2026

**Ordenar por nome, além de por estoque.**

Toda lista de perfis ou linhas do app já vinha ordenada com o que tem mais
estoque primeiro — o padrão certo para quem procura o que aproveitar, mas não
para quem já sabe o código e quer achá-lo alfabeticamente. Um par de botões
("mais estoque primeiro" / "A→Z") na mesma barra onde já aparecia o nome da
linha e o botão de voltar alterna entre as duas, sem mexer no padrão de
ninguém: continua abrindo por estoque, como sempre abriu.

Aparece nas cinco telas que agrupam por linha: Cadastrar sobra, Procurar
sobra, Modelos de perfil, Estoque de sobras e Linhas e sistemas — esta última
ordenando as próprias linhas, as demais ordenando os perfis (ou, no Estoque de
sobras, só no nível dos perfis — dentro de um perfil já aberto as peças são a
mesma coisa em comprimentos diferentes, sem nome para ordenar).

## 1.6.49 — 20/08/2026

**Corrigir a quantidade de uma sobra já cadastrada.**

Toda mudança de quantidade até aqui nascia de um evento físico: cadastrar,
reservar, cortar. Faltava o outro caso — "digitei 5 no lugar de 2" —, e quem
tentava corrigir esbarrava sem saber onde. Um lápis ao lado da quantidade, na
ficha da própria sobra, abre a correção; **zero é um valor aceito**, e zerar
esvazia o lote e o marca como descartado, em vez de ficar "disponível" com
zero peças, que não diz nada a quem olhar a lista depois.

A correção **exige um motivo** — a mesma exigência que já existia no banco
para esse tipo de movimentação, e que fica registrada no histórico da peça
sem apagar o valor anterior. Não é possível corrigir para menos do que já
está reservado; para isso, cancele a reserva primeiro.

⚠️ Depende da migração `20260820100000_ajustar_quantidade_lote.sql`, ainda
não aplicada no banco.

## 1.6.48 — 20/08/2026

**Usar uma sobra direto da ficha dela, e apagar perfil sem uso.**

**Botão "Usar peça" na ficha da sobra.** O único caminho para dar baixa era
"Procurar sobra", que busca por perfil, cor e comprimento — repetir essa busca
com a peça certa já na tela não fazia sentido para quem chegou até ali pelo
código, pela lista técnica ou por um link. O botão reserva a quantidade ali
mesmo e leva para Reservas, onde continuam os passos de retirar da prateleira
e confirmar o corte — o fluxo em si não mudou, só ganhou uma porta de entrada
a mais.

**Lixeira nos perfis sem uso.** Antes só dava para desativar um modelo de
perfil, nunca apagar de vez. Agora a lista mostra o ícone de lixeira quando —
e só quando — nenhuma sobra (nem consumida) e nenhuma lista técnica apontam
para aquele perfil; é a mesma regra que o banco já aplicava (`on delete
restrict`), só que decidindo ali se mostra o botão, em vez de deixar a pessoa
tentar e esbarrar num erro técnico. Perfil em uso continua só podendo ser
arquivado.

## 1.6.47 — 19/08/2026

**Quatro atalhos na tela inicial, do mesmo tamanho.**

"Modelos de perfil" e "Produtos e listas técnicas" entraram na tela inicial,
ao lado de "Cadastrar sobra" e "Estoque de sobras". Antes só existiam pelo
menu Mais — dois toques a mais para chegar ao catálogo que se consulta o dia
inteiro.

**Todos com a mesma medida.** Antes eram dois botões de tamanhos diferentes:
o de cadastrar sobra tinha o dobro do outro, porque era a ação do dia a dia.
Com quatro destinos, tamanho diferente vira hierarquia inventada — quem abre
o aplicativo para consultar o catálogo não está fazendo nada menos importante
do que quem vai lançar uma peça. E alvo menor que os vizinhos erra mais, com
o celular na mão e às vezes de luva.

**A cor distingue o que cada um faz**, em tons escuros de matizes próximos:
são atalhos da mesma família, e cores berrantes e distintas fariam a tela
inicial parecer um painel de alertas.

## 1.6.46 — 19/08/2026

**A folha impressa: marca d'água espalhada, logo maior, cabeçalho que repete
de verdade e imagens grandes.**

**O cabeçalho só saía na primeira página.** A técnica estava errada:
`position: fixed` deveria repetir a cada folha e no Chrome não repete. Agora
ele vive num `<thead>` da tabela que envolve a folha inteira — o navegador
redesenha o `thead` a cada quebra de página, que é o mesmo mecanismo pelo
qual os títulos da tabela da lista técnica já se repetiam.

**A marca d'água virou uma grade inclinada** de logos pequenas, cobrindo a
folha toda, em vez de uma só grande no centro. Espalhada, ela marca o papel
sem criar uma mancha atrás de um trecho específico do conteúdo; inclinada a
30°, não se confunde com o texto, que é horizontal. A grade é maior que a
página e deslocada — girada, uma do tamanho exato deixaria os cantos vazios.

**O logo do cabeçalho ficou maior e completo**, com nome e assinatura: a
folha circula fora da empresa, e o símbolo sozinho não diz de onde veio. Os
dados do produto foram para a direita, alinhados a ele.

**O logo do cabeçalho tem 30 mm de altura** — o dobro do tamanho anterior — e
os dados do produto cresceram junto. O nome do produto é o que identifica a
folha na bancada; em corpo miúdo ao lado de uma marca grande, ele virava
legenda da marca. Nome, código e medida guardam a hierarquia entre si.

**Cada imagem ocupa um terço da largura útil**, tenha a folha uma imagem ou
seis, com até três por fileira e o excesso quebrando para baixo. Fração fixa,
e não proporcional à quantidade: assim duas não ficam gigantes nem três
minúsculas, e o mesmo desenho não muda de tamanho conforme o produto tenha
foto ou não — o que atrapalharia justamente quem usa a folha para conferir
contra a peça.

O respiro entre elas vem de um recuo por dentro do terço, e não de espaço
entre os blocos: com espaço externo, três não caberiam mais na linha. Havendo
só duas, elas ficam centralizadas com esse mesmo respiro no meio.

## 1.6.45 — 19/08/2026

**Ordenar a lista técnica por um critério, e o estoque marcado na folha
impressa.**

**Quatro ordenações automáticas**, no alto da lista: por código do perfil,
por linha e depois código, do corte mais longo ao mais curto, e o que tem
sobra em estoque primeiro.

Não briga com o arrastar — serve ao arrastar. Uma lista recém-digitada, com
vinte cortes lançados na ordem em que vieram à cabeça, precisa primeiro de
uma organização qualquer; arrastar vinte linhas uma a uma é trabalho que uma
regra faz num toque. Depois se arrasta o que ficou fora de lugar.

**Aplicar um critério reescreve a ordem gravada**, não é filtro de exibição.
Fosse só visual, a folha impressa sairia diferente da tela e a lista voltaria
ao estado antigo ao recarregar — desfazendo, sem avisar, o que a pessoa
acabou de organizar. Por isso também o campo volta ao rótulo neutro depois de
aplicar: é um comando, não um estado.

Todo critério desempata pelo código e depois pelo comprimento. Sem isso, dois
itens equivalentes trocariam de lugar a cada aplicação, e a lista pareceria
embaralhar sozinha.

Ordenar "por estoque" olha só se HÁ ou não sobra, não quantas peças. Cinco
peças não são melhores que duas quando as duas bastam, e ordenar pela
quantidade colocaria o perfil abundante antes do que está no limite — que é
justamente o que merece atenção.

**Na folha impressa**, uma coluna marca o que já existe no depósito: ● tem
sobra, ○ não tem, com a legenda no rodapé. Ponto cheio ou vazio em vez de
ícone porque a folha sai em impressora comum, muitas vezes preto e branco.

## 1.6.44 — 19/08/2026

**Arrastar para ordenar a lista técnica, e a folha do produto com
numeração, logo e marca d'água.**

⚠️ **Uma migração:** `20260819100000_ordem_da_lista_tecnica.sql`.

**A sequência dos cortes passou a ser escolhida.** A lista técnica é lida na
bancada de cima para baixo, e a sequência em que os cortes aparecem é a
sequência em que se vai serrar — marco primeiro, depois folha, depois
baguete. Ordenada por data de cadastro, ela refletia a ordem em que alguém
lembrou dos perfis, que não é a ordem do trabalho.

Cada linha ganhou uma alça à esquerda. Arrastar move; soltar grava.

**A alça, e não a linha inteira**: arrastar de qualquer ponto tornaria
impossível tocar no desenho ou abrir a ficha sem mover a linha sem querer.

**Eventos de ponteiro, e não o arrastar nativo do HTML.** A API `draggable`
não existe no toque: no celular, segurar e mover rolaria a página e nada
aconteceria — justamente onde o aplicativo é mais usado. Ponteiro trata
dedo, caneta e mouse pelo mesmo caminho.

A ordem é gravada só ao soltar. Arrastar do fim para o começo passa por
todas as posições intermediárias, e cada uma viraria uma ida ao servidor.

**Na folha impressa**, três acréscimos:

**Numeração dos cortes.** Serve à conversa na oficina: "o item 7 está errado"
resolve o que "aquele marco de 1.455" não resolve quando há três cortes
parecidos.

**Cabeçalho com a logo, repetido em todas as páginas.** Uma lista longa vira
duas ou três folhas, e a segunda sem identificação é uma tabela de números
que ninguém sabe de que produto é.

**A logo como marca d'água**, bem apagada. Identifica a folha que circula
solta pela oficina sem disputar com o conteúdo — quem lê está procurando uma
medida. Foi preciso obrigar o navegador a imprimi-la: por padrão ele descarta
fundos para poupar tinta, e a marca sumiria.

## 1.6.43 — 18/08/2026

**Lápis em cada corte da lista técnica.**

Não havia como corrigir um corte: errar a quantidade ou o comprimento
obrigava a remover a linha e lançá-la de novo — e quem fizesse isso no meio
de uma lista longa perdia a posição. Agora cada linha tem lápis ao lado da
lixeira, e ele abre o mesmo formulário do "Acrescentar corte", já preenchido.

O mesmo formulário para as duas coisas porque são os mesmos três campos:
perfil, comprimento e quantidade. Um segundo modal só para editar divergiria
do primeiro na primeira mudança.

O que muda entre um caso e outro é o que acontece ao salvar. **Corrigir é uma
tarefa que termina**, então o modal fecha. **Acrescentar é uma tarefa que se
repete** — quem monta uma receita lança um corte atrás do outro —, então ele
fica aberto, com o perfil ainda escolhido e só a medida e a quantidade
limpas.

Pelo mesmo motivo o botão de sair muda de nome: "Cancelar" ao corrigir, onde
há uma alteração pendente a descartar; "Fechar" ao acrescentar, onde o que já
foi lançado está gravado e não há o que cancelar.

## 1.6.42 — 18/08/2026

**Folha do produto em PDF, para levar à bancada.**

Na tela do produto, ao lado do lápis, um botão gera a folha com tudo que quem
monta precisa: nome, código, medida, foto do produto pronto, desenho técnico
e a lista técnica completa.

**O desenho de cada perfil sai grande na tabela** — bem maior que a miniatura
da tela. É por ele que se confere o corte contra a barra na bancada, e uma
imagem de 40 px não serve para isso. Foi o motivo de a folha existir separada
da tela em vez de mandar a tela para a impressora.

**Impressão do navegador, e não uma biblioteca de PDF.** "Salvar como PDF" já
existe no diálogo de impressão do Android, do iPhone e do computador — é o
mesmo caminho da etiqueta da sobra, que a oficina já usa. Uma biblioteca como
jsPDF somaria centenas de kilobytes ao pacote para refazer, pior, o que o
sistema faz de graça: fontes, quebra de página, margens.

Em troca, quem quer o arquivo escolhe "Salvar como PDF" no diálogo em vez de
receber o download direto.

Detalhes que o papel exige: as linhas da tabela não se partem entre páginas —
o desenho ficaria numa e a medida na outra —, e a folha sai preto no branco
mesmo com o aplicativo no tema escuro, para não gastar tinta imprimindo fundo
preto.

A folha só é montada quando se pede. Deixá-la sempre pronta faria toda visita
ao produto baixar as imagens em tamanho de impressão.

## 1.6.41 — 18/08/2026

**Imagens cortadas no iPhone.**

No aplicativo instalado, a foto do produto e o desenho técnico apareciam
cortados — nem sempre, o que é a assinatura do problema.

A altura estava na IMAGEM (`max-height`), não na caixa. Assim o Safari
precisa da proporção do arquivo para decidir quanto espaço reservar, e ele
decide antes de o arquivo chegar. Quando chega, nem sempre refaz a conta — e
o que ficou reservado corta o que veio. Como as imagens vêm de link temporário
do armazenamento, a demora varia, e por isso o corte era intermitente.

Agora a caixa tem altura fixa e a imagem preenche o que houver com
`object-contain`. Não há mais conta a refazer: cabe inteira, sempre.

Valia para os três lugares com o mesmo padrão — foto e desenho do produto,
foto da peça na tela da sobra, e a prévia do que acaba de ser enviado em
qualquer campo de foto. Os visualizadores em tela cheia não sofriam disso: a
altura deles vem do próprio container que ocupa a tela.

## 1.6.40 — 18/08/2026

**Medida que não apagava, olho na senha, zoom nas imagens do produto e cor no
cadastro de sobras.**

**Apagar uma medida do perfil não funcionava.** O campo era limpo, o
formulário salvava, e o valor antigo reaparecia. A causa: uma função tirava
`medida_3_secao_mm` e `medida_4_secao_mm` do envio quando vinham vazias — ela
existia porque, antes da migração que criou essas colunas, mandá-las fazia o
banco recusar a gravação inteira.

O efeito colateral era silencioso e grave: quem corrigiu uma medida errada
acreditava ter corrigido. A migração está aplicada; nulo agora significa
nulo.

**Olho para ver a senha**, em todas as telas onde se digita uma: entrada,
primeiro acesso e definição de senha. Sem ver o que se digitou, o único
retorno possível é "e-mail ou senha incorretos" — que não diz se o erro foi
na senha, no e-mail ou num toque que virou dois caracteres. Não volta a
esconder sozinho: quem mostrou quer conferir com calma.

**Foto e desenho do produto abrem em tela cheia**, com o mesmo zoom de pinça
dos desenhos de perfil. Antes o toque não fazia nada. As legendas passaram a
dizer "toque para ampliar" — não havia nada indicando que eram clicáveis.

**A bolinha da cor ao lado do acabamento**, no cadastro de sobras e no resumo
de conferência. "Bronze", "Amadeirado marrom" e "Preto fosco" se confundem na
pressa, e quem lança a sobra tem a peça na mão: a amostra de cor decide mais
rápido que a leitura. O nome continua ao lado — cor não distingue para quem
não enxerga diferença entre tons.

Ela fica FORA do seletor porque `<option>` não aceita fundo colorido de forma
confiável, e no iPhone o menu é desenhado pelo sistema, que ignora estilo.

**Dois acertos de tela.** O cartão verde e vermelho da lista técnica ficava
ilegível no escuro: fundo claro fixo com o texto claro do tema. Agora são
tokens que invertem — verde e vermelho escuros, texto claro por cima. E o
seletor de cor no iPhone aparecia menor que os vizinhos, com as duas setinhas
do controle nativo; ganhou `appearance-none` e seta desenhada, como os demais
campos de seleção do app.

## 1.6.39 — 18/08/2026

**Perfil digitável ao acrescentar corte, e o campo de cor inteiro no
celular.**

**O campo Perfil só aceitava escolher da lista.** O catálogo passa de oitenta
perfis, e rolar até o MN-007 numa lista suspensa de celular é pior do que
digitar "MN-0". Agora é campo de texto com sugestões — digitando "MN-0", a
lista fica só com os seis da série. Quem prefere escolher continua podendo: a
lista abre ao tocar no campo.

É o mesmo componente usado nos campos de linha e fabricante, que já resolve o
problema de lista suspensa dentro de modal — o Chromium desenha o menu do
`datalist` abaixo da camada do `<dialog>`, e as sugestões existiriam sem
ninguém nunca as ver.

O texto digitado é guardado à parte do perfil escolhido: enquanto se digita
"MN-0" nenhum perfil está selecionado, e fazer o id acompanhar cada tecla
escolheria o primeiro parecido sem ninguém ter pedido. Texto pela metade
deixa a escolha vazia, e o botão avisa que falta escolher.

**O campo de cor ocupa a largura toda no celular** e volta para a linha dos
outros controles no computador, onde sobra espaço. Sozinho na segunda
fileira, um campo estreito deixava um vazio à direita e ainda cortava nomes
como "Amadeirado marrom".

## 1.6.38 — 18/08/2026

**Código do perfil conferido enquanto se digita, e a cor como opção no
cálculo de produção.**

**O código repetido só era acusado ao salvar**, pelo erro do banco, depois de
a pessoa ter preenchido o formulário inteiro. Agora, a cada tecla: o campo
fica vermelho com "Já existe: MN-002 — Marco intermediário" e o Salvar
desabilita.

E abaixo do campo aparecem os códigos da mesma série — digitando `MN-0`,
mostra MN-001, MN-002, MN-032… É o catálogo aberto ao lado da bancada: dá
para ver qual número está livre antes de escolher.

A comparação **ignora maiúsculas e espaços**. O banco distingue `MN-003` de
`mn-003` e aceitaria os dois; para quem usa são o mesmo perfil, e esse é o
pior caso possível — a busca acha um, a sobra é lançada no outro, e o estoque
fica dividido entre dois cadastros que ninguém percebe serem iguais. Perfis
inativos também bloqueiam o código: continuam ocupando ele.

**A cor da linha estava mentindo.** Um corte com material sobrando aparecia
em vermelho. A cor vinha do cálculo da peça inteira, que exige um acabamento
só — e o número entre parênteses, que soma todos, dizia o contrário. Número e
cor contando histórias diferentes.

Agora são duas perguntas separadas: cada linha responde por si ("tenho
material para este corte?"), e o veredito responde pela peça ("dá para montar
a janela?"). Cortes do mesmo perfil continuam resolvidos juntos, porque
disputam as mesmas peças.

**"Mesma cor" virou opção, ligada por padrão.** Ligada, é a verdade da
oficina: ninguém entrega janela com o marco branco e a folha preta.
Desligada, responde a pergunta anterior — "tenho o material, independente da
cor?" —, que é o que se quer saber antes de decidir mandar pintar. E há um
seletor para fixar uma cor específica em vez de deixar o sistema escolher a
que rende mais.

Quando só o acabamento impede, o veredito passa a dizer isso. Ver a lista
toda verde e "não dá" em cima seria incompreensível sem a frase.

## 1.6.37 — 18/08/2026

**Editar na ficha do perfil, e a ordem por estoque valendo no app inteiro.**

**Lápis na ficha do perfil**, para quem pode mexer nos cadastros. Quem chegou
ali pela lista técnica de um produto ou por uma sobra está justamente olhando
o dado que quer corrigir; voltar ao catálogo para achá-lo de novo é trabalho
que a ficha pode poupar.

O formulário virou um componente usado nos dois lugares — mesmo motivo do
formulário de produto: duas cópias divergiriam na primeira mudança. Ele passou
a buscar as próprias sugestões de linha, fabricante e aplicação, em vez de
recebê-las: são três consultas que existem só por causa daqueles campos, e
passá-las de fora obrigaria cada tela a saber disso.

**A ordem por estoque agora vale em todas as listas de linha e de perfil**:
catálogo de perfis, cadastro de linhas, seletor de perfil e estoque de sobras.
Quem tem mais material aparece primeiro, com metros e peças ao lado.

Em ordem alfabética, a linha com duas pontas esquecidas vinha antes da que
tem 121 peças. Quem abre qualquer uma dessas telas quase sempre quer o que há
em quantidade — e para achar um item específico existe a busca, que continua
ignorando o agrupamento.

Perfil sem nada no depósito mostra "sem estoque", e não zero: é informação de
que aquela peça não está lá hoje, diferente de um número que se confunde com
medida.

## 1.6.36 — 18/08/2026

**"E se forem cinco?" — a quantidade a produzir na tela do produto.**

Ao lado do botão Editar, encostado na margem direita, um campo de quantidade
com mais e menos. Padrão 1, porque a pergunta mais comum é "dá para fazer
esta janela?" — só quando a resposta é sim é que se pergunta "e três?".

**Cada linha da lista técnica diz se fecha.** Verde claro quando o estoque
cobre aquele corte na quantidade pedida, vermelho claro quando não. Tons
claros de propósito: a lista inteira fica colorida, e cor forte em tudo cansa
a vista e deixa de significar alguma coisa.

**E mostra o que há daquele perfil**, entre parênteses depois da medida:
`1 × 1.455 mm (2 pç / 3,0 m)`. É contexto — diz se há matéria-prima por perto
—, enquanto a cor responde se ela serve para este corte nesta quantidade.

**O veredito passou a responder sobre o pedido**, não sobre a unidade
seguinte. "Não dá para as 5 unidades" com a lista do que falta para as cinco,
e não do que faltou para a sexta. Quando dá, e o estoque permite mais, ele
avisa: "o estoque de hoje dá para até 7 no total" — é a informação que faz a
sobra virar venda maior. Quando não dá para cinco mas dá para duas, diz isso
também: resolve metade do pedido enquanto o material novo não chega.

Por dentro, o pedido é calculado como UMA unidade grande — cada corte
multiplicado pela quantidade. É o que produz as faltas certas: perguntar
"quantas unidades saem" devolve o que faltou para a unidade seguinte,
informação boa para "dá para mais uma?" e inútil para "dá para as cinco que o
cliente pediu?".

## 1.6.35 — 18/08/2026

**Material contado duas vezes: aviso no cadastro e faxina no que já existe.**

⚠️ **Mais uma migração:** `20260818160000_somar_ao_lote.sql`.

Quem cadastra uma remessa nova do que já está na prateleira acabava criando
um segundo lote. O depósito passava a ter dois códigos, duas etiquetas e duas
prateleiras possíveis para peças que são a mesma coisa — e quem procura
material via "8 peças" e "51 peças" em vez de 59, desistindo de um corte que
caberia.

**No cadastro**, ao escolher perfil, acabamento e comprimento, o sistema
avisa se já existe lote igual e oferece somar: "Já existe SB-87GN com 51
peças. Somando, ele passa a ter 59."

O aviso **não bloqueia**. Há motivo legítimo para manter separado — uma
remessa com defeito que vai voltar para o fornecedor, por exemplo. Quem
decide é quem está com as peças na mão; o botão de cadastrar separado
continua ali, só deixa de ser o primeiro.

**Lotes repetidos**, em Sobras, encontra o que já foi cadastrado em dobro e
junta. O aviso resolve daqui para a frente; o estoque atual foi montado antes
dele, por importação de planilha ou por duas pessoas lançando a mesma
remessa.

### O que define "a mesma coisa"

Perfil, acabamento e comprimento. Nada além disso — é o que decide se as
peças são intercambiáveis na hora do corte. Comprimento é comparação
**exata**: 5.980 mm não é 6.000, e quem contar com os 20 mm a mais descobre
no meio do corte.

A localização fica de fora de propósito: peças iguais em prateleiras
diferentes ainda são a mesma coisa para quem procura material.

### Juntar não apaga nada

As peças passam para o lote mais antigo — o que já está etiquetado na
prateleira e conhecido pela equipe — e o esvaziado fica registrado como
consumido, com duas movimentações de transferência ligando um ao outro. Dá
para reconstituir o que aconteceu.

Lote com peça **reservada** fica de fora: a reserva aponta para ele, e mover
as peças a deixaria apontando para o vazio.

**Tudo numa transação só no banco.** Somar num lugar e encerrar noutro, em
duas chamadas, deixaria o material contado em dobro ou sumido se a rede
caísse no meio — e sumir é o pior tipo de erro num depósito, porque só
aparece quando alguém vai buscar a peça. O banco confere o trio de novo, por
conta própria: a tela pode estar mostrando dados de um minuto atrás.

## 1.6.34 — 18/08/2026

**O estoque ordenado por quem tem mais, e o destaque legível no escuro.**

**O texto sumia no tema escuro.** O cartão de comprimento e quantidade usava
tons fixos da paleta — fundo claro com texto escuro. No escuro, o fundo
inverte e o texto não: sobrava texto escuro sobre fundo escuro, apagado
justamente no tema que se usa no depósito. Passou a usar os tokens de
destaque, que já invertem os papéis. O mesmo valia para o veredito de
produção e o aviso da tela "O que dá para produzir".

**As listas seguem o tamanho do estoque.** Em ordem alfabética, a linha com
duas pontas esquecidas aparecia antes da que tem 121 peças. Quem abre o
estoque quase sempre quer o que há em quantidade — é ali que existe o que
aproveitar. A ordem alfabética serve a quem procura um item específico, e
para isso existe a busca.

**Um nível novo: linha → perfil → peças.** A linha abre a lista de PERFIS,
cada um com o total em metros e o total de peças, do maior para o menor.
Antes ela despejava todas as peças da linha de uma vez — 121, no caso da
Suprema — e achar as de um perfil no meio disso era o mesmo trabalho que o
agrupamento por linha veio resolver um nível acima.

**Metros E peças, sempre juntos.** Um número sozinho engana: 30 metros podem
ser uma barra inteira ou dez pontas de três metros, e a diferença decide se
cabe o corte.

**A conta usa só o que está disponível** — peça reservada tem dono, e
consumida ou descartada não está mais na prateleira. As peças continuam
todas visíveis nas listas; o que muda é a conta que decide a ordem.

**O seletor de perfil também.** Ao cadastrar uma sobra, linhas e perfis
aparecem na mesma ordem e mostram quanto há de cada um — o perfil que a
empresa mais tem é o que ela mais usa, logo o mais provável de ser o
próximo. Perfil sem estoque diz "sem estoque", e não zero: é informação de
que aquela peça não está no depósito hoje, e quem lança sabe que vai ser a
primeira.

## 1.6.33 — 18/08/2026

**Foto e desenho no cadastro do produto, e a lista técnica já no primeiro
momento.**

⚠️ **Mais uma migração:** `20260818150000_imagens_do_produto.sql`.

**Duas imagens, e não uma.** Elas respondem a perguntas diferentes: a FOTO é
a janela pronta, do jeito que o cliente vai ver — serve para mostrar no
balcão e para conferir se o que saiu da oficina é o que foi combinado. O
DESENHO é o esquema com as cotas, que quem monta consulta na bancada. Um
campo só obrigaria a escolher qual perder.

O desenho é comprimido com mais resolução que a foto, pelo mesmo motivo dos
desenhos de perfil: aqui há cota para ler, e quem lê está dando zoom.

Ambas opcionais. Não vale travar o cadastro de uma janela por falta de
retrato dela.

**Produto novo cai direto na lista técnica**, com o formulário do primeiro
corte já aberto. Sem lista, o produto não responde a nada — a tela de
viabilidade só sabe dizer "sem lista" — e quem acabou de cadastrar uma janela
acabou de pensar nos perfis dela. Voltar à lista de produtos naquele momento
era interromper o raciocínio no meio.

O `?montar=1` que abre o formulário sai da URL em seguida: sem isso,
recarregar a página ou voltar a ela pelo histórico reabriria o formulário sem
ninguém ter pedido.

**Lápis na tela do produto**, para corrigir código, nome, medida e imagens
sem voltar para a lista. E as duas imagens aparecem ali, lado a lado, com
legenda — a foto do produto pronto e o desenho técnico.

O formulário virou um componente usado nos dois lugares. São o MESMO
formulário: quem corrigiu a medida de uma janela espera encontrar os campos
que usou para criá-la. Duas cópias divergiriam na primeira mudança — um campo
novo entraria no cadastro e faltaria na edição, e ninguém notaria até alguém
precisar corrigir justamente aquele campo.

A lista técnica ficou FORA desse componente, na tela do produto. Um produto
que ainda não existe não tem onde pendurar cortes, e guardá-los em memória
para gravar depois criaria dois caminhos diferentes para a mesma coisa.

## 1.6.32 — 18/08/2026

**O menu "Mais" em duas seções, e o aviso de acesso que piscava a cada
login.**

**"Usuário não autorizado" aparecia num relâmpago e sumia.** Não era
enfeite mal colocado: quando a senha é aceita, o Supabase registra a sessão
na hora, mas o perfil da pessoa só chega numa segunda ida ao servidor. Entre
uma coisa e outra havia sessão e nenhum perfil — e a tela protegida lê isso
como "autenticado e sem acesso", que é exatamente o estado de quem foi
barrado. Quem entrava certo via a acusação de um problema inexistente.

Perfil nulo tinha dois significados misturados: "ainda não sei" e "procurei
e não achei". Agora são distintos — enquanto a busca acontece, aparece o
girador; o aviso só surge depois de procurar e não achar.

Isso pedia um cuidado: o Supabase renova o token de hora em hora e cada
renovação passa pelo mesmo caminho. Marcar "carregando" sempre trocaria o
pisca do login por um pisca no meio do trabalho. Havendo perfil, a
revalidação corre em silêncio.

**O menu virou Fabricação e Administração.** A lista era uma só, na ordem em
que as telas foram nascendo: "Clientes" caía em segundo lugar e empurrava
"Modelos de perfil" e "Linhas" para baixo — cadastro de escritório separando
duas telas que se usam juntas.

A seção de fabricação agora segue a ordem do trabalho: do material que
existe (sobras) para o que ele pode virar (produtos, viabilidade), e depois o
que descreve e localiza esse material. Ela tem fundo próprio, mais escuro. A
cor é o que distingue de longe: no depósito, com o celular na mão e às vezes
de luva, ninguém lê o subtítulo da seção antes de tocar.

## 1.6.31 — 18/08/2026

**Produtos com lista técnica, e a resposta que o sistema existe para dar:
"dá para fabricar isto com as sobras?".**

⚠️ **Mais uma migração:** `20260818140000_produtos_e_lista_tecnica.sql`.

Até aqui o RePerfil sabia o que havia no depósito e não sabia o que fazer com
aquilo. A pergunta que aparece no balcão é outra: "chegou um pedido de janela
integrada 1,50 × 1,00 — dá com o que está na prateleira, ou preciso comprar
barra?" Responder isso exigia alguém que soubesse a receita de cabeça E
lembrasse do estoque, duas memórias que raramente estão na mesma pessoa no
mesmo dia.

**Produtos.** Cadastro do que a empresa fabrica, com código, nome e a medida
do produto ACABADO — como o cliente pede. Os cortes ficam na lista técnica,
porque nunca batem com a medida externa: há folga, encaixe e sobreposição no
meio.

**Lista técnica.** Uma linha por corte: perfil, comprimento e quantidade
**por unidade**. A quantidade responde "quantas peças destas entram em uma
janela?", nunca "quantas comprar" — guardar o total de um pedido aqui
misturaria a receita com a encomenda, e a receita seria reescrita a cada
venda.

**O que dá para produzir.** A pergunta invertida: em vez de "dá para fazer
esta janela?", "o que dá para fazer com o que está na prateleira?". Cada
produto aparece com o número de unidades que sai das sobras de hoje.

### Três decisões que mudam o resultado

**O acabamento separa tudo.** Ninguém entrega uma janela com o marco branco e
a folha preta. Não basta ter metros suficientes: eles precisam estar no mesmo
acabamento. O cálculo roda uma vez por acabamento e devolve o melhor — e é
por isso que a resposta pode ser "2 em branco" mesmo havendo material de
sobra em preto.

**Peça reservada não conta.** Ela já tem dono. Prometer uma janela com o
material que outra obra está esperando é criar o conflito na oficina, não
evitá-lo.

**O número é um piso, não um teto.** Distribuir cortes entre peças da melhor
forma possível é o problema do empacotamento, que não tem solução rápida e
exata. O cálculo atende os cortes do maior para o menor, cada um consumindo a
menor sobra em que ainda cabe. Ele nunca promete o que não cabe, mas pode
deixar de achar um arranjo melhor — então a tela diz "dá para fazer **pelo
menos** 2". Prometer a mais seria muito pior: alguém corta a primeira peça e
descobre no meio do serviço que falta material.

E a serra entra na conta, pelo mesmo cálculo que a tela de corte já usava.
Dois cortes de 3 m numa peça de 6 m não caberem é o tipo de detalhe que, se
ignorado, promete uma janela que não sai.

### Sobre a Fase 2

A Fase 2 do roadmap prevê tipologias **paramétricas**: informa-se largura e
altura e fórmulas versionadas calculam os cortes. Isto aqui é o degrau
anterior — a lista é digitada à mão, para uma medida fixa.

Não é desperdício. Quando as fórmulas existirem, elas passam a GERAR estas
linhas, e a tela de viabilidade continua a mesma. O caminho contrário exigiria
acertar o motor de regras antes de a empresa ter usado a coisa mais simples
uma vez.

## 1.6.30 — 18/08/2026

**Foto do colaborador, CPF, e a tela de cadastro só editando quando se pede.**

⚠️ **Mais uma migração:** `20260818130000_foto_e_cpf_do_colaborador.sql`.

**A foto.** O histórico de uma peça diz "quem cadastrou: J. Silva". Numa
empresa com dois Silvas isso não identifica ninguém — e é justamente quando
algo deu errado que se vai olhar. Agora o cadastro tem retrato, e ele
aparece ao lado do nome; sem foto, ficam as iniciais, que já separam a Ana
do Bruno melhor do que um ícone igual para todos.

**Ela é exigida para entrar**, e a exigência vale para quem já usava o
sistema antes dela existir. Um histórico onde metade das pessoas tem rosto e
a outra metade não responde à pergunta pela metade. Quem entra sem foto cai
numa tela que mostra o cadastro para conferência — nome e telefone foram
digitados pelo administrador, de cabeça, no momento do convite — e pede o
retrato para concluir.

Pedir a foto depois, num sistema que já funciona, seria pedir para nunca:
ninguém volta a uma tela que não precisa.

**As permissões pararam de ficar editáveis o tempo todo.** A tela abria com
as caixas marcáveis à mostra, numa página que se abre para consultar — e
mudar permissão de colega não é coisa que se faça sem querer. Agora, fora da
edição, é uma lista curta do que a pessoa PODE; as caixas só aparecem depois
do botão Editar.

**Os três botões numa linha.** Em tela estreita, "Tirar acesso" quebrava
para a fileira de baixo e ficava parecendo outra coisa. Ficaram menores e
mais curtos — Editar, Senha, Desligar — e agora se leem como um conjunto.

**CPF** entrou no cadastro do colaborador, opcional: serve ao cadastro de
pessoal da empresa, e nada no sistema depende dele. Exigir documento de quem
só vai procurar uma sobra seria pedir dado sensível sem ter o que fazer com
ele.

**E-mail conferido** no convite e no cadastro de clientes. A regra é
deliberadamente frouxa: pega espaço no meio, arroba faltando e domínio sem
ponto, mas aceita endereço de forma estranha. Validação rígida rejeita
e-mail legítimo, e aí a pessoa não tem como convencer o sistema de que o
próprio endereço existe.

## 1.6.29 — 18/08/2026

**Cadastro do colaborador em tela própria, máscaras nos documentos e a peça
com o essencial em destaque.**

⚠️ **Mais uma migração:** `20260818120000_acessos_ao_sistema.sql`.

**A tela do colaborador.** A lista fazia tudo — trocar cargo, ajustar
permissão, ligar e desligar — e ficava larga demais para caber num celular.
Agora ela mostra só nome, e-mail, cargo e o botão de acesso; tocar na linha
abre o cadastro, e é lá que se edita.

Dentro, o botão **Editar** aparece para quem administra e também para o
próprio dono do cadastro — corrigir o próprio nome e telefone não deveria
depender de pedir a ninguém. Cargo, permissões, senha e acesso continuam
sendo de quem administra. O e-mail não é editável em lugar nenhum: ele é a
identidade da conta, e trocá-lo aqui deixaria o cadastro apontando para um
login que não existe.

**Redefinir senha** manda ao colaborador o e-mail para ele mesmo criar uma
nova. Não é o administrador definindo senha alheia: isso exigiria a chave de
administração do projeto e significaria alguém conhecendo a senha de outra
pessoa.

**Desligado sai da lista**, com um "Exibir inativos" no fim. No fim, e não
no cabeçalho: desligado é exceção, e quem procura por um já leu a lista
inteira sem achar.

**Últimos acessos**, recolhido, com as dez últimas entradas. Só data e hora
— nada de endereço, aparelho ou localização. A pergunta que o administrador
tem é "esta pessoa ainda usa o sistema?", e para isso basta o instante;
guardar mais seria vigiar funcionário, o que não é a função deste sistema.

**Máscara e conferência em CPF, CNPJ e telefone**, no cadastro de clientes e
no de colaboradores. A máscara sozinha só arruma a aparência:
"111.111.111-11" tem cara de CPF e não é CPF nenhum. Agora o dígito
verificador é conferido, e o telefone digitado sem DDD é apontado — o erro
mais comum, porque quem digita esquece que quem vai ligar pode estar noutro
estado.

O aviso não trava o salvamento. Quem cadastra costuma estar copiando de um
papel, e às vezes o papel está errado: travar faria a pessoa inventar um
número para conseguir seguir, o que é pior do que o campo vazio. E o erro só
aparece ao sair do campo — acusar "CPF inválido" desde o primeiro dígito
treina a pessoa a ignorar o aviso justamente quando ele passa a valer.

**A peça, com o que se veio ver em primeiro lugar.** Comprimento e
quantidade saíram do meio de onze linhas iguais e agora abrem a tela em
corpo grande, sobre fundo próprio. São as duas perguntas que trazem alguém
ali: "cabe o meu corte?" e "tem peça suficiente?".

E o bloco "Do perfil" virou **Lista técnica**, recolhido. É conferência, não
o trabalho do dia — o título continua dizendo que a informação está ali, que
é diferente de escondê-la.

## 1.6.28 — 18/08/2026

**E-mails em português, com a marca — e o link deixando de apontar para a
máquina de quem desenvolve.**

⚠️ **Passos no painel do Supabase**, ver `supabase/emails/README.md`.

**Descoberta no caminho:** o Supabase não deixa mais editar template sem
SMTP próprio — o painel mostra "Set up custom SMTP to edit templates" e não
salva nada. Os arquivos ficam prontos para quando houver SMTP. Enquanto
isso, o atalho é desligar "Confirm email": quem barra estranho é o convite,
não a confirmação, e aí não há e-mail nenhum no caminho. O cadastro já
detecta esse caso e entra direto, sem mandar ninguém esperar uma mensagem
que não vem.

O e-mail de confirmação chegava em inglês, sem identidade nenhuma, e quem
recebe é justamente alguém entrando no sistema pela primeira vez — o pior
momento possível para uma mensagem que parece golpe. Agora sai em
português, com o logo e um texto que diz de onde vem e por quê.

O logo usa `{{ .SiteURL }}` em vez de um endereço fixo: o Supabase troca
pela URL do projeto, então a imagem acompanha sozinha se o endereço mudar.
Endereço fixo quebraria calado, e ninguém revisa template de e-mail. O nome
"RePerfil" também aparece em texto logo abaixo, porque boa parte dos
programas de e-mail bloqueia imagem até a pessoa liberar.

**O link que ia para o localhost.** Tocar no link pelo celular levava a
`localhost:5173` — endereço que só existe na máquina de quem desenvolve. O
Supabase monta o link a partir do "Site URL" do projeto, e ele estava
apontando para lá.

O cadastro agora informa a origem de onde a pessoa REALMENTE está, como a
recuperação de senha já fazia. Mas isso só resolve metade: o Supabase
ignora o pedido se o endereço não estiver em Redirect URLs. Os dois ajustes
no painel estão no README.

Também dois arquivos de e-mail: confirmação de cadastro e redefinição de
senha. Não fazia sentido traduzir um e deixar o outro em inglês.

## 1.6.27 — 18/08/2026

**Permissões por pessoa: liberar uma tarefa sem promover ninguém.**

⚠️ **Mais uma migração:** `20260818110000_permissao_de_cadastros.sql`,
depois das duas da versão anterior.

O caso que originou tudo: autorizar o financeiro a cadastrar colaborador
sem torná-lo administrador do sistema. Em **Colaboradores**, o ícone de
chave abre as três permissões da pessoa, com uma caixa cada. Marcar libera
na hora.

A lista passa a mostrar **"ajustado"** em quem foge do padrão do cargo.
Sem isso, dois colaboradores com o mesmo cargo poderiam ter poderes
diferentes sem nada na tela denunciar — e aí ninguém confia no que o cargo
diz.

Ninguém mexe nas próprias permissões: no seu perfil as caixas ficam
desligadas. O banco recusaria de qualquer forma, pelo gatilho contra
autopromoção, e uma caixa que volta sozinha ensina a desconfiar da tela.

**Mexer no catálogo deixou de ser a mesma chave que movimentar estoque.**
Eram a mesma coisa até aqui, e não são. Movimentar estoque é cadastrar a
peça que chegou e dar baixa na que saiu: acontece o dia inteiro, e erro ali
se conserta com um ajuste. Mexer no catálogo é dizer que o perfil FA-239
existe e quanto ele pesa: acontece raramente, e erro ali contamina todo
orçamento futuro.

Ao separar, ninguém perdeu acesso — a migração concede a permissão nova a
todos que já podiam fazer o trabalho.

**Os botões seguem a permissão.** Nas telas de perfis, linhas, acabamentos,
localizações e clientes, quem não pode editar não vê mais os botões de
criar, editar e desativar. Eles já eram recusados pelo banco; o que mudou é
que agora não aparecem — botão que sempre devolve erro ensina a pessoa a
desconfiar da tela inteira.

## 1.6.26 — 18/08/2026

**Colaboradores: cadastro pelo próprio sistema, com cargo.**

⚠️ **Duas migrações, nesta ordem:**
`20260818100000_cargos_de_colaborador.sql` e depois
`20260818100100_colaboradores_e_permissoes.sql`. E um passo no painel do
Supabase — ver `docs/colaboradores-e-permissoes.md`.

Não havia tela nenhuma para administrar quem entra no sistema. Incluir um
colaborador exigia abrir o painel do Supabase, criar o usuário à mão e
rodar um SQL — trabalho de quem construiu o sistema, não de quem toca a
serralheria. O resultado previsível é todo mundo entrando com a mesma
conta de administrador.

Agora existe **Mais → Colaboradores**, com seis cargos: Serralheiro,
Auxiliar, Vendedor, Financeiro, Gerente e Admin.

**Cargo não é permissão.** A tentação era listar cargos dentro de cada
regra de segurança. Funciona no dia em que se escreve e apodrece no
seguinte: criar cargo novo vira migração em dezenas de políticas, e
liberar UMA tarefa para UMA pessoa não teria como ser feito sem
programador.

Então o cargo é ponto de partida — define o que fica marcado no convite —
e as permissões vivem por conta própria no perfil de cada um. As regras
do banco perguntam pela permissão, nunca pelo cargo. É o que vai permitir,
na etapa seguinte, autorizar o financeiro a cadastrar colaborador sem
torná-lo administrador do sistema.

**Como alguém entra.** O administrador registra o convite; o colaborador
cria a própria senha em "Primeiro acesso", com o mesmo e-mail. O caminho
se inverteu por um motivo concreto: criar conta pelo aplicativo exigiria a
chave de administração do projeto dentro dele, e essa chave, extraída de
um celular, abre o banco inteiro.

Não é cadastro aberto — um gatilho recusa quem não tem convite, e a conta
nem chega a existir. E o convite não manda e-mail nenhum: depois de
convidar, a tela diz o que avisar ao colega.

**Um cuidado na transição:** enquanto as migrações não são aplicadas, as
colunas de permissão nem vêm do banco. Se ausente valesse "não pode", o
administrador ficaria trancado para fora da própria tela de colaboradores.
Ausente quer dizer "ninguém decidiu ainda" — e aí quem decide é o cargo.

**Falta a tela de permissões por pessoa**, que é a etapa 2. A base está
pronta: colunas, políticas e funções já perguntam pela permissão.

## 1.6.25 — 18/08/2026

**A ficha do perfil dentro da tela da peça.**

Abrir uma sobra mostrava o comprimento, a quantidade, o acabamento e o
local — mas nada do perfil além do código e do nome. Justamente as
medidas, que são o que se confere com a ponta na mão, obrigavam a sair
para a ficha do perfil e voltar. Quem faz isso perde o que estava
comparando.

Agora "Dados da peça" traz também código, linha, fabricante, medidas,
barra padrão, peso por metro e área da seção, sob um subtítulo "Do
perfil" que separa o que é DESTA peça do que vem do catálogo. Sem a
marca, "Comprimento 6 m" e "Barra padrão 6 m" viram a mesma coisa aos
olhos de quem lê — e não são.

Um campo mudou de sentido no caminho: onde a ficha do perfil mostra
"Peso da barra", aqui aparece **Peso da peça**, calculado com o
comprimento que a sobra realmente tem. A unidade que se pega na mão
neste depósito é a peça, não a barra nova.

A lista de sobras continua trazendo só quatro campos do perfil, de
propósito: são centenas de linhas, e cada coluna a mais é peso na rede,
que no depósito é ruim. A ficha inteira só é buscada quando se abre uma
peça.

## 1.6.21 — 17/08/2026

**Cadastro do perfil num lugar só, com as quatro medidas da seção.**

⚠️ **Precisa aplicar a migração**
`supabase/migrations/20260817220000_medidas_extras_da_secao.sql`. Sem
ela, o cadastro continua funcionando normalmente — só preencher as duas
medidas novas é que falha.

**Tudo na mesma tela.** Desenho técnico e fotos ficavam atrás de um
botão próprio, numa janela à parte do resto do cadastro. Ninguém edita
"o texto" numa hora e "a imagem" noutra — edita o perfil. Agora o lápis
abre tudo junto: dados, medidas, desenhos e fotos. O botão separado de
imagens saiu da lista, que ficou mais limpa.

**As quatro medidas.** A tela de identificação aceita até quatro
medidas, mas o catálogo só conhecia duas — largura e altura, derivadas
do peso e do desenho. Na prática, informar quatro medidas não estreitava
mais a lista do que informar duas, porque as outras não tinham com o que
casar.

O cadastro agora tem os quatro campos. Largura e altura chegam
calculadas e ficam editáveis, porque o cálculo erra de 3 a 5% e quem
tem a peça na mão corrige; as outras duas são cotas internas (aba,
câmara, encaixe), que não saem do desenho de jeito nenhum — só medindo.
Todas opcionais: perfil sem elas continua sendo encontrado como antes.

Quanto mais medidas o catálogo tiver de um perfil, mais estreita fica a
lista na identificação — cada medida conhecida precisa achar uma
informada que a explique.

**Um cuidado no caminho:** enquanto a migração não é aplicada, mandar as
colunas novas faria o banco recusar a gravação inteira, e quem só queria
corrigir uma descrição levaria um erro incompreensível sobre coluna
inexistente. O envio agora omite as medidas extras quando estão vazias,
então o cadastro comum funciona antes e depois da migração.

**Desativar virou ícone.** Nas listas de perfis, clientes, localizações e
acabamentos, o botão escrito "Desativar" ocupava largura demais: em
celular estreito ele espremia justamente o nome do registro, que é o que
a pessoa está procurando. Agora é só o ícone de arquivar, do mesmo
tamanho do lápis ao lado. O rótulo continua acessível — o leitor de tela
anuncia "Desativar" com o nome do registro, e no computador aparece a
dica ao passar o mouse.

**E o erro dessa migração agora fala português.** Sem a migração
aplicada, preencher a terceira ou a quarta medida devolvia
"Could not find the 'medida_3_secao_mm' column of 'modelos_perfil' in
the schema cache". Agora a tela diz qual migração falta e avisa que o
resto do cadastro grava normalmente com esses dois campos em branco.

**As quatro medidas na ficha do perfil.** A ficha mostrava só "Seção
(aprox.)", com largura e altura — as duas derivadas do peso. As outras
duas, medidas na peça e digitadas no cadastro, não apareciam em lugar
nenhum: dava para informar e não dava para conferir. Agora a linha é
"Medidas (aprox.)" com tudo junto, na ordem fixa largura × altura ×
terceira × quarta, por exemplo `125 × 125 × 452 × 52 mm`.

Numa linha só de propósito: quem confere uma ponta na mão lê a sequência
e compara com o que a trena deu, sem ir e voltar entre quatro linhas. O
que falta não vira zero nem traço — simplesmente não entra, então perfil
com duas medidas mostra duas.

A tela de identificação passou a mostrar a mesma linha nos candidatos.
É ali que a comparação acontece de verdade — a pessoa acabou de tirar
até quatro medidas com a trena e via só duas na lista, sem como conferir
as outras que ela mesma informou.

Ficha e identificação leem as medidas pela mesma função, então não há
como uma mostrar o que a outra esconde. A antiga `formatarSecao`, que só
sabia de largura e altura, saiu junto com seus testes: ninguém mais a
chamava.

**Rótulos do cadastro iguais aos da identificação.** Os campos de medida
no cadastro do perfil chamavam-se "Largura", "Altura" e duas vezes
"Outra medida"; na identificação, "Medida 1" a "Medida 4". Agora os dois
lugares falam a mesma língua: Medida 1, 2, 3 e 4.

A ordem aqui importa — é ela que casa com o que a ficha mostra e com o
que o cálculo do desenho grava — e os rótulos deixaram de dizer isso.
Então o texto sob os campos passou a dizer: as duas primeiras são a
largura e a altura por fora, vindas do cálculo; as duas últimas são
cotas internas, que só saem medindo.

**O script de cálculo aceita as credenciais no .env.** Ele só lia
`REPERFIL_EMAIL` e `REPERFIL_SENHA` de variável de ambiente — que no
PowerShell valem apenas para a janela onde foram definidas. Rodar o
script noutra janela dava "Defina REPERFIL_EMAIL e REPERFIL_SENHA" sem
pista do porquê, já que elas *tinham* sido definidas. Agora ele também
lê essas duas linhas do `.env`, que não é versionado, e a mensagem de
erro diz exatamente o que escrever e onde.

## 1.6.19 — 17/08/2026

**Atalho de identificação nos campos de perfil, estoque por linha e ícone
de trena.**

**Atalho da câmera.** Todo campo de escolha de perfil — em "Cadastrar
sobra" e em "Procurar sobra" — ganhou um ícone de câmera dentro do
próprio campo, à direita, sem ocupar linha nova. Ele leva à tela
"Identificar perfil", e é ali que precisa estar: quem não sabe o código
da peça precisa do atalho junto da busca que acabou de falhar, não
perdido noutro canto da tela.

O caminho de volta também está fechado. A tela de identificação sabe de
onde a pessoa veio, e tocar num candidato devolve ela ao cadastro com o
perfil JÁ selecionado — sem ter de refazer o caminho e procurar de novo
o perfil que acabou de identificar. O parâmetro some da URL logo
depois, senão "trocar perfil" ficaria impossível: qualquer nova
renderização voltaria a selecionar o mesmo perfil.

**Estoque por linha.** "Ver estoque de sobras" abria uma lista corrida
com todas as peças. Agora abre pela linha — com a contagem de PEÇAS, não
de modelos — e tocar numa linha mostra as sobras dela; há "Ver todas as
sobras" para quem prefere tudo de uma vez. Mesma organização já usada em
"Modelos de perfil" e na escolha de perfil ao cadastrar.

A busca e o leitor de QR Code continuam ignorando o agrupamento: quem
tem o código na mão quer a peça, não a linha dela. Verificado: estando
dentro da "Linha 25", buscar "SU-" achou as 42 sobras da Suprema.

**Ícone.** O item "Identificar perfil", no menu Mais, deixou de usar a
balança — que a oficina não tem — e passou a usar uma trena, que é o
instrumento do método principal da tela.

**Um padrão só para procurar peça.** O atalho de identificação começou
dentro do campo de busca e passou a ficar AO LADO dele, botão vizinho,
como o leitor de QR Code já fazia no estoque. Agora os três lugares onde
se procura uma peça — estoque, catálogo de perfis e escolha ao cadastrar
— têm o mesmo arranjo: campo à esquerda, atalho à direita, alvo de toque
do tamanho do campo.

**Cabeçalho parado, lista rolando por dentro — em todas as telas de
lista.** Antes a página inteira rolava, e rolar levava embora o campo de
busca, o botão de voltar e o "ver todos" — justamente o que a pessoa
procura quando a lista não trouxe o que ela queria. Ela então rolava
tudo de volta para cima; de pé no depósito, com uma peça na mão, isso é
caro.

Agora o cabeçalho fica onde está, só a lista rola (dentro de uma
moldura), e o botão de rodapé fica sempre alcançável. Vale para as sete
telas de lista: estoque de sobras, modelos de perfil, linhas e sistemas,
cores e acabamentos, localizações, clientes e reservas.

Virou um componente (`PaginaLista`), não sete cópias do mesmo cálculo de
altura — que é onde esse tipo de layout costuma se perder. No computador
nada disso vale: o menu é lateral, não há barra inferior, e a página
rola normalmente.

**Sete linhas inteiras em "Cadastrar sobra".** A lista de linhas
terminava no meio do sétimo item, e item cortado ao pé da tela parece
defeito de renderização, não convite a rolar. A altura passou a ser a de
sete itens exatos (516px = 7 × 64 + 6 × 8 + recheio e borda), cedendo
só em tela baixa demais.

No caminho apareceu um defeito de layout que ninguém tinha notado: a
tela rolava 32px sem precisar. A altura era medida até a barra de
navegação, mas o `main` ainda reservava 6rem embaixo para ela — os dois
somados empurravam conteúdo para fora, e o que se perdia era justamente
o espaço do último item. Corrigido anulando essa reserva nesta tela.

## 1.6.18 — 17/08/2026

**Renomeia o item do menu para "Identificar perfil".**

Era "Identificar pelo peso", nome que ficou estreito depois que a tela
passou a aceitar medida de trena e foto, com o peso recolhido como
alternativa para quem tiver balança.

## 1.6.17 — 17/08/2026

**Identificar a ponta sem etiqueta, medindo com trena.**

⚠️ **Precisa aplicar a migração**
`supabase/migrations/20260817200000_dimensoes_da_secao.sql` e depois rodar
`npm run secao:calcular --confirmar`. Sem esses dois passos a tela abre e
funciona, mas diz "sem medida no catálogo" em todos os perfis.

Sobra antiga achada no fundo do depósito, retalho vindo do fornecedor,
peça que perdeu a identificação: para essas o QR Code não serve, e achar
de olho entre 82 perfis parecidos é onde o erro acontece — cadastrar no
perfil errado é pior do que não cadastrar.

**As medidas não foram digitadas: foram derivadas.** O catálogo não tinha
as dimensões da seção em lugar nenhum, só o desenho. Mas tinha o peso por
metro de 64 perfis — e peso por metro de alumínio É a área da seção vezes
a densidade do metal (2,70 g/cm³). Sabendo a área real em mm² e quantos
pixels a seção ocupa no desenho, sai a escala do desenho; com a escala,
qualquer medida dele vira milímetro.

A parte difícil foi achar a seção no desenho, que tem cotas, setas e
carimbo também em preto. A separação é por manchas conexas de pixels: a
seção é de longe a maior delas — no 25-016, 4.038 pixels contra 305 da
maior linha de cota.

Conferência: o 25-002 tem as cotas 30 e 37 impressas no próprio desenho,
e o cálculo deu 29,0 × 35,7 mm — 3% abaixo, provavelmente porque a
espessura do traço entra na contagem. Folgado para o uso pretendido.

**A tela.** Reúne o que a oficina tem à mão:

- **Trena** (principal): até quatro medidas, nenhuma obrigatória. Quem
  está com a ponta na mão mede o que é fácil — a largura por fora, a
  altura, a aba que sobra, o vão de uma câmara — e não tem como saber
  quais dessas o catálogo conhece. Então o app não pede "largura e
  altura": recebe o punhado de medidas e procura, dentro dele, as que
  conhece. Medida que não corresponde a nada não elimina o perfil, porque
  provavelmente é uma cota interna que o catálogo ainda não tem. A ordem
  não importa. Tolerância de 12%, generosa de propósito: as medidas do
  catálogo são aproximadas e a trena numa ponta cortada também erra;
  apertar isso deixaria o perfil certo de fora.

  Vale registrar o limite: hoje informar quatro medidas em vez de duas não
  deixa o resultado mais preciso — deixa mais provável de acertar, porque
  aumenta a chance de as duas conhecidas estarem no meio. Quando o
  catálogo ganhar as cotas internas, as extras passam a restringir de
  fato, sem mudar nada para quem usa.
- **Foto da ponta** (opcional): não é reconhecida automaticamente — fica
  ao lado dos desenhos dos candidatos, resolvendo a comparação que antes
  obrigava a ir e voltar de tela com a peça na mão. A foto não é enviada
  nem gravada.
- **Peso** (recolhido): para o dia em que houver balança.
- **Linha**: estreita bastante. Medido contra o catálogo real, o peso
  sozinho deixa 4 ou mais candidatos em quase metade dos casos; junto com
  a linha, 86% caem para três ou menos.

O app nunca decide sozinho: mostra candidatos com o desenho ao lado, e
quem confirma é quem está com a peça na mão.

A ficha do perfil também passou a mostrar a seção aproximada e a área da
seção, ambas derivadas.

Verificado: 27 testes novos do cálculo; conferência contra as cotas
impressas de 6 perfis; e a tela funcionando antes da migração (sem
quebrar, sinalizando "sem medida no catálogo").

## 1.6.16 — 17/08/2026

**Escolha do perfil por linha ao cadastrar e procurar sobra, e correção
da lista de sugestões cortada.**

**Perfil por linha.** As telas "Cadastrar sobra" e "Procurar sobra"
abriam a escolha do perfil numa lista corrida com o catálogo inteiro.
Agora abrem na lista de linhas — Suprema, Linha 25, Fachada… — cada uma
com a contagem de perfis à direita; tocar numa linha mostra os perfis
dela, com um atalho para voltar às linhas, e há "Ver todos os perfis"
para quem prefere tudo de uma vez. É a mesma organização já usada em
"Modelos de perfil" (versão 1.6.14), agora onde a escolha realmente
acontece no dia a dia.

A busca continua ignorando o agrupamento: digitar um código acha o
perfil esteja ele em que linha estiver, e limpar a busca devolve a
pessoa à linha em que estava.

**Correção: a lista de sugestões aparecia com só duas opções.**

Na tela de renomear linha (e nos campos do cadastro de perfil), a lista
de sugestões mostrava duas opções e o resto sumia, por mais que a lista
tivesse dez ou vinte itens.

Não era o tamanho da lista: ela estava sendo RECORTADA. O conteúdo do
modal tem rolagem própria, e tudo que é posicionado lá dentro é cortado
na borda dele — a lista continuava existindo, só que fora da área
visível.

A lista passou a ser posicionada em coordenadas de tela, fora desse
recorte, e agora mostra até 6 opções de uma vez, com rolagem para o
resto. É responsiva: usa o espaço que houver, e abre para cima quando
não há espaço abaixo — caso do campo perto do rodapé, ou do teclado
aberto no celular. Acompanha a rolagem e o redimensionamento.

Cada opção também ficou com altura de toque confortável (48px), no
lugar do texto solto de antes.

Verificado no navegador: 6 opções visíveis no computador e no celular,
lista dentro da tela, abertura para cima confirmada numa tela de 460px
de altura, e a largura sempre acompanhando o campo.

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
