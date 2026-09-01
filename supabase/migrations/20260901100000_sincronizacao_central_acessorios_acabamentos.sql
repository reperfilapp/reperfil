-- =============================================================================
-- RePerfil — Catálogo central para acessórios e acabamentos
-- =============================================================================
--
-- Mesmo mecanismo já usado para linhas de perfil e produtos: uma tabela de
-- liberação por organização, sem política de RLS própria (tudo passa por
-- função `security definer`), uma coluna `origem_*_id` para saber de onde a
-- cópia veio, e um par de telas (central libera; empresa sincroniza).
--
-- Acessório sincroniza diferente de perfil: aqui não existe um número de
-- revisão manual para decidir "precisa atualizar" — o dia em que
-- adicionamos foto ao perfil e a sincronização ignorou porque ninguém
-- clicou em "Nova revisão" (corrigido em
-- `20260831800000_sincronizar_foto_sem_nova_revisao.sql`) ensinou a não
-- repetir esse desenho. Aqui a atualização dos campos e da galeria roda
-- SEMPRE que sincronizar, sem depender de nenhum gatilho manual.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Códigos do fabricante por acessório e acabamento
-- -----------------------------------------------------------------------------
create table codigos_fabricante_acessorio (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes (id) on delete cascade,
  modelo_acessorio_id uuid not null references modelos_acessorio (id) on delete cascade,
  acabamento_id uuid references acabamentos (id) on delete set null,
  codigo_fabricante text not null,
  codigo_catalogo text,
  fabricante text not null default 'Udinese',
  criado_em timestamptz not null default now(),

  unique (organizacao_id, codigo_fabricante)
);

comment on table codigos_fabricante_acessorio is
  'Código exato do fabricante (SKU) por acessório e cor/acabamento — um
   acessório cadastrado uma vez, cada cor com seu próprio código. Serve
   para achar o acessório certo a partir do código de uma nota fiscal ou
   etiqueta, e para saber o código exato ao repor estoque.';

create index idx_codigos_fabricante_acessorio_modelo
  on codigos_fabricante_acessorio (modelo_acessorio_id);

alter table codigos_fabricante_acessorio enable row level security;

create policy "ver códigos de fabricante da organização"
  on codigos_fabricante_acessorio for select
  to authenticated
  using (organizacao_id = organizacao_atual());

create policy "cadastros gerencia códigos de fabricante"
  on codigos_fabricante_acessorio for all
  to authenticated
  using (organizacao_id = organizacao_atual() and pode_gerenciar_cadastros())
  with check (organizacao_id = organizacao_atual() and pode_gerenciar_cadastros());

