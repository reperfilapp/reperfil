-- Marca quando o e-mail de convite REALMENTE saiu, para o botão de
-- reenviar poder confirmar de verdade em vez de só supor que deu certo.
--
-- O reenvio dispara o e-mail por um Database Webhook (assíncrono — a
-- gravação do convite responde antes do e-mail sair). Sem uma coluna
-- assim, a tela só saberia que a LINHA foi recriada, nunca se o Gmail
-- aceitou a mensagem. A Edge Function `enviar-email` grava aqui só depois
-- do envio ter sucesso; a tela consulta por alguns segundos até aparecer.
alter table convites_colaborador
  add column if not exists email_enviado_em timestamptz;
