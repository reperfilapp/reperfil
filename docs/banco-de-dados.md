# Banco de dados — como aplicar e verificar

## Situação

O esquema da Fase 1 está **escrito e com sintaxe validada**, mas **ainda não foi
aplicado** em nenhum banco. Não há Docker nesta máquina, então não foi possível
subir um Supabase local para testar antes. A prova de que funciona é aplicar no
projeto e rodar o teste de RLS — passo 3 abaixo.

## Passo 1 — Aplicar o esquema

1. Abra o [SQL Editor do Supabase](https://supabase.com/dashboard/project/dvwzpdhlfjzriqmdtceu/sql/new)
2. Abra o arquivo `supabase/aplicar-tudo.sql` deste projeto
3. Copie o conteúdo inteiro, cole no editor e clique em **Run**

Deve aparecer `Success. No rows returned`. Se algum erro aparecer, copie a
mensagem e me mande — é exatamente o tipo de coisa que a validação de sintaxe
não pega.

> O arquivo `aplicar-tudo.sql` é gerado, não editado à mão. Ele junta as seis
> migrations de `supabase/migrations/` em ordem. Para regerá-lo após mudar
> alguma migration: `npm run banco:consolidar`.

## Passo 2 — Dados de demonstração (opcional)

Mesmo procedimento, com o arquivo `supabase/seed.sql`. Cria uma organização
`DEMO` com 4 perfis, 4 acabamentos, 4 localizações, 8 sobras e 3 clientes, todos
fictícios.

Para remover depois:

```sql
delete from organizacoes where codigo = 'DEMO';
```

## Passo 3 — Verificar o isolamento entre empresas

Este é o teste obrigatório da especificação. Cole `supabase/testes/verificar-rls.sql`
no SQL Editor e execute.

Ele cria duas organizações de teste, dois usuários, e verifica que:

- cada usuário enxerga apenas as próprias sobras, perfis, clientes e colegas;
- consultar pelo `id` direto de um registro alheio não devolve nada;
- não é possível inserir dado na organização de outra empresa;
- não é possível reservar uma sobra de outra empresa;
- uma peça já reservada não pode ser reservada de novo;
- cancelar a reserva devolve a peça a disponível;
- o histórico de movimentações não pode ser apagado.

O resultado aparece na aba **Messages** do editor (não em Results — as
mensagens saem via `raise notice`). O esperado é uma sequência de `OK` seguida
de `TODAS AS VERIFICAÇÕES DE RLS PASSARAM`.

Qualquer falha interrompe com uma exceção descrevendo o problema.

**O script termina com `ROLLBACK`**: nada do que ele cria fica no banco.

## Passo 4 — Desabilitar cadastro público

No painel: **Authentication → Sign In / Providers → Email**, desligue
**Allow new users to sign up**.

A especificação exige que usuários sejam criados ou convidados pelo
administrador. Sem isso, qualquer pessoa com a URL do projeto cria uma conta —
e embora o RLS a deixe sem organização (e portanto sem enxergar nada), é porta
aberta desnecessária.

## Estrutura

| Arquivo | Conteúdo |
| --- | --- |
| `migrations/…_fundacao.sql` | Extensões, organizações, usuários, funções de contexto |
| `migrations/…_cadastros.sql` | Perfis, acabamentos, compatibilidades, locais, clientes, arquivos vetoriais |
| `migrations/…_estoque.sql` | Lotes de sobras, reservas, movimentações |
| `migrations/…_configuracoes_auditoria.sql` | Configurações de cálculo e auditoria |
| `migrations/…_rls.sql` | Todas as políticas de Row Level Security |
| `migrations/…_funcoes_estoque.sql` | Funções transacionais de reserva, corte e cancelamento |
| `seed.sql` | Dados de demonstração fictícios |
| `testes/verificar-rls.sql` | Verificação do isolamento entre organizações |
| `aplicar-tudo.sql` | Gerado: as seis migrations concatenadas |

## Decisões que valem conhecer

**Reserva não é `UPDATE`.** Reservar, cancelar, retirar e confirmar corte passam
por funções (`reservar_sobra`, `cancelar_reserva`, …) que travam a linha com
`SELECT … FOR UPDATE`. Duas pessoas tentando reservar a mesma peça no mesmo
instante: a segunda espera a primeira terminar e recebe "restam 0 unidades".
Fazer isso com `UPDATE` direto do aplicativo permitiria reserva dupla.

**A restrição do banco é a segunda linha de defesa.**
`quantidade_reservada <= quantidade` é uma `CHECK` na tabela. Mesmo que alguém
contorne as funções, o banco recusa.

**O histórico não tem política de `UPDATE` nem `DELETE`.** A ausência é
proposital: sem política, a operação é negada. Erro se corrige com uma
movimentação de ajuste — que exige justificativa por restrição, não por
confiança na tela.

**Toda função de contexto é `SECURITY DEFINER`.** `organizacao_atual()` lê
`perfis_usuario`, que tem RLS baseada nela. Sem o `SECURITY DEFINER`, a política
se consultaria em recursão infinita.

**Dinheiro em centavos, peso em gramas, comprimento em milímetros — todos
inteiros.** Ponto flutuante em dinheiro e em medida física é fonte garantida de
divergência de centavo e de milímetro.

## Limites da validação offline

`npm run banco:validar` confere apenas **sintaxe**. Ele não sabe se uma tabela
referenciada existe, e o corpo das funções PL/pgSQL é texto opaco para ele —
erro dentro de uma função só aparece quando o PostgreSQL a compila, no passo 1.
