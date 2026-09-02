-- =============================================================================
-- RePerfil — Sincronização de perfil passa a copiar o estado de revisão
-- =============================================================================
--
-- Bug real (ALUMIFORT, 02/09/2026): os 8 perfis da Linha 42 estão revisados
-- no catálogo central, mas depois de sincronizar continuam "Rev.: 0" na
-- Alumifort. `sincronizar_catalogo_central` nunca copiava `revisado`,
-- `revisado_em` nem `revisado_por` — nem ao criar a cópia nova, nem ao
-- atualizar uma já existente. Toda cópia nasce com o padrão da coluna
-- (`revisado = false`), não importa o que valha no central.
--
-- Pensando de novo, faz sentido copiar: a revisão confirma que as MEDIDAS
-- estão certas, e como todo o resto do perfil (medidas incluídas) já vem
-- de confiança total do central, a confirmação de que essas medidas
-- estão certas deveria vir junto — não teria sentido a empresa precisar
-- reconferir manualmente uma medida que ela nem digitou, só copiou.
-- =============================================================================

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
      origem_perfil_id, origem_revisao_catalogo,
      revisado, revisado_em, revisado_por
    )
    values (
      v_organizacao_id, v_central.codigo, v_central.descricao, v_central.fabricante,
      v_central.linha, v_central.categoria, v_central.aplicacao,
      v_central.largura_secao_mm, v_central.altura_secao_mm, v_central.medida_3_secao_mm,
      v_central.medida_4_secao_mm, v_central.codigo_barras, v_central.comprimento_barra_mm,
      v_central.peso_por_metro_g, v_central.observacoes,
      v_central.id, v_central.revisao_catalogo,
      v_central.revisado, v_central.revisado_em, v_central.revisado_por
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
        origem_revisao_catalogo = v_central.revisao_catalogo,
        revisado = v_central.revisado,
        revisado_em = v_central.revisado_em,
        revisado_por = v_central.revisado_por
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
-- Conserto retroativo: perfis JÁ copiados que ficaram "não revisado" só por
-- causa deste bug — o central está revisado, e a cópia local tem
-- exatamente os mesmos dados dele (senão `sincronizar_catalogo_central`
-- teria atualizado e este `update` já bastaria para os próximos casos).
-- Sem isso, a empresa precisaria rodar a sincronização de novo (que não
-- traria nada, porque os dados já estão iguais) só para herdar este campo.
-- -----------------------------------------------------------------------------
update modelos_perfil local
set revisado = central.revisado,
    revisado_em = central.revisado_em,
    revisado_por = central.revisado_por
from modelos_perfil central
where local.origem_perfil_id = central.id
  and central.organizacao_id = organizacao_catalogo_central()
  and central.revisado
  and not local.revisado;
