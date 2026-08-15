-- =============================================================================
-- RePerfil — Verificação dos cadastros (Etapa 4)
-- =============================================================================
--
-- Prova que o banco aceita exatamente o que o aplicativo envia. As telas de
-- cadastro gravam SEM informar `organizacao_id`, `criado_por` nem o código do
-- cliente: tudo isso é preenchido pelo banco. Se a migration
-- 20260815130000_padroes_cadastro.sql não tiver sido aplicada, este script
-- acusa.
--
-- COMO RODAR: cole no SQL Editor do Supabase e execute. O resultado sai como
-- tabela; todas as linhas precisam estar com situacao = 'OK'.
--
-- Como o teste de RLS, este roda sob o papel `authenticated` (senão o
-- superusuário ignoraria as políticas) e desfaz tudo ao final.
-- =============================================================================

create or replace function testar_cadastros()
returns table (verificacao text, situacao text, detalhe text)
language plpgsql
as $$
declare
  v_resultados jsonb := '[]'::jsonb;
  v_linha jsonb;
  v_org uuid;
  v_user uuid := gen_random_uuid();
  v_modelo modelos_perfil;
  v_acab acabamentos;
  v_local localizacoes;
  v_cliente clientes;
  v_barrou boolean;
  v_msg text;
begin
  begin
    insert into organizacoes (codigo, nome_fantasia)
    values ('TESTE-CAD', 'Serralheria de Teste') returning id into v_org;

    insert into auth.users (id, instance_id, aud, role, email, created_at, updated_at)
    values (v_user, '00000000-0000-0000-0000-000000000000', 'authenticated',
            'authenticated', 'cad@teste.invalido', now(), now());

    insert into perfis_usuario (id, organizacao_id, nome, email, papel)
    values (v_user, v_org, 'Testador', 'cad@teste.invalido', 'administrador');

    insert into configuracoes_aplicacao (organizacao_id) values (v_org);

    -- ═════════════════════════════════════════════════════════════════════
    -- Passa a atuar como usuário comum, exatamente como o aplicativo.
    -- ═════════════════════════════════════════════════════════════════════
    set local role authenticated;
    perform set_config('request.jwt.claims',
      json_build_object('sub', v_user, 'role', 'authenticated')::text, true);

    -- 1 — Inserção sem informar organizacao_id, como a tela faz
    insert into acabamentos (codigo, nome, tipo, cor_hex)
    values ('ACB-T1', 'Branco de teste', 'pintura', '#FFFFFF')
    returning * into v_acab;

    v_resultados := v_resultados || jsonb_build_object(
      'v', 'Acabamento grava sem informar a organização',
      's', case when v_acab.organizacao_id = v_org then 'OK' else 'FALHOU' end,
      'd', 'organizacao_id preenchido pelo banco');

    v_resultados := v_resultados || jsonb_build_object(
      'v', 'Autoria preenchida automaticamente',
      's', case when v_acab.criado_por = v_user then 'OK' else 'FALHOU' end,
      'd', 'criado_por preenchido pelo banco');

    -- 2 — Código repetido precisa ser recusado, com erro tratável
    v_barrou := false;
    begin
      insert into acabamentos (codigo, nome) values ('ACB-T1', 'Repetido');
    exception when unique_violation then
      v_barrou := true;
    end;
    v_resultados := v_resultados || jsonb_build_object(
      'v', 'Acabamento com código repetido é recusado',
      's', case when v_barrou then 'OK' else 'FALHOU' end,
      'd', case when v_barrou then 'violação de unicidade'
                else 'ACEITOU DUPLICADO' end);

    -- 3 — Localização
    insert into localizacoes (codigo, deposito, setor, estante)
    values ('T1-01', 'Depósito teste', 'Setor T', 'Estante 1')
    returning * into v_local;

    v_resultados := v_resultados || jsonb_build_object(
      'v', 'Localização grava sem informar a organização',
      's', case when v_local.organizacao_id = v_org then 'OK' else 'FALHOU' end,
      'd', 'organizacao_id preenchido pelo banco');

    -- 4 — Modelo de perfil
    insert into modelos_perfil (codigo, descricao, linha, comprimento_barra_mm, peso_por_metro_g)
    values ('PT-100', 'Perfil de teste', 'Linha T', 6000, 1180)
    returning * into v_modelo;

    v_resultados := v_resultados || jsonb_build_object(
      'v', 'Modelo de perfil grava sem informar a organização',
      's', case when v_modelo.organizacao_id = v_org then 'OK' else 'FALHOU' end,
      'd', 'organizacao_id preenchido pelo banco');

    -- 5 — Barra fora do limite físico precisa ser recusada
    v_barrou := false;
    begin
      insert into modelos_perfil (codigo, descricao, comprimento_barra_mm)
      values ('PT-999', 'Barra impossível', 60000);
    exception when check_violation then
      v_barrou := true;
    end;
    v_resultados := v_resultados || jsonb_build_object(
      'v', 'Barra de 60 m é recusada (zero digitado a mais)',
      's', case when v_barrou then 'OK' else 'FALHOU' end,
      'd', case when v_barrou then 'restrição de comprimento'
                else 'ACEITOU 60 metros' end);

    -- 6 — Cliente com código gerado por gatilho
    insert into clientes (nome, cidade, estado, telefone)
    values ('Cliente de Teste', 'Campinas', 'SP', '(19) 90000-0000')
    returning * into v_cliente;

    v_resultados := v_resultados || jsonb_build_object(
      'v', 'Código do cliente é gerado sozinho',
      's', case when v_cliente.codigo like 'CLI-%' then 'OK' else 'FALHOU' end,
      'd', coalesce(v_cliente.codigo, 'NULO — gatilho não rodou'));

    v_resultados := v_resultados || jsonb_build_object(
      'v', 'Cliente grava sem informar a organização',
      's', case when v_cliente.organizacao_id = v_org then 'OK' else 'FALHOU' end,
      'd', 'organizacao_id preenchido pelo banco');

    -- 7 — Configurações: só o administrador altera
    update configuracoes_aplicacao
    set espessura_serra_mm = 4, confirmado_pelo_administrador = true
    where organizacao_id = v_org;

    v_resultados := v_resultados || jsonb_build_object(
      'v', 'Administrador altera as configurações do cálculo',
      's', case when found then 'OK' else 'FALHOU' end,
      'd', 'espessura da serra atualizada');

    -- 8 — Serralheiro NÃO pode cadastrar
    update perfis_usuario set papel = 'serralheiro' where id = v_user;

    v_barrou := false;
    begin
      insert into acabamentos (codigo, nome) values ('ACB-T2', 'Proibido');
      v_barrou := false;
    exception when others then
      v_barrou := true;
      v_msg := sqlerrm;
    end;
    v_resultados := v_resultados || jsonb_build_object(
      'v', 'Serralheiro não consegue cadastrar acabamento',
      's', case when v_barrou then 'OK' else 'FALHOU' end,
      'd', case when v_barrou then 'bloqueado pelo RLS'
                else 'CADASTROU — falha de permissão' end);

    -- 9 — Serralheiro continua enxergando os cadastros para consultar
    v_resultados := v_resultados || jsonb_build_object(
      'v', 'Serralheiro continua enxergando o catálogo',
      's', case when (select count(*) from modelos_perfil) = 1
                then 'OK' else 'FALHOU' end,
      'd', 'leitura permitida, escrita não');

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

  verificacao := 'Nenhum dado de teste sobrou no banco';
  situacao := case when (select count(*) from organizacoes
                         where codigo = 'TESTE-CAD') = 0
                   then 'OK' else 'FALHOU' end;
  detalhe := 'organização de teste removida';
  return next;
end;
$$;

select
  case when situacao = 'OK' then '✓' else '✗' end as ok,
  verificacao,
  situacao,
  detalhe
from testar_cadastros();

drop function testar_cadastros();
