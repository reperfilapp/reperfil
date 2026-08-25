-- Confirmação de e-mail e a base para o e-mail de convite.
--
-- O Supabase tem um "Confirm signup" nativo, mas ele exige SMTP próprio
-- configurado no painel para ganhar identidade e sair do limite baixo do
-- servidor compartilhado (ver supabase/emails/README.md) — e o projeto
-- escolheu desligar essa confirmação por enquanto. Este token é nosso:
-- gerado pela Edge Function `enviar-email` no momento do cadastro, mandado
-- por Gmail, e conferido aqui por uma função pública.
alter table perfis_usuario
  add column if not exists email_confirmado_em timestamptz,
  add column if not exists token_confirmacao_email uuid,
  add column if not exists token_confirmacao_email_expira_em timestamptz;

-- Confere o token e marca o e-mail como confirmado.
--
-- `security definer` de propósito: quem chama pode nem ter sessão ainda —
-- o token É a credencial, igual a um link de redefinição de senha.
create or replace function confirmar_email(p_token uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_linha perfis_usuario;
begin
  select * into v_linha
  from perfis_usuario
  where token_confirmacao_email = p_token;

  if not found then
    raise exception 'Link de confirmação inválido.'
      using errcode = 'check_violation';
  end if;

  if v_linha.token_confirmacao_email_expira_em < now() then
    raise exception 'Link de confirmação expirado. Peça para o administrador reenviar o convite.'
      using errcode = 'check_violation';
  end if;

  update perfis_usuario
  set email_confirmado_em = now(),
      token_confirmacao_email = null,
      token_confirmacao_email_expira_em = null
  where id = v_linha.id;
end;
$$;

-- `anon` porque o link chega por e-mail — a pessoa pode abrir num
-- navegador onde nunca fez login.
grant execute on function confirmar_email(uuid) to anon, authenticated;
