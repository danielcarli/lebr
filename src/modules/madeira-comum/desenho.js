/*
 * LEBR — Laboratório de Estruturas Brasil
 * Copyright (C) 2026 Daniel Michelon De Carli
 *
 * Feito com uso da inteligência artificial Claude Opus 5.5, sob a orientação de Daniel Michelon De Carli.
 *
 * Este programa é software livre: você pode redistribuí-lo e/ou modificá-lo nos termos da GNU General Public
 * License, versão 3, publicada pela Free Software Foundation. É distribuído na esperança de ser útil, mas SEM
 * NENHUMA GARANTIA, nem mesmo a garantia implícita de COMERCIALIZAÇÃO ou de ADEQUAÇÃO A UMA FINALIDADE
 * ESPECÍFICA. Veja o arquivo LICENSE ou <https://www.gnu.org/licenses/gpl-3.0.html>.
 *
 * SPDX-License-Identifier: GPL-3.0-only
 */
/**
 * Desenhos dos elementos de madeira: seção retangular com anéis de crescimento
 * e corte do entrepiso (vigotas + painel).
 */

const fmt = (v, c = 0) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');

export function criarDesenhosMadeira({ s }) {
  /** Seção b × h com veios; eixos x (horizontal) e y. */
  function secao({ b, h, titulo, travadoY = false }) {
    const caixa = 190, m = 34;
    const esc = Math.min((caixa - 2 * m) / b, (caixa - 2 * m) / h, 9);
    const w = b * esc, hh = h * esc;
    const W = w + 2 * m + 130, H = Math.max(hh + 2 * m, 150);
    const x0 = m + 10, y0 = (H - hh) / 2;
    const filhos = [s('rect', { x: x0, y: y0, width: w, height: hh, rx: 2, class: 'mad-secao' })];
    // anéis de crescimento (arcos concêntricos a partir de um canto fora da peça)
    const cx = x0 + w * 0.15, cy = y0 + hh * 1.25;
    for (let r = hh * 0.35; r < hh * 1.6; r += Math.max(5, hh / 9)) {
      filhos.push(s('path', { d: `M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}`, class: 'mad-veio', 'clip-path': 'url(#mad-clip)' }));
    }
    filhos.unshift(s('defs', null, s('clipPath', { id: 'mad-clip' }, s('rect', { x: x0, y: y0, width: w, height: hh }))));
    filhos.push(s('rect', { x: x0, y: y0, width: w, height: hh, rx: 2, class: 'mad-borda' }));
    if (travadoY) filhos.push(s('rect', { x: x0 - 6, y: y0, width: 4, height: hh, class: 'mad-painel' }), s('rect', { x: x0 + w + 2, y: y0, width: 4, height: hh, class: 'mad-painel' }));
    filhos.push(
      s('text', { x: x0 + w / 2, y: y0 + hh + 18, 'text-anchor': 'middle', class: 'dg-texto' }, `b = ${fmt(b, 1)} cm`),
      s('text', { x: x0 + w + 14, y: y0 + hh / 2 + 4, class: 'dg-texto' }, `h = ${fmt(h, 1)} cm`),
      s('line', { x1: x0 - 14, y1: y0 + hh / 2, x2: x0 + w + 8, y2: y0 + hh / 2, class: 'mad-eixo' }),
      s('text', { x: x0 - 22, y: y0 + hh / 2 + 4, class: 'pl-eixo-rot' }, 'x'),
    );
    if (titulo) filhos.push(s('text', { x: x0, y: 14, class: 'dg-titulo' }, titulo));
    return s('svg', { class: 'desenho secao-madeira', viewBox: `0 0 ${W} ${H}`, width: W, height: H }, ...filhos);
  }

  /** Corte transversal do entrepiso: painel contínuo sobre vigotas espaçadas. */
  function corteEntrepiso({ b, h, s: esp, painel }) {
    const n = 4, W = 720, m = 30;
    const esc = (W - 2 * m - 100) / (n * esp);
    const tp = Math.max(3, (painel / 10) * esc), hh = h * esc, wb = b * esc;
    const y0 = 26, H = y0 + tp + hh + 54;
    const filhos = [s('rect', { x: m, y: y0, width: n * esp * esc, height: tp, class: 'mad-painel' })];
    for (let i = 0; i < n; i++) {
      const cx = m + (i + 0.5) * esp * esc;
      filhos.push(s('rect', { x: cx - wb / 2, y: y0 + tp, width: wb, height: hh, class: 'mad-secao' }));
      for (let k = 1; k < 4; k++) filhos.push(s('line', { x1: cx - wb / 2 + 2, y1: y0 + tp + (k * hh) / 4, x2: cx + wb / 2 - 2, y2: y0 + tp + (k * hh) / 4 + 3, class: 'mad-veio' }));
      filhos.push(s('rect', { x: cx - wb / 2, y: y0 + tp, width: wb, height: hh, class: 'mad-borda' }));
    }
    const c1 = m + 0.5 * esp * esc, c2 = m + 1.5 * esp * esc, yc = y0 + tp + hh + 26;
    filhos.push(
      s('line', { x1: c1, y1: yc, x2: c2, y2: yc, class: 'dg-cota' }),
      s('line', { x1: c1, y1: yc - 4, x2: c1, y2: yc + 4, class: 'dg-cota' }), s('line', { x1: c2, y1: yc - 4, x2: c2, y2: yc + 4, class: 'dg-cota' }),
      s('text', { x: (c1 + c2) / 2, y: yc - 6, 'text-anchor': 'middle', class: 'dg-texto' }, `espaçamento ${fmt(esp)} cm`),
      s('text', { x: m + n * esp * esc + 12, y: y0 + tp / 2 + 4, class: 'dg-texto' }, `painel ${fmt(painel, 1)} mm`),
      s('text', { x: m + n * esp * esc + 12, y: y0 + tp + hh / 2 + 4, class: 'dg-texto' }, `vigota ${fmt(b, 1)} × ${fmt(h, 1)}`),
    );
    return s('svg', { class: 'desenho corte-laje', viewBox: `0 0 ${W} ${H}` }, ...filhos);
  }

  return { secao, corteEntrepiso };
}
