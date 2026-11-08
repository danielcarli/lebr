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
 * Tesoura de madeira — NBR 7190-1:2022
 *
 * Treliça plana de nós articulados (Howe ou Pratt) com as terças nos nós do banzo superior. Esforços normais pelo
 * método dos deslocamentos para o peso próprio e o telhado (G), a sobrecarga (Q), a sucção do vento (W) e o forro.
 * Verifica cada barra à tração (área líquida nas ligações) e à compressão com flambagem (kc, NBR 7190-1), os limites de
 * esbeltez, o entalhe do nó de apoio (compressão inclinada de Hankinson e cisalhamento da linha) e a flecha final.
 */
import { coeficientesAcoes } from '../../engine/combinacoes.js';
import { madeira, compressaoMadeira } from '../../engine/madeira.js';
import { geometriaTesoura, resolverTrelica, entalheApoio, GRUPOS_TESOURA } from '../../engine/tesoura.js';
import { materialDoElemento, materialInicial, memorialMaterial } from '../madeira-comum/material.js';
import { cargasNosTesoura, geometriaTelhado, SECOES_TESOURA_PADRAO } from '../madeira-telhado/calculo.js';

const f = (v, c = 2) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');
const r2 = (v) => Math.round(v * 100) / 100 || 0;

export function criarTesoura(projeto) {
  return {
    ...materialInicial(projeto), classe: 'D40',
    telhadoId: null,
    geometria: { tipo: 'howe', vao: 8, inclinacao: 35, paineis: 6 },
    espacamento: 3,
    secoes: structuredClone(SECOES_TESOURA_PADRAO),
    cargas: { telhado: 0.75, sobrecarga: 0.25, forro: 0, vento: 0 },   // kN/m² (telhado na superfície; sobrecarga em projeção)
    areaLiquida: 85,                                                    // % da área bruta nas ligações tracionadas
  };
}

/** Telhado ligado (ou null) e os dados de geometria e cargas que valem para a tesoura. */
function dadosDaTesoura(el, ctx) {
  const tel = el.telhadoId ? ctx.elemento(el.telhadoId) : null;
  if (el.telhadoId && !tel) throw new Error('O telhado ligado a esta tesoura não existe mais.');
  if (tel) {
    const geoT = geometriaTelhado(tel);
    const c = cargasNosTesoura(tel, ctx.parametros);
    return { tel, L: geoT.L, inclinacao: geoT.i, paineis: geoT.n, et: geoT.et, nosSup: c.sup, nosInf: c.inf, origem: `telhado ${tel.codigo}` };
  }
  const g = el.geometria;
  const n = Math.max(2, 2 * Math.round((Number(g.paineis) || 2) / 2));
  const L = Number(g.vao), i = Number(g.inclinacao), et = Number(el.espacamento) || 3;
  const alfa = Math.atan(i / 100), cos = Math.cos(alfa), sin = Math.sin(alfa), lp = L / 2 / cos / (n / 2);
  const c = el.cargas ?? {};
  const nosSup = [], nosInf = [];
  for (let k = 0; k <= n; k++) {
    const trib = k === 0 || k === n ? lp / 2 : lp;
    const w = Number(c.vento) || 0;
    const nn = k === n / 2 ? [0, 2 * cos * 0.5] : k < n / 2 ? [-sin, cos] : [sin, cos];
    nosSup.push({ G: (Number(c.telhado) || 0) * trib * et, Q: (Number(c.sobrecarga) || 0) * trib * cos * et, W: [w * trib * et * nn[0], w * trib * et * nn[1]] });
    nosInf.push({ F: (Number(c.forro) || 0) * (k === 0 || k === n ? L / n / 2 : L / n) * et });
  }
  return { tel: null, L, inclinacao: i, paineis: n, et, nosSup, nosInf, origem: 'cargas informadas' };
}

