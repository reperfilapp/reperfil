-- =============================================================================
-- RePerfil — Funções transacionais de estoque
-- =============================================================================
--
-- POR QUE ISTO EXISTE:
--
-- Verificar disponibilidade no aplicativo e depois gravar é uma condição de
-- corrida clássica. Duas pessoas no depósito abrem a mesma peça no celular,
-- ambas leem "disponível: 1", ambas tocam em "Reservar", e as duas saem
-- achando que a peça é delas. Uma vai até a prateleira e não encontra nada.
--
-- Nenhuma quantidade de cuidado no React resolve isso. Só o banco consegue
-- serializar as duas tentativas. Por isso reserva e consumo NÃO são UPDATE
-- comum: são estas funções, que travam a linha do lote com FOR UPDATE antes
-- de olhar a quantidade. A segunda transação fica esperando a primeira
-- terminar e então enxerga o estoque já reduzido.
--
-- A restrição `lotes_sobras_reserva_coerente` é a segunda linha de defesa:
-- mesmo que alguém contorne estas funções, o banco recusa reservar mais do
-- que existe.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Código curto e legível, único por organização
-- -----------------------------------------------------------------------------
create or replace function gerar_codigo_unico(
  p_organizacao_id uuid,
  p_prefixo text,
  p_tabela text
)
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_codigo text;
  v_existe boolean;
  v_tentativa int := 0;
begin
  loop
    v_tentativa := v_tentativa + 1;
    v_codigo := p_prefixo || '-' || gerar_sufixo_codigo(4);

    execute format(
      'select exists (select 1 from %I where organizacao_id = $1 and codigo = $2)',
      p_tabela
    )
    into v_existe
    using p_organizacao_id, v_codigo;

    exit when not v_existe;

    -- Com 30 caracteres em 4 posições são 810 mil combinações; colidir 20
    -- vezes seguidas significa que o espaço encheu de verdade.
    if v_tentativa >= 20 then
      v_codigo := p_prefixo || '-' || gerar_sufixo_codigo(6);
      exit;
    end if;
  end loop;

  return v_codigo;
end;
$$;

-- -----------------------------------------------------------------------------
-- Cadastrar sobra
-- -----------------------------------------------------------------------------
create or replace function cadastrar_sobra(
  p_modelo_perfil_id uuid,
  p_acabamento_id uuid,
  p_comprimento_mm integer,
  p_quantidade integer default 1,
  p_localizacao_id uuid default null,
  p_estado estado_conservacao default 'bom',
  p_foto_url text default null,
  p_origem text default null,
  p_observacoes text default null,
  p_lote_origem_id uuid default null
)
returns lotes_sobras
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid := organizacao_atual();
  v_lote lotes_sobras;
begin
  if v_organizacao_id is null then
    raise exception 'Usuário sem organização ativa.'
      using errcode = 'insufficient_privilege';
  end if;

  if not pode_movimentar_estoque() then
    raise exception 'Seu perfil não permite cadastrar sobras.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_comprimento_mm is null or p_comprimento_mm <= 0 then
    raise exception 'Informe um comprimento maior que zero.'
      using errcode = 'check_violation';
  end if;

  if p_comprimento_mm > 18000 then
    raise exception 'Comprimento acima do limite de 18 m. Confira se digitou um zero a mais.'
      using errcode = 'check_violation';
  end if;

  if p_quantidade is null or p_quantidade < 1 then
    raise exception 'A quantidade precisa ser pelo menos 1.'
      using errcode = 'check_violation';
  end if;

  -- Garante que modelo e acabamento são da mesma organização: sem isto,
  -- alguém poderia referenciar o perfil de outra empresa por UUID.
  if not exists (
    select 1 from modelos_perfil
    where id = p_modelo_perfil_id and organizacao_id = v_organizacao_id
  ) then
    raise exception 'Modelo de perfil não encontrado nesta organização.'
      using errcode = 'foreign_key_violation';
  end if;

  if not exists (
    select 1 from acabamentos
    where id = p_acabamento_id and organizacao_id = v_organizacao_id
  ) then
    raise exception 'Acabamento não encontrado nesta organização.'
      using errcode = 'foreign_key_violation';
  end if;

  insert into lotes_sobras (
    organizacao_id, codigo, modelo_perfil_id, acabamento_id, localizacao_id,
    comprimento_mm, quantidade, estado, foto_url, origem, observacoes,
    lote_origem_id, criado_por
  )
  values (
    v_organizacao_id,
    gerar_codigo_unico(v_organizacao_id, 'SB', 'lotes_sobras'),
    p_modelo_perfil_id, p_acabamento_id, p_localizacao_id,
    p_comprimento_mm, p_quantidade, p_estado, p_foto_url, p_origem,
    p_observacoes, p_lote_origem_id, auth.uid()
  )
  returning * into v_lote;

  insert into movimentacoes_estoque (
    organizacao_id, lote_id, tipo, quantidade, comprimento_mm, criado_por
  )
  values (
    v_organizacao_id, v_lote.id, 'entrada', p_quantidade, p_comprimento_mm,
    auth.uid()
  );

  return v_lote;
