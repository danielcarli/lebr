# Fundações: sapata isolada e viga baldrame

Sapata e baldrame a partir da 0.21.0; estacas a partir da 0.22.0; blocos sobre estacas a partir da 0.23.0. Módulo `concreto.sapata` (sigla CS1, categoria *Fundações*): `src/modules/concreto-sapata/`; motor
`src/engine/sapata.js`; ações da montagem em `src/renderer/core/fundacoes.js`.

## Sapata isolada

### Carga

- **Pilar ligado** (`pilarId`): normal característica g + q do pilar (as mesmas cargas que ele recebe dos elementos). Com
  os pilares em *Pórtico espacial*, a normal e os momentos G + Q vêm do pórtico, na base do lance que chega à fundação.
- **Sem pilar**: seção ap × bp e g, q informados.
- **Momentos adicionais** Mx (flete na direção A) e My (direção B), característicos, somados aos do pórtico.
- Na base do solo entram também o peso próprio da sapata (25 kN/m³, faces inclinadas até o topo ap + 5 × bp + 5 cm) e o
  reaterro sobre ela (escavação A × B até a profundidade da base, γ = 18 kN/m³ por padrão).

### Tensão admissível

- **Informada** (kPa), na cota de apoio.
- **Estimada pelo SPT**: σadm = 20·N kPa (0,02·N MPa — correlação semiempírica usual, Teixeira e Godoy, 1996), com N o NSPT
  médio do furo (o escolhido ou o mais próximo do pilar na planta) da base da sapata até 2·B abaixo dela. Válida para
  5 ≤ N ≤ 20: abaixo de 5 há aviso de solo fraco; acima de 20, N é limitado a 20 (400 kPa). Também avisa quando o bulbo passa
  do fim do furo ou quando o nível d'água está dentro dele. É uma estimativa — o projeto de fundações confirma.

### Geometria

- **Automática**: A e B com balanços iguais (A − B = ap − bp), múltiplos de 5 cm, no mínimo 60 cm, crescendo até
  σméd ≤ σadm, σmáx ≤ 1,3·σadm e a base inteiramente comprimida (excentricidades no núcleo central:
  6·ex/A + 6·ey/B ≤ 1). Altura de sapata rígida, h ≥ (A − ap)/3 e (B − bp)/3 (NBR 6118, 22.6.1), e suficiente para ancorar
  as barras do pilar (h ≥ lb + c + 2 cm); h0 ≥ h/3 e ≥ 20 cm.
- **Informada**: A, B, h e h0; a sapata é classificada como rígida ou flexível.

### Estrutura (valores de cálculo, γf da carga do pilar)

- **Flexão** nas duas direções pelo método do CEB-70: momento na seção S1, a 0,15·ap para dentro da face do pilar,
  M1 = σd·B·(c + 0,15·ap)²/2, com a maior tensão de cálculo uniforme (sem o peso próprio). Armadura pela flexão de uma seção
  B × h com d = h − c − 1 cm, com a armadura mínima, e malha com espaçamento entre 10 e 20 cm.
- **Contorno C** (19.5.3.1): compressão diagonal na ligação com o pilar, τSd ≤ τRd2 = 0,27·αv2·fcd — rígidas e flexíveis.
- **Sapata rígida**: a punção não precisa ser verificada (22.6.2.2).
- **Sapata flexível**: punção em C′, a 2d da face (19.5.3.2), com a força reduzida pela reação do solo dentro do contorno e
  τRd1 com a taxa da malha adotada (dispensada se C′ sai da sapata); cortante como laje sem armadura transversal (19.4.1) a d
  da face, em cada direção.
- **Ancoragem** das barras do pilar (9.4.2.4): lb = (ø/4)·fyd/fbd ≥ 25ø, com a bitola do pilar calculado (ou a informada).
- Cobrimento de elemento em contato com o solo (NBR 6118, Tabela 7.2): 3,0 cm nas CAA I e II, 4,0 na III, 5,0 na IV.

### Na interface

- **Estrutura › Criar sapatas nos pilares da fundação** (também o ícone de sapata na montagem): uma sapata por pilar que
  chega à fundação e ainda não tem, com o código do pilar (P105 → S105), já ligada e calculada.
