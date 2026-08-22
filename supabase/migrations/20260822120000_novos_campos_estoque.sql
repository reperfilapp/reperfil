-- =============================================================
-- Migração: Novos campos no cadastro de estoque
-- Data: 2026-08-22
-- =============================================================

-- 1. Adiciona campo tipo_material
--    'sobra' = veio de um corte/obra (padrão anterior)
--    'novo'  = material novo, direto do fornecedor
ALTER TABLE lotes_sobras
  ADD COLUMN IF NOT EXISTS tipo_material text NOT NULL DEFAULT 'sobra'
    CHECK (tipo_material IN ('novo', 'sobra'));

-- 2. Adiciona campo cliente_obra (texto livre, referência ao cliente/obra de origem)
ALTER TABLE lotes_sobras
  ADD COLUMN IF NOT EXISTS cliente_obra text NULL;

-- 3. Adiciona opção 'novo_embalado' ao estado de conservação
ALTER TYPE estado_conservacao ADD VALUE IF NOT EXISTS 'novo_embalado';

-- 4. Índice para pesquisa por cliente_obra
CREATE INDEX IF NOT EXISTS idx_lotes_sobras_cliente_obra
  ON lotes_sobras (organizacao_id, cliente_obra)
  WHERE cliente_obra IS NOT NULL;


-- 5. Atualiza a função cadastrar_sobra para aceitar os novos campos
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
  p_lote_origem_id uuid default null,
  p_tipo_material text default 'sobra',
  p_cliente_obra text default null
)
returns lotes_sobras
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid := organizacao_atual();
  v_lote lotes_sobras;
  v_barra_mm integer;
  v_codigo_modelo text;
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

  if p_quantidade is null or p_quantidade < 1 then
    raise exception 'A quantidade precisa ser pelo menos 1.'
      using errcode = 'check_violation';
  end if;

  -- Busca o modelo e o comprimento da barra na mesma consulta
  select comprimento_barra_mm, codigo
  into v_barra_mm, v_codigo_modelo
  from modelos_perfil
  where id = p_modelo_perfil_id and organizacao_id = v_organizacao_id;

  if not found then
    raise exception 'Modelo de perfil não encontrado nesta organização.'
      using errcode = 'foreign_key_violation';
  end if;

  if p_comprimento_mm > v_barra_mm then
    raise exception
      'A barra do perfil % tem % mm; uma sobra não pode ter % mm.',
      v_codigo_modelo, v_barra_mm, p_comprimento_mm
      using errcode = 'check_violation';
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
    lote_origem_id, tipo_material, cliente_obra, criado_por
  )
  values (
    v_organizacao_id,
    gerar_codigo_unico(v_organizacao_id, 'SB', 'lotes_sobras'),
    p_modelo_perfil_id, p_acabamento_id, p_localizacao_id,
    p_comprimento_mm, p_quantidade, p_estado, p_foto_url, p_origem,
    p_observacoes, p_lote_origem_id, p_tipo_material, p_cliente_obra, auth.uid()
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
