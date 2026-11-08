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
 * Placas retangulares delgadas (teoria de Kirchhoff) por elementos finitos.
 *
 * Elemento retangular de 4 nós e 12 graus de liberdade (Adini–Clough–Melosh):
 * em cada nó, o deslocamento w e as rotações θx = ∂w/∂y e θy = −∂w/∂x.
 * Cada borda pode ser apoiada, engastada ou livre (sem apoio), o que permite
 * lajes em balanço (NBR 6118, 14.7.3 — análise linear).
 *
 * Unidades: lx, ly em m; p em kN/m²; momentos em kN·m/m; reações em kN/m.
 * O solver trabalha com p = 1 e D = 1; os resultados são escalados depois.
 * Convenção: w > 0 no sentido da carga; momento > 0 traciona a face inferior.
 */
import { MatrizBanda, resolverDenso } from './algebra.js';

export const TIPOS_BORDA = ['apoiada', 'engastada', 'livre'];

/* ------------------------------------------------------------ elemento ACM */

// termos do polinômio: 1, x, y, x², xy, y², x³, x²y, xy², y³, x³y, xy³
const EXP = [[0, 0], [1, 0], [0, 1], [2, 0], [1, 1], [0, 2], [3, 0], [2, 1], [1, 2], [0, 3], [3, 1], [1, 3]];
const termo = (x, y, [a, b]) => x ** a * y ** b;
const dx = (x, y, [a, b]) => (a ? a * x ** (a - 1) * y ** b : 0);
const dy = (x, y, [a, b]) => (b ? b * x ** a * y ** (b - 1) : 0);
const dxx = (x, y, [a, b]) => (a > 1 ? a * (a - 1) * x ** (a - 2) * y ** b : 0);
const dyy = (x, y, [a, b]) => (b > 1 ? b * (b - 1) * x ** a * y ** (b - 2) : 0);
const dxy = (x, y, [a, b]) => (a && b ? a * b * x ** (a - 1) * y ** (b - 1) : 0);

/** Inversa de matriz pequena (Gauss-Jordan com pivotamento). */
function inversa(M) {
  const n = M.length;
  return Array.from({ length: n }, (_, j) => resolverDenso(M.map((r) => [...r]), Array.from({ length: n }, (_, i) => (i === j ? 1 : 0))))
    .reduce((inv, col, j) => { col.forEach((v, i) => { inv[i][j] = v; }); return inv; }, Array.from({ length: n }, () => new Array(n).fill(0)));
}

/**
 * Rigidez e carga nodal equivalente de um elemento a × b (D = 1, p = 1),
 * e a matriz que leva os 12 deslocamentos nodais aos coeficientes do polinômio.
 */
const gp = [-Math.sqrt(0.6), 0, Math.sqrt(0.6)], gw = [5 / 9, 8 / 9, 5 / 9];
function elementoACM(a, b, nu) {
  const nos = [[0, 0], [a, 0], [a, b], [0, b]];
  const C = [];
  for (const [x, y] of nos) {
    C.push(EXP.map((e) => termo(x, y, e)));
    C.push(EXP.map((e) => dy(x, y, e)));         // θx = ∂w/∂y
    C.push(EXP.map((e) => -dx(x, y, e)));        // θy = −∂w/∂x
  }
  const A = inversa(C);                           // coeficientes = A · u
  const Kp = Array.from({ length: 12 }, () => new Array(12).fill(0));
  const Fp = new Array(12).fill(0);
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const x = (a / 2) * (1 + gp[i]), y = (b / 2) * (1 + gp[j]), peso = gw[i] * gw[j] * (a / 2) * (b / 2);
      const kxx = EXP.map((e) => dxx(x, y, e)), kyy = EXP.map((e) => dyy(x, y, e)), kxy = EXP.map((e) => 2 * dxy(x, y, e));
      for (let r = 0; r < 12; r++) {
        Fp[r] += peso * termo(x, y, EXP[r]);
        for (let c = 0; c < 12; c++) {
          Kp[r][c] += peso * (kxx[r] * kxx[c] + kyy[r] * kyy[c] + nu * (kxx[r] * kyy[c] + kyy[r] * kxx[c]) + ((1 - nu) / 2) * kxy[r] * kxy[c]);
        }
      }
    }
  }
  // k = Aᵀ Kp A ; f = Aᵀ Fp
  const KA = Kp.map((row) => A[0].map((_, c) => row.reduce((s, v, k) => s + v * A[k][c], 0)));
  const k = A[0].map((_, r) => A[0].map((__, c) => A.reduce((s, row, m) => s + row[r] * KA[m][c], 0)));
  const f = A[0].map((_, r) => A.reduce((s, row, m) => s + row[r] * Fp[m], 0));
  /** Carga nodal equivalente para uma distribuição p(x, y) local (integração de Gauss 3 × 3). */
  const fDe = (p) => {
    const F = new Array(12).fill(0);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) {
      const x = (a / 2) * (1 + gp[i]), y = (b / 2) * (1 + gp[j]), peso = gw[i] * gw[j] * (a / 2) * (b / 2) * p(x, y);
      for (let r = 0; r < 12; r++) F[r] += peso * termo(x, y, EXP[r]);
    }
    return A[0].map((_, r) => A.reduce((s, row, m) => s + row[r] * F[m], 0));
  };
  return { k, f, A, fDe };
}

