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
 * Lançamento gráfico na planta (roteiro, etapas L4 a L6): viga em cadeia, laje pelo contorno e os "dados atuais"
 * do próximo elemento. Funções puras sobre o projeto; a tela de montagem só coleta os cliques.
 */
import {
  tipoDe, contornoPilar, centroPilar, eixoViga, secaoViga, detectarLigacoes, aplicarLigacoes, TOLERANCIA,
} from './montagem.js';
import { novoId, proximoCodigo } from './projeto.js';
import { sugerirViga, sugerirLaje } from './predimensionamento.js';
import { cargaUso } from '../../engine/cargas.js';

const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
const arr = (v, p = 1e-4) => Math.round(v / p) * p;
const r4 = (v) => Math.round(v * 1e4) / 1e4;

/* ------------------------------------------------------------------ viga em cadeia (L4) */

/** Meia largura da seção do pilar na direção n (m): até onde a seção vai para cada lado do centro. */
function meiaLargura(pilar, n) {
  const c = centroPilar(pilar);
  return Math.max(...contornoPilar(pilar).map((p) => Math.abs((p[0] - c[0]) * n[0] + (p[1] - c[1]) * n[1])));
}

/** Pilar do pavimento cujo centro está a menos de `raio` do ponto (o mais próximo). */
export function pilarPerto(projeto, registro, pavId, p, raio) {
  let melhor = null;
  for (const e of projeto.elementos) {
    if (e.posicao?.pavimento !== pavId || tipoDe(e, registro) !== 'pilar') continue;
    const d = dist(centroPilar(e), p);
    if (d <= raio && (!melhor || d < melhor.d)) melhor = { d, pilar: e };
  }
  return melhor?.pilar ?? null;
}

/** Junta pontos seguidos em trechos retos: pontos alinhados na mesma direção viram um trecho só. */
export function trechosRetos(pontos) {
  const pts = pontos.filter((p, k) => k === 0 || dist(p, pontos[k - 1]) > 1e-3);
  const trechos = [];
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1], b = pts[k];
    const ult = trechos[trechos.length - 1];
    if (ult) {
      const u0 = [ult.b[0] - ult.a[0], ult.b[1] - ult.a[1]], u1 = [b[0] - a[0], b[1] - a[1]];
      const L0 = Math.hypot(...u0), L1 = Math.hypot(...u1);
      const cruz = (u0[0] * u1[1] - u0[1] * u1[0]) / (L0 * L1), dot = (u0[0] * u1[0] + u0[1] * u1[1]) / (L0 * L1);
      if (Math.abs(cruz) < 1e-4 && dot > 0) { ult.b = b; continue; }
    }
    trechos.push({ a, b });
  }
  return trechos;
}

/**
 * Vigas de uma cadeia de pontos (de pilar em pilar). Cada trecho reto vira uma viga; os vãos se quebram em todo
 * pilar que o eixo atravessa. O eixo pode ficar no centro dos pilares ou com uma face da viga rente à face do pilar,
 * e ainda ser deslocado de lado.
 * @param {{pavimento:string, pontos:number[][], secao?:{b:number,h:number},
 *   alinhamento?:'eixo'|'esquerda'|'direita', deslocamento?:number}} op  deslocamento em m, positivo para a esquerda
 * @returns {{posicao:object, vaos:{L:number}[], apoios:string[], pilares:(object|null)[], texto:string}[]}
 */
