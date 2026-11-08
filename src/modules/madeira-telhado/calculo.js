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
 * Telhado de madeira em duas águas — NBR 7190-1:2022 e NBR 6120:2019
 *
 * Estrutura usual: telhas sobre ripas, ripas sobre caibros, caibros sobre terças (frechal, terças intermediárias e
 * cumeeira) e terças sobre tesouras (ou sobre os oitões de alvenaria nas pontas). Verifica ripas (flexão oblíqua),
 * caibros (viga contínua com o beiral em balanço), terças (flexão, cisalhamento, vento com flexão oblíqua, carga
 * concentrada de 1 kN) e entrega as cargas nos nós da tesoura e as reações por metro nos apoios.
 */
import { analisarViga } from '../../engine/viga-solver.js';
import { coeficientesAcoes } from '../../engine/combinacoes.js';
import { madeira, flexaoMadeira, cisalhamentoMadeira, estabilidadeLateral, flexaoObliquaMadeira, flechaFinal } from '../../engine/madeira.js';
import { geometriaTesoura } from '../../engine/tesoura.js';
import { materialDoElemento, materialInicial, memorialMaterial } from '../madeira-comum/material.js';

const f = (v, c = 2) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');
const r3 = (v) => Math.round(v * 1000) / 1000 || 0;

/**
 * Telhas usuais (pesos por m² de telhado, saturadas, com sobreposições). REFERÊNCIA: valores típicos de catálogo e da
 * NBR 6120:2019 — confira com o fabricante. galga = distância entre ripas; vaoMax = vão máximo entre terças das telhas
 * que apoiam direto nas terças.
 */
export const TELHAS = [
  { valor: 'ceramica-francesa', texto: 'Cerâmica francesa (Marselha)', peso: 0.50, incMin: 32, galga: 0.34, ripas: true, porM2: 16 },
  { valor: 'ceramica-romana', texto: 'Cerâmica romana', peso: 0.50, incMin: 30, galga: 0.37, ripas: true, porM2: 16 },
  { valor: 'ceramica-portuguesa', texto: 'Cerâmica portuguesa', peso: 0.55, incMin: 30, galga: 0.36, ripas: true, porM2: 17 },
  { valor: 'ceramica-colonial', texto: 'Cerâmica colonial (capa e canal)', peso: 0.70, incMin: 25, galga: 0.40, ripas: true, porM2: 26 },
  { valor: 'concreto', texto: 'Telha de concreto', peso: 0.55, incMin: 30, galga: 0.32, ripas: true, porM2: 10.5 },
  { valor: 'fibrocimento', texto: 'Fibrocimento ondulada 6 mm', peso: 0.20, incMin: 15, galga: null, ripas: false, vaoMax: 1.69, porM2: 0.6 },
  { valor: 'aco', texto: 'Telha de aço trapezoidal', peso: 0.10, incMin: 10, galga: null, ripas: false, vaoMax: 2.5, porM2: 1 },
];
export const telhaDe = (el) => TELHAS.find((t) => t.valor === el.telha) ?? TELHAS[0];

export function criarTelhado(projeto) {
  return {
    ...materialInicial(projeto), classe: 'D40',
    vao: 8, comprimento: 10, inclinacao: 35, beiral: 0.6, beiralOitao: 0.4,
    telha: 'ceramica-francesa', pesoTelha: null,
    extremidades: 'tesouras',          // 'tesouras' nas pontas ou 'oitoes' de alvenaria
    paineis: 6, espacTesouras: 3, espacCaibros: 0.5, galga: null,
    ripa: { b: 5, h: 1.5 }, caibro: { b: 5, h: 6 }, terca: { b: 6, h: 16 },
    tipoTesoura: 'howe',
    cargas: { sobrecarga: 0.25, forro: 0, vento: 0 },
    posicao: null,
  };
}

