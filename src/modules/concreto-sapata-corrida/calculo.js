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
 * Sapata corrida de concreto armado sob parede ou viga (NBR 6122:2019 · NBR 6118:2023, 22.6), por metro de
 * comprimento.
 *
 * Geotecnia (característico): carga linear + peso próprio + solo sobre as abas ≤ σadm · B.
 * Estrutura (cálculo): flexão transversal pelo CEB-70 na seção S1 (a 0,15·bw da face), compressão diagonal junto à
 * face da parede e, na sapata flexível, cortante como laje (19.4.1); armadura longitudinal de distribuição
 * ≥ 0,2·As principal e ≥ 0,9 cm²/m (20.1, como nas lajes armadas numa direção).
 */
import { pernaGancho90 } from '../../engine/detalhamento.js';
import { dimensionarFlexao } from '../../engine/flexao.js';
import { verificarCortanteLaje } from '../../engine/cisalhamento.js';
import { areaBarra, fmtPhi } from '../../engine/barras.js';
import { momentoS1, DIMENSAO_MINIMA } from '../../engine/sapata.js';
import { COBRIMENTO_MM } from '../../engine/materiais.js';

const f = (v, c = 2) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');
const r2 = (v) => Math.round(v * 100) / 100 || 0;
const r1 = (v) => Math.round(v * 10) / 10 || 0;
const arred5 = (v) => Math.ceil((v - 1e-6) / 5) * 5;
const BARRA_COMERCIAL = 1200; // cm

export const COBRIMENTO_SOLO = Object.fromEntries(Object.entries(COBRIMENTO_MM.solo).map(([k, v]) => [k, v / 10]));

export function criarSapataCorrida(projeto) {
  return {
    vigaId: null,                          // viga (ou baldrame) apoiada: a carga por metro vem das reações dela
    comprimento: 5,                        // m — sem viga ligada
    bw: 20,                                // cm — largura da parede ou viga apoiada (sem viga ligada)
    cargas: { g: 40, q: 10 },              // kN/m — sem viga ligada
    local: { x: 0, y: 0, angulo: 0 },      // m e graus — início do eixo, sem viga ligada
    profundidade: 1.0,                     // m — base abaixo do terreno (cota 0 do projeto)
    solo: { tensao: 150, gama: 18 },       // kPa, kN/m³
    geometria: { modo: 'automatica', B: 80, h: 30, h0: 20 },
    cobrimento: COBRIMENTO_SOLO[projeto?.parametros?.classeAgressividade ?? 'II'] ?? 3.0,
  };
}

/** Eixo da sapata em planta (m): a viga ligada ou o eixo informado. */
export function eixoSapataCorrida(el, projeto) {
  const v = el.vigaId ? projeto.elementos.find((e) => e.id === el.vigaId) : null;
  if (v?.posicao) {
    const L = (v.vaos ?? []).reduce((s, x) => s + (Number(x.L) || 0), 0);
    return { x: v.posicao.x, y: v.posicao.y, angulo: v.posicao.angulo ?? 0, L, pavimento: v.posicao.pavimento };
  }
  return { x: el.local?.x ?? 0, y: el.local?.y ?? 0, angulo: el.local?.angulo ?? 0, L: Number(el.comprimento) || 0, pavimento: null };
}

/** Carga característica por metro: da viga ligada (soma das reações ÷ comprimento) ou informada. */
function cargaLinear(el, ctx) {
  if (!el.vigaId) return { g: Number(el.cargas?.g) || 0, q: Number(el.cargas?.q) || 0, bw: Number(el.bw) || 20, L: Number(el.comprimento) || 0, viga: null };
  const v = ctx.elemento(el.vigaId);
  if (!v) throw new Error('A viga ligada a esta sapata corrida não existe mais.');
  if (v.modulo !== 'concreto.viga') throw new Error(`${v.codigo} não é uma viga de concreto.`);
  const r = v.resultado;
  if (!r || r.erro || !Array.isArray(r.apoios)) throw new Error(`Calcule a viga ${v.codigo} antes da sapata corrida (a carga vem das reações dela).`);
  const L = (v.vaos ?? []).reduce((s, x) => s + (Number(x.L) || 0), 0);
  if (!(L > 0)) throw new Error(`${v.codigo} sem vãos.`);
  const Rg = r.apoios.reduce((s, a) => s + (a.Rg ?? 0), 0), Rq = r.apoios.reduce((s, a) => s + (a.Rq ?? 0), 0);
  return { g: Rg / L, q: Rq / L, bw: v.secao?.b ?? 20, L, viga: v };
}

