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
 * Laje nervurada moldada no local (cubetas ou blocos de enchimento)
 * NBR 6118:2023 — 13.2.4.2 (dimensões e critérios), 14.6.2.2 (mesa colaborante),
 * 14.7.7 (análise como laje maciça), 17.2, 19.4.1.
 *
 * Duas direções: esforços pela teoria das placas (como laje maciça equivalente),
 * multiplicados pelo intereixo para obter os esforços de cada nervura.
 * Uma direção: cada nervura é uma viga T que vence o vão lx.
 *
 * Bordas apoiadas, engastadas ou livres (balanço). Em duas direções, com borda livre,
 * as reações vêm do modelo de placa; em uma direção, x0 e x1 são as extremidades
 * das nervuras e y0 e y1 as bordas laterais (apoiada ou livre).
 */
import { torcaoDoBalancoPlaca } from '../comum/bordas.js';
import { alfaFluencia } from '../../engine/fissuracao.js';
import { analisarPlaca, placaEstavel } from '../../engine/placa.js';
import { temBordaLivre, emBalanco, fatoresDeReacaoPlaca, PARA_SOLVER, balancoFaixa, validarFaixa, avisosLaterais } from '../comum/bordas.js';
import { analisarViga } from '../../engine/viga-solver.js';
import { dimensionarFlexao } from '../../engine/flexao.js';
import { verificarCortanteLaje, dimensionarEstribos } from '../../engine/cisalhamento.js';
import { escolherBarrasLaje, bitolaFixa, motivoBarraLaje, fmtPhi } from '../../engine/barras.js';
import { FCK_MIN } from '../../engine/materiais.js';
import { propriedadesT, larguraColaborante, dimensionarFlexaoT, inerciaBransonT, escolherBarrasNervura } from '../../engine/secao-t.js';

const f = (v, c = 2) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');
const r2 = (v) => Math.round(v * 100) / 100 || 0;

export const BORDAS_N = [
  { id: 'y0', nome: 'Borda inferior' }, { id: 'x1', nome: 'Borda direita' },
  { id: 'y1', nome: 'Borda superior' }, { id: 'x0', nome: 'Borda esquerda' },
];

export const ENCHIMENTOS_N = {
  cubeta: { nome: 'Cubeta removível (vazio)', peso: 0 },
  eps: { nome: 'EPS (isopor)', peso: 0.15 },
  ceramico: { nome: 'Bloco cerâmico', peso: 6.5 },
  concreto: { nome: 'Bloco de concreto celular', peso: 5 },
};

export function criarLajeNervurada() {
  return {
    lx: 6, ly: 7, direcao: 'duas',
    bordas: { x0: 'apoiada', x1: 'apoiada', y0: 'apoiada', y1: 'apoiada' },
    h: 30, hf: 5, bw: 10, intereixo: 60,
    enchimento: 'cubeta', pesoEnchimento: 0,
    armadura: { nervura: 'auto', superior: 'auto' },
    pesoProprio: true,
    cargas: { revestimento: 1.0, acidental: 2.0, outras: 0.5 },
  };
}

/** Cargas características por m². */
export function cargasNervurada(el, ctx) {
  const e = el.intereixo / 100, bw = el.bw / 100, hr = (el.h - el.hf) / 100, hf = el.hf / 100;
  const gama = ctx.materiais.gama;
  const duas = el.direcao === 'duas';
  const capa = gama * hf;
  const nervuras = duas ? (gama * bw * hr * (2 * e - bw)) / (e * e) : (gama * bw * hr) / e;
  const ench = duas ? (el.pesoEnchimento * (e - bw) ** 2 * hr) / (e * e) : (el.pesoEnchimento * (e - bw) * hr) / e;
  const pp = el.pesoProprio ? capa + nervuras + ench : 0;
  return { pp, capa, nervuras, ench, g: pp + (el.cargas?.revestimento ?? 0) + (el.cargas?.outras ?? 0), q: el.cargas?.acidental ?? 0 };
}

/** Distância entre momentos nulos (m) a partir dos vínculos das duas bordas opostas. */
const distanciaA = (L, b0, b1) => {
  if (b0 === 'livre' || b1 === 'livre') return 2 * L; // balanço
  const eng = (b0 === 'engastada') + (b1 === 'engastada');
  return L * (eng === 2 ? 0.6 : eng === 1 ? 0.75 : 1);
};

