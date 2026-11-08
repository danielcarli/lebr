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
 * Bitolas comerciais e escolha de arranjos de barras.
 * Diâmetros em mm, áreas em cm², dimensões de seção em cm.
 */

export const BITOLAS = [5, 6.3, 8, 10, 12.5, 16, 20, 25, 32];

/** Bitolas oferecidas na escolha do usuário, por uso (mm). */
export const BITOLAS_USO = {
  viga: [8, 10, 12.5, 16, 20, 25],
  laje: [5, 6.3, 8, 10, 12.5, 16],
  nervura: [6.3, 8, 10, 12.5, 16, 20],
  pilar: [10, 12.5, 16, 20, 25, 32],
  estribo: [5, 6.3, 8, 10],
};

/** Valor de bitola escolhido pelo usuário: número em mm, ou null para "automático". */
export const bitolaFixa = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 && v !== '' && v !== 'auto' ? Number(v) : null);

export const fmtPhi = (phi) => String(phi).replace('.', ',');

export const areaBarra = (phiMm) => (Math.PI * phiMm * phiMm) / 400;

export const rotuloBarras = (n, phi) => `${n} ø ${String(phi).replace('.', ',')}`;

/**
 * Espaçamento livre horizontal mínimo entre barras (18.3.2.2), em cm.
 */
export const espacamentoLivreMin = (phiMm, dmaxMm = 19) => Math.max(2, phiMm / 10, (1.2 * dmaxMm) / 10);

/**
 * Escolhe o arranjo de barras longitudinais de uma viga.
 * Retorna a opção com menor área, preferindo no máximo duas camadas.
 */
export function escolherBarrasViga({ As, bw, cob, phiT = 5, dmax = 19, min = 2, phi: fixa = null }) {
  if (!(As > 0)) return null;
  const opcoes = [];
  for (const phi of fixa ? [fixa] : BITOLAS.filter((f) => f >= 8 && f <= 25)) {
    const a = areaBarra(phi);
    const n = Math.max(min, Math.ceil(As / a - 1e-9));
    const ah = espacamentoLivreMin(phi, dmax);
    const util = bw - 2 * (cob + phiT / 10);
    const porCamada = Math.max(0, Math.floor((util + ah) / (phi / 10 + ah)));
    if (porCamada < 2) continue;
    const camadas = Math.ceil(n / porCamada);
    if (camadas > 3) continue;
    const AsEf = n * a;
    opcoes.push({ phi, n, AsEf, camadas, porCamada, sobra: AsEf / As - 1, rotulo: rotuloBarras(n, phi) });
  }
  // menor excesso de área; penaliza camadas extras e excesso de barras
  opcoes.sort((x, y) => score(x) - score(y));
  return opcoes[0] ? { ...opcoes[0], alternativas: opcoes.slice(1, 4) } : null;

  function score(o) { return o.sobra + 0.12 * (o.camadas - 1) + 0.01 * Math.max(0, o.n - 6); }
}

/**
 * Escolhe bitola e espaçamento para lajes (por metro).
 * smax = min(2h, 20 cm) para armadura principal (20.1); ø ≤ h/8; espaçamento ≥ 8 cm.
 * Com `phi`, usa só essa bitola (escolha do usuário) e retorna null se ela não couber.
 */
export function escolherBarrasLaje({ As, h, principal = true, phi: fixa = null }) {
  const sMax = principal ? Math.min(2 * h, 20) : 33;
  for (const phi of fixa ? [fixa] : [5, 6.3, 8, 10, 12.5]) {
    if (phi / 10 > h / 8) break; // ø ≤ h/8
    const a = areaBarra(phi);
    let s = Math.floor(((100 * a) / As) * 2) / 2;
    s = Math.min(s, sMax);
    if (s >= 8) return { phi, s, AsEf: (100 * a) / s, rotulo: `ø ${String(phi).replace('.', ',')} c/ ${fmtS(s)}` };
  }
  return null;
}

const fmtS = (s) => (Number.isInteger(s) ? `${s}` : s.toFixed(1).replace('.', ','));

/** Por que uma bitola escolhida não serve numa laje (texto para aviso), ou null se serve. */
export function motivoBarraLaje({ As, h, phi }) {
  if (phi / 10 > h / 8) return `ø ${fmtPhi(phi)} passa de h/8 = ${fmtS(h * 1.25)} mm (20.1)`;
  const s = Math.floor(((100 * areaBarra(phi)) / As) * 2) / 2;
  if (s < 8) return `com ø ${fmtPhi(phi)} o espaçamento ficaria em ${fmtS(s)} cm, abaixo de 8 cm`;
  return null;
}
