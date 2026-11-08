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
 * Detalhamento das armaduras a partir do projeto: liga o motor (src/engine/detalhamento.js) aos elementos vizinhos.
 *
 *   - vigas: o detalhamento sai do próprio cálculo (resultado.detalhamento);
 *   - pilares: o lance de cima (traspasse) e o que está embaixo (fundação, viga ou pilar → arranques);
 *   - lajes maciças: a largura das vigas de cada borda e a laje vizinha de cada borda engastada (negativos de
 *     uma laje para a outra, detalhados uma vez só, na laje de código menor).
 *
 * As funções são puras e rápidas: as telas, os quantitativos e a exportação chamam na hora, sem guardar nada no
 * arquivo além das edições do usuário (elemento.detalhamento.edicoes).
 */
import { detalharPilar, detalharLaje, aplicarEdicoes, areaBarra } from '../../engine/detalhamento.js';
import { contextoConcreto } from '../../engine/materiais.js';
import { bordasLaje } from '../../renderer/core/montagem.js';
import { geometriaNervurada } from './nervurada-geometria.js';

const PILAR = 'concreto.pilar', VIGA = 'concreto.viga', LAJE = 'concreto.laje.macica', NERVURADA = 'concreto.laje.nervurada';
const FUNDACOES = ['concreto.sapata', 'concreto.bloco'];
const FERRAGEM_FUNDACAO = ['concreto.sapata', 'concreto.bloco', 'geotecnia.estaca'];
const recebe = (e, id, ligacao) => (e.cargas ?? []).some?.((c) => c.tipo === 'elemento' && c.elementoId === id && (ligacao == null || c.ligacao === ligacao));
const comparar = (a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true });

/** O que está embaixo do pilar: fundação, pilar do nível de baixo ou viga em que ele nasce. */
export function baseDoPilar(el, projeto) {
  const els = projeto?.elementos ?? [];
  const fund = els.find((e) => FUNDACOES.includes(e.modulo) && e.pilarId === el.id);
  if (fund) return { tipo: 'fundacao', codigo: fund.codigo, id: fund.id, h: fund.resultado?.h ?? fund.geometria?.h ?? 50, cob: fund.resultado?.cobrimento ?? fund.cobrimento ?? 5 };
  const pilar = els.find((e) => e.modulo === PILAR && e.id !== el.id && recebe(e, el.id, 'base'));
  if (pilar) return { tipo: 'pilar', codigo: pilar.codigo, id: pilar.id };
  const viga = els.find((e) => e.modulo === VIGA && recebe(e, el.id, 'base'));
  if (viga) return { tipo: 'viga', codigo: viga.codigo, id: viga.id, h: viga.secao?.h ?? 40, cob: projeto.parametros?.cobrimento?.viga ?? 3 };
  return { tipo: null };
}

/** Há pilar no lance de cima? (ele descarrega na base deste) */
export function pilarAcima(el, projeto) {
  return (el.cargas ?? []).find((c) => c.tipo === 'elemento' && c.ligacao === 'base' && projeto?.elementos?.find((e) => e.id === c.elementoId)?.modulo === PILAR) ?? null;
}

export function detalhamentoPilar(el, resultado = el.resultado, projeto) {
  const arm = resultado?.armadura;
  if (!arm?.phi || resultado?.erro) return null;
  const m = contextoConcreto(projeto?.parametros);
  return detalharPilar({
    ...(el.forma === 'circular' ? { bx: Number(el.D) || el.bx, by: Number(el.D) || el.bx, circular: true } : { bx: el.bx, by: el.by }),
    cob: arm.cobrimento ?? projeto?.parametros?.cobrimento?.pilar ?? 3, L: el.comprimento,
    barras: { phi: arm.phi, n: arm.n }, pontos: arm.pontos ?? [], estribo: arm.estribo,
    fctd: m.concreto.fctd, fyd: m.aco.fyd, acima: !!pilarAcima(el, projeto), base: baseDoPilar(el, projeto),
  });
}

/* ------------------------------------------------------------------ lajes */

const OPOSTA = { x0: 'x1', x1: 'x0', y0: 'y1', y1: 'y0' };

/** Largura (cm) da viga que recebe a borda da laje; 15 cm sem viga ligada; 0 na borda livre. */
function apoioDaBorda(laje, borda, projeto) {
  if (laje.bordas?.[borda] === 'livre') return 0;
  const v = (projeto?.elementos ?? []).find((e) => e.modulo === VIGA && recebe(e, laje.id, borda));
  return v?.secao?.b ?? 15;
}

