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
 * Viga de concreto armado — cálculo (NBR 6118:2023)
 *
 * Etapas:
 *  1. monta os casos de carga característicos G (permanente) e Q (variável);
 *  2. analisa a viga contínua (método dos deslocamentos) para cada caso;
 *  3. combina: ELU = γg·G + γq·Q  |  ELS quase permanente = G + ψ2·Q;
 *  4. dimensiona flexão (vãos e apoios), cortante e verifica flechas
 *     (inércia equivalente de Branson e fluência por αf) e a abertura de fissuras (17.3.3.2).
 *
 * Simplificação do protótipo: as sobrecargas atuam em todos os vãos
 * simultaneamente (sem alternância de cargas).
 */
import { cargaParede } from '../../engine/cargas.js';
import { envolvente, extremo, combinar, doTipo } from '../../engine/combinacoes.js';
import { aberturaFissuras, alfaFluencia, ETA1, WK_LIMITE } from '../../engine/fissuracao.js';
import { dimensionarTorcao, torcaoNoVao } from '../../engine/torcao.js';
import { escolherEstribo } from '../../engine/cisalhamento.js';
import { analisarViga } from '../../engine/viga-solver.js';
import { dimensionarFlexao } from '../../engine/flexao.js';
import { dimensionarEstribos } from '../../engine/cisalhamento.js';
import { escolherBarrasViga, bitolaFixa, fmtPhi } from '../../engine/barras.js';
import { propriedadesT, inerciaEstadioIIT, distanciaMomentoNulo, larguraColaboranteViga, flexaoVigaT, ligacaoMesaAlma } from '../../engine/secao-t.js';
import { detalharViga } from '../../engine/detalhamento.js';
import { FCK_MIN, COBRIMENTO_MM } from '../../engine/materiais.js';
import { grelhaDaViga, textoInteracao, FATOR_TORCAO_GRELHA } from '../comum/grelha.js';
import { secaoDoVao, secoesDaViga, secaoVariavel, secaoNoApoio, facesContinuas, espessuraApoiada, vaosInvertidos } from '../../engine/viga-secoes.js';

const f = (v, c = 2) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');

/** Comprimentos acumulados até o início de cada vão. */
const inicios = (vaos) => vaos.reduce((acc, v, i) => (acc.push(i ? acc[i - 1] + vaos[i - 1].L : 0), acc), []);

/** Monta os carregamentos característicos por caso (G e Q). */
export function montarCasos(el, ctx) {
  const nv = el.vaos.length;
  const G = { q: new Array(nv).fill(0), P: [], t: new Array(nv).fill(0) }; // t: torque distribuído (kN·m/m)
  const Q = { q: new Array(nv).fill(0), P: [], t: new Array(nv).fill(0) };
  const origem = []; // descrição de cada parcela, para o memorial
  const torcoes = []; // torques distribuídos com a origem (a grelha precisa do lado da laje)
  // cargas de elementos apoiados na viga (lajes, escadas): na viga invertida ficam penduradas na face inferior
  const suspensas = { g: new Array(nv).fill(0), q: new Array(nv).fill(0), P: [] };
  const alvo = (c) => (c.vao === 'todos' || c.vao == null ? [...Array(nv).keys()] : [Number(c.vao)].filter((v) => v < nv));

  const PP = new Array(nv).fill(0); // peso próprio por vão (parte de G), mostrado como caso G1
  if (el.pesoProprio) {
    // cada vão com a própria seção
    G.q.forEach((_, i) => { const s = secaoDoVao(el, i); const pp = (ctx.materiais.gama * s.b * s.h) / 1e4; G.q[i] += pp; PP[i] = pp; });
    if (PP.every((v) => Math.abs(v - PP[0]) < 1e-9)) origem.push({ texto: 'Peso próprio', g: PP[0], q: 0, vaos: 'todos' });
    else PP.forEach((pp, i) => { const s = secaoDoVao(el, i); origem.push({ texto: `Peso próprio (${s.b} × ${s.h} cm)`, g: pp, q: 0, vaos: i }); });
  }

  for (const c of el.cargas ?? []) {
    const caso = c.natureza === 'q' ? Q : G;
    if (c.tipo === 'distribuida') {
      for (const v of alvo(c)) caso.q[v] += c.valor;
      origem.push({ texto: c.descricao || 'Carga distribuída', g: c.natureza === 'q' ? 0 : c.valor, q: c.natureza === 'q' ? c.valor : 0, vaos: c.vao });
    } else if (c.tipo === 'alvenaria') {
      const parede = cargaParede(c);
      for (const v of alvo(c)) G.q[v] += parede.g;
      origem.push({ texto: `${c.descricao ? `${c.descricao}: ` : ''}${parede.texto}`, g: parede.g, q: 0, vaos: c.vao, conferir: parede.conferir });
    } else if (c.tipo === 'concentrada') {
      const v = Math.min(Number(c.vao) || 0, nv - 1);
      const x = Math.max(0, Math.min(c.posicao, el.vaos[v].L));
      caso.P.push({ vao: v, x, P: c.valor });
      (caso === G ? Q : G).P.push({ vao: v, x, P: 0 }); // mesma malha nos dois casos
      origem.push({ texto: `${c.descricao || 'Concentrada'} (vão ${v + 1}, x = ${f(x)} m)`, g: caso === G ? c.valor : 0, q: caso === Q ? c.valor : 0, vaos: v, pontual: true });
    } else if (c.tipo === 'elemento') {
      const r = ctx.cargasDe(c.elementoId, c.ligacao);
      const fonte = ctx.elemento(c.elementoId);
      // pilar que nasce na viga (transição): a normal do pilar é carga concentrada na posição da ligação
      if (c.concentrada) {
        const v = Math.min(c.vao === 'todos' ? 0 : Number(c.vao) || 0, nv - 1);
        const x = Math.max(0, Math.min(c.posicao != null ? Number(c.posicao) : el.vaos[v].L / 2, el.vaos[v].L));
        G.P.push({ vao: v, x, P: r.g }); Q.P.push({ vao: v, x, P: r.q });
        suspensas.P.push({ vao: v, x, g: r.g, q: r.q, codigo: fonte?.codigo ?? '?' });
        origem.push({ texto: `${fonte?.codigo ?? '?'} nasce na viga (transição): ${f(r.g + r.q)} kN (vão ${v + 1}, x = ${f(x)} m)`, g: r.g, q: r.q, vaos: v, pontual: true });
        continue;
      }
      // reação numa faixa estreita (escada): resultante concentrada no centro da faixa, na posição da ligação
      if (r.faixa > 0) {
        const v = Math.min(c.vao === 'todos' ? 0 : Number(c.vao) || 0, nv - 1);
        const x = Math.max(0, Math.min(c.posicao != null ? Number(c.posicao) : el.vaos[v].L / 2, el.vaos[v].L));
        G.P.push({ vao: v, x, P: r.g * r.faixa });
        Q.P.push({ vao: v, x, P: r.q * r.faixa });
        suspensas.P.push({ vao: v, x, g: r.g * r.faixa, q: r.q * r.faixa, codigo: fonte?.codigo ?? '?' });
        origem.push({ texto: `Reação de ${fonte?.codigo ?? '?'} (${c.ligacao}): ${f(r.g + r.q)} kN/m × ${f(r.faixa)} m (vão ${v + 1}, x = ${f(x)} m)`, g: r.g * r.faixa, q: r.q * r.faixa, vaos: v, pontual: true });
        continue;
      }
      // reação linear num trecho do vão (reservatório sobre parte do vão): seis resultantes ao longo do trecho
      if (Array.isArray(c.trecho) && c.vao !== 'todos' && c.vao != null) {
        const v = Math.min(Number(c.vao) || 0, nv - 1);
        const [t0, t1] = c.trecho.map((x) => Math.max(0, Math.min(Number(x) || 0, el.vaos[v].L)));
        const n = 6, dl = (t1 - t0) / n;
        for (let k = 0; k < n; k++) {
          const x = t0 + (k + 0.5) * dl;
          G.P.push({ vao: v, x, P: r.g * dl }); Q.P.push({ vao: v, x, P: r.q * dl });
          suspensas.P.push({ vao: v, x, g: r.g * dl, q: r.q * dl, codigo: fonte?.codigo ?? '?' });
        }
        origem.push({ texto: `Reação de ${fonte?.codigo ?? '?'} (${c.ligacao}): ${f(r.g + r.q)} kN/m de ${f(t0)} a ${f(t1)} m do vão ${v + 1}`, g: r.g * (t1 - t0), q: r.q * (t1 - t0), vaos: v, pontual: true });
        continue;
      }
      for (const v of alvo(c)) { G.q[v] += r.g; Q.q[v] += r.q; suspensas.g[v] += r.g; suspensas.q[v] += r.q; }
      origem.push({ texto: `Reação de ${fonte?.codigo ?? '?'} (${c.ligacao})`, g: r.g, q: r.q, vaos: c.vao });
      // laje em balanço apoiada na viga: o momento do engaste vira torção de equilíbrio (17.5.1.1)
      if (r.t && (r.t.g || r.t.q)) {
        for (const v of alvo(c)) { G.t[v] += r.t.g; Q.t[v] += r.t.q; }
        torcoes.push({ vaos: alvo(c), g: r.t.g, q: r.t.q, fonteId: c.elementoId });
        origem.push({ texto: `Torção do balanço de ${fonte?.codigo ?? '?'} (${c.ligacao})`, g: r.t.g, q: r.t.q, vaos: c.vao, torcao: true });
      }
    } else if (c.tipo === 'torcao') {
      for (const v of alvo(c)) caso.t[v] += c.valor;
      torcoes.push({ vaos: alvo(c), g: caso === G ? c.valor : 0, q: caso === Q ? c.valor : 0, fonteId: null });
      origem.push({ texto: c.descricao || 'Momento torçor distribuído', g: caso === G ? c.valor : 0, q: caso === Q ? c.valor : 0, vaos: c.vao, torcao: true });
    }
  }
  return { G, Q, PP, origem, torcoes, suspensas };
}

