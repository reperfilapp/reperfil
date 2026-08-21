-- =============================================================================
-- RePerfil — Dados do corte na reserva
-- =============================================================================
--
-- O sistema agora distingue "peças físicas reservadas" de "cortes pedidos".
--
-- Antes: reservar "5 peças de 1 m" guardava quantidade=5 no lote físico.
-- Agora: reserva guarda quantidade=1 (1 lote basta), mais os campos abaixo
-- para saber o que será cortado desse lote.
--
-- comprimento_corte_mm: comprimento de cada corte pedido (ex: 1000 mm)
-- quantidade_cortes   : número de cortes pedidos (ex: 5)
--
-- Campos nullable para compatibilidade com reservas antigas.
-- =============================================================================

alter table reservas
  add column if not exists comprimento_corte_mm integer default null,
  add column if not exists quantidade_cortes    integer default null;

comment on column reservas.comprimento_corte_mm is
  'Comprimento de cada corte solicitado na reserva, em mm. '
  'Null em reservas feitas antes desta migração.';

comment on column reservas.quantidade_cortes is
  'Número de cortes solicitados. Junto com comprimento_corte_mm define '
  'o trabalho a ser feito na serra. Null em reservas antigas.';

-- Remove a versão anterior da função (3 parâmetros) para evitar ambiguidade.
-- O PostgreSQL trata funções com assinaturas diferentes como overloads distintos:
-- CREATE OR REPLACE não substitui a versão antiga quando os parâmetros mudam.
drop function if exists reservar_sobra(uuid, integer, text);

-- Atualiza a função reservar_sobra para aceitar e gravar os novos campos.
create or replace function reservar_sobra(
  p_lote_id           uuid,
  p_quantidade        integer default 1,
  p_observacoes       text    default null,
  p_comprimento_corte_mm integer default null,
  p_quantidade_cortes    integer default null
)
returns reservas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid := organizacao_atual();
  v_lote lotes_sobras;
  v_disponivel integer;
  v_prazo_horas integer;
  v_reserva reservas;
begin
  if v_organizacao_id is null then
    raise exception 'Usuário sem organização ativa.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_quantidade is null or p_quantidade < 1 then
    raise exception 'A quantidade reservada precisa ser pelo menos 1.'
      using errcode = 'check_violation';
  end if;

  -- ═══════════════════════════════════════════════════════════════════════
  -- AQUI ESTÁ A PROTEÇÃO. O FOR UPDATE trava esta linha até o fim da
  -- transação. Uma segunda tentativa simultânea sobre o mesmo lote fica
  -- bloqueada nesta instrução e só prossegue depois que a primeira gravou,
  -- enxergando então a quantidade já reduzida. Sem o FOR UPDATE, as duas
  -- leriam o mesmo valor e ambas reservariam.
  -- ═══════════════════════════════════════════════════════════════════════
  select * into v_lote
  from lotes_sobras
  where id = p_lote_id and organizacao_id = v_organizacao_id
  for update;

  if not found then
    raise exception 'Sobra não encontrada.'
      using errcode = 'no_data_found';
  end if;

  if v_lote.status <> 'disponivel' then
    raise exception 'Esta sobra não está disponível (situação: %).', v_lote.status
      using errcode = 'check_violation';
  end if;

  v_disponivel := v_lote.quantidade - v_lote.quantidade_reservada;

  if v_disponivel < p_quantidade then
    raise exception
      'Restam apenas % unidade(s) desta sobra. Outra pessoa pode ter reservado agora há pouco.',
      v_disponivel
      using errcode = 'check_violation';
  end if;

  select prazo_reserva_horas into v_prazo_horas
  from configuracoes_aplicacao
  where organizacao_id = v_organizacao_id;

  v_prazo_horas := coalesce(v_prazo_horas, 48);

  update lotes_sobras
  set quantidade_reservada = quantidade_reservada + p_quantidade,
      status = case
        when quantidade_reservada + p_quantidade >= quantidade then 'reservada'::status_lote
        else status
      end
  where id = p_lote_id;

  insert into reservas (
    organizacao_id, codigo, lote_id, quantidade, expira_em, observacoes,
    comprimento_corte_mm, quantidade_cortes, criado_por
  )
  values (
    v_organizacao_id,
    gerar_codigo_unico(v_organizacao_id, 'RS', 'reservas'),
    p_lote_id, p_quantidade,
    now() + make_interval(hours => v_prazo_horas),
    p_observacoes,
    p_comprimento_corte_mm, p_quantidade_cortes,
    auth.uid()
  )
  returning * into v_reserva;

  insert into movimentacoes_estoque (
    organizacao_id, lote_id, reserva_id, tipo, quantidade, comprimento_mm, criado_por
  )
  values (
    v_organizacao_id, p_lote_id, v_reserva.id, 'reserva', p_quantidade,
    v_lote.comprimento_mm, auth.uid()
  );

  return v_reserva;
end;
$$;

comment on function reservar_sobra is
  'Reserva transacional com FOR UPDATE. Aceita opcionalmente comprimento_corte_mm '
  'e quantidade_cortes para registrar o que será cortado do lote. '
  'Duas tentativas simultâneas sobre a mesma peça resultam em apenas uma reserva bem-sucedida.';
