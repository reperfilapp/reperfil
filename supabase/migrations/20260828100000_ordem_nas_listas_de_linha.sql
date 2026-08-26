-- As listas de linha do catálogo central (o seletor de "sincronizar uma
-- linha" nas demais empresas, e a lista de linhas dentro de "Administrar
-- linhas por empresa") ainda ordenavam por alfabeto puro (`order by 1`) —
-- não respeitavam a ordem manual que o administrador da central definiu em
-- "Linhas e sistemas". A ordem manual é dado da organização CENTRAL (é
-- o catálogo dela sendo listado nos dois casos), então é a dela que vale
-- aqui, não a de quem está olhando.
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
  left join linhas_ordem lo
    on lo.linha = m.linha and lo.organizacao_id = organizacao_catalogo_central()
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
      select distinct linha
      from modelos_perfil
      where organizacao_id = organizacao_catalogo_central()
        and ativo
        and linha is not null
        and trim(linha) <> ''
    ) m
    left join linhas_ordem lo
      on lo.linha = m.linha and lo.organizacao_id = organizacao_catalogo_central()
    order by coalesce(lo.ordem, 999999), m.linha;
end;
$$;

grant execute on function linhas_para_organizacao(uuid) to authenticated;
