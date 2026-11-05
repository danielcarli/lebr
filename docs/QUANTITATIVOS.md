# Quantitativos

A partir da 0.26.0: **Estrutura › Quantitativos de materiais** (`src/renderer/views/quantitativos.js`), com a lógica em
`src/modules/comum/quantitativos.js` (sem interface, testada no Node). As quantidades saem da geometria de cada elemento
e das armaduras do **último cálculo**: elementos não calculados entram só com concreto e fôrma, e a tela avisa.

## Critérios

| Elemento | Concreto | Fôrma | Aço |
|---|---|---|---|
| Viga | b·h·comprimento entre eixos | (b + 2h)·L; baldrame só 2h·L | a partir da 0.27, a lista de ferros do detalhamento (com as edições do usuário: Σ n·C·massa linear por bitola — ver [DETALHAMENTO.md](DETALHAMENTO.md)); em resultados antigos, sem detalhamento: positivas L + 2·20ø; negativas 0,25·(l esq + l dir) + ganchos; porta-estribos 2 ø 6,3 fora das negativas; estribos pelo perímetro + 2·10ø a cada s; Asl de torção ao longo do vão |
| Laje maciça | lx·ly·h | lx·ly | positivas As × largura × (vão + 0,2 m); negativas l/4 + 0,15 m em cada borda engastada (a laje vizinha conta a sua parte) |
| Laje nervurada | capa + nervuras por m² | área (cubetas) | não estimado |
| Laje treliçada / alveolar | capa e nervuras moldadas na obra / só a capa | — | não estimado (vigotas, treliças, painéis à parte) |
| Pilar (a partir da 0.28: lista de ferros do detalhamento, com arranques e grampos) | bx·by·lance | 2·(bx + by)·lance | longitudinais lance + 40ø de espera; estribos pelo perímetro |
| Sapata | volume do tronco de pirâmide | 2·(A + B)·h0 | malhas nas duas direções, de face a face com ganchos |
| Bloco | A·B·h | 2·(A + B)·h | tirantes e malha com ganchos verticais; estacas à parte (n, metros, m³) |
| Escada | laje inclinada, degraus e patamares | fundo inclinado, espelhos e patamares | principal, distribuição e negativas dos tramos |
| Reservatório | paredes, fundo e tampa | duas faces das paredes, fundo (elevado) e tampa | As de cada face × área da região (vão: placa inteira; arestas: faixa de l/4) e tirantes das vigas-parede |

Massa nominal das barras: π·ø²/4·7850 kg/m³ (NBR 7480: 0,154 kg/m no ø 5 a 6,313 kg/m no ø 32). Módulos externos podem
fornecer `quantitativos(el, resultado, projeto)` (docs/MODULOS.md).

**Segmentos de barra** (0.31): o número de peças cortadas das barras comerciais de 12 m — cada barra da lista de ferros
conta 1, e uma barra mais longa que 12 m conta 1 a mais por emenda; nas malhas estimadas, o número de barras sai da
área por metro e da bitola. Aparece na coluna **Segmentos** das tabelas, no total do projeto e no CSV (campo `pecas`
por bitola no resultado de `quantitativosDoElemento`). É a medida do critério *menos segmentos de barra* da
[otimização](OTIMIZACAO.md).

## Agrupamentos

- **Por pavimento**: pelo pavimento da posição na montagem (escadas no de chegada, reservatórios no do fundo), de cima
  para baixo; sapatas, blocos e estacas no grupo **Fundações**; os sem posição no fim. Cada pavimento abre por tipo de
  elemento. Subtotais e total fecham com a soma das linhas.
- **Por tipo** e **por elemento** (com o código levando ao elemento).

## CSV

Separador `;`, vírgula decimal e UTF-8 com BOM — o padrão das planilhas em português (Excel, LibreOffice, Google
Planilhas). Colunas: pavimento, tipo, código, nome, concreto (m³), fôrma (m²), aço (kg), uma coluna por bitola (kg), taxa
de aço (kg/m³), segmentos de barra, estacas (m) e concreto das estacas (m³). Uma linha por elemento, o subtotal de cada pavimento e o total.

## Limitações

Estimativa para orçamento preliminar: sem emendas por barras de 12 m, sem armaduras construtivas além das listadas, sem
perdas e sem as armaduras de ligação das estacas. A lista de ferros sai do detalhamento (itens 20 a 22 do roteiro).

## Resumo do aço (0.28)

Abaixo da tabela, o **Resumo do aço do projeto** soma por bitola o aço de todos os elementos, com as **perdas** (%)
adotadas no projeto (`parametros.perdasAco`, 10 % de início, editável na própria tela): comprimento, massa, massa com
perdas e barras de 12 m, com os totais de CA-50 e CA-60. Vigas, pilares e lajes maciças entram pela lista de ferros
do detalhamento — as negativas entre lajes contadas uma vez —; os demais, pela estimativa. O CSV traz o resumo no fim.