- Na montagem, as sapatas aparecem tracejadas sob os pilares; no 3D, como blocos sob a base de cada pilar.
- Desenhos de planta (malha) e corte; tabela de tensões e armaduras; verificações e memorial.

## Viga baldrame

- `concreto.viga` com `baldrame: true` ("Viga baldrame" no editor da viga): usa o cobrimento de contato com o solo e avisa
  se não estiver no pavimento mais baixo. **Novo › Viga baldrame** cria uma, com a parede do térreo como carga.
- **Estrutura › Criar nível de baldrame…** (ou o ícone na montagem): cria o pavimento *Baldrame* na base dos pilares do
  pavimento mais baixo; um **arranque** (pilar curto, PB105 sob P105) do topo da sapata ao baldrame; uma **viga baldrame**
  sob cada viga do pavimento de cima (seção informada, parede do térreo como carga, sem as ligações das lajes); e as
  ligações viga → arranque e pilar → arranque. As sapatas que estavam sob os pilares passam para os arranques. No pórtico
  espacial, o baldrame trava os pilares no nível do terreno.

## Estacas

Módulo `geotecnia.estaca` (sigla GE1); motor `src/engine/estacas.js`.

### Dados

Tipo (hélice contínua, escavada mecanicamente sem fluido, broca, pré-moldada cravada), seção (circular; quadrada nas
pré-moldadas), diâmetro ou lado, comprimento L, profundidade do topo (arrasamento) abaixo do terreno, pilar ligado (posição
e carga de trabalho G + Q, ou do pórtico) ou locação e carga informadas, furo de sondagem (ou o mais próximo).

### Capacidade de carga

O fuste é dividido em trechos de 1 m (fronteiras inteiras na profundidade do furo); cada trecho usa o NSPT do ensaio que
começa nele (limitado a 50) e o solo da camada. Aterro, solo orgânico e turfa não contribuem com atrito.

| | Aoki-Velloso (1975) | Décourt-Quaresma (1978; Décourt, 1996) |
|---|---|---|
| Ponta | rp = K·Np/F1, Np na cota da ponta | rp = α·C·Np, Np = média da ponta e de 1 m acima e abaixo |
| Atrito | rl = α·K·Nl/F2 por trecho | rl = β·10·(Nl/3 + 1), Nl = média do fuste sem os ensaios da ponta, 3 ≤ N ≤ 50 |
| Fatores | F1: hélice 2,0; escavada e broca 3,0; pré-moldada 1 + D/0,80; F2 = 2·F1 (Cintra e Aoki, 2010) | α, β: escavada 0,85/0,80 (argilas), 0,60/0,65 (intermediários), 0,50/0,50 (areias); hélice 0,30/1,0; cravada 1/1 |

K (MPa) e α (%) de Aoki-Velloso: areia 1,00/1,4; areia siltosa 0,80/2,0; areia argilosa 0,60/3,0; silte 0,40/3,0; silte arenoso
0,55/2,2; silte argiloso 0,23/3,4; argila 0,20/6,0; argila arenosa 0,35/2,4; argila siltosa 0,22/4,0. C de Décourt-Quaresma:
argila 120 kPa; silte argiloso 200; silte arenoso 250; areia 400. Pedregulho é tratado como areia e rocha alterada como silte
arenoso.

### Carga admissível

- Fator de segurança global 2,0 sobre a ruptura (métodos semiempíricos, NBR 6122).
- Estacas escavadas (hélice, escavada, broca): ponta limitada a 20 % da carga admissível, isto é, Padm ≤ 1,25·Rl/2 — pode
  ser desligado (o texto e a aplicação à hélice contínua devem ser conferidos na edição da NBR 6122 em vigor).
- Carga estrutural: moldadas in loco 0,85·fck/γc·A/1,4 com os parâmetros usuais (hélice fck 20 MPa e γc 1,8; escavada sem
  fluido e broca fck 15 MPa e γc 1,9 — conferir na NBR 6122); pré-moldadas, a carga do catálogo do fabricante.
- Adotada: a menor entre Aoki-Velloso, Décourt-Quaresma e a estrutural. Com carga de trabalho, as verificações comparam
  cada método e a curva carga × comprimento dá o menor comprimento que atende.
- As estacas aparecem marcadas na planta da montagem e como cilindros no 3D.

