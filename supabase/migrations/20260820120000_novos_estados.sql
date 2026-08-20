-- ATENÇÃO: O PostgreSQL não permite usar um valor recém-criado em um ENUM
-- na mesma transação. Para executar este script no painel do Supabase,
-- SELECIONE APENAS A PARTE 1 e clique em "Run" (ou pressione Ctrl+Enter).
-- DEPOIS, selecione a PARTE 2 e rode separadamente.

-- ==========================================
-- PARTE 1: Criar os novos estados
-- ==========================================
ALTER TYPE estado_conservacao ADD VALUE IF NOT EXISTS 'excelente';
ALTER TYPE estado_conservacao ADD VALUE IF NOT EXISTS 'pequenos_arranhoes';
ALTER TYPE estado_conservacao ADD VALUE IF NOT EXISTS 'muito_avariado';
-- Após rodar a parte 1, pare aqui.

-- ==========================================
-- PARTE 2: Atualizar os dados antigos
-- ==========================================
-- (Rode esta parte somente após a Parte 1 ter finalizado com sucesso)
UPDATE lotes_sobras 
SET estado = 'pequenos_arranhoes' 
WHERE estado = 'regular';

UPDATE lotes_sobras 
SET estado = 'muito_avariado' 
WHERE estado = 'ruim';
-- FIM DA PARTE 2