/** Geometria do telhado: águas, painéis, posição das tesouras e das terças. Distâncias em m. */
export function geometriaTelhado(el) {
  const L = Number(el.vao) || 0, C = Number(el.comprimento) || 0, i = Number(el.inclinacao) || 0;
  if (!(L > 0) || !(C > 0)) throw new Error('Informe o vão e o comprimento do telhado.');
  if (!(i > 0)) throw new Error('A inclinação precisa ser maior que zero.');
  const n = Math.max(2, 2 * Math.round((Number(el.paineis) || 2) / 2)), np = n / 2;
  const alfa = Math.atan(i / 100), cos = Math.cos(alfa), sin = Math.sin(alfa);
  const a = L / 2, s = a / cos, lh = a / np, lp = s / np;
  const beiral = Math.max(0, Number(el.beiral) || 0), beiralS = beiral / cos, beiralOitao = Math.max(0, Number(el.beiralOitao) || 0);
  const nInt = Math.max(1, Math.ceil(C / Math.max(0.5, Number(el.espacTesouras) || 3) - 1e-9));
  const et = C / nInt;
  const oitoes = el.extremidades === 'oitoes';
  const tesouras = [];
  for (let k = oitoes ? 1 : 0; k <= (oitoes ? nInt - 1 : nInt); k++) tesouras.push(r3(k * et));
  // terças: em cada nó do banzo superior (frechal, intermediárias, cumeeira e as da outra água)
  const tercas = [];
  for (let k = 0; k <= n; k++) {
    const x = (k * L) / n;
    tercas.push({ x: r3(x), z: r3((i / 100) * Math.min(x, L - x)), tipo: k === 0 || k === n ? 'frechal' : k === np ? 'cumeeira' : 'terca' });
  }
  return { L, C, n, np, alfa, cos, sin, i, a, s, lh, lp, H: (i / 100) * a, beiral, beiralS, beiralOitao, nInt, et, tesouras, tercas, oitoes };
}

/** Pesos por m² de telhado (superfície inclinada) das partes apoiadas nas terças. */
function pesosSuperficie(el, m, telha) {
  const pTelha = el.pesoTelha != null && el.pesoTelha !== '' ? Number(el.pesoTelha) : telha.peso;
  const galga = Number(el.galga) || telha.galga;
  const ec = Number(el.espacCaibros) || 0.5;
  const ppRipa = telha.ripas ? (m.peso * el.ripa.b * el.ripa.h) / 1e4 : 0;      // kN/m
  const ppCaibro = telha.ripas ? (m.peso * el.caibro.b * el.caibro.h) / 1e4 : 0;
  const ripasM2 = telha.ripas ? ppRipa / galga : 0;
  const caibrosM2 = telha.ripas ? ppCaibro / ec : 0;
  return { pTelha, galga, ec, ppRipa, ppCaibro, ripasM2, caibrosM2, g: pTelha + ripasM2 + caibrosM2 };
}

/**
 * Cargas características nos nós de uma tesoura intermediária (espaçamento et): G e Q verticais (kN, para baixo),
 * vento W como [Fx, Fy] (sucção, para fora das águas) e forro nos nós do banzo inferior.
 */
export function cargasNosTesoura(el, parametros) {
  const { m } = materialDoElemento(el, parametros);
  const telha = telhaDe(el), geo = geometriaTelhado(el), ps = pesosSuperficie(el, m, telha);
  const ppTerca = (m.peso * el.terca.b * el.terca.h) / 1e4;
  const q = Number(el.cargas?.sobrecarga) || 0, w = Number(el.cargas?.vento) || 0, forro = Number(el.cargas?.forro) || 0;
  const { n, np, lp, beiralS, et, cos, sin, L } = geo;
  const sup = [], inf = [];
  for (let k = 0; k <= n; k++) {
    const trib = k === 0 || k === n ? lp / 2 + beiralS : lp;
    const G = (ps.g * trib + ppTerca) * et;
    const Q = q * trib * cos * et;
    let W = [0, 0];
    const esq = [-sin, cos], dir = [sin, cos];
    if (k === np) W = [w * (lp / 2) * et * (esq[0] + dir[0]), w * (lp / 2) * et * (esq[1] + dir[1])];
    else { const nn = k < np ? esq : dir; W = [w * trib * et * nn[0], w * trib * et * nn[1]]; }
    sup.push({ G, Q, W });
  }
  for (let k = 0; k <= n; k++) inf.push({ F: forro * (k === 0 || k === n ? L / n / 2 : L / n) * et });
  return { sup, inf, geo, ps, ppTerca };
}

