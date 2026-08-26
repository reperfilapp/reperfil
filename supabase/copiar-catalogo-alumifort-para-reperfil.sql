-- =============================================================================
-- RePerfil — Copiar o catálogo da Alumifort para a organização RePerfil
-- =============================================================================
--
-- Script de UMA VEZ SÓ, não uma migração de schema — não altera tabela
-- nenhuma, só copia dados. Roda no SQL Editor como qualquer script daqui:
-- não precisa entrar como usuário nenhum, e por isso NÃO copia imagens
-- (fotos e desenhos técnicos) — Storage não é alcançado por SQL puro. Os
-- perfis e produtos copiados ficam SEM foto/desenho até isso ser resolvido
-- à parte (avisei no chat).
--
-- O que copia: modelos de perfil, acabamentos, produtos com a lista técnica
-- de cada um, e os números de configuração de cálculo (não o "confirmado
-- pelo administrador", que é do administrador da RePerfil decidir sozinho).
--
-- O que NÃO copia, de propósito: localizações (prateleiras são da Alumifort,
-- não fazem sentido num catálogo de referência), clientes, estoque/sobras,
-- reservas, colaboradores — nada disso é "catálogo", é operação do dia a dia
-- de uma empresa específica.
--
-- Pode rodar de novo? NÃO sem querer duplicar — não é idempotente. Rodar
-- duas vezes cria dois perfis "SU-102", por exemplo. Se precisar rodar de
-- novo, apague antes o que foi copiado (ou me avise).
-- =============================================================================

do $$
declare
  v_origem_id uuid;
  v_destino_id uuid;
  v_qtd_perfis integer;
  v_qtd_acabamentos integer;
  v_qtd_produtos integer;
  v_qtd_itens integer;
begin
  select id into v_origem_id
  from organizacoes
  where nome_fantasia ilike '%alumifort%'
  limit 1;

  select id into v_destino_id
  from organizacoes
  where nome_fantasia = 'RePerfil'
  limit 1;

  if v_origem_id is null then
    raise exception 'Organização de origem (Alumifort) não encontrada pelo nome fantasia.';
  end if;

  if v_destino_id is null then
    raise exception 'Organização de destino (RePerfil) não encontrada — o nome fantasia precisa ser exatamente "RePerfil".';
  end if;

  if v_origem_id = v_destino_id then
    raise exception 'Origem e destino são a mesma organização — conferir os nomes fantasia.';
  end if;

  raise notice 'Origem (Alumifort): %', v_origem_id;
  raise notice 'Destino (RePerfil): %', v_destino_id;

  -- Mapas id-antigo -> id-novo, só durante esta execução: os itens da
  -- lista técnica precisam remapear tanto o produto quanto o perfil para
  -- os ids novos, e só dá para achar essa correspondência enquanto os
  -- dois lados (Alumifort e RePerfil) ainda estão nesta mesma sessão.
  create temporary table _mapa_perfis (id_antigo uuid primary key, id_novo uuid not null) on commit drop;
  create temporary table _mapa_produtos (id_antigo uuid primary key, id_novo uuid not null) on commit drop;

  -- ── Modelos de perfil ────────────────────────────────────────────────────
  insert into modelos_perfil (
    organizacao_id, codigo, descricao, fabricante, linha, categoria, aplicacao,
    largura_secao_mm, altura_secao_mm, medida_3_secao_mm, medida_4_secao_mm,
    imagem_url, codigo_barras, comprimento_barra_mm, peso_por_metro_g,
    preco_por_metro_centavos, observacoes, revisado, ativo
  )
  select
    v_destino_id, codigo, descricao, fabricante, linha, categoria, aplicacao,
    largura_secao_mm, altura_secao_mm, medida_3_secao_mm, medida_4_secao_mm,
    -- Caminho da imagem NÃO copiado — aponta para um arquivo que só existe
    -- no balde da Alumifort. Fica nulo até o passo de imagens acontecer.
    null, codigo_barras, comprimento_barra_mm, peso_por_metro_g,
    preco_por_metro_centavos, observacoes, revisado, ativo
  from modelos_perfil
  where organizacao_id = v_origem_id;

  insert into _mapa_perfis (id_antigo, id_novo)
  select antigo.id, novo.id
  from modelos_perfil antigo
  join modelos_perfil novo
    on novo.organizacao_id = v_destino_id and novo.codigo = antigo.codigo
  where antigo.organizacao_id = v_origem_id;

  get diagnostics v_qtd_perfis = row_count;

  -- ── Acabamentos ──────────────────────────────────────────────────────────
  insert into acabamentos (
    organizacao_id, codigo, nome, tipo, codigo_ral, descricao, cor_hex, ativo
  )
  select
    v_destino_id, codigo, nome, tipo, codigo_ral, descricao, cor_hex, ativo
  from acabamentos
  where organizacao_id = v_origem_id;

  get diagnostics v_qtd_acabamentos = row_count;

  -- ── Produtos ─────────────────────────────────────────────────────────────
  insert into produtos (
    organizacao_id, codigo, nome, descricao, largura_mm, altura_mm,
    observacoes, foto_url, desenho_url, ativo
  )
  select
    v_destino_id, codigo, nome, descricao, largura_mm, altura_mm,
    -- Mesmo caso das imagens de perfil: fica sem foto/desenho por ora.
    observacoes, null, null, ativo
  from produtos
  where organizacao_id = v_origem_id;

  insert into _mapa_produtos (id_antigo, id_novo)
  select antigo.id, novo.id
  from produtos antigo
  join produtos novo
    on novo.organizacao_id = v_destino_id and novo.codigo = antigo.codigo
  where antigo.organizacao_id = v_origem_id;

  get diagnostics v_qtd_produtos = row_count;

  -- ── Lista técnica de cada produto ────────────────────────────────────────
  -- Remapeia produto_id e modelo_perfil_id para os ids NOVOS, usando os
  -- mapas montados acima.
  insert into itens_lista_tecnica (
    organizacao_id, produto_id, modelo_perfil_id, comprimento_mm, quantidade,
    ordem, observacao
  )
  select
    v_destino_id, mp.id_novo, mpf.id_novo, it.comprimento_mm, it.quantidade,
    it.ordem, it.observacao
  from itens_lista_tecnica it
  join _mapa_produtos mp on mp.id_antigo = it.produto_id
  join _mapa_perfis mpf on mpf.id_antigo = it.modelo_perfil_id
  where it.organizacao_id = v_origem_id;

  get diagnostics v_qtd_itens = row_count;

  -- ── Configurações de cálculo ─────────────────────────────────────────────
  -- A RePerfil já tem sua própria linha (criada junto com a organização) —
  -- só atualiza os números, não mexe em `confirmado_pelo_administrador` nem
  -- `confirmado_em`: isso é o administrador de lá quem confirma, não uma
  -- cópia automática de outra empresa.
  update configuracoes_aplicacao destino
  set comprimento_barra_padrao_mm = origem.comprimento_barra_padrao_mm,
      espessura_serra_mm = origem.espessura_serra_mm,
      margem_limpeza_mm = origem.margem_limpeza_mm,
      comprimento_minimo_sobra_mm = origem.comprimento_minimo_sobra_mm,
      ultimo_corte_gera_perda = origem.ultimo_corte_gera_perda,
      prazo_reserva_horas = origem.prazo_reserva_horas,
      prioridade_utilizacao = origem.prioridade_utilizacao,
      considerar_perfis_equivalentes = origem.considerar_perfis_equivalentes
  from configuracoes_aplicacao origem
  where origem.organizacao_id = v_origem_id
    and destino.organizacao_id = v_destino_id;

  raise notice 'Perfis copiados: %', v_qtd_perfis;
  raise notice 'Acabamentos copiados: %', v_qtd_acabamentos;
  raise notice 'Produtos copiados: %', v_qtd_produtos;
  raise notice 'Itens de lista técnica copiados: %', v_qtd_itens;
end $$;

-- Confere o resultado.
select
  o.nome_fantasia,
  (select count(*) from modelos_perfil where organizacao_id = o.id) as perfis,
  (select count(*) from acabamentos where organizacao_id = o.id) as acabamentos,
  (select count(*) from produtos where organizacao_id = o.id) as produtos,
  (select count(*) from itens_lista_tecnica where organizacao_id = o.id) as itens_lista_tecnica
from organizacoes o
where o.nome_fantasia ilike '%alumifort%' or o.nome_fantasia = 'RePerfil';
