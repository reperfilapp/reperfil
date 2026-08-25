-- =============================================================================
-- RePerfil — Criar empresa nova sem depender do desenvolvedor
-- =============================================================================
--
-- Hoje o gatilho `vincular_convite` só libera cadastro em `auth.users`
-- quando existe um convite em aberto para o e-mail — sem ele, recusa e
-- desfaz tudo. Isso é ótimo para quem já é colaborador de uma empresa
-- cadastrada, e péssimo para quem está baixando o app pela primeira vez:
-- cada empresa nova dependia do desenvolvedor criar a conta e rodar um
-- script manual (`criar-primeiro-administrador.sql`).
--
-- Esta migração abre uma SEGUNDA porta, sem mexer na primeira: cadastro
-- sem convite, mas vindo explicitamente da tela "Criar minha empresa" —
-- identificado pelos metadados que `supabase.auth.signUp()` recebe em
-- `options.data` — cria a organização nova e já vincula quem se cadastrou
-- como administrador dela, no mesmo instante.
--
-- A porta só cria organização NOVA, nunca deixa entrar numa já existente:
-- o isolamento entre empresas continua exatamente como era.
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

  -- Sem convite: só passa se vier explicitamente da tela "Criar minha
  -- empresa", com nome da empresa e nome da pessoa preenchidos. Qualquer
  -- outra tentativa de cadastro sem convite continua recusada, como sempre.
  v_nome_empresa := nullif(trim(new.raw_user_meta_data ->> 'nome_empresa'), '');
  v_nome_pessoa := nullif(trim(new.raw_user_meta_data ->> 'nome'), '');

  if new.raw_user_meta_data ->> 'criar_organizacao' is distinct from 'true'
     or v_nome_empresa is null
     or v_nome_pessoa is null
  then
    raise exception 'Não há convite aberto para %. Peça ao administrador da sua empresa.', new.email
      using errcode = 'check_violation';
  end if;

  insert into organizacoes (codigo, nome_fantasia)
  values ('ORG-' || gerar_sufixo_codigo(4), v_nome_empresa)
  returning id into v_organizacao_id;

  -- Configurações de cálculo com os valores presumidos — o administrador
  -- ainda precisa confirmar a espessura real da serra antes do primeiro
  -- cálculo em produção, igual a toda organização nova.
  insert into configuracoes_aplicacao (organizacao_id) values (v_organizacao_id);

  select * into v_permissoes from permissoes_do_cargo('administrador');

  insert into perfis_usuario (
    id, organizacao_id, nome, email, papel,
    pode_movimentar_estoque, pode_gerenciar_cadastros,
    pode_gerenciar_colaboradores
  )
  values (
    new.id, v_organizacao_id, v_nome_pessoa, lower(trim(new.email)), 'administrador',
    v_permissoes.movimentar_estoque, v_permissoes.gerenciar_cadastros,
    v_permissoes.gerenciar_colaboradores
  );

  return new;
end;
$$;

comment on function vincular_convite is
  'Ponte entre o cadastro em auth.users e o acesso ao sistema. Com convite
   em aberto, entra na organização dele. Sem convite, só passa vindo da
   tela "Criar minha empresa" (metadados criar_organizacao/nome_empresa/nome
   no signUp) — cria organização nova e vira administrador dela na hora.
   Qualquer outro cadastro sem convite é recusado e desfeito.';
