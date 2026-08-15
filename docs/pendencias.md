# Pendências

> **P1, P2 e P3 foram implementados na versão 0.6.0**, em 15/08/2026, e
> verificados no navegador contra o banco real. O texto abaixo fica como
> registro do que foi combinado e por quê.
>
> O que ficou de fora, e vale considerar depois:
>
> - **Importação de sobras por CSV**, para lançamento administrativo em lote.
>   Faz mais sentido junto com os relatórios da Etapa 7.
> - **Impressão de etiquetas em lote**, hoje uma a uma. Só vale a pena quando
>   houver volume de estoque para justificar.
> - **Reconhecimento de perfil por fotografia**, previsto na especificação. As
>   fotos do P1 e do P2 são o acervo que tornaria isso possível.

---

## P1 — Foto real da peça no cadastro de sobras

**O que é.** No cadastro rápido de sobras, permitir tirar ou anexar uma foto da
ponta, para conferir estado de conservação e reconhecer a peça na prateleira
sem tirar da estante.

**Por que ficou para depois.** Precisa do Supabase Storage configurado —
bucket, políticas de acesso e limite de tamanho.

**O que precisa ser feito:**

- Criar bucket `fotos-sobras` no Supabase, **privado**, não público: foto de
  peça pode revelar layout do depósito e material de cliente
- Políticas de Storage isolando por `organizacao_id`, no mesmo espírito do RLS
  das tabelas — o teste de isolamento precisa cobrir isto também
- Comprimir no aparelho antes de enviar. Foto de celular moderno tem 3 a 6 MB;
  no 4G do depósito isso trava o cadastro. Alvo: lado maior de 1600 px, JPEG
  com qualidade 0,8, o que costuma dar menos de 300 KB
- Campo `foto_url` já existe em `lotes_sobras`; não precisa de migration
- A foto é **opcional** e não pode bloquear o salvamento se o envio falhar —
  cadastrar a sobra importa mais do que ter a foto

---

## P2 — Fotos do desenho técnico do perfil, com medidas

**O que é.** Pedido do Fernando em 15/08. No cadastro do **modelo de perfil**
(não da sobra), permitir subir **várias** fotos do desenho técnico ou da página
do catálogo do fabricante: o perfil visto de vários ângulos, com as medidas em
milímetro de cada face.

**Por que importa.** É o que permite ao serralheiro conferir se o perfil da
prateleira é mesmo aquele do orçamento, sem ir atrás do catálogo impresso.

**Atenção — isto já foi previsto no banco.** A tabela `arquivos_vetoriais`,
criada na Etapa 1, existe exatamente para isto:

| Coluna | Uso aqui |
| --- | --- |
| `tipo` | `imagem` para foto de catálogo; `secao_svg` e `secao_dxf` ficam para a Fase 2 |
| `modelo_perfil_id` | o perfil a que a imagem pertence |
| `largura_mm`, `altura_mm` | dimensões reais da seção |
| `observacoes_tecnicas` | anotações por imagem (qual face, qual vista) |
| `sanitizado` | só relevante para SVG importado |

**Não criar tabela nova.** Se faltar campo — legenda por imagem, ordem de
exibição — acrescentar coluna a `arquivos_vetoriais`, para que a Fase 2 encaixe
sem migração destrutiva.

**O que precisa ser feito:**

- Bucket `desenhos-tecnicos` no Supabase, mesmas políticas de isolamento do P1
- Várias imagens por perfil, com ordem e legenda ("vista frontal", "corte A-A")
- Visualizador com zoom — desenho técnico com cota em milímetro é ilegível em
  miniatura, e é justamente a cota que a pessoa foi consultar
- Mostrar as imagens no seletor de perfil do cadastro de sobras, para conferir
  antes de escolher

> **Ligação com a Fase 2.** A especificação distingue duas representações que
> não podem ser confundidas: a **seção transversal do perfil**, que é geometria
> física e nunca deve ser esticada, e o **desenho paramétrico da esquadria**,
> que se adapta a largura e altura. As fotos do P2 são do primeiro tipo. Ver
> `docs/backlog-fases.md`.

---

## P3 — Leitura de QR Code pela câmera

**O que é.** Ler o QR Code colado na etiqueta da sobra para localizá-la na
hora, sem digitar o código.

**Por que ficou para depois.** A câmera do navegador exige HTTPS. Com o app
publicado na Vercel, deixou de ser impedimento — o cabeçalho
`Permissions-Policy: camera=(self)` já está configurado em `vercel.json`.

**O que precisa ser feito:**

- Leitor de QR pela câmera na pesquisa de sobras e no cadastro (para localizar
  o perfil pelo código de barras, quando houver)
- **Gerar** o QR Code também: a sobra precisa de etiqueta imprimível com o
  código curto (`SB-4K2P`) e o QR. Sem a etiqueta, não há o que ler
- Tratar recusa de permissão com mensagem clara e caminho alternativo por
  digitação — nunca deixar a pessoa presa numa tela pedindo câmera
- No app Android via Capacitor, declarar a permissão de câmera; a especificação
  exige permissões mínimas, então **só** câmera, e apenas para foto e QR

---

## Observações que valem para os três

**Um teste de isolamento para o Storage.** O RLS das tabelas está verificado em
`supabase/testes/verificar-rls.sql`, mas políticas de Storage são um sistema
separado, com regras próprias. Merecem verificação equivalente — caso contrário
ficamos com o banco protegido e as imagens abertas.

**Peso das imagens.** O app é usado no 4G do depósito. Comprimir antes de
enviar não é refinamento, é o que decide se o cadastro leva três segundos ou
trinta.

**Ligação com a Fase 1.** A especificação já pedia "deixar preparado para
trabalhar com inteligência artificial para reconhecer perfis por fotografia".
As fotos do P1 e do P2 são exatamente o acervo que tornaria isso possível
depois — vale guardá-las com boa resolução e associadas ao modelo correto.
