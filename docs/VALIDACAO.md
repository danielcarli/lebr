# Banco de casos de validação

O banco de validação compara resultados do LEBR com valores de referência que **não vêm do próprio
programa**: a norma (tabelas e expressões), tabelas clássicas (Timoshenko, vigas contínuas) e cálculo
manual. É o critério de saída da Fase 1 do [roteiro](ROTEIRO.md): cada etapa nova acrescenta os seus casos.

## Como rodar

```bash
npm run validar                    # roda todos os casos e grava validacao/relatorio.html
npm run validar -- --filtro placa  # só os casos cujo id ou título contém "placa"
npm test                           # os casos também rodam junto com os testes
```

No programa: **Ajuda › Relatório de validação** roda os mesmos casos e mostra o resultado de cada um.

`npm run validar` sai com código 1 se algum caso falhar, então pode ser usado em integração contínua.

## Onde ficam

```
validacao/
  casos/              um arquivo JSON por grupo (01-materiais.json, 02-concreto-secoes.json…)
  relatorio.html      gerado pelo npm run validar
  relatorio.json      o mesmo resultado, em JSON
src/validacao/
  executar.js         executor (usado pelo npm run validar, pelos testes e pelo app)
  calculos.js         funções de cálculo dos módulos, sem a interface
  relatorio-html.js   relatório autocontido
```

## Formato de um arquivo de casos

```json
{
  "grupo": "Vigas — esforços",
  "descricao": "Motor de vigas contínuas comparado com soluções fechadas.",
  "casos": [
    {
      "id": "viga-biapoiada",
      "titulo": "Biapoiada, q = 10 kN/m, L = 6 m, EI = 10⁴ kN·m²",
      "fonte": "Resistência dos materiais: M = qL²/8, R = qL/2, f = 5qL⁴/(384EI).",
      "alvo": "motor",
      "funcao": "viga.analisarViga",
      "args": [{ "vaos": [6], "apoios": ["apoio", "apoio"], "q": [10], "P": [], "EI": [10000] }],
      "esperado": [
        { "grandeza": "Momento máximo", "caminho": "vaos.0.Mpos", "valor": 45, "unidade": "kN·m", "tolerancia": 0.001 }
      ]
    }
  ]
}
```

| Campo | O que é |
|---|---|
| `id` | identificador único entre todos os arquivos |
| `fonte` | **obrigatória**: de onde vem o valor esperado (norma e item, livro e página, ou a expressão usada no cálculo manual) |
| `alvo` | `"motor"` chama uma função do motor de cálculo; `"elemento"` calcula um elemento completo pelo módulo |
| `funcao`, `args` | (motor) nome da função e argumentos; a lista está em `MOTORES`, em `src/validacao/executar.js` |
| `modulo`, `elemento` | (elemento) id do módulo e as propriedades do elemento, que substituem as de um elemento novo |
| `parametros` | (elemento, opcional) parâmetros do projeto que mudam, por exemplo `{"concreto": {"fck": 30}}` |
| `esperado` | lista de grandezas a conferir |
| `caminho` | onde está o valor no resultado: `vaos.0.Mpos`, `coef.w`, `reacoes[id=x0].d`; vazio = o próprio resultado |
| `tolerancia` | diferença relativa aceita (0,01 = 1 %); padrão 1 % |
| `toleranciaAbs` | diferença absoluta aceita, útil quando o valor esperado é zero |

Nos `args`, alguns objetos viram materiais: `{"$concreto": 25}` ou `{"$concreto": {"fck": 30, "agregado": "basalto"}}`,
`{"$aco": 500}` e `{"$madeira": "C24"}`.

## Incluir um exemplo de livro

1. Copie um caso parecido para o arquivo do grupo (ou crie um arquivo novo em `validacao/casos/`).
2. Troque `id`, `titulo`, a entrada (`args` ou `elemento`) e os valores esperados.
3. Escreva na `fonte` o livro, a edição e a página (ou o item da norma).
4. Escolha a tolerância pelo arredondamento da fonte: tabelas com 2 algarismos pedem 2 a 3 %; contas exatas, 0,1 %.
5. Rode `npm run validar`.

