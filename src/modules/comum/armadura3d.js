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
 * Geometria 3D da armadura de UM elemento (0.32), a partir da lista de ferros do detalhamento — para a vista isolada
 * na tela da viga, do pilar ou da laje (a visualização 3D do edifício continua sem armaduras).
 *
 * Unidades em cm. Eixos: x ao longo da viga (ou bx no pilar, lx na laje), y na largura (by, ly) e z para cima.
 * Saída: { caixas: [{ min:[x,y,z], max:[x,y,z], tipo }], barras: [{ id, N, tipo, phi, pts: [[x,y,z], …] }] }.
 * Cada barra é uma linha poligonal pelo eixo (com ganchos e dobras); a vista desenha um tubo de diâmetro ø.
 */

import { pernaGancho90, pinoEstribo } from '../../engine/detalhamento.js';
import { geometriaNervurada } from './nervurada-geometria.js';

const r1 = (v) => Math.round(v * 10) / 10;
/** distribui n pontos entre a e b (um só: no meio) */
const espalhar = (n, a, b) => (n <= 1 ? [(a + b) / 2] : Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1)));
const RAD = Math.PI / 180;
const virg = (v, c = 1) => String(Math.round(v * 10 ** c) / 10 ** c).replace('.', ',');

/** Espaçamentos livres mínimos entre barras (cm): horizontal ah e vertical av (18.3.2.2 vigas; 18.4.2.2 pilares). */
export const livreHorizontal = (phi, dmax = 19) => Math.max(2, phi / 10, (1.2 * dmax) / 10);
export const livreVertical = (phi, dmax = 19) => Math.max(2, phi / 10, (0.5 * dmax) / 10);
/** Ponta reta do gancho de 135° do estribo: 5·øt, no mínimo 5 cm (9.4.6.1). */
const pontaGancho = (phiT) => Math.max(5, (5 * phiT) / 10);

/**
 * Eixo de um estribo retangular, no plano da seção (u, v): contorna as quatro barras de canto (centros em u0/u1,
 * v0/v1) com o raio da dobra encostado nelas e fecha com os dois ganchos de 135° no canto `canto` (0 = u0v0,
 * 1 = u1v0, 2 = u1v1, 3 = u0v1), voltados para dentro do núcleo. Devolve [[u, v, w]…]; w afasta de leve a segunda
 * volta no canto do gancho (as duas pernas se sobrepõem ali).
 */
export function eixoEstriboRetangular(u0, v0, u1, v1, r, phiT, canto = 3) {
  const cs = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
  const A = (k, ang) => [cs[k][0] + r * Math.cos(ang * RAD), cs[k][1] + r * Math.sin(ang * RAD)];
  const arco = (k, a0, a1, w) => { const out = []; const n = Math.max(2, Math.ceil(Math.abs(a1 - a0) / 15)); for (let i = 0; i <= n; i++) out.push([...A(k, a0 + ((a1 - a0) * i) / n), w]); return out; };
  const L = pontaGancho(phiT);
  const base = (k) => 180 + 90 * k;            // ângulo de entrada no canto k, percorrendo no sentido anti-horário
  const h = ((canto % 4) + 4) % 4;
  const dentro = (ang) => { const t = (ang + 90) * RAD; return [-Math.cos(t), -Math.sin(t)]; }; // oposto da tangente
  const pts = [];
  const a0 = base(h) - 45;
  const p0 = A(h, a0), d0 = dentro(a0);
  pts.push([p0[0] + d0[0] * L, p0[1] + d0[1] * L, 0]);
  pts.push(...arco(h, a0, base(h) + 90, 0));
  for (let i = 1; i <= 3; i++) { const k = (h + i) % 4; pts.push(...arco(k, base(k), base(k) + 90, 0)); }
  const w = phiT / 10;                         // a segunda volta passa por cima da primeira
  pts.push(...arco(h, base(h), base(h) + 135, w));
  const a1 = base(h) + 135, p1 = A(h, a1), t1 = [-Math.sin(a1 * RAD), Math.cos(a1 * RAD)];
  pts.push([p1[0] + t1[0] * L, p1[1] + t1[1] * L, w]);
  return pts;
}

