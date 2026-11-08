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
 * Pranchas em DXF (R12, unidade = cm): plantas de fôrmas por pavimento, locação dos pilares com as cargas na
 * fundação e armação de vigas, pilares e lajes maciças. Cada prancha é um arquivo, com camadas separadas.
 *
 * As coordenadas da montagem (m) viram cm; os detalhes de armação saem da lista de ferros do detalhamento, com as
 * edições do usuário. Textos e símbolos são dimensionados pela escala de impressão de cada prancha.
 */
import { Dxf, COR } from '../../engine/dxf.js';
import { resumoComPerdas } from '../../engine/detalhamento.js';
import { cantosPilar, cantosLaje, eixoViga, escadaNaPlanta, dimensoesLaje } from '../../renderer/core/montagem.js';
import { posicoesDe, detalhamentoDe, baseDoPilar } from './detalhamento.js';
import { perdasDoProjeto } from './quantitativos.js';

const VIGA = 'concreto.viga', PILAR = 'concreto.pilar', LAJE = 'concreto.laje.macica';
const TIPOS_LAJE = ['concreto.laje.macica', 'concreto.laje.nervurada', 'concreto.laje.trelicada', 'concreto.laje.alveolar'];
const cm = ([x, y]) => [x * 100, y * 100];
const f = (v, c = 2) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '-');
const phiTxt = (phi) => `%%c${String(phi).replace('.', ',')}`;
const comparar = (a, b) => String(a.codigo).localeCompare(String(b.codigo), 'pt-BR', { numeric: true });
const legivel = (ang) => { let a = ((ang % 360) + 360) % 360; if (a > 90.001 && a <= 270.001) a -= 180; return a > 180 ? a - 360 : a; };

/** Camadas de cada tipo de prancha (nome → cor ACI e tipo de linha). */
export const CAMADAS = {
  EIXOS: { cor: COR.vermelho, linha: 'CENTER' },
  PILARES: { cor: COR.amarelo },
  VIGAS: { cor: COR.branco },
  LAJES: { cor: COR.ciano },
  ESCADAS: { cor: COR.azul },
  RESERVATORIOS: { cor: COR.azul, linha: 'DASHED' },
  FUNDACOES: { cor: COR.magenta, linha: 'DASHED' },
  COTAS: { cor: COR.verde },
  TEXTOS: { cor: COR.branco },
  NIVEIS: { cor: COR.magenta },
  TABELAS: { cor: COR.cinza },
  CARIMBO: { cor: COR.cinza },
  CONCRETO: { cor: COR.cinza },
  'ARMADURA-POSITIVA': { cor: COR.vermelho },
  'ARMADURA-NEGATIVA': { cor: COR.azul },
  'ARMADURA-LONGITUDINAL': { cor: COR.vermelho },
  'ARMADURA-TRANSVERSAL': { cor: COR.verde },
  'ARMADURA-CONSTRUTIVA': { cor: COR.cinza },
  'ARMADURA-DISTRIBUICAO': { cor: COR.ciano },
};

function novoDxf(escala) {
  const d = new Dxf({ escalaLinhas: escala / 2 });
  for (const [nome, c] of Object.entries(CAMADAS)) d.camada(nome, c);
  // tamanhos em cm de desenho a partir de mm no papel
  d.mm = escala / 10;
  return d;
}

/** Carimbo: projeto, prancha, escala, data e versão, no canto inferior direito da extensão atual. */
function carimbo(d, projeto, titulo, escala, versao) {
  const [[x0, y0], [x1]] = d.extensao;
  const w = 180 * d.mm, h = 40 * d.mm;
  const X = x1 - w, Y = y0 - h - 15 * d.mm;
  const t = 2.5 * d.mm;
  d.retangulo('CARIMBO', [X, Y], [X + w, Y + h]);
  d.linha('CARIMBO', [X, Y + h * 0.5], [X + w, Y + h * 0.5]);
  d.linha('CARIMBO', [X + w * 0.62, Y], [X + w * 0.62, Y + h * 0.5]);
  d.texto('CARIMBO', [X + 4 * d.mm, Y + h - 8 * d.mm], projeto.meta?.nome ?? 'Projeto', { altura: t * 1.3 });
  d.texto('CARIMBO', [X + 4 * d.mm, Y + h - 15 * d.mm], [projeto.meta?.autor, projeto.meta?.cliente].filter(Boolean).join(' · ') || 'LEBR — Laboratório de Estruturas Brasil', { altura: t * 0.8 });
  d.texto('CARIMBO', [X + 4 * d.mm, Y + h * 0.5 - 8 * d.mm], titulo, { altura: t });
  d.texto('CARIMBO', [X + 4 * d.mm, Y + 5 * d.mm], `LEBR ${versao ?? ''} · NBR 6118:2023`, { altura: t * 0.7 });
  d.texto('CARIMBO', [X + w * 0.62 + 4 * d.mm, Y + h * 0.5 - 8 * d.mm], `ESCALA 1:${escala}`, { altura: t });
  d.texto('CARIMBO', [X + w * 0.62 + 4 * d.mm, Y + 5 * d.mm], `${new Date().toLocaleDateString('pt-BR')} · unidade: cm`, { altura: t * 0.7 });
  return [x0, Y];
}

