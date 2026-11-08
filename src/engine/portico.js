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
 * Pórtico espacial — método dos deslocamentos com barras de 6 graus de liberdade por nó
 * (NBR 6118, 14.6: análise linear). Serve de base para a grelha de pavimento e para o pórtico do
 * edifício nas próximas etapas, e pode ser usado diretamente pelo console (portico()).
 *
 * Unidades: coordenadas em m; forças em kN; momentos em kN·m; E e G em kN/m²; A em m², I e J em m⁴.
 * Deslocamentos em m e rotações em rad.
 *
 * Eixos globais: X e Y no plano do pavimento, Z vertical para cima (peso próprio em −Z).
 * Eixos locais de cada barra: x do nó i para o nó j; y é a direção da "altura" h da seção — vertical
 * (+Z) nas barras não verticais, e +X nas barras verticais —, girada de `angulo` graus em torno de x
 * quando informado; z = x × y. Para seção b × h: Iz = b·h³/12 (flexão no plano x–y) e Iy = h·b³/12.
 *
 * Esforços internos numa seção a uma distância x do nó i (face positiva, eixos locais):
 *   N  normal (tração positiva) · T  momento torçor
 *   Mz momento no plano x–y, positivo quando traciona o lado −y (numa viga, positivo = tração embaixo)
 *   My momento no plano x–z, positivo quando traciona o lado −z
 *   Vy, Vz cortantes, com dMz/dx = Vy e dMy/dx = −Vz (numa viga biapoiada, Vy > 0 junto ao nó i).
 *
 * Extremidades das barras podem ter liberações (rótulas): componentes 'N', 'Vy', 'Vz', 'T', 'My', 'Mz'
 * em `liberar: { i: [...], j: [...] }`, ou o atalho `rotula: 'i' | 'j' | 'ambas'` (libera My e Mz).
 */
import { concreto } from './materiais.js';

export const GDL = ['ux', 'uy', 'uz', 'rx', 'ry', 'rz'];
export const ESFORCOS = ['N', 'Vy', 'Vz', 'T', 'My', 'Mz'];
const REACOES = ['Fx', 'Fy', 'Fz', 'Mx', 'My', 'Mz'];

/* ================================================================== entrada */

/** Restrições de apoio: 'engaste', 'apoio' (rótula: só translações), 'livre', '111000' ou [1,1,1,0,0,0]. */
export function restricoesDe(apoio) {
  if (apoio == null || apoio === false || apoio === 'livre') return [0, 0, 0, 0, 0, 0];
  if (apoio === true || apoio === 'engaste' || apoio === 'engastado') return [1, 1, 1, 1, 1, 1];
  if (apoio === 'apoio' || apoio === 'rotula' || apoio === 'rótula' || apoio === 'articulado') return [1, 1, 1, 0, 0, 0];
  if (typeof apoio === 'string' && /^[01]{6}$/.test(apoio)) return [...apoio].map(Number);
  if (Array.isArray(apoio) && apoio.length === 6) return apoio.map((v) => (v ? 1 : 0));
  if (typeof apoio === 'object') return GDL.map((g) => (apoio[g] ? 1 : 0));
  throw new Error(`Apoio "${apoio}" não reconhecido: use 'engaste', 'apoio', 'livre', '111000' ou uma lista de 6 valores.`);
}

/** Constante de torção de Saint-Venant de um retângulo (m⁴), lados em m. */
export function torcaoRetangulo(a, b) {
  const L = Math.max(a, b), t = Math.min(a, b), r = t / L;
  return L * t ** 3 * (1 / 3 - 0.21 * r * (1 - r ** 4 / 12));
}

/** Propriedades da seção: { b, h } em cm (ou [b, h]) ou diretas { A, Iy, Iz, J } em m. */
export function propriedadesSecao(s = {}) {
  if (Array.isArray(s)) s = { b: s[0], h: s[1] };
  if (s.D != null) {
    // seção circular (pilar redondo): D em cm
    const D = s.D / 100;
    if (!(D > 0)) throw new Error('Seção circular com D não positivo.');
    const I = (Math.PI * D ** 4) / 64;
    return { A: (Math.PI * D * D) / 4, Iz: I, Iy: I, J: 2 * I, D: s.D, b: s.D, h: s.D };
  }
  if (s.b != null && s.h != null) {
    const b = s.b / 100, h = s.h / 100;
    if (!(b > 0 && h > 0)) throw new Error('Seção com b ou h não positivo.');
    return { A: b * h, Iz: (b * h ** 3) / 12, Iy: (h * b ** 3) / 12, J: torcaoRetangulo(b, h), b: s.b, h: s.h };
  }
  const { A, Iy, Iz, J } = s;
  if (![A, Iy, Iz, J].every((v) => Number.isFinite(v) && v > 0)) throw new Error('Seção sem dimensões: informe { b, h } em cm ou { A, Iy, Iz, J } em m.');
  return { A, Iy, Iz, J };
}

/** Material: { E, nu } (E em kN/m²), { G } opcional, ou { fck } para concreto (Ecs da NBR 6118, 8.2.8). */
export function propriedadesMaterial(m = {}) {
  if (typeof m === 'number') m = { fck: m };
  let E = m.E, nu = m.nu ?? 0.2;
  if (E == null && m.fck != null) E = concreto(m.fck, { agregado: m.agregado ?? 'granito' }).Ecs * 1000;
  if (E == null) E = concreto(25).Ecs * 1000;
  if (!(E > 0)) throw new Error('Módulo de elasticidade não positivo.');
  return { E, G: m.G ?? E / (2 * (1 + nu)), nu, gama: m.gama ?? 25 };
}

const DIR_GLOBAL = { X: [1, 0, 0], Y: [0, 1, 0], Z: [0, 0, 1] };
const DIR_LOCAL = { x: 0, y: 1, z: 2 };

/** Cargas de uma barra normalizadas: { tipo: 'q'|'P'|'mt', dir, valor, a?, caso }. */
function cargasDaBarra(b) {
  const out = [];
  const caso = (c) => c?.caso ?? b.caso ?? 'C';
  if (b.q) for (const [d, v] of Object.entries(b.q)) if (v) out.push({ tipo: 'q', dir: d, valor: v, caso: caso() });
  for (const c of b.cargas ?? []) {
    const tipo = c.tipo === 'concentrada' || c.tipo === 'P' ? 'P' : c.tipo === 'torcao' || c.tipo === 'mt' ? 'mt' : 'q';
    out.push({ tipo, dir: c.dir ?? c.direcao ?? 'Z', valor: Number(c.valor), a: c.a ?? c.posicao, caso: caso(c) });
  }
  return out;
}

/* ================================================================== geometria */

const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const norm = (a) => Math.hypot(a[0], a[1], a[2]);
const unit = (a) => { const n = norm(a); return [a[0] / n, a[1] / n, a[2] / n]; };

