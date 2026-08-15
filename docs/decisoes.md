# Decisões de projeto

Registro das decisões que **divergem** da especificação inicial
(`docs/prompt-inicial.txt`) ou que resolvem contradições dela. Serve para que
ninguém — nem nós daqui a três meses — reabra discussão já encerrada, e para
que a divergência não pareça descuido.

---

## D1 — Banco de dados inteiramente em português

**Contradição na especificação.** A seção 14 exigia "nomes das tabelas tudo em
português, não use nomes em inglês para nada" e, na mesma seção, listava as
tabelas em inglês (`organizations`, `remnant_lots`, `finish_compatibilities`…).

**Decisão.** Português em tudo: tabelas, colunas, tipos, funções e políticas.
`docs/backlog-fases.md` traz uma tabela de equivalência com os nomes originais
para rastreabilidade.

**Motivo.** A equipe é brasileira e a intenção declarada era clara. Misturar os
dois idiomas seria pior que qualquer das opções isoladas.

---

## D2 — Chave primária UUID + código curto legível

**Contradição na especificação.** A seção 14 pedia UUID e, duas linhas antes,
"códigos curtos, máximo 6 ou 7 caracteres". Incompatíveis: UUID tem 36
caracteres.

**Decisão.** Cada tabela tem `id UUID` como chave primária interna **e** um
campo `codigo` curto e legível, único por organização, exibido na interface, no
QR Code e na etiqueta. Exemplos: `SB-4K2P` para sobra, `MP-0198` para modelo de
perfil.

**Motivo.** O UUID é necessário para Row Level Security, para geração de
identificador no cliente e para evitar colisão entre organizações. O código
curto é o que o serralheiro consegue ler, ditar por telefone e conferir numa
etiqueta. São necessidades diferentes, resolvidas por campos diferentes.

---

## D3 — Sem modo offline

**Divergência da especificação.** A seção 11 previa offline parcial: cache
local, pesquisa no estoque em cache e cadastro de sobra pendente de
sincronização.

**Decisão.** O aplicativo **exige conexão**. Sem rede, mostra apenas a tela
"Aguardando conexão" (`src/componentes/GuardaConexao.tsx`) e volta sozinho ao
normal quando o sinal retorna. Não há Dexie, IndexedDB, fila de pendentes nem
sincronização.

**Motivo.** Decisão do cliente. Todo o estoque vive no banco na nuvem, e operar
sobre dados velhos num depósito — reservar uma sobra que outra pessoa já
consumiu — causa mais estrago do que não abrir. Elimina também a maior fonte de
complexidade do projeto: resolução de conflitos de sincronização.

**Consequência.** O service worker da PWA continua existindo, mas apenas para
instalação, ícones e cache do app shell. Nenhum dado operacional é cacheado.

---

## D4 — Perda de serra: o último corte não gera perda

**Ambiguidade na especificação.** O teste obrigatório (sobra de 1.800 mm, cortes
de 1.200 e 600 mm, serra de 3 mm) exige que o sistema responda "não cabe", mas a
especificação não definia quantos cortes geram perda.

**Decisão.** A convenção adotada é: **`n` cortes consomem `n − 1` perdas de
serra**, porque o último corte aproveita a extremidade da peça. A margem de
limpeza de ponta é descontada uma única vez, no início da peça.

Conferindo o caso obrigatório, com margem de limpeza zero:

```
1200 + 3 (serra) + 600 = 1803 mm > 1800 mm  →  não cabe  ✓
```

**Refinamento descoberto na implementação.** A regra "`n − 1` passadas" só vale
quando o último corte termina exatamente no fim da peça. Se sobrar material
depois dele, foi preciso mais uma passada de serra para separar esse resto — e
ignorar isso faria o sistema anunciar uma sobra maior do que a peça que está
realmente no depósito.

Exemplo: peça de 1.800 mm, um corte de 1.200 mm, serra de 3 mm. O corte cabe
(não consome serra pelo critério acima), mas a sobra registrada é **597 mm**, não
600 mm, porque o disco comeu 3 mm ao separá-la.

Consequência adicional: quando a folga é menor que a própria espessura do disco,
não sobra peça alguma — vira pó. O sistema registra resto zero, não uma sobra
de 2 mm inexistente.

**Parametrizável.** A tela de configurações (`configuracoes_aplicacao`) permite
alternar para a convenção "toda peça cortada consome uma perda de serra", caso a
prática da serralheria seja outra. O padrão é o descrito acima.

**Motivo.** Decisão do cliente, refletindo a prática real da oficina.

---

## D5 — Reserva transacional resolvida no banco

**Decisão.** A proteção contra reserva dupla é implementada como função RPC no
PostgreSQL, com `SELECT … FOR UPDATE` sobre o lote, e não em código React.

**Motivo.** Verificar disponibilidade no cliente e depois gravar é uma condição
de corrida clássica: duas pessoas no depósito leem "disponível" no mesmo
instante e ambas reservam. Só o banco pode serializar isso. É o teste mais
importante da Fase 1.

---

## D6 — PDFs de referência fora do controle de versão

**Decisão.** `docs/referencia/` está no `.gitignore`. Os arquivos permanecem na
máquina local, para consulta durante o desenvolvimento, mas não são enviados ao
GitHub.

**Motivo.** Contêm nome de cliente, endereço de obra, telefone e valores reais
de terceiros. Repositório, mesmo privado, não é lugar para dado pessoal de
cliente que não consentiu.

**Consequência.** Quem clonar o repositório não terá os PDFs. Isso é
intencional; o que importa deles está descrito em `docs/backlog-fases.md`.

---

## D7 — Contas de serviço em e-mail dedicado

**Decisão.** Supabase, Vercel e futuramente Google Play Console usam um e-mail
próprio do projeto, não o e-mail pessoal do responsável.

**Motivo.** Separa faturamento, chaves e permissões da conta pessoal, e permite
transferir a administração para outra pessoa da empresa sem entregar acesso
pessoal.
