# Confiabilidade e acurácia: como o LEBR é testado

O LEBR é validado em **três camadas** independentes, todas automatizadas e rodando em `npm test` (amostra) e em
`npm run confiabilidade` (campanha inteira, com relatório estatístico em
[CONFIABILIDADE-RELATORIO.md](CONFIABILIDADE-RELATORIO.md) e `validacao/confiabilidade.json`).

| Camada | O que confere | Onde |
|---|---|---|
| 1. Banco de casos | Cada resultado comparado com um valor que **não vem do programa**: expressão da norma, tabela clássica (Timoshenko, Bares, Czerny), solução fechada (Clapeyron, Navier, equilíbrio dos nós) ou **exercício resolvido publicado** (158 casos de apostilas, livros, TCCs e dissertações, com fonte, página e enunciado) | `validacao/casos/*.json`, [VALIDACAO.md](VALIDACAO.md), [VALIDACAO-BIBLIOGRAFIA.md](VALIDACAO-BIBLIOGRAFIA.md) |
| 2. Varreduras de invariantes | Milhares de entradas sorteadas em domínios de projeto usuais; para cada uma, propriedades que o resultado tem de ter **qualquer que seja o método**: equilíbrio, simetria, superposição, monotonicidade, limites da norma, coincidência entre dois caminhos de cálculo e com soluções exatas | `src/validacao/invariantes.js` |
| 3. Caminho das cargas | Em projetos inteiros (os sete exemplos), o peso somado elemento a elemento, sem passar pelas reações, tem de chegar às fundações pela cadeia laje → viga → pilar → fundação | `src/validacao/caminho-cargas.js` |

## Camada 1 — banco de casos

322 casos e 913 grandezas (0.61). Metade vem de exercícios publicados: cada caso guarda a fonte (autor, título,
instituição, ano, página), o endereço onde está publicada, o enunciado com os dados e uma nota com as hipóteses
diferentes. O relatório mostra a distribuição dos desvios (média, mediana, percentis 90 e 95, máximo e a fração
dentro de 1 %, 2 % e 5 %). Os desvios acima de 2 % são casos em que a fonte usa um coeficiente arredondado,
lê um ábaco a olho ou adota uma hipótese distinta — a diferença está explicada no próprio caso.

Os módulos novos sem exercício publicado (tesoura, telhado, radier) entraram pela via analítica
(`32-analiticos.json`): tesoura simples e Howe de 4 painéis resolvidas pelo método dos nós, Hankinson, viga de três
vãos por Clapeyron, placa 1:2 pela série de Navier, terça do telhado pela resistência dos materiais e o radier rígido
com quatro pilares simétricos.

## Camada 2 — varreduras de invariantes (testes metamórficos)

Um gerador com semente (reprodutível) sorteia entradas válidas e o programa confere, por sorteio, de 3 a 12
invariantes. As 19 famílias:

