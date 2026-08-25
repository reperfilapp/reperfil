-- Convite passa a valer por um prazo — hoje ficava aberto para sempre até
-- alguém aceitar ou um administrador cancelar. Isso também é o que o
-- e-mail de convite passa a informar ("você tem 24 horas").
alter table convites_colaborador
  add column if not exists expira_em timestamptz
    not null default (now() + interval '1 day');

-- Mesma lógica de sempre, só que um convite vencido conta como "não há
-- convite aberto" — mesma mensagem de erro de quando não existe convite
-- nenhum, para não vazar a diferença entre os dois casos.
create or replace function vincular_convite()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_convite convites_colaborador;
  v_permissoes record;
  v_nome_empresa text;
  v_nome_pessoa text;
  v_cnpj text;
  v_telefone text;
  v_organizacao_id uuid;
begin
  select * into v_convite
  from convites_colaborador
  where email = lower(trim(new.email))
    and aceito_em is null
    and expira_em > now();

  -- Caminho de sempre: alguém convidado por uma empresa que já existe.
  if found then
    select * into v_permissoes from permissoes_do_cargo(v_convite.papel);

    insert into perfis_usuario (
      id, organizacao_id, nome, email, telefone, papel,
      pode_movimentar_estoque, pode_gerenciar_cadastros,
      pode_gerenciar_colaboradores
    )
    values (
      new.id, v_convite.organizacao_id, v_convite.nome, lower(trim(new.email)),
      v_convite.telefone, v_convite.papel,
      v_permissoes.movimentar_estoque, v_permissoes.gerenciar_cadastros,
      v_permissoes.gerenciar_colaboradores
    );

    update convites_colaborador
    set aceito_em = now()
    where id = v_convite.id;

    return new;
  end if;

  -- Sem convite: só passa vindo da tela "Criar minha empresa", com os
  -- quatro campos preenchidos. Qualquer outra tentativa de cadastro sem
  -- convite continua recusada, como sempre.
  v_nome_empresa := nullif(trim(new.raw_user_meta_data ->> 'nome_empresa'), '');
  v_nome_pessoa := nullif(trim(new.raw_user_meta_data ->> 'nome'), '');
  v_cnpj := nullif(trim(new.raw_user_meta_data ->> 'cnpj'), '');
  v_telefone := nullif(trim(new.raw_user_meta_data ->> 'telefone'), '');

  if new.raw_user_meta_data ->> 'criar_organizacao' is distinct from 'true'
     or v_nome_empresa is null
     or v_nome_pessoa is null
     or v_cnpj is null
     or v_telefone is null
  then
    raise exception 'Não há convite aberto para %. Peça ao administrador da sua empresa.', new.email
      using errcode = 'check_violation';
  end if;

  insert into organizacoes (codigo, nome_fantasia, cnpj, telefone, email)
  values (
    'ORG-' || gerar_sufixo_codigo(4), v_nome_empresa, v_cnpj, v_telefone,
    lower(trim(new.email))
  )
  returning id into v_organizacao_id;

  insert into configuracoes_aplicacao (organizacao_id) values (v_organizacao_id);

  select * into v_permissoes from permissoes_do_cargo('administrador');

  insert into perfis_usuario (
    id, organizacao_id, nome, email, telefone, papel,
    pode_movimentar_estoque, pode_gerenciar_cadastros,
    pode_gerenciar_colaboradores
  )
  values (
    new.id, v_organizacao_id, v_nome_pessoa, lower(trim(new.email)), v_telefone,
    'administrador',
    v_permissoes.movimentar_estoque, v_permissoes.gerenciar_cadastros,
    v_permissoes.gerenciar_colaboradores
  );

  return new;
end;
$$;
