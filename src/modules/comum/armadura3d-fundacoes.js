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
 * Armadura em 3D das fundações: sapata isolada, bloco sobre estacas, estaca, sapata corrida e radier. Mesmo formato
 * dos modelos de armadura3d.js — { caixas, barras, legenda } em cm, z para cima — com a geometria tirada do
 * resultado do cálculo e as bitolas e quantidades da lista de ferros (já com as edições).
 */
import { pernaGancho90 } from '../../engine/detalhamento.js';
import { eixoEstriboRetangular, eixoEstriboCircular } from './armadura3d.js';

const espalhar = (n, a, b) => (n <= 1 ? [(a + b) / 2] : Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1)));
const virg = (v, c = 0) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');
const pos = (posicoes, id) => posicoes.find((q) => q.id === id || q.id?.startsWith?.(`${id}`));

/** Toco do pilar sobre a fundação (só para referência). */
const tocoPilar = (cx, cy, ap, bp, z0, alt = 40) => ({ min: [cx - ap / 2, cy - bp / 2, z0], max: [cx + ap / 2, cy + bp / 2, z0 + alt], tipo: 'apoio' });

/**
 * Barra reta com gancho a 90° nas duas pontas (subindo, sinal +1, ou descendo, −1).
 * @param {number[]} p0 @param {number[]} p1  pontas da parte reta
 */
function comGanchos(p0, p1, gancho, sinal = 1, phi = 0) {
  // as pontas chegam no cobrimento: o eixo da perna fica a ø/2 para dentro
  const L = Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]) || 1;
  const d = [0, 1, 2].map((i) => ((p1[i] - p0[i]) / L) * (phi / 2));
  const a = p0.map((v, i) => v + d[i]), b = p1.map((v, i) => v - d[i]);
  if (!(gancho > 0)) return [a, b];
  return [[a[0], a[1], a[2] + sinal * gancho], a, b, [b[0], b[1], b[2] + sinal * gancho]];
}
/** Perna do gancho a 90° (9.4.2.3, pino da Tabela 9.1) limitada ao espaço disponível (cm). */
const perna90 = (phiMm, espaco) => Math.max(0, Math.min(pernaGancho90(phiMm), espaco));

/* ------------------------------------------------------------------ sapata isolada */

/**
 * Sapata: base de altura h0, tronco de pirâmide até h no topo (pilar + 2,5 cm de folga de cada lado), malhas de
 * face a face com gancho subindo nas duas pontas.
 */
export function modeloSapata(r, posicoes) {
  const { A, B, h, ap, bp } = r;
  const h0 = Math.min(r.h0 ?? h, h), cob = r.cobrimento ?? 5;
  const a0 = Math.min(A, ap + 5), b0 = Math.min(B, bp + 5);
  const caixas = [{ min: [0, 0, 0], max: [A, B, h0], tipo: 'concreto' }];
  if (h > h0 + 0.5) caixas.push({ forma: 'tronco', min: [0, 0, h0], max: [A, B, h], topo: [(A - a0) / 2, (B - b0) / 2, (A + a0) / 2, (B + b0) / 2], tipo: 'concreto' });
  caixas.push(tocoPilar(A / 2, B / 2, ap, bp, h));
  const barras = [];
  const qa = pos(posicoes, 'malha-a'), qb = pos(posicoes, 'malha-b');
  const phiA = (qa?.phi ?? 10) / 10;
  if (qa) {
    const phi = qa.phi / 10, z = cob + phi / 2, g = perna90(qa.phi, h0 - 2 * cob - phi);
    for (const y of espalhar(Math.max(1, Math.round(qa.n)), cob + phi / 2, B - cob - phi / 2)) barras.push({ id: qa.id, N: qa.N, tipo: 'positiva', phi: qa.phi, pts: comGanchos([cob, y, z], [A - cob, y, z], g, 1, phi) });
  }
  if (qb) {
    const phi = qb.phi / 10, z = cob + phiA + phi / 2, g = perna90(qb.phi, h0 - 2 * cob - phi);
    for (const x of espalhar(Math.max(1, Math.round(qb.n)), cob + phi / 2, A - cob - phi / 2)) barras.push({ id: qb.id, N: qb.N, tipo: 'distribuição', phi: qb.phi, pts: comGanchos([x, cob, z], [x, B - cob, z], g, 1, phi) });
  }
  return {
    caixas, barras, eixos: { x: 'A', y: 'B', z: 'h' }, vista: { teta: -Math.PI / 3.2, fi: 1.05 },
    legenda: `Sapata ${virg(A)} × ${virg(B)} cm, h = ${virg(h)} cm e h0 = ${virg(h0)} cm · malhas de face a face com ganchos a 90° · cobrimento ${virg(cob, 1)} cm · o toco cinza é o pilar`,
  };
}