/** Tabela com linhas e colunas; devolve a altura ocupada. */
function tabela(d, [x, y], colunas, linhas, { altura = 2.5 } = {}) {
  const t = altura * d.mm, lh = t * 2;
  const larg = colunas.map((c) => (c.largura ?? 18) * d.mm);
  const W = larg.reduce((s, v) => s + v, 0);
  const todas = [colunas.map((c) => c.titulo), ...linhas];
  todas.forEach((ln, i) => {
    const yy = y - i * lh;
    let xx = x;
    ln.forEach((cel, j) => {
      const dir = colunas[j].alinhar === 'dir';
      d.texto('TABELAS', [dir ? xx + larg[j] - t * 0.5 : xx + t * 0.5, yy - lh * 0.7], cel, { altura: t * (i === 0 ? 0.9 : 1), alinhar: dir ? 'direita' : 'esquerda' });
      xx += larg[j];
    });
    d.linha('TABELAS', [x, yy - lh], [x + W, yy - lh]);
  });
  d.retangulo('TABELAS', [x, y - todas.length * lh], [x + W, y]);
  let xx = x;
  for (const l of larg.slice(0, -1)) { xx += l; d.linha('TABELAS', [xx, y], [xx, y - todas.length * lh]); }
  return { altura: todas.length * lh, largura: W };
}

/** Tabela de aço (lista de ferros) e resumo por bitola com perdas. */
function tabelaDeAco(d, [x, y], grupos, perdas, { titulo = 'TABELA DE AÇO' } = {}) {
  const t = 2.5 * d.mm;
  d.texto('TABELAS', [x, y + t * 0.6], titulo, { altura: t * 1.2 });
  const linhas = [];
  const todas = [];
  for (const g of grupos) for (const q of g.posicoes) {
    todas.push(q);
    linhas.push([g.codigo, q.N, phiTxt(q.phi), String(q.n), f(q.comprimento, 0), f((q.n * q.comprimento) / 100, 2)]);
  }
  const col = [{ titulo: 'Elemento', largura: 20 }, { titulo: 'N', largura: 10 }, { titulo: 'Bitola', largura: 14 }, { titulo: 'Qtd.', largura: 12, alinhar: 'dir' }, { titulo: 'C unit. (cm)', largura: 22, alinhar: 'dir' }, { titulo: 'C total (m)', largura: 22, alinhar: 'dir' }];
  const t1 = tabela(d, [x, y], col, linhas);
  const r = resumoComPerdas(todas, perdas);
  const y2 = y - t1.altura - 14 * d.mm;
  d.texto('TABELAS', [x, y2 + t * 0.6], `RESUMO DO AÇO (perdas de ${f(perdas, 0)} %)`, { altura: t * 1.2 });
  const t2 = tabela(d, [x, y2], [{ titulo: 'Aço', largura: 16 }, { titulo: 'Bitola', largura: 14 }, { titulo: 'C total (m)', largura: 22, alinhar: 'dir' }, { titulo: 'Massa (kg)', largura: 22, alinhar: 'dir' }, { titulo: '+ perdas (kg)', largura: 24, alinhar: 'dir' }],
    [...r.linhas.map((l) => [l.aco, phiTxt(l.phi), f(l.metros, 1), f(l.kg, 1), f(l.kgPerdas, 1)]), ['TOTAL', '', '', f(r.total, 1), f(r.totalPerdas, 1)]]);
  return { altura: t1.altura + t2.altura + 14 * d.mm, largura: Math.max(t1.largura, t2.largura), resumo: r };
}

/* ====================================================================== fôrmas */

function elementosDoPavimento(projeto, pav) {
  return projeto.elementos.filter((e) => e.posicao?.pavimento === pav.id);
}

