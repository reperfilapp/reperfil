-- =============================================================================
-- RePerfil — Row Level Security
-- =============================================================================
--
-- Princípio: NENHUMA linha é visível ou gravável fora da organização do
-- usuário autenticado. Esta é a única barreira real entre os dados de duas
-- empresas — a chave `anon` do Supabase é pública, então filtrar no código do
-- navegador não protege nada.
--
-- Papéis:
--   administrador  tudo, incluindo correção de estoque e gestão de usuários
--   estoque        cadastra e movimenta sobras
--   serralheiro    consulta e reserva; não cadastra nem corrige
--
-- Histórico (movimentacoes_estoque, registros_auditoria) não tem política de
-- UPDATE nem DELETE. A ausência é intencional: sem política, a operação é
-- negada para todos. Erro se corrige com uma movimentação de ajuste.
-- =============================================================================

alter table organizacoes                enable row level security;
alter table perfis_usuario              enable row level security;
alter table modelos_perfil              enable row level security;
alter table acabamentos                 enable row level security;
alter table compatibilidades_acabamento enable row level security;
alter table localizacoes                enable row level security;
alter table clientes                    enable row level security;
alter table arquivos_vetoriais          enable row level security;
alter table lotes_sobras                enable row level security;
alter table reservas                    enable row level security;
alter table movimentacoes_estoque       enable row level security;
alter table configuracoes_aplicacao     enable row level security;
alter table registros_auditoria         enable row level security;

-- -----------------------------------------------------------------------------
-- Organizações — cada um enxerga apenas a própria
-- -----------------------------------------------------------------------------
create policy "ver a própria organização"
  on organizacoes for select
  to authenticated
  using (id = organizacao_atual());

create policy "administrador edita a própria organização"
  on organizacoes for update
  to authenticated
  using (id = organizacao_atual() and e_administrador())
  with check (id = organizacao_atual());

-- -----------------------------------------------------------------------------
-- Perfis de usuário
-- -----------------------------------------------------------------------------
create policy "ver colegas da mesma organização"
  on perfis_usuario for select
  to authenticated
  using (organizacao_id = organizacao_atual());

create policy "administrador cria usuário na própria organização"
  on perfis_usuario for insert
  to authenticated
  with check (organizacao_id = organizacao_atual() and e_administrador());

-- O usuário pode editar o próprio cadastro (nome, telefone); o administrador
-- edita qualquer um. A troca de papel é barrada por gatilho, mais abaixo.
create policy "editar o próprio perfil ou, sendo administrador, qualquer um"
  on perfis_usuario for update
  to authenticated
  using (
    organizacao_id = organizacao_atual()
    and (id = auth.uid() or e_administrador())
  )
  with check (organizacao_id = organizacao_atual());

-- Impede que alguém se promova a administrador editando o próprio perfil.
create or replace function impedir_autopromocao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (new.papel is distinct from old.papel
      or new.pode_informar_sobra_resultante is distinct from old.pode_informar_sobra_resultante
      or new.ativo is distinct from old.ativo)
     and not e_administrador() then
    raise exception 'Somente o administrador altera papel, permissões ou situação de um usuário.'
      using errcode = 'insufficient_privilege';
  end if;

  return new;
end;
$$;

create trigger trg_impedir_autopromocao
  before update on perfis_usuario
  for each row execute function impedir_autopromocao();

-- -----------------------------------------------------------------------------
-- Cadastros — todos leem; só administrador e estoque escrevem
-- -----------------------------------------------------------------------------
create policy "ver modelos da organização"
  on modelos_perfil for select
  to authenticated
  using (organizacao_id = organizacao_atual());

create policy "estoque cadastra modelos"
  on modelos_perfil for insert
  to authenticated
  with check (organizacao_id = organizacao_atual() and pode_movimentar_estoque());

create policy "estoque edita modelos"
  on modelos_perfil for update
  to authenticated
  using (organizacao_id = organizacao_atual() and pode_movimentar_estoque())
  with check (organizacao_id = organizacao_atual());

create policy "ver acabamentos da organização"
  on acabamentos for select
  to authenticated
  using (organizacao_id = organizacao_atual());

create policy "estoque cadastra acabamentos"
  on acabamentos for insert
  to authenticated
  with check (organizacao_id = organizacao_atual() and pode_movimentar_estoque());

create policy "estoque edita acabamentos"
  on acabamentos for update
  to authenticated
  using (organizacao_id = organizacao_atual() and pode_movimentar_estoque())
  with check (organizacao_id = organizacao_atual());

