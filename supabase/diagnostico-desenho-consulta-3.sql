-- O arquivo existe mesmo no armazenamento?
-- SOMENTE LEITURA — não altera nada.
--
-- As políticas de leitura do catálogo central já existem (ver a migração
-- 20260826200000), então a Alumifort PODE ler arquivo da pasta do central.
-- Sobra uma explicação: o registro aponta para um arquivo que não está mais
-- lá — provavelmente apagado junto com os perfis que foram removidos do
-- central depois da cópia.
--
-- `existe_no_balde = false` é a confirmação.
--
-- Repare também na coluna `ordem`: a miniatura usa o PRIMEIRO arquivo de
-- cada perfil. Se o primeiro estiver morto, a capa some mesmo havendo um
-- segundo arquivo bom logo atrás — que é o caso do MN-001.

select
  m.codigo,
  o.nome_fantasia as organizacao,
  a.ordem,
  a.arquivo_url,
  (obj.name is not null) as existe_no_balde
from arquivos_vetoriais a
join modelos_perfil m on m.id = a.modelo_perfil_id
join organizacoes o on o.id = a.organizacao_id
left join storage.objects obj
  on obj.name = a.arquivo_url
 and obj.bucket_id = 'desenhos-tecnicos'
where a.tipo = 'imagem'
  and m.codigo in ('MN-001', 'MN-002', 'MN-003', 'MN-007', 'MN-010')
order by m.codigo, o.nome_fantasia, a.ordem;

-- O tamanho real do problema: quantos registros de CADA organização
-- apontam para arquivo que não existe mais no balde.
select
  o.nome_fantasia,
  count(*) filter (where obj.name is null) as apontam_para_arquivo_inexistente,
  count(*) as registros_no_total
from arquivos_vetoriais a
join organizacoes o on o.id = a.organizacao_id
left join storage.objects obj
  on obj.name = a.arquivo_url
 and obj.bucket_id = 'desenhos-tecnicos'
where a.tipo = 'imagem'
group by o.nome_fantasia
order by o.nome_fantasia;
