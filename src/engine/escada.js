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
 * Escadas de concreto armado — lajes armadas longitudinalmente (NBR 6118:2023, 19 · NBR 6120:2019 · NBR 9050:2020).
 *
 * Unidades: alturas e degraus em cm; vãos, larguras e projeções em m; cargas em kN/m² (projeção horizontal) e kN/m.
 *
 *   Degraus: n espelhos = arred(H/e alvo), e = H/n; Blondel 63 ≤ 2e + p ≤ 65 cm, 16 ≤ e ≤ 18 cm, 28 ≤ p ≤ 32 cm (NBR 9050, 6.8.2).
 *   Inclinação: tg α = e/p. Espessura média do lance (medida na vertical): hm = h/cos α + e/2.
 *   Cargas: lance g = γc·hm + revestimento (+ guarda-corpo/largura); patamar g = γc·h + revestimento; q da NBR 6120.
 *   Modelo: cada tramo (lance com os patamares que ele carrega) é uma laje armada na direção do lance, biapoiada
 *   nos dois extremos, com o vão na projeção horizontal e as cargas por trecho.
 *     reta: patamar inferior + lance + patamar superior;
 *     L:    dois tramos que se cruzam no patamar de canto, cada um com metade da carga do patamar;
 *     U:    dois tramos lado a lado, cada um com o lance e o patamar intermediário (faixa b + vão central/2).
 */

const RAD = Math.PI / 180;

/** Carga de uso (kN/m²) da NBR 6120:2019, Tabela 10: escadas sem e com acesso ao público. */
export const USO_ESCADA = {
  privativa: { nome: 'Sem acesso ao público (residencial)', q: 2.5 },
  publica: { nome: 'Com acesso ao público', q: 3.0 },
};

export const TIPOS_ESCADA = {
  reta: { nome: 'Lance reto', lances: 1 },
  L: { nome: 'Em L (dois lances a 90°)', lances: 2 },
  U: { nome: 'Em U (dois lances paralelos)', lances: 2 },
};

/** Número de espelhos e dimensões dos degraus para vencer H (cm). */
export function degraus({ H, espelhoAlvo = 17.5, piso = 28 }) {
  if (!(H > 0)) throw new Error('O desnível da escada deve ser positivo.');
  const n = Math.max(2, Math.round(H / espelhoAlvo));
  const e = H / n;
  return { n, e, p: piso, blondel: 2 * e + piso, alfa: Math.atan(e / piso) / RAD };
}

/** Espelhos de cada lance: reta [n]; L e U dividem ao meio (o primeiro fica com o ímpar). */
export function divisaoLances(tipo, n) {
  if (tipo === 'reta') return [n];
  const n1 = Math.ceil(n / 2);
  return [n1, n - n1];
}

/** Cargas (kN/m², na projeção horizontal) do lance e do patamar. */
export function cargasEscada({ h, e, p, gama = 25, revestimento = 1.0, guardaCorpo = 0, largura = 1, q = 2.5 }) {
  const cos = p / Math.hypot(p, e);
  const hm = h / cos + e / 2;                     // cm
  const gc = largura > 0 ? guardaCorpo / largura : 0;
  const lance = { hm, pp: (gama * hm) / 100, g: (gama * hm) / 100 + revestimento + gc, q };
  const patamar = { pp: (gama * h) / 100, g: (gama * h) / 100 + revestimento + gc, q };
  return { cos, alfa: Math.acos(cos) / RAD, lance, patamar };
}

/**
 * Geometria em planta (coordenadas locais em m: x na largura, y no sentido de subida do primeiro lance) e tramos.
 * @param {object} p  { tipo, espelhos:[n1,n2], p (cm), largura b (m), patamar (m), vaoCentral (m), patamarInferior, patamarSuperior }
 */