/** EI bruta de cada vão (kN·m²), com a seção do vão. */
function rigidezBruta(el, ctx) {
  return el.vaos.map((_, v) => {
    const { b, h } = secaoDoVao(el, v);
    const Ic = (b * h ** 3) / 12; // cm⁴
    return ctx.materiais.concreto.Ecs * 1000 * Ic * 1e-8;
  });
}

/** Análise dos casos G e Q (esforços característicos). */
export function analisarCasos(el, ctx) {
  const { G, Q, PP, origem, suspensas } = montarCasos(el, ctx);
  const L = el.vaos.map((v) => v.L);
  const EIs = rigidezBruta(el, ctx);
  const rG = analisarViga({ vaos: L, apoios: el.apoios, q: G.q, P: G.P, EI: EIs });
  const rQ = analisarViga({ vaos: L, apoios: el.apoios, q: Q.q, P: Q.P, EI: EIs });
  const rPP = PP.some((v) => v > 0) ? analisarViga({ vaos: L, apoios: el.apoios, q: PP, P: G.P.map((p) => ({ ...p, P: 0 })), EI: EIs }) : null;
  // grelha do pavimento (14.7.6): quando o pavimento usa grelha, os esforços vêm dela; a viga isolada fica para comparação
  const grelha = grelhaDaViga(el, ctx);
  if (grelha?.modo === 'grelha' && grelha.viga) {
    return { G, Q, PP, rG: grelha.viga.rG, rQ: grelha.viga.rQ, rPP: null, origem, L, grelha, iso: { rG, rQ }, suspensas };
  }
  return { G, Q, PP, rG, rQ, rPP, origem, L, grelha, iso: { rG, rQ }, suspensas };
}

/** Reações características nos apoios — usadas por pilares (ligações "apoio-k"). */
export function cargasTransmitidas(el, ctx) {
  const { rG, rQ } = analisarCasos(el, ctx);
  const out = {};
  el.apoios.forEach((t, k) => { if (t !== 'livre') out[`apoio-${k}`] = { g: rG.reacoes[k].V, q: rQ.reacoes[k].V }; });
  return out;
}

export function ligacoes(el) {
  const x0 = inicios(el.vaos);
  const xs = [...x0, x0[x0.length - 1] + el.vaos[el.vaos.length - 1].L];
  return el.apoios
    .map((t, k) => ({ id: `apoio-${k}`, nome: `Apoio ${k + 1} (x = ${f(xs[k])} m)`, tipo: 'pontual', ativo: t !== 'livre' }))
    .filter((l) => l.ativo);
}

/* ======================================================================= */

