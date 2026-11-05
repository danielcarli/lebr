# Sondagem SPT (NBR 6484:2020)

A partir da 0.20.0 cada furo de sondagem de simples reconhecimento é um elemento do projeto
(módulo `geotecnia.sondagem`, sigla GS1, categoria *Sondagens*). Motor: `src/engine/sondagem.js`; módulo:
`src/modules/geotecnia-sondagem/`. O formato no arquivo está em [FORMATO.md](FORMATO.md#geotecniasondagem).

## Dados do furo

| Grupo | Campos |
|---|---|
| Locação | x e y na planta do projeto (m); cota da boca no referencial dos pavimentos (terreno = 0); data, empresa, responsável |
| Camadas | profundidade da base, solo principal (argila, silte, areia, pedregulho, solo orgânico, turfa, aterro, rocha alterada), fração secundária, cor, origem (residual, aluvionar, coluvionar…), observação |
| Ensaios SPT | profundidade de início, golpes (NSPT) e penetração correspondente — 30 cm, ou menos na paralisação (50/10) |
| Água e fim | nível d'água inicial e final (ou furo seco), limite da sondagem, critério de paralisação (impenetrável ao SPT pelo item 5.2.4.2) e observações |

## O que o LEBR faz com os dados

- **Organiza as camadas** de cima para baixo, com cotas de topo e base.
- **Atribui cada ensaio a uma camada** pelo ponto médio dos 30 cm finais do amostrador (profundidade de início + 0,30 m).
- **NSPT equivalente**: com penetração menor que 30 cm, N·30/penetração, limitado a max(N, 50) — um 50/10 vale 50 (impenetrável),
  não 150. Usado no gráfico e nas médias; a tabela mostra o registro original (50/10).
- **Estado de compacidade ou consistência** (Anexo A), pelo menor e pelo maior NSPT da camada (ex.: "mole a média"):

| Areias e siltes arenosos | NSPT | Argilas e siltes argilosos | NSPT |
|---|---|---|---|
| fofa(o) | ≤ 4 | muito mole | ≤ 2 |
| pouco compacta(o) | 5 a 8 | mole | 3 a 5 |
| medianamente compacta(o) | 9 a 18 | média(o) | 6 a 10 |
| compacta(o) | 19 a 40 | rija(o) | 11 a 19 |
| muito compacta(o) | > 40 | muito rija(o) | 20 a 30 |
| | | dura(o) | > 30 |

  Pedregulhos seguem a compacidade; solo orgânico e turfa, a consistência; silte sem fração secundária, a compacidade.
  Aterro e rocha alterada não são classificados.
- **Confere o boletim**: camadas em ordem, perfil descrito até o fim do furo, um ensaio por metro, ensaios dentro do
  furo, nível d'água registrado ou furo seco. O que faltar aparece nas verificações do elemento.

## Perfil individual

Desenhado na entrada (prévia a cada alteração), no resultado e no PDF do elemento: escala de profundidade e cotas, coluna do
perfil com a hachura de cada solo, nível d'água (inicial e final), NSPT de cada metro, gráfico NSPT × profundidade
(0 a 50 golpes; acima de 50, seta) e a descrição de cada camada com o estado, e a linha do limite da sondagem.
Na **Montagem**, os furos aparecem marcados na planta (duplo clique abre o furo).

## Para as fundações

`src/engine/sondagem.js` exporta as consultas que as etapas de sapata e estacas usam:

- `analisarSondagem(furo)` — camadas, ensaios e NA organizados;
- `camadaNa(analise, profundidade)` e `nsptNa(analise, profundidade)`;
- `nsptMedio(analise, de, ate)` — média dos ensaios num intervalo (bulbo da sapata, fuste da estaca);
- `furoMaisProximo(furos, x, y)` — o furo mais próximo de um pilar na planta.

## Limitações

- O boletim é digitado: não há importação de arquivos de empresas de sondagem.
- Os três trechos de 15 cm não são guardados separadamente, só o NSPT e a penetração final.
- Sem correções de energia (N60) nem do nível d'água — ficam com os métodos de fundação que as exigirem.
