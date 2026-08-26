-- A migração anterior (20260828100000) quebrou "Administrar linhas por
-- empresa": a lista de linhas ficava em branco depois de escolher uma
-- empresa.
--
-- Causa: `linhas_para_organizacao` é `language plpgsql`, e a função
-- declara uma coluna de saída chamada `linha` (`returns table (linha
-- text, ...)`) — o PL/pgSQL trata isso como uma variável própria da
-- função. A sub-consulta interna referenciava a coluna de
-- `modelos_perfil` como `linha`, sem qualificar com o nome da tabela, e
-- o Postgres não conseguia decidir se era a variável da função ou a
-- coluna da tabela — erro 42702, "column reference is ambiguous".
--
-- `linhas_do_catalogo_central` (a outra função mexida na mesma migração)
-- não tem este problema porque é `language sql`, que não declara essas
-- variáveis automáticas — só a versão em plpgsql precisava da correção.
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
      -- TODA referência a `modelos_perfil.linha` qualificada com o nome
      -- da tabela, inclusive dentro do `where` — em PL/pgSQL, um `linha`
      -- desacompanhado, em QUALQUER parte da consulta, é confundido com a
      -- variável de saída `linha` da própria função, não só na lista do
      -- `select`.
      select distinct modelos_perfil.linha
      from modelos_perfil
      where organizacao_id = organizacao_catalogo_central()
        and ativo
        and modelos_perfil.linha is not null
        and trim(modelos_perfil.linha) <> ''
    ) m
    left join linhas_ordem lo
      on lo.linha = m.linha and lo.organizacao_id = organizacao_catalogo_central()
    order by coalesce(lo.ordem, 999999), m.linha;
end;
$$;

grant execute on function linhas_para_organizacao(uuid) to authenticated;