export function calcularViga(el, ctx) {
  const { concreto: c, aco: s, gg, gq, psi2, dmax, caa } = ctx.materiais;
  // seção de cada vão (b, h, invertida) e os níveis das faces, com a base dos vãos invertidos na face inferior da laje
  const hLaje = typeof ctx.elemento === 'function' ? espessuraApoiada(el, ctx.elemento) : 10;
  const secs = secoesDaViga(el, { hLaje });
  const variavel = secaoVariavel(el);
  if (secs.some((x) => !(x.b > 0) || !(x.h > 0))) throw new Error('Informe largura e altura maiores que zero em todos os vãos.');
  const bMin = Math.min(...secs.map((x) => x.b)), hMin = Math.min(...secs.map((x) => x.h));
  // viga baldrame: em contato com o solo, cobrimento da Tabela 7.2 para elementos em contato com o solo
  const cobSolo = (COBRIMENTO_MM.solo[caa] ?? 30) / 10;
  const cob = el.baldrame ? Math.max(ctx.parametros.cobrimento.viga, cobSolo) : ctx.parametros.cobrimento.viga;
  // bitolas escolhidas pelo usuário (null = automática). Arquivos até a 0.6 só tinham phiT,
  // usado apenas no desenho e na altura útil; nesses casos o estribo continua automático.
  const arm = el.armadura ?? {};
  const legado = arm.inferior === undefined && arm.superior === undefined && arm.estribo === undefined;
  const phiInf = bitolaFixa(arm.inferior), phiSup = bitolaFixa(arm.superior);
  const phiEst = legado ? null : bitolaFixa(arm.estribo);
  const phiT = phiEst ?? (legado ? (bitolaFixa(arm.phiT) ?? 5) : 5);
  const avisos = [];
  const verificacoes = [];
  const memorial = [];

  if (el.vaos.some((v) => !(v.L > 0))) throw new Error('Todos os vãos precisam ter comprimento maior que zero.');
  const { G, Q, rG, rQ, rPP, origem, L, grelha, iso, suspensas } = analisarCasos(el, ctx);
  // viga invertida: a laje fica na face inferior e as cargas dela (e de escadas) sobem por estribos de suspensão (18.3.6)
  const inv = vaosInvertidos(el);
  const invertida = inv.algum;
  const fywd = s.fyd / 10; // kN/cm² (CA-50: 43,5)
  const combinacoes = ctx.materiais.combinacoes;
  const elu = doTipo(combinacoes, 'ELU');
  const qp = combinacoes.find((x) => x.tipo === 'QP');
  for (const o of origem) if (o.conferir) avisos.push(`Carga de parede: ${o.conferir}`);
  const x0 = inicios(el.vaos);
  const xApoio = [...x0, x0[x0.length - 1] + L[L.length - 1]];

  // ---------------------------------------------------------------- viga T ou L: mesa colaborante (14.6.2.2)
  const mesa = el.mesa && (el.mesa.tipo === 'T' || el.mesa.tipo === 'L') ? el.mesa : null;
  const hf = mesa ? Number(mesa.hf) || 0 : 0;
  if (mesa && !(hf > 0)) throw new Error('Informe a espessura da mesa hf da viga T ou L.');
  if (mesa && hf >= hMin) throw new Error('A mesa (hf) deve ser mais fina que a altura total da viga (em todos os vãos).');
  /** mesa por vão: a, bf e as abas; a mesa só colabora onde está comprimida — no vão (laje em cima) ou no apoio (invertida) */
  const mesaVao = L.map((Lv, v) => {
    if (!mesa) return null;
    const balanco = el.apoios[v] === 'livre' || el.apoios[v + 1] === 'livre';
    const esq = !balanco && (v > 0 || el.apoios[v] === 'engaste');
    const dir = !balanco && (v < L.length - 1 || el.apoios[v + 1] === 'engaste');
    const dist = distanciaMomentoNulo(Lv, { esq, dir, balanco });
    return { ...dist, ...larguraColaboranteViga({ bw: secs[v].b, mesa, a: dist.a }), balanco };
  });
  /** mesa no apoio k (só na viga invertida): a menor bf dos tramos vizinhos */
  const mesaApoio = (k) => {
    if (!mesa) return null;
    const viz = [k - 1, k].filter((v) => secs[v]?.invertida).map((v) => mesaVao[v]).filter(Boolean);
    return viz.length ? viz.reduce((m, x) => (x.bf < m.bf ? x : m)) : null;
  };

  // ---------------------------------------------------------------- ELU: envoltória das combinações últimas
  const envM = envolvente(elu, { G: rG.pontos.map((p) => p.M), Q: rQ.pontos.map((p) => p.M) });
  const envV = envolvente(elu, { G: rG.pontos.map((p) => p.V), Q: rQ.pontos.map((p) => p.V) });
  const pts = rG.pontos.map((p, i) => ({
    x: p.x, vao: p.vao,
    Md: envM.max[i], MdMin: envM.min[i], cMax: envM.combMax[i], cMin: envM.combMin[i],
    Vd: Math.abs(envV.max[i]) >= Math.abs(envV.min[i]) ? envV.max[i] : envV.min[i],
    VdMax: envV.max[i], VdMin: envV.min[i],
    cV: Math.abs(envV.max[i]) >= Math.abs(envV.min[i]) ? envV.combMax[i] : envV.combMin[i],
    Ms: combinar(qp.fatores, { G: p.M, Q: rQ.pontos[i].M }),
  }));
  /** ponto com o maior valor de `campo` (ou menor, com sinal) */
  const pico = (lista, valor) => lista.reduce((a, q) => (valor(q) > valor(a) ? q : a), lista[0]);

  // altura útil a partir do arranjo de barras escolhido (iterativo)
  const dl = cob + phiT / 10 + 0.5;
  const alturaUtil = (arr, h) => {
    if (!arr) return h - cob - phiT / 10 - 0.625;
    const phi = arr.phi / 10;
    if (arr.camadas === 1) return h - cob - phiT / 10 - phi / 2;
    const av = Math.max(2, phi, (0.5 * dmax) / 10);
    return h - cob - phiT / 10 - phi - av / 2;
  };
  /** @param phi bitola da face tracionada; @param phiC bitola da face comprimida (armadura dupla) */
  const dimensionar = (Md, phi, phiC, mT, { b, h }) => {
    let arr = null, flex = null;
    for (let it = 0; it < 3; it++) {
      const d = alturaUtil(arr ?? (phi ? { phi, camadas: 1 } : null), h);
      flex = mT ? flexaoVigaT({ Md, bf: mT.bf, bw: b, hf, h, d, dl, c, s }) : dimensionarFlexao({ Md, b, h, d, dl, c, s });
      flex.d = d;
      const novo = escolherBarrasViga({ As: flex.As, bw: b, cob, phiT, dmax, phi });
      if (novo && arr && novo.phi === arr.phi && novo.camadas === arr.camadas) { arr = novo; break; }
      arr = novo;
    }
    const comp = flex.Asl > 0 ? escolherBarrasViga({ As: flex.Asl, bw: b, cob, phiT, dmax, phi: phiC }) : null;
    return { flex, barras: arr, barrasComp: comp, phiFixo: phi, mesa: mT, b, h };
  };

  // ---------------------------------------------------------------- torção (17.5): envoltória do momento torçor
  const temTorcao = [...G.t, ...Q.t].some((t) => Math.abs(t) > 1e-9);
  if (temTorcao) {
    const tor = (caso) => pts.map((q) => torcaoNoVao(caso.t[q.vao], L[q.vao], q.x - x0[q.vao], el.apoios[q.vao] === 'livre', el.apoios[q.vao + 1] === 'livre'));
    const envT = envolvente(elu, { G: tor(G), Q: tor(Q) });
    pts.forEach((q, i) => {
      const maior = Math.abs(envT.max[i]) >= Math.abs(envT.min[i]);
      q.Td = maior ? envT.max[i] : envT.min[i];
      q.cT = maior ? envT.combMax[i] : envT.combMin[i];
    });
  }

  const vaos = L.map((Lv, v) => {
    const sec = secs[v], { b, h } = sec;
    const p = pts.filter((q) => q.vao === v);
    const pM = pico(p, (q) => q.Md);
    const pV = pico(p, (q) => Math.abs(q.Vd));
    const Mdpos = Math.max(0, pM.Md);
    const Vd = Math.abs(pV.Vd);
    const mT = mesaVao[v] && !sec.invertida && !mesaVao[v].balanco ? mesaVao[v] : null; // laje em cima: comprimida no vão
    const pos = Mdpos > 0.05 ? dimensionar(Mdpos, phiInf, phiSup, mT, sec) : null;
    const dCort = pos?.flex.d ?? alturaUtil(null, h);
    let est = dimensionarEstribos({ Vd, bw: b, d: dCort, c, s, phi: phiEst });
    let tor = null;
    if (temTorcao && (G.t[v] || Q.t[v])) {
      const pT = pico(p, (q) => Math.abs(q.Td ?? 0));
      if (Math.abs(pT.Td) > 0.01) {
        // eixo da barra longitudinal do canto até a face
        const c1 = cob + phiT / 10 + (pos?.barras?.phi ?? 10) / 20;
        tor = { ...dimensionarTorcao({ Td: pT.Td, Vd, VRd2: est.VRd2, b, h, c1, c, s }), comb: pT.cT, c1 };
        // estribos: cortante (2 ramos) + torção (A90/s em cada ramo) — 17.7.2.1
        const aswTot = est.asw + 2 * tor.A90;
        const estribo = escolherEstribo({ asw: aswTot, bw: b, sMax: est.sMax, phi: phiEst });
        est = { ...est, aswV: est.asw, asw: aswTot, estribo, avisos: [...est.avisos] };
        if (estribo.apertado) est.avisos.push('Estribos para cortante + torção com espaçamento abaixo de 7 cm — aumente a seção ou a bitola do estribo.');
        if (!tor.ok) est.avisos.push('Biela comprimida: VSd/VRd2 + TSd/TRd2 > 1 — aumente a seção ou o fck.');
      }
    }
    let susp = null;
    if (sec.invertida && (suspensas.g[v] || suspensas.q[v])) {
      const pd = gg * suspensas.g[v] + gq * suspensas.q[v];   // kN/m pendurados na face inferior
      const aswS = pd / fywd;                                  // cm²/m, nos dois ramos
      const aswTot = est.asw + aswS;
      const estribo = escolherEstribo({ asw: aswTot, bw: b, sMax: est.sMax, phi: phiEst });
      susp = { pd, asw: aswS };
      est = { ...est, aswV: est.aswV ?? est.asw, asw: aswTot, estribo, avisos: [...est.avisos] };
      if (estribo.apertado) est.avisos.push('Estribos para cortante + suspensão com espaçamento abaixo de 7 cm — aumente a seção ou a bitola do estribo.');
    }
    // ligação mesa–alma (18.3.7) onde a mesa está comprimida
    const lig = mT ? ligacaoMesaAlma({ Vd, d: dCort, bf: mT.bf, b1: mT.bMax, hf, c, s }) : null;
    return { L: Lv, x0: x0[v], sec, gk: G.q[v], qk: Q.q[v], Mdpos, Vd, pos, est, tor, susp, lig, mesa: mT, comb: { Mdpos: Mdpos > 0.05 ? pM.cMax : null, Vd: pV.cV } };
  });

  const apoios = el.apoios.map((tipo, k) => {
    const prox = pts.filter((q) => Math.abs(q.x - xApoio[k]) < 1e-6);
    const pN = pico(prox, (q) => -q.MdMin);
    const Mdneg = Math.min(0, pN.MdMin);
    const sec = secaoNoApoio(secs, k);   // a menor das seções vizinhas
    const neg = Mdneg < -0.05 ? dimensionar(-Mdneg, phiSup, phiInf, mesaApoio(k), sec) : null;
    const Rg = rG.reacoes[k].V, Rq = rQ.reacoes[k].V;
    const rMax = extremo(elu, { G: Rg, Q: Rq });
    const rMin = extremo(elu, { G: Rg, Q: Rq }, { menor: true });
    return { tipo, x: xApoio[k], sec, Mdneg, neg, Rg, Rq, Rd: rMax.valor, RdMin: rMin.valor, comb: { Mdneg: Mdneg < -0.05 ? pN.cMin : null, Rd: rMax.id, RdMin: rMin.id } };
  });

  // ---------------------------------------------------------------- ELS: flechas
  const ae = s.Es / c.Ecs;
  const Ieq = vaos.map((vv, v) => {
    const { b, h } = vv.sec;
    const Ic = (b * h ** 3) / 12;
    const Mr = (1.5 * (c.fctm / 10) * Ic) / (h / 2) / 100; // kN·m
    const balanco = el.apoios[v] === 'livre' || el.apoios[v + 1] === 'livre';
    const p = pts.filter((q) => q.vao === v);
    const Ma = balanco ? Math.max(...p.map((q) => Math.abs(q.Ms))) : Math.max(0, ...p.map((q) => q.Ms));
    const arm = balanco ? apoios[el.apoios[v] === 'livre' ? v + 1 : v].neg : vv.pos;
    const As = arm?.barras?.AsEf ?? arm?.flex.As ?? 0.0015 * b * h;
    const d = arm?.flex.d ?? alturaUtil(null, h);
    // viga T ou L com a mesa comprimida no vão: Ic e estádio II da seção T, Mr com α = 1,2 (17.3.1)
    if (vv.mesa) {
      const pT = propriedadesT({ bf: vv.mesa.bf, bw: b, hf, h });
      const MrT = (1.2 * (c.fctm / 10) * pT.I) / pT.yBot / 100;
      const IIIT = inerciaEstadioIIT({ bf: vv.mesa.bf, bw: b, hf, d, As, ae }).I;
      const rT = Ma > MrT ? (MrT / Ma) ** 3 : 1;
      vv.els = { Ma, Mr: MrT, III: IIIT, Ic: pT.I, fissurada: Ma > MrT, balanco, T: true };
      return Math.min(pT.I, rT * pT.I + (1 - rT) * IIIT);
    }
    const xII = (-ae * As + Math.sqrt((ae * As) ** 2 + 2 * b * ae * As * d)) / b;
    const III = (b * xII ** 3) / 3 + ae * As * (d - xII) ** 2;
    const r = Ma > Mr ? (Mr / Ma) ** 3 : 1;
    vv.els = { Ma, Mr, III, Ic, fissurada: Ma > Mr, balanco };
    return Math.min(Ic, r * Ic + (1 - r) * III);
  });
  const qEls = G.q.map((g, i) => g + psi2 * Q.q[i]);
  const PEls = G.P.map((pg, i) => ({ ...pg, P: pg.P + psi2 * Q.P[i].P }));
  // EI em kN·m²: Ecs (MPa) × 1000 → kN/m²; I (cm⁴) × 1e-8 → m⁴
  const EIeq = Ieq.map((I) => c.Ecs * 1000 * I * 1e-8);
  const rEls = analisarViga({ vaos: L, apoios: el.apoios, q: qEls, P: PEls, EI: EIeq });
  // só a carga acidental, para o limite de vibrações sentidas no piso (Tabela 13.3)
  const rQels = analisarViga({ vaos: L, apoios: el.apoios, q: Q.q, P: Q.P, EI: EIeq });
  const t0 = ctx.parametros.els?.t0 ?? 1;

  vaos.forEach((vv, v) => {
    const comp = (vv.pos?.flex.Asl ?? 0) / (vv.sec.b * (vv.pos?.flex.d ?? vv.sec.h));
    const { alfaF, dXi } = alfaFluencia(t0, comp);
    const f0 = Math.abs(rEls.vaos[v].flecha) * 1000; // mm
    const fdif = f0 * alfaF;
    const ft = f0 + fdif;
    const lref = (vv.els.balanco ? 2 : 1) * vv.L * 1000;
    const lim = lref / 250;
    const fQ = Math.abs(rQels.vaos[v].flecha) * 1000;
    const limQ = lref / 350;
    vv.flecha = { f0, alfaF, dXi, t0, fdif, ft, lim, ok: ft <= lim, fQ, limQ, okQ: fQ <= limQ, Ieq: Ieq[v] };
  });

  // ---------------------------------------------------------------- ELS-W: abertura de fissuras (combinação frequente)
  const freq = doTipo(combinacoes, 'FREQ');
  const Mfreq = (q) => {
    const i = pts.indexOf(q);
    const vals = { G: rG.pontos[i].M, Q: rQ.pontos[i].M };
    return freq.map((x) => ({ M: combinar(x.fatores, vals), id: x.id }));
  };
  const wLim = WK_LIMITE[caa] ?? 0.3;
  const eta1 = ETA1[s.fyk] ?? 2.25;
  const MrForm = (b, h) => (1.5 * (c.fctkInf / 10) * ((b * h ** 3) / 12)) / (h / 2) / 100; // formação de fissuras (17.3.1), kN·m
  const MrFormT = (mT, b, h) => { const pT = propriedadesT({ bf: mT.bf, bw: b, hf, h }); return (1.2 * (c.fctkInf / 10) * pT.I) / pT.yBot / 100; };
  const fissuras = (arr, Ms, comb) => {
    if (!arr?.barras || !(Ms > 0.01)) return null;
    const { b, h } = arr;
    const MrF = arr.mesa ? MrFormT(arr.mesa, b, h) : MrForm(b, h);
    const w = aberturaFissuras({
      Ms, b, h, d: arr.flex.d, phi: arr.barras.phi, n: arr.barras.n, porCamada: arr.barras.porCamada,
      cob, phiT, fctm: c.fctm, eta1, Es: s.Es,
    });
    const fissurada = Ms > MrF;
    return { Ms, comb, Mr: MrF, fissurada, sigma: w.sigma, w1: w.w1, w2: w.w2, wk: w.wk, Acr: w.Acr, rho: w.rho, lim: wLim, ok: !fissurada || w.wk <= wLim + 1e-9 };
  };
  vaos.forEach((vv, v) => {
    let melhor = { M: 0, id: null };
    for (const q of pts.filter((p) => p.vao === v)) for (const m of Mfreq(q)) if (m.M > melhor.M) melhor = m;
    vv.fiss = fissuras(vv.pos, melhor.M, melhor.id);
  });
  apoios.forEach((a, k) => {
    let melhor = { M: 0, id: null };
    for (const q of pts.filter((p) => Math.abs(p.x - xApoio[k]) < 1e-6)) for (const m of Mfreq(q)) if (m.M < melhor.M) melhor = m;
    a.fiss = fissuras(a.neg, -melhor.M, melhor.id);
  });

  // ---------------------------------------------------------------- verificações
  verificacoes.push({ nome: 'Largura mínima da seção', item: '13.2.2', valor: `b = ${f(bMin, 0)} cm${variavel && secs.some((x) => x.b !== bMin) ? ' (o vão mais estreito)' : ''}`, limite: '≥ 12 cm', ok: bMin >= 12 });
  verificacoes.push({ nome: `Concreto mínimo (CAA ${caa})`, item: '7.4.2', valor: `C${c.fck}`, limite: `≥ C${FCK_MIN[caa]}`, ok: c.fck >= FCK_MIN[caa] });
  vaos.forEach((vv, v) => {
    if (vv.pos) verificacoes.push({
      nome: `Flexão — vão ${v + 1}`, item: '17.2', valor: `Md = ${f(vv.Mdpos)} kN·m`,
      limite: `As = ${f(vv.pos.flex.As)} cm²${vv.pos.flex.dupla ? ' (dupla)' : ''}`, ok: vv.pos.flex.ok && !!vv.pos.barras,
    });
    if (vv.lig) verificacoes.push({ nome: `Ligação mesa–alma — vão ${v + 1}`, item: '18.3.7', valor: `vSd = ${f(vv.lig.vSd)} kN/m`, limite: `vRd2 = ${f(vv.lig.vRd2)} kN/m · Asf = ${f(vv.lig.Asf)} cm²/m`, ok: vv.lig.ok });
    verificacoes.push({ nome: `Biela comprimida — vão ${v + 1}`, item: '17.4.2.2', valor: `VSd = ${f(vv.Vd)} kN`, limite: `VRd2 = ${f(vv.est.VRd2)} kN`, ok: vv.est.ok });
    if (vv.tor) {
      verificacoes.push({ nome: `Torção + cortante (bielas) — vão ${v + 1}`, item: '17.7.2.2', valor: `${f(vv.Vd)}/${f(vv.est.VRd2)} + ${f(vv.tor.Td)}/${f(vv.tor.TRd2)} = ${f(vv.tor.interacao)}`, limite: '≤ 1', ok: vv.tor.ok });
      verificacoes.push({ nome: `Armadura de torção — vão ${v + 1}`, item: '17.5.1.6', valor: `A90/s = ${f(vv.tor.A90)} cm²/m por ramo`, limite: `Asl = ${f(vv.tor.Asl)} cm² no perímetro`, ok: !vv.est.estribo.apertado });
    }
    if (vv.est.estribo.apertado) verificacoes.push({ nome: `Estribos — vão ${v + 1}`, item: '17.4.2.2', valor: `Asw/s = ${f(vv.est.asw)} cm²/m`, limite: `ø ${fmtPhi(vv.est.estribo.phi)} c/ 7 = ${f(vv.est.estribo.aswEf)} cm²/m`, ok: false });
    verificacoes.push({ nome: `Flecha total — vão ${v + 1}`, item: '13.3 · Tab. 13.3', valor: `${f(vv.flecha.ft, 1)} mm`, limite: `${vv.els.balanco ? '2l' : 'l'}/250 = ${f(vv.flecha.lim, 1)} mm`, ok: vv.flecha.ok });
    if (vv.flecha.fQ > 0.05) verificacoes.push({ nome: `Flecha da carga acidental — vão ${v + 1}`, item: 'Tab. 13.3 (vibrações)', valor: `${f(vv.flecha.fQ, 1)} mm`, limite: `${vv.els.balanco ? '2l' : 'l'}/350 = ${f(vv.flecha.limQ, 1)} mm`, ok: vv.flecha.okQ });
    if (vv.fiss) verificacoes.push({ nome: `Abertura de fissuras — vão ${v + 1}`, item: '17.3.3 · Tab. 13.4', valor: vv.fiss.fissurada ? `wk = ${f(vv.fiss.wk, 2)} mm` : 'não fissura', limite: `≤ ${f(vv.fiss.lim, 1)} mm (CAA ${caa})`, ok: vv.fiss.ok });
  });
  apoios.forEach((a, k) => {
    if (a.fiss) verificacoes.push({ nome: `Abertura de fissuras — apoio ${k + 1}`, item: '17.3.3 · Tab. 13.4', valor: a.fiss.fissurada ? `wk = ${f(a.fiss.wk, 2)} mm` : 'não fissura', limite: `≤ ${f(a.fiss.lim, 1)} mm (CAA ${caa})`, ok: a.fiss.ok });
    if (a.neg) verificacoes.push({
      nome: `Flexão — apoio ${k + 1}`, item: '17.2', valor: `Md = ${f(a.Mdneg)} kN·m`,
      limite: `As = ${f(a.neg.flex.As)} cm²${a.neg.flex.dupla ? ' (dupla)' : ''}`, ok: a.neg.flex.ok && !!a.neg.barras,
    });
  });
  for (const x of [...vaos.map((v) => v.pos), ...apoios.map((a) => a.neg)]) {
    for (const av of x?.flex.avisos ?? []) if (!avisos.includes(av)) avisos.push(av);
    if (x && !x.barras) {
      const msg = x.phiFixo
        ? `As barras ø ${fmtPhi(x.phiFixo)} não cabem na largura da seção (até 3 camadas) — escolha outra bitola ou aumente b.`
        : 'Não há arranjo de barras que caiba na largura da seção — aumente b.';
      if (!avisos.includes(msg)) avisos.push(msg);
    }
  }
  if (el.baldrame) {
    const pavs = [...(ctx.projeto?.pavimentos ?? [])].sort((a, b) => a.cota - b.cota);
    if (el.posicao && pavs.length && el.posicao.pavimento !== pavs[0].id) avisos.push('Viga baldrame fora do pavimento mais baixo: confira se ela está mesmo no nível da fundação.');
  }
  for (const vv of vaos) for (const av of vv.est.avisos) if (!avisos.includes(av)) avisos.push(av);

  // ---------------------------------------------------------------- memorial
  memorial.push({ titulo: 'Materiais', linhas: [
    `Concreto C${c.fck}: fcd = ${f(c.fcd)} MPa · ηc = ${f(c.etaC, 3)} · σcd = αc·ηc·fcd = ${f(c.sigmaCd)} MPa · λ = ${f(c.lambda)}`,
    `fctm = ${f(c.fctm, 3)} MPa · Ecs = ${f(c.Ecs, 0)} MPa · aço CA-${s.fyk / 10}: fyd = ${f(s.fyd)} MPa`,
    `Bitolas: inferior ${phiInf ? `ø ${fmtPhi(phiInf)}` : 'automática'} · superior ${phiSup ? `ø ${fmtPhi(phiSup)}` : 'automática'} · estribo ${phiEst ? `ø ${fmtPhi(phiEst)}` : 'automático'}`,
    `${el.baldrame ? 'Viga baldrame (em contato com o solo): ' : ''}Cobrimento ${f(cob, 1)} cm · estribo ø${f(phiT, 1)} mm · γg = ${f(gg)} · γq = ${f(gq)} · ψ2 = ${f(psi2)}`,
  ] });
  if (variavel) {
    memorial.push({ titulo: 'Seções por vão', linhas: [
      ...secs.map((x, v) => `Vão ${v + 1} (L = ${f(L[v])} m): ${f(x.b, 0)} × ${f(x.h, 0)} cm${x.invertida ? ` · invertida (base na face inferior da laje, ${f(hLaje, 0)} cm abaixo do piso; topo ${f(x.topo, 0)} cm acima)` : ' · normal (topo no piso)'} · EI = ${f(rigidezBruta(el, ctx)[v], 0)} kN·m²`),
      'A análise usa a rigidez de cada vão; o peso próprio, a flexão, a cortante, a torção, as flechas e as fissuras usam a seção do vão. Nos apoios internos, o momento negativo é dimensionado com a menor das seções vizinhas (menor altura útil e menor largura).',
      ...el.apoios.map((_, k) => {
        if (k === 0 || k === el.apoios.length - 1) return null;
        const fc = facesContinuas(secs, k);
        if (fc.superior && fc.inferior) return null;
        return `Apoio ${k + 1}: ${[!fc.superior && 'a face superior', !fc.inferior && 'a face inferior'].filter(Boolean).join(' e ')} muda${!fc.superior && !fc.inferior ? 'm' : ''} de nível ou de largura — as barras dessa face não passam de um vão ao outro e são ancoradas dentro do apoio, com gancho.`;
      }).filter(Boolean),
    ] });
  }
  memorial.push({ titulo: 'Cargas características', linhas: [
    ...origem.map((o) => `${o.texto}: g = ${f(o.g)} · q = ${f(o.q)} ${o.torcao ? 'kN·m/m' : o.pontual ? 'kN' : 'kN/m'}${o.vaos === 'todos' || o.vaos == null || o.pontual ? '' : ` (vão ${Number(o.vaos) + 1})`}`),
    ...vaos.map((vv, v) => `Vão ${v + 1} (L = ${f(vv.L)} m): g = ${f(vv.gk)} kN/m · q = ${f(vv.qk)} kN/m`),
  ] });
  const nomeComb = (id) => (id ? `${id}: ${combinacoes.find((x) => x.id === id)?.expressao ?? ''}` : '—');
  memorial.push({ titulo: 'Combinações de ações (NBR 6118, 11.8)', linhas: [
    `Casos: G = permanentes (peso próprio e demais), Q = variável de uso · γg = ${f(gg)} (desfavorável) ou ${f(ctx.materiais.ggFav)} (favorável) · γq = ${f(gq)} · ψ0 = ${f(ctx.materiais.psi0)} · ψ1 = ${f(ctx.materiais.psi1)} · ψ2 = ${f(psi2)}`,
    ...combinacoes.map((x) => `${x.id} (${x.tipo === 'ELU' ? 'última' : x.tipo === 'QP' ? 'quase permanente' : x.tipo === 'FREQ' ? 'frequente' : 'rara'}): ${x.expressao}`),
    'Os esforços de cálculo são a envoltória das combinações últimas; as flechas usam a quase permanente.',
  ] });
  memorial.push({ titulo: 'Esforços de cálculo (ELU)', linhas: [
    ...vaos.map((vv, v) => `Vão ${v + 1}: Md+ = ${f(vv.Mdpos)} kN·m (${nomeComb(vv.comb.Mdpos)}) · Vd,máx = ${f(vv.Vd)} kN (${nomeComb(vv.comb.Vd)})`),
    ...apoios.map((a, k) => `Apoio ${k + 1}: Md− = ${f(a.Mdneg)} kN·m${a.comb.Mdneg ? ` (${nomeComb(a.comb.Mdneg)})` : ''} · Rk = ${f(a.Rg)} + ${f(a.Rq)} kN · Rd = ${f(a.Rd)} kN (${nomeComb(a.comb.Rd)})${a.RdMin < -1e-6 ? ` · Rd,mín = ${f(a.RdMin)} kN (${nomeComb(a.comb.RdMin)}): apoio tracionado` : ''}`),
  ] });
  if (mesa) {
    const nomeM = mesa.tipo === 'T' ? 'Viga T' : 'Viga L';
    memorial.push({ titulo: `${nomeM} — mesa colaborante (NBR 6118, 14.6.2.2)`, linhas: [
      `Mesa hf = ${f(hf, 1)} cm · alma bw = ${variavel ? secs.map((x) => f(x.b, 1)).join(' / ') : f(secs[0].b, 1)} cm · ${mesa.tipo === 'T' ? `distância livre entre as faces das nervuras: b2 = ${f(Number(mesa.b2a) || 0, 0)} cm de um lado e ${f(Number(mesa.b2b ?? mesa.b2a) || 0, 0)} cm do outro · b1 ≤ 0,5·b2 e b1 ≤ 0,10·a` : `laje de um lado, b2 = ${f(Number(mesa.b2) || 0, 0)} cm (b1 ≤ 0,5·b2 e ≤ 0,10·a)${Number(mesa.b4) > 0 ? ` · aba em balanço do outro lado, b4 = ${f(Number(mesa.b4), 0)} cm (b3 ≤ b4 e ≤ 0,10·a)` : ' · sem aba do outro lado'}`}`,
      inv.todos ? 'Viga invertida: a laje fica embaixo e a mesa só é comprimida nos apoios (momento negativo); nos vãos, seção retangular bw × h.' : invertida ? 'Vãos normais: a mesa é comprimida no vão; vãos invertidos: a mesa (embaixo) só é comprimida nos apoios vizinhos a eles.' : 'A laje fica em cima: a mesa é comprimida nos vãos (momento positivo); nos apoios, a mesa fica tracionada e vale a seção retangular bw × h.',
      ...mesaVao.map((m, v) => `Vão ${v + 1} (ℓ = ${f(L[v])} m, ${m.caso}): a = ${f(m.fator)}·ℓ = ${f(m.a)} m · 0,10·a = ${f(m.lim, 1)} cm · ${mesa.tipo === 'T' ? `b1 = ${f(m.b1a, 1)} + ${f(m.b1b, 1)} cm` : `b1 = ${f(m.b1, 1)} cm${m.b3 ? ` · b3 = ${f(m.b3, 1)} cm` : ''}`} → bf = ${f(m.bf, 1)} cm${m.balanco ? ' (balanço: mesa tracionada, seção retangular)' : ''}`),
      'Os esforços são da análise com a seção retangular bw × h; a mesa entra no dimensionamento à flexão, na armadura mínima (W0 da seção T) e nas flechas e fissuras (Ic e estádio II da seção T, Mr com α = 1,2). Cortante e torção usam a alma bw.',
    ] });
    const ligs = vaos.map((vv, v) => vv.lig && `Vão ${v + 1}: vSd = (Vd/z)·(b1/bf) = (${f(vv.Vd)}/${f(0.9 * (vv.pos?.flex.d ?? alturaUtil(null, vv.sec.h)) / 100, 3)})·(${f(vv.mesa.bMax, 1)}/${f(vv.mesa.bf, 1)}) = ${f(vv.lig.vSd)} kN/m · vRd2 = 0,5·αv2·fcd·hf = ${f(vv.lig.vRd2)} kN/m · Asf/s = vSd/fyd = ${f(vv.lig.AsfCalc)} cm²/m → ${f(vv.lig.Asf)} cm²/m (mín. 1,5 cm²/m), atravessando a ligação na laje`).filter(Boolean);
    if (ligs.length) memorial.push({ titulo: 'Ligação mesa–alma (18.3.7)', linhas: [
      'A força de compressão nas abas varia ao longo da viga e passa para a alma por cisalhamento no plano da ligação: biela a 45° no plano da mesa e armadura transversal à viga, que pode ser a própria armadura da laje que atravessa a ligação.',
      ...ligs,
    ] });
  }
  const linhaFlex = (rot, x) => x && `${rot}: ${x.mesa ? (x.flex.comoT ? `seção T (λx > hf): abas Ff = σcd·(bf − bw)·hf = ${f(x.flex.Ff)} kN, Mf = Ff·(d − hf/2) = ${f(x.flex.Mf)} kN·m, a alma resiste a ${f(x.flex.Md - x.flex.Mf)} kN·m · ` : `λx ≤ hf: retangular bf × h com bf = ${f(x.mesa.bf, 1)} cm · `) : ''}d = ${f(x.flex.d)} cm · Kmd = ${f(x.flex.Kmd, 4)} · x/d = ${f(x.flex.xi, 3)} (domínio ${x.flex.dominio}) · As,calc = ${f(x.flex.AsCalc)} cm² · As,mín = ${f(x.flex.AsMin)} cm² → ${x.barras?.rotulo ?? '—'} (${f(x.barras?.AsEf)} cm²)${x.flex.Asl ? ` · As' = ${f(x.flex.Asl)} cm²` : ''}`;
  memorial.push({ titulo: 'Flexão', linhas: [
    ...vaos.map((vv, v) => linhaFlex(`Vão ${v + 1}`, vv.pos)),
    ...apoios.map((a, k) => linhaFlex(`Apoio ${k + 1}`, a.neg)),
  ].filter(Boolean) });
  memorial.push({ titulo: 'Força cortante — modelo I', linhas: vaos.map((vv, v) =>
    `Vão ${v + 1}: VRd2 = ${f(vv.est.VRd2)} kN · Vc = ${f(vv.est.Vc)} kN · Asw/s = ${f(vv.est.aswCalc)} cm²/m (mín. ${f(vv.est.aswMin)})${vv.tor ? ` + torção 2·A90/s = ${f(2 * vv.tor.A90)} cm²/m` : ''}${vv.susp ? ` + suspensão ${f(vv.susp.asw)} cm²/m` : ''}${vv.tor || vv.susp ? ` → total ${f(vv.est.asw)} cm²/m` : ''} → ø${f(vv.est.estribo.phi, 1)} c/ ${f(vv.est.estribo.s, 1)} cm`) });
  if (invertida) {
    const pont = suspensas.P.filter((pp) => secs[pp.vao]?.invertida).map((pp) => ({ ...pp, Pd: gg * pp.g + gq * pp.q })).filter((pp) => pp.Pd > 0.01);
    memorial.push({ titulo: 'Viga invertida — armadura de suspensão (18.3.6)', linhas: [
      'A laje se apoia na face inferior da viga: as reações das lajes e das escadas sobem até o banzo comprimido por estribos de suspensão, somados aos da cortante.',
      ...vaos.map((vv, v) => (vv.susp ? `Vão ${v + 1}: pd = γg·g + γq·q = ${f(vv.susp.pd)} kN/m pendurados → Asw,susp/s = pd/fywd = ${f(vv.susp.asw)} cm²/m (nos dois ramos)` : vv.sec.invertida ? `Vão ${v + 1}: sem cargas penduradas` : `Vão ${v + 1}: normal (laje em cima), sem suspensão`)),
      ...pont.map((pp) => `Reação de ${pp.codigo} no vão ${pp.vao + 1}, x = ${f(pp.x)} m: Pd = ${f(pp.Pd)} kN → As,susp = Pd/fywd = ${f(pp.Pd / fywd)} cm² em estribos junto à carga, além dos da cortante`),
    ] });
    for (const pp of pont) avisos.push(`Viga invertida: concentrar ${f(pp.Pd / fywd)} cm² de estribos de suspensão junto à reação de ${pp.codigo} (vão ${pp.vao + 1}, x = ${f(pp.x)} m).`);
  }
  if (temTorcao) memorial.push({ titulo: 'Torção de equilíbrio — treliça espacial, θ = 45° (17.5)', linhas: [
    'Os apoios restringem a rotação da viga em torno do eixo; torque distribuído t: T = t·(L/2 − x) entre dois apoios e T = t·(L − x) no balanço.',
    ...vaos.map((vv, v) => (vv.tor
      ? `Vão ${v + 1}: TSd = ${f(vv.tor.Td)} kN·m (${vv.tor.comb}) · c1 = ${f(vv.tor.c1)} cm · he = A/u = ${f(vv.tor.he)} cm · Ae = ${f(vv.tor.Ae, 0)} cm² · ue = ${f(vv.tor.ue, 1)} cm · TRd2 = 0,5·αv2·fcd·Ae·he = ${f(vv.tor.TRd2)} kN·m · VSd/VRd2 + TSd/TRd2 = ${f(vv.tor.interacao)} · A90/s = TSd/(2·Ae·fywd) = ${f(vv.tor.A90Calc)} cm²/m por ramo (mín. ${f(vv.tor.A90Min)}) · Asl = TSd·ue/(2·Ae·fyd) = ${f(vv.tor.AslCalc)} cm² (mín. ${f(vv.tor.AslMin)}) → ${f(vv.tor.Asl)} cm² distribuídos no perímetro, com uma barra em cada canto`
      : `Vão ${v + 1}: sem momento torçor`)),
  ] });
  memorial.push({ titulo: 'Flechas (ELS-DEF, combinação quase permanente)', linhas: [
    `Carga de longa duração aplicada aos ${f(t0, 1)} mês(es): Δξ = ξ(70) − ξ(t0) = ${f(vaos[0]?.flecha.dXi ?? 0, 3)} (Tabela 17.1) · αf = Δξ/(1 + 50ρ')`,
    ...vaos.map((vv, v) =>
      `Vão ${v + 1}: Ma = ${f(vv.els.Ma)} kN·m · Mr = ${f(vv.els.Mr)} kN·m · ${vv.els.fissurada ? `Ieq = ${f(vv.flecha.Ieq, 0)} cm⁴ (Branson)` : 'Estádio I'} · imediata f0 = ${f(vv.flecha.f0)} mm · diferida αf·f0 = ${f(vv.flecha.alfaF)} × ${f(vv.flecha.f0)} = ${f(vv.flecha.fdif)} mm · total f∞ = ${f(vv.flecha.ft)} mm ≤ ${f(vv.flecha.lim)} mm · acidental ${f(vv.flecha.fQ)} mm ≤ ${f(vv.flecha.limQ)} mm`),
  ] });
  const linhaFiss = (rot, w) => w && `${rot}: Ms,freq = ${f(w.Ms)} kN·m (${w.comb}) · Mr = ${f(w.Mr)} kN·m · ${w.fissurada
    ? `σs = ${f(w.sigma, 1)} MPa (estádio II, αe = 15) · Acr = ${f(w.Acr, 1)} cm² · ρr = ${f(w.rho * 100, 2)} % · w1 = ${f(w.w1, 3)} mm · w2 = ${f(w.w2, 3)} mm → wk = ${f(w.wk, 2)} mm ≤ ${f(w.lim, 1)} mm`
    : 'Ms < Mr: a seção não fissura'}`;
  memorial.push({ titulo: 'Abertura de fissuras (ELS-W, combinação frequente)', linhas: [
    `η1 = ${f(eta1)} (CA-${s.fyk / 10}) · fct,m = ${f(c.fctm, 3)} MPa · Mr = 1,5·fctk,inf·Ic/yt (formação de fissuras) · limite wk ≤ ${f(wLim, 1)} mm para CAA ${caa} (Tabela 13.4)`,
    ...vaos.map((vv, v) => linhaFiss(`Vão ${v + 1}`, vv.fiss)),
    ...apoios.map((a, k) => linhaFiss(`Apoio ${k + 1}`, a.fiss)),
  ].filter(Boolean) });
  if (el.vaos.length > 1) avisos.push('Sobrecargas aplicadas em todos os vãos (sem alternância de cargas) — simplificação do protótipo.');

  // ---------------------------------------------------------------- grelha do pavimento × viga isolada
  let saidaGrelha = null;
  if (grelha) {
    const emGrelha = grelha.modo === 'grelha' && !!grelha.viga;
    if (grelha.modo === 'grelha' && !grelha.viga) avisos.push(`A grelha do pavimento não pôde ser resolvida (${grelha.erro ?? 'viga fora do modelo'}): a viga foi calculada isolada.`);
    if (emGrelha) {
      for (const a of grelha.avisos) avisos.push(`Grelha: ${a}`);
      avisos.push('Grelha: flechas calculadas na viga isolada sobre apoios rígidos e torção dimensionada como de equilíbrio (sem a torção de compatibilidade da grelha).');
    }
    const outro = grelha.viga ? (emGrelha ? iso : { rG: grelha.viga.rG, rQ: grelha.viga.rQ }) : null;
    const resumoDe = (rg, rq) => resumoELU(rg, rq, elu, L, xApoio, el.apoios);
    const atual = resumoDe(rG, rQ);
    const alt = outro ? resumoDe(outro.rG, outro.rQ) : null;
    const [rIso, rGre] = emGrelha ? [alt, atual] : [atual, alt];
    saidaGrelha = {
      modo: grelha.modo, ativa: emGrelha, erro: grelha.erro, fatorTorcao: FATOR_TORCAO_GRELHA,
      tipoApoio: grelha.viga?.tipoApoio ?? null,
      interacoes: (grelha.viga?.interacoes ?? []).map((it) => {
        const mx = extremo(elu, { G: it.Rg, Q: it.Rq }).valor, mn = extremo(elu, { G: it.Rg, Q: it.Rq }, { menor: true }).valor;
        return { ...it, Rd: Math.abs(mx) >= Math.abs(mn) ? mx : mn };
      }),
      comparacao: rGre && {
        vaos: rIso.vaos.map((m, v) => ({ iso: m, grelha: rGre.vaos[v] })),
        apoios: rIso.apoios.map((a, k) => ({ isoM: a.M, grelhaM: rGre.apoios[k].M, isoR: a.R, grelhaR: rGre.apoios[k].R })),
      },
    };
    const tipoAp = (k) => { const t = saidaGrelha.tipoApoio?.[k]; return !t ? 'livre' : t.tipo === 'pilar' ? `pilar ${t.pilar}` : t.tipo === 'viga' ? `sobre a viga ${t.vigas.map((id) => ctx.elemento(id)?.codigo).join(', ')}` : 'apoio sem pilar'; };
    if (grelha.viga) memorial.push({ titulo: `Grelha do pavimento (NBR 6118, 14.7.6) — ${emGrelha ? 'usada no dimensionamento' : 'só para comparação'}`, linhas: [
      `Vigas do pavimento como grelha (pórtico plano carregado fora do plano): EI com a seção bruta e Ecs; rigidez à torção reduzida a ${f(FATOR_TORCAO_GRELHA * 100, 0)} % (fissuração); pilares como apoios com molas de rotação 4·E·I/ℓ por lance (engastamento elástico).`,
      ...el.apoios.map((tp, k) => (tp === 'livre' ? null : `Apoio ${k + 1}: ${tipoAp(k)}`)).filter(Boolean),
      ...saidaGrelha.interacoes.map((it) => textoInteracao(it, el.codigo)),
      ...(saidaGrelha.comparacao ? [
        ...saidaGrelha.comparacao.vaos.map((c, v) => `Vão ${v + 1}: Md+ isolada = ${f(c.iso)} kN·m · grelha = ${f(c.grelha)} kN·m`),
        ...saidaGrelha.comparacao.apoios.map((c, k) => (el.apoios[k] === 'livre' ? null : `Apoio ${k + 1}: Md− isolada = ${f(c.isoM)} · grelha = ${f(c.grelhaM)} kN·m · Rd isolada = ${f(c.isoR)} · grelha = ${f(c.grelhaR)} kN`)).filter(Boolean),
      ] : []),
    ] });
  }

  // ---------------------------------------------------------------- detalhamento das armaduras (9.4, 9.5, 18.3)
  let detalhamento = null;
  try {
    detalhamento = detalharViga({
      L, apoios: el.apoios, b: secs[0].b, h: secs[0].h, secoes: secs, cob, fctd: c.fctd, fyd: s.fyd,
      largura: largurasDosApoios(el, ctx),
      pts: pts.map((q) => ({ x: q.x, Md: q.Md, MdMin: q.MdMin })),
      vaos: vaos.map((vv) => ({
        barras: vv.pos?.barras, d: vv.pos?.flex.d ?? alturaUtil(null, vv.sec.h), Vd: vv.Vd, Vc: vv.est.Vc,
        estribo: vv.est.estribo, torcao: vv.tor && { Asl: vv.tor.Asl, ue: vv.tor.ue, c1: vv.tor.c1 },
      })),
      negs: apoios.map((a) => a.neg && { barras: a.neg.barras, d: a.neg.flex.d }),
      Rd: apoios.map((a) => a.Rd),
    });
    memorial.push({ titulo: 'Detalhamento das armaduras (9.4, 9.5, 17.4.2.2, 18.3)', linhas: [
      `Aderência: fbd = η1·η2·η3·fctd = 2,25 × η2 × 1,0 × ${f(c.fctd, 3)} MPa (η2 = 1,0 em boa aderência; 0,7 em má) · lb = (ø/4)·(fyd/fbd) ≥ 25ø`,
      'Cortes: barra termina aℓ + lb além do ponto em que deixa de ser necessária no diagrama deslocado; aℓ = d·VSd/[2·(VSd − Vc)] entre 0,5·d e d',
      `Apoios: ${detalhamento.larguras.map((l, k) => (el.apoios[k] === 'livre' ? null : `${k + 1}: ${f(l, 0)} cm`)).filter(Boolean).join(' · ')} de largura na direção da viga · nos extremos as barras vão até a face menos o cobrimento, com gancho a 90° (+10ø); nos internos, 10ø além da face`,
      ...detalhamento.posicoes.filter((q) => q.tipo !== 'estribo').map((q) => `${q.N} — ${q.local}: ${q.n} ø${f(q.phi, 1).replace(',0', '')} · ${f(q.comprimento, 0)} cm${q.lb ? ` (lb = ${q.lb} cm${q.al ? `, aℓ = ${q.al} cm` : ''})` : ''}${q.ganchos ? ` · ${q.ganchos} gancho${q.ganchos > 1 ? 's' : ''}` : ''}${q.emendas ? ` · ${q.emendas} emenda${q.emendas > 1 ? 's' : ''} por traspasse de ${q.l0t} cm (9.5.2)` : ''}`),
    ] });
  } catch (e) {
    avisos.push(`Detalhamento automático indisponível: ${e.message}`);
  }

  // ---------------------------------------------------------------- saída compacta
  const r2 = (v) => Math.round(v * 100) / 100 || 0; // || 0 evita "-0"
  const r3 = (v) => Math.round(v * 1000) / 1000 || 0;
  const saidaFiss = (w) => w && { Ms: r2(w.Ms), comb: w.comb, Mr: r2(w.Mr), fissurada: w.fissurada, sigma: r2(w.sigma), w1: r3(w.w1), w2: r3(w.w2), wk: r3(w.wk), Acr: r2(w.Acr), rho: Math.round(w.rho * 1e5) / 1e5, lim: w.lim, ok: w.ok };
  const flecha = rEls.pontos.map((p) => r2(Math.abs(p.v) * 1000));
  const arranjo = (x) => x && { As: r2(x.flex.As), AsCalc: r2(x.flex.AsCalc), Asl: r2(x.flex.Asl), d: r2(x.flex.d), dupla: x.flex.dupla, barras: x.barras && { phi: x.barras.phi, n: x.barras.n, camadas: x.barras.camadas, AsEf: r2(x.barras.AsEf), rotulo: x.barras.rotulo }, barrasComp: x.barrasComp && { phi: x.barrasComp.phi, n: x.barrasComp.n, rotulo: x.barrasComp.rotulo } };

  return {
    ok: verificacoes.every((v) => v.ok) && !avisos.some((a) => a.includes('aumente')),
    invertida,
    secoes: secs.map((x) => ({ b: x.b, h: x.h, invertida: x.invertida, topo: r2(x.topo), base: r2(x.base) })),
    secaoVariavel: variavel,
    mesa: mesa ? { tipo: mesa.tipo, hf } : null,
    avisos, verificacoes, memorial,
    detalhamento,
    diagrama: {
      x: pts.map((p) => r2(p.x)),
      Md: pts.map((p) => r2(p.Md)), MdMin: pts.map((p) => r2(p.MdMin)),
      Vd: pts.map((p) => r2(p.VdMax)), VdMin: pts.map((p) => r2(p.VdMin)),
      ...(temTorcao ? { Td: pts.map((p) => r2(p.Td ?? 0)) } : {}),
      flecha,
    },
    combinacoes: combinacoes.map(({ id, tipo, nome, expressao }) => ({ id, tipo, nome, expressao })),
    grelha: saidaGrelha,
    casos: casosDaViga(rG, rQ, rPP, L),
    vaos: vaos.map((vv) => ({
      L: vv.L, x0: vv.x0, gk: r2(vv.gk), qk: r2(vv.qk), Mdpos: r2(vv.Mdpos), Vd: r2(vv.Vd), comb: vv.comb,
      positiva: arranjo(vv.pos),
      mesa: vv.mesa && { bf: r2(vv.mesa.bf), a: r2(vv.mesa.a), comoT: !!vv.pos?.flex.comoT },
      ligacaoMesa: vv.lig && { vSd: r2(vv.lig.vSd), vRd2: r2(vv.lig.vRd2), Asf: r2(vv.lig.Asf), ok: vv.lig.ok },
      torcao: vv.tor && { Td: r2(vv.tor.Td), comb: vv.tor.comb, TRd2: r2(vv.tor.TRd2), interacao: r2(vv.tor.interacao), he: r2(vv.tor.he), Ae: r2(vv.tor.Ae), ue: r2(vv.tor.ue), A90: r2(vv.tor.A90), A90Calc: r2(vv.tor.A90Calc), Asl: r2(vv.tor.Asl), AslCalc: r2(vv.tor.AslCalc), AslMin: r2(vv.tor.AslMin), ok: vv.tor.ok },
      suspensao: vv.susp && { pd: r2(vv.susp.pd), asw: r2(vv.susp.asw) },
      estribos: { VRd2: r2(vv.est.VRd2), Vc: r2(vv.est.Vc), asw: r2(vv.est.asw), aswV: r2(vv.est.aswV ?? vv.est.asw), ...vv.est.estribo, rotulo: `ø ${f(vv.est.estribo.phi, 1).replace(',0', '')} c/ ${f(vv.est.estribo.s, 1).replace(',0', '')}` },
      flecha: { f0: r2(vv.flecha.f0), alfaF: r2(vv.flecha.alfaF), fdif: r2(vv.flecha.fdif), ft: r2(vv.flecha.ft), lim: r2(vv.flecha.lim), ok: vv.flecha.ok, fQ: r2(vv.flecha.fQ), limQ: r2(vv.flecha.limQ), okQ: vv.flecha.okQ },
      fissuras: saidaFiss(vv.fiss),
    })),
    apoios: apoios.map((a) => ({ tipo: a.tipo, x: a.x, Mdneg: r2(a.Mdneg), negativa: arranjo(a.neg), fissuras: saidaFiss(a.fiss), Rg: r2(a.Rg), Rq: r2(a.Rq), Rd: r2(a.Rd), RdMin: r2(a.RdMin), comb: a.comb })),
    resumo: {
      MdMax: r2(Math.max(...pts.map((p) => p.Md))), MdMin: r2(Math.min(...pts.map((p) => p.MdMin))),
      VdMax: r2(Math.max(...pts.map((p) => Math.abs(p.Vd)))),
      utilBiela: Math.max(...vaos.map((vv) => (vv.tor ? vv.tor.interacao : vv.Vd / vv.est.VRd2))),
      flechaRazao: Math.max(...vaos.map((vv) => vv.flecha.ft / vv.flecha.lim)),
      taxaMax: Math.max(0, ...[...vaos.map((v) => v.pos), ...apoios.map((a) => a.neg)].filter(Boolean).map((x) => (x.barras?.AsEf ?? x.flex.As) / (x.b * x.h))),
    },
  };
}