/** Bitola e espaçamento para As (cm²/m): espaçamento entre 10 e 20 cm. */
export function barrasPorMetro(As, bitolas = [8, 10, 12.5, 16, 20]) {
  for (const phi of bitolas) {
    const a = areaBarra(phi);
    const s = Math.min(20, Math.floor(((a * 100) / Math.max(As, 1e-9)) * 2) / 2);
    if (s >= 10) return { phi, s, AsEf: (a * 100) / s, rotulo: `ø ${fmtPhi(phi)} c/ ${f(s, s % 1 ? 1 : 0)}` };
  }
  return null;
}

export function calcularSapataCorrida(el, ctx) {
  const { concreto: c, aco: s, gg, gq, gama } = ctx.materiais;
  const avisos = [], verificacoes = [], memorial = [];
  const cl = cargaLinear(el, ctx);
  const { g, q, bw } = cl;
  const L = cl.L;
  const nk = g + q;                                         // kN/m
  if (!(nk > 0)) throw new Error('A sapata corrida não recebe carga: ligue uma viga ou informe g e q (kN/m).');
  if (!(L > 0)) throw new Error('Informe o comprimento da sapata corrida.');
  const D = Number(el.profundidade) || 0;
  const gs = Number(el.solo?.gama) || 18;
  const sigAdm = Number(el.solo?.tensao) || 0;
  if (!(sigAdm > 0)) throw new Error('Informe a tensão admissível do solo.');
  const cob = Number(el.cobrimento) || 3;

  const secao = ({ B, h, h0 }) => {
    const b0 = Math.min(B, bw + 5);
    return (B * h0 + ((h - h0) * (B + b0)) / 2) / 1e4;       // m² por metro
  };
  const pesos = (geo) => {
    const area = secao(geo);
    const pp = area * gama;
    const terra = Math.max(0, (geo.B / 100) * D - area - (bw / 100) * Math.max(0, D - geo.h / 100)) * gs;
    return { area, pp, terra };
  };
  let geo;
  if (el.geometria?.modo === 'manual') {
    const g0 = el.geometria;
    geo = { B: g0.B, h: g0.h, h0: Math.min(g0.h0 ?? g0.h, g0.h) };
  } else {
    let B = Math.max(DIMENSAO_MINIMA, bw + 20);
    for (let it = 0; it < 60; it++) {
      const h = Math.max(25, arred5((B - bw) / 3));
      const h0 = Math.min(h, Math.max(20, arred5(h / 3)));
      geo = { B, h, h0 };
      const pz = pesos(geo);
      const req = Math.max(DIMENSAO_MINIMA, bw + 20, arred5(((nk + pz.pp + pz.terra) / sigAdm) * 100));
      if (req <= B) break;
      B = req;
    }
  }
  const { B, h, h0 } = geo;
  if (B < bw) throw new Error('A sapata corrida é mais estreita que a parede.');

  // ---------------------------------------------------------------- geotecnia
  const pz = pesos(geo);
  const ntot = nk + pz.pp + pz.terra;
  const sigma = ntot / (B / 100);
  verificacoes.push(
    { nome: 'Tensão no solo', item: 'NBR 6122', valor: `${f(sigma, 0)} kPa`, limite: `≤ σadm = ${f(sigAdm, 0)} kPa`, ok: sigma <= sigAdm + 1e-6 },
    { nome: 'Largura mínima', item: 'NBR 6122', valor: `B = ${f(B, 0)} cm`, limite: `≥ ${DIMENSAO_MINIMA} cm`, ok: B >= DIMENSAO_MINIMA },
  );
  if (D < 1.5) avisos.push(`Base a ${f(D)} m do terreno: junto às divisas a NBR 6122 pede no mínimo 1,5 m — confira.`);

  // ---------------------------------------------------------------- estrutura (por metro)
  const nd = gg * g + gq * q;
  const sigD = nd / (B / 100);                               // kPa (sem o peso próprio, que vai direto ao solo)
  const cBal = (B - bw) / 2;
  const rigida = h >= (B - bw) / 3 - 1e-6;
  const d = h - cob - 1;
  const Md = momentoS1({ sigma: sigD, largura: 100, balanco: cBal, ap: bw });
  const fl = dimensionarFlexao({ Md, b: 100, h, d, c, s });
  const trans = barrasPorMetro(fl.As);
  verificacoes.push({ nome: 'Flexão transversal (por metro)', item: '22.6.4.1', valor: trans ? `${trans.rotulo} = ${f(trans.AsEf)} cm²/m` : '—', limite: `As ≥ ${f(fl.As)} cm²/m`, ok: fl.ok && !!trans });
  // distribuição longitudinal
  const AsDist = Math.max(0.2 * (trans?.AsEf ?? fl.As), 0.9);   // cm²/m de largura
  const totalDist = (AsDist * B) / 100;
  const phiD = totalDist > 6 * areaBarra(8) ? 10 : 8;
  const nDist = Math.max(4, Math.ceil(totalDist / areaBarra(phiD) - 1e-9), Math.ceil((B - 2 * cob) / 33) + 1);
  const dist = { phi: phiD, n: nDist, AsEf: nDist * areaBarra(phiD), rotulo: `${nDist} ø ${fmtPhi(phiD)}` };
  verificacoes.push({ nome: 'Armadura de distribuição (longitudinal)', item: '20.1', valor: `${dist.rotulo} = ${f(dist.AsEf)} cm²`, limite: `≥ máx(0,2·As; 0,9 cm²/m)·B = ${f(totalDist)} cm²`, ok: dist.AsEf >= totalDist - 1e-9 });
  // compressão diagonal junto à face da parede (por metro, as duas faces)
  const FC = nd - sigD * (bw / 100);
  const tauC = (FC / (2 * 100 * d)) * 10;
  const tauRd2 = 0.27 * (1 - c.fck / 250) * c.fcd;
  verificacoes.push({ nome: 'Compressão diagonal junto à parede', item: '19.5.3.1', valor: `τSd = ${f(tauC)} MPa`, limite: `≤ τRd2 = ${f(tauRd2)} MPa`, ok: tauC <= tauRd2 + 1e-9 });
  let cortante = null;
  if (rigida) verificacoes.push({ nome: 'Cortante', item: '22.6.2.2', valor: 'sapata rígida', limite: 'dispensada', ok: true });
  else {
    const Vd = sigD * Math.max(0, cBal - d) / 100;
    cortante = verificarCortanteLaje({ Vd, d, As1: trans?.AsEf ?? fl.As, c, bw: 100 });
    verificacoes.push({ nome: 'Cortante sem armadura transversal (por metro)', item: '19.4.1', valor: `VSd = ${f(cortante.Vd, 1)} kN/m`, limite: `≤ VRd1 = ${f(cortante.VRd1, 1)} kN/m`, ok: cortante.ok });
  }
  if (h0 < Math.max(20, h / 3) - 1e-6) avisos.push(`Altura da borda h0 = ${f(h0, 0)} cm abaixo do usual (≥ h/3 e ≥ 20 cm).`);
  if (trans?.phi && h0 - 2 * cob - trans.phi / 10 < pernaGancho90(trans.phi) - 1e-6) avisos.push(`Gancho a 90° das barras transversais ø ${trans.phi}: a borda de ${f(h0, 0)} cm não comporta o pino da Tabela 9.1 mais 8ø (${f(pernaGancho90(trans.phi), 1)} cm, 9.4.2.3) — use gancho a 135° ou 180°, ou aumente h0.`);

  // ---------------------------------------------------------------- lista de ferros
  const posicoes = [];
  if (trans) {
    const gancho = 10 * trans.phi / 10;
    const n = Math.floor((L * 100 - 2 * cob) / trans.s) + 1;
    posicoes.push({ id: 'transversal', tipo: 'positiva', face: 'inferior', local: `Barras transversais ${trans.rotulo}, de face a face, gancho a 90° nas duas pontas`, phi: trans.phi, n, s: trans.s, comprimento: arred5(B - 2 * cob + 2 * gancho), reto: B - 2 * cob, ganchos: 2, emendas: 0 });
  }
  {
    const reto = L * 100 - 2 * cob;
    const emendas = Math.max(0, Math.ceil(reto / BARRA_COMERCIAL) - 1);
    const traspasse = Math.ceil((50 * dist.phi) / 10);        // ≈ 50ø (prática, distribuição)
    posicoes.push({ id: 'longitudinal', tipo: 'distribuição', face: 'inferior', local: `Distribuição longitudinal ${dist.rotulo}, sobre as transversais${emendas ? `, ${emendas} emenda(s) por traspasse de ${traspasse} cm` : ''}`, phi: dist.phi, n: dist.n, comprimento: arred5(reto + emendas * traspasse), reto, ganchos: 0, emendas });
  }
  posicoes.forEach((p, i) => { p.N = `N${i + 1}`; });

  memorial.push(
    { titulo: 'Carga por metro', linhas: [
      cl.viga ? `Viga ${cl.viga.codigo} (bw = ${f(bw, 0)} cm, ${f(L)} m): soma das reações características Rg = ${f(g * L, 1)} kN e Rq = ${f(q * L, 1)} kN → g = ${f(g)} kN/m, q = ${f(q)} kN/m.` : `Carga informada: g = ${f(g)} kN/m, q = ${f(q)} kN/m sobre parede de ${f(bw, 0)} cm, em ${f(L)} m.`,
      `Peso próprio: ${f(pz.area, 4)} m² × ${f(gama, 0)} kN/m³ = ${f(pz.pp)} kN/m; solo sobre as abas (γ = ${f(gs, 0)} kN/m³): ${f(pz.terra)} kN/m.`,
    ] },
    { titulo: 'Largura e tensão', linhas: [
      `${el.geometria?.modo === 'manual' ? 'Informada' : 'Automática'}: B = ${f(B, 0)} cm (múltiplo de 5, ≥ ${DIMENSAO_MINIMA} cm), h = ${f(h, 0)} cm, h0 = ${f(h0, 0)} cm; base a ${f(D)} m.`,
      `σ = (n + pp + solo)/B = ${f(ntot)}/${f(B / 100)} = ${f(sigma, 0)} kPa ≤ ${f(sigAdm, 0)} kPa?`,
      `Rigidez: (B − bw)/3 = ${f((B - bw) / 3, 1)} cm ${rigida ? '≤' : '>'} h → sapata ${rigida ? 'rígida' : 'flexível'}.`,
    ] },
    { titulo: 'Flexão transversal (CEB-70)', linhas: [
      `nd = ${f(gg, 1)}·g + ${f(gq, 1)}·q = ${f(nd)} kN/m; σd = nd/B = ${f(sigD, 0)} kPa; balanço c = (B − bw)/2 = ${f(cBal, 1)} cm; d = ${f(d, 1)} cm.`,
      `M1 = σd·(c + 0,15·bw)²/2 = ${f(Md)} kN·m/m → As = ${f(fl.As)} cm²/m (mín. ${f(fl.AsMin)}) → ${trans?.rotulo ?? '—'}.`,
      `Distribuição: máx(0,2·As; 0,9 cm²/m) × B = ${f(totalDist)} cm² → ${dist.rotulo} (espaçamento ≤ 33 cm).`,
    ] },
  );

  return {
    ok: verificacoes.every((v) => v.ok), avisos, verificacoes, memorial,
    viga: cl.viga ? { id: cl.viga.id, codigo: cl.viga.codigo } : null,
    nk: { g: r2(g), q: r2(q) }, nd: r2(nd), bw, L: r2(L), B, h, h0, rigida, profundidade: D, cobrimento: cob, d: r2(d),
    sigmaAdm: r1(sigAdm), sigma: r1(sigma), pp: r2(pz.pp), terra: r2(pz.terra), area: Math.round(pz.area * 1e4) / 1e4, volume: Math.round(pz.area * L * 1000) / 1000,
    flexao: { Md: r2(Md), As: r2(fl.As), AsMin: r2(fl.AsMin), barras: trans }, distribuicao: dist,
    cortante: cortante && { Vd: r2(cortante.Vd), VRd1: r2(cortante.VRd1) },
    detalhamento: { posicoes, avisos: [], verificacoes: [] },
  };
}
