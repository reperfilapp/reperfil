-- =============================================================================
-- RePerfil — Copiar as LINHAS de arquivos_vetoriais (fotos e desenhos de
-- perfil) que faltaram no primeiro script de cópia
-- =============================================================================
--
-- O primeiro script (copiar-catalogo-alumifort-para-reperfil.sql) copiou
-- modelos_perfil, acabamentos, produtos e a lista técnica — mas as
-- imagens de cada perfil (foto e desenho técnico) vivem numa tabela à
-- parte, `arquivos_vetoriais`, que ficou de fora.
--
-- Só dados aqui, de novo — o `arquivo_url` é copiado com o MESMO valor de
-- antes (ainda apontando para a pasta da Alumifort no Storage). Depois de
-- rodar isto, falta o passo seguinte: mover os arquivos de verdade
-- (script `scripts/mover-arquivos-catalogo-central.mjs`), que corrige o
-- caminho nos dois lados de uma vez.
--
-- Não roda de novo sem duplicar — mesma ressalva do primeiro script.
-- =============================================================================

do $$
declare
  v_origem_id uuid;
  v_destino_id uuid;
  v_qtd integer;
begin
  select id into v_origem_id from organizacoes where nome_fantasia ilike '%alumifort%' limit 1;
  select id into v_destino_id from organizacoes where nome_fantasia = 'RePerfil' limit 1;

  if v_origem_id is null or v_destino_id is null then
    raise exception 'Organização de origem ou destino não encontrada.';
  end if;

  insert into arquivos_vetoriais (
    organizacao_id, modelo_perfil_id, tipo, arquivo_url, nome_original,
    largura_mm, altura_mm, escala, sanitizado, observacoes_tecnicas, legenda, ordem
  )
  select
    v_destino_id, novo.id, av.tipo, av.arquivo_url, av.nome_original,
    av.largura_mm, av.altura_mm, av.escala, av.sanitizado, av.observacoes_tecnicas,
    av.legenda, av.ordem
  from arquivos_vetoriais av
  join modelos_perfil antigo
    on antigo.id = av.modelo_perfil_id and antigo.organizacao_id = v_origem_id
  join modelos_perfil novo
    on novo.organizacao_id = v_destino_id and novo.codigo = antigo.codigo
  where av.organizacao_id = v_origem_id;

  get diagnostics v_qtd = row_count;
  raise notice 'Imagens de perfil copiadas: %', v_qtd;
end $$;

select
  o.nome_fantasia,
  count(*) as imagens_de_perfil
from arquivos_vetoriais av
join organizacoes o on o.id = av.organizacao_id
where o.nome_fantasia ilike '%alumifort%' or o.nome_fantasia = 'RePerfil'
group by o.nome_fantasia;
