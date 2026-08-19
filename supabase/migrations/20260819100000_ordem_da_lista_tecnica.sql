-- A ordem dos cortes na lista técnica.
--
-- ── POR QUE A ORDEM IMPORTA ──────────────────────────────────────────────
--
-- A lista técnica é lida na bancada, de cima para baixo, enquanto se monta a
-- peça. A sequência em que os cortes aparecem é a sequência em que a pessoa
-- vai serrar — marco primeiro, depois folha, depois baguete. Ordenada por
-- data de cadastro, ela reflete a ordem em que alguém lembrou dos perfis,
-- que não é a ordem do trabalho.
--
-- ── POR QUE INTEIRO, E NÃO UM CAMPO "ANTERIOR/PRÓXIMO" ───────────────────
--
-- Lista ligada (cada item apontando para o seguinte) evita renumerar, mas
-- exige percorrer a corrente para exibir, e um elo quebrado esconde metade
-- da receita. Com inteiro, exibir é um `order by` e o pior caso é reescrever
-- os números de uma lista que tem, na prática, algumas dezenas de linhas.

alter table itens_lista_tecnica
  add column if not exists ordem integer;

comment on column itens_lista_tecnica.ordem is
  'Posição na lista, começando em 1. Define a sequência de montagem.';

-- Quem já existe recebe a ordem que tinha na tela: por data de cadastro.
-- Sem isto, todos ficariam nulos e a lista sairia embaralhada.
with numerados as (
  select id,
         row_number() over (
           partition by produto_id
           order by criado_em, id
         ) as posicao
  from itens_lista_tecnica
)
update itens_lista_tecnica i
set ordem = n.posicao
from numerados n
where i.id = n.id and i.ordem is null;

-- Índice pela ordem de leitura da tela: os cortes de um produto, em sequência.
create index if not exists idx_lista_tecnica_ordem
  on itens_lista_tecnica (produto_id, ordem);