export function vigasEmCadeia(projeto, registro, { pavimento, pontos, secao = { b: 20, h: 50 }, alinhamento = 'eixo', deslocamento = 0 }) {
  const pilares = projeto.elementos.filter((e) => e.posicao?.pavimento === pavimento && tipoDe(e, registro) === 'pilar');
  const vigas = projeto.elementos.filter((e) => e.posicao?.pavimento === pavimento && tipoDe(e, registro) === 'viga' && e.vaos?.length);
  const out = [];
  for (const { a, b } of trechosRetos(pontos)) {
    const L = dist(a, b);
    if (L < 0.1) continue;
    const u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], n = [-u[1], u[0]];
    // deslocamento lateral do eixo: face rente ao pilar do início (ou do primeiro pilar atravessado)
    let d = deslocamento;
    if (alinhamento !== 'eixo') {
      const ref = pilares.find((p) => dist(centroPilar(p), a) <= 0.01) ?? pilares.find((p) => {
        const c = centroPilar(p), s = (c[0] - a[0]) * u[0] + (c[1] - a[1]) * u[1], e = Math.abs((c[0] - a[0]) * n[0] + (c[1] - a[1]) * n[1]);
        return s >= -0.01 && s <= L + 0.01 && e <= meiaLargura(p, n);
      });
      if (ref) d += (alinhamento === 'esquerda' ? 1 : -1) * Math.max(0, meiaLargura(ref, n) - secao.b / 200);
    }
    const A = [a[0] + n[0] * d, a[1] + n[1] * d];
    // pontos de apoio: as pontas e todo pilar que o eixo atravessa
    const marcas = [{ s: 0, pilar: null }, { s: L, pilar: null }];
    for (const p of pilares) {
      const c = centroPilar(p);
      const s = (c[0] - A[0]) * u[0] + (c[1] - A[1]) * u[1];
      const e = Math.abs((c[0] - A[0]) * n[0] + (c[1] - A[1]) * n[1]);
      if (s < -TOLERANCIA || s > L + TOLERANCIA || e > meiaLargura(p, n) + 1e-6) continue;
      marcas.push({ s: Math.max(0, Math.min(L, s)), pilar: p });
    }
    marcas.sort((x, y) => x.s - y.s);
    const nos = [];
    for (const m of marcas) {
      const ult = nos[nos.length - 1];
      if (ult && m.s - ult.s < 0.05) { ult.pilar ??= m.pilar; if (m.s === L) ult.s = L; continue; }
      nos.push({ ...m });
    }
    if (nos.length < 2) continue;
    // ponta sem pilar: apoio se cair sobre outra viga; senão, balanço
    const sobreViga = (s) => {
      const p = [A[0] + u[0] * s, A[1] + u[1] * s];
      return vigas.some((v) => {
        const e = eixoViga(v);
        const dx = e.b[0] - e.a[0], dy = e.b[1] - e.a[1], L2 = dx * dx + dy * dy;
        const t = Math.max(0, Math.min(1, ((p[0] - e.a[0]) * dx + (p[1] - e.a[1]) * dy) / L2));
        return dist(p, [e.a[0] + t * dx, e.a[1] + t * dy]) <= Math.max(TOLERANCIA, secaoViga(v).b / 200);
      });
    };
    const apoios = nos.map((m, k) => (m.pilar || ((k === 0 || k === nos.length - 1) && sobreViga(m.s)) ? 'apoio' : 'livre'));
    if (!apoios.some((t) => t !== 'livre')) continue;
    const vaos = nos.slice(1).map((m, k) => ({ L: r4(m.s - nos[k].s) }));
    const angulo = arr((Math.atan2(u[1], u[0]) * 180) / Math.PI, 1e-6);
    out.push({
      posicao: { pavimento, x: r4(A[0]), y: r4(A[1]), angulo: ((angulo % 360) + 360) % 360 },
      vaos, apoios, pilares: nos.map((m) => m.pilar),
      texto: `${vaos.length} vão(s) de ${vaos.map((v) => v.L.toFixed(2).replace('.', ',')).join(' + ')} m${nos.some((m) => m.pilar) ? ` sobre ${nos.filter((m) => m.pilar).map((m) => m.pilar.codigo).join(', ')}` : ''}`,
    });
  }
  return out;
}

/**
 * Cria no projeto (no lugar) as vigas da cadeia e liga cada uma aos pilares, vigas e lajes que a planta indica.
 * @param {object} modulo   o módulo da viga (criar(), id, prefixo)
 * @param {object} [dados]  dados atuais da viga (seção, cargas…) aplicados sobre o padrão do módulo
 * @returns {{vigas:object[], ligacoes:number}}
 */
