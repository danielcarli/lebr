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
 * Sapata isolada de concreto armado — geotecnia (NBR 6122:2019) e estrutura (NBR 6118:2023, 22.6).
 *
 * Unidades: dimensões da sapata e do pilar em cm; profundidades em m; forças em kN; momentos em kN·m;
 * tensões no solo em kPa (kN/m²).
 *
 *   Tensão admissível estimada pelo SPT (correlação semiempírica usual, Teixeira e Godoy, 1996):
 *     σadm = 20·N kPa (0,02·N MPa), N = NSPT médio no bulbo (da cota de apoio até 2·B abaixo), 5 ≤ N ≤ 20
 *   Tensões na base (base inteiramente comprimida, excentricidades no núcleo central):
 *     σ = N/(A·B) · (1 ± 6·ex/A ± 6·ey/B), com ex = Mx/N e ey = My/N
 *   Rigidez (22.6.1): sapata rígida quando h ≥ (a − ap)/3 nas duas direções; senão, flexível.
 *   Flexão (método do CEB-70, usual nas sapatas): momento na seção S1, a 0,15·ap para dentro da face do pilar:
 *     M1 = σ·B·(c + 0,15·ap)²/2, com o balanço c = (A − ap)/2.
 */

export const LIMITE_N_SPT = { min: 5, max: 20 };
export const DIMENSAO_MINIMA = 60; // cm — menor dimensão em planta de uma sapata (NBR 6122)

/** Tensão admissível estimada pelo NSPT médio (kPa). */
export function tensaoAdmissivelSPT(N) {
  const avisos = [];
  if (!Number.isFinite(N)) return { sigma: null, N: null, Nusado: null, avisos: ['Sem ensaios SPT no bulbo da sapata.'] };
  let Nu = N;
  if (N < LIMITE_N_SPT.min) avisos.push(`NSPT médio ${N.toFixed(1).replace('.', ',')} < 5: solo fraco para sapata — a correlação não vale; investigue ou use fundação profunda.`);
  if (N > LIMITE_N_SPT.max) { Nu = LIMITE_N_SPT.max; avisos.push(`NSPT médio ${N.toFixed(1).replace('.', ',')} > 20: a correlação foi limitada a N = 20 (σadm = 400 kPa).`); }
  return { sigma: 20 * Nu, N, Nusado: Nu, avisos };
}

/**
 * Dimensões em planta com balanços iguais (A − B = ap − bp), arredondadas para múltiplos de `passo` (cm).
 * @param {{area:number, ap:number, bp:number, passo?:number, minimo?:number}} p  area em m²
 */
export function dimensoesBalancosIguais({ area, ap, bp, passo = 5, minimo = DIMENSAO_MINIMA }) {
  const d = (ap - bp) / 100;                            // m
  const B = (-d + Math.sqrt(d * d + 4 * area)) / 2;     // m (B·(B + d) = area)
  const arred = (v) => Math.max(minimo, Math.ceil((v * 100 - 1e-6) / passo) * passo);
  const Bc = arred(B);
  const Ac = Math.max(minimo, arred(B + d), Bc + (ap - bp));
  return { A: Ac, B: Bc };
}

/**
 * Tensões na base. N total característico (kN), A e B em cm, momentos em kN·m.
 * @returns {{sMed, sMax, sMin, ex, ey, nucleo:boolean}}  tensões em kPa, excentricidades em m
 */
export function tensoesNaBase({ N, A, B, Mx = 0, My = 0 }) {
  const a = A / 100, b = B / 100;
  const ex = N > 0 ? Math.abs(Mx) / N : 0, ey = N > 0 ? Math.abs(My) / N : 0;
  const sMed = N / (a * b);
  const f = (6 * ex) / a + (6 * ey) / b;
  return { sMed, sMax: sMed * (1 + f), sMin: sMed * (1 - f), ex, ey, nucleo: f <= 1 + 1e-9 };
}

/** Altura mínima para sapata rígida (22.6.1), cm. */
export const alturaRigida = ({ A, B, ap, bp }) => Math.max((A - ap) / 3, (B - bp) / 3);

/** Classificação: rígida se h ≥ (a − ap)/3 nas duas direções. */
export const sapataRigida = ({ A, B, ap, bp, h }) => h >= alturaRigida({ A, B, ap, bp }) - 1e-9;

/**
 * Volume (m³) da sapata com faces inclinadas: prisma A × B × h0 mais o tronco de pirâmide até o topo a0 × b0.
 * a0 = ap + 2·folga, b0 = bp + 2·folga (folga de 2,5 cm para a fôrma do pilar).
 */
export function volumeSapata({ A, B, h, h0, ap, bp, folga = 2.5 }) {
  const a = A / 100, b = B / 100, H = h / 100, H0 = Math.min(h0, h) / 100;
  const a0 = Math.min(A, ap + 2 * folga) / 100, b0 = Math.min(B, bp + 2 * folga) / 100;
  const ht = H - H0;
  const A1 = a * b, A2 = a0 * b0;
  return a * b * H0 + (ht / 3) * (A1 + A2 + Math.sqrt(A1 * A2));
}

/** Momento na seção S1 do CEB-70 (kN·m) para uma tensão uniforme σ (kPa); dimensões em cm. */
export function momentoS1({ sigma, largura, balanco, ap }) {
  const x = (balanco + 0.15 * ap) / 100;
  return (sigma * (largura / 100) * x * x) / 2;
}

/** Comprimento de ancoragem básico (9.4.2.4), cm: lb = (ø/4)·fyd/fbd, fbd = η1·η2·η3·fctd (barras nervuradas). */
export function ancoragemBasica({ phi, c, s }) {
  const fbd = 2.25 * 1 * (phi >= 32 ? (132 - phi) / 100 : 1) * c.fctd;
  return { lb: Math.max((phi / 10 / 4) * (s.fyd / fbd), 25 * phi / 10), fbd };
}
