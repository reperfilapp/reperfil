-- =============================================================================
-- RePerfil — Busca visual: foto pesa mais que desenho técnico no ranking
-- =============================================================================
--
-- Teste real (ALUMIFORT, 31/08/2026): o perfil certo (SU-049) só tinha
-- desenho técnico cadastrado, não foto — porque veio por sincronização do
-- catálogo central, que raramente tem fotos reais. A busca comparou a foto
-- tirada contra traços de linha de vários perfis, e as pontuações saíram
-- todas espremidas entre 52-53%, sem separar o candidato certo dos errados
-- — sintoma de comparar domínios visuais diferentes (foto real vs. desenho
-- técnico), exatamente o risco já previsto no plano original.
--
-- Não dá para consertar a comparação foto-com-desenho em si (é uma
-- limitação do próprio modelo). O que dá para fazer: quando um perfil tem
-- FOTO cadastrada, ela é uma comparação mais confiável (mesmo domínio
-- visual da busca) e deve ganhar de um desenho técnico — tanto na escolha
-- de qual arquivo representa o perfil quanto na pontuação final.
-- =============================================================================

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
  select modelo_perfil_id, parecenca
  from (
    select
      candidatos.modelo_perfil_id,
      -- Desconto de 8% quando o melhor arquivo do perfil é desenho
      -- técnico, não foto — evita que ele empate ou passe à frente de uma
      -- foto de verdade só por uma distância de cosseno um pouco menor.
      case
        when candidatos.tipo = 'foto' then candidatos.parecenca_bruta
        else candidatos.parecenca_bruta * 0.92
      end as parecenca
    from (
      select
        av.modelo_perfil_id,
        av.tipo,
        (1 - (av.embedding <=> p_embedding))::numeric as parecenca_bruta,
        row_number() over (
          partition by av.modelo_perfil_id
          -- Entre os arquivos do MESMO perfil, uma foto qualquer vale mais
          -- que o desenho técnico, mesmo que o desenho tenha ficado
          -- numericamente mais próximo — mesma razão do desconto acima.
          order by (av.tipo = 'foto') desc, av.embedding <=> p_embedding
        ) as posicao_no_perfil
      from arquivos_vetoriais av
      where av.organizacao_id = organizacao_atual()
        and av.modelo_perfil_id is not null
        and av.embedding is not null
    ) candidatos
    where candidatos.posicao_no_perfil = 1
  ) resultado
  order by parecenca desc
  limit p_limite
$$;

comment on function perfis_mais_parecidos is
  'Perfis da organização atual mais parecidos visualmente com o vetor dado
   (embedding de uma foto tirada), por distância de cosseno — foto e desenho
   técnico entram juntos na comparação, mas foto tem prioridade: é o mesmo
   domínio visual da busca, então ganha do desenho técnico na escolha do
   arquivo representante e leva uma pontuação 8% maior quando os dois
   existem para o mesmo perfil. Um resultado por perfil. Chamada pela Edge
   Function identificar-perfil-por-foto.';
