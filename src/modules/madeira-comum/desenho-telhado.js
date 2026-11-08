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
/** Desenhos do telhado e da tesoura: elevação com os esforços, nó de apoio, corte transversal e planta. */
import { geometriaTesoura } from '../../engine/tesoura.js';

const fmt = (v, c = 0) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');

export function criarDesenhosTelhado({ s }) {
  /** Elevação da tesoura com o esforço normal de cálculo de cada barra (tração em azul, compressão em vermelho). */
  function elevacaoTesoura(r, { W = 760 } = {}) {
    const m = 40, mDir = 78, H0 = 64;
    const esc = (W - m - mDir) / r.L;
    const H = r.H * esc + H0 + 80;
    const X = (x) => m + x * esc, Y = (y) => H - 70 - y * esc;
    const f = [s('text', { x: m, y: 18, class: 'dg-titulo' }, 'ELEVAÇÃO E ESFORÇOS NORMAIS DE CÁLCULO (kN)')];
    const grosso = { banzoSup: 5, banzoInf: 5, montante: 3, diagonal: 3 };
    for (const b of r.barras) {
      const p = r.nos[b.i], q = r.nos[b.j];
      const tr = b.Nt > Math.abs(b.Nc) + 1e-6, nulo = Math.max(b.Nt, Math.abs(b.Nc)) < 0.05;
      f.push(s('line', { x1: X(p.x), y1: Y(p.y), x2: X(q.x), y2: Y(q.y), class: `ts-barra ${nulo ? 'nula' : tr ? 'tracao' : 'compressao'}${b.ok ? '' : ' falha'}`, 'stroke-width': grosso[b.grupo] }));
    }
    for (const b of r.barras) {
      const p = r.nos[b.i], q = r.nos[b.j];
      const tr = b.Nt > Math.abs(b.Nc) + 1e-6, v = tr ? b.Nt : b.Nc;
      if (Math.abs(v) < 0.5) continue;
      const cx = X((p.x + q.x) / 2), cy = Y((p.y + q.y) / 2) + (b.grupo === 'banzoInf' ? 15 : b.grupo === 'banzoSup' ? -7 : 4);
      f.push(s('text', { x: cx, y: cy, 'text-anchor': 'middle', class: `ts-n ${tr ? 'tracao' : 'compressao'}` }, `${tr ? '+' : '−'}${fmt(Math.abs(v), 1)}`));
    }
    for (const n of r.nos) f.push(s('circle', { cx: X(n.x), cy: Y(n.y), r: 3, class: 'ts-no' }));
    const apoio = (x, movel) => s('path', { d: `M${X(x)} ${Y(0) + 4} l-9 14 h18 z${movel ? ` M${X(x) - 11} ${Y(0) + 22} h22` : ''}`, class: 'ts-apoio' });
    f.push(apoio(0, false), apoio(r.L, true));
    const yc = Y(0) + 44;
    f.push(
      s('line', { x1: X(0), y1: yc, x2: X(r.L), y2: yc, class: 'dg-cota' }),
      s('text', { x: X(r.L / 2), y: yc - 5, 'text-anchor': 'middle', class: 'dg-texto' }, `vão ${fmt(r.L, 2)} m · ${r.paineis} painéis de ${fmt(r.L / r.paineis, 2)} m · inclinação ${fmt(r.inclinacao, 0)}% (${fmt((r.alfa * 180) / Math.PI, 1)}°)`),
      s('line', { x1: X(r.L) + 18, y1: Y(0), x2: X(r.L) + 18, y2: Y(r.H), class: 'dg-cota' }),
      s('text', { x: X(r.L) + 24, y: Y(r.H / 2), class: 'dg-texto' }, `${fmt(r.H, 2)} m`),
    );
    const leg = H0 - 30;
    f.push(
      s('line', { x1: W - 250, y1: leg, x2: W - 226, y2: leg, class: 'ts-barra tracao', 'stroke-width': 4 }), s('text', { x: W - 220, y: leg + 4, class: 'dg-texto' }, 'tração (+)'),
      s('line', { x1: W - 140, y1: leg, x2: W - 116, y2: leg, class: 'ts-barra compressao', 'stroke-width': 4 }), s('text', { x: W - 110, y: leg + 4, class: 'dg-texto' }, 'compressão (−)'),
    );
    return s('svg', { class: 'desenho ts-elevacao', viewBox: `0 0 ${W} ${H}`, width: W, height: H }, ...f);
  }

  /** Nó de apoio com entalhe simples: a perna encosta na face vertical do dente cortado na linha. */
  function noApoio(r, secoes) {
    const esc = 4, a = r.alfa, sa = Math.sin(a), ca = Math.cos(a);
    const hi = secoes.banzoInf.h * esc, hs = secoes.banzoSup.h * esc;
    const e = r.entalhe.e * esc, fpx = Math.min(Math.max(r.entalhe.f * esc, 70), 150), Lp = 250;
    const W = 470, x0 = 24, xd = x0 + fpx;
    const ytop = 46 + Lp * sa + hs / ca, H = ytop + hi + 70;
    const A = [xd, ytop + e], B = [A[0] + Lp * ca, A[1] - Lp * sa], C = [B[0] - hs * sa, B[1] - hs * ca], D = [xd, ytop + e - hs / ca];
    const xFundo = xd + e / Math.tan(a);
    const P = (...pts) => pts.map(([x, y], k) => `${k ? 'L' : 'M'}${x} ${y}`).join(' ') + ' Z';
    const f = [
      s('text', { x: 14, y: 20, class: 'dg-titulo' }, 'NÓ DE APOIO — ENTALHE SIMPLES'),
      s('rect', { x: x0 - 4, y: ytop + hi, width: fpx + 60, height: 18, class: 'tl-parede' }),
      s('path', { d: P([x0, ytop], [xd, ytop], [xd, ytop + e], [xFundo, ytop], [x0 + 400, ytop], [x0 + 400, ytop + hi], [x0, ytop + hi]), class: 'mad-secao' }),
      s('path', { d: P([x0, ytop], [xd, ytop], [xd, ytop + e], [xFundo, ytop], [x0 + 400, ytop], [x0 + 400, ytop + hi], [x0, ytop + hi]), class: 'mad-borda' }),
      s('path', { d: P(A, B, C, D), class: 'mad-secao' }), s('path', { d: P(A, B, C, D), class: 'mad-borda' }),
      s('circle', { cx: xd + 34, cy: ytop + hi / 2, r: 4, class: 'ts-parafuso' }),
      s('line', { x1: x0, y1: ytop - 12, x2: xd, y2: ytop - 12, class: 'dg-cota' }),
      s('text', { x: (x0 + xd) / 2, y: ytop - 17, 'text-anchor': 'middle', class: 'dg-texto' }, `f ≥ ${fmt(r.entalhe.f, 0)} cm`),
      s('line', { x1: xd - 8, y1: ytop, x2: xd - 8, y2: ytop + e, class: 'dg-cota' }),
      s('text', { x: xd - 12, y: ytop + e / 2 + 4, 'text-anchor': 'end', class: 'dg-texto' }, `e = ${fmt(r.entalhe.e, 1)} cm`),
      s('text', { x: B[0] - 70, y: B[1] - 4, class: 'dg-texto' }, `perna ${fmt(secoes.banzoSup.b, 0)} × ${fmt(secoes.banzoSup.h, 0)}`),
      s('text', { x: x0 + 250, y: ytop + hi - 10, class: 'dg-texto' }, `linha ${fmt(secoes.banzoInf.b, 0)} × ${fmt(secoes.banzoInf.h, 0)}`),
      s('text', { x: x0, y: H - 12, class: 'dg-texto' }, `Nd,perna = ${fmt(r.entalhe.H / ca, 1)} kN · fc,α,d = ${fmt(r.entalhe.fca, 2)} MPa · parafuso de montagem no nó`),
    ];
    return s('svg', { class: 'desenho ts-no-apoio', viewBox: `0 0 ${W} ${H}`, width: W, height: H }, ...f);
  }

  /** Corte transversal do telhado: tesoura, terças, caibros, ripas e telha, com o beiral. */
  function corteTelhado(el, r, secoes) {
    const g = r.geo;
    const W = 760, m = 40;
    const esc = (W - 2 * m) / (g.L + 2 * g.beiral);
    const H = g.H * esc + 150;
    const X = (x) => m + (x + g.beiral) * esc, Y = (y) => H - 80 - y * esc;
    const t = g.i / 100, z = (x) => t * Math.min(x, g.L - x);
    const f = [s('text', { x: m, y: 18, class: 'dg-titulo' }, 'CORTE TRANSVERSAL')];
    f.push(s('rect', { x: X(0) - 6, y: Y(0), width: 12, height: 34, class: 'tl-parede' }), s('rect', { x: X(g.L) - 6, y: Y(0), width: 12, height: 34, class: 'tl-parede' }));
    const geo = geometriaTesoura({ tipo: el.tipoTesoura ?? 'howe', L: g.L, inclinacao: g.i, paineis: g.n });
    for (const b of geo.barras) {
      const p = geo.nos[b.i], q = geo.nos[b.j];
      f.push(s('line', { x1: X(p.x), y1: Y(p.y), x2: X(q.x), y2: Y(q.y), class: 'tl-tesoura', 'stroke-width': b.grupo.startsWith('banzo') ? 4 : 2.5 }));
    }
    const ht = (el.terca.h / 100) * esc, bt = Math.max(3, (el.terca.b / 100) * esc);
    for (const tc of g.tercas) f.push(s('rect', { x: X(tc.x) - bt / 2, y: Y(tc.z) - ht, width: bt, height: ht, class: 'tl-terca' }));
    // caibro (linha sobre as terças) e telha, com o beiral
    const off = ht + 2;
    const pontos = [[-g.beiral, -g.beiral * t], [g.L / 2, g.H], [g.L + g.beiral, -g.beiral * t]];
    const linha = (dy, cls) => s('path', { d: pontos.map(([x, y], k) => `${k ? 'L' : 'M'}${X(x)} ${Y(y) - dy}`).join(' '), class: cls });
    if (r.telha.ripas) f.push(linha(off + 3, 'tl-caibro'));
    f.push(linha(off + (r.telha.ripas ? 9 : 3), 'tl-telha'));
    f.push(
      s('line', { x1: X(0), y1: Y(0) + 46, x2: X(g.L), y2: Y(0) + 46, class: 'dg-cota' }),
      s('text', { x: X(g.L / 2), y: Y(0) + 40, 'text-anchor': 'middle', class: 'dg-texto' }, `vão ${fmt(g.L, 2)} m · beiral ${fmt(g.beiral, 2)} m · inclinação ${fmt(g.i, 0)}%`),
      s('text', { x: X(g.L / 2) + 10, y: Y(g.H) - off - 18, class: 'dg-texto' }, `cumeeira ${fmt(g.H, 2)} m`),
      s('text', { x: m, y: Y(0) + 66, class: 'dg-texto' }, `${r.telha.ripas ? `telha sobre ripas ${fmt(el.ripa.b, 0)} × ${fmt(el.ripa.h, 1)} · caibros ${fmt(el.caibro.b, 0)} × ${fmt(el.caibro.h, 0)} a cada ${fmt(r.pesos.ec * 100, 0)} cm · ` : 'telha apoiada direto nas terças · '}terças ${fmt(el.terca.b, 0)} × ${fmt(el.terca.h, 0)} a cada ${fmt(g.lp, 2)} m na água`),
    );
    return s('svg', { class: 'desenho', viewBox: `0 0 ${W} ${H}`, width: W, height: H }, ...f);
  }

  /** Planta do telhado: projeção com beirais, cumeeira, tesouras, terças e oitões (a maior dimensão na horizontal). */
  function plantaTelhado(el, r) {
    const g = r.geo;
    const Lt = g.C + 2 * g.beiralOitao, Bt = g.L + 2 * g.beiral;
    const deitado = Lt >= Bt;                       // comprimento (cumeeira) na horizontal?
    const largo = deitado ? Lt : Bt, alto = deitado ? Bt : Lt;
    const m = 40, esc = Math.min(680 / largo, 300 / alto);
    const W = largo * esc + 2 * m + 40, H = alto * esc + 100;
    // (u ao longo do vão, v ao longo da cumeeira) → tela
    const T = (u, v) => (deitado ? [m + (v + g.beiralOitao) * esc, 44 + (u + g.beiral) * esc] : [m + (u + g.beiral) * esc, 44 + (v + g.beiralOitao) * esc]);
    const ln = (u0, v0, u1, v1, cls) => { const [a, b] = T(u0, v0), [c, d] = T(u1, v1); return s('line', { x1: a, y1: b, x2: c, y2: d, class: cls }); };
    const ret = (u0, v0, u1, v1, cls) => { const [a, b] = T(u0, v0), [c, d] = T(u1, v1); return s('rect', { x: Math.min(a, c), y: Math.min(b, d), width: Math.abs(c - a), height: Math.abs(d - b), class: cls }); };
    const f = [s('text', { x: m, y: 18, class: 'dg-titulo' }, 'PLANTA DA ESTRUTURA DO TELHADO')];
    f.push(ret(-g.beiral, -g.beiralOitao, g.L + g.beiral, g.C + g.beiralOitao, 'tl-projecao'), ret(0, 0, g.L, g.C, 'tl-contorno'));
    for (const tc of g.tercas) f.push(ln(tc.x, -g.beiralOitao, tc.x, g.C + g.beiralOitao, tc.tipo === 'cumeeira' ? 'tl-cumeeira' : 'tl-terca-planta'));
    for (const v of g.tesouras) f.push(ln(0, v, g.L, v, 'tl-tesoura-planta'));
    if (g.oitoes) for (const v of [0, g.C]) f.push(ln(0, v, g.L, v, 'tl-oitao'));
    const [xc, yc] = T(g.L / 2, g.C + g.beiralOitao);
    f.push(
      s('text', { x: deitado ? xc + 6 : xc + 6, y: deitado ? yc - 4 : yc + 14, class: 'dg-texto' }, 'cumeeira'),
      s('text', { x: m, y: H - 14, class: 'dg-texto' }, `${g.tesouras.length} tesouras a cada ${fmt(g.et, 2)} m${g.oitoes ? ' · pontas sobre oitões' : ''} · ${g.n + 1} linhas de terças · projeção com beirais ${fmt(Bt, 2)} × ${fmt(Lt, 2)} m`),
    );
    return s('svg', { class: 'desenho tl-planta', viewBox: `0 0 ${W} ${H}`, width: W, height: H }, ...f);
  }

  return { elevacaoTesoura, noApoio, corteTelhado, plantaTelhado };
}
