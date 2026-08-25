-- =============================================================================
-- RePerfil — Cada um edita e pode excluir a própria conta
-- =============================================================================
--
-- EDITAR já funcionava: `ColaboradorDetalhe.tsx` libera nome, telefone, foto
-- e nickname para quem está vendo o PRÓPRIO cadastro (`souEu`), e a política
-- de RLS já permite. O que faltava era o CAMINHO até lá — só quem gerencia
-- colaboradores enxergava o menu "Colaboradores"; o próprio dono da conta
-- não tinha link nenhum para a própria ficha.
--
-- EXCLUIR é novo. "Excluir" aqui quer dizer: apagar os dados pessoais
-- (nome, telefone, CPF, foto, nickname, e-mail viram valores neutros) e
-- desativar o acesso — mesma trava que já impede um usuário desativado de
-- entrar. Não apaga a LINHA: o histórico de estoque aponta para este id
-- (quem cadastrou cada sobra), e apagar a linha quebraria essa referência
-- ou exigiria decidir o que fazer com anos de movimentação.
--
-- Apagar o LOGIN de verdade (a linha em auth.users) exige a chave de
-- administração do projeto, que não pode viajar dentro do aplicativo — o
-- mesmo motivo pelo qual criar usuário direto também não é feito por aqui
-- (ver `vincular_convite`). Por isso o login em si (e-mail em auth.users)
-- continua existindo depois desta função — só não abre mais nada, porque
-- o perfil fica desativado.
--
-- Único obstáculo: quem é o ÚNICO administrador ativo da empresa não pode
-- excluir a própria conta sem antes promover outra pessoa — senão a
-- empresa fica sem ninguém para gerenciar acessos.
-- =============================================================================

-- O gatilho `impedir_autopromocao` bloqueia qualquer mudança em `ativo` por
-- quem não é administrador — inclusive na PRÓPRIA linha, que é exatamente o
-- caso de um colaborador comum excluindo a si mesmo. Esta flag, válida só
-- dentro da transação desta função, abre uma exceção estreita: nada além de
-- `excluir_propria_conta` a define, e ela nunca toca `papel` nem
-- `pode_informar_sobra_resultante` — só `ativo`.
create or replace function impedir_autopromocao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.papel is distinct from old.papel
      or new.pode_informar_sobra_resultante is distinct from old.pode_informar_sobra_resultante
      or new.ativo is distinct from old.ativo)
     and not e_administrador()
     and coalesce(current_setting('reperfil.excluindo_propria_conta', true), '') <> 'true'
  then
    raise exception 'Somente o administrador altera papel, permissões ou situação de um usuário.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create or replace function excluir_propria_conta()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid := organizacao_atual();
  v_meu_id uuid := auth.uid();
  v_sou_admin boolean;
  v_outros_admins_ativos integer;
begin
  if v_organizacao_id is null or v_meu_id is null then
    raise exception 'Sessão inválida.' using errcode = 'insufficient_privilege';
  end if;

  select papel = 'administrador' into v_sou_admin
  from perfis_usuario
  where id = v_meu_id;

  if v_sou_admin then
    select count(*) into v_outros_admins_ativos
    from perfis_usuario
    where organizacao_id = v_organizacao_id
      and papel = 'administrador'
      and ativo
      and id <> v_meu_id;

    if v_outros_admins_ativos = 0 then
      raise exception
        'Você é o único administrador desta empresa. Promova outro colaborador a administrador antes de excluir sua conta.'
        using errcode = 'check_violation';
    end if;
  end if;

  -- Só vale para a transação atual — não precisa desligar depois.
  perform set_config('reperfil.excluindo_propria_conta', 'true', true);

  update perfis_usuario
  set nome = 'Conta excluída',
      telefone = null,
      cpf = null,
      foto_url = null,
      apelido = null,
      email = 'conta-excluida-' || left(v_meu_id::text, 8) || '@reperfil.local',
      ativo = false
  where id = v_meu_id;
end;
$$;

comment on function excluir_propria_conta is
  'Apaga os dados pessoais do próprio perfil e desativa o acesso. Não apaga
   a linha (o histórico de estoque referencia este id) nem o login em
   auth.users (exigiria a chave de administração do projeto). Bloqueia se
   for o único administrador ativo da organização.';

grant execute on function excluir_propria_conta to authenticated;
