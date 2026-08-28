-- Diagnóstico do login por nickname que falha no app da Play Store.
-- Somente leitura, não altera nada.

-- 1. O valor exato gravado (revela espaço/maiúscula escondidos)
select
  id,
  nome,
  quote_literal(apelido) as apelido_bruto,
  ativo,
  organizacao_id
from perfis_usuario
where apelido ilike '%testegoogle%';

-- 2. A mesma função que o app chama, testada direto
select * from resolver_email_login('testegoogle');