/** Planta de fôrmas de um pavimento: eixos, pilares, vigas, lajes, cotas e nível. */
export function plantaDeFormas(projeto, pav, { versao, escala = 50 } = {}) {
  const d = novoDxf(escala);
  const t = 2.5 * d.mm;
  const els = elementosDoPavimento(projeto, pav);
  const pilares = els.filter((e) => e.modulo === PILAR).sort(comparar);
  const vigas = els.filter((e) => e.modulo === VIGA).sort(comparar);
  const lajes = els.filter((e) => TIPOS_LAJE.includes(e.modulo)).sort(comparar);
  // lajes
  for (const l of lajes) {
    const c = cantosLaje(l).map(cm);
    d.polilinha('LAJES', c, { fechada: true });
    const cx = c.reduce((s, p) => s + p[0], 0) / 4, cy = c.reduce((s, p) => s + p[1], 0) / 4;
    const h = l.h ?? (l.he != null ? l.he + (l.hf ?? 0) : null);
    d.texto('TEXTOS', [cx, cy + t * 0.3], l.codigo, { altura: t * 1.4, alinhar: 'centro', vertical: 'baixo' });
    d.texto('TEXTOS', [cx, cy - t * 0.3], h ? `h = ${f(h, 0)} cm` : '', { altura: t, alinhar: 'centro', vertical: 'cima' });
  }
  // reservatórios e escadas
  for (const r of els.filter((e) => e.modulo === 'concreto.reservatorio')) {
    const c = cantosLaje(r).map(cm);
    d.polilinha('RESERVATORIOS', c, { fechada: true });
    const { lx, ly } = dimensoesLaje(r);
    d.texto('TEXTOS', cm([r.posicao.x + lx / 2, r.posicao.y + ly / 2]), r.codigo, { altura: t * 1.2, alinhar: 'centro', vertical: 'meio' });
  }
  for (const e of els.filter((x) => x.modulo === 'concreto.escada')) {
    const g = escadaNaPlanta(e, projeto);
    if (!g) continue;
    for (const l of g.lances) { d.polilinha('ESCADAS', l.poligono.map(cm), { fechada: true }); for (const [a, b] of l.degraus) d.linha('ESCADAS', cm(a), cm(b)); }
    for (const p of g.patamares) d.polilinha('ESCADAS', p.poligono.map(cm), { fechada: true });
    const c = g.contorno.map(cm);
    d.texto('TEXTOS', [(c[0][0] + c[2][0]) / 2, (c[0][1] + c[2][1]) / 2], e.codigo, { altura: t * 1.2, alinhar: 'centro', vertical: 'meio' });
  }
  // vigas: contorno ao longo do eixo
  for (const v of vigas) {
    const ex = eixoViga(v);
    const b = (v.secao?.b ?? 15) / 2 / 100;
    const nn = [-ex.u[1], ex.u[0]];
    const P = (p, s) => cm([p[0] + nn[0] * s, p[1] + nn[1] * s]);
    d.polilinha('VIGAS', [P(ex.a, -b), P(ex.b, -b), P(ex.b, b), P(ex.a, b)], { fechada: true });
    // rótulo no meio do vão mais longo (no meio da viga ficaria sobre um pilar)
    const [s0, s1] = ex.vaos.reduce((a, q) => (q[1] - q[0] > a[1] - a[0] ? q : a), ex.vaos[0] ?? [0, ex.L]);
    const sm = (s0 + s1) / 2;
    const m = [ex.a[0] + ex.u[0] * sm, ex.a[1] + ex.u[1] * sm];
    const ang = legivel((Math.atan2(ex.u[1], ex.u[0]) * 180) / Math.PI);
    const lado = Math.abs(ang - (Math.atan2(ex.u[1], ex.u[0]) * 180) / Math.PI) < 1 ? 1 : -1;
    d.texto('TEXTOS', P(m, lado * (b + 0.06)), `${v.codigo} (${f(v.secao?.b ?? 15, 0)}x${f(v.secao?.h ?? 40, 0)})${v.invertida ? ' INV.' : ''}`, { altura: t, alinhar: 'centro', vertical: 'baixo', angulo: ang });
  }
  // pilares
  for (const p of pilares) {
    const c = pilarNaPlanta(d, p);
    const xs = c.map((q) => q[0]), ys = c.map((q) => q[1]);
    d.texto('TEXTOS', [Math.max(...xs) + t * 0.4, Math.max(...ys) + t * 0.4], `${p.codigo} (${p.forma === 'circular' ? `ø${f(p.D ?? p.bx, 0)}` : `${f(p.bx, 0)}x${f(p.by, 0)}`})`, { altura: t });
  }
  // eixos e cotas pelos centros dos pilares (pilares a 0° ou 90°)
  const [[xmin, ymin], [xmax, ymax]] = d.extensao;
  const centros = pilares.map((p) => cm([p.posicao.x, p.posicao.y]));
  const unicos = (v) => [...new Set(v.map((x) => Math.round(x)))].sort((a, b) => a - b);
  const ex = unicos(centros.map((c) => c[0])), ey = unicos(centros.map((c) => c[1]));
  const r = 4 * d.mm, folga = 18 * d.mm;
  ex.forEach((x, i) => {
    d.linha('EIXOS', [x, ymin - folga], [x, ymax + folga * 0.6]);
    d.circulo('EIXOS', [x, ymin - folga - r], r);
    d.texto('EIXOS', [x, ymin - folga - r], String(i + 1), { altura: t, alinhar: 'centro', vertical: 'meio' });
  });
  ey.forEach((y, i) => {
    d.linha('EIXOS', [xmin - folga, y], [xmax + folga * 0.6, y]);
    d.circulo('EIXOS', [xmin - folga - r, y], r);
    d.texto('EIXOS', [xmin - folga - r, y], String.fromCharCode(65 + (i % 26)), { altura: t, alinhar: 'centro', vertical: 'meio' });
  });
  const yc = ymin - folga - 2 * r - 10 * d.mm, xc = xmin - folga - 2 * r - 10 * d.mm;
  for (let i = 1; i < ex.length; i++) d.cota('COTAS', [ex[i - 1], yc], [ex[i], yc], { afastamento: 0, altura: t });
  if (ex.length > 2) d.cota('COTAS', [ex[0], yc], [ex.at(-1), yc], { afastamento: -8 * d.mm, altura: t });
  for (let i = 1; i < ey.length; i++) d.cota('COTAS', [xc, ey[i - 1]], [xc, ey[i]], { afastamento: 0, altura: t });
  if (ey.length > 2) d.cota('COTAS', [xc, ey[0]], [xc, ey.at(-1)], { afastamento: 8 * d.mm, altura: t });
  // nível e título
  const [[x0], [, y1]] = d.extensao;
  const yt = y1 + 14 * d.mm;
  d.polilinha('NIVEIS', [[x0, yt], [x0 + 3 * d.mm, yt + 4 * d.mm], [x0 - 3 * d.mm, yt + 4 * d.mm]], { fechada: true });
  d.texto('NIVEIS', [x0 + 5 * d.mm, yt + 0.5 * d.mm], `NÍVEL ${pav.cota >= 0 ? '+' : ''}${f(pav.cota, 2)} m`, { altura: t });
  d.texto('TEXTOS', [x0, yt + 10 * d.mm], `PLANTA DE FÔRMAS — ${String(pav.nome).toUpperCase()}`, { altura: t * 1.6 });
  carimbo(d, projeto, `Fôrmas — ${pav.nome}`, escala, versao);
  return d;
}

/* ====================================================================== locação */

/** Pilares que descarregam na fundação: os de baixo da prumada que não nascem em viga. */
/** Seção do pilar na planta, com o X tradicional; o pilar circular sai como círculo (0.33). Devolve os cantos (cm). */
function pilarNaPlanta(d, p) {
  const c = cantosPilar(p).map(cm);
  if (p.forma === 'circular') {
    const [x, y] = cm([p.posicao.x, p.posicao.y]), r = (Number(p.D) || p.bx) / 2, k = r / Math.SQRT2;
    d.circulo('PILARES', [x, y], r);
    d.linha('PILARES', [x - k, y - k], [x + k, y + k]); d.linha('PILARES', [x - k, y + k], [x + k, y - k]);
    return c;
  }
  d.polilinha('PILARES', c, { fechada: true });
  d.linha('PILARES', c[0], c[2]); d.linha('PILARES', c[1], c[3]);
  return c;
}

