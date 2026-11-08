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
 * Análise linear de vigas contínuas pelo método dos deslocamentos
 * (elementos de viga de Euler-Bernoulli, 2 GL por nó: v, θ).
 *
 * Unidades: comprimentos em m, cargas em kN e kN/m, EI em kN·m².
 * Convenção de saída: M > 0 traciona a face inferior; deslocamento v > 0 para baixo.
 */
import { resolverDenso } from './algebra.js';

/**
 * @typedef {object} ModeloViga
 * @property {number[]} vaos         comprimento de cada vão (m)
 * @property {string[]} apoios       vínculo em cada apoio: 'apoio' | 'engaste' | 'livre' (vaos.length + 1)
 * @property {number[]} q            carga uniforme total por vão (kN/m, para baixo)
 * @property {{vao:number,x:number,P:number}[]} P  cargas concentradas (kN, para baixo)
 * @property {number[]} EI           rigidez por vão (kN·m²)
 */

/** @param {ModeloViga} m */
export function analisarViga(m, { amostrasPorVao = 40 } = {}) {
  const nv = m.vaos.length;
  if (m.apoios.length !== nv + 1) throw new Error('Número de apoios deve ser número de vãos + 1.');

  // 1. Nós: extremidades dos vãos + pontos de carga concentrada
  const nos = [];           // {x, apoio?: índice do apoio}
  const elems = [];         // {i, j, L, w, EI, vao, x0}
  let x0 = 0;
  for (let v = 0; v < nv; v++) {
    const L = m.vaos[v];
    const pts = new Set([0, L]);
    for (const c of m.P ?? []) if (c.vao === v && c.x > 1e-9 && c.x < L - 1e-9) pts.add(+c.x.toFixed(6));
    const ord = [...pts].sort((a, b) => a - b);
    const ids = ord.map((xl, k) => {
      if (k === 0 && v > 0) return nos.length - 1; // nó compartilhado com o vão anterior
      nos.push({ x: x0 + xl, apoio: k === 0 ? v : k === ord.length - 1 ? v + 1 : null });
      return nos.length - 1;
    });
    for (let k = 0; k < ord.length - 1; k++) {
      elems.push({ i: ids[k], j: ids[k + 1], L: ord[k + 1] - ord[k], w: m.q[v] ?? 0, EI: m.EI[v], vao: v, x0: x0 + ord[k] });
    }
    x0 += L;
  }

  const ngl = nos.length * 2;
  const K = Array.from({ length: ngl }, () => new Array(ngl).fill(0));
  const F = new Array(ngl).fill(0);

  // 2. Montagem (v para cima no sistema interno)
  for (const e of elems) {
    const ke = rigidezElemento(e.EI, e.L);
    const g = [2 * e.i, 2 * e.i + 1, 2 * e.j, 2 * e.j + 1];
    for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) K[g[a]][g[b]] += ke[a][b];
    const fe = engastePerfeito(e.w, e.L);
    for (let a = 0; a < 4; a++) F[g[a]] -= fe[a];
  }
  for (const c of m.P ?? []) {
    const xg = m.vaos.slice(0, c.vao).reduce((s, l) => s + l, 0) + c.x;
    const n = nos.findIndex((no) => Math.abs(no.x - xg) < 1e-6);
    F[2 * n] -= c.P;
  }

  // 3. Condições de contorno
  const presos = new Set();
  nos.forEach((no, k) => {
    if (no.apoio == null) return;
    const t = m.apoios[no.apoio];
    if (t === 'apoio' || t === 'engaste') presos.add(2 * k);
    if (t === 'engaste') presos.add(2 * k + 1);
  });
  const livres = [...Array(ngl).keys()].filter((g) => !presos.has(g));
  const Kr = livres.map((a) => livres.map((b) => K[a][b]));
  const Fr = livres.map((a) => F[a]);
  const dr = livres.length ? resolverDenso(Kr, Fr) : [];
  const d = new Array(ngl).fill(0);
  livres.forEach((g, k) => { d[g] = dr[k]; });

  // 4. Reações
  const reacoes = m.apoios.map(() => ({ V: 0, M: 0 }));
  nos.forEach((no, k) => {
    if (no.apoio == null) return;
    const r = reacao(2 * k);
    const rm = reacao(2 * k + 1);
    if (presos.has(2 * k)) reacoes[no.apoio].V += r;
    if (presos.has(2 * k + 1)) reacoes[no.apoio].M += rm;
  });
  function reacao(g) {
    let s = 0;
    for (let j = 0; j < ngl; j++) s += K[g][j] * d[j];
    return s - F[g];
  }

  // 5. Esforços internos e deslocamentos amostrados
  const pontos = [];
  for (const e of elems) {
    const ke = rigidezElemento(e.EI, e.L);
    const de = [d[2 * e.i], d[2 * e.i + 1], d[2 * e.j], d[2 * e.j + 1]];
    const fe = engastePerfeito(e.w, e.L);
    const f = ke.map((row, a) => row.reduce((s, kv, b) => s + kv * de[b], 0) + fe[a]);
    const F1 = f[0], M1 = f[1];
    const Lv = m.vaos[e.vao];
    const n = Math.max(2, Math.ceil((amostrasPorVao * e.L) / Lv));
    for (let s = 0; s <= n; s++) {
      const x = (e.L * s) / n;
      const V = F1 - e.w * x;
      const M = -M1 + F1 * x - (e.w * x * x) / 2;
      const ξ = x / e.L, L = e.L;
      const N1 = 1 - 3 * ξ ** 2 + 2 * ξ ** 3, N2 = L * (ξ - 2 * ξ ** 2 + ξ ** 3);
      const N3 = 3 * ξ ** 2 - 2 * ξ ** 3, N4 = L * (-(ξ ** 2) + ξ ** 3);
      const vHom = N1 * de[0] + N2 * de[1] + N3 * de[2] + N4 * de[3];
      const vPart = -(e.w * x * x * (L - x) ** 2) / (24 * e.EI);
      pontos.push({ x: e.x0 + x, vao: e.vao, V, M, v: -(vHom + vPart) });
    }
  }

  // 6. Resumo por vão
  const vaos = m.vaos.map((L, v) => {
    const p = pontos.filter((q) => q.vao === v);
    const Mpos = Math.max(0, ...p.map((q) => q.M));
    const Mneg = Math.min(0, ...p.map((q) => q.M));
    const Vmax = Math.max(...p.map((q) => Math.abs(q.V)));
    const fl = p.reduce((a, q) => (Math.abs(q.v) > Math.abs(a.v) ? q : a), p[0]);
    return { L, Mpos, Mneg, Vmax, flecha: fl.v, xFlecha: fl.x };
  });

  return { nos, elems, pontos, reacoes, vaos, comprimento: x0 };
}

function rigidezElemento(EI, L) {
  const k = EI / L ** 3;
  return [
    [12 * k, 6 * L * k, -12 * k, 6 * L * k],
    [6 * L * k, 4 * L * L * k, -6 * L * k, 2 * L * L * k],
    [-12 * k, -6 * L * k, 12 * k, -6 * L * k],
    [6 * L * k, 2 * L * L * k, -6 * L * k, 4 * L * L * k],
  ];
}

/** Reações de engastamento perfeito para carga uniforme w (para baixo). */
function engastePerfeito(w, L) {
  return [(w * L) / 2, (w * L * L) / 12, (w * L) / 2, -(w * L * L) / 12];
}
