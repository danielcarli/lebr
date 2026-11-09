# Relatório de confiabilidade — LEBR 0.62.0

Gerado em 2026-11-09 · semente 20261108 · 1000 sorteios por família.

## Resumo

| Camada | Resultado |
|---|---|
| 1. Banco de casos (norma, tabelas, soluções fechadas, exercícios publicados) | 323 de 323 casos · 917 grandezas · maior desvio 9,80 % |
| 2. Varreduras aleatórias de invariantes | 20000 sorteios · 138269 verificações · 0 falhas · taxa de falha < 0,015 % (95 %) |
| 3. Fechamento do caminho das cargas nos exemplos | 7 de 7 projetos com desvio ≤ 1 % e tudo atendendo |

**139193 verificações independentes** no total. Nenhuma falha.

## 1. Desvios em relação às fontes

| | Todas as grandezas | Só exercícios publicados |
|---|---|---|
| Grandezas comparadas | 874 | 368 |
| Coincidência exata (≤ 0,01 %) | 531 (61 %) | 126 (34 %) |
| Desvio médio | 0,16 % | 0,31 % |
| Mediana | 0,00 % | 0,04 % |
| Percentil 90 | 0,39 % | 0,80 % |
| Percentil 95 | 0,86 % | 1,45 % |
| Máximo | 9,80 % | 9,80 % |
| Dentro de 1 % | 96,0 % | 92,7 % |
| Dentro de 2 % | 98,5 % | 96,7 % |
| Dentro de 5 % | 99,8 % | 99,5 % |

Os desvios acima de 2 % têm hipótese diferente documentada no caso (`nota`): arredondamento de tabela, ábaco lido a olho, coeficiente adotado pelo autor.

## 2. Varreduras de invariantes

| Família | Módulo | Sorteios | Verificações | Falhas | Taxa de falha (limite 95 %) |
|---|---|---|---|---|---|
| Viga contínua (motor de vigas) | `concreto.viga` | 1000 | 4165 | 0 | < 0,30 % |
| Treliça da tesoura (equilíbrio dos nós) | `madeira.tesoura` | 1000 | 5617 | 0 | < 0,30 % |
| Flexão simples da seção retangular | `concreto.viga` | 1000 | 7563 | 0 | < 0,30 % |
| Cortante em vigas (modelo I) | `concreto.viga` | 1000 | 6000 | 0 | < 0,30 % |
| Pilar retangular (flexocompressão) | `concreto.pilar` | 1000 | 3994 | 0 | < 0,30 % |
| Placa por elementos finitos | `concreto.laje.macica` | 1000 | 7000 | 0 | < 0,30 % |
| Punção (contornos C e C′) | `concreto.laje.macica` | 1000 | 10000 | 0 | < 0,30 % |
| Sapata isolada | `concreto.sapata` | 1000 | 13973 | 0 | < 0,30 % |
| Bloco sobre estacas (bielas e tirantes) | `concreto.bloco` | 1000 | 2506 | 0 | < 0,30 % |
| Capacidade de carga de estacas | `geotecnia.estaca` | 1000 | 7000 | 0 | < 0,30 % |
| Madeira (NBR 7190-1:2022) | `madeira.viga` | 1000 | 9000 | 0 | < 0,30 % |
| Vento (NBR 6123) e combinações (NBR 8681) | `concreto.pilar` | 1000 | 7000 | 0 | < 0,30 % |
| Estádio II e abertura de fissuras | `concreto.viga` | 1000 | 5000 | 0 | < 0,30 % |
| Viga de concreto (módulo completo) | `concreto.viga` | 1000 | 6000 | 0 | < 0,30 % |
| Viga com seção própria em cada vão (módulo completo) | `concreto.viga` | 1000 | 10010 | 0 | < 0,30 % |
| Lajes maciça, treliçada e nervurada (módulos completos) | `concreto.laje.macica` | 1000 | 5000 | 0 | < 0,30 % |
| Pilar de concreto (módulo completo) | `concreto.pilar` | 1000 | 5824 | 0 | < 0,30 % |
| Bloco, estaca, sapata corrida e radier (módulos completos) | `concreto.bloco` | 1000 | 5613 | 0 | < 0,30 % |
| Telhado e tesoura de madeira (módulos completos) | `madeira.telhado` | 1000 | 11000 | 0 | < 0,30 % |
| Escada e reservatório (módulos completos) | `concreto.escada` | 1000 | 6004 | 0 | < 0,30 % |