export function pilaresNaFundacao(projeto) {
  return projeto.elementos.filter((e) => e.modulo === PILAR && e.posicao && ['fundacao', null].includes(baseDoPilar(e, projeto).tipo)).sort(comparar);
}

export function plantaDeLocacao(projeto, { versao, escala = 50 } = {}) {
  const d = novoDxf(escala);
  const t = 2.5 * d.mm;
  const pils = pilaresNaFundacao(projeto);
  const fund = (p) => projeto.elementos.find((e) => ['concreto.sapata', 'concreto.bloco'].includes(e.modulo) && e.pilarId === p.id);
  for (const p of pils) {
    pilarNaPlanta(d, p);
    const [x, y] = cm([p.posicao.x, p.posicao.y]);
    const F = fund(p);
    const A = F?.resultado?.A ?? F?.geometria?.A, B = F?.resultado?.B ?? F?.geometria?.B;
    if (A && B) {
      const ang = ((p.posicao.angulo ?? 0) * Math.PI) / 180, cs = Math.cos(ang), sn = Math.sin(ang);
      const R = ([u, v]) => [x + u * cs - v * sn, y + u * sn + v * cs];
      d.polilinha('FUNDACOES', [[-A / 2, -B / 2], [A / 2, -B / 2], [A / 2, B / 2], [-A / 2, B / 2]].map(R), { fechada: true });
    }
    d.texto('TEXTOS', [x + (p.bx / 2) + t * 0.5, y + (p.by / 2) + t * 0.4], p.codigo, { altura: t * 1.1 });
    d.texto('TEXTOS', [x + (p.bx / 2) + t * 0.5, y - (p.by / 2) - t * 1.4], `(${f(p.posicao.x, 2)}; ${f(p.posicao.y, 2)})`, { altura: t * 0.8 });
  }
  // origem e cotas acumuladas a partir dela
  const [[xmin, ymin], [xmax, ymax]] = d.extensao;
  const o = [0, 0];
  d.linha('EIXOS', [o[0] - 10 * d.mm, o[1]], [o[0] + 10 * d.mm, o[1]]);
  d.linha('EIXOS', [o[0], o[1] - 10 * d.mm], [o[0], o[1] + 10 * d.mm]);
  d.texto('TEXTOS', [o[0] + 2 * d.mm, o[1] + 2 * d.mm], 'ORIGEM (0; 0)', { altura: t * 0.8 });
  const unicos = (v) => [...new Set(v.map((x) => Math.round(x)))].sort((a, b) => a - b);
  const xs = unicos(pils.map((p) => p.posicao.x * 100)), ys = unicos(pils.map((p) => p.posicao.y * 100));
  const yc = Math.min(ymin, 0) - 20 * d.mm, xc = Math.min(xmin, 0) - 20 * d.mm;
  xs.forEach((x, i) => d.cota('COTAS', [0, yc], [x, yc], { afastamento: -i * 7 * d.mm, altura: t * 0.9 }));
  ys.forEach((y, i) => d.cota('COTAS', [xc, 0], [xc, y], { afastamento: i * 7 * d.mm, altura: t * 0.9 }));
  // tabela de cargas na fundação
  const linhas = pils.map((p) => {
    const r = p.resultado;
    const F = fund(p);
    return [p.codigo, `${f(p.bx, 0)}x${f(p.by, 0)}`, f(p.posicao.x, 2), f(p.posicao.y, 2), r?.Nk ? f(r.Nk.g, 1) : '-', r?.Nk ? f(r.Nk.q, 1) : '-', r?.Nk ? f(r.Nk.g + r.Nk.q, 1) : '-', r?.Nd != null ? f(r.Nd, 1) : '-', F ? F.codigo : '-'];
  });
  const xt = Math.max(xmax, 0) + 30 * d.mm;
  d.texto('TABELAS', [xt, ymax + t * 0.6], 'CARGAS NA FUNDAÇÃO (valores característicos e de cálculo, kN)', { altura: t * 1.2 });
  tabela(d, [xt, ymax], [{ titulo: 'Pilar', largura: 16 }, { titulo: 'Seção (cm)', largura: 20 }, { titulo: 'x (m)', largura: 16, alinhar: 'dir' }, { titulo: 'y (m)', largura: 16, alinhar: 'dir' }, { titulo: 'Ng', largura: 16, alinhar: 'dir' }, { titulo: 'Nq', largura: 16, alinhar: 'dir' }, { titulo: 'Nk', largura: 16, alinhar: 'dir' }, { titulo: 'Nd', largura: 16, alinhar: 'dir' }, { titulo: 'Fundação', largura: 20 }], linhas);
  const [[x0], [, y1]] = d.extensao;
  d.texto('TEXTOS', [x0, y1 + 12 * d.mm], 'LOCAÇÃO DOS PILARES E CARGAS NA FUNDAÇÃO', { altura: t * 1.6 });
  d.texto('TEXTOS', [x0, y1 + 6 * d.mm], 'Coordenadas dos centros dos pilares em relação à origem do projeto (m); cotas em cm.', { altura: t * 0.8 });
  carimbo(d, projeto, 'Locação dos pilares', escala, versao);
  return d;
}

/* ====================================================================== armação de vigas */