/** Bordas em uma direção: as laterais (y) só são apoiadas ou livres. */
const bordasUmaDirecao = (b) => ({ ...b, y0: b.y0 === 'livre' ? 'livre' : 'apoiada', y1: b.y1 === 'livre' ? 'livre' : 'apoiada' });

/** Uma direção: análise da nervura que vence lx. */
function analisarUmaDirecao(el, ctx, wg, wq, EI) {
  const apoios = [PARA_SOLVER[el.bordas.x0] ?? 'apoio', PARA_SOLVER[el.bordas.x1] ?? 'apoio'];
  const base = { vaos: [el.lx], apoios, P: [], EI: [EI] };
  return { rG: analisarViga({ ...base, q: [wg] }), rQ: analisarViga({ ...base, q: [wq] }), apoios };
}

export function cargasTransmitidas(el, ctx) {
  const { g, q } = cargasNervurada(el, ctx);
  if (el.direcao !== 'duas') {
    const e = el.intereixo / 100;
    const { rG, rQ, apoios } = analisarUmaDirecao(el, ctx, g * e, q * e, 1e4);
    const out = {
      x0: { g: rG.reacoes[0].V / e, q: rQ.reacoes[0].V / e }, x1: { g: rG.reacoes[1].V / e, q: rQ.reacoes[1].V / e },
      y0: { g: 0, q: 0 }, y1: { g: 0, q: 0 },
    };
    // balanço: o momento do engaste é torção de equilíbrio na viga de apoio
    if (apoios.includes('livre')) ['x0', 'x1'].forEach((id, k) => { if (apoios[k] !== 'livre') out[id].t = { g: Math.abs(rG.reacoes[k].M) / e, q: Math.abs(rQ.reacoes[k].M) / e }; });
    return out;
  }
  const { fator } = fatoresDeReacaoPlaca({ lx: el.lx, ly: el.ly, bordas: el.bordas, nu: ctx.materiais.concreto.nu });
  const out = {};
  for (const b of BORDAS_N) out[b.id] = { g: g * fator[b.id], q: q * fator[b.id] };
  torcaoDoBalancoPlaca(out, el.bordas, el.lx, el.ly);
  return out;
}

/** Bordas que podem apoiar em vigas (as livres não transmitem carga). */
export const ligacoes = (el) => BORDAS_N.filter((b) => el?.bordas?.[b.id] !== 'livre').map((b) => ({ id: b.id, nome: b.nome, tipo: 'linear' }));

