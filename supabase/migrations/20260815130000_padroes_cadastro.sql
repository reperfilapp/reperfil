-- =============================================================================
-- RePerfil — Padrões de cadastro: organização e código automáticos
-- =============================================================================
--
-- POR QUE: sem isto, toda inserção feita pelo aplicativo precisa descobrir o
-- `organizacao_id` do usuário e mandá-lo junto. Isso significa uma consulta
-- extra por gravação, e — pior — abre espaço para o aplicativo mandar o valor
-- ERRADO. O Row Level Security recusaria, mas o erro só apareceria em tempo
-- de execução, na mão do usuário.
--
-- Com `default organizacao_atual()`, o banco preenche sozinho, a partir de
-- quem está autenticado. O aplicativo não tem como errar porque não informa.
-- =============================================================================

alter table modelos_perfil
  alter column organizacao_id set default organizacao_atual();

alter table acabamentos
  alter column organizacao_id set default organizacao_atual();

alter table compatibilidades_acabamento
  alter column organizacao_id set default organizacao_atual();

alter table localizacoes
  alter column organizacao_id set default organizacao_atual();

alter table clientes
  alter column organizacao_id set default organizacao_atual();

alter table arquivos_vetoriais
  alter column organizacao_id set default organizacao_atual();

alter table lotes_sobras
  alter column organizacao_id set default organizacao_atual();

-- Quem criou o registro também sai de graça de quem está autenticado.
alter table modelos_perfil alter column criado_por set default auth.uid();
alter table acabamentos alter column criado_por set default auth.uid();
alter table compatibilidades_acabamento alter column criado_por set default auth.uid();
alter table localizacoes alter column criado_por set default auth.uid();
alter table clientes alter column criado_por set default auth.uid();
alter table arquivos_vetoriais alter column criado_por set default auth.uid();
alter table lotes_sobras alter column criado_por set default auth.uid();

-- -----------------------------------------------------------------------------
-- Código automático para clientes
-- -----------------------------------------------------------------------------
-- Modelo de perfil, acabamento e localização têm código informado pela
-- empresa, porque são códigos que o serralheiro já conhece e usa no dia a
-- dia. Cliente não: ninguém decora código de cliente, então o sistema gera.
create or replace function preencher_codigo_cliente()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.codigo is null or trim(new.codigo) = '' then
    new.codigo := gerar_codigo_unico(new.organizacao_id, 'CLI', 'clientes');
  end if;

  return new;
end;
$$;

create trigger trg_clientes_codigo
  before insert on clientes
  for each row execute function preencher_codigo_cliente();

-- A coluna passa a aceitar nulo na entrada; o gatilho preenche antes de
-- gravar, então a restrição de unicidade continua valendo.
alter table clientes alter column codigo drop not null;