function elevacaoViga(d, v, det, posicoes, [ox, oy]) {
  const t = 2.5 * d.mm;
  const h = v.secao.h, b = v.secao.b;
  const L = v.vaos.map((x) => x.L * 100);
  const X = [0]; for (const l of L) X.push(X.at(-1) + l);
  const larg = det.larguras ?? X.map(() => 20);
  const ini = v.apoios[0] === 'livre' ? 0 : -larg[0] / 2, fim = v.apoios.at(-1) === 'livre' ? X.at(-1) : X.at(-1) + larg.at(-1) / 2;
  const P = (x, y) => [ox + x, oy + y];
  d.retangulo('CONCRETO', P(ini, 0), P(fim, h));
  v.apoios.forEach((tp, k) => {
    if (tp === 'livre') return;
    d.retangulo('CONCRETO', P(X[k] - larg[k] / 2, -30), P(X[k] + larg[k] / 2, 0));
    d.texto('TEXTOS', P(X[k], -30 - t * 1.4), `A${k + 1}`, { altura: t * 0.8, alinhar: 'centro' });
  });
  const cob = 3;
  // estribos e barras dentro da peça
  for (const e of posicoes.filter((q) => q.tipo === 'estribo')) {
    for (const tr of e.trechos ?? []) {
      const n = Math.max(1, tr.qtd);
      for (let i = 0; i < n; i++) { const x = tr.x0 * 100 + ((tr.x1 - tr.x0) * 100 * (n === 1 ? 0.5 : i / (n - 1))); d.linha('ARMADURA-TRANSVERSAL', P(x, cob), P(x, h - cob)); }
      d.texto('TEXTOS', P(((tr.x0 + tr.x1) / 2) * 100, h / 2), `${e.N} ${tr.qtd} ${phiTxt(e.phi)} c/${f(tr.s, 0)}`, { altura: t * 0.8, alinhar: 'centro', vertical: 'meio' });
    }
  }
  const camada = (q) => (q.tipo === 'negativa' ? 'ARMADURA-NEGATIVA' : q.tipo === 'porta-estribo' || q.tipo === 'construtiva' ? 'ARMADURA-CONSTRUTIVA' : 'ARMADURA-LONGITUDINAL');
  const longas = posicoes.filter((q) => q.tipo !== 'estribo' && Number.isFinite(q.x0));
  for (const q of longas) {
    const y = q.face === 'superior' ? h - cob - 1 : q.face === 'inferior' ? cob + 1 : h / 2;
    d.linha(camada(q), P(q.x0 * 100, y), P(q.x1 * 100, y));
  }
  // barras extraídas, empacotadas em linhas
  const rot = (q) => `${q.N} ${q.n} ${phiTxt(q.phi)} C=${f(q.comprimento, 0)}`;
  const empacotar = (lista) => {
    const linhas = [];
    for (const q of lista) {
      const a = q.x0 * 100, z = q.x1 * 100, c = (a + z) / 2, tw = (rot(q).length * t * 0.62) / 2 + t;
      const e = [Math.min(a, c - tw) - t, Math.max(z, c + tw) + t];
      let i = linhas.findIndex((ln) => ln.every(([p0, p1]) => e[1] < p0 || e[0] > p1));
      if (i < 0) { linhas.push([]); i = linhas.length - 1; }
      linhas[i].push(e); q._l = i;
    }
    return linhas.length;
  };
  const sup = longas.filter((q) => q.face === 'superior').sort((a, c) => (c.x1 - c.x0) - (a.x1 - a.x0));
  const inf = longas.filter((q) => q.face !== 'superior').sort((a, c) => (c.x1 - c.x0) - (a.x1 - a.x0));
  empacotar(sup); const nInf = empacotar(inf);
  const passo = t * 3.2;
  const desenha = (q, y, para) => {
    const a = q.x0 * 100, z = q.x1 * 100, gch = q.phi; // 10ø (cm) = ø (mm)
    const pts = [];
    if (q.gancho?.[0]) pts.push(P(a, y + para * gch));
    pts.push(P(a, y), P(z, y));
    if (q.gancho?.[1]) pts.push(P(z, y + para * gch));
    d.polilinha(camada(q), pts);
    d.texto('TEXTOS', P((a + z) / 2, y + t * 0.4), rot(q), { altura: t, alinhar: 'centro' });
  };
  for (const q of sup) desenha(q, h + 20 + (q._l + 1) * passo, -1);
  for (const q of inf) desenha(q, -45 - q._l * passo, 1);
  // cotas dos vãos
  const yCota = -45 - nInf * passo - 10;
  for (let k = 0; k < L.length; k++) d.cota('COTAS', P(X[k], yCota), P(X[k + 1], yCota), { afastamento: 0, altura: t * 0.9 });
  // cortes por vão
  const larguraElev = fim - ini;
  return { largura: larguraElev, topo: h + 20 + (Math.max(0, ...sup.map((q) => q._l)) + 2) * passo, base: yCota - t * 2, xFim: fim };
}

function corteViga(d, v, res, k, [ox, oy]) {
  const t = 2.5 * d.mm;
  const { b, h } = v.secao, cob = 3;
  const P = (x, y) => [ox + x, oy + y];
  d.retangulo('CONCRETO', P(0, 0), P(b, h));
  d.retangulo('ARMADURA-TRANSVERSAL', P(cob, cob), P(b - cob, h - cob));
  const linha = (bar, y) => {
    if (!bar?.n) return;
    const r = bar.phi / 20;
    for (let i = 0; i < bar.n; i++) { const x = bar.n === 1 ? b / 2 : cob + 1 + r + ((b - 2 * cob - 2 - 2 * r) * i) / (bar.n - 1); d.circulo(bar.neg ? 'ARMADURA-NEGATIVA' : 'ARMADURA-LONGITUDINAL', P(x, y), Math.max(r, 0.4)); }
  };
  const vv = res.vaos[k];
  linha(vv.positiva?.barras, cob + 1.5);
  const ng = [res.apoios[k]?.negativa, res.apoios[k + 1]?.negativa].filter(Boolean).sort((a, c) => c.As - a.As)[0];
  linha(ng?.barras ? { ...ng.barras, neg: true } : { n: 2, phi: 6.3 }, h - cob - 1.5);
  d.texto('TEXTOS', P(b / 2, -t * 1.6), `CORTE ${String.fromCharCode(65 + k)}-${String.fromCharCode(65 + k)}`, { altura: t * 0.8, alinhar: 'centro' });
  d.texto('TEXTOS', P(b / 2, -t * 3), `vão ${k + 1}`, { altura: t * 0.7, alinhar: 'centro' });
  d.texto('TEXTOS', P(b / 2, h + t * 0.5), `${f(b, 0)}x${f(h, 0)}`, { altura: t * 0.8, alinhar: 'centro' });
  return b;
}