/** Matriz de rotação 3×3 (linhas = eixos locais em coordenadas globais). */
export function eixosLocais(pi, pj, angulo = 0) {
  const d = sub(pj, pi);
  const L = norm(d);
  if (!(L > 1e-9)) throw new Error('Barra de comprimento nulo.');
  const x = [d[0] / L, d[1] / L, d[2] / L];
  const vertical = Math.hypot(x[0], x[1]) < 1e-6;
  const v = vertical ? [1, 0, 0] : [0, 0, 1];
  let y = unit(sub(v, x.map((c) => c * dot(v, x))));
  let z = cross(x, y);
  if (angulo) {
    const t = (angulo * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t);
    const y2 = [0, 1, 2].map((k) => c * y[k] + s * z[k]);
    const z2 = [0, 1, 2].map((k) => -s * y[k] + c * z[k]);
    y = y2; z = z2;
  }
  return { L, R: [x, y, z] };
}

/* ================================================================== barra */

/** Matriz de rigidez local 12×12. */
export function rigidezLocal({ E, G, A, Iy, Iz, J, L }) {
  const k = Array.from({ length: 12 }, () => new Array(12).fill(0));
  const set = (i, j, v) => { k[i][j] += v; if (i !== j) k[j][i] += v; };
  const ea = (E * A) / L, gj = (G * J) / L;
  set(0, 0, ea); set(6, 6, ea); set(0, 6, -ea);
  set(3, 3, gj); set(9, 9, gj); set(3, 9, -gj);
  const z1 = (12 * E * Iz) / L ** 3, z2 = (6 * E * Iz) / L ** 2, z3 = (4 * E * Iz) / L, z4 = (2 * E * Iz) / L;
  set(1, 1, z1); set(7, 7, z1); set(1, 7, -z1);
  set(1, 5, z2); set(1, 11, z2); set(5, 7, -z2); set(7, 11, -z2);
  set(5, 5, z3); set(11, 11, z3); set(5, 11, z4);
  const y1 = (12 * E * Iy) / L ** 3, y2 = (6 * E * Iy) / L ** 2, y3 = (4 * E * Iy) / L, y4 = (2 * E * Iy) / L;
  set(2, 2, y1); set(8, 8, y1); set(2, 8, -y1);
  set(2, 4, -y2); set(2, 10, -y2); set(4, 8, y2); set(8, 10, y2);
  set(4, 4, y3); set(10, 10, y3); set(4, 10, y4);
  return k;
}

/** Componentes locais (x, y, z) de uma carga. Maiúsculas = eixos globais; minúsculas = locais; 't' = torção. */
function vetorLocal(dir, valor, R) {
  if (DIR_GLOBAL[dir]) { const g = DIR_GLOBAL[dir].map((c) => c * valor); return R.map((e) => dot(e, g)); }
  if (dir in DIR_LOCAL) { const v = [0, 0, 0]; v[DIR_LOCAL[dir]] = valor; return v; }
  throw new Error(`Direção de carga "${dir}" inválida: use X, Y, Z (globais) ou x, y, z (locais).`);
}

/**
 * Forças de engastamento perfeito (forças que os nós aplicam na barra, eixos locais) de uma carga.
 * Também devolve a forma da carga em coordenadas locais para o cálculo dos esforços ao longo da barra.
 */
function engastamento(c, L, R) {
  const F = new Array(12).fill(0);
  if (c.tipo === 'mt') {
    F[3] = F[9] = (-c.valor * L) / 2;
    return { F, local: { tipo: 'mt', m: c.valor } };
  }
  const w = vetorLocal(c.dir, c.valor, R);
  if (c.tipo === 'q') {
    F[0] = F[6] = (-w[0] * L) / 2;
    F[1] = F[7] = (-w[1] * L) / 2;
    F[2] = F[8] = (-w[2] * L) / 2;
    F[5] = (-w[1] * L * L) / 12; F[11] = (w[1] * L * L) / 12;
    F[4] = (w[2] * L * L) / 12; F[10] = (-w[2] * L * L) / 12;
    return { F, local: { tipo: 'q', w } };
  }
  const a = Number(c.a);
  if (!(a >= 0 && a <= L)) throw new Error(`Carga concentrada fora da barra (a = ${c.a} m, L = ${L.toFixed(3)} m).`);
  const b = L - a;
  F[0] = (-w[0] * b) / L; F[6] = (-w[0] * a) / L;
  const v1 = (b * b * (3 * a + b)) / L ** 3, v2 = (a * a * (a + 3 * b)) / L ** 3;
  const m1 = (a * b * b) / (L * L), m2 = (a * a * b) / (L * L);
  F[1] = -w[1] * v1; F[7] = -w[1] * v2; F[5] = -w[1] * m1; F[11] = w[1] * m2;
  F[2] = -w[2] * v1; F[8] = -w[2] * v2; F[4] = w[2] * m1; F[10] = -w[2] * m2;
  return { F, local: { tipo: 'P', w, a } };
}

/** Inversa de uma matriz pequena (Gauss–Jordan). */
function inversa(M) {
  const n = M.length;
  const A = M.map((r, i) => [...r, ...Array.from({ length: n }, (_, j) => (i === j ? 1 : 0))]);
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(A[i][k]) > Math.abs(A[p][k])) p = i;
    if (Math.abs(A[p][k]) < 1e-12) return null;
    [A[k], A[p]] = [A[p], A[k]];
    const d = A[k][k];
    for (let j = 0; j < 2 * n; j++) A[k][j] /= d;
    for (let i = 0; i < n; i++) if (i !== k && A[i][k]) { const f = A[i][k]; for (let j = 0; j < 2 * n; j++) A[i][j] -= f * A[k][j]; }
  }
  return A.map((r) => r.slice(n));
}

/**
 * Condensação estática das componentes liberadas (r) da barra:
 *   Kc = Kcc − Kcr·Krr⁻¹·Krc ;  F0c = F0c − Kcr·Krr⁻¹·F0r ; componentes liberadas viram zero.
 * Devolve a matriz e as forças condensadas (12×12, 12) e a matriz que recupera ur a partir de uc e F0r.
 */
function condensar(K, lib) {
  if (!lib.length) return { K, inv: null };
  const c = [...Array(12).keys()].filter((i) => !lib.includes(i));
  const Krr = lib.map((i) => lib.map((j) => K[i][j]));
  const inv = inversa(Krr);
  if (!inv) return { erro: true };
  const Kc = Array.from({ length: 12 }, () => new Array(12).fill(0));
  for (const i of c) for (const j of c) {
    let s = K[i][j];
    for (let p = 0; p < lib.length; p++) for (let q = 0; q < lib.length; q++) s -= K[i][lib[p]] * inv[p][q] * K[lib[q]][j];
    Kc[i][j] = s;
  }
  return { K: Kc, inv, c };
}

