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
 * Eixos de projeto (0.65): retas de referência verticais, horizontais ou inclinadas, valendo para todos os pavimentos.
 *
 * Arquivo: projeto.eixos = {
 *   lista: [{ id, p: [x, y] (m), ang (graus; 0 = horizontal, 90 = vertical), nome? }],
 *   cotas: [{ id, a, b, s }]   (cota entre dois eixos paralelos; s = posição da linha de cota ao longo deles, m)
 * }
 * Arquivos anteriores guardavam `eixos.x` e `eixos.y` (listas de coordenadas): continuam valendo e passam para a lista
 * na primeira edição.
 *
 * Nomes automáticos: verticais 1, 2, 3… da esquerda para a direita; horizontais A, B, C… de baixo para cima; inclinados
 * D1, D2… (família a família). Os cruzamentos de eixos não paralelos são os nós: pontos de encaixe e de ancoragem —
 * um pilar, um apoio de viga ou um canto de laje sobre um eixo acompanha o eixo quando ele se move.
 */

const RAD = Math.PI / 180;
const TOL_ANG = 1e-4;     // graus
const TOL_POS = 1e-3;     // m — um ponto está "sobre" o eixo
const r6 = (v) => Math.round(v * 1e6) / 1e6;
const letra = (i) => { let t = '', n = i; do { t = String.fromCharCode(65 + (n % 26)) + t; n = Math.floor(n / 26) - 1; } while (n >= 0); return t; };
/** Ângulo da direção (0 ≤ a < 180): retas em sentidos opostos são o mesmo eixo. */
export const angDirecao = (ang) => { let a = ((Number(ang) || 0) % 180 + 180) % 180; if (Math.abs(a - 180) < TOL_ANG) a = 0; return r6(a); };
export const tipoDoAngulo = (ang) => { const a = angDirecao(ang); return Math.abs(a - 90) < TOL_ANG ? 'vertical' : Math.abs(a) < TOL_ANG ? 'horizontal' : 'inclinado'; };

/** Eixos crus do projeto, com os antigos (x/y) convertidos — sem alterar o projeto. */
function crus(projeto) {
  const e = projeto?.eixos ?? {};
  const lista = Array.isArray(e.lista) ? e.lista.map((x) => ({ ...x })) : [];
  [...new Set((e.x ?? []).map(Number).filter(Number.isFinite))].sort((a, b) => a - b).forEach((v, i) => lista.push({ id: `ex${i + 1}`, p: [v, 0], ang: 90 }));
  [...new Set((e.y ?? []).map(Number).filter(Number.isFinite))].sort((a, b) => a - b).forEach((v, i) => lista.push({ id: `ey${i + 1}`, p: [0, v], ang: 0 }));
  return lista;
}

/**
 * Eixos com a geometria pronta: direção u, normal n, posição d = p·n (distância com sinal à origem) e o nome.
 * Ordenados por família (horizontais, verticais, inclinados) e, dentro dela, por d.
 */
export function listaEixos(projeto) {
  const fam = new Map();
  const out = crus(projeto).filter((x) => Array.isArray(x.p) && x.p.every(Number.isFinite)).map((x) => {
    const ang = angDirecao(x.ang);
    const u = [Math.cos(ang * RAD), Math.sin(ang * RAD)], n = [-u[1], u[0]];
    // verticais: n aponta para −x; trocamos o sinal para d crescer da esquerda para a direita
    const sinal = tipoDoAngulo(ang) === 'vertical' ? -1 : 1;
    const nn = [n[0] * sinal, n[1] * sinal];
    return { id: x.id, nomeProprio: x.nome || null, p: x.p, ang, u, n: nn, d: r6(x.p[0] * nn[0] + x.p[1] * nn[1]), tipo: tipoDoAngulo(ang) };
  });
  for (const e of out) { const k = String(e.ang); if (!fam.has(k)) fam.set(k, []); fam.get(k).push(e); }
  const ordemTipo = { horizontal: 0, vertical: 1, inclinado: 2 };
  const familias = [...fam.values()].map((l) => l.sort((a, b) => a.d - b.d)).sort((a, b) => ordemTipo[a[0].tipo] - ordemTipo[b[0].tipo] || a[0].ang - b[0].ang);
  let inclinados = 0;
  for (const l of familias) {
    l.forEach((e, i) => {
      e.familia = String(e.ang);
      e.nome = e.nomeProprio ?? (e.tipo === 'vertical' ? String(i + 1) : e.tipo === 'horizontal' ? letra(i) : `D${++inclinados}`);
    });
  }
  return familias.flat();
}

