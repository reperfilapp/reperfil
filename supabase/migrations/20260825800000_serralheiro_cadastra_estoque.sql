-- O serralheiro passa a cadastrar estoque por padrão.
--
-- É quem está no depósito com a peça em mãos — esperar um administrador ou
-- auxiliar cadastrar por ele só atrasa o trabalho. `permissoes_do_cargo` é
-- quem define o padrão de verdade (consultada no convite, em
-- `vincular_convite`); o espelho em `src/dominio/cargos.ts` (frontend) foi
-- ajustado no mesmo commit — os dois precisam concordar.
create or replace function permissoes_do_cargo(p_papel papel_usuario)
returns table (
  movimentar_estoque boolean,
  gerenciar_cadastros boolean,
  gerenciar_colaboradores boolean
)
language sql
immutable
as $$
  select
    p_papel in ('administrador', 'gerente', 'auxiliar', 'estoque', 'serralheiro'),
    p_papel in ('administrador', 'gerente'),
    p_papel = 'administrador'
$$;
