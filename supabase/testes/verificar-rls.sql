-- =============================================================================
-- RePerfil — Verificação do isolamento entre organizações (RLS)
-- =============================================================================
--
-- Teste obrigatório da especificação: provar que o Row Level Security isola
-- de fato os dados de duas organizações distintas.
--
-- COMO RODAR: cole este arquivo inteiro no SQL Editor do Supabase e execute.
-- O resultado aparece como TABELA na aba Results, uma linha por verificação.
-- Todas as linhas precisam estar com situacao = 'OK'.
--
-- ── Duas decisões de desenho que fazem o teste valer ──────────────────────
--
-- 1. O script troca para o papel `authenticated` antes de verificar. Sem
--    isso o SQL Editor roda como superusuário, que IGNORA todas as políticas
--    de RLS — e o teste passaria mesmo com a segurança completamente
--    quebrada.
--
-- 2. Todo o trabalho acontece dentro de um bloco que termina em erro
--    proposital. O PostgreSQL desfaz as alterações de um bloco quando ele
--    lança exceção, então nenhum dado de teste sobra no banco. Isso é mais
--    confiável do que apagar na mão sete tabelas ligadas por chaves
--    estrangeiras, na ordem exata.
-- =============================================================================

create or replace function testar_isolamento_rls()
returns table (verificacao text, situacao text, detalhe text)
language plpgsql
as $$
declare
  -- Resultados acumulados aqui. Variáveis PL/pgSQL sobrevivem ao desfazer
  -- do bloco; só as alterações no banco são revertidas.
  v_resultados jsonb := '[]'::jsonb;
  v_linha jsonb;

  v_org_a uuid;
  v_org_b uuid;
  v_user_a uuid := gen_random_uuid();
  v_user_b uuid := gen_random_uuid();
  v_perfil_a uuid;
  v_perfil_b uuid;
  v_acab_a uuid;
  v_acab_b uuid;
  v_lote_a uuid;
  v_lote_b uuid;
  v_conta int;
  v_reserva_id uuid;
  v_barrou boolean;
  v_msg text;
