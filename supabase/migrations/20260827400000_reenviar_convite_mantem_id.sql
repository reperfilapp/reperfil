-- Reenviar convite deixava de reconhecer o link do e-mail ANTERIOR.
--
-- ── O BUG ────────────────────────────────────────────────────────────────
--
-- `reenviar_convite` apagava a linha antiga e criava outra, com um id NOVO
-- (gerado por `gen_random_uuid()` no default da coluna). O link de e-mail
-- de convite carrega esse id na URL (`?convite=<id>`), e é ele que
-- `vincular_convite` confere para confirmar o e-mail automaticamente na
-- hora do cadastro — "chegar por aquele link específico é a prova de que
-- a pessoa tem acesso à caixa de entrada".
--
-- Aí, se alguém reenviava o convite (por exemplo, porque o primeiro
-- e-mail demorou ou porque um erro fez parecer que precisava reenviar) e a
-- pessoa convidada usava o e-mail ANTIGO, que também era de verdade — só
-- que apontava para um id que não existe mais —, o cadastro seguia normal
-- (o convite ainda era encontrado pelo e-mail), mas a confirmação
-- automática falhava silenciosamente, sem explicação nenhuma: a pessoa
-- ficava presa na tela "Confirme seu e-mail" sem ter feito nada de errado.
--
-- ── A CORREÇÃO ───────────────────────────────────────────────────────────
--
-- Reenviar continua apagando e recriando a linha (é assim que o Database
-- Webhook, que só escuta INSERT, dispara o e-mail de novo) — mas agora com
-- o MESMO id de antes. Qualquer e-mail de convite já mandado para aquele
-- endereço, deste envio ou de reenvios anteriores, continua valendo para
-- confirmar o e-mail automaticamente. Reenviar deixa de invalidar quem já
-- tinha um link de verdade na caixa de entrada.
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

  insert into convites_colaborador (id, organizacao_id, nome, email, papel, telefone, criado_por)
  values (
    p_id,
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
