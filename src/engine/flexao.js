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
 * Flexão simples em seção retangular — NBR 6118:2023, 17.2 e 17.3.5
 *
 * Unidades de entrada: dimensões em cm, momento em kN·m.
 * Unidades de saída: áreas de aço em cm².
 */

/**
 * Dimensiona a armadura longitudinal de uma seção retangular.
 * Usa o diagrama retangular simplificado (λ·x, σcd = αc·ηc·fcd).
 * Se x/d ultrapassar o limite de ductilidade, adota armadura dupla.
 *
 * @param {object} p
 * @param {number} p.Md     momento de cálculo (kN·m), valor absoluto
 * @param {number} p.b      largura comprimida (cm)
 * @param {number} p.h      altura total (cm)
 * @param {number} p.d      altura útil (cm)
 * @param {number} [p.dl]   d' — distância da armadura comprimida à face (cm)
 * @param {object} p.c      objeto de concreto() de materiais.js
 * @param {object} p.s      objeto de aco() de materiais.js
 */
export function dimensionarFlexao({ Md, b, h, d, dl = 4, c, s }) {
  const M = Math.abs(Md) * 100;           // kN·cm
  const scd = c.sigmaCd / 10;             // kN/cm²
  const fyd = s.fyd / 10;                 // kN/cm²
  const Es = s.Es / 10;                   // kN/cm²

  const Kmd = M / (b * d * d * scd);
  const KmdLim = c.lambda * c.xiLim * (1 - c.lambda * c.xiLim / 2);
  const xi23 = c.ecu / (c.ecu + 10);

  const r = { Md: Math.abs(Md), Kmd, KmdLim, As: 0, Asl: 0, dupla: false, ok: true, avisos: [] };

  if (M === 0) return { ...r, xi: 0, x: 0, z: d, dominio: '—' };

  if (Kmd <= KmdLim) {
    const xi = (1 - Math.sqrt(1 - 2 * Kmd)) / c.lambda;
    const z = d * (1 - c.lambda * xi / 2);
    r.xi = xi; r.x = xi * d; r.z = z;
    r.As = M / (z * fyd);
    r.dominio = xi <= xi23 ? '2' : '3';
  } else {
    // Armadura dupla (17.2.4)
    const xi = c.xiLim;
    const xlim = xi * d;
    const zlim = d * (1 - c.lambda * xi / 2);
    const Mlim = KmdLim * b * d * d * scd;
    const dM = M - Mlim;
    const esl = c.ecu * (xlim - dl) / xlim / 1000;   // deformação da armadura comprimida
    const ssl = Math.min(Es * esl, fyd);
    r.dupla = true;
    r.xi = xi; r.x = xlim; r.z = zlim; r.dominio = '3 (dupla)';
    r.As = Mlim / (zlim * fyd) + dM / ((d - dl) * fyd);
    r.Asl = dM / ((d - dl) * ssl);
    r.avisos.push('x/d acima do limite de ductilidade: adotada armadura dupla.');
    if (Kmd > 2 * KmdLim) {
      r.ok = false;
      r.avisos.push('Momento muito superior ao limite da seção — aumente a altura da peça.');
    }
  }

  // Armadura mínima e máxima (17.3.5.2)
  r.AsMin = armaduraMinima({ b, h, d, c, s });
  r.AsMax = 0.04 * b * h;
  r.AsCalc = r.As;
  if (r.As < r.AsMin) r.As = r.AsMin;
  if (r.As + r.Asl > r.AsMax) {
    r.ok = false;
    r.avisos.push('Armadura total acima de 4% Ac — redimensione a seção.');
  }
  return r;
}

/**
 * Armadura mínima de tração (17.3.5.2.1): dimensionada para
 * Md,mín = 0,8·W0·fctk,sup, respeitada a taxa absoluta de 0,15 %.
 */
export function armaduraMinima({ b, h, d, c, s }) {
  const W0 = b * h * h / 6;                       // cm³
  const MdMin = 0.8 * W0 * (c.fctkSup / 10);      // kN·cm
  const scd = c.sigmaCd / 10;
  const K = MdMin / (b * d * d * scd);
  const xi = (1 - Math.sqrt(Math.max(0, 1 - 2 * K))) / c.lambda;
  const z = d * (1 - c.lambda * xi / 2);
  const AsMd = MdMin / (z * (s.fyd / 10));
  return Math.max(AsMd, 0.0015 * b * h);
}
