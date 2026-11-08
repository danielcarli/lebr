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
 * Montagem da estrutura — pavimentos, posição dos elementos em planta e ligações por geometria.
 *
 * Sem dependências de interface (testado em test/montagem.test.js).
 *
 * Convenções (documentadas em docs/FORMATO.md):
 *   - projeto.pavimentos = [{ id, nome, cota }]   cota do piso acabado do nível, em metros;
 *   - elemento.posicao = { pavimento, x, y, angulo }   em metros e graus, no sistema global da planta;
 *   - laje: (x, y) é o canto da borda esquerda/inferior; lx ao longo do ângulo, ly perpendicular;
 *   - viga: (x, y) é o apoio 1; o eixo segue o ângulo e tem o comprimento total dos vãos;
 *   - pilar: (x, y) é o centro da seção; bx ao longo do ângulo; o pilar chega à cota do seu
 *     pavimento vindo de baixo (comprimento = lance abaixo do nível);
 *   - lajes e vigas ficam com a face superior na cota do pavimento;
 *   - escada: (x, y) é o canto do início do primeiro lance (x na largura, y no sentido de subida); o pavimento é o
 *     de chegada e o início fica no nível de baixo.
 */

import { geometriaDa } from '../../modules/concreto-escada/calculo.js';
import { linhasDeApoioTelhado } from '../../modules/madeira-telhado/calculo.js';
export const TOLERANCIA = 0.1; // m — distância máxima para considerar dois elementos ligados
const RAD = Math.PI / 180;

/* ------------------------------------------------------------------ pavimentos */

export const novoIdPavimento = () => `pav_${Math.random().toString(36).slice(2, 7)}`;

export function pavimentosPadrao() {
  return [{ id: 'pav1', nome: '1º pavimento', cota: 2.8 }];
}

/** Pavimentos em ordem de cota (de baixo para cima). */
export const pavimentosOrdenados = (projeto) => [...(projeto.pavimentos ?? [])].sort((a, b) => a.cota - b.cota);

export const pavimento = (projeto, id) => projeto.pavimentos?.find((p) => p.id === id) ?? null;

/** Pavimento imediatamente abaixo (ou null). */
export function pavimentoAbaixo(projeto, id) {
  const ord = pavimentosOrdenados(projeto);
  const i = ord.findIndex((p) => p.id === id);
  return i > 0 ? ord[i - 1] : null;
}

/** Pé-direito do lance que chega ao pavimento: diferença para o nível de baixo (ou a própria cota). */
export function peDireito(projeto, id) {
  const p = pavimento(projeto, id);
  if (!p) return null;
  const abaixo = pavimentoAbaixo(projeto, id);
  // pavimento tipo embaixo (etapa L9): o lance começa no último nível dele
  const n = Math.max(1, Math.floor(Number(abaixo?.repeticoes) || 1));
  const topo = abaixo ? abaixo.cota + (n > 1 ? (n - 1) * (peDireito(projeto, abaixo.id) ?? 0) : 0) : 0;
  return Math.round((p.cota - topo) * 1000) / 1000;
}

/* ------------------------------------------------------------------ geometria por tipo */

/** 'laje' | 'viga' | 'pilar' | null, pela categoria do módulo. */
export function tipoDe(el, registro) {
  const cat = registro.obter(el.modulo)?.categoria;
  return { lajes: 'laje', vigas: 'viga', pilares: 'pilar', escadas: 'escada', reservatorios: 'reservatorio' }[cat] ?? null;
}

/** Dimensões em planta de uma laje (m): lx na direção das nervuras/vão, ly perpendicular. */
export function dimensoesLaje(el) {
  if (el.lx != null) return { lx: el.lx, ly: el.ly ?? 1 };
  // reservatório: retângulo dos eixos das paredes
  if (el.modulo === 'concreto.reservatorio') return { lx: (Number(el.a) || 2) + (Number(el.e) || 15) / 100, ly: (Number(el.b) || 3) + (Number(el.e) || 15) / 100 };
  // lajes em uma direção: L = vão das nervuras/vigotas; com direcao 'y' ele corre no eixo y da planta
  if (el.direcao === 'y') return { lx: el.largura ?? 1, ly: el.L ?? 1 };
  return { lx: el.L ?? 1, ly: el.largura ?? 1 };
}

/** Espessura total da laje (cm), por tipo. */
export function espessuraLaje(el) {
  if (el.painel?.MRd != null) return (el.painel.h ?? 20) + (el.capa ?? 0);          // alveolar
  if (el.vigota) return el.vigota.h + (el.painel?.espessura ?? 0) / 10;             // entrepiso de madeira
  if (el.he != null) return el.he + (el.hf ?? 0);                                   // treliçada
  return el.h ?? 10;                                                                // maciça e nervurada
}

export const comprimentoViga = (el) => (el.vaos ?? []).reduce((s, v) => s + (v.L ?? 0), 0);
export const secaoViga = (el) => ({ b: el.secao?.b ?? 15, h: el.secao?.h ?? 40 });
export const secaoPilar = (el) => (el?.forma === 'circular'
  ? { bx: Number(el.D) || el.bx || 30, by: Number(el.D) || el.bx || 30, D: Number(el.D) || el.bx || 30, circular: true }
  : { bx: el.bx ?? el.b ?? 20, by: el.by ?? el.h ?? 20 });

const girar = ([px, py], ang, [ox, oy]) => {
  const c = Math.cos(ang * RAD), s = Math.sin(ang * RAD);
  return [ox + px * c - py * s, oy + px * s + py * c];
};

/** Cantos da laje no sistema global, em ordem (inf. esq., inf. dir., sup. dir., sup. esq.). */
export function cantosLaje(el) {
  const { x = 0, y = 0, angulo = 0 } = el.posicao ?? {};
  const { lx, ly } = dimensoesLaje(el);
  return [[0, 0], [lx, 0], [lx, ly], [0, ly]].map((p) => girar(p, angulo, [x, y]));
}

/** Bordas da laje no sistema global: { x0, x1, y0, y1 } → [ponto inicial, ponto final]. */
export function bordasLaje(el) {
  const [a, b, c, d] = cantosLaje(el);
  return { y0: [a, b], x1: [b, c], y1: [d, c], x0: [a, d] };
}

/** Ligações das lajes em uma direção usam apoio-a/apoio-b: bordas x0/x1, ou y0/y1 com as vigotas em y. */
export const bordaDaLigacao = (id, el) => (el?.direcao === 'y' ? { 'apoio-a': 'y0', 'apoio-b': 'y1' } : { 'apoio-a': 'x0', 'apoio-b': 'x1' })[id] ?? id;