No `caminho` de uma grandeza, `\.` escapa um ponto dentro da chave (por exemplo `aco.6\.3`, a massa de ø 6,3).

Quando um caso de livro não bate, a diferença pode estar no livro (outra edição da norma, outro arredondamento)
ou no LEBR. Anote a conclusão na `fonte` em vez de alargar a tolerância.

## O que os casos atuais cobrem (versão 0.28.0)

| Grupo | Casos | Referência |
|---|---|---|
| Materiais | módulos de elasticidade de C20 a C90, tração, parâmetros do diagrama | NBR 6118:2023, Tabela 8.1, 8.2.5, 8.2.10.1, 17.2.2 |
| Concreto — seções | flexão simples e dupla, armadura mínima (C25 a C90), estribos | cálculo manual e Tabela 17.3 |
| Vigas — esforços | biapoiada, biengastada, engaste-apoio, balanço, contínuas de 2 e 3 vãos, carga concentrada | soluções fechadas da resistência dos materiais |
| Lajes — placas | placa apoiada 1:1 e 1:2, placa engastada 1:1 | série de Navier; Timoshenko e Woinowsky-Krieger, Tabelas 8 e 35 |
| Módulos | viga, laje maciça, pilar e viga de madeira completos | cálculo manual |
| Pilares — flexão oblíqua | compressão uniforme, linha neutra a 45° (conta independente da geometria), pontos de topo, seção intermediária e envoltória mínima | NBR 6118:2023, 15.8.3.3.2, 17.2 e 11.3.3.4.3; cálculo manual |
| Vigas — torção | seção vazada equivalente, TRd2, A90/s, Asl e mínimos, interação com a cortante, viga com laje em balanço e com torção informada | NBR 6118:2023, 17.5 e 17.7.2; cálculo manual |
| Vigas — serviço (ELS) | estádio II, abertura de fissuras barra a barra, αf (Tabela 17.1), viga completa e limite da CAA IV | NBR 6118:2023, 17.3.2, 17.3.3.2, Tabelas 13.3, 13.4 e 17.1; cálculo manual |
| Combinações de ações | fatores das combinações últimas e de serviço (residencial; comercial com vento) e viga com balanço em que a combinação sem a variável governa | NBR 6118:2023, Tabelas 11.1 e 11.2 e 11.8; cálculo manual |
| Lajes — punção | perímetros C' interno, de borda e de canto (u*), τRd1, coeficiente K, pilar interno com armadura de punção (Asw, τRd3, C''), laje maciça com carga concentrada | NBR 6118:2023, 19.5.2 e 19.5.3, Tabela 19.2; cálculo manual |
| Pórtico espacial | balanço, biapoiada, pórtico plano com força horizontal (inclinação-deflexão), grelha em L com torção, viga com rótula interna, pilar com flexão nos dois eixos e torção, viga contínua | resistência dos materiais, processo de inclinação-deflexão e tabelas de vigas contínuas; cálculo manual |
| Grelha de pavimento | vigas cruzadas (viga apoiada no meio de outra, compatibilidade de flechas) e viga sobre dois pilares com engastamento elástico | cálculo manual: compatibilidade de deslocamentos e inclinação-deflexão |
| Pórtico espacial do edifício | pórtico de um pavimento (viga sobre dois pilares engastados na fundação): normal, momentos no topo e na base do pilar e soma das cargas × reações | processo de inclinação-deflexão; cálculo manual |
| Vento — NBR 6123 | S2 por categoria e classe (I a V, A a C), pressão dinâmica, forças por pavimento com altura de influência, S3 do grupo 1, combinações com as quatro direções exclusivas e pórtico do edifício com vento (cortante por pilar, momentos no topo e na base, normal de tombamento, pilar em balanço) | NBR 6123:1988, Tabelas 1 e 3, 4.2 e 5.3; NBR 6118:2023, 11.8 e Tabela 11.2; inclinação-deflexão; cálculo manual |
| Estabilidade global | θ1 e θa do desaprumo (limites 1/300 e 1/200), escolha entre vento, desaprumo ou os dois pela regra dos 30 %, α e α1, γz e 0,95·γz, pilar equivalente pelo deslocamento do topo, pilar em balanço com desaprumo (α, γz com 0,8·EciIc e momento de cálculo majorado) | NBR 6118:2023, 11.3.3.4.1, 15.5.2, 15.5.3, 15.7.2 e 15.7.3; cálculo manual |
| Sondagem SPT | estados de compacidade (areias e siltes arenosos) e de consistência (argilas e siltes argilosos) nas fronteiras das faixas, camada de cada ensaio, NSPT equivalente com penetração parcial, cotas do NA e do fundo, módulo com o boletim conferido | NBR 6484:2020, Anexo A; cálculo manual |
| Sapata isolada | σadm pelo SPT (e o limite N = 20), balanços iguais, tensões com excentricidade e núcleo central, momento na seção S1 do CEB-70, sapata rígida (peso próprio, reaterro, tensão no solo, contorno C, ancoragem), sapata flexível (punção em C′ com a reação do solo descontada, cortante), dimensões automáticas | NBR 6118:2023, 22.6, 19.4.1, 19.5 e 9.4.2.4; Teixeira e Godoy (1996); CEB-70; cálculo manual |
| Estacas | hélice contínua (Aoki-Velloso e Décourt-Quaresma trecho a trecho, Np médio, Nl sem os ensaios da ponta, limite de ponta das escavadas) e pré-moldada (F1 = 1 + D/0,80, α = β = 1) no mesmo perfil, carga estrutural | Aoki e Velloso (1975), Cintra e Aoki (2010), Décourt e Quaresma (1978), Décourt (1996), NBR 6122; cálculo manual |
| Bloco sobre estacas | blocos de 1 (fendilhamento), 2 e 4 estacas completos (Padm, peso próprio, reações, α, tirantes, As, tensões nas bielas e limites), Blévot de 3 estacas, faixa de altura útil, reações com momento e número automático de estacas | Blévot e Frémy (1967), Bastos (UNESP), NBR 6118:2023, 22.7; cálculo manual |
| Escadas | número de espelhos e Blondel, espessura média e cargas do lance e do patamar, tramo biapoiado por trechos, escada em U completa (reações, Md, VSd, As) e a reação concentrada na viga de apoio | NBR 9050:2020, 6.8.2; NBR 6120:2019, Tabela 10; NBR 6118:2023, 17.3.5 e 19.3; cálculo manual |
| Vigas invertidas | laje quadrada pendurada na face inferior: carga de cálculo pendurada e estribos de suspensão Asw = pd/fywd | NBR 6118:2023, 18.3.6; processo das áreas (14.7.6.1); cálculo manual |
| Reservatórios | placa com pressão hidrostática (faixa em balanço e engastada-apoiada), compatibilização de negativos, braço de viga-parede, pesos, pressões e reações de um reservatório elevado sobre pilares, empuxo em repouso e tensão no solo do enterrado | NBR 6118:2023, 14.7.6.2 e 22.4; resistência dos materiais; cálculo manual |
| Quantitativos | massa nominal das barras, leitura dos rótulos, concreto, fôrma e aço por bitola de uma viga (positivas, estribos, porta-estribos) e de uma laje maciça (positiva e negativa) | NBR 7480; cálculo manual |
| Detalhamento de vigas | fbd em boa e má aderência, lb e limite de 25ø, lb,nec com gancho e mínimo, decalagem aℓ (modelo I), traspasse l0t, viga biapoiada completa (barras de canto com ganchos, corte da terceira barra pelo diagrama deslocado, porta-estribos, estribos) e emenda de barra acima de 12 m | NBR 6118:2023, 9.3.2, 9.4.2, 9.5.2, 17.4.2.2 e 18.3; cálculo manual |
| Detalhamento de pilares e lajes | traspasse de barras comprimidas (e o mínimo de 20 cm), barras protegidas pelo estribo e grampo suplementar, lance de pilar com arranques no bloco, último lance, laje maciça com positivas e negativa, resumo do aço com perdas | NBR 6118:2023, 9.5.2.3, 18.2.4, 18.4, 19.3.3.2; cálculo manual |
| Cargas — NBR 6120 | paredes, revestimento por camadas, cargas de uso, vigas com parede (inclusive no formato antigo) | NBR 6120:2019, Tabelas 1, 2 e 10 |

Os valores esperados foram calculados à parte, sem usar o código do LEBR.