function condensarForcas(K, F0, lib, inv) {
  if (!lib.length) return F0;
  const out = F0.slice();
  const t = lib.map((_, p) => lib.reduce((s, r, q) => s + inv[p][q] * F0[r], 0)); // Krr⁻¹·F0r
  for (let i = 0; i < 12; i++) {
    if (lib.includes(i)) { out[i] = 0; continue; }
    out[i] = F0[i] - lib.reduce((s, r, p) => s + K[i][r] * t[p], 0);
  }
  return out;
}

const LIB_IDX = { N: 0, Vy: 1, Vz: 2, T: 3, My: 4, Mz: 5 };
function liberacoesDe(b) {
  const lib = [];
  const add = (lado, nomes) => {
    for (const n of nomes ?? []) {
      if (!(n in LIB_IDX)) throw new Error(`Barra ${b.id}: liberação "${n}" inválida (use N, Vy, Vz, T, My ou Mz).`);
      lib.push(LIB_IDX[n] + (lado === 'j' ? 6 : 0));
    }
  };
  if (b.rotula === 'i' || b.rotula === 'ambas') add('i', ['My', 'Mz']);
  if (b.rotula === 'j' || b.rotula === 'ambas') add('j', ['My', 'Mz']);
  add('i', b.liberar?.i); add('j', b.liberar?.j);
  return [...new Set(lib)].sort((x, y) => x - y);
}

/* ================================================================== solver em banda */

/** Ordem dos nós por Cuthill–McKee reverso (reduz a largura de banda). */
function ordenarNos(n, adj) {
  const grau = adj.map((a) => a.size);
  const visto = new Array(n).fill(false);
  const ordem = [];
  const restantes = [...Array(n).keys()].sort((a, b) => grau[a] - grau[b]);
  for (const ini of restantes) {
    if (visto[ini]) continue;
    const fila = [ini]; visto[ini] = true;
    while (fila.length) {
      const v = fila.shift();
      ordem.push(v);
      for (const w of [...adj[v]].sort((a, b) => grau[a] - grau[b])) if (!visto[w]) { visto[w] = true; fila.push(w); }
    }
  }
  return ordem.reverse();
}

/** Matriz simétrica em banda (parte superior) com fatoração de Cholesky. */
class Banda {
  constructor(n, bw) { this.n = n; this.bw = bw; this.w = bw + 1; this.a = new Float64Array(n * this.w); }
  idx(i, j) { return i * this.w + (j - i); }
  add(i, j, v) { if (j < i) [i, j] = [j, i]; this.a[this.idx(i, j)] += v; }
  diag(i) { return this.a[this.idx(i, i)]; }
  /** Fatoração A = Uᵀ·U; devolve o índice da equação onde o pivô se anula (mecanismo), ou -1. */
  fatorar(tol) {
    const { n, bw, a } = this;
    for (let i = 0; i < n; i++) {
      const jMax = Math.min(n - 1, i + bw);
      for (let j = i; j <= jMax; j++) {
        let s = a[this.idx(i, j)];
        for (let k = Math.max(0, j - bw); k < i; k++) s -= a[this.idx(k, i)] * a[this.idx(k, j)];
        if (j === i) {
          if (!(s > tol[i])) return i;
          a[this.idx(i, i)] = Math.sqrt(s);
        } else a[this.idx(i, j)] = s / a[this.idx(i, i)];
      }
    }
    return -1;
  }
  resolver(b) {
    const { n, bw, a } = this;
    const y = Float64Array.from(b);
    for (let i = 0; i < n; i++) {
      let s = y[i];
      for (let k = Math.max(0, i - bw); k < i; k++) s -= a[this.idx(k, i)] * y[k];
      y[i] = s / a[this.idx(i, i)];
    }
    for (let i = n - 1; i >= 0; i--) {
      let s = y[i];
      for (let j = i + 1; j <= Math.min(n - 1, i + bw); j++) s -= a[this.idx(i, j)] * y[j];
      y[i] = s / a[this.idx(i, i)];
    }
    return y;
  }
}

/* ================================================================== análise */

const TIPOS_MODELO = {
  espacial: [0, 0, 0, 0, 0, 0],
  'plano-xz': [0, 1, 0, 1, 0, 1], // pórtico plano no plano XZ: restringe uy, rx, rz
  'plano-yz': [1, 0, 0, 0, 1, 1],
  grelha: [1, 1, 0, 0, 0, 1],     // grelha no plano XY carregada em Z: restringe ux, uy, rz
};

/**
 * Analisa o pórtico.
 * @param {object} m
 * @param {{id:string, x:number, y:number, z:number, apoio?:any, molas?:number[], molasRot?:{eixo:number[], k:number}[]}[]} m.nos
 *        molas: rigidez de apoio elástico por grau (kN/m, kN·m/rad); molasRot: mola de rotação em torno de um eixo qualquer
 * @param {{id:string, i:string, j:string, secao:object, material?:object, angulo?:number,
 *          liberar?:object, rotula?:string, q?:object, cargas?:object[], pesoProprio?:boolean,
 *          fatorTorcao?:number, fatorEI?:number}[]} m.barras   fatorEI multiplica Iy e Iz (rigidez reduzida, 15.7.3)
 * @param {{no:string, Fx?, Fy?, Fz?, Mx?, My?, Mz?, caso?:string}[]} [m.cargas]  cargas nodais
 * @param {object} [m.material]  material padrão das barras ({ fck } ou { E, nu })
 * @param {'espacial'|'plano-xz'|'plano-yz'|'grelha'} [m.tipo]
 * @param {boolean} [m.pesoProprio]  peso próprio γ·A em −Z em todas as barras (caso 'G' ou o padrão)
 * @returns {ResultadoPortico}
 */
