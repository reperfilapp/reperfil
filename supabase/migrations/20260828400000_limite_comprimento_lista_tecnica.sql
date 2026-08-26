-- Corte de lista técnica não pode ser maior que a barra do perfil.
--
-- A tabela só tinha `check (comprimento_mm > 0)`. Nada impedia gravar um
-- corte de 50.000 mm num perfil cuja barra tem 6.000 — e as duas telas que
-- gravam aqui (Acrescentar material e a edição de corte na ficha do
-- produto) faziam a própria conta, sem passar pelo domínio de medidas do
-- app, então também não barravam. O produto ficava impossível de
-- fabricar, e a tela de viabilidade só sabia dizer "não dá", sem explicar
-- que a receita é que estava errada.
--
-- As telas passaram a validar contra `modelos_perfil.comprimento_barra_mm`.
-- Este check é a última linha: vale para importação, script, correção
-- manual no painel — qualquer caminho que não passe pela tela.
--
-- ── POR QUE UM GATILHO, E NÃO UM `check` ─────────────────────────────────
--
-- O limite não é uma constante: depende do perfil de cada linha
-- (`modelos_perfil.comprimento_barra_mm`, que varia de 3 a 18 metros). Um
-- `check` de coluna não enxerga outra tabela — só um gatilho consegue
-- olhar o perfil apontado por `modelo_perfil_id`.

create or replace function validar_comprimento_item_lista()
returns trigger
language plpgsql
as $$
declare
  v_barra_mm integer;
begin
  select comprimento_barra_mm into v_barra_mm
  from modelos_perfil
  where id = new.modelo_perfil_id;

  -- Perfil inexistente é problema da chave estrangeira, não deste
  -- gatilho — deixa passar para o erro certo aparecer.
  if v_barra_mm is null then
    return new;
  end if;

  if new.comprimento_mm > v_barra_mm then
    raise exception
      'O corte de % mm não cabe na barra deste perfil, que tem % mm.',
      new.comprimento_mm, v_barra_mm
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

comment on function validar_comprimento_item_lista is
  'Recusa corte de lista técnica maior que a barra do perfil escolhido.
   O limite vem de modelos_perfil.comprimento_barra_mm, por isso é um
   gatilho e não um check de coluna.';

drop trigger if exists trg_validar_comprimento_item_lista on itens_lista_tecnica;

create trigger trg_validar_comprimento_item_lista
  before insert or update of comprimento_mm, modelo_perfil_id
  on itens_lista_tecnica
  for each row
  execute function validar_comprimento_item_lista();

-- Mostra o que já está gravado fora do limite, se houver. Não corrige
-- sozinho: um corte errado pode ser um erro de digitação de 6000 para
-- 60000 (fácil de arrumar) ou um perfil cadastrado com a barra errada
-- (aí o certo é corrigir o PERFIL, não o corte). Quem sabe qual é o caso
-- é quem montou a receita.
select
  p.codigo as produto,
  m.codigo as perfil,
  i.comprimento_mm as corte_mm,
  m.comprimento_barra_mm as barra_mm
from itens_lista_tecnica i
join modelos_perfil m on m.id = i.modelo_perfil_id
join produtos p on p.id = i.produto_id
where i.comprimento_mm > m.comprimento_barra_mm;
