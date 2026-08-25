-- =============================================================================
-- RePerfil — CNPJ/CPF e telefone obrigatórios ao criar empresa
-- =============================================================================
--
-- A tela "Criar minha empresa" passa a exigir CNPJ ou CPF e telefone de
-- contato, além do nome da empresa e do nome da pessoa que já eram
-- obrigatórios. O formato e o dígito verificador são conferidos na tela
-- (`dominio/documentos.ts`) antes de chegar aqui — o banco só garante que
-- ninguém contorna essa exigência chamando a API direto sem passar pela
-- tela: os quatro campos continuam obrigatórios para a organização nascer,
-- mesmo que o valor não seja revalidado dígito a dígito neste ponto.
-- =============================================================================

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
  where email = lower(trim(new.email)) and aceito_em is null;

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

comment on function vincular_convite is
  'Ponte entre o cadastro em auth.users e o acesso ao sistema. Com convite
   em aberto, entra na organização dele. Sem convite, só passa vindo da
   tela "Criar minha empresa" com nome da empresa, nome da pessoa, CNPJ/CPF
   e telefone preenchidos — cria organização nova e vira administrador dela
   na hora. Qualquer outro cadastro sem convite é recusado e desfeito.';
