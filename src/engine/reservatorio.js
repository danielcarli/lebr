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
 * Reservatórios retangulares de concreto armado — paredes, fundo e tampa como placas (NBR 6118:2023).
 *
 * Unidades: dimensões em m (espessuras em cm), pressões em kN/m², momentos em kN·m/m, forças em kN/m.
 *
 *   Pressão hidrostática: p = γw·(hágua − y), γw = 10 kN/m³, máxima no fundo.
 *   Empuxo de terra em repouso: K0 = 1 − sen φ; p = K0·(γs·(H − y) + q), máximo no fundo.
 *   Compatibilização dos momentos negativos numa aresta comum: M = máx(0,8·M maior; (M1 + M2)/2) — NBR 6118, 14.7.6.2.
 *   Tração nas paredes: a reação de uma parede na aresta vertical é a força de tração na parede vizinha.
 *   Paredes apoiadas em pilares nos cantos: vigas-parede (22.4) com braço z = 0,2·(l + 2h) para 1 ≤ l/h ≤ 2,
 *   z = 0,6·l para l/h < 1 e z = 0,8·h para l/h > 2 (viga comum).
 */
import { analisarPlaca } from './placa.js';

export const GAMA_AGUA = 10; // kN/m³

/** Coeficiente de empuxo em repouso (Jaky). */
export const k0 = (phiGraus) => 1 - Math.sin((phiGraus * Math.PI) / 180);

/** Momento compatibilizado numa aresta comum (valores absolutos). */
export function compatibilizar(m1, m2) {
  const a = Math.abs(m1), b = Math.abs(m2);
  return Math.max(0.8 * Math.max(a, b), (a + b) / 2);
}

/** Braço de alavanca do tirante de uma parede biapoiada nos pilares dos cantos (viga-parede quando l/h ≤ 2). */
export function bracoVigaParede(l, h) {
  const r = l / h;
  if (r < 1) return { z: 0.6 * l, regime: 'viga-parede' };
  if (r <= 2) return { z: 0.2 * (l + 2 * h), regime: 'viga-parede' };
  return { z: 0.8 * h, regime: 'viga' };
}

/**
 * Placa com carga unitária (máximo 1) e os resultados por unidade de pressão máxima.
 * @param {'uniforme'|'hidrostatica'|'empuxo'} tipo
 * @param {object} op  { ate (m) da água; topo (fração no topo) do empuxo }
 */
export function placaUnitaria({ lx, ly, bordas, tipo = 'uniforme', ate = null, topo = 0, nu = 0.2 }) {
  const carga = tipo === 'hidrostatica' ? { tipo: 'linear-y', base: 1, topo: 0, ate: Math.min(ate ?? ly, ly) }
    : tipo === 'empuxo' ? { tipo: 'linear-y', base: 1, topo, ate: ly } : null;
  const r = analisarPlaca({ lx, ly, bordas, nu, carga, divisoes: 20 });
  return { ...r.unit, reacoes: r.reacoes, total: r.totalReacoes };
}

/**
 * Geometria e pesos de um reservatório (eixos das paredes).
 * @param {object} p { a, b, H (m internos), hAgua, e, hf, ht (cm), tampa, gama }
 */
export function geometriaReservatorio({ a, b, H, hAgua, e, hf, ht, tampa = true, gama = 25 }) {
  const Lx = a + e / 100, Ly = b + e / 100;
  const Hw = H + hf / 200 + (tampa ? ht / 200 : 0);                 // altura da parede entre os eixos do fundo e da tampa
  const Htot = H + hf / 100 + (tampa ? ht / 100 : 0);               // altura externa
  const volume = a * b * Math.min(hAgua, H);                         // m³
  const Wagua = GAMA_AGUA * volume;
  const pesoParede = (gama * (e / 100) * Htot);                      // kN/m de parede
  const Wparedes = pesoParede * 2 * (Lx + Ly);
  const Wfundo = gama * (hf / 100) * (a + 2 * e / 100) * (b + 2 * e / 100);
  const Wtampa = tampa ? gama * (ht / 100) * (a + 2 * e / 100) * (b + 2 * e / 100) : 0;
  return { Lx, Ly, Hw, Htot, volume, Wagua, pesoParede, Wparedes, Wfundo, Wtampa };
}
