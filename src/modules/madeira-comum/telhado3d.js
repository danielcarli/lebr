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
 * Modelo 3D do telhado de madeira e da tesoura (cm, z para cima), no formato da vista de armadura: além de `caixas` e
 * `barras`, `pecas` — prismas retangulares orientados entre dois pontos (seção b × h, com h na direção "cima") — e
 * empenas triangulares dos oitões. Coordenadas locais: x ao longo do vão, y ao longo da cumeeira, z = 0 no apoio.
 */
import { geometriaTesoura } from '../../engine/tesoura.js';
import { geometriaTelhado, telhaDe, SECOES_TESOURA_PADRAO } from '../madeira-telhado/calculo.js';

const norm = (v) => { const l = Math.hypot(...v) || 1; return v.map((c) => c / l); };
const fmt = (v, c = 0) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');

/**
 * Peças de uma tesoura no plano x–z, no y dado. `cores` (opcional) troca o tipo de cada barra pelo sinal do esforço.
 */
export function pecasTesoura({ tipo = 'howe', L, inclinacao, paineis, secoes, y = 0, barrasCalc = null }) {
  const gt = geometriaTesoura({ tipo, L, inclinacao, paineis });
  const zE = secoes.banzoInf.h / 2;
  return gt.barras.map((b, k) => {
    const p = gt.nos[b.i], q = gt.nos[b.j], s = secoes[b.grupo];
    const d = [(q.x - p.x), 0, (q.y - p.y)];
    let cima = norm([-d[2], 0, d[0]]);
    if (cima[2] < 0) cima = cima.map((c) => -c);
    const bc = barrasCalc?.[k];
    const tipoPeca = bc ? (Math.max(bc.Nt, -bc.Nc) < 0.05 ? 'nula' : bc.Nt > -bc.Nc ? 'tracao' : 'compressao') : 'tesoura';
    const esf = bc ? (bc.Nt > -bc.Nc ? ` · Nt,d ${fmt(bc.Nt, 1)} kN` : ` · Nc,d ${fmt(-bc.Nc, 1)} kN`) : '';
    return { p: [p.x * 100, y, zE + p.y * 100], q: [q.x * 100, y, zE + q.y * 100], b: s.b, h: s.h, cima, tipo: tipoPeca, rotulo: `${b.nome} · ${fmt(s.b)} × ${fmt(s.h)} cm${esf}` };
  });
}

