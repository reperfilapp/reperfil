-- Cargos de verdade e cadastro de colaboradores pelo próprio sistema.
--
-- ── O PROBLEMA ───────────────────────────────────────────────────────────
--
-- O sistema nasceu com três papéis (administrador, estoque, serralheiro) e
-- nenhuma tela para administrá-los. Na prática, incluir um colaborador
-- exigia entrar no painel do Supabase, criar o usuário à mão e rodar um SQL
-- — trabalho de quem construiu o sistema, não de quem toca a serralheria.
-- O resultado previsível é que ninguém inclui ninguém, e todo mundo entra
-- com a mesma conta de administrador.
--
-- ── POR QUE CARGO NÃO É PERMISSÃO ────────────────────────────────────────
--
-- A tentação é listar cargos dentro de cada política de segurança:
-- `papel in ('administrador', 'gerente', 'financeiro')`. Funciona no dia em
-- que se escreve e apodrece no seguinte: criar um cargo novo vira uma
-- migração que percorre dezenas de políticas, e liberar UMA tarefa para UMA
-- pessoa não tem como ser feito sem programador.
--
-- Por isso o cargo aqui é rótulo e ponto de partida. Ele DEFINE as
-- permissões iniciais de quem entra, e depois cada permissão vive por conta
-- própria, no perfil da pessoa. A etapa seguinte, que dá ao administrador
-- uma tela para marcá-las, não precisa mexer em nenhuma política — elas já
-- perguntam pela permissão, não pelo cargo.

-- -----------------------------------------------------------------------------
-- Os cargos
-- -----------------------------------------------------------------------------
-- Postgres não remove valor de enum, e 'estoque' já está gravado em perfis
-- existentes. Ele fica como legado: some da tela, continua válido no banco,
-- e a função de permissão abaixo o trata como equivalente a auxiliar.
alter type papel_usuario add value if not exists 'gerente';
alter type papel_usuario add value if not exists 'vendedor';
alter type papel_usuario add value if not exists 'financeiro';
alter type papel_usuario add value if not exists 'auxiliar';

comment on type papel_usuario is
  'Cargo do colaborador. Define as permissões INICIAIS de quem entra; a
   permissão efetiva vive em perfis_usuario e pode ser ajustada pessoa a
   pessoa. O valor "estoque" é legado do modelo antigo — equivale a
   auxiliar e não aparece mais no cadastro.';

-- ATENÇÃO: esta migração vai SOZINHA. Postgres recusa usar um valor de enum
-- recém-criado dentro da mesma transação que o criou, e a migração seguinte
-- (colaboradores e permissões) usa 'gerente', 'auxiliar' e companhia. Rode
-- esta, confirme, e só então rode a próxima.
