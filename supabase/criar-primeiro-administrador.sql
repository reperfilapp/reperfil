-- =============================================================================
-- RePerfil — Criar o primeiro administrador
-- =============================================================================
--
-- O cadastro público está desabilitado, então o primeiro usuário precisa ser
-- criado à mão. Depois disso, ele convida os demais pelo próprio sistema.
--
-- ── ANTES de rodar este script ───────────────────────────────────────────
--
--  1. No painel do Supabase, vá em Authentication → Users → Add user →
--     "Create new user".
--  2. Informe e-mail e senha, e MARQUE "Auto Confirm User" (sem isso o
--     usuário fica pendente de confirmação e não consegue entrar).
--  3. Volte aqui, ajuste as três variáveis abaixo e execute no SQL Editor.
--
-- Rodar de novo com o mesmo e-mail não duplica nada: apenas atualiza.
-- =============================================================================

do $$
declare
  -- ─────────── AJUSTE ESTAS TRÊS LINHAS ───────────
  v_email            text := 'reperfilapp@gmail.com';
  v_nome             text := 'Administrador';
  v_nome_empresa     text := 'Minha Serralheria';
  -- ────────────────────────────────────────────────

  v_user_id uuid;
  v_org_id uuid;
begin
  select id into v_user_id from auth.users where email = lower(trim(v_email));

  if v_user_id is null then
    raise exception
      'Não existe usuário com o e-mail %. Crie-o primeiro em Authentication → Users → Add user, marcando "Auto Confirm User".',
      v_email;
  end if;

  -- Reaproveita a organização se o script já rodou antes.
  select organizacao_id into v_org_id
  from perfis_usuario where id = v_user_id;

  if v_org_id is null then
    insert into organizacoes (codigo, nome_fantasia)
    values ('ORG-' || gerar_sufixo_codigo(4), v_nome_empresa)
    returning id into v_org_id;

    -- Configurações de cálculo com os valores presumidos. O administrador
    -- ainda precisa confirmar a espessura real da serra antes do primeiro
    -- cálculo em produção — por isso `confirmado_pelo_administrador` fica
    -- falso.
    insert into configuracoes_aplicacao (organizacao_id) values (v_org_id);
  end if;

  insert into perfis_usuario (id, organizacao_id, nome, email, papel, ativo)
  values (v_user_id, v_org_id, v_nome, lower(trim(v_email)), 'administrador', true)
  on conflict (id) do update
    set papel = 'administrador',
        ativo = true,
        nome = excluded.nome;

  raise notice 'Administrador % vinculado à organização %.', v_email, v_org_id;
end $$;

-- Confirma o que foi criado.
select
  p.nome,
  p.email,
  p.papel,
  p.ativo,
  o.nome_fantasia as empresa,
  o.codigo as codigo_empresa
from perfis_usuario p
join organizacoes o on o.id = p.organizacao_id
order by p.criado_em desc;
