-- =============================================================================
-- RePerfil — Vincular retroativamente os perfis da Alumifort ao catálogo central
-- =============================================================================
--
-- Script de UMA VEZ SÓ, não uma migração de schema.
--
-- O catálogo central nasceu de uma cópia FEITA A PARTIR da Alumifort. O
-- script daquela cópia marcou o vínculo (`origem_perfil_id`) só do lado de
-- quem recebeu (a RePerfil) — os perfis originais da Alumifort continuaram
-- sem apontar para o central, porque na hora em que foram criados o
-- catálogo central nem existia ainda.
--
-- Sem esse vínculo, "Atualização geral" via TODO o catálogo central como
-- "perfil novo" para a Alumifort e tentava recriá-lo, batendo de frente
-- com o código que a própria Alumifort já usava (erro "duplicate key
-- value violates unique constraint modelos_perfil_codigo_unico").
--
-- Este script vincula cada perfil da Alumifort ao seu equivalente no
-- central, casando por `codigo` — só onde ainda não há vínculo, então
-- pode rodar de novo sem problema (idempotente). Depois disso, "Atualização
-- geral" na Alumifort só vai considerar de fato NOVO o que for cadastrado
-- no central dali para frente.
-- =============================================================================

do $$
declare
  v_central_id uuid;
  v_alumifort_id uuid;
  v_qtd integer;
begin
  select id into v_central_id from organizacoes where eh_catalogo_central limit 1;

  select id into v_alumifort_id
  from organizacoes
  where nome_fantasia ilike '%alumifort%'
    and id != coalesce(v_central_id, '00000000-0000-0000-0000-000000000000'::uuid)
  limit 1;

  if v_central_id is null then
    raise exception 'Nenhuma organização está marcada como catálogo central.';
  end if;

  if v_alumifort_id is null then
    raise exception 'Organização Alumifort não encontrada.';
  end if;

  update modelos_perfil local
  set origem_perfil_id = central.id,
      origem_revisao_catalogo = central.revisao_catalogo
  from modelos_perfil central
  where central.organizacao_id = v_central_id
    and local.organizacao_id = v_alumifort_id
    and local.codigo = central.codigo
    and local.origem_perfil_id is null;

  get diagnostics v_qtd = row_count;
  raise notice 'Perfis vinculados: %', v_qtd;
end $$;

-- Confere quantos perfis da Alumifort ficaram sem par no central (esperado
-- ser zero ou perto disso — são perfis cadastrados na Alumifort depois da
-- cópia inicial, que nunca existiram no central).
select count(*) as perfis_sem_vinculo
from modelos_perfil
where organizacao_id = (
  select id from organizacoes
  where nome_fantasia ilike '%alumifort%'
    and id != (select id from organizacoes where eh_catalogo_central)
  limit 1
)
and origem_perfil_id is null;
