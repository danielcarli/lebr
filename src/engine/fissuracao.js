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
 * Estados limites de serviço de vigas de concreto armado — NBR 6118:2023.
 *
 *  - Estádio II puro (seção retangular fissurada, concreto sem tração).
 *  - Abertura de fissuras wk (17.3.3.2), barra a barra, com o limite da Tabela 13.4.
 *  - Fluência: coeficiente ξ(t) da Tabela 17.1 e αf = Δξ/(1 + 50·ρ') (17.3.2.1.2).
 *
 * Unidades: dimensões em cm, bitolas em mm, momentos em kN·m, tensões em MPa, wk em mm.
 */
import { areaBarra } from './barras.js';

/** η1, coeficiente de conformação superficial da armadura (Tabela 8.3), pelo tipo de aço. */
export const ETA1 = { 250: 1.0, 500: 2.25, 600: 1.4 };

/** Limite de abertura de fissuras wk (mm) para concreto armado — Tabela 13.4, combinação frequente. */
export const WK_LIMITE = { I: 0.4, II: 0.3, III: 0.3, IV: 0.2 };

/** Relação αe = Es/Ec adotada no cálculo de σs para a abertura de fissuras (17.3.3.2). */
export const AE_FISSURAS = 15;

/** ξ(t) — Tabela 17.1, t em meses (interpolação linear entre os valores tabelados). */
const XI_TABELA = [[0, 0], [0.5, 0.54], [1, 0.68], [2, 0.84], [3, 0.95], [4, 1.04], [5, 1.12], [10, 1.36], [20, 1.64], [40, 1.89], [70, 2]];
export function xi(t) {
  if (!(t > 0)) return 0;
  if (t >= 70) return 2;
  for (let i = 1; i < XI_TABELA.length; i++) {
    const [t1, x1] = XI_TABELA[i - 1], [t2, x2] = XI_TABELA[i];
    if (t <= t2) return x1 + ((x2 - x1) * (t - t1)) / (t2 - t1);
  }
  return 2;
}

/**
 * αf = Δξ/(1 + 50·ρ'), com Δξ = ξ(t) − ξ(t0) e t = 70 meses ou mais (flecha diferida no tempo infinito).
 * @param {number} t0  idade, em meses, quando a carga de longa duração passa a atuar
 * @param {number} rhoLinha  taxa de armadura de compressão As'/(b·d)
 */
export function alfaFluencia(t0 = 1, rhoLinha = 0) {
  const dXi = xi(70) - xi(t0);
  return { dXi, alfaF: dXi / (1 + 50 * rhoLinha) };
}

/**
 * Estádio II puro de seção retangular (concreto comprimido elástico, sem tração).
 * @returns {{x:number, I:number}}  linha neutra (cm) e inércia fissurada (cm⁴)
 */
export function estadioII({ b, d, As, Asl = 0, dl = 0, ae }) {
  const A = b / 2, B = ae * (As + Asl), C = -ae * (As * d + Asl * dl);
  const x = (-B + Math.sqrt(B * B - 4 * A * C)) / (2 * A);
  const I = (b * x ** 3) / 3 + ae * As * (d - x) ** 2 + ae * Asl * (x - dl) ** 2;
  return { x, I };
}

/**
 * Abertura característica de fissuras (17.3.3.2), para cada barra da camada mais tracionada:
 *   wk = menor de  φ/(12,5·η1) · σs/Es · 3σs/fct,m   e   φ/(12,5·η1) · σs/Es · (4/ρr + 45)
 * σs no estádio II com αe = 15 e o momento da combinação frequente; ρr = As,barra/Acr, onde Acr é a região
 * de envolvimento da barra: retângulo cujos lados ficam a no máximo 7,5·φ do eixo da barra, limitado pelas
 * faces da peça, pela metade da distância às barras vizinhas e pela linha neutra.
 *
 * @param {object} p
 * @param {number} p.Ms     momento da combinação frequente (kN·m, valor absoluto)
 * @param {number} p.b      largura (cm)
 * @param {number} p.h      altura (cm)
 * @param {number} p.d      altura útil (cm)
 * @param {number} p.phi    bitola longitudinal (mm)
 * @param {number} p.n      número de barras tracionadas
 * @param {number} [p.porCamada]  barras na primeira camada (padrão: todas)
 * @param {number} p.cob    cobrimento (cm)
 * @param {number} [p.phiT] bitola do estribo (mm)
 * @param {number} p.fctm   resistência média à tração (MPa)
 * @param {number} [p.eta1] coeficiente de conformação (2,25 para CA-50)
 * @param {number} [p.Es]   módulo do aço (MPa)
 */
export function aberturaFissuras({ Ms, b, h, d, phi, n, porCamada = null, cob, phiT = 5, fctm, eta1 = 2.25, Es = 210000, ae = AE_FISSURAS }) {
  const As = n * areaBarra(phi);
  const { x, I } = estadioII({ b, d, As, ae });
  const sigma = ((ae * Math.abs(Ms) * 100 * (d - x)) / I) * 10; // MPa
  const p = phi / 10; // cm
  const m = Math.max(1, Math.min(n, porCamada ?? n));
  const xIni = cob + phiT / 10 + p / 2;
  const vao = m > 1 ? (b - 2 * xIni) / (m - 1) : 0;
  const xs = Array.from({ length: m }, (_, k) => (m > 1 ? xIni + k * vao : b / 2));
  const yc = cob + phiT / 10 + p / 2; // centro da barra a partir da face tracionada
  const altura = Math.min(yc + 7.5 * p, Math.max(yc, h - x));
  const fator = phi / (12.5 * eta1) * (sigma / Es);
  const barras = xs.map((xk, k) => {
    const esq = Math.max(0, xk - 7.5 * p, k > 0 ? (xk + xs[k - 1]) / 2 : -Infinity);
    const dir = Math.min(b, xk + 7.5 * p, k < m - 1 ? (xk + xs[k + 1]) / 2 : Infinity);
    const Acr = (dir - esq) * altura;
    const rho = areaBarra(phi) / Acr;
    const w1 = fator * ((3 * sigma) / fctm);
    const w2 = fator * (4 / rho + 45);
    return { x: xk, Acr, rho, w1, w2, wk: Math.min(w1, w2) };
  });
  const pior = barras.reduce((a, c) => (c.wk > a.wk ? c : a), barras[0]);
  return { As, x, I, sigma, barras, wk: pior.wk, w1: pior.w1, w2: pior.w2, Acr: pior.Acr, rho: pior.rho, alturaAcr: altura };
}
