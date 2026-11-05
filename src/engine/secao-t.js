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
 * Seção T — usada nas nervuras de lajes treliçadas e nervuradas.
 * NBR 6118:2023 — 14.6.2.2 (mesa colaborante), 17.2 (flexão), 17.3.5.2 (armadura mínima).
 *
 * Unidades: dimensões em cm, momentos em kN·m, áreas de aço em cm².
 */
import { dimensionarFlexao } from './flexao.js';
import { BITOLAS, areaBarra, espacamentoLivreMin, rotuloBarras } from './barras.js';

/** Área, centroide (medido do topo) e inércia de uma seção T bruta. */
export function propriedadesT({ bf, bw, hf, h }) {
  const Af = bf * hf, Aw = bw * (h - hf), A = Af + Aw;
  const yTop = (Af * hf / 2 + Aw * (hf + (h - hf) / 2)) / A;
  const I = (bf * hf ** 3) / 12 + Af * (yTop - hf / 2) ** 2
    + (bw * (h - hf) ** 3) / 12 + Aw * (hf + (h - hf) / 2 - yTop) ** 2;
  return { A, yTop, yBot: h - yTop, I };
}

/**
 * Largura colaborante da mesa (14.6.2.2): bf = bw + 2·b1,
 * com b1 ≤ 0,5·b2 (b2 = distância livre entre nervuras) e b1 ≤ 0,10·a.
 * @param {number} a  distância entre pontos de momento nulo (m)
 * @param {number} e  intereixo das nervuras (cm)
 */
export function larguraColaborante({ bw, e, a }) {
  const b1 = Math.max(0, Math.min(0.5 * (e - bw), 0.1 * a * 100));
  return bw + 2 * b1;
}

/** Fator a/L conforme vínculos (14.6.2.2): a = L, 0,75L, 0,60L ou 2L. */
export const FATOR_A = { biapoiada: 1, 'engaste-apoio': 0.75, biengastada: 0.6, balanco: 2 };

/**
 * Flexão simples em seção T com mesa comprimida.
 * Se o bloco comprimido cabe na mesa (λx ≤ hf), a seção trabalha como retangular bf × h.
 * Caso contrário, separa a contribuição das abas e dimensiona a alma (bw) com o restante.
 */
export function dimensionarFlexaoT({ Md, bf, bw, hf, h, d, c, s }) {
  const M = Math.abs(Md);
  const scd = c.sigmaCd / 10, fyd = s.fyd / 10;
  const ret = dimensionarFlexao({ Md: M, b: bf, h, d, c, s });
  const avisos = [];
  let As, x, comoT = false, ok = true;

  if (c.lambda * ret.x <= hf || M === 0) {
    As = ret.AsCalc;
    x = ret.x;
  } else {
    comoT = true;
    const Ff = scd * (bf - bw) * hf;               // força nas abas (kN)
    const Mf = Ff * (d - hf / 2) / 100;            // kN·m
    const Mw = M - Mf;
    const alma = dimensionarFlexao({ Md: Math.max(0, Mw), b: bw, h, d, c, s });
    As = Ff / fyd + alma.AsCalc;
    x = alma.x;
    if (alma.dupla) { ok = false; avisos.push('Linha neutra profunda na nervura (x/d acima do limite) — aumente a altura da laje.'); }
  }

  // armadura mínima: Md,mín = 0,8·W0·fctk,sup, com W0 da seção T bruta; taxa absoluta 0,15 % Ac
  const p = propriedadesT({ bf, bw, hf, h });
  const W0 = p.I / p.yBot;
  const MdMin = (0.8 * W0 * (c.fctkSup / 10)) / 100;   // kN·m
  const AsMd = dimensionarFlexao({ Md: MdMin, b: bf, h, d, c, s }).AsCalc;
  const AsMin = Math.max(AsMd, 0.0015 * p.A);

  return { Md: M, As: Math.max(As, AsMin), AsCalc: As, AsMin, x, xi: x / d, comoT, ok, avisos, d };
}

/** Inércia no estádio II puro de uma seção T (mesa comprimida), em cm⁴. */
export function inerciaEstadioIIT({ bf, bw, hf, d, As, ae }) {
  const n = ae * As;
  let x = (-n + Math.sqrt(n * n + 2 * bf * n * d)) / bf;
  if (x <= hf) return { x, I: (bf * x ** 3) / 3 + n * (d - x) ** 2 };
  const A = bw / 2, B = bf * hf - bw * hf + n, C = -(bf * hf * hf) / 2 + (bw * hf * hf) / 2 - n * d;
  x = (-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A);
  const I = ((bf - bw) * hf ** 3) / 12 + (bf - bw) * hf * (x - hf / 2) ** 2 + (bw * x ** 3) / 3 + n * (d - x) ** 2;
  return { x, I };
}

/** Inércia equivalente de Branson (17.3.2.1.1), α = 1,2 para seções T. */
export function inerciaBransonT({ bf, bw, hf, h, d, As, Ma, c, s }) {
  const p = propriedadesT({ bf, bw, hf, h });
  const Mr = (1.2 * (c.fctm / 10) * p.I) / p.yBot / 100; // kN·m
  const II = inerciaEstadioIIT({ bf, bw, hf, d, As, ae: s.Es / c.Ecs }).I;
  const r = Ma > Mr ? (Mr / Ma) ** 3 : 1;
  return { Ic: p.I, III: II, Mr, Ieq: Math.min(p.I, r * p.I + (1 - r) * II), fissurada: Ma > Mr };
}

/**
 * Barras de uma nervura estreita: até `maxBarras` barras, no máximo 2 camadas.
 * @returns {{n, phi, AsEf, camadas, rotulo} | null}
 */
export function escolherBarrasNervura({ As, bw, cob, dmax = 19, bitolas = [6.3, 8, 10, 12.5, 16, 20], maxBarras = 4 }) {
  if (!(As > 0)) return null;
  const opcoes = [];
  for (const phi of bitolas) {
    const n = Math.max(1, Math.ceil(As / areaBarra(phi) - 1e-9));
    if (n > maxBarras) continue;
    const ah = espacamentoLivreMin(phi, dmax);
    const util = bw - 2 * cob;
    const porCamada = Math.max(1, Math.floor((util + ah) / (phi / 10 + ah)));
    const camadas = Math.ceil(n / porCamada);
    if (camadas > 2) continue;
    opcoes.push({ n, phi, AsEf: n * areaBarra(phi), camadas, rotulo: rotuloBarras(n, phi) });
  }
  // menor área, preferindo até 2 barras e uma camada (nervuras estreitas)
  const nota = (o) => o.AsEf + 0.15 * Math.max(0, o.n - 2) + 0.1 * (o.camadas - 1);
  opcoes.sort((a, b) => nota(a) - nota(b));
  return opcoes[0] ?? null;
}

export { BITOLAS };