Invariantes conferidos por família:

- **Viga contínua (motor de vigas)** — Estática: ΣV = 0, linearidade do método dos deslocamentos, M = qL²/8 e f = 5qL⁴/(384EI) na biapoiada.
  - equilíbrio vertical ΣR = Σ cargas: 1000 verificações
  - superposição (linearidade): 1000 verificações
  - simetria (viga espelhada): 1000 verificações
  - sem NaN: 1000 verificações
  - biapoiada: M = qL²/8: 55 verificações
  - biapoiada: f = 5qL⁴/(384EI): 55 verificações
  - biapoiada: R = qL/2: 55 verificações
- **Treliça da tesoura (equilíbrio dos nós)** — Estática: ΣFx = ΣFy = 0 em cada nó com os esforços obtidos; simetria; Howe com montantes tracionados.
  - equilíbrio em cada nó: 1000 verificações
  - equilíbrio global: 1000 verificações
  - simetria sob carga simétrica: 539 verificações
  - banzo superior comprimido e inferior tracionado: 539 verificações
  - Pratt: montantes comprimidos, diagonais tracionadas: 287 verificações
  - Hankinson: fc90,d ≤ fc,α,d ≤ fc0,d: 1000 verificações
  - entalhe: e dobra com a força: 1000 verificações
  - Howe: montantes tracionados, diagonais comprimidas: 252 verificações
- **Flexão simples da seção retangular** — NBR 6118 17.2.2 e 17.2.3: equilíbrio da seção (conferido com o motor de flexocompressão, N = 0), x/d ≤ 0,45 (C20–C50) ou 0,35, As ≥ As,mín, As cresce com Md.
  - sem NaN: 1000 verificações
  - x/d ≤ ξ,lim (ductilidade): 1000 verificações
  - As ≥ As,mín: 1000 verificações
  - ok ⇔ As ≤ 4 % Ac e Kmd ≤ 2·Kmd,lim: 1000 verificações
  - MRd(As) ≥ Md pelo motor de flexocompressão: 1000 verificações
  - MRd(As) ≈ Md (mínima não governa): 563 verificações
  - As não diminui com Md maior: 1000 verificações
  - domínio coerente com ξ: 1000 verificações
- **Cortante em vigas (modelo I)** — NBR 6118 17.4.2.2: VRd2 = 0,27·αv2·fcd·bw·d; Vc = 0,6·fctd·bw·d; Asw/s = (Vd − Vc)/(0,9·d·fywd) e ≥ mínima (17.4.1.1.1).
  - sem NaN: 1000 verificações
  - Asw/s ≥ (Vd − Vc)/(0,9·d·fywd): 1000 verificações
  - Asw/s ≥ mínima: 1000 verificações
  - VRd2 do motor = fórmula: 1000 verificações
  - Vc do motor = fórmula: 1000 verificações
  - ok ⇔ Vd ≤ VRd2: 1000 verificações
- **Pilar retangular (flexocompressão)** — NBR 6118 17.2.5 e 18.4.2.1: As,mín = máx(0,15·Nd/fyd; 0,4 % Ac), As ≤ 4 % Ac; o momento resistente a θ = 0 da curva oblíqua coincide com o da flexão normal; a curva de interação encolhe com Nd crescente.
  - As,mín do motor = máx(0,15·Nd/fyd; 0,4 % Ac): 1000 verificações
  - As,mín ≤ As ≤ 4 % Ac: 994 verificações
  - todos os pontos de cálculo dentro da curva: 994 verificações
  - M1d,mín = Nd·(1,5 + 0,03h): 1000 verificações
  - sem arranjo ⇒ seção 10 cm maior resolve: 6 verificações
- **Placa por elementos finitos** — Timoshenko & Woinowsky-Krieger: série de Navier da placa simplesmente apoiada (ν = 0,2); equilíbrio: soma das reações = carga; simetria lx ↔ ly.
  - equilíbrio: Σ reações = p·lx·ly: 1000 verificações
  - sem NaN: 1000 verificações
  - apoiada: w máx = Navier (±3 %): 1000 verificações
  - apoiada: mx = Navier (±5 %): 1000 verificações
  - apoiada: my = Navier (±5 %): 1000 verificações
  - simetria lx ↔ ly: 1000 verificações
  - engastar uma borda não aumenta a flecha: 1000 verificações