export function armacaoDeVigas(projeto, { versao, escala = 25 } = {}) {
  const d = novoDxf(escala);
  const t = 2.5 * d.mm;
  const perdas = perdasDoProjeto(projeto);
  const pav = (e) => projeto.pavimentos?.find((p) => p.id === e.posicao?.pavimento);
  const vigas = projeto.elementos.filter((e) => e.modulo === VIGA && e.resultado?.detalhamento?.posicoes?.length)
    .sort((a, b) => (pav(b)?.cota ?? 0) - (pav(a)?.cota ?? 0) || comparar(a, b));
  let y = 0;
  const grupos = [];
  let largMax = 0;
  for (const v of vigas) {
    const det = v.resultado.detalhamento;
    const posicoes = posicoesDe(v, v.resultado, projeto);
    grupos.push({ codigo: v.codigo, posicoes });
    // reserva a altura das barras de cima antes de desenhar
    const prov = elevacaoViga(novoDxf(escala), v, det, posicoes.map((q) => ({ ...q })), [0, 0]);
    const oy = y - prov.topo;
    d.texto('TEXTOS', [0, oy + prov.topo + t], `${v.codigo} (${f(v.secao.b, 0)}x${f(v.secao.h, 0)})${pav(v) ? ` — ${pav(v).nome}` : ''}${v.baldrame ? ' — baldrame' : ''}${v.invertida ? ' — invertida' : ''}`, { altura: t * 1.4 });
    const e = elevacaoViga(d, v, det, posicoes, [0, oy]);
    let xc = e.xFim + 60;
    // espaço de cada corte: a seção ou o rótulo, o que for maior
    v.vaos.forEach((_, k) => { const b = corteViga(d, v, v.resultado, k, [xc, oy]); xc += Math.max(b, 22 * t * 0.62) + 30; });
    largMax = Math.max(largMax, xc);
    y = oy + e.base - 60;
  }
  if (grupos.length) {
    tabelaDeAco(d, [largMax + 40, 0], grupos, perdas, { titulo: 'TABELA DE AÇO — VIGAS' });
    const [[x0], [, y1]] = d.extensao;
    d.texto('TEXTOS', [x0, y1 + 12 * d.mm], 'ARMAÇÃO DAS VIGAS', { altura: t * 1.6 });
    carimbo(d, projeto, 'Armação das vigas', escala, versao);
  }
  return { dxf: d, n: grupos.length };
}

/* ====================================================================== armação de pilares */

function desenhoPilar(d, p, det, posicoes, [ox, oy]) {
  const t = 2.5 * d.mm;
  const L = p.comprimento * 100, bx = p.bx, by = p.by, cob = p.resultado?.armadura?.cobrimento ?? 3;
  const P = (x, y) => [ox + x, oy + y];
  const long = posicoes.find((q) => q.tipo === 'longitudinal');
  const arr = posicoes.find((q) => q.tipo === 'arranque');
  const est = posicoes.find((q) => q.tipo === 'estribo');
  d.retangulo('CONCRETO', P(0, 0), P(bx, L));
  for (const z of [0, L]) d.linha('CONCRETO', P(-40, z), P(bx + 40, z));
  if (arr) { const emb = -arr.z0 * 100 + (det.base?.cob ?? 5); d.retangulo('CONCRETO', P(-50, -emb), P(bx + 50, 0)); d.texto('TEXTOS', P(bx + 54, -emb / 2), det.base?.codigo ?? '', { altura: t * 0.8 }); }
  if (est?.s) for (let z = 5; z <= L - 2; z += est.s) d.linha('ARMADURA-TRANSVERSAL', P(cob, z), P(bx - cob, z));
  if (long) { d.linha('ARMADURA-LONGITUDINAL', P(cob + 1, 0), P(cob + 1, long.z1 * 100)); d.linha('ARMADURA-LONGITUDINAL', P(bx - cob - 1, 0), P(bx - cob - 1, long.z1 * 100)); }
  if (arr) d.polilinha('ARMADURA-LONGITUDINAL', [P(cob + 3 + (arr.pe ?? 0), arr.z0 * 100), P(cob + 3, arr.z0 * 100), P(cob + 3, arr.z1 * 100)]);
  const tx = bx + 12;
  if (long) d.texto('TEXTOS', P(tx, L * 0.6), `${long.N} ${long.n} ${phiTxt(long.phi)} C=${f(long.comprimento, 0)}`, { altura: t });
  if (arr) d.texto('TEXTOS', P(tx, arr.z0 * 50), `${arr.N} ${arr.n} ${phiTxt(arr.phi)} C=${f(arr.comprimento, 0)}`, { altura: t });
  if (est) d.texto('TEXTOS', P(tx, L * 0.3), `${est.N} ${est.n} ${phiTxt(est.phi)} c/${f(est.s, 0)} C=${f(est.comprimento, 0)}`, { altura: t });
  if (det.l0c) d.cota('COTAS', P(-20, det.acima ? L : 0), P(-20, (det.acima ? L : 0) + det.l0c), { afastamento: 0, altura: t * 0.8 });
  d.cota('COTAS', P(-40, 0), P(-40, L), { afastamento: 0, altura: t * 0.8 });
  // seção ao lado
  const sx = tx + 150, sy = L * 0.55;
  const Q = (x, y) => P(sx + x, sy + y);
  const circular = p.forma === 'circular';
  if (circular) {
    d.circulo('CONCRETO', Q(bx / 2, by / 2), bx / 2);
    if (est) d.circulo('ARMADURA-TRANSVERSAL', Q(bx / 2, by / 2), bx / 2 - cob - est.phi / 20);
  } else {
    d.retangulo('CONCRETO', Q(0, 0), Q(bx, by));
    if (est) d.retangulo('ARMADURA-TRANSVERSAL', Q(cob, cob), Q(bx - cob, by - cob));
  }
  for (const g of posicoes.filter((q) => q.tipo === 'suplementar')) {
    const gr = g.grampo;
    const [a, b] = gr.eixo === 'y' ? [Q(gr.em, gr.de), Q(gr.em, gr.ate)] : [Q(gr.de, gr.em), Q(gr.ate, gr.em)];
    d.linha('ARMADURA-TRANSVERSAL', a, b);
    d.texto('TEXTOS', [(a[0] + b[0]) / 2 + 2, (a[1] + b[1]) / 2 + 2], g.N, { altura: t * 0.7 });
  }
  const arm = p.resultado?.armadura;
  for (const pt of arm?.pontos ?? []) d.circulo('ARMADURA-LONGITUDINAL', Q(pt.x, pt.y), Math.max(0.5, arm.phi / 20));
  d.texto('TEXTOS', Q(bx / 2, -t * 1.6), circular ? `SEÇÃO CIRCULAR D=${f(bx, 0)}` : `SEÇÃO ${f(bx, 0)}x${f(by, 0)}`, { altura: t * 0.8, alinhar: 'centro' });
  return { largura: sx + bx + 40, topo: (long?.z1 ?? p.comprimento) * 100 + 20, base: arr ? arr.z0 * 100 - 30 : -30 };
}