export function geometriaEscada({ tipo, espelhos, p, largura: b, patamar, vaoCentral = 0, patamarInferior = 0, patamarSuperior = 0 }) {
  const proj = espelhos.map((n) => ((n - 1) * p) / 100);   // projeção de cada lance (m): n espelhos, n − 1 pisos
  const pi = patamarInferior, ps = patamarSuperior;
  const ret = (x0, y0, x1, y1) => ({ x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1), y1: Math.max(y0, y1) });
  let lances, patamares, apoios, largura, comprimento;
  if (tipo === 'reta') {
    lances = [{ ...ret(0, pi, b, pi + proj[0]), sentido: [0, 1], espelhos: espelhos[0] }];
    patamares = [];
    if (pi > 0) patamares.push({ ...ret(0, 0, b, pi), nivel: 'inferior' });
    if (ps > 0) patamares.push({ ...ret(0, pi + proj[0], b, pi + proj[0] + ps), nivel: 'superior' });
    largura = b; comprimento = pi + proj[0] + ps;
    apoios = [
      { id: 't1-ini', tramo: 0, extremo: 'ini', nivel: 'inferior', seg: [[0, 0], [b, 0]] },
      { id: 't1-fim', tramo: 0, extremo: 'fim', nivel: 'superior', seg: [[0, comprimento], [b, comprimento]] },
    ];
  } else if (tipo === 'L') {
    const a = pi + proj[0];
    lances = [{ ...ret(0, pi, b, a), sentido: [0, 1], espelhos: espelhos[0] }, { ...ret(b, a, b + proj[1], a + b), sentido: [1, 0], espelhos: espelhos[1] }];
    patamares = [{ ...ret(0, a, b, a + b), nivel: 'intermediario' }];
    if (pi > 0) patamares.push({ ...ret(0, 0, b, pi), nivel: 'inferior' });
    if (ps > 0) patamares.push({ ...ret(b + proj[1], a, b + proj[1] + ps, a + b), nivel: 'superior' });
    largura = b + proj[1] + ps; comprimento = a + b;
    apoios = [
      { id: 't1-ini', tramo: 0, extremo: 'ini', nivel: 'inferior', seg: [[0, 0], [b, 0]] },
      { id: 't1-fim', tramo: 0, extremo: 'fim', nivel: 'intermediario', seg: [[0, a + b], [b, a + b]] },
      { id: 't2-ini', tramo: 1, extremo: 'ini', nivel: 'intermediario', seg: [[0, a], [0, a + b]] },
      { id: 't2-fim', tramo: 1, extremo: 'fim', nivel: 'superior', seg: [[largura, a], [largura, a + b]] },
    ];
  } else if (tipo === 'U') {
    const g = vaoCentral, a = pi + proj[0];
    lances = [{ ...ret(0, pi, b, a), sentido: [0, 1], espelhos: espelhos[0] }, { ...ret(b + g, a - proj[1], 2 * b + g, a), sentido: [0, -1], espelhos: espelhos[1] }];
    patamares = [{ ...ret(0, a, 2 * b + g, a + patamar), nivel: 'intermediario' }];
    if (pi > 0) patamares.push({ ...ret(0, 0, b, pi), nivel: 'inferior' });
    const yChegada = a - proj[1];
    if (ps > 0) patamares.push({ ...ret(b + g, yChegada - ps, 2 * b + g, yChegada), nivel: 'superior' });
    largura = 2 * b + g; comprimento = a + patamar;
    const y2 = yChegada - ps;
    apoios = [
      { id: 't1-ini', tramo: 0, extremo: 'ini', nivel: 'inferior', seg: [[0, 0], [b, 0]] },
      { id: 't1-fim', tramo: 0, extremo: 'fim', nivel: 'intermediario', seg: [[0, a + patamar], [b, a + patamar]] },
      { id: 't2-ini', tramo: 1, extremo: 'ini', nivel: 'intermediario', seg: [[b + g, a + patamar], [2 * b + g, a + patamar]] },
      { id: 't2-fim', tramo: 1, extremo: 'fim', nivel: 'superior', seg: [[b + g, y2], [2 * b + g, y2]] },
    ];
  } else throw new Error(`Tipo de escada desconhecido: ${tipo}.`);
  return { proj, lances, patamares, apoios, largura, comprimento };
}

/**
 * Tramos de cálculo (laje biapoiada por faixa de largura b), com os trechos de carga ao longo do vão.
 * @param {object} p  { tipo, proj:[m], largura b, patamar, vaoCentral, patamarInferior, patamarSuperior, cargas (de cargasEscada) }
 * @returns {{nome, L, trechos:{tipo, a, b, g, q}[]}[]}
 */
