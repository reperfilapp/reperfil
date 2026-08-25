-- =============================================================================
-- RePerfil — Inventário de perfis e acessórios
-- =============================================================================
--
-- Uma SESSÃO de inventário é um recorte do estoque escolhido para contar
-- (por linha, localização, cor, condição, tamanho de barra — o que a tela de
-- seleção oferecer) e congelado no momento da criação: cada item guarda o
-- que o sistema dizia ter, NAQUELE INSTANTE, para comparar com o que a
-- contagem física encontrar depois.
--
-- Contar não altera o estoque. Só a ação de "aplicar" — item por item, nunca
-- em bloco por modelo — grava a diferença de volta em `lotes_sobras` ou
-- `lotes_acessorio`, com o mesmo cuidado de trava de linha que as outras
-- funções de estoque já usam.
-- =============================================================================

create type tipo_item_inventario as enum ('perfil', 'acessorio');
create type status_sessao_inventario as enum ('em_andamento', 'concluida', 'cancelada');

create table sessoes_inventario (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes (id) on delete cascade,
  codigo text not null,

  titulo text,
  tipo_item tipo_item_inventario not null,
  -- Só para exibir depois "o que foi escolhido para contar" — não é lido
  -- por nenhuma função, é registro do critério usado.
  criterios jsonb,

  status status_sessao_inventario not null default 'em_andamento',

  criado_em timestamptz not null default now(),
  criado_por uuid references perfis_usuario (id),
  concluido_em timestamptz,

  constraint sessoes_inventario_codigo_unico unique (organizacao_id, codigo)
);

comment on table sessoes_inventario is
  'Uma rodada de contagem física — de perfis ou de acessórios, nunca das
   duas juntas, porque os filtros de seleção são diferentes.';

create index idx_sessoes_inventario_organizacao
  on sessoes_inventario (organizacao_id, criado_em desc);

create table itens_inventario (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes (id) on delete cascade,
  sessao_id uuid not null references sessoes_inventario (id) on delete cascade,

  lote_sobra_id uuid references lotes_sobras (id) on delete cascade,
  lote_acessorio_id uuid references lotes_acessorio (id) on delete cascade,

  -- O que o sistema dizia ter no momento em que a sessão foi criada.
  estoque_esperado_quantidade integer not null,
  estoque_esperado_comprimento_mm integer,

  -- O que a contagem física encontrou. Nulo até alguém contar.
  contagem_quantidade integer,
  contagem_comprimento_mm integer,
  -- Marcado pelo botão "Confirmar": estoque bate, sem precisar digitar nada
  -- — a contagem vira igual ao esperado.
  confirmado_sem_alteracao boolean not null default false,

  contado_em timestamptz,
  contado_por uuid references perfis_usuario (id),
  -- Nulo até a diferença ser gravada de volta no estoque de verdade.
  aplicado_em timestamptz,

  criado_em timestamptz not null default now(),

  constraint itens_inventario_um_tipo check (
    (lote_sobra_id is not null and lote_acessorio_id is null)
    or (lote_sobra_id is null and lote_acessorio_id is not null)
  ),
  constraint itens_inventario_quantidade_esperada_valida
    check (estoque_esperado_quantidade >= 0),
  constraint itens_inventario_contagem_valida
    check (contagem_quantidade is null or contagem_quantidade >= 0)
);

comment on table itens_inventario is
  'Um cartão contado dentro de uma sessão — um lote específico (perfil ou
   acessório), nunca um modelo inteiro somado.';

create index idx_itens_inventario_sessao on itens_inventario (sessao_id);
create index idx_itens_inventario_lote_sobra on itens_inventario (lote_sobra_id);
create index idx_itens_inventario_lote_acessorio on itens_inventario (lote_acessorio_id);
-- Um lote não entra duas vezes na MESMA sessão — sessões diferentes podem
-- repeti-lo (contagens em datas diferentes), por isso o índice não é global.
create unique index idx_itens_inventario_lote_sobra_unico
  on itens_inventario (sessao_id, lote_sobra_id) where lote_sobra_id is not null;
create unique index idx_itens_inventario_lote_acessorio_unico
  on itens_inventario (sessao_id, lote_acessorio_id) where lote_acessorio_id is not null;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------
alter table sessoes_inventario enable row level security;
alter table itens_inventario enable row level security;

create policy "ver sessoes de inventario da organizacao"
  on sessoes_inventario for select
  to authenticated
  using (organizacao_id = organizacao_atual());

create policy "ver itens de inventario da organizacao"
  on itens_inventario for select
  to authenticated
  using (organizacao_id = organizacao_atual());

