-- A ordem manual das linhas era POR ORGANIZAÇÃO — cada empresa podia (em
-- teoria) arrastar a própria ordem, independente da central. Não é isso
-- que devia acontecer: só a organização central decide a ordem, e ela
-- vale para TODAS as empresas — inclusive quem já copiou o catálogo.
--
-- `linhas_ordem` deixa de ter `organizacao_id`: passa a ser uma ordem
-- GLOBAL única (a da central), não mais uma por empresa.
delete from linhas_ordem
where organizacao_id <> organizacao_catalogo_central();

-- As políticas antigas dependem da coluna `organizacao_id` — precisam
-- sair ANTES de derrubar a coluna, senão o Postgres recusa o drop.
drop policy if exists "ver ordem das linhas da organização" on linhas_ordem;
drop policy if exists "quem gerencia cadastros define ordem das linhas" on linhas_ordem;
drop policy if exists "quem gerencia cadastros atualiza ordem das linhas" on linhas_ordem;

alter table linhas_ordem drop constraint linhas_ordem_pkey;
alter table linhas_ordem drop column organizacao_id;
alter table linhas_ordem add primary key (linha);

comment on table linhas_ordem is
  'Ordem manual global das linhas do catálogo — só a organização central
   define (em "Linhas e sistemas"), e vale para todas as empresas. Linha
   sem registro aqui entra depois de todas as ordenadas, em ordem
   alfabética.';

-- Toda empresa PRECISA ler para ordenar o próprio catálogo por ela.
create policy "qualquer autenticado ve a ordem das linhas"
  on linhas_ordem for select
  to authenticated
  using (true);

-- Só a organização central escreve.
create policy "central define a ordem das linhas"
  on linhas_ordem for insert
  to authenticated
  with check (
    organizacao_atual() = organizacao_catalogo_central() and pode_gerenciar_cadastros()
  );

create policy "central atualiza a ordem das linhas"
  on linhas_ordem for update
  to authenticated
  using (
    organizacao_atual() = organizacao_catalogo_central() and pode_gerenciar_cadastros()
  );

-- As duas funções que juntavam `linhas_ordem` por organização agora
-- juntam pela linha só — a tabela já é global, não precisa mais filtrar
-- por organização nenhuma.
create or replace function linhas_do_catalogo_central()
returns table (linha text, disponivel boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.linha,
    exists (
      select 1
      from linhas_liberadas_organizacao l
      where l.linha = m.linha and l.organizacao_id = organizacao_atual()
    )
  from (
    select distinct linha
    from modelos_perfil
    where organizacao_id = organizacao_catalogo_central()
      and ativo
      and linha is not null
      and trim(linha) <> ''
  ) m
  left join linhas_ordem lo on lo.linha = m.linha
  order by coalesce(lo.ordem, 999999), m.linha
$$;

grant execute on function linhas_do_catalogo_central() to authenticated;

create or replace function linhas_para_organizacao(p_organizacao_id uuid)
returns table (linha text, liberada boolean)
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
      m.linha,
      exists (
        select 1
        from linhas_liberadas_organizacao l
        where l.linha = m.linha and l.organizacao_id = p_organizacao_id
      )
    from (
      select distinct modelos_perfil.linha
      from modelos_perfil
      where organizacao_id = organizacao_catalogo_central()
        and ativo
        and modelos_perfil.linha is not null
        and trim(modelos_perfil.linha) <> ''
    ) m
    left join linhas_ordem lo on lo.linha = m.linha
    order by coalesce(lo.ordem, 999999), m.linha;
end;
$$;

grant execute on function linhas_para_organizacao(uuid) to authenticated;
