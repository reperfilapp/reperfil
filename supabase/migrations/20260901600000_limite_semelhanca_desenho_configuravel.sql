-- =============================================================================
-- RePerfil — Corte de semelhança de desenho técnico, parametrizável por
-- organização
-- =============================================================================
--
-- O refinamento por desenho técnico (`desenhos_tecnicos_parecidos`,
-- migração `20260901500000`) usava 90% fixo no código — teste real
-- (ALUMIFORT, 01/09/2026) mostrou que isso é rigoroso demais na prática:
-- uma busca que antes trazia vários candidatos plausíveis passou a trazer
-- só o próprio perfil de referência, porque nenhum outro bateu 90% de
-- semelhança de desenho com ele.
--
-- Em vez de escolher um número fixo diferente, o corte vira campo em
-- `configuracoes_aplicacao` (mesma tabela dos outros parâmetros que cada
-- empresa ajusta à própria realidade, em "Configurações do cálculo") —
-- cada organização decide o quanto de rigor quer. Empresa nova nasce com
-- 60%, bem mais permissivo que os 90% chumbados antes.
-- =============================================================================

alter table configuracoes_aplicacao
  add column limite_semelhanca_desenho_percentual integer not null default 60;

alter table configuracoes_aplicacao
  add constraint config_limite_semelhanca_desenho_valido
    check (
      limite_semelhanca_desenho_percentual >= 0
      and limite_semelhanca_desenho_percentual <= 100
    );

comment on column configuracoes_aplicacao.limite_semelhanca_desenho_percentual is
  'Semelhança mínima (0-100) de DESENHO TÉCNICO para um candidato continuar
   na lista, depois que a busca por foto já achou um perfil com confiança
   alta — ver `desenhos_tecnicos_parecidos` e "Identificar perfil". Ajustado
   pelo administrador em "Configurações do cálculo".';