-- A contagem em si (digitar quantidade/comprimento, ou confirmar sem
-- alteração) é uma atualização direta da tela, sem função — não muda
-- estoque de verdade, só registra o que foi visto.
create policy "estoque registra contagem"
  on itens_inventario for update
  to authenticated
  using (organizacao_id = organizacao_atual() and pode_movimentar_estoque())
  with check (organizacao_id = organizacao_atual());

-- -----------------------------------------------------------------------------
-- Criar a sessão com os itens já congelados
-- -----------------------------------------------------------------------------
create or replace function criar_sessao_inventario(
  p_tipo_item tipo_item_inventario,
  p_titulo text,
  p_criterios jsonb,
  p_lote_ids uuid[]
)
returns sessoes_inventario
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid := organizacao_atual();
  v_sessao sessoes_inventario;
begin
  if not pode_movimentar_estoque() then
    raise exception 'Seu perfil não permite criar um inventário.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_lote_ids is null or array_length(p_lote_ids, 1) is null
     or array_length(p_lote_ids, 1) = 0 then
    raise exception 'Escolha pelo menos um item para inventariar.'
      using errcode = 'check_violation';
  end if;

  insert into sessoes_inventario (
    organizacao_id, codigo, titulo, tipo_item, criterios, criado_por
  )
  values (
    v_organizacao_id,
    gerar_codigo_unico(v_organizacao_id, 'INV', 'sessoes_inventario'),
    nullif(trim(p_titulo), ''), p_tipo_item, p_criterios, auth.uid()
  )
  returning * into v_sessao;

  if p_tipo_item = 'perfil' then
    insert into itens_inventario (
      organizacao_id, sessao_id, lote_sobra_id,
      estoque_esperado_quantidade, estoque_esperado_comprimento_mm
    )
    select v_organizacao_id, v_sessao.id, l.id, l.quantidade, l.comprimento_mm
    from lotes_sobras l
    where l.id = any(p_lote_ids) and l.organizacao_id = v_organizacao_id;
  else
    insert into itens_inventario (
      organizacao_id, sessao_id, lote_acessorio_id, estoque_esperado_quantidade
    )
    select v_organizacao_id, v_sessao.id, l.id, l.quantidade
    from lotes_acessorio l
    where l.id = any(p_lote_ids) and l.organizacao_id = v_organizacao_id;
  end if;

  return v_sessao;
end;
$$;

comment on function criar_sessao_inventario is
  'Cria a sessão e congela, para cada lote escolhido, o que o sistema dizia
   ter no momento — é contra esse número que a contagem física é comparada.';

grant execute on function criar_sessao_inventario to authenticated;

