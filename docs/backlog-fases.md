# Backlog — Fases 2, 3 e 4

> **Não implementar agora.** Este documento é o registro integral do apêndice
> da especificação inicial. A Fase 1 deve ser construída de modo que tudo
> descrito aqui encaixe depois sem retrabalho — em particular, **perfil,
> acabamento, cliente, obra e sobra são entidades únicas**, reaproveitadas por
> todos os módulos futuros e nunca duplicadas por tela.

## Nota sobre nomes de tabelas

A especificação original listou os nomes das tabelas em inglês, mas determinou
que **todo o banco fosse em português**. A contradição foi resolvida em favor do
português (decisão do cliente, registrada em `docs/decisoes.md`). As tabelas
abaixo aparecem com o nome em português que será usado, seguido do nome
original entre parênteses para rastreabilidade.

---

## FASE 2 — Tipologias paramétricas e desenho vetorial

O sistema terá dois tipos distintos de representação vetorial, e confundi-los é
erro grave.

### Seção transversal do perfil

Cada modelo de perfil pode ter imagem de apresentação, desenho vetorial da seção
em SVG otimizado para navegador, arquivo técnico original em DXF opcional,
dimensões reais da seção em milímetros, largura, altura, fabricante, linha,
escala, código e observações técnicas.

Esse desenho representa a geometria física do perfil e **nunca deve ser
esticado** para acompanhar as dimensões da porta ou janela. Quando o usuário
importar DXF, mantenha o original armazenado e gere uma versão SVG para
visualização quando tecnicamente possível. SVGs importados devem ser
sanitizados. Não implemente suporte direto a DWG — documente que precisa ser
convertido para DXF ou SVG antes.

### Desenho paramétrico da esquadria

Desenho frontal gerado dinamicamente em SVG, adaptando-se a largura, altura,
proporção, quantidade de folhas, divisão das folhas, sentido de abertura, folhas
móveis e fixas, montantes, travessas, bandeiras, peitoris, tipo e cor do vidro,
cor dos perfis, puxadores, fechaduras, dobradiças, roldanas, barras antipânico e
demais acessórios visuais.

O padrão de qualidade alvo é o do PDF de referência da BR Aluminium
(`docs/referencia/`, orçamento emitido pelo SmartCEM/Alumisoft), não o do sistema
w.vetro. Concretamente, o desenho deve:

- mostrar o número real de folhas configurado, de modo que uma porta de correr
  de 8 folhas apareça com 8 e uma de 6 apareça com 6;
- marcar folhas fixas com "F";
- indicar o sentido de abertura das folhas móveis com setas;
- representar visualmente elementos como persiana integrada, barras horizontais
  de portão tubular e módulos de fachada;
- desenhar cotas de largura e altura nas bordas, com os valores em milímetros;
- indicar "vista externa" quando aplicável.

Deve manter proporção real entre largura e altura, mas com limites mínimos de
visualização para que esquadrias muito estreitas ou muito largas continuem
legíveis.

> **O defeito central que o RePerfil existe para corrigir:** no orçamento 1734 os
> itens de 3.200 × 2.150 mm e 1.200 × 2.150 mm exibem miniaturas idênticas, e no
> 1382 as fachadas de 5.800 mm e 5.400 mm também. Isso não pode acontecer.

Calcule e exiba por item, seguindo a referência da BR Aluminium, a área da
esquadria e a área do vidro. Atenção: existem itens legítimos **sem vidro** —
portas em ACM, portões tubulares — e o cálculo não pode assumir vidro em todo
item.

O mesmo modelo paramétrico deve alimentar a pré-visualização no orçamento, o PDF
comercial, a ficha de produção, a ordem de serviço e a identificação da obra.
Tela e PDF podem usar renderizadores diferentes, mas consomem exatamente os
mesmos dados e produzem desenhos equivalentes.

### Motor de templates, não CAD livre

