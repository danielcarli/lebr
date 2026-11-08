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
 * Escada de concreto armado — cálculo (NBR 6118:2023 · NBR 6120:2019 · NBR 9050:2020).
 *
 * Lances retos, em L e em U, com patamares; cada tramo é uma laje armada longitudinalmente (na direção do lance),
 * biapoiada nos extremos, com o vão na projeção horizontal. As reações por metro de largura vão para as vigas de
 * apoio pelas ligações (cargas do tipo "elemento" com posição na viga); um apoio sem viga ligada é tratado como
 * apoio externo (alvenaria, viga de patamar não modelada, terreno) e a reação aparece no resultado.
 */
import { degraus, divisaoLances, cargasEscada, geometriaEscada, tramosEscada, biapoiadaPorTrechos, flechaBiapoiada, USO_ESCADA, TIPOS_ESCADA } from '../../engine/escada.js';
import { dimensionarFlexao, armaduraMinima } from '../../engine/flexao.js';
import { verificarCortanteLaje } from '../../engine/cisalhamento.js';
import { escolherBarrasLaje, bitolaFixa, motivoBarraLaje, fmtPhi } from '../../engine/barras.js';
import { alfaFluencia } from '../../engine/fissuracao.js';
import { FCK_MIN } from '../../engine/materiais.js';

const f = (v, c = 2) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');
const r2 = (v) => Math.round(v * 100) / 100 || 0;
const r3 = (v) => Math.round(v * 1000) / 1000 || 0;

export function criarEscada() {
  return {
    tipo: 'U',
    desnivel: null,            // cm (null = pé-direito do pavimento de chegada)
    espelhoAlvo: 17.5,         // cm
    piso: 28,                  // cm
    largura: 1.0,              // m — largura de cada lance
    patamar: 1.0,              // m — profundidade do patamar intermediário (U); no L o patamar é largura × largura
    vaoCentral: 0.1,           // m — entre os lances da escada em U
    patamarInferior: 0, patamarSuperior: 0, // m — patamares de saída e de chegada dentro da escada
    h: 12,                     // cm — espessura da laje (perpendicular ao lance)
    revestimento: 1.0,         // kN/m²
    guardaCorpo: 0,            // kN/m — peso do guarda-corpo na borda livre de cada lance
    uso: 'privativa',
    posicao: null,             // { pavimento (de chegada), x, y, angulo } — canto do início do primeiro lance
    armadura: { inferior: 'auto' },
  };
}

const NOMES_APOIO = {
  reta: { 't1-ini': 'Início do lance (piso de baixo)', 't1-fim': 'Chegada do lance (piso de cima)' },
  L: { 't1-ini': 'Tramo 1 · início (piso de baixo)', 't1-fim': 'Tramo 1 · borda do patamar', 't2-ini': 'Tramo 2 · borda do patamar', 't2-fim': 'Tramo 2 · chegada (piso de cima)' },
  U: { 't1-ini': 'Tramo 1 · início (piso de baixo)', 't1-fim': 'Tramo 1 · fundo do patamar', 't2-ini': 'Tramo 2 · fundo do patamar', 't2-fim': 'Tramo 2 · chegada (piso de cima)' },
};

/** Ligações lineares (apoios dos tramos) — consumidas pelas vigas. */
export function ligacoes(el) {
  const nomes = NOMES_APOIO[el?.tipo] ?? NOMES_APOIO.U;
  return Object.entries(nomes).map(([id, nome]) => ({ id, nome, tipo: 'linear' }));
}

/** Desnível (cm): o informado ou o pé-direito do pavimento de chegada. */
export function desnivelDa(el, projeto) {
  if (Number(el.desnivel) > 0) return Number(el.desnivel);
  const pav = el.posicao && projeto?.pavimentos?.find((p) => p.id === el.posicao.pavimento);
  if (!pav) return null;
  const abaixo = [...(projeto.pavimentos ?? [])].filter((p) => p.cota < pav.cota - 1e-9).sort((a, b) => b.cota - a.cota)[0];
  return Math.round((pav.cota - (abaixo?.cota ?? 0)) * 1000) / 10;
}