/** Famílias de eixos paralelos: [{ ang, tipo, eixos: [...] , espacos: [m] }]. */
export function familiasDeEixos(projeto) {
  const fam = new Map();
  for (const e of listaEixos(projeto)) { if (!fam.has(e.familia)) fam.set(e.familia, []); fam.get(e.familia).push(e); }
  return [...fam.values()].map((eixos) => ({ ang: eixos[0].ang, tipo: eixos[0].tipo, eixos, espacos: eixos.slice(1).map((e, i) => r6(e.d - eixos[i].d)) }));
}

/** Interseção de duas retas (ou null se paralelas). */
function intersecao(a, b) {
  const det = a.u[0] * b.u[1] - a.u[1] * b.u[0];
  if (Math.abs(det) < 1e-9) return null;
  const dx = b.p[0] - a.p[0], dy = b.p[1] - a.p[1];
  const t = (dx * b.u[1] - dy * b.u[0]) / det;
  return [r6(a.p[0] + a.u[0] * t), r6(a.p[1] + a.u[1] * t)];
}

/** Nós: cruzamentos de eixos não paralelos, com o nome (ex.: "A-1") e os eixos de cada um. */
export function nosDosEixos(projeto) {
  const l = listaEixos(projeto);
  const nos = [];
  for (let i = 0; i < l.length; i++) {
    for (let j = i + 1; j < l.length; j++) {
      const p = intersecao(l[i], l[j]);
      if (!p) continue;
      const ja = nos.find((q) => Math.hypot(q.p[0] - p[0], q.p[1] - p[1]) < TOL_POS);
      if (ja) { for (const e of [l[i], l[j]]) if (!ja.eixos.includes(e.id)) ja.eixos.push(e.id); continue; }
      const [a, b] = [l[i], l[j]].sort((x, y) => (x.tipo === 'horizontal' ? -1 : y.tipo === 'horizontal' ? 1 : 0));
      nos.push({ id: `${a.id}|${b.id}`, nome: `${a.nome}-${b.nome}`, p, eixos: [a.id, b.id] });
    }
  }
  return nos;
}

/** Pontos de encaixe dos eixos: os nós (compatível com a versão anterior). */
export const cruzamentosDosEixos = (projeto) => nosDosEixos(projeto).map((n) => n.p);

/** Distância de um ponto a um eixo (m). */
export const distanciaAoEixo = (pt, e) => Math.abs((pt[0] - e.p[0]) * e.n[0] + (pt[1] - e.p[1]) * e.n[1]);

/** Eixo mais perto de um ponto, até `lim` (m). */
export function eixoPerto(projeto, pt, lim) {
  let melhor = null;
  for (const e of listaEixos(projeto)) { const d = distanciaAoEixo(pt, e); if (d <= lim && (!melhor || d < melhor.dist)) melhor = { eixo: e, dist: d }; }
  return melhor?.eixo ?? null;
}

/** Projeção de um ponto no eixo (o ponto do eixo mais perto). */
export function projetarNoEixo(pt, e) {
  const t = (pt[0] - e.p[0]) * e.u[0] + (pt[1] - e.p[1]) * e.u[1];
  return [e.p[0] + e.u[0] * t, e.p[1] + e.u[1] * t];
}

