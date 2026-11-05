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
 * Punção — interface compartilhada (laje maciça agora; sapatas e blocos nas próximas etapas).
 *
 *   desenhoContornos(api, p)  planta da área carregada com os contornos C, C' e C'' e os conectores
 *   tabelaPuncao(api, lista)  tabela C / C' / C'' de cada carga
 *
 * `p` é o resumo de uma verificação (veja resumoPuncao na laje maciça): {posicao, c1, c2, d, C, C1, C2, armadura}.
 */

/**
 * Faces da área carregada que formam o contorno crítico, com a normal externa (cm, y para baixo).
 * Interna: retângulo fechado c1 (horizontal) × c2. Borda: borda livre em y = 0, c1 perpendicular a ela
 * (vertical) e c2 paralelo; só entram os trechos a do perímetro reduzido. Canto: bordas livres em x = 0 e y = 0.
 */
function faces({ posicao, c1, c2, d }) {
  if (posicao === 'borda') {
    const a = Math.min(1.5 * d, 0.5 * c1);
    return { fechado: false, area: [-c2 / 2, 0, c2, c1], livres: ['topo'], f: [
      { A: [-c2 / 2, c1 - a], B: [-c2 / 2, c1], n: [-1, 0] },
      { A: [-c2 / 2, c1], B: [c2 / 2, c1], n: [0, 1] },
      { A: [c2 / 2, c1], B: [c2 / 2, c1 - a], n: [1, 0] },
    ] };
  }
  if (posicao === 'canto') {
    const a1 = Math.min(1.5 * d, 0.5 * c1), a2 = Math.min(1.5 * d, 0.5 * c2);
    return { fechado: false, area: [0, 0, c1, c2], livres: ['topo', 'esquerda'], f: [
      { A: [c1 - a1, c2], B: [c1, c2], n: [0, 1] },
      { A: [c1, c2], B: [c1, c2 - a2], n: [1, 0] },
    ] };
  }
  return { fechado: true, area: [-c1 / 2, -c2 / 2, c1, c2], livres: [], f: [
    { A: [-c1 / 2, -c2 / 2], B: [c1 / 2, -c2 / 2], n: [0, -1] },
    { A: [c1 / 2, -c2 / 2], B: [c1 / 2, c2 / 2], n: [1, 0] },
    { A: [c1 / 2, c2 / 2], B: [-c1 / 2, c2 / 2], n: [0, 1] },
    { A: [-c1 / 2, c2 / 2], B: [-c1 / 2, -c2 / 2], n: [-1, 0] },
  ] };
}

/** Trechos do contorno a uma distância r: retas paralelas às faces e arcos de raio r nos cantos. */
function trechos(geo, r) {
  const out = [];
  const n = geo.f.length;
  for (let i = 0; i < n; i++) {
    const fa = geo.f[i];
    out.push({ tipo: 'reta', A: [fa.A[0] + r * fa.n[0], fa.A[1] + r * fa.n[1]], B: [fa.B[0] + r * fa.n[0], fa.B[1] + r * fa.n[1]], n: fa.n });
    const fb = geo.f[(i + 1) % n];
    if (i < n - 1 || geo.fechado) {
      const t1 = Math.atan2(fa.n[1], fa.n[0]);
      let t2 = Math.atan2(fb.n[1], fb.n[0]);
      while (t2 - t1 > Math.PI) t2 -= 2 * Math.PI;
      while (t2 - t1 < -Math.PI) t2 += 2 * Math.PI;
      out.push({ tipo: 'arco', C: fa.B, r, t1, t2 });
    }
  }
  return out.map((t) => ({ ...t, L: t.tipo === 'reta' ? Math.hypot(t.B[0] - t.A[0], t.B[1] - t.A[1]) : Math.abs(t.t2 - t.t1) * t.r }));
}

/** Ponto e normal externa a uma distância s ao longo do contorno. */
function pontoEm(tr, s) {
  for (const t of tr) {
    if (s <= t.L + 1e-9 || t === tr[tr.length - 1]) {
      const u = t.L > 0 ? Math.min(1, s / t.L) : 0;
      if (t.tipo === 'reta') return { p: [t.A[0] + u * (t.B[0] - t.A[0]), t.A[1] + u * (t.B[1] - t.A[1])], n: t.n };
      const a = t.t1 + u * (t.t2 - t.t1);
      return { p: [t.C[0] + t.r * Math.cos(a), t.C[1] + t.r * Math.sin(a)], n: [Math.cos(a), Math.sin(a)] };
    }
    s -= t.L;
  }
  return null;
}