/** Geometria completa da escada (sem esforços): degraus, lances, patamares, apoios e tramos. */
export function geometriaDa(el, projeto, ctxMat = null) {
  const H = desnivelDa(el, projeto);
  if (!(H > 0)) throw new Error('Informe o desnível da escada ou posicione-a num pavimento de chegada.');
  const tipo = TIPOS_ESCADA[el.tipo] ? el.tipo : 'U';
  const dg = degraus({ H, espelhoAlvo: Number(el.espelhoAlvo) || 17.5, piso: Number(el.piso) || 28 });
  const espelhos = divisaoLances(tipo, dg.n);
  const b = Number(el.largura) || 1;
  const patamar = tipo === 'L' ? b : Number(el.patamar) || b;
  const vaoCentral = tipo === 'U' ? Math.max(0, Number(el.vaoCentral) || 0) : 0;
  const pi = Math.max(0, Number(el.patamarInferior) || 0), ps = Math.max(0, Number(el.patamarSuperior) || 0);
  const geo = geometriaEscada({ tipo, espelhos, p: dg.p, largura: b, patamar, vaoCentral, patamarInferior: pi, patamarSuperior: ps });
  const uso = USO_ESCADA[el.uso] ?? USO_ESCADA.privativa;
  const cargas = cargasEscada({ h: Number(el.h) || 12, e: dg.e, p: dg.p, gama: ctxMat?.gama ?? 25, revestimento: Number(el.revestimento) || 0, guardaCorpo: Number(el.guardaCorpo) || 0, largura: b, q: uso.q });
  const tramos = tramosEscada({ tipo, proj: geo.proj, largura: b, patamar, vaoCentral, patamarInferior: pi, patamarSuperior: ps, cargas });
  return { H, tipo, dg, espelhos, b, patamar, vaoCentral, pi, ps, geo, uso, cargas, tramos };
}

/** Esforços característicos de cada tramo (por metro de largura). */
function esforcos(g) {
  return g.tramos.map((t) => {
    const G = biapoiadaPorTrechos(t.trechos, t.L, (x) => x.g);
    const Q = biapoiadaPorTrechos(t.trechos, t.L, (x) => x.q);
    return { ...t, G, Q };
  });
}

/** Reações características (kN/m, na faixa de largura b) — consumidas pelas vigas. */
export function cargasTransmitidas(el, ctx) {
  const g = geometriaDa(el, ctx.projeto, ctx.materiais);
  const out = {};
  esforcos(g).forEach((t, k) => {
    out[`t${k + 1}-ini`] = { g: t.G.RA, q: t.Q.RA, faixa: g.b };
    out[`t${k + 1}-fim`] = { g: t.G.RB, q: t.Q.RB, faixa: g.b };
  });
  return out;
}

/** Vigas que recebem cada apoio (pelas cargas do tipo elemento nas vigas). */
export function vigasDosApoios(el, projeto) {
  const out = {};
  for (const v of projeto?.elementos ?? []) {
    for (const c of Array.isArray(v.cargas) ? v.cargas : []) {
      if (c?.tipo === 'elemento' && c.elementoId === el.id) (out[c.ligacao] ??= []).push({ id: v.id, codigo: v.codigo, vao: c.vao, posicao: c.posicao ?? null });
    }
  }
  return out;
}