/** Tesoura ligada a este telhado, se houver. */
export const tesouraDoTelhado = (projeto, el) => projeto?.elementos?.find((e) => e.modulo === 'madeira.tesoura' && e.telhadoId === el.id) ?? null;

/** Peso próprio (kN) de uma tesoura com as seções dadas. */
export function pesoTesoura(geo, tipo, secoes, m) {
  const g = geometriaTesoura({ tipo, L: geo.L, inclinacao: geo.i, paineis: geo.n });
  return g.barras.reduce((s, b) => { const sc = secoes[b.grupo]; return s + b.L * (m.peso * sc.b * sc.h) / 1e4; }, 0);
}
export const SECOES_TESOURA_PADRAO = { banzoSup: { b: 6, h: 16 }, banzoInf: { b: 6, h: 16 }, montante: { b: 6, h: 12 }, diagonal: { b: 6, h: 12 } };

/** Cargas por metro nos apoios: beirais (a, b) e, com oitões, as empenas. */
function reacoesDoTelhado(el, ctx) {
  const { m } = materialDoElemento(el, ctx.parametros);
  const { geo, ps, ppTerca } = cargasNosTesoura(el, ctx.parametros);
  const telha = telhaDe(el);
  const q = Number(el.cargas?.sobrecarga) || 0, forro = Number(el.cargas?.forro) || 0;
  const tes = tesouraDoTelhado(ctx.projeto, el);
  const pTes = pesoTesoura(geo, tes?.geometria?.tipo ?? el.tipoTesoura ?? 'howe', tes?.secoes ?? SECOES_TESOURA_PADRAO, m);
  const Cb = geo.C + 2 * geo.beiralOitao;
  const sup = 2 * (geo.s + geo.beiralS) * Cb;                         // m² de telhado
  const hor = 2 * (geo.a + geo.beiral) * Cb;                          // m² em projeção
  const Gtot = ps.g * sup + ppTerca * (geo.n + 1) * Cb + pTes * geo.tesouras.length + forro * geo.L * geo.C;
  const Qtot = q * hor;
  if (!geo.oitoes) return { a: { g: Gtot / 2 / geo.C, q: Qtot / 2 / geo.C }, b: { g: Gtot / 2 / geo.C, q: Qtot / 2 / geo.C }, oitao: null, Gtot, Qtot, pTes, telha };
  // oitões: cada terça descarrega metade do primeiro vão (mais o beiral do oitão) na empena
  const nT = geo.n + 1;
  const gT = (k) => ps.g * (k === 0 || k === geo.n ? geo.lp / 2 + geo.beiralS : geo.lp) + ppTerca;
  const qT = (k) => q * (k === 0 || k === geo.n ? geo.lp / 2 + geo.beiralS : geo.lp) * geo.cos;
  const larg = geo.et / 2 + geo.beiralOitao;
  let gO = 0, qO = 0;
  for (let k = 0; k < nT; k++) { gO += gT(k) * larg; qO += qT(k) * larg; }
  const gE = (Gtot - 2 * gO) / 2 / geo.C, qE = (Qtot - 2 * qO) / 2 / geo.C;
  return { a: { g: gE, q: qE }, b: { g: gE, q: qE }, oitao: { g: gO / geo.L, q: qO / geo.L }, Gtot, Qtot, pTes, telha };
}

export function ligacoes(el) {
  const out = [
    { id: 'apoio-a', nome: 'Apoio A (beiral da origem)', tipo: 'linear' },
    { id: 'apoio-b', nome: 'Apoio B (beiral oposto)', tipo: 'linear' },
  ];
  if (el.extremidades === 'oitoes') out.push({ id: 'oitao-0', nome: 'Oitão da origem', tipo: 'linear' }, { id: 'oitao-1', nome: 'Oitão oposto', tipo: 'linear' });
  return out;
}