/* ------------------------------------------------------------------ edição (alteram o projeto no lugar) */

/** Passa os eixos antigos (x/y) para a lista e devolve a lista crua do arquivo. */
export function normalizarEixos(projeto) {
  const e = projeto.eixos ?? {};
  if (!Array.isArray(e.lista) || e.x?.length || e.y?.length) {
    const lista = crus(projeto).map(({ id, p, ang, nome }) => ({ id, p: [r6(p[0]), r6(p[1])], ang: r6(ang), ...(nome ? { nome } : {}) }));
    projeto.eixos = { lista, cotas: e.cotas ?? [] };
  }
  projeto.eixos.cotas ??= [];
  return projeto.eixos.lista;
}

let contador = 0;
const novoIdEixo = (lista) => { let id; do { id = `e${Date.now().toString(36)}${(contador++).toString(36)}`; } while (lista.some((x) => x.id === id)); return id; };

/** Novo eixo por um ponto e um ângulo (graus). @returns id */
export function criarEixo(projeto, p, ang, { nome } = {}) {
  const lista = normalizarEixos(projeto);
  const id = novoIdEixo(lista);
  lista.push({ id, p: [r6(p[0]), r6(p[1])], ang: angDirecao(ang), ...(nome ? { nome } : {}) });
  return id;
}

/** Novo eixo passando por dois pontos. @returns id ou null (pontos coincidentes) */
export function criarEixoPorDoisPontos(projeto, a, b) {
  if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 1e-6) return null;
  return criarEixo(projeto, a, (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI);
}

/**
 * Duplica um eixo: a cópia fica paralela, a `distancia` m do original (positivo para o lado em que d cresce —
 * à direita das verticais, acima das horizontais). @returns id da cópia
 */
export function duplicarEixo(projeto, id, distancia) {
  const e = listaEixos(projeto).find((x) => x.id === id);
  if (!e) return null;
  return criarEixo(projeto, [e.p[0] + e.n[0] * distancia, e.p[1] + e.n[1] * distancia], e.ang);
}

/** Exclui um eixo (e as cotas presas a ele). */
export function excluirEixo(projeto, id) {
  normalizarEixos(projeto);
  projeto.eixos.lista = projeto.eixos.lista.filter((x) => x.id !== id);
  projeto.eixos.cotas = projeto.eixos.cotas.filter((c) => c.a !== id && c.b !== id);
}

/** Muda o nome (vazio = automático), o ângulo ou a posição de um eixo — sem mover elementos. */
export function editarEixo(projeto, id, { nome, ang, p } = {}) {
  const x = normalizarEixos(projeto).find((q) => q.id === id);
  if (!x) return;
  if (nome !== undefined) { if (nome) x.nome = String(nome).trim(); else delete x.nome; }
  if (ang !== undefined) x.ang = angDirecao(ang);
  if (p !== undefined) x.p = [r6(p[0]), r6(p[1])];
}

/**
 * Novas posições d dos eixos (id → d) → aplica no projeto e, com `elementos`, leva junto os pilares, apoios de viga,
 * cantos de laje e demais elementos que estavam sobre os eixos movidos (ancoragem).
 * @returns {{ eixos: number, elementos: string[] }}  quantos eixos mudaram e os códigos dos elementos movidos
 */
export function moverEixos(projeto, novos, { elementos = true, tipoDe = null } = {}) {
  const antes = listaEixos(projeto);
  normalizarEixos(projeto);
  let mudaram = 0;
  for (const [id, d] of Object.entries(novos)) {
    const e = antes.find((x) => x.id === id), x = projeto.eixos.lista.find((q) => q.id === id);
    if (!e || !x || Math.abs(d - e.d) < 1e-9) continue;
    const dd = d - e.d;
    x.p = [r6(x.p[0] + e.n[0] * dd), r6(x.p[1] + e.n[1] * dd)];
    mudaram++;
  }
  const movidos = mudaram && elementos ? acompanharEixos(projeto, antes, listaEixos(projeto), tipoDe) : [];
  return { eixos: mudaram, elementos: movidos };
}

