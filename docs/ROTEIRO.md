# LEBR — Roteiro para projetos reais

_Atualizado em 07/11/2026. Também em **Ajuda › Roteiro (road map)** no programa._

O LEBR já monta e calcula um edifício pequeno de concreto armado das cargas às fundações — pórtico espacial com vento e γz, vigas, lajes, pilares, escadas, reservatório, sapatas, estacas e blocos — e entrega memorial, quantitativos e pranchas em DXF. Todos os itens da Fase 1 estão implementados; falta cumprir o critério de saída: a conferência independente de um edifício de teste.

As seções abaixo listam os módulos e as funcionalidades por área, cada um marcado como feito, parcial ou a fazer. As fases, logo no início, ordenam tudo da mais urgente para um primeiro projeto residencial real até os materiais e sistemas menos comuns.

Legenda: ✅ feito · ◐ parcial · ○ a fazer. Nas áreas abaixo: 58 feitos, 23 parciais e 33 a fazer.

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
- Otimização das bitolas (menos bitolas, menos aço ou menos segmentos)
- Planta DXF de arquitetura no fundo da montagem, eixos e malha
- Sugestão da menor seção que atende
- Armadura em 3D de cada elemento
- Memorial do edifício e cargas na fundação em PDF
- Cálculo em Web Worker
- Pilares de seção circular
- Instalador do Windows com atualização pela última versão do GitHub
- 158 exercícios resolvidos da bibliografia no banco de validação
- Relatório dos exercícios resolvidos (LEBR × fontes)
- Temas claro, escuro e blueprint

O edifício é analisado no pórtico espacial e na grelha de cada pavimento; cada elemento é dimensionado com os esforços que recebe pelas ligações laje → viga → pilar → fundação. O banco de validação tem 315 casos, 158 deles tirados de exercícios resolvidos publicados.

## Fases

### Fase 1 — Térreo e sobrado (em validação)

- ✅ Cargas NBR 6120, combinações NBR 8681
- ✅ Pórtico 3D e grelha
- ✅ Vento NBR 6123 e γz
- ✅ Torção, fissuras e punção
- ✅ Flexão oblíqua nos pilares
- ✅ Sapatas, blocos e estacas
- ✅ Escadas e reservatórios
- ✅ Detalhamento e DXF
- ✅ Quantitativos de materiais

**Saída: casos de livro (feito: 158 exercícios publicados) e um edifício de teste conferidos (a fazer)**

### Fase 2 — Edifícios de vários andares

- ◐ 2ª ordem global (P-Delta)
- ○ Pilares com λ até 140
- ◐ Pilares-parede e seção L
- ○ Lajes lisas e cogumelo
- ◐ Radier, arrimo e cortinas
- ✅ Plantas de fôrmas e armação
- ✅ Memorial do projeto inteiro
- ◐ Importar DXF; IFC (BIM)
- ◐ Lançamento gráfico na planta
- ○ Consistência, apoios e pavimento tipo no lançamento

**Saída: revisão técnica externa de cada módulo**

### Fase 3 — Outros materiais e sistemas

- ○ Aço: NBR 8800 e NBR 14762
- ○ Estruturas mistas
- ○ Alvenaria estrutural
- ○ Protendido e pré-moldados
- ◐ Madeira: ligações, MLC, CLT
- ○ Situação de incêndio
- ◐ Coberturas e treliças
- ○ Orçamento (SINAPI)
- ○ Repositório de módulos

**Contínuo: novas normas e módulos da comunidade**

A Fase 1 é o mínimo para um primeiro projeto residencial real (térreo ou sobrado em concreto armado). Cada fase só termina quando passa pelo seu critério de saída: a Fase 1 exige o banco de validação, porque é ele que dá segurança para usar o cálculo em obra; a Fase 2 exige revisão técnica externa dos módulos.

## 1. Análise estrutural global

Este é o maior salto para projetos reais: sem ações horizontais e estabilidade global, nenhum edifício acima de um pavimento pode ser verificado como a norma exige.

