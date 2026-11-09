# Formato do arquivo de projeto (`.lebr.json`)

O projeto é um arquivo **JSON** comum, legível e editável por qualquer programa.
A extensão recomendada é `.lebr.json`. Arquivos da época do OpenLabViga (`.olv.json`,
formato `openlabviga.projeto`) continuam sendo aceitos.

```jsonc
{
  "formato": "lebr.projeto",          // identifica o tipo de arquivo
  "versao": 1,                         // versão do esquema (não do programa)
  "meta": {
    "nome": "Residência exemplo",
    "autor": "",
    "descricao": "",
    "criadoEm": "2026-11-01T12:00:00.000Z",
    "modificadoEm": "2026-11-01T12:00:00.000Z",
    "aplicativo": "LEBR 0.8.0"
  },
  "parametros": {
    "norma": "NBR 6118:2023",
    "classeAgressividade": "II",
    "concreto": { "fck": 25, "agregado": "granito", "pesoEspecifico": 25 },
    "aco": { "fyk": 500, "Es": 210000 },
    "agregadoDmax": 19,
    "cobrimento": { "viga": 3.0, "pilar": 3.0, "laje": 2.5 },
    "coeficientes": { "gc": 1.4, "gs": 1.15, "gg": 1.4, "ggFav": 1.0, "gq": 1.4, "psi0": 0.5, "psi1": 0.4, "psi2": 0.3 },
    "uso": "residencial",
    "els": { "t0": 1 },
    "unidades": { "comprimento": "cm" },
    "analiseGlobal": { "pilares": "elementos" },
    "vento": { "ativo": false, "V0": 45, "referencia": "", "topografia": "plano", "S1": 1, "categoria": "IV", "classe": "auto", "grupo": 2, "Ca": { "x": null, "y": null } },
    "estabilidade": { "desaprumo": true, "rigidez": "separada", "contraventamento": "porticos", "majorar": true }
  },
  "pavimentos": [ { "id": "pav1", "nome": "1º pavimento", "cota": 2.8, "analise": "isolada" } ],
  "elementos": [ /* lista plana — ver abaixo */ ]
}
```

`analiseGlobal.pilares` diz de onde vêm os esforços dos pilares: `elementos` (padrão; normal pelas reações das vigas
e do pilar de cima) ou `portico` (normal e momentos nas pontas de cada lance pelo pórtico espacial do edifício).

`vento` (NBR 6123) guarda os dados do vento: `ativo` liga os casos V1 a V4 (0°, 90°, 180° e 270°) no pórtico do
edifício e nas combinações dele; `V0` (m/s) é a velocidade básica do mapa de isopletas e `referencia` um texto livre
com o local; `topografia` é `plano` (S1 = 1,0), `vale` (0,9) ou `informado` (usa `S1`); `categoria` vai de `I` a `V`;
`classe` é `auto` (pela maior dimensão) ou `A`, `B`, `C`; `grupo` (1 a 5) dá S3; `Ca.x` e `Ca.y` são os coeficientes de
arrasto lidos no ábaco para o vento ao longo de X e de Y — `null` usa a estimativa do programa. Sem o campo, o vento fica
desligado e valem os padrões acima.

`estabilidade` (NBR 6118, 11.3.3.4.1 e 15.5): `desaprumo` liga o desaprumo global no pórtico do edifício (padrão
`true`); `rigidez` é a rigidez reduzida do γz — `separada` (vigas 0,4·EciIc, pilares 0,8·EciIc), `simetrica` (vigas 0,5)
ou `simplificada` (0,7 para os dois); `contraventamento` (`porticos`, `misto`, `paredes`) dá α1 com 4 níveis ou mais (0,5,
0,6, 0,7); `majorar` aplica 0,95·γz aos esforços horizontais das combinações do edifício quando 1,1 < γz.

`unidades.comprimento` (`cm` ou `mm`) só muda a exibição: todas as dimensões do arquivo (b, h, espessuras,
cobrimentos, c1, c2…) continuam gravadas em centímetros, qualquer que seja a escolha. Sem o campo, vale `cm`.

