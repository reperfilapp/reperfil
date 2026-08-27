-- Encerrar uma empresa: o pedido e a execução.
--
-- ── POR QUE ISTO EXISTE ──────────────────────────────────────────────────
--
-- Empresa criada por engano, ou usada por um mês e abandonada, ficava para
-- sempre ocupando o banco — com catálogo, estoque, colaboradores e fotos
-- que ninguém mais vai abrir. Pior: os e-mails de login continuavam
-- ocupados, e quem quisesse recomeçar do zero com o mesmo endereço não
-- conseguia.
--
-- ── QUEM PODE, E POR QUÊ NÃO É QUEM VOCÊ PENSA ───────────────────────────
--
-- O administrador da empresa PEDE; quem EXECUTA é a organização central.
--
-- A tentação era deixar o próprio administrador apagar direto, e seria
-- menos código. Mas apagar uma empresa é irreversível e não tem backup
-- dentro do aplicativo: um administrador irritado, ou enganado por alguém
-- que conseguiu a senha dele, encerraria anos de cadastro num toque, e não
-- haveria a quem recorrer. Passar pela central custa um dia de espera e
-- transforma "acabou" em "quase acabou".
--
-- O pedido pode ser cancelado enquanto a central não executou — que é a
-- única janela de arrependimento que existe.

alter table organizacoes
  add column if not exists exclusao_solicitada_em timestamptz,
  add column if not exists exclusao_solicitada_por uuid
    references perfis_usuario (id) on delete set null,
  add column if not exists exclusao_motivo text;

comment on column organizacoes.exclusao_solicitada_em is
  'Quando o administrador pediu para encerrar. Nulo = sem pedido em aberto.
   Pedir NÃO apaga nada: só a organização central executa.';

