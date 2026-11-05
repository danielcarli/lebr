# Detalhamento de vigas, pilares e lajes

A partir da 0.27.0, o cálculo da viga (`concreto.viga`) termina com o detalhamento das armaduras longitudinais e
transversais: posições numeradas, comprimentos com ganchos e emendas, cortes das barras e a verificação da ancoragem
nos apoios extremos. O motor está em `src/engine/detalhamento.js` (`detalharViga`), chamado por `calcularViga`; o
resultado fica em `resultado.detalhamento`. A tela da viga mostra a seção **Detalhamento das barras**, com a elevação,
a lista de ferros editável e o resumo do aço.

## Critérios (NBR 6118:2023)

| Item | Critério |
|---|---|
| Aderência (9.3.2.1) | fbd = η1·η2·η3·fctd, η1 = 2,25 (CA-50), η2 = 1,0 em boa aderência e 0,7 em má, η3 = 1 para ø < 32 mm |
| Zonas de aderência (9.3.1) | positivas: boa; negativas: boa só se a barra estiver a até 30 cm da face inferior (h < 60 cm) ou a pelo menos 30 cm abaixo do topo (h ≥ 60 cm) |
| Ancoragem básica (9.4.2.4) | lb = (ø/4)·(fyd/fbd) ≥ 25ø |
| Ancoragem necessária (9.4.2.5) | lb,nec = α·lb·As,calc/As,ef, α = 0,7 com gancho, ≥ máx(0,3·lb; 10ø; 10 cm) |
| Decalagem (17.4.2.2, modelo I) | aℓ = d·VSd/[2·(VSd − Vc)], entre 0,5·d e d; com VSd ≤ Vc, aℓ = d |
| Cortes (18.3.2.3) | as barras de canto (duas) correm a viga; as demais, em pares, terminam aℓ + lb além do ponto em que o momento cai abaixo da capacidade das barras que continuam; um corte que economiza menos de 15 cm não é feito |
| Apoios extremos (18.3.2.4) | as positivas vão até a face externa do apoio menos o cobrimento, com gancho a 90°; As,apoio ≥ máx[(aℓ/d)·VSd/fyd; As,vão/3] e a ancoragem com gancho (lb,nec ≥ r + 5,5ø e ≥ 6 cm) precisa caber na largura do apoio menos o cobrimento. Se as barras de canto não bastam, as cortadas passam a chegar ao apoio, grupo a grupo |
| Apoios internos (18.3.2.4.1) | as positivas passam 10ø além da face do apoio |
| Negativas | metade das barras (arredondada para cima) vai até onde o momento negativo se anula, mais aℓ + lb; a outra metade, até onde as primeiras dão conta, mais aℓ + lb. Chegando à extremidade da viga, terminam com gancho |
| Porta-estribos | 2 ø 6,3 (b ≤ 25 cm) ou 2 ø 8 nos trechos do topo sem negativa, com 30ø de traspasse com a negativa |
| Balanços sem positiva | 2 barras construtivas (ø 6,3 ou ø 8) na face inferior |
| Pele (17.3.5.2.3) | h > 60 cm: 0,10 %·b·h por face, ø 8, espaçamento ≤ 20 cm |
| Torção | a parcela de Asl nas faces laterais (proporcional ao perímetro), em ø 10, no vão com torção mais lb para cada lado |
| Estribos (9.4.6) | perímetro externo 2·(b − 2c) + 2·(h − 2c) mais dois ganchos de 8ø ≥ 6 cm; quantidade ⌈vão livre/s⌉ + 1 por vão |
| Ganchos (9.4.2.3) | a 90°, 10ø de barra por gancho (ponta reta de 8ø, pino de 5ø) |
| Emendas (9.5.2.2) | barra acima de 12 m: uma emenda por traspasse a cada 12 m, l0t = 1,8·lb,nec ≥ máx(0,3·1,8·lb; 15ø; 20 cm) somada ao comprimento |
| Comprimentos | arredondados para cima, de 5 em 5 cm |

Barras iguais (mesma bitola, comprimento, ganchos e posição) viram uma só posição. A numeração segue positivas,
negativas, porta-estribos, pele e torção e, por fim, estribos.

## Largura dos apoios

Para cada apoio, a largura na direção do eixo da viga é a do **pilar ligado** (bx·|cos θ| + by·|sen θ|, com θ o
ângulo entre a viga e o pilar; o diâmetro nos pilares circulares), a **largura b da viga que a recebe** (viga apoiada
em viga) ou 20 cm sem ligação. O campo **Largura dos apoios** na seção de detalhamento fixa um valor para todos os
apoios e recalcula a viga.

## Edições

