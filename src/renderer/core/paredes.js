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
 * Paredes da arquitetura como cargas (roteiro, etapa L12).
 *
 *  1. `segmentosDoFundo`: os segmentos de reta das camadas escolhidas do DXF de fundo, já em metros no pavimento.
 *  2. `paredesDeSegmentos`: pares de linhas paralelas afastadas de 9 a 25 cm, com trecho em comum, viram paredes
 *     (eixo, espessura desenhada e comprimento); trechos alinhados da mesma parede, cortados por um encontro, se juntam.
 *  3. `planoDeParedes`: cada parede vai para as vigas paralelas que estão embaixo dela (por vão) e o que sobra,
 *     para a laje que a contém. Altura = pé-direito do lance de cima − altura da viga (ou − espessura da laje).
 *  4. `aplicarParedes`: troca as cargas de parede lançadas antes no pavimento pelas do plano.
 *
 * Carga na viga (NBR 6120:2019, Tabela 2 — peso por área × altura):
 *  - a parede cobre ao menos metade do vão → carga de parede no vão inteiro (a favor da segurança);
 *  - trecho menor → carga concentrada com o peso do trecho, no centro dele (também a favor da segurança).
 * Na laje: o peso das paredes dividido pela área da laje vai em `cargas.paredes` (kN/m²), somado às permanentes —
 * a prática usual para lajes armadas em duas direções; nas armadas em uma direção, confira a faixa de distribuição.
 */
import { alvenaria, cargaParede, ALVENARIAS } from '../../engine/cargas.js';
import { pavimentosOrdenados, peDireito, tipoDe, eixoViga, secaoViga, cantosLaje, dimensoesLaje, espessuraLaje } from './montagem.js';
import { secaoDoVao } from '../../engine/viga-secoes.js';

export const ESPESSURA_MIN = 0.09; // m
export const ESPESSURA_MAX = 0.25; // m
export const ORIGEM = 'paredes';
const GRAU = Math.PI / 180;
const r2 = (v) => Math.round(v * 100) / 100;
const r3 = (v) => Math.round(v * 1000) / 1000;

/* ------------------------------------------------------------------ 1. segmentos */

/**
 * Segmentos de reta (m) das entidades do desenho nas camadas escolhidas.
 * @param planta  { camadas, entidades: [{ c, p: [x0,y0,x1,y1…], f }] }
 * @param aplicar (x, y) → [x, y] em metros no pavimento
 * @param camadas nomes das camadas (todas, se vazio)
 */
export function segmentosDoFundo(planta, aplicar, camadas = [], { minimo = 0.05 } = {}) {
  const usar = new Set(camadas);
  const out = [];
  for (const e of planta?.entidades ?? []) {
    if (usar.size && !usar.has(planta.camadas[e.c])) continue;
    const pts = [];
    for (let i = 0; i + 1 < e.p.length; i += 2) pts.push(aplicar(e.p[i], e.p[i + 1]));
    if (e.f && pts.length > 2) pts.push(pts[0]);
    for (let i = 1; i < pts.length; i++) {
      const [a, b] = [pts[i - 1], pts[i]];
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) >= minimo) out.push([a, b]);
    }
  }
  return out;
}

/** Camadas do desenho com mais pares de linhas paralelas na faixa das paredes (a primeira é a sugestão). */
export function camadasProvaveis(planta, aplicar) {
  const out = [];
  for (const nome of planta?.camadas ?? []) {
    if (/pilar|column|viga|beam|laje|slab/i.test(nome)) continue; // contornos de estrutura não são paredes
    const n = paredesDeSegmentos(segmentosDoFundo(planta, aplicar, [nome])).length;
    if (n) out.push({ nome, paredes: n });
  }
  const pista = (n) => (/parede|alven|wall|muro/i.test(n) ? 1 : 0);
  return out.sort((a, b) => pista(b.nome) - pista(a.nome) || b.paredes - a.paredes);
}

/* ------------------------------------------------------------------ 2. paredes */

/**
 * Pares de linhas paralelas com afastamento entre `min` e `max` (m) e trecho comum de pelo menos `sobreposicao` (m).
 * @returns [{ a: [x,y], b: [x,y], espessura (m), comprimento (m) }]
 */