/** Barras de uma direção no resultado da laje: positiva ou negativa x/y. */
function barrasDe(resultado, tipo, dir) {
  const a = (resultado?.armaduras ?? []).find((x) => x.rotulo?.startsWith(`${tipo} ${dir}`));
  return a?.barras?.phi ? { ...a.barras, As: a.barras.AsEf ?? (areaBarra(a.barras.phi) * 100) / a.barras.s } : null;
}

/** Trechos da borda `borda` desta laje que coincidem com bordas engastadas de lajes vizinhas: [{ laje, borda, t0, t1 }]. */
export function vizinhasNaBorda(laje, borda, projeto, modulos = [LAJE]) {
  if (!laje.posicao) return [];
  const [P, Q] = bordasLaje(laje)[borda];
  const len = Math.hypot(Q[0] - P[0], Q[1] - P[1]);
  if (!(len > 0)) return [];
  const u = [(Q[0] - P[0]) / len, (Q[1] - P[1]) / len];
  const dist = (R) => Math.abs((R[0] - P[0]) * u[1] - (R[1] - P[1]) * u[0]);
  const t = (R) => (R[0] - P[0]) * u[0] + (R[1] - P[1]) * u[1];
  const out = [];
  for (const o of projeto?.elementos ?? []) {
    if (o.id === laje.id || !modulos.includes(o.modulo) || !o.posicao || o.posicao.pavimento !== laje.posicao.pavimento) continue;
    for (const [b2, [R, S]] of Object.entries(bordasLaje(o))) {
      if (o.bordas?.[b2] !== 'engastada') continue;
      if (dist(R) > 0.15 || dist(S) > 0.15) continue;
      const t0 = Math.max(0, Math.min(t(R), t(S))), t1 = Math.min(len, Math.max(t(R), t(S)));
      if (t1 - t0 > 0.2) out.push({ laje: o, borda: b2, t0, t1 });
    }
  }
  return out.sort((a, b) => a.t0 - b.t0);
}

export function detalhamentoLaje(el, resultado = el.resultado, projeto) {
  if (!resultado || resultado.erro || !(resultado.armaduras?.length)) return null;
  const { lx, ly, h = 10, bordas = {} } = el;
  const cob = projeto?.parametros?.cobrimento?.laje ?? 2.5;
  const apoios = Object.fromEntries(['x0', 'x1', 'y0', 'y1'].map((b) => [b, apoioDaBorda(el, b, projeto)]));
  const positivas = { x: barrasDe(resultado, 'Positiva', 'x'), y: barrasDe(resultado, 'Positiva', 'y') };
  const negativos = [], notas = [];
  const balanco = (laje, b) => laje.bordas?.[OPOSTA[b]] === 'livre';
  for (const b of ['x0', 'x1', 'y0', 'y1']) {
    if (bordas[b] !== 'engastada') continue;
    const dir = b[0];
    const proprio = barrasDe(resultado, 'Negativa', dir);
    if (!proprio) continue;
    const Lb = (dir === 'x' ? ly : lx);                 // comprimento da borda
    const lp = (dir === 'x' ? lx : ly) * 100;           // vão perpendicular à borda (cm)
    const aqui = balanco(el, b) ? lp - cob : 0.25 * lp;
    const viz = vizinhasNaBorda(el, b, projeto);
    let cursor = 0;
    const livres = [];
    for (const v of viz) {
      if (v.t0 > cursor + 0.2) livres.push([cursor, v.t0]);
      cursor = Math.max(cursor, v.t1);
      const lpo = (v.borda[0] === 'x' ? v.laje.lx : v.laje.ly) * 100;
      if (comparar(el.codigo, v.laje.codigo) > 0) { notas.push(`Negativa da borda ${b} (com ${v.laje.codigo}) detalhada em ${v.laje.codigo}.`); continue; }
      const dele = barrasDe(v.laje.resultado, 'Negativa', v.borda[0]);
      const barra = dele && dele.As > proprio.As ? dele : proprio;
      const base = 0.25 * Math.max(lp, lpo);
      let a1 = balanco(el, b) ? lp - cob : base;
      let a2 = balanco(v.laje, v.borda) ? lpo - cob : base;
      if (balanco(el, b)) a2 = Math.max(a2, a1); else if (balanco(v.laje, v.borda)) a1 = Math.max(a1, a2);
      negativos.push({ borda: b, phi: barra.phi, s: barra.s, As: barra.As, t0: v.t0, t1: v.t1, a1, a2, outro: v.laje.codigo });
    }
    if (Lb > cursor + 0.2) livres.push([cursor, Lb]);
    for (const [t0, t1] of livres) {
      // sem laje do outro lado: a negativa entra na viga até a face oposta menos o cobrimento
      negativos.push({ borda: b, phi: proprio.phi, s: proprio.s, As: proprio.As, t0, t1, a1: aqui, a2: Math.max(5, apoios[b] - cob) });
      if (balanco(el, b)) notas.push(`Balanço sem laje vizinha na borda ${b}: a negativa ancora só na viga — confira a ancoragem e a torção da viga.`);
    }
  }
  const det = detalharLaje({ lx, ly, h, cob, bordas, apoios, positivas, negativos });
  det.avisos.push(...notas);
  return det;
}

