-- Acessórios na lista técnica do produto.
--
-- ── O QUE ISTO RESPONDE ──────────────────────────────────────────────────
--
-- A lista técnica de um produto só sabia registrar cortes de perfil
-- (`itens_lista_tecnica`). Não existia como dizer "esta janela leva 4
-- dobradiças e 2 puxadores" — o catálogo de acessórios (`modelos_acessorio`)
-- nunca foi ligado a um produto.
--
-- A tabela nova é bem mais simples que `itens_lista_tecnica`: acessório não
-- é cortado, então não há comprimento, sentido, corte nem grupos de corte —
-- só o acessório e quantas peças dele entram em UMA unidade do produto.

create table if not exists itens_lista_tecnica_acessorio (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null default organizacao_atual()
    references organizacoes (id) on delete cascade,
  produto_id uuid not null references produtos (id) on delete cascade,

  -- `restrict`, mesma razão do `modelo_perfil_id` em `itens_lista_tecnica`:
  -- apagar um acessório do catálogo não pode esvaziar a receita de uma
  -- janela em silêncio.
  modelo_acessorio_id uuid not null references modelos_acessorio (id) on delete restrict,

  quantidade integer not null check (quantidade > 0),

  observacao text,
  criado_em timestamptz not null default now()
);

comment on column itens_lista_tecnica_acessorio.quantidade is
  'Peças deste acessório por UMA unidade do produto.';

create index if not exists idx_lista_tecnica_acessorio_produto
  on itens_lista_tecnica_acessorio (produto_id);

-- -----------------------------------------------------------------------------
-- Segurança — mesmas 4 políticas de `itens_lista_tecnica`
-- -----------------------------------------------------------------------------
alter table itens_lista_tecnica_acessorio enable row level security;

create policy "ver lista técnica de acessório da organização"
  on itens_lista_tecnica_acessorio for select
  to authenticated
  using (organizacao_id = organizacao_atual());

create policy "quem gerencia cadastros monta a lista técnica de acessório"
  on itens_lista_tecnica_acessorio for insert
  to authenticated
  with check (organizacao_id = organizacao_atual() and pode_gerenciar_cadastros());

create policy "quem gerencia cadastros edita a lista técnica de acessório"
  on itens_lista_tecnica_acessorio for update
  to authenticated
  using (organizacao_id = organizacao_atual() and pode_gerenciar_cadastros())
  with check (organizacao_id = organizacao_atual());

create policy "quem gerencia cadastros remove item da lista técnica de acessório"
  on itens_lista_tecnica_acessorio for delete
  to authenticated
  using (organizacao_id = organizacao_atual() and pode_gerenciar_cadastros());

-- -----------------------------------------------------------------------------
-- `sincronizar_produtos_central` passa a copiar também a receita de
-- acessório, do mesmo jeito que já copia a de perfil: apaga a local e
-- reinsere a partir do central, casando pelo vínculo de origem
-- (`origem_acessorio_id`, a mesma coluna que `sincronizar_acessorios_central`
-- já usa). `itens_sem_acessorio` conta os que ficaram de fora por a empresa
-- ainda não ter aquele acessório importado — mesmo papel de
-- `itens_sem_perfil`.
--
-- `create or replace` NÃO muda o tipo de retorno de uma função que já
-- existe — como esta ganha uma coluna nova (`itens_sem_acessorio`), a
-- versão anterior precisa cair antes. Mesmo tropeço de sempre nesta função
-- (ver `20260829000000` e `20260901300000`, as duas vezes anteriores em que
-- ela ganhou colunas).
-- -----------------------------------------------------------------------------
drop function if exists sincronizar_produtos_central(uuid);