export function calcularLajeNervurada(el, ctx) {
  const { concreto: c, aco: s, gg, gq, psi2, caa, dmax } = ctx.materiais;
  const cob = ctx.parametros.cobrimento.laje;
  if (!(el.lx > 0 && el.ly > 0)) throw new Error('Os vãos da laje devem ser positivos.');
  if (el.hf >= el.h) throw new Error('A capa deve ser mais fina que a altura total.');
  const avisos = [], verificacoes = [], memorial = [];
  const e = el.intereixo / 100, ecm = el.intereixo, bw = el.bw, h = el.h, hf = el.hf;
  const duas = el.direcao === 'duas';
  if (!duas) el = { ...el, bordas: bordasUmaDirecao(el.bordas) };
  if (duas && !placaEstavel(el.bordas)) throw new Error('Laje instável: use ao menos uma borda engastada ou duas bordas apoiadas.');
  if (!duas) validarFaixa(el.bordas);
  const livre = temBordaLivre(el.bordas);
  const balanco = duas ? emBalanco(el.bordas) : balancoFaixa(el.bordas);
  let flechaBorda = null; // { l } quando a flecha máxima está numa borda livre
  const cg = cargasNervurada(el, ctx);
  const pd = gg * cg.g + gq * cg.q, pser = cg.g + psi2 * cg.q;
  const dx = h - cob - 0.5, dy = dx - 1.0, dNeg = h - cob - 0.5;
  const bfRig = ecm; // rigidez: mesa contínua inteira
  const pT = propriedadesT({ bf: bfRig, bw, hf, h });

  const armaduras = [];
  const phiNerv = bitolaFixa(el.armadura?.nervura), phiNeg = bitolaFixa(el.armadura?.superior);
  const projetarPos = (rotulo, Md, d, L, b0, b1) => {
    const bf = larguraColaborante({ bw, e: ecm, a: distanciaA(L, b0, b1) });
    // sem momento positivo (balanço): nada a dimensionar nessa direção
    if (!(Md > 0.01)) { armaduras.push({ rotulo, Md: 0, d, As: 0, AsMin: 0, barras: null, bf, ok: true, comoT: false, nula: true }); return; }
    const fl = dimensionarFlexaoT({ Md, bf, bw, hf, h, d, c, s });
    const barras = escolherBarrasNervura({ As: fl.As, bw, cob, dmax, ...(phiNerv ? { bitolas: [phiNerv] } : {}) });
    if (!barras && phiNerv) avisos.push(`${rotulo}: com ø ${fmtPhi(phiNerv)} seriam necessárias mais de 4 barras ou mais de 2 camadas na nervura — escolha uma bitola maior.`);
    armaduras.push({ rotulo, Md, d, As: fl.As, AsMin: fl.AsMin, barras, bf, ok: fl.ok && !!barras, comoT: fl.comoT });
    for (const a of fl.avisos) if (!avisos.includes(a)) avisos.push(a);
  };
  const projetarNeg = (rotulo, Md) => {
    const fl = dimensionarFlexao({ Md: Math.abs(Md), b: bw, h, d: dNeg, c, s });
    const porMetro = fl.As / e;
    const barrasNeg = escolherBarrasLaje({ As: porMetro, h, principal: true, phi: phiNeg });
    if (!barrasNeg && phiNeg) avisos.push(`${rotulo}: ${motivoBarraLaje({ As: porMetro, h, phi: phiNeg }) ?? `ø ${fmtPhi(phiNeg)} não atende`} — escolha outra bitola.`);
    armaduras.push({ rotulo, Md, d: dNeg, As: fl.As, AsMin: fl.AsMin, porMetro, barras: barrasNeg, ok: !fl.dupla && !!barrasNeg, negativa: true });
    if (fl.dupla) avisos.push(`${rotulo}: compressão excessiva na nervura — use região maciça junto ao apoio ou aumente h.`);
  };

  let VdNerv, reacoes, mapa = null, f0, Ma, placa = null, Ieq, fissurada;

  if (duas) {
    placa = analisarPlaca({ lx: el.lx, ly: el.ly, bordas: el.bordas, nu: c.nu });
    const u = placa.unit;
    const Mx = u.mxPos * pd * e, My = u.myPos * pd * e, Mxn = u.mxNeg * pd * e, Myn = u.myNeg * pd * e;
    const principal = el.lx <= el.ly ? 'x' : 'y';
    projetarPos('Nervura x (positiva)', Mx, principal === 'x' ? dx : dy, el.lx, el.bordas.x0, el.bordas.x1);
    projetarPos('Nervura y (positiva)', My, principal === 'y' ? dx : dy, el.ly, el.bordas.y0, el.bordas.y1);
    if (Mxn < -1e-6) projetarNeg('Negativa x (bordas esquerda/direita)', Mxn);
    if (Myn < -1e-6) projetarNeg('Negativa y (bordas inferior/superior)', Myn);
    const fr = fatoresDeReacaoPlaca({ lx: el.lx, ly: el.ly, bordas: el.bordas, nu: c.nu });
    reacoes = BORDAS_N.map((b) => {
      const k = fr.fator[b.id];
      return { id: b.id, nome: b.nome, tipo: el.bordas[b.id], g: cg.g * k, q: cg.q * k, d: pd * k };
    });
    VdNerv = Math.max(...reacoes.map((r) => r.d)) * e;
    // flecha: placa com rigidez equivalente por metro D = Ecs·I(T)/e
    // em balanço, a fissuração que governa é a do engaste (momento negativo)
    const negs = armaduras.filter((a) => a.negativa).sort((a, b) => a.Md - b.Md);
    Ma = (balanco && negs.length ? Math.max(-u.mxNeg, -u.myNeg) : Math.max(u.mxPos, u.myPos)) * pser * e;
    const prin = balanco && negs.length ? negs[0] : armaduras.find((a) => a.rotulo.startsWith(`Nervura ${principal}`));
    if (placa.flechaMaxima?.naBordaLivre) flechaBorda = { l: placa.flechaMaxima.distanciaApoio };
    const br = inerciaBransonT({ bf: bfRig, bw, hf, h, d: prin.d, As: prin.negativa ? prin.As : (prin.barras?.AsEf ?? prin.As), Ma, c, s });
    const D = (c.Ecs * 1000 * br.Ieq * 1e-8) / e;
    f0 = (u.wMax * pser / D) * 1000;
    const amostrar = (n, max) => Array.from({ length: Math.min(max, n + 1) }, (_, i) => Math.round((i * n) / (Math.min(max, n + 1) - 1)));
    const is = amostrar(placa.nx, 13), js = amostrar(placa.ny, 13);
    mapa = js.slice().reverse().map((j) => is.map((i) => Math.round((placa.grade[j][i].w / u.wMax) * 1000) / 1000));
    memorial.push({ titulo: 'Esforços (placa equivalente, 14.7.7)', linhas: [
      `μx = ${f(placa.coef.mxPos * 100)} · μy = ${f(placa.coef.myPos * 100)} · μ'x = ${f(-placa.coef.mxNeg * 100)} · μ'y = ${f(-placa.coef.myNeg * 100)} (m = μ·p·l²/100)`,
      `Por nervura (× intereixo ${f(e)} m): Mx = ${f(Mx)} · My = ${f(My)} · M'x = ${f(Mxn)} · M'y = ${f(Myn)} kN·m`,
    ] });
    if (Math.max(el.lx, el.ly) / Math.min(el.lx, el.ly) > 2) avisos.push('λ > 2: considere nervuras em uma direção.');
    ({ Ieq, fissurada } = br);
  } else {
    const EIc = c.Ecs * 1000 * pT.I * 1e-8;
    const { rG, rQ, apoios } = analisarUmaDirecao(el, ctx, cg.g * e, cg.q * e, EIc);
    const pts = rG.pontos.map((p, i) => ({ M: gg * p.M + gq * rQ.pontos[i].M, V: gg * p.V + gq * rQ.pontos[i].V, Ms: p.M + psi2 * rQ.pontos[i].M }));
    const Mpos = Math.max(0, ...pts.map((p) => p.M)), Mneg = Math.min(0, ...pts.map((p) => p.M));
    projetarPos('Nervura x (positiva)', Mpos, dx, el.lx, el.bordas.x0, el.bordas.x1);
    if (Mneg < -1e-6) projetarNeg('Negativa sobre os apoios', Mneg);
    VdNerv = Math.max(...pts.map((p) => Math.abs(p.V)));
    reacoes = BORDAS_N.map((b) => {
      const idx = b.id === 'x0' ? 0 : b.id === 'x1' ? 1 : null;
      const gk = idx == null ? 0 : rG.reacoes[idx].V / e, qk = idx == null ? 0 : rQ.reacoes[idx].V / e;
      const tipo = idx == null ? (el.bordas[b.id] === 'livre' ? 'livre' : 'lateral (paralela às nervuras)') : el.bordas[b.id];
      return { id: b.id, nome: b.nome, tipo, g: gk, q: qk, d: gg * gk + gq * qk };
    });
    const negs = armaduras.filter((a) => a.negativa);
    Ma = balanco ? Math.max(...pts.map((p) => Math.abs(p.Ms))) : Math.max(0, ...pts.map((p) => p.Ms));
    const prin = armaduras[0];
    const bf = prin.bf;
    const AsServ = balanco && negs.length ? negs[0].As : (prin.barras?.AsEf ?? prin.As);
    const br = inerciaBransonT({ bf, bw, hf, h, d: prin.d, As: AsServ, Ma, c, s });
    const rE = analisarViga({ vaos: [el.lx], apoios, P: [], q: [pser * e], EI: [c.Ecs * 1000 * br.Ieq * 1e-8] });
    f0 = Math.abs(rE.vaos[0].flecha) * 1000;
    ({ Ieq, fissurada } = br);
    if (balanco) flechaBorda = { l: el.lx };
    if (el.lx > 4 && !balanco) avisos.push(el.lx > 6 ? 'Vão acima de 6 m: prever ao menos duas nervuras transversais de travamento.' : 'Vão acima de 4 m: prever uma nervura transversal de travamento.');
  }

  // cortante nas nervuras (13.2.4.2)
  const dCort = Math.min(dx, dy);
  // armadura tracionada junto ao apoio: no balanço, a negativa (por nervura)
  const negsApoio = armaduras.filter((a) => a.negativa);
  const AsApoio = balanco && negsApoio.length
    ? Math.min(...negsApoio.map((a) => a.As))
    : Math.min(...armaduras.filter((a) => !a.negativa).map((a) => a.barras?.AsEf ?? a.As));
  const comoLaje = ecm <= 65 || (ecm <= 90 && bw > 12);
  let cort;
  if (comoLaje) {
    const v = verificarCortanteLaje({ Vd: VdNerv, d: dCort, As1: AsApoio, c, bw });
    cort = { Vd: VdNerv, VR: v.VRd1, ok: v.ok, criterio: 'VRd1 (como laje)' };
  } else {
    const est = dimensionarEstribos({ Vd: VdNerv, bw, d: dCort, c, s });
    cort = { Vd: VdNerv, VR: est.VRd2, ok: est.ok, criterio: 'VRd2 (como viga)', estribos: est.estribo };
  }

  // mesa (13.2.4.2): verificada à flexão quando o intereixo passa de 65 cm
  let mesa = null;
  const l0 = ecm - bw;
  if (ecm > 65 && ecm <= 110) {
    const Mm = (pd * (l0 / 100) ** 2) / 12;
    const fl = dimensionarFlexao({ Md: Mm, b: 100, h: hf, d: hf / 2, c, s });
    mesa = { Md: Mm, As: Math.max(fl.As, 0.9), barras: escolherBarrasLaje({ As: Math.max(fl.As, 0.9), h: Math.max(hf, 8), principal: false }), ok: fl.ok && !fl.dupla };
  }
  if (ecm > 110) avisos.push('Intereixo acima de 110 cm: a mesa deve ser projetada como laje maciça apoiada na grelha — fora do escopo deste módulo.');

  const ft = f0 * (1 + alfaFluencia(ctx.parametros.els?.t0 ?? 1).alfaF);
  const lmenor = duas ? Math.min(el.lx, el.ly) : el.lx;
  // balanço ou flecha máxima numa borda livre: limite 2·l/250, com l até a borda vinculada mais próxima
  const lref = flechaBorda ? flechaBorda.l : lmenor;
  const flim = ((flechaBorda ? 2 : 1) * lref * 1000) / 250;

  // verificações
  const hfMin = Math.max(4, l0 / 15);
  verificacoes.push({ nome: 'Espessura da mesa', item: '13.2.4.2', valor: `hf = ${f(hf, 1)} cm`, limite: `≥ ${f(hfMin, 1)} cm`, ok: hf >= hfMin - 1e-9 });
  verificacoes.push({ nome: 'Largura da nervura', item: '13.2.4.2', valor: `bw = ${f(bw, 1)} cm`, limite: '≥ 5 cm', ok: bw >= 5 });
  verificacoes.push({ nome: 'Intereixo das nervuras', item: '13.2.4.2', valor: `${f(ecm, 0)} cm`, limite: '≤ 110 cm', ok: ecm <= 110 });
  verificacoes.push({ nome: `Concreto mínimo (CAA ${caa})`, item: '7.4.2', valor: `C${c.fck}`, limite: `≥ C${FCK_MIN[caa]}`, ok: c.fck >= FCK_MIN[caa] });
  for (const a of armaduras.filter((x) => !x.nula)) {
    verificacoes.push({ nome: `Flexão — ${a.rotulo}`, item: '17.2', valor: `Md = ${f(a.Md)} kN·m`, limite: a.negativa ? `As = ${f(a.porMetro)} cm²/m` : `As = ${f(a.As)} cm²/nervura`, ok: a.ok });
  }
  if (mesa) verificacoes.push({ nome: 'Flexão da mesa entre nervuras', item: '13.2.4.2', valor: `Md = ${f(mesa.Md, 3)} kN·m/m`, limite: `As = ${f(mesa.As)} cm²/m`, ok: mesa.ok });
  verificacoes.push({ nome: `Cortante na nervura — ${cort.criterio}`, item: comoLaje ? '19.4.1' : '17.4.2.2', valor: `VSd = ${f(cort.Vd)} kN`, limite: `${f(cort.VR)} kN`, ok: cort.ok });
  verificacoes.push({ nome: flechaBorda ? 'Flecha total na borda livre' : 'Flecha total', item: '13.3', valor: `${f(ft, 1)} mm`, limite: `${flechaBorda ? '2·l/250' : 'l/250'} = ${f(flim, 1)} mm`, ok: ft <= flim });
  if (balanco) avisos.push('Laje em balanço: a armadura negativa da mesa deve ser ancorada na laje ou na viga adjacente; junto ao engaste a nervura fica comprimida — prever região maciça se necessário.');
  if (livre) avisos.push(duas
    ? 'Bordas livres: prever nervura de borda com armadura de reforço; as reações nas vigas vêm do modelo de placa.'
    : (avisosLaterais(el.bordas, 'prever nervura de borda reforçada ou viga de bordo.')[0] ?? 'Borda livre: prever nervura de borda com armadura de reforço.'));
  if (bw < 8) avisos.push('Nervuras com menos de 8 cm não podem ter armadura de compressão (13.2.4.2).');
  if (!cort.ok && comoLaje) avisos.push('Cortante acima de VRd1: use região maciça junto aos apoios, aumente bw ou h.');

  memorial.unshift({ titulo: 'Geometria e cargas', linhas: [
    `Bordas: esquerda ${el.bordas.x0}, direita ${el.bordas.x1}, inferior ${el.bordas.y0}, superior ${el.bordas.y1}${balanco ? ' → laje em balanço' : ''}`,
    `${duas ? 'Nervuras nas duas direções' : 'Nervuras na direção x'} · lx = ${f(el.lx)} m · ly = ${f(el.ly)} m · h = ${f(h, 0)} cm · mesa ${f(hf, 1)} cm · bw = ${f(bw, 1)} cm · intereixo ${f(ecm, 0)} cm`,
    `Peso próprio: mesa ${f(cg.capa)} + nervuras ${f(cg.nervuras)} + enchimento ${f(cg.ench)} = ${f(cg.pp)} kN/m² (equivale a maciça de ${f((cg.capa + cg.nervuras) / 0.25, 1)} cm)`,
    `g = ${f(cg.g)} · q = ${f(cg.q)} · pd = ${f(pd)} · pser = ${f(pser)} kN/m²`,
  ] });
  memorial.push({ titulo: 'Armaduras', linhas: armaduras.filter((a) => !a.nula).map((a) => a.negativa
    ? `${a.rotulo}: Md = ${f(a.Md)} kN·m/nervura · As = ${f(a.As)} cm²/nervura = ${f(a.porMetro)} cm²/m → ${a.barras?.rotulo ?? '—'}`
    : `${a.rotulo}: Md = ${f(a.Md)} kN·m · d = ${f(a.d)} cm · bf = ${f(a.bf, 1)} cm ${a.comoT ? '(seção T)' : '(LN na mesa)'} · As = ${f(a.As)} cm² → ${a.barras?.rotulo ?? '—'}`) });
  memorial.push({ titulo: 'Cortante e flecha', linhas: [
    `VSd por nervura = ${f(cort.Vd)} kN · ${cort.criterio} = ${f(cort.VR)} kN${cort.estribos ? ` · estribos ø${f(cort.estribos.phi, 1)} c/ ${cort.estribos.s}` : ''}`,
    `Ma = ${f(Ma)} kN·m/nervura · ${fissurada ? `Ieq = ${f(Ieq, 0)} cm⁴` : `Estádio I, Ic = ${f(pT.I, 0)} cm⁴`} · f0 = ${f(f0)} mm · f∞ = ${f(ft)} mm ≤ ${f(flim)} mm`,
  ] });

  return {
    ok: verificacoes.every((v) => v.ok) && !avisos.some((a) => a.includes('fora do escopo')),
    avisos, verificacoes, memorial,
    duas, balanco, livre, metodoReacoes: duas && livre ? 'placa' : duas ? 'areas' : 'faixa', cargas: { pp: r2(cg.pp), g: r2(cg.g), q: r2(cg.q), pd: r2(pd) },
    armaduras: armaduras.filter((a) => !a.nula).map((a) => ({ rotulo: a.rotulo, Md: r2(a.Md), As: r2(a.As), porMetro: a.porMetro && r2(a.porMetro), barras: a.barras?.rotulo ?? '—', negativa: !!a.negativa })),
    mesa: mesa && { Md: r2(mesa.Md), As: r2(mesa.As), barras: mesa.barras?.rotulo ?? '—' },
    cortante: { Vd: r2(cort.Vd), VR: r2(cort.VR), criterio: cort.criterio },
    flecha: { f0: r2(f0), ft: r2(ft), lim: r2(flim), bordaLivre: !!flechaBorda },
    reacoes: reacoes.map((r) => ({ ...r, g: r2(r.g), q: r2(r.q), d: r2(r.d) })),
    mapa,
  };
}
