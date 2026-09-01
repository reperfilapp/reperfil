-- =============================================================================
-- RePerfil — Sincronização em lote disparada pela organização central
-- =============================================================================
--
-- Hoje a sincronização é sempre PUXADA: cada empresa cliente entra na
-- própria tela e clica em "Importar do catálogo central" — as 4 funções
-- abaixo sempre operam sobre `organizacao_atual()`, ou seja, sobre quem
-- está logado. Não existe hoje um jeito da central atualizar várias
-- empresas de uma vez.
--
-- Esta migração:
-- 1. Dá à empresa um jeito de "aceitar" ser incluída num disparo em lote
--    (`organizacoes.sincronizacao_automatica`) — continua sendo a CENTRAL
--    quem aperta o botão, isto só decide quem entra na lista.
-- 2. Deixa as 4 funções de sincronização aceitarem uma organização-alvo —
--    só o administrador do catálogo central pode passar uma organização
--    que não é a sua própria. Chamada sem esse parâmetro continua 100%
--    igual a hoje (é o `default null`, resolvido para `organizacao_atual()`).
--
-- POR QUE `drop function` antes de cada `create or replace`: mudar a
-- LISTA de parâmetros (mesmo só acrescentando um argumento com `default`)
-- faz o Postgres tratar como uma função DIFERENTE (funções são
-- identificadas por nome + tipos dos argumentos) — sem o `drop`, ficariam
-- DUAS versões da mesma função (a antiga sem o parâmetro novo, e esta),
-- e uma chamada antiga (só com `p_linha`, por exemplo) ficaria ambígua
-- entre as duas. O `drop` garante que só existe uma versão de cada.
--
-- `empresas_para_central()` precisa do mesmo `drop` por um motivo
-- diferente: os argumentos dela não mudam (continua sem nenhum), mas o
-- `returns table` ganha uma coluna — e o Postgres recusa mudar o tipo de
-- retorno de uma função existente via `create or replace`, mesmo só
-- acrescentando coluna (erro 42P13, "cannot change return type of
-- existing function"). Sem o `drop`, este arquivo inteiro falha no meio.
-- =============================================================================

alter table organizacoes
  add column sincronizacao_automatica boolean not null default false;

comment on column organizacoes.sincronizacao_automatica is
  'A empresa aceitou ser incluída quando a organização central disparar a
   sincronização em lote (painel de sincronização da central). Não muda
   nada sozinho — só decide quem entra na lista quando a central aciona.';

-- -----------------------------------------------------------------------------
-- 1. Perfis (e linhas, via `p_linha`)
-- -----------------------------------------------------------------------------
drop function if exists sincronizar_catalogo_central(text);

create or replace function sincronizar_catalogo_central(
  p_linha text default null,
  p_organizacao_id uuid default null
)
returns table (perfis_novos integer, perfis_atualizados integer, imagens_novas integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid := coalesce(p_organizacao_id, organizacao_atual());
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

  if p_organizacao_id is not null and p_organizacao_id <> organizacao_atual() then
    if organizacao_atual() <> organizacao_catalogo_central() or not e_administrador() then
      raise exception 'Apenas o administrador do catálogo central pode sincronizar por outra empresa.'
        using errcode = 'insufficient_privilege';
    end if;
  elsif not pode_gerenciar_cadastros() then
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
  -- linha, se `p_linha` for nulo), a organização-alvo está liberada para
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
      largura_mm, altura_mm, escala, sanitizado, observacoes_tecnicas, legenda, ordem,
      embedding, embedding_ok, embedding_erro
    )
    select
      v_organizacao_id, v_novo_id, av.tipo, av.arquivo_url, av.nome_original,
      av.largura_mm, av.altura_mm, av.escala, av.sanitizado, av.observacoes_tecnicas,
      av.legenda, av.ordem,
      av.embedding, av.embedding_ok, av.embedding_erro
    from arquivos_vetoriais av
    where av.modelo_perfil_id = v_central.id
      and av.organizacao_id = v_central_id;

    get diagnostics v_qtd_imagens = row_count;
    v_imagens_novas := v_imagens_novas + v_qtd_imagens;
    v_perfis_novos := v_perfis_novos + 1;
  end loop;

  -- Perfis já copiados, na linha pedida (ou em qualquer linha), liberados
  -- para a organização-alvo (ou sem linha), cuja origem central avançou
  -- de revisão OU ganhou algum arquivo (foto/desenho) que a cópia local
  -- ainda não tem — as duas coisas contam como "precisa atualizar".
  for v_central in
    select central.*, local.id as id_local
    from modelos_perfil local
    join modelos_perfil central on central.id = local.origem_perfil_id
    where local.organizacao_id = v_organizacao_id
      and central.organizacao_id = v_central_id
      and (
        central.revisao_catalogo > local.origem_revisao_catalogo
        or exists (
          select 1
          from arquivos_vetoriais av_central
          where av_central.modelo_perfil_id = central.id
            and not exists (
              select 1
              from arquivos_vetoriais av_local
              where av_local.modelo_perfil_id = local.id
                and av_local.arquivo_url = av_central.arquivo_url
            )
        )
      )
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
      largura_mm, altura_mm, escala, sanitizado, observacoes_tecnicas, legenda, ordem,
      embedding, embedding_ok, embedding_erro
    )
    select
      v_organizacao_id, v_central.id_local, av.tipo, av.arquivo_url, av.nome_original,
      av.largura_mm, av.altura_mm, av.escala, av.sanitizado, av.observacoes_tecnicas,
      av.legenda, av.ordem,
      av.embedding, av.embedding_ok, av.embedding_erro
    from arquivos_vetoriais av
    where av.modelo_perfil_id = v_central.id
      and av.organizacao_id = v_central_id
      and av.tipo = 'imagem';

    get diagnostics v_qtd_imagens = row_count;
    v_imagens_novas := v_imagens_novas + v_qtd_imagens;

    insert into arquivos_vetoriais (
      organizacao_id, modelo_perfil_id, tipo, arquivo_url, nome_original,
      largura_mm, altura_mm, escala, sanitizado, observacoes_tecnicas, legenda, ordem,
      embedding, embedding_ok, embedding_erro
    )
    select
      v_organizacao_id, v_central.id_local, av.tipo, av.arquivo_url, av.nome_original,
      av.largura_mm, av.altura_mm, av.escala, av.sanitizado, av.observacoes_tecnicas,
      av.legenda, av.ordem,
      av.embedding, av.embedding_ok, av.embedding_erro
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