/** Eixo de um estribo circular de raio R (centro cu, cv): uma volta com traspasse e os ganchos para dentro. */
export function eixoEstriboCircular(cu, cv, R, phiT, inicio = 90) {
  const L = pontaGancho(phiT), w = phiT / 10, volta = 360 + 45;
  const P = (ang) => [cu + R * Math.cos(ang * RAD), cv + R * Math.sin(ang * RAD)];
  // ganchos de 135°: a ponta sai dobrada para dentro, em 45° com a tangente
  const ponta = (ang, sinal) => {
    const t = [-Math.sin(ang * RAD), Math.cos(ang * RAD)], n = [-Math.cos(ang * RAD), -Math.sin(ang * RAD)];
    const p = P(ang), d = [(sinal * t[0] + n[0]) / Math.SQRT2, (sinal * t[1] + n[1]) / Math.SQRT2];
    return [p[0] + d[0] * L, p[1] + d[1] * L];
  };
  const pts = [[...ponta(inicio, 1), 0]];
  const n = 54;
  for (let i = 0; i <= n; i++) { const a = inicio + (volta * i) / n; pts.push([...P(a), (w * i) / n]); }
  pts.push([...ponta(inicio + volta, -1), w]);
  return pts;
}

/**
 * Posição das barras longitudinais numa face (viga): camadas com o espaçamento livre mínimo ah na horizontal e av
 * entre camadas (18.3.2.2), as duas primeiras barras de cada camada nos cantos do estribo e as demais igualmente
 * espaçadas entre elas.
 */
function arranjoDaFace({ total, phiMax, b, cob, phiT, dmax }) {
  const ah = livreHorizontal(phiMax * 10, dmax), av = livreVertical(phiMax * 10, dmax);
  const util = b - 2 * (cob + phiT);
  const porCamada = Math.max(2, Math.floor((util + ah) / (phiMax + ah)));
  const camadas = Math.ceil(total / porCamada);
  return (slot) => {
    const camada = Math.floor(slot / porCamada), j = slot % porCamada;
    const m = Math.min(porCamada, total - camada * porCamada);
    const y0 = cob + phiT + phiMax / 2, y1 = b - cob - phiT - phiMax / 2;
    const idx = m === 1 ? 0 : j === 0 ? 0 : j === 1 ? m - 1 : j - 1;
    const ys = espalhar(Math.max(m, 1), y0, y1);
    return { y: m === 1 ? (y0 + y1) / 2 : ys[idx], camada, dz: camada * (phiMax + av), camadas, porCamada, ah, av };
  };
}

/**
 * Viga: posições do detalhamento (x0, x1 em m ao longo do eixo; face inferior, superior ou lateral; estribos por trecho).
 * @param {{secao:{b,h}}} el
 * @param {{limites:number[]}} det
 * @param {object[]} posicoes  lista de ferros (com as edições aplicadas)
 * @param {{cob?:number, dmax?:number}} [op]   dmax: diâmetro máximo do agregado (mm)
 */