/* ------------------------------------------------------------------ estaca (gaiola) */

/** Gaiola de uma estaca de diâmetro D (cm), centro (cx, cy), topo em zTopo: barras e estribos circulares. */
function gaiola(barras, posicoes, { cx, cy, D, zTopo, zFim, cob = 5, porEstaca = 1, idx = 0 }) {
  const ql = pos(posicoes, 'estaca-long'), qe = pos(posicoes, 'estaca-estribo');
  if (!ql) return;
  const phiT = (qe?.phi ?? 6.3) / 10, phi = ql.phi / 10;
  const R = D / 2 - cob - phiT - phi / 2;
  const n = Math.max(1, Math.round(ql.n / porEstaca));
  const espera = Math.max(0, (ql.comprimento ?? 0) - (ql.Larm ?? 0));
  for (let k = 0; k < n; k++) {
    const a = (2 * Math.PI * k) / n + Math.PI / 2;
    const x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
    barras.push({ id: ql.id, N: ql.N, tipo: 'longitudinal', phi: ql.phi, pts: [[x, y, zTopo], [x, y, zFim]] });
  }
  void espera; void idx;
  if (qe) {
    const s = qe.s ?? 15;
    const Re = D / 2 - cob - phiT / 2;
    for (let z = Math.min(zTopo, 0) - 5; z >= zFim + 2; z -= s) {
      barras.push({ id: qe.id, N: qe.N, tipo: 'estribo', phi: qe.phi, pts: eixoEstriboCircular(cx, cy, Re, qe.phi).map(([u, v, w]) => [u, v, z + w]) });
    }
  }
}

/**
 * Estaca isolada: o fuste inteiro (ou os primeiros 6 m, se for mais longa) e a gaiola do trecho armado, com a espera
 * acima da cota de arrasamento.
 */
export function modeloEstaca(el, r, posicoes, { cob = 5 } = {}) {
  const D = el.D ?? 40, L = (el.L ?? 8) * 100;
  const ql = pos(posicoes, 'estaca-long'), qe = pos(posicoes, 'estaca-estribo');
  const Larm = (r?.armadura?.Larm ?? 0) * 100 || (ql ? Math.max(0, ql.comprimento - 60) : 0);
  const espera = r?.armadura?.espera ?? (ql ? Math.max(0, ql.comprimento - Larm) : 0);
  const mostrar = Math.min(L, Math.max(Larm + 100, 300), 600);
  const caixas = [{ forma: 'cilindro', min: [-D / 2, -D / 2, -mostrar], max: [D / 2, D / 2, 0], tipo: 'concreto' }];
  const barras = [];
  if (ql) {
    gaiola(barras, posicoes.map((q) => (q.id === 'estaca-long' ? { ...q, Larm } : q)), { cx: 0, cy: 0, D, zTopo: espera, zFim: -Larm, cob });
    // os estribos só no trecho armado (abaixo do arrasamento)
    for (let i = barras.length - 1; i >= 0; i--) if (barras[i].tipo === 'estribo' && barras[i].pts[0][2] > 0) barras.splice(i, 1);
  }
  void qe;
  return {
    caixas, barras, eixos: { x: '', y: '', z: '' }, vista: { teta: -Math.PI / 4, fi: 1.25 },
    legenda: `Estaca ø ${virg(D)} cm${L > mostrar ? `, mostrados os ${virg(mostrar / 100, 1)} m de cima (de ${virg(L / 100, 1)} m)` : `, ${virg(L / 100, 1)} m`} · ${ql ? `${virg(Larm / 100, 1)} m armados e ${virg(espera)} cm de espera acima do arrasamento` : 'sem armadura calculada'}`,
  };
}

