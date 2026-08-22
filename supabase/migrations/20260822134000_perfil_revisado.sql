-- Adiciona flag de revisão nos perfis
alter table modelos_perfil add column revisado boolean not null default false;
