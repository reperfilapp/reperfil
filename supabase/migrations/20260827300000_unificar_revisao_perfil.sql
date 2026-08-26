-- Unifica os dois lugares onde "revisão" aparecia — o checkbox "Perfil
-- verificado e revisado" (dentro do formulário de editar) e o botão
-- "Marcar nova revisão" (só no catálogo central) — numa AÇÃO SÓ, na tela
-- de exibição do perfil: `revisado` continua existindo (é ainda a mesma
-- coluna, lida em toda parte que já filtrava/mostrava por ela), só que
-- agora tem quando e quem, e uma única função cuida das duas situações.
alter table modelos_perfil
  add column if not exists revisado_em timestamptz,
  add column if not exists revisado_por uuid references perfis_usuario (id) on delete set null;

comment on column modelos_perfil.revisado_em is
  'Quando a revisão (ou a mais recente delas) foi marcada.';
comment on column modelos_perfil.revisado_por is
  'Quem marcou a revisão (ou a mais recente delas).';

-- Substitui `marcar_nova_revisao_perfil`: aquela só existia para o
-- catálogo central e exigia um `revisado` já marcado por fora (o
-- checkbox do formulário). Esta serve qualquer organização, e decide
-- sozinha se é a primeira revisão ou uma nova.
drop function if exists marcar_nova_revisao_perfil(uuid);

create or replace function marcar_revisao_perfil(p_perfil_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil modelos_perfil;
begin
  select * into v_perfil
  from modelos_perfil
  where id = p_perfil_id;

  if v_perfil.id is null then
    raise exception 'Perfil não encontrado.' using errcode = 'check_violation';
  end if;

  if v_perfil.organizacao_id <> organizacao_atual() or not pode_gerenciar_cadastros() then
    raise exception 'Sem permissão para revisar este perfil.'
      using errcode = 'insufficient_privilege';
  end if;

  if v_perfil.revisado then
    -- Já tinha sido revisado antes: esta é uma NOVA revisão — atualiza
    -- quem/quando, e avança a revisão do catálogo SE este perfil for do
    -- catálogo central (é o que avisa quem já copiou que há atualização;
    -- em qualquer outra organização, este número simplesmente não é lido
    -- em lugar nenhum).
    update modelos_perfil
    set revisado_em = now(),
        revisado_por = auth.uid(),
        revisao_catalogo = case
          when organizacao_atual() = organizacao_catalogo_central()
            then revisao_catalogo + 1
          else revisao_catalogo
        end
    where id = p_perfil_id;
  else
    -- Primeira revisão: só marca revisado, sem mexer na revisão do
    -- catálogo — não houve nada "novo" pra avisar ainda.
    update modelos_perfil
    set revisado = true,
        revisado_em = now(),
        revisado_por = auth.uid()
    where id = p_perfil_id;
  end if;
end;
$$;

grant execute on function marcar_revisao_perfil(uuid) to authenticated;
