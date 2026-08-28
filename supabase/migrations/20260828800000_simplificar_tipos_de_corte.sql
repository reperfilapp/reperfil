-- Seis variações de corte viraram três.
--
-- ── POR QUE ENCOLHEU ─────────────────────────────────────────────────────
--
-- O corte reto é um só. 90° não tem inclinação para variar, e de que lado da
-- peça ele acontece já está dito pelo botão da ponta — cada ponta tem o seu.
-- "90° em cima" e "90° em baixo" pediam uma escolha que não muda peça nenhuma.
--
-- A meia-esquadria tem duas, e só duas: numa ponta, um corte a 45° corre para
-- um lado ou para o outro. O que se chamava "invertido" era a mesma
-- inclinação vista pela OUTRA ponta — e a ponta já é escolhida à parte. Eram
-- duas formas de dizer a mesma coisa, e duas formas de dizer a mesma coisa
-- num campo de instrução de corte é convite a gravar uma e ler a outra.
--
-- ── A ORDEM AQUI NÃO É NEGOCIÁVEL ────────────────────────────────────────
--
-- As regras caem PRIMEIRO, os dados mudam depois, e as regras novas entram
-- por último.
--
-- O check antigo aceita apenas os seis nomes antigos. Rodar o update com ele
-- ainda de pé faz o banco recusar a primeira linha convertida — a nova grafia
-- 'reto' não está na lista dele. Foi exatamente o que aconteceu na primeira
-- tentativa desta migração:
--
--   new row for relation "itens_lista_tecnica"
--   violates check constraint "corte_fim_valido"
--
-- Entre soltar as regras e recolocá-las a tabela fica sem validação, e é por
-- isso que o update vem no meio e não no fim: a janela dura o tempo de um
-- comando, dentro da mesma transação.

alter table itens_lista_tecnica
  drop constraint if exists corte_inicio_valido;

alter table itens_lista_tecnica
  drop constraint if exists corte_fim_valido;

update itens_lista_tecnica
set corte_inicio = case corte_inicio
      when 'reto_cima' then 'reto'
      when 'reto_baixo' then 'reto'
      -- O invertido colapsa na inclinação equivalente, e não no reto:
      -- trocar 45° por 90° mudaria a peça, que é justamente o que esta
      -- migração não pode fazer.
      when 'meia_cima_inv' then 'meia_cima'
      when 'meia_baixo_inv' then 'meia_baixo'
      else corte_inicio
    end,
    corte_fim = case corte_fim
      when 'reto_cima' then 'reto'
      when 'reto_baixo' then 'reto'
      when 'meia_cima_inv' then 'meia_cima'
      when 'meia_baixo_inv' then 'meia_baixo'
      else corte_fim
    end
where corte_inicio in ('reto_cima', 'reto_baixo', 'meia_cima_inv', 'meia_baixo_inv')
   or corte_fim in ('reto_cima', 'reto_baixo', 'meia_cima_inv', 'meia_baixo_inv');

-- O default seguia o nome antigo. Sem trocar, toda linha nova nasceria com
-- um valor que o check abaixo proíbe.
alter table itens_lista_tecnica
  alter column corte_inicio set default 'reto',
  alter column corte_fim set default 'reto';

alter table itens_lista_tecnica
  add constraint corte_inicio_valido check (
    corte_inicio in ('reto', 'meia_cima', 'meia_baixo')
  );

alter table itens_lista_tecnica
  add constraint corte_fim_valido check (
    corte_fim in ('reto', 'meia_cima', 'meia_baixo')
  );

comment on column itens_lista_tecnica.corte_inicio is
  'Corte da primeira ponta (esquerda, se deitado; de cima, se em pé).
   reto = 90 graus; meia_cima e meia_baixo = 45 graus, pelo lado da cunha.';

comment on column itens_lista_tecnica.corte_fim is
  'Corte da segunda ponta (direita, se deitado; de baixo, se em pé).';
