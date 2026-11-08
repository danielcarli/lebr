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
 * Punção — NBR 6118:2023, 19.5. Motor usado pelas lajes (cargas concentradas, pilares) e, nas próximas
 * etapas, pelas sapatas e blocos.
 *
 * Contornos críticos (19.5.1):
 *   C   — perímetro da área carregada (pilar ou carga): compressão diagonal, τSd ≤ τRd2 = 0,27·αv2·fcd;
 *   C'  — a 2d da face: tração diagonal, τSd ≤ τRd1 sem armadura de punção, ou ≤ τRd3 com armadura;
 *   C'' — a 2d além da última linha da armadura de punção: τSd ≤ τRd1.
 * τRd1 = 0,13·k·(100·ρ·fck)^(1/3) + 0,10·σcp, com k = 1 + √(20/d) (d em cm, k ≤ 2) e ρ = √(ρx·ρy) ≤ 0,02.
 * τRd3 = 0,10·k·(100·ρ·fck)^(1/3) + 0,10·σcp + 1,5·(d/sr)·Asw·fywd·sen α/(u·d).
 *
 * Posição da área carregada: interna; de borda (c1 perpendicular à borda livre, c2 paralelo);
 * de canto. Nas posições de borda e de canto os perímetros são os reduzidos (u*), com
 * a ≤ min(1,5·d; 0,5·c1) (19.5.2.4 e 19.5.2.5).
 *
 * Unidades: dimensões em cm, forças em kN, momentos em kN·m, tensões em MPa, áreas em cm².
 */
import { areaBarra } from './barras.js';

export const POSICOES = ['interna', 'borda', 'canto'];

/** K (Tabela 19.2): fração do momento transferido por cisalhamento, pela relação c1/c2. */
export function coeficienteK(c1, c2) {
  const tab = [[0.5, 0.45], [1, 0.6], [2, 0.7], [3, 0.8]];
  const r = c1 / c2;
  if (r <= tab[0][0]) return tab[0][1];
  if (r >= 3) return 0.8;
  for (let i = 1; i < tab.length; i++) {
    const [r1, k1] = tab[i - 1], [r2, k2] = tab[i];
    if (r <= r2) return k1 + ((k2 - k1) * (r - r1)) / (r2 - r1);
  }
  return 0.8;
}

/**
 * Perímetro do contorno a uma distância r da face (r = 0: contorno C).
 * @returns {{u:number, base:number, kr:number, a1?:number, a2?:number}}
 */
export function perimetro({ posicao = 'interna', c1, c2, d, r = 0 }) {
  if (posicao === 'borda') {
    const a = Math.min(1.5 * d, 0.5 * c1);
    return { u: 2 * a + c2 + Math.PI * r, base: 2 * a + c2, kr: Math.PI, a1: a };
  }
  if (posicao === 'canto') {
    const a1 = Math.min(1.5 * d, 0.5 * c1), a2 = Math.min(1.5 * d, 0.5 * c2);
    return { u: a1 + a2 + (Math.PI / 2) * r, base: a1 + a2, kr: Math.PI / 2, a1, a2 };
  }
  return { u: 2 * (c1 + c2) + 2 * Math.PI * r, base: 2 * (c1 + c2), kr: 2 * Math.PI };
}

/** τRd1 e a parcela do concreto de τRd3 (MPa). */
export function resistenciaConcreto({ d, rho, fck, sigmaCp = 0 }) {
  const k = Math.min(2, 1 + Math.sqrt(20 / d));
  const r = Math.min(0.02, Math.max(0, rho));
  const base = k * Math.cbrt(100 * r * fck);
  return { k, rho: r, tauRd1: 0.13 * base + 0.1 * sigmaCp, tauC3: 0.1 * base + 0.1 * sigmaCp };
}

/** fywd da armadura de punção (19.5.3.3): 250 MPa até h = 15 cm, 435 MPa a partir de 35 cm, interpolado. */
export const fywdPuncao = (h, fyd = 435) => Math.min(fyd, h <= 15 ? 250 : h >= 35 ? 435 : 250 + ((435 - 250) * (h - 15)) / 20);

/**
 * Verificação completa da punção.
 * @param {object} p
 * @param {number} p.FSd      força concentrada de cálculo (kN)
 * @param {number} [p.MSd]    momento de cálculo transferido (kN·m), só na posição interna, no plano de c1
 * @param {'interna'|'borda'|'canto'} p.posicao
 * @param {number} p.c1  @param {number} p.c2  dimensões da área carregada (cm)
 * @param {number} p.d   altura útil média (cm)
 * @param {number} p.h   espessura da laje (cm)
 * @param {number} p.rho taxa de armadura de flexão tracionada, √(ρx·ρy)
 * @param {object} p.c   concreto() ; @param {object} p.s aço()
 * @param {number} [p.phi]  bitola da armadura de punção (mm); null = automática
 */