- **Punção (contornos C e C′)** — NBR 6118 19.5.2: u0 = 2(c1 + c2), u1 = u0 + 4πd (pilar interno); τSd = FSd/(u·d); τRd2 = 0,27·αv2·fcd; K da Tabela 19.2 entre 0,45 e 0,80.
  - u0 = 2(c1 + c2): 1000 verificações
  - u1 = u0 + 4πd: 1000 verificações
  - τSd em C ≥ FSd/(u0·d): 1000 verificações
  - τSd em C′ ≥ FSd/(u1·d): 1000 verificações
  - τSd em C > τSd em C′: 1000 verificações
  - τRd2 = 0,27·αv2·fcd: 1000 verificações
  - τSd em C = FSd/(u0·d) sem momento: 1000 verificações
  - C não atende ⇒ ok falso; ok ⇒ C atende: 1000 verificações
  - K entre 0,45 e 0,80 e cresce com c1/c2: 1000 verificações
  - τSd em C′ diminui com d maior: 1000 verificações
- **Sapata isolada** — NBR 6122: σ = N/(A·B) (e com momento σmáx = N/A·(1 + 6e/B) dentro do núcleo), balanços iguais, h rígida ≥ (A − ap)/3; dimensões em múltiplos de 5 cm.
  - A·B ≥ área necessária: 1000 verificações
  - balanços iguais: A − ap ≈ B − bp (±5 cm), salvo a dimensão mínima de 60 cm: 1000 verificações
  - σméd = N/(A·B): 1000 verificações
  - σmáx = σméd·(1 + 6e/A) dentro do núcleo: 973 verificações
  - σmáx ≥ σméd ≥ σmín: 1000 verificações
  - sapataRigida ⇔ h ≥ (A − ap)/3: 1000 verificações
  - módulo: sem erro: 1000 verificações
  - módulo: σméd ≤ σadm: 1000 verificações
  - módulo: σméd = Ntot/(A·B): 1000 verificações
  - módulo: Ntot = Nk + PP + terra: 1000 verificações
  - módulo: balanços iguais sem momento (A − ap = B − bp), salvo a dimensão mínima: 614 verificações
  - módulo: sapata rígida automática: 1000 verificações
  - módulo: ok ⇔ todas as verificações ok: 1000 verificações
  - módulo: As ≥ As,mín nas duas direções: 1000 verificações
  - módulo: com momento, a base fica inteiramente comprimida ou avisa: 386 verificações
- **Bloco sobre estacas (bielas e tirantes)** — Estática: ΣR = N e ΣR·x = M; Blévot: 2 estacas Rst = Nd·(2e − ap)/(8d), biela entre 45° e 55°.
  - ΣR = N: 1000 verificações
  - ΣR·x = Mx: 1000 verificações
  - Blévot 2 estacas: Rst = Nd(2e − ap)/(8d): 253 verificações
  - biela entre 40° e 60°: 253 verificações
- **Capacidade de carga de estacas** — Aoki-Velloso (1975): rp = K·Np/F1, rl = α·K·Nl/F2 — em perfil uniforme Rl é proporcional a L e Rp não depende de L; Décourt-Quaresma cresce com L; carga admissível com FS = 2.
  - sem NaN: 1000 verificações
  - Aoki-Velloso: Rl(2L) = 2·Rl(L) em perfil uniforme: 1000 verificações
  - Aoki-Velloso: Rp não depende de L em perfil uniforme: 1000 verificações
  - Décourt-Quaresma: R cresce com L: 1000 verificações
  - F2 = 2·F1: 1000 verificações
  - rp = K·N/F1: 1000 verificações
  - Rp = rp·Ap: 1000 verificações
- **Madeira (NBR 7190-1:2022)** — Xd = kmod·Xk/γw; kc(λrel) não crescente e = 1 para λrel < 0,3; σ = 6M/(bh²); τ = 1,5V/(bh); com λrel grande kc → 1/λrel² (Euler).
  - fc0,d = kmod·fc0,k/γw: 1000 verificações
  - fv,d = kmod·fv,k/1,8: 1000 verificações
  - kc(0,29) = 1 e kc não cresce com λrel: 1000 verificações
  - kc → 1/λrel² (Euler) para λrel grande: 1000 verificações
  - σM = 6·Md/(b·h²): 1000 verificações
  - τ = 1,5·Vd/(b·h): 1000 verificações
  - λy = L0/(b/√12): 1000 verificações
  - interação cresce com Nd: 1000 verificações
  - interação cresce com L0: 1000 verificações
