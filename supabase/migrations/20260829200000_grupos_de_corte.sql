-- "Corte por peça" muda de mecanismo outra vez: de uma entrada por PEÇA
-- física para uma entrada por GRUPO de peças que compartilham o mesmo
-- corte, cada grupo com a própria quantidade.
--
-- ── POR QUE ISTO MUDOU ────────────────────────────────────────────────────
--
-- A versão anterior (`cortes_por_peca`) guardava uma entrada por peça: 4
-- peças, 4 entradas — mesmo quando só existiam 2 cortes diferentes entre
-- elas (2 retas, 2 em meia-esquadria). Isso obrigava a pessoa a preencher
-- 4 cartões repetindo o mesmo corte duas vezes, e a folha impressa
-- desenhava a mesma peça 4 vezes em vez de 2 — pequeno demais para
-- conferir na bancada, e sem necessidade nenhuma.
--
-- ── A SAÍDA: UM GRUPO POR CORTE DISTINTO, NÃO POR PEÇA ───────────────────
--
-- `grupos_de_corte` guarda, quando presente, um array de
-- `{quantidade, sentido, corte_inicio, corte_fim}` — cada grupo diz QUANTAS
-- peças usam aquele corte. A soma das quantidades de todos os grupos
-- sempre bate com `quantidade`. "4 peças, 2 retas e 2 em meia-esquadria"
-- vira 2 grupos, não 4 entradas quase iguais.

alter table itens_lista_tecnica
  rename column cortes_por_peca to grupos_de_corte;

alter table itens_lista_tecnica
  drop constraint if exists cortes_por_peca_valido;

-- Converte os dados já gravados no formato antigo (um elemento por peça)
-- para o novo (um elemento por grupo, com quantidade) — agrupando peças
-- consecutivas com o mesmo corte. Função de uso único: existe só para este
-- backfill, e é removida no fim da migração.
create or replace function agrupar_cortes_por_peca(p_cortes jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  v_peca jsonb;
  v_grupos jsonb := '[]'::jsonb;
  v_atual jsonb := null;
  v_quantidade integer := 0;
begin
  if p_cortes is null then
    return null;
  end if;

  for v_peca in select * from jsonb_array_elements(p_cortes)
  loop
    if v_atual is not null
       and v_atual ->> 'sentido' = v_peca ->> 'sentido'
       and v_atual ->> 'corte_inicio' = v_peca ->> 'corte_inicio'
       and v_atual ->> 'corte_fim' = v_peca ->> 'corte_fim'
    then
      v_quantidade := v_quantidade + 1;
    else
      if v_atual is not null then
        v_grupos := v_grupos || jsonb_build_object(
          'quantidade', v_quantidade,
          'sentido', v_atual ->> 'sentido',
          'corte_inicio', v_atual ->> 'corte_inicio',
          'corte_fim', v_atual ->> 'corte_fim'
        );
      end if;

      v_atual := v_peca;
      v_quantidade := 1;
    end if;
  end loop;

  if v_atual is not null then
    v_grupos := v_grupos || jsonb_build_object(
      'quantidade', v_quantidade,
      'sentido', v_atual ->> 'sentido',
      'corte_inicio', v_atual ->> 'corte_inicio',
      'corte_fim', v_atual ->> 'corte_fim'
    );
  end if;

  return v_grupos;
end;
$$;

update itens_lista_tecnica
set grupos_de_corte = agrupar_cortes_por_peca(grupos_de_corte)
where grupos_de_corte is not null;

drop function agrupar_cortes_por_peca(jsonb);

-- Mesma ideia da validação anterior — o `check` só chama uma função,
-- porque um `exists (select ... from jsonb_array_elements(...))` direto no
-- `check` esbarra em "cannot use subquery in check constraint".
create or replace function grupos_de_corte_e_valido(
  p_grupos jsonb,
  p_quantidade integer
)
returns boolean
language plpgsql
immutable
as $$
declare
  v_grupo jsonb;
  v_soma integer := 0;
begin
  if p_grupos is null then
    return true;
  end if;

  if jsonb_typeof(p_grupos) <> 'array' or jsonb_array_length(p_grupos) = 0 then
    return false;
  end if;

  for v_grupo in select * from jsonb_array_elements(p_grupos)
  loop
    if not (
      (v_grupo ->> 'quantidade') ~ '^[0-9]+$'
      and (v_grupo ->> 'quantidade')::integer > 0
      and v_grupo ->> 'sentido' in ('h', 'v')
      and v_grupo ->> 'corte_inicio' in ('reto', 'meia_cima', 'meia_baixo')
      and v_grupo ->> 'corte_fim' in ('reto', 'meia_cima', 'meia_baixo')
    ) then
      return false;
    end if;

    v_soma := v_soma + (v_grupo ->> 'quantidade')::integer;
  end loop;

  -- A soma das quantidades dos grupos precisa bater com a quantidade da
  -- própria linha — é o que substitui o antigo "tamanho do array = quantidade".
  return v_soma = p_quantidade;
end;
$$;

alter table itens_lista_tecnica
  add constraint grupos_de_corte_valido check (
    grupos_de_corte_e_valido(grupos_de_corte, quantidade)
  );

comment on column itens_lista_tecnica.grupos_de_corte is
  'Grupos de corte, quando a linha não é uniforme — array de
   {quantidade, sentido, corte_inicio, corte_fim}, soma das quantidades
   igual a `quantidade`. Nulo (o comum): toda peça usa o
   sentido/corte_inicio/corte_fim da própria linha.';

-- `sincronizar_produtos_central` copia linha por linha da receita central —
-- só troca o nome da coluna copiada. O retorno da função não muda, então
-- `create or replace` basta.
create or replace function sincronizar_produtos_central()
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
  v_organizacao_id uuid := organizacao_atual();
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

  if not pode_gerenciar_cadastros() then
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

grant execute on function sincronizar_produtos_central() to authenticated;
