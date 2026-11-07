# Validação com exercícios resolvidos publicados

Além dos casos calculados à parte (norma, tabelas clássicas e cálculo manual, ver [VALIDACAO.md](VALIDACAO.md)), o
banco tem **158 casos e 368 grandezas** tirados de **exercícios resolvidos publicados online** por professores e
alunos: apostilas, livros com amostra aberta, TCCs, dissertações e monografias de especialização. Cada caso traz:

- `fonte`: autor, título, instituição, ano e o lugar exato (exemplo, seção, página);
- `url`: onde o documento está publicado (o relatório mostra o link);
- `descricao`: o enunciado do problema, com os dados usados;
- `nota`: o que a fonte faz diferente do LEBR e por que a tolerância é aquela.

No programa, **Ajuda › Exercícios resolvidos (LEBR × fontes)** mostra todos esses problemas com o enunciado, a fonte
com o link, o valor do material publicado e o do LEBR, as hipóteses diferentes, as divergências e os exercícios que
ficaram de fora, e exporta a página em PDF.

Os arquivos são gerados por scripts em `tools/bibliografia/` (um por grupo), para que a fonte, o enunciado e os
valores fiquem juntos e possam ser revistos:

| Arquivo | Script | Casos | Grandezas | Conteúdo |
|---|---|---|---|---|
| `27-bibliografia-pilares.json` | `pilares.py` | 31 | 111 | esbeltez, M1d,mín, αb, λ1, 2ª ordem pela curvatura aproximada, armadura por ábaco |
| `28-bibliografia-fundacoes.json` | `fundacoes.py` | 24 | 58 | blocos (Blévot) de 2, 3 e 4 estacas, intervalo de d, reações com momento, sapatas, σadm pelo SPT, Décourt-Quaresma (ponta) |
| `29-bibliografia-vigas.json` | `vigas.py` | 28 | 60 | flexão simples e dupla, estribos (modelo I), decalagem, seção vazada da torção, estádio II e σs |
| `30-bibliografia-lajes.json` | `lajes.py` | 60 | 106 | momentos negativos e reações por tabela, flechas (Bares), Czerny, VRd1, armadura de lajes, punção, escadas, compatibilização |
| `31-bibliografia-madeira-acoes.json` | `madeira_acoes.py` | 15 | 33 | compressão com kc (NBR 7190-1:2022), flexão e cisalhamento, S2 e pressão dinâmica (NBR 6123), γz |

Para regerar depois de corrigir um valor: `python3 tools/bibliografia/<script>.py` e `npm run validar`.

## Fontes

**Pilares.** Bastos, *Pilares de concreto armado*, UNESP Bauru, 2017; Scadelai, dissertação, EESC-USP, 2004;
Silva, TCC, Unichristus, 2023; Costantin, TCC, UFU, 2021.

**Fundações.** Bastos, *Blocos de fundação*, UNESP Bauru, 2023; Almeida, TCC, UFC, 2013; Alonso, *Exercícios de
fundações*, 3ª ed., Blucher, 2019 (amostra da editora); Sfeir, TCC, UTFPR Guarapuava, 2021; UFPR, TC 041 – exercícios
de capacidade de carga, 2019.

**Vigas.** Bastos, *Flexão normal simples – vigas*, 2015, *Vigas de concreto armado*, 2015, e *Torção em vigas*,
2023, UNESP Bauru; UFPR, TC037, capítulos 5 (2015) e 6 (2016); Pinheiro, Muzardo e Santos, *Fundamentos do concreto e
projeto de edifícios*, EESC-USP, 2007; Pinheiro e Muzardo, *Estados limites de serviço*, EESC-USP, 2004; Lima, Guarda
e Pinheiro, *Torção*, EESC-USP, 2003; Chaer e Oliveira, *Cisalhamento em vigas*, PUC Goiás; Chaer, *Estudo dirigido
– viga biapoiada ELU/ELS*, PUC Goiás, 2015; Bandeira, *Estruturas de concreto armado segundo a NBR 6118/2014*, 2015.

**Lajes, punção, escadas e reservatórios.** Bastos, *Lajes de concreto*, UNESP Bauru, 2015; Camacho, *Estudo das
lajes*, UNESP Ilha Solteira, 2004; EPUSP/FDTE, *ES-013*, 2001; Faria, TCC, UTFPR Campo Mourão, 2019; Reggiani, TCC,
UFSC, 2016; Rodrigues, TCC, UFC, 2020; Leite, TCC, UTFPR Toledo, 2017; Almeida, TCC, IFPB, 2021; Assunção, monografia,
UFMG, 2022; Pinto, monografia, UFMG, 2015; Costa, *Estruturas de concreto armado II*, PUC Goiás, 2016; Oliveira, TCC,
UFU, 2023; Bassanezi, TCC, UTFPR Toledo, 2018; Rodrigues, monografia, UFMG, 2018.