export function analisarPortico(m) {
  const avisos = [];
  const tipo = m.tipo ?? 'espacial';
  if (!TIPOS_MODELO[tipo]) throw new Error(`Tipo de modelo "${tipo}" inválido: espacial, plano-xz, plano-yz ou grelha.`);
  const nos = (m.nos ?? []).map((n, k) => {
    const id = String(n.id ?? `N${k + 1}`);
    const xyz = Array.isArray(n) ? n : [n.x ?? 0, n.y ?? 0, n.z ?? 0];
    if (!xyz.every(Number.isFinite)) throw new Error(`Nó ${id}: coordenadas inválidas.`);
    const r = restricoesDe(n.apoio);
    const extra = TIPOS_MODELO[tipo];
    const molasRot = (n.molasRot ?? []).map((m) => { const e = unit(m.eixo); return { e, k: Number(m.k) }; }).filter((m) => m.k > 0);
    // graus de rotação que alguma mola inclinada toca (para as reações)
    const rotMola = [0, 1, 2].map((a) => molasRot.some((m) => Math.abs(m.e[a]) > 1e-9));
    return { id, p: xyz.map(Number), apoio: r, r: r.map((v, g) => v || extra[g]), molas: n.molas ?? null, molasRot, rotMola };
  });
  if (nos.length < 2) throw new Error('O pórtico precisa de pelo menos 2 nós.');
  const idxNo = new Map();
  nos.forEach((n, k) => { if (idxNo.has(n.id)) throw new Error(`Nó repetido: ${n.id}.`); idxNo.set(n.id, k); });
  const matPadrao = propriedadesMaterial(m.material ?? {});

  const barras = (m.barras ?? []).map((b, k) => {
    const id = String(b.id ?? `B${k + 1}`);
    const ni = idxNo.get(String(b.i)), nj = idxNo.get(String(b.j));
    if (ni == null || nj == null) throw new Error(`Barra ${id}: nó ${ni == null ? b.i : b.j} não existe.`);
    const { L, R } = eixosLocais(nos[ni].p, nos[nj].p, b.angulo ?? 0);
    const sec = propriedadesSecao(b.secao ?? m.secao);
    const mat = b.material ? propriedadesMaterial(b.material) : matPadrao;
    const fT = b.fatorTorcao ?? m.fatorTorcao ?? 1;
    const fEI = b.fatorEI ?? m.fatorEI ?? 1; // rigidez à flexão reduzida (não linearidade física, NBR 6118 15.7.3)
    if (!(fEI > 0)) throw new Error(`Barra ${id}: fatorEI deve ser positivo.`);
    const props = { E: mat.E, G: mat.G, A: sec.A, Iy: sec.Iy * fEI, Iz: sec.Iz * fEI, J: sec.J * fT, L };
    const lib = liberacoesDe({ ...b, id });
    const cargas = cargasDaBarra(b);
    if (b.pesoProprio ?? m.pesoProprio) cargas.push({ tipo: 'q', dir: 'Z', valor: -mat.gama * sec.A, caso: m.casoPesoProprio ?? 'G', pp: true });
    return { id, ni, nj, L, R, sec, mat, props, lib, cargas };
  });
  if (!barras.length) throw new Error('O pórtico precisa de pelo menos uma barra.');
  { const ids = new Set(); for (const b of barras) { if (ids.has(b.id)) throw new Error(`Barra repetida: ${b.id}.`); ids.add(b.id); } }

  const cargasNodais = (m.cargas ?? []).map((c) => {
    const k = idxNo.get(String(c.no));
    if (k == null) throw new Error(`Carga nodal em nó inexistente: ${c.no}.`);
    return { k, v: REACOES.map((n) => Number(c[n] ?? 0)), caso: c.caso ?? 'C' };
  });

  // casos de carga, na ordem em que aparecem
  const casos = [];
  const addCaso = (c) => { if (!casos.includes(c)) casos.push(c); };
  for (const b of barras) for (const c of b.cargas) addCaso(c.caso);
  for (const c of cargasNodais) addCaso(c.caso);
  if (!casos.length) casos.push('C');

  // rigidez local, condensação das liberações e forças de engastamento por caso
  for (const b of barras) {
    b.kLocal = rigidezLocal(b.props);
    const cd = condensar(b.kLocal, b.lib);
    if (cd.erro) throw new Error(`Barra ${b.id}: as liberações formam um mecanismo (por exemplo, torção liberada nas duas pontas).`);
    b.kCond = cd.K; b.invLib = cd.inv;
    b.F0 = Object.fromEntries(casos.map((c) => [c, new Array(12).fill(0)]));
    b.formas = Object.fromEntries(casos.map((c) => [c, []]));
    for (const c of b.cargas) {
      const e = engastamento(c, b.L, b.R);
      for (let i = 0; i < 12; i++) b.F0[c.caso][i] += e.F[i];
      b.formas[c.caso].push(e.local);
    }
    b.F0c = Object.fromEntries(casos.map((c) => [c, condensarForcas(b.kLocal, b.F0[c], b.lib, b.invLib)]));
    // matriz global: Kg = Tᵀ·Kc·T, por blocos 3×3
    b.kGlobal = transformar(b.kCond, b.R);
  }

  // diafragmas rígidos no plano XY (lajes): ux, uy e rz de cada nó seguem um nó mestre (penalidade)
  const diafragmas = (m.diafragmas ?? []).map((d, k) => {
    const ids = [...new Set((d.nos ?? []).map(String))];
    const ks = ids.map((id) => { const i = idxNo.get(id); if (i == null) throw new Error(`Diafragma ${k + 1}: nó ${id} não existe.`); return i; });
    if (ks.length < 2) return null;
    let mestre = d.mestre != null ? idxNo.get(String(d.mestre)) : null;
    if (mestre == null) {
      const cx = ks.reduce((s, i) => s + nos[i].p[0], 0) / ks.length, cy = ks.reduce((s, i) => s + nos[i].p[1], 0) / ks.length;
      mestre = ks.reduce((a, i) => (Math.hypot(nos[i].p[0] - cx, nos[i].p[1] - cy) < Math.hypot(nos[a].p[0] - cx, nos[a].p[1] - cy) ? i : a), ks[0]);
    }
    return { mestre, escravos: ks.filter((i) => i !== mestre) };
  }).filter(Boolean);
  // restrições: lista de termos {k (nó), g (grau), v (coeficiente)} com Σ v·u = 0
  const vinculos = [];
  for (const d of diafragmas) {
    const pm = nos[d.mestre].p;
    for (const s of d.escravos) {
      const dx = nos[s].p[0] - pm[0], dy = nos[s].p[1] - pm[1];
      vinculos.push([{ k: s, g: 0, v: 1 }, { k: d.mestre, g: 0, v: -1 }, { k: d.mestre, g: 5, v: dy }]);
      vinculos.push([{ k: s, g: 1, v: 1 }, { k: d.mestre, g: 1, v: -1 }, { k: d.mestre, g: 5, v: -dx }]);
      vinculos.push([{ k: s, g: 5, v: 1 }, { k: d.mestre, g: 5, v: -1 }]);
    }
  }

  // numeração das equações (nós em ordem de Cuthill–McKee reverso)
  const adj = nos.map(() => new Set());
  for (const b of barras) { adj[b.ni].add(b.nj); adj[b.nj].add(b.ni); }
  for (const d of diafragmas) for (const s of d.escravos) { adj[s].add(d.mestre); adj[d.mestre].add(s); }
  const ordem = ordenarNos(nos.length, adj);
  const montar = (restr) => {
    const eq = nos.map(() => new Array(6).fill(-1));
    let n = 0;
    for (const k of ordem) for (let g = 0; g < 6; g++) if (!restr[k][g]) eq[k][g] = n++;
    return { eq, n };
  };
  let restr = nos.map((n) => n.r.slice());
  let kPenal = 0;
  const isolados = nos.filter((_, k) => !adj[k].size);
  if (isolados.length) throw new Error(`Nó sem barra: ${isolados.map((n) => n.id).join(', ')}.`);

  // graus de liberdade sem rigidez (ex.: rotação de um nó onde todas as barras são rotuladas) → restringidos com aviso
  {
    const diag = nos.map(() => new Array(6).fill(0));
    for (const b of barras) for (let a = 0; a < 2; a++) for (let g = 0; g < 6; g++) diag[a ? b.nj : b.ni][g] += b.kGlobal[a * 6 + g][a * 6 + g];
    for (const [k, n] of nos.entries()) {
      for (let g = 0; g < 6; g++) if (n.molas?.[g]) diag[k][g] += n.molas[g];
      for (const m of n.molasRot) for (let a = 0; a < 3; a++) diag[k][3 + a] += m.k * m.e[a] ** 2;
    }
    const maxDiag = Math.max(...diag.flat());
    kPenal = 1e4 * maxDiag;
    for (const vc of vinculos) for (const tm of vc) diag[tm.k][tm.g] += kPenal * tm.v ** 2;
    for (const [k, n] of nos.entries()) {
      for (let g = 0; g < 6; g++) {
        if (restr[k][g] || diag[k][g] > maxDiag * 1e-12) continue;
        const carregado = cargasNodais.some((c) => c.k === k && Math.abs(c.v[g]) > 1e-12);
        if (carregado) throw new Error(`Nó ${n.id}: ${REACOES[g]} aplicado num grau de liberdade sem rigidez (${GDL[g]}).`);
        restr[k][g] = 1;
        avisos.push(`Nó ${n.id}: ${GDL[g]} sem rigidez (todas as barras liberadas) — restringido sem reação.`);
        n.semRigidez = [...(n.semRigidez ?? []), g];
      }
    }
  }

  const { eq, n } = montar(restr);
  let bw = 0;
  for (const b of barras) {
    const e = [...eq[b.ni], ...eq[b.nj]].filter((x) => x >= 0);
    if (e.length) bw = Math.max(bw, Math.max(...e) - Math.min(...e));
  }
  if (nos.some((no) => no.molasRot.length)) bw = Math.max(bw, Math.min(5, Math.max(0, n - 1)));
  for (const vc of vinculos) {
    const e = vc.map((tm) => eq[tm.k][tm.g]).filter((x) => x >= 0);
    if (e.length) bw = Math.max(bw, Math.max(...e) - Math.min(...e));
  }
  const K = new Banda(n, bw);
  const dofs = (b) => [...eq[b.ni], ...eq[b.nj]];
  for (const b of barras) {
    const d = dofs(b);
    for (let p = 0; p < 12; p++) {
      if (d[p] < 0) continue;
      for (let q = p; q < 12; q++) if (d[q] >= 0 && b.kGlobal[p][q] !== 0) K.add(d[p], d[q], b.kGlobal[p][q]);
    }
  }
  for (const [k, no] of nos.entries()) {
    for (let g = 0; g < 6; g++) if (no.molas?.[g] && eq[k][g] >= 0) K.add(eq[k][g], eq[k][g], no.molas[g]);
    for (const m of no.molasRot) for (let a = 0; a < 3; a++) for (let b = a; b < 3; b++) {
      const ea = eq[k][3 + a], eb = eq[k][3 + b];
      if (ea >= 0 && eb >= 0 && m.e[a] * m.e[b] !== 0) K.add(ea, eb, m.k * m.e[a] * m.e[b]);
    }
  }

  for (const vc of vinculos) {
    const e = vc.map((tm) => ({ eq: eq[tm.k][tm.g], v: tm.v })).filter((x) => x.eq >= 0 && x.v !== 0);
    for (let a = 0; a < e.length; a++) for (let b = a; b < e.length; b++) K.add(e[a].eq, e[b].eq, kPenal * e[a].v * e[b].v);
  }

  const tol = Array.from({ length: n }, (_, i) => Math.max(1e-300, K.diag(i) * 1e-10));
  const falha = n ? K.fatorar(tol) : -1;
  if (falha >= 0) {
    let onde = '';
    for (const [k, no] of nos.entries()) { const g = eq[k].indexOf(falha); if (g >= 0) onde = `nó ${no.id}, ${GDL[g]}`; }
    throw new Error(`Estrutura hipostática (mecanismo) — sem rigidez em ${onde}. Confira os apoios e as liberações das barras.`);
  }

  // resolve cada caso
  const porCaso = {};
  for (const caso of casos) {
    const F = new Float64Array(n);
    for (const c of cargasNodais) if (c.caso === caso) for (let g = 0; g < 6; g++) if (eq[c.k][g] >= 0) F[eq[c.k][g]] += c.v[g];
    for (const b of barras) {
      const fg = transformarVetorT(b.F0c[caso], b.R); // forças de engastamento em eixos globais
      const d = dofs(b);
      for (let p = 0; p < 12; p++) if (d[p] >= 0) F[d[p]] -= fg[p];
    }
    const u = n ? K.resolver(F) : new Float64Array(0);
    const U = nos.map((_, k) => eq[k].map((e) => (e >= 0 ? u[e] : 0)));
    porCaso[caso] = posProcessar({ nos, barras, cargasNodais, caso, U });
  }

  return new ResultadoPortico({
    tipo, casos, porCaso, avisos,
    resumo: { nos: nos.length, barras: barras.length, equacoes: n, banda: bw, diafragmas: diafragmas.length },
    nosModelo: nos.map((no) => ({ id: no.id, x: no.p[0], y: no.p[1], z: no.p[2], restricoes: no.r })),
    barrasModelo: barras.map((b) => ({ id: b.id, i: nos[b.ni].id, j: nos[b.nj].id, L: b.L, eixos: b.R, secao: b.sec, E: b.props.E, G: b.props.G, liberacoes: b.lib })),
  });
}

