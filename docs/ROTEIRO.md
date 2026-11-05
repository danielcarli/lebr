# LEBR — Roteiro para projetos reais

_Atualizado em 02/11/2026. Também em **Ajuda › Roteiro (road map)** no programa._

O LEBR já calcula elementos isolados de concreto armado e de madeira com boa base técnica, mas ainda não projeta um edifício: faltam a análise global com vento, as fundações e o detalhamento que vira prancha de obra.

As seções abaixo listam os módulos e as funcionalidades que faltam, agrupados por área. As fases, logo no início, ordenam tudo da mais urgente para um primeiro projeto residencial real até os materiais e sistemas menos comuns.

## O que existe hoje

- Vigas contínuas
- Lajes maciças por elementos finitos
- Lajes treliçada, nervurada e alveolar
- Pilares com 2ª ordem local
- Madeira pela NBR 7190-1:2022
- Montagem por pavimentos
- Visualização 3D
- Console JavaScript
- PDF por elemento
- Escolha de bitolas
- Banco de casos de validação
- Catálogo de cargas da NBR 6120
- Combinações de ações (NBR 8681)
- Fissuras e flechas das vigas
- Torção nas vigas
- Flexão oblíqua nos pilares
- Punção nas lajes maciças
- Motor de pórtico espacial (console)
- Grelha de pavimento
- Pórtico espacial do edifício
- Vento (NBR 6123)
- Desaprumo, α e γz (estabilidade global)
- Sondagem SPT (NBR 6484)
- Sapata isolada e viga baldrame
- Estacas (Aoki-Velloso e Décourt-Quaresma)
- Bloco sobre estacas (bielas e tirantes)
- Escadas retas, em L e em U
- Viga invertida (armadura de suspensão)
- Reservatórios elevados e enterrados
- Explorador agrupado por pavimento
- Quantitativos e CSV
- Detalhamento das vigas (lista de ferros editável)
- Abas lado a lado e 3D fixado à direita
- Detalhamento de pilares e lajes, resumo do aço com perdas
- Pranchas em DXF (fôrmas, locação e armação)
- Verificação da montagem no explorador
- Otimização das bitolas (menos bitolas ou menos aço)

Cada elemento é calculado sozinho, com as cargas transmitidas pelas ligações laje → viga → pilar.

## Fases

### Fase 1 — Térreo e sobrado

- Cargas NBR 6120, combinações NBR 8681
- Pórtico 3D e grelha
- Vento NBR 6123 e γz
- Torção, fissuras e punção
- Flexão oblíqua nos pilares
- Sapatas, blocos e estacas
- Escadas e reservatórios
- Detalhamento e DXF
- Quantitativos de materiais

**Saída: casos de livro e um edifício de teste conferidos**

### Fase 2 — Edifícios de vários andares

- 2ª ordem global (P-Delta)
- Pilares com λ até 140
- Pilares-parede e seção L
- Lajes lisas e cogumelo
- Radier, arrimo e cortinas
- Plantas de fôrmas e armação
- Memorial do projeto inteiro
- Importar DXF; IFC (BIM)
- Lançamento gráfico na planta

**Saída: revisão técnica externa de cada módulo**

### Fase 3 — Outros materiais e sistemas

- Aço: NBR 8800 e NBR 14762
- Estruturas mistas
- Alvenaria estrutural
- Protendido e pré-moldados
- Madeira: ligações, MLC, CLT
- Situação de incêndio
- Coberturas e treliças
- Orçamento (SINAPI)
- Repositório de módulos

**Contínuo: novas normas e módulos da comunidade**

A Fase 1 é o mínimo para um primeiro projeto residencial real (térreo ou sobrado em concreto armado). Cada fase só termina quando passa pelo seu critério de saída: a Fase 1 exige o banco de validação, porque é ele que dá segurança para usar o cálculo em obra; a Fase 2 exige revisão técnica externa dos módulos.

## 1. Análise estrutural global

Este é o maior salto para projetos reais: sem ações horizontais e estabilidade global, nenhum edifício acima de um pavimento pode ser verificado como a norma exige.

