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
 * Análise de uma faixa (nervura ou painel) armada em uma direção,
 * usada pelas lajes treliçada, nervurada (uma direção) e alveolar.
 */
import { analisarViga } from '../../engine/viga-solver.js';

/** Vínculos das versões até 0.5 (substituídos pelas bordas de comum/bordas.js; mantidos para arquivos antigos). */
export const VINCULOS = [
  { valor: 'biapoiada', texto: 'Biapoiada', apoios: ['apoio', 'apoio'] },
  { valor: 'engaste-apoio', texto: 'Engaste + apoio', apoios: ['engaste', 'apoio'] },
  { valor: 'biengastada', texto: 'Biengastada', apoios: ['engaste', 'engaste'] },
  { valor: 'balanco', texto: 'Balanço', apoios: ['engaste', 'livre'] },
];

export const apoiosDoVinculo = (v) => (VINCULOS.find((x) => x.valor === v) ?? VINCULOS[0]).apoios;

/**
 * Esforços característicos (G e Q separados) de uma faixa de um vão.
 * @param {number} L   vão (m)
 * @param {number} wg  carga permanente na faixa (kN/m)
 * @param {number} wq  carga variável na faixa (kN/m)
 * @param {number} EI  rigidez (kN·m²)
 * @param {string[]} apoios  vínculos [x = 0, x = L]: 'apoio' | 'engaste' | 'livre'
 */
export function analisarFaixa({ L, apoios: ap, vinculo, wg, wq, EI }) {
  const apoios = ap ?? apoiosDoVinculo(vinculo);
  const base = { vaos: [L], apoios, P: [], EI: [EI] };
  const rG = analisarViga({ ...base, q: [wg] });
  const rQ = analisarViga({ ...base, q: [wq] });
  return { rG, rQ, apoios };
}

/** Combina G e Q ponto a ponto. */
export function combinar(rG, rQ, fg, fq) {
  return rG.pontos.map((p, i) => ({
    x: p.x,
    M: fg * p.M + fq * rQ.pontos[i].M,
    V: fg * p.V + fq * rQ.pontos[i].V,
  }));
}

/** Flecha da faixa para uma carga uniforme w com rigidez EI (mm). */
export function flechaFaixa({ L, apoios, vinculo, w, EI }) {
  const r = analisarViga({ vaos: [L], apoios: apoios ?? apoiosDoVinculo(vinculo), q: [w], P: [], EI: [EI] });
  return Math.abs(r.vaos[0].flecha) * 1000;
}