Não tente construir algo parecido com AutoCAD. Implemente um motor de templates
paramétricos com templates iniciais cobrindo as tipologias que a empresa
efetivamente vende, observadas nos orçamentos de referência:

- painel fixo;
- janela fixa com múltiplos módulos;
- porta de giro de 1 folha;
- porta de giro de 2 folhas;
- porta de giro de 2 folhas com barra antipânico;
- porta pivotante de 1 folha;
- porta de correr de 2, 3, 4, 6 e 8 folhas, com número de trilhos/planos
  configurável e definição de quais folhas são móveis e quais são fixas;
- porta e janela de correr com persiana integrada;
- janela de correr de 2 folhas;
- maxim-ar de 1 e 2 folhas;
- portão de giro de 2 folhas em estrutura tubular com fechamento em barras;
- porta em ACM sem vidro;
- fachada pele de vidro com grade de módulos e basculantes.

Cada template define nome, categoria, desenho base, parâmetros permitidos,
quantidade mínima e máxima de folhas, regras de divisão, limites mínimos e
máximos de largura e altura, linha de perfis compatível, componentes
necessários, fórmulas de corte, fórmulas de vidro, acessórios obrigatórios,
acessórios opcionais, regras de validação e representação SVG. Deve ser possível
adicionar tipologias novas depois sem reescrever o aplicativo.

### Motor de regras, separado da camada visual

Não derive a lista de materiais da aparência do desenho. Cada tipologia e linha
de perfis tem fórmulas configuráveis e versionadas para calcular perfis
horizontais e verticais, montantes, travessas, baguetes, folhas, marcos,
contramarcos, dimensões dos vidros, quantidade de acessórios, descontos
técnicos, folgas, sobreposições, perdas, cortes em ângulo e quantidades por
item.

As fórmulas reais variam conforme fabricante, linha, tipologia e modo de
fabricação. Portanto: crie campos configuráveis; forneça dados demonstrativos
claramente identificados como demonstrativos; permita versionar as regras; exija
validação pela empresa antes do uso em produção; e **não apresente fórmulas
fictícias como tecnicamente aprovadas**. Uma alteração de fórmula não pode
modificar silenciosamente orçamentos antigos — cada orçamento guarda a versão
das regras usada na sua criação.

### Tabelas da Fase 2

| Nome a usar | Nome original |
| --- | --- |
| `sistemas_perfis` | `profile_systems` |
| `tipologias_produto` | `product_typologies` |
| `modelos_tipologia` | `typology_templates` |
| `parametros_tipologia` | `typology_parameters` |
| `conjuntos_regras_formula` | `formula_rule_sets` |
| `regras_formula` | `formula_rules` |
| `componentes_perfil` | `profile_components` |
| `tipos_vidro` | `glass_types` |
| `acessorios` | `accessories` |

### Testes da Fase 2

Alterar largura atualiza o desenho; alterar altura atualiza o desenho; porta de
2 folhas continua mostrando 2 folhas e a de 8 mostra 8; o desenho mantém
proporção legível nos extremos; a seção do perfil não é deformada; tipologia
incompatível com a linha é rejeitada; as fórmulas corretas são selecionadas
conforme a linha; a lista de materiais é recalculada ao mudar parâmetro; o vidro
é calculado pelas dimensões internas e não pela largura e altura externas; item
sem vidro não gera cálculo de vidro.

---

## FASE 3 — Orçamentos, custos, preços e PDF

### Orçamento

Número sequencial, data de emissão, validade, cliente, vendedor, responsável
técnico opcional, endereço da obra, condições de pagamento, prazo estimado,
observações internas, observações para o cliente, desconto, frete, instalação,
impostos, situação, versão e histórico.

Status: rascunho, em cálculo, pronto, enviado, aprovado, rejeitado, vencido,
cancelado, convertido em obra. Permita duplicar e criar nova versão; alteração
em orçamento já enviado cria versão nova e preserva a anterior.

