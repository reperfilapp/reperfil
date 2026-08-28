-- Por que 5 perfis da Alumifort não mostram desenho técnico.
-- SOMENTE LEITURA — não altera nada.
--
-- Duas hipóteses, e as três consultas abaixo separam uma da outra:
--
--  A) A Alumifort não tem registro de imagem para esses perfis. Aí o
--     problema é ausência de dado: nunca foi copiado.
--
--  B) Tem o registro, mas o caminho do arquivo aponta para a PASTA DO
--     CENTRAL. O balde exige `{organizacao_id}/arquivo`, então a Alumifort
--     não consegue ler um arquivo guardado sob o id da outra organização —
--     a linha existe, o link falha, e a miniatura fica vazia.

-- 1. Os perfis da lista técnica que aparecem sem desenho, com o que a
--    Alumifort tem de imagem para cada um.
select
  m.codigo,
  m.id as perfil_id,
  m.origem_perfil_id,
  count(a.id) as imagens_na_alumifort
from modelos_perfil m
left join arquivos_vetoriais a
  on a.modelo_perfil_id = m.id
 and a.tipo = 'imagem'
 and a.organizacao_id = m.organizacao_id
where m.organizacao_id = (
        select id from organizacoes
        where nome_fantasia ilike '%alumifort%' limit 1
      )
  and m.codigo in ('MN-001', 'MN-002', 'MN-003', 'MN-007', 'MN-010')
group by m.codigo, m.id, m.origem_perfil_id
order by m.codigo;

-- 2. De quem é a pasta em que cada caminho está guardado. Se `dono_do_arquivo`
--    for diferente de `organizacao_do_registro`, é a hipótese B.
select
  m.codigo,
  o_reg.nome_fantasia as organizacao_do_registro,
  o_arq.nome_fantasia as dono_do_arquivo,
  a.arquivo_url
from arquivos_vetoriais a
join modelos_perfil m on m.id = a.modelo_perfil_id
join organizacoes o_reg on o_reg.id = a.organizacao_id
left join organizacoes o_arq
  on o_arq.id::text = split_part(a.arquivo_url, '/', 1)
where a.tipo = 'imagem'
  and m.codigo in ('MN-001', 'MN-002', 'MN-003', 'MN-007', 'MN-010')
order by m.codigo, o_reg.nome_fantasia;

-- 3. O quadro geral, para saber se são só estes 5 ou um problema maior:
--    quantos perfis de cada organização estão sem imagem nenhuma.
select
  o.nome_fantasia,
  count(*) filter (where a.id is null) as perfis_sem_imagem,
  count(*) as perfis_no_total
from modelos_perfil m
join organizacoes o on o.id = m.organizacao_id
left join arquivos_vetoriais a
  on a.modelo_perfil_id = m.id
 and a.tipo = 'imagem'
 and a.organizacao_id = m.organizacao_id
where m.ativo
group by o.nome_fantasia
order by o.nome_fantasia;