function analisar(el, ctx) {
  const { m } = materialDoElemento(el, ctx.parametros);
  const d = dadosDaTesoura(el, ctx);
  const geo = geometriaTesoura({ tipo: el.geometria?.tipo ?? 'howe', L: d.L, inclinacao: d.inclinacao, paineis: d.paineis });
  const E = m.E0m * 1000;
  const barras = geo.barras.map((b) => { const s = el.secoes[b.grupo]; return { ...b, b: s.b, h: s.h, A: s.b * s.h, EA: E * s.b * s.h * 1e-4, pp: b.L * (m.peso * s.b * s.h) / 1e4 }; });
  const nNos = geo.nos.length;
  const vazio = () => Object.fromEntries([...Array(nNos).keys()].map((k) => [k, [0, 0]]));
  const G = vazio(), Q = vazio(), W = vazio();
  // peso próprio: metade de cada barra em cada nó
  for (const b of barras) { G[b.i][1] -= b.pp / 2; G[b.j][1] -= b.pp / 2; }
  geo.sup.forEach((no, k) => {
    const c = d.nosSup[k];
    G[no][1] -= c.G; Q[no][1] -= c.Q; W[no][0] += c.W[0]; W[no][1] += c.W[1];
  });
  geo.inf.forEach((no, k) => { G[no][1] -= d.nosInf[k].F; });
  const apoios = { [geo.inf[0]]: [true, true], [geo.inf[geo.n]]: [false, true] };
  const resolver = (cargas) => resolverTrelica({ nos: geo.nos, barras, apoios, cargas });
  return { m, d, geo, barras, rG: resolver(G), rQ: resolver(Q), rW: resolver(W), temVento: Object.values(W).some((v) => v[0] || v[1]) };
}

export function ligacoes() {
  return [{ id: 'apoio-a', nome: 'Apoio A', tipo: 'pontual' }, { id: 'apoio-b', nome: 'Apoio B', tipo: 'pontual' }];
}

export function cargasTransmitidas(el, ctx) {
  const { geo, rG, rQ } = analisar(el, ctx);
  const R = (r, no) => r.reacoes[no][1];
  return {
    'apoio-a': { g: R(rG, geo.inf[0]), q: R(rQ, geo.inf[0]) },
    'apoio-b': { g: R(rG, geo.inf[geo.n]), q: R(rQ, geo.inf[geo.n]) },
  };
}