begin
  begin
    -- ── Preparação (ainda como superusuário, sem RLS) ────────────────────
    insert into organizacoes (codigo, nome_fantasia)
    values ('TESTE-A', 'Serralheria A') returning id into v_org_a;

    insert into organizacoes (codigo, nome_fantasia)
    values ('TESTE-B', 'Serralheria B') returning id into v_org_b;

    insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
    values
      (v_user_a, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'a@teste.invalido', now(), now()),
      (v_user_b, '00000000-0000-0000-0000-000000000000', 'authenticated',
       'authenticated', 'b@teste.invalido', now(), now());

    insert into perfis_usuario (id, organizacao_id, nome, email, papel)
    values
      (v_user_a, v_org_a, 'Usuário A', 'a@teste.invalido', 'administrador'),
      (v_user_b, v_org_b, 'Usuário B', 'b@teste.invalido', 'administrador');

    insert into configuracoes_aplicacao (organizacao_id) values (v_org_a), (v_org_b);

    insert into modelos_perfil (organizacao_id, codigo, descricao)
    values (v_org_a, 'X-100', 'Perfil da empresa A') returning id into v_perfil_a;
    insert into modelos_perfil (organizacao_id, codigo, descricao)
    values (v_org_b, 'X-100', 'Perfil da empresa B') returning id into v_perfil_b;

    insert into acabamentos (organizacao_id, codigo, nome)
    values (v_org_a, 'AC-1', 'Branco A') returning id into v_acab_a;
    insert into acabamentos (organizacao_id, codigo, nome)
    values (v_org_b, 'AC-1', 'Branco B') returning id into v_acab_b;

    insert into clientes (organizacao_id, codigo, nome)
    values (v_org_a, 'CLI-A', 'Cliente da empresa A');

    insert into lotes_sobras (organizacao_id, codigo, modelo_perfil_id,
                              acabamento_id, comprimento_mm, quantidade)
    values (v_org_a, 'SB-AAAA', v_perfil_a, v_acab_a, 1800, 1)
    returning id into v_lote_a;

    insert into lotes_sobras (organizacao_id, codigo, modelo_perfil_id,
                              acabamento_id, comprimento_mm, quantidade)
    values (v_org_b, 'SB-BBBB', v_perfil_b, v_acab_b, 2400, 1)
    returning id into v_lote_b;

    -- ═════════════════════════════════════════════════════════════════════
    -- Daqui em diante, usuário comum sujeito ao RLS.
    -- ═════════════════════════════════════════════════════════════════════
    set local role authenticated;
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);

    select count(*) into v_conta from lotes_sobras;
    v_resultados := v_resultados || jsonb_build_object(
      'v', 'A enxerga apenas as próprias sobras',
      's', case when v_conta = 1 then 'OK' else 'FALHOU' end,
      'd', format('enxergou %s de 1 esperada', v_conta));

    select count(*) into v_conta from lotes_sobras where id = v_lote_b;
    v_resultados := v_resultados || jsonb_build_object(
      'v', 'A não alcança sobra da B nem pelo id direto',
      's', case when v_conta = 0 then 'OK' else 'FALHOU' end,
      'd', format('enxergou %s, esperado 0', v_conta));

    select count(*) into v_conta from modelos_perfil;
    v_resultados := v_resultados || jsonb_build_object(
      'v', 'Catálogo de perfis isolado',
      's', case when v_conta = 1 then 'OK' else 'FALHOU' end,
      'd', format('enxergou %s de 1 esperado', v_conta));

    select count(*) into v_conta from organizacoes;
    v_resultados := v_resultados || jsonb_build_object(
      'v', 'A enxerga apenas a própria organização',
      's', case when v_conta = 1 then 'OK' else 'FALHOU' end,
      'd', format('enxergou %s de 1 esperada', v_conta));

    select count(*) into v_conta from perfis_usuario;
    v_resultados := v_resultados || jsonb_build_object(
      'v', 'Lista de usuários isolada',
      's', case when v_conta = 1 then 'OK' else 'FALHOU' end,
      'd', format('enxergou %s de 1 esperado', v_conta));

    v_barrou := false;
    begin
      insert into lotes_sobras (organizacao_id, codigo, modelo_perfil_id,
                                acabamento_id, comprimento_mm, quantidade)
      values (v_org_b, 'SB-INVA', v_perfil_b, v_acab_b, 1000, 1);
    exception when others then
      v_barrou := true;
    end;
    v_resultados := v_resultados || jsonb_build_object(
      'v', 'A não consegue inserir dado na empresa B',
      's', case when v_barrou then 'OK' else 'FALHOU' end,
      'd', case when v_barrou then 'bloqueado pelo RLS'
                else 'INSERIU — falha grave' end);

    v_barrou := false;
    begin
      perform reservar_sobra(v_lote_b, 1);
    exception when others then
      v_barrou := true;
    end;
    v_resultados := v_resultados || jsonb_build_object(
      'v', 'A não consegue reservar sobra da empresa B',
      's', case when v_barrou then 'OK' else 'FALHOU' end,
      'd', case when v_barrou then 'bloqueado'
                else 'RESERVOU — falha grave' end);

    select id into v_reserva_id from reservar_sobra(v_lote_a, 1);
    v_resultados := v_resultados || jsonb_build_object(
      'v', 'A reserva a própria sobra',
      's', case when v_reserva_id is not null then 'OK' else 'FALHOU' end,
      'd', 'reserva criada');

    select count(*) into v_conta from lotes_sobras
    where id = v_lote_a and quantidade - quantidade_reservada = 0;
    v_resultados := v_resultados || jsonb_build_object(
      'v', 'Sobra reservada deixa de estar disponível',
      's', case when v_conta = 1 then 'OK' else 'FALHOU' end,
      'd', 'disponibilidade zerada');

    -- O teste mais importante da Fase 1.
    v_barrou := false;
    begin
      perform reservar_sobra(v_lote_a, 1);
    exception when others then
      v_barrou := true;
      v_msg := sqlerrm;
    end;
    v_resultados := v_resultados || jsonb_build_object(
      'v', 'Mesma peça NÃO pode ser reservada duas vezes',
      's', case when v_barrou then 'OK' else 'FALHOU' end,
      'd', case when v_barrou then left(v_msg, 60)
                else 'RESERVOU DE NOVO — falha grave' end);

    perform cancelar_reserva(v_reserva_id, 'Teste automatizado');
    select count(*) into v_conta from lotes_sobras
    where id = v_lote_a and status = 'disponivel'
      and quantidade - quantidade_reservada = 1;
    v_resultados := v_resultados || jsonb_build_object(
      'v', 'Cancelar reserva devolve a peça a disponível',
      's', case when v_conta = 1 then 'OK' else 'FALHOU' end,
      'd', 'peça de volta ao estoque');

    v_barrou := false;
    begin
      delete from movimentacoes_estoque where organizacao_id = v_org_a;
      v_barrou := not found;
    exception when others then
      v_barrou := true;
    end;
    v_resultados := v_resultados || jsonb_build_object(
      'v', 'Histórico de movimentações não pode ser apagado',
      's', case when v_barrou then 'OK' else 'FALHOU' end,
      'd', case when v_barrou then 'nenhuma linha apagada'
                else 'APAGOU — falha grave' end);

    -- ── Agora como usuário da empresa B ──────────────────────────────────
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_user_b, 'role', 'authenticated')::text, true);

    select count(*) into v_conta from lotes_sobras;
    v_resultados := v_resultados || jsonb_build_object(
      'v', 'B enxerga apenas as próprias sobras',
      's', case when v_conta = 1 then 'OK' else 'FALHOU' end,
      'd', format('enxergou %s de 1 esperada', v_conta));

    select count(*) into v_conta from movimentacoes_estoque;
    v_resultados := v_resultados || jsonb_build_object(
      'v', 'B não enxerga o histórico da empresa A',
      's', case when v_conta = 0 then 'OK' else 'FALHOU' end,
      'd', format('enxergou %s, esperado 0', v_conta));

    select count(*) into v_conta from clientes;
    v_resultados := v_resultados || jsonb_build_object(
      'v', 'Clientes (dado pessoal, LGPD) isolados',
      's', case when v_conta = 0 then 'OK' else 'FALHOU' end,
      'd', format('enxergou %s, esperado 0 (A tem 1 cliente)', v_conta));

    -- Erro proposital: faz o PostgreSQL desfazer tudo o que este bloco criou.
    raise exception 'DESFAZER_TESTE';

  exception when others then
    if sqlerrm <> 'DESFAZER_TESTE' then
      v_resultados := v_resultados || jsonb_build_object(
        'v', 'ERRO INESPERADO DURANTE O TESTE',
        's', 'FALHOU',
        'd', sqlerrm);
    end if;
  end;

  reset role;

  for v_linha in select * from jsonb_array_elements(v_resultados) loop
    verificacao := v_linha ->> 'v';
    situacao := v_linha ->> 's';
    detalhe := v_linha ->> 'd';
    return next;
  end loop;

  -- Confirma que nada sobrou no banco.
  select count(*) into v_conta from organizacoes
  where codigo in ('TESTE-A', 'TESTE-B');
  verificacao := 'Nenhum dado de teste sobrou no banco';
  situacao := case when v_conta = 0 then 'OK' else 'FALHOU' end;
  detalhe := format('%s organização(ões) de teste remanescente(s)', v_conta);
  return next;
end;
$$;

select
  case when situacao = 'OK' then '✓' else '✗' end as ok,
  verificacao,
  situacao,
  detalhe
from testar_isolamento_rls();

-- Remove a função de teste: ela não deve viver no banco de produção.
drop function testar_isolamento_rls();