- **Vento (NBR 6123) e combinações (NBR 8681)** — q = 0,613·Vk² (Pa); S2 cresce com z; a força de arrasto é proporcional a V0²; envoltória contém todas as combinações; ELU normal = γg·G + γq·Q.
  - q = 0,613·Vk²/1000: 1000 verificações
  - S2 cresce com z: 1000 verificações
  - força de arrasto ∝ V0²: 1000 verificações
  - Σ forças por nível = total: 1000 verificações
  - pressão por nível cresce com z (S2): 1000 verificações
  - envoltória ELU contém γg·G + γq·Q: 1000 verificações
  - envoltória: mín ≤ máx e mín ≤ G: 1000 verificações
- **Estádio II e abertura de fissuras** — Estádio II: b·x²/2 = αe·As·(d − x); I₂ = b·x³/3 + αe·As·(d − x)²; wk cresce com Ms (17.3.3.2).
  - b·x²/2 = αe·As·(d − x): 1000 verificações
  - I₂ = b·x³/3 + αe·As·(d − x)²: 1000 verificações
  - x < d: 1000 verificações
  - wk cresce com Ms: 1000 verificações
  - wk = mín(w1, w2): 1000 verificações
- **Viga de concreto (módulo completo)** — Equilíbrio: Σ reações características = peso próprio + cargas; detalhamento com As,ef ≥ As,calc; nenhum NaN.
  - viga: sem erro: 1000 verificações
  - viga: verificações sem NaN/undefined: 1000 verificações
  - viga: ok ⇔ todas as verificações ok: 1000 verificações
  - viga: memorial sem NaN: 1000 verificações
  - viga: Σ Rg = pp + g: 1000 verificações
  - viga: Σ Rq = q·L: 1000 verificações
- **Viga com seção própria em cada vão (módulo completo)** — Equilíbrio com o peso próprio vão a vão; reações iguais às do motor com EI de cada vão (método dos deslocamentos refeito por fora); nenhuma barra atravessa um apoio onde a sua face muda de nível; vãos iguais à seção da viga dão o mesmo resultado da seção constante.
  - viga por vão: sem erro: 1000 verificações
  - viga por vão: verificações sem NaN/undefined: 1000 verificações
  - viga por vão: ok ⇔ todas as verificações ok: 1000 verificações
  - viga por vão: memorial sem NaN: 1000 verificações
  - viga por vão: Σ Rg = Σ (pp do vão + g)·L: 1000 verificações
  - viga por vão: Σ Rq = q·ΣL: 1000 verificações
  - viga por vão: reações = motor com EI por vão: 1000 verificações
  - viga por vão: nenhuma barra atravessa apoio onde a face muda: 2010 verificações
  - viga por vão: vãos iguais ≡ seção constante: 1000 verificações
- **Lajes maciça, treliçada e nervurada (módulos completos)** — Equilíbrio: Σ reações nas bordas = (g + q)·área; As ≥ As,mín; nenhum NaN.
  - nervurada: sem erro: 329 verificações
  - nervurada: verificações sem NaN/undefined: 329 verificações
  - nervurada: ok ⇔ todas as verificações ok: 329 verificações
  - nervurada: memorial sem NaN: 329 verificações
  - nervurada: Σ reações nas bordas = (g + q)·área (±3 %): 329 verificações
  - macica: sem erro: 332 verificações
  - macica: verificações sem NaN/undefined: 332 verificações
  - macica: ok ⇔ todas as verificações ok: 332 verificações
  - macica: memorial sem NaN: 332 verificações
  - macica: Σ reações nas bordas = (g + q)·área (±3 %): 332 verificações
  - trelicada: sem erro: 339 verificações
  - trelicada: verificações sem NaN/undefined: 339 verificações
  - trelicada: ok ⇔ todas as verificações ok: 339 verificações
  - trelicada: memorial sem NaN: 339 verificações
  - trelicada: Σ reações nas bordas = (g + q)·área (±3 %): 339 verificações
