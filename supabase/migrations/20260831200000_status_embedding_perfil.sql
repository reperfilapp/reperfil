-- =============================================================================
-- RePerfil — Status do cálculo de embedding, visível na galeria
-- =============================================================================
--
-- A coluna `embedding` (vetor de 1024 números) não serve para mostrar na
-- tela — é só matemática interna. Mas SABER se o cálculo deu certo ou
-- falhou para um arquivo específico é útil de verdade: se falhou, aquela
-- foto/desenho simplesmente não vai aparecer na busca visual, e quem
-- cadastrou merece saber disso sem precisar adivinhar.
--
-- `embedding_ok` existe separado de "`embedding` não é nulo" por um motivo
-- concreto: mostrar o marcador na galeria não pode custar buscar o vetor
-- inteiro (uns 8 KB por linha, só de números) toda vez que a tela abre —
-- um booleano é praticamente de graça.
-- =============================================================================

alter table arquivos_vetoriais
  add column if not exists embedding_ok boolean not null default false,
  add column if not exists embedding_erro text;

comment on column arquivos_vetoriais.embedding_ok is
  'true quando o embedding foi calculado com sucesso na última tentativa.
   Redundante com "embedding is not null" de propósito — existe para a
   galeria poder mostrar o marcador sem selecionar o vetor inteiro.';
comment on column arquivos_vetoriais.embedding_erro is
  'Mensagem da última falha ao calcular o embedding (Cohere fora do ar, sem
   crédito, etc.). Nula quando nunca falhou, ou quando uma tentativa
   seguinte deu certo — é sempre sobre a tentativa MAIS RECENTE, não um
   histórico.';

-- Arquivos já calculados no backfill de hoje (antes desta coluna existir)
-- ficam corretos sem precisar rodar o cálculo de novo.
update arquivos_vetoriais set embedding_ok = true where embedding is not null;
