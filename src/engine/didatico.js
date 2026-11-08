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
 * Contas das lições do módulo Aprender: fórmulas fechadas, escritas para serem lidas. Nada aqui substitui os módulos
 * de cálculo; as lições que mostram armadura usam os módulos de verdade (modules/comum/didatico-elementos.js).
 *
 * Convenções: x em m a partir do apoio esquerdo (no balanço, a partir do engaste); q em kN/m; V em kN; M em kN·m,
 * positivo quando traciona a face de baixo (e o DMF é desenhado do lado tracionado, como se faz no Brasil).
 */

export const TIPOS_VIGA = {
  biapoiada: 'Biapoiada',
  balanco: 'Em balanço',
  biengastada: 'Biengastada',
};

/**
 * Esforços e deformada de uma viga de um vão com carga uniforme q.
 * Flecha em "unidades de q·L⁴/EI": y(x) = q/(24·EI)·f(x), devolvida como fração da flecha máxima (forma) e o
 * coeficiente c de fmax = c·q·L⁴/(EI).
 */
export function esforcosViga(tipo, L, q, n = 81) {
  const xs = Array.from({ length: n }, (_, i) => (L * i) / (n - 1));
  let V, M, y, reacoes, c;
  if (tipo === 'balanco') {
    // engaste em x = 0, ponta livre em x = L
    V = (x) => q * (L - x);
    M = (x) => -(q * (L - x) ** 2) / 2;
    y = (x) => (x * x * (6 * L * L - 4 * L * x + x * x)) / 24;
    reacoes = [{ x: 0, R: q * L, M: -(q * L * L) / 2 }];
    c = 1 / 8;
  } else if (tipo === 'biengastada') {
    V = (x) => q * (L / 2 - x);
    M = (x) => (q * (6 * L * x - 6 * x * x - L * L)) / 12;
    y = (x) => (x * x * (L - x) ** 2) / 24;
    reacoes = [{ x: 0, R: (q * L) / 2, M: -(q * L * L) / 12 }, { x: L, R: (q * L) / 2, M: -(q * L * L) / 12 }];
    c = 1 / 384;
  } else {
    V = (x) => q * (L / 2 - x);
    M = (x) => (q * x * (L - x)) / 2;
    y = (x) => (x * (L ** 3 - 2 * L * x * x + x ** 3)) / 24;
    reacoes = [{ x: 0, R: (q * L) / 2, M: 0 }, { x: L, R: (q * L) / 2, M: 0 }];
    c = 5 / 384;
  }
  const ys = xs.map(y);
  const ymax = Math.max(...ys.map(Math.abs)) || 1;
  const Ms = xs.map(M), Vs = xs.map(V);
  return {
    tipo, L, q, x: xs, V: Vs, M: Ms, forma: ys.map((v) => v / ymax),
    reacoes, Mmax: Math.max(...Ms), Mmin: Math.min(...Ms), Vmax: Math.max(...Vs.map(Math.abs)),
    coefFlecha: c,
    // forma da deformada normalizada (1 = flecha máxima), para desenhar
    em: (x) => ({ V: V(x), M: M(x) }),
  };
}

/** Flecha elástica máxima (cm) da viga de concreto retangular b × h (cm), E em MPa, q em kN/m, L em m. */
export function flechaElastica(tipo, L, q, b, h, E) {
  const c = esforcosViga(tipo, L, q, 3).coefFlecha;
  const I = (b * h ** 3) / 12 / 1e8;                 // m⁴
  const EI = E * 1000 * I;                           // kN·m²
  return (c * q * L ** 4) / EI * 100;                // cm
}

/**
 * Flexão simples na seção retangular (NBR 6118, 17.2, concreto até C50): bloco retangular 0,8·x com 0,85·fcd,
 * εcu = 3,5 ‰; CA-50. Devolve o domínio, as deformações, as forças e o aço.
 * @param {{ b:number, h:number, d?:number, fck:number, fyk?:number, Md:number }} p  cm, MPa, kN·m
 */
