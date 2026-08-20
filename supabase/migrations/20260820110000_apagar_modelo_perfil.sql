-- =============================================================================
-- RePerfil — Permitir apagar um modelo de perfil
-- =============================================================================
--
-- Faltava a política de DELETE em `modelos_perfil`. Sem ela, o RLS nega por
-- padrão — o botão de apagar, adicionado à tela de perfis, chamava o banco,
-- não recebia erro nenhum (uma exclusão que não atinge linha nenhuma não é
-- falha para o PostgREST) e a pessoa saía da tela achando que tinha apagado.
--
-- A mesma permissão da edição (`pode_movimentar_estoque`), e não uma nova: é
-- o padrão já usado nas políticas de insert e update desta tabela. Quem já
-- pode cadastrar e corrigir um perfil pode apagar o que não está em uso.
--
-- Em uso continua impossível de apagar — não por esta política, mas pelo
-- `on delete restrict` de `lotes_sobras` e `itens_lista_tecnica`, que barra a
-- exclusão no nível do banco antes mesmo de a política ser relevante.
-- =============================================================================

create policy "estoque apaga modelos sem uso"
  on modelos_perfil for delete
  to authenticated
  using (organizacao_id = organizacao_atual() and pode_movimentar_estoque());
