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
 * Torção em vigas de seção retangular — NBR 6118:2023, 17.5 (treliça espacial, bielas a θ = 45°)
 * e interação com a força cortante (17.7.2).
 *
 * Unidades: dimensões em cm, momento torçor em kN·m, forças em kN, áreas de aço em cm² e cm²/m.
 */

/**
 * Seção vazada equivalente (17.5.1.4.1): he ≤ A/u e he ≥ 2·c1; se A/u < 2·c1, he = A/u ≤ bw − 2·c1.
 * @param {number} c1  distância do eixo da barra longitudinal do canto à face (cm)
 */
export function secaoVazada({ b, h, c1 }) {
  const A = b * h, u = 2 * (b + h);
  // adota he = A/u (limite superior); quando A/u < 2·c1, a norma manda he = A/u ≤ bw − 2·c1
  let he = A / u;
  if (A / u < 2 * c1) he = Math.min(A / u, b - 2 * c1);
  const Ae = (b - he) * (h - he);
  const ue = 2 * ((b - he) + (h - he));
  return { A, u, he, Ae, ue };
}

/**
 * Dimensionamento à torção de equilíbrio, com a força cortante concomitante.
 * @param {object} p
 * @param {number} p.Td    momento torçor de cálculo (kN·m, valor absoluto)
 * @param {number} p.Vd    força cortante de cálculo na mesma seção (kN)
 * @param {number} p.VRd2  resistência da biela à cortante (kN)
 * @param {number} p.b     largura (cm)
 * @param {number} p.h     altura (cm)
 * @param {number} p.c1    eixo da barra de canto até a face (cm)
 * @param {object} p.c     concreto() de materiais.js
 * @param {object} p.s     aco() de materiais.js
 */
export function dimensionarTorcao({ Td, Vd = 0, VRd2, b, h, c1, c, s }) {
  const T = Math.abs(Td) * 100;                 // kN·cm
  const fcd = c.fcd / 10;                       // kN/cm²
  const fyd = s.fyd / 10;
  const fywd = Math.min(s.fyd, 435) / 10;
  const av2 = 1 - c.fck / 250;
  const sec = secaoVazada({ b, h, c1 });
  const { he, Ae, ue } = sec;

  // 17.5.1.5: TRd2 = 0,5·αv2·fcd·Ae·he·sen2θ (θ = 45°)
  const TRd2 = 0.5 * av2 * fcd * Ae * he;                     // kN·cm
  // 17.5.1.6: armaduras para TSd = TRd3 = TRd4
  const A90 = (T / (2 * Ae * fywd)) * 100;                    // cm²/m, por ramo (estribo vertical)
  const AslPorCm = T / (2 * Ae * fyd);                        // cm²/cm de perímetro
  const Asl = AslPorCm * ue;                                  // cm², total no perímetro
  // taxas mínimas (17.5.1.2): ρsl = ρ90 ≥ 0,2·fct,m/fywk
  const rhoMin = (0.2 * c.fctm) / Math.min(s.fyk, 500);
  const A90Min = rhoMin * he * 100;                           // cm²/m por ramo (parede de espessura he)
  const AslMin = rhoMin * he * ue;                            // cm²
  // 17.7.2.2: biela com cortante e torção combinadas
  const interacao = (VRd2 > 0 ? Math.abs(Vd) / VRd2 : 0) + T / TRd2;
  return {
    ...sec, Td: Math.abs(Td), TRd2: TRd2 / 100, A90Calc: A90, A90: Math.max(A90, A90Min), A90Min,
    AslCalc: Asl, Asl: Math.max(Asl, AslMin), AslMin, AslPorM: AslPorCm * 100,
    interacao, ok: interacao <= 1 + 1e-9,
  };
}

/**
 * Momento torçor característico ao longo de um vão com torque distribuído t (kN·m/m).
 * Apoios restringem a torção (pilares ou vigas de apoio); extremidade livre (balanço) não.
 * @param {number} t     torque distribuído (kN·m/m)
 * @param {number} L     vão (m)
 * @param {number} x     posição a partir do início do vão (m)
 * @param {boolean} livreIni  início do vão livre (balanço à esquerda)
 * @param {boolean} livreFim  fim do vão livre (balanço à direita)
 */
export function torcaoNoVao(t, L, x, livreIni, livreFim) {
  if (!t) return 0;
  if (livreFim && !livreIni) return t * (L - x);   // engastado no início
  if (livreIni && !livreFim) return -t * x;        // engastado no fim
  return t * (L / 2 - x);                          // engastado nas duas extremidades
}
