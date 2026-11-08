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
 * Planta de armação da laje nervurada: vazios (ou blocos) entre as nervuras, as barras de cada nervura, travamentos,
 * negativas e distribuição na capa sobre as bordas engastadas e uma barra representativa da malha da capa.
 */
const fmt = (v, c = 0) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');
const phiTxt = (phi) => String(phi).replace('.', ',');

export function criarDesenhoNervurada({ s }) {
  function planta(el, det, posicoes, { destaque = null } = {}) {
    const geo = det.geometria;
    const lx = geo.lx / 100, ly = geo.ly / 100;
    const ap = det.apoios ?? {};
    const marg = 1.0;
    const W = 820, H0 = 460;
    const esc = Math.min(420 / (lx + 2 * marg), (H0 - 80) / (ly + 2 * marg));
    const ox = 60 + marg * esc, oy = 30 + (ly + marg) * esc;
    const X = (x) => ox + x * esc, Y = (y) => oy - y * esc;
    const H = oy + marg * esc + 40;
    const filhos = [s('text', { x: 0, y: 14, class: 'dg-titulo' }, `PLANTA DE ARMAÇÃO — ${el.codigo ?? ''} (${fmt(lx, 2)} × ${fmt(ly, 2)} m, h = ${fmt(geo.h)} cm, capa ${fmt(geo.hf)} cm)`)];
    const faixa = { x0: [[0, 0], [0, ly], 'v'], x1: [[lx, 0], [lx, ly], 'v'], y0: [[0, 0], [lx, 0], 'h'], y1: [[0, ly], [lx, ly], 'h'] };
    for (const [b, [p, q, o]] of Object.entries(faixa)) {
      const w = (ap[b] ?? 0) / 100;
      if (!(w > 0)) { filhos.push(s('line', { x1: X(p[0]), y1: Y(p[1]), x2: X(q[0]), y2: Y(q[1]), class: 'det-borda-livre' })); continue; }
      filhos.push(o === 'v'
        ? s('rect', { x: X(p[0] - w / 2), y: Y(q[1] + w / 2), width: w * esc, height: (ly + w) * esc, class: 'det-apoio' })
        : s('rect', { x: X(p[0] - w / 2), y: Y(p[1] + w / 2), width: (lx + w) * esc, height: w * esc, class: 'det-apoio' }));
    }
    filhos.push(s('rect', { x: X(0), y: Y(ly), width: lx * esc, height: ly * esc, class: 'det-laje-planta' }));
    // vazios / blocos entre as nervuras (tracejados)
    for (const [a, b] of geo.faixasX.vazios) for (const [c, d] of geo.faixasY.vazios) {
      filhos.push(s('rect', { x: X(a / 100), y: Y(d / 100), width: ((b - a) / 100) * esc, height: ((d - c) / 100) * esc, class: 'det-vazio' }));
    }
    const cls = (q, base) => `${base}${destaque === q.id ? ' destaque' : ''}`;
    const g = (q, ...f) => s('g', { class: `det-pos${q.editada ? ' editada' : ''}`, 'data-pos': q.id }, ...f);
    // no desenho só a etiqueta da posição (N1, N2…); o texto completo vai na legenda à direita
    const tag = (q, x, y, op = {}) => s('text', { x, y, class: 'det-rot det-rot-halo', ...op }, q.N);
    const perto = (eixos, alvo) => eixos.reduce((a, b) => (Math.abs(b - alvo) < Math.abs(a - alvo) ? b : a), eixos[0]);
    const legenda = [];
    // nervuras e travamentos: uma linha por nervura
    for (const q of posicoes.filter((p) => p.eixos?.length)) {
      const linhas = q.eixos.map((c) => (q.dir === 'x'
        ? s('line', { x1: X(q.a), y1: Y(c / 100), x2: X(q.b), y2: Y(c / 100), class: cls(q, `det-barra fina${q.tipo === 'construtiva' ? ' porta' : ''}`) })
        : s('line', { x1: X(c / 100), y1: Y(q.a), x2: X(c / 100), y2: Y(q.b), class: cls(q, `det-barra fina${q.tipo === 'construtiva' ? ' porta' : ''}`) })));
      const c = perto(q.eixos, (q.dir === 'x' ? ly : lx) * 100 * (q.tipo === 'construtiva' ? 0.5 : 0.3)) / 100;
      filhos.push(g(q, ...linhas, q.dir === 'x' ? tag(q, X(lx * 0.1), Y(c) - 4) : tag(q, X(c) + 4, Y(ly * 0.1))));
      legenda.push([q, `${q.n} ø${phiTxt(q.phi)} (${q.porNervura} por nervura × ${q.eixos.length}) · C = ${fmt(q.comprimento)}`, q.tipo === 'construtiva' ? 'travamento' : `nervuras em ${q.dir}`]);
    }
    // negativas na capa: barra reta cruzando a borda no meio do trecho, faixa ao longo da borda
    for (const q of posicoes.filter((p) => p.tipo === 'negativa')) {
      const t = (q.t0 + q.t1) / 2, a1 = q.a1 / 100, a2 = q.a2 / 100;
      const P = { x0: [[-a2, t], [a1, t], [a1 * 0.5, q.t0], [a1 * 0.5, q.t1]], x1: [[lx - a1, t], [lx + a2, t], [lx - a1 * 0.5, q.t0], [lx - a1 * 0.5, q.t1]],
        y0: [[t, -a2], [t, a1], [q.t0, a1 * 0.5], [q.t1, a1 * 0.5]], y1: [[t, ly - a1], [t, ly + a2], [q.t0, ly - a1 * 0.5], [q.t1, ly - a1 * 0.5]] }[q.borda];
      if (!P) continue;
      const [p0, p1, f0, f1] = P;
      const dentro = { x0: p1, x1: p0, y0: p1, y1: p0 }[q.borda];
      filhos.push(g(q,
        s('line', { x1: X(p0[0]), y1: Y(p0[1]), x2: X(p1[0]), y2: Y(p1[1]), class: cls(q, 'det-barra negativa') }),
        s('line', { x1: X(f0[0]), y1: Y(f0[1]), x2: X(f1[0]), y2: Y(f1[1]), class: 'det-faixa negativa' }),
        tag(q, X(dentro[0]) + (q.borda === 'x1' ? -4 : 4), Y(dentro[1]) + (q.borda === 'y1' ? 13 : -5), { 'text-anchor': q.borda === 'x1' ? 'end' : 'start' })));
      legenda.push([q, `${q.n} ø${phiTxt(q.phi)} c/ ${fmt(q.s, q.s % 1 ? 1 : 0)} · C = ${fmt(q.comprimento)}`, `negativa ${q.borda}${q.outro ? ` (com ${q.outro})` : ''}`]);
    }
    // distribuição das negativas
    for (const q of posicoes.filter((p) => p.tipo === 'distribuição' && p.borda)) {
      const lado = { x0: [0.06, null], x1: [lx - 0.06, null], y0: [null, 0.06], y1: [null, ly - 0.06] }[q.borda];
      const [p0, p1] = lado[0] != null ? [[lado[0], q.t0], [lado[0], q.t1]] : [[q.t0, lado[1]], [q.t1, lado[1]]];
      filhos.push(g(q, s('line', { x1: X(p0[0]), y1: Y(p0[1]), x2: X(p1[0]), y2: Y(p1[1]), class: cls(q, 'det-barra porta') })));
      legenda.push([q, `${q.n} ø${phiTxt(q.phi)} c/ ${fmt(q.s)} · C = ${fmt(q.comprimento)}`, `distribuição da negativa ${q.borda}`]);
    }
    // malha da capa: uma barra representativa em cada direção
    for (const q of posicoes.filter((p) => p.face === 'capa')) {
      filhos.push(q.dir === 'x'
        ? g(q, s('line', { x1: X(0.05), y1: Y(ly * 0.7), x2: X(lx - 0.05), y2: Y(ly * 0.7), class: cls(q, 'det-barra lateral') }), tag(q, X(lx * 0.62), Y(ly * 0.7) - 4))
        : g(q, s('line', { x1: X(lx * 0.7), y1: Y(0.05), x2: X(lx * 0.7), y2: Y(ly - 0.05), class: cls(q, 'det-barra lateral') }), tag(q, X(lx * 0.7) + 4, Y(ly * 0.14))));
      legenda.push([q, `${q.n} ø${phiTxt(q.phi)} c/ ${fmt(q.s, q.s % 1 ? 1 : 0)} · C = ${fmt(q.comprimento)}`, `malha da capa em ${q.dir}`]);
    }
    const est = posicoes.find((p) => p.tipo === 'estribo');
    if (est) legenda.push([est, `${est.n} ø${phiTxt(est.phi)} ${est.forma} · C = ${fmt(est.comprimento)}`, 'estribos das nervuras']);
    // legenda
    const xl = 530;
    filhos.push(s('text', { x: xl, y: 44, class: 'dg-texto' }, 'POSIÇÕES'));
    legenda.forEach(([q, txt, onde], i) => {
      const y = 66 + i * 34;
      filhos.push(g(q,
        s('text', { x: xl, y, class: cls(q, 'det-rot') }, `${q.N} · ${txt}`),
        s('text', { x: xl + 30, y: y + 14, class: 'det-rot-estribo' }, onde)));
    });
    filhos.push(
      s('line', { x1: X(0), y1: Y(0) + 26, x2: X(lx), y2: Y(0) + 26, class: 'dg-cota' }),
      s('text', { x: X(lx / 2), y: Y(0) + 22, class: 'dg-texto', 'text-anchor': 'middle' }, `lx = ${fmt(lx, 2)} m`),
      s('line', { x1: X(0) - 26, y1: Y(0), x2: X(0) - 26, y2: Y(ly), class: 'dg-cota' }),
      s('text', { x: X(0) - 30, y: Y(ly / 2), class: 'dg-texto', 'text-anchor': 'middle', transform: `rotate(-90 ${X(0) - 30} ${Y(ly / 2)})` }, `ly = ${fmt(ly, 2)} m`),
    );
    return s('svg', { class: 'desenho planta-laje-det', viewBox: `0 0 ${W} ${Math.max(H, 80 + legenda.length * 34)}`, preserveAspectRatio: 'xMidYMin meet' }, ...filhos);
  }
  return { planta };
}