| Família | Invariantes (resumo) |
|---|---|
| Viga contínua | ΣR = Σ cargas; linearidade; viga espelhada dá reações espelhadas; biapoiada: M = qL²/8, f = 5qL⁴/384EI |
| Treliça da tesoura | equilíbrio ΣF = 0 recalculado em **cada nó** por fora do solver; simetria; Howe com montantes tracionados e diagonais comprimidas, Pratt ao contrário; Hankinson entre fc90 e fc0 |
| Flexão da seção | x/d ≤ ξ,lim; As ≥ As,mín; **MRd(As) ≈ Md conferido pelo motor de flexocompressão** (outro código); As não diminui com Md |
| Cortante | VRd2, Vc e Asw/s mínimos refeitos pela expressão da norma |
| Pilar | As,mín = máx(0,15·Nd/fyd; 0,4 % Ac); As ≤ 4 % Ac; **MRd da curva oblíqua a θ = 0 = MRd da flexão normal**; M1d,mín = Nd(1,5 + 0,03h); sem arranjo só quando a seção é pequena |
| Placa (elementos finitos) | Σ reações = carga; simetria lx ↔ ly; apoiada: w e momentos pela **série de Navier** (±3–5 %); engastar não aumenta a flecha |
| Punção | u0 = 2(c1 + c2), u1 = u0 + 4πd; τSd = FSd/(u·d); τRd2 = 0,27·αv2·fcd; τSd(C′) cai com d; K da Tabela 19.2 |
| Sapata isolada | A·B ≥ área; balanços iguais; σ = N/(A·B) e σmáx com momento no núcleo; h rígida; módulo inteiro: σ ≤ σadm, Ntot = Nk + PP + terra |
| Bloco | ΣR = N e ΣR·x = M; Blévot 2 estacas Rst = Nd(2e − ap)/(8d); biela entre 40° e 60° |
| Estacas | Aoki-Velloso em perfil uniforme: Rl ∝ L, Rp independe de L, rp = K·N/F1, F2 = 2F1; Décourt cresce com L |
| Madeira | Xd = kmod·Xk/γw; kc não crescente e → 1/λ² (Euler); σ = 6M/bh²; τ = 1,5V/bh; interação cresce com Nd e com L0 |
| Vento e combinações | q = 0,613V²; S2 cresce com z; arrasto ∝ V0²; envoltória contém γg·G + γq·Q |
| Fissuração | estádio II: b·x²/2 = αe·As·(d − x), I₂ pela expressão; wk cresce com Ms |
| Módulos completos (viga, lajes, pilar, fundações, telhado e tesoura, escada e reservatório) | sem exceção e sem NaN; ok ⇔ todas as verificações ok; Σ reações = cargas (vigas, lajes, tesoura, telhado); Nd = γn·1,4·ΣNk no pilar; Blondel e n·e = desnível na escada; volume do reservatório |

**Interpretação estatística.** Se n sorteios de uma família passam sem falha, a taxa de falha na população
sorteada é menor que 3/n com 95 % de confiança (regra dos três; com falhas, usa-se o intervalo de Wilson). Com os
1000 sorteios por família da campanha padrão, isso dá **< 0,3 % por família** e **< 0,02 % no conjunto** das 19 000
entradas. O relatório traz o limite calculado para cada família.

O que isso **não** cobre: entradas fora do domínio sorteado; erros que preservem equilíbrio, simetria e limites
(um coeficiente da norma trocado por outro plausível só aparece na camada 1); e as hipóteses de modelo declaradas
nos avisos de cada módulo (sem alternância de sobrecarga, grelha sem torção de compatibilidade, radier rígido…).

## Camada 3 — fechamento do caminho das cargas

Para cada projeto de exemplo (residência térrea, sobrado, edifícios de 3 e 18 pavimentos, dois terminais de
aeroporto e o exemplo padrão), o peso que entra é somado por fora: área das lajes × (g + q) do próprio módulo,
peso próprio e paredes das vigas, pilares, escadas, reservatórios e telhado. Ele tem de bater com a soma das cargas
características nas fundações. Esse teste pega carga perdida ou contada duas vezes na montagem, mesmo que cada
elemento isolado esteja certo.

Foi ele que revelou, na 0.61, que uma laje apoiada em **meio vão** de uma viga carregava o vão inteiro
(+20 % na carga daquela laje): a ligação passou a guardar o trecho em que a laje realmente apoia. Hoje o desvio
nos sete exemplos fica entre 0,00 % e 0,22 % (o resto é o revestimento do reservatório, fora da soma independente).

## Limites e responsabilidade

Nenhum conjunto de testes torna um programa "seguro para uso real" por si só. A NBR 6118 e a NBR 7190 exigem
projeto de responsabilidade de um engenheiro habilitado, que confere hipóteses, dados de entrada e resultados; a
validação independente (cálculo à mão ou em planilha, caso a caso) continua necessária e é o que o
[CONTRIBUTING.md](../CONTRIBUTING.md) pede aos colaboradores. Estes números medem **consistência interna** e
**aderência às fontes**, em domínios de projeto usuais; o LEBR continua um protótipo.

## Como rodar

```bash
npm test                                   # amostra: 60 sorteios por família + fechamento dos exemplos + banco
npm run confiabilidade                     # campanha: 1000 sorteios por família, relatório em docs/ e validacao/
npm run confiabilidade -- --n 2000         # mais sorteios (limite de 95 % cai para 0,15 % por família)
LEBR_INVARIANTES_N=300 npm test            # amostra maior nos testes
```
