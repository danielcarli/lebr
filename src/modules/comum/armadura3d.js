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
 * Geometria 3D da armadura de UM elemento (0.32), a partir da lista de ferros do detalhamento — para a vista isolada
 * na tela da viga, do pilar ou da laje (a visualização 3D do edifício continua sem armaduras).
 *
 * Unidades em cm. Eixos: x ao longo da viga (ou bx no pilar, lx na laje), y na largura (by, ly) e z para cima.
 * Saída: { caixas: [{ min:[x,y,z], max:[x,y,z], tipo }], barras: [{ id, N, tipo, phi, pts: [[x,y,z], …] }] }.
 * Cada barra é uma linha poligonal pelo eixo (com ganchos e dobras); a vista desenha um tubo de diâmetro ø.
 */

const r1 = (v) => Math.round(v * 10) / 10;
/** distribui n pontos entre a e b (um só: no meio) */
const espalhar = (n, a, b) => (n <= 1 ? [(a + b) / 2] : Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1)));

/**
 * Viga: posições do detalhamento (x0, x1 em m ao longo do eixo; face inferior, superior ou lateral; estribos por trecho).
 * @param {{secao:{b,h}}} el
 * @param {{limites:number[]}} det
 * @param {object[]} posicoes  lista de ferros (com as edições aplicadas)
 * @param {{cob?:number}} [op]
 */
export function modeloViga(el, det, posicoes, { cob = 3 } = {}) {
  const b = el.secao?.b ?? 20, h = el.secao?.h ?? 40;
  const est = posicoes.find((q) => q.tipo === 'estribo');
  const phiT = (est?.phi ?? 5) / 10;
  const [l0, l1] = det.limites ?? [0, (el.vaos ?? []).reduce((s, v) => s + v.L, 0)];
  const caixas = [{ min: [r1(l0 * 100 - cob), 0, 0], max: [r1(l1 * 100 + cob), b, h], tipo: 'concreto' }];
  const barras = [];
  // faixas ao longo da largura: posições do mesmo lado que se sobrepõem em x não usam as mesmas barras
  const porFace = { inferior: [], superior: [] };
  for (const q of posicoes) if (porFace[q.face]) porFace[q.face].push(q);
  for (const [face, lista] of Object.entries(porFace)) {
    const ordem = [...lista].sort((p, q) => (q.corrida ? 1 : 0) - (p.corrida ? 1 : 0) || q.n - p.n);
    const colocadas = [];
    for (const q of ordem) {
      const sobre = colocadas.filter((c) => c.q.x0 < q.x1 - 1e-6 && q.x0 < c.q.x1 - 1e-6);
      let ini = 0;
      while (sobre.some((c) => ini < c.ini + c.q.n && c.ini < ini + q.n)) ini++;
      colocadas.push({ q, ini });
    }
    const total = Math.max(2, ...colocadas.map((c) => c.ini + c.q.n));
    for (const { q, ini } of colocadas) {
      const phi = q.phi / 10;
      const y0 = cob + phiT + phi / 2, y1 = b - cob - phiT - phi / 2;
      const ys = espalhar(total, y0, y1);
      const z = face === 'inferior' ? cob + phiT + phi / 2 : h - cob - phiT - phi / 2;
      const sobe = face === 'inferior' ? 1 : -1;  // gancho para dentro da seção
      const gancho = Math.min(10 * phi, h - 2 * cob - 2 * phiT - phi);
      const xa = q.x0 * 100, xb = q.x1 * 100;
      for (let k = 0; k < q.n; k++) {
        const y = ys[Math.min(ys.length - 1, ini + k)];
        const pts = [];
        if (q.gancho?.[0]) pts.push([xa, y, z + sobe * gancho]);
        pts.push([xa, y, z], [xb, y, z]);
        if (q.gancho?.[1]) pts.push([xb, y, z + sobe * gancho]);
        barras.push({ id: q.id, N: q.N, tipo: q.tipo, phi: q.phi, pts });
      }
    }
  }
  // laterais (pele e torção): metade de cada lado, espaçadas na altura
  for (const q of posicoes.filter((p) => p.face === 'lateral')) {
    const phi = q.phi / 10, porLado = Math.max(1, Math.round(q.n / 2));
    const zs = espalhar(porLado + 2, cob + phiT, h - cob - phiT).slice(1, -1);
    for (const y of [cob + phiT + phi / 2, b - cob - phiT - phi / 2]) {
      for (const z of zs) barras.push({ id: q.id, N: q.N, tipo: q.tipo, phi: q.phi, pts: [[q.x0 * 100, y, z], [q.x1 * 100, y, z]] });
    }
  }
  // estribos: um retângulo pelo eixo da barra a cada s, em cada trecho
  for (const q of posicoes.filter((p) => p.tipo === 'estribo')) {
    const c = cob + q.phi / 20;
    for (const t of q.trechos ?? []) {
      const n = Math.max(1, Math.round(t.qtd ?? 1));
      for (let i = 0; i < n; i++) {
        const x = Math.min(t.x1 * 100, t.x0 * 100 + i * t.s);
        barras.push({ id: q.id, N: q.N, tipo: 'estribo', phi: q.phi, pts: [[x, c, c], [x, b - c, c], [x, b - c, h - c], [x, c, h - c], [x, c, c]] });
      }
    }
  }
  return { caixas, barras, eixos: { x: 'eixo da viga', y: 'b', z: 'h' }, vista: { teta: -Math.PI / 2 + 0.55, fi: 1.25 } };
}