-- -----------------------------------------------------------------------------
-- 2. Catálogo central — ACESSÓRIOS
-- -----------------------------------------------------------------------------
create table acessorios_liberados_organizacao (
  modelo_acessorio_id uuid not null references modelos_acessorio (id) on delete cascade,
  organizacao_id uuid not null references organizacoes (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (modelo_acessorio_id, organizacao_id)
);

comment on table acessorios_liberados_organizacao is
  'Uma linha por (acessório do catálogo central, organização) liberada para
   importar aquele acessório. Ausência = bloqueado. Só mexido pelas funções
   abaixo, nunca direto pelo cliente.';

alter table acessorios_liberados_organizacao enable row level security;
-- Sem política nenhuma, de propósito — mesmo motivo de produtos_liberados_organizacao.

alter table modelos_acessorio
  add column origem_acessorio_id uuid references modelos_acessorio (id) on delete set null;

comment on column modelos_acessorio.origem_acessorio_id is
  'O acessório do catálogo central de onde este foi importado. Nulo em
   acessório criado pela própria empresa.';

create index idx_modelos_acessorio_origem
  on modelos_acessorio (organizacao_id, origem_acessorio_id);

-- ── PARA A ORGANIZAÇÃO CENTRAL: por acessório ───────────────────────────

create or replace function organizacoes_para_liberacao_acessorio(p_modelo_acessorio_id uuid)
returns table (organizacao_id uuid, nome_fantasia text, liberada boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if organizacao_atual() <> organizacao_catalogo_central() or not pode_gerenciar_cadastros() then
    raise exception 'Só quem administra o catálogo central gerencia liberação de acessório.'
      using errcode = 'insufficient_privilege';
  end if;

  return query
    select
      o.id,
      o.nome_fantasia,
      exists (
        select 1
        from acessorios_liberados_organizacao l
        where l.modelo_acessorio_id = p_modelo_acessorio_id and l.organizacao_id = o.id
      )
    from organizacoes o
    where o.id <> organizacao_catalogo_central()
      and o.ativo
    order by o.nome_fantasia;
end;
$$;

grant execute on function organizacoes_para_liberacao_acessorio(uuid) to authenticated;

create or replace function definir_liberacao_acessorio(
  p_modelo_acessorio_id uuid,
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
    raise exception 'Só quem administra o catálogo central gerencia liberação de acessório.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_liberada then
    insert into acessorios_liberados_organizacao (modelo_acessorio_id, organizacao_id)
    values (p_modelo_acessorio_id, p_organizacao_id)
    on conflict (modelo_acessorio_id, organizacao_id) do nothing;
  else
    delete from acessorios_liberados_organizacao
    where modelo_acessorio_id = p_modelo_acessorio_id and organizacao_id = p_organizacao_id;
  end if;
end;
$$;

grant execute on function definir_liberacao_acessorio(uuid, uuid, boolean) to authenticated;

create or replace function definir_liberacao_acessorio_todas(
  p_modelo_acessorio_id uuid,
  p_liberada boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if organizacao_atual() <> organizacao_catalogo_central() or not pode_gerenciar_cadastros() then
    raise exception 'Só quem administra o catálogo central gerencia liberação de acessório.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_liberada then
    insert into acessorios_liberados_organizacao (modelo_acessorio_id, organizacao_id)
    select p_modelo_acessorio_id, o.id
    from organizacoes o
    where o.id <> organizacao_catalogo_central() and o.ativo
    on conflict (modelo_acessorio_id, organizacao_id) do nothing;
  else
    delete from acessorios_liberados_organizacao where modelo_acessorio_id = p_modelo_acessorio_id;
  end if;
end;
$$;

grant execute on function definir_liberacao_acessorio_todas(uuid, boolean) to authenticated;

-- ── PARA A ORGANIZAÇÃO CENTRAL: por empresa ─────────────────────────────

create or replace function acessorios_para_organizacao(p_organizacao_id uuid)
returns table (modelo_acessorio_id uuid, codigo text, descricao text, liberada boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if organizacao_atual() <> organizacao_catalogo_central() or not pode_gerenciar_cadastros() then
    raise exception 'Só quem administra o catálogo central gerencia liberação de acessório.'
      using errcode = 'insufficient_privilege';
  end if;

  return query
    select
      a.id,
      a.codigo,
      a.descricao,
      exists (
        select 1
        from acessorios_liberados_organizacao l
        where l.modelo_acessorio_id = a.id and l.organizacao_id = p_organizacao_id
      )
    from modelos_acessorio a
    where a.organizacao_id = organizacao_catalogo_central()
      and a.ativo
    order by a.descricao;
end;
$$;

grant execute on function acessorios_para_organizacao(uuid) to authenticated;

create or replace function definir_liberacao_todos_acessorios_organizacao(
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
    raise exception 'Só quem administra o catálogo central gerencia liberação de acessório.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_liberada then
    insert into acessorios_liberados_organizacao (modelo_acessorio_id, organizacao_id)
    select a.id, p_organizacao_id
    from modelos_acessorio a
    where a.organizacao_id = organizacao_catalogo_central() and a.ativo
    on conflict (modelo_acessorio_id, organizacao_id) do nothing;
  else
    delete from acessorios_liberados_organizacao
    where organizacao_id = p_organizacao_id;
  end if;
end;
$$;

grant execute on function definir_liberacao_todos_acessorios_organizacao(uuid, boolean)
  to authenticated;

-- ── PARA AS DEMAIS EMPRESAS: importar ───────────────────────────────────

create or replace function acessorios_do_catalogo_central()
returns table (
  modelo_acessorio_id uuid,
  codigo text,
  descricao text,
  ja_importado boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    a.id,
    a.codigo,
    a.descricao,
    exists (
      select 1
      from modelos_acessorio meu
      where meu.organizacao_id = organizacao_atual()
        and meu.origem_acessorio_id = a.id
    )
  from modelos_acessorio a
  join acessorios_liberados_organizacao l
    on l.modelo_acessorio_id = a.id and l.organizacao_id = organizacao_atual()
  where a.organizacao_id = organizacao_catalogo_central()
    and a.ativo
  order by a.descricao
$$;

grant execute on function acessorios_do_catalogo_central() to authenticated;

/*
 * Importa/atualiza os acessórios liberados — foto, desenho técnico e
 * códigos do fabricante inclusos, sempre, sem depender de revisão manual.
 */
create or replace function sincronizar_acessorios_central()
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
  v_organizacao_id uuid := organizacao_atual();
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

    -- Desenho técnico: substituído por inteiro (mesma lógica de perfil —
    -- é sempre UM desenho por família, então recriar é mais simples e mais
    -- seguro que tentar casar linha a linha).
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

    -- Foto real: só entra a que ainda não existe localmente (poderia já
    -- ter sido cadastrada uma foto própria da empresa, e essa não some).
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

    -- Códigos do fabricante: só os que ainda não existem localmente —
    -- `codigo_fabricante` é único por organização, então um `not exists`
    -- evita erro de duplicidade sem precisar de upsert.
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

grant execute on function sincronizar_acessorios_central() to authenticated;

-- -----------------------------------------------------------------------------
-- 3. Catálogo central — ACABAMENTOS
-- -----------------------------------------------------------------------------
-- Mais simples que acessório: sem imagem, sem tabela filha — só os campos
-- escalares.
create table acabamentos_liberados_organizacao (
  acabamento_id uuid not null references acabamentos (id) on delete cascade,
  organizacao_id uuid not null references organizacoes (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (acabamento_id, organizacao_id)
);

comment on table acabamentos_liberados_organizacao is
  'Uma linha por (acabamento do catálogo central, organização) liberada
   para importar aquele acabamento. Ausência = bloqueado.';

alter table acabamentos_liberados_organizacao enable row level security;

alter table acabamentos
  add column origem_acabamento_id uuid references acabamentos (id) on delete set null;

comment on column acabamentos.origem_acabamento_id is
  'O acabamento do catálogo central de onde este foi importado. Nulo em
   acabamento criado pela própria empresa.';

create index idx_acabamentos_origem
  on acabamentos (organizacao_id, origem_acabamento_id);

create or replace function organizacoes_para_liberacao_acabamento(p_acabamento_id uuid)
returns table (organizacao_id uuid, nome_fantasia text, liberada boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if organizacao_atual() <> organizacao_catalogo_central() or not pode_gerenciar_cadastros() then
    raise exception 'Só quem administra o catálogo central gerencia liberação de acabamento.'
      using errcode = 'insufficient_privilege';
  end if;

  return query
    select
      o.id,
      o.nome_fantasia,
      exists (
        select 1
        from acabamentos_liberados_organizacao l
        where l.acabamento_id = p_acabamento_id and l.organizacao_id = o.id
      )
    from organizacoes o
    where o.id <> organizacao_catalogo_central()
      and o.ativo
    order by o.nome_fantasia;
end;
$$;

grant execute on function organizacoes_para_liberacao_acabamento(uuid) to authenticated;

create or replace function definir_liberacao_acabamento(
  p_acabamento_id uuid,
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
    raise exception 'Só quem administra o catálogo central gerencia liberação de acabamento.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_liberada then
    insert into acabamentos_liberados_organizacao (acabamento_id, organizacao_id)
    values (p_acabamento_id, p_organizacao_id)
    on conflict (acabamento_id, organizacao_id) do nothing;
  else
    delete from acabamentos_liberados_organizacao
    where acabamento_id = p_acabamento_id and organizacao_id = p_organizacao_id;
  end if;
end;
$$;

grant execute on function definir_liberacao_acabamento(uuid, uuid, boolean) to authenticated;

create or replace function definir_liberacao_acabamento_todas(
  p_acabamento_id uuid,
  p_liberada boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if organizacao_atual() <> organizacao_catalogo_central() or not pode_gerenciar_cadastros() then
    raise exception 'Só quem administra o catálogo central gerencia liberação de acabamento.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_liberada then
    insert into acabamentos_liberados_organizacao (acabamento_id, organizacao_id)
    select p_acabamento_id, o.id
    from organizacoes o
    where o.id <> organizacao_catalogo_central() and o.ativo
    on conflict (acabamento_id, organizacao_id) do nothing;
  else
    delete from acabamentos_liberados_organizacao where acabamento_id = p_acabamento_id;
  end if;
end;
$$;

grant execute on function definir_liberacao_acabamento_todas(uuid, boolean) to authenticated;

create or replace function acabamentos_para_organizacao(p_organizacao_id uuid)
returns table (acabamento_id uuid, codigo text, nome text, liberada boolean)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if organizacao_atual() <> organizacao_catalogo_central() or not pode_gerenciar_cadastros() then
    raise exception 'Só quem administra o catálogo central gerencia liberação de acabamento.'
      using errcode = 'insufficient_privilege';
  end if;

  return query
    select
      a.id,
      a.codigo,
      a.nome,
      exists (
        select 1
        from acabamentos_liberados_organizacao l
        where l.acabamento_id = a.id and l.organizacao_id = p_organizacao_id
      )
    from acabamentos a
    where a.organizacao_id = organizacao_catalogo_central()
      and a.ativo
    order by a.nome;
end;
$$;

grant execute on function acabamentos_para_organizacao(uuid) to authenticated;

create or replace function definir_liberacao_todos_acabamentos_organizacao(
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
    raise exception 'Só quem administra o catálogo central gerencia liberação de acabamento.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_liberada then
    insert into acabamentos_liberados_organizacao (acabamento_id, organizacao_id)
    select a.id, p_organizacao_id
    from acabamentos a
    where a.organizacao_id = organizacao_catalogo_central() and a.ativo
    on conflict (acabamento_id, organizacao_id) do nothing;
  else
    delete from acabamentos_liberados_organizacao
    where organizacao_id = p_organizacao_id;
  end if;
end;
$$;

grant execute on function definir_liberacao_todos_acabamentos_organizacao(uuid, boolean)
  to authenticated;

create or replace function acabamentos_do_catalogo_central()
returns table (
  acabamento_id uuid,
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
    a.id,
    a.codigo,
    a.nome,
    exists (
      select 1
      from acabamentos meu
      where meu.organizacao_id = organizacao_atual()
        and meu.origem_acabamento_id = a.id
    )
  from acabamentos a
  join acabamentos_liberados_organizacao l
    on l.acabamento_id = a.id and l.organizacao_id = organizacao_atual()
  where a.organizacao_id = organizacao_catalogo_central()
    and a.ativo
  order by a.nome
$$;

grant execute on function acabamentos_do_catalogo_central() to authenticated;

create or replace function sincronizar_acabamentos_central()
returns table (acabamentos_novos integer, acabamentos_atualizados integer)
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

grant execute on function sincronizar_acabamentos_central() to authenticated;

-- -----------------------------------------------------------------------------
-- Os acessórios e acabamentos que o central JÁ TEM ficam liberados para as
-- empresas que já existem — mesmo raciocínio de `liberacao_produto_por_empresa`:
-- é o estado que se esperaria encontrar, e evita um catálogo inteiro
-- nascendo bloqueado sem ninguém ter decidido isso.
-- -----------------------------------------------------------------------------
insert into acessorios_liberados_organizacao (modelo_acessorio_id, organizacao_id)
select a.id, o.id
from modelos_acessorio a
cross join organizacoes o
where a.organizacao_id = organizacao_catalogo_central()
  and a.ativo
  and o.id <> organizacao_catalogo_central()
  and o.ativo
on conflict (modelo_acessorio_id, organizacao_id) do nothing;

insert into acabamentos_liberados_organizacao (acabamento_id, organizacao_id)
select a.id, o.id
from acabamentos a
cross join organizacoes o
where a.organizacao_id = organizacao_catalogo_central()
  and a.ativo
  and o.id <> organizacao_catalogo_central()
  and o.ativo
on conflict (acabamento_id, organizacao_id) do nothing;
