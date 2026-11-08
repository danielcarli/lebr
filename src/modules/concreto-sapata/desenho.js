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
 * Desenhos da sapata isolada: planta (sapata, pilar e malha de armaduras) e corte (faces inclinadas, pilar,
 * terreno e cotas).
 */
const fmt = (v, c = 0) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');

export function criarDesenhoSapata({ s }) {
  function planta(r) {
    const W = 360, H = 320, m = 46;
    const esc = Math.min((W - 2 * m) / r.A, (H - 2 * m) / r.B);
    const a = r.A * esc, b = r.B * esc, x0 = (W - a) / 2, y0 = (H - b) / 2;
    const pa = r.ap * esc, pb = r.bp * esc;
    const f = [s('rect', { x: x0, y: y0, width: a, height: b, class: 'sap-base' })];
    // faces inclinadas: do contorno ao topo (pilar + 2,5 cm)
    const ta = Math.min(a, (r.ap + 5) * esc), tb = Math.min(b, (r.bp + 5) * esc);
    const tx = (W - ta) / 2, ty = (H - tb) / 2;
    f.push(s('path', { d: `M${x0} ${y0}L${tx} ${ty}M${x0 + a} ${y0}L${tx + ta} ${ty}M${x0} ${y0 + b}L${tx} ${ty + tb}M${x0 + a} ${y0 + b}L${tx + ta} ${ty + tb}`, class: 'sap-aresta' }),
      s('rect', { x: tx, y: ty, width: ta, height: tb, class: 'sap-aresta' }));
    // barras (algumas linhas representativas)
    const c = (r.cobrimento ?? 3) * esc;
    const barras = (n, horizontal) => {
      const k = Math.min(n, 12);
      for (let i = 0; i < k; i++) {
        const t = k > 1 ? i / (k - 1) : 0.5;
        if (horizontal) { const y = y0 + c + t * (b - 2 * c); f.push(s('line', { x1: x0 + c, y1: y, x2: x0 + a - c, y2: y, class: 'sap-barra' })); }
        else { const x = x0 + c + t * (a - 2 * c); f.push(s('line', { x1: x, y1: y0 + c, x2: x, y2: y0 + b - c, class: 'sap-barra y' })); }
      }
    };
    if (r.flexao?.x?.malha) barras(r.flexao.x.malha.n, true);
    if (r.flexao?.y?.malha) barras(r.flexao.y.malha.n, false);
    f.push(s('rect', { x: (W - pa) / 2, y: (H - pb) / 2, width: pa, height: pb, class: 'sap-pilar' }));
    // cotas
    f.push(s('line', { x1: x0, y1: y0 + b + 18, x2: x0 + a, y2: y0 + b + 18, class: 'dg-cota' }),
      s('text', { x: W / 2, y: y0 + b + 33, 'text-anchor': 'middle', class: 'dg-texto' }, `A = ${fmt(r.A)} cm`),
      s('line', { x1: x0 + a + 18, y1: y0, x2: x0 + a + 18, y2: y0 + b, class: 'dg-cota' }),
      s('text', { x: x0 + a + 26, y: H / 2, class: 'dg-texto', transform: `rotate(90 ${x0 + a + 26} ${H / 2})`, 'text-anchor': 'middle' }, `B = ${fmt(r.B)} cm`),
      s('text', { x: x0, y: y0 - 10, class: 'dg-titulo' }, 'PLANTA'));
    if (r.flexao?.x?.malha) f.push(s('text', { x: x0, y: 14, class: 'sap-rot' }, `A: ${r.flexao.x.malha.rotulo}`));
    if (r.flexao?.y?.malha) f.push(s('text', { x: x0 + a / 2 + 10, y: 14, class: 'sap-rot y' }, `B: ${r.flexao.y.malha.rotulo}`));
    return s('svg', { class: 'desenho sapata-planta', viewBox: `0 0 ${W} ${H}`, width: W, height: H }, ...f);
  }

  function corte(r) {
    const W = 420, H = 320, m = 40;
    const prof = Math.max(r.profundidade * 100, r.h + 20);   // cm desenhados abaixo do terreno
    const esc = Math.min((W - 2 * m) / r.A, (H - 70) / (prof + 40));
    const a = r.A * esc, x0 = (W - a) / 2;
    const yT = 40, yB = yT + prof * esc;                      // terreno e base
    const h = r.h * esc, h0 = r.h0 * esc;
    const ta = Math.min(a, (r.ap + 5) * esc), tx = (W - ta) / 2;
    const pa = r.ap * esc;
    const f = [];
    // terreno e reaterro
    f.push(s('line', { x1: 8, y1: yT, x2: W - 8, y2: yT, class: 'sap-terreno' }));
    for (let x = 14; x < W - 10; x += 14) f.push(s('line', { x1: x, y1: yT, x2: x - 7, y2: yT + 7, class: 'sap-terreno-h' }));
    f.push(s('rect', { x: x0 - 8, y: yB, width: a + 16, height: 5 * esc + 3, class: 'sap-magro' }));
    f.push(s('path', { d: `M${x0} ${yB}V${yB - h0}L${tx} ${yB - h}H${tx + ta}L${x0 + a} ${yB - h0}V${yB}Z`, class: 'sap-concreto' }));
    f.push(s('rect', { x: (W - pa) / 2, y: yT - 30, width: pa, height: yB - h - yT + 30, class: 'sap-pilar' }));
    // armadura de flexão
    const c = (r.cobrimento ?? 3) * esc;
    f.push(s('path', { d: `M${x0 + c} ${yB - c - 10}V${yB - c}H${x0 + a - c}V${yB - c - 10}`, class: 'sap-barra' }));
    // cotas
    f.push(
      s('line', { x1: x0 + a + 14, y1: yB, x2: x0 + a + 14, y2: yB - h0, class: 'dg-cota' }), s('text', { x: x0 + a + 19, y: yB - h0 / 2 + 4, class: 'dg-texto' }, `h0 = ${fmt(r.h0)}`),
      s('line', { x1: x0 - 14, y1: yB, x2: x0 - 14, y2: yB - h, class: 'dg-cota' }), s('text', { x: x0 - 19, y: yB - h / 2 + 4, 'text-anchor': 'end', class: 'dg-texto' }, `h = ${fmt(r.h)}`),
      s('line', { x1: W - 18, y1: yT, x2: W - 18, y2: yB, class: 'dg-cota' }), s('text', { x: W - 22, y: (yT + yB) / 2, 'text-anchor': 'end', class: 'dg-texto' }, `${fmt(r.profundidade, 2)} m`),
      s('text', { x: 10, y: yT - 8, class: 'dg-titulo' }, `CORTE · ${r.rigida ? 'SAPATA RÍGIDA' : 'SAPATA FLEXÍVEL'}`),
      s('text', { x: W / 2, y: yB + 5 * esc + 20, 'text-anchor': 'middle', class: 'dg-texto' }, `σméd = ${fmt(r.tensoes.med)} kPa · σadm = ${fmt(r.sigmaAdm)} kPa`),
    );
    return s('svg', { class: 'desenho sapata-corte', viewBox: `0 0 ${W} ${H}`, width: W, height: H }, ...f);
  }

  return { planta, corte };
}
