-- "Atualização geral" quebrava com "duplicate key value violates unique
-- constraint modelos_perfil_codigo_unico" na Alumifort.
--
-- ── A CAUSA ──────────────────────────────────────────────────────────────
--
-- O catálogo central nasceu de uma cópia FEITA A PARTIR da Alumifort (ver
-- copiar-catalogo-alumifort-para-reperfil.sql). Isso deixou o vínculo
-- (`origem_perfil_id`) marcado só do lado de quem RECEBEU a cópia — os
-- perfis originais da própria Alumifort continuaram sem apontar para
-- ninguém, porque, quando foram criados, o catálogo central nem existia.
--
-- `sincronizar_catalogo_central()` considera "perfil novo" qualquer perfil
-- do central sem uma cópia local vinculada (`origem_perfil_id`) — e a
-- Alumifort, por não ter esse vínculo em nenhum dos seus 368 perfis, via
-- TODOS eles como "novos" e tentava inserir de novo, com o MESMO código
-- que ela mesma já usava. Dava choque no índice único assim que topava com
-- o primeiro código repetido, e a função inteira abortava (uma exceção não
-- tratada desfaz a transação toda).
--
-- ── A CORREÇÃO ───────────────────────────────────────────────────────────
--
-- Duas partes:
--  1) Aqui: a função passa a pular (não travar) qualquer perfil do central
--     cujo código já exista na organização, vinculado ou não — protege
--     QUALQUER organização de um travamento parecido no futuro, mesmo que
--     a causa seja outra (duas empresas que, por coincidência, usam o
--     mesmo código interno para perfis diferentes).
--  2) Um script à parte (fora de migrations/, roda uma vez só) vincula
--     retroativamente os perfis da Alumifort aos seus equivalentes no
--     central, pelo código — resolve a causa raiz para quem já tinha o
--     catálogo inteiro duplicado desse jeito.
create or replace function sincronizar_catalogo_central()
returns table (perfis_novos integer, perfis_atualizados integer, imagens_novas integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid := organizacao_atual();
  v_central_id uuid := organizacao_catalogo_central();
  v_central record;
  v_novo_id uuid;
  v_qtd_imagens integer;
  v_perfis_novos integer := 0;
  v_perfis_atualizados integer := 0;
  v_imagens_novas integer := 0;
begin
  if v_organizacao_id is null then
    raise exception 'Sessão inválida.' using errcode = 'insufficient_privilege';
  end if;

  if not pode_gerenciar_cadastros() then
    raise exception 'Sem permissão para gerenciar cadastros.' using errcode = 'insufficient_privilege';
  end if;

  if v_central_id is null then
    raise exception 'Nenhuma organização está marcada como catálogo central.'
      using errcode = 'check_violation';
  end if;

  if v_organizacao_id = v_central_id then
    raise exception 'A própria organização central não sincroniza consigo mesma.'
      using errcode = 'check_violation';
  end if;

  -- Perfis novos: existem no central, ainda sem cópia local — e sem
  -- NENHUM perfil local já usando o mesmo código (vinculado ou não; um
  -- código já em uso localmente nunca pode virar um segundo insert, senão
  -- o índice único barra a transação inteira).
  for v_central in
    select central.*
    from modelos_perfil central
    where central.organizacao_id = v_central_id
      and central.ativo
      and not exists (
        select 1
        from modelos_perfil local
        where local.organizacao_id = v_organizacao_id
          and local.origem_perfil_id = central.id
      )
      and not exists (
        select 1
        from modelos_perfil local2
        where local2.organizacao_id = v_organizacao_id
          and local2.codigo = central.codigo
      )
  loop
    insert into modelos_perfil (
      organizacao_id, codigo, descricao, fabricante, linha, categoria, aplicacao,
      largura_secao_mm, altura_secao_mm, medida_3_secao_mm, medida_4_secao_mm,
      codigo_barras, comprimento_barra_mm, peso_por_metro_g, observacoes,
      origem_perfil_id, origem_revisao_catalogo
    )
    values (
      v_organizacao_id, v_central.codigo, v_central.descricao, v_central.fabricante,
      v_central.linha, v_central.categoria, v_central.aplicacao,
      v_central.largura_secao_mm, v_central.altura_secao_mm, v_central.medida_3_secao_mm,
      v_central.medida_4_secao_mm, v_central.codigo_barras, v_central.comprimento_barra_mm,
      v_central.peso_por_metro_g, v_central.observacoes,
      v_central.id, v_central.revisao_catalogo
    )
    returning id into v_novo_id;

    -- Perfil recém-chegado: todas as imagens do central (foto e desenho)
    -- entram juntas, não há nada local ainda para conflitar.
    insert into arquivos_vetoriais (
      organizacao_id, modelo_perfil_id, tipo, arquivo_url, nome_original,
      largura_mm, altura_mm, escala, sanitizado, observacoes_tecnicas, legenda, ordem
    )
    select
      v_organizacao_id, v_novo_id, av.tipo, av.arquivo_url, av.nome_original,
      av.largura_mm, av.altura_mm, av.escala, av.sanitizado, av.observacoes_tecnicas,
      av.legenda, av.ordem
    from arquivos_vetoriais av
    where av.modelo_perfil_id = v_central.id
      and av.organizacao_id = v_central_id;

    get diagnostics v_qtd_imagens = row_count;
    v_imagens_novas := v_imagens_novas + v_qtd_imagens;
    v_perfis_novos := v_perfis_novos + 1;
  end loop;

  -- Perfis já copiados, cuja origem central avançou de revisão.
  for v_central in
    select central.*, local.id as id_local
    from modelos_perfil local
    join modelos_perfil central on central.id = local.origem_perfil_id
    where local.organizacao_id = v_organizacao_id
      and central.organizacao_id = v_central_id
      and central.revisao_catalogo > local.origem_revisao_catalogo
  loop
    update modelos_perfil
    set descricao = v_central.descricao,
        fabricante = v_central.fabricante,
        linha = v_central.linha,
        categoria = v_central.categoria,
        aplicacao = v_central.aplicacao,
        largura_secao_mm = v_central.largura_secao_mm,
        altura_secao_mm = v_central.altura_secao_mm,
        medida_3_secao_mm = v_central.medida_3_secao_mm,
        medida_4_secao_mm = v_central.medida_4_secao_mm,
        codigo_barras = v_central.codigo_barras,
        comprimento_barra_mm = v_central.comprimento_barra_mm,
        peso_por_metro_g = v_central.peso_por_metro_g,
        observacoes = v_central.observacoes,
        origem_revisao_catalogo = v_central.revisao_catalogo
    where id = v_central.id_local;

    -- Desenho técnico PREVALECE o do central: apaga os locais e recoloca
    -- exatamente o conjunto atual de lá — resolve desenho duplicado ou
    -- desatualizado que a empresa não tem como saber que está errado.
    delete from arquivos_vetoriais
    where modelo_perfil_id = v_central.id_local
      and tipo = 'imagem';

    insert into arquivos_vetoriais (
      organizacao_id, modelo_perfil_id, tipo, arquivo_url, nome_original,
      largura_mm, altura_mm, escala, sanitizado, observacoes_tecnicas, legenda, ordem
    )
    select
      v_organizacao_id, v_central.id_local, av.tipo, av.arquivo_url, av.nome_original,
      av.largura_mm, av.altura_mm, av.escala, av.sanitizado, av.observacoes_tecnicas,
      av.legenda, av.ordem
    from arquivos_vetoriais av
    where av.modelo_perfil_id = v_central.id
      and av.organizacao_id = v_central_id
      and av.tipo = 'imagem';

    get diagnostics v_qtd_imagens = row_count;
    v_imagens_novas := v_imagens_novas + v_qtd_imagens;

    -- Foto continua só acrescentando — a empresa pode ter fotografado a
    -- peça por conta própria, e essa foto não tem "versão central" para
    -- prevalecer sobre ela.
    insert into arquivos_vetoriais (
      organizacao_id, modelo_perfil_id, tipo, arquivo_url, nome_original,
      largura_mm, altura_mm, escala, sanitizado, observacoes_tecnicas, legenda, ordem
    )
    select
      v_organizacao_id, v_central.id_local, av.tipo, av.arquivo_url, av.nome_original,
      av.largura_mm, av.altura_mm, av.escala, av.sanitizado, av.observacoes_tecnicas,
      av.legenda, av.ordem
    from arquivos_vetoriais av
    where av.modelo_perfil_id = v_central.id
      and av.organizacao_id = v_central_id
      and av.tipo = 'foto'
      and not exists (
        select 1
        from arquivos_vetoriais existente
        where existente.modelo_perfil_id = v_central.id_local
          and existente.arquivo_url = av.arquivo_url
      );

    get diagnostics v_qtd_imagens = row_count;
    v_imagens_novas := v_imagens_novas + v_qtd_imagens;
    v_perfis_atualizados := v_perfis_atualizados + 1;
  end loop;

  return query select v_perfis_novos, v_perfis_atualizados, v_imagens_novas;
end;
$$;
