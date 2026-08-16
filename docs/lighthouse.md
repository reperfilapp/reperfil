# Lighthouse — pontuações reais

Medido em **15/08/2026**, Lighthouse 12.8.2, no build de produção servido em
`localhost:4173`, Chrome sem interface. Não são estimativas.

Para repetir:

```bash
npm run build
npx vite preview --port 4173
```

```bash
npx lighthouse http://localhost:4173/entrar --view --only-categories=performance,accessibility,best-practices,seo
```

## Resultado

| Categoria | Pontuação | Observação |
| --- | --- | --- |
| Desempenho | **95–97** | Varia entre execuções; ver nota abaixo |
| Acessibilidade | **100** | 19 verificações aplicadas, todas passaram |
| Boas práticas | **100** | |
| SEO | **66** | Baixo **de propósito** — ver explicação |

### Métricas de carregamento

| Métrica | Valor |
| --- | --- |
| Primeiro conteúdo visível | 1,9 s |
| Maior conteúdo visível | 2,4 s |
| Tempo total de bloqueio | 30 ms |
| Deslocamento de layout | 0 |

## Por que o SEO é 66, e por que está certo

A categoria SEO do Lighthouse pressupõe que a página **quer** ser encontrada
por buscadores. O RePerfil é o oposto: sistema interno de uma empresa, onde
toda tela exige autenticação e não há conteúdo público.

O `public/robots.txt` bloqueia todos os rastreadores, e o Lighthouse desconta
por isso. Subir essa nota exigiria liberar a indexação da tela de entrada — o
que não traz benefício nenhum e expõe o endereço em resultados de pesquisa.

Antes do `robots.txt` a nota era 92, com um aviso de "robots.txt inválido"
(o servidor devolvia o `index.html` no lugar dele). Ou seja: o número maior
vinha de uma configuração pior.

**Este é um caso em que otimizar a pontuação pioraria o produto.**

## O que foi corrigido para chegar aqui

A primeira medição deu **desempenho 72**, com o maior conteúdo visível em
**6,2 segundos**. Duas causas, ambas encontradas pelo relatório:

**1. O logotipo tinha 614 KB.** Ele é o maior elemento da tela de entrada, e
sozinho custava 2,8 s. O `npm run icones` passou a gerar
`logo-otimizada.webp` (26 KB) e um PNG de reserva (110 KB), dimensionados para
os 224 px em que a imagem realmente aparece. O original continua em
`public/logo.png` como fonte.

**2. As bibliotecas de QR Code carregavam sempre.** O leitor sozinho tem
481 KB e só é usado quando alguém toca no botão da câmera. Passou a carregar
sob demanda, junto com o gerador de etiqueta.

Resultado: 72 → 97, e o maior conteúdo visível de 6,2 s para 2,4 s.

## Nota sobre a variação do desempenho

A pontuação oscila entre 95 e 97 entre execuções, na mesma máquina e no mesmo
código. É variação normal de medição — a nota depende do que a máquina está
fazendo no momento. Diferenças dessa ordem não indicam regressão; o que vale
acompanhar é queda de dez pontos ou mais.

## Categoria PWA

O Lighthouse 12 **removeu** a categoria PWA, que existia até a versão 11.
Verificações equivalentes foram feitas à mão, no build de produção:

- Service worker registrado, com escopo `/`
- Manifesto servido com status 200, com ícones de 192 e 512, comuns e
  `maskable`
- 14 arquivos do esqueleto da aplicação em cache
- **Nenhuma resposta do Supabase em cache** — conferido lendo as chaves do
  cache. É a decisão D3: o aplicativo exige conexão, e dado de estoque
  guardado localmente mostraria peça já reservada como disponível