/** Curvaturas (wxx, wyy, wxy) num ponto local do elemento a partir dos deslocamentos. */
function curvaturas(A, ue, x, y) {
  const coef = A.map((row) => row.reduce((s, v, k) => s + v * ue[k], 0));
  let wxx = 0, wyy = 0, wxy = 0;
  EXP.forEach((e, i) => { wxx += coef[i] * dxx(x, y, e); wyy += coef[i] * dyy(x, y, e); wxy += coef[i] * dxy(x, y, e); });
  return { wxx, wyy, wxy };
}

/* ------------------------------------------------------------ análise */

const cache = new Map();

/**
 * Valida se os vínculos impedem o movimento de corpo rígido: é preciso ao
 * menos uma borda engastada ou duas bordas apoiadas.
 */
export function placaEstavel(bordas) {
  const v = Object.values(bordas);
  return v.includes('engastada') || v.filter((b) => b === 'apoiada').length >= 2;
}

/**
 * @param {object} p
 * @param {number} p.lx  vão na direção x (m)
 * @param {number} p.ly  vão na direção y (m)
 * @param {{x0:string,x1:string,y0:string,y1:string}} p.bordas  'apoiada' | 'engastada' | 'livre'
 * @param {number} [p.nu=0.2] coeficiente de Poisson
 * @param {number} [p.divisoes=24] divisões no menor vão
 * @param {object} [p.carga]  distribuição da carga (máximo 1): uniforme (padrão) ou
 *   { tipo: 'linear-y', base, topo, ate } — p(y) varia linearmente de `base` em y = 0 a `topo` em y = `ate` (m) e é nula
 *   acima de `ate` (pressão hidrostática: base 1, topo 0, ate = altura d'água; empuxo de terra: ate = ly)
 */