export function armacaoDePilares(projeto, { versao, escala = 25 } = {}) {
  const d = novoDxf(escala);
  const t = 2.5 * d.mm;
  const perdas = perdasDoProjeto(projeto);
  const pav = (e) => projeto.pavimentos?.find((p) => p.id === e.posicao?.pavimento);
  const pils = projeto.elementos.filter((e) => e.modulo === PILAR && e.resultado?.armadura?.phi)
    .sort((a, b) => (pav(a)?.cota ?? 0) - (pav(b)?.cota ?? 0) || comparar(a, b));
  const grupos = [];
  let x = 0, y = 0, linhaAlt = 0, col = 0;
  const POR_LINHA = 6;
  for (const p of pils) {
    const det = detalhamentoDe(p, p.resultado, projeto);
    if (!det?.posicoes?.length) continue;
    const posicoes = posicoesDe(p, p.resultado, projeto);
    grupos.push({ codigo: p.codigo, posicoes });
    const alt = (det.posicoes.find((q) => q.tipo === 'longitudinal')?.z1 ?? p.comprimento) * 100 + 200;
    linhaAlt = Math.max(linhaAlt, alt);
    d.texto('TEXTOS', [x, y + 30 + (p.comprimento * 100) + 40], `${p.codigo} (${p.forma === 'circular' ? `ø${f(p.bx, 0)}` : `${f(p.bx, 0)}x${f(p.by, 0)}`})${pav(p) ? ` — ${pav(p).nome}` : ''}`, { altura: t * 1.2 });
    const r = desenhoPilar(d, p, det, posicoes, [x, y]);
    x += Math.max(420, r.largura + 60);
    if (++col >= POR_LINHA) { col = 0; x = 0; y -= linhaAlt + 160; linhaAlt = 0; }
  }
  if (grupos.length) {
    const [, [xmax, ymax]] = d.extensao;
    tabelaDeAco(d, [xmax + 60, ymax], grupos, perdas, { titulo: 'TABELA DE AÇO — PILARES' });
    const [[x0], [, y1]] = d.extensao;
    d.texto('TEXTOS', [x0, y1 + 12 * d.mm], 'ARMAÇÃO DOS PILARES', { altura: t * 1.6 });
    carimbo(d, projeto, 'Armação dos pilares', escala, versao);
  }
  return { dxf: d, n: grupos.length };
}

/* ====================================================================== armação de lajes */