`els.t0` é a idade, em meses, em que a carga de longa duração passa a atuar (padrão 1); define αf da flecha
diferida pela Tabela 17.1 da NBR 6118. `uso` (`residencial`, `comercial` ou `garagem`) escolhe os fatores ψ0, ψ1 e ψ2 da Tabela 11.2 da NBR 6118;
`ggFav` é o γg das combinações com permanentes favoráveis. Arquivos até a 0.9, sem `ggFav`, `psi0` e `psi1`,
recebem esses valores pelo `uso`. As combinações (ELU1…, QP, FREQ1…, RARA1…) não são gravadas: são geradas
a partir desses coeficientes a cada cálculo (`src/engine/combinacoes.js`).

## Elementos

Todos os elementos compartilham estes campos:

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | texto | Identificador interno único (não muda ao renomear) |
| `modulo` | texto | Módulo que calcula o elemento, ex.: `concreto.viga` |
| `codigo` | texto | Código de prancha: `V1`, `L2`, `P3` |
| `nome` | texto | Nome livre |
| `resultado` | objeto ou `null` | Último cálculo (pode ser recalculado a qualquer momento) |
| `posicao` | objeto (opcional) | Lugar do elemento na montagem: `{ pavimento, x, y, angulo }` — ver abaixo |

Os demais campos dependem do módulo.

## Pavimentos e montagem

`pavimentos` lista os níveis da estrutura: `{ id, nome, cota, analise }`, com a cota em metros. `analise` diz como as vigas
de concreto do pavimento são calculadas: `isolada` (padrão, quando o campo falta) ou `grelha`.
O pé-direito de um nível é a diferença para o nível de baixo (ou a própria cota, no mais baixo).
Arquivos sem `pavimentos` ganham um nível ao abrir, e os elementos ficam sem posição.

`posicao` coloca o elemento na planta de um pavimento, em metros e graus, no sistema
global (x para a direita, y para cima):

| Tipo | (x, y) | ângulo |
|---|---|---|
| Laje | canto da borda esquerda com a inferior | direção de `lx` (das nervuras/vigotas nas lajes em uma direção) |
| Viga | apoio 1 | direção do eixo; o comprimento é a soma dos vãos |
| Pilar | centro da seção | direção de `bx` |

Lajes e vigas ficam com a face superior na cota do pavimento; o pilar chega à cota do seu
pavimento vindo de baixo, com o seu `comprimento`.

A montagem só ajuda a criar as ligações: o cálculo continua usando as cargas do tipo
`elemento` (abaixo). "Conectar automaticamente" cria as cargas que a geometria indica —
borda vinculada de laje sobre o eixo de uma viga (nos vãos que ela cobre), apoio de viga
sobre o centro de um pilar do mesmo pavimento, e pilar sobre pilar do nível de baixo
(ligação `base`), com tolerância de 10 cm.

### Bitolas (`armadura`)

Os elementos de concreto armado guardam em `armadura` a bitola escolhida para cada posição,
em mm (`5`, `6.3`, `8`, `10`, `12.5`, `16`, `20`, `25`, `32`), ou `"auto"` para o programa
escolher a de menor consumo que atende à norma. Uma bitola escolhida que não serve (não cabe
na seção, passa de h/8 ou b/8, exige espaçamento abaixo do mínimo, estribo menor que ø/4)
deixa o elemento como "não atende", com um aviso explicando o motivo.

| Módulo | Posições |
|---|---|
| `concreto.viga` | `inferior` (positivas), `superior` (negativas), `estribo` |
| `concreto.laje.macica` | `inferior` (positivas), `superior` (negativas) |
| `concreto.laje.trelicada` | `adicional` (barras na vigota, além da treliça), `superior` (negativa na capa) |
| `concreto.laje.nervurada` | `nervura` (barras das nervuras), `superior` (negativa na mesa) |
| `concreto.pilar` | `longitudinal`, `estribo` |

Vigas de arquivos até a versão 0.6 têm só `armadura.phiT`; nelas o estribo continua automático.

### Planta de fundo e eixos da montagem (`plantasFundo`, `pavimento.fundo`, `eixos`)

A partir da 0.32, a planta de arquitetura importada de um DXF fica no arquivo, nas unidades do desenho:

```json
"plantasFundo": [{ "id": "pl1", "nome": "arquitetura.dxf", "unidade": "mm",
  "camadas": ["A-PAREDE", "A-PORTA"], "entidades": [{ "c": 0, "p": [0, 0, 8150, 0, 8150, 10150], "f": 1 }],
  "textos": [{ "c": 1, "x": 3500, "y": 2500, "h": 250, "r": 0, "t": "SALA" }], "limites": { "x0": 0, "y0": 0, "x1": 8150, "y1": 10150 } }],
"pavimentos": [{ "id": "pav1", "nome": "1º pavimento", "cota": 3,
  "fundo": { "planta": "pl1", "unidade": "mm", "dx": -0.075, "dy": -0.075, "rotacao": 0, "opacidade": 55, "ocultas": ["A-MOBILIA"], "visivel": true } }],
"eixos": { "x": [0, 4, 8], "y": [0, 5, 10] }
```

`entidades` são linhas poligonais (`p`: x0, y0, x1, y1… — arcos, círculos e blocos já vêm em segmentos; `f`: 1 se
fechada) e `c` é o índice da camada. No pavimento, `dx`/`dy` (m) e `rotacao` (°) levam o desenho, já convertido
para metros, à posição da montagem. Até a 0.64 os eixos eram posições em metros: em `x`, as linhas verticais
(1, 2, 3…); em `y`, as horizontais (A, B, C…). Esse formato continua sendo lido.

Desde a 0.65 os eixos podem ser verticais, horizontais ou inclinados, e as cotas entre eixos ficam no arquivo:

```json
"eixos": {
  "lista": [{ "id": "e1", "p": [0, 0], "ang": 90 }, { "id": "e2", "p": [4, 0], "ang": 90 },
            { "id": "e3", "p": [0, 0], "ang": 0, "nome": "A" }, { "id": "e4", "p": [0, 0], "ang": 45 }],
  "cotas": [{ "id": "c1", "a": "e1", "b": "e2", "s": 1.5 }]
}
```

Cada eixo é uma reta pelo ponto `p` (m) com a direção `ang` (°, de 0 a 180: 0 horizontal, 90 vertical); `nome` é
opcional (sem ele: verticais 1, 2, 3…, horizontais A, B, C…, inclinados D1, D2…, na ordem da posição). Uma cota liga
dois eixos paralelos `a` e `b`, desenhada a `s` metros ao longo deles. Os cruzamentos (nós A-1, B-3…) são calculados,
não gravados. A primeira edição de eixos num arquivo antigo grava a `lista` no lugar de `x`/`y`. Mostrar ou ocultar
os eixos é preferência da tela, não vai para o arquivo.

### Otimização das bitolas (`otimizacao`)

A partir da 0.30, vigas, pilares, lajes maciças, escadas e reservatórios de concreto podem guardar um critério de
otimização:

```json
"otimizacao": "bitolas"
```

`"bitolas"` busca o menor número de bitolas diferentes no elemento (no empate, o menor peso de aço), `"aco"` o menor
peso de aço (no empate, o menor número de bitolas) e `"segmentos"` (0.31) o menor número de segmentos de barra — peças
cortadas das barras de 12 m — com até `otimizacaoLimiteAco` % a mais de aço que a escolha automática (padrão 10). Sem o campo, não há otimização. O cálculo varia só as posições
em `"auto"` — as bitolas escolhidas em `armadura` ficam como estão — e o resultado traz `otimizacao` com o critério,
a escolha adotada por posição (`escolha`), o peso (`kg`, pela lista de ferros, sem perdas), as bitolas e os `segmentos`, a mesma
medida sem otimização (`base`) e o número de combinações calculadas (`avaliadas`). Detalhes em
[OTIMIZACAO.md](OTIMIZACAO.md).

### Detalhamento das vigas (`detalhamento`)

A partir da 0.27, a viga pode guardar em `detalhamento` a largura dos apoios e as edições feitas na lista de ferros:

```json
"detalhamento": {
  "largura": 25,
  "edicoes": { "pos-v1-g2": { "phi": 12.5, "n": 3 }, "estribo-1": { "comprimento": 140 } }
}
```