/** Polilinha do contorno (arcos amostrados). */
function polilinha(tr) {
  const pts = [];
  for (const t of tr) {
    if (t.tipo === 'reta') pts.push(t.A, t.B);
    else for (let k = 0; k <= 10; k++) {
      const a = t.t1 + ((t.t2 - t.t1) * k) / 10;
      pts.push([t.C[0] + t.r * Math.cos(a), t.C[1] + t.r * Math.sin(a)]);
    }
  }
  return pts;
}

/** Conectores: linhas radiais distribuídas no primeiro contorno de armadura (s0), espaçadas de sr. */
export function posicoesConectores(p) {
  const a = p.armadura;
  if (!a) return [];
  const geo = faces(p);
  const tr = trechos(geo, a.s0);
  const total = tr.reduce((x, t) => x + t.L, 0);
  const pts = [];
  for (let i = 0; i < a.linhas; i++) {
    const s = geo.fechado ? (tr[0].L / 2 + (i * total) / a.linhas) % total : a.linhas > 1 ? (i * total) / (a.linhas - 1) : total / 2;
    const base = pontoEm(tr, s);
    for (let k = 0; k < a.contornos; k++) pts.push([base.p[0] + base.n[0] * k * a.sr, base.p[1] + base.n[1] * k * a.sr]);
  }
  return pts;
}

/**
 * Planta da área carregada com os contornos críticos.
 * @param {object} api
 * @param {object} p  resumo da verificação
 */
export function desenhoContornos(api, p) {
  const { s } = api.dom;
  const { num } = api.formatar;
  const W = 360, H = 300, m = 22;
  const geo = faces(p);
  const rC1 = 2 * p.d;
  const rC2 = p.C2?.distancia ?? null;
  const rMax = rC2 ?? rC1;
  const contornos = [
    { r: 0, classe: 'pc-c', rot: 'C' },
    { r: rC1, classe: 'pc-c1', rot: "C'" },
    ...(rC2 != null ? [{ r: rC2, classe: 'pc-c2', rot: "C''" }] : []),
  ].map((c) => ({ ...c, pts: polilinha(trechos(geo, c.r)) }));

  // caixa em cm: contorno externo e área carregada
  const todos = [...contornos[contornos.length - 1].pts, [geo.area[0], geo.area[1]], [geo.area[0] + geo.area[2], geo.area[1] + geo.area[3]]];
  let x0 = Math.min(...todos.map((q) => q[0])), x1 = Math.max(...todos.map((q) => q[0]));
  let y0 = Math.min(...todos.map((q) => q[1])), y1 = Math.max(...todos.map((q) => q[1]));
  if (geo.livres.includes('topo')) y0 = Math.min(y0, 0);
  if (geo.livres.includes('esquerda')) x0 = Math.min(x0, 0);
  // folga ao redor das bordas livres para a hachura
  const folga = (rMax + Math.max(p.c1, p.c2)) * 0.08;
  if (!geo.livres.includes('esquerda')) x0 -= folga;
  x1 += folga; y1 += folga;
  if (!geo.livres.includes('topo')) y0 -= folga;
  const esc = Math.min((W - 2 * m) / (x1 - x0), (H - 2 * m) / (y1 - y0));
  const ox = (W - (x1 - x0) * esc) / 2, oy = (H - (y1 - y0) * esc) / 2;
  const X = (x) => ox + (x - x0) * esc, Y = (y) => oy + (y - y0) * esc;
  const caminho = (pts, fechar) => `M${pts.map((q) => `${X(q[0]).toFixed(1)},${Y(q[1]).toFixed(1)}`).join(' L')}${fechar ? ' Z' : ''}`;

  const filhos = [];
  // laje
  const lx0 = geo.livres.includes('esquerda') ? X(0) : 0, ly0 = geo.livres.includes('topo') ? Y(0) : 0;
  filhos.push(s('rect', { x: lx0, y: ly0, width: W - lx0, height: H - ly0, class: 'pc-laje' }));
  // bordas livres
  if (geo.livres.includes('topo')) filhos.push(s('line', { x1: lx0, y1: Y(0), x2: W, y2: Y(0), class: 'pc-livre' }), s('text', { x: W - 6, y: Y(0) - 6, 'text-anchor': 'end', class: 'pc-rot-livre' }, 'borda livre'));
  if (geo.livres.includes('esquerda')) filhos.push(s('line', { x1: X(0), y1: ly0, x2: X(0), y2: H, class: 'pc-livre' }));
  // contornos
  for (const c of contornos) {
    if (c.r === 0) continue;
    filhos.push(s('path', { d: caminho(c.pts, geo.fechado), class: `pc-contorno ${c.classe} ${c.classe === 'pc-c1' && p.C1 && !p.C1.ok ? 'falha' : ''} ${c.classe === 'pc-c2' && p.C2 && !p.C2.ok ? 'falha' : ''}` }));
  }
  // área carregada
  filhos.push(s('rect', { x: X(geo.area[0]), y: Y(geo.area[1]), width: geo.area[2] * esc, height: geo.area[3] * esc, class: `pc-area ${p.C && !p.C.ok ? 'falha' : ''}` }));
  // contorno C (perímetro reduzido nas bordas e cantos)
  filhos.push(s('path', { d: caminho(contornos[0].pts, geo.fechado), class: 'pc-contorno pc-c' }));
  // conectores
  for (const q of posicoesConectores(p)) filhos.push(s('circle', { cx: X(q[0]), cy: Y(q[1]), r: 2.6, class: 'pc-conector' }));
  // rótulos dos contornos, na direção diagonal inferior direita
  const ang = geo.fechado ? Math.PI / 4 : p.posicao === 'canto' ? Math.PI / 4 : Math.PI / 2;
  for (const c of contornos) {
    const ref = geo.f.find((fa) => fa.n[1] === 1) ?? geo.f[0];
    const cx = p.posicao === 'borda' ? ref.B[0] : geo.area[0] + geo.area[2];
    const cy = p.posicao === 'borda' ? ref.B[1] : geo.area[1] + geo.area[3];
    const px = cx + c.r * Math.cos(ang), py = cy + c.r * Math.sin(ang);
    filhos.push(s('text', { x: X(px) + 7, y: Y(py) + (c.r === 0 ? -5 : 14), class: `pc-rot ${c.classe}` }, c.rot));
  }
  // cotas da área carregada
  filhos.push(s('text', { x: X(geo.area[0] + geo.area[2] / 2), y: Y(geo.area[1] + geo.area[3] / 2) + 4, 'text-anchor': 'middle', class: 'pc-dim' }, `${num(p.c1, 0)}×${num(p.c2, 0)}`));
  return s('svg', { class: 'desenho puncao', viewBox: `0 0 ${W} ${H}` }, ...filhos);
}