export function analisarPlaca({ lx, ly, bordas, nu = 0.2, divisoes = 24, carga = null }) {
  const chave = JSON.stringify([lx, ly, bordas, nu, divisoes, carga]);
  if (cache.has(chave)) return cache.get(chave);
  if (!placaEstavel(bordas)) throw new Error('Laje instável: são necessárias ao menos uma borda engastada ou duas bordas apoiadas.');

  const menor = Math.min(lx, ly);
  const nx = Math.max(4, Math.min(60, Math.round((divisoes * lx) / menor)));
  const ny = Math.max(4, Math.min(60, Math.round((divisoes * ly) / menor)));
  const a = lx / nx, b = ly / ny;
  const el = elementoACM(a, b, nu);

  // numeração dos nós: a direção com menos nós varia mais rápido (banda menor)
  const xRapido = nx <= ny;
  const no = (i, j) => (xRapido ? j * (nx + 1) + i : i * (ny + 1) + j);
  const nNos = (nx + 1) * (ny + 1);

  // vínculos: w = 0 em borda apoiada; w e as duas rotações = 0 em borda engastada.
  // Na borda apoiada também se fixa a rotação tangente (apoio "rígido").
  const preso = new Uint8Array(nNos * 3);
  const prender = (i, j, tipo, tangente) => {
    const n = no(i, j);
    if (tipo === 'apoiada') { preso[3 * n] = 1; preso[3 * n + tangente] = 1; }
    if (tipo === 'engastada') { preso[3 * n] = 1; preso[3 * n + 1] = 1; preso[3 * n + 2] = 1; }
  };
  for (let j = 0; j <= ny; j++) { prender(0, j, bordas.x0, 1); prender(nx, j, bordas.x1, 1); }   // bordas paralelas a y: tangente θx = ∂w/∂y
  for (let i = 0; i <= nx; i++) { prender(i, 0, bordas.y0, 2); prender(i, ny, bordas.y1, 2); }   // bordas paralelas a x: tangente θy

  const eq = new Int32Array(nNos * 3).fill(-1);
  let n = 0;
  for (let g = 0; g < nNos * 3; g++) if (!preso[g]) eq[g] = n++;
  const bw = 3 * ((xRapido ? nx : ny) + 3);
  const K = new MatrizBanda(n, bw);
  const F = new Float64Array(n);

  const gls = (i, j) => [no(i, j), no(i + 1, j), no(i + 1, j + 1), no(i, j + 1)].flatMap((m) => [3 * m, 3 * m + 1, 3 * m + 2]);
  const pDe = carga?.tipo === 'linear-y'
    ? (Y) => (Y <= carga.ate + 1e-12 ? carga.base + ((carga.topo - carga.base) * Y) / carga.ate : 0)
    : null;
  const fEl = (i, j) => (pDe ? el.fDe((x, y) => pDe(j * b + y)) : el.f);
  const fs = [];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const g = gls(i, j);
      const fe = fEl(i, j);
      fs[j * nx + i] = fe;
      for (let r = 0; r < 12; r++) {
        const er = eq[g[r]];
        if (er < 0) continue;
        F[er] += fe[r];
        for (let c = 0; c < 12; c++) { const ec = eq[g[c]]; if (ec >= 0) K.add(er, ec, el.k[r][c]); }
      }
    }
  }
  const sol = K.resolver(F);
  const u = new Float64Array(nNos * 3);
  for (let g = 0; g < nNos * 3; g++) if (eq[g] >= 0) u[g] = sol[eq[g]];

  // esforços nos nós (média dos elementos vizinhos) e reações nos nós presos
  const soma = Array.from({ length: nNos }, () => ({ wxx: 0, wyy: 0, wxy: 0, n: 0 }));
  const reacao = new Float64Array(nNos);
  const cantos = [[0, 0], [a, 0], [a, b], [0, b]];
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const g = gls(i, j);
      const ue = g.map((k) => u[k]);
      const nosEl = [no(i, j), no(i + 1, j), no(i + 1, j + 1), no(i, j + 1)];
      cantos.forEach(([x, y], k) => {
        const c = curvaturas(el.A, ue, x, y);
        const s = soma[nosEl[k]];
        s.wxx += c.wxx; s.wyy += c.wyy; s.wxy += c.wxy; s.n++;
      });
      // carga transmitida ao apoio = carga nodal − força interna (só nos GL de deslocamento presos)
      for (let k = 0; k < 4; k++) {
        const r = 3 * k;
        if (!preso[g[r]]) continue;
        reacao[nosEl[k]] += fs[j * nx + i][r] - el.k[r].reduce((acc, v, c) => acc + v * ue[c], 0);
      }
    }
  }

  const livre = (b) => bordas[b] === 'livre';
  const engaste = (b) => bordas[b] === 'engastada';
  const grade = [];
  let wMax = 0, wMaxEm = { i: 0, j: 0 }, mxPos = 0, myPos = 0, mxNeg = 0, myNeg = 0;
  for (let j = 0; j <= ny; j++) {
    const linha = [];
    for (let i = 0; i <= nx; i++) {
      const s = soma[no(i, j)];
      const wxx = s.wxx / s.n, wyy = s.wyy / s.n;
      const mx = -(wxx + nu * wyy), my = -(wyy + nu * wxx);
      const w = u[3 * no(i, j)];
      linha.push({ w, mx, my });
      if (w > wMax) { wMax = w; wMaxEm = { i, j }; }
      // positivos: interior e bordas livres (bordas vinculadas têm w = 0)
      const naBordaPresa = (i === 0 && !livre('x0')) || (i === nx && !livre('x1')) || (j === 0 && !livre('y0')) || (j === ny && !livre('y1'));
      if (!naBordaPresa) { mxPos = Math.max(mxPos, mx); myPos = Math.max(myPos, my); }
      if ((i === 0 && engaste('x0')) || (i === nx && engaste('x1'))) mxNeg = Math.min(mxNeg, mx);
      if ((j === 0 && engaste('y0')) || (j === ny && engaste('y1'))) myNeg = Math.min(myNeg, my);
    }
    grade.push(linha);
  }

  // reações por borda (força total da borda ÷ comprimento); nó de canto dividido entre bordas presas
  const total = { x0: 0, x1: 0, y0: 0, y1: 0 };
  for (let j = 0; j <= ny; j++) {
    for (let i = 0; i <= nx; i++) {
      const R = reacao[no(i, j)];
      if (!R) continue;
      const bordasDoNo = [i === 0 && 'x0', i === nx && 'x1', j === 0 && 'y0', j === ny && 'y1'].filter((k) => k && !livre(k));
      for (const k of bordasDoNo) total[k] += R / bordasDoNo.length;
    }
  }
  const comprimento = { x0: ly, x1: ly, y0: lx, y1: lx };
  const reacoes = Object.fromEntries(Object.keys(total).map((k) => [k, total[k] / comprimento[k]]));

  // posição da flecha máxima e distância até a borda vinculada mais próxima (para o limite de balanço)
  const xw = wMaxEm.i * a, yw = wMaxEm.j * b;
  const dist = { x0: xw, x1: lx - xw, y0: yw, y1: ly - yw };
  const presas = Object.keys(dist).filter((k) => !livre(k));
  const wNaBordaLivre = (wMaxEm.i === 0 && livre('x0')) || (wMaxEm.i === nx && livre('x1')) || (wMaxEm.j === 0 && livre('y0')) || (wMaxEm.j === ny && livre('y1'));

  const r = {
    nx, ny, lx, ly, metodo: 'Elementos finitos de placa (ACM)',
    coef: {
      mxPos: mxPos / menor ** 2, myPos: myPos / menor ** 2,
      mxNeg: mxNeg / menor ** 2, myNeg: myNeg / menor ** 2,
      w: wMax / menor ** 4,
    },
    unit: { mxPos, myPos, mxNeg, myNeg, wMax },
    reacoes, totalReacoes: Object.values(total).reduce((s, v) => s + v, 0),
    flechaMaxima: { x: xw, y: yw, naBordaLivre: wNaBordaLivre, distanciaApoio: Math.min(...presas.map((k) => dist[k])) },
    grade,
  };
  if (cache.size > 40) cache.clear();
  cache.set(chave, r);
  return r;
}

