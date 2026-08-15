-- =============================================================================
-- RePerfil — Verificação do isolamento entre organizações (RLS)
-- =============================================================================
--
-- Teste obrigatório da especificação: provar que o Row Level Security isola
-- de fato os dados de duas organizações distintas.
--
-- COMO RODAR: cole este arquivo inteiro no SQL Editor do Supabase e execute.
-- Ao final ele imprime o resultado de cada verificação e DESFAZ TUDO — o
-- ROLLBACK no fim garante que nenhum dado de teste fica no banco.
--
-- Qualquer verificação que falhar interrompe o script com uma exceção
-- descrevendo o problema. Sem exceção e com todos os "OK" impressos, o
-- isolamento está funcionando.
-- =============================================================================

begin;

do $$
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
  v_visiveis int;
  v_reserva_id uuid;
  v_erro_capturado boolean;
begin
  raise notice '--- Preparando duas organizações de teste ---';

  insert into organizacoes (codigo, nome_fantasia)
  values ('TESTE-A', 'Serralheria A') returning id into v_org_a;

  insert into organizacoes (codigo, nome_fantasia)
  values ('TESTE-B', 'Serralheria B') returning id into v_org_b;

  -- Usuários de autenticação mínimos, só para ter um auth.uid() válido.
  insert into auth.users (id, instance_id, aud, role, email,
                          created_at, updated_at)
  values
    (v_user_a, '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'teste-a@exemplo.invalido', now(), now()),
    (v_user_b, '00000000-0000-0000-0000-000000000000', 'authenticated',
     'authenticated', 'teste-b@exemplo.invalido', now(), now());

  insert into perfis_usuario (id, organizacao_id, nome, email, papel)
  values
    (v_user_a, v_org_a, 'Usuário A', 'teste-a@exemplo.invalido', 'administrador'),
    (v_user_b, v_org_b, 'Usuário B', 'teste-b@exemplo.invalido', 'administrador');

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
  -- A partir daqui, atuamos como o usuário A, sujeito às políticas de RLS.
  -- ═══════════════════════════════════════════════════════════════════════
  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);

  raise notice '--- Atuando como usuário da empresa A ---';

  select count(*) into v_visiveis from lotes_sobras;
  if v_visiveis <> 1 then
    raise exception 'FALHA: usuário A enxerga % sobras; deveria enxergar apenas 1.', v_visiveis;
  end if;
  raise notice 'OK  A enxerga apenas a própria sobra (% visível).', v_visiveis;

  select count(*) into v_visiveis from lotes_sobras where id = v_lote_b;
  if v_visiveis <> 0 then
    raise exception 'FALHA GRAVE: usuário A enxerga a sobra da empresa B mesmo consultando pelo id.';
  end if;
  raise notice 'OK  A não enxerga a sobra da empresa B nem consultando pelo id direto.';

  select count(*) into v_visiveis from modelos_perfil;
  if v_visiveis <> 1 then
    raise exception 'FALHA: usuário A enxerga % modelos de perfil; deveria enxergar 1.', v_visiveis;
  end if;
  raise notice 'OK  Catálogo de perfis isolado.';

  select count(*) into v_visiveis from organizacoes;
  if v_visiveis <> 1 then
    raise exception 'FALHA: usuário A enxerga % organizações; deveria enxergar apenas a própria.', v_visiveis;
  end if;
  raise notice 'OK  A enxerga apenas a própria organização.';

  select count(*) into v_visiveis from perfis_usuario;
  if v_visiveis <> 1 then
    raise exception 'FALHA: usuário A enxerga % usuários; deveria enxergar apenas colegas da empresa A.', v_visiveis;
  end if;
  raise notice 'OK  Lista de usuários isolada.';

  -- Tentativa de escrever na organização alheia.
  v_erro_capturado := false;
  begin
    insert into lotes_sobras (organizacao_id, codigo, modelo_perfil_id,
                              acabamento_id, comprimento_mm, quantidade)
    values (v_org_b, 'SB-INVA', v_perfil_b, v_acab_b, 1000, 1);
  exception when others then
    v_erro_capturado := true;
  end;

  if not v_erro_capturado then
    raise exception 'FALHA GRAVE: usuário A conseguiu inserir sobra na empresa B.';
  end if;
  raise notice 'OK  A não consegue inserir dado na empresa B.';

  -- Tentativa de reservar peça da outra empresa pela função transacional.
  v_erro_capturado := false;
  begin
    perform reservar_sobra(v_lote_b, 1);
  exception when others then
    v_erro_capturado := true;
  end;

  if not v_erro_capturado then
    raise exception 'FALHA GRAVE: usuário A reservou uma sobra da empresa B.';
  end if;
  raise notice 'OK  A não consegue reservar sobra da empresa B.';

  -- ═══════════════════════════════════════════════════════════════════════
  -- Reserva legítima e trava contra reserva dupla
  -- ═══════════════════════════════════════════════════════════════════════
  raise notice '--- Reserva e proteção contra reserva dupla ---';

  select id into v_reserva_id from reservar_sobra(v_lote_a, 1);
  raise notice 'OK  A reservou a própria sobra.';

  select count(*) into v_visiveis
  from lotes_sobras
  where id = v_lote_a and quantidade - quantidade_reservada = 0;
  if v_visiveis <> 1 then
    raise exception 'FALHA: a sobra reservada ainda aparece como disponível.';
  end if;
  raise notice 'OK  A sobra reservada não aparece mais como disponível.';

  -- Segunda reserva sobre a mesma peça: precisa ser recusada.
  v_erro_capturado := false;
  begin
    perform reservar_sobra(v_lote_a, 1);
  exception when others then
    v_erro_capturado := true;
  end;

  if not v_erro_capturado then
    raise exception 'FALHA GRAVE: a mesma peça foi reservada duas vezes.';
  end if;
  raise notice 'OK  Segunda reserva da mesma peça foi recusada.';

  -- Cancelamento devolve a peça ao estoque.
  perform cancelar_reserva(v_reserva_id, 'Teste automatizado');

  select count(*) into v_visiveis
  from lotes_sobras
  where id = v_lote_a and status = 'disponivel'
    and quantidade - quantidade_reservada = 1;
  if v_visiveis <> 1 then
    raise exception 'FALHA: o cancelamento não devolveu a peça a disponível.';
  end if;
  raise notice 'OK  Cancelamento devolveu a peça a disponível.';

  -- ═══════════════════════════════════════════════════════════════════════
  -- Mesmas verificações do lado da empresa B
  -- ═══════════════════════════════════════════════════════════════════════
  perform set_config('request.jwt.claims',
    json_build_object('sub', v_user_b, 'role', 'authenticated')::text, true);

  raise notice '--- Atuando como usuário da empresa B ---';

  select count(*) into v_visiveis from lotes_sobras;
  if v_visiveis <> 1 then
    raise exception 'FALHA: usuário B enxerga % sobras; deveria enxergar 1.', v_visiveis;
  end if;
  raise notice 'OK  B enxerga apenas a própria sobra.';

  select count(*) into v_visiveis from movimentacoes_estoque;
  if v_visiveis <> 0 then
    raise exception 'FALHA: usuário B enxerga % movimentações da empresa A.', v_visiveis;
  end if;
  raise notice 'OK  Histórico de movimentações isolado.';

  -- Histórico é imutável: não existe política de UPDATE nem DELETE.
  v_erro_capturado := false;
  begin
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_user_a, 'role', 'authenticated')::text, true);
    delete from movimentacoes_estoque where organizacao_id = v_org_a;
    if found then
      v_erro_capturado := false;
    else
      v_erro_capturado := true;  -- nenhuma linha apagada: a política barrou
    end if;
  exception when others then
    v_erro_capturado := true;
  end;

  if not v_erro_capturado then
    raise exception 'FALHA GRAVE: foi possível apagar movimentações do histórico.';
  end if;
  raise notice 'OK  Histórico de movimentações não pode ser apagado.';

  reset role;
  raise notice '';
  raise notice '════════════════════════════════════════════════';
  raise notice ' TODAS AS VERIFICAÇÕES DE RLS PASSARAM';
  raise notice '════════════════════════════════════════════════';
end $$;

-- Desfaz tudo: o teste não deixa rastro no banco.
rollback;