/** Move um eixo para a posição d (m). */
export const moverEixo = (projeto, id, d, op) => moverEixos(projeto, { [id]: d }, op);

/**
 * Define a distância entre dois eixos paralelos: o eixo `b` vai para `dist` m de `a` (do lado em que já estava) e os
 * eixos da família que estão além de `b` vão junto, mantendo os espaçamentos entre eles.
 */
export function definirDistancia(projeto, idA, idB, dist, op) {
  const l = listaEixos(projeto);
  const a = l.find((x) => x.id === idA), b = l.find((x) => x.id === idB);
  if (!a || !b || a.familia !== b.familia || !(dist >= 0)) return { eixos: 0, elementos: [] };
  const lado = b.d >= a.d ? 1 : -1;
  const delta = a.d + lado * dist - b.d;
  const novos = {};
  for (const e of l) if (e.familia === a.familia && (lado > 0 ? e.d >= b.d - 1e-9 : e.d <= b.d + 1e-9) && e.id !== a.id) novos[e.id] = e.d + delta;
  return moverEixos(projeto, novos, op);
}

/** Espaçamentos de uma família (lista na ordem): o primeiro eixo fica; os outros se acomodam. */
export function definirEspacamentos(projeto, familia, espacos, op) {
  const l = listaEixos(projeto).filter((x) => x.familia === familia);
  if (!l.length) return { eixos: 0, elementos: [] };
  const novos = {};
  let d = l[0].d;
  l.slice(1).forEach((e, i) => { d += Number(espacos[i]) >= 0 ? Number(espacos[i]) : e.d - l[i].d; novos[e.id] = d; });
  return moverEixos(projeto, novos, op);
}

/** Cota entre dois eixos paralelos (para editar a distância na planta). @returns id */
export function criarCota(projeto, a, b, s = 0) {
  normalizarEixos(projeto);
  const ja = projeto.eixos.cotas.find((c) => (c.a === a && c.b === b) || (c.a === b && c.b === a));
  if (ja) { ja.s = r6(s); return ja.id; }
  const id = `c${Date.now().toString(36)}${(contador++).toString(36)}`;
  projeto.eixos.cotas.push({ id, a, b, s: r6(s) });
  return id;
}
export function excluirCota(projeto, id) {
  normalizarEixos(projeto);
  projeto.eixos.cotas = projeto.eixos.cotas.filter((c) => c.id !== id);
}

/** Cotas com a geometria: pontos das pontas, distância e os eixos. */
export function cotasDosEixos(projeto) {
  const l = listaEixos(projeto);
  return (projeto?.eixos?.cotas ?? []).map((c) => {
    const a = l.find((x) => x.id === c.a), b = l.find((x) => x.id === c.b);
    if (!a || !b || a.familia !== b.familia) return null;
    const pa = [a.p[0] + a.u[0] * c.s, a.p[1] + a.u[1] * c.s];
    const t = (pa[0] - b.p[0]) * b.u[0] + (pa[1] - b.p[1]) * b.u[1];
    const pb = [b.p[0] + b.u[0] * t, b.p[1] + b.u[1] * t];
    return { ...c, pa, pb, dist: r6(Math.abs(b.d - a.d)), eixoA: a, eixoB: b };
  }).filter(Boolean);
}

/* ------------------------------------------------------------------ ancoragem: elementos acompanham os eixos */

/**
 * Novo lugar de um ponto que estava sobre eixos: sobre dois eixos não paralelos → o novo cruzamento; sobre um eixo →
 * desloca com ele (na normal); fora dos eixos → fica.
 */
