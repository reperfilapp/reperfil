-- Acrescentar peças a um lote que já existe.
--
-- ── O PROBLEMA ───────────────────────────────────────────────────────────
--
-- Chega uma remessa com mais oito pontas do mesmo perfil, mesmo acabamento e
-- mesmo comprimento de um lote já cadastrado. Sem esta função, a única saída
-- era cadastrar um lote novo — e aí o depósito passa a ter dois códigos, duas
-- etiquetas e duas prateleiras possíveis para peças que são a mesma coisa.
--
-- Quem procura material vê "8 peças" e "51 peças" em vez de 59, e o cálculo
-- de produção fica pior sem motivo: ele trata cada lote como um monte
-- separado.
--
-- ── POR QUE É "ENTRADA", E NÃO "AJUSTE" ──────────────────────────────────
--
-- Peça que chegou é entrada, mesmo indo para um lote existente. Registrar
-- como ajuste faria o relatório de entradas mentir sobre quanto material
-- entrou no mês, e ajuste é o que se usa quando a contagem estava errada —
-- coisa diferente, que merece continuar distinguível no histórico.

create or replace function somar_ao_lote(
  p_lote_id uuid,
  p_quantidade integer,
  p_origem text default null
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

  if p_quantidade is null or p_quantidade < 1 then
    raise exception 'A quantidade precisa ser pelo menos 1.'
      using errcode = 'check_violation';
  end if;

  -- `for update` trava a linha até o fim da transação. Duas pessoas
  -- cadastrando a mesma remessa ao mesmo tempo, cada uma somando 8 peças,
  -- resultariam em 8 e não 16 se ambas lessem a quantidade antiga antes de
  -- qualquer uma gravar.
  select * into v_lote
  from lotes_sobras
  where id = p_lote_id and organizacao_id = v_organizacao_id
  for update;

  if not found then
    raise exception 'Lote não encontrado nesta organização.'
      using errcode = 'foreign_key_violation';
  end if;

  -- Só lote disponível recebe peça. Somar a um lote consumido ou descartado
  -- ressuscitaria material que saiu do depósito, e o histórico passaria a
  -- contar uma história que não aconteceu.
  if v_lote.status <> 'disponivel' then
    raise exception 'Este lote está % e não recebe mais peças.', v_lote.status
      using errcode = 'check_violation';
  end if;

  update lotes_sobras
  set quantidade = quantidade + p_quantidade,
      -- A origem nova entra ao lado da antiga: as peças vieram de lugares
      -- diferentes, e apagar a primeira perderia de onde veio o material
      -- que já estava lá.
      origem = case
        when p_origem is null or trim(p_origem) = '' then origem
        when origem is null or trim(origem) = '' then p_origem
        when origem like '%' || p_origem || '%' then origem
        else origem || ' · ' || p_origem
      end
  where id = p_lote_id
  returning * into v_lote;

  insert into movimentacoes_estoque (
    organizacao_id, lote_id, tipo, quantidade, comprimento_mm, criado_por
  )
  values (
    v_organizacao_id, v_lote.id, 'entrada', p_quantidade,
    v_lote.comprimento_mm, auth.uid()
  );

  return v_lote;
end;
$$;

comment on function somar_ao_lote is
  'Acrescenta peças a um lote existente, registrando a entrada no histórico.
   Usado quando o cadastro detecta que já há lote com o mesmo perfil,
   acabamento e comprimento.';

-- -----------------------------------------------------------------------------
-- Juntar dois lotes que são a mesma coisa
-- -----------------------------------------------------------------------------
-- UMA função, e não duas chamadas do aplicativo (somar aqui, consumir ali).
-- Se a rede caísse entre as duas, o material apareceria contado em dobro ou
-- sumiria do estoque — e o segundo caso é o pior tipo de erro num depósito:
-- silencioso, descoberto só quando alguém vai buscar a peça.
create or replace function juntar_lotes(
  p_destino_id uuid,
  p_origem_id uuid
)
returns lotes_sobras
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid := organizacao_atual();
  v_destino lotes_sobras;
  v_origem lotes_sobras;
begin
  if not pode_movimentar_estoque() then
    raise exception 'Seu perfil não permite mexer no estoque.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_destino_id = p_origem_id then
    raise exception 'Um lote não se junta a si mesmo.'
      using errcode = 'check_violation';
  end if;

  -- Trava os dois na mesma ordem de id sempre: dois usuários juntando os
  -- mesmos lotes em sentidos opostos travariam um ao outro para sempre.
  perform 1 from lotes_sobras
  where id in (p_destino_id, p_origem_id)
    and organizacao_id = v_organizacao_id
  order by id
  for update;

  select * into v_destino from lotes_sobras
  where id = p_destino_id and organizacao_id = v_organizacao_id;

  select * into v_origem from lotes_sobras
  where id = p_origem_id and organizacao_id = v_organizacao_id;

  if v_destino.id is null or v_origem.id is null then
    raise exception 'Lote não encontrado nesta organização.'
      using errcode = 'foreign_key_violation';
  end if;

  if v_destino.status <> 'disponivel' or v_origem.status <> 'disponivel' then
    raise exception 'Só lotes disponíveis podem ser juntados.'
      using errcode = 'check_violation';
  end if;

  -- O trio que define "mesma coisa". Conferido aqui também, e não só na
  -- tela: a tela pode estar mostrando dados de um minuto atrás, e juntar
  -- peças de comprimentos diferentes estragaria o estoque de um jeito que
  -- ninguém percebe até o corte.
  if v_destino.modelo_perfil_id <> v_origem.modelo_perfil_id
    or v_destino.acabamento_id <> v_origem.acabamento_id
    or v_destino.comprimento_mm <> v_origem.comprimento_mm
  then
    raise exception 'Estes lotes não são equivalentes: perfil, acabamento e comprimento precisam ser iguais.'
      using errcode = 'check_violation';
  end if;

  if v_origem.quantidade_reservada > 0 then
    raise exception 'O lote % tem peça reservada. Cancele ou conclua a reserva antes de juntar.', v_origem.codigo
      using errcode = 'check_violation';
  end if;

  update lotes_sobras
  set quantidade = quantidade + v_origem.quantidade,
      origem = case
        when v_origem.origem is null or trim(v_origem.origem) = '' then origem
        when origem is null or trim(origem) = '' then v_origem.origem
        when origem like '%' || v_origem.origem || '%' then origem
        else origem || ' · ' || v_origem.origem
      end
  where id = p_destino_id
  returning * into v_destino;

  -- O lote esvaziado não é apagado: o histórico dele aponta para
  -- movimentações reais, e apagá-lo deixaria o passado sem explicação.
  update lotes_sobras
  set quantidade = 0,
      status = 'consumida',
      observacoes = coalesce(observacoes || ' · ', '')
        || 'Peças transferidas para o lote ' || v_destino.codigo || '.'
  where id = p_origem_id;

  insert into movimentacoes_estoque (
    organizacao_id, lote_id, tipo, quantidade, comprimento_mm,
    justificativa, criado_por
  )
  values
    (
      v_organizacao_id, p_origem_id, 'transferencia', v_origem.quantidade,
      v_origem.comprimento_mm,
      'Peças transferidas para o lote ' || v_destino.codigo || '.', auth.uid()
    ),
    (
      v_organizacao_id, p_destino_id, 'transferencia', v_origem.quantidade,
      v_destino.comprimento_mm,
      'Peças recebidas do lote ' || v_origem.codigo || '.', auth.uid()
    );

  return v_destino;
end;
$$;

comment on function juntar_lotes is
  'Move as peças de um lote para outro equivalente e encerra o esvaziado.
   Confere o trio perfil/acabamento/comprimento no próprio banco.';
