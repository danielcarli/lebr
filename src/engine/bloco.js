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
 * Bloco sobre estacas — NBR 6118:2023, 22.7, pelo método das bielas e tirantes (Blévot).
 *
 * Unidades: dimensões em cm; forças em kN; momentos em kN·m; tensões em MPa.
 *
 *   2 estacas: tg α = d/(e/2 − ap/4); Rs = Nd·(2e − ap)/(8d); 0,5·(e − ap/2) ≤ d ≤ 0,71·(e − ap/2); σ ≤ 1,40·KR·fcd
 *   3 estacas: tg α = d/(e·√3/3 − 0,3·a); Rs (mediana) = Nd·(√3·e − 0,9·a)/(9d), nos lados Rs/√3;
 *              0,58·(e − a/2) ≤ d ≤ 0,825·(e − a/2); σ ≤ 1,75·KR·fcd
 *   4 estacas: tg α = d/(√2/2·(e − a/2)); nos lados Rs = Nd·(2e − a)/(16d); 0,71·(e − a/2) ≤ d ≤ (e − a/2); σ ≤ 2,10·KR·fcd
 *   σ na biela junto ao pilar = Nd/(Ap·sen²α); junto à estaca = Rd/(Ae·sen²α); KR = 0,90.
 *   1 estaca: bloco de transição, tração de fendilhamento Td = 0,25·Nd·(A − ap)/A.
 *   5 e 6 estacas: generalização do método — cada estaca recebe a sua biela de um ponto a ap/4 e bp/4 do centro;
 *              tração total numa direção = Σ Ri·(xi − ap/4)/d das estacas de um lado.
 * Pilares retangulares nos blocos de 3 e 4 estacas: a = √(ap·bp) (quadrado equivalente).
 */

export const KR = 0.9;
export const FOLGA_BORDA = 15;  // cm — da face da estaca à face lateral do bloco
export const D_LINHA = 15;      // cm — do fundo do bloco ao eixo das barras (estaca embutida 10 cm + cobrimento)

/** Posições das estacas (cm), centradas no pilar, nos arranjos usuais. */
export function arranjoEstacas(n, e) {
  const r3 = Math.sqrt(3), r2 = Math.SQRT2;
  switch (n) {
    case 1: return [{ x: 0, y: 0 }];
    case 2: return [{ x: -e / 2, y: 0 }, { x: e / 2, y: 0 }];
    case 3: return [{ x: 0, y: (e * r3) / 3 }, { x: -e / 2, y: -(e * r3) / 6 }, { x: e / 2, y: -(e * r3) / 6 }];
    case 4: return [{ x: -e / 2, y: -e / 2 }, { x: e / 2, y: -e / 2 }, { x: -e / 2, y: e / 2 }, { x: e / 2, y: e / 2 }];
    case 5: { const c = (e * r2) / 2; return [{ x: -c, y: -c }, { x: c, y: -c }, { x: 0, y: 0 }, { x: -c, y: c }, { x: c, y: c }]; }
    case 6: return [-e, 0, e].flatMap((x) => [{ x, y: -e / 2 }, { x, y: e / 2 }]);
    default: throw new Error('O bloco aceita de 1 a 6 estacas.');
  }
}

/** Dimensões em planta (retângulo envolvente) com a folga da face da estaca à borda. */
export function dimensoesBloco(pos, D, { ap = 0, bp = 0, folga = FOLGA_BORDA } = {}) {
  const xs = pos.map((p) => p.x), ys = pos.map((p) => p.y);
  const A = Math.max(Math.max(...xs) - Math.min(...xs) + D + 2 * folga, ap + 2 * 10);
  const B = Math.max(Math.max(...ys) - Math.min(...ys) + D + 2 * folga, bp + 2 * 10);
  return { A: Math.ceil(A / 5 - 1e-9) * 5, B: Math.ceil(B / 5 - 1e-9) * 5 };
}

/** Reações nas estacas (kN): Ri = N/n + Mx·xi/Σx² + My·yi/Σy² (momentos em kN·m, posições em cm). */
export function reacoesEstacas({ N, Mx = 0, My = 0, pos }) {
  const n = pos.length;
  const sx = pos.reduce((s, p) => s + (p.x / 100) ** 2, 0), sy = pos.reduce((s, p) => s + (p.y / 100) ** 2, 0);
  return pos.map((p) => N / n + (sx > 0 ? (Mx * (p.x / 100)) / sx : 0) + (sy > 0 ? (My * (p.y / 100)) / sy : 0));
}

