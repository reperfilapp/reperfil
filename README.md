# RePerfil

> Orce, projete e reaproveite.

Aplicativo de controle de sobras de perfis de alumínio e orçamento de esquadrias.
PWA instalável, web responsiva e Android (via Capacitor), a partir de uma única
base de código.

**Situação atual: versão 1.0.0 — Fase 1 completa.** O ciclo do estoque
funciona de ponta a ponta: cadastrar sobras com foto, procurar a peça que
serve para um corte, reservar, retirar, confirmar o corte, e exportar
relatórios. Instalável como aplicativo, com projeto Android compilando.
Publicado em https://reperfil.vercel.app.

As Fases 2 (desenho paramétrico), 3 (orçamentos e PDF) e 4 (obras e plano de
corte) ainda não foram construídas — ver `docs/backlog-fases.md`.

## O problema que resolve

Os perfis chegam em barras de 6.000 mm e a fabricação gera sobras ("pontas") de
modelos, cores e comprimentos variados, que se acumulam no depósito. Como são
muitas, ninguém lembra que existe peça aproveitável — e uma barra nova acaba
sendo cortada sem necessidade. O RePerfil cataloga essas sobras e permite
encontrá-las em segundos.

## Stack

React 19 · TypeScript 6 (strict) · Vite 8 · Tailwind CSS 4 · Supabase
(PostgreSQL, autenticação, storage, RLS) · Vitest · Capacitor

## Requisitos

- Node.js 20 ou superior (desenvolvido com 24)
- Uma conta Supabase (gratuita)
- Para gerar o APK Android: JDK 17+ e Android SDK

## Executar localmente

```bash
npm install
```

Copie o modelo de variáveis de ambiente e preencha com as chaves do seu projeto
Supabase (painel → Project Settings → API):

```bash
cp .env.example .env
```

```bash
npm run dev
```

A aplicação sobe em `http://localhost:5173`.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Verificação de tipos + build de produção |
| `npm run preview` | Serve o build de produção localmente |
| `npm run lint` | Análise estática (oxlint) |
| `npm run test` | Testes (Vitest) |
| `npm run test:watch` | Testes em modo observador |
| `npm run test:cobertura` | Testes com relatório de cobertura |
| `npm run format` | Formata o código (Prettier) |
| `npm run verificar` | Lint + testes + build — rode antes de commitar |
| `npm run banco:validar` | Confere a sintaxe dos arquivos SQL |
| `npm run banco:consolidar` | Junta as migrations num arquivo só |
| `npm run icones` | Regenera ícones e logotipo a partir de `public/logo.png` |
| `npm run lighthouse` | Build e servidor local para auditoria |
| `npm run android:apk` | Gera o APK de depuração |
| `npm run android:instalar` | Instala no celular ligado por USB |
| `npm run android:estudio` | Abre o projeto no Android Studio |
| `npm run versao:etapa` | Sobe a versão ao concluir uma etapa |

## Organização das pastas

```
src/
  componentes/   Componentes de interface reutilizáveis
  config/        Identidade do app e variáveis de ambiente validadas
  dominio/       Regras de negócio puras e testáveis (medidas, cortes, estoque)
  lib/           Utilitários genéricos
  testes/        Configuração da suíte de testes
  autenticacao/  Sessão, papéis e proteção de rotas
  dados/         Consultas e gravações, por entidade
  paginas/       Uma pasta por tela
  tipos/         Tipos espelhando as tabelas do banco
docs/
  banco-de-dados.md  Como aplicar e verificar o esquema
  lighthouse.md      Pontuações reais medidas, e o que foi corrigido
  publicacao-play-store.md  Caminho até a Google Play
  backlog-fases.md   Escopo das Fases 2, 3 e 4 — não implementar agora
  decisoes.md        Decisões que divergem da especificação, com o motivo
  pendencias.md      Itens combinados e ainda não implementados
  publicacao-vercel.md  Como publicar
  versoes.md         Histórico de versões
  prompt-inicial.txt Especificação original
  referencia/        PDFs de referência (fora do controle de versão)
supabase/
  migrations/    Esquema do banco, em ordem
  testes/        Verificações de RLS e de cadastros
```

## Convenções

- **Banco de dados inteiramente em português** — tabelas, colunas e funções.
- **Comprimentos sempre em milímetros inteiros.** A interface aceita mm, cm ou m
  e converte na entrada. Nenhum valor de medida trafega como decimal.
- **Cores sempre por token.** Nenhum componente usa cor literal do Tailwind
  (`bg-blue-500` e afins); tudo sai de `src/index.css`, para que a identidade da
  empresa possa ser trocada num arquivo só.
- **O aplicativo exige conexão.** Não há modo offline — ver decisão D3.

## Plano de etapas — Fase 1

| Etapa | Escopo | Situação |
| --- | --- | --- |
| 0 | Fundação: scaffold, tokens, configuração, documentação | Concluída |
| 1 | Banco: tabelas, RLS, funções transacionais, seeds | Concluída |
| 2 | Núcleo de domínio testado: medidas, "cabe ou não cabe", estoque | Concluída |
| 3 | Autenticação e perfis de acesso | Concluída |
| 4 | Cadastros: perfis, acabamentos, locais, clientes, configurações | Concluída |
| 5 | Cadastro rápido de sobras | Concluída |
| 6 | Pesquisa, reserva e corte | Concluída |
| 7 | Painel, relatórios e PWA | Concluída |
| 8 | Android (Capacitor) e documentação de publicação | Concluída |

Itens combinados e ainda não implementados estão em `docs/pendencias.md`.

As Fases 2, 3 e 4 estão descritas em `docs/backlog-fases.md` e **não devem ser
implementadas** até a Fase 1 ser aprovada.

## Segurança

- Nenhum segredo é versionado. `.env` está no `.gitignore`.
- A chave `anon` do Supabase é pública por design — quem protege os dados é o
  Row Level Security. A chave `service_role` **nunca** pode aparecer no código do
  navegador ou do aplicativo Android.
- Os PDFs de referência contêm dados reais de clientes e estão fora do controle
  de versão.