/**
 * Pilar: barras longitudinais nos pontos da seção (resultado.armadura.pontos), arranques, estribos e grampos.
 * z = 0 na base do lance.
 */
export function modeloPilar(el, det, posicoes, { pontos = [], cob = 3 } = {}) {
  const bx = el.bx ?? 20, by = el.by ?? 20, L = (el.comprimento ?? 3) * 100;
  const long = posicoes.find((q) => q.tipo === 'longitudinal');
  const arr = posicoes.find((q) => q.tipo === 'arranque');
  const est = posicoes.find((q) => q.tipo === 'estribo');
  const caixas = [{ min: [0, 0, 0], max: [bx, by, L], tipo: 'concreto' }];
  if (arr) {
    const emb = -arr.z0 * 100;
    caixas.push({ min: [-25, -25, -emb - 5], max: [bx + 25, by + 25, 0], tipo: 'apoio' });
  }
  if (det?.acima) caixas.push({ min: [0, 0, L], max: [bx, by, Math.max(L + 40, (long?.z1 ?? 0) * 100 + 10)], tipo: 'apoio' });
  const barras = [];
  const pts = pontos ?? [];
  if (long) for (const p of pts) barras.push({ id: long.id, N: long.N, tipo: 'longitudinal', phi: long.phi, pts: [[p.x, p.y, long.z0 * 100], [p.x, p.y, long.z1 * 100]] });
  if (arr) {
    const cx = bx / 2, cy = by / 2;
    for (const p of pts) {
      // o arranque fica encostado na barra do lance (deslocado meio ø para dentro), com o pé virado para fora
      const dx = Math.sign(p.x - cx) || 1, dy = Math.sign(p.y - cy) || 1;
      const off = arr.phi / 10;
      const x = p.x - dx * off * 0.6, y = p.y - dy * off * 0.6;
      const linha = [[x, y, arr.z1 * 100], [x, y, arr.z0 * 100]];
      if (arr.pe) linha.push([x + dx * arr.pe, y, arr.z0 * 100]);
      barras.push({ id: arr.id, N: arr.N, tipo: 'arranque', phi: arr.phi, pts: linha });
    }
  }
  if (est?.s) {
    const c = cob + est.phi / 20;
    for (let z = 5; z <= L - 2; z += est.s) barras.push({ id: est.id, N: est.N, tipo: 'estribo', phi: est.phi, pts: [[c, c, z], [bx - c, c, z], [bx - c, by - c, z], [c, by - c, z], [c, c, z]] });
    for (const g of posicoes.filter((q) => q.tipo === 'suplementar')) {
      const gr = g.grampo;
      if (!gr) continue;
      for (let z = 5 + est.s / 2; z <= L - 2; z += est.s) {
        const [a, bb] = gr.eixo === 'y' ? [[gr.em, gr.de], [gr.em, gr.ate]] : [[gr.de, gr.em], [gr.ate, gr.em]];
        barras.push({ id: g.id, N: g.N, tipo: 'suplementar', phi: g.phi, pts: [[a[0], a[1], z], [bb[0], bb[1], z]] });
      }
    }
  }
  return { caixas, barras, eixos: { x: 'bx', y: 'by', z: 'altura' }, vista: { teta: -Math.PI / 3, fi: 1.3 } };
}