export function verificarPuncao({ FSd, MSd = 0, posicao = 'interna', c1, c2, d, h, rho, c, s, phi = null, sigmaCp = 0 }) {
  const fcd = c.fcd;                                   // MPa
  const av2 = 1 - c.fck / 250;
  const tauRd2 = 0.27 * av2 * fcd;
  const conc = resistenciaConcreto({ d, rho, fck: c.fck, sigmaCp });
  const avisos = [];

  // momento transferido (só pilar interno, plano de c1): τSd = FSd/(u·d) + K·MSd/(Wp·d)
  const K = posicao === 'interna' && MSd ? coeficienteK(c1, c2) : 0;
  const Wp1 = c1 ** 2 / 2 + c1 * c2 + 4 * c2 * d + 16 * d ** 2 + 2 * Math.PI * d * c1;  // contorno C' (cm²)
  const Wp0 = c1 ** 2 / 2 + c1 * c2;                                                     // contorno C
  const tau = (F, u, Wp) => ((F / (u * d)) + (K && Wp ? (K * Math.abs(MSd) * 100) / (Wp * d) : 0)) * 10; // MPa
  if (posicao !== 'interna' && MSd) avisos.push('Momento transferido considerado só em pilar interno; nas bordas e cantos vale o perímetro reduzido u* (19.5.2.4 e 19.5.2.5).');

  // contorno C
  const pC = perimetro({ posicao, c1, c2, d, r: 0 });
  const C = { u: pC.u, tauSd: tau(FSd, pC.u, Wp0), tauRd: tauRd2 };
  C.ok = C.tauSd <= C.tauRd + 1e-9;

  // contorno C' (2d)
  const p1 = perimetro({ posicao, c1, c2, d, r: 2 * d });
  const C1 = { u: p1.u, tauSd: tau(FSd, p1.u, Wp1), tauRd: conc.tauRd1 };
  C1.dispensa = C1.tauSd <= conc.tauRd1 + 1e-9;

  const r = { posicao, FSd, MSd, K, d, h, rho: conc.rho, k: conc.k, tauRd1: conc.tauRd1, tauRd2, C, C1, avisos };
  if (!C.ok) avisos.push('Contorno C: compressão diagonal acima de τRd2 — aumente a área carregada, a espessura ou o fck.');

  if (C1.dispensa) {
    r.armadura = null;
    r.ok = C.ok;
    return r;
  }

  // ----------------------------------------------------------- armadura de punção (19.5.3.3 e 20.4)
  if (h < 16) avisos.push('A NBR 6118 exige espessura de ao menos 16 cm em lajes com armadura de punção.');
  const fywd = fywdPuncao(h, s.fyd);
  const sr = Math.floor(0.75 * d * 2) / 2;                    // espaçamento radial ≤ 0,75·d (múltiplo de 0,5 cm)
  const s0 = Math.floor(0.5 * d * 2) / 2;                     // primeira linha ≤ 0,5·d da face
  // Asw por contorno de armadura: τRd3 = τSd no contorno C'
  const tauS = Math.max(0, C1.tauSd - conc.tauC3);
  const AswNec = (tauS * C1.u * d) / (1.5 * (d / sr) * fywd);  // cm²
  // linhas radiais: espaçamento circunferencial ≤ 2d no primeiro contorno de armadura
  const uPrimeira = pC.base + pC.kr * s0;
  const minimo = { interna: 8, borda: 5, canto: 3 }[posicao];
  const linhas = Math.max(minimo, Math.ceil(uPrimeira / (2 * d)));
  const bitolas = phi ? [phi] : [6.3, 8, 10, 12.5, 16];
  const phiEsc = bitolas.find((f) => areaBarra(f) * linhas >= AswNec - 1e-9) ?? bitolas[bitolas.length - 1];
  const Asw = areaBarra(phiEsc) * linhas;
  const tauRd3 = conc.tauC3 + (1.5 * (d / sr) * Asw * fywd) / (C1.u * d);
  if (Asw < AswNec - 1e-9) avisos.push(`Armadura de punção com ø ${String(phiEsc).replace('.', ',')} não basta em ${linhas} linhas radiais — escolha bitola maior ou aumente a espessura.`);
  // número de contornos de armadura até C'' atender τRd1
  let n = 1, C2 = null;
  for (; n <= 30; n++) {
    const dist = s0 + (n - 1) * sr + 2 * d;
    const p2 = perimetro({ posicao, c1, c2, d, r: dist });
    const WpN = K ? c1 ** 2 / 2 + c1 * c2 + 2 * c2 * dist + dist ** 2 * 4 + Math.PI * dist * c1 : 0;
    const t2 = tau(FSd, p2.u, WpN);
    C2 = { u: p2.u, distancia: dist, tauSd: t2, tauRd: conc.tauRd1, ok: t2 <= conc.tauRd1 + 1e-9 };
    if (C2.ok) break;
  }
  if (!C2.ok) avisos.push('Contorno C\'\': mesmo com 30 contornos de armadura a tensão passa de τRd1 — aumente a espessura.');
  const C1armado = { ...C1, tauRd: tauRd3, ok: C1.tauSd <= tauRd3 + 1e-9 };
  r.C1 = C1armado;
  r.C2 = C2;
  r.armadura = {
    phi: phiEsc, linhas, contornos: n, sr, s0, fywd, AswNec, Asw, tauRd3,
    total: linhas * n, alcance: s0 + (n - 1) * sr,
    rotulo: `${linhas} linhas × ${n} conectores ø ${String(phiEsc).replace('.', ',')} (s0 = ${String(s0).replace('.', ',')} cm, sr = ${String(sr).replace('.', ',')} cm)`,
  };
  r.ok = C.ok && C1armado.ok && C2.ok && Asw >= AswNec - 1e-9 && h >= 16;
  return r;
}
