-- =============================================================================
-- RePerfil — Remover os dados criados durante os testes
-- =============================================================================
--
-- Depois da importação da planilha, o banco tem o inventário real misturado
-- com o que foi criado para verificar as telas de cada etapa. Este script
-- remove apenas o de teste.
--
-- ── POR QUE ISTO NÃO PODE SER FEITO PELO APLICATIVO ──────────────────────
--
-- As movimentações de estoque são imutáveis por decisão de projeto: não
-- existe política de DELETE em `movimentacoes_estoque`, então nem o
-- administrador consegue apagá-las pelo app. Isso é proposital — histórico
-- que pode ser apagado não é histórico.
--
-- Apagar um lote exige apagar antes as movimentações que apontam para ele, e
-- só o SQL Editor tem privilégio para isso. É exatamente o tipo de operação
-- que deve exigir sair do aplicativo e ir ao painel.
--
-- COMO RODAR: cole no SQL Editor do Supabase e execute. Mostra o que vai
-- apagar antes, e o resultado depois.
-- =============================================================================

-- O que será removido
select 'perfil de teste' as item, codigo, descricao
from modelos_perfil where codigo = 'P-2501'
union all
select 'lote de teste', codigo, comprimento_mm || ' mm'
from lotes_sobras
where modelo_perfil_id in (select id from modelos_perfil where codigo = 'P-2501')
union all
select 'cliente de teste', codigo, nome
from clientes where nome ilike '%teste%'
order by 1, 2;

-- -----------------------------------------------------------------------------
-- Remoção, na ordem que as chaves estrangeiras exigem
-- -----------------------------------------------------------------------------
do $$
declare
  v_perfil uuid;
  v_lotes uuid[];
begin
  select id into v_perfil from modelos_perfil where codigo = 'P-2501';

  if v_perfil is null then
    raise notice 'Nada a remover: o perfil de teste já não existe.';
    return;
  end if;

  select array_agg(id) into v_lotes
  from lotes_sobras where modelo_perfil_id = v_perfil;

  -- 1. Movimentações e reservas apontam para os lotes.
  delete from movimentacoes_estoque where lote_id = any(v_lotes);
  delete from reservas where lote_id = any(v_lotes);

  -- 2. A auditoria guarda cópia dos registros; sai junto.
  delete from registros_auditoria
  where registro_id = any(v_lotes) or registro_id = v_perfil;

  -- 3. O vínculo entre lotes (resto do corte) precisa ser desfeito antes,
  --    senão um lote impede a exclusão do outro.
  update lotes_sobras set lote_origem_id = null where id = any(v_lotes);
  delete from lotes_sobras where id = any(v_lotes);

  -- 4. Desenhos do perfil de teste.
  delete from arquivos_vetoriais where modelo_perfil_id = v_perfil;

  delete from modelos_perfil where id = v_perfil;

  raise notice 'Removidos: perfil P-2501 e % lote(s).', coalesce(array_length(v_lotes,1), 0);
end $$;

-- Cliente de teste
delete from clientes where nome ilike '%teste%';

-- -----------------------------------------------------------------------------
-- Conferência
-- -----------------------------------------------------------------------------
select
  (select count(*) from modelos_perfil)   as perfis,
  (select count(*) from acabamentos)      as acabamentos,
  (select count(*) from lotes_sobras)     as lotes,
  (select count(*) from arquivos_vetoriais) as desenhos,
  (select sum(quantidade) from lotes_sobras where status = 'disponivel') as pecas,
  (select round(sum(quantidade * comprimento_mm) / 1000.0, 1)
     from lotes_sobras where status = 'disponivel') as metros;

-- =============================================================================
-- O que este script NÃO remove, de propósito
-- =============================================================================
--
-- • O acabamento "Pintura preto fosco" (ACB-PT). Foi criado nos testes, mas é
--   um acabamento legítimo e pode ser útil. Se não quiser, desative pela tela
--   em vez de apagar.
--
-- • A localização "A1-01". Também veio dos testes, mas os 84 lotes importados
--   estão SEM localização — a planilha não tinha essa informação. Vale
--   aproveitá-la e ir atribuindo conforme organizar o depósito.
--
-- • A conta `teste@reperfil.invalido`. Ver decisão D8 em docs/decisoes.md:
--   precisa sair antes do primeiro cliente real ser cadastrado.
-- =============================================================================