/** Legenda curta do desenho. */
export function legendaContornos(api, p) {
  const { h } = api.dom;
  const { num } = api.formatar;
  return h('figcaption', {},
    h('span', {}, h('i', { class: 'pc-leg c' }), 'C — face da área carregada'),
    h('span', {}, h('i', { class: 'pc-leg c1' }), `C' — a 2d = ${num(2 * p.d, 1)} cm`),
    ...(p.C2 ? [h('span', {}, h('i', { class: 'pc-leg c2' }), `C'' — a ${num(p.C2.distancia, 1)} cm`)] : []),
    ...(p.armadura ? [h('span', {}, h('i', { class: 'pc-leg conector' }), `Conectores ø ${num(p.armadura.phi, 1)}`)] : []),
  );
}

/** Tabela C / C' / C'' de uma verificação. */
export function tabelaPuncao(api, p) {
  const ui = api.ui;
  const { num } = api.formatar;
  const linhas = [
    ['C — compressão diagonal', num(p.C.u, 1), num(p.C.tauSd, 3), `τRd2 = ${num(p.C.tauRd, 3)}`, ui.selo(p.C.ok)],
    [`C' — ${p.armadura ? 'com armadura de punção' : 'sem armadura de punção'}`, num(p.C1.u, 1), num(p.C1.tauSd, 3), `${p.armadura ? 'τRd3' : 'τRd1'} = ${num(p.C1.tauRd, 3)}`, ui.selo(p.armadura ? p.C1.ok : p.C1.dispensa)],
  ];
  if (p.C2) linhas.push([`C'' — a ${num(p.C2.distancia, 1)} cm da face`, num(p.C2.u, 1), num(p.C2.tauSd, 3), `τRd1 = ${num(p.C2.tauRd, 3)}`, ui.selo(p.C2.ok)]);
  return ui.tabela({
    classe: 'els-tabela',
    colunas: [{ titulo: 'Contorno' }, { titulo: 'u (cm)', alinhar: 'dir' }, { titulo: 'τSd (MPa)', alinhar: 'dir' }, { titulo: 'Resistente (MPa)', alinhar: 'dir' }, { titulo: '' }],
    linhas,
  });
}