`largura` (cm, opcional) vale para todos os apoios; sem ela, o LEBR usa a do pilar ligado na direção da viga, a
largura da viga que a recebe ou 20 cm. `edicoes` é indexado pelo `id` estável da posição (`pos-v{vão}-g{grupo}`,
`neg-a{apoio}-g{grupo}`, `porta-{n}`, `inf-v{vão}`, `pele`, `torcao-v{vão}`, `estribo-{n}`) e guarda só os campos
alterados: `phi` (mm), `n` e `comprimento` (cm). O resultado traz `detalhamento.posicoes` (com `N`, `tipo`, `face`,
`local`, `phi`, `n`, `comprimento`, `x0`/`x1` em m, `gancho` [início, fim], `ganchos`, `emendas`, `l0t`, `lb`, `al`),
`verificacoes`, `avisos` e `larguras`. Edições de posições que deixaram de existir são ignoradas.

Pilares (`concreto.pilar`) e lajes maciças (`concreto.laje.macica`) guardam as edições no mesmo formato
(`detalhamento.edicoes`). Ids dos pilares: `long`, `arranque`, `estribo`, `grampo-{x|y}-{n}`; das lajes: `pos-x`, `pos-y`,
`neg-{borda}-{n}`, `dist-{borda}-{n}`. O detalhamento deles não fica no resultado: é refeito a partir do resultado e das
ligações sempre que é exibido.

`parametros.perdasAco` (%, padrão 10) é a perda de aço somada no resumo por bitola dos quantitativos e do detalhamento.

### `concreto.viga`

```json
{
  "secao": { "b": 15, "h": 40 },
  "vaos": [{ "L": 4.0 }, { "L": 3.5 }],
  "apoios": ["apoio", "apoio", "apoio"],
  "pesoProprio": true,
  "armadura": { "inferior": "auto", "superior": 12.5, "estribo": "auto" },
  "cargas": [
    { "id": "c1", "tipo": "distribuida", "natureza": "g", "valor": 5, "vao": "todos" },
    { "id": "c2", "tipo": "concentrada", "natureza": "q", "valor": 10, "vao": 0, "posicao": 2.0 },
    { "id": "c3", "tipo": "alvenaria", "material": "ceramico-vedacao", "espessura": 14, "revestimento": 1, "altura": 2.6, "aberturas": 0, "vao": "todos" },
    { "id": "c4", "tipo": "elemento", "elementoId": "l1", "ligacao": "y0", "vao": 0 }
  ]
}
```

`apoios` tem um item a mais que `vaos`; valores: `apoio`, `engaste`, `livre` (só nas extremidades).

Torção distribuída (`torcao`, só na viga de concreto): `{ "tipo": "torcao", "natureza": "g", "valor": 2, "vao": "todos" }`,
com `valor` em kN·m/m. Lajes em balanço transmitem, além de `{g, q}`, o campo `t: {g, q}` (kN·m/m) na ligação
do engaste, e a viga o soma como torção de equilíbrio.

Carga de parede (`alvenaria`, também na viga de madeira): `material` é um tipo da Tabela 2 da NBR 6120:2019
(ids em `src/engine/cargas.js`, por exemplo `ceramico-vedacao`, `concreto-vedacao`, `celular`, `concreto-estrutural`,
`tijolo-macico`), `espessura` é a espessura nominal do bloco (cm), `revestimento` é 0, 1 ou 2 cm por face,
`altura` em m e `aberturas` em % da parede (descontadas do peso). A carga é peso por área × altura × (1 − aberturas).
Arquivos até a versão 0.8 trazem `{ "espessura", "altura", "peso" }` sem `material`: continuam valendo como
γ·e·h, com `peso` em kN/m³.

### `concreto.laje.macica`

```json
{
  "lx": 4, "ly": 5, "h": 10,
  "bordas": { "x0": "apoiada", "x1": "engastada", "y0": "apoiada", "y1": "apoiada" },
  "pesoProprio": true,
  "cargas": {
    "uso": "res-sala", "acidental": 1.5,
    "revestimento": 0.96, "outras": 0,
    "composicao": { "contrapiso": 3, "piso": "ceramico", "pisoEsp": 1, "teto": "gesso", "tetoEsp": 1, "forro": "nenhum" }
  }
}
```

Cargas concentradas para a punção (opcional, só na laje maciça):

```json
"cargasConcentradas": [
  { "id": "p1", "descricao": "Pilar P5", "posicao": "interna", "c1": 25, "c2": 25, "g": 90, "q": 40, "phi": "auto" }
]
```

