-- De quem é a PASTA em que cada arquivo de desenho está guardado.
-- SOMENTE LEITURA — não altera nada.
--
-- Como ler o resultado:
--
--   organizacao_do_registro = a empresa dona da linha em arquivos_vetoriais
--   dono_do_arquivo         = a empresa dona da PASTA onde o arquivo está
--
-- Se as duas colunas forem DIFERENTES (ou dono_do_arquivo vier vazio) na
-- linha da Alumifort, é a causa: o balde exige o caminho
-- `{organizacao_id}/arquivo`, então ela não consegue ler um arquivo
-- guardado sob o id de outra organização. No central funciona porque lá é
-- a pasta dele mesmo.
--
-- Se as duas forem IGUAIS, o caminho está certo e o arquivo é que não
-- existe no balde.

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