/* ------------------------------------------------------------------ bloco sobre estacas */

/**
 * Bloco: o bloco, as estacas (1,5 m de cada, entrando 10 cm no bloco) com a gaiola, os tirantes sobre as estacas com
 * as pernas subindo pelas faces, a malha de distribuição, a armadura superior, a pele, os estribos verticais, a
 * suspensão e, no bloco de uma estaca, os estribos horizontais.
 */
export function modeloBloco(r, posicoes) {
  const { A, B, h, ap, bp } = r;
  const cob = r.cobrimento ?? 5, D = r.estaca?.D ?? 30;
  const Lmostra = 150, emb = 10;
  const estacas = (r.pos ?? []).map((p) => [A / 2 + p.x, B / 2 + p.y]);
  const caixas = [{ min: [0, 0, 0], max: [A, B, h], tipo: 'concreto' }, tocoPilar(A / 2, B / 2, ap, bp, h)];
  for (const [x, y] of estacas) caixas.push({ forma: 'cilindro', min: [x - D / 2, y - D / 2, -Lmostra], max: [x + D / 2, y + D / 2, emb], tipo: 'apoio' });
  const barras = [];
  const perna = Math.max(20, h - 2 * cob - 5);
  // tirantes: faixas sobre as linhas (ou colunas) de estacas
  const linhas = (k) => [...new Set(estacas.map((p) => Math.round(p[k])))].sort((a, b) => a - b);
  let zTirX = 0;
  const qx = pos(posicoes, 'tirante-x'), qy = pos(posicoes, 'tirante-y');
  if (qx) {
    const phi = qx.phi / 10, z = cob + phi / 2;
    zTirX = phi;
    if (r.armadura?.tipo === 'lados' && estacas.length === 3) {
      // triângulo: barras sobre os três lados
      const porLado = Math.max(1, Math.round(qx.n / 3));
      for (let i = 0; i < 3; i++) {
        const [p, q] = [estacas[i], estacas[(i + 1) % 3]];
        const L = Math.hypot(q[0] - p[0], q[1] - p[1]), ux = (q[0] - p[0]) / L, uy = (q[1] - p[1]) / L;
        for (const o of espalhar(porLado, -D / 3, D / 3)) {
          const a = [p[0] - ux * D / 2 - uy * o, p[1] - uy * D / 2 + ux * o, z], b = [q[0] + ux * D / 2 - uy * o, q[1] + uy * D / 2 + ux * o, z];
          barras.push({ id: qx.id, N: qx.N, tipo: 'positiva', phi: qx.phi, pts: [a, b] });
        }
      }
    } else {
      const ys = linhas(1), por = Math.max(1, Math.round(qx.n / ys.length));
      for (const yl of ys) for (const y of espalhar(por, Math.max(cob, yl - D / 2), Math.min(B - cob, yl + D / 2))) barras.push({ id: qx.id, N: qx.N, tipo: 'positiva', phi: qx.phi, pts: comGanchos([cob, y, z], [A - cob, y, z], perna, 1, qx.phi / 10) });
    }
  }
  if (qy) {
    const phi = qy.phi / 10, z = cob + zTirX + phi / 2;
    const xs = linhas(0), por = Math.max(1, Math.round(qy.n / xs.length));
    for (const xl of xs) for (const x of espalhar(por, Math.max(cob, xl - D / 2), Math.min(A - cob, xl + D / 2))) barras.push({ id: qy.id, N: qy.N, tipo: 'positiva', phi: qy.phi, pts: comGanchos([x, cob, z], [x, B - cob, z], perna, 1, phi) });
  }
  // malhas de distribuição
  for (const [id, dir] of [['malha-x', 'x'], ['malha-y', 'y']]) {
    const q = pos(posicoes, id);
    if (!q) continue;
    const phi = q.phi / 10, z = cob + zTirX + 2 + phi / 2 + (dir === 'y' ? phi : 0), g = perna90(q.phi, h - z - cob - phi / 2);
    const L = dir === 'x' ? A : B, W = dir === 'x' ? B : A;
    for (const c of espalhar(Math.max(1, Math.round(q.n)), cob, W - cob)) {
      barras.push({ id: q.id, N: q.N, tipo: 'distribuição', phi: q.phi, pts: dir === 'x' ? comGanchos([cob, c, z], [L - cob, c, z], g, 1, phi) : comGanchos([c, cob, z], [c, L - cob, z], g, 1, phi) });
    }
  }
  // superior (ganchos descendo) e pele nas duas faces
  const qs = pos(posicoes, 'superior');
  if (qs) {
    const phi = qs.phi / 10, z = h - cob - phi / 2;
    for (const y of espalhar(Math.max(1, Math.round(qs.n)), cob + 3, B - cob - 3)) barras.push({ id: qs.id, N: qs.N, tipo: 'construtiva', phi: qs.phi, pts: comGanchos([cob, y, z], [A - cob, y, z], perna, -1, phi) });
  }
  const qp = pos(posicoes, 'pele');
  if (qp) {
    const phi = qp.phi / 10, porFace = Math.max(1, Math.round(qp.n / 2));
    const zs = espalhar(porFace + 2, cob, h - cob).slice(1, -1);
    const g = perna90(qp.phi, B / 2 - cob - phi);
    for (const y of [cob + 1 + phi / 2, B - cob - 1 - phi / 2]) for (const z of zs) {
      // armadura de pele com ganchos a 90° deitados, voltados para o miolo do bloco
      const dy = y < B / 2 ? g : -g, x0 = cob + phi / 2, x1 = A - cob - phi / 2;
      barras.push({ id: qp.id, N: qp.N, tipo: 'pele', phi: qp.phi, pts: [[x0, y + dy, z], [x0, y, z], [x1, y, z], [x1, y + dy, z]] });
    }
  }
  // estribos verticais (e de suspensão): no plano y–z, ao longo de A
  for (const id of ['estribo-vertical', 'suspensao']) {
    const q = pos(posicoes, id);
    if (!q) continue;
    const pt = q.phi / 10;
    let xs;
    if (id === 'suspensao' && estacas.length > 1) {
      const xsE = [...new Set(estacas.map((p) => p[0]))].sort((a, b) => a - b);
      const meio = (xsE[0] + xsE[xsE.length - 1]) / 2;
      xs = espalhar(Math.max(1, Math.round(q.n)), meio - 25, meio + 25);
    } else xs = espalhar(Math.max(1, Math.round(q.n)), cob + 3, A - cob - 3);
    for (const [k, x] of xs.entries()) {
      const eixo = eixoEstriboRetangular(cob + pt / 2, cob + pt / 2, B - cob - pt / 2, h - cob - pt / 2, pt * 1.5, q.phi, k % 2 ? 2 : 3);
      barras.push({ id: q.id, N: q.N, tipo: 'estribo', phi: q.phi, pts: eixo.map(([u, v, w]) => [x + w, u, v]) });
    }
  }
  // bloco sobre uma estaca: estribos horizontais fechados
  const qh = pos(posicoes, 'estribo-horizontal');
  if (qh) {
    const pt = qh.phi / 10;
    for (const [k, z] of espalhar(Math.max(1, Math.round(qh.n)), cob + 5, h - cob - 5).entries()) {
      const eixo = eixoEstriboRetangular(cob + pt / 2, cob + pt / 2, A - cob - pt / 2, B - cob - pt / 2, pt * 1.5, qh.phi, k % 4);
      barras.push({ id: qh.id, N: qh.N, tipo: 'estribo', phi: qh.phi, pts: eixo.map(([u, v, w]) => [u, v, z + w]) });
    }
  }
  // gaiola de cada estaca, com a espera dentro do bloco
  const ql = pos(posicoes, 'estaca-long');
  if (ql) {
    const espera = Math.min(h - cob - 5 - emb, r.armaduraEstaca?.espera ?? Math.max(30, ql.comprimento - (r.armaduraEstaca?.Larm ?? 0) * 100));
    for (const [i, [x, y]] of estacas.entries()) gaiola(barras, posicoes, { cx: x, cy: y, D, zTopo: emb + espera, zFim: -Lmostra + 5, cob: 5, porEstaca: estacas.length, idx: i });
  }
  return {
    caixas, barras, eixos: { x: 'A', y: 'B', z: 'h' }, vista: { teta: -Math.PI / 3.2, fi: 1.1 },
    legenda: `Bloco ${virg(A)} × ${virg(B)} × ${virg(h)} cm sobre ${estacas.length} estaca(s) ø ${virg(D)} cm (mostrados 1,5 m de cada, entrando 10 cm no bloco) · tirantes sobre as estacas com as pernas subindo pelas faces`,
  };
}

