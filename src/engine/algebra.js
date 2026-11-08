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
 * Álgebra linear mínima para os solvers do motor.
 */

/** Resolve A·x = b por eliminação de Gauss com pivotamento parcial (A densa, n×n). */
export function resolverDenso(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
    if (Math.abs(M[p][k]) < 1e-12) throw new Error('Sistema singular: estrutura hipostática ou mal vinculada.');
    [M[k], M[p]] = [M[p], M[k]];
    for (let i = k + 1; i < n; i++) {
      const f = M[i][k] / M[k][k];
      if (f === 0) continue;
      for (let j = k; j <= n; j++) M[i][j] -= f * M[k][j];
    }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = M[i][n];
    for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
    x[i] = s / M[i][i];
  }
  return x;
}

/**
 * Matriz em banda armazenada como linhas compactas: guarda A[i][j] para |i−j| ≤ bw.
 * Usada pelo solver de placas (elementos finitos), onde n pode passar de 1000.
 */
export class MatrizBanda {
  constructor(n, bw) {
    this.n = n; this.bw = bw; this.w = 2 * bw + 1;
    this.d = new Float64Array(n * this.w);
  }
  add(i, j, v) {
    const k = j - i + this.bw;
    if (k < 0 || k >= this.w) throw new Error('Fora da banda');
    this.d[i * this.w + k] += v;
  }
  get(i, j) {
    const k = j - i + this.bw;
    return k < 0 || k >= this.w ? 0 : this.d[i * this.w + k];
  }
  /** Eliminação de Gauss sem pivotamento (adequada a matrizes simétricas definidas positivas). */
  resolver(b) {
    const { n, bw, w, d } = this;
    const A = Float64Array.from(d);
    const x = Float64Array.from(b);
    const at = (i, j) => i * w + (j - i + bw);
    for (let k = 0; k < n; k++) {
      const piv = A[at(k, k)];
      if (Math.abs(piv) < 1e-14) throw new Error('Sistema singular na análise de placa.');
      const iMax = Math.min(n - 1, k + bw);
      for (let i = k + 1; i <= iMax; i++) {
        const f = A[at(i, k)] / piv;
        if (f === 0) continue;
        const jMax = Math.min(n - 1, k + bw);
        for (let j = k; j <= jMax; j++) A[at(i, j)] -= f * A[at(k, j)];
        x[i] -= f * x[k];
      }
    }
    for (let i = n - 1; i >= 0; i--) {
      let s = x[i];
      const jMax = Math.min(n - 1, i + bw);
      for (let j = i + 1; j <= jMax; j++) s -= A[at(i, j)] * x[j];
      x[i] = s / A[at(i, i)];
    }
    return x;
  }
}
