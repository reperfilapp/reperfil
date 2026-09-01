-- =============================================================================
-- RePerfil — sincronizar_acabamentos_central() adota acabamento local com o
-- mesmo código, em vez de tentar duplicar
-- =============================================================================
--
-- Bug real (ALUMIFORT, 01/09/2026): sincronizar acabamentos pela primeira
-- vez falhou com "duplicate key value violates unique constraint
-- acabamentos_codigo_unico" — a empresa já tinha um acabamento próprio com
-- o mesmo código de um do catálogo central, cadastrado antes de qualquer
-- sincronização. A função só reconhecia "já copiado" por
-- `origem_acabamento_id`, então tentava INSERIR um novo em vez de perceber
-- o que já existia — e batia na unicidade de (organizacao_id, codigo).
--
-- Conserto: acha o acabamento local pelo CÓDIGO também (não só pela
-- origem) — se existir, vincula (grava `origem_acabamento_id` e atualiza
-- os campos, como se já estivesse sincronizado); só cria um novo quando
-- não existe nenhum com aquele código. Mesmo raciocínio de
-- `sincronizar_produtos_central` para código repetido (migração
-- `20260829000000_importar_produto_sem_duplicar.sql`), mas sem precisar de
-- uma contagem de "vinculado" à parte — aqui os campos são só escalares,
-- não uma receita que possa conflitar, então vincular é sempre seguro.
--
-- Retorno da função não muda (mesmas duas colunas de sempre) — `create or
-- replace` basta, sem precisar de `drop function`.
-- =============================================================================

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
    -- "Já existe" por origem (sincronizado antes) OU por código (a empresa
    -- já tinha um acabamento próprio com este código, criado à mão) — nos
    -- dois casos, vincula em vez de tentar duplicar.
    select id into v_local_id
    from acabamentos
    where organizacao_id = v_organizacao_id
      and (origem_acabamento_id = v_central.id or codigo = v_central.codigo)
    limit 1;

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
          cor_hex = v_central.cor_hex,
          origem_acabamento_id = v_central.id
      where id = v_local_id;

      v_atualizados := v_atualizados + 1;
    end if;
  end loop;

  return query select v_novos, v_atualizados;
end;
$$;

grant execute on function sincronizar_acabamentos_central(uuid) to authenticated;