/* ------------------------------------------------------------------ sapata corrida */

/** Sapata corrida: um trecho de até 3 m (para enxergar), tronco transversal, barras transversais e longitudinais. */
export function modeloSapataCorrida(r, posicoes) {
  const { B, h, bw } = r;
  const h0 = Math.min(r.h0 ?? h, h), cob = r.cobrimento ?? 5;
  const L = Math.min(r.L * 100, 300);
  const b0 = Math.min(B, bw + 5);
  const caixas = [{ min: [0, 0, 0], max: [L, B, h0], tipo: 'concreto' }];
  if (h > h0 + 0.5) caixas.push({ forma: 'tronco', min: [0, 0, h0], max: [L, B, h], topo: [0, (B - b0) / 2, L, (B + b0) / 2], tipo: 'concreto' });
  caixas.push({ min: [0, (B - bw) / 2, h], max: [L, (B + bw) / 2, h + 40], tipo: 'apoio' });
  const barras = [];
  const qt = pos(posicoes, 'transversal'), ql = pos(posicoes, 'longitudinal');
  if (qt) {
    const phi = qt.phi / 10, z = cob + phi / 2, s = qt.s ?? 15, g = perna90(qt.phi, h0 - 2 * cob - phi);
    for (let x = cob; x <= L - cob + 0.1; x += s) barras.push({ id: qt.id, N: qt.N, tipo: 'positiva', phi: qt.phi, pts: comGanchos([x, cob, z], [x, B - cob, z], g, 1, phi) });
  }
  if (ql) {
    const phi = ql.phi / 10, z = cob + (qt?.phi ?? 10) / 10 + phi / 2;
    for (const y of espalhar(Math.max(1, Math.round(ql.n)), cob + 2, B - cob - 2)) barras.push({ id: ql.id, N: ql.N, tipo: 'distribuição', phi: ql.phi, pts: [[0, y, z], [L, y, z]] });
  }
  return {
    caixas, barras, eixos: { x: 'L', y: 'B', z: 'h' }, vista: { teta: -Math.PI / 3, fi: 1.05 },
    legenda: `Sapata corrida B = ${virg(B)} cm, h = ${virg(h)} cm, h0 = ${virg(h0)} cm${r.L * 100 > L ? ` · mostrado um trecho de ${virg(L / 100, 1)} m de ${virg(r.L, 2)} m` : ''} · barras transversais com ganchos e longitudinais de distribuição · em cinza, a parede ou viga apoiada`,
  };
}

