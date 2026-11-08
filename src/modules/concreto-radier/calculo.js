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
 * Radier de concreto armado sob os pilares da fundação (NBR 6122:2019 · NBR 6118:2023) pelo método rígido
 * (convencional): a pressão no solo é plana (N/A ± M/W), e a placa é tratada como uma laje invertida contínua,
 * em faixas nas duas direções, apoiada nas linhas de pilares.
 *
 *   Momentos por metro (pressão líquida σd dos pilares, sem o peso próprio e as cargas do piso, que vão direto ao solo):
 *     sob as linhas de pilares (tração embaixo): σd·l²/8 com dois vãos, σd·l²/10 com três ou mais; no balanço σd·b²/2;
 *     no meio dos vãos (tração em cima): σd·l²/8 com um vão, σd·l²/11 nos demais.
 *   Punção em cada pilar (19.5.3): contornos C (τRd2) e C′ a 2d (τRd1), com a reação do solo dentro de C′ descontada.
 *
 * Modelo simplificado, adequado a radiers rígidos e malha regular; para radier flexível, pilares com cargas muito
 * diferentes ou recalques, use placa sobre base elástica (Winkler) ou elementos finitos.
 */
import { dimensionarFlexao } from '../../engine/flexao.js';
import { resistenciaConcreto, perimetro } from '../../engine/puncao.js';
import { areaBarra, fmtPhi } from '../../engine/barras.js';
import { COBRIMENTO_MM } from '../../engine/materiais.js';
import { pilaresDeFundacao } from '../concreto-sapata/calculo.js';
import { barrasPorMetro } from '../concreto-sapata-corrida/calculo.js';

const f = (v, c = 2) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');
const r2 = (v) => Math.round(v * 100) / 100 || 0;
const r1 = (v) => Math.round(v * 10) / 10 || 0;
const arred5 = (v) => Math.ceil((v - 1e-6) / 5) * 5;
const BARRA_COMERCIAL = 1200;

export const COBRIMENTO_SOLO = Object.fromEntries(Object.entries(COBRIMENTO_MM.solo).map(([k, v]) => [k, v / 10]));

export function criarRadier(projeto) {
  return {
    pilares: null,                                       // null = os pilares de fundação sem sapata nem bloco
    geometria: { modo: 'automatica', balanco: 0.5, h: 30, lx: 8, ly: 6 },
    local: { x: 0, y: 0 },                               // canto do radier (m), com a geometria informada
    cargas: { g: 1.0, q: 2.0 },                          // kN/m² sobre o radier (piso do térreo)
    profundidade: 0.5,
    solo: { tensao: 100, gama: 18 },
    cobrimento: COBRIMENTO_SOLO[projeto?.parametros?.classeAgressividade ?? 'II'] ?? 3.0,
  };
}

const OUTRAS = ['concreto.sapata', 'concreto.bloco'];

/** Pilares apoiados no radier: os escolhidos ou os pilares de fundação sem sapata nem bloco (e dentro dele, se a geometria for informada). */
export function pilaresDoRadier(el, projeto) {
  const fund = pilaresDeFundacao(projeto);
  let lista;
  if (Array.isArray(el.pilares) && el.pilares.length) lista = fund.filter(({ pilar }) => el.pilares.includes(pilar.id));
  else lista = fund.filter(({ pilar }) => !projeto.elementos.some((e) => OUTRAS.includes(e.modulo) && e.pilarId === pilar.id));
  if (el.geometria?.modo === 'manual') {
    const { x = 0, y = 0 } = el.local ?? {}, lx = Number(el.geometria.lx) || 0, ly = Number(el.geometria.ly) || 0;
    lista = lista.filter(({ centro: [cx, cy] }) => cx >= x - 1e-6 && cx <= x + lx + 1e-6 && cy >= y - 1e-6 && cy <= y + ly + 1e-6);
  }
  return lista;
}

