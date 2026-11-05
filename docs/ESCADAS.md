# Escadas

Módulo `concreto.escada` (sigla CE1, categoria *Escadas*), a partir da 0.24.0: `src/modules/concreto-escada/`; motor
`src/engine/escada.js`. Referências: NBR 6118:2023 (13.2.4.1, 17.2, 17.3.5, 19.3, 19.4.1, 13.3); NBR 6120:2019
(Tabela 10); NBR 9050:2020 (6.8.2); Bastos, *Escadas* (UNESP); Melges, Pinheiro e Giongo, *Escadas* (EESC-USP).

## Geometria

| Tipo | Lances | Patamar | Apoios |
|---|---|---|---|
| Reta | 1 | saída e chegada opcionais | início (piso de baixo) e chegada (piso de cima) |
| L | 2, a 90° | de canto, largura × largura | início, duas bordas externas do patamar, chegada |
| U | 2, paralelos, com vão central | intermediário, profundidade informada, na largura total | início, fundo do patamar (dois tramos), chegada |

- Espelhos: n = arred(H/e alvo), e = H/n; L e U dividem ao meio (o primeiro lance fica com o ímpar).
- Cada lance com n espelhos tem n − 1 pisos; a projeção é (n − 1)·p.
- Verificação: fórmula de Blondel, 63 ≤ 2e + p ≤ 65 cm (NBR 9050, 6.8.2). Espelho fora de 16 a 18 cm, piso fora de
  28 a 32 cm e largura abaixo de 0,80 m geram avisos (as faixas da NBR 9050 valem para rotas acessíveis; confira o
  código de obras).

## Cargas (projeção horizontal)

- Inclinação: tg α = e/p. Espessura média medida na vertical: hm = h/cos α + e/2.
- Lance: g = γc·hm + revestimento + guarda-corpo/largura. Patamar: g = γc·h + revestimento + guarda-corpo/largura.
- Uso (NBR 6120:2019, Tabela 10): escadas sem acesso ao público 2,5 kN/m²; com acesso ao público 3,0 kN/m² (conferir na
  edição em vigor).

## Modelo de cálculo

Cada tramo é uma faixa de laje armada **longitudinalmente** (na direção do lance), biapoiada, com o vão medido na
projeção horizontal e as cargas uniformes por trecho (lance, patamar):

- reta: patamar de saída + lance + patamar de chegada;
- L: tramo 1 = lance 1 + patamar de canto; tramo 2 = patamar de canto + lance 2; o patamar entra com metade da carga em
  cada tramo (armado nas duas direções);
- U: tramo 1 = lance 1 + patamar; tramo 2 = patamar + lance 2; cada faixa leva o patamar na largura b + vão central/2.

Por tramo: reações características g e q nos dois apoios (kN/m), Md máximo (onde a cortante zera), VSd = maior reação de
cálculo. Dimensionamento por metro de largura:

- flexão (17.2) com d = h − c − ø/2 e As ≥ ρmín·b·h (Tabela 19.1, laje armada numa direção);
- distribuição: máx(0,2·As; 0,9 cm²/m; 0,5·ρmín·b·h);
- negativa construtiva nos apoios (borda sem continuidade): 0,67·ρmín·b·h;
- cortante sem armadura transversal, VSd ≤ VRd1 (19.4.1);
- flecha: combinação quase permanente, inércia equivalente de Branson com o estádio II da armadura adotada, integração
  de M/EI ao longo do vão, fluência αf (Tabela 17.1); limite l/250;
- espessura mínima de 8 cm (13.2.4.1) e concreto mínimo da CAA.

## Ligação com as vigas

- A escada posicionada na montagem tem o pavimento **de chegada**; o início fica no pavimento de baixo.
- As linhas de apoio dos pisos (início do primeiro lance e chegada do último) que caem sobre o eixo de uma viga do nível
  correspondente viram cargas `elemento` nessa viga, com o vão e a posição do centro do lance. **Conectar
  automaticamente** na montagem e qualquer mudança no editor da escada refazem essas ligações.
- Na viga, a reação da faixa (kN/m × largura do lance) entra como **resultante concentrada** na posição — inclusive na
  grelha do pavimento e no pórtico espacial.
- Os apoios do patamar ficam externos por padrão (alvenaria ou viga de patamar fora da montagem). Para apoiar o patamar
  numa viga, lance a carga na viga: *Cargas › Reação de laje ou escada*, escolhendo a escada, o apoio, o vão e a posição.
  Apoios sem viga aparecem como "externo", com a reação, e geram um aviso.

## Limitações

- Lajes biapoiadas; sem continuidade com a laje do piso nem engaste nas vigas (a negativa é construtiva).
- Sem escadas armadas transversalmente (degraus em balanço ou entre vigas laterais), helicoidais ou autoportantes.
- Patamar de canto da L dividido igualmente entre as duas direções.
- A torção que a reação excêntrica pode causar na viga não é considerada.
