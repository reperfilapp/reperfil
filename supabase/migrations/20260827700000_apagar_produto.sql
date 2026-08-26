-- Produto não tinha política de DELETE — só select/insert/update.
--
-- Sem uma política permitindo, o RLS trata qualquer `delete` como "nenhuma
-- linha corresponde": o comando roda sem erro nenhum, mas apaga zero
-- linhas. É por isso que "Apagar produto" fechava o modal normalmente e o
-- produto continuava na lista — nem chegava a ser um erro para o app
-- perceber e avisar.
create policy "quem gerencia cadastros apaga produtos"
  on produtos for delete
  to authenticated
  using (organizacao_id = organizacao_atual() and pode_gerenciar_cadastros());