/** Eixo da viga: extremos, posição dos apoios e intervalos dos vãos ao longo do eixo (m). */
export function eixoViga(el) {
  const { x = 0, y = 0, angulo = 0 } = el.posicao ?? {};
  const L = comprimentoViga(el);
  const u = [Math.cos(angulo * RAD), Math.sin(angulo * RAD)];
  const xs = [0];
  for (const v of el.vaos ?? []) xs.push(xs[xs.length - 1] + v.L);
  return {
    a: [x, y], b: [x + u[0] * L, y + u[1] * L], u, L,
    apoios: xs.map((s) => [x + u[0] * s, y + u[1] * s]),
    vaos: xs.slice(0, -1).map((s, k) => [s, xs[k + 1]]),
  };
}

export const centroPilar = (el) => [el.posicao?.x ?? 0, el.posicao?.y ?? 0];

/**
 * Escada na planta: lances, patamares e apoios em coordenadas globais (m), com o pavimento de cada apoio
 * ('inferior' → o pavimento de baixo, 'superior' → o de chegada, 'intermediario' → nenhum). null sem posição ou geometria.
 */
export function escadaNaPlanta(el, projeto) {
  if (!el.posicao) return null;
  let g;
  try { g = geometriaDa(el, projeto); } catch { return null; }
  const { x = 0, y = 0, angulo = 0 } = el.posicao;
  const c = Math.cos(angulo * RAD), s = Math.sin(angulo * RAD);
  const T = ([u, v]) => [x + u * c - v * s, y + u * s + v * c];
  const ret = (r) => [T([r.x0, r.y0]), T([r.x1, r.y0]), T([r.x1, r.y1]), T([r.x0, r.y1])];
  const chegada = el.posicao.pavimento;
  const baixo = pavimentoAbaixo(projeto, chegada)?.id ?? null;
  const pavDe = (nivel) => (nivel === 'superior' ? chegada : nivel === 'inferior' ? baixo : null);
  return {
    geometria: g, T, angulo,
    cotaBase: (baixo ? pavimento(projeto, baixo).cota : (pavimento(projeto, chegada)?.cota ?? 0) - g.H / 100),
    contorno: ret({ x0: 0, y0: 0, x1: g.geo.largura, y1: g.geo.comprimento }),
    lances: g.geo.lances.map((l) => {
      // linhas dos degraus (uma por piso), perpendiculares ao sentido do lance
      const n = l.espelhos - 1, linhas = [];
      const sobe = l.sentido;
      for (let k = 1; k < n; k++) {
        const fr = k / n;
        if (sobe[1] !== 0) { const yy = sobe[1] > 0 ? l.y0 + fr * (l.y1 - l.y0) : l.y1 - fr * (l.y1 - l.y0); linhas.push([T([l.x0, yy]), T([l.x1, yy])]); }
        else { const xx = sobe[0] > 0 ? l.x0 + fr * (l.x1 - l.x0) : l.x1 - fr * (l.x1 - l.x0); linhas.push([T([xx, l.y0]), T([xx, l.y1])]); }
      }
      const cx = (l.x0 + l.x1) / 2, cy = (l.y0 + l.y1) / 2;
      const seta = sobe[1] !== 0 ? [T([cx, sobe[1] > 0 ? l.y0 + 0.15 : l.y1 - 0.15]), T([cx, sobe[1] > 0 ? l.y1 - 0.15 : l.y0 + 0.15])]
        : [T([sobe[0] > 0 ? l.x0 + 0.15 : l.x1 - 0.15, cy]), T([sobe[0] > 0 ? l.x1 - 0.15 : l.x0 + 0.15, cy])];
      return { poligono: ret(l), degraus: linhas, seta, espelhos: l.espelhos };
    }),
    patamares: g.geo.patamares.map((p) => ({ poligono: ret(p), nivel: p.nivel })),
    apoios: g.geo.apoios.map((a) => ({ ...a, seg: a.seg.map(T), pavimento: pavDe(a.nivel) })),
  };
}

/** Cantos da seção do pilar no sistema global. */
export function cantosPilar(el) {
  const { bx, by } = secaoPilar(el);
  const ang = el.posicao?.angulo ?? 0;
  const c = centroPilar(el);
  const hx = bx / 200, hy = by / 200;
  return [[-hx, -hy], [hx, -hy], [hx, hy], [-hx, hy]].map((p) => girar(p, ang, c));
}

/** Contorno da seção do pilar no sistema global: os quatro cantos ou, no pilar circular, um polígono de 32 lados. */
export function contornoPilar(el, n = 32) {
  const sec = secaoPilar(el);
  if (!sec.circular) return cantosPilar(el);
  const [cx, cy] = centroPilar(el), r = sec.D / 200;
  return Array.from({ length: n }, (_, k) => [cx + r * Math.cos((2 * Math.PI * k) / n), cy + r * Math.sin((2 * Math.PI * k) / n)]);
}

/** Pontos de encaixe de um elemento (para o arrasto magnético na planta). */
export function pontosDeEncaixe(el, tipo) {
  if (tipo === 'laje') return cantosLaje(el);
  if (tipo === 'viga') return eixoViga(el).apoios;
  if (tipo === 'pilar') return [centroPilar(el)];
  return [];
}

/* ------------------------------------------------------------------ giro */

/** Centro de um elemento na planta (gira com ele em torno da origem da posição). */
export function centroDoElemento(el, t) {
  if (t === 'laje' || t === 'reservatorio') { const c = cantosLaje(el); return [c.reduce((s0, p) => s0 + p[0], 0) / 4, c.reduce((s0, p) => s0 + p[1], 0) / 4]; }
  if (t === 'viga') { const { a, b } = eixoViga(el); return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; }
  return [el.posicao.x ?? 0, el.posicao.y ?? 0];
}

/** Gira um elemento de `delta` graus em torno do próprio centro (altera no lugar; o ângulo fica entre 0 e 360°). */
export function girarElemento(el, t, delta) {
  const c0 = centroDoElemento(el, t);
  el.posicao.angulo = Math.round((((el.posicao.angulo ?? 0) + delta) % 360 + 360) % 360 * 1e6) / 1e6;
  const c1 = centroDoElemento(el, t);
  el.posicao.x = Math.round(((el.posicao.x ?? 0) + c0[0] - c1[0]) * 1e5) / 1e5;
  el.posicao.y = Math.round(((el.posicao.y ?? 0) + c0[1] - c1[1]) * 1e5) / 1e5;
}

/* ------------------------------------------------------------------ detecção de ligações */

const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);