export function modeloViga(el, det, posicoes, { cob = 3, dmax = 19 } = {}) {
  const b = el.secao?.b ?? 20, h = el.secao?.h ?? 40;
  const est = posicoes.find((q) => q.tipo === 'estribo');
  const phiT = (est?.phi ?? 5) / 10;
  const [l0, l1] = det.limites ?? [0, (el.vaos ?? []).reduce((s, v) => s + v.L, 0)];
  const caixas = [{ min: [r1(l0 * 100 - cob), 0, 0], max: [r1(l1 * 100 + cob), b, h], tipo: 'concreto' }];
  const barras = [];
  const info = {};
  const porFace = { inferior: [], superior: [] };
  for (const q of posicoes) if (porFace[q.face]) porFace[q.face].push(q);
  const cantos = { inferior: 0, superior: 0 };   // bitola das barras de canto (para o raio do estribo)
  for (const [face, lista] of Object.entries(porFace)) {
    if (!lista.length) continue;
    // as barras corridas (que chegam aos apoios) ficam nos cantos; as cortadas, entre elas
    const noCanto = (q) => q.corrida || q.tipo === 'construtiva' || q.tipo === 'porta-estribo' || (q.tipo === 'negativa' && /-g1$/.test(q.id));
    const ordem = [...lista].sort((p, q) => (noCanto(q) ? 1 : 0) - (noCanto(p) ? 1 : 0) || q.n - p.n);
    // barras que só se cruzam nas pontas (traspasse, ancoragem no apoio) dividem a posição, encostadas (emenda por
    // contato); as que correm juntas num trecho maior ocupam posições diferentes na camada
    const ponta = (a, b) => {
      const sob = Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0);
      return sob < 0.3 * Math.min(a.x1 - a.x0, b.x1 - b.x0);
    };
    const colocadas = [];
    for (const q of ordem) {
      const sobre = colocadas.filter((c) => c.q.x0 < q.x1 - 1e-6 && q.x0 < c.q.x1 - 1e-6);
      const conflito = sobre.filter((c) => !ponta(c.q, q));
      let ini = 0;
      while (conflito.some((c) => ini < c.ini + c.q.n && c.ini < ini + q.n)) ini++;
      const encosta = sobre.some((c) => ponta(c.q, q) && ini < c.ini + c.q.n && c.ini < ini + q.n && !c.encosta);
      colocadas.push({ q, ini, encosta });
    }
    const total = Math.max(2, ...colocadas.map((c) => c.ini + c.q.n));
    const phiMax = Math.max(...lista.map((q) => q.phi)) / 10;
    cantos[face] = Math.max(...colocadas.filter((c) => c.ini === 0).map((c) => c.q.phi)) / 10;
    const posicao = arranjoDaFace({ total, phiMax, b, cob, phiT, dmax });
    info[face] = { barras: total, porCamada: posicao(0).porCamada, camadas: posicao(0).camadas, ah: posicao(0).ah };
    for (const { q, ini, encosta } of colocadas) {
      const phi = q.phi / 10;
      const sobe = face === 'inferior' ? 1 : -1;  // gancho para dentro da seção
      const gancho = Math.max(0, Math.min(pernaGancho90(q.phi), h - 2 * cob - 2 * phiT - phi)); // 9.4.2.3 + Tabela 9.1
      const xa = q.x0 * 100, xb = q.x1 * 100;
      for (let k = 0; k < q.n; k++) {
        const { y: y1, dz } = posicao(ini + k);
        // na emenda por contato a barra encosta na vizinha, do lado de dentro
        const y = encosta ? y1 + (y1 < b / 2 ? 1 : -1) * phi : y1;
        const z = face === 'inferior' ? cob + phiT + phi / 2 + dz : h - cob - phiT - phi / 2 - dz;
        const pts = [];
        if (q.gancho?.[0]) pts.push([xa, y, z + sobe * gancho]);
        pts.push([xa, y, z], [xb, y, z]);
        if (q.gancho?.[1]) pts.push([xb, y, z + sobe * gancho]);
        barras.push({ id: q.id, N: q.N, tipo: q.tipo, phi: q.phi, pts });
      }
    }
  }
  // laterais (pele e torção): metade de cada lado, por dentro do estribo, igualmente espaçadas na altura
  for (const q of posicoes.filter((p) => p.face === 'lateral')) {
    const phi = q.phi / 10, porLado = Math.max(1, Math.round(q.n / 2));
    const zs = espalhar(porLado + 2, cob + phiT + phi / 2, h - cob - phiT - phi / 2).slice(1, -1);
    for (const y of [cob + phiT + phi / 2, b - cob - phiT - phi / 2]) {
      for (const z of zs) barras.push({ id: q.id, N: q.N, tipo: q.tipo, phi: q.phi, pts: [[q.x0 * 100, y, z], [q.x1 * 100, y, z]] });
    }
  }
  // estribos: contornam as barras de canto, com os ganchos de 135° nos cantos de cima, alternando o lado
  for (const q of posicoes.filter((p) => p.tipo === 'estribo')) {
    const pt = q.phi / 10;
    const fi = cantos.inferior || 1, fs = cantos.superior || fi;
    const u0 = cob + pt + Math.max(fi, fs) / 2, u1 = b - u0;
    const v0 = cob + pt + fi / 2, v1 = h - cob - pt - fs / 2;
    const r = Math.max(Math.max(fi, fs) / 2, (pinoEstribo(q.phi) / 2) * pt) + pt / 2; // dobra do estribo ≥ pino de 9.4.6.1
    let i = 0;
    for (const t of q.trechos ?? []) {
      const n = Math.max(1, Math.round(t.qtd ?? 1));
      for (let k = 0; k < n; k++, i++) {
        const x = Math.min(t.x1 * 100, t.x0 * 100 + k * t.s);
        const eixo = eixoEstriboRetangular(u0, v0, u1, v1, r, q.phi, i % 2 ? 2 : 3);
        barras.push({ id: q.id, N: q.N, tipo: 'estribo', phi: q.phi, pts: eixo.map(([u, v, w]) => [x + w, u, v]) });
      }
    }
  }
  const nomes = { inferior: 'Face inferior', superior: 'Face superior' };
  const legenda = Object.entries(info).map(([f, i]) => `${nomes[f]}: ${i.barras} barras, até ${i.porCamada} por camada${i.camadas > 1 ? ` (${i.camadas} camadas)` : ''}`).join(' · ')
    + (Object.keys(info).length ? ` · livre entre barras ah ≥ ${virg(Object.values(info)[0].ah)} cm, entre camadas av ≥ ${virg(livreVertical(Math.max(...posicoes.filter((q) => porFace[q.face]).map((q) => q.phi), 10), dmax))} cm (18.3.2.2) · estribos com ganchos a 135°, alternando o lado` : '');
  return { caixas, barras, info, legenda, eixos: { x: 'eixo da viga', y: 'b', z: 'h' }, vista: { teta: -Math.PI / 2 + 0.55, fi: 1.25 } };
}

