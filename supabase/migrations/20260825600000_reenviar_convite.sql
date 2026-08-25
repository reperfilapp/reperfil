-- Reenviar (ou corrigir e reenviar) um convite pendente.
--
-- O e-mail de convite só dispara no INSERT em `convites_colaborador` (ver
-- Database Webhook + Edge Function `enviar-email`). "Reenviar" não é mandar
-- o MESMO e-mail de novo — é apagar o convite antigo e criar outro, com os
-- mesmos dados ou já corrigidos (por exemplo, um e-mail digitado errado),
-- o que dispara o webhook de novo sozinho.
--
-- As duas operações (apagar + criar) precisam estar na MESMA transação:
-- se parasse no meio, o convite sumiria sem deixar outro no lugar. Uma
-- função é a forma mais simples de garantir isso vindo do app.
create or replace function reenviar_convite(
  p_id uuid,
  p_nome text,
  p_email text,
  p_papel papel_usuario,
  p_telefone text
)
returns convites_colaborador
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid;
  v_resultado convites_colaborador;
begin
  if not pode_gerenciar_colaboradores() then
    raise exception 'Sem permissão para gerenciar colaboradores.'
      using errcode = 'insufficient_privilege';
  end if;

  select organizacao_id into v_organizacao_id
  from convites_colaborador
  where id = p_id;

  if v_organizacao_id is null then
    raise exception 'Convite não encontrado.' using errcode = 'check_violation';
  end if;

  delete from convites_colaborador where id = p_id;

  insert into convites_colaborador (organizacao_id, nome, email, papel, telefone, criado_por)
  values (
    v_organizacao_id,
    trim(p_nome),
    lower(trim(p_email)),
    p_papel,
    p_telefone,
    auth.uid()
  )
  returning * into v_resultado;

  return v_resultado;
end;
$$;

grant execute on function reenviar_convite(uuid, text, text, papel_usuario, text) to authenticated;