/**
 * Largura de cada apoio na direção do eixo da viga (cm): a informada no detalhamento, a do pilar ligado
 * (bx·|cos θ| + by·|sen θ|, θ = ângulo entre a viga e o pilar) ou a da viga que a recebe; sem ligação, 20 cm.
 */
export function largurasDosApoios(el, ctx) {
  const fixa = Number(el.detalhamento?.largura);
  const elementos = ctx.projeto?.elementos ?? [];
  const recebe = (e, k) => (e.cargas ?? []).some((c) => c.tipo === 'elemento' && c.elementoId === el.id && c.ligacao === `apoio-${k}`);
  return el.apoios.map((t, k) => {
    if (fixa > 0) return fixa;
    const pl = elementos.find((p) => p.modulo === 'concreto.pilar' && recebe(p, k));
    if (!pl) {
      const vg = elementos.find((p) => p.modulo === 'concreto.viga' && p.id !== el.id && recebe(p, k));
      return vg?.secao?.b ?? 20;                          // apoiada em outra viga: a largura da viga que a recebe
    }
    if (pl.forma === 'circular' || pl.diametro) return pl.diametro ?? 20;
    const th = (((el.posicao?.angulo ?? 0) - (pl.posicao?.angulo ?? 0)) * Math.PI) / 180;
    return Math.abs(Math.cos(th)) * (pl.bx ?? 20) + Math.abs(Math.sin(th)) * (pl.by ?? 20);
  });
}