`posicao`: `interna`, `borda` (junto a uma borda livre; `c1` perpendicular à borda, `c2` paralelo) ou `canto`.
`c1` e `c2` em cm; `g` e `q` são as forças características em kN; `phi` é a bitola dos conectores (mm) ou `"auto"`.
O resultado traz `puncao`: para cada carga, `FSd`, `d`, `rho`, `C`, `C1` (C'), `C2` (C'') com `u`, `tauSd`,
`tauRd`, `ok`, e `armadura` (`null` quando dispensada).

Cargas das lajes (todos os tipos e o entrepiso de madeira): o cálculo usa só os números `acidental`, `revestimento`
e `outras` (kN/m²). `uso` (opcional) diz de qual linha da Tabela 10 da NBR 6120:2019 veio a carga acidental;
`composicao` (opcional) guarda as camadas que somaram o `revestimento` (espessuras em cm; ids de piso, teto e forro
em `src/engine/cargas.js`). Sem esses campos, os números valem como foram digitados.

Cada borda: `apoiada`, `engastada` ou `livre` (sem apoio). Ligações (para cargas em vigas): `x0` esquerda, `x1` direita, `y0` inferior, `y1` superior; bordas livres não são ligações.

### `concreto.pilar`

```json
{
  "bx": 20, "by": 30, "comprimento": 2.8,
  "le": { "x": null, "y": null },
  "pesoProprio": true,
  "momentos": { "x": { "A": 0, "B": 0 }, "y": { "A": 0, "B": 0 } },
  "cargas": [
    { "id": "c1", "tipo": "concentrada", "natureza": "g", "valor": 300 },
    { "id": "c2", "tipo": "elemento", "elementoId": "v1", "ligacao": "apoio-1" }
  ]
}
```

`le` nulo significa comprimento de flambagem igual a `comprimento`.

`forma` (0.33, opcional): `retangular` (padrão) ou `circular`. No pilar circular, `D` é o diâmetro (cm) e `bx` = `by` =
`D` são mantidos para os módulos que só leem a caixa da seção (montagem, quantitativos, pranchas). Arquivos antigos,
sem `forma`, continuam retangulares.

```json
{ "forma": "circular", "D": 40, "bx": 40, "by": 40, "comprimento": 3 }
```

### Bordas das lajes em uma direção

A laje treliçada, a alveolar, o entrepiso de madeira e a nervurada em uma direção usam o
mesmo campo `bordas` da laje maciça. As nervuras, vigotas ou painéis vencem o vão na direção x:

- `x0` (borda esquerda, x = 0) e `x1` (borda direita, x = L): `apoiada`, `engastada` ou `livre`.
  Uma extremidade livre é um balanço e exige a outra `engastada`; `L` é então o comprimento do balanço.
- `y0` e `y1` (bordas laterais, paralelas às nervuras): `apoiada` ou `livre`; não recebem carga
  no modelo em uma direção, e livres geram aviso de nervura ou viga de bordo.

Arquivos até a versão 0.5 usam `vinculo` (`biapoiada`, `engaste-apoio`, `biengastada`,
`balanco`); eles continuam abrindo e passam a gravar `bordas` quando uma borda é alterada.

### `concreto.laje.trelicada`

```json
{
  "L": 3.5, "largura": 3.5,
  "bordas": { "x0": "apoiada", "x1": "apoiada", "y0": "apoiada", "y1": "apoiada" },
  "he": 12, "hf": 4, "intereixo": 42, "bw": 9, "contraflecha": 0,
  "enchimento": "ceramico", "pesoEnchimento": 6.5, "trelica": "auto",
  "pesoProprio": true,
  "cargas": { "revestimento": 1.0, "acidental": 1.5, "outras": 0 }
}
```

`direcao`: sentido das vigotas na planta, `x` (padrão) ou `y`. `L` é sempre o vão das vigotas e `largura` a outra dimensão; as `bordas` são as da planta, então com `direcao: "y"` as vigotas se apoiam em `y0` e `y1` (apoio-a e apoio-b) e `x0`/`x1` são as laterais. `trelica`: `auto` ou `TR 8644`, `TR 12645`, `TR 16745`, `TR 20745`, `TR 25856`. Ligações: `apoio-a` (borda esquerda) e `apoio-b` (borda direita); uma borda livre não é ligação.

### `concreto.laje.nervurada`

```json
{
  "lx": 6, "ly": 7, "direcao": "duas",
  "bordas": { "x0": "apoiada", "x1": "apoiada", "y0": "apoiada", "y1": "apoiada" },
  "h": 30, "hf": 5, "bw": 10, "intereixo": 60,
  "enchimento": "cubeta", "pesoEnchimento": 0,
  "pesoProprio": true,
  "cargas": { "revestimento": 1.0, "acidental": 2.0, "outras": 0.5 }
}
```

`direcao`: `duas` ou `x` (nervuras vencendo lx). Cada borda: `apoiada`, `engastada` ou `livre`; em duas direções, com borda livre as reações vêm do modelo de placa; em uma direção valem as regras de bordas acima. Ligações: `x0`, `x1`, `y0`, `y1`, exceto as livres.

### `concreto.laje.alveolar`

```json
{
  "L": 7, "largura": 5, "capa": 5, "apoio": 10,
  "bordas": { "x0": "apoiada", "x1": "apoiada", "y0": "apoiada", "y1": "apoiada" },
  "painel": { "nome": "LA20 do fabricante", "h": 20, "larguraPainel": 125, "alveolos": 6,
              "peso": 2.9, "MRd": 95, "MRdNeg": 0, "VRd": 75, "EI": 16000 },
  "cargas": { "revestimento": 1.0, "acidental": 3.0, "outras": 1.0 }
}
```

`peso` em kN/m², `MRd` em kN·m/m, `VRd` em kN/m e `EI` em kN·m²/m, todos do catálogo. `MRdNeg` (kN·m/m) é o momento negativo resistente da armadura na capa ou nos alvéolos preenchidos, exigido com borda engastada ou em balanço. Ligações: `apoio-a` e `apoio-b`, exceto a borda livre.

### Elementos de madeira

Todos têm `classe` (ex.: `C24`, `D40`, `D30e`), `carregamento` (`permanente`, `longa`, `media`, `curta`, `instantanea`) e `tipo` (`serrada` ou `mlc`). A classe de umidade, γw, γg, γq e o limite de flecha ficam em `parametros.madeira`.

- `madeira.viga`: `secao {b, h}` (cm), `vaos`, `apoios`, `cargas` (como a viga de concreto), `travamento {continuo, L1}`, `apoioC` (cm). Ligações `apoio-k`.
- `madeira.pilar`: `b`, `h` (cm), `comprimento` (m), `KEx`, `KEy`, `montante`, `travamentoY` (m), `momentos {x, y}` (kN·m), `cargas`. Ligação `base`.
- `madeira.entrepiso`: `L`, `largura`, `bordas` (como nas lajes em uma direção), `vigota {b, h}`, `espacamento` (cm), `painel {tipo, espessura, peso}`, `bloqueio` (m), `apoioC` (cm), `cargas {revestimento, forro, outras, acidental}`. Ligações `apoio-a`, `apoio-b`.

### `geotecnia.sondagem`

Furo de sondagem SPT (NBR 6484:2020). Não é posicionado num pavimento: a locação fica no próprio elemento.

```json
{
  "modulo": "geotecnia.sondagem", "codigo": "SP1",
  "local": { "x": -1.5, "y": -1.5 }, "cotaBoca": 0.2,
  "data": "15/10/2026", "empresa": "", "responsavel": "", "observacoes": "",
  "nivelAgua": { "inicial": 3.5, "final": 3.6, "seco": false },
  "limite": 10.45, "paralisacao": "impenetravel",
  "camadas": [ { "id": "k1", "ate": 1.0, "solo": "aterro", "secundario": "", "cor": "marrom", "origem": "aterro", "descricao": "" } ],
  "spt": [ { "prof": 1, "n": 3, "pen": 30 }, { "prof": 10, "n": 50, "pen": 15 } ]
}
```

`local` em m na planta do projeto; `cotaBoca` em m no referencial dos pavimentos (terreno = 0). `nivelAgua` e `limite` são
profundidades a partir da boca (m); `inicial`/`final` podem ser `null`. Cada camada vai de onde a anterior termina até
`ate` (m); `solo`: `argila`, `silte`, `areia`, `pedregulho`, `organico`, `turfa`, `aterro`, `rocha`; `secundario`: `''`,
`arenoso`, `argiloso`, `siltoso`, `pedregulhoso`, `organico`, `comPedregulhos`; `origem`: `''`, `residual`, `aluvionar`,
`coluvionar`, `sedimentar`, `marinho`, `aterro`. Cada ensaio `spt` começa em `prof` (m) e tem `n` golpes para os
últimos `pen` cm (30, ou menos na paralisação: 50/10). `paralisacao`: `projeto`, `impenetravel`, `lavagem`, `outro`.

### `concreto.sapata`

Sapata isolada (NBR 6122:2019 · NBR 6118:2023, 22.6). Não é posicionada num pavimento: fica sob o pilar ligado.

```json
{
  "modulo": "concreto.sapata", "codigo": "S105", "pilarId": "p_…",
  "ap": 20, "bp": 30, "cargas": { "g": 300, "q": 80 },
  "momentos": { "x": 0, "y": 0 }, "profundidade": 1.5,
  "solo": { "modo": "informada", "tensao": 200, "sondagemId": null, "gama": 18 },
  "geometria": { "modo": "automatica", "A": 180, "B": 190, "h": 50, "h0": 25 },
  "cobrimento": 3.0, "armadura": { "phiPilar": null }
}
```

`pilarId` liga a sapata a um pilar de concreto (com ele, `ap`, `bp` e `cargas` são ignorados: valem a seção e a carga do
pilar). `momentos` (kN·m, característicos) somam-se aos do pilar; `profundidade` (m) é a base abaixo do terreno (cota 0).
`solo.modo`: `informada` (usa `tensao`, kPa) ou `spt` (estima pelo furo `sondagemId`, ou o mais próximo); `gama` é o peso
específico do reaterro (kN/m³). `geometria.modo`: `automatica` ou `manual` (usa `A`, `B`, `h`, `h0` em cm; A na direção bx do
pilar). `cobrimento` em cm; `armadura.phiPilar` (mm) é a bitola do pilar para a ancoragem (`null`: a do pilar calculado).

### `geotecnia.estaca`

```json
{ "modulo": "geotecnia.estaca", "codigo": "E1", "tipo": "helice", "secao": "circular", "D": 40, "L": 10, "topo": 1.5,
  "local": { "x": 0, "y": 0 }, "pilarId": null, "sondagemId": null, "limitarPonta": null, "cargaTrabalho": null,
  "estrutural": { "fck": null, "gc": null, "catalogo": null } }
```

`tipo`: `helice`, `escavada`, `broca`, `premoldada`; `secao` (`circular` ou `quadrada`, só pré-moldadas) com `D` o diâmetro
ou o lado (cm); `L` (m) o comprimento e `topo` (m) a profundidade do topo abaixo do terreno (cota 0). `pilarId` põe a estaca
sob um pilar (posição e carga de trabalho dele); sem pilar, valem `local` e `cargaTrabalho` (kN, opcional). `sondagemId`:
furo usado (`null`: o mais próximo). `limitarPonta`: ponta ≤ 20 % da carga admissível (`null`: sim nas escavadas).
`estrutural`: `fck` e `gc` das moldadas in loco (`null`: os do tipo), `catalogo` (kN) das pré-moldadas.

### `concreto.bloco`

```json
{ "modulo": "concreto.bloco", "codigo": "B1", "pilarId": "p…", "ap": 20, "bp": 30, "cargas": { "g": 400, "q": 100 },
  "momentos": { "x": 0, "y": 0 }, "n": "auto", "espacamento": null, "profundidade": 1.5,
  "geometria": { "modo": "automatica", "A": 160, "B": 70, "h": 60 }, "cobrimento": 3.0,
  "estaca": { "tipo": "helice", "secao": "circular", "D": 30, "L": 8, "sondagemId": null, "limitarPonta": null,
              "estrutural": { "fck": null, "gc": null, "catalogo": null } },
  "armadura": { "phiPilar": null } }
```

`pilarId` liga o bloco a um pilar (seção, posição e cargas dele); sem pilar valem `ap`, `bp` (cm) e `cargas` (kN). `momentos`
(kN·m) são somados aos do pilar. `n`: `auto` ou 1 a 6 estacas; `espacamento` (cm) entre eixos (`null`: 3·D, ou 2,5·D nas
pré-moldadas). `profundidade` (m) do fundo do bloco abaixo do terreno; o topo das estacas fica 10 cm acima. `geometria.modo`:
`automatica` ou `manual` (`A` na direção bx do pilar, `B`, `h` em cm). `estaca`: os mesmos campos do módulo `geotecnia.estaca`.

### `concreto.escada`

```json
{ "modulo": "concreto.escada", "codigo": "ES1", "tipo": "U", "desnivel": null, "espelhoAlvo": 17.5, "piso": 28,
  "largura": 1.0, "patamar": 1.0, "vaoCentral": 0.1, "patamarInferior": 0, "patamarSuperior": 0,
  "h": 12, "revestimento": 1.0, "guardaCorpo": 0, "uso": "privativa",
  "posicao": { "pavimento": "pav2", "x": 0.075, "y": 5, "angulo": 0 }, "armadura": { "inferior": "auto" } }
```

`tipo`: `reta`, `L` ou `U`. `desnivel` (cm; `null`: pé-direito do pavimento de chegada); `espelhoAlvo` e `piso` (cm);
`largura` de cada lance, `patamar` (profundidade do intermediário da U), `vaoCentral` (entre os lances da U),
`patamarInferior` e `patamarSuperior` (m). `h` (cm) é a espessura da laje, perpendicular ao lance; `revestimento` (kN/m²),
`guardaCorpo` (kN/m); `uso`: `privativa` (2,5 kN/m²) ou `publica` (3,0 kN/m²). `posicao`: pavimento **de chegada** e o
canto do início do primeiro lance (x na largura, y no sentido de subida, `angulo` em graus).

As ligações da escada são `t1-ini`, `t1-fim`, `t2-ini`, `t2-fim` (reta: só o tramo 1). Na viga, a carga
`{ "tipo": "elemento", "elementoId": "es1", "ligacao": "t2-fim", "vao": 0, "posicao": 1.475 }` aplica a reação da faixa
(kN/m × largura do lance) como resultante concentrada a `posicao` metros do início do vão.

### `concreto.reservatorio`

```json
{ "modulo": "concreto.reservatorio", "codigo": "RS1", "tipo": "elevado", "apoio": "vigas", "a": 1.85, "b": 4.85, "H": 1.5,
  "hAgua": 1.2, "e": 15, "hf": 15, "ht": 10, "tampa": true, "revestimento": { "fundo": 0.5, "tampa": 1.0 }, "qTampa": 1.0,
  "solo": { "gama": 18, "phi": 30, "sobrecarga": 10, "sigmaAdm": 150 }, "cobrimento": 3.0, "wkLim": 0.1,
  "posicao": { "pavimento": "pav3", "x": 0, "y": 5, "angulo": 0 }, "armadura": { "phi": "auto" } }
```

`tipo`: `elevado` ou `enterrado` (este sempre apoiado no solo, com `solo`); `apoio` do elevado: `vigas` (ligações `x0`, `x1`,
`y0`, `y1` — uma por parede, lineares) ou `pilares` (ligações `canto-1` a `canto-4`, pontuais). `a`, `b`, `H`, `hAgua` em m
(internos; `a` na direção x), espessuras `e`, `hf`, `ht` em cm, `wkLim` em mm. `posicao`: pavimento em cuja cota fica o
fundo e o canto dos eixos das paredes. Uma carga de elemento numa viga pode ter `"trecho": [x0, x1]` (m no vão): a reação
linear fica só nesse trecho (parede sobre parte do vão).

Vigas invertidas são `concreto.viga` com `"invertida": true` (laje na face inferior; estribos de suspensão para as
cargas das lajes e escadas). Vigas baldrame são `concreto.viga` com `"baldrame": true` (cobrimento de contato com o solo). O pavimento criado por
**Criar nível de baldrame** tem `"tipo": "baldrame"`.

## Cargas entre elementos

Uma carga do tipo `elemento` aponta para outro elemento e para uma de suas
**ligações**. No cálculo, o módulo de origem informa as cargas características
`{ g, q }` daquela ligação. Assim a reação da laje chega à viga, e a reação da
viga chega ao pilar, sempre a partir dos dados atuais.

## Compatibilidade

- Campos desconhecidos são preservados ao abrir e salvar.
- Elementos de módulos não instalados continuam no arquivo e aparecem no explorador com aviso.
- Mudanças incompatíveis no esquema aumentam `versao` e ganham uma migração em `src/renderer/core/projeto.js`.
