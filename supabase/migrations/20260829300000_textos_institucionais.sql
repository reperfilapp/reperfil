-- Textos institucionais da tela "Sobre" ("O RePerfil" e "Nossa equipe
-- técnica") ganham um lápis de editar — só para o administrador da
-- organização CENTRAL, não qualquer administrador.
--
-- ── POR QUE UMA TABELA NOVA, E NÃO UMA COLUNA EM `configuracoes_aplicacao` ──
--
-- `configuracoes_aplicacao` é UMA LINHA POR ORGANIZAÇÃO — cada empresa tem
-- a própria (é onde mora até o logo do desenvolvedor, hoje). Os textos
-- institucionais são o oposto: um texto SÓ, o mesmo para toda organização
-- que abre a tela "Sobre", e só a central pode mudá-lo. Encaixar isso numa
-- tabela por-organização exigiria ou duplicar o texto em toda linha (e
-- sincronizar manualmente), ou uma regra de leitura que ignora a própria
-- organização para ler sempre a da central — mais confuso do que uma
-- tabela de registro único (singleton) dedicada.
--
-- ── FORMATO DO TEXTO ──────────────────────────────────────────────────────
--
-- Texto solto, um parágrafo por linha (`\n` separa parágrafos) — o mesmo
-- que a tela já mostrava em `<p>`s soltos, só que editável.

create table textos_institucionais (
  id uuid primary key default gen_random_uuid(),
  texto_sobre_app text not null,
  texto_equipe_tecnica text not null,
  atualizado_em timestamptz not null default now()
);

comment on table textos_institucionais is
  'Textos da tela "Sobre" — registro único (singleton), comum a toda
   organização. Só a organização central edita; as demais só leem.';

insert into textos_institucionais (texto_sobre_app, texto_equipe_tecnica)
values (
  E'Somos uma empresa de desenvolvimento de software localizada em Rio Verde, GO. O RePerfil nasceu para resolver um problema concreto de oficina: sobra de perfil de alumínio que não volta a ser usada porque ninguém sabe onde ela está, ou de que tamanho é.\nO aplicativo controla essas sobras e permite reaproveitá-las de verdade em novos cortes — além de controlar o estoque de material novo, seja perfil ou acessório (dobradiça, roldana, puxador e afins).\nTem uma necessidade específica que o RePerfil ainda não atende? Fale com a gente pelo e-mail ou WhatsApp acima — vamos avaliar a possibilidade de atender sua demanda.',
  E'Nossa equipe é formada por profissionais com ampla experiência em serralheria de alumínio — somos proprietários de uma empresa de esquadrias e vidros temperados, especializada em montagens de todo tipo de esquadria de alumínio, ACM e projetos com vidro temperado. O RePerfil é feito por quem também trabalha no depósito.'
);

create trigger trg_textos_institucionais_atualizado_em
  before update on textos_institucionais
  for each row execute function tocar_atualizado_em();

alter table textos_institucionais enable row level security;

-- Qualquer pessoa logada lê — é o texto que a tela "Sobre" mostra para
-- todo mundo, não um dado sensível de nenhuma organização.
create policy "qualquer autenticado le os textos institucionais"
  on textos_institucionais for select
  using (auth.uid() is not null);

-- Só edita quem é administrador da organização marcada como catálogo
-- central — as demais organizações só leem, mesmo sendo administradoras
-- na própria empresa.
create policy "só administrador da organização central edita"
  on textos_institucionais for update
  using (
    organizacao_atual() = organizacao_catalogo_central()
    and papel_atual() = 'administrador'
  )
  with check (
    organizacao_atual() = organizacao_catalogo_central()
    and papel_atual() = 'administrador'
  );
