-- Dimensões da seção transversal do perfil.
--
-- POR QUE ESTES CAMPOS EXISTEM
--
-- A oficina tem trena, não balança. Para identificar uma ponta sem etiqueta,
-- o que dá para medir ali mesmo é a altura e a largura da seção — e o
-- catálogo não tinha esses números em lugar nenhum, só o desenho.
--
-- DE ONDE OS VALORES VÊM
--
-- Não são digitados: saem do cruzamento de dois dados que já existem.
--
--   1. O peso por metro dá a área real de metal na seção, porque
--      peso/m = área × densidade do alumínio (2,70 g/cm³).
--   2. O desenho técnico dá a mesma seção em pixels.
--
-- Com a área real e a área em pixels, sai a escala do desenho, e com ela
-- qualquer medida dele vira milímetro. Conferido contra as cotas impressas
-- no próprio desenho: no 25-002, o cálculo deu 29 × 36 mm e as cotas dizem
-- 30 × 37 — dentro de 4%, que é folgado para triagem com trena.
--
-- São valores DERIVADOS, e por isso aproximados: servem para estreitar a
-- lista de candidatos, nunca para conferir se uma peça cabe num corte. Quem
-- decide continua sendo o desenho, com a peça na mão.

alter table modelos_perfil
  add column if not exists largura_secao_mm numeric(6, 1),
  add column if not exists altura_secao_mm numeric(6, 1);

comment on column modelos_perfil.largura_secao_mm is
  'Largura da seção transversal em mm, DERIVADA do peso e do desenho.
   Aproximada (±5%): serve para achar a peça, não para calcular corte.';

comment on column modelos_perfil.altura_secao_mm is
  'Altura da seção transversal em mm, DERIVADA do peso e do desenho.
   Aproximada (±5%): serve para achar a peça, não para calcular corte.';

-- Busca por faixa de medida ("tem uns 30 por 40") precisa varrer as duas
-- colunas juntas.
create index if not exists idx_modelos_perfil_secao
  on modelos_perfil (largura_secao_mm, altura_secao_mm)
  where largura_secao_mm is not null;
