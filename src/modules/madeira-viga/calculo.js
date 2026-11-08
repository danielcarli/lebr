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
 * Viga de madeira de seção retangular — NBR 7190-1:2022
 *
 * Vigas contínuas (apoios, engastes, balanços) analisadas pelo método dos
 * deslocamentos. Verificações: flexão, cisalhamento, estabilidade lateral,
 * compressão normal ao grão nos apoios e flecha final com fluência.
 */
import { analisarViga } from '../../engine/viga-solver.js';
import { cargaParede } from '../../engine/cargas.js';
import { coeficientesAcoes, casosPadrao, gerarCombinacoes, envolvente, extremo, doTipo } from '../../engine/combinacoes.js';
import { flexaoMadeira, cisalhamentoMadeira, estabilidadeLateral, apoioMadeira, flechaFinal } from '../../engine/madeira.js';
import { materialDoElemento, materialInicial, memorialMaterial } from '../madeira-comum/material.js';

const f = (v, c = 2) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');
const r2 = (v) => Math.round(v * 100) / 100 || 0;

export function criarVigaMadeira(projeto) {
  return {
    ...materialInicial(projeto),
    secao: { b: 6, h: 24 },
    vaos: [{ L: 3.5 }],
    apoios: ['apoio', 'apoio'],
    pesoProprio: true,
    travamento: { continuo: false, L1: null },  // L1 em m; null = maior vão
    apoioC: 10,                                 // comprimento de apoio (cm)
    cargas: [
      { id: 'c1', tipo: 'distribuida', natureza: 'g', vao: 'todos', valor: 1.5, descricao: 'Telhado e forro' },
      { id: 'c2', tipo: 'distribuida', natureza: 'q', vao: 'todos', valor: 1.0, descricao: 'Sobrecarga' },
    ],
  };
}

function montarCasos(el, m, ctx) {
  const nv = el.vaos.length;
  const G = { q: new Array(nv).fill(0), P: [] }, Q = { q: new Array(nv).fill(0), P: [] };
  const origem = [];
  const alvo = (c) => (c.vao === 'todos' || c.vao == null ? [...Array(nv).keys()] : [Number(c.vao)].filter((v) => v < nv));
  if (el.pesoProprio) {
    const pp = (m.peso * el.secao.b * el.secao.h) / 1e4;
    G.q.forEach((_, i) => { G.q[i] += pp; });
    origem.push({ texto: 'Peso próprio', g: pp, q: 0 });
  }
  for (const c of el.cargas ?? []) {
    const caso = c.natureza === 'q' ? Q : G;
    if (c.tipo === 'distribuida') {
      for (const v of alvo(c)) caso.q[v] += c.valor;
      origem.push({ texto: c.descricao || 'Distribuída', g: caso === G ? c.valor : 0, q: caso === Q ? c.valor : 0 });
    } else if (c.tipo === 'alvenaria') {
      const parede = cargaParede(c);
      for (const v of alvo(c)) G.q[v] += parede.g;
      origem.push({ texto: `${c.descricao ? `${c.descricao}: ` : ''}${parede.texto}`, g: parede.g, q: 0, conferir: parede.conferir });
    } else if (c.tipo === 'concentrada') {
      const v = Math.min(Number(c.vao) || 0, nv - 1);
      const x = Math.max(0, Math.min(c.posicao, el.vaos[v].L));
      caso.P.push({ vao: v, x, P: c.valor });
      (caso === G ? Q : G).P.push({ vao: v, x, P: 0 });
      origem.push({ texto: `${c.descricao || 'Concentrada'} (vão ${v + 1}, x = ${f(x)} m)`, g: caso === G ? c.valor : 0, q: caso === Q ? c.valor : 0, pontual: true });
    } else if (c.tipo === 'elemento') {
      const r = ctx.cargasDe(c.elementoId, c.ligacao);
      if (r.faixa > 0) {
        // reação numa faixa estreita (escada): resultante concentrada na posição da ligação
        const v = Math.min(c.vao === 'todos' ? 0 : Number(c.vao) || 0, nv - 1);
        const x = Math.max(0, Math.min(c.posicao != null ? Number(c.posicao) : el.vaos[v].L / 2, el.vaos[v].L));
        G.P.push({ vao: v, x, P: r.g * r.faixa });
        Q.P.push({ vao: v, x, P: r.q * r.faixa });
        origem.push({ texto: `Reação de ${ctx.elemento(c.elementoId)?.codigo ?? '?'} (${c.ligacao}, vão ${v + 1}, x = ${f(x)} m)`, g: r.g * r.faixa, q: r.q * r.faixa, pontual: true });
        continue;
      }
      for (const v of alvo(c)) { G.q[v] += r.g; Q.q[v] += r.q; }
      origem.push({ texto: `Reação de ${ctx.elemento(c.elementoId)?.codigo ?? '?'} (${c.ligacao})`, g: r.g, q: r.q });
    }
  }
  return { G, Q, origem };
}

