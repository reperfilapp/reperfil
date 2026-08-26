-- Rastreio de revisão do catálogo central + sincronização para as demais
-- empresas.
--
-- `revisado` (já existente) é outra coisa: é a empresa dizendo "eu conferi
-- este cadastro", local, sem relação com o catálogo central. Este aqui é o
-- rastreio de QUANDO o catálogo central mudou, e se uma cópia já copiada
-- por outra empresa ficou para trás.
alter table modelos_perfil
  add column if not exists revisao_catalogo integer not null default 1,
  add column if not exists origem_perfil_id uuid references modelos_perfil (id) on delete set null,
  add column if not exists origem_revisao_catalogo integer;

comment on column modelos_perfil.revisao_catalogo is
  'Só sobe em perfis da organização central, pelo botão "marcar nova revisão".';
comment on column modelos_perfil.origem_perfil_id is
  'Em um perfil COPIADO do catálogo central, aponta pra linha de origem lá.';
comment on column modelos_perfil.origem_revisao_catalogo is
  'A revisão central no momento da última cópia/atualização deste perfil.';

-- -----------------------------------------------------------------------------
-- Leitura cruzada do catálogo central
-- -----------------------------------------------------------------------------
-- Sem isto, uma empresa comum não consegue nem SABER que existem perfis
-- novos ou atualizados na RePerfil — só os donos da organização central
-- enxergavam essas linhas até agora. Só leitura: escrever continua restrito
-- a quem administra a própria organização central, como sempre.
drop policy if exists "ver perfis do catalogo central" on modelos_perfil;
create policy "ver perfis do catalogo central"
  on modelos_perfil for select
  to authenticated
  using (organizacao_id = organizacao_catalogo_central());

drop policy if exists "ver imagens do catalogo central" on arquivos_vetoriais;
create policy "ver imagens do catalogo central"
  on arquivos_vetoriais for select
  to authenticated
  using (organizacao_id = organizacao_catalogo_central());

-- -----------------------------------------------------------------------------
-- Marcar nova revisão
-- -----------------------------------------------------------------------------
-- Só em perfil da organização CENTRAL, e só por quem gerencia cadastros
-- nela — usar depois de editar um perfil de catálogo, pra avisar quem já
-- copiou que há novidade.
create or replace function marcar_nova_revisao_perfil(p_perfil_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid;
begin
  select organizacao_id into v_organizacao_id
  from modelos_perfil
  where id = p_perfil_id;

  if v_organizacao_id is null then
    raise exception 'Perfil não encontrado.' using errcode = 'check_violation';
  end if;

  if v_organizacao_id <> organizacao_atual()
     or v_organizacao_id <> organizacao_catalogo_central()
     or not pode_gerenciar_cadastros()
  then
    raise exception 'Só quem administra o catálogo central pode marcar uma nova revisão.'
      using errcode = 'insufficient_privilege';
  end if;

  update modelos_perfil
  set revisao_catalogo = revisao_catalogo + 1
  where id = p_perfil_id;
end;
$$;

grant execute on function marcar_nova_revisao_perfil(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Sincronizar com o catálogo central
-- -----------------------------------------------------------------------------
-- Traz perfis novos (que ainda não têm cópia local) e atualiza os já
-- copiados que ficaram para trás — os dois de uma vez, porque é isso que o
-- botão "Atualização geral" faz. O botão "Atualizar" de UM perfil só chama
-- esta mesma função: sincronizar tudo de novo é inofensivo e mais simples
-- do que manter duas funções parecidas.
--
-- Campos reimportados: os DESCRITIVOS/TÉCNICOS do perfil. Preço por metro e
-- `revisado` são da empresa, nunca tocados. Imagens: uma atualização só
-- ACRESCENTA imagens novas do central (comparando pelo caminho do
-- arquivo) — nunca apaga nada, porque a empresa pode ter fotografado a
-- peça por conta própria.
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

  -- Perfis novos: existem no central, ainda sem cópia local (nenhuma linha
  -- local aponta pra eles via origem_perfil_id).
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

  -- Perfis já copiados, mas cuja origem central avançou de revisão.
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

grant execute on function sincronizar_catalogo_central() to authenticated;