export function tramosEscada({ tipo, proj, largura: b, patamar, vaoCentral = 0, patamarInferior = 0, patamarSuperior = 0, cargas }) {
  const L = cargas.lance, P = cargas.patamar;
  const montar = (partes) => {
    let x = 0;
    const trechos = partes.filter((t) => t.c > 1e-9).map((t) => {
      const tr = { tipo: t.tipo, a: x, b: x + t.c, g: t.k * (t.tipo === 'lance' ? L.g : P.g), q: t.k * (t.tipo === 'lance' ? L.q : P.q), fator: t.k };
      x += t.c;
      return tr;
    });
    return { L: x, trechos };
  };
  if (tipo === 'reta') {
    return [{ nome: 'Tramo único', ...montar([{ tipo: 'patamar', c: patamarInferior, k: 1 }, { tipo: 'lance', c: proj[0], k: 1 }, { tipo: 'patamar', c: patamarSuperior, k: 1 }]) }];
  }
  if (tipo === 'L') {
    // patamar de canto armado nas duas direções: metade da carga para cada tramo
    return [
      { nome: 'Tramo 1 (lance 1 + patamar)', ...montar([{ tipo: 'patamar', c: patamarInferior, k: 1 }, { tipo: 'lance', c: proj[0], k: 1 }, { tipo: 'patamar', c: b, k: 0.5 }]) },
      { nome: 'Tramo 2 (patamar + lance 2)', ...montar([{ tipo: 'patamar', c: b, k: 0.5 }, { tipo: 'lance', c: proj[1], k: 1 }, { tipo: 'patamar', c: patamarSuperior, k: 1 }]) },
    ];
  }
  // U: cada faixa leva o seu lance e a parte do patamar intermediário (b + vão central/2)
  const k = b > 0 ? (b + vaoCentral / 2) / b : 1;
  return [
    { nome: 'Tramo 1 (lance 1 + patamar)', ...montar([{ tipo: 'patamar', c: patamarInferior, k: 1 }, { tipo: 'lance', c: proj[0], k: 1 }, { tipo: 'patamar', c: patamar, k }]) },
    { nome: 'Tramo 2 (patamar + lance 2)', ...montar([{ tipo: 'patamar', c: patamar, k }, { tipo: 'lance', c: proj[1], k: 1 }, { tipo: 'patamar', c: patamarSuperior, k: 1 }]) },
  ];
}

/**
 * Viga biapoiada com cargas uniformes por trecho (por metro de largura).
 * @param {{a,b}[]} trechos  com a intensidade em `chave` (kN/m por m de largura)
 * @param {number} L  vão (m)
 * @param {(t)=>number} w  intensidade de cada trecho
 * @returns {{RA, RB, Mmax, xM, M:(x)=>number}}
 */
export function biapoiadaPorTrechos(trechos, L, w) {
  let W = 0, Mo = 0;
  for (const t of trechos) { const c = t.b - t.a, v = w(t) * c; W += v; Mo += v * (t.a + c / 2); }
  const RB = L > 0 ? Mo / L : 0, RA = W - RB;
  const M = (x) => {
    let m = RA * x;
    for (const t of trechos) {
      if (x <= t.a) continue;
      const fim = Math.min(x, t.b), c = fim - t.a;
      m -= w(t) * c * (x - (t.a + c / 2));
    }
    return m;
  };
  // máximo: onde a cortante zera (dentro de um trecho) — procura em cada trecho
  let xM = 0, Mmax = 0;
  const testar = (x) => { const m = M(x); if (m > Mmax) { Mmax = m; xM = x; } };
  let V = RA;
  for (const t of trechos) {
    const wt = w(t), c = t.b - t.a;
    if (wt > 0 && V > 0 && V - wt * c <= 0) testar(t.a + V / wt);
    testar(t.a); testar(t.b);
    V -= wt * c;
  }
  return { RA, RB, Mmax, xM, M, W };
}

/** Flecha máxima (m) da biapoiada por integração numérica da curvatura M/EI (EI em kN·m²). */
export function flechaBiapoiada(M, L, EI, n = 400) {
  const dx = L / n;
  const k = Array.from({ length: n + 1 }, (_, i) => M(i * dx) / EI);
  // θ e v com v(0) = 0, depois corrige a rotação inicial para v(L) = 0
  const th = [0], v = [0];
  for (let i = 1; i <= n; i++) {
    th.push(th[i - 1] + ((k[i - 1] + k[i]) / 2) * dx);
    v.push(v[i - 1] + ((th[i - 1] + th[i]) / 2) * dx);
  }
  const corr = v[n] / L;
  let max = 0;
  for (let i = 0; i <= n; i++) max = Math.max(max, Math.abs(v[i] - corr * i * dx));
  return max;
}

/** Biapoiada por trechos com a intensidade em `campo` de cada trecho (forma serializável, para o banco de validação). */
export function tramoBiapoiado({ trechos, L, campo = 'w' }) {
  const { RA, RB, Mmax, xM, W } = biapoiadaPorTrechos(trechos, L, (t) => Number(t[campo]) || 0);
  return { RA, RB, Mmax, xM, W };
}
