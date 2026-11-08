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
 * Texto das lições do módulo Aprender: objetivo, passos, conceitos e, para cada gráfico, para que ele serve e como
 * se lê. A parte interativa (controles, animações e 3D) está em aprender.js.
 */

export const LICOES = [
  {
    id: 'caminho',
    numero: '01',
    titulo: 'O caminho das cargas',
    resumo: 'Da laje ao solo: quem apoia em quem',
    objetivo: 'Entender que toda carga percorre um caminho até o solo e que cada elemento existe para recebê-la de um lado e entregá-la ao próximo.',
    passos: [
      'A laje recebe as cargas da superfície: peso próprio, contrapiso, revestimento, pessoas e móveis (NBR 6120).',
      'A laje se apoia nas vigas do contorno e entrega a elas a sua reação, em kN por metro de viga.',
      'As vigas vencem o vão entre os pilares e entregam a eles as reações dos apoios, em kN.',
      'Os pilares descem a carga de todos os pavimentos acima até a fundação. Por isso o pilar do térreo é o mais carregado.',
      'A fundação (sapata, bloco sobre estacas) espalha a carga no solo, numa tensão que o solo suporta.',
    ],
    conceitos: [
      ['Carga permanente (g)', 'Age sempre: peso próprio, paredes, revestimentos.'],
      ['Carga acidental (q)', 'Pode ou não estar presente: pessoas, móveis, veículos.'],
      ['Reação de apoio', 'A força que um elemento faz sobre o que o apoia. É a carga do próximo elemento do caminho.'],
    ],
    graficos: [
      {
        id: 'caminho', titulo: 'Animação do caminho das cargas',
        paraQueServe: 'Mostra a ordem em que a carga passa de um elemento para o outro. É a mesma ordem do cálculo: primeiro as lajes, depois as vigas, os pilares e por fim a fundação.',
        comoLer: 'As setas tracejadas andam no sentido da carga. O elemento aceso é o que está recebendo a carga naquele instante, e a frase embaixo do desenho dá a conta daquela etapa num exemplo de dois pavimentos.',
      },
    ],
    pergunta: 'Se a laje do último pavimento for retirada, quais elementos deixam de receber carga e quais continuam carregados?',
  },
  {
    id: 'esforcos',
    numero: '02',
    titulo: 'Esforços na viga: cortante e momento fletor',
    resumo: 'DEC, DMF e deformada de uma viga',
    objetivo: 'Ver como a carga distribuída gera esforço cortante e momento fletor ao longo da viga, e como os vínculos (apoio, engaste, balanço) mudam esses diagramas.',
    passos: [
      'Escolha o tipo de viga e ajuste o vão e a carga. Os diagramas são refeitos na hora.',
      'Aperte Animar para ver a carga entrar aos poucos e os diagramas crescerem junto com ela.',
      'Passe o mouse sobre a viga: a linha vertical mostra V e M naquela seção.',
      'Compare a biapoiada (M máximo = qL²/8 no meio) com a biengastada (−qL²/12 nos engastes e qL²/24 no meio) e com o balanço (−qL²/2 no engaste).',
    ],
    conceitos: [
      ['Esforço cortante (V)', 'A força que tende a deslizar uma parte da viga em relação à outra. É máximo junto aos apoios.'],
      ['Momento fletor (M)', 'O esforço que curva a viga. Traciona a face de baixo no vão (momento positivo) e a de cima nos engastes (negativo).'],
      ['dM/dx = V', 'Onde o cortante passa por zero, o momento é máximo. É por isso que o pico do DMF da biapoiada fica no meio do vão.'],
    ],
    graficos: [
      {
        id: 'carregamento', titulo: 'Esquema estático',
        paraQueServe: 'Mostra o modelo que será calculado: o vão, os vínculos e a carga. Errar aqui é errar todo o resto.',
        comoLer: 'Triângulo é apoio (deixa girar), hachura é engaste (não deixa girar), ponta sem nada é borda livre. As setas são a carga em kN/m e os números embaixo são as reações.',
      },
      {
        id: 'dec', titulo: 'Diagrama de esforço cortante (DEC)',
        paraQueServe: 'Dimensiona os estribos e verifica a biela comprimida de concreto (NBR 6118, 17.4). Onde o cortante é maior, os estribos ficam mais próximos.',
        comoLer: 'Acima do eixo, cortante positivo; abaixo, negativo. A inclinação da reta é a própria carga q. O valor máximo aparece junto aos apoios.',
      },
      {
        id: 'dmf', titulo: 'Diagrama de momento fletor (DMF)',
        paraQueServe: 'Dimensiona a armadura longitudinal: onde o momento é positivo, barras embaixo; onde é negativo, barras em cima. O tamanho do momento define a quantidade de aço.',
        comoLer: 'No Brasil o DMF é desenhado do lado tracionado: positivo para baixo, negativo para cima. Assim o desenho já mostra em que face vai a armadura.',
      },
      {
        id: 'deformada', titulo: 'Deformada (linha elástica)',
        paraQueServe: 'Verifica a flecha no estado-limite de serviço (NBR 6118, 13.3): a viga pode resistir e mesmo assim deformar tanto que trinca paredes e pisos.',
        comoLer: 'A curva mostra a viga deformada, muito exagerada. O número é a flecha elástica máxima; a norma limita a flecha total (com fluência) a L/250.',
      },
    ],
    pergunta: 'Por que, na viga biengastada, o momento no meio do vão é três vezes menor que na biapoiada?',
  },
  {
    id: 'flexao',
    numero: '03',
    titulo: 'Flexão na seção: deformações, tensões e domínios',
    resumo: 'Linha neutra, bloco de compressão e aço',
    objetivo: 'Entender o que acontece dentro da seção de concreto armado quando o momento aumenta: o concreto comprime em cima, o aço traciona embaixo e a linha neutra desce.',
    passos: [
      'Ajuste a seção (b, h e fck) e aperte Animar: o momento cresce de zero até o valor escolhido.',
      'Observe a linha neutra (x) descer e a seção passar pelos domínios 2, 3 e, se o momento for grande demais, 4.',
      'Note que a força no concreto (Rc) é sempre igual à força no aço (Rs): a seção está em equilíbrio, e Md = Rc · z.',
      'Passe de x/d = 0,45 e a seção deixa de ser dúctil: a norma (14.6.4.3) pede outra seção ou armadura dupla.',
    ],
    conceitos: [
      ['Linha neutra (x)', 'A altura, medida do topo, onde a deformação é zero. Acima dela o concreto comprime; abaixo, o concreto trinca e só o aço trabalha.'],
      ['Domínio 2', 'O aço chega a 10 ‰ antes de o concreto esmagar. Seção com pouco aço, muito dúctil.'],
      ['Domínio 3', 'O concreto chega a 3,5 ‰ com o aço já escoando. É a ruptura desejada: avisa antes de romper.'],
      ['Domínio 4', 'O concreto esmaga antes de o aço escoar: ruptura frágil, sem aviso. Deve ser evitado.'],
    ],
    graficos: [
      {
        id: 'deformacoes', titulo: 'Diagrama de deformações',
        paraQueServe: 'Mostra quanto cada fibra da seção encurta ou alonga. Pela hipótese das seções planas, é uma reta. É ele que define o domínio e se o aço escoa.',
        comoLer: 'À esquerda, encurtamento (concreto, até 3,5 ‰); à direita, alongamento (aço, até 10 ‰). Onde a reta cruza o eixo está a linha neutra.',
      },
      {
        id: 'tensoes', titulo: 'Diagrama de tensões e forças',
        paraQueServe: 'Transforma as deformações em forças: o bloco de compressão do concreto (Rc) e a força no aço (Rs). O braço de alavanca z entre elas dá o momento resistente.',
        comoLer: 'O retângulo de altura 0,8·x e tensão 0,85·fcd é a simplificação da norma (17.2.2) para o diagrama parábola-retângulo. As setas mostram Rc e Rs, de mesmo valor e sentidos opostos.',
      },
      {
        id: 'dominios', titulo: 'Régua dos domínios (x/d)',
        paraQueServe: 'Diz em que domínio a seção está e se ela é dúctil. É o que se confere depois de achar a linha neutra.',
        comoLer: 'O marcador anda conforme o momento cresce. Verde até 0,45 (dúctil), amarelo até o limite dos domínios 3 e 4, vermelho no domínio 4.',
      },
    ],
    pergunta: 'Se dobrarmos a altura da viga, o que acontece com x/d e com a área de aço para o mesmo momento?',
  },
  {
    id: 'viga',
    numero: '04',
    titulo: 'Da conta à armadura: a viga completa',
    resumo: 'Cálculo do módulo de vigas, lista de ferros e 3D',
    objetivo: 'Ligar os diagramas à armação: ver como o módulo de vigas do LEBR transforma momento e cortante em barras, estribos, ancoragens e na lista de ferros.',
    passos: [
      'Ajuste vão, cargas e seção. A viga é calculada pelo mesmo módulo da página de edição (combinações, peso próprio, ELU e ELS).',
      'A envoltória mostra os esforços de cálculo (com γf = 1,4) que o módulo usou.',
      'Na armadura em 3D, passe o mouse sobre cada barra para ver a posição (N1, N2…) e a bitola. Gire com o mouse.',
      'Aumente a carga até a viga deixar de atender e veja qual verificação falha.',
    ],
    conceitos: [
      ['Armadura positiva', 'Barras na face de baixo, para o momento do vão.'],
      ['Armadura negativa', 'Barras em cima, sobre os engastes e apoios intermediários.'],
      ['Porta-estribos', 'Barras finas em cima, só para segurar os estribos na montagem.'],
      ['Estribos', 'Resistem ao cortante e amarram a armadura. O espaçamento sai do DEC.'],
      ['Ancoragem', 'Comprimento que a barra precisa entrar no apoio para transferir a força ao concreto (9.4).'],
    ],
    graficos: [
      {
        id: 'envoltoria', titulo: 'Envoltória de esforços de cálculo',
        paraQueServe: 'É o diagrama que o dimensionamento usa de verdade: o maior e o menor valor de cada esforço entre todas as combinações de carga, já majorados.',
        comoLer: 'Em cima, Md (positivo para baixo, como no DMF); embaixo, Vd. As duas linhas de cada gráfico são o máximo e o mínimo das combinações.',
      },
      {
        id: 'armadura3d', titulo: 'Armadura em 3D',
        paraQueServe: 'Mostra a armação como ela será montada na obra: onde cada barra começa e termina, as dobras, os ganchos e o espaçamento dos estribos.',
        comoLer: 'Cada cor é um tipo de barra (legenda acima do desenho). O concreto aparece transparente; o botão Concreto o esconde. Arrastar gira, a roda aproxima.',
      },
      {
        id: 'lista', titulo: 'Lista de ferros',
        paraQueServe: 'É o que vai para a armação e para o orçamento: quantidade, bitola e comprimento de cada posição, e a massa de aço.',
        comoLer: 'Cada linha é uma posição (N1, N2…). C é o comprimento de corte da barra, em cm; a massa usa a massa linear da bitola (NBR 7480).',
      },
    ],
    pergunta: 'Por que os estribos ficam mais juntos perto dos apoios em algumas vigas?',
  },
  {
    id: 'laje',
    numero: '05',
    titulo: 'Laje maciça: uma ou duas direções',
    resumo: 'Divisão de carga, momentos e malha',
    objetivo: 'Ver como a proporção entre os vãos define se a laje trabalha numa direção ou nas duas, e como isso aparece na armadura.',
    passos: [
      'Mude lx e ly. Quando o lado maior passa do dobro do menor (λ > 2), a laje passa a ser armada em uma direção.',
      'A animação das faixas mostra quanto da carga vai para cada direção: a direção mais curta, mais rígida, leva a maior parte.',
      'Os momentos e a malha vêm do módulo de lajes maciças (tabelas de Bares).',
      'No 3D, veja a malha positiva e, nas lajes em uma direção, a armadura de distribuição.',
    ],
    conceitos: [
      ['lx e ly', 'Os vãos da laje; lx é o menor.'],
      ['λ = ly / lx', 'Até 2, a laje trabalha nas duas direções; acima de 2, praticamente só na menor.'],
      ['Armadura de distribuição', 'Na laje em uma direção, barras na direção longa que espalham as cargas concentradas e controlam fissuras (20.1).'],
    ],
    graficos: [
      {
        id: 'faixas', titulo: 'Divisão da carga entre as direções',
        paraQueServe: 'Explica por que a laje quadrada é armada igual nos dois sentidos e a laje comprida quase só no menor: cada direção recebe uma parte da carga proporcional à sua rigidez.',
        comoLer: 'As faixas cruzadas no centro precisam ter a mesma flecha. Como a flecha cresce com L⁴, a faixa curta fica com mais carga. As barras mostram a porcentagem de cada direção (faixas de Marcus, só para ilustrar).',
      },
      {
        id: 'momentos', titulo: 'Momentos da laje',
        paraQueServe: 'São os momentos por metro de largura que dimensionam a malha positiva (Mx, My) e as negativas sobre as bordas engastadas (Mx\', My\').',
        comoLer: 'Barras para baixo são momentos positivos (aço embaixo); para cima, negativos (aço em cima). Valores em kN·m/m, de cálculo.',
      },
      {
        id: 'armadura3d', titulo: 'Malha em 3D',
        paraQueServe: 'Mostra as barras da malha nas duas direções, as negativas e a distribuição como ficam na fôrma.',
        comoLer: 'Passe o mouse sobre uma barra para ver a posição e a bitola. A direção com mais barras é a que recebeu mais carga.',
      },
    ],
    pergunta: 'Uma laje de 3 × 7 m precisa de armadura na direção de 7 m? Para quê?',
  },
  {
    id: 'pilar',
    numero: '06',
    titulo: 'Pilar: compressão, esbeltez e flambagem',
    resumo: 'Índice de esbeltez, efeitos de 2ª ordem e envoltória',
    objetivo: 'Entender por que um pilar comprido e fino é mais perigoso que um curto e grosso com a mesma carga, e como a norma trata isso.',
    passos: [
      'Mude a altura do pilar e as dimensões da seção. O índice de esbeltez λ = le·√12/h é recalculado.',
      'Aperte Animar: a carga cresce e o pilar se curva. Quanto mais esbelto, mais cedo e mais ele se curva.',
      'Se λ passar de λ1, a norma (15.8) pede os efeitos de 2ª ordem: o momento extra que a própria curvatura cria.',
      'A envoltória mostra se o ponto (Mdx, Mdy) do pilar está dentro da curva que a seção resiste.',
    ],
    conceitos: [
      ['Comprimento de flambagem (le)', 'Para o pilar biarticulado, é a distância entre os apoios.'],
      ['Índice de esbeltez (λ)', 'λ = le/i, com i = h/√12 na seção retangular. Quanto maior, mais esbelto.'],
      ['Efeitos de 2ª ordem', 'A carga, agindo sobre o pilar já curvado, cria um momento a mais (N · e2). Acima de λ1 ele precisa ser somado.'],
      ['Limites', 'λ ≤ 90: pilar-padrão com curvatura aproximada; 90 a 140: métodos mais rigorosos; acima de 200: não permitido.'],
    ],
    graficos: [
      {
        id: 'esbeltez', titulo: 'Régua da esbeltez',
        paraQueServe: 'Classifica o pilar e diz qual método de cálculo a norma exige. É a primeira conta de todo pilar.',
        comoLer: 'O marcador é o λ do pilar na direção mais fraca. A faixa até λ1 é de pilar curto (sem 2ª ordem); depois vêm as faixas de 90, 140 e 200.',
      },
      {
        id: 'flambagem', titulo: 'Animação da flambagem',
        paraQueServe: 'Mostra o efeito de 2ª ordem: a curvatura cresce com a carga e cresce mais rápido no pilar esbelto.',
        comoLer: 'A curva é a forma do pilar deformado (meia senoide), muito exagerada. A amplitude cresce com N/(Ncr − N), onde Ncr é a carga crítica de Euler.',
      },
      {
        id: 'envoltoria', titulo: 'Envoltória de momentos resistentes',
        paraQueServe: 'É a verificação final do pilar à flexão composta oblíqua: para a força normal de cálculo, a seção resiste a qualquer par de momentos dentro da curva.',
        comoLer: 'A curva fechada é o que a seção armada resiste (Mx × My) para a força normal de cálculo. Os pontos x e y são as situações de cálculo de cada direção, com a 2ª ordem daquela direção. Dentro da curva, atende; fora, falta seção ou aço. O uso é a distância do ponto até a curva, em porcentagem.',
      },
      {
        id: 'armadura3d', titulo: 'Armadura em 3D',
        paraQueServe: 'Mostra as barras longitudinais nos cantos e faces e os estribos que as seguram contra a flambagem das próprias barras (18.4).',
        comoLer: 'Passe o mouse sobre as barras e os estribos para ver posição e bitola.',
      },
    ],
    pergunta: 'Por que é melhor orientar o lado maior do pilar na direção em que ele é mais comprido sem travamento?',
  },
];
