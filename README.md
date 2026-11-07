# LEBR — Laboratório de Estruturas Brasil

O **LEBR** é um sistema **aberto, modular e multiplataforma** para cálculo de estruturas de concreto
armado (**ABNT NBR 6118:2023**) e de madeira (**NBR 7190-1:2022** e **NBR 16936:2023**). Desktop (Windows, macOS, Linux) em
JavaScript com Electron, interface no modelo do VS Code e projetos salvos em
**JSON aberto**.

> [!WARNING]
> **Protótipo 0.33.1 — fase inicial de desenvolvimento.** O software ainda encontra-se em estágio inicial de
> desenvolvimento e **não deve ser utilizado para cálculos reais de estruturas.**

> [!IMPORTANT]
> **Procuramos colaboradores** para criar **estudos de caso** e fazer a **validação independente de cada função**,
> com cálculos feitos **à mão ou em planilhas** comparados com os resultados do programa. Veja
> [CONTRIBUTING.md](CONTRIBUTING.md) e a [apresentação do projeto](docs/APRESENTACAO.md), com capturas de tela.

![LEBR: elemento e visualização 3D lado a lado](docs/imagens/abas-lado-a-lado-3d.png)

| | |
|---|---|
| ![Tela inicial](docs/imagens/tela-inicial.png) | ![Detalhamento de viga](docs/imagens/viga-detalhamento.png) |
| ![Montagem por pavimentos](docs/imagens/montagem.png) | ![Quantitativos](docs/imagens/quantitativos.png) |

Mais capturas e o convite para colaborar na [apresentação do projeto](docs/APRESENTACAO.md).

O que falta para chegar a projetos reais está no [roteiro](docs/ROTEIRO.md), que também abre no
programa em **Ajuda › Roteiro (road map)**.

## Como rodar