- **Pilar de concreto (módulo completo)** — Nd = 1,4·(Nk + peso próprio); As entre as taxas mínima e máxima; λ ≤ 90 nas seções usuais; nenhum NaN.
  - pilar: sem erro: 1000 verificações
  - pilar: verificações sem NaN/undefined: 1000 verificações
  - pilar: ok ⇔ todas as verificações ok: 1000 verificações
  - pilar: memorial sem NaN: 1000 verificações
  - pilar: Nd = γn·1,4·(Ng + pp + Nq): 1000 verificações
  - pilar: 0,4 % Ac ≤ As ≤ 4 % Ac: 824 verificações
- **Bloco, estaca, sapata corrida e radier (módulos completos)** — Equilíbrio e coerência: Σ reações das estacas = Nd; carga da estaca ≤ admissível quando ok; pressão do radier = N/A; nenhum NaN.
  - sapata corrida: sem erro: 264 verificações
  - sapata corrida: verificações sem NaN/undefined: 264 verificações
  - sapata corrida: ok ⇔ todas as verificações ok: 264 verificações
  - sapata corrida: memorial sem NaN: 264 verificações
  - sapata corrida: σ ≤ σadm: 264 verificações
  - sapata corrida: B múltiplo de 5 e ≥ 60: 264 verificações
  - sapata corrida: σ = (n + pp + terra)/B: 264 verificações
  - radier: sem erro: 267 verificações
  - radier: verificações sem NaN/undefined: 267 verificações
  - radier: ok ⇔ todas as verificações ok: 267 verificações
  - radier: memorial sem NaN: 267 verificações
  - radier: σméd = N/A: 267 verificações
  - radier: pega os 4 pilares: 267 verificações
  - radier: N = Σ Nk dos pilares + peso próprio + piso: 267 verificações
  - bloco: sem erro: 233 verificações
  - bloco: verificações sem NaN/undefined: 233 verificações
  - bloco: ok ⇔ todas as verificações ok: 233 verificações
  - bloco: memorial sem NaN: 233 verificações
  - estaca: sem erro: 236 verificações
  - estaca: verificações sem NaN/undefined: 236 verificações
  - estaca: ok ⇔ todas as verificações ok: 236 verificações
  - estaca: memorial sem NaN: 236 verificações
  - estaca: carga de trabalho ≤ admissível quando ok: 20 verificações
- **Telhado e tesoura de madeira (módulos completos)** — Equilíbrio: Σ cargas nos nós da tesoura = peso do telhado por tesoura; reações da tesoura = Σ nós + peso próprio; nenhum NaN.
  - telhado: sem erro: 1000 verificações
  - telhado: verificações sem NaN/undefined: 1000 verificações
  - telhado: ok ⇔ todas as verificações ok: 1000 verificações
  - telhado: memorial sem NaN: 1000 verificações
  - tesoura: sem erro: 1000 verificações
  - tesoura: verificações sem NaN/undefined: 1000 verificações
  - tesoura: ok ⇔ todas as verificações ok: 1000 verificações
  - tesoura: memorial sem NaN: 1000 verificações
  - tesoura: Σ Rg = Σ G nos nós + peso próprio: 1000 verificações
  - tesoura: Σ Rq = Σ Q nos nós: 1000 verificações
  - telhado: Σ cargas nos apoios = peso total: 1000 verificações
- **Escada e reservatório (módulos completos)** — Blondel 63 ≤ 2e + p ≤ 65 quando ok; volume de água = a·b·hAgua; nenhum NaN.
  - escada: sem erro: 502 verificações
  - escada: verificações sem NaN/undefined: 502 verificações
  - escada: ok ⇔ todas as verificações ok: 502 verificações
  - escada: memorial sem NaN: 502 verificações
  - escada: Blondel 2e + p entre 60 e 66 cm: 502 verificações
  - escada: n·e = desnível: 502 verificações
  - escada: 16 ≤ e ≤ 18,5 cm (NBR 9050): 502 verificações
  - reservatório: sem erro: 498 verificações
  - reservatório: verificações sem NaN/undefined: 498 verificações
  - reservatório: ok ⇔ todas as verificações ok: 498 verificações
  - reservatório: memorial sem NaN: 498 verificações
  - reservatório: volume = a·b·hAgua: 498 verificações

