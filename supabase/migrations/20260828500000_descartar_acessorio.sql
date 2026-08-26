-- Descarte de acessório: quebrou, sumiu, estragou.
--
-- ── POR QUE NÃO SERVE O QUE JÁ EXISTE ────────────────────────────────────
--
-- Havia dois caminhos para o estoque de acessório diminuir, e nenhum diz
-- "perdi":
--
--   `usar_acessorio`   → a peça foi para uma janela. É consumo, história
--                        real de produção. Usar isto para registrar uma
--                        caixa que caiu no chão faria o relatório de
--                        consumo contar peças que nunca chegaram a obra
--                        nenhuma — e o custo por produto sairia inflado.
--
--   `ajustar_quantidade_acessorio` → o número cadastrado estava errado
--                        desde o começo. É correção de digitação, não
--                        acontecimento. Registra tipo 'ajuste'.
--
-- Perda é a terceira coisa: a peça EXISTIU, saiu do estoque, e não virou
-- produto. O tipo `'descarte'` já estava no enum `tipo_movimentacao_acessorio`
-- desde a criação da tabela (migração 20260824200000), e a tela de detalhe
-- do acessório já tem o rótulo "Descartado" pronto para exibir — mas
-- nenhuma função gravava esse tipo. Ficou pela metade. Esta função fecha.
--
-- ── DUAS DIFERENÇAS DELIBERADAS EM RELAÇÃO A `usar_acessorio` ────────────
--
-- 1. A justificativa é OBRIGATÓRIA aqui, e opcional no uso. Consumo se
--    explica sozinho (foi para um produto); perda, não. Sem o motivo
--    registrado, meses depois ninguém consegue distinguir quebra de
--    montagem, chuva no depósito e furto — e é justamente essa distinção
--    que decide se vale mudar de fornecedor, de embalagem ou de
--    prateleira.
--
-- 2. Recebe QUANTAS peças saíram, não quantas sobraram. É como a pessoa
--    pensa diante do estrago ("quebrei 5"), e evita o erro perigoso de
--    digitar 5 querendo dizer "perdi 5" num campo que espera "restaram 5"
--    — que zeraria quase o lote inteiro em silêncio.
create or replace function descartar_acessorio(
  p_lote_id uuid,
  p_quantidade integer,
  p_justificativa text
)
returns lotes_acessorio
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid := organizacao_atual();
  v_lote lotes_acessorio;
begin
  if not pode_movimentar_estoque() then
    raise exception 'Seu perfil não permite dar baixa no estoque.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_justificativa is null or length(trim(p_justificativa)) < 5 then
    raise exception
      'Descreva o que aconteceu (pelo menos 5 letras) — fica registrado no histórico.'
      using errcode = 'check_violation';
  end if;

  -- `for update` pela mesma razão das outras funções de estoque: duas
  -- pessoas dando baixa da mesma caixa ao mesmo tempo, no depósito, não
  -- podem ler o mesmo saldo e subtrair as duas em cima dele.
  select * into v_lote
  from lotes_acessorio
  where id = p_lote_id and organizacao_id = v_organizacao_id
  for update;

  if not found then
    raise exception 'Acessório não encontrado.' using errcode = 'no_data_found';
  end if;

  if p_quantidade is null or p_quantidade < 1 then
    raise exception 'A quantidade descartada precisa ser pelo menos 1.'
      using errcode = 'check_violation';
  end if;

  if p_quantidade > v_lote.quantidade then
    raise exception
      'Não é possível descartar % — só há % unidade(s) neste lote.',
      p_quantidade, v_lote.quantidade
      using errcode = 'check_violation';
  end if;

  update lotes_acessorio
  set quantidade = quantidade - p_quantidade,
      -- 'descartada', e não 'consumida' como no uso: zerar por perda e
      -- zerar por produção são finais diferentes para a mesma caixa, e o
      -- histórico precisa saber qual foi.
      status = case
        when quantidade - p_quantidade <= 0 then 'descartada'::status_lote
        else 'disponivel'::status_lote
      end
  where id = p_lote_id
  returning * into v_lote;

  -- Quantidade POSITIVA, como em 'uso': é quanto SAIU. O 'ajuste' grava
  -- delta com sinal porque pode subir; descarte só desce.
  insert into movimentacoes_acessorio (
    organizacao_id, lote_id, tipo, quantidade, justificativa, criado_por
  )
  values (
    v_organizacao_id, p_lote_id, 'descarte', p_quantidade,
    trim(p_justificativa), auth.uid()
  );

  return v_lote;
end;
$$;

comment on function descartar_acessorio is
  'Baixa por PERDA (quebra, sumiço, avaria) — não é consumo (usar_acessorio)
   nem correção de cadastro (ajustar_quantidade_acessorio). Justificativa
   obrigatória: perda sem motivo registrado não se audita depois.';

grant execute on function descartar_acessorio to authenticated;
