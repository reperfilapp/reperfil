-- Produto do catálogo central liberado por empresa — o mesmo controle que já
-- existe para LINHA de perfil, agora para produto.
--
-- ── O QUE FALTAVA ────────────────────────────────────────────────────────
--
-- Produto nunca teve caminho nenhum entre organizações. A política de
-- leitura filtra por `organizacao_id` e ponto: um produto cadastrado no
-- catálogo central simplesmente não existia para as demais empresas, e não
-- havia tela, função ou coluna para mudar isso. Não era um bloqueio ligado —
-- era a ausência do mecanismo.
--
-- ── POR QUE COPIAR, E NÃO SÓ ENXERGAR ────────────────────────────────────
--
-- Seria mais simples abrir uma política de leitura cruzada e deixar a
-- empresa ver o produto do central. Mas a lista técnica aponta para
-- `modelo_perfil_id`, e o perfil de cada empresa é uma CÓPIA do central,
-- com id próprio. Um produto lido direto do central traria uma receita que
-- aponta para perfis de outra organização — a tela de viabilidade
-- procuraria esses perfis no estoque local e não acharia nada, para sempre.
--
-- Então o produto é importado, como o perfil já é, e a lista técnica é
-- remapeada pelo `origem_perfil_id` que a cópia local do perfil já guarda.