/** Intervalo de d recomendado (45° ≤ α ≤ 55°) para 2, 3 e 4 estacas; para 5 e 6, pelo braço da biela mais abatida. */
export function intervaloAlturaUtil({ n, e, ap, bp, pos }) {
  const a = n === 2 ? ap : Math.sqrt(ap * bp);
  if (n === 2) return { min: 0.5 * (e - a / 2), max: 0.71 * (e - a / 2) };
  if (n === 3) return { min: 0.58 * (e - a / 2), max: 0.825 * (e - a / 2) };
  if (n === 4) return { min: 0.71 * (e - a / 2), max: e - a / 2 };
  // 5 e 6 estacas: pela biela mais abatida (estaca mais afastada), entre 45° e 55°
  const lmax = Math.max(...bracos({ pos, ap, bp }).filter((v) => v > 1));
  return { min: lmax, max: lmax * Math.tan((55 * Math.PI) / 180) };
}

/** Braço horizontal de cada biela (cm): da estaca ao ponto do pilar a ap/4 e bp/4 do centro. */
function bracos({ pos, ap, bp }) {
  return pos.map((p) => Math.hypot(p.x - Math.sign(p.x) * (ap / 4), p.y - Math.sign(p.y) * (bp / 4)));
}

/**
 * Bielas e tirantes.
 * @param {object} p  { n, e, ap, bp, d, D (cm), Nd, R: reações de cálculo das estacas, pos, fcd (MPa) }
 * @returns {{ alfa, alfaMin, alfaMax, Tx, Ty, tirantes, sigmaPil, sigmaEst, limite, fator }}
 */
export function bielasETirantes({ n, e, ap, bp, d, D, Nd, R, pos, fcd }) {
  const Ap = ap * bp, Ae = (Math.PI * D * D) / 4;      // cm²
  const Rmax = Math.max(...R);
  const fator = n === 2 ? 1.4 : n === 3 ? 1.75 : 2.1;
  const limite = fator * KR * fcd;
  const rad = (v) => (v * 180) / Math.PI;
  let alfa, Tx = 0, Ty = 0, tirantes;
  if (n === 2) {
    alfa = Math.atan(d / (e / 2 - ap / 4));
    Tx = (Nd * (2 * e - ap)) / (8 * d);
    tirantes = { tipo: 'faixa', x: Tx, y: 0, texto: 'Rs = Nd·(2e − ap)/(8d), sobre as estacas' };
  } else if (n === 3) {
    const a = Math.sqrt(ap * bp);
    alfa = Math.atan(d / ((e * Math.sqrt(3)) / 3 - 0.3 * a));
    const Rs = (Nd * (Math.sqrt(3) * e - 0.9 * a)) / (9 * d);
    const lado = Rs / Math.sqrt(3);
    Tx = 1.5 * lado; Ty = Tx;
    tirantes = { tipo: 'lados', lado, mediana: Rs, x: Tx, y: Ty, texto: 'Rs = Nd·(√3·e − 0,9·a)/(9d) na mediana; nos três lados Rs/√3' };
  } else if (n === 4) {
    const a = Math.sqrt(ap * bp);
    alfa = Math.atan(d / ((Math.SQRT2 / 2) * (e - a / 2)));
    const lado = (Nd * (2 * e - a)) / (16 * d);
    Tx = 2 * lado; Ty = 2 * lado;
    tirantes = { tipo: 'lados', lado, x: Tx, y: Ty, texto: 'Rs = Nd·(2e − a)/(16d) em cada lado' };
  } else if (n === 1) {
    alfa = Math.PI / 2;
    tirantes = { tipo: 'fendilhamento', x: 0, y: 0, texto: 'Td = 0,25·Nd·(A − ap)/A, em estribos horizontais' };
  } else {
    // 5 e 6 estacas: biela de cada estaca e tração total por direção (corte no eixo do pilar)
    const l = bracos({ pos, ap, bp });
    const ang = l.map((v) => (v > 1 ? Math.atan(d / v) : Math.PI / 2));
    alfa = Math.min(...ang);
    const lado = (fn) => Math.max(...[1, -1].map((sg) => pos.reduce((s, p, k) => s + (fn(p) * sg > 1e-9 ? (R[k] * Math.max(0, Math.abs(fn(p)) - (fn === px ? ap : bp) / 4)) / d : 0), 0)));
    Tx = lado(px); Ty = lado(py);
    tirantes = { tipo: 'faixa', x: Tx, y: Ty, texto: 'tração por direção = Σ Ri·(xi − ap/4)/d das estacas de um lado' };
  }
  const s2 = Math.sin(alfa) ** 2;
  const sigmaPil = n === 1 ? (Nd / Ap) * 10 : (Nd / (Ap * s2)) * 10;     // MPa
  const sigmaEst = n === 1 ? (Rmax / Ae) * 10 : (Rmax / (Ae * s2)) * 10;
  const angulos = n >= 5 ? bracos({ pos, ap, bp }).filter((v) => v > 1).map((v) => rad(Math.atan(d / v))) : [rad(alfa)];
  return { alfa: rad(alfa), alfaMin: Math.min(...angulos), alfaMax: Math.max(...angulos), Tx, Ty, tirantes, sigmaPil, sigmaEst, limite, fator, Ap, Ae };
}
const px = (p) => p.x, py = (p) => p.y;