create function sincronizar_produtos_central(p_organizacao_id uuid default null)
returns table (
  produtos_novos integer,
  produtos_atualizados integer,
  produtos_vinculados integer,
  produtos_em_conflito integer,
  itens_sem_perfil integer,
  itens_sem_acessorio integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid := coalesce(p_organizacao_id, organizacao_atual());
  v_central_id uuid := organizacao_catalogo_central();
  v_central record;
  v_local_id uuid;
  v_adotado_id uuid;
  v_novos integer := 0;
  v_atualizados integer := 0;
  v_vinculados integer := 0;
  v_conflitos integer := 0;
  v_sem_perfil integer := 0;
  v_sem_acessorio integer := 0;
  v_faltaram integer;
begin
  if v_organizacao_id is null then
    raise exception 'Sessão inválida.' using errcode = 'insufficient_privilege';
  end if;

  if p_organizacao_id is not null and p_organizacao_id <> organizacao_atual() then
    if organizacao_atual() <> organizacao_catalogo_central() or not e_administrador() then
      raise exception 'Apenas o administrador do catálogo central pode sincronizar por outra empresa.'
        using errcode = 'insufficient_privilege';
    end if;
  elsif not pode_gerenciar_cadastros() then
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
      sentido, corte_inicio, corte_fim, grupos_de_corte, observacao
    )
    select
      v_organizacao_id, v_local_id, meu.id,
      i.comprimento_mm, i.quantidade, i.ordem,
      i.sentido, i.corte_inicio, i.corte_fim, i.grupos_de_corte, i.observacao
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

    -- A mesma reescrita, agora para acessório.
    delete from itens_lista_tecnica_acessorio where produto_id = v_local_id;

    insert into itens_lista_tecnica_acessorio (
      organizacao_id, produto_id, modelo_acessorio_id, quantidade, observacao
    )
    select
      v_organizacao_id, v_local_id, mea.id,
      ia.quantidade, ia.observacao
    from itens_lista_tecnica_acessorio ia
    join modelos_acessorio mea
      on mea.organizacao_id = v_organizacao_id
     and mea.origem_acessorio_id = ia.modelo_acessorio_id
    where ia.produto_id = v_central.id;

    select count(*) into v_faltaram
    from itens_lista_tecnica_acessorio ia
    where ia.produto_id = v_central.id
      and not exists (
        select 1 from modelos_acessorio mea
        where mea.organizacao_id = v_organizacao_id
          and mea.origem_acessorio_id = ia.modelo_acessorio_id
      );

    v_sem_acessorio := v_sem_acessorio + coalesce(v_faltaram, 0);
  end loop;

  return query
    select v_novos, v_atualizados, v_vinculados, v_conflitos, v_sem_perfil, v_sem_acessorio;
end;
$$;

grant execute on function sincronizar_produtos_central(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Encerrar uma empresa também precisa limpar a receita de acessório dela —
-- mesmo `delete` que já existe para a de perfil. A assinatura de
-- `excluir_organizacao` não muda, então aqui basta `create or replace`.
-- -----------------------------------------------------------------------------
create or replace function excluir_organizacao(p_organizacao_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_nome text;
  v_central uuid := organizacao_catalogo_central();
begin
  if organizacao_atual() <> v_central or not e_administrador() then
    raise exception 'Apenas o administrador do catálogo central pode encerrar uma empresa.'
      using errcode = 'insufficient_privilege';
  end if;

  if p_organizacao_id = v_central then
    raise exception
      'A organização do catálogo central não pode ser encerrada por aqui.'
      using errcode = 'check_violation';
  end if;

  select nome_fantasia into v_nome
  from organizacoes where id = p_organizacao_id;

  if v_nome is null then
    raise exception 'Empresa não encontrada.' using errcode = 'no_data_found';
  end if;

  delete from movimentacoes_acessorio where organizacao_id = p_organizacao_id;
  delete from movimentacoes_estoque where organizacao_id = p_organizacao_id;
  delete from reservas where organizacao_id = p_organizacao_id;

  delete from itens_inventario where organizacao_id = p_organizacao_id;
  delete from sessoes_inventario where organizacao_id = p_organizacao_id;

  -- ── Receitas (apontam para produtos E para modelos_perfil/modelos_acessorio) ──
  delete from itens_lista_tecnica where organizacao_id = p_organizacao_id;
  delete from itens_lista_tecnica_acessorio where organizacao_id = p_organizacao_id;

  delete from lotes_sobras where organizacao_id = p_organizacao_id;
  delete from lotes_acessorio where organizacao_id = p_organizacao_id;

  delete from arquivos_vetoriais where organizacao_id = p_organizacao_id;
  delete from produtos where organizacao_id = p_organizacao_id;

  delete from modelos_perfil where organizacao_id = p_organizacao_id;
  delete from modelos_acessorio where organizacao_id = p_organizacao_id;

  delete from compatibilidades_acabamento where organizacao_id = p_organizacao_id;
  delete from acabamentos where organizacao_id = p_organizacao_id;
  delete from localizacoes where organizacao_id = p_organizacao_id;
  delete from clientes where organizacao_id = p_organizacao_id;

  delete from registros_auditoria where organizacao_id = p_organizacao_id;
  delete from acessos_sistema where organizacao_id = p_organizacao_id;
  delete from convites_colaborador where organizacao_id = p_organizacao_id;
  delete from configuracoes_aplicacao where organizacao_id = p_organizacao_id;
  delete from linhas_liberadas_organizacao where organizacao_id = p_organizacao_id;

  delete from perfis_usuario where organizacao_id = p_organizacao_id;
  delete from organizacoes where id = p_organizacao_id;

  return jsonb_build_object('ok', true, 'nome_fantasia', v_nome);
end;
$$;

grant execute on function excluir_organizacao(uuid) to authenticated;
