# Estruturas de madeira no LEBR

Os módulos **viga de madeira** (`madeira.viga`), **pilar/montante de madeira**
(`madeira.pilar`) e **entrepiso de madeira** (`madeira.entrepiso`) seguem a
**ABNT NBR 7190-1:2022** (critérios de dimensionamento). O entrepiso e o montante
correspondem aos elementos do sistema **light wood frame** da **ABNT NBR 16936:2023**
(edificações de até dois pavimentos), que remete o dimensionamento das peças à NBR 7190.

## Valores adotados

| Item | Valor no programa |
|---|---|
| Valor de cálculo | Xd = kmod · Xk / γw |
| kmod | kmod1 · kmod2 (a versão 2022 não tem kmod3) |
| kmod1 (serrada, roliça, MLC, MLCC, LVL) | permanente 0,60 · longa 0,70 · média 0,80 · curta 0,90 · instantânea 1,10 |
| kmod2 (mesmos materiais) | umidade 1: 1,00 · 2: 0,90 · 3: 0,80 · 4: 0,70 |
| γw | 1,4 tensões normais · 1,8 cisalhamento (editáveis) |
| γg / γq | 1,4 / 1,5 (editáveis nos parâmetros) |
| Rigidez | Ec0,ef = kmod · E0,med · E0,05 = 0,7 · E0,med (nativas) · G = E0,med/16 |
| Fluência φ | umidade 1–2: 0,8 (permanente/longa), 0,3 (média), 0,1 (curta) · umidade 3–4: 2,0 · 1,0 · 0,5 |
| Estabilidade | λrel = (λ/π)·√(fc0,k/E0,05); kc com βc = 0,2 (serrada/roliça) ou 0,1 (MLC/LVL); dispensa se λrel < 0,3 |
| Flexocompressão | σN/(kc·fc0,d) + σMx/fm,d + kM·σMy/fm,d ≤ 1 (e a combinação trocada), kM = 0,7; com λrel < 0,3 o termo de compressão é ao quadrado |
| Esbeltez máxima | L0 ≤ 40 vezes a dimensão da seção na direção considerada |
| Comprimento de flambagem | L0 = KE·L com KE = 0,65 · 0,8 · 1,0 · 1,2 · 2,1 · 2,4 |
| Espécies nativas | D20 a D60 (corpos de prova); fm,d = fc0,d |
| Peças estruturais | coníferas C14 a C50, folhosas D18 a D70 (fm,k, ft0,k, fc0,k, fc90,k, fv,k, E0,med, E0,05, ρ) |

## Pontos a conferir no texto da norma

Os valores acima foram reunidos de trabalhos acadêmicos que reproduzem a NBR 7190-1:2022.
Os itens abaixo usam critérios de referência e devem ser conferidos:

- **Estabilidade lateral de vigas:** usa o coeficiente βM com βE = 4 e γf = 1,4 (critério tradicional da NBR 7190).
- **Compressão normal às fibras nas espécies nativas:** fc90,k = 0,25·fc0,k, com αn = 1.
- **Tração nas espécies nativas:** ft0,k = fc0,k/0,77 (não usada nas verificações atuais).
- **Limite de flecha:** L/200 para vãos e 2L/200 para balanços, editável (L/250 a L/350).
- **Flecha final:** ufin = (uG + ψ2·uQ)·(1 + φ), com E0,med.
- **Frequência do entrepiso:** f1 ≥ 8 Hz, critério de conforto de referência da EN 1995-1-1, fora da NBR.
- **Classe D70 estrutural:** ft0,k = 42 MPa (0,6·fm,k); a fonte consultada trazia um valor inconsistente.

## Fontes consultadas

- Otimização de pilares de madeira de acordo com restrições da NBR 7190:2022 — *Ambiente Construído* (SciELO).
- Dimensionamento de pilares pela NBR 7190-1:2022 — repositório UFMS.
- Trabalho de conclusão sobre a NBR 7190:2022 — IFTO, 2023 (tabelas de classes de peças estruturais).
- *The new Brazilian timber structures code NBR 7190:2022* — WCTE.
- Comparative dimensioning of plane timber truss by NBR 7190:1997 and NBR 7190-1:2022 — *BioResources*.
- Notícias e resumos da NBR 16936:2023 — Remade, AETEC, ABIMCI.