end;
$$;

-- -----------------------------------------------------------------------------
-- Reservar sobra — a função crítica
-- -----------------------------------------------------------------------------
create or replace function reservar_sobra(
  p_lote_id uuid,
  p_quantidade integer default 1,
  p_observacoes text default null
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
    organizacao_id, codigo, lote_id, quantidade, expira_em, observacoes, criado_por
  )
  values (
    v_organizacao_id,
    gerar_codigo_unico(v_organizacao_id, 'RS', 'reservas'),
    p_lote_id, p_quantidade,
    now() + make_interval(hours => v_prazo_horas),
    p_observacoes, auth.uid()
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
  'Reserva transacional com FOR UPDATE. Duas tentativas simultâneas sobre a
   mesma peça resultam em apenas uma reserva bem-sucedida.';

-- -----------------------------------------------------------------------------
-- Cancelar reserva — devolve a peça a disponível
-- -----------------------------------------------------------------------------
create or replace function cancelar_reserva(
  p_reserva_id uuid,
  p_motivo text default null
)
returns reservas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid := organizacao_atual();
  v_reserva reservas;
  v_lote lotes_sobras;
begin
  select * into v_reserva
  from reservas
  where id = p_reserva_id and organizacao_id = v_organizacao_id
  for update;

  if not found then
    raise exception 'Reserva não encontrada.' using errcode = 'no_data_found';
  end if;

  if v_reserva.status not in ('ativa', 'retirada') then
    raise exception 'Esta reserva já foi encerrada (situação: %).', v_reserva.status
      using errcode = 'check_violation';
  end if;

  -- Só quem reservou, o estoque ou o administrador podem cancelar.
  if v_reserva.criado_por <> auth.uid() and not pode_movimentar_estoque() then
    raise exception 'Você só pode cancelar as suas próprias reservas.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_lote from lotes_sobras where id = v_reserva.lote_id for update;

  update lotes_sobras
  set quantidade_reservada = quantidade_reservada - v_reserva.quantidade,
      status = case
        when status = 'reservada' then 'disponivel'::status_lote
        else status
      end
  where id = v_reserva.lote_id;

  update reservas
  set status = 'cancelada', motivo_cancelamento = p_motivo
  where id = p_reserva_id
  returning * into v_reserva;

  insert into movimentacoes_estoque (
    organizacao_id, lote_id, reserva_id, tipo, quantidade, comprimento_mm,
    justificativa, criado_por
  )
  values (
    v_organizacao_id, v_reserva.lote_id, v_reserva.id, 'cancelamento_reserva',
    v_reserva.quantidade, v_lote.comprimento_mm, p_motivo, auth.uid()
  );

  return v_reserva;
end;
$$;

-- -----------------------------------------------------------------------------
-- Confirmar retirada da prateleira
-- -----------------------------------------------------------------------------
create or replace function confirmar_retirada(p_reserva_id uuid)
returns reservas
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid := organizacao_atual();
  v_reserva reservas;
  v_lote lotes_sobras;
begin
  select * into v_reserva
  from reservas
  where id = p_reserva_id and organizacao_id = v_organizacao_id
  for update;

  if not found then
    raise exception 'Reserva não encontrada.' using errcode = 'no_data_found';
  end if;

  if v_reserva.status <> 'ativa' then
    raise exception 'Só é possível retirar uma reserva ativa (situação: %).',
      v_reserva.status using errcode = 'check_violation';
  end if;

  if v_reserva.expira_em < now() then
    raise exception 'Esta reserva venceu em %. Reserve novamente.',
      to_char(v_reserva.expira_em, 'DD/MM/YYYY HH24:MI')
      using errcode = 'check_violation';
  end if;

  select * into v_lote from lotes_sobras where id = v_reserva.lote_id;

  update reservas
  set status = 'retirada', retirada_em = now()
  where id = p_reserva_id
  returning * into v_reserva;

  insert into movimentacoes_estoque (
    organizacao_id, lote_id, reserva_id, tipo, quantidade, comprimento_mm, criado_por
  )
  values (
    v_organizacao_id, v_reserva.lote_id, v_reserva.id, 'retirada',
    v_reserva.quantidade, v_lote.comprimento_mm, auth.uid()
  );

  return v_reserva;
end;
$$;

-- -----------------------------------------------------------------------------
-- Confirmar corte — baixa a peça e devolve o resto ao estoque
-- -----------------------------------------------------------------------------
-- O comprimento restante é calculado FORA daqui, pela regra de domínio em
-- src/dominio/corte.ts, e chega pronto. O banco não recalcula: ter a mesma
-- fórmula em dois lugares é receita para os dois discordarem.
create or replace function confirmar_corte(
  p_reserva_id uuid,
  p_comprimento_utilizado_mm integer,
  p_comprimento_restante_mm integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid := organizacao_atual();
  v_reserva reservas;
  v_lote lotes_sobras;
  v_minimo_sobra integer;
  v_lote_resultante lotes_sobras;
  v_virou_descarte boolean := false;
begin
  select * into v_reserva
  from reservas
  where id = p_reserva_id and organizacao_id = v_organizacao_id
  for update;

  if not found then
    raise exception 'Reserva não encontrada.' using errcode = 'no_data_found';
  end if;

  if v_reserva.status not in ('ativa', 'retirada') then
    raise exception 'Esta reserva já foi encerrada (situação: %).', v_reserva.status
      using errcode = 'check_violation';
  end if;

  select * into v_lote from lotes_sobras where id = v_reserva.lote_id for update;

  if p_comprimento_utilizado_mm <= 0
     or p_comprimento_utilizado_mm > v_lote.comprimento_mm then
    raise exception
      'O comprimento utilizado precisa estar entre 1 mm e % mm.', v_lote.comprimento_mm
      using errcode = 'check_violation';
  end if;

  select comprimento_minimo_sobra_mm into v_minimo_sobra
  from configuracoes_aplicacao
  where organizacao_id = v_organizacao_id;

  v_minimo_sobra := coalesce(v_minimo_sobra, 300);

  -- Baixa as unidades consumidas do lote de origem.
  update lotes_sobras
  set quantidade = quantidade - v_reserva.quantidade,
      quantidade_reservada = quantidade_reservada - v_reserva.quantidade,
      status = case
        when quantidade - v_reserva.quantidade <= 0 then 'consumida'::status_lote
        else 'disponivel'::status_lote
      end
  where id = v_lote.id;

  insert into movimentacoes_estoque (
    organizacao_id, lote_id, reserva_id, tipo, quantidade, comprimento_mm, criado_por
  )
  values (
    v_organizacao_id, v_lote.id, v_reserva.id, 'corte', v_reserva.quantidade,
    p_comprimento_utilizado_mm, auth.uid()
  );

  -- O resto volta ao estoque ou vira descarte, conforme o mínimo configurado.
  if p_comprimento_restante_mm >= v_minimo_sobra and p_comprimento_restante_mm > 0 then
    insert into lotes_sobras (
      organizacao_id, codigo, modelo_perfil_id, acabamento_id, localizacao_id,
      comprimento_mm, quantidade, estado, origem, lote_origem_id, criado_por
    )
    values (
      v_organizacao_id,
      gerar_codigo_unico(v_organizacao_id, 'SB', 'lotes_sobras'),
      v_lote.modelo_perfil_id, v_lote.acabamento_id, v_lote.localizacao_id,
      p_comprimento_restante_mm, v_reserva.quantidade, v_lote.estado,
      'Resto do corte da sobra ' || v_lote.codigo, v_lote.id, auth.uid()
    )
    returning * into v_lote_resultante;

    insert into movimentacoes_estoque (
      organizacao_id, lote_id, reserva_id, tipo, quantidade, comprimento_mm, criado_por
    )
    values (
      v_organizacao_id, v_lote_resultante.id, v_reserva.id, 'entrada',
      v_reserva.quantidade, p_comprimento_restante_mm, auth.uid()
    );

  elsif p_comprimento_restante_mm > 0 then
    v_virou_descarte := true;

    insert into movimentacoes_estoque (
      organizacao_id, lote_id, reserva_id, tipo, quantidade, comprimento_mm,
      justificativa, criado_por
    )
    values (
      v_organizacao_id, v_lote.id, v_reserva.id, 'descarte', v_reserva.quantidade,
      p_comprimento_restante_mm,
      format('Resto de %s mm menor que o mínimo aproveitável de %s mm.',
             p_comprimento_restante_mm, v_minimo_sobra),
      auth.uid()
    );
  end if;

  update reservas
  set status = 'consumida',
      consumida_em = now(),
      comprimento_utilizado_mm = p_comprimento_utilizado_mm,
      lote_resultante_id = v_lote_resultante.id
  where id = p_reserva_id;

  return jsonb_build_object(
    'reserva_id', p_reserva_id,
    'lote_consumido_id', v_lote.id,
    'lote_resultante_id', v_lote_resultante.id,
    'lote_resultante_codigo', v_lote_resultante.codigo,
    'comprimento_restante_mm', p_comprimento_restante_mm,
    'destino_resto', case
      when p_comprimento_restante_mm <= 0 then 'sem-resto'
      when v_virou_descarte then 'descarte'
      else 'sobra'
    end
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Expirar reservas vencidas
-- -----------------------------------------------------------------------------
-- Chamada por tarefa agendada (pg_cron) ou na abertura do painel.
create or replace function expirar_reservas_vencidas()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reserva reservas;
  v_total integer := 0;
begin
  for v_reserva in
    select * from reservas
    where status = 'ativa' and expira_em < now()
    for update skip locked
  loop
    update lotes_sobras
    set quantidade_reservada = quantidade_reservada - v_reserva.quantidade,
        status = case
          when status = 'reservada' then 'disponivel'::status_lote
          else status
        end
    where id = v_reserva.lote_id;

    update reservas set status = 'expirada' where id = v_reserva.id;

    insert into movimentacoes_estoque (
      organizacao_id, lote_id, reserva_id, tipo, quantidade, criado_por
    )
    values (
      v_reserva.organizacao_id, v_reserva.lote_id, v_reserva.id,
      'expiracao_reserva', v_reserva.quantidade, v_reserva.criado_por
    );

    v_total := v_total + 1;
  end loop;

  return v_total;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permissões
-- -----------------------------------------------------------------------------
grant execute on function cadastrar_sobra          to authenticated;
grant execute on function reservar_sobra           to authenticated;
grant execute on function cancelar_reserva         to authenticated;
grant execute on function confirmar_retirada       to authenticated;
grant execute on function confirmar_corte          to authenticated;
grant execute on function expirar_reservas_vencidas to authenticated;