/** Kg = Tᵀ·K·T com T = diag(R, R, R, R). */
function transformar(K, R) {
  const out = Array.from({ length: 12 }, () => new Array(12).fill(0));
  for (let bi = 0; bi < 4; bi++) for (let bj = 0; bj < 4; bj++) {
    for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
      let s = 0;
      for (let p = 0; p < 3; p++) for (let q = 0; q < 3; q++) s += R[p][a] * K[bi * 3 + p][bj * 3 + q] * R[q][b];
      out[bi * 3 + a][bj * 3 + b] = s;
    }
  }
  return out;
}
/** Vetor local → global: Tᵀ·v. */
function transformarVetorT(v, R) {
  const out = new Array(12).fill(0);
  for (let b = 0; b < 4; b++) for (let a = 0; a < 3; a++) out[b * 3 + a] = R[0][a] * v[b * 3] + R[1][a] * v[b * 3 + 1] + R[2][a] * v[b * 3 + 2];
  return out;
}
/** Vetor global → local: T·v. */
function transformarVetor(v, R) {
  const out = new Array(12).fill(0);
  for (let b = 0; b < 4; b++) for (let a = 0; a < 3; a++) out[b * 3 + a] = R[a][0] * v[b * 3] + R[a][1] * v[b * 3 + 1] + R[a][2] * v[b * 3 + 2];
  return out;
}