function analisar(el, ctx) {
  const { m } = materialDoElemento(el, ctx.parametros);
  const { G, Q, origem } = montarCasos(el, m, ctx);
  const I = (el.secao.b * el.secao.h ** 3) / 12;
  const EI = m.E0m * 1000 * I * 1e-8; // kN·m²
  const L = el.vaos.map((v) => v.L);
  const base = { vaos: L, apoios: el.apoios, EI: L.map(() => EI) };
  return { m, G, Q, origem, EI, rG: analisarViga({ ...base, q: G.q, P: G.P }), rQ: analisarViga({ ...base, q: Q.q, P: Q.P }) };
}

export function cargasTransmitidas(el, ctx) {
  const { rG, rQ } = analisar(el, ctx);
  const out = {};
  el.apoios.forEach((t, k) => { if (t !== 'livre') out[`apoio-${k}`] = { g: rG.reacoes[k].V, q: rQ.reacoes[k].V }; });
  return out;
}

export function ligacoes(el) {
  let x = 0;
  const xs = [0, ...el.vaos.map((v) => (x += v.L))];
  return el.apoios.map((t, k) => ({ id: `apoio-${k}`, nome: `Apoio ${k + 1} (x = ${f(xs[k])} m)`, tipo: 'pontual', ativo: t !== 'livre' })).filter((l) => l.ativo);
}

