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
 * Desenho do detalhamento do pilar: elevação do lance (barras, traspasse com o lance de cima, arranques na peça de
 * baixo e estribos) e seção transversal com estribo e grampos suplementares.
 */
const fmt = (v, c = 0) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');
const phiTxt = (phi) => String(phi).replace('.', ',');

export function criarDesenhoPilar({ s }) {
  function detalhe(el, det, posicoes, { destaque = null } = {}) {
    const long = posicoes.find((q) => q.tipo === 'longitudinal');
    const arr = posicoes.find((q) => q.tipo === 'arranque');
    const est = posicoes.find((q) => q.tipo === 'estribo');
    const gramp = posicoes.filter((q) => q.tipo === 'suplementar');
    const L = (el.comprimento ?? 3) * 100;
    const emb = arr ? -arr.z0 * 100 : 0;
    const topo = Math.max(L, long ? long.z1 * 100 : L);
    const total = emb + topo + 30;
    const H = 440, y0 = 26, esc = (H - y0 - 40) / total;
    const Y = (z) => y0 + (topo + 15 - z) * esc;       // z em cm, a partir da base do lance
    const xP = 90, wP = 64;                             // pilar desenhado com largura fixa
    const filhos = [];
    const cls = (q, base) => `${base}${destaque === q?.id ? ' destaque' : ''}`;
    filhos.push(s('text', { x: 0, y: 12, class: 'dg-titulo' }, `ELEVAÇÃO DO LANCE — ${el.codigo ?? ''} (${fmt(el.bx)} × ${fmt(el.by)} cm)`));
    // peça de baixo (fundação ou viga) e pisos
    if (arr) {
      const wB = det.base?.tipo === 'fundacao' ? 200 : 140;
      filhos.push(s('rect', { x: xP + wP / 2 - wB / 2, y: Y(0), width: wB, height: emb * esc + 4, class: 'det-apoio' }));
      filhos.push(s('text', { x: xP + wP / 2 + wB / 2 + 6, y: Y(-emb / 2) + 4, class: 'dg-rot' }, det.base?.codigo ?? (det.base?.tipo === 'fundacao' ? 'Fundação' : 'Viga')));
    }
    const laje = 12;
    for (const z of [0, L]) filhos.push(s('rect', { x: xP - 46, y: Y(z), width: wP + 92, height: laje * esc, class: 'det-laje' }));
    filhos.push(s('rect', { x: xP, y: Y(L), width: wP, height: L * esc, class: 'det-viga' }));
    if (det.acima) filhos.push(s('rect', { x: xP, y: Y(topo + 12), width: wP, height: (topo + 12 - L) * esc, class: 'det-viga acima' }));
    filhos.push(
      s('text', { x: xP - 52, y: Y(0) + 4, class: 'dg-rot', 'text-anchor': 'end' }, 'base'),
      s('text', { x: xP - 52, y: Y(L) + 4, class: 'dg-rot', 'text-anchor': 'end' }, `+${fmt(L / 100, 2)} m`),
    );
    // estribos
    if (est?.s) {
      for (let z = 5; z <= L - 2; z += est.s) filhos.push(s('line', { x1: xP + 4, y1: Y(z), x2: xP + wP - 4, y2: Y(z), class: cls(est, 'det-estribo') }));
    }
    // barras
    const barra = (q, x, z0, z1, pe, rot) => {
      const d = `M${x + (pe ? 22 : 0)},${Y(z0)} ${pe ? `L${x},${Y(z0)} ` : ''}L${x},${Y(z1)}`;
      return s('g', { class: `det-pos${q.editada ? ' editada' : ''}`, 'data-pos': q.id },
        s('path', { d, class: cls(q, `det-barra${q.tipo === 'arranque' ? ' negativa' : ''}`) }),
        s('text', { x: xP + wP + 18, y: rot, class: 'det-rot' }, `${q.N} · ${q.n} ø${phiTxt(q.phi)} · C = ${fmt(q.comprimento)}`));
    };
    if (long) filhos.push(barra(long, xP + 10, 0, long.z1 * 100, false, Y(L * 0.62)));
    if (arr) filhos.push(barra(arr, xP + 18, arr.z0 * 100, arr.z1 * 100, true, Y(-emb * 0.35)));
    // cota do traspasse
    if (det.l0c && (det.acima || arr)) {
      const zc = det.acima ? L : 0;
      const xc = xP + wP + 8;
      filhos.push(
        s('line', { x1: xc, y1: Y(zc), x2: xc, y2: Y(zc + det.l0c), class: 'dg-cota' }),
        s('text', { x: xc + 6, y: Y(zc + det.l0c / 2) + 4, class: 'dg-texto det-cota-txt' }, `l0c = ${fmt(det.l0c)} cm`),
      );
    }
    if (est) filhos.push(s('g', { class: 'det-pos', 'data-pos': est.id }, s('text', { x: xP + wP + 18, y: Y(L * 0.3), class: 'det-rot-estribo' }, `${est.N} · ${est.n} ø${phiTxt(est.phi)} c/ ${fmt(est.s)}`)));

    // seção transversal
    const arm = el.resultado?.armadura;
    const sx = 400, sy = 60, caixa = 220;
    const e2 = Math.min(caixa / el.bx, caixa / el.by);
    const w = el.bx * e2, hh = el.by * e2;
    const cob = arm?.cobrimento ?? 3;
    filhos.push(s('text', { x: sx, y: 12 + 0, class: 'dg-titulo' }, 'SEÇÃO'));
    filhos.push(s('rect', { x: sx, y: sy, width: w, height: hh, class: 'sec-concreto' }));
    if (est) filhos.push(s('g', { class: 'det-pos', 'data-pos': est.id }, s('rect', { x: sx + cob * e2, y: sy + cob * e2, width: w - 2 * cob * e2, height: hh - 2 * cob * e2, rx: 4, class: cls(est, 'sec-estribo') })));
    for (const g of gramp) {
      const gr = g.grampo;
      const P = (x, y) => [sx + x * e2, sy + (el.by - y) * e2];
      const [a, b] = gr.eixo === 'y' ? [P(gr.em, gr.de), P(gr.em, gr.ate)] : [P(gr.de, gr.em), P(gr.ate, gr.em)];
      filhos.push(s('g', { class: 'det-pos', 'data-pos': g.id },
        s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: cls(g, 'det-barra porta') }),
        s('text', { x: (a[0] + b[0]) / 2 + 6, y: (a[1] + b[1]) / 2 - 4, class: 'det-rot-estribo' }, g.N)));
    }
    if (arm?.pontos) {
      const r = Math.max(3, (arm.phi / 20) * e2);
      for (const p of arm.pontos) filhos.push(s('circle', { cx: sx + p.x * e2, cy: sy + (el.by - p.y) * e2, r, class: 'sec-barra' }));
    }
    filhos.push(
      s('text', { x: sx + w / 2, y: sy + hh + 20, 'text-anchor': 'middle', class: 'dg-texto' }, `bx = ${fmt(el.bx)} cm`),
      s('text', { x: sx - 12, y: sy + hh / 2, 'text-anchor': 'middle', class: 'dg-texto', transform: `rotate(-90 ${sx - 12} ${sy + hh / 2})` }, `by = ${fmt(el.by)} cm`),
    );
    if (long) filhos.push(s('text', { x: sx, y: sy + hh + 44, class: 'det-rot' }, `${long.N} · ${long.n} ø${phiTxt(long.phi)}${est ? `   ${est.N} · ø${phiTxt(est.phi)} c/ ${fmt(est.s)} (${est.forma})` : ''}`));
    const W = Math.max(sx + w + 40, 640);
    return s('svg', { class: 'desenho detalhe-pilar', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMinYMin meet' }, ...filhos);
  }
  return { detalhe };
}
