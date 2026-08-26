-- Substitui o bloqueio geral de linha (liga/desliga para TODAS as empresas
-- de uma vez, criado em 20260827600000) por liberação POR EMPRESA — a
-- ideia de negociar linha a linha com cada cliente do catálogo central,
-- não só "todo mundo vê" ou "ninguém vê".
--
-- ── A TABELA ─────────────────────────────────────────────────────────────
-- Uma linha por (linha, organização) que PODE importar/atualizar aquela
-- linha. Ausência = bloqueada para aquela empresa — ao contrário da versão
-- anterior, aqui é lista de permissão, não de bloqueio, então o backfill
-- abaixo é o que evita travar quem já usava.
create table if not exists linhas_liberadas_organizacao (
  linha text not null,
  organizacao_id uuid not null references organizacoes (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (linha, organizacao_id)
);

comment on table linhas_liberadas_organizacao is
  'Uma linha por (linha, organização) liberada para importar/atualizar
   aquela linha do catálogo central. Ausência = bloqueada para aquela
   empresa. Só mexido pelas funções abaixo, nunca direto pelo cliente.';

alter table linhas_liberadas_organizacao enable row level security;
-- Sem política nenhuma de propósito: toda leitura e escrita passa pelas
-- funções `security definer` abaixo, que já conferem quem pode o quê.

-- Preserva o que já funcionava: toda linha que já existe no central fica
-- liberada para toda organização que já existe (menos a própria central).
-- Dali para frente, linha nova ou empresa nova começam SEM liberação — é
-- o administrador do central quem decide, dali em diante.
insert into linhas_liberadas_organizacao (linha, organizacao_id)
select distinct m.linha, o.id
from modelos_perfil m
cross join organizacoes o
where m.organizacao_id = organizacao_catalogo_central()
  and m.ativo
  and m.linha is not null
  and trim(m.linha) <> ''
  and o.id <> organizacao_catalogo_central()
on conflict (linha, organizacao_id) do nothing;

-- A versão anterior (bloqueio geral) sai de cena — substituída pela
-- liberação por empresa.
drop function if exists definir_disponibilidade_linha(text, boolean);
drop table if exists linhas_catalogo_central;

-- ── PARA A TELA DE ADMINISTRAÇÃO (organização central) ──────────────────
-- Lista as empresas (menos a própria central) e se cada uma está liberada
-- para a linha pedida — alimenta a lista de empresas dentro de "Editar
-- linha", em Linhas e sistemas.
create or replace function organizacoes_para_liberacao(p_linha text)
returns table (organizacao_id uuid, nome_fantasia text, liberada boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if organizacao_atual() <> organizacao_catalogo_central() or not pode_gerenciar_cadastros() then
    raise exception 'Só quem administra o catálogo central gerencia liberação de linha.'
      using errcode = 'insufficient_privilege';
  end if;

  return query
    select
      o.id,
      o.nome_fantasia,
      exists (
        select 1
        from linhas_liberadas_organizacao l
        where l.linha = p_linha and l.organizacao_id = o.id
      )
    from organizacoes o
    where o.id <> organizacao_catalogo_central()
      and o.ativo
    order by o.nome_fantasia;
end;
$$;

grant execute on function organizacoes_para_liberacao(text) to authenticated;

-- Liga ou desliga UMA empresa para UMA linha.
create or replace function definir_liberacao_linha(
  p_linha text,
  p_organizacao_id uuid,
  p_liberada boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if organizacao_atual() <> organizacao_catalogo_central() or not pode_gerenciar_cadastros() then
    raise exception 'Só quem administra o catálogo central gerencia liberação de linha.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_liberada then
    insert into linhas_liberadas_organizacao (linha, organizacao_id)
    values (p_linha, p_organizacao_id)
    on conflict (linha, organizacao_id) do nothing;
  else
    delete from linhas_liberadas_organizacao
    where linha = p_linha and organizacao_id = p_organizacao_id;
  end if;
end;
$$;

grant execute on function definir_liberacao_linha(text, uuid, boolean) to authenticated;

-- Liga ou desliga TODAS as empresas de uma vez, para UMA linha — o
-- atalho "liberar/bloquear para todas" dentro de "Editar linha".
create or replace function definir_liberacao_linha_todas(
  p_linha text,
  p_liberada boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if organizacao_atual() <> organizacao_catalogo_central() or not pode_gerenciar_cadastros() then
    raise exception 'Só quem administra o catálogo central gerencia liberação de linha.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_liberada then
    insert into linhas_liberadas_organizacao (linha, organizacao_id)
    select p_linha, o.id
    from organizacoes o
    where o.id <> organizacao_catalogo_central()
    on conflict (linha, organizacao_id) do nothing;
  else
    delete from linhas_liberadas_organizacao
    where linha = p_linha;
  end if;
end;
$$;

grant execute on function definir_liberacao_linha_todas(text, boolean) to authenticated;

-- ── PARA AS DEMAIS EMPRESAS ──────────────────────────────────────────────
-- Mesma assinatura de antes — só troca o que `disponivel` significa: era
-- "a linha está geralmente aberta", passa a ser "a MINHA organização foi
-- liberada para esta linha".
create or replace function linhas_do_catalogo_central()
returns table (linha text, disponivel boolean)
language sql
stable
security definer
set search_path = public
as $$
  select distinct
    m.linha,
    exists (
      select 1
      from linhas_liberadas_organizacao l
      where l.linha = m.linha and l.organizacao_id = organizacao_atual()
    )
  from modelos_perfil m
  where m.organizacao_id = organizacao_catalogo_central()
    and m.ativo
    and m.linha is not null
    and trim(m.linha) <> ''
  order by 1
$$;

grant execute on function linhas_do_catalogo_central() to authenticated;

-- Sincronizar passa a checar liberação POR ORGANIZAÇÃO, não mais o
-- bloqueio geral. Perfil sem linha nenhuma continua de fora do esquema de
-- liberação (sempre sincroniza, como antes).
create or replace function sincronizar_catalogo_central(p_linha text default null)
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

  -- Perfis novos: existem no central, na linha pedida (ou em qualquer
  -- linha, se `p_linha` for nulo), a MINHA organização está liberada para
  -- aquela linha (ou o perfil não tem linha nenhuma), ainda sem cópia
  -- local — e sem NENHUM perfil local já usando o mesmo código.
  for v_central in
    select central.*
    from modelos_perfil central
    where central.organizacao_id = v_central_id
      and central.ativo
      and (p_linha is null or central.linha = p_linha)
      and (
        central.linha is null
        or exists (
          select 1
          from linhas_liberadas_organizacao l
          where l.linha = central.linha and l.organizacao_id = v_organizacao_id
        )
      )
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

  -- Perfis já copiados, na linha pedida (ou em qualquer linha), liberados
  -- para a minha organização (ou sem linha), cuja origem central avançou
  -- de revisão.
  for v_central in
    select central.*, local.id as id_local
    from modelos_perfil local
    join modelos_perfil central on central.id = local.origem_perfil_id
    where local.organizacao_id = v_organizacao_id
      and central.organizacao_id = v_central_id
      and central.revisao_catalogo > local.origem_revisao_catalogo
      and (p_linha is null or central.linha = p_linha)
      and (
        central.linha is null
        or exists (
          select 1
          from linhas_liberadas_organizacao l
          where l.linha = central.linha and l.organizacao_id = v_organizacao_id
        )
      )
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

grant execute on function sincronizar_catalogo_central(text) to authenticated;
