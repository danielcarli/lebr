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
 * Bordas das lajes — regras comuns a todos os tipos de laje.
 *
 * Toda laje é um retângulo com quatro bordas, com os mesmos nomes da laje maciça:
 *   x0 = borda esquerda (x = 0)    x1 = borda direita (x = L ou lx)
 *   y0 = borda inferior            y1 = borda superior
 * Cada borda é 'apoiada', 'engastada' ou 'livre' (sem apoio, em balanço).
 *
 * Nas lajes armadas em uma direção (treliçada, nervurada em uma direção, alveolar,
 * entrepiso de madeira) as nervuras, vigotas ou painéis vencem o vão na direção x:
 * x0 e x1 são as extremidades e y0 e y1 são as bordas laterais, paralelas às nervuras,
 * que só podem ser apoiadas ou livres e não recebem carga no modelo em uma direção.
 */
import { analisarPlaca, areasDeInfluencia } from '../../engine/placa.js';

export const BORDAS_LAJE = [
  { id: 'y0', nome: 'Borda inferior' },
  { id: 'x1', nome: 'Borda direita' },
  { id: 'y1', nome: 'Borda superior' },
  { id: 'x0', nome: 'Borda esquerda' },
];

export const OPCOES_VINCULO = [
  { valor: 'apoiada', texto: 'Apoiada' },
  { valor: 'engastada', texto: 'Engastada' },
  { valor: 'livre', texto: 'Livre', dica: 'Borda sem apoio (em balanço)' },
];
export const OPCOES_LATERAL = [
  { valor: 'apoiada', texto: 'Apoiada' },
  { valor: 'livre', texto: 'Livre', dica: 'Borda sem apoio, paralela às nervuras' },
];

/** Próximo vínculo ao clicar numa borda da planta. */
export const PROXIMO = { apoiada: 'engastada', engastada: 'livre', livre: 'apoiada' };
export const PROXIMO_LATERAL = { apoiada: 'livre', livre: 'apoiada', engastada: 'livre' };

/** Vínculo da borda → vínculo do apoio no solver de vigas. */
export const PARA_SOLVER = { apoiada: 'apoio', engastada: 'engaste', livre: 'livre' };

export const temBordaLivre = (bordas) => Object.values(bordas).includes('livre');

/**
 * Laje em balanço: nenhum par de bordas opostas é vinculado nos dois lados
 * (ex.: varanda engastada numa borda e livre nas outras três).
 */
export const emBalanco = (bordas) => temBordaLivre(bordas)
  && !(bordas.x0 !== 'livre' && bordas.x1 !== 'livre') && !(bordas.y0 !== 'livre' && bordas.y1 !== 'livre');

/* ------------------------------------------------------------------ lajes em uma direção */

/** Vínculos antigos (até a versão 0.5) → bordas. */
const DO_VINCULO = {
  biapoiada: ['apoiada', 'apoiada'],
  'engaste-apoio': ['engastada', 'apoiada'],
  biengastada: ['engastada', 'engastada'],
  balanco: ['engastada', 'livre'],
};

/**
 * Bordas de uma laje em uma direção, aceitando o campo antigo `vinculo`.
 * Não altera o elemento.
 */
export function bordasFaixa(el) {
  if (el?.bordas && el.bordas.x0 && el.bordas.x1) {
    return { y0: 'apoiada', y1: 'apoiada', ...el.bordas };
  }
  const [x0, x1] = DO_VINCULO[el?.vinculo] ?? DO_VINCULO.biapoiada;
  return { x0, x1, y0: 'apoiada', y1: 'apoiada' };
}

/** Vínculos das duas extremidades para o solver: [x = 0, x = L]. */
export const apoiosFaixa = (bordas) => [PARA_SOLVER[bordas.x0] ?? 'apoio', PARA_SOLVER[bordas.x1] ?? 'apoio'];

/** Faixa em balanço: uma das extremidades é livre. */
export const balancoFaixa = (bordas) => bordas.x0 === 'livre' || bordas.x1 === 'livre';

/** Situação das extremidades: null se estável, ou o motivo da instabilidade. */
export function problemaFaixa(bordas, nomes = { x0: 'esquerda', x1: 'direita' }) {
  if (bordas.x0 === 'livre' && bordas.x1 === 'livre') return 'As duas extremidades estão livres: a laje não tem apoio.';
  if (bordas.x0 === 'livre' && bordas.x1 !== 'engastada') return `Para deixar a borda ${nomes.x0} livre (balanço), a borda ${nomes.x1} precisa ser engastada.`;
  if (bordas.x1 === 'livre' && bordas.x0 !== 'engastada') return `Para deixar a borda ${nomes.x1} livre (balanço), a borda ${nomes.x0} precisa ser engastada.`;
  return null;
}

export function validarFaixa(bordas, nomes) {
  const p = problemaFaixa(bordas, nomes);
  if (p) throw new Error(p);
}

/** Fator da distância entre momentos nulos (a = fator·L) para a mesa colaborante (14.6.2.2). */
export function fatorAFaixa(bordas) {
  if (balancoFaixa(bordas)) return 2;
  const eng = (bordas.x0 === 'engastada') + (bordas.x1 === 'engastada');
  return eng === 2 ? 0.6 : eng === 1 ? 0.75 : 1;
}