-- -----------------------------------------------------------------------------
-- O pedido (administrador da própria empresa)
-- -----------------------------------------------------------------------------
create or replace function solicitar_exclusao_organizacao(p_motivo text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid := organizacao_atual();
begin
  if v_organizacao_id is null then
    raise exception 'Usuário sem organização ativa.'
      using errcode = 'insufficient_privilege';
  end if;

  if not e_administrador() then
    raise exception 'Apenas o administrador pode pedir o encerramento da empresa.'
      using errcode = 'insufficient_privilege';
  end if;

  -- A central não pode pedir o próprio encerramento: ela é quem executa, e
  -- sem ela o catálogo compartilhado some para todas as outras empresas.
  if v_organizacao_id = organizacao_catalogo_central() then
    raise exception
      'Esta é a organização do catálogo central — encerrá-la deixaria todas as demais empresas sem catálogo.'
      using errcode = 'check_violation';
  end if;

  if p_motivo is null or length(trim(p_motivo)) < 10 then
    raise exception
      'Diga por que está encerrando (pelo menos 10 letras).'
      using errcode = 'check_violation';
  end if;

  update organizacoes
  set exclusao_solicitada_em = now(),
      exclusao_solicitada_por = auth.uid(),
      exclusao_motivo = trim(p_motivo)
  where id = v_organizacao_id;
end;
$$;

grant execute on function solicitar_exclusao_organizacao(text) to authenticated;

create or replace function cancelar_exclusao_organizacao()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_organizacao_id uuid := organizacao_atual();
begin
  if not e_administrador() then
    raise exception 'Apenas o administrador pode desistir do encerramento.'
      using errcode = 'insufficient_privilege';
  end if;

  update organizacoes
  set exclusao_solicitada_em = null,
      exclusao_solicitada_por = null,
      exclusao_motivo = null
  where id = v_organizacao_id;
end;
$$;

grant execute on function cancelar_exclusao_organizacao() to authenticated;

-- -----------------------------------------------------------------------------
-- O que a Edge Function precisa saber ANTES de apagar
-- -----------------------------------------------------------------------------
-- Apagar as linhas do banco não apaga os arquivos no Storage nem as contas
-- em `auth.users` — nenhum dos dois é alcançável por SQL comum. Esta
-- função entrega os dois antes da exclusão, para a Edge Function limpar
-- depois com a chave de serviço.
create or replace function dados_para_excluir_organizacao(p_organizacao_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_resultado jsonb;
begin
  if organizacao_atual() <> organizacao_catalogo_central() or not e_administrador() then
    raise exception 'Apenas o administrador do catálogo central pode encerrar uma empresa.'
      using errcode = 'insufficient_privilege';
  end if;

  select jsonb_build_object(
    'nome_fantasia', o.nome_fantasia,
    'usuarios', coalesce(
      (select jsonb_agg(p.id) from perfis_usuario p where p.organizacao_id = o.id),
      '[]'::jsonb
    ),
    'contagens', jsonb_build_object(
      'colaboradores', (select count(*) from perfis_usuario where organizacao_id = o.id),
      'perfis', (select count(*) from modelos_perfil where organizacao_id = o.id),
      'sobras', (select count(*) from lotes_sobras where organizacao_id = o.id),
      'produtos', (select count(*) from produtos where organizacao_id = o.id),
      'acessorios', (select count(*) from lotes_acessorio where organizacao_id = o.id),
      'clientes', (select count(*) from clientes where organizacao_id = o.id)
    )
  )
  into v_resultado
  from organizacoes o
  where o.id = p_organizacao_id;

  if v_resultado is null then
    raise exception 'Empresa não encontrada.' using errcode = 'no_data_found';
  end if;

  return v_resultado;
end;
$$;

grant execute on function dados_para_excluir_organizacao(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- A execução (organização central)
-- -----------------------------------------------------------------------------
-- ── POR QUE APAGAR NA MÃO, SE QUASE TUDO É `on delete cascade` ───────────
--
-- Porque o cascade sozinho NÃO funciona aqui, por dois motivos:
--
-- 1. `perfis_usuario.organizacao_id` é `on delete restrict` — de
--    propósito, para ninguém apagar uma empresa com gente dentro por
--    acidente. `delete from organizacoes` falha enquanto houver um
--    colaborador sequer.
--
-- 2. Várias tabelas se referenciam entre si com `restrict` ou sem regra
--    nenhuma (`criado_por uuid references perfis_usuario`, que é NO ACTION
--    e se comporta como restrict). O cascade da organização apagaria
--    `modelos_perfil` e `lotes_sobras` sem ordem garantida — e
--    `lotes_sobras → modelos_perfil` é restrict. Dependendo da ordem que o
--    Postgres escolher, a exclusão inteira falha no meio.
--
-- Por isso a ordem abaixo é explícita, das folhas para a raiz. Ela não é
-- decorativa: trocar duas linhas de lugar quebra a função.
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

  -- A central não se apaga. Sem ela, toda empresa que copiou o catálogo
  -- perde a origem dos perfis e nenhuma consegue mais sincronizar.
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

  -- ── Movimentações e histórico (apontam para lotes e para pessoas) ──
  delete from movimentacoes_acessorio where organizacao_id = p_organizacao_id;
  delete from movimentacoes_estoque where organizacao_id = p_organizacao_id;
  delete from reservas where organizacao_id = p_organizacao_id;

  -- ── Inventário (itens apontam para lotes; sessões, para pessoas) ──
  delete from itens_inventario where organizacao_id = p_organizacao_id;
  delete from sessoes_inventario where organizacao_id = p_organizacao_id;

  -- ── Receitas (apontam para produtos E para modelos_perfil) ──
  delete from itens_lista_tecnica where organizacao_id = p_organizacao_id;

  -- ── Estoque físico (aponta para modelos e acabamentos) ──
  delete from lotes_sobras where organizacao_id = p_organizacao_id;
  delete from lotes_acessorio where organizacao_id = p_organizacao_id;

  -- ── Imagens e catálogo ──
  delete from arquivos_vetoriais where organizacao_id = p_organizacao_id;
  delete from produtos where organizacao_id = p_organizacao_id;

  -- Perfil desta empresa pode ser a ORIGEM de cópias em outras empresas.
  -- `origem_perfil_id` é `on delete set null`, então a cópia sobrevive —
  -- só perde o vínculo com a origem, que é o comportamento certo: o
  -- perfil copiado continua sendo da outra empresa.
  delete from modelos_perfil where organizacao_id = p_organizacao_id;
  delete from modelos_acessorio where organizacao_id = p_organizacao_id;

  delete from compatibilidades_acabamento where organizacao_id = p_organizacao_id;
  delete from acabamentos where organizacao_id = p_organizacao_id;
  delete from localizacoes where organizacao_id = p_organizacao_id;
  delete from clientes where organizacao_id = p_organizacao_id;

  -- ── Registros administrativos ──
  delete from registros_auditoria where organizacao_id = p_organizacao_id;
  delete from acessos_sistema where organizacao_id = p_organizacao_id;
  delete from convites_colaborador where organizacao_id = p_organizacao_id;
  delete from configuracoes_aplicacao where organizacao_id = p_organizacao_id;
  delete from linhas_liberadas_organizacao where organizacao_id = p_organizacao_id;

  -- ── As pessoas, e por fim a empresa ──
  -- Só agora: tudo que tinha `criado_por` apontando para elas já se foi.
  delete from perfis_usuario where organizacao_id = p_organizacao_id;
  delete from organizacoes where id = p_organizacao_id;

  return jsonb_build_object('ok', true, 'nome_fantasia', v_nome);
end;
$$;

comment on function excluir_organizacao is
  'Apaga uma empresa e TODOS os seus registros, sem volta. Só a organização
   central executa. Não alcança Storage nem auth.users — a Edge Function
   `excluir-empresa` cuida dessas duas partes.';

grant execute on function excluir_organizacao(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- A central precisa ver quem pediu para sair
-- -----------------------------------------------------------------------------
create or replace function empresas_para_central()
returns table (
  organizacao_id uuid,
  nome_fantasia text,
  criado_em timestamptz,
  colaboradores bigint,
  exclusao_solicitada_em timestamptz,
  exclusao_motivo text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if organizacao_atual() <> organizacao_catalogo_central() or not e_administrador() then
    raise exception 'Apenas o administrador do catálogo central vê esta lista.'
      using errcode = 'insufficient_privilege';
  end if;

  return query
    select
      o.id,
      o.nome_fantasia,
      o.criado_em,
      (select count(*) from perfis_usuario p where p.organizacao_id = o.id),
      o.exclusao_solicitada_em,
      o.exclusao_motivo
    from organizacoes o
    where o.id <> organizacao_catalogo_central()
    -- Quem pediu para sair primeiro: é a lista de trabalho da central.
    order by o.exclusao_solicitada_em desc nulls last, o.nome_fantasia;
end;
$$;

grant execute on function empresas_para_central() to authenticated;
