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
 * Desenhos do memorial dos exercícios resolvidos (o "desenho" de validacao/memorial-exercicios.js): seção com a linha
 * neutra, pilar com os momentos, bloco com as bielas, placa com as bordas e os momentos, contornos de punção,
 * tensões na base, barras comparando solicitação e resistência, curvas e réguas.
 */
import { s } from '../ui/dom.js';

const n = (v, c = 1) => (Number.isFinite(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c }) : '—');
const svg = (W, H, filhos, titulo) => s('svg', { class: 'bib-svg', viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': titulo ?? 'desenho' }, ...filhos.flat().filter(Boolean));
const txt = (x, y, t, op = {}) => s('text', { x, y, class: op.classe ?? 'bib-t', 'text-anchor': op.ancora ?? 'start', ...(op.rot ? { transform: `rotate(${op.rot} ${x} ${y})` } : {}) }, t);
const linha = (x1, y1, x2, y2, classe = 'bib-l') => s('line', { x1, y1, x2, y2, class: classe });
const ret = (x, y, w, h, classe) => s('rect', { x, y, width: w, height: h, class: classe });
const seta = (x1, y1, x2, y2, classe = 'bib-seta') => {
  const a = Math.atan2(y2 - y1, x2 - x1), k = 7;
  return s('g', { class: classe }, s('line', { x1, y1, x2, y2 }), s('path', { d: `M${x2} ${y2} L${x2 - k * Math.cos(a - 0.4)} ${y2 - k * Math.sin(a - 0.4)} L${x2 - k * Math.cos(a + 0.4)} ${y2 - k * Math.sin(a + 0.4)} Z` }));
};
const poli = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');

const D = {
  /** Barras horizontais comparando solicitação e resistência. */
  barras(d) {
    const W = 520, lh = 30, H = 40 + d.itens.length * lh;
    const max = Math.max(...d.itens.map((i) => Math.abs(i[1]) || 0), 1e-9);
    const X0 = 90, X1 = 440;
    return svg(W, H, [txt(0, 16, d.titulo, { classe: 'bib-tit' }), d.itens.map(([rot, v, tipo], k) => {
      const y = 30 + k * lh, w = (Math.abs(v) / max) * (X1 - X0);
      return [txt(X0 - 8, y + 15, rot, { ancora: 'end' }), ret(X0, y, Math.max(1, w), 20, `bib-barra ${tipo}`), txt(X0 + w + 6, y + 15, n(v, Math.abs(v) < 10 ? 2 : 1), { classe: 'bib-n' })];
    })], d.titulo);
  },

  /** Pilar em elevação com a carga, o comprimento de flambagem e a soma dos momentos. */
  pilar(d) {
    const W = 560, H = 280;
    const x = 80, y0 = 40, y1 = 240, larg = 26;
    const Ms = [['M1d,mín', d.M1min, 'par'], ['M1d', d.M1, 'par'], ['M2d', d.M2, 'ref'], ['Md,tot', d.Md, 'res']];
    const max = Math.max(...Ms.map((m) => m[1] || 0), 1e-9);
    const bx = 240, bw = 240;
    const lam = Math.min(d.lambda, 140), L = (v) => bx + (Math.min(v, 140) / 140) * bw;
    return svg(W, H, [
      ret(x - larg / 2, y0, larg, y1 - y0, 'bib-concreto'),
      seta(x, y0 - 34, x, y0 - 2, 'bib-seta carga'), txt(x + 8, y0 - 18, `Nd = ${n(d.Nd, 0)} kN`, { classe: 'bib-n' }),
      s('path', { d: `M${x - 10} ${y1 + 12} L${x + 10} ${y1 + 12} L${x} ${y1} Z`, class: 'bib-l' }),
      linha(x - 34, y0, x - 34, y1, 'bib-cota'), txt(x - 40, (y0 + y1) / 2, `le = ${n(d.le, 0)} cm`, { ancora: 'middle', rot: -90 }),
      txt(x + larg / 2 + 6, y1 - 6, `h = ${n(d.h, 0)} cm`),
      txt(bx, 22, 'Momentos (kN·m)', { classe: 'bib-tit' }),
      Ms.map(([r, v, t], k) => { const y = 34 + k * 28, w = ((v || 0) / max) * (bw - 50); return [txt(bx - 6, y + 14, r, { ancora: 'end' }), ret(bx, y, Math.max(1, w), 18, `bib-barra ${t}`), txt(bx + w + 6, y + 14, n(v, 2), { classe: 'bib-n' })]; }),
      txt(bx, 176, 'Esbeltez', { classe: 'bib-tit' }),
      ret(bx, 186, L(d.lambda1) - bx, 14, 'bib-faixa ok'), ret(L(d.lambda1), 186, L(90) - L(d.lambda1), 14, 'bib-faixa medio'), ret(L(90), 186, L(140) - L(90), 14, 'bib-faixa alto'),
      linha(L(lam), 180, L(lam), 206, 'bib-marca'), txt(L(lam), 222, `λ = ${n(d.lambda, 1)}`, { ancora: 'middle', classe: 'bib-n' }),
      txt(L(d.lambda1), 240, `λ1 = ${n(d.lambda1, 0)}`, { ancora: 'middle' }), txt(L(90), 240, '90', { ancora: 'middle' }), txt(L(140), 240, '140', { ancora: 'middle' }),
    ], 'pilar');
  },

  /** Seção retangular com a linha neutra, o bloco comprimido, o braço z e as armaduras. */
  'secao-flexao'(d) {
    const W = 520, H = 260, k = Math.min(180 / d.h, 140 / d.b);
    const x0 = 60, y0 = 30, w = d.b * k, h = d.h * k, xn = (d.x || 0) * k, dd = d.d * k;
    const tx = x0 + w + 120;
    return svg(W, H, [
      ret(x0, y0, w, h, 'bib-concreto'), ret(x0, y0, w, 0.8 * xn, 'bib-comprimido'),
      linha(x0 - 10, y0 + xn, tx + 120, y0 + xn, 'bib-ln'), txt(x0 - 12, y0 + xn + 4, `x = ${n(d.x, 2)}`, { ancora: 'end', classe: 'bib-n' }),
      [0, 1, 2].map((i) => s('circle', { cx: x0 + 8 + (i * (w - 16)) / 2, cy: y0 + dd, r: 4.5, class: 'bib-aco' })),
      d.Asl > 0 ? [0, 1].map((i) => s('circle', { cx: x0 + 8 + i * (w - 16), cy: y0 + 4 * k, r: 3.5, class: 'bib-aco' })) : null,
      txt(x0 + w / 2, y0 + h + 20, `${n(d.b, 0)} × ${n(d.h, 0)} cm · d = ${n(d.d, 1)}`, { ancora: 'middle' }),
      ret(tx - 40, y0, 40, 0.8 * xn, 'bib-bloco'), txt(tx - 44, y0 + 12, '0,85·fcd', { ancora: 'end' }),
      seta(tx + 70, y0 + 0.4 * xn, tx + 4, y0 + 0.4 * xn, 'bib-seta carga'), txt(tx + 76, y0 + 0.4 * xn + 4, 'Rc', { classe: 'bib-n' }),
      seta(tx + 4, y0 + dd, tx + 70, y0 + dd, 'bib-seta aco'), txt(tx + 76, y0 + dd + 4, `Rs (As = ${n(d.As, 2)} cm²)`, { classe: 'bib-n' }),
      linha(tx + 56, y0 + 0.4 * xn, tx + 56, y0 + dd, 'bib-cota'), txt(tx + 50, (y0 + 0.4 * xn + y0 + dd) / 2, `z = ${n(d.z, 1)}`, { ancora: 'end', classe: 'bib-n' }),
      txt(tx - 40, H - 8, `Md = ${n(d.Md, 1)} kN·m · domínio ${d.dominio}`, { classe: 'bib-n' }),
    ], 'seção');
  },

  /** Seção com armadura simétrica em duas faces e o par N, M. */
  'secao-duas-faces'(d) {
    const W = 480, H = 220, k = Math.min(160 / d.h, 200 / d.b);
    const x0 = 60, y0 = 30, w = d.b * k, h = d.h * k, c = d.dl * k;
    const barras = (y) => [0, 1, 2, 3].map((i) => s('circle', { cx: x0 + c + (i * (w - 2 * c)) / 3, cy: y, r: 4.5, class: 'bib-aco' }));
    return svg(W, H, [
      ret(x0, y0, w, h, 'bib-concreto'), barras(y0 + c), barras(y0 + h - c),
      txt(x0 + w / 2, y0 + h + 22, `${n(d.b, 0)} × ${n(d.h, 0)} cm, d′ = ${n(d.dl, 1)} cm`, { ancora: 'middle' }),
      txt(x0 + w + 30, y0 + 20, `Nd = ${n(d.Nd, 0)} kN`, { classe: 'bib-n' }), txt(x0 + w + 30, y0 + 44, `Md = ${n(d.Md, 2)} kN·m`, { classe: 'bib-n' }),
      txt(x0 + w + 30, y0 + 80, `As,tot = ${n(d.As, 2)} cm²`, { classe: 'bib-n' }), txt(x0 + w + 30, y0 + 100, '(metade em cada face)'),
    ], 'seção');
  },

  /** Bloco em elevação: pilar, estacas, bielas com o ângulo e o tirante. */
  bloco(d) {
    const W = 520, H = 260;
    const xs = [...new Set((d.pos ?? [{ x: -d.e / 2 }, { x: d.e / 2 }]).map((p) => Math.round(p.x)))].sort((a, b) => a - b);
    const span = Math.max(...xs.map(Math.abs), 1) * 2 + (d.D || 30) * 2;
    const k = 360 / span, cx = W / 2, yTopo = 50, hh = (d.d + 10) * k, yT = yTopo + hh - 10 * k;
    const X = (x) => cx + x * k;
    return svg(W, H, [
      ret(X(-span / 2), yTopo, span * k, hh, 'bib-concreto'),
      ret(X(-d.ap / 2), yTopo - 34, d.ap * k, 34, 'bib-pilar'),
      xs.map((x) => ret(X(x) - ((d.D || 30) * k) / 2, yTopo + hh - 10 * k, (d.D || 30) * k, 60, 'bib-estaca')),
      xs.map((x) => linha(X(Math.sign(x) * d.ap / 4), yTopo + 4, X(x), yT, 'bib-biela')),
      linha(X(xs[0]), yT, X(xs.at(-1)), yT, 'bib-tirante'),
      txt(cx, yT + 16, `tirante T = ${n(d.T, 1)} kN`, { ancora: 'middle', classe: 'bib-n' }),
      txt(X(xs.at(-1)) + 8, (yTopo + yT) / 2, `α = ${n(d.alfa, 1)}°`, { classe: 'bib-n' }),
      linha(X(-span / 2) - 16, yTopo, X(-span / 2) - 16, yT, 'bib-cota'),
      txt(X(-span / 2) - 22, (yTopo + yT) / 2, d.dMin ? `d = ${n(d.dMin, 1)} a ${n(d.d, 1)} cm` : `d = ${n(d.d, 1)} cm`, { ancora: 'middle', rot: -90 }),
      txt(cx, 22, `${d.n} estacas a ${n(d.e, 0)} cm · pilar ${n(d.ap, 0)} cm`, { ancora: 'middle', classe: 'bib-tit' }),
    ], 'bloco');
  },

  /** Planta das estacas com a reação de cada uma. */
  reacoes(d) {
    const W = 480, H = 240;
    const xs = d.pos.map((p) => p.x), ys = d.pos.map((p) => p.y);
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 60) + 80;
    const k = 180 / span, cx = W / 2 - 40, cy = H / 2;
    const Rmax = Math.max(...d.R);
    return svg(W, H, d.pos.map((p, i) => {
      const r = 10 + 14 * (d.R[i] / Rmax);
      return [s('circle', { cx: cx + p.x * k, cy: cy - p.y * k, r, class: 'bib-estaca' }), txt(cx + p.x * k, cy - p.y * k + r + 14, `${n(d.R[i], 1)} kN`, { ancora: 'middle', classe: 'bib-n' })];
    }), 'reações');
  },

  /** Sapata em planta com o pilar e os balanços iguais. */
  'sapata-planta'(d) {
    const W = 360, H = 260, k = Math.min(240 / d.A, 200 / d.B);
    const a = d.A * k, b = d.B * k, x0 = (W - a) / 2, y0 = (H - b) / 2 - 10;
    return svg(W, H, [
      ret(x0, y0, a, b, 'bib-concreto'), ret(W / 2 - (d.ap * k) / 2, y0 + b / 2 - (d.bp * k) / 2, d.ap * k, d.bp * k, 'bib-pilar'),
      linha(x0, y0 + b + 16, x0 + a, y0 + b + 16, 'bib-cota'), txt(W / 2, y0 + b + 32, `A = ${n(d.A, 0)} cm`, { ancora: 'middle' }),
      txt(x0 + a + 10, y0 + b / 2, `B = ${n(d.B, 0)}`),
      txt(x0 + 6, y0 + b / 2 + 4, `${n((d.A - d.ap) / 2, 1)}`, { classe: 'bib-n' }),
    ], 'sapata');
  },

  /** Diagrama trapezoidal das tensões na base da sapata. */
  'tensoes-base'(d) {
    const W = 460, H = 220, x0 = 60, x1 = 400, yb = 90;
    const k = 80 / Math.max(d.sMax, 1e-9);
    return svg(W, H, [
      ret(x0, yb - 30, x1 - x0, 30, 'bib-concreto'), ret((x0 + x1) / 2 - 15, yb - 80, 30, 50, 'bib-pilar'),
      seta((x0 + x1) / 2, yb - 120, (x0 + x1) / 2, yb - 84, 'bib-seta carga'), txt((x0 + x1) / 2 + 8, yb - 104, `N = ${n(d.N, 0)} kN`, { classe: 'bib-n' }),
      s('path', { d: `M${x0} ${yb} L${x0} ${yb + d.sMin * k} L${x1} ${yb + d.sMax * k} L${x1} ${yb} Z`, class: 'bib-pressao' }),
      txt(x0, yb + d.sMin * k + 16, `σmín ${n(d.sMin, 0)} kPa`, { classe: 'bib-n' }), txt(x1, yb + d.sMax * k + 16, `σmáx ${n(d.sMax, 0)} kPa`, { ancora: 'end', classe: 'bib-n' }),
      linha(x0, yb + d.sMed * k, x1, yb + d.sMed * k, 'bib-ref'), txt((x0 + x1) / 2, yb + d.sMed * k - 4, `σméd ${n(d.sMed, 0)}`, { ancora: 'middle' }),
      txt(x0, 18, `Base de largura A = ${n(d.A, 0)} cm`, { classe: 'bib-tit' }),
    ], 'tensões');
  },

  /** Régua do SPT para a tensão admissível. */
  spt(d) { return D.regua({ titulo: `σadm = 20·N = ${n(d.sigma, 0)} kPa`, valor: d.N, min: 0, max: 30, faixas: [[0, 5, 'fora (N < 5)'], [5, 20, 'faixa válida'], [20, 30, 'fora (N > 20)']], rotulo: `N = ${n(d.N, 1)}` }); },

  /** Régua com faixas e um marcador. */
  regua(d) {
    const W = 520, H = 120, X0 = 30, X1 = 490, X = (v) => X0 + ((Math.min(d.max, Math.max(d.min, v)) - d.min) / (d.max - d.min)) * (X1 - X0);
    const cls = ['ok', 'medio', 'alto'];
    return svg(W, H, [
      txt(X0, 18, d.titulo, { classe: 'bib-tit' }),
      d.faixas.map(([a, b, r], i) => [ret(X(a), 40, X(b) - X(a), 18, `bib-faixa ${cls[i] ?? 'alto'}`), txt((X(a) + X(b)) / 2, 34, r, { ancora: 'middle' })]),
      d.faixas.map(([a]) => txt(X(a), 74, n(a, 2), { ancora: 'middle' })), txt(X(d.max), 74, n(d.max, 2), { ancora: 'middle' }),
      linha(X(d.valor), 34, X(d.valor), 64, 'bib-marca'), txt(X(d.valor), 98, d.rotulo ?? n(d.valor, 3), { ancora: 'middle', classe: 'bib-n' }),
    ], d.titulo);
  },

  /** Placa em planta: bordas (engaste hachurado), momentos por metro. */
  placa(d) {
    const W = 520, H = 280, k = Math.min(220 / d.lx, 200 / d.ly);
    const w = d.lx * k, h = d.ly * k, x0 = 50, y0 = 40;
    const borda = (lado, x1, y1, x2, y2, nx, ny) => d.bordas[lado] === 'engastada'
      ? [linha(x1, y1, x2, y2, 'bib-engaste'), ...Array.from({ length: 10 }, (_, i) => { const t = (i + 0.5) / 10, px = x1 + (x2 - x1) * t, py = y1 + (y2 - y1) * t; return linha(px, py, px + nx * 8 + ny * 4, py + ny * 8 - nx * 4, 'bib-l'); })]
      : d.bordas[lado] === 'livre' ? [linha(x1, y1, x2, y2, 'bib-livre')] : [linha(x1, y1, x2, y2, 'bib-apoio')];
    const bx = 330;
    const ms = [['mx', d.m.mxPos], ['my', d.m.myPos], ["m′x", d.m.mxNeg], ["m′y", d.m.myNeg]];
    const max = Math.max(...ms.map((m) => Math.abs(m[1]) || 0), 1e-9);
    return svg(W, H, [
      ret(x0, y0, w, h, 'bib-laje'),
      borda('x0', x0, y0, x0, y0 + h, -1, 0), borda('x1', x0 + w, y0, x0 + w, y0 + h, 1, 0), borda('y0', x0, y0 + h, x0 + w, y0 + h, 0, 1), borda('y1', x0, y0, x0 + w, y0, 0, -1),
      txt(x0 + w / 2, y0 + h + 30, `lx = ${n(d.lx, 2)} m`, { ancora: 'middle' }), txt(x0 + w + 26, y0 + h / 2, `ly = ${n(d.ly, 2)} m`, { ancora: 'middle', rot: 90 }),
      txt(x0 - 8, y0 + h / 2, 'x0', { ancora: 'end' }), txt(x0 + w + 8, y0 + h / 2 - 14, 'x1'), txt(x0 + w / 2, y0 + h + 14, 'y0', { ancora: 'middle' }), txt(x0 + w / 2, y0 - 8, 'y1', { ancora: 'middle' }),
      txt(bx, 30, 'Momentos para p = 1 kN/m² (kN·m/m)', { classe: 'bib-tit' }),
      ms.map(([r, v], i) => { const y = 46 + i * 34, wb = (Math.abs(v || 0) / max) * 120; return [txt(bx + 30, y + 14, r, { ancora: 'end' }), ret(bx + 36, y, Math.max(1, wb), 20, `bib-barra ${v < 0 ? 'neg' : 'par'}`), txt(bx + 42 + wb, y + 14, n(v, 3), { classe: 'bib-n' })]; }),
      txt(bx, 200, 'traço grosso hachurado: engaste · fino: apoio', {}),
    ], 'placa');
  },

  /** Áreas de influência pelas charneiras (aproximação gráfica com 45° e 60°). */
  areas(d) {
    const W = 520, H = 280, k = Math.min(240 / d.lx, 210 / d.ly), lx = d.lx, ly = d.ly;
    const x0 = 50, y0 = 30, X = (x) => x0 + x * k, Y = (y) => y0 + (ly - y) * k;
    const eng = (b) => d.bordas[b] === 'engastada';
    // ângulo da charneira medido a partir da borda "horizontal" (y0/y1) no canto entre a borda vertical v e a horizontal hz
    const ang = (v, hz) => (eng(v) === eng(hz) ? 45 : eng(v) ? 30 : 60) * Math.PI / 180;
    const cantos = [[0, 0, 'x0', 'y0', 1, 1], [lx, 0, 'x1', 'y0', -1, 1], [lx, ly, 'x1', 'y1', -1, -1], [0, ly, 'x0', 'y1', 1, -1]];
    const linhas = [];
    if (lx <= ly) {
      // vértices sobre a linha média vertical: um embaixo, outro em cima
      const apice = (c1, c2) => { const t1 = Math.tan(ang(c1[2], c1[3])), t2 = Math.tan(ang(c2[2], c2[3])); const x = (lx * t2) / (t1 + t2); return [x, c1[1] + c1[5] * x * t1]; };
      const pb = apice(cantos[0], cantos[1]), pt = apice(cantos[3], cantos[2]);
      linhas.push([cantos[0], pb], [cantos[1], pb], [cantos[3], pt], [cantos[2], pt], [pb, pt]);
    } else {
      const apice = (c1, c2) => { const t1 = 1 / Math.tan(ang(c1[2], c1[3])), t2 = 1 / Math.tan(ang(c2[2], c2[3])); const y = (ly * t2) / (t1 + t2); return [c1[0] + c1[4] * y * t1, y]; };
      const pe = apice(cantos[0], cantos[3]), pd = apice(cantos[1], cantos[2]);
      linhas.push([cantos[0], pe], [cantos[3], pe], [cantos[1], pd], [cantos[2], pd], [pe, pd]);
    }
    return svg(W, H, [
      ret(X(0), Y(ly), lx * k, ly * k, 'bib-laje'),
      linhas.map(([a, b]) => linha(X(a[0]), Y(a[1]), X(b[0]), Y(b[1]), 'bib-charneira')),
      ['x0', 'x1', 'y0', 'y1'].map((b) => linha(...(b === 'x0' ? [X(0), Y(0), X(0), Y(ly)] : b === 'x1' ? [X(lx), Y(0), X(lx), Y(ly)] : b === 'y0' ? [X(0), Y(0), X(lx), Y(0)] : [X(0), Y(ly), X(lx), Y(ly)]), eng(b) ? 'bib-engaste' : 'bib-apoio')),
      txt(X(0) + 8, Y(ly / 2), `x0: ${n(d.area.x0, 2)} m²`, { classe: 'bib-n' }), txt(X(lx) - 8, Y(ly / 2), `x1: ${n(d.area.x1, 2)} m²`, { ancora: 'end', classe: 'bib-n' }),
      txt(X(lx / 2), Y(0) - 8, `y0: ${n(d.area.y0, 2)} m²`, { ancora: 'middle', classe: 'bib-n' }), txt(X(lx / 2), Y(ly) + 16, `y1: ${n(d.area.y1, 2)} m²`, { ancora: 'middle', classe: 'bib-n' }),
      txt(X(lx) + 20, 40, 'charneiras: 45° entre bordas iguais', {}), txt(X(lx) + 20, 58, 'e 60° a partir do engaste', {}), txt(X(lx) + 20, 80, '(desenho aproximado)', {}),
    ], 'áreas');
  },

  /** Contornos de punção C e C′ em volta do pilar e as tensões. */
  puncao(d) {
    const W = 520, H = 260, k = Math.min(3, 180 / (d.c1 + 4 * d.d));
    const cx = 140, cy = 130, a = d.c1 * k, b = d.c2 * k, r = 2 * d.d * k;
    const W2 = 320;
    const max = Math.max(d.tauC, d.tauRd2, d.tauC1, d.tauRd1);
    const barra = (y, v, t, rot) => { const w = (v / max) * 140; return [txt(W2, y + 13, rot, { ancora: 'end' }), ret(W2 + 6, y, Math.max(1, w), 18, `bib-barra ${t}`), txt(W2 + 12 + w, y + 13, n(v, 3), { classe: 'bib-n' })]; };
    return svg(W, H, [
      s('rect', { x: cx - a / 2 - r, y: cy - b / 2 - r, width: a + 2 * r, height: b + 2 * r, rx: r, class: 'bib-contorno' }),
      ret(cx - a / 2, cy - b / 2, a, b, 'bib-pilar'),
      txt(cx, cy - b / 2 - r - 8, 'C′ a 2d', { ancora: 'middle' }), txt(cx, cy + b / 2 + 16, `C: ${n(d.c1, 0)} × ${n(d.c2, 0)}`, { ancora: 'middle' }),
      txt(W2 - 60, 30, 'Tensões (MPa)', { classe: 'bib-tit' }),
      barra(44, d.tauC, 'sol', 'τSd em C'), barra(70, d.tauRd2, 'res', 'τRd2'), barra(116, d.tauC1, 'sol', 'τSd em C′'), barra(142, d.tauRd1, 'res', 'τRd1'),
    ], 'punção');
  },

  /** Seção com a armadura de torção: a seção vazada equivalente. */
  torcao(d) {
    const W = 360, H = 260, k = Math.min(200 / d.h, 160 / d.b), x0 = 60, y0 = 30, w = d.b * k, h = d.h * k, he = d.he * k;
    return svg(W, H, [
      ret(x0, y0, w, h, 'bib-concreto'), s('rect', { x: x0, y: y0, width: w, height: h, class: 'bib-vazada', 'stroke-width': he }),
      ret(x0 + he / 2, y0 + he / 2, w - he, h - he, 'bib-media'),
      txt(x0 + w + 12, y0 + 20, `he = ${n(d.he, 2)} cm`, { classe: 'bib-n' }), txt(x0 + w + 12, y0 + 40, 'tracejado: linha média'), txt(x0 + w + 12, y0 + 58, '(Ae e ue)'),
      txt(x0 + w / 2, y0 + h + 20, `${n(d.b, 0)} × ${n(d.h, 0)} cm`, { ancora: 'middle' }),
    ], 'torção');
  },

  /** Seção fissurada: linha neutra no estádio II e, se houver, a área de envolvimento. */
  estadio2(d) {
    const W = 420, H = 260, k = Math.min(200 / d.h, 160 / d.b), x0 = 60, y0 = 30, w = d.b * k, h = d.h * k;
    return svg(W, H, [
      ret(x0, y0, w, h, 'bib-concreto'), ret(x0, y0, w, d.x * k, 'bib-comprimido'),
      d.acr ? ret(x0, y0 + h - d.acr * k, w, d.acr * k, 'bib-acr') : null,
      [0, 1, 2, 3].slice(0, d.nBarras ?? 3).map((i, _, arr) => s('circle', { cx: x0 + 8 + (i * (w - 16)) / Math.max(1, arr.length - 1), cy: y0 + d.d * k, r: 4.5, class: 'bib-aco' })),
      linha(x0 - 10, y0 + d.x * k, x0 + w + 20, y0 + d.x * k, 'bib-ln'), txt(x0 + w + 24, y0 + d.x * k + 4, `x_II = ${n(d.x, 2)} cm`, { classe: 'bib-n' }),
      d.acr ? txt(x0 + w + 24, y0 + h - (d.acr * k) / 2, `Acr (${n(d.acr, 1)} cm de altura)`, {}) : null,
      txt(x0 + w / 2, y0 + h + 20, `b = ${n(d.b, 0)} cm, d = ${n(d.d, 1)} cm`, { ancora: 'middle' }),
    ], 'estádio II');
  },

  /** Diagrama de momentos e o diagrama deslocado de al. */
  decalagem(d) {
    const W = 520, H = 200, X0 = 40, X1 = 480, L = 500, al = Math.min(d.al, 120);
    const k = (X1 - X0) / L, ym = 40;
    const M = (x) => Math.max(0, 1 - ((x - L / 2) / (L / 2)) ** 2);
    const pts = Array.from({ length: 41 }, (_, i) => (L * i) / 40);
    const desl = (x) => (x < L / 2 ? M(Math.min(L / 2, x + al)) : M(Math.max(L / 2, x - al)));
    return svg(W, H, [
      linha(X0, ym, X1, ym, 'bib-l'),
      s('path', { d: poli(pts.map((x) => [X0 + x * k, ym + M(x) * 110])), class: 'bib-curva' }),
      s('path', { d: poli(pts.map((x) => [X0 + x * k, ym + desl(x) * 110])), class: 'bib-curva desl' }),
      seta(X0 + 60 * k, ym + M(60) * 110, X0 + (60 - al) * k, ym + M(60) * 110, 'bib-seta aco'),
      txt(X0 + 60 * k + 6, ym + M(60) * 110 + 4, `al = ${n(d.al, 1)} cm`, { classe: 'bib-n' }),
      txt(X1, H - 8, 'contínuo: Md · tracejado: Md deslocado de al (esquemático)', { ancora: 'end' }),
    ], 'decalagem');
  },

  /** Perfil do degrau e altura média. */
  escada(d) {
    const W = 420, H = 220, k = 3;
    const pts = [[40, 180]];
    for (let i = 0; i < 4; i++) { const [x, y] = pts.at(-1); pts.push([x, y - d.e * k], [x + d.p * k, y - d.e * k]); }
    return svg(W, H, [
      s('path', { d: poli(pts), class: 'bib-curva' }),
      linha(40, 180 + d.h * k / Math.cos(Math.atan(d.e / d.p)), pts.at(-1)[0], pts.at(-1)[1] + d.h * k / Math.cos(Math.atan(d.e / d.p)), 'bib-l'),
      txt(pts[1][0] - 6, (pts[0][1] + pts[1][1]) / 2, `e = ${n(d.e, 1)}`, { ancora: 'end' }), txt((pts[1][0] + pts[2][0]) / 2, pts[1][1] - 6, `p = ${n(d.p, 1)}`, { ancora: 'middle' }),
      txt(260, 200, `laje h = ${n(d.h, 0)} cm · hm = ${n(d.hm, 2)} cm`, { classe: 'bib-n' }),
    ], 'escada');
  },

  /** Tramo biapoiado com cargas por trecho e o diagrama de momentos. */
  tramo(d) {
    const W = 520, H = 230, X0 = 50, X1 = 470, k = (X1 - X0) / d.L, yv = 80;
    const wmax = Math.max(...d.trechos.map((t) => t.w));
    const M = (x) => { let m = d.RA * x; for (const t of d.trechos) { const a = t.a, b = Math.min(t.b, x); if (b > a) m -= t.w * (b - a) * (x - (a + b) / 2); } return m; };
    const pts = Array.from({ length: 61 }, (_, i) => (d.L * i) / 60);
    return svg(W, H, [
      d.trechos.map((t) => ret(X0 + t.a * k, yv - 10 - (t.w / wmax) * 40, (t.b - t.a) * k, (t.w / wmax) * 40, 'bib-carga')),
      d.trechos.map((t) => txt(X0 + ((t.a + t.b) / 2) * k, yv - 16 - (t.w / wmax) * 40, `${n(t.w, 1)} kN/m`, { ancora: 'middle' })),
      linha(X0, yv, X1, yv, 'bib-viga'),
      s('path', { d: `M${X0} ${yv + 2} l-8 12 h16 Z M${X1} ${yv + 2} l-8 12 h16 Z`, class: 'bib-l' }),
      s('path', { d: poli(pts.map((x) => [X0 + x * k, yv + 30 + (M(x) / d.Mmax) * 90])), class: 'bib-curva' }),
      txt(X0 + d.xM * k, yv + 30 + 90 + 16, `Mmáx = ${n(d.Mmax, 2)} kN·m`, { ancora: 'middle', classe: 'bib-n' }),
      txt(X0, yv + 26, `RA = ${n(d.RA, 1)}`, { ancora: 'middle' }), txt(X1, yv + 26, `RB = ${n(d.RB, 1)}`, { ancora: 'middle' }),
    ], 'tramo');
  },

  /** Curva y(x) com um ponto destacado. */
  curva(d) {
    const W = 460, H = 240, X0 = 60, X1 = 420, Y0 = 200, Y1 = 30;
    const xs = d.pontos.map((p) => p[0]), ys = d.pontos.map((p) => p[1]);
    const xmin = d.xy ? 0 : Math.min(...xs) * 0.95, xmax = Math.max(...xs) * 1.02, ymin = 0, ymax = Math.max(...ys);
    const X = (v) => X0 + ((v - xmin) / (xmax - xmin)) * (X1 - X0), Y = (v) => Y0 - ((v - ymin) / (ymax - ymin)) * (Y0 - Y1);
    return svg(W, H, [
      linha(X0, Y0, X1, Y0, 'bib-l'), linha(X0, Y0, X0, Y1, 'bib-l'),
      s('path', { d: poli(d.pontos.map(([x, y]) => [X(x), Y(y)])), class: 'bib-curva' }),
      s('circle', { cx: X(d.destaque[0]), cy: Y(d.destaque[1]), r: 5, class: 'bib-ponto' }),
      txt(X(d.destaque[0]) + 8, Y(d.destaque[1]) - 6, `(${n(d.destaque[0], 3)}; ${n(d.destaque[1], 3)})`, { classe: 'bib-n' }),
      txt(X1, Y0 + 20, d.x, { ancora: 'end' }), txt(X0 - 8, Y1, d.y, { ancora: 'end' }),
      txt(X0, 16, d.titulo, { classe: 'bib-tit' }),
    ], d.titulo);
  },

  /** Estaca no perfil: atrito lateral por metro e a ponta. */
  estaca(d) {
    const W = 480, H = 300, y0 = 30, y1 = 270, k = (y1 - y0) / Math.max(d.L, 1), xE = 120, larg = 22;
    const Rmax = Math.max(...d.perfil.map((p) => p.R), 1e-9);
    return svg(W, H, [
      ret(xE - larg / 2, y0, larg, d.L * k, 'bib-estaca'),
      d.perfil.map((p) => ret(xE + larg / 2 + 4, y0 + p.de * k, (p.R / Rmax) * 150, Math.max(1, (p.ate - p.de) * k - 1), 'bib-barra par')),
      d.perfil.filter((_, i) => i % 3 === 0).map((p) => txt(xE - larg / 2 - 6, y0 + p.de * k + 10, `${n(p.de, 0)} m`, { ancora: 'end' })),
      seta(xE, y0 + d.L * k + 30, xE, y0 + d.L * k + 4, 'bib-seta carga'), txt(xE + 14, y0 + d.L * k + 22, `Rp = ${n(d.Rp, 1)} kN`, { classe: 'bib-n' }),
      txt(xE + larg / 2 + 4, 20, 'atrito lateral por metro (kN)', { classe: 'bib-tit' }),
      txt(330, 60, `D = ${n(d.D, 0)} cm, L = ${n(d.L, 1)} m`, { classe: 'bib-n' }), txt(330, 80, `Padm = ${n(d.Padm, 1)} kN`, { classe: 'bib-n' }), d.metodo ? txt(330, 100, `governa: ${d.metodo}`, {}) : null,
    ], 'estaca');
  },
};

/** SVG do desenho, ou null se o tipo não tiver desenho. */
export function desenhoExercicio(d) {
  const f = d && D[d.tipo];
  if (!f) return null;
  try { return f(d); } catch (err) { console.error(err); return null; }
}
export const TIPOS_DESENHO = Object.keys(D);