/** Contorno do radier em planta (m): automático pelos pilares + balanço, ou informado. */
export function contornoRadier(el, projeto, lista = pilaresDoRadier(el, projeto)) {
  const g = el.geometria ?? {};
  if (g.modo === 'manual' || !lista.length) return { x: el.local?.x ?? 0, y: el.local?.y ?? 0, lx: Number(g.lx) || 1, ly: Number(g.ly) || 1 };
  const bal = Number(g.balanco ?? 0.5);
  const xs = lista.map((p) => p.centro[0]), ys = lista.map((p) => p.centro[1]);
  const meia = (p, k) => (k === 0 ? p.pilar.bx : p.pilar.by) / 200;
  const x0 = Math.min(...lista.map((p) => p.centro[0] - meia(p, 0))) - bal, x1 = Math.max(...lista.map((p) => p.centro[0] + meia(p, 0))) + bal;
  const y0 = Math.min(...lista.map((p) => p.centro[1] - meia(p, 1))) - bal, y1 = Math.max(...lista.map((p) => p.centro[1] + meia(p, 1))) + bal;
  void xs; void ys;
  const lx = arred5((x1 - x0) * 100) / 100, ly = arred5((y1 - y0) * 100) / 100;
  return { x: Math.round(x0 * 100) / 100, y: Math.round(y0 * 100) / 100, lx, ly };
}

/** Linhas de pilares numa direção (posições agrupadas a 30 cm), vãos e balanços. */
function linhas(coords, inicio, fim) {
  const ord = [...coords].sort((a, b) => a - b);
  const grupos = [];
  for (const v of ord) { if (grupos.length && v - grupos.at(-1).at(-1) < 0.3) grupos.at(-1).push(v); else grupos.push([v]); }
  const eixos = grupos.map((g) => g.reduce((s, v) => s + v, 0) / g.length);
  const vaos = eixos.slice(1).map((v, i) => v - eixos[i]);
  return { eixos, vaos, balancos: [eixos[0] - inicio, fim - eixos.at(-1)] };
}

/** Momentos por metro (kN·m/m) numa direção. */
function momentosDirecao(sigD, lin, Lplaca) {
  const n = lin.vaos.length;
  const lmax = n ? Math.max(...lin.vaos) : Lplaca;
  const bmax = Math.max(0, ...lin.balancos);
  const balanco = (sigD * bmax ** 2) / 2;
  let apoio, vao, regra;
  if (n === 0) { apoio = 0; vao = (sigD * Lplaca ** 2) / 8; regra = 'uma linha de pilares: a placa trabalha como um balanço duplo e, no meio, σd·L²/8'; }
  else if (n === 1) { apoio = 0; vao = (sigD * lmax ** 2) / 8; regra = 'um vão: σd·l²/8 no meio (tração em cima)'; }
  else { apoio = (sigD * lmax ** 2) / (n === 2 ? 8 : 10); vao = (sigD * lmax ** 2) / 11; regra = `${n} vãos: σd·l²/${n === 2 ? 8 : 10} sob os pilares (tração embaixo) e σd·l²/11 nos vãos (tração em cima)`; }
  return { lmax, bmax, inferior: Math.max(apoio, balanco), superior: vao, apoio, balanco, vao, regra };
}