/** Texto curto para memoriais: "biapoiada", "balanço engastado à esquerda"… */
export function descreverFaixa(bordas, nomes = { x0: 'esquerda', x1: 'direita' }) {
  const { x0, x1 } = bordas;
  if (x1 === 'livre') return `balanço (engastada na borda ${nomes.x0}, livre na ${nomes.x1})`;
  if (x0 === 'livre') return `balanço (livre na borda ${nomes.x0}, engastada na ${nomes.x1})`;
  if (x0 === 'engastada' && x1 === 'engastada') return 'biengastada';
  if (x0 === 'engastada' || x1 === 'engastada') return 'engastada e apoiada';
  return 'biapoiada';
}

/** Avisos sobre bordas laterais livres numa laje em uma direção. */
export function avisosLaterais(bordas, elementoDeBorda, nomesLaterais = { y0: 'inferior', y1: 'superior' }) {
  const livres = ['y0', 'y1'].filter((b) => bordas[b] === 'livre');
  if (!livres.length) return [];
  const nomes = livres.map((b) => nomesLaterais[b]).join(' e ');
  return [`Borda${livres.length > 1 ? 's' : ''} lateral${livres.length > 1 ? 'is' : ''} ${nomes} livre${livres.length > 1 ? 's' : ''}: ${elementoDeBorda}`];
}

/* ------------------------------------------------------------------ lajes em duas direções (placa) */

/**
 * Reação por borda para carga unitária (kN/m por kN/m²).
 * Sem borda livre: processo das áreas (14.7.6.1). Com borda livre: reações do modelo de placa.
 */
const cacheReacoes = new Map(); // análise de placa e áreas de influência são caras e se repetem (pilares → vigas → lajes)
export function fatoresDeReacaoPlaca({ lx, ly, bordas, nu = 0.2 }) {
  const chave = JSON.stringify([lx, ly, bordas, nu]);
  if (!cacheReacoes.has(chave)) {
    let r;
    if (temBordaLivre(bordas)) {
      const pl = analisarPlaca({ lx, ly, bordas, nu });
      r = { metodo: 'placa', fator: pl.reacoes, area: null };
    } else {
      const { area, comprimento } = areasDeInfluencia({ lx, ly, bordas });
      r = { metodo: 'areas', fator: Object.fromEntries(BORDAS_LAJE.map((b) => [b.id, area[b.id] / comprimento[b.id]])), area };
    }
    cacheReacoes.set(chave, r);
    if (cacheReacoes.size > 128) cacheReacoes.delete(cacheReacoes.keys().next().value);
  }
  return structuredClone(cacheReacoes.get(chave));
}

/* ------------------------------------------------------------------ sentido das nervuras na planta */

/**
 * Laje em uma direção vista na planta. Os campos do elemento continuam os da faixa:
 * `L` = vão das vigotas/nervuras e `largura` = a outra dimensão; `direcao` diz em que
 * sentido da planta elas correm ('x', padrão, ou 'y'). As `bordas` são sempre as da planta
 * (x0 esquerda, x1 direita, y0 inferior, y1 superior).
 *
 * Retorna as dimensões em planta, as bordas da planta, as bordas no referencial da faixa
 * (x0/x1 = extremidades das vigotas, y0/y1 = laterais — o que o cálculo usa) e os nomes.
 */
export function faixaNaPlanta(el) {
  const dir = el?.direcao === 'y' ? 'y' : 'x';
  const L = el?.L ?? 1, largura = el?.largura ?? 1;
  const plano = bordasFaixa(el);
  if (dir === 'x') {
    return {
      dir, L, largura, lx: L, ly: largura, plano, local: plano,
      extremidades: ['x0', 'x1'], laterais: ['y0', 'y1'],
      nomes: { x0: 'esquerda', x1: 'direita' }, nomesLaterais: { y0: 'inferior', y1: 'superior' },
      rotulos: { x0: 'Borda esquerda (x = 0)', x1: 'Borda direita (x = L)' },
    };
  }
  return {
    dir, L, largura, lx: largura, ly: L, plano,
    local: { x0: plano.y0, x1: plano.y1, y0: plano.x0, y1: plano.x1 },
    extremidades: ['y0', 'y1'], laterais: ['x0', 'x1'],
    nomes: { x0: 'inferior', x1: 'superior' }, nomesLaterais: { y0: 'esquerda', y1: 'direita' },
    rotulos: { x0: 'Borda inferior (y = 0)', x1: 'Borda superior (y = L)' },
  };
}

/** Borda da planta que recebe cada ligação da faixa (apoio-a / apoio-b) conforme o sentido. */
export const bordaDaPlanta = (ligacao, el) => {
  const dir = el?.direcao === 'y' ? 'y' : 'x';
  const mapa = dir === 'y' ? { 'apoio-a': 'y0', 'apoio-b': 'y1' } : { 'apoio-a': 'x0', 'apoio-b': 'x1' };
  return mapa[ligacao] ?? ligacao;
};

/**
 * Laje em duas direções em balanço (engastada numa borda e livre nas opostas): a viga da borda engastada
 * recebe, além da reação, o momento do engaste como torção de equilíbrio (kN·m/m). Com carga uniforme,
 * o momento médio na borda é a reação média × metade do comprimento do balanço.
 * Altera `out` (reações por borda) acrescentando `t: {g, q}` na borda engastada.
 */
export function torcaoDoBalancoPlaca(out, bordas, lx, ly) {
  if (!emBalanco(bordas)) return out;
  for (const [id, perp] of [['x0', lx], ['x1', lx], ['y0', ly], ['y1', ly]]) {
    if (bordas[id] !== 'engastada' || !out[id]) continue;
    out[id].t = { g: (out[id].g * perp) / 2, q: (out[id].q * perp) / 2 };
  }
  return out;
}