## Bloco sobre estacas

Módulo `concreto.bloco` (sigla CB1); motor `src/engine/bloco.js`. Referências: Blévot e Frémy (1967); Bastos, *Blocos de
fundação* (UNESP); NBR 6118:2023, 22.7.

### Arranjos e reações

| n | Arranjo (e = espaçamento entre eixos, 3·D ou 2,5·D nas pré-moldadas) |
|---|---|
| 1 | estaca centrada (bloco de transição) |
| 2 | em linha na direção A (bx do pilar) |
| 3 | triângulo equilátero de lado e |
| 4 | quadrado de lado e |
| 5 | quadrado de lado e·√2 com a estaca central |
| 6 | retângulo 3 × 2 com espaçamento e |

O bloco é o retângulo envolvente com 15 cm da face da estaca à borda (múltiplo de 5 cm). As reações características são
Ri = (N + peso próprio)/n + Mx·xi/Σx² + My·yi/Σy²; a maior deve ser ≤ Padm da estaca e nenhuma pode tracionar. No automático,
o LEBR escolhe o menor n de 1 a 6 que atende.

### Bielas e tirantes (Blévot)

d = h − 15 cm (estaca embutida 10 cm). Nos pilares retangulares dos blocos de 3 e 4 estacas usa-se a = √(ap·bp).

| n | Inclinação | Tirante | Faixa de d (45° a 55°) | Limite das bielas |
|---|---|---|---|---|
| 2 | tg α = d/(e/2 − ap/4) | Rs = Nd·(2e − ap)/(8d), +15 % na armadura | 0,5 a 0,71·(e − ap/2) | 1,40·KR·fcd |
| 3 | tg α = d/(e·√3/3 − 0,3·a) | mediana Nd·(√3·e − 0,9·a)/(9d); lados Rs/√3 | 0,58 a 0,825·(e − a/2) | 1,75·KR·fcd |
| 4 | tg α = d/(√2/2·(e − a/2)) | lados Nd·(2e − a)/(16d) | 0,71 a 1,0·(e − a/2) | 2,10·KR·fcd |
| 5, 6 | por estaca, do ponto a ap/4, bp/4 do centro | Σ Ri·(xi − ap/4)/d de um lado | pela biela mais abatida (estaca mais afastada); as das estacas próximas ficam mais íngremes | 2,10·KR·fcd |

KR = 0,90. Tensões: junto ao pilar σ = Nd/(Ap·sen²α), junto à estaca σ = Rd/(Ae·sen²α). Bloco de 1 estaca: fendilhamento
Td = 0,25·Nd·(A − ap)/A, em estribos horizontais.

### Armaduras e verificações

- Tirantes concentrados em faixas de 1,2·D sobre as estacas, de face a face, com ganchos (22.7.4.1); malha de
  distribuição com 20 % da armadura principal em cada direção (22.7.4.1.3).
- Espaçamento entre estacas maior que 3·D: aviso de armadura de suspensão, As ≈ Nd/(1,5·n·fyd).
- Verificações: reação máxima e sem tração, espaçamento, inclinação das bielas, bielas junto ao pilar e à estaca, bloco
  rígido ((a − ap)/3 ≤ h) e ancoragem das barras do pilar (d ≥ lb).
- **Estrutura › Criar blocos sobre estacas** cria um bloco ligado a cada pilar da fundação que ainda não tem sapata nem
  bloco (código B + número do pilar). O nível de baldrame também passa os blocos para os arranques.

## Limitações

- Estacas isoladas: sem efeito de grupo, atrito negativo, recalques ou esforços horizontais.
- Blocos: arranjos usuais de 1 a 6 estacas, sem blocos sobre estacas em linhas irregulares, blocos de divisa ou com viga
  alavanca; as cargas no bloco são G + Q característicos (Nd = γg·G + γq·Q) e os momentos do pilar e informados.
- Sapatas isoladas e centradas; sem sapatas corridas, associadas ou de divisa (com viga alavanca).
- Tensão admissível pelo SPT por uma correlação simples; sem recalques nem capacidade de carga por teoria.
- Combinações de vento nas fundações ainda não: a sapata usa G + Q característicos e os momentos informados.
- A viga baldrame é calculada apoiada nos arranques, sem considerar o apoio no solo.