function novoPonto(pt, antes, depois) {
  const sobre = antes.filter((e) => distanciaAoEixo(pt, e) < TOL_POS);
  const movidos = sobre.map((e) => ({ e, n: depois.find((x) => x.id === e.id) })).filter((q) => q.n && Math.abs(q.n.d - q.e.d) > 1e-9);
  if (!movidos.length) return null;
  // dois eixos não paralelos (dos que passam pelo ponto, movidos ou não): o cruzamento novo
  const pares = sobre.map((e) => depois.find((x) => x.id === e.id)).filter(Boolean);
  for (let i = 0; i < pares.length; i++) for (let j = i + 1; j < pares.length; j++) { const q = intersecao(pares[i], pares[j]); if (q) return q; }
  const { e, n } = movidos[0];
  const dd = n.d - e.d;
  return [r6(pt[0] + e.n[0] * dd), r6(pt[1] + e.n[1] * dd)];
}

/** Dimensões de laje a partir de lx, ly (o campo que o módulo usa). */
function definirDimensoesLaje(el, lx, ly) {
  if (el.lx != null) { el.lx = r6(lx); el.ly = r6(ly); return true; }
  if (el.modulo === 'concreto.reservatorio') return false;
  if (el.direcao === 'y') { el.largura = r6(lx); el.L = r6(ly); } else { el.L = r6(lx); el.largura = r6(ly); }
  return true;
}
function dimensoesLaje(el) {
  if (el.lx != null) return { lx: el.lx, ly: el.ly ?? 1 };
  if (el.modulo === 'concreto.reservatorio') return { lx: (Number(el.a) || 2) + (Number(el.e) || 15) / 100, ly: (Number(el.b) || 3) + (Number(el.e) || 15) / 100 };
  if (el.direcao === 'y') return { lx: el.largura ?? 1, ly: el.L ?? 1 };
  return { lx: el.L ?? 1, ly: el.largura ?? 1 };
}

