-- =============================================================================
-- RePerfil — Zerar todo o estoque da organização
-- =============================================================================
--
-- Ação de última instância: apagar de uma vez a quantidade de TODAS as sobras
-- da empresa. Serve para recomeçar o controle do zero — depois de um
-- inventário físico muito diferente do sistema, por exemplo — e não para o
-- dia a dia, que continua passando por `ajustar_quantidade_lote` (um lote de
-- cada vez, com justificativa).
--
-- Só o administrador pode chamar (`e_administrador()`), e mesmo assim exige
-- justificativa: o texto de confirmação ("CONFIRMO") é uma trava da TELA,
-- para evitar o toque acidental — a proteção de verdade, que nenhuma tela
-- pode contornar, é esta função exigir o papel e registrar o motivo.
--
-- Toda reserva em aberto é cancelada primeiro: zerar o lote por baixo dela
-- deixaria a reserva presa, promitendo uma peça que não existe mais.
-- =============================================================================

create or replace function zerar_estoque_organizacao(p_justificativa text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid := organizacao_atual();
  v_lote record;
  v_afetados integer := 0;
begin
  if v_organizacao_id is null then
    raise exception 'Usuário sem organização ativa.'
      using errcode = 'insufficient_privilege';
  end if;

  if not e_administrador() then
    raise exception 'Apenas o administrador pode zerar o estoque da empresa.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_justificativa is null or length(trim(p_justificativa)) < 5 then
    raise exception
      'Descreva o motivo (pelo menos 5 letras) — fica registrado no histórico.'
      using errcode = 'check_violation';
  end if;

  -- Encerra toda reserva em aberto ANTES de zerar os lotes: senão ela
  -- ficaria apontando para uma quantidade que não existe mais.
  update reservas
  set status = 'cancelada',
      motivo_cancelamento = 'Estoque da empresa zerado: ' || p_justificativa
  where organizacao_id = v_organizacao_id
    and status in ('ativa', 'retirada');

  for v_lote in
    select * from lotes_sobras
    where organizacao_id = v_organizacao_id
      and quantidade > 0
    for update
  loop
    update lotes_sobras
    set quantidade = 0,
        quantidade_reservada = 0,
        status = 'descartada'
    where id = v_lote.id;

    insert into movimentacoes_estoque (
      organizacao_id, lote_id, tipo, quantidade, comprimento_mm,
      justificativa, criado_por
    )
    values (
      v_organizacao_id, v_lote.id, 'ajuste', -v_lote.quantidade,
      v_lote.comprimento_mm, p_justificativa, auth.uid()
    );

    v_afetados := v_afetados + 1;
  end loop;

  return v_afetados;
end;
$$;

comment on function zerar_estoque_organizacao is
  'Zera a quantidade de toda sobra da organização — recomeço de controle, não
   uso do dia a dia. Só o administrador chama, exige justificativa, cancela
   reservas em aberto antes e devolve quantos lotes foram afetados.';

grant execute on function zerar_estoque_organizacao to authenticated;