Na lista de ferros, a bitola, a quantidade e o comprimento unitário de qualquer posição podem ser alterados. As
edições ficam no arquivo (`detalhamento.edicoes`, indexadas pelo id estável da posição — ver FORMATO.md) e:

- atualizam na hora a elevação, a massa da posição e o **resumo por bitola**;
- entram nos **quantitativos** do projeto;
- sobrevivem a um novo cálculo (posições que deixarem de existir são ignoradas);
- podem ser desfeitas por posição (**restaurar**) ou todas de uma vez.

As edições **não são reverificadas**: trocar ø 12,5 por ø 10 sem aumentar a quantidade, por exemplo, deixa a viga
com menos aço que o calculado. A tabela marca as posições editadas para que isso fique visível.

## Limitações

- Momentos sem alternância de sobrecargas (a mesma hipótese do dimensionamento da viga).
- Uma camada de cálculo por posição: barras em segunda camada aparecem na mesma posição das demais.
- Grampos, ancoragem por barras transversais soldadas e ganchos a 45° nas barras longitudinais não são gerados; quando a
  ancoragem não cabe no apoio, o LEBR avisa e sugere barras mais finas, grampos ou um apoio mais largo.
- Emendas em posições escolhidas pelo projetista (fora das regiões mais solicitadas) e a proporção de barras emendadas
  na mesma seção não são verificadas — l0t usa α0t = 1,8 (50 % das barras).
- Estribos com espaçamento único por vão (o do trecho mais solicitado).

## Pilares (0.28.0)

O detalhamento de cada lance sai de `detalharPilar` (motor) a partir do resultado do pilar e das ligações da montagem
(`src/modules/comum/detalhamento.js`):

| Item | Critério |
|---|---|
| Barras longitudinais | as do cálculo; com pilar no lance de cima, sobem o traspasse de compressão l0c; no último lance, terminam no topo menos o cobrimento |
| Traspasse (9.5.2.3) | l0c = lb,nec ≥ máx(0,6·lb; 15ø; 20 cm), com As,calc/As,ef = 1 e boa aderência (barras verticais) |
| Arranques | quando o pilar nasce numa sapata, num bloco ou numa viga: esperas com a mesma armadura, embutidas até o fundo da peça menos o cobrimento (h da sapata/bloco do último cálculo dela) e subindo l0c; na fundação, pé dobrado de máx(15ø; 15 cm) para apoio. A ancoragem da espera na fundação é verificada no módulo da sapata/bloco |
| Estribos | ⌊L/s⌋ + 1 ao longo do lance, perímetro com dois ganchos de 8ø ≥ 6 cm |
| Suplementares (18.2.4) | as barras de canto e as que estão a até 20·øt do canto (no máx. duas no trecho) ficam protegidas pelo estribo; para cada linha de barras desprotegidas, um grampo de face a face, com a mesma bitola e espaçamento do estribo |

O lance desenhado mostra a peça de baixo, os pisos, o lance de cima (tracejado), as barras com o traspasse cotado e os
estribos; a seção mostra o estribo, os grampos e as barras.

## Lajes maciças (0.28.0)

| Item | Critério |
|---|---|
| Positivas | nas duas direções calculadas; comprimento até a face oposta das vigas menos o cobrimento (na borda livre, até a borda menos o cobrimento); quantidade pelo vão livre e o espaçamento |
| Negativas | em cada borda engastada: 0,25 do maior vão perpendicular à borda para cada lado (o balanço inteiro quando a laje é em balanço, e a vizinha recebe pelo menos o mesmo comprimento), com dobras de h − 2c nas pontas |
| Lajes vizinhas | a negativa de uma borda comum (as duas bordas engastadas, alinhadas e sobrepostas) é detalhada uma vez só, na laje de código menor, com a maior armadura das duas, ao longo do trecho comum; a outra laje mostra o aviso |
| Sem vizinha | a negativa entra na viga até a face oposta menos o cobrimento (balanço sem laje atrás: aviso para conferir a ancoragem e a torção da viga) |
| Distribuição (19.3.3.2) | sob as negativas, ø 5 com ≥ 20 % da principal e ≥ 0,9 cm²/m, s ≤ 33 cm |

Lajes nervuradas, treliçadas e alveolares continuam com o aço estimado nos quantitativos.

## Resumo do aço com perdas

As seções de detalhamento e a tela **Quantitativos** trazem o resumo por bitola com as **perdas** adotadas no projeto
(`parametros.perdasAco`, 10 % de início, editável nos Quantitativos): comprimento, massa, massa com perdas e barras de
12 m, separando CA-60 (ø 5 e ø 6) e CA-50. O resumo do projeto soma todos os elementos — vigas, pilares e lajes
maciças pela lista de ferros (com as edições), os demais pela estimativa — e entra no CSV.
