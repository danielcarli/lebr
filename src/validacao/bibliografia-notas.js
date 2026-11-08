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
 * Exercícios resolvidos publicados (validacao/casos/2x-bibliografia-*.json): as divergências de hipótese que a
 * comparação revelou e os exercícios que ficaram de fora do banco. Mesmo conteúdo de docs/VALIDACAO-BIBLIOGRAFIA.md.
 */

/** Arquivos de casos que vêm da bibliografia. */
export const ehArquivoBibliografia = (nome) => /bibliografia/.test(nome ?? '');

/** situacao: 'revisar' — precisa da revisão de engenheiros; 'hipotese' — escolha diferente, já explicada. */
export const DIVERGENCIAS = [
  {
    tema: 'Punção — τRd1 com k ≤ 2', situacao: 'revisar',
    fontes: 'Camacho (UNESP, 2004); Assunção (UFMG, 2022)',
    texto: 'O LEBR limita k = 1 + √(20/d) a 2; as fontes não limitam. Em lajes com d < 20 cm o τRd1 do LEBR fica 10 a 13 % menor (a favor da segurança). Os casos comparam perímetros, τSd e τRd2, mas não τRd1, até a regra ser conferida no texto da NBR 6118:2023.',
  },
  {
    tema: 'Blocos — KR da tensão-limite nas bielas', situacao: 'hipotese',
    fontes: 'Bastos (UNESP, 2023); Almeida (UFC, 2013)',
    texto: 'O LEBR usa KR = 0,9; Bastos usa 0,95 e o TCC da UFC, 0,85. A tensão-limite não é comparada; ângulo, tensões nas bielas e tirantes não dependem de KR.',
  },
  {
    tema: 'Torção — área Ae da seção vazada', situacao: 'hipotese',
    fontes: 'Bastos, Torção em vigas (UNESP, 2023)',
    texto: 'Bastos calcula Ae e ue pela linha dos eixos das barras de canto; o LEBR, pela linha média da parede (17.5.1.4.1). Só he é comparado; o TRd2 do LEBR sai cerca de 7 % maior.',
  },
  {
    tema: 'Lajes — reações pelo processo das áreas', situacao: 'hipotese',
    fontes: 'Bastos, Lajes de concreto (UNESP, 2015)',
    texto: 'Nas bordas apoiadas vizinhas de bordas engastadas, os coeficientes das tabelas (por exemplo νy = 2,17 no tipo 3) somam mais de 100 % da carga; o LEBR distribui toda a carga pelas retas a 45° e 60° e dá 1,83. Só as bordas engastadas são comparadas.',
  },
  {
    tema: 'Lajes — momentos positivos das tabelas de Bares', situacao: 'hipotese',
    fontes: 'Bastos (2015); Faria (UTFPR, 2019); Rodrigues (UFC, 2020)',
    texto: 'As tabelas usadas nas apostilas correspondem a um coeficiente de Poisson menor que o 0,2 do LEBR; os positivos do LEBR saem até 15 % maiores (a favor da segurança). Comparam-se os negativos, que não dependem de ν, e as lajes apoiadas nas quatro bordas.',
  },
  {
    tema: 'Vigas — abertura de fissuras', situacao: 'hipotese',
    fontes: 'Pinheiro e Muzardo, ELS (EESC-USP, 2004)',
    texto: 'O LEBR monta a região de envolvimento de cada barra (até 7,5ø, limitada pelas vizinhas); a fonte usa Acr = 87,62 cm² por barra. Na mesma viga, wk = 0,16 mm no LEBR e 0,19 mm na fonte. Só σs é comparado.',
  },
  {
    tema: 'Bloco sobre 2 estacas — acréscimo de 15 % no tirante', situacao: 'hipotese',
    fontes: 'Bastos (2023); Almeida (UFC, 2013)',
    texto: 'As fontes aumentam o tirante em 15 % (Blévot). O motor devolve a força sem o acréscimo, que o módulo do bloco aplica na armadura; os casos comparam a força sem ele. Não há divergência no resultado final.',
  },
];

export const EXCLUIDOS = [
  { fonte: 'Bastos, Lajes de concreto (2015) — laje L7, tipo 5A', motivo: 'μ\'x = 8,81 na fonte e 7,78 no LEBR; as outras lajes 5A do mesmo exemplo e da tabela conferem, o que sugere erro de leitura ou de digitação.' },
  { fonte: 'Bastos, Lajes de concreto (2015) — laje L3, flecha', motivo: 'α = 2,96 na fonte contra 3,13 no LEBR para λ = 1,12 (a L2 do mesmo exemplo confere).' },
  { fonte: 'Faria (UTFPR, 2019) — armadura negativa', motivo: 'As = 8,67 cm²/m contra 9,16 no LEBR para m\'x,d = 24,64 kN·m/m e d = 7,5 cm; a altura útil usada pela fonte não está clara.' },
  { fonte: 'Santos (UFPB, 2024) — vigas V21, pilar P16 e pilarete', motivo: 'Os k e kc publicados não saem da fórmula da NBR 7190-1:2022 com os λrel e o βc publicados.' },
  { fonte: 'Valle et al., apostila da UFSC (2012) — madeira', motivo: 'Segue a NBR 7190:1997 (excentricidades e Ec0,ef), que o LEBR não implementa.' },
  { fonte: 'Lima, Guarda e Pinheiro (EESC-USP, 2003) — torção', motivo: 'A fonte adota he = 8 cm por escolha; o LEBR usa he = A/u.' },
  { fonte: 'UFPR (2019), Araujo (UFC, 2019), Souza Neto (UNESP, 2022) — atrito lateral de estacas', motivo: 'Os critérios de Nl (limite N ≥ 3, exclusão dos ensaios da ponta, N médio por camada) diferem entre as fontes e o LEBR; só a ponta foi comparada. Os exemplos com CPT e com estaca raiz não têm equivalente no LEBR.' },
];

export const SEM_EXERCICIOS = 'Não foram encontrados exercícios resolvidos com números para combinações de ações, parâmetro α e desaprumo θ1.';
