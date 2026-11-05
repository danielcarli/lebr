# Vento (NBR 6123)

A partir da 0.18.0 o LEBR calcula as forças devidas ao vento no edifício montado e as aplica no pórtico espacial
(ver [PORTICO.md](PORTICO.md)). Motor: `src/engine/vento.js`; integração: `src/modules/comum/portico-edificio.js`;
tela: **Estrutura › Vento (NBR 6123)** (F8).

> **Edição da norma.** Os parâmetros de S2 (Tabela 1) e S3 (Tabela 3) são os da NBR 6123:1988. A NBR 6123 foi
> revisada em dezembro de 2023; confira na edição em vigor os parâmetros, o mapa de isopletas e os ábacos de Ca
> antes de usar os resultados em projeto.

## Expressões

| Grandeza | Expressão | Onde |
|---|---|---|
| Velocidade característica | Vk = V0 · S1 · S2 · S3 | 4.2 |
| Pressão dinâmica | q = 0,613 · Vk² (N/m²) | 4.2 |
| Fator S2 | S2 = b · Fr · (z/10)^p, com z ≤ zg | 5.3, Tabela 1 |
| Força de arrasto | Fa = Ca · q · Ae | 4.2.1 |
| Força por pavimento | F = Ca · q(z) · l1 · altura de influência | — |

## Dados (Parâmetros do projeto › vento)

| Campo | Valores | Observação |
|---|---|---|
| V0 | m/s | mapa de isopletas (Figura 1); rajada de 3 s, 50 anos, 10 m, terreno aberto |
| Referência | texto | local e isopleta usados, para o memorial |
| Topografia (S1) | plano 1,0 · vale protegido 0,9 · informado | taludes e morros: S1 calculado à parte e informado |
| Categoria | I a V | rugosidade do terreno (5.3.1) |
| Classe | automática, A, B, C | automática pela maior dimensão entre Lx, Ly e a altura: ≤ 20 m A, ≤ 50 m B, acima C |
| Grupo (S3) | 1 (1,10) a 5 (0,83) | Tabela 3 |
| Ca em X e em Y | número ou vazio | vazio usa a estimativa |

## Geometria

- **Planta**: retângulo que envolve todos os elementos posicionados (faces dos pilares, eixos das vigas e contornos
  das lajes). Lx e Ly são as dimensões desse retângulo.
- **Alturas**: o terreno está na cota 0; z é a cota de cada pavimento. A altura de influência é metade do pé-direito
  abaixo mais metade do de cima (na cobertura, só a metade de baixo). Pavimentos abaixo de z = 0 não recebem vento.
- **Direções**: 0° e 180° (V1, V3) ao longo de X, com face exposta l1 = Ly e profundidade l2 = Lx; 90° e 270°
  (V2, V4) ao longo de Y, com l1 = Lx e l2 = Ly.

## Coeficiente de arrasto

A norma dá Ca nos ábacos das Figuras 4 (vento de baixa turbulência) e 5 (alta turbulência), em função de l1/l2 e
h/l1. O programa oferece uma **estimativa** por interpolação logarítmica aproximada do ábaco de baixa turbulência
(produto de um fator de l1/l2 por um fator de h/l1, limitado a 0,7 – 2,2). É uma ajuda para começar: leia o valor no
ábaco e informe-o em *Ca informado*. Em zona urbana com obstáculos altos à volta a norma permite a Figura 5, com Ca
menor.

## Aplicação no pórtico

Com *Considerar o vento no pórtico do edifício* ligado:

- para cada pavimento e cada direção, a força é aplicada no nó do diafragma mais próximo do centro da planta, com o
  momento em torno de z que leva a resultante para o centro (sem excentricidade adicional);
- os casos `V1` a `V4` entram no modelo junto com `G` e `Q`; a tela de vento confere, para cada caso, a soma das forças
  aplicadas com a reação horizontal na fundação;
- as combinações do edifício (`combinacoesGlobais`) incluem o vento como ação variável com ψ0 = 0,6, ψ1 = 0,3 e ψ2 = 0
  (Tabela 11.2). As quatro direções formam um grupo exclusivo: cada combinação tem no máximo uma delas. Com G, Q e
  vento: 28 combinações últimas (γg 1,4 e 1,0; Q principal com 0,84·V, V principal com 0,7·Q, só V, só Q, só G) e 15 de
  serviço — 43 no total;
- as combinações dos elementos (vigas, lajes, pilares por cargas dos elementos) continuam só com G e Q.

Os pilares em *Pórtico espacial* testam as combinações candidatas (maior normal, maior e menor tensão elástica
N/A ± Mx/Wx ± My/Wy) e ficam com a de maior armadura. Combinações que tracionam o pilar geram aviso (pilar tracionado
não é dimensionado nesta versão). O resultado do pilar traz `portico.vento` com as forças por pavimento e os esforços
característicos do lance em cada caso de vento.

## Na tela e no console

- **Vento (NBR 6123)**: dados, Ca por direção, tabela por pavimento (z, S2, Vk, q, altura de influência, F em X e
  em Y), cortante e momento de tombamento na base e conferência no pórtico.
- **Visualização 3D**: *Forças de vento* desenha uma seta por pavimento (comprimento proporcional à força) na direção
  escolhida; a deformada ganha os casos V1 a V4.
- **Parâmetros › Ações e combinações**: com o vento ligado, a tabela lista as combinações do edifício.
- Console: `vento()` devolve as forças; `porticoEdificio()` o pórtico com os casos de vento.

## Limitações

- Sem efeitos dinâmicos (edifícios esbeltos ou flexíveis, 9), de vizinhança (6.5) e excentricidades de 6.6.
- Ca por estimativa, salvo quando informado; sem coeficientes de pressão para vedações e coberturas.
- Edifício tratado como um prisma retangular envolvente; recortes em planta e torres sobre embasamento não são
  distinguidos.
- Análise de 1ª ordem: os efeitos globais de 2ª ordem entram pela majoração por 0,95·γz (ver [ESTABILIDADE.md](ESTABILIDADE.md)); P-Δ na Fase 2.
- A partir da 0.19.0 os casos V1 a V4 podem levar também o desaprumo global (regra dos 30 %, 11.3.3.4.1 da NBR 6118).
