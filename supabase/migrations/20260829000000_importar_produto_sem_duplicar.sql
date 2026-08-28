-- "Importar do catálogo central" quebrava com
-- "duplicate key value violates unique constraint codigo_unico_por_organizacao".
--
-- ── A CAUSA, QUE JÁ CONHECÍAMOS ──────────────────────────────────────────
--
-- É o mesmo caso dos perfis (ver 20260827500000): o catálogo central nasceu
-- de uma cópia FEITA A PARTIR da Alumifort. O vínculo de origem ficou
-- marcado só do lado de quem RECEBEU a cópia — os produtos originais da
-- própria Alumifort continuaram sem apontar para ninguém, porque, quando
-- foram criados, o central nem existia.
--
-- A importação considera "produto novo" todo produto do central sem cópia
-- local vinculada. Sem o vínculo, a Alumifort via como novo um produto que
-- ela mesma já tinha, tentava inserir com o MESMO código, e o índice único
-- derrubava a função inteira — uma exceção não tratada desfaz a transação
-- toda, então nem os produtos seguintes entravam.
--
-- ── A CORREÇÃO: ADOTAR, EM VEZ DE PULAR ──────────────────────────────────
--
-- Nos perfis a saída foi PULAR o código repetido. Aqui o produto repetido é
-- ADOTADO: ganha o vínculo de origem e passa a ser a cópia local daquele
-- produto do central. Pular deixaria a empresa para sempre sem receber
-- atualização de um produto que ela tem — que é exatamente a queixa que
-- originou esta funcionalidade.
--
-- Adotar REESCREVE a lista técnica local pela do central, como já acontece
-- em toda reimportação. Por isso os adotados são contados à parte: a tela
-- avisa quantas receitas foram substituídas, em vez de trocá-las em
-- silêncio.
--
-- Produto local que já aponta para OUTRO produto do central não é adotado —
-- aí o código repetido é coincidência de verdade, e escolher por conta
-- própria qual dos dois vence seria pior do que deixar de fora.

-- `create or replace` NÃO muda o tipo de retorno de uma função que já
-- existe — as colunas de saída fazem parte da assinatura, e o Postgres
-- recusa com "cannot change return type of existing function". Como esta
-- ganhou duas colunas novas (`produtos_vinculados` e `produtos_em_conflito`),
-- a versão anterior precisa cair antes. Mesmo tropeço de quando
-- `sincronizar_catalogo_central` ganhou o parâmetro de linha.
drop function if exists sincronizar_produtos_central();

create function sincronizar_produtos_central()
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
      -- Antes de inserir: já existe aqui um produto com este código, ainda
      -- sem dono? Então é ele — adota em vez de duplicar.
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
        -- Código repetido apontando para outro produto do central: deixa
        -- de fora e conta, em vez de escolher um vencedor sozinho.
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
          -- Fecha o vínculo do adotado. Nos já vinculados é uma
          -- reatribuição do mesmo valor, inofensiva.
          origem_produto_id = v_central.id
      where id = v_local_id;

      if v_adotado_id is null then
        v_atualizados := v_atualizados + 1;
      end if;
    end if;

    v_adotado_id := null;

    -- A receita é REESCRITA, não mesclada: mesclar deixaria itens de uma
    -- versão anterior convivendo com os novos, e uma lista técnica com
    -- corte a mais é peça a mais na serra.
    delete from itens_lista_tecnica where produto_id = v_local_id;

    insert into itens_lista_tecnica (
      organizacao_id, produto_id, modelo_perfil_id,
      comprimento_mm, quantidade, ordem,
      sentido, corte_inicio, corte_fim, observacao
    )
    select
      v_organizacao_id, v_local_id, meu.id,
      i.comprimento_mm, i.quantidade, i.ordem,
      i.sentido, i.corte_inicio, i.corte_fim, i.observacao
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