**Madeira e ações.** Nunes, TCC, UEPG, 2022; Santos, *Peças compostas em estruturas de madeira*, UFAL/eduCAPES, 2026;
Carrocière, monografia, UNESP Ilha Solteira, 2025; Santos, TCC, UFPB, 2024; Santos, TCC, UTFPR Campo Mourão, 2019;
Zumaeta, *Análise da estabilidade de edifícios*, TQS, 2016.

Os links completos estão em cada caso e no relatório (**Ajuda › Relatório de validação**).

## Diferenças encontradas

Os exercícios publicados nem sempre seguem as mesmas hipóteses do LEBR. Onde a diferença é de hipótese (e não erro),
o caso compara só as grandezas que não dependem dela e a `nota` explica. Os pontos abaixo **precisam da revisão de
engenheiros**:

1. **Punção — τRd1 com k ≤ 2.** O LEBR limita k = 1 + √(20/d) a 2; as fontes (Camacho 2004 e Assunção 2022) não
   limitam. Em lajes com d < 20 cm o τRd1 do LEBR fica 10 a 13 % menor (a favor da segurança). Os casos comparam
   perímetros, τSd e τRd2, mas não τRd1, até a regra ser conferida no texto da NBR 6118:2023.
2. **Blocos — KR da tensão-limite nas bielas.** O LEBR usa KR = 0,9; Bastos usa 0,95 e o TCC da UFC, 0,85. A
   tensão-limite não é comparada.
3. **Torção — Ae.** Bastos calcula Ae e ue pela linha dos eixos das barras de canto; o LEBR, pela linha média da
   parede (17.5.1.4.1). Só he é comparado; o TRd2 do LEBR sai cerca de 7 % maior.
4. **Reações de lajes pelo processo das áreas.** Nas bordas apoiadas vizinhas de bordas engastadas, os coeficientes
   das tabelas usadas por Bastos (por exemplo νy = 2,17 no tipo 3) não fecham o equilíbrio da laje (a soma passa de
   100 % da carga); o LEBR distribui toda a carga pelas retas a 45° e 60° e dá 1,83. Só as bordas engastadas são
   comparadas.
5. **Momentos positivos de lajes.** As tabelas de Bares usadas nas apostilas correspondem a um coeficiente de Poisson
   menor que o 0,2 do LEBR; os positivos do LEBR saem até 15 % maiores (a favor da segurança). Comparam-se os
   negativos, que não dependem de ν, e os casos de laje apoiada nas quatro bordas, em que as tabelas usam ν = 0,2.
6. **Abertura de fissuras.** O LEBR monta a região de envolvimento de cada barra (até 7,5ø, limitada pelas vizinhas);
   Pinheiro usa Acr = 87,62 cm² por barra. Na mesma viga, wk = 0,16 mm no LEBR e 0,19 mm na fonte. Só σs é comparado.

Sem divergência, mas vale saber: no bloco sobre 2 estacas, Bastos e o TCC da UFC aumentam o tirante em 15 %
(Blévot). O motor (`bloco.bielasETirantes`) devolve a força sem o acréscimo, que o módulo do bloco aplica na
armadura; os casos comparam a força sem ele.

## Exercícios que ficaram de fora

- **Bastos (lajes), L7 tipo 5A:** μ'x = 8,81 na fonte e 7,78 no LEBR; as outras lajes 5A do mesmo exemplo e da
  tabela conferem, o que sugere erro de leitura ou de digitação.
- **Bastos (lajes), L3:** coeficiente de flecha α = 2,96 contra 3,13 no LEBR para λ = 1,12 (a L2 do mesmo exemplo
  confere).
- **Faria (lajes), armadura negativa:** As = 8,67 cm²/m contra 9,16 no LEBR para m'x,d = 24,64 kN·m/m e d = 7,5 cm;
  a altura útil usada pela fonte não está clara.
- **UFPB (madeira), vigas V21, pilar P16 e pilarete:** os k e kc publicados não saem da fórmula da norma com os λrel
  e o βc publicados.
- **Apostila da UFSC (madeira):** segue a NBR 7190:1997 (excentricidades e Ec0,ef), que o LEBR não implementa.
- **Lima/Pinheiro (torção):** a fonte adota he = 8 cm por escolha; o LEBR usa he = A/u.
- **Capacidade lateral de estacas (UFPR, UFC, Souza Neto):** os critérios de Nl (limite N ≥ 3, exclusão dos ensaios
  da ponta, N médio por camada) diferem entre as fontes e o LEBR; só a ponta foi comparada. Os exemplos com CPT e
  com estaca raiz não têm equivalente no LEBR.

Não foram encontrados exercícios resolvidos com números para combinações de ações, parâmetro α e desaprumo θ1.
