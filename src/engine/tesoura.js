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
 * Tesouras de telhado em duas águas: geometria (Howe e Pratt; com dois painéis, a tesoura simples de perna, linha e pendural) e treliça plana de nós
 * articulados resolvida pelo método dos deslocamentos. Unidades: m, kN, kN/m², E em kN/m².
 */
import { resolverDenso } from './algebra.js';

export const TIPOS_TESOURA = [
  { valor: 'howe', texto: 'Howe', descricao: 'Montantes tracionados e diagonais (escoras) comprimidas — a tesoura usual de madeira' },
  { valor: 'pratt', texto: 'Pratt', descricao: 'Diagonais tracionadas e montantes comprimidos' },
];

export const GRUPOS_TESOURA = {
  banzoSup: 'Banzo superior (perna)',
  banzoInf: 'Banzo inferior (linha)',
  montante: 'Montantes (pendural e tirantes)',
  diagonal: 'Diagonais (escoras)',
};

/**
 * Nós e barras de uma tesoura de duas águas simétrica.
 * @param {object} op
 * @param {'howe'|'pratt'} op.tipo
 * @param {number} op.L          vão entre apoios (m)
 * @param {number} op.inclinacao inclinação das águas (%)
 * @param {number} op.paineis    número de painéis do banzo inferior (par, 2 a 16)
 * @returns {{nos:{x:number,y:number,tipo:'inf'|'sup'}[], barras:{i:number,j:number,grupo:string,nome:string}[], H:number, alfa:number, inf:number[], sup:number[]}}
 */
export function geometriaTesoura({ tipo = 'howe', L, inclinacao, paineis = 6 }) {
  const n = Math.max(2, 2 * Math.round((Number(paineis) || 2) / 2));
  if (!(L > 0)) throw new Error('O vão da tesoura precisa ser maior que zero.');
  if (!(inclinacao > 0)) throw new Error('A inclinação precisa ser maior que zero.');
  const t = inclinacao / 100, alfa = Math.atan(t), H = (t * L) / 2;
  const nos = [], barras = [];
  const inf = [], sup = [];
  // banzo inferior: n + 1 nós (0 e n são os apoios)
  for (let i = 0; i <= n; i++) { inf.push(nos.length); nos.push({ x: (i * L) / n, y: 0, tipo: 'inf' }); }
  // banzo superior: nós no mesmo prumo dos nós internos do banzo inferior
  sup[0] = inf[0]; sup[n] = inf[n];
  for (let i = 1; i < n; i++) {
    const x = (i * L) / n;
    sup[i] = nos.length; nos.push({ x, y: t * Math.min(x, L - x), tipo: 'sup' });
  }
  const b = (i, j, grupo, nome) => barras.push({ i, j, grupo, nome });
  for (let i = 0; i < n; i++) b(inf[i], inf[i + 1], 'banzoInf', `Banzo inferior ${i + 1}`);
  for (let i = 0; i < n; i++) b(sup[i], sup[i + 1], 'banzoSup', `Banzo superior ${i + 1}`);
  const meio = n / 2;
  {
    for (let i = 1; i < n; i++) b(inf[i], sup[i], 'montante', i === meio ? 'Pendural' : `Montante ${i}`);
    for (let i = 1; i < meio; i++) {
      if (tipo === 'pratt') {
        b(sup[i + 1], inf[i], 'diagonal', `Diagonal ${i}`);
        b(sup[n - i - 1], inf[n - i], 'diagonal', `Diagonal ${n - i}`);
      } else {
        // Howe: escoras do pé do montante mais próximo do centro até o nó superior de fora
        b(sup[i], inf[i + 1], 'diagonal', `Diagonal ${i}`);
        b(sup[n - i], inf[n - i - 1], 'diagonal', `Diagonal ${n - i}`);
      }
    }
  }
  for (const br of barras) {
    const p = nos[br.i], q = nos[br.j];
    br.L = Math.hypot(q.x - p.x, q.y - p.y);
  }
  return { nos, barras, H, alfa, inf, sup, n };
}

/**
 * Treliça plana de nós articulados.
 * @param {object} op
 * @param {{x:number,y:number}[]} op.nos
 * @param {{i:number,j:number,EA:number}[]} op.barras   EA em kN
 * @param {Object<number,[boolean,boolean]>} op.apoios  nó → [restringe x, restringe y]
 * @param {Object<number,[number,number]>} op.cargas    nó → [Fx, Fy] (kN; y para cima)
 * @returns {{N:number[], u:number[][], reacoes:Object<number,[number,number]>}}  N > 0 tração
 */
