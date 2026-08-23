-- =============================================================================
-- RePerfil — O resto de CADA peça, e não o da primeira para todas
-- =============================================================================
--
-- ── O QUE ESTAVA ERRADO ──────────────────────────────────────────────────
--
-- `confirmar_corte` recebia UM comprimento de resto e criava com ele todas as
-- peças da reserva. Isso valia enquanto uma reserva era "N peças, um corte em
-- cada": todas terminavam iguais.
--
-- Deixou de valer quando a reserva passou a guardar QUANTOS CORTES se quer.
-- Enche-se uma peça até o limite antes de abrir a próxima, então a última
-- quase nunca recebe a mesma quantidade — e sobra muito mais. Sete cortes de
-- 1 m em peças de 6 m: a primeira leva 5 e sobra 985 mm, a segunda leva 2 e
-- sobra 3.994 mm. O sistema gravava 985 mm para as duas, e 3 metros de perfil
-- aproveitável sumiam do estoque — exatamente o desperdício que este
-- aplicativo existe para evitar.
--
-- ── A CORREÇÃO ───────────────────────────────────────────────────────────
--
-- `p_restos` recebe a lista de restos já calculada pelo aplicativo:
--
--   [{"comprimento_mm": 985, "quantidade": 1},
--    {"comprimento_mm": 3994, "quantidade": 1}]
--
-- Cada entrada vira um lote de sobra próprio (ou um descarte, se estiver
-- abaixo do mínimo aproveitável). Quem calcula continua sendo `dominio/corte`
-- no aplicativo: ter a mesma fórmula de serra nos dois lados é receita para
-- os dois discordarem, e aí ninguém sabe qual está certo.
--
-- Sem `p_restos` a função se comporta exatamente como antes. Reserva antiga,
-- criada quando "quantidade" queria dizer "peças com um corte cada", continua
-- sendo fechada certo — naquele modelo as peças terminavam iguais mesmo.
-- =============================================================================

-- A assinatura muda, e `create or replace` com assinatura nova cria uma
-- SOBRECARGA em vez de substituir: as duas conviveriam e a chamada com três
-- argumentos ficaria ambígua, falhando em execução. Derruba a antiga primeiro.
drop function if exists confirmar_corte(uuid, integer, integer);

create or replace function confirmar_corte(
  p_reserva_id uuid,
  p_comprimento_utilizado_mm integer,
  p_comprimento_restante_mm integer default 0,
  p_restos jsonb default null
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
  v_primeiro_lote lotes_sobras;
  v_virou_descarte boolean := false;
  v_restos jsonb;
  v_resto jsonb;
  v_comprimento integer;
  v_quantidade integer;
  v_soma integer := 0;
  v_geradas jsonb := '[]'::jsonb;
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

  -- Sem lista, cai no comportamento antigo: um resto igual para cada peça.
  v_restos := coalesce(
    p_restos,
    jsonb_build_array(
      jsonb_build_object(
        'comprimento_mm', coalesce(p_comprimento_restante_mm, 0),
        'quantidade', v_reserva.quantidade
      )
    )
  );

  -- As peças descritas na lista têm de ser as peças reservadas, nem mais nem
  -- menos: a diferença viraria estoque inventado ou sumido, calada.
  for v_resto in select * from jsonb_array_elements(v_restos) loop
    v_soma := v_soma + coalesce((v_resto ->> 'quantidade')::integer, 0);
  end loop;

  if v_soma <> v_reserva.quantidade then
    raise exception
      'Os restos somam % peça(s), mas a reserva tem %. O corte não foi registrado.',
      v_soma, v_reserva.quantidade
      using errcode = 'check_violation';
  end if;

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

  -- Cada resto distinto vira o seu próprio lote de sobra, ou um descarte.
  for v_resto in select * from jsonb_array_elements(v_restos) loop
    v_comprimento := coalesce((v_resto ->> 'comprimento_mm')::integer, 0);
    v_quantidade  := coalesce((v_resto ->> 'quantidade')::integer, 0);

    if v_quantidade <= 0 or v_comprimento <= 0 then
      continue;
    end if;

    if v_comprimento >= v_minimo_sobra then
      insert into lotes_sobras (
        organizacao_id, codigo, modelo_perfil_id, acabamento_id, localizacao_id,
        comprimento_mm, quantidade, estado, origem, lote_origem_id, criado_por
      )
      values (
        v_organizacao_id,
        gerar_codigo_unico(v_organizacao_id, 'SB', 'lotes_sobras'),
        v_lote.modelo_perfil_id, v_lote.acabamento_id, v_lote.localizacao_id,
        v_comprimento, v_quantidade, v_lote.estado,
        'Resto do corte da sobra ' || v_lote.codigo, v_lote.id, auth.uid()
      )
      returning * into v_lote_resultante;

      if v_primeiro_lote.id is null then
        v_primeiro_lote := v_lote_resultante;
      end if;

      v_geradas := v_geradas || jsonb_build_object(
        'codigo', v_lote_resultante.codigo,
        'comprimento_mm', v_comprimento,
        'quantidade', v_quantidade
      );

      insert into movimentacoes_estoque (
        organizacao_id, lote_id, reserva_id, tipo, quantidade, comprimento_mm, criado_por
      )
      values (
        v_organizacao_id, v_lote_resultante.id, v_reserva.id, 'entrada',
        v_quantidade, v_comprimento, auth.uid()
      );
    else
      v_virou_descarte := true;

      insert into movimentacoes_estoque (
        organizacao_id, lote_id, reserva_id, tipo, quantidade, comprimento_mm,
        justificativa, criado_por
      )
      values (
        v_organizacao_id, v_lote.id, v_reserva.id, 'descarte', v_quantidade,
        v_comprimento,
        format('Resto de %s mm menor que o mínimo aproveitável de %s mm.',
               v_comprimento, v_minimo_sobra),
        auth.uid()
      );
    end if;
  end loop;

  update reservas
  set status = 'consumida',
      consumida_em = now(),
      comprimento_utilizado_mm = p_comprimento_utilizado_mm,
      lote_resultante_id = v_primeiro_lote.id
  where id = p_reserva_id;

  return jsonb_build_object(
    'reserva_id', p_reserva_id,
    'lote_consumido_id', v_lote.id,
    -- Campos no singular preservados: a tela antiga lia estes nomes, e a
    -- maioria esmagadora das reservas continua gerando um resto só.
    'lote_resultante_id', v_primeiro_lote.id,
    'lote_resultante_codigo', v_primeiro_lote.codigo,
    'comprimento_restante_mm', coalesce(
      (v_geradas -> 0 ->> 'comprimento_mm')::integer,
      p_comprimento_restante_mm
    ),
    'sobras_geradas', v_geradas,
    'destino_resto', case
      when jsonb_array_length(v_geradas) > 0 then 'sobra'
      when v_virou_descarte then 'descarte'
      else 'sem-resto'
    end
  );
end;
$$;

comment on function confirmar_corte is
  'Fecha a reserva, baixa as peças e devolve os restos ao estoque. p_restos
   traz um resto por grupo de peças, porque a última peça de uma reserva com
   vários cortes termina diferente das anteriores. Sem ela, comportamento
   antigo — que continua correto para as reservas criadas naquele modelo.';

grant execute on function confirmar_corte to authenticated;