| | Módulo | O que faz | Norma |
|---|---|---|---|
| ✅ | Pórtico espacial 3D | Barras (vigas e pilares) com 6 graus de liberdade por nó, gerado da montagem por pavimentos; substitui o cálculo viga a viga | NBR 6118, 14.6 |
| ✅ | Grelha de pavimento | Lajes e vigas como grelha, com interação entre elas e viga apoiada em viga | NBR 6118, 14.7.6 |
| ✅ | Vento | Velocidade básica pela isopleta, fatores S1, S2 e S3, coeficientes de arrasto e forças por pavimento | NBR 6123 |
| ✅ | Desaprumo e imperfeições | Imperfeições geométricas globais e locais, comparadas com o vento | NBR 6118, 11.3.3.4 |
| ✅ | Estabilidade global | Coeficiente γz e parâmetro α; classificação em nós fixos ou móveis | NBR 6118, 15.5 |
| ◐ | 2ª ordem global | P-Delta ou majoração por 0,95·γz, com não linearidade física aproximada (EI reduzido) | NBR 6118, 15.7 |
| ✅ | Combinações de ações | Todas as combinações últimas e de serviço, com vento em várias direções e ação variável principal alternada; envoltórias por elemento | NBR 8681, NBR 6118 11.7 e 11.8 |
| ○ | Sobrecargas alternadas | Carga variável em vãos alternados para o máximo momento positivo | NBR 6118, 14.6.7.3 |
| ✅ | Catálogo de cargas | Pesos de materiais e cargas de uso por tipo de ambiente | NBR 6120:2019 |
| ◐ | Engastamento elástico | Rigidez da ligação viga–pilar e momentos nos pilares de extremidade | NBR 6118, 14.6.7.1 |
| ○ | Redistribuição de esforços | Redução de momentos negativos com limite de x/d | NBR 6118, 14.6.4.3 |

## 2. Lançamento da estrutura

Como o edifício entra no programa. TQS, Eberick e CYPECAD seguem a mesma filosofia: critérios e pavimentos primeiro, a arquitetura como fundo de cada pavimento, pilares → vigas → lajes, os dados do próximo elemento escolhidos antes de inserir, e uma barreira de consistência que não deixa calcular enquanto houver algo indefinido (cruzamento de vigas sem apoio escolhido, laje com contorno aberto). O plano em etapas está no fim do roteiro.