/**
 * Pilar: barras longitudinais nos pontos da seção (resultado.armadura.pontos — já com os espaçamentos de 18.4.2.2),
 * arranques encostados nelas, estribos (retangulares com ganchos de 135° alternando o canto, ou circulares) e grampos
 * suplementares no mesmo nível dos estribos. z = 0 na base do lance.
 */
export function modeloPilar(el, det, posicoes, { pontos = [], cob = 3, dmax = 19 } = {}) {
  const circular = el.forma === 'circular';
  const D = circular ? Number(el.D) || el.bx || 30 : null;
  const bx = circular ? D : el.bx ?? 20, by = circular ? D : el.by ?? 20, L = (el.comprimento ?? 3) * 100;
  const long = posicoes.find((q) => q.tipo === 'longitudinal');
  const arr = posicoes.find((q) => q.tipo === 'arranque');
  const est = posicoes.find((q) => q.tipo === 'estribo');
  const caixas = [circular ? { min: [0, 0, 0], max: [D, D, L], tipo: 'concreto', forma: 'cilindro' } : { min: [0, 0, 0], max: [bx, by, L], tipo: 'concreto' }];
  if (arr) {
    const emb = -arr.z0 * 100;
    caixas.push({ min: [-25, -25, -emb - 5], max: [bx + 25, by + 25, 0], tipo: 'apoio' });
  }
  if (det?.acima) caixas.push({ min: [0, 0, L], max: [bx, by, Math.max(L + 40, (long?.z1 ?? 0) * 100 + 10)], tipo: 'apoio', forma: circular ? 'cilindro' : undefined });
  const barras = [];
  const pts = pontos ?? [];
  const cx = bx / 2, cy = by / 2;
  if (long) for (const p of pts) barras.push({ id: long.id, N: long.N, tipo: 'longitudinal', phi: long.phi, pts: [[p.x, p.y, long.z0 * 100], [p.x, p.y, long.z1 * 100]] });
  if (arr) {
    for (const p of pts) {
      // o arranque encosta na barra do lance (centros a ø de distância), do lado de dentro, com o pé virado para fora
      const dx = cx - p.x, dy = cy - p.y, n = Math.hypot(dx, dy) || 1;
      const off = arr.phi / 10;
      const x = p.x + (dx / n) * off, y = p.y + (dy / n) * off;
      const linha = [[x, y, arr.z1 * 100], [x, y, arr.z0 * 100]];
      if (arr.pe) linha.push([x - (dx / n) * arr.pe, y - (dy / n) * arr.pe, arr.z0 * 100]);
      barras.push({ id: arr.id, N: arr.N, tipo: 'arranque', phi: arr.phi, pts: linha });
    }
  }
  const info = {};
  if (pts.length >= 2) {
    const dists = pts.map((p, i) => Math.min(...pts.filter((_, j) => j !== i).map((q) => Math.hypot(p.x - q.x, p.y - q.y))));
    info.espacamento = Math.max(...dists);
    info.livre = Math.min(...dists) - (long?.phi ?? 10) / 10;
  }
  if (est?.s) {
    const pt = est.phi / 10, phiL = (long?.phi ?? 10) / 10;
    const zs = [];
    for (let z = 5; z <= L - 2; z += est.s) zs.push(z);
    zs.forEach((z, i) => {
      if (circular) {
        const R = D / 2 - cob - pt / 2;
        barras.push({ id: est.id, N: est.N, tipo: 'estribo', phi: est.phi, pts: eixoEstriboCircular(D / 2, D / 2, R, est.phi, 90 + 90 * (i % 4)).map(([u, v, w]) => [u, v, z + w]) });
      } else {
        const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
        const [u0, u1, v0, v1] = pts.length ? [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)] : [cob + pt + phiL / 2, bx - cob - pt - phiL / 2, cob + pt + phiL / 2, by - cob - pt - phiL / 2];
        const r = Math.max(phiL / 2, (pinoEstribo(est.phi) / 2) * pt) + pt / 2;
        barras.push({ id: est.id, N: est.N, tipo: 'estribo', phi: est.phi, pts: eixoEstriboRetangular(u0, v0, u1, v1, r, est.phi, i % 4).map(([u, v, w]) => [u, v, z + w]) });
      }
    });
    // grampos: no nível de cada estribo, abraçando as duas barras de faces opostas
    for (const g of posicoes.filter((q) => q.tipo === 'suplementar')) {
      const gr = g.grampo;
      if (!gr) continue;
      const pg = g.phi / 10, r = phiL / 2 + pg / 2, ponta = pontaGancho(g.phi);
      // no plano (a ao longo do grampo, c na outra direção): barras em a = de e a = ate, c = em
      const P = (a, c) => (gr.eixo === 'y' ? [c, a] : [a, c]);
      const arco = (a, c, a0, a1) => { const out = []; for (let k = 0; k <= 8; k++) { const t = (a0 + ((a1 - a0) * k) / 8) * RAD; out.push(P(a + r * Math.cos(t), c + r * Math.sin(t))); } return out; };
      const eixo2d = [
        P(gr.de + ponta * 0.7, gr.em + r),
        ...arco(gr.de, gr.em, 90, 270),
        ...arco(gr.ate, gr.em, -90, 90),
        P(gr.ate - ponta * 0.7, gr.em + r),
      ];
      zs.forEach((z) => barras.push({ id: g.id, N: g.N, tipo: 'suplementar', phi: g.phi, pts: eixo2d.map(([u, v]) => [u, v, z + pt]) }));
    }
  }
  const legenda = info.espacamento != null
    ? `${pts.length} barras ${circular ? 'no contorno circular' : 'no contorno'} · entre eixos ${virg(info.espacamento)} cm (máx. ${virg(Math.min(2 * Math.min(bx, by), 40), 0)} cm) · livre ${virg(info.livre)} cm (mín. ${virg(livreHorizontal(long?.phi ?? 10, dmax))} cm) — 18.4.2.2 · estribos ${circular ? 'circulares com traspasse' : 'com ganchos a 135°, girando o canto a cada nível'}`
    : '';
  return { caixas, barras, info, legenda, eixos: { x: 'bx', y: 'by', z: 'altura' }, vista: { teta: -Math.PI / 3, fi: 1.3 } };
}