export function paredesDeSegmentos(segs, { min = ESPESSURA_MIN, max = ESPESSURA_MAX, sobreposicao = 0.2, angulo = 0.5 } = {}) {
  const folga = 0.005;
  // direção em [0°, 180°) em faixas de 1°; comparam-se a faixa e a seguinte
  const linhas = segs.map(([a, b]) => {
    let dx = b[0] - a[0], dy = b[1] - a[1];
    let ang = Math.atan2(dy, dx) / GRAU;
    if (ang < 0) { ang += 180; dx = -dx; dy = -dy; } // sentido em [0°, 180°)
    if (ang >= 180) { ang -= 180; dx = -dx; dy = -dy; }
    const L = Math.hypot(dx, dy);
    return { a, b, u: [dx / L, dy / L], L, ang };
  });
  const faixas = new Map();
  for (const l of linhas) {
    const k = Math.round(l.ang) % 180;
    if (!faixas.has(k)) faixas.set(k, []);
    faixas.get(k).push(l);
  }
  const brutas = [];
  const parear = (p, q) => {
    let dif = Math.abs(p.ang - q.ang);
    if (dif > 90) dif = 180 - dif;
    if (dif > angulo) return;
    const u = p.u, n = [-u[1], u[0]];
    // afastamento: das duas pontas de q à reta de p
    const d0 = (q.a[0] - p.a[0]) * n[0] + (q.a[1] - p.a[1]) * n[1];
    const d1 = (q.b[0] - p.a[0]) * n[0] + (q.b[1] - p.a[1]) * n[1];
    const d = (Math.abs(d0) + Math.abs(d1)) / 2;
    if (Math.sign(d0) !== Math.sign(d1) || d < min - folga || d > max + folga) return;
    const s = (pt) => (pt[0] - p.a[0]) * u[0] + (pt[1] - p.a[1]) * u[1];
    const [p0, p1] = [0, p.L];
    const [q0, q1] = [s(q.a), s(q.b)].sort((x, y) => x - y);
    const i0 = Math.max(p0, q0), i1 = Math.min(p1, q1);
    if (i1 - i0 < sobreposicao) return;
    const meio = ((d0 + d1) / 4); // metade do afastamento, com sinal
    const ponto = (t) => [p.a[0] + u[0] * t + n[0] * meio, p.a[1] + u[1] * t + n[1] * meio];
    brutas.push({ a: ponto(i0), b: ponto(i1), espessura: d, u });
  };
  for (const [k, A] of faixas) {
    const B = faixas.get((k + 1) % 180) ?? [];
    for (let i = 0; i < A.length; i++) {
      for (let j = i + 1; j < A.length; j++) parear(A[i], A[j]);
      for (const q of B) parear(A[i], q);
    }
  }
  return juntarAlinhadas(brutas);
}

/** Junta paredes no mesmo alinhamento, com a mesma espessura, que se tocam ou têm um vão até `vao` (encontros). */
function juntarAlinhadas(ps, { vao = 0.3 } = {}) {
  const usadas = new Array(ps.length).fill(false);
  const out = [];
  for (let i = 0; i < ps.length; i++) {
    if (usadas[i]) continue;
    usadas[i] = true;
    const base = ps[i], u = base.u, n = [-u[1], u[0]];
    const s = (pt) => (pt[0] - base.a[0]) * u[0] + (pt[1] - base.a[1]) * u[1];
    const off = (pt) => (pt[0] - base.a[0]) * n[0] + (pt[1] - base.a[1]) * n[1];
    let iv = [[Math.min(s(base.a), s(base.b)), Math.max(s(base.a), s(base.b))]];
    let mudou = true;
    while (mudou) {
      mudou = false;
      for (let j = i + 1; j < ps.length; j++) {
        if (usadas[j]) continue;
        const q = ps[j];
        if (Math.abs(q.espessura - base.espessura) > 0.01) continue;
        if (Math.abs(u[0] * q.u[1] - u[1] * q.u[0]) > Math.sin(1 * GRAU)) continue;
        if (Math.abs(off(q.a)) > 0.02 || Math.abs(off(q.b)) > 0.02) continue;
        const a = Math.min(s(q.a), s(q.b)), b = Math.max(s(q.a), s(q.b));
        const lo = Math.min(...iv.map((x) => x[0])), hi = Math.max(...iv.map((x) => x[1]));
        if (a > hi + vao || b < lo - vao) continue;
        iv.push([a, b]);
        usadas[j] = true;
        mudou = true;
      }
    }
    const lo = Math.min(...iv.map((x) => x[0])), hi = Math.max(...iv.map((x) => x[1]));
    const P = (t) => [r3(base.a[0] + u[0] * (t - s(base.a))), r3(base.a[1] + u[1] * (t - s(base.a)))];
    out.push({ a: P(lo), b: P(hi), espessura: r3(base.espessura), comprimento: r3(hi - lo) });
  }
  return out.sort((x, y) => x.a[1] - y.a[1] || x.a[0] - y.a[0]);
}

/* ------------------------------------------------------------------ 3. plano */

/** Espessura nominal do bloco (cm) da Tabela 2 mais próxima da desejada. */
export function blocoMaisProximo(material, cm) {
  const esp = Object.keys(alvenaria(material)?.espessuras ?? {}).map(Number);
  if (!esp.length) return cm;
  return esp.reduce((m, e) => (Math.abs(e - cm) < Math.abs(m - cm) - 1e-9 ? e : m), esp[0]);
}

