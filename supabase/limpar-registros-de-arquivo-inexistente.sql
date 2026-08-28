-- Apaga os registros de imagem que apontam para arquivo que não existe mais.
--
-- ── O QUE ACONTECEU ──────────────────────────────────────────────────────
--
-- A sincronização do catálogo central copia o REGISTRO da imagem com o
-- caminho original — o arquivo continua morando na pasta do central, e as
-- políticas de leitura deixam as outras empresas lerem de lá. Isso funciona
-- enquanto o arquivo existe.
--
-- Ao apagar perfis no central depois da cópia, os arquivos foram junto. As
-- cópias do registro na Alumifort ficaram apontando para o vazio.
--
-- ── POR QUE ISSO ESCONDIA UM DESENHO BOM ─────────────────────────────────
--
-- A miniatura usa o PRIMEIRO arquivo de cada perfil. Com o primeiro morto,
-- o desenho sumia mesmo havendo um segundo arquivo bom logo atrás — foi o
-- caso do MN-001. Apagando o registro morto, o seguinte assume a capa.
--
-- ── ANTES DE APAGAR ──────────────────────────────────────────────────────
--
-- A primeira consulta MOSTRA o que será apagado. Rode-a sozinha, confira, e
-- só então rode o delete. Perfil cujo ÚNICO registro estiver na lista vai
-- ficar sem imagem nenhuma — a coluna `ficara_sem_imagem` avisa quais são,
-- e para esses a solução é reenviar o desenho pela tela do perfil.

-- 1) O que será apagado.
with mortos as (
  select
    a.id,
    a.modelo_perfil_id,
    a.tipo,
    a.arquivo_url,
    o.nome_fantasia
  from arquivos_vetoriais a
  join organizacoes o on o.id = a.organizacao_id
  left join storage.objects obj
    on obj.name = a.arquivo_url
   and obj.bucket_id = case a.tipo
         when 'imagem' then 'desenhos-tecnicos'
         when 'foto' then 'fotos-perfis'
       end
  where a.tipo in ('imagem', 'foto')
    and obj.name is null
)
select
  m.nome_fantasia,
  p.codigo,
  m.tipo,
  m.arquivo_url,
  -- Sobra algum outro arquivo bom para este perfil, do mesmo tipo?
  not exists (
    select 1
    from arquivos_vetoriais outro
    join storage.objects obj2
      on obj2.name = outro.arquivo_url
     and obj2.bucket_id = case outro.tipo
           when 'imagem' then 'desenhos-tecnicos'
           when 'foto' then 'fotos-perfis'
         end
    where outro.modelo_perfil_id = m.modelo_perfil_id
      and outro.tipo = m.tipo
      and outro.id <> m.id
  ) as ficara_sem_imagem
from mortos m
join modelos_perfil p on p.id = m.modelo_perfil_id
order by m.nome_fantasia, p.codigo;

-- 2) O delete. Rode só depois de conferir a consulta acima.
delete from arquivos_vetoriais a
using (
  select a2.id
  from arquivos_vetoriais a2
  left join storage.objects obj
    on obj.name = a2.arquivo_url
   and obj.bucket_id = case a2.tipo
         when 'imagem' then 'desenhos-tecnicos'
         when 'foto' then 'fotos-perfis'
       end
  where a2.tipo in ('imagem', 'foto')
    and obj.name is null
) mortos
where a.id = mortos.id;
