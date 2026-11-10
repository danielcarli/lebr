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
  const est = posicoes.find((q) => q.tipo === 'estribo');
  const phiT = (est?.phi ?? 5) / 10;
  const [l0, l1] = det.limites ?? [0, (el.vaos ?? []).reduce((s, v) => s + v.L, 0)];
  // seções por vão (cm; topo e base com 0 no piso); sem elas (resultados antigos), a seção constante da viga
  const b0 = el.secao?.b ?? 20, h0 = el.secao?.h ?? 40;
  const secs = det.secoes?.length ? det.secoes : (el.vaos ?? [{}]).map(() => ({ b: b0, h: h0, topo: 0, base: -h0 }));
  const bMax = Math.max(...secs.map((s) => s.b));
  const zRef = Math.min(...secs.map((s) => s.base));
  const variavel = secs.some((s) => s.b !== secs[0].b || s.topo !== secs[0].topo || s.base !== secs[0].base);
  const X = det.X ?? [0, ...(el.vaos ?? []).map((v, i, a) => a.slice(0, i + 1).reduce((s, w) => s + w.L, 0))];
  const larg = det.larguras ?? X.map(() => 20);
  const caixas = [];
  if (!variavel) caixas.push({ min: [r1(l0 * 100 - cob), 0, 0], max: [r1(l1 * 100 + cob), secs[0].b, secs[0].h], tipo: 'concreto' });
  else {
    secs.forEach((s, v) => {
      const xa = v === 0 ? l0 * 100 - cob : X[v] * 100, xb = v === secs.length - 1 ? l1 * 100 + cob : X[v + 1] * 100;
      caixas.push({ min: [r1(xa), (bMax - s.b) / 2, s.base - zRef], max: [r1(xb), (bMax + s.b) / 2, s.topo - zRef], tipo: 'concreto' });
    });
    // nó sobre o apoio onde a seção muda: o concreto do apoio cobre as duas seções
    for (let k = 1; k < secs.length; k++) {
      const a = secs[k - 1], c = secs[k];
      if (a.b === c.b && a.topo === c.topo && a.base === c.base) continue;
      const w = larg[k] ?? 20, bb = Math.max(a.b, c.b);
      caixas.push({ min: [r1(X[k] * 100 - w / 2), (bMax - bb) / 2, Math.min(a.base, c.base) - zRef], max: [r1(X[k] * 100 + w / 2), (bMax + bb) / 2, Math.max(a.topo, c.topo) - zRef], tipo: 'apoio' });
    }
  }
  const barras = [];
  const info = {};
  // grupos: face e seção em que as barras ficam (com a seção constante, um grupo por face)
  const secDe = (q) => q.sec ?? secs[0];
  const chaveSec = (s) => `${s.b}|${s.topo}|${s.base}`;
  const porFace = new Map();
  for (const q of posicoes) {
    if (q.face !== 'inferior' && q.face !== 'superior') continue;
    const s = secDe(q), ch = `${q.face}|${q.face === 'inferior' ? `${s.b}|${s.base}` : `${s.b}|${s.topo}`}`;
    if (!porFace.has(ch)) porFace.set(ch, { face: q.face, sec: s, lista: [] });
    porFace.get(ch).lista.push(q);
  }
  const cantos = { inferior: 0, superior: 0 };   // bitola das barras de canto (para o raio do estribo)
  for (const { face, sec, lista } of porFace.values()) {
    if (!lista.length) continue;
    const b = sec.b, h = sec.h ?? (sec.topo - sec.base), dy = (bMax - b) / 2;
    const zBase = sec.base - zRef, zTopo = sec.topo - zRef;
    // as barras corridas (que chegam aos apoios) ficam nos cantos; as cortadas, entre elas
    const noCanto = (q) => q.corrida || q.tipo === 'construtiva' || q.tipo === 'porta-estribo' || (q.tipo === 'negativa' && /-g1(-\d+)?$/.test(q.id));
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
    cantos[face] = Math.max(cantos[face], Math.max(...colocadas.filter((c) => c.ini === 0).map((c) => c.q.phi)) / 10);
    const posicao = arranjoDaFace({ total, phiMax, b, cob, phiT, dmax });
    const inf0 = { barras: total, porCamada: posicao(0).porCamada, camadas: posicao(0).camadas, ah: posicao(0).ah };
    if (!info[face] || inf0.barras > info[face].barras) info[face] = inf0;
    for (const { q, ini, encosta } of colocadas) {
      const phi = q.phi / 10;
      const sobe = face === 'inferior' ? 1 : -1;  // gancho para dentro da seção
      const gancho = Math.max(0, Math.min(pernaGancho90(q.phi), h - 2 * cob - 2 * phiT - phi)); // 9.4.2.3 + Tabela 9.1
      const xa = q.x0 * 100, xb = q.x1 * 100;
      for (let k = 0; k < q.n; k++) {
        const { y: y1, dz } = posicao(ini + k);
        // na emenda por contato a barra encosta na vizinha, do lado de dentro
        const y = dy + (encosta ? y1 + (y1 < b / 2 ? 1 : -1) * phi : y1);
        const z = face === 'inferior' ? zBase + cob + phiT + phi / 2 + dz : zTopo - cob - phiT - phi / 2 - dz;
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
    const s = secDe(q), b = s.b, dy = (bMax - b) / 2, zb = s.base - zRef, zt = s.topo - zRef;
    const zs = espalhar(porLado + 2, zb + cob + phiT + phi / 2, zt - cob - phiT - phi / 2).slice(1, -1);
    for (const y of [dy + cob + phiT + phi / 2, dy + b - cob - phiT - phi / 2]) {
      for (const z of zs) barras.push({ id: q.id, N: q.N, tipo: q.tipo, phi: q.phi, pts: [[q.x0 * 100, y, z], [q.x1 * 100, y, z]] });
    }
  }
  // estribos: contornam as barras de canto, com os ganchos de 135° nos cantos de cima, alternando o lado
  for (const q of posicoes.filter((p) => p.tipo === 'estribo')) {
    const pt = q.phi / 10;
    const fi = cantos.inferior || 1, fs = cantos.superior || fi;
    const r = Math.max(Math.max(fi, fs) / 2, (pinoEstribo(q.phi) / 2) * pt) + pt / 2; // dobra do estribo ≥ pino de 9.4.6.1
    let i = 0;
    for (const t of q.trechos ?? []) {
      const s = secs[t.vao] ?? secs[0], dy = (bMax - s.b) / 2, zb = s.base - zRef, zt = s.topo - zRef;
      const u0 = dy + cob + pt + Math.max(fi, fs) / 2, u1 = dy + s.b - cob - pt - Math.max(fi, fs) / 2;
      const v0 = zb + cob + pt + fi / 2, v1 = zt - cob - pt - fs / 2;
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

/**
 * Laje treliçada (0.66): vigotas pré-moldadas (placa de concreto com a treliça CA-60 — banzo inferior com 2 barras,
 * banzo superior com 1 e as diagonais em zigue-zague), as barras adicionais junto ao banzo inferior, o enchimento entre
 * as nervuras, a capa com a armadura de distribuição e as negativas sobre os apoios engastados ou o balanço.
 * Coordenadas em cm no referencial das vigotas: x ao longo do vão L, y na largura, z = 0 no fundo da vigota.
 * @param {object} el   laje treliçada (L, largura, he, hf, bw, intereixo, enchimento)
 * @param {object} res  resultado do cálculo (trelica, adicional {n, phi}, negativa {phi, s}, distribuicaoBarras, bordas)
 * @param {object} tr   treliça adotada ({ nome, altura, sup, diag, inf } em cm e mm)
 */
export function modeloTrelicada(el, res, tr, { cob = 2.5, maxVigotas = 40 } = {}) {
  const L = (el.L ?? 4) * 100, W = (el.largura ?? 4) * 100, he = el.he ?? 12, hf = el.hf ?? 4, bw = el.bw ?? 9, e = el.intereixo ?? 42;
  const h = he + hf, placa = 3, meiaPlaca = 6;
  const caixas = [{ min: [0, 0, he], max: [L, W, h], tipo: 'concreto', parte: 'capa' }];
  const barras = [];
  // eixos das vigotas: a primeira a meio intereixo da borda, as outras de e em e
  const eixosY = [];
  for (let y = e / 2; y < W - 1e-6; y += e) eixosY.push(y);
  if (!eixosY.length) eixosY.push(W / 2);
  const passoV = Math.max(1, Math.ceil(eixosY.length / maxVigotas));
  const inf = (tr?.inf ?? 5) / 10, sup = (tr?.sup ?? 6) / 10, diag = (tr?.diag ?? 4.2) / 10, Ht = tr?.altura ?? 12;
  const zInf = 1.5 + inf / 2, zSup = Math.min(h - cob - sup / 2, zInf + Ht - inf / 2 - sup / 2);
  const larguraTr = 8;                      // abertura usual da base da treliça (cm)
  const pasoDiag = 20;                      // passo das diagonais (sinusoide de 20 cm)
  const x0 = 1, x1 = L - 1;
  eixosY.forEach((y, i) => {
    // placa da vigota e a nervura moldada no local
    caixas.push({ min: [0, y - meiaPlaca, 0], max: [L, y + meiaPlaca, placa], tipo: 'concreto', parte: 'vigota' });
    caixas.push({ min: [0, y - bw / 2, placa], max: [L, y + bw / 2, he], tipo: 'concreto', parte: 'nervura' });
    // enchimento até a próxima vigota (ou até a borda)
    const yProx = eixosY[i + 1] ?? null;
    if (el.enchimento && yProx != null) caixas.push({ min: [0, y + bw / 2, placa], max: [L, yProx - bw / 2, he], tipo: 'enchimento', parte: 'enchimento', material: el.enchimento });
    if (i % passoV) return;
    // treliça: banzos e diagonais
    const yA = y - larguraTr / 2, yB = y + larguraTr / 2;
    for (const yb of [yA, yB]) barras.push({ id: 'banzo-inf', N: 'T', tipo: 'treliça', phi: tr?.inf ?? 5, pts: [[x0, yb, zInf], [x1, yb, zInf]] });
    barras.push({ id: 'banzo-sup', N: 'T', tipo: 'treliça', phi: tr?.sup ?? 6, pts: [[x0, y, zSup], [x1, y, zSup]] });
    for (const yb of [yA, yB]) {
      const pts = [];
      for (let x = x0, k = 0; x <= x1 + 1e-6; x += pasoDiag / 2, k++) pts.push(k % 2 ? [x, y, zSup - sup / 2 - diag / 2] : [x, yb, zInf + inf / 2 + diag / 2]);
      barras.push({ id: 'diagonal', N: 'T', tipo: 'treliça', phi: tr?.diag ?? 4.2, pts });
    }
    // barras adicionais junto ao banzo inferior, entre as duas barras dele
    const ad = res?.adicional;
    if (ad?.n > 0 && ad.phi) {
      const p = ad.phi / 10;
      const ys = ad.n === 1 ? [y] : espalhar(ad.n, y - larguraTr / 2 + inf + p / 2 + 0.3, y + larguraTr / 2 - inf - p / 2 - 0.3);
      for (const yy of ys) barras.push({ id: 'adicional', N: 'A', tipo: 'positiva', phi: ad.phi, pts: [[cob, yy, zInf + inf / 2 + p / 2], [L - cob, yy, zInf + inf / 2 + p / 2]] });
    }
  });
  // distribuição na capa: perpendicular às vigotas (ao longo de y), no meio da capa
  const db = res?.distribuicaoBarras ?? { phi: 5, s: 20 };
  const zDist = he + hf / 2;
  for (const x of espalhar(Math.max(2, Math.floor((L - 2 * cob) / db.s) + 1), cob, L - cob)) {
    barras.push({ id: 'distribuicao', N: 'D', tipo: 'distribuição', phi: db.phi, pts: [[x, cob, zDist], [x, W - cob, zDist]] });
  }
  // negativas sobre as extremidades engastadas (ou o balanço), no topo da capa
  const neg = res?.negativa;
  const bordas = res?.bordas ?? {};
  if (neg?.phi && neg?.s) {
    const p = neg.phi / 10, z = h - cob - p / 2;
    const balanco = bordas.x0 === 'livre' || bordas.x1 === 'livre';
    const a = Math.min(0.25 * L, 150);
    const trechos = [];
    if (bordas.x0 === 'engastada') trechos.push([-a, a]);
    if (bordas.x1 === 'engastada') trechos.push([L - a, L + a]);
    if (balanco && !trechos.length) trechos.push(bordas.x0 === 'livre' ? [cob, L + a] : [-a, L - cob]);
    for (const [u0, u1] of trechos) {
      for (const y of espalhar(Math.max(2, Math.floor((W - 2 * cob) / neg.s) + 1), cob, W - cob)) {
        barras.push({ id: 'negativa', N: 'N', tipo: 'negativa', phi: neg.phi, pts: [[u0, y, z], [u1, y, z]] });
      }
    }
  }
  const legenda = [
    `${eixosY.length} vigota${eixosY.length > 1 ? 's' : ''} com ${tr?.nome ?? 'treliça'}${passoV > 1 ? ` (treliças mostradas de ${passoV} em ${passoV})` : ''}`,
    `H${virg(h, 0)} (${virg(he, 0)} + ${virg(hf, 0)}) · intereixo ${virg(e, 0)} cm · bw ${virg(bw)} cm`,
    res?.adicional?.rotulo ? `adicional ${res.adicional.rotulo} por vigota` : 'sem barra adicional',
    res?.negativa?.rotulo && res.negativa.rotulo !== '—' ? `negativa ${res.negativa.rotulo}` : '',
    `distribuição na capa ${res?.distribuicao ?? 'ø 5 c/ 20'}`,
    el.enchimento ? `enchimento: ${{ eps: 'EPS', ceramico: 'lajota cerâmica', concreto: 'bloco de concreto' }[el.enchimento] ?? el.enchimento}` : '',
  ].filter(Boolean).join(' · ');
  return { caixas, barras, legenda, eixos: { x: 'L', y: 'largura', z: 'h' }, vista: { teta: -Math.PI / 3, fi: 2.05 } };
}

/**
 * Laje alveolar (0.69): os painéis protendidos com os alvéolos (seção extrudada com furos circulares, como no corte),
 * as chavetas entre painéis, a capa, as cordoalhas na face inferior e as faixas de apoio nas extremidades vinculadas.
 * O último painel é cortado na largura que sobra. Coordenadas em cm: x ao longo do vão L, y na largura, z = 0 no
 * fundo dos painéis.
 * @param {object} el   laje alveolar (L, largura, capa, apoio, painel { h, larguraPainel, alveolos, cordoalhas, phiCordoalha })
 * @param {object} [res] resultado do cálculo (bordas)
 */
export function modeloAlveolar(el, res = null, { junta = 1, maxPaineis = 60 } = {}) {
  const P = el.painel ?? {};
  const L = (el.L ?? 7) * 100, W = (el.largura ?? 5) * 100, h = P.h ?? 20, capa = el.capa ?? 0;
  const bp = P.larguraPainel ?? 125, nAlv = Math.max(1, Math.round(P.alveolos ?? 6));
  const passo = bp / nAlv, r = Math.min(passo * 0.36, h * 0.34);
  const caixas = [], barras = [];
  const nP = Math.max(1, Math.ceil(W / bp - 1e-9));
  const nCord = Math.max(0, Math.round(P.cordoalhas ?? nAlv + 1)), phiC = P.phiCordoalha ?? 9.5;
  const zC = Math.max(2.5 + phiC / 20, 3.5);
  let cortado = false;
  for (let i = 0; i < Math.min(nP, maxPaineis); i++) {
    const y0 = i * bp, y1 = Math.min(W, (i + 1) * bp);
    const larg = y1 - y0 - (y1 < W ? junta : 0);
    if (larg < 5) continue;
    if (larg < bp - junta - 1e-6) cortado = true;
    // alvéolos que cabem inteiros (com 2 cm de parede) no painel, centrados como no painel inteiro
    const furos = [];
    for (let k = 0; k < nAlv; k++) { const yc = (k + 0.5) * passo; if (yc + r + 2 <= larg) furos.push({ y: yc, z: h / 2, r }); }
    caixas.push({ min: [0, y0, 0], max: [L, y0 + larg, h], tipo: 'concreto', parte: 'painel', forma: 'alveolar', furos });
    if (y1 < W) caixas.push({ min: [0, y0 + larg, 0], max: [L, y1, h], tipo: 'enchimento', parte: 'chaveta', material: 'concreto' });
    // cordoalhas nas almas, junto à face inferior
    const almas = [];
    for (let k = 0; k <= nAlv; k++) { const y = k === 0 ? 4 : k === nAlv ? larg - 4 : k * passo; if (y <= larg - 3) almas.push(y); }
    const ys = nCord === almas.length ? almas : espalhar(Math.min(nCord, Math.max(1, Math.floor(larg / 8))), 4, larg - 4);
    for (const y of ys) barras.push({ id: 'cordoalha', N: 'CP', tipo: 'protensão', phi: phiC, pts: [[0, y0 + y, zC], [L, y0 + y, zC]] });
  }
  if (capa > 0) caixas.push({ min: [0, 0, h], max: [L, W, h + capa], tipo: 'concreto', parte: 'capa' });
  // faixas de apoio (o comprimento de apoio sobre a viga), só nas extremidades vinculadas
  const b = res?.bordas ?? el.bordas ?? {};
  // a viga (topo de 12 cm mostrado) avança `ap` sob o painel e tem pelo menos 20 cm de largura
  const ap = el.apoio ?? 10, bv = Math.max(ap + 5, 20);
  if (b.x0 !== 'livre') caixas.push({ min: [ap - bv, 0, -12], max: [ap, W, 0], tipo: 'apoio', parte: 'apoio' });
  if (b.x1 !== 'livre') caixas.push({ min: [L - ap, 0, -12], max: [L - ap + bv, W, 0], tipo: 'apoio', parte: 'apoio' });
  const legenda = [
    `${nP} painé${nP > 1 ? 'is' : 'l'} de ${virg(bp, 0)} cm${cortado ? ' (o último cortado na largura)' : ''} · h ${virg(h, 0)} cm com ${nAlv} alvéolos ø ${virg(2 * r, 1)} cm (forma do desenho)`,
    `${nCord} cordoalha${nCord === 1 ? '' : 's'} ø ${virg(phiC, 1)} mm por painel (do catálogo)`,
    capa > 0 ? `capa de ${virg(capa, 1)} cm` : 'sem capa',
    `apoio de ${virg(ap, 1)} cm nas extremidades vinculadas`,
    nP > maxPaineis ? `mostrados ${maxPaineis} painéis` : '',
  ].filter(Boolean).join(' · ');
  return { caixas, barras, legenda, eixos: { x: 'L', y: 'largura', z: 'h' }, vista: { teta: -Math.PI / 3, fi: 2.05 } };
}

/** Caixa que envolve o modelo (para enquadrar a câmera). */
export function limitesDoModelo(m) {
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity];
  const pts = [...m.caixas.flatMap((c) => [c.min, c.max]), ...m.barras.flatMap((b) => b.pts), ...(m.pecas ?? []).flatMap((q) => [q.p, q.q]),
    ...(m.empenas ?? []).flatMap((e) => [[0, e.y, 0], [e.L, e.y, e.H]])];
  for (const p of pts) for (let i = 0; i < 3; i++) { min[i] = Math.min(min[i], p[i]); max[i] = Math.max(max[i], p[i]); }
  return { min, max };
}