### Item do orçamento

Escolher tipologia, selecionar linha ou sistema de perfis, informar largura,
altura e quantidade, definir número de folhas, definir folhas fixas e móveis,
definir sentido de abertura, selecionar cor e acabamento do perfil, selecionar
cor dos acessórios, selecionar tipo e espessura do vidro, selecionar acessórios,
informar local ou ambiente, inserir observações, visualizar o desenho atualizado
e calcular materiais, custo e preço. O desenho atualiza imediatamente quando
largura, altura, folhas, divisões ou sentido de abertura mudam.

Validações contra combinações incompatíveis: tipologia incompatível com a linha,
largura abaixo do mínimo, altura acima do máximo, número de folhas inválido,
vidro incompatível, ausência de acessório obrigatório, barra antipânico em
configuração não permitida. O administrador pode autorizar exceção mediante
justificativa registrada.

### Cadastros de apoio

Linhas e sistemas; tipologias; vidros; chapas (incluindo ACM, presente nos
orçamentos reais); telas; acessórios; ferragens; puxadores; fechaduras; barras
antipânico; roldanas; cremonas multiponto; borrachas; escovas; parafusos e
consumíveis; serviços; instalação; frete; impostos; tabelas de preços com data
de início de vigência.

### Vidros

Descrição, cor, espessura, composição, unidade de cobrança, preço por metro
quadrado, preço mínimo, perda configurável, acabamento de borda, lapidação,
têmpera, laminação, fornecedor e situação.

Os orçamentos reais usam designações como "LAMINADO INCOLOR 3+3 – LAPIDADO",
"INCOLOR 08MM – TEMPERADO", "TEMPERADO DE 8 MM ACIDATO" e "VIDRO LAMINADO
REFLETIVO NEUTRAL" — o cadastro precisa comportar essa granularidade. A dimensão
e a área do vidro vêm das fórmulas da tipologia, não da largura e altura
externas da esquadria.

### Custo e preço

Separando claramente custo interno, preço de venda, margem, desconto e economia
gerada por reaproveitamento. Considere perfis de alumínio por peso ou metragem,
preço por quilo, metro ou barra, acabamento, pintura, vidro, acessórios,
consumíveis, mão de obra, instalação, frete, impostos, perdas, margem, comissão
e desconto.

Tabelas de preços com vigência; orçamento antigo preserva os preços usados mesmo
após atualização da tabela. Custo interno e margem nunca aparecem no PDF do
cliente.

O uso de uma sobra reduz o custo real, mas **não deve reduzir automaticamente o
preço de venda**. Crie configuração de política comercial definindo se a economia
é incorporada à margem, repassada parcialmente, repassada integralmente ou
ignorada no preço comercial.

### PDF comercial

Com identidade visual original do RePerfil e da empresa usuária. Deve conter
logotipo, dados da empresa, número e versão, data, validade, vendedor, cliente,
endereço da obra, contatos, desenho vetorial de cada item, descrição, local ou
ambiente, linha, cor do perfil, cor dos acessórios, vidro, quantidade, largura,
altura, área da esquadria, área do vidro, valor unitário, valor total, subtotal,
desconto, instalação, frete, impostos quando aplicável, total geral, condições de
pagamento, prazo, observações, garantia, espaço para aceite do cliente,
paginação e identificação do documento.

Estruture o bloco de item seguindo a lógica dos orçamentos de referência:
desenho à esquerda, descrição completa da tipologia com linha e acessórios em
destaque, cor do perfil e cor do acessório em linha própria, e abaixo a linha
tabular com item, quantidade, largura, altura, vidro, valor unitário e valor
total.

O desenho precisa permanecer nítido com zoom no PDF — priorize vetor sobre
raster. Crie visualização antes da geração. Implemente compartilhamento,
download, impressão e envio por WhatsApp ou e-mail usando o mecanismo de
compartilhamento nativo do dispositivo, sem integrar APIs pagas de WhatsApp no
MVP.

