# Reservatórios

Módulo `concreto.reservatorio` (sigla CR1, categoria *Reservatórios*), a partir da 0.25.0:
`src/modules/concreto-reservatorio/`; motor `src/engine/reservatorio.js` e placas em `src/engine/placa.js`.
Referências: NBR 6118:2023 (14.7.6.2, 17.3.3, 18.3.6, 19.4.1, 22.4); Bastos, *Reservatórios* (UNESP); Hanai,
*Reservatórios com fundo elástico* (EESC-USP).

## Geometria e modelo

- Caixa retangular de uma célula; medidas internas a (x), b (y) e altura H; lâmina d'água máxima.
- As placas usam os eixos: paredes de Lx = a + e e Ly = b + e por Hw = H + hf/2 + ht/2.
- Vínculos: paredes engastadas entre si (arestas verticais) e no fundo, apoiadas na tampa (ou livres no topo); fundo
  engastado nas paredes; tampa apoiada.
- Placas por elementos finitos (Adini–Clough–Melosh), agora com carga **linear em y** (pressão triangular ou trapezoidal).

## Ações e casos

| Caso | Paredes | Fundo |
|---|---|---|
| Cheio (elevado e enterrado) | pressão hidrostática γw·(hágua − y), γw = 10 kN/m³ | elevado: γc·hf + revestimento + água; enterrado: reação do solo menos o que está sobre o fundo, (paredes + tampa)/área, para cima |
| Vazio (enterrado) | empuxo em repouso K0·(γs·(H − y) + q), K0 = 1 − sen φ | o mesmo do cheio |

ELU com γf = 1,4 para a água, a terra e os pesos; a fissuração usa a água no nível máximo (ação quase permanente).

## Esforços e armaduras

- Negativos compatibilizados em cada aresta comum: M = máx(0,8·M maior; média), com o positivo da placa que teve o
  negativo reduzido aumentado da metade da redução (14.7.6.2). Na base, só quando as duas placas tracionam a mesma face.
- Tração nas paredes: a reação de uma parede na aresta vertical (média na altura) é a força de tração horizontal na
  vizinha; As,tr = Nd/fyd dividida entre as duas faces (flexo-tração por superposição).
- Faces: com água, os vãos tracionam a face externa e as arestas a interna; com empuxo, o contrário.
- Armadura de cada face e direção: flexão (17.2), mínima da Tabela 19.1 (0,67·ρmín nos vãos, ρmín nas arestas) e
  aumento das barras até wk ≤ limite (17.3.3), 0,1 mm por padrão para estanqueidade.
- Cortante sem armadura transversal na base das paredes e nas bordas do fundo (19.4.1).

## Apoios e reações

- **Paredes sobre vigas**: reação por metro de parede = peso da parede + reação do fundo (com a água) + reação da tampa
  (g) e a sobrecarga da tampa (q). Na montagem, cada parede se liga às vigas sob ela; se cobre só parte de um vão, a carga
  fica só no trecho (`trecho` na carga da viga, aplicada como seis resultantes).
- **Pilares nos cantos**: G/4 e Q/4 em cada canto. As paredes trabalham como vigas-parede entre os pilares (22.4):
  Md = qd·l²/8 com z = 0,2·(l + 2h) para 1 ≤ l/h ≤ 2, 0,6·l para l/h < 1, 0,8·h acima de 2; e o fundo fica pendurado na
  base delas, com As,susp = Rd/fyd por metro (18.3.6).
- **Enterrado**: tensão no solo (G + Q)/área externa ≤ σadm.

## Limitações

- Uma célula, sem septo divisor; espessuras constantes; sem mísulas.
- Sem subpressão nem flutuação do enterrado; sem fundo apoiado em solo elástico.
- Vigas-parede verificadas só pelo tirante; sem a verificação das bielas e dos apoios de 22.4.
