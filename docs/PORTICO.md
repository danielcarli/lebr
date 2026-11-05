# Pórtico espacial

Motor de análise linear de estruturas de barras pelo método dos deslocamentos, com 6 graus de liberdade
por nó (3 translações e 3 rotações). Está em `src/engine/portico.js` e, nesta versão, é usado pelo console;
nas próximas etapas do roteiro ele passa a resolver a grelha de cada pavimento e o pórtico do edifício.

## Unidades e eixos

| Grandeza | Unidade |
|---|---|
| Coordenadas, comprimentos | m |
| Forças | kN |
| Momentos | kN·m |
| E, G | kN/m² (ou `{ fck }`, que usa o Ecs da NBR 6118, 8.2.8) |
| Seção `{ b, h }` | cm (ou `{ A, Iy, Iz, J }` em m², m⁴) |
| Deslocamentos / rotações | m / rad (o relatório do console mostra mm e mrad) |

- **Eixos globais:** X e Y no plano do pavimento, **Z vertical para cima**. Peso próprio e cargas de gravidade em −Z.
- **Eixos locais da barra:** x vai do nó `i` ao nó `j`; y é a direção da altura `h` da seção — vertical (+Z)
  nas barras não verticais e +X nas barras verticais —; z = x × y. `angulo` (graus) gira a seção em torno de x.
- **Inércias:** Iz = b·h³/12 (flexão no plano x–y) e Iy = h·b³/12. J é a constante de torção de Saint-Venant
  do retângulo; `fatorTorcao` (padrão 1) a reduz. `fatorEI` (padrão 1, na barra ou no modelo) multiplica Iy e Iz —
  é a rigidez reduzida da não linearidade física (NBR 6118, 15.7.3) usada no γz.

## Esforços

Na seção a x metros do nó `i`: **N** (tração positiva), **Vy**, **Vz**, **T**, **My** e **Mz**.
Mz > 0 traciona o lado −y local — numa viga, positivo é tração embaixo — e dMz/dx = Vy (na biapoiada,
Vy é positivo junto ao nó `i`). My > 0 traciona o lado −z local.

## Modelo

```js
analisarPortico({
  tipo: 'espacial',            // ou 'plano-xz', 'plano-yz', 'grelha' (restringe os graus fora do plano)
  material: { fck: 25 },       // padrão das barras; cada barra pode ter o seu
  pesoProprio: false,          // γ·A em −Z em todas as barras, no caso 'G'
  nos: [
    { id: 'A', x: 0, y: 0, z: 0, apoio: 'engaste' },   // 'engaste', 'apoio' (rótula), 'livre', '111000'
    { id: 'B', x: 0, y: 0, z: 3, molas: [0, 0, 0, 0, 0, 0] },  // apoio elástico (kN/m e kN·m/rad)
  ],
  barras: [
    { id: 'P1', i: 'A', j: 'B', secao: { b: 20, h: 40 },
      rotula: 'j',                         // ou liberar: { i: ['Mz'], j: ['My', 'Mz'] }
      q: { Z: -10 },                       // distribuída (kN/m) em eixos globais (X, Y, Z) ou locais (x, y, z)
      cargas: [{ tipo: 'P', dir: 'Z', valor: -20, a: 1.5, caso: 'Q' }],  // concentrada a 1,5 m do nó i
      caso: 'G' },                         // caso das cargas desta barra (padrão 'C')
  ],
  cargas: [{ no: 'B', Fx: 8, caso: 'V' }],  // cargas nodais: Fx, Fy, Fz, Mx, My, Mz
})
```

Cada caso de carga é resolvido com a mesma fatoração da matriz de rigidez; `r.combinar({ G: 1.4, Q: 1.4 })`
soma os casos com os fatores. Sem fatores, o resultado mostra a soma de todos os casos.

## Conferências automáticas

- **Equilíbrio:** a soma das reações é comparada com a resultante das cargas em cada caso.
- **Mecanismo:** se a matriz perde a rigidez num grau de liberdade, o erro diz o nó e o grau
  (por exemplo, "sem rigidez em nó A, rx": falta impedir a rotação em torno do eixo da barra).
- **Nó sem rigidez à rotação** (todas as barras rotuladas nele): o grau é restringido sem reação, com aviso.
- A numeração das equações usa a ordem de Cuthill–McKee reversa, que reduz a largura de banda; a matriz é
  fatorada por Cholesky em banda.

## Console

```js
porticoExemplo()               // dois pilares engastados e uma viga, carga vertical (G) e vento (V)
m = portico({ material: { fck: 25 } })
m.no('A', 0, 0, 0, 'engaste'); m.no('B', 0, 0, 3); m.no('C', 6, 0, 3); m.no('D', 6, 0, 0, 'engaste')
m.barra('P1', 'A', 'B', { secao: [20, 40] }); m.barra('V1', 'B', 'C', { secao: [15, 50] }); m.barra('P2', 'D', 'C', { secao: [20, 40] })
m.q('V1', -12, 'G'); m.carga('B', { Fx: 8 }, 'V')
r = m.resolver()               // mostra deslocamentos, reações e esforços
r.no('B'); r.reacao('A'); r.barra('V1'); r.barra('V1', 3); r.combinar({ G: 1.4, V: 0.84 })
```

