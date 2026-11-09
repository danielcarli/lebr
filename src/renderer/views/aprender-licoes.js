/*
 * LEBR — Laboratório de Estruturas Brasil
 * Copyright (C) 2026 Daniel Michelon De Carli
 *
 * Feito com uso da inteligência artificial Claude Opus 5.5, sob a orientação de Daniel Michelon De Carli.
 *
 * Este programa é software livre: você pode redistribuí-lo e/ou modificá-lo nos termos da GNU Affero General
 * Public License, versão 3, publicada pela Free Software Foundation. É distribuído na esperança de ser útil, mas
 * SEM NENHUMA GARANTIA, nem mesmo a garantia implícita de COMERCIALIZAÇÃO ou de ADEQUAÇÃO A UMA FINALIDADE
 * ESPECÍFICA. Veja o arquivo LICENSE ou <https://www.gnu.org/licenses/agpl-3.0.html>.
 *
 * SPDX-License-Identifier: AGPL-3.0-only
 */
/**
 * Texto das lições do módulo Aprender, escrito para estudantes de engenharia civil e de arquitetura.
 *
 * Cada lição tem: objetivo; `antes` (o que convém saber); `passos` ({ faca, observe }: o que fazer e o que observar,
 * com o significado); `conceitos` ([termo, definição]); `formulas` ([expressão, significado]); `naPratica`
 * ({ arquitetura, engenharia }); para cada gráfico, `paraQueServe` e `comoLer`; `erros` comuns; `pergunta` com
 * `resposta`; e `norma` (onde o assunto está na NBR). A parte interativa (controles, animações e 3D) está em aprender.js.
 */