/**
 * Laje maciça: malhas positivas (x por baixo, y por cima dela), negativas nas bordas com as dobras e a distribuição.
 * Coordenadas da planta: (0,0) no canto x0/y0; a e b, de e ate em m; t0, t1 em m ao longo da borda; a1, a2 em cm.
 */
export function modeloLaje(el, det, posicoes, { cob = 2.5 } = {}) {
  const lx = (el.lx ?? 4) * 100, ly = (el.ly ?? 4) * 100, h = el.h ?? 10;
  const caixas = [{ min: [0, 0, 0], max: [lx, ly, h], tipo: 'concreto' }];
  const barras = [];
  const posX = posicoes.find((q) => q.tipo === 'positiva' && q.dir === 'x');
  const phiX = (posX?.phi ?? 0) / 10;
  for (const q of posicoes.filter((p) => p.tipo === 'positiva')) {
    const phi = q.phi / 10;
    const z = q.dir === 'x' ? cob + phi / 2 : cob + phiX + phi / 2;
    const n = Math.max(1, Math.round(q.n));
    const cs = espalhar(n, q.de * 100, q.ate * 100);
    for (const c of cs) {
      const pts = q.dir === 'x' ? [[q.a * 100, c, z], [q.b * 100, c, z]] : [[c, q.a * 100, z], [c, q.b * 100, z]];
      barras.push({ id: q.id, N: q.N, tipo: 'positiva', phi: q.phi, pts });
    }
  }
  const dobra = det?.dobra ?? Math.max(5, h - 2 * cob);
  for (const q of posicoes.filter((p) => p.tipo === 'negativa')) {
    const phi = q.phi / 10;
    const z = h - cob - phi / 2;
    const n = Math.max(1, Math.round(q.n));
    const ts = espalhar(n, q.t0 * 100 + cob, q.t1 * 100 - cob);
    // trecho atravessando a borda: [início, fim] na direção da barra
    const [u0, u1] = { x0: [-q.a2, q.a1], x1: [lx - q.a1, lx + q.a2], y0: [-q.a2, q.a1], y1: [ly - q.a1, ly + q.a2] }[q.borda] ?? [0, 0];
    const baixo = Math.max(z - dobra, cob + phi / 2);   // a ponta da dobra para no cobrimento de baixo
    for (const t of ts) {
      const P = (u, zz) => (q.dir === 'x' ? [u, t, zz] : [t, u, zz]);
      barras.push({ id: q.id, N: q.N, tipo: 'negativa', phi: q.phi, pts: [P(u0, baixo), P(u0, z), P(u1, z), P(u1, baixo)] });
    }
  }
  for (const q of posicoes.filter((p) => p.tipo === 'distribuição')) {
    const phi = q.phi / 10;
    const zNeg = h - cob - 1;               // logo abaixo das negativas
    const z = zNeg - phi / 2 - 0.5;
    const n = Math.max(1, Math.round(q.n));
    const [u0, u1] = { x0: [-q.a2, q.a1], x1: [lx - q.a1, lx + q.a2], y0: [-q.a2, q.a1], y1: [ly - q.a1, ly + q.a2] }[q.borda] ?? [0, 0];
    const us = espalhar(n, u0 + 3, u1 - 3);
    const t0 = q.t0 * 100 + cob, t1 = q.t1 * 100 - cob;
    for (const u of us) {
      // perpendicular às negativas: corre ao longo da borda
      const pts = q.dir === 'y' ? [[u, t0, z], [u, t1, z]] : [[t0, u, z], [t1, u, z]];
      barras.push({ id: q.id, N: q.N, tipo: 'distribuição', phi: q.phi, pts });
    }
  }
  return { caixas, barras, eixos: { x: 'lx', y: 'ly', z: 'h' } };
}