-- -----------------------------------------------------------------------------
-- Cancelar uma sessão (nada foi aplicado, só se desiste da contagem)
-- -----------------------------------------------------------------------------
create or replace function cancelar_sessao_inventario(p_sessao_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid := organizacao_atual();
begin
  if not pode_movimentar_estoque() then
    raise exception 'Seu perfil não permite cancelar um inventário.'
      using errcode = 'insufficient_privilege';
  end if;

  update sessoes_inventario
  set status = 'cancelada'
  where id = p_sessao_id
    and organizacao_id = v_organizacao_id
    and status = 'em_andamento';

  if not found then
    raise exception 'Sessão não encontrada ou já encerrada.'
      using errcode = 'no_data_found';
  end if;
end;
$$;

grant execute on function cancelar_sessao_inventario to authenticated;

-- -----------------------------------------------------------------------------
-- Aplicar UM item ao estoque de verdade
-- -----------------------------------------------------------------------------
create or replace function aplicar_item_inventario(p_item_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid := organizacao_atual();
  v_item itens_inventario;
  v_sessao sessoes_inventario;
  v_lote_sobra lotes_sobras;
  v_lote_acessorio lotes_acessorio;
  v_mudou boolean := false;
  v_justificativa text;
begin
  if not pode_movimentar_estoque() then
    raise exception 'Seu perfil não permite aplicar o inventário.'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_item
  from itens_inventario
  where id = p_item_id and organizacao_id = v_organizacao_id
  for update;

  if not found then
    raise exception 'Item de inventário não encontrado.'
      using errcode = 'no_data_found';
  end if;

  if v_item.contagem_quantidade is null then
    raise exception 'Este item ainda não foi contado.'
      using errcode = 'check_violation';
  end if;

  if v_item.aplicado_em is not null then
    raise exception 'Este item já foi aplicado ao estoque.'
      using errcode = 'check_violation';
  end if;

  select * into v_sessao from sessoes_inventario where id = v_item.sessao_id;
  v_justificativa := 'Ajuste por inventário ' || v_sessao.codigo;

  if v_item.lote_sobra_id is not null then
    select * into v_lote_sobra
    from lotes_sobras where id = v_item.lote_sobra_id for update;

    if v_item.contagem_quantidade <> v_lote_sobra.quantidade
       or (v_item.contagem_comprimento_mm is not null
           and v_item.contagem_comprimento_mm <> v_lote_sobra.comprimento_mm)
    then
      if v_item.contagem_quantidade < v_lote_sobra.quantidade_reservada then
        raise exception
          'Há % peça(s) reservada(s) desta sobra — cancele a reserva antes de aplicar uma contagem menor.',
          v_lote_sobra.quantidade_reservada
          using errcode = 'check_violation';
      end if;

      v_mudou := true;

      update lotes_sobras
      set quantidade = v_item.contagem_quantidade,
          comprimento_mm = coalesce(v_item.contagem_comprimento_mm, comprimento_mm),
          status = case
            when v_item.contagem_quantidade = 0 then 'descartada'::status_lote
            when v_item.contagem_quantidade = quantidade_reservada
              and v_item.contagem_quantidade > 0 then 'reservada'::status_lote
            else 'disponivel'::status_lote
          end
      where id = v_lote_sobra.id;

      insert into movimentacoes_estoque (
        organizacao_id, lote_id, tipo, quantidade, comprimento_mm,
        justificativa, criado_por
      )
      values (
        v_organizacao_id, v_lote_sobra.id, 'ajuste',
        v_item.contagem_quantidade - v_lote_sobra.quantidade,
        coalesce(v_item.contagem_comprimento_mm, v_lote_sobra.comprimento_mm),
        v_justificativa, auth.uid()
      );
    end if;
  else
    select * into v_lote_acessorio
    from lotes_acessorio where id = v_item.lote_acessorio_id for update;

    if v_item.contagem_quantidade <> v_lote_acessorio.quantidade then
      v_mudou := true;

      update lotes_acessorio
      set quantidade = v_item.contagem_quantidade,
          status = case
            when v_item.contagem_quantidade = 0 then 'descartada'::status_lote
            else 'disponivel'::status_lote
          end
      where id = v_lote_acessorio.id;

      insert into movimentacoes_acessorio (
        organizacao_id, lote_id, tipo, quantidade, justificativa, criado_por
      )
      values (
        v_organizacao_id, v_lote_acessorio.id, 'ajuste',
        v_item.contagem_quantidade - v_lote_acessorio.quantidade,
        v_justificativa, auth.uid()
      );
    end if;
  end if;

  update itens_inventario set aplicado_em = now() where id = p_item_id;

  return jsonb_build_object('mudou', v_mudou);
end;
$$;

comment on function aplicar_item_inventario is
  'Grava a contagem de UM item de volta no estoque de verdade. Só altera
   quando a contagem difere do esperado — sem isso, é só um registro de
   conferência, sem movimentação para gerar.';

grant execute on function aplicar_item_inventario to authenticated;

-- -----------------------------------------------------------------------------
-- Aplicar TODOS os itens já contados da sessão, de uma vez
-- -----------------------------------------------------------------------------
create or replace function aplicar_sessao_inventario(p_sessao_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid := organizacao_atual();
  v_item_id uuid;
  v_resultado jsonb;
  v_total integer := 0;
  v_alterados integer := 0;
begin
  if not pode_movimentar_estoque() then
    raise exception 'Seu perfil não permite aplicar o inventário.'
      using errcode = 'insufficient_privilege';
  end if;

  if not exists (
    select 1 from sessoes_inventario
    where id = p_sessao_id and organizacao_id = v_organizacao_id
  ) then
    raise exception 'Sessão não encontrada.' using errcode = 'no_data_found';
  end if;

  for v_item_id in
    select id from itens_inventario
    where sessao_id = p_sessao_id
      and organizacao_id = v_organizacao_id
      and contagem_quantidade is not null
      and aplicado_em is null
  loop
    v_resultado := aplicar_item_inventario(v_item_id);
    v_total := v_total + 1;

    if (v_resultado ->> 'mudou')::boolean then
      v_alterados := v_alterados + 1;
    end if;
  end loop;

  update sessoes_inventario
  set status = 'concluida', concluido_em = now()
  where id = p_sessao_id and organizacao_id = v_organizacao_id;

  return jsonb_build_object('total', v_total, 'alterados', v_alterados);
end;
$$;

comment on function aplicar_sessao_inventario is
  'Aplica de uma vez todo item já contado e ainda não aplicado — item por
   item, por baixo, com a mesma trava de aplicar_item_inventario. Encerra a
   sessão ao final, mesmo que algum item nunca tenha sido contado.';

grant execute on function aplicar_sessao_inventario to authenticated;
