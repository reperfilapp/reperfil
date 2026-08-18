-- A permissão de cadastros passa a valer de verdade.
--
-- ── O PROBLEMA ───────────────────────────────────────────────────────────
--
-- A migração anterior criou `pode_gerenciar_cadastros`, mas nenhuma
-- política a consultava: catálogo de perfis, acabamentos, localizações e
-- clientes continuavam exigindo `pode_movimentar_estoque()`. Ou seja, a
-- caixa existia na tela de permissões e não mudava nada — o pior tipo de
-- controle, o que aparenta proteger.
--
-- São coisas diferentes. Movimentar estoque é cadastrar a peça que chegou e
-- dar baixa na que saiu: acontece o dia inteiro, no depósito, e erro ali se
-- conserta com um ajuste. Mexer no catálogo é dizer que o perfil FA-239
-- existe e quanto ele pesa: acontece raramente e erro ali contamina todo
-- orçamento futuro. Merecem chaves separadas.
--
-- ── NINGUÉM PERDE ACESSO ─────────────────────────────────────────────────
--
-- Separar as duas coisas tiraria o catálogo de quem hoje o administra. Por
-- isso a migração começa CONCEDENDO a permissão nova a todos que já podiam
-- fazer o trabalho — o estado de cada um continua exatamente o que era. A
-- partir daqui, quem entrar recebe o padrão do cargo, e o administrador
-- ajusta na tela de permissões.

update perfis_usuario
set pode_gerenciar_cadastros = true
where pode_movimentar_estoque;

create or replace function pode_gerenciar_cadastros()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select pode_gerenciar_cadastros from perfis_usuario
     where id = auth.uid() and ativo),
    false
  )
$$;

comment on function pode_gerenciar_cadastros is
  'Mexer no catálogo: perfis, linhas, acabamentos, localizações, clientes.
   Separada de pode_movimentar_estoque de propósito — ver o cabeçalho da
   migração 20260818110000.';

-- -----------------------------------------------------------------------------
-- As políticas dos cadastros
-- -----------------------------------------------------------------------------
-- Os nomes antigos falam de "estoque", que era o cargo de então. Ficam com
-- nome novo para que quem ler as políticas no painel entenda a regra sem
-- precisar do histórico.
drop policy if exists "estoque cadastra modelos" on modelos_perfil;
drop policy if exists "estoque edita modelos" on modelos_perfil;

create policy "quem gerencia cadastros cria modelos"
  on modelos_perfil for insert
  to authenticated
  with check (organizacao_id = organizacao_atual() and pode_gerenciar_cadastros());

create policy "quem gerencia cadastros edita modelos"
  on modelos_perfil for update
  to authenticated
  using (organizacao_id = organizacao_atual() and pode_gerenciar_cadastros())
  with check (organizacao_id = organizacao_atual());

drop policy if exists "estoque cadastra acabamentos" on acabamentos;
drop policy if exists "estoque edita acabamentos" on acabamentos;

create policy "quem gerencia cadastros cria acabamentos"
  on acabamentos for insert
  to authenticated
  with check (organizacao_id = organizacao_atual() and pode_gerenciar_cadastros());

create policy "quem gerencia cadastros edita acabamentos"
  on acabamentos for update
  to authenticated
  using (organizacao_id = organizacao_atual() and pode_gerenciar_cadastros())
  with check (organizacao_id = organizacao_atual());

drop policy if exists "estoque cadastra localizações" on localizacoes;
drop policy if exists "estoque edita localizações" on localizacoes;

create policy "quem gerencia cadastros cria localizações"
  on localizacoes for insert
  to authenticated
  with check (organizacao_id = organizacao_atual() and pode_gerenciar_cadastros());

create policy "quem gerencia cadastros edita localizações"
  on localizacoes for update
  to authenticated
  using (organizacao_id = organizacao_atual() and pode_gerenciar_cadastros())
  with check (organizacao_id = organizacao_atual());

drop policy if exists "estoque cadastra clientes" on clientes;
drop policy if exists "estoque edita clientes" on clientes;

create policy "quem gerencia cadastros cria clientes"
  on clientes for insert
  to authenticated
  with check (organizacao_id = organizacao_atual() and pode_gerenciar_cadastros());

create policy "quem gerencia cadastros edita clientes"
  on clientes for update
  to authenticated
  using (organizacao_id = organizacao_atual() and pode_gerenciar_cadastros());