Antes de considerar o PDF pronto: renderize todas as páginas, verifique
visualmente, confira totais, confira quebras de página, confirme que **não existe
página em branco no final** e que textos, tabelas e desenhos não estão cortados.
Os PDFs de referência do sistema w.vetro terminam numa página em branco contendo
apenas o rodapé — esse defeito não pode se repetir.

### Tabelas da Fase 3

| Nome a usar | Nome original |
| --- | --- |
| `categorias_produto` | `product_categories` |
| `tabelas_preco` | `price_lists` |
| `itens_tabela_preco` | `price_list_items` |
| `orcamentos` | `quotes` |
| `versoes_orcamento` | `quote_versions` |
| `itens_orcamento` | `quote_items` |
| `parametros_item_orcamento` | `quote_item_parameters` |
| `componentes_item_orcamento` | `quote_item_components` |
| `totais_orcamento` | `quote_totals` |
| `condicoes_pagamento` | `payment_terms` |

### Cenário de aceitação

Espelhando um orçamento real: dois itens de porta de giro de 2 folhas com barra
antipânico, linha de perfis configurável, perfil branco, acessórios brancos,
vidro laminado; item 1 com 3.200 × 2.150 mm; item 2 com 1.200 × 2.150 mm;
quantidade 1 cada.

Critérios: os dois desenhos representam a mesma tipologia; **o desenho do item de
3.200 mm é visivelmente mais largo que o de 1.200 mm** — este é o critério que
separa o RePerfil do sistema atual; os valores são calculados separadamente; o
total é a soma dos itens; o PDF mostra os dois itens; não existe segunda página
em branco; e os dados demonstrativos não usam nome, logotipo nem dados pessoais
reais dos arquivos de referência.

### Testes da Fase 3

Preço total é quantidade vezes valor unitário; desconto aplicado corretamente;
custo e margem ausentes do PDF do cliente; orçamentos antigos preservam preços e
fórmulas; alteração gera nova versão; aprovação habilita conversão em obra; o
SVG exibido corresponde ao produto configurado; o PDF não gera página adicional
em branco.

---

## FASE 4 — Obras, motor de aproveitamento e plano de corte

### Obra

Nome ou número, cliente opcional, responsável, data, observações e status
(orçamento, planejada, em produção, concluída, cancelada).

Necessidades de corte por obra: modelo do perfil, acabamento, comprimento de
cada corte, quantidade, observação e referência da esquadria ou ambiente.
Entrada por lançamento manual, duplicação de linhas, colagem de dados de
planilha e importação CSV com arquivo de exemplo.

### Motor de aproveitamento

Tratado como otimização de corte unidimensional. Agrupe as necessidades
obrigatoriamente por modelo de perfil, acabamento ou grupo compatível, e demais
características que impeçam substituição. Considere comprimentos e quantidades
das sobras disponíveis, espessura de cada corte da serra, margem de limpeza,
comprimento mínimo de sobra reaproveitável, barras novas de 6.000 mm ou do
comprimento configurado, e peças reservadas que não podem ser oferecidas a outra
obra.

Objetivos do cálculo, nesta ordem:

1. minimizar a quantidade de barras novas;
2. maximizar o uso das sobras existentes;
3. minimizar o desperdício final;
4. priorizar sobras mais antigas quando o resultado técnico for equivalente.

Implemente inicialmente um algoritmo confiável como Best Fit Decreasing,
complementado por busca local ou estratégia adequada. **Não declare que o
resultado é matematicamente ótimo se for heurística** — apresente como "melhor
sugestão encontrada".

