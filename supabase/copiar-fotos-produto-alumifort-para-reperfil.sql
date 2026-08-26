-- =============================================================================
-- RePerfil — Copiar foto/desenho de produto da Alumifort para a RePerfil
-- =============================================================================
--
-- Script de UMA VEZ SÓ, não uma migração de schema.
--
-- O primeiro script de cópia do catálogo (copiar-catalogo-alumifort-para-
-- -reperfil.sql) trouxe os produtos, mas deixou foto_url/desenho_url nulos
-- de propósito — SQL puro não alcança o Storage. Depois, o script de mover
-- arquivos (mover-arquivos-catalogo-central.mjs) moveu os arquivos de
-- verdade para a pasta da RePerfil e atualizou produtos.foto_url/desenho_url
-- — mas só da linha que JÁ TINHA um caminho para casar (a da Alumifort). A
-- linha nova da RePerfil, com os campos nulos, não tinha o que casar e ficou
-- sem nada.
--
-- Este script preenche essa lacuna: copia o valor (já atualizado, apontando
-- para a pasta da RePerfil) da linha da Alumifort para a linha correspondente
-- da RePerfil, casando por `codigo` (único por organização). Só preenche
-- onde estiver nulo — não sobrescreve nada que já exista do lado da RePerfil.
-- Pode rodar de novo sem problema (idempotente).
-- =============================================================================

do $$
declare
  v_origem_id uuid;
  v_destino_id uuid;
  v_qtd integer;
begin
  -- O destino é achado pela marca de catálogo central (não pelo nome
  -- fantasia — esse pode ter mudado desde a cópia inicial, e a marca é o
  -- dado que não erra).
  select id into v_destino_id
  from organizacoes
  where eh_catalogo_central
  limit 1;

  select id into v_origem_id
  from organizacoes
  where nome_fantasia ilike '%alumifort%'
    and id != coalesce(v_destino_id, '00000000-0000-0000-0000-000000000000'::uuid)
  limit 1;

  if v_destino_id is null then
    raise exception 'Nenhuma organização está marcada como catálogo central (eh_catalogo_central).';
  end if;

  if v_origem_id is null then
    raise exception 'Organização de origem (Alumifort) não encontrada pelo nome fantasia.';
  end if;

  update produtos destino
  set foto_url = coalesce(destino.foto_url, origem.foto_url),
      desenho_url = coalesce(destino.desenho_url, origem.desenho_url)
  from produtos origem
  where origem.organizacao_id = v_origem_id
    and destino.organizacao_id = v_destino_id
    and destino.codigo = origem.codigo
    and (
      (destino.foto_url is null and origem.foto_url is not null)
      or (destino.desenho_url is null and origem.desenho_url is not null)
    );

  get diagnostics v_qtd = row_count;
  raise notice 'Produtos atualizados: %', v_qtd;
end $$;

-- Confere o resultado.
select codigo, nome, foto_url, desenho_url
from produtos
where organizacao_id = (select id from organizacoes where eh_catalogo_central);
