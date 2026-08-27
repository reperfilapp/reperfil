-- =============================================================================
-- O que está segurando a exclusão de teste@reperfil.invalido
-- =============================================================================
--
-- Só CONSULTA. Não apaga nem altera nada.
--
-- Devolve o resultado como TABELA, e não por `raise notice`: o SQL Editor
-- do Supabase esconde os avisos numa aba à parte, e a primeira versão
-- deste script parecia não responder nada.
--
-- ── O QUE ESTÁ ACONTECENDO ───────────────────────────────────────────────
--
-- Apagar em `auth.users` tenta apagar `perfis_usuario` junto (a chave é
-- `on delete cascade`). Mas as tabelas abaixo apontam para
-- `perfis_usuario` em colunas como `criado_por`, sem regra de exclusão
-- declarada — o padrão do Postgres nesse caso é NO ACTION, que se comporta
-- como RESTRICT.
--
-- Qualquer linha diferente de zero abaixo é motivo suficiente para o banco
-- recusar a exclusão. O painel do Supabase não mostra esse erro: o botão
-- simplesmente não faz nada.

with conta as (
  select p.id
  from perfis_usuario p
  join auth.users u on u.id = p.id
  where u.email = 'teste@reperfil.invalido'
)
select tabela, coluna, linhas, efeito from (
  select 'modelos_perfil' as tabela, 'criado_por' as coluna,
         (select count(*) from modelos_perfil where criado_por = (select id from conta)) as linhas,
         'BLOQUEIA' as efeito
  union all select 'acabamentos', 'criado_por',
         (select count(*) from acabamentos where criado_por = (select id from conta)), 'BLOQUEIA'
  union all select 'compatibilidades_acabamento', 'criado_por',
         (select count(*) from compatibilidades_acabamento where criado_por = (select id from conta)), 'BLOQUEIA'
  union all select 'localizacoes', 'criado_por',
         (select count(*) from localizacoes where criado_por = (select id from conta)), 'BLOQUEIA'
  union all select 'clientes', 'criado_por',
         (select count(*) from clientes where criado_por = (select id from conta)), 'BLOQUEIA'
  union all select 'arquivos_vetoriais', 'criado_por',
         (select count(*) from arquivos_vetoriais where criado_por = (select id from conta)), 'BLOQUEIA'
  union all select 'lotes_sobras', 'criado_por',
         (select count(*) from lotes_sobras where criado_por = (select id from conta)), 'BLOQUEIA'
  union all select 'reservas', 'criado_por',
         (select count(*) from reservas where criado_por = (select id from conta)), 'BLOQUEIA'
  union all select 'movimentacoes_estoque', 'criado_por',
         (select count(*) from movimentacoes_estoque where criado_por = (select id from conta)), 'BLOQUEIA'
  union all select 'configuracoes_aplicacao', 'confirmado_por',
         (select count(*) from configuracoes_aplicacao where confirmado_por = (select id from conta)), 'BLOQUEIA'
  union all select 'registros_auditoria', 'usuario_id',
         (select count(*) from registros_auditoria where usuario_id = (select id from conta)), 'BLOQUEIA'
  union all select 'modelos_acessorio', 'criado_por',
         (select count(*) from modelos_acessorio where criado_por = (select id from conta)), 'BLOQUEIA'
  union all select 'lotes_acessorio', 'criado_por',
         (select count(*) from lotes_acessorio where criado_por = (select id from conta)), 'BLOQUEIA'
  union all select 'movimentacoes_acessorio', 'criado_por',
         (select count(*) from movimentacoes_acessorio where criado_por = (select id from conta)), 'BLOQUEIA'
  union all select 'sessoes_inventario', 'criado_por',
         (select count(*) from sessoes_inventario where criado_por = (select id from conta)), 'BLOQUEIA'
  union all select 'itens_inventario', 'contado_por',
         (select count(*) from itens_inventario where contado_por = (select id from conta)), 'BLOQUEIA'

  -- Estas NÃO bloqueiam: somem ou viram nulo sozinhas. Aparecem só para o
  -- retrato ficar completo.
  union all select 'acessos_sistema', 'usuario_id',
         (select count(*) from acessos_sistema where usuario_id = (select id from conta)), 'ok (cascade)'
  union all select 'convites_colaborador', 'criado_por',
         (select count(*) from convites_colaborador where criado_por = (select id from conta)), 'ok (set null)'
  union all select 'modelos_perfil', 'revisado_por',
         (select count(*) from modelos_perfil where revisado_por = (select id from conta)), 'ok (set null)'
) t
where linhas > 0
order by efeito, linhas desc;

-- Se o resultado vier VAZIO, nada está segurando e o motivo é outro.
-- Se vier com linhas 'BLOQUEIA', são elas que impedem o "Delete user".

-- A qual empresa a conta pertence — útil para saber se é dado descartável
-- ou se está misturada com a empresa de verdade.
select
  o.nome_fantasia,
  o.codigo,
  p.nome,
  p.papel,
  p.ativo
from perfis_usuario p
join organizacoes o on o.id = p.organizacao_id
join auth.users u on u.id = p.id
where u.email = 'teste@reperfil.invalido';