/**
 * Reações de apoio pelo processo das áreas (NBR 6118, 14.7.6.1):
 * retas a 45° entre bordas do mesmo tipo e a 60° a partir da borda engastada
 * quando a vizinha é apoiada. Implementado por amostragem: cada ponto da laje
 * é atribuído à borda de menor distância ponderada (peso √3 para engaste).
 *
 * @returns áreas de influência (m²) e fração da carga por borda
 */
export function areasDeInfluencia({ lx, ly, bordas, amostras = 160 }) {
  const peso = (b) => (b === 'engastada' ? Math.sqrt(3) : 1);
  const area = { x0: 0, x1: 0, y0: 0, y1: 0 };
  const ns = amostras, dA = (lx * ly) / (ns * ns);
  for (let a = 0; a < ns; a++) {
    for (let c = 0; c < ns; c++) {
      const x = ((a + 0.5) / ns) * lx, y = ((c + 0.5) / ns) * ly;
      const dist = { x0: x / peso(bordas.x0), x1: (lx - x) / peso(bordas.x1), y0: y / peso(bordas.y0), y1: (ly - y) / peso(bordas.y1) };
      let melhor = 'x0';
      for (const k of ['x1', 'y0', 'y1']) if (dist[k] < dist[melhor]) melhor = k;
      area[melhor] += dA;
    }
  }
  const comprimento = { x0: ly, x1: ly, y0: lx, y1: lx };
  return { area, comprimento };
}