function posProcessar({ nos, barras, cargasNodais, caso, U }) {
  const reac = nos.map(() => new Array(6).fill(0));
  const resBarras = barras.map((b) => {
    const ug = [...U[b.ni], ...U[b.nj]];
    const ul = transformarVetor(ug, b.R);
    // recupera as componentes liberadas: ur = −Krr⁻¹·(Krc·uc + F0r)
    if (b.lib.length) {
      const c = [...Array(12).keys()].filter((i) => !b.lib.includes(i));
      const t = b.lib.map((r) => c.reduce((s, j) => s + b.kLocal[r][j] * ul[j], 0) + b.F0[caso][r]);
      b.lib.forEach((r, p) => { ul[r] = -b.lib.reduce((s, _, q) => s + b.invLib[p][q] * t[q], 0); });
    }
    const F = new Array(12).fill(0); // forças nas extremidades (nós → barra), eixos locais
    for (let p = 0; p < 12; p++) { let s = b.F0[caso][p]; for (let q = 0; q < 12; q++) s += b.kLocal[p][q] * ul[q]; F[p] = s; }
    for (const r of b.lib) F[r] = 0;
    const Fg = transformarVetorT(F, b.R);
    for (let g = 0; g < 6; g++) { reac[b.ni][g] += Fg[g]; reac[b.nj][g] += Fg[6 + g]; }
    return { id: b.id, L: b.L, F, ul, formas: b.formas[caso], geo: { pi: nos[b.ni].p, R: b.R, EIz: b.props.E * b.props.Iz, EIy: b.props.E * b.props.Iy } };
  });
  // reação = soma das forças das barras sobre o nó − carga nodal (só nos graus restringidos)
  for (const c of cargasNodais) if (c.caso === caso) for (let g = 0; g < 6; g++) reac[c.k][g] -= c.v[g];
  const deslocamentos = nos.map((no, k) => ({ id: no.id, u: U[k].slice() }));
  const reacoes = nos.map((no, k) => ({ id: no.id, R: reac[k].map((v, g) => (no.r[g] || no.molas?.[g] || (g >= 3 && no.rotMola[g - 3]) ? v : 0)), restricoes: no.apoio.map((v, g) => (v || no.molas?.[g] || (g >= 3 && no.rotMola[g - 3]) ? 1 : 0)) }))
    .filter((r, k) => r.restricoes.some(Boolean) || r.R.some((v) => Math.abs(v) > 1e-9));
  // resultante das cargas aplicadas (em relação à origem) para conferir o equilíbrio
  const cargaTotal = [0, 0, 0];
  for (const c of cargasNodais) if (c.caso === caso) for (let g = 0; g < 3; g++) cargaTotal[g] += c.v[g];
  for (const b of barras) for (const c of b.cargas) if (c.caso === caso) {
    if (c.tipo === 'mt') continue;
    const g = DIR_GLOBAL[c.dir] ? DIR_GLOBAL[c.dir].map((x) => x * c.valor) : b.R[DIR_LOCAL[c.dir]].map((x) => x * c.valor);
    const f = c.tipo === 'q' ? b.L : 1;
    for (let k = 0; k < 3; k++) cargaTotal[k] += g[k] * f;
  }
  const reacaoTotal = [0, 1, 2].map((g) => reacoes.reduce((s, r) => s + r.R[g], 0));
  const escala = Math.max(1, ...cargaTotal.map(Math.abs));
  const erro = Math.max(...[0, 1, 2].map((g) => Math.abs(cargaTotal[g] + reacaoTotal[g]))) / escala;
  return { caso, deslocamentos, reacoes, barras: resBarras.map((rb) => resumoBarra(rb)), equilibrio: { cargas: cargaTotal, reacoes: reacaoTotal, erro } };
}

/* ================================================================== esforços ao longo da barra */

/** Esforços internos na seção x (m) de uma barra a partir das forças de extremidade e das cargas. */
export function esforcosNaSecao(rb, x) {
  const { F, formas } = rb;
  const S = [-F[0], -F[1], -F[2]];
  const M = [-F[3], -F[4] - x * F[2], -F[5] + x * F[1]];
  for (const f of formas) {
    if (f.tipo === 'q') {
      for (let k = 0; k < 3; k++) S[k] -= f.w[k] * x;
      M[1] -= (f.w[2] * x * x) / 2;
      M[2] += (f.w[1] * x * x) / 2;
    } else if (f.tipo === 'mt') {
      M[0] -= f.m * x;
    } else if (f.tipo === 'P' && f.a <= x + 1e-12) {
      for (let k = 0; k < 3; k++) S[k] -= f.w[k];
      M[1] += (f.a - x) * f.w[2];
      M[2] -= (f.a - x) * f.w[1];
    }
  }
  return { x, N: S[0], Vy: -S[1], Vz: -S[2], T: M[0], My: M[1], Mz: M[2] };
}

function resumoBarra(rb) {
  const xs = new Set(Array.from({ length: 11 }, (_, k) => (rb.L * k) / 10));
  for (const f of rb.formas) if (f.tipo === 'P') { xs.add(Math.max(0, f.a - 1e-9)); xs.add(f.a); }
  // pontos de cortante nulo (máximos de momento) sob carga distribuída
  const lista = [...xs].sort((a, b) => a - b);
  const diagrama = lista.map((x) => esforcosNaSecao(rb, x));
  const extremos = {};
  for (const e of ESFORCOS) {
    let mx = diagrama[0], mn = diagrama[0];
    for (const d of diagrama) { if (d[e] > mx[e]) mx = d; if (d[e] < mn[e]) mn = d; }
    extremos[e] = { max: mx[e], xMax: mx.x, min: mn[e], xMin: mn.x };
  }
  // máximo do momento no vão: refina onde o cortante troca de sinal
  for (const [V, Mn, s] of [['Vy', 'Mz', 1], ['Vz', 'My', -1]]) {
    for (let k = 1; k < diagrama.length; k++) {
      const a = diagrama[k - 1], b = diagrama[k];
      if (a[V] * b[V] < 0 && b.x - a.x > 1e-9) {
        let lo = a.x, hi = b.x;
        for (let it = 0; it < 50; it++) { const mid = (lo + hi) / 2; const v = esforcosNaSecao(rb, mid)[V]; if (Math.sign(v) === Math.sign(a[V])) lo = mid; else hi = mid; }
        const d = esforcosNaSecao(rb, (lo + hi) / 2);
        const ex = extremos[Mn];
        if (d[Mn] > ex.max) { ex.max = d[Mn]; ex.xMax = d.x; }
        if (d[Mn] < ex.min) { ex.min = d[Mn]; ex.xMin = d.x; }
      }
    }
    void s;
  }
  const ini = esforcosNaSecao(rb, 0), fim = esforcosNaSecao(rb, rb.L);
  const ponta = (d) => Object.fromEntries(ESFORCOS.map((e) => [e, d[e]]));
  return {
    id: rb.id, L: rb.L,
    extremos: { i: ponta(ini), j: ponta(fim) },
    forcasExtremidade: rb.F,          // nós → barra, eixos locais (Fx, Fy, Fz, Mx, My, Mz em i e em j)
    deslocamentosLocais: rb.ul,
    diagrama, max: extremos,
    _rb: { L: rb.L, F: rb.F, formas: rb.formas, ul: rb.ul, geo: rb.geo },
  };
}

