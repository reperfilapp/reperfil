-- Excluir a própria conta agora libera de verdade o e-mail de LOGIN, não só
-- o do perfil.
--
-- `excluir_propria_conta` (migração anterior) só trocava o e-mail em
-- `perfis_usuario` — o login de verdade, em `auth.users`, continuava com o
-- e-mail real. Resultado: um administrador convidava a mesma pessoa de
-- novo e o cadastro nunca completava, porque o Supabase já conhecia aquele
-- e-mail. Trocar o e-mail em `auth.users` pelo caminho normal
-- (`supabase.auth.updateUser`) também não resolve: com "Secure email
-- change" ligado no projeto, a troca só vale depois de confirmar num
-- endereço novo — e o endereço novo é `@reperfil.local`, que não recebe
-- e-mail nenhum. A troca ficaria pendente para sempre.
--
-- A única forma de aplicar sem precisar de confirmação é a API de admin do
-- Supabase (`auth.admin.updateUserById`), que exige a chave de serviço — e
-- por isso quem chama agora é a Edge Function `excluir-conta`, não mais o
-- app direto.
create or replace function excluir_conta_admin(p_usuario_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid;
  v_sou_admin boolean;
  v_outros_admins_ativos integer;
begin
  select organizacao_id, papel = 'administrador'
    into v_organizacao_id, v_sou_admin
  from perfis_usuario
  where id = p_usuario_id;

  if v_organizacao_id is null then
    raise exception 'Usuário não encontrado.' using errcode = 'check_violation';
  end if;

  if v_sou_admin then
    select count(*) into v_outros_admins_ativos
    from perfis_usuario
    where organizacao_id = v_organizacao_id
      and papel = 'administrador'
      and ativo
      and id <> p_usuario_id;

    if v_outros_admins_ativos = 0 then
      raise exception
        'Você é o único administrador desta empresa. Promova outro colaborador a administrador antes de excluir sua conta.'
        using errcode = 'check_violation';
    end if;
  end if;

  perform set_config('reperfil.excluindo_propria_conta', 'true', true);

  update perfis_usuario
  set nome = 'Conta excluída',
      telefone = null,
      cpf = null,
      foto_url = null,
      apelido = null,
      email = 'conta-excluida-' || left(p_usuario_id::text, 8) || '@reperfil.local',
      ativo = false
  where id = p_usuario_id;
end;
$$;

-- Recebe um id explícito em vez de usar `auth.uid()` — quem chama é a Edge
-- Function, autenticada como `service_role`, depois de já ter conferido
-- pelo token de quem fez o pedido QUE aquele id é o dela mesma. Por isso só
-- `service_role` pode executar: nas mãos de um usuário comum, um id
-- arbitrário apagaria a conta de qualquer colega.
revoke all on function excluir_conta_admin(uuid) from public, anon, authenticated;
grant execute on function excluir_conta_admin(uuid) to service_role;

-- A versão antiga não alcançava `auth.users` — substituída pela Edge
-- Function, que faz as duas partes na ordem certa (perfil primeiro, e só
-- se aquilo funcionar, o login).
drop function if exists excluir_propria_conta();