/** Trecho de um segmento que coincide com o eixo de uma viga: [s0, s1] ao longo do eixo, ou null. */
function sobreposicao(seg, eixo, tol) {
  const [p, q] = seg;
  const n = [-eixo.u[1], eixo.u[0]];
  const desvio = (pt) => Math.abs((pt[0] - eixo.a[0]) * n[0] + (pt[1] - eixo.a[1]) * n[1]);
  if (desvio(p) > tol || desvio(q) > tol) return null;
  const t = (pt) => (pt[0] - eixo.a[0]) * eixo.u[0] + (pt[1] - eixo.a[1]) * eixo.u[1];
  const s0 = Math.max(0, Math.min(t(p), t(q))), s1 = Math.min(eixo.L, Math.max(t(p), t(q)));
  return s1 - s0 > Math.max(0.2, tol * 2) ? [s0, s1] : null;
}

/** Vãos da viga cobertos por um trecho [s0, s1]: 'todos' ou lista de índices. */
function vaosCobertos(eixo, [s0, s1]) {
  const cobertos = eixo.vaos
    .map(([a, b], k) => ({ k, frac: Math.max(0, Math.min(b, s1) - Math.max(a, s0)) / (b - a) }))
    .filter((v) => v.frac >= 0.5 - 1e-6).map((v) => v.k);
  if (!cobertos.length) {
    // trecho curto: o vão com maior sobreposição
    const melhor = eixo.vaos.map(([a, b], k) => ({ k, ov: Math.min(b, s1) - Math.max(a, s0) })).sort((x, y) => y.ov - x.ov)[0];
    return melhor && melhor.ov > 0 ? [melhor.k] : [];
  }
  return cobertos.length === eixo.vaos.length ? 'todos' : cobertos;
}

/**
 * Ligações sugeridas pela geometria.
 * @returns {{tipo:'laje-viga'|'viga-pilar'|'pilar-pilar', receptor:object, fonte:object, ligacao:string, vao?:number|'todos', texto:string}[]}
 */
export function detectarLigacoes(projeto, registro, { tol = TOLERANCIA, tolGeo = toleranciaGeometrica(projeto) } = {}) {
  const posicionados = projeto.elementos.filter((e) => e.posicao && pavimento(projeto, e.posicao.pavimento));
  const porTipo = (t) => posicionados.filter((e) => tipoDe(e, registro) === t);
  const lajes = porTipo('laje'), vigas = porTipo('viga'), pilares = porTipo('pilar');
  const mesmoPav = (a, b) => a.posicao.pavimento === b.posicao.pavimento;
  const out = [];

  // laje → viga: borda vinculada sobre o eixo da viga
  for (const laje of lajes) {
    const mod = registro.obter(laje.modulo);
    const ligs = (mod?.ligacoes?.(laje) ?? []).filter((l) => l.tipo === 'linear');
    const bordas = bordasLaje(laje);
    for (const lig of ligs) {
      const seg = bordas[bordaDaLigacao(lig.id, laje)];
      if (!seg) continue;
      for (const viga of vigas.filter((v) => mesmoPav(v, laje))) {
        const eixo = eixoViga(viga);
        const ov = sobreposicao(seg, eixo, tol);
        if (!ov) continue;
        const vaos = vaosCobertos(eixo, ov);
        const lista = vaos === 'todos' ? ['todos'] : vaos;
        for (const vao of lista) {
          out.push({ tipo: 'laje-viga', receptor: viga, fonte: laje, ligacao: lig.id, vao,
            texto: `${laje.codigo} · ${lig.nome} → ${viga.codigo}${vao === 'todos' ? '' : ` (vão ${vao + 1})`}` });
        }
      }
    }
  }

  // reservatório → vigas (paredes sobre as vigas) ou → pilares (cantos sobre os pilares), no pavimento do fundo
  for (const res of porTipo('reservatorio')) {
    const mod = registro.obter(res.modulo);
    const ligs = mod?.ligacoes?.(res) ?? [];
    const bordas = bordasLaje(res), cantos = cantosLaje(res);
    for (const lig of ligs) {
      if (lig.tipo === 'linear') {
        for (const viga of vigas.filter((v) => mesmoPav(v, res))) {
          const eixo = eixoViga(viga);
          const ov = sobreposicao(bordas[lig.id], eixo, Math.max(tol, secaoViga(viga).b / 200 + 0.02));
          if (!ov) continue;
          const vaos = vaosCobertos(eixo, ov);
          for (const vao of vaos === 'todos' ? ['todos'] : vaos) {
            // parede sobre parte do vão: a carga fica só no trecho coberto
            let trecho = null;
            if (vao !== 'todos') {
              const [a, b] = eixo.vaos[vao];
              const t0 = Math.max(a, ov[0]) - a, t1 = Math.min(b, ov[1]) - a;
              if (t1 - t0 < b - a - 0.05) trecho = [Math.round(t0 * 1000) / 1000, Math.round(t1 * 1000) / 1000];
            }
            out.push({ tipo: 'reservatorio-viga', receptor: viga, fonte: res, ligacao: lig.id, vao, trecho, texto: `${res.codigo} · ${lig.nome} → ${viga.codigo}${vao === 'todos' ? '' : ` (vão ${vao + 1}${trecho ? `, ${fmt(trecho[0])} a ${fmt(trecho[1])} m` : ''})`}` });
          }
        }
      } else {
        const k = Number(lig.id.split('-')[1]) - 1;
        for (const pilar of pilares.filter((p) => mesmoPav(p, res))) {
          const { bx, by } = secaoPilar(pilar);
          if (dist(cantos[k], centroPilar(pilar)) <= Math.max(tol, Math.max(bx, by) / 200)) out.push({ tipo: 'reservatorio-pilar', receptor: pilar, fonte: res, ligacao: lig.id, texto: `${res.codigo} · ${lig.nome} → ${pilar.codigo}` });
        }
      }
    }
  }

  // telhado → vigas: beirais (e oitões) sobre o eixo das vigas do pavimento em que as tesouras apoiam
  for (const tel of posicionados.filter((e) => e.modulo === 'madeira.telhado')) {
    const linhas = linhasDeApoioTelhado(tel);
    for (const [lig, seg] of Object.entries(linhas)) {
      for (const viga of vigas.filter((v) => mesmoPav(v, tel))) {
        const eixo = eixoViga(viga);
        const ov = sobreposicao(seg, eixo, Math.max(tol, secaoViga(viga).b / 200 + 0.02));
        if (!ov) continue;
        const vaos = vaosCobertos(eixo, ov);
        for (const vao of vaos === 'todos' ? ['todos'] : vaos) {
          let trecho = null;
          if (vao !== 'todos') {
            const [a, b] = eixo.vaos[vao];
            const t0 = Math.max(a, ov[0]) - a, t1 = Math.min(b, ov[1]) - a;
            if (t1 - t0 < b - a - 0.05) trecho = [Math.round(t0 * 1000) / 1000, Math.round(t1 * 1000) / 1000];
          }
          const nome = lig.startsWith('oitao') ? `oitão ${Number(lig.slice(-1)) + 1}` : `apoio ${lig.slice(-1).toUpperCase()}`;
          out.push({ tipo: 'telhado-viga', receptor: viga, fonte: tel, ligacao: lig, vao, trecho, texto: `${tel.codigo} · ${nome} → ${viga.codigo}${vao === 'todos' ? '' : ` (vão ${vao + 1})`}` });
        }
      }
    }
  }

  // escada → viga: linha de apoio do tramo sobre o eixo de uma viga do nível do apoio (de baixo ou de chegada)
  for (const esc of porTipo('escada')) out.push(...ligacoesDaEscada(projeto, esc, vigas, { tol, registro }));

  // viga → pilar: apoio da viga sobre o pilar do mesmo pavimento
  for (const viga of vigas) {
    const mod = registro.obter(viga.modulo);
    const ativos = new Set((mod?.ligacoes?.(viga) ?? []).map((l) => l.id));
    const eixo = eixoViga(viga);
    eixo.apoios.forEach((pt, k) => {
      const id = `apoio-${k}`;
      if (!ativos.has(id)) return;
      for (const pilar of pilares.filter((p) => mesmoPav(p, viga))) {
        const { bx, by } = secaoPilar(pilar);
        // dentro do raio de busca do centro, ou dentro do contorno do pilar a menos da tolerância geométrica (encostada na face)
        if (dist(pt, centroPilar(pilar)) <= Math.max(tol, Math.max(bx, by) / 200) || distanciaAoPilar(pt, pilar).d <= tolGeo + EPS) {
          out.push({ tipo: 'viga-pilar', receptor: pilar, fonte: viga, ligacao: id, texto: `${viga.codigo} · apoio ${k + 1} → ${pilar.codigo}` });
        }
      }
    });
  }

  // pilar → pilar: o pilar de cima descarrega no de baixo, no mesmo prumo
  for (const sup of pilares) {
    const abaixo = pavimentoAbaixo(projeto, sup.posicao.pavimento);
    if (!abaixo) continue;
    let temPilar = false;
    for (const inf of pilares.filter((p) => p.posicao.pavimento === abaixo.id)) {
      // mesmo prumo, ou o centro do de cima dentro da seção do de baixo (seção maior com ponto fixo num canto)
      if (dist(centroPilar(sup), centroPilar(inf)) <= tol || distanciaAoPilar(centroPilar(sup), inf).d <= tolGeo + EPS) {
        temPilar = true;
        out.push({ tipo: 'pilar-pilar', receptor: inf, fonte: sup, ligacao: 'base', texto: `${sup.codigo} (${pavimento(projeto, sup.posicao.pavimento).nome}) → ${inf.codigo}` });
      }
    }
    // pilar nascendo em viga (transição, etapa L10): sem pilar embaixo, a base cai sobre o eixo de uma viga do nível de baixo
    if (temPilar) continue;
    const c = centroPilar(sup);
    for (const v of vigas.filter((x) => x.posicao.pavimento === abaixo.id)) {
      const e = eixoViga(v);
      const s = (c[0] - e.a[0]) * e.u[0] + (c[1] - e.a[1]) * e.u[1];
      const desvio = Math.abs((c[0] - e.a[0]) * -e.u[1] + (c[1] - e.a[1]) * e.u[0]);
      if (s < 0.05 || s > e.L - 0.05 || desvio > Math.max(tol, secaoViga(v).b / 200)) continue;
      const k = Math.max(0, e.vaos.findIndex(([x0, x1]) => s >= x0 - 1e-9 && s <= x1 + 1e-9));
      const posicao = Math.round((s - e.vaos[k][0]) * 1000) / 1000;
      out.push({ tipo: 'pilar-viga', receptor: v, fonte: sup, ligacao: 'base', vao: k, posicao, concentrada: true,
        texto: `${sup.codigo} (${pavimento(projeto, sup.posicao.pavimento).nome}) nasce em ${v.codigo} (vão ${k + 1}, x = ${fmt(posicao)} m)` });
      break;
    }
  }
  return out;
}