export function armacaoDeLajes(projeto, pav, { versao, escala = 50 } = {}) {
  const d = novoDxf(escala);
  const t = 2.5 * d.mm;
  const perdas = perdasDoProjeto(projeto);
  const lajes = elementosDoPavimento(projeto, pav).filter((e) => e.modulo === LAJE).sort(comparar);
  const grupos = [];
  for (const l of lajes) {
    const det = detalhamentoDe(l, l.resultado, projeto);
    d.polilinha('LAJES', cantosLaje(l).map(cm), { fechada: true });
    if (!det?.posicoes?.length) continue;
    const posicoes = posicoesDe(l, l.resultado, projeto);
    grupos.push({ codigo: l.codigo, posicoes });
    const { x = 0, y = 0, angulo = 0 } = l.posicao;
    const cs = Math.cos((angulo * Math.PI) / 180), sn = Math.sin((angulo * Math.PI) / 180);
    const T = (u, v) => cm([x + u * cs - v * sn, y + u * sn + v * cs]);
    const ang = legivel(angulo);
    const lx = l.lx, ly = l.ly;
    const rot = (q) => `${q.N} ${q.n} ${phiTxt(q.phi)} c/${f(q.s, q.s % 1 ? 1 : 0)} C=${f(q.comprimento, 0)}`;
    for (const q of posicoes.filter((p) => p.tipo === 'positiva')) {
      if (q.dir === 'x') {
        const yy = ly * 0.3;
        d.linha('ARMADURA-POSITIVA', T(q.a, yy), T(q.b, yy));
        d.linha('ARMADURA-DISTRIBUICAO', T(lx * 0.15, q.de), T(lx * 0.15, q.ate));
        d.texto('TEXTOS', T(lx * 0.5, yy + 0.04), rot(q), { altura: t, alinhar: 'centro', angulo: ang });
      } else {
        const xx = lx * 0.75;
        d.linha('ARMADURA-POSITIVA', T(xx, q.a), T(xx, q.b));
        d.linha('ARMADURA-DISTRIBUICAO', T(q.de, ly * 0.85), T(q.ate, ly * 0.85));
        d.texto('TEXTOS', T(xx - 0.04, ly * 0.5), rot(q), { altura: t, alinhar: 'centro', angulo: legivel(angulo + 90) });
      }
    }
    for (const q of posicoes.filter((p) => p.tipo === 'negativa')) {
      const m = (q.t0 + q.t1) / 2, a1 = q.a1 / 100, a2 = q.a2 / 100, dob = (q.dobra ?? 5) / 100;
      const seg = { x0: [[-a2, m], [a1, m]], x1: [[lx - a1, m], [lx + a2, m]], y0: [[m, -a2], [m, a1]], y1: [[m, ly - a1], [m, ly + a2]] }[q.borda];
      const perp = q.borda[0] === 'x' ? [0, dob] : [dob, 0];
      d.polilinha('ARMADURA-NEGATIVA', [T(seg[0][0] + perp[0], seg[0][1] + perp[1]), T(...seg[0]), T(...seg[1]), T(seg[1][0] + perp[0], seg[1][1] + perp[1])]);
      // faixa ao longo da borda (onde as barras se repetem)
      const off = { x0: [a1 * 0.5, null], x1: [lx - a1 * 0.5, null], y0: [null, a1 * 0.5], y1: [null, ly - a1 * 0.5] }[q.borda];
      const [p0, p1] = off[0] != null ? [[off[0], q.t0], [off[0], q.t1]] : [[q.t0, off[1]], [q.t1, off[1]]];
      d.linha('ARMADURA-DISTRIBUICAO', T(...p0), T(...p1));
      const angTxt = q.borda[0] === 'x' ? ang : legivel(angulo + 90);
      d.texto('TEXTOS', T((seg[0][0] + seg[1][0]) / 2 + (q.borda[0] === 'y' ? 0.05 : 0), (seg[0][1] + seg[1][1]) / 2 + (q.borda[0] === 'x' ? 0.05 : 0)), rot(q), { altura: t * 0.9, alinhar: 'centro', angulo: angTxt });
    }
    const c = cantosLaje(l).map(cm);
    d.texto('TEXTOS', [(c[0][0] + c[2][0]) / 2, (c[0][1] + c[2][1]) / 2], `${l.codigo} h=${f(l.h, 0)}`, { altura: t * 1.3, alinhar: 'centro', vertical: 'meio' });
  }
  if (grupos.length) {
    const [, [xmax, ymax]] = d.extensao;
    tabelaDeAco(d, [xmax + 20 * d.mm, ymax], grupos, perdas, { titulo: `TABELA DE AÇO — LAJES (${pav.nome})` });
    const [[x0], [, y1]] = d.extensao;
    d.texto('TEXTOS', [x0, y1 + 12 * d.mm], `ARMAÇÃO DAS LAJES — ${String(pav.nome).toUpperCase()}`, { altura: t * 1.6 });
    d.texto('TEXTOS', [x0, y1 + 6 * d.mm], 'Positivas em vermelho, negativas em azul (com as dobras); a linha fina mostra a faixa em que cada barra se repete.', { altura: t * 0.8 });
    carimbo(d, projeto, `Armação das lajes — ${pav.nome}`, escala, versao);
  }
  return { dxf: d, n: grupos.length };
}

/* ====================================================================== conjunto */

const nomeArquivo = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\\/:*?"<>|º°ª]+/g, '').replace(/\s+/g, ' ').trim();

/**
 * Gera as pranchas pedidas: [{ nome, conteudo (texto DXF), camadas, entidades }].
 * @param {object} op { formas, locacao, vigas, pilares, lajes } (true/false) e versao
 */
export function gerarPranchas(projeto, op = {}) {
  const { formas = true, locacao = true, vigas = true, pilares = true, lajes = true, versao = '' } = op;
  const base = nomeArquivo(projeto.meta?.nome ?? 'Projeto');
  const out = [];
  const add = (titulo, d) => { if (d?.entidades) out.push({ nome: `${base} - ${nomeArquivo(titulo)}.dxf`, titulo, conteudo: d.toString(), camadas: d.camadasUsadas, entidades: d.entidades }); };
  const pavs = [...(projeto.pavimentos ?? [])].sort((a, b) => b.cota - a.cota);
  if (formas) for (const p of pavs) if (elementosDoPavimento(projeto, p).length) add(`Formas ${p.nome}`, plantaDeFormas(projeto, p, { versao }));
  if (locacao && pilaresNaFundacao(projeto).length) add('Locacao dos pilares', plantaDeLocacao(projeto, { versao }));
  if (vigas) { const r = armacaoDeVigas(projeto, { versao }); if (r.n) add('Armacao das vigas', r.dxf); }
  if (pilares) { const r = armacaoDePilares(projeto, { versao }); if (r.n) add('Armacao dos pilares', r.dxf); }
  if (lajes) for (const p of pavs) { const r = armacaoDeLajes(projeto, p, { versao }); if (r.n) add(`Armacao das lajes ${p.nome}`, r.dxf); }
  return out;
}
