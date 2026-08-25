-- Confirma o e-mail automaticamente quando o cadastro vem do LINK do
-- convite (clicar nele já prova acesso à caixa de entrada) — e passa a
-- EXIGIR a confirmação separada de quem chega sem esse link (endereço
-- digitado na mão, ou "Criar minha empresa"), bloqueando o acesso ao app
-- até confirmar. Ver o gatilho em `RotaProtegida.tsx`.
--
-- Contas que já existiam antes desta migração ficam de fora da exigência —
-- não haveria como cobrar delas um e-mail de confirmação que nunca foi
-- mandado. `email_confirmado_em = now()` aqui é esse perdão único, de
-- quem já usava o sistema.
update perfis_usuario
set email_confirmado_em = now()
where email_confirmado_em is null;

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
  v_veio_do_link boolean;
begin
  select * into v_convite
  from convites_colaborador
  where email = lower(trim(new.email))
    and aceito_em is null
    and expira_em > now();

  -- Caminho de sempre: alguém convidado por uma empresa que já existe.
  if found then
    select * into v_permissoes from permissoes_do_cargo(v_convite.papel);

    -- Só conta como "veio do link do convite" se o id bater com o MESMO
    -- convite encontrado agora — um id chutado, de outro convite ou
    -- inventado, não prova nada e cai no caminho que ainda exige
    -- confirmação por e-mail antes de liberar o app.
    v_veio_do_link := (new.raw_user_meta_data ->> 'convite_id') = v_convite.id::text;

    insert into perfis_usuario (
      id, organizacao_id, nome, email, telefone, papel,
      pode_movimentar_estoque, pode_gerenciar_cadastros,
      pode_gerenciar_colaboradores, email_confirmado_em
    )
    values (
      new.id, v_convite.organizacao_id, v_convite.nome, lower(trim(new.email)),
      v_convite.telefone, v_convite.papel,
      v_permissoes.movimentar_estoque, v_permissoes.gerenciar_cadastros,
      v_permissoes.gerenciar_colaboradores,
      case when v_veio_do_link then now() else null end
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

  -- Sem link nenhum para provar posse do e-mail — precisa confirmar
  -- separado, como qualquer cadastro sem convite.
  insert into perfis_usuario (
    id, organizacao_id, nome, email, telefone, papel,
    pode_movimentar_estoque, pode_gerenciar_cadastros,
    pode_gerenciar_colaboradores, email_confirmado_em
  )
  values (
    new.id, v_organizacao_id, v_nome_pessoa, lower(trim(new.email)), v_telefone,
    'administrador',
    v_permissoes.movimentar_estoque, v_permissoes.gerenciar_cadastros,
    v_permissoes.gerenciar_colaboradores, null
  );

  return new;
end;
$$;