| Módulo | O que faz | Norma |
|---|---|---|
| Pórtico espacial 3D | Barras (vigas e pilares) com 6 graus de liberdade por nó, gerado da montagem por pavimentos; substitui o cálculo viga a viga | NBR 6118, 14.6 |
| Grelha de pavimento | Lajes e vigas como grelha, com interação entre elas e viga apoiada em viga | NBR 6118, 14.7.6 |
| Vento | Velocidade básica pela isopleta, fatores S1, S2 e S3, coeficientes de arrasto e forças por pavimento | NBR 6123 |
| Desaprumo e imperfeições | Imperfeições geométricas globais e locais, comparadas com o vento | NBR 6118, 11.3.3.4 |
| Estabilidade global | Coeficiente γz e parâmetro α; classificação em nós fixos ou móveis | NBR 6118, 15.5 |
| 2ª ordem global | P-Delta ou majoração por 0,95·γz, com não linearidade física aproximada (EI reduzido) | NBR 6118, 15.7 |
| Combinações de ações | Todas as combinações últimas e de serviço, com vento em várias direções e ação variável principal alternada; envoltórias por elemento | NBR 8681, NBR 6118 11.7 e 11.8 |
| Sobrecargas alternadas | Carga variável em vãos alternados para o máximo momento positivo | NBR 6118, 14.6.7.3 |
| Catálogo de cargas | Pesos de materiais e cargas de uso por tipo de ambiente | NBR 6120:2019 |
| Engastamento elástico | Rigidez da ligação viga–pilar e momentos nos pilares de extremidade | NBR 6118, 14.6.7.1 |
| Redistribuição de esforços | Redução de momentos negativos com limite de x/d | NBR 6118, 14.6.4.3 |

## 2. Concreto armado: completar vigas, pilares e lajes

Os módulos atuais calculam a armadura principal; para obra ainda faltam as verificações de serviço, a torção, a punção e o detalhamento das barras.

**Vigas**

- Torção de equilíbrio e de compatibilidade, combinada com cortante (NBR 6118, 17.5)
- Abertura de fissuras (ELS-W) com os limites por classe de agressividade (17.3.3 e Tabela 13.4)
- Ancoragem, decalagem do diagrama, comprimento de traspasse e ganchos (9.4 a 9.5, 18.3.2)
- Armadura de pele para h > 60 cm e armadura de suspensão em apoios indiretos (17.3.5.2.3, 18.3.6)
- Seção T e L com a laje colaborante, ligada à montagem
- Furos e aberturas, vigas-parede e dentes Gerber

**Pilares**

- Flexão oblíqua (hoje é normal em cada direção) com a superfície de interação
- Esbeltez de 90 a 140 com pilar-padrão com rigidez κ aproximada ou método geral, e fluência (15.8.3 e 15.8.4)
- Pilares-parede, seções L, T, U e circulares
- Estribos suplementares e proteção contra flambagem das barras (18.4.3)
- Lance a lance: um pilar único da fundação à cobertura, com esforços por pavimento

**Lajes**

- Punção em lajes lisas e cogumelo, com armadura de punção (19.5)
- Lajes lisas e cogumelo (sem vigas), analisadas na grelha ou por elementos finitos de todo o pavimento
- Cargas concentradas e de paredes sobre lajes, aberturas e rebaixos
- Fissuração e flecha diferida com contraflecha em todas as lajes
- Continuidade entre lajes vizinhas com compatibilização de momentos negativos

## 3. Fundações e contenções

Sem fundações o projeto para nos pilares do térreo; este grupo fecha o caminho das cargas até o solo e depende de dados de sondagem (SPT) informados pelo usuário.

| Módulo | O que faz | Norma |
|---|---|---|
| Sondagem SPT | Cadastro dos furos, perfil do solo e NSPT por metro, usado pelos outros módulos | NBR 6484 |
| Sapata isolada | Dimensões pela tensão admissível, flexão, cisalhamento e punção; sapata rígida ou flexível | NBR 6122, NBR 6118 22.6 |
| Sapata associada e de divisa | Duas ou mais cargas, viga de equilíbrio (viga alavanca) para pilares na divisa | NBR 6122 |
| Bloco sobre estacas | 1 a n estacas, método das bielas e tirantes, armadura principal e de distribuição | NBR 6118 22.7 |
| Estacas | Capacidade de carga por Aoki-Velloso e Décourt-Quaresma, comprimento e quantidade; hélice contínua, escavada, pré-moldada, broca | NBR 6122 |
| Radier | Laje sobre base elástica (coeficiente de reação vertical), recalques e esforços | NBR 6122 |
| Vigas baldrame | Vigas de fundação com carga de paredes e travamento dos blocos | NBR 6118 |
| Recalques | Estimativa de recalques e recalques diferenciais entre apoios | NBR 6122 |
| Muro de arrimo | Muro de flexão e de gravidade: empuxo (Rankine ou Coulomb), tombamento, deslizamento e tensão no solo | NBR 11682 |
| Cortina e contenção de subsolo | Paredes de subsolo com empuxo de terra e de água | NBR 11682, NBR 6122 |

