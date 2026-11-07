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

const PILAR = 'concreto.pilar', VIGA = 'concreto.viga', LAJE = 'concreto.laje.macica';
const FUNDACOES = ['concreto.sapata', 'concreto.bloco'];
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
export function vizinhasNaBorda(laje, borda, projeto) {
  if (!laje.posicao) return [];
  const [P, Q] = bordasLaje(laje)[borda];
  const len = Math.hypot(Q[0] - P[0], Q[1] - P[1]);
  if (!(len > 0)) return [];
  const u = [(Q[0] - P[0]) / len, (Q[1] - P[1]) / len];
  const dist = (R) => Math.abs((R[0] - P[0]) * u[1] - (R[1] - P[1]) * u[0]);
  const t = (R) => (R[0] - P[0]) * u[0] + (R[1] - P[1]) * u[1];
  const out = [];
  for (const o of projeto?.elementos ?? []) {
    if (o.id === laje.id || o.modulo !== LAJE || !o.posicao || o.posicao.pavimento !== laje.posicao.pavimento) continue;
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

/* ------------------------------------------------------------------ todos */

/** Detalhamento de um elemento (sem as edições), ou null se o módulo não tem detalhamento. */
export function detalhamentoDe(el, resultado = el?.resultado, projeto = null) {
  if (!el || !resultado || resultado.erro) return null;
  try {
    if (el.modulo === VIGA) return resultado.detalhamento ?? null;
    if (el.modulo === PILAR) return detalhamentoPilar(el, resultado, projeto);
    if (el.modulo === LAJE) return detalhamentoLaje(el, resultado, projeto);
  } catch { return null; }
  return null;
}

/** Posições do elemento com as edições do usuário aplicadas (ou null). */
export function posicoesDe(el, resultado = el?.resultado, projeto = null) {
  const d = detalhamentoDe(el, resultado, projeto);
  return d?.posicoes?.length ? aplicarEdicoes(d.posicoes, el.detalhamento?.edicoes) : null;
}

export const MODULOS_DETALHADOS = [VIGA, PILAR, LAJE];
