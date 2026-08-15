-- =============================================================================
-- RePerfil — Dados de DEMONSTRAÇÃO
-- =============================================================================
--
-- Tudo aqui é FICTÍCIO e serve só para conhecer o sistema. Nenhum nome,
-- logotipo, cliente, endereço ou valor foi tirado dos PDFs de referência.
-- As linhas de perfil ("Série 25", "Série 30") são genéricas de propósito,
-- não correspondem a produto de fabricante real.
--
-- Como remover depois: `delete from organizacoes where codigo = 'DEMO';`
-- O cascade limpa todo o resto.
-- =============================================================================

do $$
declare
  v_org_id uuid;
  v_perfil_25 uuid;
  v_perfil_30 uuid;
  v_perfil_tub uuid;
  v_branco uuid;
  v_preto uuid;
  v_bronze uuid;
  v_loc_a1 uuid;
  v_loc_a2 uuid;
  v_loc_b1 uuid;
begin
  -- Não duplica se a semente já foi aplicada.
  if exists (select 1 from organizacoes where codigo = 'DEMO') then
    raise notice 'Dados de demonstração já existem. Nada a fazer.';
    return;
  end if;

  insert into organizacoes (codigo, nome_fantasia, razao_social, cidade, estado)
  values ('DEMO', 'Esquadrias Demonstração', 'Empresa Demonstrativa Ltda', 'São Paulo', 'SP')
  returning id into v_org_id;

  insert into configuracoes_aplicacao (
    organizacao_id, espessura_serra_mm, margem_limpeza_mm,
    comprimento_minimo_sobra_mm, prazo_reserva_horas
  )
  values (v_org_id, 3, 0, 300, 48);

  -- ── Modelos de perfil ────────────────────────────────────────────────────
  insert into modelos_perfil (organizacao_id, codigo, descricao, linha, categoria, comprimento_barra_mm, peso_por_metro_g)
  values (v_org_id, 'P-2501', 'Marco de correr — Série 25', 'Série 25', 'Marco', 6000, 1180)
  returning id into v_perfil_25;

  insert into modelos_perfil (organizacao_id, codigo, descricao, linha, categoria, comprimento_barra_mm, peso_por_metro_g)
  values (v_org_id, 'P-3010', 'Folha de giro — Série 30', 'Série 30', 'Folha', 6000, 1640)
  returning id into v_perfil_30;

  insert into modelos_perfil (organizacao_id, codigo, descricao, linha, categoria, comprimento_barra_mm, peso_por_metro_g)
  values (v_org_id, 'T-7638', 'Tubo estrutural 76 x 38 mm', 'Tubular', 'Tubo', 6000, 2450)
  returning id into v_perfil_tub;

  insert into modelos_perfil (organizacao_id, codigo, descricao, linha, categoria, comprimento_barra_mm)
  values (v_org_id, 'P-2502', 'Baguete — Série 25', 'Série 25', 'Baguete', 6000);

  -- ── Acabamentos ──────────────────────────────────────────────────────────
  insert into acabamentos (organizacao_id, codigo, nome, tipo, cor_hex)
  values (v_org_id, 'ACB-BR', 'Branco brilhante', 'pintura', '#F5F5F5')
  returning id into v_branco;

  insert into acabamentos (organizacao_id, codigo, nome, tipo, codigo_ral, cor_hex)
  values (v_org_id, 'ACB-PT', 'Preto fosco', 'pintura', 'RAL9005', '#1A1A1A')
  returning id into v_preto;

  insert into acabamentos (organizacao_id, codigo, nome, tipo, cor_hex)
  values (v_org_id, 'ACB-BZ', 'Bronze anodizado', 'anodizado', '#6B4E2E')
  returning id into v_bronze;

  insert into acabamentos (organizacao_id, codigo, nome, tipo, cor_hex)
  values (v_org_id, 'ACB-NT', 'Natural fosco', 'natural', '#C8CACC');

  -- ── Localizações ─────────────────────────────────────────────────────────
  insert into localizacoes (organizacao_id, codigo, deposito, setor, estante, prateleira)
  values (v_org_id, 'A1-01', 'Depósito 1', 'Setor A', 'Estante 1', 'Prateleira 1')
  returning id into v_loc_a1;

  insert into localizacoes (organizacao_id, codigo, deposito, setor, estante, prateleira)
  values (v_org_id, 'A1-02', 'Depósito 1', 'Setor A', 'Estante 1', 'Prateleira 2')
  returning id into v_loc_a2;

  insert into localizacoes (organizacao_id, codigo, deposito, setor, estante, prateleira)
  values (v_org_id, 'B2-01', 'Depósito 1', 'Setor B', 'Estante 2', 'Prateleira 1')
  returning id into v_loc_b1;

  insert into localizacoes (organizacao_id, codigo, deposito, setor, observacao)
  values (v_org_id, 'CAV-01', 'Depósito 1', 'Cavalete', 'Peças acima de 3 m');

  -- ── Sobras ───────────────────────────────────────────────────────────────
  -- Comprimentos escolhidos para exercitar os casos interessantes:
  -- a peça de 1.800 mm é a do teste obrigatório da especificação.
  insert into lotes_sobras (
    organizacao_id, codigo, modelo_perfil_id, acabamento_id, localizacao_id,
    comprimento_mm, quantidade, estado, origem
  )
  values
    (v_org_id, 'SB-DEMO1', v_perfil_25, v_branco, v_loc_a1, 1800, 1, 'bom',
     'Sobra de demonstração'),
    (v_org_id, 'SB-DEMO2', v_perfil_25, v_branco, v_loc_a1, 2400, 3, 'bom',
     'Sobra de demonstração'),
    (v_org_id, 'SB-DEMO3', v_perfil_25, v_preto,  v_loc_a2, 3200, 2, 'bom',
     'Sobra de demonstração'),
    (v_org_id, 'SB-DEMO4', v_perfil_30, v_branco, v_loc_a2, 950,  5, 'regular',
     'Sobra de demonstração'),
    (v_org_id, 'SB-DEMO5', v_perfil_30, v_preto,  v_loc_b1, 4750, 1, 'bom',
     'Sobra de demonstração'),
    (v_org_id, 'SB-DEMO6', v_perfil_tub, v_preto, v_loc_b1, 2100, 4, 'bom',
     'Sobra de demonstração'),
    (v_org_id, 'SB-DEMO7', v_perfil_25, v_bronze, v_loc_b1, 320,  2, 'ruim',
     'Ponta curta, perto do limite de aproveitamento'),
    (v_org_id, 'SB-DEMO8', v_perfil_30, v_bronze, v_loc_a1, 5400, 1, 'bom',
     'Sobra de demonstração');

  -- Movimentações de entrada correspondentes, para o histórico não nascer vazio.
  insert into movimentacoes_estoque (organizacao_id, lote_id, tipo, quantidade, comprimento_mm)
  select v_org_id, id, 'entrada', quantidade, comprimento_mm
  from lotes_sobras
  where organizacao_id = v_org_id;

  -- ── Clientes ─────────────────────────────────────────────────────────────
  -- Fictícios. CNPJ inválido de propósito, para não colidir com empresa real.
  insert into clientes (organizacao_id, codigo, nome, nome_fantasia, cidade, estado, telefone, email)
  values
    (v_org_id, 'CLI-0001', 'Construtora Exemplo Ltda', 'Exemplo Construções',
     'São Paulo', 'SP', '(11) 90000-0001', 'contato@exemplo.invalido'),
    (v_org_id, 'CLI-0002', 'Condomínio Modelo', null,
     'Campinas', 'SP', '(19) 90000-0002', 'sindico@modelo.invalido'),
    (v_org_id, 'CLI-0003', 'João da Silva (demonstração)', null,
     'Santos', 'SP', '(13) 90000-0003', null);

  raise notice 'Dados de demonstração criados na organização %.', v_org_id;
end $$;