O pórtico do console é uma análise avulsa: não altera o projeto aberto.

## Limitações desta versão

- Análise linear de 1ª ordem; sem P-Delta, sem não linearidade física (a redução de rigidez da NBR 6118, 15.7.3,
  entra quando o pórtico do edifício for gerado).
- Barras prismáticas de eixo reto, sem trechos rígidos nos nós e sem deformação por cortante.
- Cargas distribuídas uniformes em toda a barra e concentradas; sem cargas trapezoidais nem de temperatura.
- Sem deslocamentos impostos (recalques); apoios elásticos por molas.

## Grelha de pavimento

A partir da 0.16.0 o motor também resolve a **grelha de cada pavimento** (`src/modules/comum/grelha.js`), quando o
pavimento está em **Grelha** (montagem → quadro do pavimento, ou a seção *Grelha do pavimento* de uma viga).
O modelo é montado a partir da planta:

| Item | Como entra |
|---|---|
| Nós | apoios de cada viga, cruzamentos e encontros entre vigas (tolerância de 10 cm) |
| Barras | trechos das vigas de concreto entre nós; seção b × h, Ecs do projeto, J reduzido a 15 % (fissuração) |
| Apoio sobre pilar de concreto | apoio vertical + molas de rotação nos dois eixos da seção do pilar: Σ 4·Ecs·I/ℓ dos lances abaixo e acima |
| Apoio sobre outra viga | nó comum, sem apoio: a reação passa de uma viga à outra |
| Apoio declarado sem pilar e sem viga | apoio vertical; impede o giro em torno do eixo da viga quando só há vigas paralelas no nó |
| Engaste declarado | rotações impedidas (sobre outra viga, vale a continuidade) |
| Cargas | as da viga isolada, casos G e Q: peso próprio, distribuídas, paredes, concentradas, reações de lajes e a torção dos balanços (sentido pelo lado da laje) |

O resultado de cada viga é convertido para os mesmos pontos do cálculo isolado, e o dimensionamento (flexão,
cortante, fissuras) segue igual. As reações nos pilares passam a ser as da grelha. A viga isolada continua
calculada para a comparação lado a lado.

Limitações: flechas pela viga isolada; torção dimensionada como de equilíbrio; os momentos transmitidos aos
pilares pelas molas ainda não entram no pilar; vigas de madeira ficam fora da grelha.

## Pórtico espacial do edifício

A partir da 0.17.0 (`src/modules/comum/portico-edificio.js`), o edifício inteiro vira um pórtico espacial:

| Item | Como entra |
|---|---|
| Vigas | as barras da grelha de cada pavimento (mesmos nós, seções e cargas), na cota do pavimento, com J a 15 % |
| Pilares | barras verticais de cada lance, seção bx × by girada pelo ângulo do pilar; o lance de cima nasce no topo do de baixo (mesmo prumo) ou num nó de viga do pavimento de baixo; sem nada embaixo, engastado na fundação |
| Lajes | diafragma rígido em cada pavimento: ux, uy e rz dos nós do nível seguem o nó mais próximo do centro (penalidade) |
| Apoio de viga sem pilar | apoio vertical, como na grelha |
| Cargas | as das vigas (casos G e Q), o peso próprio dos pilares e as cargas concentradas lançadas nos pilares |

Diafragma no motor: `diafragmas: [{ nos: ['A', 'B', …], mestre?: 'A' }]` em `analisarPortico`. A função
`deformadaBarra(rb, n)` dá a deformada de cada barra (funções de Hermite com as pontas mais a parcela das cargas
distribuídas), usada na Visualização 3D.

Com **Parâmetros do projeto › Análise global › Pórtico espacial**, cada pilar usa a normal na base do seu lance e
os momentos de 1ª ordem no topo e na base; daí seguem o momento mínimo, a 2ª ordem local pelo pilar-padrão e a
flexão oblíqua, como antes. Sem vento, vale a combinação da maior normal. Com o vento ligado (0.18.0, ver
[VENTO.md](VENTO.md)), entram os casos V1 a V4 e o pilar é dimensionado nas combinações candidatas — maior normal,
maior tensão de compressão e menor tensão (N/A ± M/W nas duas direções) — ficando a de maior armadura (empate: maior
uso da curva de interação). O desaprumo global e a majoração por 0,95·γz estão em [ESTABILIDADE.md](ESTABILIDADE.md).
Limitações: análise linear de 1ª ordem, sem trechos rígidos nas ligações viga–pilar.