export function calcularRadier(el, ctx) {
  const { concreto: c, aco: s, gg, gq, gama } = ctx.materiais;
  const avisos = [], verificacoes = [], memorial = [];
  const lista = pilaresDoRadier(el, ctx.projeto);
  if (!lista.length) throw new Error('Nenhum pilar de fundação sobre o radier: os pilares que chegam à fundação já têm sapata ou bloco, ou estão fora do contorno.');
  const geo = contornoRadier(el, ctx.projeto, lista);
  const { lx, ly } = geo;
  const A = lx * ly;
  const sigAdm = Number(el.solo?.tensao) || 0;
  if (!(sigAdm > 0)) throw new Error('Informe a tensão admissível do solo.');
  const cob = Number(el.cobrimento) || 3;
  const gPiso = Number(el.cargas?.g) || 0, qPiso = Number(el.cargas?.q) || 0;

  const pil = lista.map(({ pilar, centro }) => {
    const { g, q } = ctx.cargasDe(pilar.id, 'base');
    return { id: pilar.id, codigo: pilar.codigo, bx: pilar.bx ?? 20, by: pilar.by ?? 20, u: centro[0] - geo.x, v: centro[1] - geo.y, g, q, Nk: g + q, Nd: gg * g + gq * q };
  });
  const G = pil.reduce((t, p) => t + p.g, 0), Q = pil.reduce((t, p) => t + p.q, 0);
  const Nd = pil.reduce((t, p) => t + p.Nd, 0);
  const linX = linhas(pil.map((p) => p.u), 0, lx), linY = linhas(pil.map((p) => p.v), 0, ly);

  // ---------------------------------------------------------------- espessura: punção e flexão
  const tauRd2 = 0.27 * (1 - c.fck / 250) * c.fcd;
  const avaliar = (h) => {
    const d = h - cob - 1.5;
    const sigD = Nd / A;                                   // kPa: pressão líquida de cálculo dos pilares
    const mx = momentosDirecao(sigD, linX, lx), my = momentosDirecao(sigD, linY, ly);
    const flex = (M) => dimensionarFlexao({ Md: M, b: 100, h, d, c, s });
    const fx = { inf: flex(mx.inferior), sup: flex(mx.superior) }, fy = { inf: flex(my.inferior), sup: flex(my.superior) };
    const okFlex = [fx.inf, fx.sup, fy.inf, fy.sup].every((r) => r.ok && !r.dupla);
    const rho = Math.sqrt((Math.max(fx.inf.As, 1e-9) / (100 * d)) * (Math.max(fy.inf.As, 1e-9) / (100 * d)));
    const pun = pil.map((p) => {
      const borda = Math.min(p.u, lx - p.u, p.v, ly - p.v) < 2 * d / 100 + Math.max(p.bx, p.by) / 200;
      const per = perimetro({ c1: p.bx, c2: p.by, d, r: 2 * d });
      const areaC1 = (p.bx * p.by + 2 * 2 * d * (p.bx + p.by) + Math.PI * (2 * d) ** 2) / 1e4;
      const F = Math.max(0, p.Nd - sigD * areaC1);
      const conc = resistenciaConcreto({ d, rho, fck: c.fck });
      const tau1 = (F / (per.u * d)) * 10;
      const tau0 = (p.Nd / (2 * (p.bx + p.by) * d)) * 10;
      return { codigo: p.codigo, u: per.u, F, tau1, tauRd1: conc.tauRd1, tau0, ok: tau1 <= conc.tauRd1 + 1e-9 && tau0 <= tauRd2 + 1e-9, borda };
    });
    return { h, d, sigD, mx, my, fx, fy, pun, ok: okFlex && pun.every((p) => p.ok) };
  };
  let av;
  if (el.geometria?.modo === 'manual') av = avaliar(Number(el.geometria.h) || 30);
  else {
    for (let h = 20; h <= 150; h += 5) { av = avaliar(h); if (av.ok) break; }
  }
  const { h, d, sigD, mx, my, fx, fy, pun } = av;

  // ---------------------------------------------------------------- geotecnia
  const pp = (h / 100) * gama * A;
  const N = G + Q + pp + (gPiso + qPiso) * A;
  const xr = (pil.reduce((t, p) => t + p.Nk * p.u, 0) + (pp + (gPiso + qPiso) * A) * (lx / 2)) / N;
  const yr = (pil.reduce((t, p) => t + p.Nk * p.v, 0) + (pp + (gPiso + qPiso) * A) * (ly / 2)) / N;
  const ex = xr - lx / 2, ey = yr - ly / 2;
  const sMed = N / A;
  const dsx = (6 * N * Math.abs(ex)) / (A * lx), dsy = (6 * N * Math.abs(ey)) / (A * ly);
  const sMax = sMed + dsx + dsy, sMin = sMed - dsx - dsy;
  verificacoes.push(
    { nome: 'Tensão média no solo', item: 'NBR 6122', valor: `${f(sMed, 0)} kPa`, limite: `≤ σadm = ${f(sigAdm, 0)} kPa`, ok: sMed <= sigAdm + 1e-6 },
    { nome: 'Tensão máxima no solo', item: 'NBR 6122', valor: `${f(sMax, 0)} kPa`, limite: `≤ 1,3·σadm = ${f(1.3 * sigAdm, 0)} kPa`, ok: sMax <= 1.3 * sigAdm + 1e-6 },
    { nome: 'Placa inteiramente comprimida', item: 'NBR 6122', valor: `σmín = ${f(sMin, 0)} kPa`, limite: '≥ 0', ok: sMin >= -1e-6 },
  );

  // ---------------------------------------------------------------- armaduras
  const malha = (r) => barrasPorMetro(r.As, [10, 12.5, 16, 20, 25]);
  const mal = { inferior: { x: malha(fx.inf), y: malha(fy.inf) }, superior: { x: malha(fx.sup), y: malha(fy.sup) } };
  for (const [face, k, r, m, rot] of [['inferior', 'x', fx.inf, mx, 'sob os pilares'], ['inferior', 'y', fy.inf, my, 'sob os pilares'], ['superior', 'x', fx.sup, mx, 'nos vãos'], ['superior', 'y', fy.sup, my, 'nos vãos']]) {
    const b = mal[face][k];
    verificacoes.push({ nome: `Flexão ${face} em ${k} (${rot})`, item: '17.2 · 19.3', valor: b ? `${b.rotulo} = ${f(b.AsEf)} cm²/m` : '—', limite: `As ≥ ${f(r.As)} cm²/m (M = ${f(face === 'inferior' ? m.inferior : m.superior)} kN·m/m)`, ok: r.ok && !!b });
  }
  for (const p of pun) {
    verificacoes.push({ nome: `Punção em ${p.codigo} (C′ a 2d)`, item: '19.5.3.2', valor: `τSd = ${f(p.tau1)} MPa`, limite: `≤ τRd1 = ${f(p.tauRd1)} MPa`, ok: p.tau1 <= p.tauRd1 + 1e-9 });
    if (p.borda) avisos.push(`${p.codigo} perto da borda do radier: a punção foi verificada com o contorno de pilar interno — confira com o contorno de borda (19.5.2.4) ou aumente o balanço.`);
  }
  verificacoes.push({ nome: 'Compressão diagonal no contorno C (pior pilar)', item: '19.5.3.1', valor: `τSd = ${f(Math.max(...pun.map((p) => p.tau0)))} MPa`, limite: `≤ τRd2 = ${f(tauRd2)} MPa`, ok: pun.every((p) => p.tau0 <= tauRd2 + 1e-9) });

  // ---------------------------------------------------------------- lista de ferros
  const posicoes = [];
  const perna = Math.max(10, h - 2 * cob - 2);
  for (const [face, k] of [['inferior', 'x'], ['inferior', 'y'], ['superior', 'x'], ['superior', 'y']]) {
    const b = mal[face][k];
    if (!b) continue;
    const L = (k === 'x' ? lx : ly) * 100, W = (k === 'x' ? ly : lx) * 100;
    const reto = L - 2 * cob;
    const emendas = Math.max(0, Math.ceil(reto / BARRA_COMERCIAL) - 1);
    const traspasse = Math.ceil((40 * b.phi) / 10);
    const n = Math.floor((W - 2 * cob) / b.s) + 1;
    posicoes.push({ id: `${face}-${k}`, tipo: face === 'inferior' ? 'positiva' : 'negativa', face, dir: k, local: `Malha ${face} em ${k}: ${b.rotulo}, pernas de ${f(Math.min(perna, 15 * b.phi / 10), 0)} cm nas bordas${emendas ? `, ${emendas} emenda(s) de ${traspasse} cm (alternadas)` : ''}`, phi: b.phi, n, s: b.s, comprimento: arred5(reto + 2 * Math.min(perna, (15 * b.phi) / 10) + emendas * traspasse), reto, ganchos: 2, emendas });
  }
  {
    const s = 20, phi = 8, perim = 2 * (lx + ly) * 100;
    const n = Math.ceil(perim / s);
    posicoes.push({ id: 'grampo', tipo: 'construtiva', face: 'lateral', local: `Grampos em U nas bordas ø ${fmtPhi(phi)} c/ ${s} (prática usual: amarram as malhas e protegem a borda)`, phi, n, s, comprimento: arred5(2 * 30 + (h - 2 * cob)), reto: h - 2 * cob, ganchos: 0, emendas: 0 });
  }
  posicoes.forEach((p, i) => { p.N = `N${i + 1}`; });

  memorial.push(
    { titulo: 'Pilares e cargas', linhas: [
      `${pil.length} pilar(es): ${pil.map((p) => `${p.codigo} ${f(p.Nk, 0)} kN`).join(' · ')}.`,
      `Contorno ${el.geometria?.modo === 'manual' ? 'informado' : `automático (pilares + balanço de ${f(el.geometria?.balanco ?? 0.5)} m)`}: ${f(lx)} × ${f(ly)} m, A = ${f(A)} m², canto em (${f(geo.x)}; ${f(geo.y)}).`,
      `Piso sobre o radier: g = ${f(gPiso)} kN/m², q = ${f(qPiso)} kN/m²; peso próprio ${f(h, 0)} cm × ${f(gama, 0)} = ${f(pp)} kN.`,
    ] },
    { titulo: 'Pressão no solo (método rígido)', linhas: [
      `N = ${f(N, 1)} kN, resultante em (${f(xr)}; ${f(yr)}) m → ex = ${f(ex, 3)} m, ey = ${f(ey, 3)} m.`,
      `σ = N/A ± 6·N·e/(A·L): média ${f(sMed, 0)}, máxima ${f(sMax, 0)}, mínima ${f(sMin, 0)} kPa (σadm = ${f(sigAdm, 0)} kPa).`,
    ] },
    { titulo: 'Flexão em faixas (laje invertida)', linhas: [
      `Pressão líquida de cálculo dos pilares: σd = ΣNd/A = ${f(Nd, 1)}/${f(A)} = ${f(sigD, 1)} kPa (o peso próprio e o piso vão direto ao solo).`,
      `Direção x: linhas de pilares em ${linX.eixos.map((v) => f(v)).join(', ')} m; ${mx.regra}; balanço ${f(mx.bmax)} m → σd·b²/2 = ${f(mx.balanco)} kN·m/m. Inferior ${f(mx.inferior)}, superior ${f(mx.superior)} kN·m/m.`,
      `Direção y: linhas em ${linY.eixos.map((v) => f(v)).join(', ')} m; ${my.regra}; balanço ${f(my.bmax)} m → ${f(my.balanco)} kN·m/m. Inferior ${f(my.inferior)}, superior ${f(my.superior)} kN·m/m.`,
      `h = ${f(h, 0)} cm${el.geometria?.modo === 'manual' ? ' (informada)' : ' (a menor, em múltiplos de 5 cm, que atende à punção e à flexão sem armadura dupla)'}; d = ${f(d, 1)} cm.`,
    ] },
    { titulo: 'Punção nos pilares', linhas: pun.map((p) => `${p.codigo}: C′ u = ${f(p.u, 0)} cm, FSd = ${f(p.F, 1)} kN (descontada a reação dentro de C′), τSd = ${f(p.tau1)} MPa ≤ τRd1 = ${f(p.tauRd1)} MPa? · contorno C: τSd = ${f(p.tau0)} ≤ ${f(tauRd2)} MPa?`) },
    { titulo: 'Limites do modelo', linhas: ['Método rígido: pressão plana e faixas com coeficientes de viga contínua. Não calcula recalques nem a interação solo-estrutura; para radier flexível ou cargas muito desiguais, use placa sobre base elástica.'] },
  );

  return {
    ok: verificacoes.every((v) => v.ok), avisos, verificacoes, memorial,
    lx, ly, local: { x: geo.x, y: geo.y }, h, d: r2(d), cobrimento: cob, profundidade: Number(el.profundidade) || 0,
    sigmaAdm: r1(sigAdm), tensoes: { med: r1(sMed), max: r1(sMax), min: r1(sMin), ex: r2(ex * 100), ey: r2(ey * 100) },
    N: r1(N), Nd: r1(Nd), pp: r1(pp), sigD: r1(sigD), volume: Math.round(A * (h / 100) * 1000) / 1000,
    pilares: pil.map((p) => ({ id: p.id, codigo: p.codigo, u: r2(p.u), v: r2(p.v), bx: p.bx, by: p.by, Nk: r1(p.Nk), Nd: r1(p.Nd) })),
    linhas: { x: linX.eixos.map(r2), y: linY.eixos.map(r2) },
    momentos: { x: { inferior: r2(mx.inferior), superior: r2(mx.superior), lmax: r2(mx.lmax), bmax: r2(mx.bmax) }, y: { inferior: r2(my.inferior), superior: r2(my.superior), lmax: r2(my.lmax), bmax: r2(my.bmax) } },
    malhas: mal,
    puncao: pun.map((p) => ({ codigo: p.codigo, tauSd: r2(p.tau1), tauRd1: r2(p.tauRd1), ok: p.ok, borda: p.borda })),
    detalhamento: { posicoes, avisos: [], verificacoes: [] },
  };
}
