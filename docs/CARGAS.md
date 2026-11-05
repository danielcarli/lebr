# Catálogo de cargas — NBR 6120:2019

O LEBR preenche cargas de uso, revestimentos e paredes pela ABNT NBR 6120:2019 (Ações para o cálculo de
estruturas de edificações). Os dados ficam em `src/engine/cargas.js` e aparecem em **Ajuda › Catálogo de
cargas (NBR 6120)** (também no menu **Estrutura**).

## Onde é usado

| Lugar | O que faz |
|---|---|
| Lajes (maciça, treliçada, nervurada, alveolar) e entrepiso de madeira | **Uso do ambiente** (Tabela 10) preenche a carga acidental. Digitar outro valor volta para "Valor informado". |
| Lajes | **Compor o revestimento por camadas**: contrapiso, piso, revestimento do teto e forro (Tabela 1); o total vai para o campo Revestimento. No entrepiso o forro continua em campo próprio. |
| Vigas de concreto e de madeira | Carga de **parede**: tipo de alvenaria e espessura (Tabela 2), revestimento por face, altura e porcentagem de aberturas. |

O cálculo continua lendo os números (`acidental`, `revestimento`, carga da parede); o catálogo só os preenche e
guarda de onde vieram. Projetos antigos abrem com as cargas que tinham: uma parede sem tipo de alvenaria continua
calculada por γ·e·h com o peso específico informado.

## Fontes e valores a conferir

A norma não tem texto aberto. Os valores foram tirados de material técnico que reproduz as tabelas e conferidos
entre si: notas de aula com a Tabela 10, o projeto de revisão de 2017 da NBR 6120 e páginas técnicas com as Tabelas
1, 2 e 10 da versão publicada. Onde as fontes divergem, o LEBR marca o valor com **conferir** (ícone de alerta no
catálogo, no editor e um aviso no resultado):

| Item | Situação |
|---|---|
| Bloco de concreto vazado de vedação, 19 cm, 1 cm por face | Uma fonte traz 1,9 kN/m²; adotado 2,2 kN/m², coerente com o acréscimo de 0,4 kN/m² por centímetro das outras linhas. |
| Forros de gesso (0,25 e 0,15 kN/m²) | Valores do projeto de revisão de 2017; conferir na versão publicada. |
| Bloco cerâmico estrutural de paredes vazadas, 19 cm | Não incluído: o valor encontrado (3,4 kN/m²) destoa da sequência da tabela. |

Ficaram de fora por divergirem entre as fontes ou dependerem de itens próprios da norma: forro acessível só para
manutenção, coberturas com placas solares, corredores de escritórios, garagens e áreas técnicas.

Um teste automático (`test/cargas.test.js`) confere a coerência da Tabela 2: cada linha precisa crescer de 0,25 a
0,55 kN/m² por centímetro de revestimento e com a espessura do bloco. Erros de digitação aparecem ali.

Quem tiver a norma em mãos pode corrigir ou completar `src/engine/cargas.js`; os casos de `validacao/casos/06-cargas.json`
mostram os valores conferidos.

## Ainda não incluído (próximas etapas)

- Paredes divisórias sem posição definida (carga adicional por m² conforme o peso da parede).
- Combinações com ψ0, ψ1 e ψ2 por tipo de uso — etapa 3 do plano (casos de carga e combinações).
- Cargas de garagens, telhados e reservatórios.
