# Imperfeições e estabilidade global (NBR 6118, 11.3.3.4.1, 15.5 e 15.7)

A partir da 0.19.0 o LEBR avalia a estabilidade global do edifício montado. Motor: `src/engine/estabilidade.js`;
integração: `src/modules/comum/portico-edificio.js`; tela: **Estrutura › Estabilidade global** (F9).

## Desaprumo global (11.3.3.4.1)

| Grandeza | Expressão |
|---|---|
| Ângulo | θ1 = 1/(100·√H), com 1/300 ≤ θ1 ≤ 1/200 (H em m) |
| Ângulo com n pilares | θa = θ1·√((1 + 1/n)/2) |
| Força no nível i | Fi = θa·(G + Q)i |

- H vai da fundação (cota mais baixa dos pilares) ao último nível; n é o número de pilares que chegam à fundação
  (na NBR 6118:2023, os pilares verticais que contribuem para o desaprumo).
- A carga do nível é a soma característica G + Q do pavimento (vigas, cargas lançadas e peso dos pilares que chegam a ele).
- **Comparação com o vento**, pelos momentos na base: se 30 % do vento passa do desaprumo, fica **só o vento**; se o
  vento é menor que 30 % do desaprumo, fica **só o desaprumo** (com θ1,mín); nos demais casos os dois somam na mesma
  direção, **sem** θ1,mín, e a soma é tratada como uma ação de vento. A escolha é feita em X e em Y.
- O resultado de cada direção vai para os casos V1 a V4 do pórtico (0°, 90°, 180° e 270°), aplicado no diafragma
  como o vento. Combinações: vento e vento + desaprumo com ψ0 = 0,6, ψ1 = 0,3, ψ2 = 0; o desaprumo sozinho com
  γq e ψ = 1 (entra inteiro em todas as combinações com a sua direção — a favor da segurança em relação a γ = 1,2 das
  ações permanentes indiretas). As quatro direções continuam exclusivas.
- Pode ser desligado em `parametros.estabilidade.desaprumo`; sem vento e sem desaprumo, o pórtico fica só com G e Q.

## Parâmetro de instabilidade α (15.5.2)

α = H·√(Nk/(Ecs·Ic)), nós fixos se α ≤ α1.

- Nk: soma das cargas verticais características (G + Q) acima da fundação.
- Ecs·Ic: rigidez do pilar equivalente engastado na base e livre no topo com o mesmo deslocamento do topo sob as
  mesmas forças horizontais. O LEBR resolve o pórtico com as seções brutas e Ecs, com as forças horizontais da
  direção, e usa δtopo = Σ Fi·hi²·(3H − hi)/(6·EI).
- α1 = 0,2 + 0,1·n para n ≤ 3 níveis; com 4 ou mais, 0,5 (só pórticos, o padrão do LEBR), 0,6 (pórticos com
  pilares-parede) ou 0,7 (só pilares-parede).

## Coeficiente γz (15.5.3) e majoração (15.7.2)

γz = 1/(1 − ΔMtot,d/M1,tot,d).

- Rigidez reduzida (15.7.3): o pórtico é resolvido de novo com `fatorEI` nas barras — vigas 0,4·Eci·Ic (0,5 com
  As′ = As) e pilares 0,8·Eci·Ic, ou 0,7·Eci·Ic para os dois (simplificada, só com γz ≤ 1,3). Eci = Ecs/αi.
- δi: deslocamento horizontal de cada nível (média dos nós do diafragma) com as forças horizontais características.
- M1,tot,d = γ·Σ Fi·hi e ΔMtot,d = Σ Pd,i·γ·δi, com Pd,i = γg·Gi + γq·ψ·Qi da combinação. O LEBR calcula γz em todas as
  combinações últimas com a ação horizontal da direção e fica com o maior (em geral 1,4·G + 1,4·Q + 0,84·V).
- **Classificação**: γz ≤ 1,1 nós fixos; 1,1 < γz ≤ 1,3 nós móveis, com os esforços horizontais das combinações
  últimas do edifício multiplicados por **0,95·γz**; γz > 1,3 o processo aproximado não vale — o LEBR avisa (na tela
  e nos pilares), aplica 0,95·γz só como estimativa e a análise P-Δ fica para a Fase 2.
- O γz vale para estruturas com 4 andares ou mais. Com menos, a classificação segue o α e a majoração só se aplica
  quando α > α1.

## Onde aparece

- **Estabilidade global (F9)**: parâmetros, desaprumo (θ1, θa, ação escolhida em cada direção, forças por nível),
  α por direção, γz por direção com os deslocamentos e as cargas de cada nível, e as combinações do edifício com as
  majoradas marcadas.
- **Pilares** em *Pórtico espacial*: as combinações vêm do edifício (com as ações horizontais e a majoração); o
  resultado mostra γz e α e os esforços característicos de cada caso V1 a V4; o memorial registra θa, α, γz e o fator.
- **Parâmetros › Ações e combinações** lista as combinações do edifício; **Vento** indica quando a ação inclui o
  desaprumo; a **Visualização 3D** desenha as forças horizontais por nível.
- `portico.estabilidade` no resultado do pilar e `porticoEdificio()` no console.

## Limitações

- Efeitos globais de 2ª ordem só pela majoração por 0,95·γz; sem P-Δ (Fase 2).
- Lajes não entram como barras (diafragma rígido), então a redução 0,3·EciIc das lajes não se aplica.
- NBR 6118:2023, 15.7.3: em estruturas com menos de 4 andares e normais pequenas nos pilares (NSd < 0,1·Ac·fcd,
  galpões), a redução de rigidez deve ser avaliada caso a caso — o LEBR usa os valores usuais.
- Desaprumo aplicado no centro da planta, com a carga G + Q característica de cada nível.