export function calcularTesoura(el, ctx) {
  for (const k of Object.keys(GRUPOS_TESOURA)) {
    const s = el.secoes?.[k];
    if (!(s?.b > 0 && s?.h > 0)) throw new Error(`Informe a seção de ${GRUPOS_TESOURA[k].toLowerCase()}.`);
  }
  const { m, d, geo, barras, rG, rQ, rW, temVento } = analisar(el, ctx);
  const { p, psi2 } = materialDoElemento(el, ctx.parametros);
  const mInst = madeira(el.classe ?? p.classe, { umidade: p.umidade, carregamento: 'instantanea', tipo: el.tipo ?? p.tipo, gwc: p.gwc, gwv: p.gwv });
  const acoes = coeficientesAcoes(ctx.parametros);
  const gg = p.gg, gq = p.gq, ggFav = acoes.ggFav;
  const aLiq = Math.min(100, Math.max(40, Number(el.areaLiquida) || 85)) / 100;
  const combos = [
    { id: 'ELU1', nome: 'γg·G + γq·Q', N: (k) => gg * rG.N[k] + gq * rQ.N[k], m },
    { id: 'ELU2', nome: 'γg·G (peso próprio, sem sobrecarga)', N: (k) => gg * rG.N[k], m },
    ...(temVento ? [{ id: 'ELU3', nome: 'γg,fav·G + γq·W (sucção)', N: (k) => ggFav * rG.N[k] + gq * rW.N[k], m: mInst }] : []),
  ];
  const verificacoes = [], avisos = [], memorial = [memorialMaterial(m, p)];
  const lp = geo.barras.find((b) => b.grupo === 'banzoSup').L;

  const res = barras.map((b, k) => {
    const Ns = combos.map((c) => ({ id: c.id, N: c.N(k), m: c.m }));
    const tr = Ns.reduce((a, x) => (x.N > a.N ? x : a), { N: 0 });
    const co = Ns.reduce((a, x) => (x.N < a.N ? x : a), { N: 0 });
    const out = { ...b, NG: r2(rG.N[k]), NQ: r2(rQ.N[k]), NW: r2(rW.N[k]), Nt: r2(tr.N), Nc: r2(co.N), combT: tr.id ?? null, combC: co.id ?? null, uso: 0, falhas: [] };
    if (tr.N > 1e-6) {
      const sig = (tr.N / (b.A * aLiq)) * 10;
      out.tracao = { sigma: sig, f: tr.m.ft0d, uso: sig / tr.m.ft0d };
      out.uso = Math.max(out.uso, out.tracao.uso);
      if ((b.L * 100) / (Math.min(b.b, b.h) / Math.sqrt(12)) > 173) out.falhas.push('esbeltez de tração > 173');
    }
    if (co.N < -1e-6) {
      // no plano: flambagem entre nós (h); fora do plano: banzo superior travado pelas terças em cada nó, demais pelo comprimento
      const L0x = b.L * 100, L0y = (b.grupo === 'banzoSup' ? lp : b.L) * 100;
      const c = compressaoMadeira({ Nd: -co.N, b: b.b, h: b.h, L0x, L0y, m: co.m });
      out.compressao = { ...c, L0x, L0y, uso: Math.max(c.interacaoX, c.interacaoY) };
      out.uso = Math.max(out.uso, out.compressao.uso);
      if (!c.limiteEsbeltez.ok) out.falhas.push('esbeltez de compressão > 140');
    }
    out.ok = out.uso <= 1 + 1e-9 && !out.falhas.length;
    return out;
  });

  // verificação por grupo (a barra mais solicitada)
  for (const [g, nome] of Object.entries(GRUPOS_TESOURA)) {
    const bs = res.filter((b) => b.grupo === g);
    if (!bs.length) continue;
    const pior = bs.reduce((a, b) => (b.uso > a.uso || (!b.ok && a.ok) ? b : a), bs[0]);
    const s = el.secoes[g];
    const desc = pior.compressao && (!pior.tracao || pior.compressao.uso >= pior.tracao.uso)
      ? `${pior.nome}: Nc,d = ${f(-pior.Nc, 1)} kN · λ = ${f(Math.max(pior.compressao.lambdaX, pior.compressao.lambdaY), 0)}`
      : pior.tracao ? `${pior.nome}: Nt,d = ${f(pior.Nt, 1)} kN · σt = ${f(pior.tracao.sigma)} MPa` : `${pior.nome}: esforço nulo`;
    verificacoes.push({ nome: `${nome} ${f(s.b, 1)} × ${f(s.h, 1)}`, item: 'NBR 7190-1', valor: `${desc}${pior.falhas.length ? ` · ${pior.falhas.join(', ')}` : ''}`, limite: `uso ${f(pior.uso * 100, 0)}%`, ok: bs.every((b) => b.ok) });
  }

  // nó de apoio: entalhe simples da perna na linha
  const perna = res.find((b) => b.grupo === 'banzoSup');
  const ent = entalheApoio({ Nd: -perna.Nc, alfa: geo.alfa, b: Math.min(el.secoes.banzoSup.b, el.secoes.banzoInf.b), hInf: el.secoes.banzoInf.h, m });
  verificacoes.push({ nome: 'Nó de apoio — profundidade do entalhe', item: 'NBR 7190-1', valor: `e = ${f(ent.eNec, 1)} cm`, limite: `≤ h/4 = ${f(ent.eMax, 1)} cm`, ok: ent.ok });

  // flecha: deslocamento vertical do nó central do banzo inferior (ELS quase permanente, com fluência)
  const noMeio = geo.inf[geo.n / 2];
  const uG = Math.abs(rG.u[noMeio][1]) * 1000, uQ = Math.abs(rQ.u[noMeio][1]) * 1000;
  const ufin = (uG + psi2 * uQ) * (1 + m.phi);
  const ulim = (d.L * 1000) / (p.flecha ?? 200);
  verificacoes.push({ nome: 'Flecha final no meio do vão', item: 'ELS', valor: `${f(ufin, 1)} mm`, limite: `L/${p.flecha ?? 200} = ${f(ulim, 1)} mm`, ok: ufin <= ulim });
  avisos.push('Flecha com nós perfeitamente rígidos ao deslocamento: o deslizamento das ligações pregadas ou parafusadas aumenta a flecha — prever contraflecha de L/200 a L/300 na montagem.');
  if (res.some((b) => b.combC === 'ELU3' && b.grupo === 'banzoInf')) avisos.push('A sucção do vento comprime o banzo inferior: contraventar a linha (travessas ou mãos-francesas) e conferir as ligações à inversão de esforços.');

  const reac = (r, no) => r.reacoes[no][1];
  const apoios = [geo.inf[0], geo.inf[geo.n]].map((no, k) => ({
    id: k ? 'B' : 'A', Rg: r2(reac(rG, no)), Rq: r2(reac(rQ, no)), Rw: r2(reac(rW, no)), Rd: r2(gg * reac(rG, no) + gq * reac(rQ, no)),
    Rd3: temVento ? r2(ggFav * reac(rG, no) + gq * reac(rW, no)) : null,
  }));
  if (apoios.some((a) => a.Rd3 != null && a.Rd3 < 0)) avisos.push('Reação de arrancamento com a sucção do vento: ancorar a tesoura na cinta de amarração (estribo metálico ou chumbador).');
  const peso = barras.reduce((s, b) => s + b.pp, 0);
  const volume = barras.reduce((s, b) => s + (b.A * b.L) / 1e4, 0);

  memorial.unshift({ titulo: 'Geometria e cargas', linhas: [
    `Tesoura ${el.geometria?.tipo === 'pratt' ? 'Pratt' : 'Howe'} de duas águas: vão ${f(d.L)} m, inclinação ${f(d.inclinacao, 1)}% (α = ${f((geo.alfa * 180) / Math.PI, 1)}°), altura ${f(geo.H)} m, ${geo.n} painéis de ${f(d.L / geo.n)} m`,
    `Espaçamento entre tesouras ${f(d.et)} m · cargas: ${d.origem} · terças nos nós do banzo superior`,
    `Peso próprio ${f(peso)} kN (${f(volume, 3)} m³ de madeira) distribuído nos nós · área líquida nas ligações tracionadas ${f(aLiq * 100, 0)}% da bruta`,
    ...d.nosSup.map((c, k) => `Nó superior ${k}: G = ${f(c.G)} kN · Q = ${f(c.Q)} kN${temVento ? ` · W = (${f(c.W[0])}; ${f(c.W[1])}) kN` : ''}`).filter((_, k) => k <= geo.n / 2),
  ] });
  memorial.push({ titulo: 'Combinações (NBR 8681)', linhas: [
    ...combos.map((c) => `${c.id}: ${c.nome}${c.m === mInst ? ' — kmod instantâneo (vento)' : ''}`),
    `γg = ${f(gg)} · γq = ${f(gq)} · γg,fav = ${f(ggFav)} · ELS: G + ψ2·Q com ψ2 = ${f(psi2)} e fluência φ = ${f(m.phi, 1)}`,
  ] });
  memorial.push({ titulo: 'Barras', linhas: res.map((b) => {
    const t = b.tracao ? `tração ${f(b.Nt, 1)} kN (${b.combT}) σt = ${f(b.tracao.sigma)} ≤ ${f(b.tracao.f)} MPa` : '';
    const c = b.compressao ? `compressão ${f(-b.Nc, 1)} kN (${b.combC}) λx = ${f(b.compressao.lambdaX, 0)} λy = ${f(b.compressao.lambdaY, 0)} kc = ${f(Math.min(b.compressao.kcx, b.compressao.kcy), 3)} interação ${f(b.compressao.uso, 3)}` : '';
    return `${b.nome} (${f(b.b, 1)} × ${f(b.h, 1)}, L = ${f(b.L)} m): ${[t, c].filter(Boolean).join(' · ') || 'esforço nulo'}`;
  }) });
  memorial.push({ titulo: 'Nó de apoio (entalhe simples)', linhas: [
    `Nd,perna = ${f(-perna.Nc, 1)} kN · componente horizontal Nd·cos α = ${f(ent.H, 1)} kN`,
    `fc,α,d (Hankinson) = fc0,d·fc90,d/(fc0,d·sen²α + fc90,d·cos²α) = ${f(ent.fca)} MPa`,
    `e ≥ Nd·cos α/(b·fc,α,d) = ${f(ent.eNec, 1)} cm ≤ h/4 = ${f(ent.eMax, 1)} cm → adotar e = ${f(ent.e, 1)} cm`,
    `Folga da linha além do dente: f ≥ Nd·cos α/(b·fv,d) = ${f(ent.fNec, 1)} cm → adotar f = ${f(ent.f, 0)} cm; prever parafuso de montagem atravessando o nó`,
  ] });
  memorial.push({ titulo: 'Flecha', linhas: [`uG = ${f(uG, 1)} mm · uQ = ${f(uQ, 1)} mm · ufin = (uG + ψ2·uQ)(1 + φ) = ${f(ufin, 1)} mm ≤ ${f(ulim, 1)} mm`] });

  return {
    ok: verificacoes.every((v) => v.ok), avisos, verificacoes, memorial,
    tipo: el.geometria?.tipo ?? 'howe', L: d.L, inclinacao: d.inclinacao, paineis: geo.n, et: d.et, H: geo.H, alfa: geo.alfa, telhado: d.tel?.codigo ?? null,
    nos: geo.nos.map((n, k) => ({ ...n, u: rG.u[k] })), barras: res.map(({ i, j, grupo, nome, L, b, h, NG, NQ, NW, Nt, Nc, combT, combC, uso, ok, tracao, compressao, falhas }) => ({
      i, j, grupo, nome, L: r2(L), b, h, NG, NQ, NW, Nt, Nc, combT, combC, uso: r2(uso * 1000) / 1000, ok, falhas,
      sigmaT: tracao ? r2(tracao.sigma) : null, lambda: compressao ? Math.round(Math.max(compressao.lambdaX, compressao.lambdaY)) : null,
    })),
    combinacoes: combos.map(({ id, nome }) => ({ id, nome })),
    entalhe: ent, flecha: { uG, uQ, ufin, ulim }, apoios, peso, volume,
    uso: Math.max(...res.map((b) => b.uso)),
  };
}