export function criarVigasEmCadeia(projeto, registro, modulo, specs, dados = {}) {
  const novas = [];
  for (const sp of specs) {
    const codigo = dados.proximoCodigo && !projeto.elementos.some((e) => e.codigo === dados.proximoCodigo) ? dados.proximoCodigo : proximoCodigo(projeto, modulo.prefixo);
    const base = modulo.criar(projeto);
    const el = {
      id: novoId(modulo.prefixo.toLowerCase()), modulo: modulo.id, codigo, nome: codigo, ...base,
      vaos: sp.vaos.map((v) => ({ ...(base.vaos?.[0] ?? {}), L: v.L })), apoios: [...sp.apoios], posicao: { ...sp.posicao }, resultado: null,
    };
    aplicarDadosAtuais(el, 'viga', dados);
    // altura pelo vão (etapa L8): L/10, L/12 ou L/5, em múltiplos de 5 cm
    if (dados.hPeloVao) el.secao = { ...el.secao, h: sugerirViga(el).secao.h };
    projeto.elementos.push(el);
    novas.push(el);
    if (dados.proximoCodigo) dados.proximoCodigo = null;
  }
  const ids = new Set(novas.map((e) => e.id));
  const ligacoes = aplicarLigacoes(projeto, detectarLigacoes(projeto, registro).filter((d) => ids.has(d.fonte.id) || ids.has(d.receptor.id)));
  return { vigas: novas, ligacoes };
}

/* ------------------------------------------------------------------ dados atuais do próximo elemento (L6) */

/** Padrões dos dados atuais por tipo de elemento lançado na planta. */
export const DADOS_PADRAO = {
  // cargas: 'padrao' (as do módulo), 'nenhuma' ou a lista copiada com o conta-gotas; criterios: exceção de fck/cobrimento
  viga: { secao: { b: 20, h: 50 }, hPeloVao: false, alinhamento: 'eixo', deslocamento: 0, proximoCodigo: null, criterios: null, cargas: 'padrao', origem: null },
  laje: { modulo: 'concreto.laje.macica', h: 10, hPeloVao: false, proximoCodigo: null, criterios: null, cargas: 'padrao', origem: null },
  pilar: { bx: 20, by: 30, proximoCodigo: null, criterios: null, origem: null },
};

/** Tipo de lançamento de um elemento (viga, laje ou pilar de concreto), ou null. */
export function tipoDeLancamento(el, registro) {
  const t = tipoDe(el, registro);
  return ['viga', 'laje', 'pilar'].includes(t) && String(el.modulo).startsWith('concreto.') ? t : null;
}

const cargasProprias = (cargas) => (Array.isArray(cargas) ? cargas.filter((c) => c?.tipo !== 'elemento').map((c) => structuredClone(c)) : []);

/**
 * Aplica os dados atuais a um elemento novo (altera no lugar): seção ou espessura, critérios e cargas próprias.
 * As ligações (cargas vindas de outros elementos) nunca são tocadas.
 */
export function aplicarDadosAtuais(el, tipo, d) {
  if (!d) return el;
  if (tipo === 'viga' && d.secao) el.secao = { ...(el.secao ?? {}), ...d.secao };
  if (tipo === 'laje' && d.h && 'h' in el && el.lx != null) el.h = d.h;
  if (tipo === 'pilar') { if (d.bx) el.bx = d.bx; if (d.by) el.by = d.by; }
  if (d.criterios && Object.keys(d.criterios).length) el.criterios = structuredClone(d.criterios);
  if (tipo === 'viga' && d.cargas && d.cargas !== 'padrao') {
    const ligadas = Array.isArray(el.cargas) ? el.cargas.filter((c) => c?.tipo === 'elemento') : [];
    el.cargas = [...ligadas, ...(d.cargas === 'nenhuma' ? [] : cargasProprias(d.cargas).map((c, k) => ({ ...c, id: `c${k + 1}${Math.random().toString(36).slice(2, 5)}` })))];
  }
  if (tipo === 'laje' && d.cargas && d.cargas !== 'padrao' && typeof d.cargas === 'object' && !Array.isArray(el.cargas)) el.cargas = structuredClone(d.cargas);
  return el;
}