export function calcularEscada(el, ctx) {
  const { concreto: c, aco: s, gg, gq, psi2, caa } = ctx.materiais;
  const cob = ctx.parametros.cobrimento.laje;
  const avisos = [], verificacoes = [], memorial = [];
  const g = geometriaDa(el, ctx.projeto, ctx.materiais);
  const h = Number(el.h) || 12;
  const phiInf = bitolaFixa(el.armadura?.inferior);
  const d = h - cob - (phiInf ?? 10) / 20;
  const AsMinBase = armaduraMinima({ b: 100, h, d, c, s });
  const rhoMin = AsMinBase / (100 * h);
  const { alfaF } = alfaFluencia(ctx.parametros.els?.t0 ?? 1);
  const ae = s.Es / c.Ecs;
  const Ic = (100 * h ** 3) / 12;                                 // cm⁴/m
  const Mr = ((1.5 * (c.fctm / 10) * Ic) / (h / 2)) / 100;        // kN·m/m
  const receptores = vigasDosApoios(el, ctx.projeto);

  const tramos = esforcos(g).map((t, k) => {
    const D = biapoiadaPorTrechos(t.trechos, t.L, (x) => gg * x.g + gq * x.q);
    const S = biapoiadaPorTrechos(t.trechos, t.L, (x) => x.g + psi2 * x.q);
    const Md = D.Mmax, Vd = Math.max(D.RA, D.RB);
    const flex = dimensionarFlexao({ Md, b: 100, h, d, c, s });
    const AsMin = rhoMin * 100 * h;                               // Tabela 19.1: armadura principal de laje armada numa direção
    const As = Math.max(flex.AsCalc, AsMin);
    const barras = escolherBarrasLaje({ As, h, principal: true, phi: phiInf });
    const AsDist = Math.max(0.2 * As, 0.9, 0.5 * rhoMin * 100 * h);
    const dist = escolherBarrasLaje({ As: AsDist, h, principal: false });
    const AsNeg = 0.67 * rhoMin * 100 * h;                        // borda sem continuidade (Tabela 19.1)
    const neg = escolherBarrasLaje({ As: AsNeg, h, principal: true });
    const cort = verificarCortanteLaje({ Vd, d, As1: barras?.AsEf ?? As, c });
    // flecha: Branson com o estádio II da armadura principal; integração de M/EI na projeção horizontal
    const AsEf = barras?.AsEf ?? As;
    const xII = (-ae * AsEf + Math.sqrt((ae * AsEf) ** 2 + 200 * ae * AsEf * d)) / 100;
    const III = (100 * xII ** 3) / 3 + ae * AsEf * (d - xII) ** 2;
    const Ma = S.Mmax;
    const fissurada = Ma > Mr;
    const rr = fissurada ? (Mr / Ma) ** 3 : 1;
    const Ieq = Math.min(Ic, rr * Ic + (1 - rr) * III);
    const EI = c.Ecs * 1000 * Ieq * 1e-8;                         // kN·m²/m
    const f0 = flechaBiapoiada(S.M, t.L, EI) * 1000;              // mm
    const ft = f0 * (1 + alfaF);
    const flim = (t.L * 1000) / 250;
    const id = (ext) => `t${k + 1}-${ext}`;
    const apoio = (ext, R) => ({ id: id(ext), g: R.g, q: R.q, d: R.d, vigas: receptores[id(ext)] ?? [] });
    return {
      nome: t.nome, L: t.L, trechos: t.trechos,
      apoios: [apoio('ini', { g: t.G.RA, q: t.Q.RA, d: D.RA }), apoio('fim', { g: t.G.RB, q: t.Q.RB, d: D.RB })],
      Md, xM: D.xM, Vd, flex, As, AsMin, barras, AsDist, dist, AsNeg, neg, cort, Ma, fissurada, Ieq, f0, ft, flim,
    };
  });

  // ---------------------------------------------------------------- verificações
  const { dg } = g;
  verificacoes.push({ nome: 'Degraus — fórmula de Blondel', item: 'NBR 9050, 6.8.2', valor: `2e + p = ${f(dg.blondel, 1)} cm`, limite: '63 a 65 cm', ok: dg.blondel >= 63 - 0.05 && dg.blondel <= 65 + 0.05 });
  if (dg.e < 16 - 0.05 || dg.e > 18 + 0.05) avisos.push(`Espelho de ${f(dg.e, 1)} cm fora da faixa de 16 a 18 cm da NBR 9050 (rotas acessíveis); ajuste o espelho alvo.`);
  if (dg.p < 28 || dg.p > 32) avisos.push(`Piso de ${f(dg.p, 0)} cm fora da faixa de 28 a 32 cm da NBR 9050.`);
  if (g.b < 0.8) avisos.push(`Largura de ${f(g.b)} m: confira a largura mínima no código de obras (1,20 m nas rotas acessíveis da NBR 9050).`);
  verificacoes.push({ nome: 'Espessura mínima', item: '13.2.4.1', valor: `h = ${f(h, 1)} cm`, limite: '≥ 8 cm', ok: h >= 8 });
  verificacoes.push({ nome: `Concreto mínimo (CAA ${caa})`, item: '7.4.2', valor: `C${c.fck}`, limite: `≥ C${FCK_MIN[caa]}`, ok: c.fck >= FCK_MIN[caa] });
  for (const t of tramos) {
    const ok = t.flex.ok && !t.flex.dupla && !!t.barras;
    verificacoes.push({ nome: `${t.nome} — flexão`, item: '17.2 / 19.3', valor: `Md = ${f(t.Md)} kN·m/m`, limite: `As = ${f(t.As)} cm²/m`, ok });
    verificacoes.push({ nome: `${t.nome} — cortante sem armadura transversal`, item: '19.4.1', valor: `VSd = ${f(t.cort.Vd)} kN/m`, limite: `VRd1 = ${f(t.cort.VRd1)} kN/m`, ok: t.cort.ok });
    verificacoes.push({ nome: `${t.nome} — flecha total`, item: '13.3', valor: `${f(t.ft, 1)} mm`, limite: `l/250 = ${f(t.flim, 1)} mm`, ok: t.ft <= t.flim });
    if (t.flex.dupla) avisos.push(`${t.nome}: x/d acima do limite — aumente a espessura da escada.`);
    if (!t.barras) avisos.push(phiInf ? `${t.nome}: ${motivoBarraLaje({ As: t.As, h, phi: phiInf }) ?? `ø ${fmtPhi(phiInf)} não atende`}.` : `${t.nome}: armadura elevada para a espessura adotada.`);
    if (!t.cort.ok) avisos.push(`${t.nome}: cortante acima de VRd1 — aumente a espessura.`);
  }
  const externos = tramos.flatMap((t) => t.apoios.filter((a) => !a.vigas.length).map((a) => ({ ...a, tramo: t.nome })));
  if (externos.length) avisos.push(`Apoios sem viga ligada (alvenaria, viga de patamar ou terreno): ${externos.map((a) => `${NOMES_APOIO[g.tipo][a.id]} — ${f(a.g + a.q)} kN/m`).join('; ')}. Essas reações não descem para a estrutura do modelo.`);
  if (g.tipo === 'L') avisos.push('Escada em L: o patamar de canto é dividido igualmente entre os dois tramos (metade da carga para cada direção).');

  // ---------------------------------------------------------------- memorial
  const { cargas: cg } = g;
  memorial.push({ titulo: 'Geometria', linhas: [
    `${TIPOS_ESCADA[g.tipo].nome}: desnível H = ${f(g.H, 1)} cm${Number(el.desnivel) > 0 ? '' : ' (pé-direito do pavimento)'} → ${dg.n} espelhos de e = ${f(dg.e, 2)} cm e piso p = ${f(dg.p, 1)} cm; 2e + p = ${f(dg.blondel, 1)} cm.`,
    `Lances: ${g.espelhos.map((n, i) => `${i + 1}º com ${n} espelhos e ${n - 1} pisos (projeção ${f(g.geo.proj[i])} m)`).join('; ')}; largura ${f(g.b)} m${g.tipo === 'U' ? `, vão central ${f(g.vaoCentral)} m, patamar de ${f(g.patamar)} m` : g.tipo === 'L' ? `, patamar de canto ${f(g.b)} × ${f(g.b)} m` : ''}.`,
    `Inclinação tg α = e/p → α = ${f(cg.alfa, 1)}°, cos α = ${f(cg.cos, 3)}.`,
  ] });
  memorial.push({ titulo: 'Cargas (projeção horizontal)', linhas: [
    `Lance: hm = h/cos α + e/2 = ${f(h, 1)}/${f(cg.cos, 3)} + ${f(dg.e / 2, 2)} = ${f(cg.lance.hm, 2)} cm → peso próprio ${f(cg.lance.pp)} kN/m²; g = ${f(cg.lance.g)} kN/m² (revestimento ${f(Number(el.revestimento) || 0)}${Number(el.guardaCorpo) ? `, guarda-corpo ${f(el.guardaCorpo)} kN/m ÷ ${f(g.b)} m` : ''}).`,
    `Patamar: peso próprio ${f(cg.patamar.pp)} kN/m²; g = ${f(cg.patamar.g)} kN/m².`,
    `Uso: ${g.uso.nome}, q = ${f(g.uso.q, 1)} kN/m² (NBR 6120:2019, Tabela 10).`,
  ] });
  for (const t of tramos) {
    memorial.push({ titulo: `${t.nome} — laje biapoiada, L = ${f(t.L)} m`, linhas: [
      `Trechos: ${t.trechos.map((x) => `${x.tipo} de ${f(x.a)} a ${f(x.b)} m (g = ${f(x.g)}, q = ${f(x.q)} kN/m²${x.fator !== 1 ? `, fator ${f(x.fator, 3)}` : ''})`).join('; ')}.`,
      `Reações características por metro: início g = ${f(t.apoios[0].g)}, q = ${f(t.apoios[0].q)} kN/m; fim g = ${f(t.apoios[1].g)}, q = ${f(t.apoios[1].q)} kN/m.`,
      `Md = ${f(t.Md)} kN·m/m a ${f(t.xM)} m do início; VSd = ${f(t.Vd)} kN/m.`,
      `Flexão: d = ${f(d)} cm, As,calc = ${f(t.flex.AsCalc)} cm²/m, As,mín = ρmín·b·h = ${f(t.AsMin)} cm²/m → ${t.barras?.rotulo ?? '—'} (${f(t.barras?.AsEf)} cm²/m), na direção do lance.`,
      `Distribuição: máx(0,2·As; 0,9; 0,5·ρmín·b·h) = ${f(t.AsDist)} cm²/m → ${t.dist?.rotulo ?? '—'}. Negativa nos apoios (borda sem continuidade, 0,67·ρmín·b·h) = ${f(t.AsNeg)} cm²/m → ${t.neg?.rotulo ?? '—'}.`,
      `Flecha: Ma = ${f(t.Ma)} kN·m/m, Mr = ${f(Mr)} kN·m/m → ${t.fissurada ? `fissurada, Ieq/Ic = ${f(t.Ieq / Ic, 3)}` : 'estádio I'}; f0 = ${f(t.f0)} mm, αf = ${f(alfaF)}, f∞ = ${f(t.ft)} mm ≤ l/250 = ${f(t.flim)} mm.`,
    ] });
  }

  const apoioOut = (a) => ({ id: a.id, nome: NOMES_APOIO[g.tipo][a.id], g: r2(a.g), q: r2(a.q), d: r2(a.d), vigas: a.vigas });
  const ok = verificacoes.every((v) => v.ok);
  return {
    ok, avisos, verificacoes, memorial,
    tipo: g.tipo, H: r2(g.H), degraus: { n: dg.n, e: r2(dg.e), p: r2(dg.p), blondel: r2(dg.blondel), alfa: r2(g.cargas.alfa) },
    espelhos: g.espelhos, largura: g.b, patamar: g.patamar, vaoCentral: g.vaoCentral, h, d: r2(d),
    geometria: {
      proj: g.geo.proj.map(r3), largura: r3(g.geo.largura), comprimento: r3(g.geo.comprimento),
      lances: g.geo.lances.map((l) => ({ ...l, x0: r3(l.x0), y0: r3(l.y0), x1: r3(l.x1), y1: r3(l.y1) })),
      patamares: g.geo.patamares.map((p) => ({ ...p, x0: r3(p.x0), y0: r3(p.y0), x1: r3(p.x1), y1: r3(p.y1) })),
      apoios: g.geo.apoios.map((a) => ({ ...a, seg: a.seg.map((p) => p.map(r3)) })),
    },
    cargas: { lance: { hm: r2(cg.lance.hm), pp: r2(cg.lance.pp), g: r2(cg.lance.g), q: r2(cg.lance.q) }, patamar: { pp: r2(cg.patamar.pp), g: r2(cg.patamar.g), q: r2(cg.patamar.q) }, uso: g.uso.nome },
    tramos: tramos.map((t) => ({
      nome: t.nome, L: r3(t.L), trechos: t.trechos.map((x) => ({ tipo: x.tipo, a: r3(x.a), b: r3(x.b), g: r2(x.g), q: r2(x.q) })),
      apoios: t.apoios.map(apoioOut), Md: r2(t.Md), xM: r2(t.xM), Vd: r2(t.Vd), VRd1: r2(t.cort.VRd1),
      As: r2(t.As), AsCalc: r2(t.flex.AsCalc), AsMin: r2(t.AsMin), barras: t.barras ? { ...t.barras, AsEf: r2(t.barras.AsEf) } : null,
      AsDist: r2(t.AsDist), dist: t.dist?.rotulo ?? null, AsNeg: r2(t.AsNeg), neg: t.neg?.rotulo ?? null,
      flecha: { f0: r2(t.f0), ft: r2(t.ft), lim: r2(t.flim), fissurada: t.fissurada },
    })),
  };
}