export function resolverTrelica({ nos, barras, apoios, cargas }) {
  const nd = nos.length * 2;
  const K = Array.from({ length: nd }, () => new Array(nd).fill(0));
  const F = new Array(nd).fill(0);
  const geo = barras.map((b) => {
    const p = nos[b.i], q = nos[b.j];
    const L = Math.hypot(q.x - p.x, q.y - p.y);
    return { c: (q.x - p.x) / L, s: (q.y - p.y) / L, L };
  });
  barras.forEach((b, k) => {
    const { c, s, L } = geo[k];
    const kk = b.EA / L;
    const m = [[c * c, c * s], [c * s, s * s]];
    const gl = [2 * b.i, 2 * b.i + 1, 2 * b.j, 2 * b.j + 1];
    for (let a = 0; a < 4; a++) for (let d = 0; d < 4; d++) {
      const sinal = (a < 2) === (d < 2) ? 1 : -1;
      K[gl[a]][gl[d]] += sinal * kk * m[a % 2][d % 2];
    }
  });
  for (const [no, f] of Object.entries(cargas ?? {})) { F[2 * no] += f[0]; F[2 * no + 1] += f[1]; }
  const presos = new Set();
  for (const [no, r] of Object.entries(apoios)) { if (r[0]) presos.add(2 * no); if (r[1]) presos.add(2 * no + 1); }
  const livres = [...Array(nd).keys()].filter((g) => !presos.has(g));
  const Kr = livres.map((a) => livres.map((d) => K[a][d]));
  const ur = resolverDenso(Kr, livres.map((a) => F[a]));
  if (ur.some((v) => !Number.isFinite(v))) throw new Error('Treliça hipostática: confira a geometria e os apoios.');
  const u = new Array(nd).fill(0);
  livres.forEach((g, k) => { u[g] = ur[k]; });
  const N = barras.map((b, k) => {
    const { c, s, L } = geo[k];
    const du = (u[2 * b.j] - u[2 * b.i]) * c + (u[2 * b.j + 1] - u[2 * b.i + 1]) * s;
    return (b.EA / L) * du;
  });
  const reacoes = {};
  for (const [no, r] of Object.entries(apoios)) {
    const ku = (g) => K[g].reduce((s0, kv, d) => s0 + kv * u[d], 0) - F[g];
    reacoes[no] = [r[0] ? ku(2 * no) : 0, r[1] ? ku(2 * no + 1) : 0];
  }
  return { N, u: nos.map((_, i) => [u[2 * i], u[2 * i + 1]]), reacoes };
}

/**
 * Ligação por entalhe simples no nó de apoio (perna sobre a linha): profundidade necessária pela compressão
 * inclinada (Hankinson) e comprimento da "folga" do banzo inferior além do dente pelo cisalhamento.
 * @param {number} Nd     compressão de cálculo na perna (kN)
 * @param {number} alfa   inclinação da perna (rad)
 * @param {number} b      espessura das peças (cm)
 * @param {object} m      material (fc0d, fc90d, fvd em MPa)
 */
export function entalheApoio({ Nd, alfa, b, hInf, m }) {
  const s2 = Math.sin(alfa) ** 2, c2 = Math.cos(alfa) ** 2;
  const fca = (m.fc0d * m.fc90d) / (m.fc0d * s2 + m.fc90d * c2);   // Hankinson (MPa)
  const H = Math.abs(Nd) * Math.cos(alfa);                          // componente horizontal (kN)
  // face do dente perpendicular à linha: área b·e, compressão inclinada de α em relação às fibras da linha
  const eNec = (H / (b * fca)) * 10;                                // cm
  const eMax = hInf / 4;
  const fNec = (H / (b * m.fvd)) * 10;                              // cm
  return { fca, H, eNec, eMax, ok: eNec <= eMax + 1e-9, fNec, e: Math.max(2, Math.ceil(eNec * 2) / 2), f: Math.max(15, Math.ceil(fNec / 5) * 5) };
}

/**
 * Tesoura inteira resolvida: geometria + treliça com cargas verticais nos nós do banzo superior (kN, para baixo) e,
 * opcionalmente, nos do inferior. Devolve os esforços por nome de barra — útil para validação com soluções fechadas.
 */
export function resolverTesoura({ tipo = 'howe', L, inclinacao, paineis, Psup = 0, Pinf = 0, EA = 1e5 }) {
  const g = geometriaTesoura({ tipo, L, inclinacao, paineis });
  const cargas = {};
  const vSup = Array.isArray(Psup) ? Psup : g.sup.map((_, k) => (k === 0 || k === g.n ? Psup / 2 : Psup));
  const vInf = Array.isArray(Pinf) ? Pinf : g.inf.map((_, k) => (k === 0 || k === g.n ? Pinf / 2 : Pinf));
  g.sup.forEach((no, k) => { cargas[no] = [0, -(vSup[k] ?? 0)]; });
  g.inf.forEach((no, k) => { if (k > 0 && k < g.n) cargas[no] = [(cargas[no]?.[0] ?? 0), (cargas[no]?.[1] ?? 0) - (vInf[k] ?? 0)]; });
  const r = resolverTrelica({ nos: g.nos, barras: g.barras.map((b) => ({ ...b, EA })), apoios: { [g.inf[0]]: [true, true], [g.inf[g.n]]: [false, true] }, cargas });
  const N = Object.fromEntries(g.barras.map((b, k) => [b.nome, r.N[k]]));
  return { H: g.H, alfa: g.alfa, N, RA: r.reacoes[g.inf[0]][1], RB: r.reacoes[g.inf[g.n]][1], barras: g.barras.map((b, k) => ({ nome: b.nome, grupo: b.grupo, L: b.L, N: r.N[k] })) };
}