export const LICOES = [
  {
    id: 'caminho',
    numero: '01',
    titulo: 'O caminho das cargas',
    resumo: 'Da laje ao solo: quem apoia em quem',
    objetivo: 'Entender que toda carga que atua num edifício percorre um caminho até o solo — laje → viga → pilar → fundação — e que cada elemento existe para receber a carga de quem está acima e entregá-la a quem está abaixo. Esse caminho é também a ordem em que a estrutura é lançada e calculada.',
    antes: 'Só estática básica: uma força aplicada num corpo em repouso é equilibrada pelas reações dos apoios (ΣF = 0).',
    passos: [
      { faca: 'Aperte Animar e acompanhe as setas.', observe: 'A carga nasce na superfície da laje — peso próprio, contrapiso, revestimento, pessoas e móveis (NBR 6120) — e desce de elemento em elemento. A frase abaixo do desenho faz a conta de cada etapa para um exemplo de dois pavimentos.' },
      { faca: 'Repare na passagem laje → viga.', observe: 'A laje recebe carga por área (kN/m²) e entrega às vigas do contorno uma carga por comprimento (kN/m). A mudança de unidade é o sinal de que a carga trocou de elemento: o que era "peso espalhado" virou "carga de viga".' },
      { faca: 'Siga a carga até o pilar.', observe: 'A viga vence o vão entre os pilares e entrega a eles as reações dos apoios, agora em kN — uma força concentrada. Quanto maior o vão e a carga por metro, maior a reação (numa biapoiada, qL/2 em cada apoio).' },
      { faca: 'Desça pelos pilares.', observe: 'O pilar soma a carga de todos os pavimentos acima dele. Por isso o lance do térreo é o mais carregado e tem a maior seção ou mais aço; num edifício alto a seção do pilar pode diminuir à medida que sobe.' },
      { faca: 'Chegue à fundação.', observe: 'A sapata (ou o bloco sobre estacas) recebe a força concentrada do pilar e a espalha numa área grande o bastante para que a tensão no solo (kN/m², isto é, kPa) fique abaixo do que a sondagem indicou que ele suporta.' },
    ],
    conceitos: [
      ['Carga permanente (g)', 'Age durante toda a vida da estrutura, com valor praticamente constante: peso próprio do concreto armado (25 kN/m³), alvenarias, revestimentos, contrapiso. Valores na NBR 6120.'],
      ['Carga variável ou acidental (q)', 'Pode ou não estar presente e muda de posição e intensidade: pessoas, móveis, veículos, água, vento. A NBR 6120 dá valores mínimos por uso do ambiente (1,5 kN/m² em ambientes residenciais, 2,5 kN/m² em escritórios, por exemplo).'],
      ['Reação de apoio', 'Força que o apoio faz sobre o elemento para mantê-lo em equilíbrio. Pela ação e reação, é com esse mesmo valor que o elemento carrega quem o apoia: a reação da laje é a carga da viga; a reação da viga é a carga do pilar.'],
      ['Área de influência', 'Parte do pavimento cuja carga chega a um pilar (aproximadamente, metade da distância até cada pilar vizinho). Serve para estimar a carga do pilar antes de qualquer cálculo.'],
    ],
    formulas: [
      ['p = g + q  (kN/m²)', 'carga total por metro quadrado de laje; é com ela que começa toda conta'],
      ['Laje em uma direção: carga na viga ≈ p · lx / 2  (kN/m)', 'cada viga de apoio leva metade da faixa de laje; em lajes em duas direções a divisão segue os triângulos e trapézios dos quinhões de carga (NBR 6118, 14.7.6.1)'],
      ['Viga biapoiada: R = q · L / 2  (kN)', 'reação em cada apoio com carga q uniforme no vão L'],
      ['N ≈ A_inf · (10 a 12 kN/m²) · n', 'estimativa da carga característica de um pilar: área de influência × carga total por m² de pavimento × número de pavimentos acima'],
      ['σ = N / A ≤ σ_adm', 'tensão na base da sapata: a área A é escolhida para que a tensão não ultrapasse a admissível do solo (NBR 6122)'],
    ],
    naPratica: {
      arquitetura: 'O caminho das cargas é desenhado por você antes de qualquer cálculo: ao posicionar os pilares, você define os vãos das vigas; ao escolher onde ficam as paredes, define quais vigas as recebem. Pilares alinhados de um pavimento ao outro dão o caminho mais curto e barato; um pilar que "nasce" numa viga (transição) obriga essa viga a carregar um pedaço do edifício. Lajes de 4 a 6 m e pilares a cada 4 a 7 m são proporções que costumam resultar em vigas e lajes de altura usual.',
      engenharia: 'A ordem laje → viga → pilar → fundação é a ordem do lançamento e do cálculo. Antes de dimensionar, confira a soma: o peso de tudo que entra (área × (g + q), paredes, peso próprio) tem de chegar às fundações. É o "fechamento do caminho das cargas" que o LEBR faz nos projetos de exemplo; feito à mão numa folha, é a conferência mais barata de um projeto.',
    },
    graficos: [
      {
        id: 'caminho', titulo: 'Animação do caminho das cargas',
        paraQueServe: 'Mostra a ordem em que a carga passa de um elemento para o outro — e, portanto, a ordem do cálculo: primeiro as lajes, depois as vigas, os pilares e por fim a fundação. Cada elemento só pode ser calculado depois de conhecidas as reações de quem ele apoia.',
        comoLer: 'As setas tracejadas andam no sentido da carga. O elemento aceso é o que está recebendo a carga naquele instante. A frase embaixo do desenho dá a conta daquela etapa num exemplo de dois pavimentos: repare na unidade mudando de kN/m² (laje) para kN/m (viga), kN (pilar) e kPa (solo).',
      },
    ],
    erros: [
      'Esquecer o peso próprio: o concreto pesa 25 kN/m³ — uma laje de 12 cm já pesa 3 kN/m² antes de receber qualquer coisa.',
      'Contar a mesma parede duas vezes (na laje e na viga) ou nenhuma vez (parede sobre a laje sem ser lançada).',
      'Achar que a viga que apoia a laje "maior" é sempre a mais carregada: o que importa é o quinhão de carga que chega a ela, não o tamanho da laje.',
    ],
    pergunta: 'Se a laje do último pavimento for retirada, quais elementos deixam de receber carga e quais continuam carregados? E o que acontece com a carga do pilar do térreo?',
    resposta: 'As vigas que só apoiavam essa laje ficam apenas com o peso próprio e as paredes que porventura recebam. Todos os pilares continuam carregados pelos pavimentos de baixo, mas cada um perde a parcela daquela laje; o pilar do térreo perde exatamente o mesmo valor que o do último pavimento, porque a carga removida passava inteira por ele. A fundação alivia na mesma medida.',
    norma: [
      'NBR 6120:2019 — cargas permanentes e variáveis (pesos específicos e cargas de uso por ambiente)',
      'NBR 6118:2023, 14.7.6.1 — reações das lajes nas vigas (quinhões de carga)',
      'NBR 6122:2022 — fundações: tensão admissível e segurança',
    ],
  },
  {
    id: 'esforcos',
    numero: '02',
    titulo: 'Esforços na viga: cortante e momento fletor',
    resumo: 'DEC, DMF e deformada de uma viga',
    objetivo: 'Ver como uma carga distribuída gera esforço cortante (V) e momento fletor (M) ao longo da viga, aprender a ler os diagramas DEC e DMF e perceber como os vínculos — apoio simples, engaste, balanço — mudam esses diagramas e a deformada.',
    antes: 'Equilíbrio de forças e momentos (ΣF = 0, ΣM = 0) e a ideia de "cortar" a viga numa seção para expor os esforços internos.',
    passos: [
      { faca: 'Escolha a viga biapoiada, deixe a carga num valor redondo e leia as reações.', observe: 'Cada apoio recebe metade da carga total (qL/2). O esquema estático é o modelo de cálculo: o que entra errado aqui sai errado em tudo o que vem depois.' },
      { faca: 'Aperte Animar.', observe: 'A carga entra aos poucos e os diagramas crescem na mesma proporção: dobrar q dobra V e M em toda seção. Essa linearidade é o que permite calcular cada carga em separado e somar os resultados (superposição).' },
      { faca: 'Passe o mouse ao longo da viga e acompanhe V e M.', observe: 'V é máximo nos apoios e passa por zero no meio; exatamente aí M é máximo (qL²/8). A regra é geral — dM/dx = V: onde o cortante zera, o momento tem um extremo.' },
      { faca: 'Troque para a biengastada com o mesmo vão e carga.', observe: 'Aparecem momentos negativos nos engastes (−qL²/12) e o do meio cai para qL²/24; a soma |M_eng| + M_meio continua qL²/8. Engastar não elimina momento, redistribui — e a flecha cai para um quinto da biapoiada.' },
      { faca: 'Troque para o balanço.', observe: 'V e M são máximos no engaste (qL e −qL²/2) e nulos na ponta livre. O momento é negativo em todo o comprimento: a armadura principal vai em cima. É o caso em que mais se erra na obra.' },
    ],
    conceitos: [
      ['Esforço cortante (V)', 'Resultante das forças verticais de um lado da seção. Tende a fazer uma parte da viga "deslizar" em relação à outra; no concreto produz fissuras inclinadas a cerca de 45° perto dos apoios, costuradas pelos estribos. Unidade: kN.'],
      ['Momento fletor (M)', 'Resultante dos momentos das forças de um lado da seção. É o que curva a viga: traciona a face de baixo quando positivo (meio do vão) e a de cima quando negativo (engastes, apoios internos, balanços). Unidade: kN·m.'],
      ['Relações diferenciais', 'dV/dx = −q e dM/dx = V: a carga é a inclinação do DEC; o cortante é a inclinação do DMF. Com carga uniforme, o DEC é uma reta e o DMF uma parábola.'],
      ['Vínculos', 'Apoio simples impede só o deslocamento vertical; apoio fixo impede também o horizontal; engaste impede ainda a rotação. Com mais vínculos que o necessário a viga é hiperestática: os esforços passam a depender da rigidez.'],
      ['Flecha', 'Deslocamento vertical máximo da viga em serviço. A norma a limita (L/250 para aceitabilidade visual, Tabela 13.3) porque uma viga pode resistir e, ainda assim, trincar as paredes e os pisos que apoia.'],
    ],
    formulas: [
      ['Biapoiada: R = qL/2 ; M_máx = qL²/8 ; f = 5qL⁴/(384EI)', 'o caso de referência de toda a análise de vigas'],
      ['Biengastada: M_eng = −qL²/12 ; M_meio = qL²/24 ; f = qL⁴/(384EI)', 'flecha cinco vezes menor que a da biapoiada'],
      ['Balanço: V_eng = qL ; M_eng = −qL²/2 ; f = qL⁴/(8EI)', 'momento quatro vezes o da biapoiada de mesmo vão e flecha 48 vezes maior'],
      ['dM/dx = V ; dV/dx = −q', 'o momento é extremo onde o cortante zera'],
    ],
    naPratica: {
      arquitetura: 'O momento cresce com o quadrado do vão: uma viga de 8 m tem quatro vezes o momento de uma de 4 m e precisa de muito mais altura. Para pré-dimensionar, h ≈ L/10 a L/12 em vigas biapoiadas de concreto armado, L/12 a L/15 em vigas contínuas e L/5 a L/6 em balanços — e lembre que a altura da viga consome pé-direito e dita por onde passam dutos e esquadrias. Um balanço de 2 m tem o mesmo momento de uma viga biapoiada de 4 m.',
      engenharia: 'Os diagramas são o insumo direto do dimensionamento: o DMF dá a área de aço e a face em que ela vai; o DEC dá os estribos e a verificação da biela comprimida; a deformada dá o estado-limite de serviço. Confira sempre os picos com as expressões fechadas (qL²/8, qL²/12, qL²/2) antes de confiar em qualquer programa — inclusive neste.',
    },
    graficos: [
      {
        id: 'carregamento', titulo: 'Esquema estático',
        paraQueServe: 'Mostra o modelo que será calculado: o vão, os vínculos e a carga. É a idealização da viga real — e a etapa em que mais se decide: errar o vínculo (apoio onde há engaste, ou o contrário) muda todos os diagramas.',
        comoLer: 'Triângulo é apoio (deixa girar), hachura é engaste (não deixa girar), ponta sem nada é borda livre. As setas são a carga uniforme em kN/m e os números embaixo são as reações em kN. Confira: a soma das reações tem de ser igual a q · L.',
      },
      {
        id: 'dec', titulo: 'Diagrama de esforço cortante (DEC)',
        paraQueServe: 'Dimensiona os estribos e verifica se a biela de concreto comprimido aguenta (NBR 6118, 17.4). Onde o cortante é maior, os estribos ficam mais próximos; se Vd passar de VRd2, nem estribo resolve — a seção precisa crescer.',
        comoLer: 'Acima do eixo, cortante positivo; abaixo, negativo (convenção: positivo quando a resultante à esquerda da seção aponta para cima). A inclinação da reta é a própria carga q. O valor máximo, em kN, aparece junto aos apoios; nas reações ele dá um "salto" igual à reação.',
      },
      {
        id: 'dmf', titulo: 'Diagrama de momento fletor (DMF)',
        paraQueServe: 'Dimensiona a armadura longitudinal: onde o momento é positivo, barras embaixo; onde é negativo, barras em cima. O valor do momento define a quantidade de aço; a extensão do trecho define o comprimento das barras.',
        comoLer: 'No Brasil o DMF é desenhado do lado tracionado: positivo para baixo, negativo para cima. Assim o próprio desenho mostra em que face vai a armadura. Valores em kN·m. Com carga uniforme a curva é uma parábola; o pico fica onde o DEC cruza o zero.',
      },
      {
        id: 'deformada', titulo: 'Deformada (linha elástica)',
        paraQueServe: 'Verifica a flecha no estado-limite de serviço (NBR 6118, 13.3): a viga pode resistir e mesmo assim deformar tanto que trinca alvenarias, empena esquadrias e dá sensação de insegurança. Em vigas de vão grande a flecha manda mais que a resistência.',
        comoLer: 'A curva é a viga deformada, muito exagerada. O número é a flecha elástica imediata máxima (em mm, com a inércia bruta da seção). A norma limita a flecha total — que inclui a fissuração e a fluência do concreto, e pode ser duas a três vezes a imediata — a L/250.',
      },
    ],
    erros: [
      'Desenhar o DMF "para cima" como em livros estrangeiros e depois colocar a armadura na face errada: no Brasil o diagrama é traçado do lado tracionado.',
      'Tratar um balanço como viga biapoiada: a armadura principal do balanço é negativa (em cima), e a sua ancoragem no vão vizinho é o que o segura.',
      'Supor engaste onde o apoio não é capaz de absorver momento: uma viga que chega num pilar fino está mais perto de apoiada do que de engastada.',
    ],
    pergunta: 'Por que, na viga biengastada, o momento no meio do vão é três vezes menor que na biapoiada, se a carga e o vão são os mesmos?',
    resposta: 'Porque os engastes "puxam" o diagrama para cima. O momento isostático qL²/8 continua sendo a distância entre a parábola e a linha que une os momentos dos apoios — só que essa linha agora está em −qL²/12. No meio do vão, qL²/8 − qL²/12 = qL²/24, um terço de qL²/8. O momento total não desapareceu: parte dele foi para os apoios, onde a armadura negativa o resiste.',
    norma: [
      'NBR 6118:2023, 14.6 — análise linear; 14.6.2.4 — vãos efetivos',
      'NBR 6118:2023, 13.3 e Tabela 13.3 — limites de deslocamentos',
      'NBR 6118:2023, 17.4 — dimensionamento ao esforço cortante',
    ],
  },
  {
    id: 'flexao',
    numero: '03',
    titulo: 'Flexão na seção: deformações, tensões e domínios',
    resumo: 'Linha neutra, bloco de compressão e aço',
    objetivo: 'Entender o que acontece dentro de uma seção de concreto armado conforme o momento cresce: o concreto encurta em cima, o aço alonga embaixo, a linha neutra desce e a seção passa pelos domínios de deformação. É a base do dimensionamento à flexão da NBR 6118.',
    antes: 'Lição 02 (de onde vem o momento) e a noção de tensão × deformação: o concreto quase não resiste à tração — por isso o aço —, e o aço CA-50 escoa a partir de εyd ≈ 2,07 ‰.',
    passos: [
      { faca: 'Deixe a seção padrão e aperte Animar.', observe: 'Com momento pequeno a linha neutra fica alta e o aço se alonga muito em relação ao concreto: é o domínio 2, em que o aço chegaria a 10 ‰ antes de o concreto esmagar.' },
      { faca: 'Observe o par de forças Rc e Rs.', observe: 'Em qualquer instante Rc = Rs (não há força normal): a seção está em equilíbrio e o momento é o binário Md = Rc · z = Rs · z. Aumentar o momento aumenta as forças e, com elas, a altura do bloco comprimido — a linha neutra desce.' },
      { faca: 'Aumente o momento até o marcador passar de x/d = 0,45.', observe: 'A seção sai da faixa dúctil (verde). A norma (14.6.4.3) limita x/d a 0,45 para fck ≤ 50 MPa para garantir que o aço escoe bastante antes de o concreto romper: a viga avisa — fissura e deforma — antes de cair.' },
      { faca: 'Continue até o domínio 4.', observe: 'O concreto chega a 3,5 ‰ com o aço ainda elástico (εs < εyd): ruptura frágil, sem aviso. A solução não é "mais aço" — é mais altura, concreto mais resistente ou armadura dupla (barras comprimidas em cima).' },
      { faca: 'Aumente h e repita.', observe: 'Para o mesmo momento, x/d cai e a área de aço diminui: a altura é o parâmetro mais eficiente da flexão, porque aumenta o braço de alavanca z.' },
    ],
    conceitos: [
      ['Hipótese das seções planas', 'Uma seção plana antes da flexão continua plana depois (Bernoulli). Consequência: as deformações variam linearmente com a altura, e o diagrama de deformações é uma reta.'],
      ['Linha neutra (x)', 'Profundidade, medida do topo, onde a deformação (e a tensão) é zero. Acima: concreto comprimido. Abaixo: concreto fissurado, que o cálculo despreza, e aço tracionado.'],
      ['Domínio 2', 'Ruptura pelo aço (εs = 10 ‰) com o concreto ainda abaixo de 3,5 ‰. Seções pouco armadas: muito dúcteis, mas o concreto é subaproveitado.'],
      ['Domínio 3', 'Concreto a 3,5 ‰ e aço escoando (εyd ≤ εs ≤ 10 ‰). Os dois materiais trabalham no limite: é a ruptura econômica e com aviso — o objetivo do dimensionamento.'],
      ['Domínio 4', 'Concreto a 3,5 ‰ e aço elástico (εs < εyd): ruptura brusca pela compressão. Não é aceito como ruptura de projeto — daí o limite x/d ≤ 0,45.'],
      ['Bloco retangular', 'Simplificação da norma (17.2.2) para o diagrama parábola-retângulo: tensão 0,85·fcd numa altura 0,8·x (para fck ≤ 50 MPa).'],
    ],
    formulas: [
      ['εc / x = εs / (d − x)', 'semelhança de triângulos no diagrama de deformações'],
      ['Rc = 0,85·fcd · b · 0,8·x ; Rs = As · fyd', 'resultantes de compressão e tração; fcd = fck/1,4 e fyd = fyk/1,15'],
      ['Md = Rc · z, com z = d − 0,4·x', 'equilíbrio de momentos; z é o braço de alavanca'],
      ['x/d ≤ 0,45 (fck ≤ 50 MPa)', 'limite de ductilidade da NBR 6118, 14.6.4.3'],
      ['As,mín = ρmín · b · h, com ρmín ≥ 0,15 %', 'armadura mínima (Tabela 17.3): evita ruptura frágil ao fissurar'],
      ['x₂₃ = 0,259·d ; x₃₄ = 0,628·d (CA-50)', 'fronteiras entre os domínios 2/3 e 3/4'],
    ],
    naPratica: {
      arquitetura: 'A altura útil d é o que mais pesa na flexão: dobrar h divide a armadura por mais de dois e reduz muito a flecha. Quando o pé-direito ou a fachada exigem uma viga baixa, a conta fecha com mais aço e mais largura, mas há um limite (x/d ≤ 0,45) a partir do qual nem "mais aço" resolve — a viga precisa crescer, receber armadura dupla, ou o vão precisa diminuir. Vigas-faixa (largas e baixas) são possíveis, mas custam mais e deformam mais.',
      engenharia: 'Roteiro do dimensionamento: Md → x pela equação de equilíbrio de momentos → conferir o domínio e x/d ≤ 0,45 → As = Md/(fyd·z) → conferir As,mín e As,máx (4 % de Ac) → escolher bitolas que caibam na largura com o espaçamento mínimo. Este é o motor usado pelo módulo de vigas; refaça uma seção à mão com as fórmulas da lição e compare.',
    },
    graficos: [
      {
        id: 'deformacoes', titulo: 'Diagrama de deformações',
        paraQueServe: 'Mostra quanto cada fibra da seção encurta ou alonga. Pela hipótese das seções planas é uma reta, e é ela que define em que domínio a seção está e se o aço escoa. Todo o dimensionamento à flexão parte daqui.',
        comoLer: 'Deformações em ‰ (milésimos: 3,5 ‰ = 0,35 %). À esquerda, encurtamento do concreto, limitado a 3,5 ‰; à direita, alongamento do aço, limitado a 10 ‰. Onde a reta cruza o eixo da seção está a linha neutra; a marca εyd mostra a partir de onde o aço escoa.',
      },
      {
        id: 'tensoes', titulo: 'Diagrama de tensões e forças',
        paraQueServe: 'Transforma deformações em forças: o bloco de compressão do concreto (Rc) e a força no aço (Rs). O braço de alavanca z entre elas vezes a força dá o momento resistente — é a conta que fecha o dimensionamento.',
        comoLer: 'O retângulo de altura 0,8·x e tensão 0,85·fcd (em MPa) é a simplificação da norma (17.2.2) para o diagrama parábola-retângulo. As setas Rc e Rs têm o mesmo valor (kN) e sentidos opostos; o momento é Rc · z, em kN·m.',
      },
      {
        id: 'dominios', titulo: 'Régua dos domínios (x/d)',
        paraQueServe: 'Diz em que domínio a seção está e se ela é dúctil. É o que se confere logo depois de achar a linha neutra — e o que decide se a solução é aceitável ou se a seção precisa mudar.',
        comoLer: 'O marcador anda conforme o momento cresce. Verde até x/d = 0,45 (dúctil, aceito pela norma); amarelo até 0,628 (ainda domínio 3, mas acima do limite de ductilidade); vermelho a partir daí (domínio 4, ruptura frágil).',
      },
    ],
    erros: [
      'Dimensionar no domínio 4 e "resolver" colocando mais aço tracionado: isso só aprofunda a linha neutra. O caminho é altura, fck ou armadura dupla.',
      'Confundir d com h: d = h − cobrimento − estribo − metade da bitola. Numa viga de 40 cm, d fica em torno de 35 a 36 cm.',
      'Usar fck em vez de fcd (ou fyk em vez de fyd): os coeficientes 1,4 e 1,15 são a segurança dos materiais.',
    ],
    pergunta: 'Se dobrarmos a altura da viga, o que acontece com x/d e com a área de aço para o mesmo momento?',
    resposta: 'Com o dobro de d o braço z quase dobra; para o mesmo Md, as forças Rc e Rs caem para cerca da metade. Rc menor exige um bloco comprimido menor, logo x cai — e x/d cai ainda mais, porque d dobrou. A área de aço As = Md/(fyd·z) fica um pouco abaixo da metade. É por isso que ganhar altura é mais eficiente do que ganhar aço.',
    norma: [
      'NBR 6118:2023, 17.2.2 — hipóteses básicas e domínios de deformação (Figura 17.1)',
      'NBR 6118:2023, 14.6.4.3 — limite x/d para ductilidade',
      'NBR 6118:2023, 17.3.5 e Tabela 17.3 — armadura mínima',
      'NBR 6118:2023, 8.2.10 e 8.3.6 — diagramas tensão-deformação do concreto e do aço',
    ],
  },
  {
    id: 'viga',
    numero: '04',
    titulo: 'Da conta à armadura: a viga completa',
    resumo: 'Cálculo do módulo de vigas, lista de ferros e 3D',
    objetivo: 'Ligar os diagramas à armação real: ver como o módulo de vigas do LEBR transforma momento e cortante em barras longitudinais, estribos, ancoragens e lista de ferros — o mesmo caminho que um projeto executivo percorre.',
    antes: 'Lições 02 e 03. Os nomes das peças da armadura (positiva, negativa, estribo, porta-estribo) estão nos conceitos ao lado.',
    passos: [
      { faca: 'Ajuste vão, cargas e seção e leia a ficha de resultados.', observe: 'A viga é calculada pelo mesmo módulo da página de edição: combinações da NBR 8681 (γg = γq = 1,4), peso próprio automático, verificações de ELU (flexão, cortante) e de ELS (flecha, abertura de fissuras).' },
      { faca: 'Leia a envoltória.', observe: 'Ela não é o DMF de um carregamento só: é o maior e o menor valor de cada esforço entre todas as combinações, já majorados (Md, Vd). É com esses valores que a armadura é dimensionada.' },
      { faca: 'Na armadura 3D, passe o mouse sobre as barras; gire e aproxime.', observe: 'Cada cor é uma posição (N1, N2…). Veja onde as barras positivas terminam dentro do apoio (ancoragem), os ganchos das negativas e o espaçamento dos estribos — mais apertado onde Vd é maior.' },
      { faca: 'Confira a lista de ferros.', observe: 'Cada linha é uma posição: quantidade, bitola, comprimento de corte (com dobras e ganchos) e massa. É o documento que vai para a obra e para o orçamento; a massa total por m³ de concreto (80 a 120 kg/m³ em vigas usuais) é um bom termômetro da solução.' },
      { faca: 'Aumente a carga até a viga deixar de atender.', observe: 'A ficha diz qual verificação falhou primeiro: x/d, taxa de armadura, biela comprimida (cortante), flecha ou abertura de fissuras. Cada uma pede um remédio diferente — altura, largura, fck ou aço.' },
    ],
    conceitos: [
      ['Armadura positiva', 'Barras na face inferior, para o momento positivo do vão. Pelo menos parte delas deve chegar aos apoios e ser ancorada ali (18.3.2.4).'],
      ['Armadura negativa', 'Barras na face superior, sobre apoios intermediários, engastes e balanços. O comprimento acompanha o trecho de momento negativo mais a ancoragem.'],
      ['Porta-estribos', 'Barras finas (em geral 2 φ 6,3 ou 8 mm) na face sem armadura calculada, só para fechar e posicionar os estribos na montagem.'],
      ['Estribos', 'Armadura transversal que costura as fissuras inclinadas do cortante e confina a seção. Espaçamento máximo 0,6·d ≤ 30 cm quando Vd ≤ 0,67·VRd2; bitola mínima 5 mm (18.3.3.2).'],
      ['Ancoragem (lb)', 'Comprimento que a barra precisa ficar embutida no concreto para transferir sua força por aderência (9.4.2). Ganchos reduzem a ancoragem reta.'],
      ['Cobrimento', 'Camada de concreto entre a barra e a face, que protege contra corrosão e fogo. Depende da classe de agressividade ambiental: 25 mm em vigas na CAA I, 30 mm na CAA II, 40 mm na CAA III (Tabela 7.2).'],
    ],
    formulas: [
      ['Md = 1,4·(Mg + Mq)', 'combinação última normal usual (NBR 8681); a envoltória guarda o máximo e o mínimo entre as combinações'],
      ['As = Md / (fyd · z)', 'área de aço da flexão (Lição 03)'],
      ['VRd2 = 0,27·αv2·fcd·bw·d, com αv2 = 1 − fck/250', 'resistência da biela comprimida: se Vd > VRd2 a seção é pequena'],
      ['Vsw = Vd − Vc ; Asw/s = Vsw / (0,9·d·fywd)', 'estribos pelo modelo de cálculo I (treliça a 45°), com Vc = 0,6·fctd·bw·d'],
      ['lb = (φ/4) · (fyd / fbd)', 'comprimento de ancoragem básico (9.4.2.4)'],
    ],
    naPratica: {
      arquitetura: 'A armadura precisa caber: largura mínima de 12 cm (13.2.2), espaçamento livre entre barras de pelo menos 2 cm, uma bitola e 1,2 vez o agregado — e o concreto tem de passar entre elas. Vigas estreitas com muito aço viram "paredes de ferro" que não concretam bem. A posição das barras também condiciona furos e passagens: nunca na zona de maior momento ou perto dos apoios sem o engenheiro saber.',
      engenharia: 'O detalhamento é tão projeto quanto o cálculo: decalagem do diagrama de momentos (al), comprimentos de ancoragem, emendas por traspasse, ganchos e raios de dobra (Tabela 9.1) e a lista de ferros. Compare neste 3D a armadura que você imaginaria a partir dos diagramas com a desenhada; onde diferirem, procure o motivo no memorial do módulo.',
    },
    graficos: [
      {
        id: 'envoltoria', titulo: 'Envoltória de esforços de cálculo',
        paraQueServe: 'É o diagrama que o dimensionamento usa de verdade: o maior e o menor valor de cada esforço entre todas as combinações de carga, já majorados por γf = 1,4. Onde a envoltória de momentos passa de positivo a negativo, as duas faces precisam de armadura.',
        comoLer: 'Em cima, Md em kN·m (positivo para baixo, como no DMF); embaixo, Vd em kN. As duas linhas de cada gráfico são o máximo e o mínimo das combinações. Numa viga só com carga permanente e acidental em todos os vãos elas coincidem; separam-se quando há alternância de carga.',
      },
      {
        id: 'armadura3d', titulo: 'Armadura em 3D',
        paraQueServe: 'Mostra a armação como será montada na obra: onde cada barra começa e termina, as dobras com o raio da norma, os ganchos e o espaçamento dos estribos. É a tradução dos diagramas em aço.',
        comoLer: 'Cada cor é uma posição (legenda acima do desenho). O concreto aparece transparente; o botão Concreto o esconde. Arrastar gira, a roda aproxima, passar o mouse mostra posição e bitola. Compare o trecho em que as barras negativas se estendem com o trecho de momento negativo na envoltória.',
      },
      {
        id: 'lista', titulo: 'Lista de ferros',
        paraQueServe: 'É o que vai para a armação e para o orçamento: quantidade, bitola e comprimento de cada posição, e a massa de aço. Também é a conferência final: uma posição faltando ou com comprimento errado aparece aqui.',
        comoLer: 'Cada linha é uma posição (N1, N2…). C é o comprimento de corte da barra em cm, já com as dobras e ganchos; a massa usa a massa linear nominal da NBR 7480 (φ 8 = 0,395 kg/m, φ 10 = 0,617 kg/m, φ 12,5 = 0,963 kg/m).',
      },
    ],
    erros: [
      'Cortar as barras positivas exatamente onde o momento zera: a decalagem e a ancoragem exigem prolongá-las — e pelo menos parte delas tem de ir até dentro do apoio.',
      'Estribos iguais em toda a viga "por garantia": desperdiça aço onde Vd é pequeno e pode faltar junto aos apoios se o espaçamento único for o do meio do vão.',
      'Esquecer o cobrimento e o estribo ao contar as barras por camada: a largura útil para as barras é b − 2·(c + φt).',
    ],
    pergunta: 'Por que os estribos ficam mais juntos perto dos apoios em algumas vigas e, em outras, o espaçamento é o mesmo em todo o vão?',
    resposta: 'O espaçamento sai de Vd. Perto dos apoios o cortante é máximo e a parcela Vsw = Vd − Vc exige mais área de estribo por metro. Em vigas pouco carregadas Vd fica abaixo de Vc em quase todo o vão e manda a armadura mínima, com o espaçamento máximo — por isso os estribos ficam uniformes. Em vigas muito carregadas ou curtas o cortante domina e aparecem dois ou três trechos de espaçamento diferente.',
    norma: [
      'NBR 6118:2023, 17.4 — esforço cortante (modelos de cálculo I e II)',
      'NBR 6118:2023, 18.3 — detalhamento de vigas (armaduras longitudinal e transversal, decalagem)',
      'NBR 6118:2023, 9.4 — ancoragem; Tabela 9.1 — diâmetro dos pinos de dobramento',
      'NBR 6118:2023, Tabela 7.2 — cobrimentos nominais · NBR 7480 — barras de aço (massa linear)',
    ],
  },
  {
    id: 'laje',
    numero: '05',
    titulo: 'Laje maciça: uma ou duas direções',
    resumo: 'Divisão de carga, momentos e malha',
    objetivo: 'Ver como a proporção entre os vãos (λ = ly/lx) define se a laje trabalha numa direção ou nas duas, como a carga se divide entre as direções, de onde saem os momentos por metro e como tudo isso vira malha de aço.',
    antes: 'Lição 02 (a laje em uma direção é, por metro de largura, uma viga) e Lição 03 (os momentos por metro são dimensionados como numa seção de 100 cm de largura).',
    passos: [
      { faca: 'Comece com lx = ly (laje quadrada).', observe: 'As faixas dividem a carga meio a meio: a laje é armada igual nas duas direções, com Mx = My. Cada direção carrega metade — por isso a laje quadrada é a mais eficiente.' },
      { faca: 'Aumente ly aos poucos e acompanhe as porcentagens.', observe: 'A faixa curta é muito mais rígida (a flecha cresce com L⁴) e fica com a maior parte da carga. Com ly = 1,5·lx ela já leva cerca de 84 %.' },
      { faca: 'Passe de λ = 2.', observe: 'A laje passa a ser tratada como armada em uma direção: trabalha praticamente só na direção curta. Os momentos são os de uma viga de 1 m de largura e vão lx; na direção longa entra só a armadura de distribuição.' },
      { faca: 'Leia o gráfico de momentos.', observe: 'Mx e My (positivos, aço embaixo) e Mx\', My\' (negativos, aço em cima, nas bordas engastadas) saem das tabelas de Bares para o λ e para as condições de apoio — e são por metro de largura (kN·m/m).' },
      { faca: 'Abra o 3D.', observe: 'A direção com mais barras, ou mais grossas, é a que levou mais carga — a curta. Veja também as negativas nas bordas engastadas e a armadura de distribuição nas lajes em uma direção.' },
    ],
    conceitos: [
      ['lx e ly', 'Vãos teóricos da laje (entre os eixos dos apoios); por convenção lx é o menor. Na laje armada em uma direção, lx é a direção principal.'],
      ['λ = ly / lx', 'Índice que classifica a laje: até 2, armada em duas direções (em cruz); acima de 2, em uma direção. É um critério clássico de projeto que a norma adota ao definir as armaduras mínimas (Tabela 19.1).'],
      ['Momento por metro', 'Nas lajes os esforços são dados por faixa de 1 m de largura (kN·m/m). O dimensionamento é o da Lição 03 com b = 100 cm, e a armadura sai em cm²/m — convertida em bitola e espaçamento (φ 8 c/ 15, por exemplo).'],
      ['Armadura de distribuição', 'Nas lajes em uma direção, barras na direção longa — pelo menos 20 % da principal, 0,9 cm²/m e metade da taxa mínima (Tabela 19.1) — que espalham cargas concentradas e controlam as fissuras de retração e temperatura.'],
      ['Espessura mínima', 'A norma (13.2.4.1) fixa 7 cm para cobertura não em balanço, 8 cm para piso não em balanço, 10 cm em balanço e para veículos até 30 kN, 12 cm para veículos acima disso.'],
    ],
    formulas: [
      ['λ = ly / lx', 'classificação da laje'],
      ['kx = ly⁴ / (lx⁴ + ly⁴) ; ky = 1 − kx', 'quinhão de carga de cada direção pelas faixas de Marcus (ilustrativo: a tabela de Bares já embute a divisão)'],
      ['M = μ · p · lx² / 100', 'momentos por metro pelas tabelas (Bares, Czerny): μ depende de λ e das condições de apoio'],
      ['Laje em uma direção biapoiada: M = p · lx² / 8', 'o mesmo da viga, por metro de largura'],
      ['s = 100 · Aφ / As', 'espaçamento (cm) a partir da área por metro; s ≤ 2h e ≤ 20 cm na armadura principal (20.1)'],
    ],
    naPratica: {
      arquitetura: 'A laje é o elemento de maior volume de concreto do edifício: um ou dois centímetros a mais em todas as lajes pesam muito no custo e na carga dos pilares e fundações. Para pré-dimensionar lajes maciças: h ≈ lx/40 (apoiadas) a lx/50 (contínuas), nunca abaixo do mínimo da norma — vãos de 4 a 5 m dão lajes de 10 a 12 cm. Para vãos maiores, lajes nervuradas ou treliçadas costumam ser mais econômicas. Plantas com panos próximos do quadrado aproveitam melhor a laje do que retângulos alongados.',
      engenharia: 'Roteiro: classificar (λ); escolher a condição de cada borda (apoiada, engastada quando há continuidade com a laje vizinha, livre); ler μ nas tabelas; calcular os momentos por metro; compatibilizar os negativos entre lajes vizinhas; dimensionar com b = 100 cm; converter em bitola e espaçamento; conferir mínimos (Tabela 19.1), espaçamentos máximos (20.1), flecha com fluência e, sob cargas concentradas ou pilares diretos, a punção.',
    },
    graficos: [
      {
        id: 'faixas', titulo: 'Divisão da carga entre as direções',
        paraQueServe: 'Explica por que a laje quadrada é armada igual nos dois sentidos e a laje comprida quase só no menor: cada direção recebe uma parte da carga proporcional à sua rigidez. É a intuição por trás das tabelas de lajes.',
        comoLer: 'As duas faixas cruzadas no centro precisam ter a mesma flecha. Como a flecha cresce com L⁴, a faixa curta fica com a maior parte da carga. As barras mostram a porcentagem de cada direção (faixas de Marcus, só para ilustrar); a tabela de Bares embute esse efeito com mais precisão.',
      },
      {
        id: 'momentos', titulo: 'Momentos da laje',
        paraQueServe: 'São os momentos por metro de largura que dimensionam a malha positiva (Mx, My) e as negativas sobre as bordas engastadas (Mx\', My\'). Cada um vira uma área de aço por metro e, depois, uma bitola com espaçamento.',
        comoLer: 'Barras para baixo são momentos positivos (aço embaixo); para cima, negativos (aço em cima). Valores de cálculo em kN·m/m. Compare Mx com My: a razão entre eles acompanha a divisão de carga do gráfico anterior.',
      },
      {
        id: 'armadura3d', titulo: 'Malha em 3D',
        paraQueServe: 'Mostra as barras da malha nas duas direções, as negativas e a distribuição como ficam na fôrma: a direção principal por baixo (maior altura útil), a secundária por cima dela.',
        comoLer: 'Passe o mouse sobre uma barra para ver posição e bitola. A direção com mais barras é a que recebeu mais carga. Nas bordas engastadas as negativas aparecem em cima, entrando nas duas lajes vizinhas.',
      },
    ],
    erros: [
      'Classificar a laje pelos lados brutos em vez dos vãos teóricos, ou trocar lx e ly: lx é sempre o menor.',
      'Considerar engaste onde há só uma viga de borda: o engaste da laje vem da continuidade com a laje vizinha; a borda externa apoiada numa viga é apoio simples.',
      'Dispensar a armadura de distribuição na laje em uma direção: ela é obrigatória (Tabela 19.1) e é o que segura as fissuras de retração.',
    ],
    pergunta: 'Uma laje de 3 × 7 m precisa de armadura na direção de 7 m? Para quê?',
    resposta: 'Precisa. λ = 7/3 ≈ 2,3 > 2: a laje é armada em uma direção (a de 3 m), e a direção de 7 m recebe a armadura de distribuição — no mínimo 20 % da principal, 0,9 cm²/m e metade da taxa mínima. Ela não é dimensionada por um momento, mas distribui cargas concentradas (um móvel pesado, uma parede), controla as fissuras de retração e temperatura e mantém a malha na posição durante a concretagem.',
    norma: [
      'NBR 6118:2023, 13.2.4.1 — espessuras mínimas de lajes',
      'NBR 6118:2023, 14.7 — lajes: análise e reações nas vigas',
      'NBR 6118:2023, Tabela 19.1 — armaduras mínimas; 20.1 — detalhamento (espaçamentos)',
      'NBR 6118:2023, 19.5 — punção (lajes lisas e cogumelo)',
    ],
  },
  {
    id: 'pilar',
    numero: '06',
    titulo: 'Pilar: compressão, esbeltez e flambagem',
    resumo: 'Índice de esbeltez, efeitos de 2ª ordem e envoltória',
    objetivo: 'Entender por que um pilar comprido e fino é mais perigoso que um curto e grosso com a mesma carga — a flambagem e os efeitos de 2ª ordem —, como a NBR 6118 classifica o pilar pela esbeltez e como a verificação final se faz com a envoltória de momentos resistentes.',
    antes: 'Lição 01 (de onde vem a carga do pilar) e Lição 03 (equilíbrio da seção — aqui com força normal: flexão composta).',
    passos: [
      { faca: 'Deixe a seção quadrada e aumente o comprimento le.', observe: 'λ = le·√12/h cresce em linha reta com le. Até λ1 (entre 35 e 90) o pilar é "curto": só a 1ª ordem. Acima, a norma exige considerar a 2ª ordem (15.8).' },
      { faca: 'Aperte Animar.', observe: 'A carga cresce e o pilar se curva; a amplitude cresce com N/(Ncr − N) — devagar no começo, depressa perto da carga crítica de Euler. No pilar esbelto Ncr é menor e a curva "dispara" mais cedo.' },
      { faca: 'Faça by maior que bx (seção retangular).', observe: 'O pilar tem dois λ, um por direção. A direção fraca (menor lado) comanda: a régua de esbeltez usa o maior λ.' },
      { faca: 'Leia a envoltória.', observe: 'Para Nd, a seção armada resiste a qualquer par (Mx, My) dentro da curva. Os pontos x e y são as situações de cálculo de cada direção: o momento mínimo de 1ª ordem mais a 2ª ordem daquela direção. Dentro, atende; fora, falta seção ou aço.' },
      { faca: 'Aumente Nk até o pilar deixar de atender.', observe: 'A ficha mostra a armadura encontrada (entre 0,4 % e 4 % de Ac, com γn para lados menores que 19 cm) e o uso da seção. Repare que em pilares a armadura mínima costuma mandar: a seção de concreto governa, não o aço.' },
    ],
    conceitos: [
      ['Comprimento equivalente (le)', 'Distância entre os pontos de inflexão da deformada. Para o lance biarticulado, o modelo da lição, é o menor valor entre l0 + h e l (15.6): aproximadamente a altura entre os apoios.'],
      ['Índice de esbeltez (λ)', 'λ = le / i, com i = √(I/A) o raio de giração; na seção retangular i = h/√12, logo λ ≈ 3,46·le/h. Mede a "finura" do pilar: quanto maior, mais sensível à flambagem.'],
      ['λ1', 'Esbeltez-limite abaixo da qual a 2ª ordem local pode ser desprezada: λ1 = (25 + 12,5·e1/h)/αb, entre 35 e 90 (15.8.2). Depende da excentricidade de 1ª ordem e da forma do diagrama de momentos (αb).'],
      ['Efeitos de 2ª ordem', 'Momento adicional N·e2 criado pela carga agindo sobre o pilar já deformado. Acima de λ1 é obrigatório; até λ = 90 pode ser estimado pelo método do pilar-padrão com curvatura aproximada.'],
      ['Momento mínimo (M1d,mín)', 'Nd·(1,5 cm + 0,03·h): a norma impõe uma excentricidade mínima em cada direção porque nenhum pilar é perfeitamente centrado nem perfeitamente reto (11.3.3.4.3).'],
      ['Limites de λ', 'Até 90: pilar-padrão com curvatura ou rigidez aproximada; de 90 a 140: pilar-padrão acoplado a diagramas M–N–1/r, com fluência; de 140 a 200: método geral; acima de 200 não é permitido, salvo postes pouco carregados.'],
    ],
    formulas: [
      ['λ = le / i ; i = h/√12 (retangular) → λ ≈ 3,46·le/h', 'esbeltez em cada direção'],
      ['λ1 = (25 + 12,5·e1/h) / αb, com 35 ≤ λ1 ≤ 90', 'limite para dispensar a 2ª ordem local (15.8.2)'],
      ['Ncr = π²·EI / le²', 'carga crítica de Euler: referência da flambagem elástica'],
      ['e2 = (le²/10) · (1/r) ; 1/r = 0,005 / (h·(ν + 0,5)) ≤ 0,005/h', 'pilar-padrão com curvatura aproximada (15.8.3.3.2); ν = Nd/(Ac·fcd)'],
      ['M1d,mín = Nd · (1,5 cm + 0,03·h)', 'momento mínimo de 1ª ordem'],
      ['Nd = γn · 1,4 · Nk ; γn = 1,95 − 0,05·b para b < 19 cm', 'majoração adicional para pilares de menor dimensão (Tabela 13.1)'],
      ['0,4 % · Ac ≤ As ≤ 8 % · Ac (4 % fora das emendas)', 'armadura longitudinal mínima e máxima (17.3.5.3)'],
    ],
    naPratica: {
      arquitetura: 'A menor dimensão de um pilar é 19 cm — 14 cm só com a majoração γn — e a área mínima 360 cm² (Tabela 13.1). Como regra de bolso para edifícios com fck de 25 a 30 MPa, Ac ≈ 0,6 a 0,7 cm² por kN de carga de cálculo (Nd ≈ 1,4·Nk): um pilar de 20 × 50 cm leva da ordem de 1000 kN característicos, uns oito pavimentos de 12 m² de área de influência. Oriente o lado maior na direção menos travada e lembre que vigas e lajes que chegam ao pilar reduzem le — pés-direitos duplos e mezaninos de um lado só o aumentam.',
      engenharia: 'Roteiro: Nd (com γn) → le em cada direção → λ e λ1 → se λ > λ1, e2 pelo pilar-padrão → M1d,mín → Md total em cada direção → flexão composta oblíqua: achar a armadura cuja curva de interação envolve os pontos → detalhar (φ ≥ 10 mm e ≤ b/8; estribos φt ≥ 5 mm e ≥ φ/4, s ≤ 20 cm, ≤ b e ≤ 12φ para CA-50 — 18.4). O módulo de pilares do LEBR faz exatamente isso, com a curva Mx × My traçada para o Nd do pilar.',
    },
    graficos: [
      {
        id: 'esbeltez', titulo: 'Régua da esbeltez',
        paraQueServe: 'Classifica o pilar e diz qual método de cálculo a norma exige. É a primeira conta de todo pilar: ela decide se bastam os momentos de 1ª ordem ou se a 2ª ordem entra, e por qual método.',
        comoLer: 'O marcador é o λ do pilar na direção mais fraca (adimensional). A faixa até λ1 é de pilar curto, sem 2ª ordem; depois vêm as faixas até 90 (pilar-padrão), 140 (métodos acoplados a M–N–1/r) e 200 (método geral; acima disso, não permitido).',
      },
      {
        id: 'flambagem', titulo: 'Animação da flambagem',
        paraQueServe: 'Mostra o efeito de 2ª ordem: a curvatura cresce com a carga e cresce mais rápido no pilar esbelto. A carga, agindo sobre a deformada, cria um momento que não existia na geometria original.',
        comoLer: 'A curva é a forma do pilar deformado (meia senoide), muito exagerada. A amplitude cresce com N/(Ncr − N), em que Ncr = π²EI/le² é a carga crítica de Euler: quanto mais perto de Ncr, mais a deformação dispara. O texto ao lado dá Ncr e a razão Nd/Ncr.',
      },
      {
        id: 'envoltoria', titulo: 'Envoltória de momentos resistentes',
        paraQueServe: 'É a verificação final do pilar à flexão composta oblíqua: para a força normal de cálculo, a seção armada resiste a qualquer par de momentos (Mx, My) dentro da curva. Substitui o ábaco de interação dos livros, traçado aqui para a armadura encontrada.',
        comoLer: 'A curva fechada é o que a seção armada resiste (Mx × My, em kN·m) para Nd. Os pontos x e y são as situações de cálculo de cada direção, já com a 2ª ordem daquela direção. Dentro da curva, atende; fora, falta seção ou aço. O "uso" é a distância do ponto até a curva, em porcentagem da resistência.',
      },
      {
        id: 'armadura3d', titulo: 'Armadura em 3D',
        paraQueServe: 'Mostra as barras longitudinais nos cantos e faces e os estribos que as seguram contra a flambagem das próprias barras (18.4). O comprimento das longitudinais inclui a espera para emendar o lance de cima.',
        comoLer: 'Passe o mouse sobre as barras e os estribos para ver posição e bitola. Conte as barras por face e compare com a armadura da ficha; o espaçamento dos estribos obedece a s ≤ 20 cm, ≤ menor lado e ≤ 12φ.',
      },
    ],
    erros: [
      'Calcular λ só na direção do lado maior: a direção fraca (menor lado, maior λ) é a que flamba.',
      'Esquecer o momento mínimo: um pilar "só comprimido" não existe para a norma — M1d,mín é obrigatório em cada direção.',
      'Confundir le com o pé-direito: vigas e lajes que chegam ao pilar reduzem le; a ausência delas (pé-direito duplo, mezanino de um lado só) o aumenta — e e2 cresce com le².',
    ],
    pergunta: 'Por que é melhor orientar o lado maior do pilar na direção em que ele é mais comprido sem travamento?',
    resposta: 'Porque λ ≈ 3,46·le/h: na direção em que le é maior (sem vigas que travem), colocar o h maior compensa e reduz λ — e com ele e2, que cresce com le². Orientar o lado maior para a direção já travada desperdiça rigidez onde ela não é necessária e deixa o lado fino exposto justamente onde a flambagem é mais provável. Na arquitetura isso significa que a orientação do pilar na planta não é só estética: muda a armadura e, às vezes, a própria viabilidade da seção.',
    norma: [
      'NBR 6118:2023, 15.6 — comprimento equivalente; 15.8 — análise de elementos isolados (λ1 e métodos)',
      'NBR 6118:2023, 11.3.3.4.3 — momento mínimo de 1ª ordem',
      'NBR 6118:2023, 13.2.3 e Tabela 13.1 — dimensões mínimas e γn',
      'NBR 6118:2023, 17.3.5.3 — armaduras mínima e máxima; 18.4 — detalhamento de pilares',
    ],
  },
];