## 4. Elementos especiais

Quase toda edificação tem pelo menos uma escada e um reservatório, então estes módulos aparecem cedo em projetos residenciais.

| Módulo | O que faz |
|---|---|
| Escadas | Lances retos, em L e em U, armada longitudinal ou transversal, patamares; cargas transmitidas às vigas |
| Rampas | Lajes inclinadas com cargas de uso e de veículos |
| Reservatórios | Caixas d'água elevadas e enterradas: paredes como placas, empuxo hidrostático, fissuração mais rígida |
| Marquises e balanços | Verificação de equilíbrio, tombamento e engaste na viga, com γn |
| Consolos e dentes | Consolos curtos e muito curtos por bielas e tirantes (NBR 6118, 22.5) |
| Vigas de transição | Vigas que recebem pilares (pilar nascendo em viga), com carga concentrada vinda do pavimento de cima |
| Piscinas e caixas enterradas | Empuxo de terra com e sem água, subpressão |
| Paredes de concreto | Sistema de paredes de concreto moldadas no local (NBR 16055) |

## 5. Outros materiais e sistemas

O modelo de módulos já prevê novos materiais; cada um abaixo entra como um conjunto de módulos com a sua norma.

| Material ou sistema | Módulos | Norma |
|---|---|---|
| Aço (perfis laminados e soldados) | Vigas com flambagem lateral com torção, pilares e flexo-compressão, terças e contraventamentos, ligações parafusadas e soldadas, placas de base e chumbadores | NBR 8800 |
| Aço (perfis formados a frio) | Terças, montantes e vigas de light steel frame, com flambagem local e distorcional | NBR 14762, NBR 15253 |
| Estruturas mistas | Vigas mistas com conectores, pilares mistos, lajes com fôrma de aço incorporada (steel deck) | NBR 8800, anexos O a Q |
| Coberturas | Tesouras e treliças de aço e de madeira, terças, caibros e ripas, vento em coberturas | NBR 6123, NBR 7190, NBR 8800 |
| Madeira (complementos) | Ligações por pinos, parafusos e pregos; peças compostas; madeira lamelada colada (MLC) e lamelada cruzada (CLT); paredes de light wood frame | NBR 7190-1:2022, NBR 16936:2023 |
| Alvenaria estrutural | Paredes de blocos de concreto e cerâmicos: compressão, cisalhamento, flexão, distribuição das cargas por grupos de paredes, vergas | NBR 16868 |
| Concreto protendido | Lajes e vigas pós-tracionadas com cordoalha engraxada: traçado, perdas, verificações em vazio e em serviço | NBR 6118 (9.6 e 17.2.4) |
| Pré-moldados | Pilares, vigas e painéis pré-fabricados, consolos, ligações e situações transitórias de içamento e montagem | NBR 9062 |
| Situação de incêndio | Tempo requerido de resistência ao fogo e verificação por método tabular (concreto) ou simplificado (aço e madeira) | NBR 14432, NBR 15200, NBR 14323, NBR 7190-1 |

## 6. Detalhamento, desenhos e quantitativos

O que a obra recebe são pranchas e listas de materiais; hoje o LEBR entrega cálculos, então este grupo transforma resultado em documento executável.

