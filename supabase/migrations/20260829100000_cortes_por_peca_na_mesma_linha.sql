-- "Corte por peça" muda de mecanismo: continua UMA linha de quantidade N,
-- não N linhas de quantidade 1.
--
-- ── POR QUE ISTO MUDOU ────────────────────────────────────────────────────
--
-- A primeira versão, ao dividir os cortes de um item, trocava a linha única
-- por N linhas de quantidade 1 — cada peça virava uma linha própria da
-- lista técnica. Do lado do banco isso funcionava, mas do lado de quem lê a
-- lista na bancada não: "4 marcos, um deles diferente" virava quatro linhas
-- soltas, e a lista deixava de responder "quantas peças desse perfil eu
-- preciso?" de relance — era preciso somar linhas espalhadas.
--
-- ── A SAÍDA: UMA COLUNA JSON PARA AS EXCEÇÕES ────────────────────────────
--
-- `cortes_por_peca` guarda, quando presente, um corte PRÓPRIO por peça —
-- um array de `{sentido, corte_inicio, corte_fim}` do tamanho de
-- `quantidade`. Nula (o caso comum) significa "toda peça desta linha usa o
-- sentido e o corte das colunas de sempre" — nada muda para quem nunca usou
-- o recurso.
--
-- JSONB, e não uma tabela à parte: são no máximo algumas dezenas de peças
-- por linha, sempre lidas e escritas juntas (nunca uma peça isolada), e o
-- ciclo de vida delas é o da própria linha — apagar o item apaga as
-- exceções junto, de graça, sem precisar de `on delete cascade` numa
-- tabela nova.

alter table itens_lista_tecnica
  add column if not exists cortes_por_peca jsonb;

comment on column itens_lista_tecnica.cortes_por_peca is
  'Corte próprio por peça, quando a linha não é uniforme — array de
   {sentido, corte_inicio, corte_fim}, do tamanho de `quantidade`. Nulo (o
   comum): toda peça usa o sentido/corte_inicio/corte_fim da própria linha.';

-- Cada elemento precisa ter as mesmas três chaves, com os mesmos valores
-- válidos que corte_inicio_valido e corte_fim_valido já exigem na coluna
-- solteira — a exceção não pode aceitar o que a regra normal recusaria.
--
-- A validação mora numa FUNÇÃO, e o `check` só chama ela — não dá para
-- fazer isso com um `exists (select ... from jsonb_array_elements(...))`
-- direto no `check`: o Postgres recusa qualquer subquery ali
-- ("cannot use subquery in check constraint"), mesmo uma que não olha
-- outra tabela. Dentro de uma função, o mesmo laço é permitido.
create or replace function cortes_por_peca_e_valido(
  p_cortes jsonb,
  p_quantidade integer
)
returns boolean
language plpgsql
immutable
as $$
declare
  v_peca jsonb;
begin
  if p_cortes is null then
    return true;
  end if;

  if jsonb_typeof(p_cortes) <> 'array' then
    return false;
  end if;

  if jsonb_array_length(p_cortes) <> p_quantidade then
    return false;
  end if;

  for v_peca in select * from jsonb_array_elements(p_cortes)
  loop
    if not (
      v_peca ->> 'sentido' in ('h', 'v')
      and v_peca ->> 'corte_inicio' in ('reto', 'meia_cima', 'meia_baixo')
      and v_peca ->> 'corte_fim' in ('reto', 'meia_cima', 'meia_baixo')
    ) then
      return false;
    end if;
  end loop;

  return true;
end;
$$;

alter table itens_lista_tecnica
  drop constraint if exists cortes_por_peca_valido;

alter table itens_lista_tecnica
  add constraint cortes_por_peca_valido check (
    cortes_por_peca_e_valido(cortes_por_peca, quantidade)
  );