create table if not exists produtos_liberados_organizacao (
  produto_id uuid not null references produtos (id) on delete cascade,
  organizacao_id uuid not null references organizacoes (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (produto_id, organizacao_id)
);

comment on table produtos_liberados_organizacao is
  'Uma linha por (produto do catálogo central, organização) liberada para
   importar aquele produto. Ausência = bloqueado. Só mexido pelas funções
   abaixo, nunca direto pelo cliente.';

alter table produtos_liberados_organizacao enable row level security;
-- Sem política nenhuma, de propósito: toda leitura e escrita passa pelas
-- funções `security definer` abaixo, que conferem quem pode o quê.

-- Liga o produto importado ao original, para reimportar atualizar em vez de
-- duplicar — o mesmo papel que `origem_perfil_id` faz no perfil.
alter table produtos
  add column if not exists origem_produto_id uuid
    references produtos (id) on delete set null;

comment on column produtos.origem_produto_id is
  'O produto do catálogo central de onde este foi importado. Nulo em produto
   criado pela própria empresa.';

create index if not exists idx_produtos_origem
  on produtos (organizacao_id, origem_produto_id);

-- Os produtos que o central JÁ tem ficam liberados para as empresas que já
-- existem: é a resposta ao problema que motivou esta migração, e o estado
-- que a pessoa esperava encontrar. Produto novo, dali em diante, nasce
-- bloqueado — mesma regra da linha, e é o administrador do central quem
-- decide.
insert into produtos_liberados_organizacao (produto_id, organizacao_id)
select p.id, o.id
from produtos p
cross join organizacoes o
where p.organizacao_id = organizacao_catalogo_central()
  and p.ativo
  and o.id <> organizacao_catalogo_central()
  and o.ativo
on conflict (produto_id, organizacao_id) do nothing;

-- ── PARA A ORGANIZAÇÃO CENTRAL: por produto ─────────────────────────────

create or replace function organizacoes_para_liberacao_produto(p_produto_id uuid)
returns table (organizacao_id uuid, nome_fantasia text, liberada boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if organizacao_atual() <> organizacao_catalogo_central() or not pode_gerenciar_cadastros() then
    raise exception 'Só quem administra o catálogo central gerencia liberação de produto.'
      using errcode = 'insufficient_privilege';
  end if;

  return query
    select
      o.id,
      o.nome_fantasia,
      exists (
        select 1
        from produtos_liberados_organizacao l
        where l.produto_id = p_produto_id and l.organizacao_id = o.id
      )
    from organizacoes o
    where o.id <> organizacao_catalogo_central()
      and o.ativo
    order by o.nome_fantasia;
end;
$$;

grant execute on function organizacoes_para_liberacao_produto(uuid) to authenticated;

create or replace function definir_liberacao_produto(
  p_produto_id uuid,
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
    raise exception 'Só quem administra o catálogo central gerencia liberação de produto.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_liberada then
    insert into produtos_liberados_organizacao (produto_id, organizacao_id)
    values (p_produto_id, p_organizacao_id)
    on conflict (produto_id, organizacao_id) do nothing;
  else
    delete from produtos_liberados_organizacao
    where produto_id = p_produto_id and organizacao_id = p_organizacao_id;
  end if;
end;
$$;

grant execute on function definir_liberacao_produto(uuid, uuid, boolean) to authenticated;

create or replace function definir_liberacao_produto_todas(
  p_produto_id uuid,
  p_liberada boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if organizacao_atual() <> organizacao_catalogo_central() or not pode_gerenciar_cadastros() then
    raise exception 'Só quem administra o catálogo central gerencia liberação de produto.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_liberada then
    insert into produtos_liberados_organizacao (produto_id, organizacao_id)
    select p_produto_id, o.id
    from organizacoes o
    where o.id <> organizacao_catalogo_central() and o.ativo
    on conflict (produto_id, organizacao_id) do nothing;
  else
    delete from produtos_liberados_organizacao where produto_id = p_produto_id;
  end if;
end;
$$;

grant execute on function definir_liberacao_produto_todas(uuid, boolean) to authenticated;

-- ── PARA A ORGANIZAÇÃO CENTRAL: por empresa ─────────────────────────────
-- O outro ângulo da mesma tabela: em vez de "quem vê este produto", "que
-- produtos esta empresa vê". Duas telas, uma verdade só.

create or replace function produtos_para_organizacao(p_organizacao_id uuid)
returns table (produto_id uuid, codigo text, nome text, liberada boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if organizacao_atual() <> organizacao_catalogo_central() or not pode_gerenciar_cadastros() then
    raise exception 'Só quem administra o catálogo central gerencia liberação de produto.'
      using errcode = 'insufficient_privilege';
  end if;

  return query
    select
      p.id,
      p.codigo,
      p.nome,
      exists (
        select 1
        from produtos_liberados_organizacao l
        where l.produto_id = p.id and l.organizacao_id = p_organizacao_id
      )
    from produtos p
    where p.organizacao_id = organizacao_catalogo_central()
      and p.ativo
    order by p.nome;
end;
$$;

grant execute on function produtos_para_organizacao(uuid) to authenticated;

create or replace function definir_liberacao_todos_produtos_organizacao(
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
    raise exception 'Só quem administra o catálogo central gerencia liberação de produto.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_liberada then
    insert into produtos_liberados_organizacao (produto_id, organizacao_id)
    select p.id, p_organizacao_id
    from produtos p
    where p.organizacao_id = organizacao_catalogo_central() and p.ativo
    on conflict (produto_id, organizacao_id) do nothing;
  else
    delete from produtos_liberados_organizacao
    where organizacao_id = p_organizacao_id;
  end if;
end;
$$;

grant execute on function definir_liberacao_todos_produtos_organizacao(uuid, boolean)
  to authenticated;

-- ── PARA AS DEMAIS EMPRESAS: importar ───────────────────────────────────

create or replace function produtos_do_catalogo_central()
returns table (
  produto_id uuid,
  codigo text,
  nome text,
  ja_importado boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.id,
    p.codigo,
    p.nome,
    exists (
      select 1
      from produtos meu
      where meu.organizacao_id = organizacao_atual()
        and meu.origem_produto_id = p.id
    )
  from produtos p
  join produtos_liberados_organizacao l
    on l.produto_id = p.id and l.organizacao_id = organizacao_atual()
  where p.organizacao_id = organizacao_catalogo_central()
    and p.ativo
  order by p.nome
$$;

grant execute on function produtos_do_catalogo_central() to authenticated;

/*
 * Importa os produtos liberados, remapeando a lista técnica.
 *
 * ── O REMAPEAMENTO É O CORAÇÃO DISTO ────────────────────────────────────
 *
 * Cada item da receita central aponta para um perfil DO CENTRAL. A cópia
 * local desse perfil guarda `origem_perfil_id` apontando de volta — é por
 * essa ligação que se descobre qual perfil local corresponde a cada item.
 *
 * Item cujo perfil a empresa ainda não importou fica DE FORA, e é contado
 * em `itens_sem_perfil`. Trazer o item apontando para o perfil do central
 * seria pior do que não trazer: a tela de viabilidade procuraria no estoque
 * local um perfil que não é de lá, não acharia nunca, e diria "falta
 * material" para sempre — sem nada na tela explicando por quê.
 */
create or replace function sincronizar_produtos_central()
returns table (
  produtos_novos integer,
  produtos_atualizados integer,
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
  v_novos integer := 0;
  v_atualizados integer := 0;
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
          desenho_url = v_central.desenho_url
      where id = v_local_id;

      v_atualizados := v_atualizados + 1;
    end if;

    -- A receita é REESCRITA, não mesclada: mesclar deixaria itens de uma
    -- versão anterior convivendo com os novos, e uma lista técnica com
    -- corte a mais é peça a mais na serra.
    delete from itens_lista_tecnica where produto_id = v_local_id;

    insert into itens_lista_tecnica (
      organizacao_id, produto_id, modelo_perfil_id,
      comprimento_mm, quantidade, ordem,
      sentido, corte_inicio, corte_fim, observacao
    )
    select
      v_organizacao_id, v_local_id, meu.id,
      i.comprimento_mm, i.quantidade, i.ordem,
      i.sentido, i.corte_inicio, i.corte_fim, i.observacao
    from itens_lista_tecnica i
    join modelos_perfil meu
      on meu.organizacao_id = v_organizacao_id
     and meu.origem_perfil_id = i.modelo_perfil_id
    where i.produto_id = v_central.id;

    -- Quantos itens ficaram de fora por falta do perfil correspondente.
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

  return query select v_novos, v_atualizados, v_sem_perfil;
end;
$$;

grant execute on function sincronizar_produtos_central() to authenticated;