/* ------------------------------------------------------------------ laje nervurada */

const arred5 = (cm) => Math.ceil(cm / 5 - 1e-9) * 5;
const virgula = (v) => String(Math.round(v * 10) / 10).replace('.', ',');

/**
 * Lista de ferros da laje nervurada (NBR 6118, 13.2.4.2 e 20.1): barras de cada nervura de face a face dos apoios,
 * travamentos (uma direção), negativas na capa sobre as bordas engastadas com a distribuição embaixo, malha da capa
 * (calculada quando o intereixo passa de 65 cm, construtiva ø 5 c/ 20 abaixo disso) e estribos das nervuras quando
 * o cortante as trata como viga. Coordenadas como em nervurada-geometria.js.
 */
export function detalhamentoNervurada(el, resultado = el.resultado, projeto) {
  if (!resultado || resultado.erro || !(resultado.armaduras?.length)) return null;
  const geo = geometriaNervurada(el);
  const { lx, ly, h, hf, bw } = geo;
  const bordas = el.bordas ?? {};
  const cob = projeto?.parametros?.cobrimento?.laje ?? 2.5;
  const apoios = Object.fromEntries(['x0', 'x1', 'y0', 'y1'].map((b) => [b, apoioDaBorda(el, b, projeto)]));
  // até a face oposta do apoio menos o cobrimento; na borda livre, até a borda menos o cobrimento
  const alem = (b) => (bordas[b] === 'livre' || !(apoios[b] > 0) ? -cob : apoios[b] / 2 - cob);
  const posicoes = [], avisos = [];
  const arm = (dir, neg) => resultado.armaduras.find((a) => !!a.negativa === neg && (a.dir ?? 'x') === dir && a.arranjo?.phi);

  // nervuras: n barras por nervura, de face a face dos apoios
  for (const dir of geo.duas ? ['x', 'y'] : ['x']) {
    const a = arm(dir, false);
    if (!a) continue;
    const eixos = dir === 'x' ? geo.nervurasX : geo.nervurasY;
    const [ia, ib] = dir === 'x' ? ['x0', 'x1'] : ['y0', 'y1'];
    const L = dir === 'x' ? lx : ly;
    const c = L + alem(ia) + alem(ib);
    const { phi, n, camadas = 1 } = a.arranjo;
    posicoes.push({ id: `nerv-${dir}`, tipo: 'positiva', face: 'inferior', dir, local: `Nervuras em ${dir}: ${eixos.length} × ${n} ø ${virgula(phi)}${camadas > 1 ? ` (${camadas} camadas)` : ''}, de face a face dos apoios`,
      phi, n: eixos.length * n, porNervura: n, camadas, eixos, comprimento: arred5(c), reto: c, ganchos: 0, gancho: [false, false], a: -alem(ia) / 100, b: (L + alem(ib)) / 100, emendas: 0 });
    if (c > 1200) avisos.push(`Nervuras em ${dir}: barras com ${virgula(c / 100)} m — mais que a barra comercial de 12 m; prever emenda por traspasse fora da região de momento máximo.`);
  }
  // travamentos (uma direção): construtivos, 2 barras no fundo, de face a face das bordas laterais
  if (geo.travamento.length) {
    const phi = Math.max(8, arm('x', false)?.arranjo?.phi ?? 8);
    const c = ly + alem('y0') + alem('y1');
    posicoes.push({ id: 'travamento', tipo: 'construtiva', face: 'inferior', dir: 'y', local: `Nervura${geo.travamento.length > 1 ? 's' : ''} de travamento (${geo.travamento.length}): 2 ø ${virgula(phi)} no fundo, prática usual (13.2.4.2)`,
      phi, n: 2 * geo.travamento.length, porNervura: 2, camadas: 1, eixos: geo.travamento, comprimento: arred5(c), reto: c, ganchos: 0, gancho: [false, false], a: -alem('y0') / 100, b: (ly + alem('y1')) / 100, emendas: 0 });
  }
  // negativas na capa, sobre as bordas engastadas: a1 para dentro desta laje, a2 para a vizinha (ou para dentro da viga)
  const balanco = (laje, b) => laje.bordas?.[{ x0: 'x1', x1: 'x0', y0: 'y1', y1: 'y0' }[b]] === 'livre';
  let ineg = 0;
  for (const b of ['x0', 'x1', 'y0', 'y1']) {
    if (bordas[b] !== 'engastada') continue;
    const dir = b[0];
    const a = arm(dir, true) ?? (geo.duas ? null : arm('x', true));
    if (!a) continue;
    const { phi, s } = a.arranjo;
    const Lb = dir === 'x' ? ly : lx;                  // comprimento da borda (cm)
    const lp = dir === 'x' ? lx : ly;                  // vão perpendicular (cm)
    const aqui = balanco(el, b) ? lp - cob : 0.25 * lp;
    const trechos = [];
    let cursor = 0;
    for (const v of vizinhasNaBorda(el, b, projeto, [NERVURADA])) {
      if (v.t0 * 100 > cursor + 20) trechos.push({ t0: cursor, t1: v.t0 * 100 });
      cursor = Math.max(cursor, v.t1 * 100);
      if (comparar(el.codigo, v.laje.codigo) > 0) { avisos.push(`Negativa da borda ${b} (com ${v.laje.codigo}) detalhada em ${v.laje.codigo}.`); continue; }
      const lpo = (v.borda[0] === 'x' ? v.laje.lx : v.laje.ly) * 100;
      let a1 = balanco(el, b) ? lp - cob : 0.25 * Math.max(lp, lpo), a2 = balanco(v.laje, v.borda) ? lpo - cob : 0.25 * Math.max(lp, lpo);
      if (balanco(el, b)) a2 = Math.max(a2, a1); else if (balanco(v.laje, v.borda)) a1 = Math.max(a1, a2);
      trechos.push({ t0: v.t0 * 100, t1: v.t1 * 100, a1, a2, outro: v.laje.codigo });
    }
    if (Lb > cursor + 20) trechos.push({ t0: cursor, t1: Lb });
    for (const tr of trechos) {
      const a1 = tr.a1 ?? aqui, a2 = tr.a2 ?? Math.max(5, apoios[b] - cob);
      const comp = tr.t1 - tr.t0;
      const n = Math.ceil(Math.max(0, comp - 2 * cob) / s - 1e-9) + 1;
      const k = ++ineg;
      posicoes.push({ id: `neg-${b}-${k}`, tipo: 'negativa', face: 'superior', dir, borda: b, local: `Negativa na capa, borda ${b}${tr.outro ? ` (com ${tr.outro})` : ''}: ø ${virgula(phi)} c/ ${virgula(s)} · ${Math.round(a1)} + ${Math.round(a2)} cm`,
        phi, n, s, comprimento: arred5(a1 + a2), reto: a1 + a2, ganchos: 0, gancho: [false, false], a1, a2, t0: tr.t0 / 100, t1: tr.t1 / 100, outro: tr.outro ?? null, emendas: 0 });
      // distribuição sob as negativas (19.3.3.2): ≥ 20 % da principal e ≥ 0,9 cm²/m, s ≤ 33 cm, em ø 5
      const As = (areaBarra(phi) * 100) / s;
      const sd = Math.min(33, Math.floor((areaBarra(5) * 100) / Math.max(0.2 * As, 0.9)));
      const nd = Math.ceil(a1 / sd) + Math.ceil(a2 / sd);
      const cd = Math.max(0, comp - 2 * cob);
      posicoes.push({ id: `dist-${b}-${k}`, tipo: 'distribuição', face: 'superior', dir: dir === 'x' ? 'y' : 'x', borda: b, local: `Distribuição da negativa ${b} (ø 5 c/ ${sd})`,
        phi: 5, n: nd, s: sd, comprimento: arred5(cd), reto: cd, ganchos: 0, gancho: [false, false], a1, a2, t0: tr.t0 / 100, t1: tr.t1 / 100, emendas: 0 });
      if (balanco(el, b) && !tr.outro) avisos.push(`Balanço sem laje vizinha na borda ${b}: a negativa ancora só na viga — confira a ancoragem e a torção da viga.`);
    }
  }
  // malha da capa: calculada (intereixo > 65 cm) ou construtiva
  const malha = resultado.mesa?.arranjo ?? { phi: 5, s: 20 };
  const calculada = !!resultado.mesa?.arranjo;
  for (const dir of ['x', 'y']) {
    const L = dir === 'x' ? lx : ly, D = dir === 'x' ? ly : lx;
    const c = L - 2 * cob;
    const n = Math.ceil(Math.max(0, D - 2 * cob) / malha.s - 1e-9) + 1;
    posicoes.push({ id: `capa-${dir}`, tipo: 'distribuição', face: 'capa', dir, local: `Malha da capa em ${dir}: ø ${virgula(malha.phi)} c/ ${virgula(malha.s)} (${calculada ? 'flexão da mesa entre nervuras, 13.2.4.2' : 'construtiva, prática usual'})`,
      phi: malha.phi, n, s: malha.s, comprimento: arred5(c), reto: c, ganchos: 0, gancho: [false, false], emendas: 0 });
  }
  // estribos das nervuras (cortante como viga, 13.2.4.2)
  const est = resultado.cortante?.estribos;
  if (est?.phi && est?.s) {
    const gancho = Math.max((8 * est.phi) / 10, 6);
    const comp = 2 * (bw - 2 * cob) + 2 * (h - 2 * cob) + 2 * gancho;
    const trechos = [];
    for (const dir of geo.duas ? ['x', 'y'] : ['x']) {
      const eixos = dir === 'x' ? geo.nervurasX : geo.nervurasY;
      const L = dir === 'x' ? lx : ly;
      const qtd = Math.ceil(Math.max(0, L - 2 * cob) / est.s) + 1;
      for (const c of eixos) trechos.push({ dir, eixo: c, qtd, s: est.s, de: cob, ate: L - cob });
    }
    const n = trechos.reduce((t, x) => t + x.qtd, 0);
    posicoes.push({ id: 'estribo', tipo: 'estribo', face: 'transversal', local: `Estribos das nervuras: ø ${virgula(est.phi)} c/ ${virgula(est.s)} (${trechos.length} nervuras)`,
      phi: est.phi, n, comprimento: arred5(comp), reto: comp, ganchos: 2, forma: `${bw - 2 * cob} × ${h - 2 * cob} cm`, trechos, emendas: 0 });
  }
  if (Object.values(bordas).includes('livre')) avisos.push('Bordas livres: prever a nervura de borda com armadura de reforço (grampos em U envolvendo as barras), não incluída na lista.');
  if (resultado.balanco) avisos.push('Junto ao engaste do balanço a nervura fica comprimida embaixo: prever região maciça se a verificação pedir.');
  const ordem = { positiva: 0, construtiva: 1, negativa: 2, 'distribuição': 3, estribo: 4 };
  posicoes.sort((a, c) => ordem[a.tipo] - ordem[c.tipo]);
  posicoes.forEach((q, i) => { q.N = `N${i + 1}`; });
  return { posicoes, avisos, verificacoes: [], geometria: geo, apoios, bordas, h, hf, cob };
}

/* ------------------------------------------------------------------ todos */

/** Detalhamento de um elemento (sem as edições), ou null se o módulo não tem detalhamento. */
export function detalhamentoDe(el, resultado = el?.resultado, projeto = null) {
  if (!el || !resultado || resultado.erro) return null;
  try {
    if (el.modulo === VIGA) return resultado.detalhamento ?? null;
    if (el.modulo === PILAR) return detalhamentoPilar(el, resultado, projeto);
    if (el.modulo === LAJE) return detalhamentoLaje(el, resultado, projeto);
    if (el.modulo === NERVURADA) return detalhamentoNervurada(el, resultado, projeto);
    if (FERRAGEM_FUNDACAO.includes(el.modulo)) return resultado.detalhamento ?? null;
  } catch { return null; }
  return null;
}

/** Posições do elemento com as edições do usuário aplicadas (ou null). */
export function posicoesDe(el, resultado = el?.resultado, projeto = null) {
  const d = detalhamentoDe(el, resultado, projeto);
  return d?.posicoes?.length ? aplicarEdicoes(d.posicoes, el.detalhamento?.edicoes) : null;
}

export const MODULOS_DETALHADOS = [VIGA, PILAR, LAJE, NERVURADA];
