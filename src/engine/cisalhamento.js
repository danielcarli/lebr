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
 * Força cortante em vigas — NBR 6118:2023, 17.4.2.2 (Modelo de cálculo I, θ = 45°, α = 90°)
 * Lajes sem armadura transversal — 19.4.1
 *
 * Dimensões em cm, forças em kN.
 */
import { BITOLAS, areaBarra } from './barras.js';

/**
 * @param {object} p
 * @param {number} p.Vd  força cortante de cálculo (kN)
 * @param {number} p.bw  largura da alma (cm)
 * @param {number} p.d   altura útil (cm)
 */
export function dimensionarEstribos({ Vd, bw, d, c, s, phi = null }) {
  const V = Math.abs(Vd);
  const fcd = c.fcd / 10;                        // kN/cm²
  const fctd = c.fctd / 10;
  const fywd = Math.min(s.fyd, 435) / 10;        // kN/cm²
  const av2 = 1 - c.fck / 250;

  const VRd2 = 0.27 * av2 * fcd * bw * d;
  const Vc = 0.6 * fctd * bw * d;
  const Vsw = Math.max(0, V - Vc);

  const aswCalc = (Vsw / (0.9 * d * fywd)) * 100;                 // cm²/m
  const rhoMin = 0.2 * c.fctm / Math.min(s.fyk, 500);
  const aswMin = rhoMin * bw * 100;                               // cm²/m
  const asw = Math.max(aswCalc, aswMin);

  // Espaçamento máximo (18.3.3.2)
  const sMax = V <= 0.67 * VRd2 ? Math.min(0.6 * d, 30) : Math.min(0.3 * d, 20);

  const r = {
    Vd: V, VRd2, Vc, Vsw, aswCalc, aswMin, asw, sMax,
    ok: V <= VRd2,
    avisos: [],
  };
  if (!r.ok) r.avisos.push('VSd > VRd2: esmagamento das bielas — aumente a seção ou o fck.');

  r.estribo = escolherEstribo({ asw, bw, sMax, phi });
  if (r.estribo.apertado) {
    r.avisos.push(phi
      ? `Estribo ø ${String(phi).replace('.', ',')} exigiria espaçamento abaixo de 7 cm — escolha uma bitola maior.`
      : 'Estribos com espaçamento mínimo de 7 cm não atendem — aumente a seção.');
  }
  if (phi && phi > Math.max(5, bw)) r.avisos.push(`Estribo ø ${String(phi).replace('.', ',')} acima de bw/10 (18.3.3.2).`);
  return r;
}

/** Escolhe bitola e espaçamento de estribo de 2 ramos (18.3.3.2). Com `phi`, usa só essa bitola. */
export function escolherEstribo({ asw, bw, sMax, ramos = 2, phi: fixa = null }) {
  // 5 mm ≤ øt ≤ bw/10 (bw/10 em cm equivale numericamente a bw em mm)
  const candidatas = fixa ? [fixa] : BITOLAS.filter((f) => f >= 5 && f <= 10 && f <= Math.max(5, bw));
  for (const phi of candidatas) {
    const a = ramos * areaBarra(phi);
    let sp = Math.floor((a / asw) * 100);   // cm inteiros, como na obra
    sp = Math.min(sp, Math.floor(sMax));
    if (sp >= 7) return { phi, s: sp, ramos, aswEf: (a / sp) * 100 };
  }
  const phi = candidatas[candidatas.length - 1] ?? 10;
  const sp = 7;
  return { phi, s: sp, ramos, aswEf: (ramos * areaBarra(phi) / sp) * 100, apertado: (ramos * areaBarra(phi) / sp) * 100 < asw - 1e-9 };
}

/**
 * Verificação de lajes sem armadura para força cortante (19.4.1).
 * Também usada em nervuras de lajes nervuradas com intereixo ≤ 65 cm (13.2.4.2).
 * @param {number} Vd    kN (na largura bw; para lajes maciças, kN/m com bw = 100)
 * @param {number} d     cm
 * @param {number} As1   armadura de tração que se estende até o apoio (cm², na largura bw)
 * @param {number} [bw=100] largura considerada (cm)
 */
export function verificarCortanteLaje({ Vd, d, As1, c, bw = 100 }) {
  const tauRd = 0.25 * (c.fctd / 10);           // kN/cm²
  const k = Math.max(1, Math.abs(1.6 - d / 100));
  const rho1 = Math.min(As1 / (bw * d), 0.02);
  const VRd1 = tauRd * k * (1.2 + 40 * rho1) * bw * d; // kN na largura bw
  return { Vd: Math.abs(Vd), VRd1, k, rho1, ok: Math.abs(Vd) <= VRd1 };
}