/** Leva os elementos sobre eixos movidos para as novas posições. @returns códigos movidos */
export function acompanharEixos(projeto, antes, depois, tipoDe = null) {
  const movidos = [];
  const tipo = (el) => tipoDe?.(el) ?? (/pilar$/.test(el.modulo) ? 'pilar' : /viga$/.test(el.modulo) ? 'viga' : /laje|entrepiso/.test(el.modulo) ? 'laje' : null);
  for (const el of projeto.elementos ?? []) {
    const pos = el.posicao;
    if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) continue;
    const t = tipo(el);
    const ang = (pos.angulo ?? 0) * RAD, ex = [Math.cos(ang), Math.sin(ang)], ey = [-ex[1], ex[0]];
    let mudou = false;
    if (t === 'viga' && Array.isArray(el.vaos) && el.vaos.length) {
      // apoios: os que estavam sobre eixos vão para os lugares novos; a viga passa pelo primeiro e pelo último
      const s = [0]; for (const v of el.vaos) s.push(s.at(-1) + (Number(v.L) || 0));
      const P = s.map((si) => [pos.x + ex[0] * si, pos.y + ex[1] * si]);
      const N = P.map((pt) => novoPonto(pt, antes, depois));
      if (!N.some(Boolean)) continue;
      // apoios ancorados: os que estão sobre algum eixo (movido ou não); os outros acompanham os vizinhos
      const K = P.map((pt, k) => (N[k] || antes.some((e) => distanciaAoEixo(pt, e) < TOL_POS) ? k : -1)).filter((k) => k >= 0);
      const Q = P.map((pt, k) => N[k] ?? pt);
      if (K.length === 1) {
        const k = K[0];
        pos.x = r6(pos.x + Q[k][0] - P[k][0]); pos.y = r6(pos.y + Q[k][1] - P[k][1]);
      } else {
        const i = K[0], j = K.at(-1), L = Math.hypot(Q[j][0] - Q[i][0], Q[j][1] - Q[i][1]);
        if (L < 1e-6) continue;
        const u = [(Q[j][0] - Q[i][0]) / L, (Q[j][1] - Q[i][1]) / L];
        const sn = s.map(() => null);
        for (const k of K) sn[k] = (Q[k][0] - Q[i][0]) * u[0] + (Q[k][1] - Q[i][1]) * u[1];
        for (let k = 0; k < s.length; k++) {
          if (sn[k] != null) continue;
          const l = [...K].reverse().find((x) => x < k), r = K.find((x) => x > k);
          if (l != null && r != null) sn[k] = sn[l] + ((s[k] - s[l]) * (sn[r] - sn[l])) / (s[r] - s[l]);
          else if (l != null) sn[k] = sn[l] + (s[k] - s[l]);      // balanço depois do último apoio ancorado
          else sn[k] = sn[r] - (s[r] - s[k]);                      // balanço antes do primeiro
        }
        if (sn.some((v, k) => k && v - sn[k - 1] < 0.05)) continue;   // vão sumiria ou inverteria: a viga fica
        pos.x = r6(Q[i][0] + u[0] * sn[0]); pos.y = r6(Q[i][1] + u[1] * sn[0]);
        pos.angulo = r6(((Math.atan2(u[1], u[0]) * 180) / Math.PI + 360) % 360);
        el.vaos.forEach((v, k) => { v.L = r6(sn[k + 1] - sn[k]); });
      }
      mudou = true;
    } else if (t === 'laje') {
      const { lx, ly } = dimensoesLaje(el);
      const C = [[0, 0], [lx, 0], [lx, ly], [0, ly]].map(([u, v]) => [pos.x + ex[0] * u + ey[0] * v, pos.y + ex[1] * u + ey[1] * v]);
      const N = C.map((pt) => novoPonto(pt, antes, depois));
      if (!N.some(Boolean)) continue;
      const Q = C.map((pt, k) => N[k] ?? pt);
      const dot = (p0, p1, e) => (p1[0] - p0[0]) * e[0] + (p1[1] - p0[1]) * e[1];
      const nlx = (dot(Q[0], Q[1], ex) + dot(Q[3], Q[2], ex)) / 2, nly = (dot(Q[0], Q[3], ey) + dot(Q[1], Q[2], ey)) / 2;
      const redim = Math.abs(nlx - lx) > 1e-6 || Math.abs(nly - ly) > 1e-6;
      if (redim && (nlx < 0.1 || nly < 0.1 || !definirDimensoesLaje(el, nlx, nly))) {
        const d = [Q[0][0] - C[0][0], Q[0][1] - C[0][1]];
        pos.x = r6(pos.x + d[0]); pos.y = r6(pos.y + d[1]);
      } else { pos.x = r6(Q[0][0]); pos.y = r6(Q[0][1]); }
      mudou = true;
    } else {
      const q = novoPonto([pos.x, pos.y], antes, depois);
      if (!q) continue;
      pos.x = q[0]; pos.y = q[1];
      mudou = true;
    }
    if (mudou) movidos.push(el.codigo ?? el.id);
  }
  return movidos;
}

/** Eixos pelos pilares (centros distintos), como fazia a versão anterior: verticais em x e horizontais em y. */
export function eixosPelosPontos(projeto, pontos) {
  const unicos = (v) => [...new Set(v.map((x) => Math.round(x * 1000) / 1000))].sort((a, b) => a - b);
  const xs = unicos(pontos.map((p) => p[0])), ys = unicos(pontos.map((p) => p[1]));
  const ja = listaEixos(projeto);
  let n = 0;
  for (const x of xs) if (!ja.some((e) => e.tipo === 'vertical' && Math.abs(e.d - x) < TOL_POS)) { criarEixo(projeto, [x, 0], 90); n++; }
  for (const y of ys) if (!ja.some((e) => e.tipo === 'horizontal' && Math.abs(e.d - y) < TOL_POS)) { criarEixo(projeto, [0, y], 0); n++; }
  return n;
}
