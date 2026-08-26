-- Ordem manual das linhas, definida pelo administrador em "Linhas e
-- sistemas" (arrastando) — passa a ser a ordem PADRÃO em toda tela do
-- app que agrupa por linha (a lista de linhas em si; não mexe na ordem
-- dos perfis dentro de uma linha já aberta, que continua por conta
-- própria). Os dois botões de ordenar (nome/estoque) continuam existindo
-- só em "Linhas e sistemas", como troca TEMPORÁRIA — o estado fica só na
-- tela (`useState`), então sair e voltar restaura esta ordem.
create table if not exists linhas_ordem (
  organizacao_id uuid not null default organizacao_atual()
    references organizacoes (id) on delete cascade,
  linha text not null,
  ordem integer not null,
  atualizado_em timestamptz not null default now(),
  primary key (organizacao_id, linha)
);

comment on table linhas_ordem is
  'Ordem manual de cada linha, por organização — definida arrastando em
   "Linhas e sistemas". Linha sem registro aqui entra depois de todas as
   ordenadas, em ordem alfabética.';

alter table linhas_ordem enable row level security;

create policy "ver ordem das linhas da organização"
  on linhas_ordem for select
  to authenticated
  using (organizacao_id = organizacao_atual());

create policy "quem gerencia cadastros define ordem das linhas"
  on linhas_ordem for insert
  to authenticated
  with check (
    organizacao_id = organizacao_atual() and pode_gerenciar_cadastros()
  );

create policy "quem gerencia cadastros atualiza ordem das linhas"
  on linhas_ordem for update
  to authenticated
  using (
    organizacao_id = organizacao_atual() and pode_gerenciar_cadastros()
  )
  with check (organizacao_id = organizacao_atual());
