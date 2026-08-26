-- Segunda forma de mexer na mesma liberação (linha × empresa) criada em
-- 20260827800000 — agora pelo ângulo da EMPRESA: escolher uma empresa e
-- liberar todas as linhas de uma vez, ou linha por linha, para ela. É a
-- MESMA tabela `linhas_liberadas_organizacao` por trás — mexer aqui ou em
-- "Editar linha" (por linha) sincroniza sozinho, porque os dois lêem e
-- escrevem a mesma fonte.
--
-- Importante: nada aqui apaga perfil já copiado. Bloquear uma linha para
-- uma empresa só impede IMPORTAR perfil novo dela ou ATUALIZAR o que já
-- foi copiado — o que a empresa já trouxe para o próprio catálogo
-- continua lá, intacto, para sempre. `sincronizar_catalogo_central` só
-- INSERE ou ATUALIZA linhas locais; não existe, em lugar nenhum deste
-- mecanismo, um caminho que apague `modelos_perfil` de quem já copiou.

-- ── Empresas para administrar (menos a própria central) ─────────────────
create or replace function empresas_para_administrar_linhas()
returns table (organizacao_id uuid, nome_fantasia text)
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
    select o.id, o.nome_fantasia
    from organizacoes o
    where o.id <> organizacao_catalogo_central()
      and o.ativo
    order by o.nome_fantasia;
end;
$$;

grant execute on function empresas_para_administrar_linhas() to authenticated;

-- ── Todas as linhas do central, com a liberação de UMA empresa ──────────
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
    select distinct
      m.linha,
      exists (
        select 1
        from linhas_liberadas_organizacao l
        where l.linha = m.linha and l.organizacao_id = p_organizacao_id
      )
    from modelos_perfil m
    where m.organizacao_id = organizacao_catalogo_central()
      and m.ativo
      and m.linha is not null
      and trim(m.linha) <> ''
    order by 1;
end;
$$;

grant execute on function linhas_para_organizacao(uuid) to authenticated;

-- Liga ou desliga TODAS as linhas de uma vez, para UMA empresa — o atalho
-- "Liberar/Bloquear todas as linhas" dentro de "Administrar linhas por
-- empresa".
create or replace function definir_liberacao_todas_linhas_organizacao(
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
    select distinct m.linha, p_organizacao_id
    from modelos_perfil m
    where m.organizacao_id = organizacao_catalogo_central()
      and m.ativo
      and m.linha is not null
      and trim(m.linha) <> ''
    on conflict (linha, organizacao_id) do nothing;
  else
    delete from linhas_liberadas_organizacao
    where organizacao_id = p_organizacao_id;
  end if;
end;
$$;

grant execute on function definir_liberacao_todas_linhas_organizacao(uuid, boolean) to authenticated;