export function calcularVigaMadeira(el, ctx) {
  const { b, h } = el.secao;
  if (el.vaos.some((v) => !(v.L > 0))) throw new Error('Todos os vãos precisam ter comprimento maior que zero.');
  const { m, G, Q, origem, rG, rQ } = analisar(el, ctx);
  const { p, psi2 } = materialDoElemento(el, ctx.parametros);
  const gg = p.gg, gq = p.gq;
  const avisos = [], verificacoes = [], memorial = [memorialMaterial(m, p)];
  for (const o of origem) if (o.conferir) avisos.push(`Carga de parede: ${o.conferir}`);

  // combinações (NBR 8681): γ da madeira (parâmetros do projeto) e ψ pelo uso da edificação
  const acoes = coeficientesAcoes(ctx.parametros);
  const casos = casosPadrao({ ...acoes, psi2 });
  const combinacoes = gerarCombinacoes(casos, { gg, ggFav: acoes.ggFav, gq });
  const elu = doTipo(combinacoes, 'ELU');
  const envM = envolvente(elu, { G: rG.pontos.map((pt) => pt.M), Q: rQ.pontos.map((pt) => pt.M) });
  const envV = envolvente(elu, { G: rG.pontos.map((pt) => pt.V), Q: rQ.pontos.map((pt) => pt.V) });
  const pts = rG.pontos.map((pt, i) => {
    const vMaior = Math.abs(envV.max[i]) >= Math.abs(envV.min[i]);
    return { x: pt.x, vao: pt.vao, Md: envM.max[i], MdMin: envM.min[i], cMax: envM.combMax[i], cMin: envM.combMin[i], Vd: vMaior ? envV.max[i] : envV.min[i], cV: vMaior ? envV.combMax[i] : envV.combMin[i], VdMax: envV.max[i], VdMin: envV.min[i] };
  });
  const pico = (lista, valor) => lista.reduce((a, q) => (valor(q) > valor(a) ? q : a), lista[0]);
  const pPos = pico(pts, (q) => q.Md), pNeg = pico(pts, (q) => -q.MdMin), pV = pico(pts, (q) => Math.abs(q.Vd));
  const MdPos = Math.max(0, pPos.Md);
  const MdNeg = Math.min(0, pNeg.MdMin);
  const MdAbs = Math.max(MdPos, -MdNeg);
  const VdMax = Math.abs(pV.Vd);
  const combGoverna = { MdPos: MdPos > 1e-6 ? pPos.cMax : null, MdNeg: MdNeg < -1e-6 ? pNeg.cMin : null, Vd: pV.cV };

  // ELU
  const flex = flexaoMadeira({ Md: MdAbs, b, h, m });
  const cis = cisalhamentoMadeira({ Vd: VdMax, b, h, m });
  const L1 = el.travamento?.L1 ?? Math.max(...el.vaos.map((v) => v.L));
  const est = el.travamento?.continuo ? null : estabilidadeLateral({ L1: L1 * 100, b, h, sigma: flex.sigma, m });

  verificacoes.push({ nome: 'Flexão (σM,d ≤ fm,d)', item: 'NBR 7190-1', valor: `${f(flex.sigma)} MPa`, limite: `${f(m.fmd)} MPa`, ok: flex.ok });
  verificacoes.push({ nome: 'Cisalhamento (τd = 1,5·Vd/A)', item: 'NBR 7190-1', valor: `${f(cis.tau)} MPa`, limite: `${f(m.fvd)} MPa`, ok: cis.ok });
  if (est) verificacoes.push(est.dispensada
    ? { nome: 'Estabilidade lateral (L1/b)', item: 'NBR 7190-1', valor: `${f(est.esbeltez, 1)}`, limite: `≤ ${f(est.limite, 1)} (dispensa)`, ok: true }
    : { nome: 'Estabilidade lateral (σc1,d)', item: 'NBR 7190-1', valor: `${f(flex.sigma)} MPa`, limite: `${f(est.sigmaLim)} MPa`, ok: est.ok });

  // apoios
  let x = 0;
  const xs = [0, ...el.vaos.map((v) => (x += v.L))];
  const apoios = el.apoios.map((tipo, k) => {
    const Rg = rG.reacoes[k].V, Rq = rQ.reacoes[k].V;
    const rMax = extremo(elu, { G: Rg, Q: Rq });
    const Rd = rMax.valor;
    const prox = pts.filter((q) => Math.abs(q.x - xs[k]) < 1e-6);
    const Mdneg = Math.min(0, ...prox.map((q) => q.MdMin));
    const ap = tipo === 'livre' ? null : apoioMadeira({ Rd, b, c: el.apoioC ?? 10, m });
    if (ap) verificacoes.push({ nome: `Compressão normal no apoio ${k + 1}`, item: 'NBR 7190-1', valor: `${f(ap.sigma)} MPa`, limite: `${f(m.fc90d)} MPa`, ok: ap.ok });
    return { tipo, x: xs[k], Rg: r2(Rg), Rq: r2(Rq), Rd: r2(Rd), Mdneg: r2(Mdneg), comb: { Rd: rMax.id } };
  });

  // ELS — flecha final com fluência (E0,med, combinação quase permanente)
  const lim = p.flecha ?? 200;
  const vaos = el.vaos.map((v, i) => {
    const balanco = el.apoios[i] === 'livre' || el.apoios[i + 1] === 'livre';
    const uG = Math.abs(rG.vaos[i].flecha) * 1000, uQ = Math.abs(rQ.vaos[i].flecha) * 1000;
    const ufin = flechaFinal({ uG, uQ, psi2, phi: m.phi });
    const ulim = ((balanco ? 2 : 1) * v.L * 1000) / lim;
    verificacoes.push({ nome: `Flecha final — vão ${i + 1}`, item: 'ELS', valor: `${f(ufin, 1)} mm`, limite: `${balanco ? '2L' : 'L'}/${lim} = ${f(ulim, 1)} mm`, ok: ufin <= ulim });
    const p_ = pts.filter((q) => q.vao === i);
    const pM = pico(p_, (q) => q.Md), pVv = pico(p_, (q) => Math.abs(q.Vd));
    return { L: v.L, gk: r2(G.q[i]), qk: r2(Q.q[i]), Mdpos: r2(Math.max(0, pM.Md)), Vd: r2(Math.abs(pVv.Vd)), comb: { Mdpos: pM.Md > 1e-6 ? pM.cMax : null, Vd: pVv.cV }, flecha: { uG: r2(uG), uQ: r2(uQ), ufin: r2(ufin), lim: r2(ulim), ok: ufin <= ulim } };
  });

  if (el.vaos.length > 1) avisos.push('Sobrecargas aplicadas em todos os vãos ao mesmo tempo (sem alternância).');
  if (h / b > 4 && !el.travamento?.continuo) avisos.push('Relação h/b acima de 4: prever travamento lateral (bloqueadores ou contraventamento).');
  if (!est) avisos.push('Borda comprimida considerada travada continuamente (piso, forro ou terças): estabilidade lateral dispensada.');

  memorial.push({ titulo: 'Cargas características', linhas: [
    ...origem.map((o) => `${o.texto}: g = ${f(o.g)} · q = ${f(o.q)} ${o.pontual ? 'kN' : 'kN/m'}`),
  ] });
  const nomeComb = (id) => (id ? `${id}: ${combinacoes.find((x) => x.id === id)?.expressao ?? ''}` : '—');
  memorial.push({ titulo: 'Combinações de ações (NBR 8681)', linhas: [
    `γg = ${f(gg)} (desfavorável) ou ${f(acoes.ggFav)} (favorável) · γq = ${f(gq)} · ψ0 = ${f(acoes.psi0)} · ψ1 = ${f(acoes.psi1)} · ψ2 = ${f(psi2)}`,
    ...combinacoes.map((x) => `${x.id}: ${x.expressao}`),
    `Governam: M+ ${nomeComb(combGoverna.MdPos)} · M− ${nomeComb(combGoverna.MdNeg)} · V ${nomeComb(combGoverna.Vd)}`,
  ] });
  memorial.push({ titulo: 'Estados limites últimos', linhas: [
    `Md,máx = ${f(MdAbs)} kN·m (M+ ${f(MdPos)} · M− ${f(MdNeg)}) · W = b·h²/6 = ${f((b * h * h) / 6, 1)} cm³ · σM,d = ${f(flex.sigma)} MPa ≤ fm,d = ${f(m.fmd)} MPa`,
    `Vd,máx = ${f(VdMax)} kN · τd = 1,5·Vd/(b·h) = ${f(cis.tau)} MPa ≤ fv,d = ${f(m.fvd)} MPa`,
    est ? `Estabilidade lateral: L1 = ${f(L1)} m · L1/b = ${f(est.esbeltez, 1)} · βM = ${f(est.betaM)} · limite Ec0,ef/(βM·fc0,d) = ${f(est.limite, 1)}${est.dispensada ? ' → dispensada' : ` → σc1,d ≤ ${f(est.sigmaLim)} MPa`}` : 'Estabilidade lateral: borda comprimida travada continuamente',
  ] });
  memorial.push({ titulo: 'Flechas (E0,med, fluência)', linhas: vaos.map((v, i) =>
    `Vão ${i + 1}: uG = ${f(v.flecha.uG)} mm · uQ = ${f(v.flecha.uQ)} mm · ufin = (uG + ψ2·uQ)(1 + φ) = ${f(v.flecha.ufin)} mm ≤ ${f(v.flecha.lim)} mm`) });

  // diagrama compatível com o desenho das vigas de concreto
  const flecha = rG.pontos.map((pt, i) => r2(Math.abs((pt.v + psi2 * rQ.pontos[i].v) * (1 + m.phi)) * 1000));
  return {
    ok: verificacoes.every((v) => v.ok),
    avisos, verificacoes, memorial,
    classe: m.nome, MdPos: r2(MdPos), MdNeg: r2(MdNeg), VdMax: r2(VdMax), comb: combGoverna,
    combinacoes: combinacoes.map(({ id, tipo, nome, expressao }) => ({ id, tipo, nome, expressao })),
    usoFlexao: flex.uso, usoCis: cis.uso, usoEst: est?.uso ?? 0,
    flechaRazao: Math.max(...vaos.map((v) => v.flecha.ufin / v.flecha.lim)),
    vaos, apoios,
    diagrama: { x: pts.map((q) => r2(q.x)), Md: pts.map((q) => r2(q.Md)), MdMin: pts.map((q) => r2(q.MdMin)), Vd: pts.map((q) => r2(q.VdMax)), VdMin: pts.map((q) => r2(q.VdMin)), flecha },
  };
}
