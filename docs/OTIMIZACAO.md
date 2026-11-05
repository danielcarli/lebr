# Otimização das bitolas

A partir da versão 0.30, cada elemento pode ser calculado com um critério de otimização das armaduras (o terceiro, menos segmentos de barra, entrou na 0.31):

| Critério | O que busca | No empate |
|---|---|---|
| **Menos bitolas diferentes** | o menor número de bitolas no elemento — obra mais simples: menos tipos de barra para comprar, cortar, dobrar e conferir | o menor peso de aço |
| **Menos aço** | o menor peso de aço do elemento | o menor número de bitolas |
| **Menos segmentos de barra** | o menor número de segmentos de barra — as peças cortadas das barras comerciais de 12 m, que são cortadas, dobradas, amarradas e posicionadas uma a uma —, aceitando até um acréscimo de aço sobre a escolha automática (10 % por padrão) | o menor peso de aço |

Sem otimização (o padrão), cada posição em "Automática" escolhe a sua bitola sozinha, pelo menor excesso de área,
sem olhar para as outras posições nem para o comprimento das barras.

## Onde ligar

- **Na tela do elemento**, seção **Armadura**: o controle **Otimização** (Nenhuma, Menos bitolas diferentes, Menos
  aço, Menos segmentos de barra). Ao escolher, o elemento é recalculado. Com segmentos, aparece o campo **Aço a mais
  aceito** (%).
- **Calcular › Otimizar o elemento** (menos bitolas, menos aço, menos segmentos ou sem otimização) para o elemento aberto.
- **Calcular › Otimizar todos os elementos** aplica o critério a todos os elementos que aceitam otimização e
  recalcula o projeto. **Remover a otimização de todos** desfaz.

## Segmentos de barra

Um **segmento** é cada pedaço de barra que sai do corte das barras comerciais de 12 m: cada barra da lista de ferros
conta 1, e uma barra mais longa que 12 m conta 1 a mais por emenda (no detalhamento das vigas, as emendas por
traspasse já estão no comprimento). Nas malhas estimadas (escadas, reservatórios), o número de barras sai da área por
metro e da bitola. Cada segmento é trabalho de obra — cortar, dobrar, amarrar e posicionar —, então menos segmentos
quer dizer armação mais rápida, com menos estribos (bitola maior, espaçamento maior) e menos barras longitudinais
(bitola maior).

Só que menos segmentos quase sempre quer dizer mais aço: sem limite, a busca levaria a barras e estribos grossos
demais (na viga de exemplo, 2,6 vezes o aço). Por isso o critério aceita **no máximo um acréscimo de aço** sobre a
escolha automática — 10 % por padrão, editável no campo **Aço a mais aceito** — e, dentro dele, fica com o menor número
de segmentos. Com 0 %, só passa o que não pesa mais que o automático.

No edifício de exemplo, com 10 %: o pilar P205 cai de 58 para 25 segmentos com menos aço (ø 12,5 no lugar de ø 10,
menos barras e menos grampos); a viga V001 de 69 para 49 segmentos com 6 % a mais de aço; a laje L101 de 127 para
89 com 7 % a mais. No projeto inteiro, os segmentos caem de 6.182 para 4.893 (−21 %) com 3,9 % a mais de aço.

Os quantitativos mostram o número de segmentos por elemento, por pavimento e do projeto (coluna **Segmentos** e no
CSV).

## Como funciona

1. O programa toma as posições de bitola do elemento que estão em **Automática**. As que o usuário escolheu ficam
   como estão.
2. Calcula o elemento com várias combinações de bitolas nessas posições — cada uma com o cálculo completo
   (flexão, cortante, torção, fissuração, flechas, ancoragens e detalhamento).
3. Descarta as combinações que deixam alguma verificação sem atender.
4. Mede cada combinação pela **lista de ferros** do detalhamento (vigas, pilares e lajes maciças: comprimentos de
   corte, ganchos, ancoragens, traspasses e as edições feitas na lista) ou, em escadas e reservatórios, pela mesma
   estimativa dos quantitativos. O peso não inclui as perdas de obra.
5. Fica com a melhor pelo critério (no de segmentos, só entre as que não passam do acréscimo de aço aceito). Quando nenhuma combinação melhora, mantém a escolha automática; quando nenhuma
   atende, avisa e mantém o cálculo automático.

Com até 60 combinações (pilares, lajes, escadas, reservatórios), todas são calculadas. Nas vigas (7 × 7 × 5 = 245
combinações), o programa parte de sementes — a mesma bitola nas barras de cima e de baixo, com cada estribo — e
melhora trocando uma posição de cada vez enquanto houver ganho. Uma viga leva da ordem de 0,1 a 0,2 s; um pilar,
cerca de 0,5 s.

| Elemento | Posições variadas |
|---|---|
| Viga de concreto | barras inferiores, superiores e estribos |
| Pilar de concreto | barras longitudinais e estribos |
| Laje maciça | barras inferiores e superiores |
| Escada | armadura principal |
| Reservatório | bitola das barras |

Lajes treliçadas e nervuradas ainda não entram: os quantitativos delas não dependem das bitolas calculadas.

## O que aparece

Na seção **Armadura**, o quadro compara o elemento **sem otimização** e **otimizado** — número de bitolas, peso,
segmentos de barra e a diferença de aço — e diz quais bitolas foram adotadas. Nos seletores das posições, "Automática" passa a mostrar a
bitola otimizada ("Otimizada: ø 10 mm"). **Fixar estas bitolas** grava as bitolas adotadas nas posições e desliga
a otimização, para que o elemento não mude mais quando as cargas mudarem. O memorial ganha o bloco **Otimização
das bitolas**, com as duas medidas.

## Cuidados

- **Menos bitolas pode custar mais aço.** Para ter uma bitola só, o pilar pode receber estribos de 10 mm, ou a viga
  barras maiores que o necessário. O quadro mostra a diferença em porcentagem; quando ela for grande, vale fixar à
  mão a bitola que mais pesa e otimizar o resto.
- O critério é **por elemento**. Uniformizar as bitolas do projeto inteiro (por exemplo, todas as vigas com as
  mesmas bitolas) ainda não é feito automaticamente; dá para chegar perto fixando as bitolas nas posições.
- A otimização refaz a busca a cada cálculo, então o resultado acompanha as mudanças de carga e geometria.

## Arquivo

O critério fica em `elemento.otimizacao` (`"bitolas"`, `"aco"` ou `"segmentos"`) e o acréscimo de aço aceito no de
segmentos em `elemento.otimizacaoLimiteAco` (%, padrão 10); o resultado traz `otimizacao` com a escolha adotada e as
duas medidas (peso, bitolas e segmentos). Ver [FORMATO.md](FORMATO.md).

## Código

`src/modules/comum/otimizacao.js` — critérios, posições por módulo, medida do aço e a busca (`otimizarBitolas`);
chamada em `calcularElemento` (`src/renderer/core/calculo.js`). Testes em `test/otimizacao.test.js`.