/**
 * Laje maciça: malhas positivas (x por baixo, y por cima dela), negativas nas bordas com as dobras e a distribuição.
 * Coordenadas da planta: (0,0) no canto x0/y0; a e b, de e ate em m; t0, t1 em m ao longo da borda; a1, a2 em cm.
 */
export function modeloLaje(el, det, posicoes, { cob = 2.5 } = {}) {
  const lx = (el.lx ?? 4) * 100, ly = (el.ly ?? 4) * 100, h = el.h ?? 10;
  const caixas = [{ min: [0, 0, 0], max: [lx, ly, h], tipo: 'concreto' }];
  const barras = [];
  const posX = posicoes.find((q) => q.tipo === 'positiva' && q.dir === 'x');
  const phiX = (posX?.phi ?? 0) / 10;
  for (const q of posicoes.filter((p) => p.tipo === 'positiva')) {
    const phi = q.phi / 10;
    const z = q.dir === 'x' ? cob + phi / 2 : cob + phiX + phi / 2;
    const n = Math.max(1, Math.round(q.n));
    const cs = espalhar(n, q.de * 100, q.ate * 100);
    for (const c of cs) {
      const pts = q.dir === 'x' ? [[q.a * 100, c, z], [q.b * 100, c, z]] : [[c, q.a * 100, z], [c, q.b * 100, z]];
      barras.push({ id: q.id, N: q.N, tipo: 'positiva', phi: q.phi, pts });
    }
  }
  const dobra = det?.dobra ?? Math.max(5, h - 2 * cob);
  for (const q of posicoes.filter((p) => p.tipo === 'negativa')) {
    const phi = q.phi / 10;
    const z = h - cob - phi / 2;
    const n = Math.max(1, Math.round(q.n));
    const ts = espalhar(n, q.t0 * 100 + cob, q.t1 * 100 - cob);
    // trecho atravessando a borda: [início, fim] na direção da barra
    const [u0, u1] = { x0: [-q.a2, q.a1], x1: [lx - q.a1, lx + q.a2], y0: [-q.a2, q.a1], y1: [ly - q.a1, ly + q.a2] }[q.borda] ?? [0, 0];
    const baixo = z - Math.min(dobra, h - 2 * cob);
    for (const t of ts) {
      const P = (u, zz) => (q.dir === 'x' ? [u, t, zz] : [t, u, zz]);
      barras.push({ id: q.id, N: q.N, tipo: 'negativa', phi: q.phi, pts: [P(u0, baixo), P(u0, z), P(u1, z), P(u1, baixo)] });
    }
  }
  for (const q of posicoes.filter((p) => p.tipo === 'distribuição')) {
    const phi = q.phi / 10;
    const zNeg = h - cob - 1;               // logo abaixo das negativas
    const z = zNeg - phi / 2 - 0.5;
    const n = Math.max(1, Math.round(q.n));
    const [u0, u1] = { x0: [-q.a2, q.a1], x1: [lx - q.a1, lx + q.a2], y0: [-q.a2, q.a1], y1: [ly - q.a1, ly + q.a2] }[q.borda] ?? [0, 0];
    const us = espalhar(n, u0 + 3, u1 - 3);
    const t0 = q.t0 * 100 + cob, t1 = q.t1 * 100 - cob;
    for (const u of us) {
      // perpendicular às negativas: corre ao longo da borda
      const pts = q.dir === 'y' ? [[u, t0, z], [u, t1, z]] : [[t0, u, z], [t1, u, z]];
      barras.push({ id: q.id, N: q.N, tipo: 'distribuição', phi: q.phi, pts });
    }
  }
  return { caixas, barras, eixos: { x: 'lx', y: 'ly', z: 'h' } };
}

/** Caixa que envolve o modelo (para enquadrar a câmera). */
export function limitesDoModelo(m) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const pts = [...m.caixas.flatMap((c) => [c.min, c.max]), ...m.barras.flatMap((b) => b.pts)];
  for (const p of pts) for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], p[i]); max[i] = Math.max(max[i], p[i]); }
  return { min, max };
}
