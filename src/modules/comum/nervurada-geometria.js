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
 * Geometria da laje nervurada moldada no local: capa, nervuras, faixas maciças de borda, nervuras de travamento e os
 * vazios (cubetas) ou blocos de enchimento entre elas. Usada pela vista 3D da estrutura e pela armadura em 3D.
 *
 * Coordenadas locais em cm: (0, 0) no canto x0/y0 da laje, x ao longo de lx, y ao longo de ly, z para cima com a face
 * inferior das nervuras em z = 0 e a face superior da capa em z = h.
 *
 * Arranjo em cada direção: m vazios de (e − bw) separados por nervuras de bw, com nervura nas duas pontas; a sobra
 * (L − m·e − bw) fica meio a meio como faixa maciça junto às bordas, somada à nervura da ponta (nervura de borda).
 *   m = ⌊(L − bw) / e⌋
 * Em uma direção (nervuras em x), na direção x só as faixas das extremidades e as nervuras transversais de travamento:
 * uma no meio do vão acima de 4 m, duas (terços) acima de 6 m (prática usual; a NBR 6118, 13.2.4.2, pede o
 * travamento sem fixar a quantidade).
 */

const r1 = (v) => Math.round(v * 10) / 10;

/** Faixas de uma direção de comprimento L (cm): { cheios: [[a, b]] (nervuras e faixas de borda), vazios: [[a, b]], eixos: [centro de cada nervura] }. */
export function faixasNervuras(L, e, bw) {
  if (!(L > 0) || !(e > bw) || !(bw > 0)) return { cheios: [[0, L]], vazios: [], eixos: [L / 2], borda: L / 2 };
  const m = Math.max(0, Math.floor((L - bw) / e + 1e-9));
  if (m === 0) return { cheios: [[0, L]], vazios: [], eixos: [L / 2], borda: L / 2 };
  const sobra = (L - m * e - bw) / 2;
  const borda = sobra + bw;                       // faixa maciça + nervura da ponta
  const eixos = Array.from({ length: m + 1 }, (_, k) => r1(sobra + bw / 2 + k * e));
  const cheios = [[0, r1(borda)]], vazios = [];
  for (let k = 0; k < m; k++) {
    const a = sobra + bw + k * e, b = a + e - bw;
    vazios.push([r1(a), r1(b)]);
    cheios.push(k === m - 1 ? [r1(b), L] : [r1(b), r1(b + bw)]);
  }
  return { cheios, vazios, eixos, borda: r1(borda) };
}

/** Posições (cm) das nervuras transversais de travamento numa laje armada em uma direção de vão lx (m). */
export function travamentos(lx, balanco = false) {
  if (balanco || !(lx > 4)) return [];
  return lx > 6 ? [lx / 3, (2 * lx) / 3].map((x) => r1(x * 100)) : [r1(lx * 50)];
}

/** Recorta [0, L] tirando os intervalos cheios: o que sobra são os vazios. */
function vaziosEntre(L, cheios) {
  const cs = [...cheios].sort((a, b) => a[0] - b[0]);
  const out = [];
  let x = 0;
  for (const [a, b] of cs) { if (a > x + 0.05) out.push([r1(x), r1(a)]); x = Math.max(x, b); }
  if (L > x + 0.05) out.push([r1(x), L]);
  return out;
}

/**
 * Geometria completa.
 * @param {object} el  laje nervurada (lx, ly em m; h, hf, bw, intereixo em cm; direcao 'duas' | 'x'; enchimento; bordas)
 * @returns {{ lx, ly, h, hf, bw, e, duas, nervurasX, nervurasY, travamento, faixasX, faixasY, caixas, enchimento }}
 *   nervurasX: eixos (y, cm) das nervuras que correm em x (vencem lx); nervurasY: eixos (x, cm) das que correm em y
 *   caixas: [{ min, max, tipo: 'concreto' | 'enchimento', parte: 'capa' | 'nervura' | 'enchimento' }]
 */
export function geometriaNervurada(el) {
  const lx = (Number(el.lx) || 1) * 100, ly = (Number(el.ly) || 1) * 100;
  const h = Number(el.h) || 30, hf = Math.min(Number(el.hf) || 5, h - 1), bw = Number(el.bw) || 10, e = Number(el.intereixo) || 60;
  const duas = el.direcao === 'duas';
  const hr = h - hf;
  // nervuras que correm em x ficam distribuídas ao longo de y
  const fy = faixasNervuras(ly, e, bw);
  let fx, nervurasY, travamento = [];
  if (duas) {
    fx = faixasNervuras(lx, e, bw);
    nervurasY = fx.eixos;
  } else {
    const b = el.bordas ?? {};
    const balanco = b.x0 === 'livre' || b.x1 === 'livre';
    travamento = travamentos(lx / 100, balanco);
    const ponta = Math.min(lx / 2, Math.max(bw, fy.borda));        // faixa maciça nas extremidades das nervuras
    const cheios = [[0, r1(ponta)], [r1(lx - ponta), lx], ...travamento.map((x) => [r1(x - bw / 2), r1(x + bw / 2)])];
    fx = { cheios, vazios: vaziosEntre(lx, cheios), eixos: travamento, borda: r1(ponta) };
    nervurasY = travamento;
  }
  const caixas = [{ min: [0, 0, hr], max: [lx, ly, h], tipo: 'concreto', parte: 'capa' }];
  // nervuras em x: faixas cheias de y, corridas em x
  for (const [a, b] of fy.cheios) caixas.push({ min: [0, a, 0], max: [lx, b, hr], tipo: 'concreto', parte: 'nervura' });
  // nervuras em y (ou travamentos): só nos trechos vazios de y, para não sobrepor as de x
  for (const [a, b] of fx.cheios) for (const [c, d] of fy.vazios) caixas.push({ min: [a, c, 0], max: [b, d, hr], tipo: 'concreto', parte: 'nervura' });
  const enchimento = el.enchimento && el.enchimento !== 'cubeta' ? el.enchimento : null;
  if (enchimento) for (const [a, b] of fx.vazios) for (const [c, d] of fy.vazios) caixas.push({ min: [a, c, 0], max: [b, d, hr], tipo: 'enchimento', parte: 'enchimento', material: enchimento });
  return { lx, ly, h, hf, bw, e, duas, nervurasX: fy.eixos, nervurasY, travamento, faixasX: fx, faixasY: fy, caixas, enchimento };
}

/** Cores do enchimento (vista 3D). */
export const COR_ENCHIMENTO = { eps: 0xf2f0ea, ceramico: 0xc4704a, concreto: 0xb8b3aa };
