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
  return Math.round((p.cota - (abaixo?.cota ?? 0)) * 1000) / 1000;
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
export const secaoPilar = (el) => ({ bx: el.bx ?? el.b ?? 20, by: el.by ?? el.h ?? 20 });

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

/** Pontos de encaixe de um elemento (para o arrasto magnético na planta). */
export function pontosDeEncaixe(el, tipo) {
  if (tipo === 'laje') return cantosLaje(el);
  if (tipo === 'viga') return eixoViga(el).apoios;
  if (tipo === 'pilar') return [centroPilar(el)];
  return [];
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
export function detectarLigacoes(projeto, registro, { tol = TOLERANCIA } = {}) {
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
        if (dist(pt, centroPilar(pilar)) <= Math.max(tol, Math.max(bx, by) / 200)) {
          out.push({ tipo: 'viga-pilar', receptor: pilar, fonte: viga, ligacao: id, texto: `${viga.codigo} · apoio ${k + 1} → ${pilar.codigo}` });
        }
      }
    });
  }

  // pilar → pilar: o pilar de cima descarrega no de baixo, no mesmo prumo
  for (const sup of pilares) {
    const abaixo = pavimentoAbaixo(projeto, sup.posicao.pavimento);
    if (!abaixo) continue;
    for (const inf of pilares.filter((p) => p.posicao.pavimento === abaixo.id)) {
      if (dist(centroPilar(sup), centroPilar(inf)) <= tol) {
        out.push({ tipo: 'pilar-pilar', receptor: inf, fonte: sup, ligacao: 'base', texto: `${sup.codigo} (${pavimento(projeto, sup.posicao.pavimento).nome}) → ${inf.codigo}` });
      }
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

/** Avisos de montagem: pilares com comprimento diferente do pé-direito, elementos fora de pavimento. */
export function avisosMontagem(projeto, registro) {
  const avisos = [];
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

/* ------------------------------------------------------------------ estado da montagem por elemento */

const FUNDACOES_PILAR = ['concreto.sapata', 'concreto.bloco'];
const NA_MONTAGEM = ['laje', 'viga', 'pilar', 'escada', 'reservatorio'];

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
  const temFundacao = els.some((e) => FUNDACOES_PILAR.includes(e.modulo));
  const avisos = new Map();
  for (const a of avisosMontagem(projeto, registro)) { if (!avisos.has(a.elemento.id)) avisos.set(a.elemento.id, []); avisos.get(a.elemento.id).push(a.texto); }
  const problemas = (id) => { if (!mapa.has(id)) mapa.set(id, { estado: 'ok', problemas: [] }); return mapa.get(id).problemas; };
  const vigasDoPav = (pav) => els.filter((e) => tipoDe(e, registro) === 'viga' && e.posicao?.pavimento === pav);
  const sobreOutraViga = (v, k) => {
    const pt = eixoViga(v).apoios[k];
    if (!pt) return false;
    return vigasDoPav(v.posicao.pavimento).some((o) => {
      if (o.id === v.id) return false;
      const { a, b } = eixoViga(o);
      const dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
      if (!(L2 > 0)) return false;
      const t = Math.max(0, Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / L2));
      return dist(pt, [a[0] + t * dx, a[1] + t * dy]) <= TOLERANCIA;
    });
  };
  const intermediarios = (esc) => new Set((escadaNaPlanta(esc, projeto)?.apoios ?? []).filter((x) => !x.pavimento).map((x) => x.id));

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
        const fund = els.find((e) => FUNDACOES_PILAR.includes(e.modulo) && e.pilarId === el.id);
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