/**
 * Ligações de uma escada com as vigas sob as linhas de apoio dos tramos.
 * @param {object[]} vigas  vigas posicionadas candidatas
 */
export function ligacoesDaEscada(projeto, esc, vigas, { tol = TOLERANCIA, registro = null } = {}) {
  const out = [];
  const pl = escadaNaPlanta(esc, projeto);
  if (!pl) return out;
  const nomes = registro?.obter(esc.modulo)?.ligacoes?.(esc) ?? [];
  for (const ap of pl.apoios) {
    if (!ap.pavimento) continue;
    const meio = [(ap.seg[0][0] + ap.seg[1][0]) / 2, (ap.seg[0][1] + ap.seg[1][1]) / 2];
    for (const viga of vigas.filter((v) => v.posicao?.pavimento === ap.pavimento)) {
      const eixo = eixoViga(viga);
      if (!sobreposicao(ap.seg, eixo, Math.max(tol, secaoViga(viga).b / 200 + 0.02))) continue;
      const s = (meio[0] - eixo.a[0]) * eixo.u[0] + (meio[1] - eixo.a[1]) * eixo.u[1];
      const k = Math.max(0, eixo.vaos.findIndex(([a, b]) => s >= a - 1e-9 && s <= b + 1e-9));
      const posicao = Math.round((s - eixo.vaos[k][0]) * 1000) / 1000;
      const nome = nomes.find((l) => l.id === ap.id)?.nome ?? ap.id;
      out.push({ tipo: 'escada-viga', receptor: viga, fonte: esc, ligacao: ap.id, vao: k, posicao,
        texto: `${esc.codigo} · ${nome} → ${viga.codigo} (vão ${k + 1}, x = ${fmt(posicao)} m)` });
    }
  }
  return out;
}

const mesmaLigacao = (c, lig) => c.tipo === 'elemento' && c.elementoId === lig.fonte.id && c.ligacao === lig.ligacao;
const cobreVao = (c, lig) => lig.vao == null || c.vao === 'todos' || c.vao === lig.vao || lig.vao === 'todos';

/** A ligação já existe como carga no elemento receptor? */
export const ligacaoExiste = (receptor, lig) => (Array.isArray(receptor.cargas) ? receptor.cargas : []).some((c) => mesmaLigacao(c, lig) && cobreVao(c, lig));

/**
 * Cria no projeto (no lugar) as cargas das ligações que ainda não existem.
 * @returns {number} quantas cargas foram criadas
 */
