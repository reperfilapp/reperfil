-- Sincronizar o catálogo central por LINHA, não só tudo de uma vez — e
-- deixar a organização central habilitar ou desabilitar cada linha para as
-- demais empresas (é uma decisão comercial, negociada linha a linha, não
-- do código).
--
-- ── A TABELA ─────────────────────────────────────────────────────────────
-- Uma linha por nome de linha do catálogo central. Ausência de linha aqui
-- quer dizer "disponível" — é o padrão são de não travar nada que já
-- funcionava antes desta migração existir.
create table if not exists linhas_catalogo_central (
  linha text primary key,
  disponivel boolean not null default true,
  atualizado_em timestamptz not null default now()
);

comment on table linhas_catalogo_central is
  'Uma linha por nome de linha do catálogo central. disponivel = false
   bloqueia a linha inteira de ser importada ou atualizada pelas demais
   empresas — decisão de quem administra a organização central. Ausência
   de linha aqui conta como disponível.';

alter table linhas_catalogo_central enable row level security;

drop policy if exists "ver disponibilidade das linhas" on linhas_catalogo_central;
create policy "ver disponibilidade das linhas"
  on linhas_catalogo_central for select
  to authenticated
  using (true);

drop policy if exists "central define disponibilidade das linhas" on linhas_catalogo_central;
create policy "central define disponibilidade das linhas"
  on linhas_catalogo_central for insert
  to authenticated
  with check (
    organizacao_atual() = organizacao_catalogo_central() and pode_gerenciar_cadastros()
  );

drop policy if exists "central atualiza disponibilidade das linhas" on linhas_catalogo_central;
create policy "central atualiza disponibilidade das linhas"
  on linhas_catalogo_central for update
  to authenticated
  using (
    organizacao_atual() = organizacao_catalogo_central() and pode_gerenciar_cadastros()
  );

