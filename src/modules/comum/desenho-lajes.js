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
 * Desenhos das lajes em uma direção: corte transversal (treliçada, nervurada,
 * alveolar) e esquema longitudinal com vínculos. Recebe `s` da API.
 */

const fmt = (v, c = 0) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');

export function criarDesenhosLajes({ s }) {
  /** Cota horizontal com texto acima. */
  function cotaH(x1, x2, y, texto) {
    return [
      s('line', { x1, y1: y, x2, y2: y, class: 'dg-cota' }),
      s('line', { x1, y1: y - 4, x2: x1, y2: y + 4, class: 'dg-cota' }),
      s('line', { x1: x2, y1: y - 4, x2, y2: y + 4, class: 'dg-cota' }),
      s('text', { x: (x1 + x2) / 2, y: y - 6, 'text-anchor': 'middle', class: 'dg-texto' }, texto),
    ];
  }
  /** Cota vertical com texto à direita. */
  function cotaV(x, y1, y2, texto) {
    return [
      s('line', { x1: x, y1, x2: x, y2, class: 'dg-cota' }),
      s('line', { x1: x - 4, y1, x2: x + 4, y2: y1, class: 'dg-cota' }),
      s('line', { x1: x - 4, y1: y2, x2: x + 4, y2, class: 'dg-cota' }),
      s('text', { x: x + 8, y: (y1 + y2) / 2 + 4, class: 'dg-texto' }, texto),
    ];
  }

  /**
   * Corte transversal de uma laje com nervuras.
   * @param {object} p  h, hf, bw, e em cm; tipo 'trelicada' | 'nervurada'; enchimento: 'ceramico' | 'eps' | 'concreto' | 'cubeta'
   */
  function corteNervurada({ tipo, h, hf, bw, e, enchimento, trelica, n = 3 }) {
    const W = 720, m = 30;
    const esc = (W - 2 * m - 90) / (n * e);
    const H = h * esc + 70;
    const x0 = m, y0 = 24, hh = h * esc, hfp = hf * esc;
    const filhos = [];
    // capa contínua
    filhos.push(s('rect', { x: x0, y: y0, width: n * e * esc, height: hfp, class: 'sec-concreto' }));
    for (let i = 0; i < n; i++) {
      const cx = x0 + (i + 0.5) * e * esc;
      const wbw = bw * esc;
      // enchimento entre nervuras (à direita de cada nervura, exceto a última)
      if (i < n) {
        const xa = cx + wbw / 2, xb = cx + e * esc - wbw / 2;
        if (i < n - 1 && enchimento !== 'cubeta') {
          filhos.push(s('rect', { x: xa + 1, y: y0 + hfp + 1, width: xb - xa - 2, height: hh - hfp - 1, class: `sec-enchimento ${enchimento}` }));
          if (enchimento === 'ceramico') {
            for (let k = 0; k < 3; k++) filhos.push(s('rect', { x: xa + 6 + (k * (xb - xa - 12)) / 3, y: y0 + hfp + 6, width: (xb - xa - 12) / 3 - 6, height: hh - hfp - 12, rx: 2, class: 'sec-furo' }));
          }
        }
      }
      // nervura
      filhos.push(s('rect', { x: cx - wbw / 2, y: y0 + hfp - 0.5, width: wbw, height: hh - hfp + 0.5, class: 'sec-concreto sem-borda-topo' }));
      if (tipo === 'trelicada') {
        // sapata da vigota pré-moldada (12 × 3 cm) e treliça
        const ws = Math.max(12, bw) * esc, hs = 3 * esc;
        filhos.push(s('rect', { x: cx - ws / 2, y: y0 + hh - hs, width: ws, height: hs, class: 'sec-vigota' }));
        const th = Math.min(trelica?.altura ?? 8, h - 2) * esc;
        const yb = y0 + hh - hs / 2, yt = yb - th + 2;
        filhos.push(s('path', { d: `M${cx - wbw / 3} ${yb} L${cx} ${yt} L${cx + wbw / 3} ${yb}`, class: 'sec-trelica' }));
        filhos.push(s('circle', { cx: cx - wbw / 3, cy: yb, r: 2.6, class: 'sec-barra' }), s('circle', { cx: cx + wbw / 3, cy: yb, r: 2.6, class: 'sec-barra' }), s('circle', { cx, cy: yt, r: 2.6, class: 'sec-barra' }));
      } else {
        filhos.push(s('circle', { cx, cy: y0 + hh - 2.5 * esc, r: 3, class: 'sec-barra' }));
      }
    }
    // cotas
    const xr = x0 + n * e * esc + 14;
    filhos.push(...cotaV(xr, y0, y0 + hfp, `capa ${fmt(hf, 1)}`));
    filhos.push(...cotaV(xr + 2, y0 + hfp, y0 + hh, `${fmt(h - hf, 1)}`));
    const c1 = x0 + 0.5 * e * esc, c2 = x0 + 1.5 * e * esc;
    filhos.push(...cotaH(c1, c2, y0 + hh + 26, `intereixo ${fmt(e)} cm`));
    filhos.push(s('text', { x: x0 + 2.5 * e * esc, y: y0 + hh + 20, 'text-anchor': 'middle', class: 'dg-texto' }, `bw ${fmt(bw, 1)}`));
    return s('svg', { class: 'desenho corte-laje', viewBox: `0 0 ${W} ${H}` }, ...filhos);
  }

  /** Corte de um painel alveolar (largura do painel, alvéolos circulares, capa opcional). */
  function corteAlveolar({ h, capa = 0, larguraPainel = 125, alveolos = 6 }) {
    const W = 720, m = 30;
    const esc = (W - 2 * m - 90) / larguraPainel;
    const hh = h * esc, hc = capa * esc, y0 = 24 + hc;
    const H = hh + hc + 70;
    const filhos = [];
    if (capa > 0) filhos.push(s('rect', { x: m, y: 24, width: larguraPainel * esc, height: hc, class: 'sec-capa' }));
    filhos.push(s('rect', { x: m, y: y0, width: larguraPainel * esc, height: hh, rx: 2, class: 'sec-concreto' }));
    const passo = (larguraPainel * esc) / alveolos;
    const r = Math.min(passo * 0.36, hh * 0.34);
    for (let i = 0; i < alveolos; i++) filhos.push(s('circle', { cx: m + (i + 0.5) * passo, cy: y0 + hh / 2, r, class: 'sec-furo' }));
    for (let i = 0; i < alveolos + 1; i++) filhos.push(s('circle', { cx: m + i * passo + (i === 0 ? 8 : i === alveolos ? -8 : 0), cy: y0 + hh - 3.5 * esc, r: 2.4, class: 'sec-barra protensao' }));
    const xr = m + larguraPainel * esc + 14;
    if (capa > 0) filhos.push(...cotaV(xr, 24, y0, `capa ${fmt(capa, 1)}`));
    filhos.push(...cotaV(xr + 2, y0, y0 + hh, `h ${fmt(h, 1)}`));
    filhos.push(...cotaH(m, m + larguraPainel * esc, y0 + hh + 26, `painel ${fmt(larguraPainel)} cm`));
    return s('svg', { class: 'desenho corte-laje', viewBox: `0 0 ${W} ${H}` }, ...filhos);
  }

  /**
   * Esquema longitudinal da faixa: vão cotado, vínculos das extremidades e carga distribuída.
   * @param {{L:number, bordas?:{x0:string,x1:string}, vinculo?:string}} p  bordas 'apoiada' | 'engastada' | 'livre'
   */
  function esquemaFaixa({ L, bordas, vinculo }) {
    const W = 720, y = 50, x0 = 60, x1 = 660;
    const filhos = [s('line', { x1: x0, y1: y, x2: x1, y2: y, class: 'dg-viga' })];
    for (let x = x0; x <= x1 + 0.1; x += 24) filhos.push(s('line', { x1: x, y1: 18, x2: x, y2: y - 6, class: 'dg-seta' }));
    filhos.push(s('line', { x1: x0, y1: 18, x2: x1, y2: 18, class: 'dg-seta' }));
    const apoio = (x) => s('g', { class: 'dg-apoio' }, s('path', { d: `M${x},${y + 5} l-11,18 h22 z` }), s('line', { x1: x - 16, y1: y + 27, x2: x + 16, y2: y + 27 }));
    const engaste = (x, dx) => {
      const g = s('g', { class: 'dg-apoio' }, s('line', { x1: x, y1: y - 20, x2: x, y2: y + 20, class: 'dg-engaste-linha' }));
      for (let i = -18; i <= 14; i += 7) g.append(s('line', { x1: x, y1: y + i, x2: x + 8 * dx, y2: y + i + 7, class: 'dg-hachura' }));
      return g;
    };
    const livre = (x) => s('text', { x, y: y + 32, 'text-anchor': 'middle', class: 'dg-rot' }, 'LIVRE');
    const antigos = { biapoiada: ['apoiada', 'apoiada'], 'engaste-apoio': ['engastada', 'apoiada'], biengastada: ['engastada', 'engastada'], balanco: ['engastada', 'livre'] };
    const [t0, t1] = bordas ? [bordas.x0, bordas.x1] : (antigos[vinculo] ?? antigos.biapoiada);
    const ponta = (t, x, dx) => (t === 'engastada' ? engaste(x, dx) : t === 'livre' ? livre(x) : apoio(x));
    filhos.push(ponta(t0, x0, -1), ponta(t1, x1, 1));
    filhos.push(...cotaH(x0, x1, 124, `${t0 === 'livre' || t1 === 'livre' ? 'Balanço' : 'L'} = ${fmt(L, 2)} m`));
    return s('svg', { class: 'desenho esquema', viewBox: `0 0 ${W} 136` }, ...filhos);
  }

  return { corteNervurada, corteAlveolar, esquemaFaixa };
}
