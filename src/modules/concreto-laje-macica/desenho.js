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
 * Planta de armação da laje maciça: positivas nas duas direções (uma barra representativa e a faixa de
 * distribuição), negativas atravessando as bordas engastadas (com dobras) e as barras de distribuição.
 */
const fmt = (v, c = 0) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');
const phiTxt = (phi) => String(phi).replace('.', ',');

export function criarDesenhoLaje({ s }) {
  function planta(el, det, posicoes, { destaque = null } = {}) {
    const lx = el.lx, ly = el.ly;
    const ap = det.apoios ?? {};
    const marg = 1.0; // m em volta (negativas que entram nas vizinhas)
    const W = 720, H0 = 460;
    const esc = Math.min((W - 120) / (lx + 2 * marg), (H0 - 80) / (ly + 2 * marg));
    const ox = 60 + marg * esc, oy = 30 + (ly + marg) * esc;
    const X = (x) => ox + x * esc, Y = (y) => oy - y * esc;
    const H = oy + marg * esc + 40;
    const filhos = [s('text', { x: 0, y: 14, class: 'dg-titulo' }, `PLANTA DE ARMAÇÃO — ${el.codigo ?? ''} (${fmt(lx, 2)} × ${fmt(ly, 2)} m, h = ${fmt(el.h)} cm)`)];
    // vigas (faixas nas bordas) e contorno da laje
    const faixa = { x0: [[0, 0], [0, ly], 'v'], x1: [[lx, 0], [lx, ly], 'v'], y0: [[0, 0], [lx, 0], 'h'], y1: [[0, ly], [lx, ly], 'h'] };
    for (const [b, [p, q, o]] of Object.entries(faixa)) {
      const w = (ap[b] ?? 0) / 100;
      if (!(w > 0)) { filhos.push(s('line', { x1: X(p[0]), y1: Y(p[1]), x2: X(q[0]), y2: Y(q[1]), class: 'det-borda-livre' })); continue; }
      filhos.push(o === 'v'
        ? s('rect', { x: X(p[0] - w / 2), y: Y(q[1] + w / 2), width: w * esc, height: (ly + w) * esc, class: 'det-apoio' })
        : s('rect', { x: X(p[0] - w / 2), y: Y(p[1] + w / 2), width: (lx + w) * esc, height: w * esc, class: 'det-apoio' }));
    }
    filhos.push(s('rect', { x: X(0), y: Y(ly), width: lx * esc, height: ly * esc, class: 'det-laje-planta' }));
    const cls = (q, base) => `${base}${destaque === q.id ? ' destaque' : ''}`;
    const g = (q, ...f) => s('g', { class: `det-pos${q.editada ? ' editada' : ''}`, 'data-pos': q.id }, ...f);
    const rot = (q) => `${q.N} · ${q.n} ø${phiTxt(q.phi)} c/ ${fmt(q.s, q.s % 1 ? 1 : 0)} · C = ${fmt(q.comprimento)}`;
    // positivas
    for (const q of posicoes.filter((p) => p.tipo === 'positiva')) {
      if (q.dir === 'x') {
        const y = ly * 0.3, xd = lx * 0.18;
        filhos.push(g(q,
          s('line', { x1: X(q.a), y1: Y(y), x2: X(q.b), y2: Y(y), class: cls(q, 'det-barra') }),
          s('line', { x1: X(xd), y1: Y(q.de), x2: X(xd), y2: Y(q.ate), class: 'det-faixa' }),
          s('text', { x: X(lx * 0.06) + 4, y: Y(y) - 6, class: 'det-rot' }, rot(q))));
      } else {
        const x = lx * 0.86, yd = ly * 0.84;
        const ty = Y(ly * 0.64);
        filhos.push(g(q,
          s('line', { x1: X(x), y1: Y(q.a), x2: X(x), y2: Y(q.b), class: cls(q, 'det-barra') }),
          s('line', { x1: X(q.de), y1: Y(yd), x2: X(q.ate), y2: Y(yd), class: 'det-faixa' }),
          s('text', { x: X(x) - 7, y: ty, class: 'det-rot', 'text-anchor': 'middle', transform: `rotate(-90 ${X(x) - 7} ${ty})` }, rot(q))));
      }
    }
    // negativas: barra cruzando a borda no meio do trecho, com as dobras, e a faixa ao longo da borda
    const dobraPx = 8;
    for (const q of posicoes.filter((p) => p.tipo === 'negativa')) {
      const t = (q.t0 + q.t1) / 2, a1 = q.a1 / 100, a2 = q.a2 / 100;
      let p0, p1, f0, f1, tx;
      if (q.borda === 'x0') { p0 = [-a2, t]; p1 = [a1, t]; f0 = [a1 * 0.5, q.t0]; f1 = [a1 * 0.5, q.t1]; }
      if (q.borda === 'x1') { p0 = [lx - a1, t]; p1 = [lx + a2, t]; f0 = [lx - a1 * 0.5, q.t0]; f1 = [lx - a1 * 0.5, q.t1]; }
      if (q.borda === 'y0') { p0 = [t, -a2]; p1 = [t, a1]; f0 = [q.t0, a1 * 0.5]; f1 = [q.t1, a1 * 0.5]; }
      if (q.borda === 'y1') { p0 = [t, ly - a1]; p1 = [t, ly + a2]; f0 = [q.t0, ly - a1 * 0.5]; f1 = [q.t1, ly - a1 * 0.5]; }
      const vert = q.borda[0] === 'y';
      const d = vert
        ? `M${X(p0[0]) + dobraPx},${Y(p0[1])} L${X(p0[0])},${Y(p0[1])} L${X(p1[0])},${Y(p1[1])} L${X(p1[0]) + dobraPx},${Y(p1[1])}`
        : `M${X(p0[0])},${Y(p0[1]) + dobraPx} L${X(p0[0])},${Y(p0[1])} L${X(p1[0])},${Y(p1[1])} L${X(p1[0])},${Y(p1[1]) + dobraPx}`;
      // rótulo ao lado da barra, dentro da laje
      tx = vert
        ? s('text', { x: X(t) + 10, y: q.borda === 'y1' ? Y(ly - a1 * 0.25) + 4 : Y(a1 * 0.25) + 4, class: 'det-rot' }, rot(q))
        : s('text', { x: q.borda === 'x0' ? X(0) + 6 : X(lx) - 6, y: Y(t) - 6, class: 'det-rot', 'text-anchor': q.borda === 'x0' ? 'start' : 'end' }, rot(q));
      filhos.push(g(q,
        s('path', { d, class: cls(q, 'det-barra negativa') }),
        s('line', { x1: X(f0[0]), y1: Y(f0[1]), x2: X(f1[0]), y2: Y(f1[1]), class: 'det-faixa negativa' }),
        tx));
    }
    for (const q of posicoes.filter((p) => p.tipo === 'distribuição')) {
      const lado = { x0: [0.06, null], x1: [lx - 0.06, null], y0: [null, 0.06], y1: [null, ly - 0.06] }[q.borda];
      const [p0, p1] = lado[0] != null ? [[lado[0], q.t0], [lado[0], q.t1]] : [[q.t0, lado[1]], [q.t1, lado[1]]];
      const vert = lado[0] != null;
      filhos.push(g(q,
        s('line', { x1: X(p0[0]), y1: Y(p0[1]), x2: X(p1[0]), y2: Y(p1[1]), class: cls(q, 'det-barra porta') }),
        s('text', vert
          ? { x: X(p0[0]) + (q.borda === 'x0' ? 12 : -6), y: Y(q.t0) - 8, class: 'det-rot-estribo', transform: `rotate(-90 ${X(p0[0]) + (q.borda === 'x0' ? 12 : -6)} ${Y(q.t0) - 8})` }
          : { x: X(q.t0) + 8, y: Y(p0[1]) + (q.borda === 'y0' ? -5 : 13), class: 'det-rot-estribo' },
        `${q.N} · ${q.n} ø${phiTxt(q.phi)} · C = ${fmt(q.comprimento)}`)));
    }
    // cotas
    filhos.push(
      s('line', { x1: X(0), y1: Y(0) + 26, x2: X(lx), y2: Y(0) + 26, class: 'dg-cota' }),
      s('text', { x: X(lx / 2), y: Y(0) + 22, class: 'dg-texto', 'text-anchor': 'middle' }, `lx = ${fmt(lx, 2)} m`),
      s('line', { x1: X(0) - 26, y1: Y(0), x2: X(0) - 26, y2: Y(ly), class: 'dg-cota' }),
      s('text', { x: X(0) - 30, y: Y(ly / 2), class: 'dg-texto', 'text-anchor': 'middle', transform: `rotate(-90 ${X(0) - 30} ${Y(ly / 2)})` }, `ly = ${fmt(ly, 2)} m`),
    );
    return s('svg', { class: 'desenho planta-laje-det', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMidYMin meet' }, ...filhos);
  }
  return { planta };
}