grant execute on function sincronizar_catalogo_central(text, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Produtos
-- -----------------------------------------------------------------------------
drop function if exists sincronizar_produtos_central();

create or replace function sincronizar_produtos_central(p_organizacao_id uuid default null)
returns table (
  produtos_novos integer,
  produtos_atualizados integer,
  produtos_vinculados integer,
  produtos_em_conflito integer,
  itens_sem_perfil integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid := coalesce(p_organizacao_id, organizacao_atual());
  v_central_id uuid := organizacao_catalogo_central();
  v_central record;
  v_local_id uuid;
  v_adotado_id uuid;
  v_novos integer := 0;
  v_atualizados integer := 0;
  v_vinculados integer := 0;
  v_conflitos integer := 0;
  v_sem_perfil integer := 0;
  v_faltaram integer;
begin
  if v_organizacao_id is null then
    raise exception 'Sessão inválida.' using errcode = 'insufficient_privilege';
  end if;

  if p_organizacao_id is not null and p_organizacao_id <> organizacao_atual() then
    if organizacao_atual() <> organizacao_catalogo_central() or not e_administrador() then
      raise exception 'Apenas o administrador do catálogo central pode sincronizar por outra empresa.'
        using errcode = 'insufficient_privilege';
    end if;
  elsif not pode_gerenciar_cadastros() then
    raise exception 'Sem permissão para gerenciar cadastros.'
      using errcode = 'insufficient_privilege';
  end if;

  if v_central_id is null then
    raise exception 'Nenhuma organização está marcada como catálogo central.'
      using errcode = 'check_violation';
  end if;

  if v_organizacao_id = v_central_id then
    raise exception 'A organização central não importa do próprio catálogo.'
      using errcode = 'check_violation';
  end if;

  for v_central in
    select p.*
    from produtos p
    join produtos_liberados_organizacao l
      on l.produto_id = p.id and l.organizacao_id = v_organizacao_id
    where p.organizacao_id = v_central_id and p.ativo
  loop
    select id into v_local_id
    from produtos
    where organizacao_id = v_organizacao_id
      and origem_produto_id = v_central.id;

    if v_local_id is null then
      select id into v_adotado_id
      from produtos
      where organizacao_id = v_organizacao_id
        and codigo = v_central.codigo
        and origem_produto_id is null;

      if v_adotado_id is not null then
        v_local_id := v_adotado_id;
        v_vinculados := v_vinculados + 1;
      elsif exists (
        select 1 from produtos
        where organizacao_id = v_organizacao_id
          and codigo = v_central.codigo
      ) then
        v_conflitos := v_conflitos + 1;
        continue;
      end if;
    end if;

    if v_local_id is null then
      insert into produtos (
        organizacao_id, codigo, nome, descricao,
        largura_mm, altura_mm, observacoes,
        foto_url, desenho_url, origem_produto_id
      )
      values (
        v_organizacao_id, v_central.codigo, v_central.nome, v_central.descricao,
        v_central.largura_mm, v_central.altura_mm, v_central.observacoes,
        v_central.foto_url, v_central.desenho_url, v_central.id
      )
      returning id into v_local_id;

      v_novos := v_novos + 1;
    else
      update produtos
      set nome = v_central.nome,
          descricao = v_central.descricao,
          largura_mm = v_central.largura_mm,
          altura_mm = v_central.altura_mm,
          observacoes = v_central.observacoes,
          foto_url = v_central.foto_url,
          desenho_url = v_central.desenho_url,
          origem_produto_id = v_central.id
      where id = v_local_id;

      if v_adotado_id is null then
        v_atualizados := v_atualizados + 1;
      end if;
    end if;

    v_adotado_id := null;

    delete from itens_lista_tecnica where produto_id = v_local_id;

    insert into itens_lista_tecnica (
      organizacao_id, produto_id, modelo_perfil_id,
      comprimento_mm, quantidade, ordem,
      sentido, corte_inicio, corte_fim, grupos_de_corte, observacao
    )
    select
      v_organizacao_id, v_local_id, meu.id,
      i.comprimento_mm, i.quantidade, i.ordem,
      i.sentido, i.corte_inicio, i.corte_fim, i.grupos_de_corte, i.observacao
    from itens_lista_tecnica i
    join modelos_perfil meu
      on meu.organizacao_id = v_organizacao_id
     and meu.origem_perfil_id = i.modelo_perfil_id
    where i.produto_id = v_central.id;

    select count(*) into v_faltaram
    from itens_lista_tecnica i
    where i.produto_id = v_central.id
      and not exists (
        select 1 from modelos_perfil meu
        where meu.organizacao_id = v_organizacao_id
          and meu.origem_perfil_id = i.modelo_perfil_id
      );

    v_sem_perfil := v_sem_perfil + coalesce(v_faltaram, 0);
  end loop;

  return query
    select v_novos, v_atualizados, v_vinculados, v_conflitos, v_sem_perfil;
end;
$$;

grant execute on function sincronizar_produtos_central(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Acessórios
-- -----------------------------------------------------------------------------
drop function if exists sincronizar_acessorios_central();

create or replace function sincronizar_acessorios_central(p_organizacao_id uuid default null)
returns table (
  acessorios_novos integer,
  acessorios_atualizados integer,
  imagens_novas integer,
  codigos_novos integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid := coalesce(p_organizacao_id, organizacao_atual());
  v_central_id uuid := organizacao_catalogo_central();
  v_central record;
  v_local_id uuid;
  v_qtd integer;
  v_novos integer := 0;
  v_atualizados integer := 0;
  v_imagens_novas integer := 0;
  v_codigos_novos integer := 0;
begin
  if v_organizacao_id is null then
    raise exception 'Sessão inválida.' using errcode = 'insufficient_privilege';
  end if;

  if p_organizacao_id is not null and p_organizacao_id <> organizacao_atual() then
    if organizacao_atual() <> organizacao_catalogo_central() or not e_administrador() then
      raise exception 'Apenas o administrador do catálogo central pode sincronizar por outra empresa.'
        using errcode = 'insufficient_privilege';
    end if;
  elsif not pode_gerenciar_cadastros() then
    raise exception 'Sem permissão para gerenciar cadastros.'
      using errcode = 'insufficient_privilege';
  end if;

  if v_central_id is null then
    raise exception 'Nenhuma organização está marcada como catálogo central.'
      using errcode = 'check_violation';
  end if;

  if v_organizacao_id = v_central_id then
    raise exception 'A organização central não importa do próprio catálogo.'
      using errcode = 'check_violation';
  end if;

  for v_central in
    select a.*
    from modelos_acessorio a
    join acessorios_liberados_organizacao l
      on l.modelo_acessorio_id = a.id and l.organizacao_id = v_organizacao_id
    where a.organizacao_id = v_central_id and a.ativo
  loop
    select id into v_local_id
    from modelos_acessorio
    where organizacao_id = v_organizacao_id
      and origem_acessorio_id = v_central.id;

    if v_local_id is null then
      insert into modelos_acessorio (
        organizacao_id, codigo, descricao, fabricante, categoria,
        unidade_medida, codigo_barras, preco_unitario_centavos, observacoes,
        origem_acessorio_id
      )
      values (
        v_organizacao_id, v_central.codigo, v_central.descricao, v_central.fabricante,
        v_central.categoria, v_central.unidade_medida, v_central.codigo_barras,
        v_central.preco_unitario_centavos, v_central.observacoes,
        v_central.id
      )
      returning id into v_local_id;

      v_novos := v_novos + 1;
    else
      update modelos_acessorio
      set descricao = v_central.descricao,
          fabricante = v_central.fabricante,
          categoria = v_central.categoria,
          unidade_medida = v_central.unidade_medida,
          codigo_barras = v_central.codigo_barras,
          preco_unitario_centavos = v_central.preco_unitario_centavos,
          observacoes = v_central.observacoes
      where id = v_local_id;

      v_atualizados := v_atualizados + 1;
    end if;

    delete from arquivos_vetoriais
    where modelo_acessorio_id = v_local_id
      and tipo = 'imagem';

    insert into arquivos_vetoriais (
      organizacao_id, modelo_acessorio_id, tipo, arquivo_url, nome_original,
      largura_mm, altura_mm, escala, sanitizado, observacoes_tecnicas, legenda, ordem,
      embedding, embedding_ok, embedding_erro
    )
    select
      v_organizacao_id, v_local_id, av.tipo, av.arquivo_url, av.nome_original,
      av.largura_mm, av.altura_mm, av.escala, av.sanitizado, av.observacoes_tecnicas,
      av.legenda, av.ordem,
      av.embedding, av.embedding_ok, av.embedding_erro
    from arquivos_vetoriais av
    where av.modelo_acessorio_id = v_central.id
      and av.organizacao_id = v_central_id
      and av.tipo = 'imagem';

    get diagnostics v_qtd = row_count;
    v_imagens_novas := v_imagens_novas + v_qtd;

    insert into arquivos_vetoriais (
      organizacao_id, modelo_acessorio_id, tipo, arquivo_url, nome_original,
      largura_mm, altura_mm, escala, sanitizado, observacoes_tecnicas, legenda, ordem,
      embedding, embedding_ok, embedding_erro
    )
    select
      v_organizacao_id, v_local_id, av.tipo, av.arquivo_url, av.nome_original,
      av.largura_mm, av.altura_mm, av.escala, av.sanitizado, av.observacoes_tecnicas,
      av.legenda, av.ordem,
      av.embedding, av.embedding_ok, av.embedding_erro
    from arquivos_vetoriais av
    where av.modelo_acessorio_id = v_central.id
      and av.organizacao_id = v_central_id
      and av.tipo = 'foto'
      and not exists (
        select 1
        from arquivos_vetoriais existente
        where existente.modelo_acessorio_id = v_local_id
          and existente.arquivo_url = av.arquivo_url
      );

    get diagnostics v_qtd = row_count;
    v_imagens_novas := v_imagens_novas + v_qtd;

    insert into codigos_fabricante_acessorio (
      organizacao_id, modelo_acessorio_id, acabamento_id,
      codigo_fabricante, codigo_catalogo, fabricante
    )
    select
      v_organizacao_id, v_local_id, cf.acabamento_id,
      cf.codigo_fabricante, cf.codigo_catalogo, cf.fabricante
    from codigos_fabricante_acessorio cf
    where cf.modelo_acessorio_id = v_central.id
      and cf.organizacao_id = v_central_id
      and not exists (
        select 1
        from codigos_fabricante_acessorio existente
        where existente.organizacao_id = v_organizacao_id
          and existente.codigo_fabricante = cf.codigo_fabricante
      );

    get diagnostics v_qtd = row_count;
    v_codigos_novos := v_codigos_novos + v_qtd;
  end loop;

  return query select v_novos, v_atualizados, v_imagens_novas, v_codigos_novos;
end;
$$;

grant execute on function sincronizar_acessorios_central(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Acabamentos
-- -----------------------------------------------------------------------------
drop function if exists sincronizar_acabamentos_central();

create or replace function sincronizar_acabamentos_central(p_organizacao_id uuid default null)
returns table (acabamentos_novos integer, acabamentos_atualizados integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid := coalesce(p_organizacao_id, organizacao_atual());
  v_central_id uuid := organizacao_catalogo_central();
  v_central record;
  v_local_id uuid;
  v_novos integer := 0;
  v_atualizados integer := 0;
begin
  if v_organizacao_id is null then
    raise exception 'Sessão inválida.' using errcode = 'insufficient_privilege';
  end if;

  if p_organizacao_id is not null and p_organizacao_id <> organizacao_atual() then
    if organizacao_atual() <> organizacao_catalogo_central() or not e_administrador() then
      raise exception 'Apenas o administrador do catálogo central pode sincronizar por outra empresa.'
        using errcode = 'insufficient_privilege';
    end if;
  elsif not pode_gerenciar_cadastros() then
    raise exception 'Sem permissão para gerenciar cadastros.'
      using errcode = 'insufficient_privilege';
  end if;

  if v_central_id is null then
    raise exception 'Nenhuma organização está marcada como catálogo central.'
      using errcode = 'check_violation';
  end if;

  if v_organizacao_id = v_central_id then
    raise exception 'A organização central não importa do próprio catálogo.'
      using errcode = 'check_violation';
  end if;

  for v_central in
    select a.*
    from acabamentos a
    join acabamentos_liberados_organizacao l
      on l.acabamento_id = a.id and l.organizacao_id = v_organizacao_id
    where a.organizacao_id = v_central_id and a.ativo
  loop
    select id into v_local_id
    from acabamentos
    where organizacao_id = v_organizacao_id
      and origem_acabamento_id = v_central.id;

    if v_local_id is null then
      insert into acabamentos (
        organizacao_id, codigo, nome, tipo, codigo_ral, descricao, cor_hex,
        origem_acabamento_id
      )
      values (
        v_organizacao_id, v_central.codigo, v_central.nome, v_central.tipo,
        v_central.codigo_ral, v_central.descricao, v_central.cor_hex,
        v_central.id
      );

      v_novos := v_novos + 1;
    else
      update acabamentos
      set nome = v_central.nome,
          tipo = v_central.tipo,
          codigo_ral = v_central.codigo_ral,
          descricao = v_central.descricao,
          cor_hex = v_central.cor_hex
      where id = v_local_id;

      v_atualizados := v_atualizados + 1;
    end if;
  end loop;

  return query select v_novos, v_atualizados;
end;
$$;

grant execute on function sincronizar_acabamentos_central(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. `empresas_para_central()` ganha a coluna de opt-in — o painel novo
--    (e a tela "Empresas", que ignora a coluna nova) usam a mesma função.
-- -----------------------------------------------------------------------------
drop function if exists empresas_para_central();

create or replace function empresas_para_central()
returns table (
  organizacao_id uuid,
  nome_fantasia text,
  criado_em timestamptz,
  colaboradores bigint,
  exclusao_solicitada_em timestamptz,
  exclusao_motivo text,
  sincronizacao_automatica boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if organizacao_atual() <> organizacao_catalogo_central() or not e_administrador() then
    raise exception 'Apenas o administrador do catálogo central vê esta lista.'
      using errcode = 'insufficient_privilege';
  end if;

  return query
    select
      o.id,
      o.nome_fantasia,
      o.criado_em,
      (select count(*) from perfis_usuario p where p.organizacao_id = o.id),
      o.exclusao_solicitada_em,
      o.exclusao_motivo,
      o.sincronizacao_automatica
    from organizacoes o
    where o.id <> organizacao_catalogo_central()
    -- Quem pediu para sair primeiro: é a lista de trabalho da central.
    order by o.exclusao_solicitada_em desc nulls last, o.nome_fantasia;
end;
$$;

grant execute on function empresas_para_central() to authenticated;