-- `sincronizar_produtos_central` copia linha por linha da receita central —
-- e agora precisa copiar esta coluna junto, ou toda peça dividida do
-- central chegaria uniformizada na empresa que importa. O retorno da
-- função não muda, então `create or replace` basta (sem precisar do
-- `drop function` que as colunas de saída exigiriam).
create or replace function sincronizar_produtos_central()
returns table (
  produtos_novos integer,
  produtos_atualizados integer,
  produtos_vinculados integer,
  produtos_em_conflito integer,
  itens_sem_perfil integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid := organizacao_atual();
  v_central_id uuid := organizacao_catalogo_central();
  v_central record;
  v_local_id uuid;
  v_adotado_id uuid;
  v_novos integer := 0;
  v_atualizados integer := 0;
  v_vinculados integer := 0;
  v_conflitos integer := 0;
  v_sem_perfil integer := 0;
  v_faltaram integer;
begin
  if v_organizacao_id is null then
    raise exception 'Sessão inválida.' using errcode = 'insufficient_privilege';
  end if;

  if not pode_gerenciar_cadastros() then
    raise exception 'Sem permissão para gerenciar cadastros.'
      using errcode = 'insufficient_privilege';
  end if;

  if v_central_id is null then
    raise exception 'Nenhuma organização está marcada como catálogo central.'
      using errcode = 'check_violation';
  end if;

  if v_organizacao_id = v_central_id then
    raise exception 'A organização central não importa do próprio catálogo.'
      using errcode = 'check_violation';
  end if;

  for v_central in
    select p.*
    from produtos p
    join produtos_liberados_organizacao l
      on l.produto_id = p.id and l.organizacao_id = v_organizacao_id
    where p.organizacao_id = v_central_id and p.ativo
  loop
    select id into v_local_id
    from produtos
    where organizacao_id = v_organizacao_id
      and origem_produto_id = v_central.id;

    if v_local_id is null then
      select id into v_adotado_id
      from produtos
      where organizacao_id = v_organizacao_id
        and codigo = v_central.codigo
        and origem_produto_id is null;

      if v_adotado_id is not null then
        v_local_id := v_adotado_id;
        v_vinculados := v_vinculados + 1;
      elsif exists (
        select 1 from produtos
        where organizacao_id = v_organizacao_id
          and codigo = v_central.codigo
      ) then
        v_conflitos := v_conflitos + 1;
        continue;
      end if;
    end if;

    if v_local_id is null then
      insert into produtos (
        organizacao_id, codigo, nome, descricao,
        largura_mm, altura_mm, observacoes,
        foto_url, desenho_url, origem_produto_id
      )
      values (
        v_organizacao_id, v_central.codigo, v_central.nome, v_central.descricao,
        v_central.largura_mm, v_central.altura_mm, v_central.observacoes,
        v_central.foto_url, v_central.desenho_url, v_central.id
      )
      returning id into v_local_id;

      v_novos := v_novos + 1;
    else
      update produtos
      set nome = v_central.nome,
          descricao = v_central.descricao,
          largura_mm = v_central.largura_mm,
          altura_mm = v_central.altura_mm,
          observacoes = v_central.observacoes,
          foto_url = v_central.foto_url,
          desenho_url = v_central.desenho_url,
          origem_produto_id = v_central.id
      where id = v_local_id;

      if v_adotado_id is null then
        v_atualizados := v_atualizados + 1;
      end if;
    end if;

    v_adotado_id := null;

    delete from itens_lista_tecnica where produto_id = v_local_id;

    insert into itens_lista_tecnica (
      organizacao_id, produto_id, modelo_perfil_id,
      comprimento_mm, quantidade, ordem,
      sentido, corte_inicio, corte_fim, cortes_por_peca, observacao
    )
    select
      v_organizacao_id, v_local_id, meu.id,
      i.comprimento_mm, i.quantidade, i.ordem,
      i.sentido, i.corte_inicio, i.corte_fim, i.cortes_por_peca, i.observacao
    from itens_lista_tecnica i
    join modelos_perfil meu
      on meu.organizacao_id = v_organizacao_id
     and meu.origem_perfil_id = i.modelo_perfil_id
    where i.produto_id = v_central.id;

    select count(*) into v_faltaram
    from itens_lista_tecnica i
    where i.produto_id = v_central.id
      and not exists (
        select 1 from modelos_perfil meu
        where meu.organizacao_id = v_organizacao_id
          and meu.origem_perfil_id = i.modelo_perfil_id
      );

    v_sem_perfil := v_sem_perfil + coalesce(v_faltaram, 0);
  end loop;

  return query
    select v_novos, v_atualizados, v_vinculados, v_conflitos, v_sem_perfil;
end;
$$;

grant execute on function sincronizar_produtos_central() to authenticated;
