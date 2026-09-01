-- =============================================================================
-- RePerfil — Foto e desenho técnico para acessórios
-- =============================================================================
--
-- `modelos_acessorio` só tinha um campo solto `imagem_url`, que nenhuma
-- tela lia ou gravava. Acessórios passam a ter a mesma galeria de foto +
-- desenho técnico que perfis já têm — reaproveitando `arquivos_vetoriais`
-- (mesma tabela, GaleriaDesenhos.tsx, VisualizadorImagem, selos de IA e
-- hooks de embedding já prontos), em vez de duplicar tudo numa tabela
-- paralela.
-- =============================================================================

alter table arquivos_vetoriais
  add column modelo_acessorio_id uuid references modelos_acessorio (id) on delete cascade;

alter table arquivos_vetoriais
  add constraint arquivo_de_uma_entidade_so check (
    (modelo_perfil_id is not null)::int + (modelo_acessorio_id is not null)::int = 1
  );

create index idx_arquivos_vetoriais_acessorio on arquivos_vetoriais (modelo_acessorio_id);

comment on column arquivos_vetoriais.modelo_acessorio_id is
  'Foto ou desenho técnico de um acessório — mutuamente exclusivo com
   modelo_perfil_id (ver constraint arquivo_de_uma_entidade_so). Nenhuma
   política de RLS muda: as existentes já checam só organizacao_id e
   pode_movimentar_estoque(), sem referência a qual das duas FKs.';