/**
 * Deformada de uma barra: deslocamentos globais (m) em n + 1 pontos, pelas funções de Hermite com os
 * deslocamentos das pontas mais a parcela das cargas distribuídas (solução de barra biengastada).
 * @returns {{x:number, p:number[], u:number[]}[]}  p = posição indeformada, u = deslocamento
 */
export function deformadaBarra(rb, n = 12) {
  const { L, ul, geo, formas } = rb;
  if (!geo || !ul) return [];
  const { R, pi, EIz, EIy } = geo;
  const wy = formas.filter((f) => f.tipo === 'q').reduce((s, f) => s + f.w[1], 0);
  const wz = formas.filter((f) => f.tipo === 'q').reduce((s, f) => s + f.w[2], 0);
  const out = [];
  for (let k = 0; k <= n; k++) {
    const x = (L * k) / n, xi = x / L;
    const N1 = 1 - 3 * xi ** 2 + 2 * xi ** 3, N2 = L * (xi - 2 * xi ** 2 + xi ** 3), N3 = 3 * xi ** 2 - 2 * xi ** 3, N4 = L * (-(xi ** 2) + xi ** 3);
    const part = (x * x * (L - x) ** 2) / 24;
    const u = ul[0] * (1 - xi) + ul[6] * xi;
    const v = N1 * ul[1] + N2 * ul[5] + N3 * ul[7] + N4 * ul[11] + (EIz ? (wy * part) / EIz : 0);
    const w = N1 * ul[2] - N2 * ul[4] + N3 * ul[8] - N4 * ul[10] + (EIy ? (wz * part) / EIy : 0);
    const loc = [u, v, w];
    const ug = [0, 1, 2].map((a) => R[0][a] * loc[0] + R[1][a] * loc[1] + R[2][a] * loc[2]);
    out.push({ x, p: [0, 1, 2].map((a) => pi[a] + R[0][a] * x), u: ug });
  }
  return out;
}

/* ================================================================== resultado */

const fmt = (v, c = 2) => {
  if (!Number.isFinite(v)) return '—';
  const r = Math.abs(v) < 0.5 * 10 ** -c ? 0 : v;
  return r.toFixed(c).replace('.', ',').replace(/^-/, '−');
};
const col = (s, n) => String(s).padStart(n);

/** Resultado da análise: dados por caso de carga, combinação linear e relatório em texto. */
export class ResultadoPortico {
  constructor(d) {
    Object.assign(this, d);
    const unico = d.casos.length === 1 ? d.porCaso[d.casos[0]] : this.combinar(Object.fromEntries(d.casos.map((c) => [c, 1])), 'Total');
    this.deslocamentos = unico.deslocamentos;
    this.reacoes = unico.reacoes;
    this.barras = unico.barras;
    this.equilibrio = unico.equilibrio;
  }

  /** Combinação linear dos casos: combinar({ G: 1.4, Q: 1.4 }). */
  combinar(fatores, nome = 'Combinação') {
    const casos = Object.keys(fatores).filter((c) => fatores[c]);
    for (const c of casos) if (!this.porCaso[c]) throw new Error(`Caso de carga "${c}" não existe (casos: ${this.casos.join(', ')}).`);
    const base = this.porCaso[this.casos[0]];
    const soma = (f) => (arr) => arr.map((_, k) => casos.reduce((s, c) => s + fatores[c] * f(this.porCaso[c])[k], 0));
    const deslocamentos = base.deslocamentos.map((d, k) => ({ id: d.id, u: soma((p) => p.deslocamentos[k].u)(d.u) }));
    const reacoes = base.reacoes.map((r, k) => ({ id: r.id, R: soma((p) => p.reacoes[k].R)(r.R), restricoes: r.restricoes }));
    const barras = base.barras.map((b, k) => {
      const F = soma((p) => p.barras[k]._rb.F)(b._rb.F);
      const formas = casos.flatMap((c) => this.porCaso[c].barras[k]._rb.formas.map((f) => escalarForma(f, fatores[c])));
      const ul = soma((p) => p.barras[k].deslocamentosLocais)(b.deslocamentosLocais);
      return resumoBarra({ id: b.id, L: b.L, F, ul, formas, geo: b._rb.geo });
    });
    const equilibrio = {
      cargas: [0, 1, 2].map((g) => casos.reduce((s, c) => s + fatores[c] * this.porCaso[c].equilibrio.cargas[g], 0)),
      reacoes: [0, 1, 2].map((g) => casos.reduce((s, c) => s + fatores[c] * this.porCaso[c].equilibrio.reacoes[g], 0)),
    };
    equilibrio.erro = Math.max(...[0, 1, 2].map((g) => Math.abs(equilibrio.cargas[g] + equilibrio.reacoes[g]))) / Math.max(1, ...equilibrio.cargas.map(Math.abs));
    return { caso: nome, fatores, deslocamentos, reacoes, barras, equilibrio };
  }

  /** Deslocamentos de um nó: { ux, uy, uz (m), rx, ry, rz (rad) }. */
  no(id) {
    const d = this.deslocamentos.find((x) => x.id === String(id));
    if (!d) throw new Error(`Nó ${id} não existe.`);
    return Object.fromEntries(GDL.map((g, k) => [g, d.u[k]]));
  }
  /** Reação de um nó apoiado: { Fx, Fy, Fz, Mx, My, Mz }. */
  reacao(id) {
    const r = this.reacoes.find((x) => x.id === String(id));
    if (!r) throw new Error(`Nó ${id} não tem reação.`);
    return Object.fromEntries(REACOES.map((g, k) => [g, r.R[k]]));
  }
  /** Esforços da barra: nas extremidades, ou numa seção a x metros do nó i. */
  barra(id, x) {
    const b = this.barras.find((bb) => bb.id === String(id));
    if (!b) throw new Error(`Barra ${id} não existe.`);
    if (x == null) return { L: b.L, i: b.extremos.i, j: b.extremos.j, max: b.max };
    if (!(x >= 0 && x <= b.L + 1e-9)) throw new Error(`x = ${x} fora da barra (L = ${fmt(b.L)} m).`);
    return esforcosNaSecao(b._rb, x);
  }