/**
 * Conta-gotas: as propriedades de um elemento como dados atuais do tipo (seção, espessura, critérios e cargas próprias).
 * @returns {object|null} parte dos dados atuais
 */
export function copiarPropriedades(el, registro) {
  const tipo = tipoDeLancamento(el, registro);
  if (!tipo) return null;
  const d = { origem: el.codigo, criterios: el.criterios ? structuredClone(el.criterios) : null };
  if (tipo === 'viga') Object.assign(d, { secao: { b: el.secao?.b ?? 20, h: el.secao?.h ?? 50 }, cargas: cargasProprias(el.cargas) });
  if (tipo === 'laje') Object.assign(d, { modulo: el.modulo, ...(el.h != null && el.lx != null ? { h: el.h } : {}), cargas: Array.isArray(el.cargas) ? 'padrao' : structuredClone(el.cargas ?? null) ?? 'padrao' });
  if (tipo === 'pilar') Object.assign(d, { bx: el.bx, by: el.by });
  return { tipo, dados: d };
}

/**
 * Pincel: aplica as propriedades copiadas a outro elemento do mesmo tipo (altera no lugar).
 * @returns {boolean} se aplicou
 */
export function aplicarPropriedades(destino, copia, registro) {
  if (!copia || tipoDeLancamento(destino, registro) !== copia.tipo) return false;
  const d = copia.dados;
  if (copia.tipo === 'laje' && d.modulo && d.modulo !== destino.modulo) return false;
  aplicarDadosAtuais(destino, copia.tipo, { ...d, cargas: d.cargas ?? 'padrao' });
  if (!d.criterios) delete destino.criterios;
  if (destino.resultado) destino.resultado.desatualizado = true;
  return true;
}

/** Dados atuais (seção, alinhamento, próximo código…) do tipo, guardados no projeto em `projeto.lancamento`. */
export function dadosAtuais(projeto, tipo) {
  const p = DADOS_PADRAO[tipo] ?? {};
  const g = projeto?.lancamento?.[tipo] ?? {};
  return { ...structuredClone(p), ...structuredClone(g) };
}

/** Grava parte dos dados atuais do tipo (altera o projeto no lugar). */
export function definirDadosAtuais(projeto, tipo, parcial) {
  projeto.lancamento ??= {};
  projeto.lancamento[tipo] = { ...dadosAtuais(projeto, tipo), ...parcial };
}

/* ------------------------------------------------------------------ laje pelo contorno (L5) */

const chaveDoPonto = (p) => `${Math.round(p[0] * 100)}|${Math.round(p[1] * 100)}`; // vértices a menos de 1 cm se fundem
const cruz2 = (a, b) => a[0] * b[1] - a[1] * b[0];
const areaAssinada = (pts) => pts.reduce((s, p, i) => s + cruz2(p, pts[(i + 1) % pts.length]), 0) / 2;