| | Prática | Como os programas consolidados fazem | No LEBR |
|---|---|---|---|
| ✅ | Arquitetura como fundo por pavimento | DXF/DWG como referência externa de cada pavimento, com camadas e opacidade | Planta DXF por pavimento, camadas, opacidade, deslocamento e rotação |
| ✅ | Encaixes, eixos e malha | Capturas no desenho, eixos de locação e malha; coordenadas digitadas | Encaixe nos cantos e pontas da planta, nos eixos e na malha; coordenadas digitadas a fazer |
| ✅ | Ligações pela geometria | Apoios reconhecidos pelas faces de vigas e pilares | Conectar automaticamente e aviso de ligação com problema no explorador |
| ✅ | 3D durante o lançamento | Pórtico 3D sempre à mão, atualizado a cada mudança | Visualização 3D fixa à direita enquanto se edita |
| ✅ | Critérios iniciais pela CAA | CAA define fck mínimo e cobrimentos, com exceção por elemento | Parâmetros do projeto pela CAA (Tabelas 6.1, 7.1 e 7.2); exceção de fck e cobrimento por elemento, com aviso abaixo do mínimo da CAA (etapa L7, 0.41.0) |
| ✅ | Cópia e pavimento tipo | Andar tipo como um objeto que se repete; cópia total ou seletiva entre pavimentos | Repetições no cartão do pavimento (um modelo, n níveis no 3D, no pórtico, no vento, nos quantitativos e nas cargas dos pilares; os pavimentos de cima sobem junto); copiar pavimento total ou só pilares, vigas ou lajes, para um novo ou existente (etapa L9 (0.48.0) |
| ✅ | Consistência que bloqueia o cálculo | Lista de erros e avisos por elemento e pavimento; erros impedem processar | Painel Problemas por pavimento com zoom na planta; 14 regras independentes (elemento solto, viga sem apoio, laje com contorno aberto, sobreposição, pilar sem continuidade, carga de elemento inexistente, ligação não aplicada…); erro desabilita Calcular (etapa L2, 0.37.0) |
| ✅ | Tolerância e fusão de nós | Nós a menos de 1 mm se fundem; nó sobre barra a parte e apoia | Tolerância em mm (padrão 1 mm); apoio a menos dela da face do pilar fica apoiado; Limpar geometria funde nós e leva os apoios até faces e eixos; folgas até 20 mm viram aviso com Encostar (etapa L1, 0.36.0) |
| ✅ | Apoio explícito no cruzamento de vigas | Cada cruzamento diz quem apoia em quem; indefinido não processa | Cruzamento na planta com "?" e menu (A apoia em B, B em A, sem transferência); Definir todos pela rigidez b·h³/L³; rótula na viga apoiada da grelha; indefinido é erro de montagem (etapa L3, 0.38.0) |
| ✅ | Viga em cadeia | Clique de pilar em pilar; o programa quebra nos intermediários; eixo ou face | Modo Viga em cadeia (V) na montagem: vãos quebrados nos pilares atravessados, eixo ou face rente ao pilar, deslocamento, Shift ortogonal, ligações aplicadas (etapa L4, 0.39.0) |
| ✅ | Laje por clique no contorno | Contornos fechados reconhecidos; clicar dentro cria a laje com a direção principal | Modo Laje no contorno (L): regiões fechadas pelos eixos das vigas destacadas na planta; clique cria a laje com as bordas ligadas; fechamento de bordo para balanço com borda livre; lajes em uma direção no menor vão (etapa L5 (0.40.0) |
| ✅ | Dados do próximo elemento | Seção, carga e próximo número escolhidos antes de inserir; conta-gotas e pincel | Dados atuais gravados no projeto: seção, concreto, cargas e próximo código antes de lançar (Viga em cadeia, Laje no contorno e Adicionar); conta-gotas e pincel de propriedades na montagem (etapa L6 (0.41.0) |
| ✅ | Pré-dimensionamento no lançamento | Regras práticas (viga L/10 a L/12, laje Lx/40, pilar pela área de influência) | Sugestão no elemento selecionado e para o pavimento inteiro: viga L/10, L/12 ou L/5 em múltiplos de 5 cm; laje máx(Lx/40, 8 cm); pilar pela área de influência (Nk = q·Ai·n, γ = 1,8/2,2/2,5); altura pelo vão na Viga em cadeia e na Laje no contorno (etapa L8 (0.42.0) |
| ✅ | Pilar com ponto fixo e lance | Ponto fixo (centro, canto, face) e pavimento inicial e final; pilar nascendo em viga | Ponto fixo (centro, cantos, meios das faces) que fica no lugar quando a seção muda; prumada e lance de um pavimento até outro, criando e ligando os pilares que faltam; pilar nascendo em viga vira carga concentrada na viga e aviso de transição (etapa L10 (0.47.0) |
| ✅ | Renumeração automática | P, V e L da esquerda para a direita e de cima para baixo | Estrutura › Renumerar (e no menu … da montagem, só o pavimento): de cima para baixo e da esquerda para a direita, vigas horizontais e depois verticais; por pavimento (P101…) ou sequencial; ligações, nomes e descrições acompanham (etapa L11 (0.46.0) |
| ✅ | Paredes da arquitetura como cargas | Paredes do DXF/IFC viram cargas lineares (peso por área × altura) | Feito: camada escolhida, revisão em lista e cargas nas vigas e lajes (0.49.0) |
| ✅ | Carga padrão por pavimento | Uso do pavimento aplicado a toda laje nova | Uso das lajes novas no cartão do pavimento (catálogo NBR 6120): toda laje nova do pavimento já sai com a acidental do uso; cada laje pode mudar; botão para aplicar às lajes existentes (etapa L13 (0.45.0) |
| ○ | Versões do projeto | Versão gravada antes de processar e comparação entre versões | A fazer (etapa L14) |
| ✅ | Importar IFC | Pavimentos, pilares, lajes e paredes de um modelo BIM | Feito: pavimentos, pilares, lajes retangulares e paredes/vigas na planta de fundo (0.50.0) |

## 3. Concreto armado: completar vigas, pilares e lajes

Os módulos atuais calculam a armadura principal; para obra ainda faltam as verificações de serviço, a torção, a punção e o detalhamento das barras.

**Vigas**

- ◐ Torção de equilíbrio e de compatibilidade, combinada com cortante (NBR 6118, 17.5)
- ✅ Abertura de fissuras (ELS-W) com os limites por classe de agressividade (17.3.3 e Tabela 13.4)
- ✅ Ancoragem, decalagem do diagrama, comprimento de traspasse e ganchos (9.4 a 9.5, 18.3.2)
- ◐ Armadura de pele para h > 60 cm e armadura de suspensão em apoios indiretos (17.3.5.2.3, 18.3.6)
- ◐ Seção T e L com a laje colaborante, ligada à montagem
- ○ Furos e aberturas, vigas-parede e dentes Gerber

**Pilares**

- ✅ Flexão oblíqua (hoje é normal em cada direção) com a superfície de interação
- ○ Esbeltez de 90 a 140 com pilar-padrão com rigidez κ aproximada ou método geral, e fluência (15.8.3 e 15.8.4)
- ◐ Pilares-parede, seções L, T, U e circulares
- ✅ Estribos suplementares e proteção contra flambagem das barras (18.4.3)
- ✅ Lance a lance: um pilar único da fundação à cobertura, com esforços por pavimento

**Lajes**

- ◐ Punção em lajes lisas e cogumelo, com armadura de punção (19.5)
- ○ Lajes lisas e cogumelo (sem vigas), analisadas na grelha ou por elementos finitos de todo o pavimento
- ◐ Cargas concentradas e de paredes sobre lajes, aberturas e rebaixos
- ◐ Fissuração e flecha diferida com contraflecha em todas as lajes
- ◐ Continuidade entre lajes vizinhas com compatibilização de momentos negativos

## 4. Fundações e contenções

Sem fundações o projeto para nos pilares do térreo; este grupo fecha o caminho das cargas até o solo e depende de dados de sondagem (SPT) informados pelo usuário.

| | Módulo | O que faz | Norma |
|---|---|---|---|
| ✅ | Sondagem SPT | Cadastro dos furos, perfil do solo e NSPT por metro, usado pelos outros módulos | NBR 6484 |
| ✅ | Sapata isolada | Dimensões pela tensão admissível, flexão, cisalhamento e punção; sapata rígida ou flexível | NBR 6122, NBR 6118 22.6 |
| ○ | Sapata associada e de divisa | Duas ou mais cargas, viga de equilíbrio (viga alavanca) para pilares na divisa | NBR 6122 |
| ✅ | Bloco sobre estacas | 1 a n estacas, método das bielas e tirantes, armadura principal e de distribuição | NBR 6118 22.7 |
| ✅ | Ferragem das fundações | Armadura das estacas moldadas in loco pela Tabela 4 (tensão-limite, armadura mínima, comprimento armado pelo atrito, gaiola e estribos) e lista de ferros editável das sapatas e dos blocos, com armaduras laterais e superior nos blocos em linha e suspensão — feito na 0.54.0 | NBR 6122:2019 8.6.3; NBR 6118 22.6 e 22.7 |
| ✅ | Estacas | Capacidade de carga por Aoki-Velloso e Décourt-Quaresma, comprimento e quantidade; hélice contínua, escavada, pré-moldada, broca | NBR 6122 |
| ✅ | Sapata corrida | Sob paredes e vigas do baldrame: largura pela tensão admissível, sapata rígida, flexão pelo CEB-70, compressão diagonal, armadura transversal e de distribuição, carga por metro tirada das reações da viga — feito na 0.58.0 | NBR 6122, NBR 6118 22.6 |
| ◐ | Radier | Método rígido feito na 0.58.0 (pressão N/A ± M/W, faixas pelas linhas de pilares, malhas inferior e superior, punção em C e C′, espessura automática); falta a laje sobre base elástica (coeficiente de reação vertical) e os recalques | NBR 6122, NBR 6118 19.5 |
| ✅ | Armadura 3D das fundações | Sapata (tronco de pirâmide), bloco com as estacas, estaca com a gaiola, sapata corrida e radier com as barras da lista de ferros em 3D; na visualização do projeto, a geometria calculada de cada fundação — feito na 0.58.0 | NBR 6118 22.6 e 22.7 |
| ✅ | Vigas baldrame | Vigas de fundação com carga de paredes e travamento dos blocos | NBR 6118 |
| ○ | Recalques | Estimativa de recalques e recalques diferenciais entre apoios | NBR 6122 |
| ○ | Muro de arrimo | Muro de flexão e de gravidade: empuxo (Rankine ou Coulomb), tombamento, deslizamento e tensão no solo | NBR 11682 |
| ○ | Cortina e contenção de subsolo | Paredes de subsolo com empuxo de terra e de água | NBR 11682, NBR 6122 |

## 5. Elementos especiais

Quase toda edificação tem pelo menos uma escada e um reservatório, então estes módulos aparecem cedo em projetos residenciais.

| | Módulo | O que faz |
|---|---|---|
| ✅ | Escadas | Lances retos, em L e em U, armada longitudinal ou transversal, patamares; cargas transmitidas às vigas |
| ○ | Rampas | Lajes inclinadas com cargas de uso e de veículos |
| ✅ | Reservatórios | Caixas d'água elevadas e enterradas: paredes como placas, empuxo hidrostático, fissuração mais rígida |
| ◐ | Marquises e balanços | Verificação de equilíbrio, tombamento e engaste na viga, com γn |
| ○ | Consolos e dentes | Consolos curtos e muito curtos por bielas e tirantes (NBR 6118, 22.5) |
| ✅ | Vigas T e L | Laje moldada junto como mesa colaborante (NBR 6118, 14.6.2.2): largura bf por tramo, flexão com a linha neutra na mesa ou na alma, ligação mesa–alma (18.3.7), flechas e fissuras com a seção T — feito na 0.53.0 |
| ✅ | Telhado e tesouras de madeira | Telhado de duas águas com telhas, ripas, caibros e terças verificados, tesoura Howe ou Pratt com esforços nas barras, flambagem, entalhe do nó de apoio e flecha; cargas ligadas às vigas e o telhado completo na visualização 3D — feito na 0.60.0 |
| ✅ | Dobras das barras pela Tabela 9.1 | Armadura em 3D com as dobras em arco pelo pino da NBR 6118 (5ø ou 8ø no CA-50) e ganchos a 90° com ponta reta de 8ø depois da dobra — feito na 0.60.0 |
| ✅ | Memorial dos exercícios resolvidos | Em cada exercício da bibliografia, o memorial de cálculo do LEBR recolhido, com os passos, as fórmulas com os números e um desenho que explica a solução (seção, bielas, tensões no solo, contornos de punção, diagramas, curvas) — feito na 0.58.0 |
| ✅ | Módulo educacional (Aprender) | Ajuda › Aprender cálculo estrutural: seis lições (caminho das cargas, esforços na viga, flexão na seção, viga completa, laje maciça e pilar) com controles, gráficos animados explicados e, nas de viga, laje e pilar, o cálculo, a lista de ferros e a armadura em 3D dos módulos — feito na 0.57.0; textos reescritos para estudantes de engenharia civil e arquitetura (o que saber antes, fazer/observar, fórmulas, na prática para a arquitetura e a engenharia, erros comuns, resposta da pergunta e referências da norma) na 0.62.0 |
| ✅ | Laje nervurada em 3D | Geometria completa na visualização 3D (capa, nervuras, faixas maciças de borda, travamentos e blocos de enchimento) e lista de ferros editável com a armadura em 3D: barras de cada nervura, negativas e distribuição na capa, malha da capa e estribos — feito na 0.56.0 |
| ○ | Vigas de transição | Vigas que recebem pilares (pilar nascendo em viga), com carga concentrada vinda do pavimento de cima |
| ◐ | Piscinas e caixas enterradas | Empuxo de terra com e sem água, subpressão |
| ○ | Paredes de concreto | Sistema de paredes de concreto moldadas no local (NBR 16055) |

## 6. Outros materiais e sistemas

O modelo de módulos já prevê novos materiais; cada um abaixo entra como um conjunto de módulos com a sua norma.

| | Material ou sistema | Módulos | Norma |
|---|---|---|---|
| ○ | Aço (perfis laminados e soldados) | Vigas com flambagem lateral com torção, pilares e flexo-compressão, terças e contraventamentos, ligações parafusadas e soldadas, placas de base e chumbadores | NBR 8800 |
| ○ | Aço (perfis formados a frio) | Terças, montantes e vigas de light steel frame, com flambagem local e distorcional | NBR 14762, NBR 15253 |
| ○ | Estruturas mistas | Vigas mistas com conectores, pilares mistos, lajes com fôrma de aço incorporada (steel deck) | NBR 8800, anexos O a Q |
| ◐ | Coberturas | Telhado de madeira (ripas, caibros, terças) e tesouras Howe e Pratt feitos na 0.60.0; faltam treliças de aço, ligações das barras e o vento por zonas da NBR 6123 | NBR 6123, NBR 7190, NBR 8800 |
| ○ | Madeira (complementos) | Ligações por pinos, parafusos e pregos; peças compostas; madeira lamelada colada (MLC) e lamelada cruzada (CLT); paredes de light wood frame | NBR 7190-1:2022, NBR 16936:2023 |
| ○ | Alvenaria estrutural | Paredes de blocos de concreto e cerâmicos: compressão, cisalhamento, flexão, distribuição das cargas por grupos de paredes, vergas | NBR 16868 |
| ○ | Concreto protendido | Lajes e vigas pós-tracionadas com cordoalha engraxada: traçado, perdas, verificações em vazio e em serviço | NBR 6118 (9.6 e 17.2.4) |
| ○ | Pré-moldados | Pilares, vigas e painéis pré-fabricados, consolos, ligações e situações transitórias de içamento e montagem | NBR 9062 |
| ○ | Situação de incêndio | Tempo requerido de resistência ao fogo e verificação por método tabular (concreto) ou simplificado (aço e madeira) | NBR 14432, NBR 15200, NBR 14323, NBR 7190-1 |

## 7. Detalhamento, desenhos e quantitativos

O que a obra recebe são pranchas e listas de materiais; hoje o LEBR entrega cálculos, então este grupo transforma resultado em documento executável.

- ✅ **Detalhamento automático das armaduras:** posições numeradas (N1, N2…), comprimentos com ganchos e dobras, cortes das barras pelo diagrama decalado, editável pelo usuário
- ✅ **Plantas de fôrmas por pavimento:** eixos, cotas, seções das vigas e pilares, níveis, furos e rebaixos, gerados da montagem
- ✅ **Pranchas de armação:** elevação e cortes de vigas e pilares, malhas e negativos de lajes, com tabela de aço por prancha
- ✅ **Locação de pilares e cargas na fundação:** planta com coordenadas e a tabela de cargas por pilar
- ◐ **Exportação DXF:** (formato aberto, lê no AutoCAD, LibreCAD e QCAD) e PDF em formato A1/A0 com carimbo
- ✅ **Quantitativos:** volume de concreto (m³), área de fôrma (m²) e aço por bitola (kg), por elemento e por pavimento
- ◐ **Resumo de aço:** com perdas, peso por metro e lista de corte e dobra
- ○ **Orçamento:** com composições de referência (SINAPI) a partir dos quantitativos
- ✅ **Memorial de cálculo do projeto inteiro:** critérios, materiais, ações, modelo, estabilidade, resultados por elemento, em um único PDF

## 8. Interoperabilidade

O projeto estrutural nasce da arquitetura e volta para ela; trocar arquivos com outros programas evita redesenhar tudo à mão.

- ✅ **Importar DXF da arquitetura:** como fundo da montagem, para lançar pilares e vigas sobre a planta
- ○ **Importar e exportar IFC:** (BIM aberto): ler paredes e pavimentos de um modelo de arquitetura e devolver o modelo estrutural com elementos e armaduras
- ○ **Exportar o modelo de cálculo:** para programas de análise (nós, barras, cargas) e conferir os resultados em outro software
- ◐ **Esquema JSON público e versionado:** do arquivo .lebr.json, para scripts e outras ferramentas lerem o projeto
- ◐ **Catálogos de fabricantes:** como arquivos abertos: treliças, lajotas e EPS, painéis alveolares, perfis de aço, madeiras comerciais, estacas
- ◐ **Planilhas:** exportar tabelas de esforços, reações e quantitativos em CSV ou XLSX

## 9. Confiabilidade e responsabilidade técnica

Um programa de cálculo estrutural só serve para obra se for possível provar que ele calcula certo; esta área vale mais que qualquer módulo novo.

- ✅ **Banco de casos de validação:** exemplos resolvidos dos livros de referência de concreto, madeira e aço e das normas, rodados automaticamente a cada versão, com a tolerância aceita em cada resultado
- ✅ **Varreduras de invariantes e relatório estatístico:** milhares de entradas sorteadas por família (viga, treliça, seção, pilar, placa, punção, fundações, madeira, vento, módulos inteiros) conferindo equilíbrio, simetria, linearidade, limites da norma e soluções exatas, com a taxa de falha limitada a 95 % de confiança; fechamento do caminho das cargas nos projetos de exemplo; npm run confiabilidade — feito na 0.61.0
- ○ **Comparação com programas comerciais:** em edifícios de teste, com as diferenças explicadas no relatório
- ○ **Revisão técnica externa:** de cada módulo por engenheiro estrutural, registrada no repositório
- ✅ **Rastreabilidade no memorial:** cada verificação com a fórmula, os valores usados e o item da norma; hipóteses e simplificações declaradas
- ◐ **Validação de entradas:** limites físicos, unidades em todos os campos e alerta para valores fora do comum (por exemplo, fck acima de 50 MPa ou vão acima de 12 m em laje maciça)
- ○ **Histórico do projeto:** quem mudou o quê e quando, versões do cálculo emitidas e revisões de prancha (R0, R1…)
- ✅ **Versão do programa e das normas:** gravada em cada arquivo e em cada prancha, para reproduzir o cálculo anos depois
- ✅ **Termo de uso claro:** o LEBR é ferramenta de apoio; o projeto é de responsabilidade do profissional habilitado que o assina (ART no CREA ou RRT no CAU, conforme a atribuição profissional)

## 10. Produto e experiência de uso

Estas funcionalidades não mudam o cálculo, mas decidem se um escritório consegue usar o programa no dia a dia.

- ◐ **Lançamento gráfico direto:** desenhar vigas, lajes e pilares na planta com o mouse (hoje se cria o elemento e depois se posiciona)
- ○ **Criação de lajes pelo contorno das vigas:** clicar dentro de um vazio entre vigas gera a laje com as dimensões certas
- ○ **Edição em lote:** mudar seção, fck ou carga de vários elementos de uma vez
- ◐ **Gabaritos de projeto:** residencial térreo, sobrado, prédio de 4 pavimentos, galpão, com parâmetros e cargas típicos
- ◐ **Instalador assinado e atualização automática:** para Windows, macOS e Linux
- ○ **Ajuda contextual e tutoriais:** em cada módulo, com o trecho da norma e um exemplo
- ○ **Repositório de módulos externos:** com versionamento e verificação, para a comunidade publicar módulos
- ○ **Acessibilidade e idiomas:** navegação por teclado completa, alto contraste, textos traduzíveis

## Plano de ação: lançamento da estrutura

Pesquisa de 07/11/2026 nos manuais e materiais de TQS, Eberick, CYPECAD e ETABS (fontes em docs/LANCAMENTO.md). Cada etapa é pequena e entregável sozinha; L1 → L2 → L3 formam o núcleo, porque as outras regras usam o painel de problemas da L2.
- L1 · Tolerância e fusão de nós — tolerância em mm (padrão 1 mm); nós próximos se fundem e o nó que cai sobre uma barra a parte e apoia; comando "limpar geometria". Verificar: viga terminando a 0,8 mm da face do pilar fica apoiada; com 5 mm o programa avisa. ✅ Feita na 0.36.0.
- L2 · Painel de problemas que bloqueia o cálculo — regras independentes (elemento solto, viga sem apoio, laje com contorno aberto, sobreposição, pilar sem continuidade, carga em elemento inexistente), lista por pavimento com zoom no elemento; erro desabilita Calcular. Verificar: um arquivo de teste por defeito gera exatamente um problema; o exemplo de 3 pavimentos gera zero. ✅ Feita na 0.37.0.
- L3 · Apoio explícito nos cruzamentos viga–viga — estado indefinido, A apoia em B, B apoia em A ou sem transferência; "Definir todos" sugere a viga mais rígida como apoio. Verificar: duas vigas em cruz começam indefinidas e bloqueiam; inverter o apoio troca a reação na grelha. ✅ Feita na 0.38.0.
- L4 · Viga em cadeia — lançar clicando de pilar em pilar, com quebra nos pilares atravessados, eixo ou face e deslocamento. Verificar: de P1 a P3 passando por P2 sai uma viga de dois vãos apoiada nos três pilares. ✅ Feita na 0.39.0.
- L5 · Laje por clique no contorno — regiões fechadas pelas faces de vigas e pilares; clicar dentro cria a laje com a direção principal; fechamento de bordo para balanço. Verificar: planta 2×2 mostra quatro regiões; abrir uma viga faz a região sumir e o painel acusar contorno aberto. ✅ Feita na 0.40.0.
- L6 · Dados do próximo elemento e conta-gotas — seção, fck, carga e próximo número antes de inserir; copiar propriedades de um elemento para outros. Verificar: cinco vigas seguidas 14×40 sem reabrir o diálogo. ✅ Feita na 0.41.0.
- L7 · Critérios por elemento — exceção de fck e cobrimento por elemento, com aviso quando fica abaixo do mínimo da CAA. Verificar: C20 numa viga com CAA II dispara aviso. ✅ Feita na 0.41.0.
- L8 · Pré-dimensionamento no lançamento — botão Sugerir: viga h = L/10 (isolada) ou L/12 (contínua) em múltiplos de 5 cm; laje h = máx(Lx/40, mínimo da norma); pilar pela área de influência (Nk = q·Ai·n, γ = 1,8/2,2/2,5). Verificar: viga contínua de 5 m sugere 45 cm; laje 4×5 m sugere 10 cm. ✅ Feita na 0.42.0.
- L9 · Pavimento tipo e cópia seletiva — pavimento com número de repetições (um modelo físico, vários níveis no pórtico) e cópia só de pilares, vigas ou lajes. Verificar: tipo × 4 aparece como quatro níveis no 3D e editar o tipo muda os quatro. ✅ Feita na 0.48.0.
- L10 · Pilar com ponto fixo e lance — ponto fixo (centro, cantos, faces), pavimento inicial e final; pilar nascendo em viga vira aviso de transição. Verificar: aumentar a seção com ponto fixo de canto mantém o canto no lugar. ✅ Feita na 0.47.0.
- L11 · Renumeração automática — P, V e L da esquerda para a direita e de cima para baixo, atualizando ligações e cargas. Verificar: planta embaralhada fica em ordem e as ligações continuam apontando para os mesmos elementos. ✅ Feita na 0.46.0.
- L12 · Paredes do DXF como cargas — camada de paredes escolhida, pares de linhas paralelas de 9 a 25 cm viram paredes; altura = pé-direito − viga (ou − laje); revisão em lista antes de aplicar. Verificar: três paredes de 14 cm geram três cargas com o valor da conta à mão.
- L13 · Carga padrão por pavimento — uso do pavimento (NBR 6120) aplicado a toda laje nova, com sobrescrita por laje. Verificar: laje nova num pavimento residencial já traz a carga do catálogo. ✅ Feita na 0.45.0.
- L14 · Versões do projeto — cópia gravada a cada cálculo e comparação por elemento entre duas versões. Verificar: depois de mudar uma viga, a comparação mostra só essa viga.
- L15 · Importar IFC (mínimo) — pavimentos, pilares, contornos de laje e paredes como cargas (reaproveita a L12). Verificar: um IFC pequeno do Revit ou do Archicad entra com cotas e pilares no lugar.
