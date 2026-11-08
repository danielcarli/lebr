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
 * Imperfeições globais e estabilidade global — ABNT NBR 6118:2023, 11.3.3.4.1, 15.5 e 15.7.
 *
 * Desaprumo (11.3.3.4.1):
 *   θ1 = 1 / (100·√H)   (H em m), com θ1,máx = 1/200 e θ1,mín = 1/300 (estruturas reticuladas)
 *   θa = θ1 · √((1 + 1/n) / 2)   n: número de pilares verticais que contribuem para o desaprumo
 *   Comparação com o vento (momento total na base):
 *     30 % do vento > desaprumo         → só o vento
 *     vento < 30 % do desaprumo         → só o desaprumo (com θ1,mín)
 *     nos demais casos                  → vento + desaprumo na mesma direção, sem θ1,mín, como uma ação de vento
 *
 * Parâmetro de instabilidade α (15.5.2):
 *   α = Htot · √(Nk / (Ecs·Ic))  ≤ α1 → nós fixos
 *   α1 = 0,2 + 0,1·n para n ≤ 3 (n: número de níveis de barras horizontais); para n ≥ 4, 0,6 (usual),
 *   0,5 só com pórticos, 0,7 só com pilares-parede.
 *   Ecs·Ic é a rigidez de um pilar equivalente engastado na base e livre no topo que, sob as mesmas forças
 *   horizontais, tem o mesmo deslocamento no topo.
 *
 * Coeficiente γz (15.5.3), válido para estruturas com 4 andares ou mais:
 *   γz = 1 / (1 − ΔMtot,d / M1,tot,d)   ≤ 1,1 → nós fixos
 *   Esforços finais aproximados (15.7.2): esforços horizontais da combinação × 0,95·γz, válido para γz ≤ 1,3.
 *   Rigidez reduzida (15.7.3): vigas 0,4·Eci·Ic (0,5 com As' = As), pilares 0,8·Eci·Ic, lajes 0,3·Eci·Ic;
 *   com vigas e pilares formando o contraventamento e γz ≤ 1,3, pode-se usar 0,7·Eci·Ic para ambos.
 */

export const THETA1_MIN = 1 / 300;
export const THETA1_MAX = 1 / 200;
export const LIMITE_GZ_FIXOS = 1.1;
export const LIMITE_GZ_APROXIMADO = 1.3;

/** Tipos de contraventamento e o α1 para 4 níveis ou mais (15.5.2). */
export const CONTRAVENTAMENTOS = {
  porticos: { alfa1: 0.5, desc: 'Só pórticos (vigas e pilares)' },
  misto: { alfa1: 0.6, desc: 'Pórticos associados a pilares-parede (estruturas usuais)' },
  paredes: { alfa1: 0.7, desc: 'Só pilares-parede' },
};

/** Rigidez reduzida (15.7.3), em fração de Eci·Ic. */
export const RIGIDEZ_REDUZIDA = {
  separada: { viga: 0.4, pilar: 0.8, desc: 'Vigas 0,4·EciIc e pilares 0,8·EciIc' },
  simetrica: { viga: 0.5, pilar: 0.8, desc: 'Vigas com As′ = As 0,5·EciIc e pilares 0,8·EciIc' },
  simplificada: { viga: 0.7, pilar: 0.7, desc: 'Vigas e pilares 0,7·EciIc (só com γz ≤ 1,3)' },
};

/**
 * Ângulos de desaprumo global.
 * @param {{H:number, n:number}} p  H: altura total (m); n: número de pilares verticais
 * @returns {{theta1:number, theta1Bruto:number, theta1SemMin:number, thetaA:number, thetaASemMin:number, fatorN:number}}
 */
export function desaprumo({ H, n }) {
  if (!(H > 0)) throw new Error('A altura do edifício precisa ser positiva.');
  const nn = Math.max(1, Math.round(n || 1));
  const bruto = 1 / (100 * Math.sqrt(H));
  const semMin = Math.min(bruto, THETA1_MAX);
  const theta1 = Math.max(semMin, THETA1_MIN);
  const fatorN = Math.sqrt((1 + 1 / nn) / 2);
  return { H, n: nn, theta1Bruto: bruto, theta1, theta1SemMin: semMin, fatorN, thetaA: theta1 * fatorN, thetaASemMin: semMin * fatorN };
}

/**
 * Ação horizontal a considerar numa direção, pela comparação dos momentos na base (11.3.3.4.1).
 * @param {number} Mvento  momento do vento na base (kN·m), 0 sem vento
 * @param {number} Mdesaprumo  momento do desaprumo com θ1,mín (kN·m)
 * @returns {'vento'|'desaprumo'|'combinado'}
 */
export function acaoHorizontal(Mvento, Mdesaprumo) {
  if (!(Mvento > 0)) return 'desaprumo';
  if (!(Mdesaprumo > 0)) return 'vento';
  if (0.3 * Mvento > Mdesaprumo) return 'vento';
  if (Mvento < 0.3 * Mdesaprumo) return 'desaprumo';
  return 'combinado';
}

/** α1 pelo número de níveis e pelo tipo de contraventamento. */
export function alfa1(nNiveis, contraventamento = 'porticos') {
  if (nNiveis <= 3) return Math.round((0.2 + 0.1 * Math.max(1, nNiveis)) * 100) / 100;
  return CONTRAVENTAMENTOS[contraventamento]?.alfa1 ?? 0.6;
}

/**
 * Rigidez do pilar equivalente (engastado na base, livre no topo) pelo deslocamento do topo sob forças
 * horizontais Fi nas alturas hi:  δtopo = Σ Fi·hi²·(3H − hi) / (6·EI).
 * @param {{h:number, F:number}[]} forcas  @param {number} H  @param {number} deltaTopo
 */
export function rigidezEquivalente(forcas, H, deltaTopo) {
  if (!(Math.abs(deltaTopo) > 0)) throw new Error('Deslocamento do topo nulo: não há rigidez equivalente.');
  const s = forcas.reduce((a, f) => a + f.F * f.h * f.h * (3 * H - f.h), 0);
  return Math.abs(s / (6 * deltaTopo));
}

/**
 * Parâmetro de instabilidade α.
 * @param {{H:number, Nk:number, EI:number, nNiveis:number, contraventamento?:string}} p  EI em kN·m²
 */
export function parametroAlfa({ H, Nk, EI, nNiveis, contraventamento = 'porticos' }) {
  if (!(EI > 0)) throw new Error('Rigidez equivalente não positiva.');
  const alfa = H * Math.sqrt(Math.max(0, Nk) / EI);
  const a1 = alfa1(nNiveis, contraventamento);
  return { alfa, alfa1: a1, nosFixos: alfa <= a1 };
}

/**
 * Coeficiente γz.
 * @param {{M1:number, dM:number}} p  M1: momento de tombamento de cálculo; dM: Σ Pd·δ (de cálculo)
 */
export function gamaZ({ M1, dM }) {
  if (!(M1 > 0)) throw new Error('Momento de tombamento nulo: γz indefinido.');
  const r = dM / M1;
  if (r >= 1) return { gz: Infinity, razao: r, classe: 'instavel', fator: Infinity };
  const gz = 1 / (1 - r);
  return { gz, razao: r, ...classificarGamaZ(gz) };
}

/** Classificação por γz e o fator de majoração dos esforços horizontais (15.7.2). */
export function classificarGamaZ(gz) {
  if (!Number.isFinite(gz)) return { classe: 'instavel', fator: Infinity };
  if (gz <= LIMITE_GZ_FIXOS) return { classe: 'fixos', fator: 1 };
  return { classe: gz <= LIMITE_GZ_APROXIMADO ? 'moveis' : 'excede', fator: Math.max(1, 0.95 * gz) };
}