-- Compatibilidade de acabamento afrouxa a regra de ouro do sistema, então
-- só o administrador cria ou remove.
create policy "ver compatibilidades da organização"
  on compatibilidades_acabamento for select
  to authenticated
  using (organizacao_id = organizacao_atual());

create policy "administrador cria compatibilidade"
  on compatibilidades_acabamento for insert
  to authenticated
  with check (organizacao_id = organizacao_atual() and e_administrador());

create policy "administrador remove compatibilidade"
  on compatibilidades_acabamento for delete
  to authenticated
  using (organizacao_id = organizacao_atual() and e_administrador());

create policy "ver localizações da organização"
  on localizacoes for select
  to authenticated
  using (organizacao_id = organizacao_atual());

create policy "estoque cadastra localizações"
  on localizacoes for insert
  to authenticated
  with check (organizacao_id = organizacao_atual() and pode_movimentar_estoque());

create policy "estoque edita localizações"
  on localizacoes for update
  to authenticated
  using (organizacao_id = organizacao_atual() and pode_movimentar_estoque())
  with check (organizacao_id = organizacao_atual());

-- -----------------------------------------------------------------------------
-- Clientes — dado pessoal sob a LGPD
-- -----------------------------------------------------------------------------
create policy "ver clientes da organização"
  on clientes for select
  to authenticated
  using (organizacao_id = organizacao_atual());

create policy "estoque cadastra clientes"
  on clientes for insert
  to authenticated
  with check (organizacao_id = organizacao_atual() and pode_movimentar_estoque());

create policy "estoque edita clientes"
  on clientes for update
  to authenticated
  using (organizacao_id = organizacao_atual() and pode_movimentar_estoque())
  with check (organizacao_id = organizacao_atual());

-- -----------------------------------------------------------------------------
-- Arquivos vetoriais (Fase 2)
-- -----------------------------------------------------------------------------
create policy "ver arquivos vetoriais da organização"
  on arquivos_vetoriais for select
  to authenticated
  using (organizacao_id = organizacao_atual());

create policy "estoque envia arquivos vetoriais"
  on arquivos_vetoriais for insert
  to authenticated
  with check (organizacao_id = organizacao_atual() and pode_movimentar_estoque());

-- -----------------------------------------------------------------------------
-- Lotes de sobras
-- -----------------------------------------------------------------------------
create policy "ver sobras da organização"
  on lotes_sobras for select
  to authenticated
  using (organizacao_id = organizacao_atual());

create policy "estoque cadastra sobras"
  on lotes_sobras for insert
  to authenticated
  with check (organizacao_id = organizacao_atual() and pode_movimentar_estoque());

-- Atenção: reserva e consumo NÃO passam por aqui. Vão pelas funções
-- transacionais da migration seguinte, que travam a linha antes de alterar.
create policy "estoque edita sobras"
  on lotes_sobras for update
  to authenticated
  using (organizacao_id = organizacao_atual() and pode_movimentar_estoque())
  with check (organizacao_id = organizacao_atual());

-- -----------------------------------------------------------------------------
-- Reservas — o serralheiro reserva, e é para isso que ele usa o sistema
-- -----------------------------------------------------------------------------
create policy "ver reservas da organização"
  on reservas for select
  to authenticated
  using (organizacao_id = organizacao_atual());

-- -----------------------------------------------------------------------------
-- Histórico — leitura livre na organização, escrita só pelas funções
-- -----------------------------------------------------------------------------
-- Sem política de INSERT direto: movimentação é gravada pelas funções
-- transacionais, que são SECURITY DEFINER. Isso garante que nenhuma
-- movimentação seja inventada sem a alteração de estoque correspondente.
create policy "ver movimentações da organização"
  on movimentacoes_estoque for select
  to authenticated
  using (organizacao_id = organizacao_atual());

-- Auditoria: só o administrador lê. Contém dados completos de todas as
-- alterações, incluindo dado pessoal de cliente.
create policy "administrador vê a auditoria"
  on registros_auditoria for select
  to authenticated
  using (organizacao_id = organizacao_atual() and e_administrador());

-- -----------------------------------------------------------------------------
-- Configurações
-- -----------------------------------------------------------------------------
create policy "ver configurações da organização"
  on configuracoes_aplicacao for select
  to authenticated
  using (organizacao_id = organizacao_atual());

create policy "administrador altera configurações"
  on configuracoes_aplicacao for update
  to authenticated
  using (organizacao_id = organizacao_atual() and e_administrador())
  with check (organizacao_id = organizacao_atual());

create policy "administrador cria configurações"
  on configuracoes_aplicacao for insert
  to authenticated
  with check (organizacao_id = organizacao_atual() and e_administrador());