-- ── LIGAR/DESLIGAR UMA LINHA ────────────────────────────────────────────
-- Upsert simples: cria a linha na tabela na primeira vez que alguém mexe
-- nela (fica implícito que, antes disso, estava disponível).
create or replace function definir_disponibilidade_linha(p_linha text, p_disponivel boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if organizacao_atual() <> organizacao_catalogo_central() or not pode_gerenciar_cadastros() then
    raise exception 'Só quem administra o catálogo central pode habilitar ou desabilitar uma linha.'
      using errcode = 'insufficient_privilege';
  end if;

  insert into linhas_catalogo_central (linha, disponivel, atualizado_em)
  values (p_linha, p_disponivel, now())
  on conflict (linha) do update
    set disponivel = excluded.disponivel,
        atualizado_em = excluded.atualizado_em;
end;
$$;

grant execute on function definir_disponibilidade_linha(text, boolean) to authenticated;

-- ── LISTAR AS LINHAS DO CENTRAL ──────────────────────────────────────────
-- Alimenta o seletor de "sincronizar esta linha" nas demais empresas —
-- inclusive linhas que elas ainda não copiaram nenhum perfil, então o
-- seletor também serve para IMPORTAR uma linha inteira, não só atualizar
-- uma que já existe localmente. `security definer` porque lista perfis da
-- organização central, que uma empresa comum não lê direto linha a linha.
create or replace function linhas_do_catalogo_central()
returns table (linha text, disponivel boolean)
language sql
stable
security definer
set search_path = public
as $$
  select distinct
    m.linha,
    coalesce(l.disponivel, true)
  from modelos_perfil m
  left join linhas_catalogo_central l on l.linha = m.linha
  where m.organizacao_id = organizacao_catalogo_central()
    and m.ativo
    and m.linha is not null
    and trim(m.linha) <> ''
  order by 1
$$;

grant execute on function linhas_do_catalogo_central() to authenticated;

-- ── SINCRONIZAR, AGORA POR LINHA ────────────────────────────────────────
-- `p_linha` nulo mantém o comportamento de sempre (tudo de uma vez, o
-- botão "Atualização geral"). Uma linha desabilitada pela central fica de
-- fora dos dois casos (perfil novo e perfil atualizado), em QUALQUER dos
-- dois modos — geral ou de uma linha só.
--
-- `drop function` antes: a versão anterior não tinha parâmetro nenhum, e
-- `create or replace` não troca uma função por outra de assinatura
-- diferente — só sobrepõe quando os parâmetros são os mesmos. Sem o drop,
-- ficariam as DUAS versões (uma nova, uma velha), e quem chamasse sem
-- argumento continuaria caindo na antiga, sem a checagem de linha.
drop function if exists sincronizar_catalogo_central();

create or replace function sincronizar_catalogo_central(p_linha text default null)
returns table (perfis_novos integer, perfis_atualizados integer, imagens_novas integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid := organizacao_atual();
  v_central_id uuid := organizacao_catalogo_central();
  v_central record;
  v_novo_id uuid;
  v_qtd_imagens integer;
  v_perfis_novos integer := 0;
  v_perfis_atualizados integer := 0;
  v_imagens_novas integer := 0;
begin
  if v_organizacao_id is null then
    raise exception 'Sessão inválida.' using errcode = 'insufficient_privilege';
  end if;

  if not pode_gerenciar_cadastros() then
    raise exception 'Sem permissão para gerenciar cadastros.' using errcode = 'insufficient_privilege';
  end if;

  if v_central_id is null then
    raise exception 'Nenhuma organização está marcada como catálogo central.'
      using errcode = 'check_violation';
  end if;

  if v_organizacao_id = v_central_id then
    raise exception 'A própria organização central não sincroniza consigo mesma.'
      using errcode = 'check_violation';
  end if;

  -- Perfis novos: existem no central, na linha pedida (ou em qualquer
  -- linha, se `p_linha` for nulo), ainda sem cópia local — e sem NENHUM
  -- perfil local já usando o mesmo código.
  for v_central in
    select central.*
    from modelos_perfil central
    where central.organizacao_id = v_central_id
      and central.ativo
      and (p_linha is null or central.linha = p_linha)
      and coalesce(
        (select l.disponivel from linhas_catalogo_central l where l.linha = central.linha),
        true
      )
      and not exists (
        select 1
        from modelos_perfil local
        where local.organizacao_id = v_organizacao_id
          and local.origem_perfil_id = central.id
      )
      and not exists (
        select 1
        from modelos_perfil local2
        where local2.organizacao_id = v_organizacao_id
          and local2.codigo = central.codigo
      )
  loop
    insert into modelos_perfil (
      organizacao_id, codigo, descricao, fabricante, linha, categoria, aplicacao,
      largura_secao_mm, altura_secao_mm, medida_3_secao_mm, medida_4_secao_mm,
      codigo_barras, comprimento_barra_mm, peso_por_metro_g, observacoes,
      origem_perfil_id, origem_revisao_catalogo
    )
    values (
      v_organizacao_id, v_central.codigo, v_central.descricao, v_central.fabricante,
      v_central.linha, v_central.categoria, v_central.aplicacao,
      v_central.largura_secao_mm, v_central.altura_secao_mm, v_central.medida_3_secao_mm,
      v_central.medida_4_secao_mm, v_central.codigo_barras, v_central.comprimento_barra_mm,
      v_central.peso_por_metro_g, v_central.observacoes,
      v_central.id, v_central.revisao_catalogo
    )
    returning id into v_novo_id;

    -- Perfil recém-chegado: todas as imagens do central (foto e desenho)
    -- entram juntas, não há nada local ainda para conflitar.
    insert into arquivos_vetoriais (
      organizacao_id, modelo_perfil_id, tipo, arquivo_url, nome_original,
      largura_mm, altura_mm, escala, sanitizado, observacoes_tecnicas, legenda, ordem
    )
    select
      v_organizacao_id, v_novo_id, av.tipo, av.arquivo_url, av.nome_original,
      av.largura_mm, av.altura_mm, av.escala, av.sanitizado, av.observacoes_tecnicas,
      av.legenda, av.ordem
    from arquivos_vetoriais av
    where av.modelo_perfil_id = v_central.id
      and av.organizacao_id = v_central_id;

    get diagnostics v_qtd_imagens = row_count;
    v_imagens_novas := v_imagens_novas + v_qtd_imagens;
    v_perfis_novos := v_perfis_novos + 1;
  end loop;

  -- Perfis já copiados, na linha pedida (ou em qualquer linha), cuja
  -- origem central avançou de revisão.
  for v_central in
    select central.*, local.id as id_local
    from modelos_perfil local
    join modelos_perfil central on central.id = local.origem_perfil_id
    where local.organizacao_id = v_organizacao_id
      and central.organizacao_id = v_central_id
      and central.revisao_catalogo > local.origem_revisao_catalogo
      and (p_linha is null or central.linha = p_linha)
      and coalesce(
        (select l.disponivel from linhas_catalogo_central l where l.linha = central.linha),
        true
      )
  loop
    update modelos_perfil
    set descricao = v_central.descricao,
        fabricante = v_central.fabricante,
        linha = v_central.linha,
        categoria = v_central.categoria,
        aplicacao = v_central.aplicacao,
        largura_secao_mm = v_central.largura_secao_mm,
        altura_secao_mm = v_central.altura_secao_mm,
        medida_3_secao_mm = v_central.medida_3_secao_mm,
        medida_4_secao_mm = v_central.medida_4_secao_mm,
        codigo_barras = v_central.codigo_barras,
        comprimento_barra_mm = v_central.comprimento_barra_mm,
        peso_por_metro_g = v_central.peso_por_metro_g,
        observacoes = v_central.observacoes,
        origem_revisao_catalogo = v_central.revisao_catalogo
    where id = v_central.id_local;

    -- Desenho técnico PREVALECE o do central: apaga os locais e recoloca
    -- exatamente o conjunto atual de lá.
    delete from arquivos_vetoriais
    where modelo_perfil_id = v_central.id_local
      and tipo = 'imagem';

    insert into arquivos_vetoriais (
      organizacao_id, modelo_perfil_id, tipo, arquivo_url, nome_original,
      largura_mm, altura_mm, escala, sanitizado, observacoes_tecnicas, legenda, ordem
    )
    select
      v_organizacao_id, v_central.id_local, av.tipo, av.arquivo_url, av.nome_original,
      av.largura_mm, av.altura_mm, av.escala, av.sanitizado, av.observacoes_tecnicas,
      av.legenda, av.ordem
    from arquivos_vetoriais av
    where av.modelo_perfil_id = v_central.id
      and av.organizacao_id = v_central_id
      and av.tipo = 'imagem';

    get diagnostics v_qtd_imagens = row_count;
    v_imagens_novas := v_imagens_novas + v_qtd_imagens;

    -- Foto continua só acrescentando — a empresa pode ter fotografado a
    -- peça por conta própria.
    insert into arquivos_vetoriais (
      organizacao_id, modelo_perfil_id, tipo, arquivo_url, nome_original,
      largura_mm, altura_mm, escala, sanitizado, observacoes_tecnicas, legenda, ordem
    )
    select
      v_organizacao_id, v_central.id_local, av.tipo, av.arquivo_url, av.nome_original,
      av.largura_mm, av.altura_mm, av.escala, av.sanitizado, av.observacoes_tecnicas,
      av.legenda, av.ordem
    from arquivos_vetoriais av
    where av.modelo_perfil_id = v_central.id
      and av.organizacao_id = v_central_id
      and av.tipo = 'foto'
      and not exists (
        select 1
        from arquivos_vetoriais existente
        where existente.modelo_perfil_id = v_central.id_local
          and existente.arquivo_url = av.arquivo_url
      );

    get diagnostics v_qtd_imagens = row_count;
    v_imagens_novas := v_imagens_novas + v_qtd_imagens;
    v_perfis_atualizados := v_perfis_atualizados + 1;
  end loop;

  return query select v_perfis_novos, v_perfis_atualizados, v_imagens_novas;
end;
$$;

grant execute on function sincronizar_catalogo_central(text) to authenticated;