- **Detalhamento automático das armaduras:** posições numeradas (N1, N2…), comprimentos com ganchos e dobras, cortes das barras pelo diagrama decalado, editável pelo usuário
- **Plantas de fôrmas por pavimento:** eixos, cotas, seções das vigas e pilares, níveis, furos e rebaixos, gerados da montagem
- **Pranchas de armação:** elevação e cortes de vigas e pilares, malhas e negativos de lajes, com tabela de aço por prancha
- **Locação de pilares e cargas na fundação:** planta com coordenadas e a tabela de cargas por pilar
- **Exportação DXF:** (formato aberto, lê no AutoCAD, LibreCAD e QCAD) e PDF em formato A1/A0 com carimbo
- **Quantitativos:** volume de concreto (m³), área de fôrma (m²) e aço por bitola (kg), por elemento e por pavimento
- **Resumo de aço:** com perdas, peso por metro e lista de corte e dobra
- **Orçamento:** com composições de referência (SINAPI) a partir dos quantitativos
- **Memorial de cálculo do projeto inteiro:** critérios, materiais, ações, modelo, estabilidade, resultados por elemento, em um único PDF

## 7. Interoperabilidade

O projeto estrutural nasce da arquitetura e volta para ela; trocar arquivos com outros programas evita redesenhar tudo à mão.

- **Importar DXF da arquitetura:** como fundo da montagem, para lançar pilares e vigas sobre a planta
- **Importar e exportar IFC:** (BIM aberto): ler paredes e pavimentos de um modelo de arquitetura e devolver o modelo estrutural com elementos e armaduras
- **Exportar o modelo de cálculo:** para programas de análise (nós, barras, cargas) e conferir os resultados em outro software
- **Esquema JSON público e versionado:** do arquivo .lebr.json, para scripts e outras ferramentas lerem o projeto
- **Catálogos de fabricantes:** como arquivos abertos: treliças, lajotas e EPS, painéis alveolares, perfis de aço, madeiras comerciais, estacas
- **Planilhas:** exportar tabelas de esforços, reações e quantitativos em CSV ou XLSX

## 8. Confiabilidade e responsabilidade técnica

Um programa de cálculo estrutural só serve para obra se for possível provar que ele calcula certo; esta área vale mais que qualquer módulo novo.

- **Banco de casos de validação:** exemplos resolvidos dos livros de referência de concreto, madeira e aço e das normas, rodados automaticamente a cada versão, com a tolerância aceita em cada resultado
- **Comparação com programas comerciais:** em edifícios de teste, com as diferenças explicadas no relatório
- **Revisão técnica externa:** de cada módulo por engenheiro estrutural, registrada no repositório
- **Rastreabilidade no memorial:** cada verificação com a fórmula, os valores usados e o item da norma; hipóteses e simplificações declaradas
- **Validação de entradas:** limites físicos, unidades em todos os campos e alerta para valores fora do comum (por exemplo, fck acima de 50 MPa ou vão acima de 12 m em laje maciça)
- **Histórico do projeto:** quem mudou o quê e quando, versões do cálculo emitidas e revisões de prancha (R0, R1…)
- **Versão do programa e das normas:** gravada em cada arquivo e em cada prancha, para reproduzir o cálculo anos depois
- **Termo de uso claro:** o LEBR é ferramenta de apoio; o projeto é de responsabilidade do profissional habilitado que o assina (ART no CREA ou RRT no CAU, conforme a atribuição profissional)

## 9. Produto e experiência de uso

Estas funcionalidades não mudam o cálculo, mas decidem se um escritório consegue usar o programa no dia a dia.

- **Lançamento gráfico direto:** desenhar vigas, lajes e pilares na planta com o mouse (hoje se cria o elemento e depois se posiciona)
- **Criação de lajes pelo contorno das vigas:** clicar dentro de um vazio entre vigas gera a laje com as dimensões certas
- **Edição em lote:** mudar seção, fck ou carga de vários elementos de uma vez
- **Gabaritos de projeto:** residencial térreo, sobrado, prédio de 4 pavimentos, galpão, com parâmetros e cargas típicos
- **Instalador assinado e atualização automática:** para Windows, macOS e Linux
- **Ajuda contextual e tutoriais:** em cada módulo, com o trecho da norma e um exemplo
- **Repositório de módulos externos:** com versionamento e verificação, para a comunidade publicar módulos
- **Desempenho:** cálculo em segundo plano (Web Worker) para edifícios com centenas de elementos sem travar a tela
- **Acessibilidade e idiomas:** navegação por teclado completa, alto contraste, textos traduzíveis
