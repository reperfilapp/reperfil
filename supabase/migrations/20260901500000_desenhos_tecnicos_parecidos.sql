-- =============================================================================
-- RePerfil — Afinar a busca visual comparando desenho técnico com desenho
-- técnico, não só foto com catálogo
-- =============================================================================
--
-- `perfis_mais_parecidos` (migração `20260831100000_busca_visual_por_foto.sql`)
-- compara a FOTO tirada com o catálogo inteiro — domínios visuais
-- diferentes (foto real vs. desenho técnico), por isso a pontuação fica
-- espremida quando o perfil certo só tem desenho cadastrado.
--
-- Esta função é outra comparação: DESENHO TÉCNICO contra DESENHO TÉCNICO,
-- os dois do mesmo domínio visual — por isso mais confiável para decidir
-- "estes dois perfis são visualmente parecidos de verdade". Usada em
-- `IdentificarPerfil.tsx` só quando a busca por foto já achou um perfil
-- com confiança alta (≥95%): os demais candidatos da tela têm o PRÓPRIO
-- desenho técnico comparado com o desse perfil de maior confiança, e só
-- quem passar de 90% de semelhança continua na lista — é o desenho
-- decidindo se um candidato duvidoso fica ou sai, não mais a comparação
-- foto-com-desenho que gerou a pontuação inicial.
-- =============================================================================

create or replace function desenhos_tecnicos_parecidos(
  p_modelo_perfil_id uuid,
  p_ids uuid[]
)
returns table (modelo_perfil_id uuid, parecenca numeric)
language sql
stable
security definer
set search_path = public
as $$
  with referencia as (
    select av.embedding
    from arquivos_vetoriais av
    where av.modelo_perfil_id = p_modelo_perfil_id
      and av.organizacao_id = organizacao_atual()
      and av.tipo = 'imagem'
      and av.embedding is not null
    order by av.ordem
    limit 1
  ),
  candidatos as (
    select
      av.modelo_perfil_id,
      (1 - (av.embedding <=> referencia.embedding))::numeric as parecenca,
      -- Um perfil pode ter mais de um desenho técnico — fica só o mais
      -- parecido de cada um, mesmo raciocínio de `perfis_mais_parecidos`.
      row_number() over (
        partition by av.modelo_perfil_id
        order by av.embedding <=> referencia.embedding
      ) as posicao
    from arquivos_vetoriais av
    cross join referencia
    where av.organizacao_id = organizacao_atual()
      and av.modelo_perfil_id = any(p_ids)
      and av.tipo = 'imagem'
      and av.embedding is not null
  )
  -- Sem `referencia` (o perfil-âncora não tem desenho técnico cadastrado),
  -- o `cross join` já devolve zero linhas — não filtra nada por engano.
  select modelo_perfil_id, parecenca
  from candidatos
  where posicao = 1
$$;

comment on function desenhos_tecnicos_parecidos is
  'Compara o desenho técnico de UM perfil de referência com o desenho
   técnico de outros perfis (distância de cosseno). Usado para afinar a
   busca visual depois que a foto já achou um perfil com confiança alta —
   perfil sem desenho técnico cadastrado não entra no resultado, porque
   não tem o que comparar. Chamada por `useCompararDesenhosTecnicos`
   (src/dados/identificacaoPorFoto.ts).';

grant execute on function desenhos_tecnicos_parecidos(uuid, uuid[]) to authenticated;
