-- Como cada perfil da lista técnica é montado e cortado.
--
-- ── POR QUE ISTO FALTAVA ─────────────────────────────────────────────────
--
-- "1.455 mm do MN-001" não é uma instrução completa de corte. A mesma medida
-- serrada em topo ou em meia-esquadria dá duas peças diferentes, e só uma
-- monta. Quem serra pergunta isso ao montador toda vez que a lista não diz —
-- e quando o montador não está, chuta. Peça de alumínio cortada espelhada
-- não tem conserto: vira sucata.
--
-- ── TRÊS COLUNAS, E NÃO UMA ──────────────────────────────────────────────
--
-- `sentido` não muda o corte, muda o NOME das pontas: um perfil deitado tem
-- ponta esquerda e direita, em pé tem de cima e de baixo. Guardá-lo junto
-- permite a tela falar a língua de quem está com a peça na mão.
--
-- As duas pontas são colunas separadas porque são decisões independentes: o
-- caso mais comum de um montante é 45° numa ponta e 90° na outra.
--
-- ── POR QUE TEXTO COM CHECK, E NÃO ENUM ──────────────────────────────────
--
-- Enum do Postgres precisa de `alter type` para ganhar um valor, e isso não
-- roda dentro de transação em versões que a hospedagem ainda usa. Uma sexta
-- variação de corte é mudança plausível; travar isso num enum transformaria
-- um ajuste de tela numa migração arriscada.

alter table itens_lista_tecnica
  add column if not exists sentido text not null default 'h',
  add column if not exists corte_inicio text not null default 'reto_cima',
  add column if not exists corte_fim text not null default 'reto_cima';

-- O default cobre o que já estava cadastrado: corte reto é o que
-- "1.455 mm" sempre quis dizer antes desta informação existir. Supor
-- meia-esquadria mudaria, em silêncio, a instrução de receitas prontas.

alter table itens_lista_tecnica
  drop constraint if exists sentido_valido;

alter table itens_lista_tecnica
  add constraint sentido_valido check (sentido in ('h', 'v'));

alter table itens_lista_tecnica
  drop constraint if exists corte_inicio_valido;

alter table itens_lista_tecnica
  add constraint corte_inicio_valido check (
    corte_inicio in (
      'reto_cima', 'reto_baixo',
      'meia_cima', 'meia_baixo', 'meia_cima_inv', 'meia_baixo_inv'
    )
  );

alter table itens_lista_tecnica
  drop constraint if exists corte_fim_valido;

alter table itens_lista_tecnica
  add constraint corte_fim_valido check (
    corte_fim in (
      'reto_cima', 'reto_baixo',
      'meia_cima', 'meia_baixo', 'meia_cima_inv', 'meia_baixo_inv'
    )
  );

comment on column itens_lista_tecnica.sentido is
  'Como a peça fica montada: h = deitado, v = em pé. Define se as pontas se
   chamam esquerda/direita ou cima/baixo.';

comment on column itens_lista_tecnica.corte_inicio is
  'Corte da primeira ponta (esquerda, se deitado; de cima, se em pé).
   reto_* = 90 graus, meia_* = 45 graus.';

comment on column itens_lista_tecnica.corte_fim is
  'Corte da segunda ponta (direita, se deitado; de baixo, se em pé).';