  /** Relatório em texto (o console mostra este texto). */
  texto() {
    const l = [];
    const r = this.resumo;
    l.push(`Pórtico ${this.tipo === 'espacial' ? 'espacial' : this.tipo === 'grelha' ? '— grelha' : `plano (${this.tipo.slice(6).toUpperCase()})`} — ${r.nos} nós, ${r.barras} barras, ${r.equacoes} equações (banda ${r.banda})`);
    if (this.casos.length > 1) l.push(`Casos de carga: ${this.casos.join(', ')} — abaixo, a soma de todos (use combinar({...}) para outra combinação)`);
    const e = this.equilibrio;
    l.push(`Equilíbrio: cargas (${e.cargas.map((v) => fmt(v)).join('; ')}) kN · reações (${e.reacoes.map((v) => fmt(v)).join('; ')}) kN ${e.erro < 1e-6 ? '✓' : `— diferença ${fmt(e.erro * 100, 4)} %`}`);
    for (const a of this.avisos) l.push(`Aviso: ${a}`);
    l.push('', 'DESLOCAMENTOS DOS NÓS (mm e mrad)', `${'Nó'.padEnd(8)}${['ux', 'uy', 'uz', 'rx', 'ry', 'rz'].map((s) => col(s, 10)).join('')}`);
    for (const d of this.deslocamentos) l.push(`${d.id.padEnd(8)}${d.u.map((v) => col(fmt(v * 1000, 3), 10)).join('')}`);
    l.push('', 'REAÇÕES DE APOIO (kN e kN·m)', `${'Nó'.padEnd(8)}${REACOES.map((s) => col(s, 10)).join('')}`);
    for (const rr of this.reacoes) l.push(`${rr.id.padEnd(8)}${rr.R.map((v, g) => col(rr.restricoes[g] ? fmt(v) : '·', 10)).join('')}`);
    l.push('', 'ESFORÇOS NAS BARRAS (eixos locais; kN e kN·m)', `${'Barra'.padEnd(12)}${col('L (m)', 7)}${ESFORCOS.map((s) => col(s, 10)).join('')}`);
    for (const b of this.barras) {
      l.push(`${`${b.id} · i`.padEnd(12)}${col(fmt(b.L), 7)}${ESFORCOS.map((s) => col(fmt(b.extremos.i[s]), 10)).join('')}`);
      l.push(`${'     j'.padEnd(12)}${col('', 7)}${ESFORCOS.map((s) => col(fmt(b.extremos.j[s]), 10)).join('')}`);
      const mz = b.max.Mz, my = b.max.My;
      const vao = [];
      if (mz.max > Math.max(b.extremos.i.Mz, b.extremos.j.Mz) + 1e-6) vao.push(`Mz,máx = ${fmt(mz.max)} em x = ${fmt(mz.xMax)} m`);
      if (my.max > Math.max(b.extremos.i.My, b.extremos.j.My) + 1e-6) vao.push(`My,máx = ${fmt(my.max)} em x = ${fmt(my.xMax)} m`);
      if (vao.length) l.push(`${''.padEnd(19)}no vão: ${vao.join(' · ')}`);
    }
    l.push('', 'Convenção: N > 0 é tração; Mz > 0 traciona o lado −y local (embaixo, nas vigas); dMz/dx = Vy.',
      'Consultas: r.no(id) · r.reacao(id) · r.barra(id) · r.barra(id, x) · r.combinar({ G: 1.4, Q: 1.4 })');
    return l.join('\n');
  }
  toString() { return this.texto(); }
  [Symbol.for('lebr.console')]() { return this.texto(); }
}

function escalarForma(f, k) {
  if (f.tipo === 'mt') return { ...f, m: f.m * k };
  return { ...f, w: f.w.map((v) => v * k) };
}

/* ================================================================== montagem por comandos */

/**
 * Modelo montado passo a passo (usado pelo console):
 *   m = new ModeloPortico({ material: { fck: 25 } })
 *   m.no('A', 0, 0, 0, 'engaste').no('B', 0, 0, 3) …
 *   m.barra('P1', 'A', 'B', { secao: [20, 40] })
 *   m.carga('B', { Fx: 10 }) ; m.resolver()
 */
export class ModeloPortico {
  constructor(op = {}) {
    this.nos = []; this.barras = []; this.cargas = [];
    this.material = op.material ?? {}; this.tipo = op.tipo ?? 'espacial'; this.pesoProprio = op.pesoProprio ?? false;
    if (op.secao) this.secao = op.secao;
  }
  no(id, x = 0, y = 0, z = 0, apoio = null, op = {}) {
    if (this.nos.some((n) => n.id === String(id))) throw new Error(`Nó ${id} já existe.`);
    this.nos.push({ id: String(id), x, y, z, apoio, ...op });
    return this;
  }
  apoio(id, apoio, molas) {
    const n = this.nos.find((x) => x.id === String(id));
    if (!n) throw new Error(`Nó ${id} não existe.`);
    n.apoio = apoio; if (molas) n.molas = molas;
    return this;
  }
  barra(id, i, j, props = {}) {
    if (this.barras.some((b) => b.id === String(id))) throw new Error(`Barra ${id} já existe.`);
    this.barras.push({ id: String(id), i: String(i), j: String(j), ...props });
    return this;
  }
  carga(no, forcas, caso) { this.cargas.push({ no: String(no), ...forcas, ...(caso ? { caso } : {}) }); return this; }
  /** Carga distribuída numa barra: q('V1', -10) (Z global) ou q('V1', { Z: -10, caso: 'Q' }). */
  q(barra, valor, caso) {
    const b = this.barras.find((x) => x.id === String(barra));
    if (!b) throw new Error(`Barra ${barra} não existe.`);
    const v = typeof valor === 'number' ? { Z: valor } : valor;
    const c = v.caso ?? caso;
    for (const [d, val] of Object.entries(v)) if (d !== 'caso') (b.cargas ??= []).push({ tipo: 'q', dir: d, valor: val, ...(c ? { caso: c } : {}) });
    return this;
  }
  /** Carga concentrada numa barra a a metros do nó i: P('V1', 2, -20) (Z global). */
  P(barra, a, valor, dir = 'Z', caso) {
    const b = this.barras.find((x) => x.id === String(barra));
    if (!b) throw new Error(`Barra ${barra} não existe.`);
    (b.cargas ??= []).push({ tipo: 'P', dir, valor, a, ...(caso ? { caso } : {}) });
    return this;
  }
  dados() { return { tipo: this.tipo, material: this.material, pesoProprio: this.pesoProprio, secao: this.secao, nos: this.nos, barras: this.barras, cargas: this.cargas }; }
  resolver() { return analisarPortico(this.dados()); }
  [Symbol.for('lebr.console')]() {
    return `Modelo de pórtico: ${this.nos.length} nós, ${this.barras.length} barras, ${this.cargas.length} cargas nodais. Use .no(), .barra(), .carga(), .q(), .P() e .resolver().`;
  }
}

/** Pórtico de exemplo: dois pilares engastados de 3 m e uma viga de 6 m, carga vertical (G) e vento (V). */
export function exemploPortico() {
  return new ModeloPortico({ material: { fck: 25 } })
    .no('A', 0, 0, 0, 'engaste').no('B', 0, 0, 3).no('C', 6, 0, 3).no('D', 6, 0, 0, 'engaste')
    .barra('P1', 'A', 'B', { secao: { b: 20, h: 40 } })
    .barra('V1', 'B', 'C', { secao: { b: 15, h: 50 } })
    .barra('P2', 'D', 'C', { secao: { b: 20, h: 40 } })
    .q('V1', -12, 'G')
    .carga('B', { Fx: 8 }, 'V');
}
