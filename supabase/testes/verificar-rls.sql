-- =============================================================================
-- RePerfil — Verificação do isolamento entre organizações (RLS)
-- =============================================================================
--
-- Teste obrigatório da especificação: provar que o Row Level Security isola
-- de fato os dados de duas organizações distintas.
--
-- COMO RODAR: cole este arquivo inteiro no SQL Editor do Supabase e execute.
-- O resultado aparece como TABELA na aba Results, uma linha por verificação.
-- Procure a coluna `situacao`: todas precisam estar "OK".
--
-- O teste cria duas organizações fictícias, faz as verificações e apaga tudo
-- ao final, inclusive se alguma verificação falhar.
--
-- Detalhe importante: o script troca para o papel `authenticated` antes de
-- verificar. Sem isso o SQL Editor roda como superusuário, que IGNORA todas
-- as políticas de RLS — e o teste passaria sem provar nada.
-- =============================================================================

create or replace function testar_isolamento_rls()
returns table (verificacao text, situacao text, detalhe text)
language plpgsql
as $$
declare
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
  -- Limpa restos de execução anterior interrompida.
  delete from organizacoes where codigo in ('TESTE-A', 'TESTE-B');
  delete from auth.users where email like '%@teste.invalido';

  -- ── Preparação (como superusuário, sem RLS) ─────────────────────────────
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

  insert into lotes_sobras (organizacao_id, codigo, modelo_perfil_id,
                            acabamento_id, comprimento_mm, quantidade)
  values (v_org_a, 'SB-AAAA', v_perfil_a, v_acab_a, 1800, 1)
  returning id into v_lote_a;

  insert into lotes_sobras (organizacao_id, codigo, modelo_perfil_id,
                            acabamento_id, comprimento_mm, quantidade)
  values (v_org_b, 'SB-BBBB', v_perfil_b, v_acab_b, 2400, 1)
  returning id into v_lote_b;

  -- ═══════════════════════════════════════════════════════════════════════
  -- Daqui em diante atuamos como usuário comum, sujeito ao RLS.
  -- ═══════════════════════════════════════════════════════════════════════
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);

  -- 1
  select count(*) into v_conta from lotes_sobras;
  verificacao := 'A enxerga apenas as próprias sobras';
  situacao := case when v_conta = 1 then 'OK' else 'FALHOU' end;
  detalhe := format('enxergou %s de 1 esperada', v_conta);
  return next;

  -- 2
  select count(*) into v_conta from lotes_sobras where id = v_lote_b;
  verificacao := 'A não alcança sobra da B nem pelo id direto';
  situacao := case when v_conta = 0 then 'OK' else 'FALHOU' end;
  detalhe := format('enxergou %s, esperado 0', v_conta);
  return next;

  -- 3
  select count(*) into v_conta from modelos_perfil;
  verificacao := 'Catálogo de perfis isolado';
  situacao := case when v_conta = 1 then 'OK' else 'FALHOU' end;
  detalhe := format('enxergou %s de 1 esperado', v_conta);
  return next;

  -- 4
  select count(*) into v_conta from organizacoes;
  verificacao := 'A enxerga apenas a própria organização';
  situacao := case when v_conta = 1 then 'OK' else 'FALHOU' end;
  detalhe := format('enxergou %s de 1 esperada', v_conta);
  return next;

  -- 5
  select count(*) into v_conta from perfis_usuario;
  verificacao := 'Lista de usuários isolada';
  situacao := case when v_conta = 1 then 'OK' else 'FALHOU' end;
  detalhe := format('enxergou %s de 1 esperado', v_conta);
  return next;

  -- 6
  v_barrou := false;
  begin
    insert into lotes_sobras (organizacao_id, codigo, modelo_perfil_id,
                              acabamento_id, comprimento_mm, quantidade)
    values (v_org_b, 'SB-INVA', v_perfil_b, v_acab_b, 1000, 1);
  exception when others then
    v_barrou := true;
    v_msg := sqlerrm;
  end;
  verificacao := 'A não consegue inserir dado na empresa B';
  situacao := case when v_barrou then 'OK' else 'FALHOU' end;
  detalhe := case when v_barrou then 'bloqueado pelo RLS'
                  else 'INSERIU — falha grave' end;
  return next;

  -- 7
  v_barrou := false;
  begin
    perform reservar_sobra(v_lote_b, 1);
  exception when others then
    v_barrou := true;
  end;
  verificacao := 'A não consegue reservar sobra da empresa B';
  situacao := case when v_barrou then 'OK' else 'FALHOU' end;
  detalhe := case when v_barrou then 'bloqueado' else 'RESERVOU — falha grave' end;
  return next;

  -- 8
  select id into v_reserva_id from reservar_sobra(v_lote_a, 1);
  verificacao := 'A reserva a própria sobra';
  situacao := case when v_reserva_id is not null then 'OK' else 'FALHOU' end;
  detalhe := 'reserva criada';
  return next;

  -- 9
  select count(*) into v_conta from lotes_sobras
  where id = v_lote_a and quantidade - quantidade_reservada = 0;
  verificacao := 'Sobra reservada deixa de estar disponível';
  situacao := case when v_conta = 1 then 'OK' else 'FALHOU' end;
  detalhe := 'disponibilidade zerada';
  return next;

  -- 10 — o teste mais importante da Fase 1
  v_barrou := false;
  begin
    perform reservar_sobra(v_lote_a, 1);
  exception when others then
    v_barrou := true;
    v_msg := sqlerrm;
  end;
  verificacao := 'Mesma peça NÃO pode ser reservada duas vezes';
  situacao := case when v_barrou then 'OK' else 'FALHOU' end;
  detalhe := case when v_barrou then left(v_msg, 60)
                  else 'RESERVOU DE NOVO — falha grave' end;
  return next;

  -- 11
  perform cancelar_reserva(v_reserva_id, 'Teste automatizado');
  select count(*) into v_conta from lotes_sobras
  where id = v_lote_a and status = 'disponivel'
    and quantidade - quantidade_reservada = 1;
  verificacao := 'Cancelar reserva devolve a peça a disponível';
  situacao := case when v_conta = 1 then 'OK' else 'FALHOU' end;
  detalhe := 'peça de volta ao estoque';
  return next;

  -- 12 — histórico imutável
  v_barrou := false;
  begin
    delete from movimentacoes_estoque where organizacao_id = v_org_a;
    v_barrou := not found;
  exception when others then
    v_barrou := true;
  end;
  verificacao := 'Histórico de movimentações não pode ser apagado';
  situacao := case when v_barrou then 'OK' else 'FALHOU' end;
  detalhe := case when v_barrou then 'nenhuma linha apagada'
                  else 'APAGOU — falha grave' end;
  return next;

  -- ── Agora como usuário da empresa B ─────────────────────────────────────
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user_b, 'role', 'authenticated')::text, true);

  -- 13
  select count(*) into v_conta from lotes_sobras;
  verificacao := 'B enxerga apenas as próprias sobras';
  situacao := case when v_conta = 1 then 'OK' else 'FALHOU' end;
  detalhe := format('enxergou %s de 1 esperada', v_conta);
  return next;

  -- 14
  select count(*) into v_conta from movimentacoes_estoque;
  verificacao := 'B não enxerga o histórico da empresa A';
  situacao := case when v_conta = 0 then 'OK' else 'FALHOU' end;
  detalhe := format('enxergou %s, esperado 0', v_conta);
  return next;

  -- 15
  select count(*) into v_conta from clientes;
  verificacao := 'Clientes (dado pessoal, LGPD) isolados';
  situacao := case when v_conta = 0 then 'OK' else 'FALHOU' end;
  detalhe := format('enxergou %s, esperado 0', v_conta);
  return next;

  -- ── Limpeza ─────────────────────────────────────────────────────────────
  reset role;
  delete from organizacoes where codigo in ('TESTE-A', 'TESTE-B');
  delete from auth.users where email like '%@teste.invalido';

exception when others then
  -- Falha inesperada: limpa mesmo assim e reporta.
  reset role;
  delete from organizacoes where codigo in ('TESTE-A', 'TESTE-B');
  delete from auth.users where email like '%@teste.invalido';

  verificacao := 'ERRO INESPERADO';
  situacao := 'FALHOU';
  detalhe := sqlerrm;
  return next;
end;
$$;

-- Executa e mostra o resultado.
select
  case when situacao = 'OK' then '✓' else '✗' end as ok,
  verificacao,
  situacao,
  detalhe
from testar_isolamento_rls();

-- Remove a função de teste: ela não deve viver no banco de produção.
drop function testar_isolamento_rls();