O resultado apresenta as sobras selecionadas com código ou QR de cada uma,
comprimento original, cortes retirados daquela peça, perdas de serra,
comprimento restante, indicação se o restante volta ao estoque ou vira descarte,
barras novas necessárias, plano de corte de cada barra nova, percentual de
aproveitamento, total de metros reaproveitados, total de metros novos,
desperdício estimado e economia financeira estimada quando houver preço
cadastrado. Inclua representação visual de cada barra com segmentos coloridos
para cortes e sobra.

### Fluxo de reserva e corte

O cálculo **não altera o estoque imediatamente**. Gerar sugestão, o usuário
revisa, aprova o plano, reservar as sobras de forma transacional, emitir lista de
separação por localização, confirmar retirada, confirmar corte, registrar as
sobras resultantes e encerrar a reserva. Plano cancelado devolve as peças a
disponível. Restante maior ou igual ao mínimo vira nova sobra disponível; menor
vira descarte. Histórico completo mantido, sem apagar movimentações; correções
exigem justificativa.

### Integração orçamento e obra

Consulta de sobras durante o rascunho **não reserva** estoque, porque o orçamento
pode não ser aprovado. O fluxo é criar orçamento, gerar lista preliminar de
materiais, simular aproveitamento, mostrar custo estimado com e sem
reaproveitamento, enviar o orçamento, aguardar aprovação, converter em obra,
revalidar o estoque disponível, gerar o plano definitivo de corte, reservar as
sobras e emitir lista de separação e produção. Reserva manual antecipada só para
usuários autorizados e com prazo de expiração.

A conversão em obra preserva o orçamento original, cria a obra, copia os itens
aprovados, copia as versões das fórmulas, gera lista de materiais e lista de
cortes, consulta novamente as sobras, cria o plano de corte, permite reservar
materiais, emite ordem de produção e registra a ligação entre orçamento e obra.

### Tabelas da Fase 4

| Nome a usar | Nome original |
| --- | --- |
| `obras` | `projects` |
| `itens_corte_obra` | `project_cut_items` |
| `planos_corte` | `cutting_plans` |
| `origens_plano_corte` | `cutting_plan_sources` |
| `cortes_plano` | `cutting_plan_cuts` |
| `ordens_producao` | `production_orders` |

### Os quatorze testes obrigatórios do motor de corte

Nenhum pode ser pulado, e o resultado real de cada um deve ser mostrado antes de
a fase ser considerada concluída:

1. Uma sobra que comporta exatamente o corte mais a perda da serra.
2. Uma sobra que parece suficiente, mas não comporta o corte depois de
   considerar a serra.
3. Vários cortes na mesma sobra.
4. Necessidade de utilizar mais de uma sobra.
5. Necessidade de incluir barras novas.
6. Acabamentos diferentes que não podem ser misturados.
7. Peças reservadas que não podem ser usadas.
8. Quantidades maiores que uma unidade.
9. Resto menor que o mínimo, classificado como descarte.
10. Resto maior que o mínimo, retornando ao estoque.
11. Cancelamento de uma reserva.
12. Tentativa simultânea de reservar a mesma peça.
13. Conversão correta entre metros, centímetros e milímetros.
14. Garantia de que nenhum corte individual seja dividido entre duas barras.

> **Caso concreto que o sistema precisa acertar:** estoque com uma sobra de
> 1.800 mm, necessidades de 1.200 mm e 600 mm, serra de 3 mm por corte. O sistema
> não pode afirmar que os dois cortes cabem na mesma sobra, porque 1.200 + 600
> mais as perdas ultrapassa 1.800 mm.

### Testes de integração da Fase 4

Geração do plano, reserva, confirmação de corte, criação da sobra resultante e
atualização dos relatórios; consulta de sobras no rascunho do orçamento não
reserva estoque; aprovação revalida estoque; conversão gera a lista de cortes
correta.

---

## Fora de escopo, para backlog futuro

Integração com ERP; emissão de compras; integração com máquinas de corte;
notificações avançadas; aplicativo iOS; marketplace de sobras entre empresas.