export function pontoNoPoligono([x, y], poli) {
  let dentro = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [xi, yi] = poli[i], [xj, yj] = poli[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** Segmentos do contorno das lajes de um pavimento: eixos das vigas e fechamentos de bordo. */
export function segmentosDoContorno(projeto, registro, pavId) {
  const segs = [];
  for (const e of projeto.elementos) {
    if (e.posicao?.pavimento !== pavId || tipoDe(e, registro) !== 'viga' || !e.vaos?.length) continue;
    const { a, b } = eixoViga(e);
    segs.push({ a, b, fonte: 'viga', viga: e });
  }
  const pv = projeto.pavimentos?.find((p) => p.id === pavId);
  for (const f of pv?.fechamentos ?? []) segs.push({ a: f.a, b: f.b, fonte: 'fechamento' });
  return segs;
}

/**
 * Regiões fechadas pelos eixos das vigas (e pelos fechamentos de bordo) de um pavimento: as faces limitadas do
 * desenho em planta. Cada região diz se é um retângulo (onde cabe uma laje retangular), as bordas (apoiada sobre
 * viga, livre no fechamento) e se já tem laje.
 * @returns {{poligono:number[][], area:number, centro:number[], retangulo:object|null, ocupada:object|null}[]}
 */
export function regioesDoPavimento(projeto, registro, pavId) {
  const segs = segmentosDoContorno(projeto, registro, pavId);
  // 1. quebra os segmentos nos cruzamentos e encontros
  const tol = 0.01;
  const cortes = segs.map((s) => [0, 1]);
  for (let i = 0; i < segs.length; i++) {
    for (let j = i + 1; j < segs.length; j++) {
      const A = segs[i], B = segs[j];
      const r = [A.b[0] - A.a[0], A.b[1] - A.a[1]], q = [B.b[0] - B.a[0], B.b[1] - B.a[1]];
      const La = Math.hypot(...r), Lb = Math.hypot(...q);
      const den = cruz2(r, q);
      const w = [B.a[0] - A.a[0], B.a[1] - A.a[1]];
      if (Math.abs(den) < 1e-9 * La * Lb) {
        // colineares: cada ponta de um que cai sobre o outro corta o outro
        if (Math.abs(cruz2(w, r)) / La > tol) continue;
        for (const [S, T, ci] of [[A, B, j], [B, A, i]]) {
          const d = [T.b[0] - T.a[0], T.b[1] - T.a[1]], L2 = d[0] ** 2 + d[1] ** 2;
          for (const p of [S.a, S.b]) { const t = ((p[0] - T.a[0]) * d[0] + (p[1] - T.a[1]) * d[1]) / L2; if (t > 0 && t < 1) cortes[ci].push(t); }
        }
        continue;
      }
      const t = cruz2(w, q) / den, u = cruz2(w, r) / den;
      const ta = tol / La, tb = tol / Lb;
      if (t < -ta || t > 1 + ta || u < -tb || u > 1 + tb) continue;
      cortes[i].push(Math.max(0, Math.min(1, t)));
      cortes[j].push(Math.max(0, Math.min(1, u)));
    }
  }
  // 2. vértices (fundidos a 1 cm) e arestas
  const vert = new Map();
  const vertice = (p) => { const k = chaveDoPonto(p); if (!vert.has(k)) vert.set(k, { k, p, saidas: [] }); return vert.get(k); };
  const arestas = new Map();
  segs.forEach((s, i) => {
    const ts = [...new Set(cortes[i].map((t) => Math.round(t * 1e6) / 1e6))].sort((x, y) => x - y);
    for (let k = 1; k < ts.length; k++) {
      const p0 = [s.a[0] + (s.b[0] - s.a[0]) * ts[k - 1], s.a[1] + (s.b[1] - s.a[1]) * ts[k - 1]];
      const p1 = [s.a[0] + (s.b[0] - s.a[0]) * ts[k], s.a[1] + (s.b[1] - s.a[1]) * ts[k]];
      const v0 = vertice(p0), v1 = vertice(p1);
      if (v0 === v1) continue;
      const kk = [v0.k, v1.k].sort().join('>');
      const ex = arestas.get(kk);
      if (ex) { if (s.fonte === 'viga') ex.fonte = 'viga'; continue; }
      arestas.set(kk, { fonte: s.fonte });
      v0.saidas.push({ para: v1, fonte: s.fonte, kk });
      v1.saidas.push({ para: v0, fonte: s.fonte, kk });
    }
  });
  for (const v of vert.values()) {
    for (const e of v.saidas) e.ang = Math.atan2(e.para.p[1] - v.p[1], e.para.p[0] - v.p[0]);
    v.saidas.sort((x, y) => x.ang - y.ang);
  }
  // 3. faces: anda pelas meias-arestas sempre com a face à esquerda
  const vista = new Set();
  const regioes = [];
  for (const v of vert.values()) {
    for (const e0 of v.saidas) {
      if (vista.has(`${v.k}>${e0.para.k}`)) continue;
      const ciclo = [];
      let de = v, e = e0, passos = 0;
      while (passos++ < 10000) {
        const id = `${de.k}>${e.para.k}`;
        if (vista.has(id)) break;
        vista.add(id);
        ciclo.push({ p: de.p, fonte: arestas.get(e.kk).fonte });
        const at = e.para;
        const lista = at.saidas;
        const i = lista.findIndex((x) => x.para === de);
        const prox = lista[(i - 1 + lista.length) % lista.length];
        de = at; e = prox;
      }
      if (ciclo.length < 3) continue;
      const pts = ciclo.map((c) => c.p);
      const area = areaAssinada(pts);
      if (area <= 0.01) continue; // a face de fora (área negativa) e restos
      regioes.push(simplificar(ciclo, area));
    }
  }
  // 4. retângulos e lajes já lançadas
  const lajes = projeto.elementos.filter((e) => e.posicao?.pavimento === pavId && tipoDe(e, registro) === 'laje');
  for (const r of regioes) {
    r.retangulo = retanguloDe(r);
    r.ocupada = lajes.find((l) => { const c = cantosDaLaje(l); return pontoNoPoligono(c, r.poligono); }) ?? null;
  }
  return regioes;
}

function cantosDaLaje(l) {
  const { x = 0, y = 0, angulo = 0 } = l.posicao;
  const lx = l.lx ?? (l.direcao === 'y' ? l.largura : l.L) ?? 1, ly = l.ly ?? (l.direcao === 'y' ? l.L : l.largura) ?? 1;
  const c = Math.cos((angulo * Math.PI) / 180), s = Math.sin((angulo * Math.PI) / 180);
  return [x + (lx / 2) * c - (ly / 2) * s, y + (lx / 2) * s + (ly / 2) * c];
}

/** Tira das faces os vértices alinhados e as idas e voltas por vigas soltas dentro da região. */
function simplificar(ciclo, area) {
  let lado = ciclo.map((c) => ({ ...c }));
  let mudou = true;
  while (mudou && lado.length > 2) {
    mudou = false;
    for (let i = 0; i < lado.length; i++) {
      const a = lado[(i - 1 + lado.length) % lado.length], b = lado[i], c = lado[(i + 1) % lado.length];
      // ida e volta (viga solta dentro da região): some o bico
      if (Math.hypot(a.p[0] - c.p[0], a.p[1] - c.p[1]) < 1e-6) { lado.splice(i, 1); lado.splice(i % lado.length, 1); mudou = true; break; }
      const u = [b.p[0] - a.p[0], b.p[1] - a.p[1]], w = [c.p[0] - b.p[0], c.p[1] - b.p[1]];
      if (Math.abs(cruz2(u, w)) < 1e-9 * Math.hypot(...u) * Math.hypot(...w) && u[0] * w[0] + u[1] * w[1] > 0) {
        // alinhado: a borda é livre se algum trecho dela for fechamento
        a.fonte = a.fonte === 'fechamento' || b.fonte === 'fechamento' ? 'fechamento' : 'viga';
        lado.splice(i, 1); mudou = true; break;
      }
    }
  }
  const pts = lado.map((c) => c.p);
  const n = pts.length;
  return { poligono: pts, fontes: lado.map((c) => c.fonte), area, centro: [pts.reduce((s, p) => s + p[0], 0) / n, pts.reduce((s, p) => s + p[1], 0) / n] };
}

/** Retângulo da região, no formato da laje: canto, ângulo (0 a 90°), lx, ly e as bordas x0/x1/y0/y1. */
function retanguloDe(r) {
  const P = r.poligono;
  if (P.length !== 4) return null;
  for (let i = 0; i < 4; i++) {
    const a = P[i], b = P[(i + 1) % 4], c = P[(i + 2) % 4];
    const u = [b[0] - a[0], b[1] - a[1]], w = [c[0] - b[0], c[1] - b[1]];
    if (Math.abs(u[0] * w[0] + u[1] * w[1]) > 1e-4 * Math.hypot(...u) * Math.hypot(...w)) return null;
  }
  // lado de referência: o de direção entre 0 e 90°; o canto é o de menor coordenada nessa base
  let melhor = null;
  for (let i = 0; i < 4; i++) {
    const a = P[i], b = P[(i + 1) % 4];
    let ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
    if (ang < -1e-6 || ang >= 90 - 1e-6) continue;
    melhor = { i, ang: Math.max(0, ang) };
  }
  if (!melhor) return null;
  const i = melhor.i;
  const c0 = P[i], c1 = P[(i + 1) % 4], c3 = P[(i + 3) % 4];
  const lx = Math.hypot(c1[0] - c0[0], c1[1] - c0[1]), ly = Math.hypot(c3[0] - c0[0], c3[1] - c0[1]);
  // a face está à esquerda das meias-arestas (sentido anti-horário): lados i, i+1, i+2, i+3 = y0, x1, y1, x0
  const borda = (k) => (r.fontes[(i + k) % 4] === 'fechamento' ? 'livre' : 'apoiada');
  return {
    posicao: { x: r4(c0[0]), y: r4(c0[1]), angulo: arr(melhor.ang, 1e-6) },
    lx: r4(lx), ly: r4(ly),
    bordas: { y0: borda(0), x1: borda(1), y1: borda(2), x0: borda(3) },
  };
}

/**
 * Cria a laje da região (altera o projeto no lugar) e liga as bordas às vigas. Lajes maciças usam lx/ly e as quatro
 * bordas; as de uma direção (treliçada, nervurada, alveolar) correm as vigotas no menor vão (a direção principal).
 * @returns {{laje:object, ligacoes:number}}
 */
export function criarLajeNaRegiao(projeto, registro, modulo, pavId, regiao, dados = {}) {
  const r = regiao.retangulo;
  if (!r) throw new Error('A região não é retangular: a laje precisa de um contorno com quatro lados em ângulo reto.');
  const codigo = dados.proximoCodigo && !projeto.elementos.some((e) => e.codigo === dados.proximoCodigo) ? dados.proximoCodigo : proximoCodigo(projeto, modulo.prefixo);
  const base = modulo.criar(projeto);
  const el = { id: novoId(modulo.prefixo.toLowerCase()), modulo: modulo.id, codigo, nome: codigo, ...base, resultado: null };
  if ('lx' in base) {
    Object.assign(el, { lx: r.lx, ly: r.ly, bordas: { ...(base.bordas ?? {}), ...r.bordas } });
  } else {
    // uma direção: as vigotas vencem o menor vão
    const dir = r.lx <= r.ly ? 'x' : 'y';
    Object.assign(el, { direcao: dir, L: Math.min(r.lx, r.ly), largura: Math.max(r.lx, r.ly) });
  }
  el.posicao = { pavimento: pavId, ...r.posicao };
  // carga padrão do pavimento (L13) e, por cima, as cargas copiadas com o conta-gotas
  aplicarCargaPadrao(projeto, el, pavId);
  aplicarDadosAtuais(el, 'laje', { ...dados, h: 'lx' in base ? dados.h : null });
  if (dados.hPeloVao && el.lx != null) { const sg = sugerirLaje(el); if (sg.h) el.h = sg.h; }
  projeto.elementos.push(el);
  const ligacoes = aplicarLigacoes(projeto, detectarLigacoes(projeto, registro).filter((d) => d.fonte.id === el.id));
  return { laje: el, ligacoes };
}

/* ------------------------------------------------------------------ carga padrão por pavimento (L13) */

/**
 * Carga padrão das lajes do pavimento: `pavimento.cargaPadrao = { uso, revestimento, outras }` (uso do catálogo da
 * NBR 6120; a acidental sai do catálogo). Aplicada a toda laje nova do pavimento; cada laje pode mudar depois.
 * @returns {boolean} se aplicou
 */
export function aplicarCargaPadrao(projeto, laje, pavId = laje?.posicao?.pavimento) {
  const pv = projeto.pavimentos?.find((p) => p.id === pavId);
  const cp = pv?.cargaPadrao;
  if (!cp?.uso || !laje || Array.isArray(laje.cargas)) return false;
  const u = cargaUso(cp.uso);
  if (!u) return false;
  laje.cargas = { ...(laje.cargas ?? {}), uso: cp.uso, acidental: u.q };
  if (Number.isFinite(cp.revestimento)) laje.cargas.revestimento = cp.revestimento;
  if (Number.isFinite(cp.outras)) laje.cargas.outras = cp.outras;
  return true;
}