/**
 * Laje nervurada: capa, nervuras, faixas de borda, travamentos e enchimento (nervurada-geometria.js) com as barras de
 * cada nervura no fundo, as negativas e a distribuição no topo da capa, a malha da capa e os estribos, se houver.
 * Coordenadas em cm, z = 0 no fundo das nervuras. Estribos demais (laje grande) são mostrados de k em k.
 */
export function modeloNervurada(el, det, posicoes, { cob = 2.5, maxEstribos = 400 } = {}) {
  const geo = det?.geometria ?? geometriaNervurada(el);
  const { lx, ly, h, hf, bw } = geo;
  const caixas = geo.caixas.map((c) => ({ min: c.min, max: c.max, tipo: c.tipo, ...(c.material ? { material: c.material } : {}) }));
  const barras = [];
  const est = posicoes.find((q) => q.tipo === 'estribo');
  const phiT = est ? est.phi / 10 : 0;
  const phiX = (posicoes.find((q) => q.id === 'nerv-x')?.phi ?? 10) / 10;
  // barras das nervuras (e dos travamentos): no fundo, as de y por cima das de x
  for (const q of posicoes.filter((p) => p.eixos && (p.tipo === 'positiva' || p.tipo === 'construtiva'))) {
    const phi = q.phi / 10;
    const k = Math.max(1, Math.round(q.porNervura ?? 1)), camadas = Math.max(1, q.camadas ?? 1);
    const porCamada = Math.ceil(k / camadas);
    const z0 = cob + phiT + phi / 2 + (q.dir === 'y' ? phiX : 0);
    for (const c of q.eixos) {
      const lo = c - bw / 2 + cob + phiT + phi / 2, hi = c + bw / 2 - cob - phiT - phi / 2;
      let resto = k;
      for (let cam = 0; cam < camadas && resto > 0; cam++) {
        const nc = Math.min(porCamada, resto); resto -= nc;
        const z = z0 + cam * (phi + 2);
        for (const u of hi > lo ? espalhar(nc, lo, hi) : [c]) {
          const pts = q.dir === 'x' ? [[q.a * 100, u, z], [q.b * 100, u, z]] : [[u, q.a * 100, z], [u, q.b * 100, z]];
          barras.push({ id: q.id, N: q.N, tipo: q.tipo, phi: q.phi, pts });
        }
      }
    }
  }
  // negativas no topo da capa, atravessando a borda
  const trecho = (q) => ({ x0: [-q.a2, q.a1], x1: [lx - q.a1, lx + q.a2], y0: [-q.a2, q.a1], y1: [ly - q.a1, ly + q.a2] }[q.borda] ?? [0, 0]);
  for (const q of posicoes.filter((p) => p.tipo === 'negativa')) {
    const phi = q.phi / 10, z = h - cob - phi / 2;
    const [u0, u1] = trecho(q);
    for (const t of espalhar(Math.max(1, Math.round(q.n)), q.t0 * 100 + cob, q.t1 * 100 - cob)) {
      barras.push({ id: q.id, N: q.N, tipo: 'negativa', phi: q.phi, pts: q.dir === 'x' ? [[u0, t, z], [u1, t, z]] : [[t, u0, z], [t, u1, z]] });
    }
  }
  for (const q of posicoes.filter((p) => p.tipo === 'distribuição' && p.borda)) {
    const phiN = (posicoes.find((p) => p.tipo === 'negativa' && p.borda === q.borda)?.phi ?? 8) / 10;
    const phi = q.phi / 10, z = h - cob - phiN - phi / 2;
    const [u0, u1] = trecho(q);
    const t0 = q.t0 * 100 + cob, t1 = q.t1 * 100 - cob;
    for (const u of espalhar(Math.max(1, Math.round(q.n)), u0 + 3, u1 - 3)) {
      barras.push({ id: q.id, N: q.N, tipo: 'distribuição', phi: q.phi, pts: q.dir === 'y' ? [[u, t0, z], [u, t1, z]] : [[t0, u, z], [t1, u, z]] });
    }
  }
  // malha da capa, no meio da capa (y por cima de x)
  for (const q of posicoes.filter((p) => p.face === 'capa')) {
    const phi = q.phi / 10, z = h - hf / 2 + (q.dir === 'y' ? phi / 2 : -phi / 2);
    const D = q.dir === 'x' ? ly : lx, L = q.dir === 'x' ? lx : ly;
    for (const c of espalhar(Math.max(1, Math.round(q.n)), cob, D - cob)) {
      barras.push({ id: q.id, N: q.N, tipo: 'distribuição', phi: q.phi, pts: q.dir === 'x' ? [[cob, c, z], [L - cob, c, z]] : [[c, cob, z], [c, L - cob, z]] });
    }
  }
  // estribos das nervuras
  let passo = 1;
  if (est) {
    const total = (est.trechos ?? []).reduce((s, t) => s + t.qtd, 0);
    passo = Math.max(1, Math.ceil(total / maxEstribos));
    const pt = est.phi / 10, fi = phiX;
    for (const t of est.trechos ?? []) {
      const u0 = t.eixo - bw / 2 + cob + pt + fi / 2, u1 = t.eixo + bw / 2 - cob - pt - fi / 2;
      const v0 = cob + pt + fi / 2, v1 = h - cob - pt - fi / 2;
      const r = fi / 2 + pt / 2;
      for (let k = 0; k < t.qtd; k += passo) {
        const x = Math.min(t.ate, t.de + k * t.s);
        const eixo = eixoEstriboRetangular(Math.min(u0, t.eixo - 0.5), v0, Math.max(u1, t.eixo + 0.5), v1, r, est.phi, k % 2 ? 2 : 3);
        barras.push({ id: est.id, N: est.N, tipo: 'estribo', phi: est.phi, pts: eixo.map(([u, v, w]) => (t.dir === 'x' ? [x + w, u, v] : [u, x + w, v])) });
      }
    }
  }
  const nx = geo.nervurasX.length, ny = geo.duas ? geo.nervurasY.length : 0;
  const legenda = [
    geo.duas ? `${nx} nervuras em x e ${ny} em y` : `${nx} nervuras em x${geo.travamento.length ? ` · ${geo.travamento.length} de travamento` : ''}`,
    `intereixo ${virg(geo.e, 0)} cm · bw ${virg(bw)} cm · capa ${virg(hf)} cm · h ${virg(h)} cm`,
    `faixa maciça de borda ${virg(geo.faixasY.borda)} cm`,
    geo.enchimento ? `enchimento: ${{ eps: 'EPS', ceramico: 'bloco cerâmico', concreto: 'concreto celular' }[geo.enchimento] ?? geo.enchimento}` : 'vazios das cubetas',
    est && passo > 1 ? `estribos mostrados de ${passo} em ${passo}` : '',
  ].filter(Boolean).join(' · ');
  return { caixas, barras, legenda, eixos: { x: 'lx', y: 'ly', z: 'h' }, vista: { teta: -Math.PI / 3, fi: 2.05 } };
}

/** Caixa que envolve o modelo (para enquadrar a câmera). */
export function limitesDoModelo(m) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const pts = [...m.caixas.flatMap((c) => [c.min, c.max]), ...m.barras.flatMap((b) => b.pts)];
  for (const p of pts) for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], p[i]); max[i] = Math.max(max[i], p[i]); }
  return { min, max };
}
