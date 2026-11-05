# Exportação DXF

**Arquivo › Exportar pranchas em DXF…** (`Ctrl+Shift+D`) gera um arquivo DXF por prancha, numa pasta escolhida. O
formato é o **DXF R12 ASCII** (AC1009), aberto e lido por LibreCAD, QCAD, AutoCAD, BricsCAD e DraftSight. A
unidade do desenho é o **centímetro**; o texto vai em ANSI 1252, com `%%c` para o símbolo de diâmetro.

O gravador está em `src/engine/dxf.js` (LINE, POLYLINE, CIRCLE, TEXT, cotas desenhadas com linhas e texto) e as
pranchas em `src/modules/comum/pranchas.js`. Antes de exportar, os elementos sem cálculo atual são calculados.

## Pranchas

| Prancha | Conteúdo | Escala |
|---|---|---|
| Fôrmas — um arquivo por pavimento | contorno dos pilares (com o X), das vigas (largura b ao longo do eixo) e das lajes, escadas e reservatórios; rótulos (V101 (15x40), P101 (20x30), L101 h = 10 cm); eixos pelos centros dos pilares, numerados (1, 2…) e com letras (A, B…); cotas em cadeia entre eixos e totais; nível do pavimento; carimbo | 1:50 |
| Locação dos pilares e cargas na fundação | pilares que chegam à fundação, contorno das sapatas e dos blocos, coordenadas dos centros, cotas acumuladas a partir da origem do projeto e a tabela Ng, Nq, Nk e Nd (kN) com a fundação de cada pilar | 1:50 |
| Armação das vigas | para cada viga: elevação com apoios, barras dentro da peça, estribos por vão, barras extraídas com ganchos e rótulos (N, quantidade, bitola, comprimento), cotas dos vãos e um corte por vão; tabela de aço e resumo por bitola com perdas | 1:25 |
| Armação dos pilares | para cada lance: elevação com a peça de baixo, barras, arranques com pé, estribos e cota do traspasse; seção com estribo, grampos e barras; tabela de aço e resumo | 1:25 |
| Armação das lajes — um arquivo por pavimento | positivas (barra representativa e faixa de repetição), negativas cruzando as bordas com as dobras e a faixa ao longo da borda; tabela de aço e resumo | 1:50 |

Textos, símbolos de eixo e o carimbo são dimensionados pela escala de impressão (2,5 mm no papel). A lista de ferros
vem do detalhamento de cada elemento, **com as edições** feitas nas tabelas do LEBR.

## Camadas

| Camada | Cor (ACI) | Linha | Uso |
|---|---|---|---|
| EIXOS | 1 vermelho | CENTER | eixos e símbolos |
| PILARES | 2 amarelo | contínua | contorno dos pilares |
| VIGAS | 7 branco | contínua | contorno das vigas |
| LAJES | 4 ciano | contínua | contorno das lajes |
| ESCADAS | 5 azul | contínua | lances, degraus e patamares |
| RESERVATORIOS | 5 azul | DASHED | contorno |
| FUNDACOES | 6 magenta | DASHED | sapatas e blocos na locação |
| COTAS | 3 verde | contínua | cotas |
| TEXTOS | 7 branco | contínua | rótulos e títulos |
| NIVEIS | 6 magenta | contínua | símbolo e cota do nível |
| TABELAS / CARIMBO | 8 cinza | contínua | tabelas de aço e de cargas, carimbo |
| CONCRETO | 8 cinza | contínua | contorno das peças nos detalhes |
| ARMADURA-LONGITUDINAL / -POSITIVA | 1 vermelho | contínua | barras longitudinais, positivas |
| ARMADURA-NEGATIVA | 5 azul | contínua | negativas |
| ARMADURA-TRANSVERSAL | 3 verde | contínua | estribos e grampos |
| ARMADURA-CONSTRUTIVA | 8 cinza | contínua | porta-estribos e construtivas |
| ARMADURA-DISTRIBUICAO | 4 ciano | contínua | faixas de repetição e distribuição |

Cada arquivo leva só as camadas que usa.

## Conferência

- `test/dxf.test.js` lê os arquivos gerados e confere as camadas, o número de pilares, vigas e lajes de cada planta, as
  cotas entre eixos (iguais às diferenças das coordenadas da montagem, em cm), a tabela de cargas da locação e que as
  edições da lista de ferros aparecem na armação.
- Durante o desenvolvimento, todos os arquivos do exemplo de 3 pavimentos foram abertos pelo leitor do **ezdxf**
  (auditoria sem erros) e desenhados para inspeção.

## Limitações

- Cotas desenhadas com linhas e texto (não são entidades DIMENSION associativas).
- Uma prancha por arquivo, sem layout de papel (tudo no espaço do modelo, com o carimbo junto ao desenho).
- Hachuras de corte e símbolos de seção ainda não são gerados; os pilares levam o X tradicional.

## Importar uma planta de arquitetura (0.32)

O caminho inverso também existe: a montagem lê um DXF de arquitetura para usá-lo como **fundo** de cada pavimento
(bloco **Planta de fundo, eixos e malha**). O leitor (`src/engine/dxf-planta.js`) aceita DXF em texto (ASCII), de
qualquer versão:

- **Lidos:** LINE, LWPOLYLINE e POLYLINE (com os arcos de *bulge*), CIRCLE, ARC, ELLIPSE, SPLINE (pelos pontos de
  ajuste ou de controle), TEXT, MTEXT (sem a formatação) e ATTRIB; blocos (INSERT com escala, rotação e matriz de
  linhas e colunas, aninhados até 8 níveis) e as cotas (DIMENSION, pelo bloco que o CAD grava).
- **Ignorados:** hachuras, sólidos, imagens, malhas 3D e o espaço de papel — a mensagem da importação diz quantos.
- **Unidade:** a do cabeçalho (`$INSUNITS`: mm, cm, m, polegada, pé); sem ela, pela extensão do desenho (acima de
  2.000 unidades, mm; acima de 200, cm; senão, m). Pode ser trocada depois.
- **DWG** e **DXF binário** não são lidos: salve como DXF (texto) no programa de CAD.
- Desenhos muito grandes são cortados em 600 mil pontos, com aviso. Para plantas pesadas, congele ou apague no CAD as
  camadas de mobiliário, hachura e detalhes antes de exportar.

As pranchas que o próprio LEBR exporta também podem ser lidas como fundo (por exemplo, a planta de fôrmas de um
pavimento como referência para outro projeto).
