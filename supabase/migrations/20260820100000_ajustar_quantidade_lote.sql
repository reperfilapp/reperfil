-- =============================================================================
-- RePerfil — Corrigir a quantidade de um lote já cadastrado
-- =============================================================================
--
-- POR QUE ISTO NÃO EXISTIA:
--
-- Toda mudança de quantidade até aqui vinha de um evento físico real: cadastrar
-- (entrada), reservar, cortar. Não havia caminho para o outro caso, o de
-- alguém ter digitado 5 no lugar de 2 ao cadastrar — a peça na prateleira não
-- mudou, só o número gravado está errado.
--
-- É por isso que esta função exige justificativa (a mesma restrição que já
-- existia em `movimentacoes_estoque` para o tipo 'ajuste', desde que a tabela
-- foi criada, e que até agora nenhuma função usava): corrigir um erro de
-- cadastro é diferente de um evento do dia a dia, e quem olhar o histórico
-- depois precisa entender o porquê, não só o quê.
--
-- Zerar a quantidade é o caso mais comum de uso — "cadastrei isso errado, essa
-- peça nem deveria existir no sistema" — e por isso o lote vai para
-- 'descartada' quando chega a zero, em vez de ficar "disponível" com zero
-- peças, que não descreve nada.
-- =============================================================================

create or replace function ajustar_quantidade_lote(
  p_lote_id uuid,
  p_nova_quantidade integer,
  p_justificativa text
)
returns lotes_sobras
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid := organizacao_atual();
  v_lote lotes_sobras;
  v_quantidade_anterior integer;
  v_novo_status status_lote;
begin
  if v_organizacao_id is null then
    raise exception 'Usuário sem organização ativa.'
      using errcode = 'insufficient_privilege';
  end if;

  if not pode_movimentar_estoque() then
    raise exception 'Seu perfil não permite ajustar o estoque.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_nova_quantidade is null or p_nova_quantidade < 0 then
    raise exception 'A quantidade não pode ser negativa.'
      using errcode = 'check_violation';
  end if;

  if p_nova_quantidade > 9999 then
    raise exception 'Quantidade acima do limite de 9999. Confira se digitou um zero a mais.'
      using errcode = 'check_violation';
  end if;

  if p_justificativa is null or length(trim(p_justificativa)) < 5 then
    raise exception
      'Descreva o motivo do ajuste (pelo menos 5 letras) — fica registrado no histórico, sem apagar o valor anterior.'
      using errcode = 'check_violation';
  end if;

  -- Trava a linha como as demais funções de estoque: duas correções
  -- simultâneas sobre o mesmo lote não podem se sobrepor.
  select * into v_lote
  from lotes_sobras
  where id = p_lote_id and organizacao_id = v_organizacao_id
  for update;

  if not found then
    raise exception 'Sobra não encontrada.' using errcode = 'no_data_found';
  end if;

  if v_lote.status = 'consumida' then
    raise exception
      'Esta sobra já foi consumida em um corte — a quantidade dela não pode mais ser ajustada por aqui.'
      using errcode = 'check_violation';
  end if;

  if p_nova_quantidade < v_lote.quantidade_reservada then
    raise exception
      'Há % unidade(s) reservada(s) desta sobra — cancele a reserva antes de baixar a quantidade abaixo disso.',
      v_lote.quantidade_reservada
      using errcode = 'check_violation';
  end if;

  if p_nova_quantidade = v_lote.quantidade then
    raise exception 'A quantidade informada já é a atual — nada para ajustar.'
      using errcode = 'check_violation';
  end if;

  v_quantidade_anterior := v_lote.quantidade;

  -- Zero é "esta peça não deveria estar no estoque" — vira descartada, e não
  -- disponível com zero unidades, que não quer dizer nada para quem olha a
  -- lista depois. Reservada por inteiro e disponível seguem a mesma lógica já
  -- usada em `reservar_sobra`. Um lote que estava descartado ou consumido por
  -- engano e é corrigido para cima volta a valer.
  v_novo_status := case
    when p_nova_quantidade = 0 then 'descartada'::status_lote
    when p_nova_quantidade = v_lote.quantidade_reservada
      and p_nova_quantidade > 0 then 'reservada'::status_lote
    else 'disponivel'::status_lote
  end;

  update lotes_sobras
  set quantidade = p_nova_quantidade,
      status = v_novo_status
  where id = p_lote_id
  returning * into v_lote;

  insert into movimentacoes_estoque (
    organizacao_id, lote_id, tipo, quantidade, comprimento_mm, justificativa,
    detalhes, criado_por
  )
  values (
    v_organizacao_id, v_lote.id, 'ajuste',
    p_nova_quantidade - v_quantidade_anterior, v_lote.comprimento_mm,
    p_justificativa,
    jsonb_build_object(
      'quantidade_anterior', v_quantidade_anterior,
      'quantidade_nova', p_nova_quantidade
    ),
    auth.uid()
  );

  return v_lote;
end;
$$;

comment on function ajustar_quantidade_lote is
  'Corrige a quantidade de um lote já cadastrado — para erro de digitação, não
   para consumo. Exige justificativa, trava a linha e nunca deixa a
   quantidade_reservada descoberta.';

grant execute on function ajustar_quantidade_lote to authenticated;