export function cargasTransmitidas(el, ctx) {
  const r = reacoesDoTelhado(el, ctx);
  const out = { 'apoio-a': r.a, 'apoio-b': r.b };
  if (r.oitao) { out['oitao-0'] = r.oitao; out['oitao-1'] = r.oitao; }
  return out;
}

/**
 * Linhas de apoio do telhado na planta (coordenadas globais): beirais A e B (ao longo do comprimento) e, com
 * oitões, as empenas (ao longo do vão). Origem da posição no canto do apoio A; eixo x local = vão, y local = cumeeira.
 */
export function linhasDeApoioTelhado(el) {
  const { x = 0, y = 0, angulo = 0 } = el.posicao ?? {};
  const a = (angulo * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  const P = (u, v) => [x + u * c - v * s, y + u * s + v * c];
  const L = Number(el.vao) || 0, C = Number(el.comprimento) || 0;
  const out = { 'apoio-a': [P(0, 0), P(0, C)], 'apoio-b': [P(L, 0), P(L, C)] };
  if (el.extremidades === 'oitoes') { out['oitao-0'] = [P(0, 0), P(L, 0)]; out['oitao-1'] = [P(0, C), P(L, C)]; }
  return out;
}

/** Ponto global de coordenadas locais (u ao longo do vão, v ao longo da cumeeira). */
export function pontoTelhado(el, u, v) {
  const { x = 0, y = 0, angulo = 0 } = el.posicao ?? {};
  const a = (angulo * Math.PI) / 180;
  return [x + u * Math.cos(a) - v * Math.sin(a), y + u * Math.sin(a) + v * Math.cos(a)];
}

export function calcularTelhado(el, ctx) {
  const { m, p, psi2 } = materialDoElemento(el, ctx.parametros);
  const mCurta = madeira(el.classe ?? p.classe, { umidade: p.umidade, carregamento: 'curta', tipo: el.tipo ?? p.tipo, gwc: p.gwc, gwv: p.gwv });
  const mInst = madeira(el.classe ?? p.classe, { umidade: p.umidade, carregamento: 'instantanea', tipo: el.tipo ?? p.tipo, gwc: p.gwc, gwv: p.gwv });
  const acoes = coeficientesAcoes(ctx.parametros);
  const gg = p.gg, gq = p.gq, ggFav = acoes.ggFav;
  const telha = telhaDe(el);
  const { geo, ps, ppTerca, sup: nosSup, inf: nosInf } = cargasNosTesoura(el, ctx.parametros);
  const q = Number(el.cargas?.sobrecarga) || 0, w = Number(el.cargas?.vento) || 0;
  const qs = q * geo.cos;                      // sobrecarga por m² de telhado
  const lim = p.flecha ?? 200;
  const verificacoes = [], avisos = [], memorial = [memorialMaterial(m, p)];
  const E = m.E0m * 1000;                      // kN/m²
  const ver = (nome, valor, limite, ok, item = 'NBR 7190-1') => verificacoes.push({ nome, item, valor, limite, ok });

  if (geo.i < telha.incMin - 1e-9) avisos.push(`Inclinação de ${f(geo.i, 0)}% abaixo da mínima usual de ${f(telha.incMin, 0)}% para ${telha.texto.toLowerCase()} — confira com o fabricante.`);
  if (!telha.ripas && telha.vaoMax && geo.lp > telha.vaoMax + 1e-9) ver(`Vão da telha entre terças`, `${f(geo.lp)} m`, `≤ ${f(telha.vaoMax)} m`, false, 'Fabricante');

  // ------------------------------------------------------------------ ripas
  let ripa = null;
  if (telha.ripas) {
    const { b, h } = el.ripa, L = ps.ec;
    const gL = ps.pTelha * ps.galga + ps.ppRipa, qL = qs * ps.galga;
    const Mx = ((gg * gL + gq * qL) * geo.cos * L * L) / 8, My = ((gg * gL + gq * qL) * geo.sin * L * L) / 8;
    const fo = flexaoObliquaMadeira({ Mx, My, b, h, m });
    const I = (b * h ** 3) / 12 * 1e-8;
    const u = ((5 * (gL + psi2 * qL) * geo.cos * L ** 4) / (384 * E * I)) * 1000 * (1 + m.phi);
    const ulim = (L * 1000) / lim;
    ver('Ripas — flexão oblíqua', f(fo.uso, 3), '≤ 1', fo.ok);
    ver('Ripas — flecha final', `${f(u, 1)} mm`, `L/${lim} = ${f(ulim, 1)} mm`, u <= ulim, 'ELS');
    ripa = { b, h, L, gL, qL, Mx, My, uso: fo.uso, u, ulim };
    memorial.push({ titulo: 'Ripas', linhas: [
      `Ripa ${f(b, 1)} × ${f(h, 1)} cm a cada ${f(ps.galga)} m (galga), vão entre caibros ${f(L)} m, biapoiada`,
      `g = telha ${f(ps.pTelha)} kN/m² × ${f(ps.galga)} m + peso próprio ${f(ps.ppRipa, 3)} = ${f(gL, 3)} kN/m · q = ${f(q)} × cos α × ${f(ps.galga)} = ${f(qL, 3)} kN/m`,
      `Componentes: normal à água × cos α = ${f(geo.cos, 3)} · na água × sen α = ${f(geo.sin, 3)}`,
      `Md,⊥ = ${f(Mx, 4)} kN·m · Md,∥ = ${f(My, 4)} kN·m · σ = ${f(fo.sigmaX)} e ${f(fo.sigmaY)} MPa · interação ${f(fo.uso, 3)} ≤ 1 (kM = ${f(m.kM, 1)})`,
      'A carga concentrada de 1 kN da NBR 6120 não é aplicada às ripas: as telhas a repartem entre várias ripas.',
    ] });
  }

  // ------------------------------------------------------------------ caibros
  let caibro = null;
  if (telha.ripas) {
    const { b, h } = el.caibro;
    const gL = (ps.pTelha + ps.ripasM2) * ps.ec * geo.cos + ps.ppCaibro * geo.cos, qL = qs * ps.ec * geo.cos;
    const vaos = [...(geo.beiralS > 0.05 ? [geo.beiralS] : []), ...Array(geo.np).fill(geo.lp)];
    const apoios = [...(geo.beiralS > 0.05 ? ['livre'] : []), ...Array(geo.np + 1).fill('apoio')];
    const EI = E * (b * h ** 3) / 12 * 1e-8;
    const rG = analisarViga({ vaos, apoios, EI: vaos.map(() => EI), q: vaos.map(() => gL), P: [] });
    const rQ = analisarViga({ vaos, apoios, EI: vaos.map(() => EI), q: vaos.map(() => qL), P: [] });
    const Mabs = (r) => Math.max(...r.pontos.map((pt) => Math.abs(pt.M)));
    const Vabs = (r) => Math.max(...r.pontos.map((pt) => Math.abs(pt.V)));
    const Md = gg * Mabs(rG) + gq * Mabs(rQ), Vd = gg * Vabs(rG) + gq * Vabs(rQ);
    const fl = flexaoMadeira({ Md, b, h, m }), ci = cisalhamentoMadeira({ Vd, b, h, m });
    // carga concentrada de 1 kN no meio do vão (NBR 6120), não cumulativa com a sobrecarga: duração curta
    const MdP = gg * Mabs(rG) + gq * 1.0 * geo.cos * geo.lp / 4;
    const flP = flexaoMadeira({ Md: MdP, b, h, m: mCurta });
    ver('Caibros — flexão', `${f(fl.sigma)} MPa`, `${f(m.fmd)} MPa`, fl.ok);
    ver('Caibros — cisalhamento', `${f(ci.tau)} MPa`, `${f(m.fvd)} MPa`, ci.ok);
    ver('Caibros — carga concentrada de 1 kN', `${f(flP.sigma)} MPa`, `${f(mCurta.fmd)} MPa (curta)`, flP.ok, 'NBR 6120');
    const fls = vaos.map((L, k) => {
      const bal = apoios[k] === 'livre' || apoios[k + 1] === 'livre';
      const u = flechaFinal({ uG: Math.abs(rG.vaos[k].flecha) * 1000, uQ: Math.abs(rQ.vaos[k].flecha) * 1000, psi2, phi: m.phi });
      return { L, u, ulim: ((bal ? 2 : 1) * L * 1000) / lim, bal };
    });
    const pior = fls.reduce((a, x) => (x.u / x.ulim > a.u / a.ulim ? x : a), fls[0]);
    ver(`Caibros — flecha final${pior.bal ? ' (beiral)' : ''}`, `${f(pior.u, 1)} mm`, `${pior.bal ? '2L' : 'L'}/${lim} = ${f(pior.ulim, 1)} mm`, pior.u <= pior.ulim, 'ELS');
    caibro = { b, h, gL, qL, vaos, Md, Vd, MdP, uso: Math.max(fl.uso, ci.uso, flP.uso), u: pior.u, ulim: pior.ulim, n: Math.floor((geo.C + 2 * geo.beiralOitao) / ps.ec + 1e-9) + 1 };
    memorial.push({ titulo: 'Caibros', linhas: [
      `Caibro ${f(b, 1)} × ${f(h, 1)} cm a cada ${f(ps.ec)} m, contínuo sobre ${geo.np + 1} terças por água (vão ${f(geo.lp)} m na água)${geo.beiralS > 0.05 ? ` e beiral de ${f(geo.beiralS)} m em balanço` : ''}`,
      `g⊥ = (telha + ripas) × ${f(ps.ec)} m × cos α + peso próprio × cos α = ${f(gL, 3)} kN/m · q⊥ = ${f(qL, 3)} kN/m (a componente na água vai ao frechal)`,
      `Md = ${f(Md, 3)} kN·m · σ = ${f(fl.sigma)} MPa ≤ ${f(m.fmd)} · Vd = ${f(Vd, 3)} kN · τ = ${f(ci.tau)} MPa ≤ ${f(m.fvd)}`,
      `Concentrada de 1 kN no meio do vão: Md = ${f(MdP, 3)} kN·m · σ = ${f(flP.sigma)} MPa ≤ fm,d = ${f(mCurta.fmd)} MPa (kmod de duração curta)`,
      `Borda comprimida travada pelas ripas: estabilidade lateral dispensada.`,
    ] });
  }

  // ------------------------------------------------------------------ terças
  const { b: bt, h: ht } = el.terca;
  const L = geo.et;
  const gL = (telha.ripas ? ps.g : ps.pTelha) * geo.lp + ppTerca, qL = q * geo.lp * geo.cos;
  const MdT = ((gg * gL + gq * qL) * L * L) / 8, VdT = ((gg * gL + gq * qL) * L) / 2;
  const flT = flexaoMadeira({ Md: MdT, b: bt, h: ht, m }), ciT = cisalhamentoMadeira({ Vd: VdT, b: bt, h: ht, m });
  const MdTP = (gg * gL * L * L) / 8 + (gq * 1.0 * L) / 4;
  const flTP = flexaoMadeira({ Md: MdTP, b: bt, h: ht, m: mCurta });
  const travada = telha.ripas;
  const est = travada ? null : estabilidadeLateral({ L1: L * 100, b: bt, h: ht, sigma: flT.sigma, m });
  ver('Terças — flexão', `${f(flT.sigma)} MPa`, `${f(m.fmd)} MPa`, flT.ok);
  ver('Terças — cisalhamento', `${f(ciT.tau)} MPa`, `${f(m.fvd)} MPa`, ciT.ok);
  ver('Terças — carga concentrada de 1 kN', `${f(flTP.sigma)} MPa`, `${f(mCurta.fmd)} MPa (curta)`, flTP.ok, 'NBR 6120');
  if (est) ver('Terças — estabilidade lateral', est.dispensada ? f(est.esbeltez, 1) : `${f(flT.sigma)} MPa`, est.dispensada ? `≤ ${f(est.limite, 1)} (dispensa)` : `${f(est.sigmaLim)} MPa`, est.ok);
  let vento = null;
  if (w > 0) {
    const wL = w * geo.lp;
    const Mx = ((ggFav * gL - gq * wL * geo.cos) * L * L) / 8, My = (gq * wL * geo.sin * L * L) / 8;
    const fo = flexaoObliquaMadeira({ Mx, My, b: bt, h: ht, m: mInst });
    ver('Terças — sucção do vento (flexão oblíqua)', f(fo.uso, 3), '≤ 1', fo.ok);
    vento = { wL, Mx, My, uso: fo.uso, inverte: Mx < 0 };
    if (Mx < 0) avisos.push('A sucção do vento inverte a flexão das terças: a borda inferior fica comprimida — prever travamento (mãos-francesas ou tirantes) se a terça for alta e esbelta.');
  }
  const EIt = E * (bt * ht ** 3) / 12 * 1e-8;
  const uT = flechaFinal({ uG: (5 * gL * L ** 4) / (384 * EIt) * 1000, uQ: (5 * qL * L ** 4) / (384 * EIt) * 1000, psi2, phi: m.phi });
  const ulimT = (L * 1000) / lim;
  ver('Terças — flecha final', `${f(uT, 1)} mm`, `L/${lim} = ${f(ulimT, 1)} mm`, uT <= ulimT, 'ELS');
  const terca = { b: bt, h: ht, L, gL, qL, Md: MdT, Vd: VdT, MdP: MdTP, uso: Math.max(flT.uso, ciT.uso, flTP.uso, vento?.uso ?? 0), u: uT, ulim: ulimT, vento };
  memorial.push({ titulo: 'Terças (frechal, intermediárias e cumeeira)', linhas: [
    `Terça ${f(bt, 1)} × ${f(ht, 1)} cm em pé (seção vertical), biapoiada entre ${geo.oitoes ? 'tesouras e oitões' : 'tesouras'} com vão ${f(L)} m (emendas sobre os apoios)`,
    `Faixa de influência ${f(geo.lp)} m na água (as terças intermediárias e a cumeeira, que recebe meia faixa de cada água)`,
    `g = ${f(telha.ripas ? ps.g : ps.pTelha)} kN/m² × ${f(geo.lp)} m + peso próprio ${f(ppTerca, 3)} = ${f(gL, 3)} kN/m · q = ${f(q)} kN/m² × ${f(geo.lp)} × cos α = ${f(qL, 3)} kN/m`,
    `Md = (γg·g + γq·q)·L²/8 = ${f(MdT, 3)} kN·m · σ = ${f(flT.sigma)} MPa ≤ ${f(m.fmd)} · τ = ${f(ciT.tau)} MPa ≤ ${f(m.fvd)}`,
    `Concentrada de 1 kN no meio do vão (NBR 6120): Md = ${f(MdTP, 3)} kN·m · σ = ${f(flTP.sigma)} MPa ≤ ${f(mCurta.fmd)} MPa`,
    vento ? `Sucção ${f(w)} kN/m² × ${f(geo.lp)} m = ${f(vento.wL, 3)} kN/m normal à água: Mx = (γg,fav·g − γq·w·cos α)·L²/8 = ${f(vento.Mx, 3)} · My = γq·w·sen α·L²/8 = ${f(vento.My, 3)} kN·m · interação ${f(vento.uso, 3)} (kmod instantâneo)` : 'Sem sucção de vento informada.',
    travada ? 'Borda superior travada pelos caibros pregados: estabilidade lateral dispensada.' : '',
  ].filter(Boolean) });

  // ------------------------------------------------------------------ reações e quantidades
  const reac = reacoesDoTelhado(el, ctx);
  const Cb = geo.C + 2 * geo.beiralOitao;
  const area = 2 * (geo.s + geo.beiralS) * Cb;
  const nRipasAgua = telha.ripas ? Math.ceil((geo.s + geo.beiralS) / ps.galga) + 1 : 0;
  const vol = (sc, comp) => (sc.b * sc.h * comp) / 1e4;
  const quant = {
    area, telhas: Math.ceil(area * telha.porM2), tesouras: geo.tesouras.length,
    tercas: { n: geo.n + 1, comprimento: (geo.n + 1) * Cb, volume: vol(el.terca, (geo.n + 1) * Cb) },
    caibros: telha.ripas ? { n: 2 * caibro.n, comprimento: 2 * caibro.n * (geo.s + geo.beiralS), volume: vol(el.caibro, 2 * caibro.n * (geo.s + geo.beiralS)) } : null,
    ripas: telha.ripas ? { n: 2 * nRipasAgua, comprimento: 2 * nRipasAgua * Cb, volume: vol(el.ripa, 2 * nRipasAgua * Cb) } : null,
  };
  memorial.unshift({ titulo: 'Geometria e cargas', linhas: [
    `Duas águas: vão ${f(geo.L)} m, comprimento ${f(geo.C)} m, inclinação ${f(geo.i, 1)}% (α = ${f((geo.alfa * 180) / Math.PI, 1)}°), altura da cumeeira ${f(geo.H)} m`,
    `${geo.n} painéis na tesoura: terças a cada ${f(geo.lh)} m em planta (${f(geo.lp)} m na água) · ${geo.tesouras.length} tesouras a cada ${f(geo.et)} m${geo.oitoes ? ', pontas sobre oitões de alvenaria' : ''}`,
    `${telha.texto}: ${f(ps.pTelha)} kN/m² (saturada) · ripas ${f(ps.ripasM2, 3)} + caibros ${f(ps.caibrosM2, 3)} kN/m² · total sobre as terças ${f(ps.g, 3)} kN/m² de telhado`,
    `Sobrecarga ${f(q)} kN/m² em projeção horizontal (NBR 6120:2019, coberturas sem acesso) · forro ${f(Number(el.cargas?.forro) || 0)} kN/m² · sucção do vento ${f(w)} kN/m²`,
    `Combinações: ELU γg = ${f(gg)} e γq = ${f(gq)} (vento: γg,fav = ${f(ggFav)}) · ELS quase permanente ψ2 = ${f(psi2)} com fluência φ = ${f(m.phi, 1)}`,
  ] });
  memorial.push({ titulo: 'Reações nos apoios', linhas: [
    `Peso total ${f(reac.Gtot, 1)} kN (inclui ${geo.tesouras.length} tesouras de ${f(reac.pTes, 2)} kN) · sobrecarga total ${f(reac.Qtot, 1)} kN`,
    `Beirais A e B: g = ${f(reac.a.g)} kN/m · q = ${f(reac.a.q)} kN/m ao longo de ${f(geo.C)} m`,
    reac.oitao ? `Oitões: g = ${f(reac.oitao.g)} kN/m · q = ${f(reac.oitao.q)} kN/m ao longo de ${f(geo.L)} m (pontas das terças), sem o peso da alvenaria da empena` : 'Tesouras nas pontas: sem carga nas empenas.',
  ] });
  avisos.push('Cargas verticais por metro nos apoios: as reações das tesouras foram repartidas ao longo dos beirais (frechal ou cinta de amarração).');
  if (!tesouraDoTelhado(ctx.projeto, el)) avisos.push('Ainda não há tesoura ligada a este telhado: o peso das tesouras foi estimado com seções padrão. Use "Criar a tesoura do telhado".');

  return {
    ok: verificacoes.every((v) => v.ok), avisos, verificacoes, memorial,
    geo: { ...geo, alfaGraus: (geo.alfa * 180) / Math.PI }, telha: { ...telha, peso: ps.pTelha, galga: ps.galga }, pesos: ps, ppTerca,
    ripa, caibro, terca, nos: { sup: nosSup, inf: nosInf },
    reacoes: reac, quant,
    uso: Math.max(ripa?.uso ?? 0, caibro?.uso ?? 0, terca.uso),
  };
}