export function flexaoSecao({ b, h, d = h - 4, fck, fyk = 500, Md }) {
  const fcd = fck / 1.4 / 10;                         // kN/cm²
  const fyd = fyk / 1.15 / 10;                        // kN/cm²
  const eyd = (fyk / 1.15 / 210000) * 1000;           // ‰
  const xi34 = 3.5 / (3.5 + eyd);                     // limite dos domínios 3 e 4
  const xi23 = 3.5 / (3.5 + 10);                      // 0,259
  const M = Math.max(0, Md) * 100;                    // kN·cm
  const K = M / (b * d * d * fcd);
  const disc = 0.68 ** 2 - 4 * 0.272 * K;
  if (disc < 0) return { ok: false, motivo: 'A seção não resiste a esse momento só com aço tracionado: aumente a altura ou a largura.', K, xi34, xi23, fcd, fyd, d };
  const xi = (0.68 - Math.sqrt(disc)) / (2 * 0.272);
  const x = xi * d;
  const z = d - 0.4 * x;
  const dominio = xi <= xi23 ? 2 : xi <= xi34 ? 3 : 4;
  // deformações (‰): no domínio 2 o aço está a 10 ‰; nos 3 e 4, o concreto a 3,5 ‰
  const epsS = dominio === 2 ? 10 : (3.5 * (1 - xi)) / Math.max(xi, 1e-9);
  const epsC = dominio === 2 ? (10 * xi) / Math.max(1 - xi, 1e-9) : 3.5;
  const sigmaS = Math.min(fyd, (epsS / 1000) * 21000);   // kN/cm²
  const Rc = 0.85 * fcd * b * 0.8 * x;                   // kN
  const As = M > 0 ? Rc / sigmaS : 0;                     // cm²
  return {
    ok: true, d, K, xi, x, z, dominio, epsC, epsS, eyd, xi23, xi34, fcd, fyd, sigmaS, Rc, Rs: As * sigmaS, As,
    ductil: xi <= 0.45,                                  // 14.6.4.3: x/d ≤ 0,45 até C50
  };
}

/** Momento que leva a seção de x/d = 0 até o limite de ductilidade x/d = 0,45 (kN·m), para a escala da animação. */
export function momentoLimite({ b, h, d = h - 4, fck }) {
  const fcd = fck / 1.4 / 10, xi = 0.45;
  return (0.85 * fcd * b * 0.8 * xi * d * (d - 0.4 * xi * d)) / 100;
}

/**
 * Esbeltez do pilar biarticulado (NBR 6118, 15.8.2): λ = le·√12/h, λ1 = (25 + 12,5·e1/h)/αb entre 35 e 90; classe
 * do pilar e carga crítica de Euler com o módulo secante (só para ilustrar a flambagem).
 */
export function esbeltezPilar({ h, le, e1h = 0, ab = 1, E = 23800, b = 20 }) {
  const lambda = (le * 100 * Math.sqrt(12)) / h;
  const lambda1 = Math.min(90, Math.max(35, (25 + 12.5 * e1h) / ab));
  const classe = lambda <= lambda1 ? 'curto' : lambda <= 90 ? 'medianamente esbelto' : lambda <= 140 ? 'esbelto' : lambda <= 200 ? 'muito esbelto' : 'proibido';
  const I = (b * h ** 3) / 12 / 1e8;
  const Ncr = (Math.PI ** 2 * E * 1000 * I) / (le * le);  // kN
  return { lambda, lambda1, classe, segundaOrdem: lambda > lambda1, Ncr };
}

/** Laje retangular: λ = ly/lx (lx o menor vão) e se é armada em uma ou nas duas direções (λ > 2 → uma). */
export function direcoesLaje(lx, ly) {
  const a = Math.min(lx, ly), b = Math.max(lx, ly);
  const lambda = b / a;
  // parcela da carga em cada direção numa laje apoiada nos quatro lados (faixas de Marcus, só para ilustrar)
  const kx = b ** 4 / (a ** 4 + b ** 4);
  return { lambda, umaDirecao: lambda > 2, kCurto: kx, kLongo: 1 - kx };
}

/** Suavização das animações (0 → 1). */
export const suave = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
