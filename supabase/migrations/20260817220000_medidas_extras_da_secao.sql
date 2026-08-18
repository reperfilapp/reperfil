-- Mais duas medidas da seção, informadas à mão.
--
-- POR QUE QUATRO E NÃO DUAS
--
-- A tela de identificação aceita até quatro medidas, porque quem está com a
-- ponta na mão mede o que é fácil: a largura por fora, a altura, a aba que
-- sobra, o vão de uma câmara. Mas o catálogo só conhecia DUAS — largura e
-- altura, derivadas do peso e do desenho. Resultado: informar quatro medidas
-- não estreitava mais a lista do que informar duas, porque as outras não
-- tinham com o que casar.
--
-- Estas colunas fecham essa lacuna. Não dá para derivá-las do desenho como
-- as duas primeiras: uma cota interna não sai do cruzamento de peso e área.
-- Ela é medida na peça, uma vez, por quem cadastra o perfil — e a partir daí
-- serve para sempre.
--
-- SÃO OPCIONAIS. Perfil sem elas continua sendo encontrado pelas duas
-- primeiras, exatamente como hoje.

alter table modelos_perfil
  add column if not exists medida_3_secao_mm numeric(6, 1),
  add column if not exists medida_4_secao_mm numeric(6, 1);

comment on column modelos_perfil.medida_3_secao_mm is
  'Terceira medida da seção, informada à mão — em geral uma cota interna
   (aba, câmara, encaixe). Opcional; ajuda a identificar a ponta na trena.';

comment on column modelos_perfil.medida_4_secao_mm is
  'Quarta medida da seção, informada à mão. Opcional, como a terceira.';