## 3. Caminho das cargas nos projetos de exemplo

| Projeto | Elementos | Entra (kN) | Chega à fundação (kN) | Desvio | Pendências |
|---|---|---|---|---|---|
| aeroporto-terminal-satelite | 466 | 90917 | 90915 | -0,00 % | — |
| edificio-18-pavimentos | 612 | 37752 | 37752 | 0,00 % | — |
| edificio-3-pavimentos | 96 | 3224 | 3231 | 0,22 % | 4 apoio(s) de escada em alvenaria |
| edificio-exemplo | 13 | 1287 | 1287 | -0,00 % | — |
| residencia-terrea-baldrame | 31 | 1476 | 1476 | -0,00 % | — |
| sobrado-garagem | 90 | 2256 | 2258 | 0,09 % | 2 apoio(s) de escada em alvenaria |
| terminal-aeroporto | 292 | 59004 | 59003 | -0,00 % | — |

O peso que entra é somado elemento a elemento (área das lajes × carga, peso próprio e paredes das vigas, pilares, escadas, reservatórios e telhado), sem passar pelas reações; o que chega é a soma das cargas características nas fundações.

## 4. Cobertura por módulo

| Módulo | Casos do banco | dos quais exercícios publicados | Grandezas | Famílias de invariantes | Sorteios |
|---|---|---|---|---|---|
| `concreto.viga` | 115 | 46 | 300 | viga-continua, flexao-secao, cisalhamento, fissuracao, elemento-viga, elemento-viga-secoes | 6000 |
| `concreto.laje.macica` | 49 | 31 | 114 | placa, puncao, elemento-laje | 3000 |
| `concreto.pilar` | 72 | 41 | 228 | pilar, vento-combinacoes, elemento-pilar | 3000 |
| `concreto.laje.trelicada` | 0 | 0 | 0 | elemento-laje | 1000 |
| `concreto.laje.nervurada` | 0 | 0 | 0 | elemento-laje | 1000 |
| `concreto.laje.alveolar` | 0 | 0 | 0 | — | 0 |
| `madeira.viga` | 8 | 5 | 30 | madeira | 1000 |
| `madeira.pilar` | 0 | 0 | 0 | — | 0 |
| `madeira.entrepiso` | 0 | 0 | 0 | — | 0 |
| `geotecnia.sondagem` | 11 | 0 | 21 | — | 0 |
| `concreto.sapata` | 15 | 7 | 39 | sapata | 1000 |
| `geotecnia.estaca` | 5 | 2 | 27 | estacas, elemento-fundacoes | 2000 |
| `concreto.bloco` | 22 | 15 | 72 | bloco, elemento-fundacoes | 2000 |
| `concreto.escada` | 7 | 3 | 36 | elemento-escada-reservatorio | 1000 |
| `concreto.reservatorio` | 14 | 8 | 24 | elemento-escada-reservatorio | 1000 |
| `concreto.sapataCorrida` | 0 | 0 | 0 | elemento-fundacoes | 1000 |
| `concreto.radier` | 1 | 0 | 4 | elemento-fundacoes | 1000 |
| `madeira.telhado` | 1 | 0 | 6 | elemento-madeira-telhado | 1000 |
| `madeira.tesoura` | 3 | 0 | 16 | trelica, elemento-madeira-telhado | 2000 |

## O que esta estatística garante — e o que não garante

- Com 20000 sorteios sem falha, a probabilidade de uma entrada sorteada nesses domínios violar um invariante é menor que 0,015 %, com 95 % de confiança (regra dos três). Isso vale para o domínio sorteado (seções, vãos, cargas e materiais usuais) e para os invariantes listados; não cobre entradas fora dele nem erros que preservem equilíbrio, simetria e limites (por exemplo um coeficiente de norma trocado por outro plausível).
- Os exercícios publicados conferem os coeficientes e as expressões da norma item a item; os desvios acima de 2 % estão explicados caso a caso.
- Nenhum conjunto de testes torna um programa "seguro para uso real" por si só: a NBR 6118 e a NBR 7190 exigem que o projeto seja de responsabilidade de um engenheiro habilitado, que confere as hipóteses, os dados de entrada e os resultados. O LEBR continua um protótipo; estes números medem a consistência interna e a aderência às fontes, não substituem a verificação independente.