/* ------------------------------------------------------------------ radier */

/** Radier: placa lx × ly × h, malhas inferior e superior nas duas direções, grampos de borda e os tocos dos pilares. */
export function modeloRadier(r, posicoes, { maxBarras = 160 } = {}) {
  const lx = r.lx * 100, ly = r.ly * 100, h = r.h, cob = r.cobrimento ?? 5;
  const caixas = [{ min: [0, 0, 0], max: [lx, ly, h], tipo: 'concreto' }];
  for (const p of r.pilares ?? []) caixas.push(tocoPilar(p.u * 100, p.v * 100, p.bx, p.by, h));
  const barras = [];
  let passo = 1;
  const malha = (id, dir, face, ordem) => {
    const q = pos(posicoes, id);
    if (!q) return;
    const phi = q.phi / 10;
    const z = face === 'inf' ? cob + phi / 2 + ordem * phi : h - cob - phi / 2 - ordem * phi;
    const L = dir === 'x' ? lx : ly, W = dir === 'x' ? ly : lx;
    const n = Math.max(1, Math.round(q.n));
    passo = Math.max(passo, Math.ceil(n / maxBarras));
    const cs = espalhar(n, cob, W - cob).filter((_, i) => i % passo === 0 || i === n - 1);
    const g = h - 2 * cob - 2;                          // pernas fechando na outra face
    for (const c of cs) {
      const p0 = dir === 'x' ? [cob, c, z] : [c, cob, z], p1 = dir === 'x' ? [L - cob, c, z] : [c, L - cob, z];
      barras.push({ id: q.id, N: q.N, tipo: face === 'inf' ? 'positiva' : 'negativa', phi: q.phi, pts: comGanchos(p0, p1, Math.min(g, 15 * phi), face === 'inf' ? 1 : -1, phi) });
    }
  };
  malha('inferior-x', 'x', 'inf', 0); malha('inferior-y', 'y', 'inf', 1);
  malha('superior-x', 'x', 'sup', 0); malha('superior-y', 'y', 'sup', 1);
  // grampos em U nas bordas
  const qg = pos(posicoes, 'grampo');
  if (qg) {
    const phi = qg.phi / 10, s = qg.s ?? 20, prof = 30;
    const z0 = cob + 2, z1 = h - cob - 2;
    const borda = (x0, y0, x1, y1, nx, ny) => {
      const Lb = Math.hypot(x1 - x0, y1 - y0);
      for (let t = 10; t <= Lb - 10; t += s * passo) {
        const x = x0 + ((x1 - x0) * t) / Lb, y = y0 + ((y1 - y0) * t) / Lb;
        barras.push({ id: qg.id, N: qg.N, tipo: 'construtiva', phi: qg.phi, pts: [[x + nx * prof, y + ny * prof, z0], [x, y, z0], [x, y, z1], [x + nx * prof, y + ny * prof, z1]] });
      }
    };
    const c = cob + phi / 2;
    borda(c, c, lx - c, c, 0, 1); borda(c, ly - c, lx - c, ly - c, 0, -1); borda(c, c, c, ly - c, 1, 0); borda(lx - c, c, lx - c, ly - c, -1, 0);
  }
  return {
    caixas, barras, eixos: { x: 'lx', y: 'ly', z: 'h' }, vista: { teta: -Math.PI / 3, fi: 0.95 },
    legenda: `Radier ${virg(r.lx, 2)} × ${virg(r.ly, 2)} m, h = ${virg(h)} cm · malha inferior (sob os pilares) e superior (nos vãos), grampos em U nas bordas${passo > 1 ? ` · barras mostradas de ${passo} em ${passo}` : ''} · tocos cinza: pilares`,
  };
}