Requisitos: [Node.js](https://nodejs.org) 20 ou superior.

```bash
npm install      # instala o Electron
npm start        # abre o programa
npm run dev      # abre com as ferramentas de desenvolvedor
npm test         # testes do motor de cálculo e dos módulos (não precisa do Electron)
npm run validar  # banco de casos de validação: grava validacao/relatorio.html
```

No Windows, rode os comandos dentro da pasta que contém o `package.json`. Se o PowerShell
bloquear o `npm` ("a execução de scripts foi desabilitada"), use `npm.cmd install` e `npm.cmd start`.

Na tela inicial há quatro exemplos:

- **Abrir exemplo**: um pavimento com duas lajes, cinco vigas e seis pilares já ligados entre si.
- **Exemplo térreo com baldrame** (`exemplos/residencia-terrea-baldrame.lebr.json`): a mesma casa de um pavimento com o
  nível de baldrame — arranques sob os pilares e vigas baldrame sob as vigas da cobertura, com a parede do térreo como
  carga —, um furo de sondagem SPT e sapatas isoladas sob os arranques, com a tensão admissível pelo SPT.
- **Exemplo de 3 pavimentos** (`exemplos/edificio-3-pavimentos.lebr.json`): edifício residencial com dois
  pavimentos-tipo e cobertura, 9 pilares por lance, 7 vigas e 5 lajes maciças por nível, sacada em balanço, uma viga
  apoiada em outras duas, as vigas calculadas como grelha, uma caixa de escada com duas escadas em U (térreo → 1º e
  1º → 2º pavimento) apoiadas nas vigas, o reservatório elevado de 10,8 m³ sobre a caixa de escada, o nível de baldrame com vigas baldrame e as lajes de piso do térreo, dois
  furos de sondagem SPT e a fundação em blocos sobre estacas hélice contínua (ø 30 cm, 8 m) sob os arranques.
- **Exemplo de 18 pavimentos** (`exemplos/edificio-18-pavimentos.lebr.json`): torre residencial de 51,8 m com 16
  pilares por lance (seções reduzidas a cada 6 pavimentos), 16 vigas e 9 lajes maciças por pavimento, vigas invertidas
  com platibanda na cobertura, pilares pelo pórtico espacial com vento (NBR 6123), desaprumo e γz, dois furos de
  sondagem e blocos sobre estacas hélice contínua ø 60 cm. Com cerca de 600 elementos, o cálculo completo leva alguns
  segundos.

Tipografia: [Livvic](https://fonts.google.com/specimen/Livvic) (Fonthausen, licença OFL 1.1), embutida em
`src/renderer/assets/fonts`, então funciona sem internet.

## O que o protótipo faz

| Módulo | Cálculo |
|---|---|
| **Viga** (`concreto.viga`) | Vigas contínuas com apoios, engastes e balanços (método dos deslocamentos); cargas distribuídas, concentradas, alvenaria e reações de lajes; flexão simples e dupla (σcd = αc·ηc·fcd, NBR 6118:2023); cortante pelo modelo I; flechas com inércia de Branson e fluência; escolha de barras e estribos. |
| **Laje maciça** (`concreto.laje.macica`) | Teoria das placas por elementos finitos (elemento ACM); cada borda apoiada, engastada ou **livre** (lajes em balanço e varandas); armaduras mínimas da Tabela 19.1; cortante sem armadura (VRd1); flecha (limite 2·l/250 na borda livre); balanço com h ≥ 10 cm e γn (13.2.4.1); reações pelo processo das áreas ou, com borda livre, pelo modelo de placa. |
| **Laje treliçada** (`concreto.laje.trelicada`) | Vigotas com treliça TR (8644 a 25856) e lajota cerâmica, EPS ou bloco; nervura T com mesa colaborante (14.6.2.2); armadura da treliça (CA-60) + barras adicionais; momento negativo na capa; cortante na nervura como laje (13.2.4.2); flecha com Branson para seção T e contraflecha limitada a L/350; capa mínima; aviso de nervura de travamento; extremidades apoiadas, engastadas ou **livres** (balanço com armadura negativa na capa) e bordas laterais livres; **sentido das vigotas** em x ou em y na planta. |
| **Laje nervurada** (`concreto.laje.nervurada`) | Nervuras em uma ou duas direções com cubetas ou blocos; em duas direções, esforços de placa equivalente (14.7.7) × intereixo; nervuras T; mesa verificada à flexão para intereixo entre 65 e 110 cm; cortante como laje ou como viga conforme 13.2.4.2; flecha com rigidez equivalente; bordas apoiadas, engastadas ou **livres** (varandas), com reações pelas áreas ou, com borda livre, pelo modelo de placa. |
| **Laje alveolar** (`concreto.laje.alveolar`) | Painéis protendidos apoiados, com continuidade ou em **balanço**: verifica Md e VSd contra MRd e VRd do catálogo do fabricante e o momento negativo contra o MRd− da armadura na capa ou nos alvéolos preenchidos, vibração pela flecha das cargas acidentais (L/350, Tabela 13.3), capa como carga, número de painéis e reações nas vigas. |
| **Viga de madeira** (`madeira.viga`) | NBR 7190-1:2022: classes nativas D20–D60 e estruturais C14–C50 / D18–D70, kmod1·kmod2, vigas contínuas, flexão, cisalhamento, estabilidade lateral, compressão normal no apoio e flecha final com fluência. |
| **Pilar / montante de madeira** (`madeira.pilar`) | Esbeltez relativa, kc (βc 0,2 ou 0,1), flexocompressão com kM = 0,7, limite L0 ≤ 40·dimensão, montante de light wood frame travado pelo painel (NBR 16936:2023). |
| **Entrepiso de madeira** (`madeira.entrepiso`) | Light wood frame (NBR 16936:2023): vigotas sob painel OSB ou compensado, flexão, cisalhamento, estabilidade com bloqueadores, apoio, flecha com fluência e frequência natural; vigotas apoiadas, engastadas ou em **balanço**. Detalhes em [docs/MADEIRA.md](docs/MADEIRA.md). |
| **Pilar** (`concreto.pilar`) | Seção retangular ou circular, momento mínimo, esbeltez, 2ª ordem pelo pilar-padrão com curvatura aproximada (λ ≤ 90), flexo-compressão por compatibilidade de deformações, busca do arranjo de barras de menor área, γn para seções < 19 cm, reações vindas das vigas. |

Em vigas, lajes e pilares de concreto, a seção **Armadura** permite escolher a bitola de cada
posição (barras inferiores e superiores, estribos, barras das nervuras, longitudinais do pilar).
Em **Automática**, o programa escolhe a de menor consumo; com uma bitola escolhida, ele calcula
quantidade e espaçamento com ela e avisa se ela não servir (não cabe na seção, passa de h/8 ou
b/8, espaçamento abaixo do mínimo, estribo de pilar menor que ø/4).

### Montagem da estrutura e visualização 3D

**Estrutura › Montagem da estrutura** (`F6`) organiza o projeto em **pavimentos** (nome e cota)
e mostra a planta de cada um. Os elementos são colocados e arrastados na planta, com encaixe
nos apoios das vigas, nos cantos das lajes e nos pilares; o pavimento de baixo aparece esmaecido
como referência. **Conectar automaticamente** cria as cargas entre elementos que a geometria
indica (laje sobre viga, viga sobre pilar, pilar sobre pilar) e a lista de ligações mostra o que
coincide com a planta. **Duplicar pavimento** copia um nível inteiro para cima.
Elementos criados fora da montagem entram na lista **Não posicionados**; o botão de atualizar
(↻) ao lado do título procura os novos e os destaca para serem posicionados.

**Planta de arquitetura, eixos e malha (0.32).** No bloco **Planta de fundo, eixos e malha** da montagem,
**Importar planta DXF…** coloca a planta de arquitetura (DXF em texto, de qualquer programa de CAD) no fundo do
pavimento: linhas, polilinhas com arcos, círculos, arcos, elipses, splines, textos e blocos (portas, mobiliário,
cotas). A unidade vem do cabeçalho do DXF (ou é deduzida pelo tamanho do desenho) e pode ser trocada; a planta pode
ser deslocada (pelos campos ou arrastando), girada, esmaecida e ter camadas escondidas, e **Usar em todos os
pavimentos** repete o mesmo fundo nos outros níveis. Ao arrastar um elemento, ele **encaixa nos cantos e pontas das
linhas da planta**. Os **eixos** do projeto (verticais numerados 1, 2, 3… e horizontais A, B, C…) são digitados em
metros — ou criados pelos pilares do pavimento — e aparecem em traço-ponto com os rótulos nas bordas; os elementos
encostam neles e nos cruzamentos. A **malha de encaixe** (10, 25, 50 cm ou 1 m) leva o ponto de inserção dos
elementos para a malha quando não há outro encaixe por perto. A planta fica guardada no arquivo do projeto
(`plantasFundo`, ver [docs/FORMATO.md](docs/FORMATO.md)).

**Estrutura › Visualização 3D** (`F7`) mostra a estrutura montada com as dimensões reais, com
cores por verificação (atende / não atende / não calculado), por material ou por tipo, pavimentos
que podem ser ocultados ou afastados, e clique para abrir o elemento. A visualização usa o
[Three.js](https://threejs.org) (licença MIT), embutido em `src/renderer/assets/vendor/three`.

As cargas fluem entre elementos: **laje → viga → pilar**. Ao alterar uma laje, as
vigas e pilares que dependem dela ficam marcados como desatualizados.

### Códigos e organização

Na árvore do explorador, vigas, lajes e pilares ficam sempre em **ordem alfabética natural** dos
códigos (V1, V2, … V10). O código de qualquer elemento pode ser trocado em **Editar código e nome…**
(`F2`, menu de contexto da árvore ou botão **Código…** na montagem); o programa recusa códigos
repetidos, e as cargas entre elementos continuam ligadas porque usam o identificador interno.
Com o botão de camadas no topo do explorador (ou **Exibir › Agrupar elementos por pavimento**), os elementos
posicionados na montagem — vigas, lajes, pilares, escadas, reservatórios — ficam **agrupados por pavimento**, de cima
para baixo, com a quantidade e o estado do cálculo de cada grupo; os sem posição vão para o fim. Com mais de quatro
pavimentos os grupos começam recolhidos, e o do elemento aberto se abre sozinho. A escolha fica gravada.
Cada elemento tem **duas bolinhas** no explorador. A primeira é o **cálculo** (verde atende, terracota não atende, anel
quando não calculado ou desatualizado). A segunda é a **montagem**: **anel vazio** se o elemento ainda não foi
posicionado, **verde** se está posicionado e todos os apoios e ancoragens conferem com a planta, e **vermelha** quando
algo da montagem está errado — uma borda de laje ou um apoio de viga sem elemento que o receba, a base de um pilar
solta acima da fundação, uma ligação que não confere mais com as posições, uma ligação que a planta indica e ainda não
foi aplicada (Conectar automaticamente), pavimento inexistente ou pilar com comprimento diferente do pé-direito.
Passe o mouse para ver o motivo; na tela do elemento, o aviso "Montagem: n problemas" abre a montagem. Os grupos
seguem a mesma regra (vermelho se algum tem erro). Vigas apoiadas em outra viga e patamares intermediários de escada
não contam como erro; sapatas e blocos contam pelo pilar ligado.
A **barra de status** (inferior) muda de cor com a situação do projeto: **verde musgo** (#556b2f) quando todos os
elementos estão calculados e atendem, **terracota** quando algum não atende, tem erro de cálculo ou erro de montagem,
e **cinza chumbo** (#555151) enquanto há elementos não calculados ou desatualizados, ou nenhum projeto aberto. O
motivo aparece ao passar o mouse; `Shift+F5` calcula todos.

![As três cores da barra de status](docs/imagens/barra-de-status.png)

Na montagem, as listas podem ser ordenadas por código (A–Z), por tipo ou por ordem de criação.
**Duplicar** cria a cópia sem posição (ela aparece em "Não posicionados") e sem as reações de
outros elementos, para não contar a mesma carga duas vezes.

### Console de comandos (JavaScript)

**Exibir › Console de comandos** (`Ctrl+Shift+Y`) abre, no painel inferior, um console que executa
JavaScript com funções para montar a estrutura por linha de comando. `ajuda()` lista tudo:

```js
for (const [x, y] of [[0, 0], [4, 0], [0, 5], [4, 5]]) pilar({ bx: 20, by: 20, N: 150, em: [x, y] })
viga({ codigo: 'V1', b: 15, h: 40, vaos: [4], em: [0, 0] })
viga({ b: 15, h: 40, vaos: [5], x: 0, y: 0, angulo: 90 })
laje({ lx: 4, ly: 5, h: 10, bordas: 'aaaa', acidental: 2, em: [0, 0] })
conectar()          // ligações pela planta
calcular()          // todos; calcular('V1') para um
elementos('V')      // lista as vigas
alterar('V1', { h: 50 }); mover('P1', 4, 0); renomear('V1', 'V10'); excluir('V3')
```

Também há `trelicada()`, `nervurada()`, `alveolar()`, `vigaMadeira()`, `pilarMadeira()`,
`entrepiso()` e `criar(tipo, {...})` (tipo pelo apelido, sigla ou id do módulo), além de
`pavimento(nome, cota)`, `pavimentos()`, `resultado(cod)`, `abrir(cod)`, `montagem()`, `ver3d()`,
`desfazer()` e `limpar()`. `porticoExemplo()` e `portico()` resolvem pórticos espaciais avulsos (sem alterar o projeto). Cada comando entra no desfazer (`Ctrl+Z`). Variáveis atribuídas sem
`var/let/const` ficam guardadas entre comandos; ↑ ↓ percorrem o histórico. A API está em
`src/renderer/core/script.js`. Para isso a página permite `eval` (`'unsafe-eval'` na política de
segurança); o programa não carrega conteúdo da internet, e o código do console roda só no seu
computador, como os módulos externos.

### Exportar em PDF

Qualquer elemento pode ser exportado como PDF A4 com a página inteira: dados de entrada,
desenhos, cargas, resultados, verificações e memorial de cálculo. Use o botão **Exportar PDF**
na barra do elemento, **Arquivo › Exportar elemento em PDF…** (`Ctrl+E`) ou o menu de contexto
do elemento no explorador ou na aba. O PDF sai sempre no tema claro, com o elemento recalculado
se os dados tiverem mudado, e cada folha traz o nome do projeto e do elemento no cabeçalho e a
versão, a norma, a data de emissão e a paginação no rodapé. A aparência da folha fica em
`src/renderer/styles/impressao.css`.

### Catálogo de cargas (NBR 6120:2019)

Nas lajes, o campo **Uso do ambiente** preenche a carga acidental pela Tabela 10 (dormitório, área de serviço,
varanda, corredor de uso comum…) e o revestimento pode ser **composto por camadas** — contrapiso, piso, gesso
ou reboco no teto e forro — com os pesos específicos da Tabela 1. Nas vigas, a carga de **parede** usa o tipo de
bloco, a espessura e o revestimento da Tabela 2, a altura e a porcentagem de aberturas. As tabelas ficam em
**Ajuda › Catálogo de cargas**. Fontes e valores a conferir: [docs/CARGAS.md](docs/CARGAS.md).

### Casos de carga e combinações (NBR 8681 · NBR 6118, 11.7 e 11.8)

As ações ficam separadas em casos — G (permanentes: peso próprio e demais) e Q (variável de uso) —, e o LEBR
gera as combinações últimas normais (permanentes desfavoráveis 1,4 ou favoráveis 1,0, variável presente ou
omitida) e as de serviço (quase permanente, frequente e rara), com ψ0, ψ1 e ψ2 pelo uso da edificação
(Tabela 11.2). Vigas de concreto e de madeira dimensionam pela **envoltória** das combinações últimas e
mostram, em cada vão e apoio, qual combinação governa; o pilar mostra a combinação do Nd. Nos diagramas da viga,
cada painel traz a legenda das linhas: no momento fletor e na cortante, a **linha contínua** é o máximo de cada seção
entre as combinações (MSd,máx e VSd,máx, que dimensionam os positivos) e a **tracejada** é o mínimo (MSd,mín e
VSd,mín, que dimensionam os negativos); o torçor é pontilhado e a linha elástica da flecha, tracejada. Em
**Parâmetros do projeto › Ações e combinações** ficam os coeficientes e a lista das combinações.

### Serviço das vigas: fissuras e flechas (NBR 6118, 17.3)

Cada vão e apoio de viga verifica a **abertura de fissuras** wk pelas duas expressões de 17.3.3.2, barra a
barra, com o momento da combinação frequente e o limite da Tabela 13.4 pela classe de agressividade
(0,4 mm na CAA I, 0,3 mm nas CAA II e III, 0,2 mm na CAA IV). A **flecha** aparece separada em imediata
(Branson), diferida (αf da Tabela 17.1, pela idade no carregamento definida em Parâmetros do projeto) e total
(l/250), além da flecha só da carga acidental (l/350, vibrações). Detalhes: [docs/ELS.md](docs/ELS.md).

### Torção nas vigas (NBR 6118, 17.5)

A viga recebe momento torçor de duas formas: uma carga **Torção distribuída** (kN·m/m, permanente ou
variável), para marquises e consolos, ou automaticamente pela **reação de uma laje em balanço** apoiada nela
(o momento do engaste vira torção de equilíbrio; o engaste entre lajes contínuas é torção de compatibilidade
e não entra). O cálculo usa a treliça espacial com bielas a 45°: seção vazada equivalente, TRd2, estribos
A90/s somados aos de cortante, armadura longitudinal Asl no perímetro e a verificação combinada
VSd/VRd2 + TSd/TRd2 ≤ 1. O diagrama de momento torçor aparece junto dos demais.

### Flexão oblíqua nos pilares (NBR 6118, 17.2 e 11.3.3.4.3)

O pilar calcula a curva de interação Mx–My do arranjo de barras para a normal de cálculo, com a linha
neutra em todas as direções (compatibilidade de deformações, diagrama retangular com 0,9·σcd quando a
linha neutra é inclinada). A curva precisa conter os pontos de topo e base (1ª ordem), da seção
intermediária (com a 2ª ordem local do pilar-padrão) e toda a envoltória mínima com 2ª ordem
(elipse de 11.3.3.4.3). O resultado mostra o diagrama com a curva, a elipse e os pontos, e o uso de cada ponto.

### Punção nas lajes maciças (NBR 6118, 19.5)

A laje maciça aceita **cargas concentradas** (um pilar apoiado nela, um equipamento) com a área carregada
c1 × c2, a posição (interna, junto a uma borda livre ou num canto) e as parcelas Fg,k e Fq,k. Cada uma é
verificada nos contornos críticos: C, na face (compressão diagonal, τRd2); C', a 2d (τRd1, com
ρ = √(ρx·ρy) das barras inferiores adotadas e d médio das duas camadas); e, quando C' não atende,
a armadura de punção (conectores em linhas radiais, sr ≤ 0,75d, s0 ≤ 0,5d, fywd de 250 a 435 MPa pela
espessura) e o contorno C'' além da última linha. Nas bordas e cantos valem os perímetros reduzidos u*.
O resultado mostra a planta dos contornos com os conectores e a tabela C / C' / C''. O mesmo motor
(`engine/puncao.js`) será usado pelas sapatas e pelos blocos.

### Motor de pórtico espacial

Análise linear de estruturas de barras com 6 graus de liberdade por nó (método dos deslocamentos): nós
com apoios engastados, rotulados, parciais ou elásticos; barras com seção b × h ou propriedades diretas,
liberações nas extremidades (rótulas), cargas distribuídas e concentradas em eixos globais ou locais, cargas
nodais e casos de carga combináveis. Confere o equilíbrio e aponta o nó e o grau de liberdade quando a
estrutura é hipostática. Nesta versão ele é usado pelo console — `porticoExemplo()` ou `portico()` para
montar um modelo à mão —; nas próximas etapas resolve a grelha do pavimento e o pórtico do edifício.
Convenções e exemplos: [docs/PORTICO.md](docs/PORTICO.md).

### Grelha de pavimento (NBR 6118, 14.7.6)

Cada pavimento escolhe como as vigas de concreto são analisadas: **Vigas isoladas** (cada uma como viga
contínua sobre apoios rígidos, como antes) ou **Grelha** — a escolha fica na montagem, no quadro do
pavimento, e também na seção *Grelha do pavimento* do resultado de cada viga. Na grelha, as vigas do
pavimento são resolvidas juntas pelo motor de pórtico: onde uma viga se apoia em outra sem pilar, a reação
passa de uma para a outra; os pilares entram com molas de rotação (4·E·I/ℓ por lance, engastamento elástico);
a torção das vigas usa 15 % da rigidez elástica; as cargas são as mesmas das vigas isoladas (lajes, paredes,
concentradas, torção dos balanços). O resultado de cada viga mostra os dois cálculos lado a lado (Md+, Md−
e Rd isolada × grelha) e as forças nos encontros com outras vigas; a montagem desenha os nós da grelha e a força
de cada viga apoiada em viga. `grelha()` no console mostra o modelo resolvido. Detalhes em [docs/PORTICO.md](docs/PORTICO.md).

### Pórtico espacial do edifício (NBR 6118, 14.6)

A partir da montagem, o LEBR gera um pórtico espacial com os pilares de concreto de todos os lances
(engastados na fundação; o de cima nasce no topo do de baixo) e as vigas de concreto de cada pavimento, com as
mesmas cargas da grelha; as lajes entram como **diafragma rígido** em cada pavimento. Em
**Parâmetros do projeto › Análise global**, os pilares podem usar as **cargas dos elementos** (como antes) ou o
**pórtico espacial** — normal e momentos de 1ª ordem nas pontas de cada lance. O resultado de cada pilar mostra
a prumada inteira, lance a lance, e a conferência das cargas verticais (soma dos pavimentos × reações na
fundação). Na **Visualização 3D**, a opção *Deformada* desenha o pórtico deformado (G, Q ou G + Q) com a
mesma tabela de cargas. `porticoEdificio()` no console mostra o modelo resolvido.

### Vento (NBR 6123)

**Estrutura › Vento (NBR 6123)** (F8) reúne os dados do vento do projeto: velocidade básica V0 lida no mapa de
isopletas (com o local de referência), fator topográfico S1, categoria de rugosidade (I a V), classe da
edificação (automática pela maior dimensão ou escolhida) e grupo de uso (S3). Pela planta e pela altura do
edifício, o LEBR estima o coeficiente de arrasto Ca em cada direção (l1/l2 e h/l1, vento de baixa turbulência) —
o valor lido no ábaco da norma pode ser informado no lugar da estimativa. A tela mostra S2, Vk e q por pavimento,
a força em cada direção, o cortante e o momento de tombamento na base. Com *Considerar o vento* ligado, as forças
entram no pórtico espacial do edifício como os casos **V1 a V4 (0°, 90°, 180° e 270°)**, aplicadas no diafragma de
cada pavimento, e as combinações do edifício passam a incluir o vento (as quatro direções nunca aparecem juntas);
a tela confere as reações horizontais na fundação. Os pilares em *Pórtico espacial* são dimensionados pela
combinação determinante (maior normal, maior e menor tensão) e mostram os esforços característicos de cada caso de
vento. Na **Visualização 3D**, *Forças de vento* desenha as setas por pavimento e a deformada mostra V1 a V4.
`vento()` no console lista as forças. Os valores de S2 e S3 são os da NBR 6123:1988 — a norma foi revisada em
2023 e os parâmetros devem ser conferidos na edição em vigor. Detalhes em [docs/VENTO.md](docs/VENTO.md).

### Imperfeições e estabilidade global (NBR 6118, 11.3.3.4.1 e 15.5)

**Estrutura › Estabilidade global** (F9) avalia o edifício montado nas duas direções:

- **Desaprumo global**: θ1 = 1/(100·√H) entre 1/300 e 1/200, θa = θ1·√((1 + 1/n)/2) com n pilares na fundação, e a
  força θa·(G + Q) em cada nível. O momento do desaprumo na base é comparado com o do vento: com 30 % do vento acima do
  desaprumo fica só o vento; com o vento abaixo de 30 % do desaprumo, só o desaprumo; nos demais casos os dois somam
  (sem θ1,mín). A ação resultante de cada direção vira os casos V1 a V4 do pórtico. Vem ligado por padrão.
- **Parâmetro α** = H·√(Nk/(Ecs·Ic)), com a rigidez do pilar equivalente tirada do deslocamento do topo do pórtico
  (seções brutas), comparado com α1 (0,2 + 0,1·n até 3 níveis; 0,5, 0,6 ou 0,7 conforme o contraventamento).
- **Coeficiente γz** com a rigidez reduzida (vigas 0,4·EciIc e pilares 0,8·EciIc, ou 0,7 para os dois), o maior entre
  as combinações últimas da direção. γz ≤ 1,1: nós fixos; até 1,3 os esforços horizontais das combinações do edifício são
  majorados por **0,95·γz**; acima de 1,3 o LEBR avisa que é preciso P-Δ (Fase 2). Com menos de 4 andares a
  classificação segue o α (15.5.3).

Os pilares em *Pórtico espacial* recebem as ações horizontais e a majoração; o resultado de cada um mostra γz e α e
repete o aviso quando γz passa de 1,3. Detalhes em [docs/ESTABILIDADE.md](docs/ESTABILIDADE.md).

### Sondagem SPT (NBR 6484:2020)

Cada furo de sondagem é um elemento do projeto (**Novo: Sondagem SPT**, categoria *Sondagens* no explorador), gravado no
mesmo arquivo `.lebr.json`. Cadastra-se a locação na planta (x, y) e a cota da boca, as camadas (até que profundidade,
solo principal e fração secundária, cor, origem), o NSPT de cada metro (golpes nos últimos 30 cm, ou golpes/penetração
na paralisação, como 50/10), os níveis d'água inicial e final (ou furo seco), o limite e o critério de paralisação. O
LEBR desenha o **perfil individual** — escala de profundidade e cotas, coluna com a hachura de cada solo, nível d'água,
NSPT por metro e o gráfico NSPT × profundidade, descrição das camadas — já na entrada e no resultado (e no PDF), classifica
a compacidade ou a consistência de cada camada pelo NSPT (Anexo A) e confere o boletim (camadas até o fim do furo, um ensaio
por metro, NA registrado). Os furos aparecem marcados na planta da montagem; as sapatas e estacas das próximas etapas
vão buscar o furo mais próximo. Detalhes em [docs/SONDAGEM.md](docs/SONDAGEM.md).

### Viga invertida (NBR 6118, 18.3.6)

No editor da viga, **Viga invertida** indica que a laje se apoia na face inferior e a viga sobe acima do piso (platibandas,
vigas de cobertura, vãos livres sob o forro). As reações das lajes e das escadas apoiadas nela ficam penduradas: o LEBR
soma aos estribos da cortante a **armadura de suspensão** Asw,susp/s = pd/fywd por vão e indica, nas reações concentradas
(escadas), a área de estribos a concentrar junto à carga. A seção desenhada mostra a laje embaixo, a planta da montagem
desenha a viga tracejada (fica acima da laje, como na planta de fôrmas) e o 3D a coloca com a face inferior na da laje.

### Sapata isolada e viga baldrame (NBR 6122:2019 · NBR 6118:2023, 22.6)

**Sapata isolada** (categoria *Fundações*): ligada a um pilar que chega à fundação, recebe a carga característica dele
(das cargas dos elementos ou, com os pilares em pórtico, a normal e os momentos G + Q do pórtico na base). A tensão
admissível é informada ou **estimada pelo SPT** do furo mais próximo (σadm = 20·N kPa, N médio no bulbo de 2·B abaixo
da base). Com as dimensões automáticas, o LEBR acha A e B com balanços iguais (múltiplos de 5 cm, mínimo 60 cm) até a
tensão média, a de borda (≤ 1,3·σadm) e a excentricidade atenderem, e a altura de sapata **rígida** (h ≥ (a − ap)/3) que
ancora as barras do pilar; com as dimensões informadas, a sapata pode ser **flexível**. Verifica a flexão (CEB-70, nas duas
direções, com a malha de barras), a compressão diagonal no contorno C e, nas flexíveis, a **punção** em C′ (com a reação do
solo descontada) e o cortante como laje. **Estrutura › Criar sapatas nos pilares da fundação** (ou o ícone na montagem)
cria e liga uma sapata sob cada pilar que ainda não tem; elas aparecem tracejadas na planta e no 3D.

**Viga baldrame**: **Novo › Viga baldrame** cria uma viga de concreto marcada como baldrame — cobrimento de elemento em
contato com o solo (NBR 6118, Tabela 7.2) e a parede do térreo como carga; qualquer viga pode ser marcada no editor.
**Estrutura › Criar nível de baldrame** monta o conjunto: um pavimento *Baldrame* na base dos pilares do pavimento mais
baixo, um arranque sob cada pilar (até a sapata), uma viga baldrame sob cada viga do pavimento de cima e as ligações; as
sapatas existentes passam para os arranques. Detalhes em [docs/FUNDACOES.md](docs/FUNDACOES.md).

### Estacas (NBR 6122)

**Estaca isolada** (categoria *Fundações*): hélice contínua, escavada mecanicamente, broca ou pré-moldada (circular ou
quadrada), com diâmetro, comprimento e profundidade do topo. Pelo furo de sondagem mais próximo (ou o escolhido), o LEBR
calcula a capacidade de carga pelos dois métodos semiempíricos — **Aoki-Velloso** (K e α por solo, F1 e F2 de Cintra e
Aoki) e **Décourt-Quaresma** (C, α e β de Décourt) —, a ponta e o atrito trecho a trecho, e a **carga admissível** com o
fator de segurança 2 da NBR 6122 para métodos semiempíricos, limitando a ponta das escavadas a 20 % da carga admissível. A
carga adotada é a menor entre os dois métodos e a carga estrutural (0,85·fck/γc·A/1,4 nas moldadas in loco; catálogo nas
pré-moldadas). A curva carga admissível × comprimento mostra o efeito de alongar a estaca e, com uma carga de trabalho (ou
um pilar ligado), o menor comprimento que atende. Detalhes em [docs/FUNDACOES.md](docs/FUNDACOES.md#estacas).

### Bloco sobre estacas (NBR 6118, 22.7)

**Bloco sobre estacas** (categoria *Fundações*): ligado a um pilar, recebe a carga dele (com os momentos) e a distribui entre
1 a 6 estacas nos arranjos usuais — em linha, triângulo, quadrado, quadrado com a central e retângulo 3 × 2 —, com
Ri = N/n ± M·xi/Σx². A capacidade de cada estaca sai do furo de sondagem mais próximo, como no módulo Estaca, e o número de
estacas pode ser automático (o menor que atende). O bloco é dimensionado pelo **método das bielas e tirantes** (Blévot):
altura com as bielas entre 45° e 55°, tensões nas bielas junto ao pilar e junto às estacas, tirantes sobre as estacas
(armadura principal) e malha de distribuição com 20 % da armadura principal; o bloco de uma estaca é tratado como bloco
de transição (fendilhamento). **Estrutura › Criar blocos sobre estacas** liga um bloco a cada pilar da fundação que ainda
não tem sapata nem bloco; os blocos aparecem na planta da montagem, com as estacas, e no 3D. Detalhes em
[docs/FUNDACOES.md](docs/FUNDACOES.md#bloco-sobre-estacas).

### Escadas (NBR 6118 · NBR 6120)

**Escada** (categoria *Escadas*): lance reto, em L (dois lances a 90° com patamar de canto) ou em U (dois lances
paralelos com patamar intermediário), com patamares de saída e de chegada opcionais. Pelo desnível — informado ou o
pé-direito do pavimento de chegada — o LEBR escolhe o número de espelhos e confere a fórmula de Blondel
(63 ≤ 2e + p ≤ 65 cm). Cada tramo (lance com o patamar que ele leva) é uma laje **armada longitudinalmente**, biapoiada,
com o vão na projeção horizontal: peso próprio pela espessura média hm = h/cos α + e/2, revestimento, guarda-corpo e a
carga de uso da NBR 6120; flexão, armadura de distribuição, negativa construtiva nos apoios, cortante sem estribos e flecha
com fissuração e fluência. Posicionada na montagem, a escada se liga às vigas sob as linhas de apoio dos pisos de baixo e
de chegada, e cada **viga recebe a reação** como resultante concentrada na posição do lance; os apoios sem viga (patamar
em alvenaria ou viga de patamar não modelada, terreno) ficam como externos, com a reação no resultado. A escada aparece
na planta da montagem, com os degraus e o sentido de subida, e no 3D. Detalhes em [docs/ESCADAS.md](docs/ESCADAS.md).

### Reservatórios (NBR 6118)

**Reservatório** (categoria *Reservatórios*): caixa retangular **elevada** — paredes sobre vigas ou pilares nos cantos —
ou **enterrada**, com ou sem tampa. Paredes, fundo e tampa são **placas** por elementos finitos: paredes engastadas entre
si e no fundo e apoiadas na tampa, com a **pressão hidrostática** triangular até a lâmina d'água; no enterrado, também o
caso vazio com o **empuxo de terra** em repouso (K0 = 1 − sen φ) e a sobrecarga no terreno. Os momentos negativos são
compatibilizados nas arestas, a reação de cada parede vira tração na vizinha (flexo-tração), e as armaduras de cada face
são aumentadas até a **abertura de fissuras** ficar abaixo do limite de estanqueidade (0,1 mm por padrão, mais rígido que
a Tabela 13.4). O resultado mostra a planificação com os momentos das paredes e do fundo, o corte com a lâmina d'água,
as armaduras por face e as **reações**: por metro de parede sobre as vigas — inclusive quando a parede cobre só parte do
vão — ou em cada canto sobre os pilares, com as paredes verificadas como vigas-parede e a suspensão do fundo; no
enterrado, a tensão no solo. Na montagem, **Conectar automaticamente** liga as paredes às vigas (ou os cantos aos
pilares). Detalhes em [docs/RESERVATORIOS.md](docs/RESERVATORIOS.md).

### Quantitativos

**Estrutura › Quantitativos de materiais** (ou o ícone de tabela no explorador) abre a tabela de **volume de concreto
(m³)**, **área de fôrma (m²)** e **aço por bitola (kg)**, com a taxa de aço (kg/m³), calculada da geometria de cada
elemento e das armaduras do último cálculo. A tabela agrupa **por pavimento** (com subtotais por tipo de elemento ao
abrir cada pavimento, as fundações num grupo próprio e as estacas à parte, em metros e m³), **por tipo** ou **por
elemento**, sempre com o total do projeto. **Exportar CSV** grava uma planilha no padrão brasileiro — separador `;`,
vírgula decimal, UTF-8 —, com uma linha por elemento, o subtotal de cada pavimento e o total, pronta para abrir no
Excel ou no LibreOffice. Nas vigas, o aço sai da lista de ferros do detalhamento (com as edições); nos demais
elementos, os comprimentos de barra usam ancoragens e ganchos aproximados — uma estimativa para orçamento preliminar.
Detalhes em [docs/QUANTITATIVOS.md](docs/QUANTITATIVOS.md).

### Detalhamento de vigas

Depois do cálculo, cada viga mostra a seção **Detalhamento das barras**: a **elevação** com a armação (barras dentro
da peça e cada posição desenhada à parte, com ganchos, número, quantidade, bitola e comprimento), a **lista de ferros**
numerada (N1, N2…) e o **resumo do aço por bitola** (metros, barras de 12 m e kg). O LEBR calcula a aderência (fbd), as
ancoragens básica e necessária, a **decalagem aℓ** do diagrama de momentos e corta as barras aℓ + lb além do ponto em
que deixam de ser necessárias; as duas barras de canto correm a viga e seguram os estribos. Nos apoios extremos as
barras vão até a face com **gancho a 90°**, com a verificação da ancoragem (se as de canto não bastam, mais barras
chegam ao apoio); nos internos passam 10ø da face. Barras acima de 12 m levam **emenda por traspasse**. Entram ainda
porta-estribos, estribos (com a forma), armadura de pele (h > 60 cm) e a longitudinal de torção. A largura dos apoios
vem do pilar (ou da viga que recebe) na direção da viga, ou pode ser informada. **Bitola, quantidade e comprimento**
de qualquer posição podem ser editados na própria tabela: o resumo e os quantitativos usam os valores editados, e um
novo cálculo mantém as edições. Detalhes em [docs/DETALHAMENTO.md](docs/DETALHAMENTO.md).

**Pilares e lajes maciças** também têm a seção de detalhamento. No pilar, o lance desenhado em elevação e em seção
mostra as barras longitudinais (subindo o traspasse de compressão para o lance de cima, ou até o topo no último), os
**arranques** embutidos na sapata, no bloco ou na viga em que o pilar nasce, os estribos e os **grampos suplementares**
das barras que o estribo não protege (18.2.4). Na laje, a planta de armação mostra as malhas positivas, as
**negativas** de cada borda engastada (detalhadas uma vez só entre duas lajes vizinhas, na de código menor) e a
distribuição sob elas. A lista de ferros é editável como na viga, e o **resumo do aço por bitola** soma as **perdas**
adotadas no projeto. Na tela de Quantitativos, o resumo do aço do projeto inteiro vem com as perdas (editáveis) e os
totais de CA-50 e CA-60.

**Armadura em 3D (0.32):** na seção de detalhamento da viga, do pilar e da laje maciça, **Armadura em 3D** troca o
desenho por uma vista 3D isolada das barras daquele elemento — positivas, negativas, porta-estribos, pele, estribos,
arranques, grampos, malhas e distribuição, cada tipo com uma cor, dentro do concreto transparente. Arrastar gira,
Shift+arrastar desloca e a roda aproxima; passar o mouse sobre uma barra mostra a posição (N) e destaca a linha da
lista de ferros. A visualização 3D do edifício continua sem armaduras; o PDF do elemento leva sempre o desenho 2D.

**Armadura em 3D segundo a norma (0.33):** as barras longitudinais das vigas ficam em camadas com o espaçamento livre
mínimo da NBR 6118, 18.3.2.2 — na horizontal ah ≥ máx(2 cm; ø; 1,2·dmax), na vertical av ≥ máx(2 cm; ø; 0,5·dmax) —,
com as barras corridas, construtivas e porta-estribos nos cantos do estribo e as demais igualmente espaçadas entre
elas; barras que só se cruzam nas pontas (ancoragem no apoio, traspasse) ficam encostadas, como na emenda por contato.
Nos pilares as barras seguem os pontos do dimensionamento, com espaçamento livre ≥ máx(2 cm; ø; 1,2·dmax) e entre
eixos ≤ mín(2b; 40 cm) (18.4.2.2). Os estribos são desenhados pelo eixo, contornando as barras de canto com a dobra
encostada nelas e fechando com dois ganchos de 135° de ponta reta 5·øt ≥ 5 cm voltados para o núcleo; o canto do
gancho alterna a cada estribo (nas vigas, entre os dois cantos de cima). Os grampos suplementares ficam no nível de
cada estribo, abraçando as duas barras, e os arranques encostam nas barras do lance. Abaixo da vista, uma linha resume
barras por camada e espaçamentos.

**Pilar circular (0.33):** em **Seção e comprimento**, **Forma da seção** alterna entre Retangular e Circular (campo
**Diâmetro D**). A seção circular tem A = π·D²/4, raio de giração i = D/4 (λ = 4·le/D), no mínimo 6 barras igualmente
espaçadas no contorno (18.4.2.1), espaçamento verificado pela corda entre barras vizinhas, flexão oblíqua pela curva de
interação da seção circular (resistente igual em qualquer direção) e estribos circulares com traspasse e ganchos de
135°, sem grampos. O pilar circular aparece como círculo na montagem, na planta de formas e locação das pranchas, como
cilindro na visualização 3D, com volume π·D²/4·L e forma π·D·L nos quantitativos, e entra no pórtico espacial com
I = π·D⁴/64. As sugestões de seção aumentam o diâmetro.

### Otimização das bitolas

Cada viga, pilar, laje maciça, escada e reservatório de concreto pode ser calculado com um critério de otimização,
escolhido na seção **Armadura** (controle **Otimização**) ou em **Calcular › Otimizar o elemento**:

- **Menos bitolas diferentes** — simplifica a obra: o menor número de bitolas no elemento (no empate, o menor peso);
- **Menos aço** — o menor peso de aço do elemento (no empate, o menor número de bitolas).
- **Menos segmentos de barra** — o menor número de peças cortadas das barras de 12 m (cada uma a cortar, dobrar e
  posicionar; barras acima de 12 m contam uma a mais por emenda), com até um acréscimo de aço sobre a escolha
  automática (campo **Aço a mais aceito**, 10 % por padrão).

O programa recalcula o elemento com várias combinações de bitolas nas posições em "Automática" (as escolhidas à mão
ficam), descarta as que deixam alguma verificação sem atender e mede cada uma pela lista de ferros do detalhamento.
O quadro da seção compara o elemento sem otimização e otimizado (bitolas, peso e diferença de aço), os seletores
mostram a bitola adotada ("Otimizada: ø 10 mm") e **Fixar estas bitolas** grava a escolha. **Calcular › Otimizar
todos os elementos** aplica o critério ao projeto inteiro, com o progresso na tela. No edifício de exemplo, *menos
aço* tira cerca de 3 % do aço do projeto e *menos bitolas* reduz as bitolas por elemento ao custo de cerca de 10 % a
mais de aço. Os quantitativos trazem o número de segmentos de barra por elemento, pavimento e projeto. Detalhes em [docs/OTIMIZACAO.md](docs/OTIMIZACAO.md).

### Memorial do edifício e cargas na fundação (0.32)

**Estrutura › Memorial do edifício (PDF)** reúne, numa aba que sai em PDF, os dados do projeto (materiais, CAA,
cobrimentos, coeficientes, análise global e vento), a situação do projeto (com os elementos que não atendem), as
cargas na fundação, os quantitativos e, por pavimento, cada elemento com os avisos, as verificações e o memorial de
cálculo (as duas partes podem ser desligadas para um documento mais curto). **Estrutura › Cargas na fundação (PDF)**
traz a tabela dos pilares que chegam à fundação — seção, posição, Ng, Nq, Nk e Nd e a sapata ou o bloco ligado — com
os totais e a planta de locação com a normal de cada pilar.

### Pranchas em DXF

**Arquivo › Exportar pranchas em DXF…** (`Ctrl+Shift+D`) grava, numa pasta, um arquivo DXF R12 (formato aberto, unidade
cm) por prancha: **fôrmas de cada pavimento** (eixos, cotas, seções, rótulos e nível), **locação dos pilares** com a
tabela de **cargas na fundação**, e a **armação das vigas, dos pilares e das lajes** com as tabelas de aço e o resumo
com perdas. As camadas vêm separadas (eixos, pilares, vigas, lajes, cotas, textos, armaduras por tipo…). Os arquivos
abrem no LibreCAD, QCAD e AutoCAD. Detalhes em [docs/DXF.md](docs/DXF.md).

### Banco de casos de validação

Os resultados do LEBR são conferidos com valores que não vêm do próprio programa: tabelas e
expressões da NBR 6118:2023, tabelas clássicas (Timoshenko e Woinowsky-Krieger, vigas contínuas)
e cálculo manual. São 157 casos e 511 grandezas na versão 0.28.0, cada um com a fonte e a tolerância.
`npm run validar` mostra o resumo no terminal e grava `validacao/relatorio.html`; no programa,
**Ajuda › Relatório de validação** roda os mesmos casos. Os casos também entram no `npm test`.
Formato e como incluir exemplos de livros: [docs/VALIDACAO.md](docs/VALIDACAO.md).

## Interface

- **Unidade das dimensões:** em **Parâmetros do projeto › Unidades**, cm ou mm. Muda campos, tabelas, memorial, desenhos e PDF; o arquivo e o cálculo continuam em centímetros. Áreas de aço seguem em cm², vãos em m e flechas em mm.

- Barra de menus, barra de atividades, explorador, abas, painel e barra de status, como no VS Code.
- **Tela do elemento (0.32):** a barra de cálculo fica logo abaixo do cabeçalho e acompanha a rolagem, com o
  **estado sempre à vista** (Atende; "2 verificações não atendidas" — clique para ir às verificações; Não calculado;
  Calculando…). Em telas largas, um **índice das seções** ao lado da página mostra onde se está e leva a cada seção;
  em telas estreitas, o botão **…** da barra lista as seções.
- **Instalador e atualização automática (0.33.1):** instalador do Windows (`LEBR-Setup-…-win-x64.exe`), com
  atalhos e desinstalação; o programa instalado procura novas versões nas releases do GitHub
  (github.com/danielcarli/lebr), baixa em segundo plano e oferece **Reiniciar e atualizar** — também em
  **Ajuda → Verificar atualizações**. Ver [docs/INSTALACAO.md](docs/INSTALACAO.md).
- **Ajustes da tela do elemento (0.33.1):** o estado do elemento aparece só no chip da barra de cálculo (saiu o selo
  verde repetido no canto do cabeçalho), e os textos dos gráficos — esquema da viga, diagramas de momento, cortante,
  torção e flecha, curva de interação do pilar e curva da estaca — têm o dobro do tamanho, com os espaçamentos e a
  legenda (que quebra linha quando não cabe) ajustados.
- **Como fazer atender:** quando o elemento não atende, a seção logo abaixo dos resultados propõe a **menor
  alteração** que faz todas as verificações passarem — a altura ou a largura da viga, as dimensões do pilar, a
  espessura da laje, ou voltar para "Automática" uma bitola escolhida à mão que não serve —, com o botão **Aplicar**.
- **Cálculo sem travar a janela:** os cálculos rodam num *Web Worker* (fora da linha da interface) quando o projeto
  só tem módulos internos; com módulo externo instalado, voltam a rodar na interface, como antes. "Calcular todos"
  mostra o progresso.
- **Telas pequenas:** em notebooks de 1366 × 768 ou com duas abas lado a lado, o cabeçalho, as margens e os botões
  diminuem; em telas grandes nada muda.
- **Estado além da cor:** no explorador, o losango indica problema, o círculo cheio, em ordem, e o anel, o que falta
  fazer; o botão **ⓘ** mostra a legenda, e o **funil** (ou **Exibir › Explorador: mostrar só os elementos com
  pendências**) deixa só os elementos que não atendem, estão sem cálculo ou têm erro de montagem. A barra de status
  também diz a situação em texto ("Tudo atende", "2 não atendem", "12 a calcular") — clique para filtrar.
- **Paleta de comandos** `Ctrl+Shift+P` (ou `F1`) e **ir para elemento** `Ctrl+P`.
- `F5` calcula o elemento aberto, `Shift+F5` calcula o projeto inteiro.
- `Ctrl+Shift+1` a `9` criam viga, laje maciça, pilar, laje treliçada, laje nervurada, laje alveolar, viga de madeira, pilar de madeira e entrepiso de madeira. `F2` renomeia, `Delete` exclui no explorador.
- Desfazer/refazer (`Ctrl+Z` / `Ctrl+Y`) em todas as alterações do projeto.
- **Navegar entre as abas abertas:** `Ctrl+Tab` / `Ctrl+Shift+Tab` (ou `Ctrl+PageDown` / `Ctrl+PageUp`) passam para a próxima / anterior, dando a volta no fim; `Alt+1` a `Alt+8` vão direto para a aba naquela posição e `Alt+9` para a última; `Alt+0` lista as abas abertas para escolher pelo nome; `Ctrl+W` fecha e `Ctrl+Shift+T` reabre a última aba fechada, no mesmo lugar (abas de elementos excluídos são puladas). Os atalhos com `Ctrl`/`Alt` também funcionam com o cursor no console. No macOS, `Ctrl+Tab` usa a tecla Control; os demais trocam `Ctrl` por `⌘`.
- **Duas abas lado a lado:** `Ctrl+\` (ou o ícone de divisão no fim da barra de abas) leva a aba ativa para um segundo grupo à direita; arrastar uma aba para a metade direita do editor faz o mesmo, e arrastá-la para a barra do outro lado move-a para lá (ou muda a ordem na mesma barra). O divisor entre os lados é arrastável e a largura é lembrada; `Ctrl+K` passa o foco de um lado para o outro e o menu de contexto da aba tem **Mover para a direita/esquerda** e **Juntar os lados**. Um lado que fica sem abas se fecha. Os atalhos de navegação (`Ctrl+Tab`, `Alt+1`…) valem para o lado com o foco, e com o editor dividido o que se abre a partir do 3D ou da montagem (duplo clique, "Abrir elemento") vai para o outro lado.
- **3D fixado à direita:** **Exibir › Fixar a visualização 3D à direita** (ou a chave **Fixar à direita** no painel do 3D, ou o menu de contexto da aba) mantém a visualização 3D num lado próprio, à direita, enquanto os elementos abrem à esquerda — o 3D acompanha cada alteração. A escolha é lembrada: ao abrir um projeto, o 3D já aparece à direita.
- **Painel de controles do 3D:** o botão de recolher no canto do painel (pavimentos, cores, deformada, vento, vistas) esconde-o e a cena ocupa a área toda; o botão **Controles**, no canto superior esquerdo, traz o painel de volta. O estado fica lembrado, e o comando **Exibir › Mostrar / ocultar o painel de controles do 3D** faz o mesmo pela paleta.
- Tema **Claro** e tema **Escuro** (item da barra de status ou **Exibir › Alternar tema claro / escuro**).
- Em todos os tipos de laje, cada borda alterna entre apoiada, engastada e livre com um clique na planta (nas lajes em uma direção, as bordas laterais alternam entre apoiada e livre).

## Estrutura do código

```
src/
  main/               processo principal (janela, arquivos, recentes) — CommonJS
    main.cjs  preload.cjs  recentes.cjs
  engine/             motor de cálculo puro, sem interface (testável em Node)
    materiais.js  flexao.js  cisalhamento.js  barras.js
    viga-solver.js  placa.js  flexocompressao.js  secao-t.js  madeira.js  algebra.js
    cargas.js         catálogo da NBR 6120:2019 (uso, alvenarias, pesos específicos)
    combinacoes.js    casos de carga e combinações ELU/ELS (NBR 8681, NBR 6118 11.8)
    fissuracao.js     estádio II, abertura de fissuras e fluência (NBR 6118, 17.3)
    torcao.js         torção: seção vazada equivalente e treliça espacial (NBR 6118, 17.5)
    flexao-obliqua.js curva de interação Mx–My e pontos de cálculo dos pilares (17.2)
    puncao.js         contornos C, C' e C'' e armadura de punção (19.5)
    portico.js        pórtico espacial: barras com 6 graus de liberdade por nó, diafragmas rígidos (14.6)
    vento.js          forças de vento: S1, S2, S3, pressão dinâmica, Ca e forças por pavimento (NBR 6123)
    estabilidade.js   desaprumo global, parâmetro α e coeficiente γz (NBR 6118, 11.3.3.4.1 e 15.5)
    sondagem.js       sondagem SPT: camadas, NSPT, compacidade e consistência (NBR 6484:2020)
    sapata.js         sapata isolada: σadm pelo SPT, dimensões, tensões na base, CEB-70, ancoragem
    estacas.js        estacas: Aoki-Velloso, Décourt-Quaresma, carga admissível e estrutural
    bloco.js          bloco sobre estacas: arranjos, reações, bielas e tirantes (Blévot)
    escada.js         escadas: degraus, geometria (reta, L, U), cargas e tramos biapoiados
    reservatorio.js   reservatórios: placas com pressão hidrostática, compatibilização, empuxo, viga-parede
  modules/            módulos de elementos (cada um: index.js + calculo.js)
    concreto-viga/  concreto-laje-macica/  concreto-pilar/
    concreto-laje-trelicada/  concreto-laje-nervurada/  concreto-laje-alveolar/
    madeira-viga/  madeira-pilar/  madeira-entrepiso/  madeira-comum/  geotecnia-sondagem/  concreto-sapata/  geotecnia-estaca/  concreto-bloco/  concreto-escada/  concreto-reservatorio/  comum/
  renderer/           interface
    core/             estado, projeto (formato JSON), comandos, módulos, API
    ui/               workbench, menus, paleta, diálogos, componentes, ícones
    views/            tela inicial, explorador, editor de elemento, parâmetros, montagem, 3D, vento, estabilidade
    styles/           tokens de design e folhas de estilo
  validacao/          executor do banco de casos (Node e app)
validacao/
  casos/*.json        casos de validação com fonte e tolerância
docs/
  APRESENTACAO.md     apresentação do projeto com capturas de tela (para o GitHub)
  imagens/            capturas de tela usadas na documentação
  FORMATO.md          esquema do arquivo .lebr.json
  VALIDACAO.md        banco de casos de validação: formato e como incluir casos
  VENTO.md            vento (NBR 6123): dados, Ca, aplicação no pórtico e limitações
  ESTABILIDADE.md     desaprumo, α, γz, rigidez reduzida e majoração por 0,95·γz
  SONDAGEM.md         sondagem SPT: dados do furo, classificação, perfil e uso pelas fundações
  FUNDACOES.md        sapata isolada, ligação pilar → sapata e nível de baldrame
  ESCADAS.md          escadas: geometria, modelo de cálculo e ligação com as vigas
  RESERVATORIOS.md    reservatórios: placas, ações, fissuração e apoios
  QUANTITATIVOS.md    quantitativos: critérios de concreto, fôrma e aço, e o CSV
  DETALHAMENTO.md     detalhamento de vigas, pilares e lajes: ancoragens, cortes, emendas e edições
  DXF.md              exportação das pranchas em DXF: conteúdo, escalas e camadas
  OTIMIZACAO.md       otimização das bitolas por elemento: menos bitolas, menos aço ou menos segmentos de barra
  CARGAS.md           catálogo de cargas da NBR 6120: uso, fontes e valores a conferir
  ELS.md              fissuras e flechas das vigas: método e hipóteses
  MODULOS.md          como criar módulos (aço, ligações…)
  MADEIRA.md          critérios e fontes dos módulos de madeira
exemplos/
  edificio-exemplo.lebr.json            um pavimento: lajes, vigas e pilares
  residencia-terrea-baldrame.lebr.json  casa térrea com vigas baldrame e sapatas
  edificio-3-pavimentos.lebr.json       3 pavimentos: escadas, baldrame, blocos sobre estacas
  edificio-18-pavimentos.lebr.json      18 pavimentos em pórtico espacial com vento
  modulos/esqueleto-modulo/   módulo externo de exemplo
test/                 testes com valores de referência (Timoshenko, fórmulas clássicas)
```

## Módulos novos

Novos tipos de elemento entram como módulos, internos ou externos, sem mudar o
núcleo nem o formato do arquivo. As lajes treliçada, nervurada e alveolar foram
adicionadas assim. Para testar um módulo externo, copie `exemplos/modulos/esqueleto-modulo`
para a pasta aberta em **Módulos → Abrir pasta de módulos externos** e reinicie. O contrato está em
[docs/MODULOS.md](docs/MODULOS.md).

## Simplificações conhecidas

- Torção: os apoios restringem a rotação da viga em torno do eixo; torque só distribuído (sem torque concentrado); a armadura longitudinal de torção é informada para somar às de flexão, ainda sem detalhamento.
- Sobrecargas aplicadas em todos os vãos ao mesmo tempo (sem alternância); as combinações tratam cada carga variável lançada como um todo (presente ou omitida).
- Pórtico espacial: análise linear de 1ª ordem; efeitos globais de 2ª ordem só pela majoração por 0,95·γz (P-Δ na Fase 2); as vigas continuam dimensionadas pela grelha ou isoladas, sem o vento; pilares de madeira e vigas de madeira ficam fora do modelo.
- Vento: planta tomada como o retângulo que envolve os elementos posicionados, terreno na cota 0 e força de cada pavimento no centro da planta (sem excentricidade de 7.3 da NBR 6123 nem efeitos de vizinhança ou dinâmicos); Ca estimado por interpolação aproximada do ábaco de baixa turbulência — informe o valor do ábaco; S2 e S3 da NBR 6123:1988, a conferir na revisão de 2023.
- Lajes e pilares usam a combinação ELU1 (1,4·G + 1,4·Q), que governa sob carga uniforme; as vigas usam a envoltória completa.
- Montagem: com o pavimento em **Vigas isoladas**, viga apoiada em outra viga (fora de um pilar) não é conectada automaticamente — use uma carga concentrada na viga de apoio ou passe o pavimento para **Grelha**. Na grelha, as flechas continuam pela viga isolada, a torção é dimensionada como de equilíbrio e os momentos que as molas transmitem aos pilares ainda não entram no cálculo dos pilares. Lajes e vigas são retângulos e eixos retos; o 3D é ilustrativo (sem armaduras).
- Lajes com borda livre: reações médias por borda; a armadura de reforço das bordas livres (e a nervura ou viga de bordo das lajes em uma direção) é apenas indicada em aviso.
- Lajes em uma direção em balanço: um único trecho engastado numa extremidade; balanço contínuo com o vão vizinho deve ser modelado como viga.
- Laje alveolar com engaste ou balanço: o MRd− da armadura negativa é informado pelo usuário; o fabricante deve confirmar a solução.
- Laje treliçada e nervurada em uma direção: um vão (sem continuidade entre lajes vizinhas); nervura transversal só como aviso.
- Laje nervurada em duas direções: esforços de placa isótropa equivalente (14.7.7).
- Laje alveolar: depende dos valores MRd, VRd e EI do fabricante; os valores iniciais do painel são apenas exemplo.
- Pilares: flexão oblíqua pela curva de interação (passo de 5° na direção da linha neutra, interpolação linear entre pontos); fator 0,9 da tensão do bloco com linha neutra inclinada a conferir no texto da NBR 6118:2023; λ > 90 fora do escopo.
- Punção: as cargas concentradas entram só na punção (não nos momentos e flechas da laje); momento transferido só no motor (pilar interno), ainda sem campo na laje; k = 1 + √(20/d) limitado a 2 e ρ ≤ 2 % (critério do EC2, a conferir no texto da NBR 6118:2023); sem limite superior de τRd3 além de τRd2 em C; ρ e d tomados das barras inferiores da laje (uma carga sob pilar que apoia a laje usaria as superiores).
- Sem ancoragem e detalhamento de dobras. Abertura de fissuras só nas vigas (lajes ainda não).
- Fator ηc da NBR 6118:2023 implementado como ηc = (40/fck)^(1/3) ≤ 1 — conferir com o texto da norma.

## Nome

O projeto se chamava **OpenLabViga** até a versão 0.3.1. Arquivos antigos (`.olv.json`, formato
`openlabviga.projeto`) continuam abrindo e são gravados no formato novo ao salvar. A lista de
projetos recentes e os módulos externos são copiados da pasta de dados antiga na primeira execução.

## Autoria

Software idealizado e desenvolvido por **Daniel Michelon De Carli** com uso do Claude com modelo
Opus 5.5. Os créditos também aparecem em **Ajuda › Sobre o LEBR**.

## Licença

**GNU General Public License, versão 3** (GPL-3.0) — veja [LICENSE](LICENSE). O LEBR é software livre: pode ser
usado, estudado, modificado e redistribuído, desde que as versões distribuídas mantenham a mesma licença e o
código-fonte aberto. É distribuído **sem nenhuma garantia**. Até a versão 0.29.1 o projeto era distribuído sob a
licença MIT. O Three.js, embutido em `src/renderer/assets/vendor/three`, mantém a sua licença MIT.

Cada arquivo JavaScript do projeto traz no cabeçalho a autoria — feito com uso da inteligência artificial Claude
Opus 5.5, sob a orientação de Daniel Michelon De Carli — e a licença GPL-3.0 (`SPDX-License-Identifier:
GPL-3.0-only`).