/** Modelo completo do telhado: tesouras, terças, caibros, ripas, telhas, oitões e os apoios. */
export function modeloTelhado(el, { secoes = SECOES_TESOURA_PADRAO, tipo = el.tipoTesoura ?? 'howe' } = {}) {
  const g = geometriaTelhado(el), telha = telhaDe(el);
  const L = g.L * 100, C = g.C * 100, t = g.i / 100, cosA = g.cos, sinA = g.sin;
  const bei = g.beiral * 100, beiO = g.beiralOitao * 100;
  const pecas = [];
  // tesouras
  for (const v of g.tesouras) pecas.push(...pecasTesoura({ tipo, L: g.L, inclinacao: g.i, paineis: g.n, secoes, y: v * 100 }));
  const zE = secoes.banzoInf.h / 2;
  const topo = (u) => zE + t * Math.min(u, L - u) + secoes.banzoSup.h / (2 * cosA);
  // terças em pé nos nós do banzo superior
  const ht = el.terca.h, bt = el.terca.b;
  for (const tc of g.tercas) {
    const u = tc.x * 100, zc = topo(u) + ht / 2;
    pecas.push({ p: [u, -beiO, zc], q: [u, C + beiO, zc], b: bt, h: ht, cima: [0, 0, 1], tipo: 'terca', rotulo: `${tc.tipo === 'cumeeira' ? 'Cumeeira' : tc.tipo === 'frechal' ? 'Frechal' : 'Terça'} · ${fmt(bt)} × ${fmt(ht)} cm` });
  }
  // águas: caibros, ripas e telha sobre o plano do topo das terças (prolongado no beiral)
  const zApoio = (u) => topo(Math.min(Math.max(u, 0), L)) + ht + (u < 0 ? u * t : u > L ? -(u - L) * t : 0);
  const ec = (Number(el.espacCaibros) || 0.5) * 100, galga = (Number(el.galga) || telha.galga || 0.35) * 100;
  for (const lado of [-1, 1]) {
    const u0 = lado < 0 ? -bei : L + bei, u1 = L / 2;
    const nrm = lado < 0 ? [-sinA, cosA] : [sinA, cosA];
    const P = (u, v, off) => [u + nrm[0] * off, v, zApoio(u) + nrm[1] * off];
    const cima = [nrm[0], 0, nrm[1]];
    let off = 1.5;
    if (telha.ripas) {
      const hc = el.caibro.h, bc = el.caibro.b, hr = el.ripa.h, br = el.ripa.b;
      for (let v = -beiO + bc / 2; v <= C + beiO - bc / 2 + 1e-6; v += ec) pecas.push({ p: P(u0, v, hc / 2), q: P(u1, v, hc / 2), b: bc, h: hc, cima, tipo: 'caibro', rotulo: `Caibro · ${fmt(bc)} × ${fmt(hc)} cm a cada ${fmt(ec)} cm` });
      const sTot = Math.hypot(u1 - u0, (u1 - u0) * t);
      for (let s = 3; s <= sTot - 2; s += galga) {
        const u = u0 + (s / sTot) * (u1 - u0);
        pecas.push({ p: P(u, -beiO, hc + hr / 2), q: P(u, C + beiO, hc + hr / 2), b: br, h: hr, cima, tipo: 'ripa', rotulo: `Ripa · ${fmt(br)} × ${fmt(hr, 1)} cm · galga ${fmt(galga)} cm` });
      }
      off = hc + hr + 1;
    }
    pecas.push({ p: P(u0, C / 2, off), q: P(u1, C / 2, off), b: C + 2 * beiO, h: 1.5, cima, tipo: 'telha', rotulo: `${telha.texto} · ${fmt(telha.peso, 2)} kN/m²` });
  }
  // oitões (empenas) e apoios: paredes ou vigas sob os beirais
  const empenas = g.oitoes ? [0, C].map((v) => ({ L, H: g.H * 100, y: v, esp: 14, tipo: 'oitao', rotulo: 'Oitão de alvenaria (empena)' })) : [];
  const caixas = [
    { min: [-7, 0, -30], max: [7, C, 0], tipo: 'apoio' },
    { min: [L - 7, 0, -30], max: [L + 7, C, 0], tipo: 'apoio' },
    ...(g.oitoes ? [{ min: [0, -7, -30], max: [L, 7, 0], tipo: 'apoio' }, { min: [0, C - 7, -30], max: [L, C + 7, 0], tipo: 'apoio' }] : []),
  ];
  return {
    caixas, barras: [], pecas, empenas, vista: { teta: -0.75, fi: 1.0 },
    legenda: `${g.tesouras.length} tesouras ${tipo === 'pratt' ? 'Pratt' : 'Howe'} a cada ${fmt(g.et, 2)} m · ${g.n + 1} linhas de terças${telha.ripas ? ` · caibros a cada ${fmt(ec)} cm · ripas com galga de ${fmt(galga)} cm` : ''} · ${telha.texto.toLowerCase()}${g.oitoes ? ' · oitões de alvenaria nas pontas' : ''} · apoios em cinza`,
  };
}

/** Modelo da tesoura isolada, com as barras coloridas pelo esforço que governa. */
export function modeloTesoura(r, secoes) {
  const pecas = pecasTesoura({ tipo: r.tipo, L: r.L, inclinacao: r.inclinacao, paineis: r.paineis, secoes, barrasCalc: r.barras });
  const L = r.L * 100;
  return {
    caixas: [{ min: [-7, -10, -30], max: [7, 10, 0], tipo: 'apoio' }, { min: [L - 7, -10, -30], max: [L + 7, 10, 0], tipo: 'apoio' }],
    barras: [], pecas, empenas: [], vista: { teta: -1.25, fi: 1.25 },
    legenda: 'Barras pelo esforço normal de cálculo que governa: tração em azul, compressão em vermelho, esforço nulo em cinza · passe o mouse para ver a barra',
  };
}
