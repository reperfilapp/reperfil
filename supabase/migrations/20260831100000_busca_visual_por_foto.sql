-- =============================================================================
-- RePerfil — Busca visual por foto ("Identificar perfil")
-- =============================================================================
--
-- Até aqui, a foto tirada em "Identificar perfil" servia só para conferência
-- manual ao lado do desenho de cada candidato — quem afunilava a lista era a
-- medida ou o peso. Esta migração prepara o banco para a foto participar de
-- verdade da busca: cada arquivo de `arquivos_vetoriais` (foto OU desenho
-- técnico) ganha um vetor (embedding) gerado por IA a partir da imagem, e
-- comparar dois vetores por distância de cosseno é o suficiente para achar
-- os perfis mais parecidos visualmente — sem precisar de IA a cada busca, só
-- para gerar o vetor da foto nova.
--
-- Todo perfil cadastrado entra na busca — com foto, com só desenho técnico,
-- ou com os dois. Perfil que só tem desenho tende a um resultado menos
-- preciso (compara foto real contra traço de linha, domínios visuais bem
-- diferentes), mas participa em vez de ficar de fora.
-- =============================================================================

create extension if not exists vector;

-- -----------------------------------------------------------------------------
-- Vetor de embedding por arquivo
-- -----------------------------------------------------------------------------
-- 1024 é uma das dimensões de saída aceitas pelo `cohere/embed-v4.0` (via
-- Vercel AI Gateway) — bom equilíbrio entre precisão e tamanho por linha.
-- Nula até o cálculo acontecer (Edge Function `calcular-embedding-perfil`,
-- disparada no upload e, para o catálogo já existente, por um script de
-- backfill rodado uma vez).
alter table arquivos_vetoriais
  add column if not exists embedding vector(1024);

comment on column arquivos_vetoriais.embedding is
  'Vetor gerado a partir da imagem (foto ou desenho técnico) pela Edge
   Function calcular-embedding-perfil, via Vercel AI Gateway
   (cohere/embed-v4.0). Nulo até ser calculado. Usado só para busca visual
   por similaridade — não para exibir nem para nenhuma outra regra.';

-- Índice para busca por vizinho mais próximo por distância de cosseno. HNSW
-- não exige treino prévio com dados (diferente do ivfflat), o que serve bem
-- a uma tabela que começa com a coluna inteira nula.
create index if not exists idx_arquivos_vetoriais_embedding
  on arquivos_vetoriais
  using hnsw (embedding vector_cosine_ops)
  where embedding is not null;

-- -----------------------------------------------------------------------------
-- Perfis mais parecidos com um vetor dado
-- -----------------------------------------------------------------------------
-- Um perfil pode ter vários arquivos com embedding (várias fotos, o desenho
-- técnico); aqui cada perfil aparece uma única vez, com o seu MELHOR
-- (mais próximo) arquivo — não faz sentido listar o mesmo perfil repetido
-- só porque tem duas fotos parecidas com a busca.
create or replace function perfis_mais_parecidos(
  p_embedding vector(1024),
  p_limite integer default 20
)
returns table (
  modelo_perfil_id uuid,
  parecenca numeric
)
language sql
stable
security definer
set search_path = public
as $$
  select candidatos.modelo_perfil_id, candidatos.parecenca
  from (
    select
      av.modelo_perfil_id,
      (1 - (av.embedding <=> p_embedding))::numeric as parecenca,
      row_number() over (
        partition by av.modelo_perfil_id
        order by av.embedding <=> p_embedding
      ) as posicao_no_perfil
    from arquivos_vetoriais av
    where av.organizacao_id = organizacao_atual()
      and av.modelo_perfil_id is not null
      and av.embedding is not null
  ) candidatos
  where candidatos.posicao_no_perfil = 1
  order by candidatos.parecenca desc
  limit p_limite
$$;

comment on function perfis_mais_parecidos is
  'Perfis da organização atual mais parecidos visualmente com o vetor dado
   (embedding de uma foto tirada), por distância de cosseno — foto e desenho
   técnico entram juntos na comparação. Um resultado por perfil, o mais
   próximo entre todos os arquivos daquele perfil. Chamada pela Edge Function
   identificar-perfil-por-foto.';

grant execute on function perfis_mais_parecidos(vector, integer) to authenticated;