/** Md+ máximo por vão, Md− por apoio e Rd por apoio (envoltória ELU) — para comparar isolada × grelha. */
function resumoELU(rG, rQ, elu, L, xApoio, tipos) {
  const r2 = (v) => Math.round(v * 100) / 100 || 0;
  const env = envolvente(elu, { G: rG.pontos.map((p) => p.M), Q: rQ.pontos.map((p) => p.M) });
  const vaos = L.map((_, v) => r2(Math.max(0, ...rG.pontos.map((p, i) => (p.vao === v ? env.max[i] : -Infinity)))));
  const apoios = xApoio.map((x, k) => ({
    M: r2(Math.min(0, ...rG.pontos.map((p, i) => (Math.abs(p.x - x) < 1e-6 ? env.min[i] : Infinity)))),
    R: tipos[k] === 'livre' ? 0 : r2(extremo(elu, { G: rG.reacoes[k].V, Q: rQ.reacoes[k].V }).valor),
  }));
  return { vaos, apoios };
}

/**
 * Esforços característicos por caso, para conferência: G1 = peso próprio, G2 = demais permanentes, Q = uso.
 * Por vão: maior momento positivo; por apoio: momento e reação.
 */
function casosDaViga(rG, rQ, rPP, L) {
  const r2 = (v) => Math.round(v * 100) / 100 || 0;
  const sub = (a, b) => (b ? a.map((x, i) => x - b[i]) : a);
  const M = { G: rG.pontos.map((p) => p.M), Q: rQ.pontos.map((p) => p.M) };
  const PP = rPP ? rPP.pontos.map((p) => p.M) : null;
  const porVao = (arr) => L.map((_, v) => r2(Math.max(0, ...rG.pontos.map((p, i) => (p.vao === v ? arr[i] : -Infinity)))));
  const casos = [];
  if (PP) casos.push({ id: 'G1', nome: 'Peso próprio', grupo: 'G', Mvao: porVao(PP), R: rPP.reacoes.map((r) => r2(r.V)) });
  casos.push({ id: PP ? 'G2' : 'G', nome: PP ? 'Demais permanentes' : 'Permanentes', grupo: 'G', Mvao: porVao(sub(M.G, PP)), R: rG.reacoes.map((r, k) => r2(r.V - (rPP?.reacoes[k].V ?? 0))) });
  casos.push({ id: 'Q', nome: 'Variável de uso', grupo: 'Q', Mvao: porVao(M.Q), R: rQ.reacoes.map((r) => r2(r.V)) });
  return casos;
}

/** Dados iniciais de uma viga nova. */
export function criarViga() {
  return {
    secao: { b: 20, h: 50 },
    vaos: [{ L: 5 }],
    apoios: ['apoio', 'apoio'],
    pesoProprio: true,
    armadura: { inferior: 'auto', superior: 'auto', estribo: 'auto' },
    cargas: [
      { id: 'c1', tipo: 'alvenaria', vao: 'todos', material: 'ceramico-vedacao', espessura: 14, revestimento: 2, altura: 2.7, aberturas: 0, descricao: 'Parede' },
      { id: 'c2', tipo: 'distribuida', natureza: 'q', vao: 'todos', valor: 3, descricao: 'Sobrecarga' },
    ],
  };
}
