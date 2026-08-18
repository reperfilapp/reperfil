-- Registro de acessos, para o administrador saber quem está usando.
--
-- ── POR QUE UMA TABELA, SE O SUPABASE JÁ GUARDA ISSO ─────────────────────
--
-- `auth.users` tem `last_sign_in_at`, mas só o ÚLTIMO: não responde "ele
-- entrou esta semana?" nem "ele entrou alguma vez desde que foi
-- contratado?". E o registro de auditoria do Supabase não é acessível pela
-- API do aplicativo — só pelo painel, por quem tem acesso ao projeto, que é
-- justamente o que se quer evitar exigir do dono da serralheria.
--
-- ── O QUE NÃO É GUARDADO ─────────────────────────────────────────────────
--
-- Só a data e a hora. Nada de endereço IP, aparelho ou localização: a
-- pergunta que o administrador tem é "esta pessoa ainda usa o sistema?", e
-- para responder isso basta o instante. Guardar mais seria vigiar
-- funcionário, o que não é a função deste sistema.

create table if not exists acessos_sistema (
  id uuid primary key default gen_random_uuid(),
  organizacao_id uuid not null references organizacoes (id) on delete cascade,
  usuario_id uuid not null references perfis_usuario (id) on delete cascade,
  criado_em timestamptz not null default now()
);

-- A consulta é sempre "os últimos acessos desta pessoa", em ordem de tempo.
create index if not exists idx_acessos_usuario
  on acessos_sistema (usuario_id, criado_em desc);

comment on table acessos_sistema is
  'Data e hora de cada entrada no sistema. Só isso — ver o cabeçalho da
   migração 20260818120000 sobre o que deliberadamente não é guardado.';

alter table acessos_sistema enable row level security;

-- Cada um registra o PRÓPRIO acesso, e só o próprio: a linha é gravada pelo
-- aplicativo logo depois de entrar, então quem grava é a pessoa que entrou.
create policy "registrar o próprio acesso"
  on acessos_sistema for insert
  to authenticated
  with check (
    organizacao_id = organizacao_atual() and usuario_id = auth.uid()
  );

-- Ver o próprio histórico é direito de quem entrou; ver o dos colegas exige
-- a permissão de gerenciar colaboradores, que é onde a informação serve.
create policy "ver os próprios acessos ou, podendo, os de qualquer colega"
  on acessos_sistema for select
  to authenticated
  using (
    organizacao_id = organizacao_atual()
    and (usuario_id = auth.uid() or pode_gerenciar_colaboradores())
  );