/** Pé-direito do lance que começa no pavimento (o da parede que nasce nele). */
export function peDireitoDoLance(projeto, pavId) {
  const ord = pavimentosOrdenados(projeto);
  const i = ord.findIndex((p) => p.id === pavId);
  if (i < 0) return null;
  const pv = ord[i];
  if (Math.floor(Number(pv.repeticoes) || 1) > 1) return peDireito(projeto, pv.id); // tipo: o próprio pé-direito
  return ord[i + 1] ? peDireito(projeto, ord[i + 1].id) : peDireito(projeto, pv.id);
}

function pontoNoPoligono([x, y], poli) {
  let dentro = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [xi, yi] = poli[i], [xj, yj] = poli[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/**
 * Para onde vai cada parede do pavimento e com que carga.
 * @param opcoes { material, revestimento (cm/face), desenho: 'acabada' (a espessura desenhada inclui o revestimento)
 *                 | 'bloco', aberturas (%), alturas: { [índice]: m } para trocar a altura de uma parede }
 * @returns { paredes: [{ indice, parede, bloco, altura, gPorMetro, trechos: [{ destino, id, codigo, vao, comprimento, carga }] , semApoio }], resumo }
 */
export function planoDeParedes(projeto, registro, pavId, paredes, opcoes = {}) {
  const { material = 'ceramico-vedacao', revestimento = 2, desenho = 'acabada', aberturas = 0, alturas = {}, ignorar = [] } = opcoes;
  const pd = peDireitoDoLance(projeto, pavId) ?? 0;
  const els = projeto.elementos.filter((e) => e.posicao?.pavimento === pavId);
  const vigas = els.filter((e) => tipoDe(e, registro) === 'viga').map((v) => ({ el: v, eixo: eixoViga(v), b: secaoViga(v).b / 100, h: secaoViga(v).h / 100 }));
  const lajes = els.filter((e) => tipoDe(e, registro) === 'laje').map((l) => ({ el: l, poli: cantosLaje(l), h: espessuraLaje(l) / 100 }));
  const ign = new Set(ignorar);
  const lista = paredes.map((par, indice) => {
    const desenhadaCm = par.espessura * 100;
    const bloco = blocoMaisProximo(material, desenho === 'acabada' ? desenhadaCm - 2 * revestimento : desenhadaCm);
    const dir = [(par.b[0] - par.a[0]) / (par.comprimento || 1), (par.b[1] - par.a[1]) / (par.comprimento || 1)];
    const trechos = [];
    let cobertos = []; // intervalos da parede (0…comprimento) que caíram em viga
    let hViga = null;
    for (const v of vigas) {
      const { u, a, L } = v.eixo;
      if (Math.abs(u[0] * dir[1] - u[1] * dir[0]) > Math.sin(3 * GRAU)) continue;
      const n = [-u[1], u[0]];
      const lado = (p) => (p[0] - a[0]) * n[0] + (p[1] - a[1]) * n[1];
      const lim = Math.max(v.b, par.espessura) / 2 + 0.05;
      if (Math.abs(lado(par.a)) > lim || Math.abs(lado(par.b)) > lim) continue;
      const s = (p) => (p[0] - a[0]) * u[0] + (p[1] - a[1]) * u[1];
      const w0 = Math.min(s(par.a), s(par.b)), w1 = Math.max(s(par.a), s(par.b));
      const i0 = Math.max(0, w0), i1 = Math.min(L, w1);
      if (i1 - i0 < 0.05) continue;
      v.eixo.vaos.forEach(([s0, s1], k) => {
        const t0 = Math.max(i0, s0), t1 = Math.min(i1, s1);
        if (t1 - t0 < 0.05) return;
        const hVao = secaoDoVao(v.el, k).h / 100;
        trechos.push({ destino: 'viga', id: v.el.id, codigo: v.el.codigo, vao: k, Lvao: r3(s1 - s0), inicio: r3(t0 - s0), comprimento: r3(t1 - t0), hViga: hVao });
        hViga = Math.max(hViga ?? 0, hVao);
        // em coordenadas da parede
        const sp = (t) => ((a[0] + u[0] * t) - par.a[0]) * dir[0] + ((a[1] + u[1] * t) - par.a[1]) * dir[1];
        cobertos.push([Math.min(sp(t0), sp(t1)), Math.max(sp(t0), sp(t1))]);
      });
    }
    // o que sobrou da parede: na laje que contém o meio do trecho
    cobertos = cobertos.sort((x, y) => x[0] - y[0]);
    const livres = [];
    let pos = 0;
    for (const [c0, c1] of cobertos) { if (c0 - pos > 0.1) livres.push([pos, c0]); pos = Math.max(pos, c1); }
    if (par.comprimento - pos > 0.1) livres.push([pos, par.comprimento]);
    let semApoio = 0;
    for (const [l0, l1] of livres) {
      const m = (l0 + l1) / 2, pm = [par.a[0] + dir[0] * m, par.a[1] + dir[1] * m];
      const laje = lajes.find((l) => pontoNoPoligono(pm, l.poli));
      if (laje) trechos.push({ destino: 'laje', id: laje.el.id, codigo: laje.el.codigo, comprimento: r3(l1 - l0), hLaje: laje.h });
      else semApoio += l1 - l0;
    }
    // altura: pé-direito − viga (a mais alta embaixo da parede) ou − laje
    const desconto = hViga ?? (trechos.find((t) => t.destino === 'laje')?.hLaje ?? 0);
    const altura = Number.isFinite(alturas[indice]) ? alturas[indice] : r2(Math.max(0, pd - desconto));
    const g = cargaParede({ material, espessura: bloco, revestimento, altura, aberturas }).g;
    for (const t of trechos) {
      if (t.destino === 'viga') {
        const inteiro = t.comprimento >= t.Lvao / 2;
        t.carga = inteiro
          ? { tipo: 'alvenaria', material, espessura: bloco, revestimento, altura, aberturas, vao: t.vao, valorPorMetro: r3(g) }
          : { tipo: 'concentrada', natureza: 'g', valor: r3(g * t.comprimento), vao: t.vao, posicao: r3(t.inicio + t.comprimento / 2) };
      } else {
        t.peso = r3(g * t.comprimento);
      }
    }
    return { indice, parede: par, bloco, altura, gPorMetro: r3(g), trechos, semApoio: r3(semApoio), ignorada: ign.has(indice) };
  });
  // lajes: soma dos pesos / área
  const porLaje = new Map();
  for (const p of lista) if (!p.ignorada) for (const t of p.trechos) if (t.destino === 'laje') porLaje.set(t.id, (porLaje.get(t.id) ?? 0) + t.peso);
  const lajesCarga = [...porLaje].map(([id, peso]) => {
    const el = projeto.elementos.find((e) => e.id === id);
    const { lx, ly } = dimensoesLaje(el);
    return { id, codigo: el.codigo, peso: r3(peso), area: r3(lx * ly), valor: r3(peso / (lx * ly)) };
  });
  const ativas = lista.filter((p) => !p.ignorada);
  return {
    peDireito: pd, material, revestimento, desenho,
    paredes: lista,
    lajes: lajesCarga,
    resumo: {
      paredes: ativas.length,
      cargasViga: ativas.reduce((s, p) => s + p.trechos.filter((t) => t.destino === 'viga').length, 0),
      lajes: lajesCarga.length,
      semApoio: ativas.filter((p) => p.semApoio > 0.1).length,
      comprimento: r2(ativas.reduce((s, p) => s + p.parede.comprimento, 0)),
    },
  };
}

/* ------------------------------------------------------------------ 4. aplicar */

const novoId = () => `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const fmt = (v) => String(Math.round(v * 100) / 100).replace('.', ',');

/** Troca as cargas de parede do pavimento pelas do plano (altera no lugar). Devolve o número de cargas lançadas. */
export function aplicarParedes(projeto, pavId, plano) {
  const els = projeto.elementos.filter((e) => e.posicao?.pavimento === pavId);
  for (const e of els) {
    if (Array.isArray(e.cargas)) e.cargas = e.cargas.filter((c) => c?.origem !== ORIGEM);
    else if (e.cargas && typeof e.cargas === 'object' && 'paredes' in e.cargas) delete e.cargas.paredes;
  }
  let n = 0;
  for (const p of plano.paredes) {
    if (p.ignorada) continue;
    for (const t of p.trechos) {
      if (t.destino !== 'viga') continue;
      const v = els.find((e) => e.id === t.id);
      if (!v) continue;
      const { valorPorMetro, ...carga } = t.carga;
      const desc = carga.tipo === 'alvenaria'
        ? `Parede ${p.indice + 1} (DXF, ${fmt(t.comprimento)} m)`
        : `Parede ${p.indice + 1} (DXF, trecho de ${fmt(t.comprimento)} m, ${fmt(valorPorMetro ?? p.gPorMetro)} kN/m)`;
      (v.cargas ??= []).push({ id: novoId(), ...carga, descricao: desc, origem: ORIGEM });
      n++;
    }
  }
  for (const l of plano.lajes) {
    const el = els.find((e) => e.id === l.id);
    if (!el) continue;
    el.cargas ??= {};
    el.cargas.paredes = l.valor;
    n++;
  }
  return n;
}

export const MATERIAIS_PAREDE = ALVENARIAS.filter((a) => a.uso === 'vedacao').map((a) => ({ id: a.id, nome: a.nome }));