export function aplicarLigacoes(projeto, ligacoes) {
  let n = 0;
  for (const lig of ligacoes) {
    const rec = projeto.elementos.find((e) => e.id === lig.receptor.id);
    if (!rec) continue;
    if (ligacaoExiste(rec, lig)) {
      // escada deslocada: a ligação existe, mas a posição na viga muda junto
      const c = lig.posicao != null && rec.cargas.find((x) => mesmaLigacao(x, lig) && x.vao === lig.vao);
      if (c && Math.abs((c.posicao ?? -1) - lig.posicao) > 1e-6) { c.posicao = lig.posicao; if (rec.resultado) rec.resultado.desatualizado = true; n++; }
      continue;
    }
    if (!Array.isArray(rec.cargas)) rec.cargas = [];
    const carga = { id: `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, tipo: 'elemento', elementoId: lig.fonte.id, ligacao: lig.ligacao, descricao: lig.fonte.nome ?? lig.fonte.codigo };
    if (lig.vao != null) carga.vao = lig.vao;
    if (lig.posicao != null) carga.posicao = lig.posicao;
    if (lig.trecho) carga.trecho = lig.trecho;
    if (lig.concentrada) carga.concentrada = true;
    rec.cargas.push(carga);
    if (rec.resultado) rec.resultado.desatualizado = true;
    n++;
  }
  return n;
}

/**
 * Ligações existentes (cargas do tipo elemento) com a situação geométrica:
 * 'ok' coincide com a planta, 'fora' os dois estão posicionados mas não coincidem, 'sem-posicao'.
 */
export function ligacoesExistentes(projeto, registro, detectadas = detectarLigacoes(projeto, registro)) {
  const out = [];
  for (const rec of projeto.elementos) {
    if (!Array.isArray(rec.cargas)) continue;
    for (const c of rec.cargas) {
      if (c?.tipo !== 'elemento') continue;
      const fonte = projeto.elementos.find((e) => e.id === c.elementoId);
      if (!fonte) continue;
      const geo = detectadas.some((d) => d.receptor.id === rec.id && mesmaLigacao(c, d) && (c.vao == null || d.vao === c.vao || d.vao === 'todos' || c.vao === 'todos'));
      const situacao = geo ? 'ok' : rec.posicao && fonte.posicao ? 'fora' : 'sem-posicao';
      const nomeLig = registro.obter(fonte.modulo)?.ligacoes?.(fonte)?.find((l) => l.id === c.ligacao)?.nome ?? c.ligacao;
      out.push({ receptor: rec, fonte, carga: c, situacao,
        texto: `${fonte.codigo} · ${nomeLig} → ${rec.codigo}${c.vao != null && c.vao !== 'todos' ? ` (vão ${Number(c.vao) + 1}${c.posicao != null ? `, x = ${fmt(c.posicao)} m` : ''})` : ''}` });
    }
  }
  return out;
}

/**
 * Avisos de montagem: pilares com comprimento diferente do pé-direito, elementos fora de pavimento e folgas pequenas
 * (acima da tolerância geométrica) entre um apoio e o elemento que deveria recebê-lo.
 */
export function avisosMontagem(projeto, registro) {
  const avisos = folgasGeometricas(projeto, registro).map((f) => ({ elemento: f.elemento, folga: f, texto: f.texto }));
  for (const el of projeto.elementos) {
    if (!el.posicao) continue;
    if (!pavimento(projeto, el.posicao.pavimento)) { avisos.push({ elemento: el, texto: `${el.codigo}: o pavimento não existe mais — reposicione.` }); continue; }
    if (tipoDe(el, registro) === 'pilar') {
      const pd = peDireito(projeto, el.posicao.pavimento);
      if (pd > 0 && Math.abs((el.comprimento ?? 0) - pd) > 0.005) {
        avisos.push({ elemento: el, ajustarComprimento: pd, texto: `${el.codigo}: comprimento ${fmt(el.comprimento)} m diferente do pé-direito ${fmt(pd)} m do lance.` });
      }
    }
  }
  return avisos;
}

const fmt = (v) => (Number.isFinite(v) ? v.toFixed(2).replace('.', ',') : '—');

/* ------------------------------------------------------------------ tolerância geométrica e limpeza da geometria */

/** Tolerância geométrica padrão, em mm: nós mais próximos que isso se fundem (roteiro, etapa L1). */
export const TOLERANCIA_GEOMETRICA_MM = 1;

/** Tolerância geométrica do projeto, em m (Parâmetros › Montagem). */
export function toleranciaGeometrica(projeto) {
  const t = Number(projeto?.parametros?.montagem?.tolerancia);
  return (Number.isFinite(t) && t >= 0 ? t : TOLERANCIA_GEOMETRICA_MM) / 1000;
}

/** Até onde uma folga acima da tolerância gera aviso (m): mais longe que isso, os elementos não deviam se tocar. */
export const limiteDeAviso = (tol) => Math.max(0.02, 5 * tol);

const EPS = 1e-7;
const mm = (d) => `${(d * 1000).toFixed(1).replace('.', ',')} mm`;
const arred = (v) => Math.round(v * 1e6) / 1e6;

/** Ponto do segmento [a, b] mais próximo de p. */
function noSegmento(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  const t = L2 > 0 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)) : 0;
  const q = [a[0] + t * dx, a[1] + t * dy];
  return { q, d: dist(p, q) };
}

function dentroDoPoligono([x, y], poli) {
  let dentro = false;
  for (let i = 0, j = poli.length - 1; i < poli.length; j = i++) {
    const [xi, yi] = poli[i], [xj, yj] = poli[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dentro = !dentro;
  }
  return dentro;
}

/** Distância de um ponto à seção do pilar: 0 dentro dela; fora, a distância à face mais próxima. */
export function distanciaAoPilar(p, pilar) {
  const poli = contornoPilar(pilar);
  if (dentroDoPoligono(p, poli)) return { d: 0, dentro: true };
  let d = Infinity;
  for (let k = 0; k < poli.length; k++) d = Math.min(d, noSegmento(p, poli[k], poli[(k + 1) % poli.length]).d);
  return { d, dentro: false };
}

/** Parâmetro s em que a reta p + s·u corta o segmento [c, e] (null se não corta). */
function cortaSegmento(p, u, c, e) {
  const v = [e[0] - c[0], e[1] - c[1]];
  const den = u[0] * v[1] - u[1] * v[0];
  if (Math.abs(den) < 1e-12) return null;
  const w = [c[0] - p[0], c[1] - p[1]];
  const t = (w[0] * u[1] - w[1] * u[0]) / den;
  return t >= -1e-9 && t <= 1 + 1e-9 ? (w[0] * v[1] - w[1] * v[0]) / den : null;
}

/** Índices dos apoios da viga que pedem um elemento embaixo (os apoios do módulo que não são livres). */
function apoiosAtivos(viga, registro) {
  const ids = (registro.obter(viga.modulo)?.ligacoes?.(viga) ?? []).map((l) => l.id).filter((id) => /^apoio-\d+$/.test(id));
  return ids.map((id) => Number(id.split('-')[1]));
}

/**
 * Situação geométrica de um apoio de viga em relação aos pilares e às outras vigas do mesmo pavimento, buscando até
 * a distância `busca`. Devolve o que está mais perto e a melhor correção possível:
 *   fundir   — o apoio fica a d de um nó de outra viga (fim de vão): leva o apoio até o nó;
 *   estender — prolongando ou encurtando a viga ao longo do eixo, o apoio chega a uma face de pilar ou ao eixo de outra viga.
 */
/** Pilares e vigas de um pavimento, com o contorno, o eixo e a caixa envolvente de cada um (para as buscas). */
function contextoDoPavimento(projeto, registro, pav) {
  const caixa = (pts) => { const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; };
  const doPav = projeto.elementos.filter((e) => e.posicao?.pavimento === pav);
  return {
    pilares: doPav.filter((e) => tipoDe(e, registro) === 'pilar').map((el) => { const poli = contornoPilar(el); return { el, poli, caixa: caixa(poli) }; }),
    vigas: doPav.filter((e) => tipoDe(e, registro) === 'viga' && Array.isArray(e.vaos) && e.vaos.length).map((el) => { const eixo = eixoViga(el); return { el, eixo, caixa: caixa([eixo.a, eixo.b]) }; }),
  };
}
const longe = ([x0, y0, x1, y1], [px, py], r) => px < x0 - r || px > x1 + r || py < y0 - r || py > y1 + r;

function analisarApoio(projeto, registro, viga, k, busca, ctx = contextoDoPavimento(projeto, registro, viga.posicao.pavimento)) {
  const eixo = eixoViga(viga);
  const p = eixo.apoios[k];
  const pilares = ctx.pilares.filter((x) => x.el.id !== viga.id && !longe(x.caixa, p, busca + 0.001));
  const vigas = ctx.vigas.filter((x) => x.el.id !== viga.id && !longe(x.caixa, p, busca + 0.001));
  if (pilares.some((x) => distanciaAoPilar(p, x.el).dentro)) return { ok: true };

  let perto = { d: Infinity }; // o que está mais perto, de qualquer tipo
  let acao = null;             // a correção de menor deslocamento
  // os nós se fundem primeiro: um nó de outra viga ao alcance vence o prolongamento até uma face ou um eixo
  const propor = (a) => {
    if (a.d > busca + EPS) return;
    const melhor = !acao || (a.tipo === 'fundir' && acao.tipo !== 'fundir') || (a.tipo === acao.tipo && a.d < acao.d - EPS);
    if (melhor) acao = a;
  };
  for (const { el: pl, poli } of pilares) {
    const { d } = distanciaAoPilar(p, pl);
    if (d < perto.d) perto = { d, alvo: pl, onde: `da face de ${pl.codigo}` };
    // ao longo do eixo da viga, até a face
    for (let j = 0; j < poli.length; j++) {
      const s = cortaSegmento(p, eixo.u, poli[j], poli[(j + 1) % poli.length]);
      if (s != null) propor({ tipo: 'estender', d: Math.abs(s), ds: s, alvo: pl, onde: `até a face de ${pl.codigo}` });
    }
  }
  for (const { el: o, eixo: eo } of vigas) {
    for (const q of eo.apoios) {
      const d = dist(p, q);
      if (d < perto.d - EPS) perto = { d, alvo: o, onde: `do nó de ${o.codigo}` };
      if (d > EPS) propor({ tipo: 'fundir', d, q, alvo: o, onde: `no nó de ${o.codigo}` });
    }
    const { d } = noSegmento(p, eo.a, eo.b);
    if (d < perto.d - EPS) perto = { d, alvo: o, onde: `do eixo de ${o.codigo}` };
    const s = cortaSegmento(p, eixo.u, eo.a, eo.b);
    if (s != null) propor({ tipo: 'estender', d: Math.abs(s), ds: s, alvo: o, onde: `até o eixo de ${o.codigo}` });
  }
  if (perto.d <= EPS) return { ok: true, perto };
  return { ok: false, perto, acao };
}

/** Desloca o apoio k da viga ao longo do eixo (du, m), mudando os vãos vizinhos; no primeiro apoio a viga anda junto. */
function moverApoio(viga, k, du) {
  const u = eixoViga(viga).u, n = viga.vaos.length;
  if (k === 0) {
    viga.posicao.x = arred(viga.posicao.x + u[0] * du);
    viga.posicao.y = arred(viga.posicao.y + u[1] * du);
    viga.vaos[0].L = arred(viga.vaos[0].L - du);
  } else if (k === n) viga.vaos[n - 1].L = arred(viga.vaos[n - 1].L + du);
  else { viga.vaos[k - 1].L = arred(viga.vaos[k - 1].L + du); viga.vaos[k].L = arred(viga.vaos[k].L - du); }
}

/** A correção cabe na viga sem deixar um vão curto demais (a correção é de milímetros, não de metros). */
function cabe(viga, k, du) {
  const n = viga.vaos.length, L = (i) => viga.vaos[i]?.L ?? 0;
  if (k === 0) return L(0) - du > 0.05;
  if (k === n) return L(n - 1) + du > 0.05;
  return L(k - 1) + du > 0.05 && L(k) - du > 0.05;
}

const vigasPosicionadas = (projeto, registro) => projeto.elementos
  .filter((e) => e.posicao && pavimento(projeto, e.posicao.pavimento) && tipoDe(e, registro) === 'viga' && Array.isArray(e.vaos) && e.vaos.length)
  .sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'pt-BR', { numeric: true }));
const pilaresPosicionados = (projeto, registro) => projeto.elementos
  .filter((e) => e.posicao && pavimento(projeto, e.posicao.pavimento) && tipoDe(e, registro) === 'pilar')
  .sort((a, b) => String(a.codigo).localeCompare(String(b.codigo), 'pt-BR', { numeric: true }));

/** Pilar do nível de baixo mais próximo do prumo de um pilar (para fundir o prumo). */
function prumoAbaixo(projeto, registro, pl, pilares = pilaresPosicionados(projeto, registro)) {
  const abaixo = pavimentoAbaixo(projeto, pl.posicao.pavimento);
  if (!abaixo) return null;
  let melhor = null;
  for (const o of pilares) {
    if (o.posicao.pavimento !== abaixo.id) continue;
    const d = dist(centroPilar(pl), centroPilar(o));
    if (!melhor || d < melhor.d) melhor = { d, alvo: o, pav: abaixo };
  }
  return melhor;
}

/**
 * Limpar geometria: funde os nós a menos de `tol` — o apoio da viga vai até o nó da outra viga, até a face do pilar
 * ou até o eixo da viga que o recebe, prolongando ou encurtando a viga ao longo do próprio eixo (nenhuma viga gira),
 * e o pilar de cima vai para o prumo do de baixo. Altera o projeto no lugar.
 * @param {{tol?: number, filtro?: (el: object, apoio: number|null) => boolean}} [op]  tol em m (padrão: a do projeto)
 * @returns {{elemento: object, apoio: number|null, tipo: 'fundir'|'estender'|'prumo', distancia: number, texto: string}[]}
 */
export function limparGeometria(projeto, registro, { tol = toleranciaGeometrica(projeto), filtro = () => true } = {}) {
  const feitas = [];
  for (const pl of pilaresPosicionados(projeto, registro)) {
    if (!filtro(pl, null)) continue;
    const m = prumoAbaixo(projeto, registro, pl);
    if (!m || m.d <= EPS || m.d > tol + EPS) continue;
    [pl.posicao.x, pl.posicao.y] = centroPilar(m.alvo).map(arred);
    feitas.push({ elemento: pl, apoio: null, tipo: 'prumo', distancia: m.d, texto: `${pl.codigo} levado ao prumo de ${m.alvo.codigo} (${m.pav.nome}) · ${mm(m.d)}` });
  }
  for (const v of vigasPosicionadas(projeto, registro)) {
    for (const k of apoiosAtivos(v, registro)) {
      if (!filtro(v, k)) continue;
      const r = analisarApoio(projeto, registro, v, k, tol);
      if (r.ok || !r.acao) continue;
      const a = r.acao;
      const { u } = eixoViga(v);
      if (a.tipo === 'estender') {
        if (!cabe(v, k, a.ds)) continue;
        moverApoio(v, k, a.ds);
      } else {
        const p = eixoViga(v).apoios[k];
        const dx = a.q[0] - p[0], dy = a.q[1] - p[1];
        const du = dx * u[0] + dy * u[1], dn = -dx * u[1] + dy * u[0];
        // cada viga anda só ao longo do próprio eixo: num encontro em L ou em T, a outra viga resolve a outra direção
        // quando chega a vez dela; só quando o nó está de lado (vigas em linha) a viga inteira anda, sem girar
        if (Math.abs(du) > EPS) {
          if (!cabe(v, k, du)) continue;
          moverApoio(v, k, du);
        } else { v.posicao.x = arred(v.posicao.x - u[1] * dn); v.posicao.y = arred(v.posicao.y + u[0] * dn); }
      }
      feitas.push({ elemento: v, apoio: k, tipo: a.tipo, distancia: a.d, texto: `${v.codigo} · apoio ${k + 1} levado ${a.onde} · ${mm(a.d)}` });
    }
  }
  return feitas;
}

/**
 * Folgas pequenas: apoios de vigas e prumos de pilares que ficam acima da tolerância geométrica, mas perto o bastante
 * (até limiteDeAviso) para parecerem erro de desenho. `encostar` diz se Limpar geometria resolve com tolerância `d`.
 * @returns {{elemento: object, apoio: number|null, distancia: number, encostar: boolean, texto: string}[]}
 */
export function folgasGeometricas(projeto, registro, { tol = toleranciaGeometrica(projeto) } = {}) {
  const lim = limiteDeAviso(tol);
  const out = [];
  const tolTxt = mm(tol).replace(',0 mm', ' mm');
  const todos = pilaresPosicionados(projeto, registro);
  for (const pl of todos) {
    const m = prumoAbaixo(projeto, registro, pl, todos);
    if (m && m.d > tol + EPS && m.d <= lim) {
      out.push({ elemento: pl, apoio: null, distancia: m.d, encostar: true, texto: `${pl.codigo} a ${mm(m.d)} do prumo de ${m.alvo.codigo} (${m.pav.nome}) — mais que a tolerância de ${tolTxt}.` });
    }
  }
  const ctx = new Map();
  for (const v of vigasPosicionadas(projeto, registro)) {
    const pav = v.posicao.pavimento;
    if (!ctx.has(pav)) ctx.set(pav, contextoDoPavimento(projeto, registro, pav));
    for (const k of apoiosAtivos(v, registro)) {
      const r = analisarApoio(projeto, registro, v, k, lim, ctx.get(pav));
      if (r.ok || !(r.perto.d > tol + EPS) || r.perto.d > lim) continue;
      // uma correção dentro da tolerância resolve sozinha: não é folga
      if (r.acao && r.acao.d <= tol + EPS) continue;
      const encostar = !!r.acao && cabe(v, k, r.acao.ds ?? 0);
      out.push({ elemento: v, apoio: k, distancia: encostar ? r.acao.d : r.perto.d, encostar,
        texto: `${v.codigo} · apoio ${k + 1} a ${mm(r.perto.d)} ${r.perto.onde} — mais que a tolerância de ${tolTxt}.` });
    }
  }
  return out;
}

/**
 * Viga do mesmo pavimento sobre cujo eixo cai o apoio k de uma viga (viga apoiada em viga; a grelha liga as duas), ou null.
 */
export function vigaSobApoio(projeto, registro, v, k) {
  const pt = eixoViga(v).apoios[k];
  if (!pt || !v.posicao) return null;
  return projeto.elementos.find((o) => {
    if (o.id === v.id || o.posicao?.pavimento !== v.posicao.pavimento || tipoDe(o, registro) !== 'viga') return false;
    const { a, b } = eixoViga(o);
    const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
    if (!(L2 > 0)) return false;
    const t = Math.max(0, Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / L2));
    return dist(pt, [a[0] + t * dx, a[1] + t * dy]) <= TOLERANCIA;
  }) ?? null;
}

/** Apoios dos patamares intermediários da escada (sem nível de piso: não pedem elemento da montagem). */
export const apoiosIntermediariosDaEscada = (projeto, esc) => new Set((escadaNaPlanta(esc, projeto)?.apoios ?? []).filter((x) => !x.pavimento).map((x) => x.id));

/* ------------------------------------------------------------------ estado da montagem por elemento */

export const FUNDACOES_PILAR = ['concreto.sapata', 'concreto.bloco'];

/**
 * Radier que recebe o pilar: o que o lista em `pilares`, ou — com a lista vazia — qualquer radier, desde que o pilar
 * não tenha sapata nem bloco (e esteja dentro do contorno, quando o contorno é informado).
 */
export function radierDoPilar(projeto, pilar) {
  const els = projeto?.elementos ?? [];
  const radiers = els.filter((e) => e.modulo === 'concreto.radier');
  if (!radiers.length || !pilar) return null;
  if (els.some((e) => FUNDACOES_PILAR.includes(e.modulo) && e.pilarId === pilar.id)) return null;
  for (const r of radiers) {
    if (Array.isArray(r.pilares) && r.pilares.length) { if (r.pilares.includes(pilar.id)) return r; continue; }
    if (r.geometria?.modo === 'manual' && pilar.posicao) {
      const [cx, cy] = centroPilar(pilar), { x = 0, y = 0 } = r.local ?? {};
      if (cx >= x - 1e-6 && cx <= x + (Number(r.geometria.lx) || 0) + 1e-6 && cy >= y - 1e-6 && cy <= y + (Number(r.geometria.ly) || 0) + 1e-6) return r;
      continue;
    }
    return r;
  }
  return null;
}

/** Fundação sob o pilar: sapata ou bloco ligados a ele, ou o radier que o recebe. */
export function fundacaoDoPilar(projeto, pilar) {
  return (projeto?.elementos ?? []).find((e) => FUNDACOES_PILAR.includes(e.modulo) && e.pilarId === pilar?.id) ?? radierDoPilar(projeto, pilar);
}
export const NA_MONTAGEM = ['laje', 'viga', 'pilar', 'escada', 'reservatorio'];

/**
 * Situação de cada elemento na montagem do modelo — a segunda bolinha do explorador:
 *   'sem-posicao' — ainda não posicionado (círculo vazio);
 *   'ok'          — posicionado, e todos os apoios e ancoragens conferem com a planta;
 *   'erro'        — algo da montagem não confere: apoio sem elemento que o receba, ligação que não bate com a posição,
 *                   ligação que a planta indica mas não foi aplicada, pavimento inexistente, pilar fora do pé-direito.
 * Fundações (sapata, bloco) contam pelo pilar ligado. Outros módulos (sondagem, madeira isolada…) ficam de fora.
 * @returns {Map<string, {estado:'sem-posicao'|'ok'|'erro', problemas:string[]}>}
 */
export function estadoMontagem(projeto, registro) {
  const mapa = new Map();
  if (!projeto) return mapa;
  const els = projeto.elementos;
  const porId = new Map(els.map((e) => [e.id, e]));
  const detectadas = detectarLigacoes(projeto, registro);
  const existentes = ligacoesExistentes(projeto, registro, detectadas);
  // quem recebe cada ligação de cada elemento (elementoId|ligacao → receptores)
  const recebe = new Map();
  for (const r of els) for (const c of Array.isArray(r.cargas) ? r.cargas : []) {
    if (c?.tipo !== 'elemento') continue;
    const k = `${c.elementoId}|${c.ligacao}`;
    if (!recebe.has(k)) recebe.set(k, []);
    recebe.get(k).push(r);
  }
  const temFundacao = els.some((e) => FUNDACOES_PILAR.includes(e.modulo) || e.modulo === 'concreto.radier');
  const avisos = new Map();
  for (const a of avisosMontagem(projeto, registro)) { if (!avisos.has(a.elemento.id)) avisos.set(a.elemento.id, []); avisos.get(a.elemento.id).push(a.texto); }
  const problemas = (id) => { if (!mapa.has(id)) mapa.set(id, { estado: 'ok', problemas: [] }); return mapa.get(id).problemas; };
  const sobreOutraViga = (v, k) => !!vigaSobApoio(projeto, registro, v, k);
  const intermediarios = (esc) => apoiosIntermediariosDaEscada(projeto, esc);

  for (const el of els) {
    const tipo = tipoDe(el, registro);
    if (FUNDACOES_PILAR.includes(el.modulo)) {
      if (!el.pilarId) { mapa.set(el.id, { estado: 'sem-posicao', problemas: ['Sem pilar ligado.'] }); continue; }
      const p = porId.get(el.pilarId);
      const pr = problemas(el.id);
      if (!p) pr.push('O pilar ligado não existe mais.');
      else if (els.some((x) => x.modulo === 'concreto.pilar' && x.id !== p.id && (x.cargas ?? []).some?.((c) => c.tipo === 'elemento' && c.elementoId === p.id && c.ligacao === 'base'))) pr.push(`${p.codigo} descarrega num pilar de baixo, não na fundação.`);
      continue;
    }
    if (!NA_MONTAGEM.includes(tipo)) continue;
    if (!el.posicao) { mapa.set(el.id, { estado: 'sem-posicao', problemas: ['Ainda não posicionado na montagem.'] }); continue; }
    const pr = problemas(el.id);
    pr.push(...(avisos.get(el.id) ?? []));
    if (!pavimento(projeto, el.posicao.pavimento)) continue;
    // apoios e ancoragens que o elemento oferece: cada um precisa de alguém que o receba
    const mod = registro.obter(el.modulo);
    for (const l of mod?.ligacoes?.(el) ?? []) {
      const quem = recebe.get(`${el.id}|${l.id}`) ?? [];
      if (quem.length) continue;
      if (tipo === 'pilar' && l.id === 'base') {
        const fund = fundacaoDoPilar(projeto, el);
        const abaixo = pavimentoAbaixo(projeto, el.posicao.pavimento);
        // o lance de baixo sem fundação no projeto (nenhuma criada) não é erro de montagem
        if (fund || (!abaixo && !temFundacao)) continue;
        pr.push(abaixo ? `Base de ${el.codigo} sem pilar, viga ou fundação embaixo.` : `Base de ${el.codigo} sem fundação (o projeto tem fundações em outros pilares).`);
        continue;
      }
      // viga apoiada em outra viga: o apoio fica sobre o eixo de uma viga do mesmo pavimento (a grelha liga as duas)
      if (tipo === 'viga' && /^apoio-\d+$/.test(l.id) && sobreOutraViga(el, Number(l.id.split('-')[1]))) continue;
      // patamar intermediário da escada: não há nível de piso ali (apoio em viga de patamar ou parede, fora da montagem)
      if (tipo === 'escada' && intermediarios(el).has(l.id)) continue;
      pr.push(`${l.nome ?? l.id}: sem elemento de apoio ligado.`);
    }
    // um pilar posicionado que não recebe nada não está montado
    if (tipo === 'pilar' && !(el.cargas ?? []).some?.((c) => c.tipo === 'elemento')) pr.push('Não recebe nenhuma viga, laje ou pilar.');
  }
  // ligações aplicadas que não conferem com as posições
  for (const x of existentes) {
    if (x.situacao !== 'fora') continue;
    for (const e of [x.receptor, x.fonte]) if (mapa.has(e.id) && mapa.get(e.id).estado !== 'sem-posicao') problemas(e.id).push(`Ligação ${x.texto} não confere com a posição na planta.`);
  }
  // ligações que a planta indica e ainda não foram aplicadas
  for (const d of detectadas) {
    if (ligacaoExiste(d.receptor, d)) continue;
    for (const e of [d.receptor, d.fonte]) if (mapa.has(e.id) && mapa.get(e.id).estado !== 'sem-posicao') problemas(e.id).push(`Ligação ${d.texto} indicada pela planta e não aplicada — use Conectar automaticamente na montagem.`);
  }
  for (const v of mapa.values()) if (v.estado !== 'sem-posicao') { v.problemas = [...new Set(v.problemas)]; v.estado = v.problemas.length ? 'erro' : 'ok'; }
  return mapa;
}
