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
 * Montagem da estrutura — pavimentos, planta de cada nível e ligações entre elementos.
 *
 *   ┌ lateral ─────────────┬ planta do pavimento ─────────────────────────────┐
 *   │ Pavimentos           │ barra: pavimento · Adicionar · Conectar · 3D     │
 *   │ Elemento selecionado │ SVG com grade, lajes, vigas e pilares (arrastar) │
 *   │ Não posicionados     │ ligações do pavimento e avisos                   │
 *   └──────────────────────┴──────────────────────────────────────────────────┘
 *
 * A geometria e a detecção das ligações ficam em core/montagem.js.
 */
import { h, s, limpar } from '../ui/dom.js';
import * as ui from '../ui/componentes.js';
import { icone } from '../ui/icones.js';
import { abrirMenu } from '../ui/menus.js';
import { confirmar, notificar } from '../ui/dialogos.js';
import { estado } from '../core/estado.js';
import { comandos } from '../core/comandos.js';
import { modulos } from '../core/modulos.js';
import { num } from '../core/formatar.js';
import { novoId, proximoCodigo } from '../core/projeto.js';
import {
  pavimentosOrdenados, pavimento, novoIdPavimento, peDireito, tipoDe, cantosLaje, bordasLaje, eixoViga,
  cantosPilar, centroPilar, secaoViga, pontosDeEncaixe, detectarLigacoes, aplicarLigacoes,
  ligacoesExistentes, avisosMontagem, dimensoesLaje, escadaNaPlanta,
} from '../core/montagem.js';
import { grelhaDoPavimento, modoDoPavimento } from '../../modules/comum/grelha.js';

/** Estado da vista (sobrevive aos redesenhos da aba). */
const vista = { projeto: null, pav: null, cx: 4, cy: 2.5, esc: 60, sel: null, enquadrar: true, conhecidos: null, novos: new Set(), ordem: 'alfabetica' };

const GRADE = 0.05;               // m — passo do arrasto
const IMA_PX = 12;                // distância de encaixe magnético na tela
const arred = (v, p = GRADE) => Math.round(v / p) * p;

/** Comparação natural em português: V2 antes de V10, sem diferenciar maiúsculas e acentos. */
const natural = (a, b) => String(a).localeCompare(String(b), 'pt-BR', { numeric: true, sensitivity: 'base' });
const ORDEM_TIPO = { laje: 0, viga: 1, pilar: 2 };

/**
 * Ordena elementos conforme a escolha da lateral: 'alfabetica' (pelo código),
 * 'tipo' (lajes, vigas, pilares e, dentro de cada tipo, pelo código) ou 'criacao'.
 */
function ordenarElementos(lista, tipo) {
  if (vista.ordem === 'criacao') return lista;
  return [...lista].sort((a, b) => (vista.ordem === 'tipo' ? (ORDEM_TIPO[tipo(a)] ?? 9) - (ORDEM_TIPO[tipo(b)] ?? 9) : 0) || natural(a.codigo, b.codigo));
}
const fmt = (v) => num(v, 2);

/** Seleciona um elemento (e o seu pavimento) na próxima vez que a montagem for desenhada. */
export function selecionarNaMontagem(id) {
  const el = estado.elemento(id);
  if (!el) return;
  vista.sel = id;
  if (el.posicao?.pavimento) { vista.pav = el.posicao.pavimento; vista.enquadrar = true; }
}

export function abaMontagem(acoes) {
  return {
    id: 'montagem',
    icone: 'planta',
    titulo: () => 'Montagem da estrutura',
    render: (container) => renderizar(container, acoes),
  };
}

function renderizar(container, acoes) {
  const p = estado.projeto;
  if (!p) return;
  const chave = p.meta?.criadoEm ?? p.meta?.nome;
  if (vista.projeto !== chave) Object.assign(vista, { projeto: chave, pav: null, sel: null, enquadrar: true, conhecidos: null, novos: new Set() });
  const pavs = pavimentosOrdenados(p);
  if (!pavs.some((x) => x.id === vista.pav)) vista.pav = pavs[pavs.length - 1]?.id ?? null;
  if (vista.sel && !estado.elemento(vista.sel)?.posicao) vista.sel = null;

  const tipo = (el) => tipoDe(el, modulos);
  const doPav = p.elementos.filter((e) => e.posicao?.pavimento === vista.pav && tipo(e));
  const pavAcima = (() => { const i = pavs.findIndex((x) => x.id === vista.pav); return pavs[i + 1] ?? null; })();
  const pilaresAcima = pavAcima ? p.elementos.filter((e) => e.posicao?.pavimento === pavAcima.id && tipo(e) === 'pilar') : [];
  const pavAbaixo = (() => { const i = pavs.findIndex((x) => x.id === vista.pav); return i > 0 ? pavs[i - 1] : null; })();
  const referencia = pavAbaixo ? p.elementos.filter((e) => e.posicao?.pavimento === pavAbaixo.id && tipo(e)) : [];
  const naoPosicionados = p.elementos.filter((e) => tipo(e) && (!e.posicao || !pavimento(p, e.posicao.pavimento)));
  // na primeira abertura, todos os não posicionados contam como já vistos
  if (!vista.conhecidos) vista.conhecidos = new Set(naoPosicionados.map((e) => e.id));

  const alterar = (fn, descricao, extra = {}) => estado.alterar(fn, { descricao, estrutural: true, invalidar: false, origem: 'montagem', ...extra });
  const elDoProjeto = (proj, id) => proj.elementos.find((e) => e.id === id);

  const estadoClasse = (el) => (!el.resultado ? 'sem' : el.resultado.desatualizado ? (el.resultado.ok === false ? 'desat falhou' : 'desat') : el.resultado.ok ? 'ok' : 'falha');

  /* ------------------------------------------------------------ planta (SVG) */
  const planta = h('div', { class: 'mont-planta' });
  const svg = s('svg', { class: 'mont-svg' });
  planta.append(svg);

  let W = 800, H = 500;
  const tela = ([x, y]) => [(x - vista.cx) * vista.esc + W / 2, H / 2 - (y - vista.cy) * vista.esc];
  const mundo = (px, py) => [(px - W / 2) / vista.esc + vista.cx, (H / 2 - py) / vista.esc + vista.cy];
  const pontos = (pts) => pts.map((pt) => tela(pt).join(',')).join(' ');

  function enquadrar() {
    const pts = (doPav.length ? doPav : referencia).flatMap((e) => pontosDeEncaixe(e, tipo(e)).concat(tipo(e) === 'laje' ? cantosLaje(e) : []));
    if (!pts.length) { Object.assign(vista, { cx: 4, cy: 2.5, esc: 60 }); return; }
    const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    vista.cx = (x0 + x1) / 2; vista.cy = (y0 + y1) / 2;
    vista.esc = Math.max(8, Math.min(220, Math.min((W - 140) / Math.max(x1 - x0, 1), (H - 120) / Math.max(y1 - y0, 1))));
  }

  /** Desenho de um elemento; `d` é o deslocamento provisório durante o arrasto. */
  function desenharElemento(el, { fantasma = false } = {}) {
    const t = tipo(el);
    const sel = el.id === vista.sel;
    const res = el.resultado;
    const classe = ['mont-el', `mont-${t}`, sel && 'sel', fantasma && 'fantasma', res && !res.desatualizado && (res.ok ? 'atende' : 'falha')].filter(Boolean).join(' ');
    const g = s('g', { class: classe, dataset: undefined });
    g.dataset.id = el.id;
    if (t === 'laje') {
      const c = cantosLaje(el);
      g.append(s('polygon', { points: pontos(c), class: 'mont-laje-area' }));
      const b = bordasLaje(el);
      for (const [id, seg] of Object.entries(b)) {
        const vinc = el.bordas?.[id] ?? (id.startsWith('y') && !el.lx ? 'apoiada' : 'apoiada');
        const [a, z] = seg.map(tela);
        g.append(s('line', { x1: a[0], y1: a[1], x2: z[0], y2: z[1], class: `mont-borda ${vinc}` }));
      }
      // direção das nervuras/vigotas nas lajes em uma direção
      const umaDir = el.L != null || el.direcao === 'x';
      const emY = el.L != null && el.direcao === 'y'; // vigotas no sentido y da laje
      const ctr = [(c[0][0] + c[2][0]) / 2, (c[0][1] + c[2][1]) / 2];
      if (umaDir) {
        const m1 = emY ? [(c[0][0] + c[1][0]) / 2, (c[0][1] + c[1][1]) / 2] : [(c[0][0] + c[3][0]) / 2, (c[0][1] + c[3][1]) / 2];
        const m2 = emY ? [(c[3][0] + c[2][0]) / 2, (c[3][1] + c[2][1]) / 2] : [(c[1][0] + c[2][0]) / 2, (c[1][1] + c[2][1]) / 2];
        const [a, z] = [tela(m1), tela(m2)];
        g.append(s('line', { x1: a[0] + (z[0] - a[0]) * 0.18, y1: a[1] + (z[1] - a[1]) * 0.18, x2: z[0] - (z[0] - a[0]) * 0.18, y2: z[1] - (z[1] - a[1]) * 0.18, class: 'mont-direcao' }));
      }
      const [tx, ty] = tela(ctr);
      const { lx, ly } = dimensoesLaje(el);
      g.append(s('text', { x: tx, y: ty - 2, class: 'mont-cod', 'text-anchor': 'middle' }, el.codigo),
        s('text', { x: tx, y: ty + 13, class: 'mont-dim', 'text-anchor': 'middle' }, `${fmt(lx)} × ${fmt(ly)}`));
    } else if (t === 'viga') {
      const e = eixoViga(el);
      const [a, z] = [tela(e.a), tela(e.b)];
      const larg = Math.max(4, (secaoViga(el).b / 100) * vista.esc);
      g.append(s('line', { x1: a[0], y1: a[1], x2: z[0], y2: z[1], class: 'mont-viga-alvo' }));
      g.append(s('line', { x1: a[0], y1: a[1], x2: z[0], y2: z[1], class: `mont-viga-eixo${el.invertida ? ' invertida' : ''}`, 'stroke-width': larg }));
      e.apoios.forEach((pt, k) => {
        const [x, y] = tela(pt);
        const tipoA = el.apoios?.[k];
        if (tipoA === 'livre') return;
        g.append(s('circle', { cx: x, cy: y, r: 3.2, class: `mont-apoio ${tipoA}` }));
      });
      const meio = tela([(e.a[0] + e.b[0]) / 2, (e.a[1] + e.b[1]) / 2]);
      const n = [-e.u[1], -e.u[0]];
      g.append(s('text', { x: meio[0] + n[0] * 14, y: meio[1] + n[1] * 14 + 4, class: 'mont-cod', 'text-anchor': 'middle' }, el.codigo));
    } else if (t === 'reservatorio') {
      // eixos das paredes e a face interna (água)
      const c = cantosLaje(el);
      const e = (Number(el.e) || 15) / 100;
      const { x = 0, y = 0, angulo = 0 } = el.posicao ?? {};
      const cs = Math.cos((angulo * Math.PI) / 180), sn = Math.sin((angulo * Math.PI) / 180);
      const T = ([u, v]) => [x + u * cs - v * sn, y + u * sn + v * cs];
      const Lx = (Number(el.a) || 2) + e, Ly = (Number(el.b) || 3) + e;
      const interno = [[e / 2, e / 2], [Lx - e / 2, e / 2], [Lx - e / 2, Ly - e / 2], [e / 2, Ly - e / 2]].map(T);
      const externo = [[-e / 2, -e / 2], [Lx + e / 2, -e / 2], [Lx + e / 2, Ly + e / 2], [-e / 2, Ly + e / 2]].map(T);
      g.append(s('polygon', { points: pontos(externo), class: 'mont-res-parede' }), s('polygon', { points: pontos(interno), class: 'mont-res-agua' }));
      const [tx, ty] = tela([(c[0][0] + c[2][0]) / 2, (c[0][1] + c[2][1]) / 2]);
      const r = el.resultado && !el.resultado.erro ? el.resultado : null;
      g.append(s('text', { x: tx, y: ty - 2, class: 'mont-cod', 'text-anchor': 'middle' }, el.codigo),
        s('text', { x: tx, y: ty + 13, class: 'mont-dim', 'text-anchor': 'middle' }, r ? `${fmt(r.volume)} m³` : 'reservatório'));
    } else if (t === 'escada') {
      const pl = escadaNaPlanta(el, estado.projeto);
      if (!pl) return g;
      g.append(s('polygon', { points: pontos(pl.contorno), class: 'mont-escada-caixa' }));
      for (const pt of pl.patamares) g.append(s('polygon', { points: pontos(pt.poligono), class: 'mont-escada-patamar' }));
      for (const l of pl.lances) {
        g.append(s('polygon', { points: pontos(l.poligono), class: 'mont-escada-lance' }));
        for (const [a, z] of l.degraus) { const [p, q] = [tela(a), tela(z)]; g.append(s('line', { x1: p[0], y1: p[1], x2: q[0], y2: q[1], class: 'mont-escada-degrau' })); }
        const [p, q] = l.seta.map(tela);
        g.append(s('line', { x1: p[0], y1: p[1], x2: q[0], y2: q[1], class: 'mont-escada-seta' }), s('circle', { cx: p[0], cy: p[1], r: 2.6, class: 'mont-escada-ini' }));
        const ang = Math.atan2(q[1] - p[1], q[0] - p[0]);
        g.append(s('path', { d: `M${q[0]} ${q[1]} l${-7 * Math.cos(ang - 0.45)} ${-7 * Math.sin(ang - 0.45)} M${q[0]} ${q[1]} l${-7 * Math.cos(ang + 0.45)} ${-7 * Math.sin(ang + 0.45)}`, class: 'mont-escada-seta' }));
      }
      const xs = pl.contorno.map((c) => c[0]), ys = pl.contorno.map((c) => c[1]);
      const [tx, ty] = tela([(Math.min(...xs) + Math.max(...xs)) / 2, Math.max(...ys)]);
      g.append(s('text', { x: tx, y: ty - 6, class: 'mont-cod', 'text-anchor': 'middle' }, `${el.codigo} · sobe`));
    } else if (t === 'pilar') {
      g.append(s('polygon', { points: pontos(cantosPilar(el)), class: 'mont-pilar-secao' }));
      const [x, y] = tela(centroPilar(el));
      g.append(s('text', { x: x + 10, y: y - 10, class: 'mont-cod' }, el.codigo));
    }
    return g;
  }

  /** Nós da grelha do pavimento e as forças entre vigas (viga apoiada em viga). */
  function desenharGrelha() {
    const gr = grelhaDoPavimento(estado.projeto, vista.pav, modulos);
    const camada = s('g', { class: 'mont-grelha' });
    if (gr.erro) return camada;
    for (const n of gr.nos) {
      const [x, y] = tela([n.x, n.y]);
      if (n.apoio === 'viga') camada.append(s('circle', { cx: x, cy: y, r: 6.5, class: 'mont-no viga' }));
      else camada.append(s('circle', { cx: x, cy: y, r: n.apoio ? 3.6 : 2.6, class: `mont-no ${n.apoio ?? 'livre'}` }));
    }
    // força de cada encontro: a viga que se apoia (força positiva sobre ela)
    const vistos = new Set();
    for (const v of gr.vigas) {
      for (const it of v.interacoes) {
        const Rk = it.Rg + it.Rq;
        if (Rk <= 0.005 || vistos.has(it.no)) continue;
        vistos.add(it.no);
        const n = gr.nos.find((q) => q.id === it.no);
        const [x, y] = tela([n.x, n.y]);
        camada.append(s('text', { x: x + 9, y: y - 9, class: 'mont-no-rot' }, `${v.codigo} → ${it.com.join(', ')}: ${num(Rk, 1)} kN`));
      }
    }
    return camada;
  }

  /** Sapatas sob os pilares deste pavimento (contorno tracejado, com as dimensões calculadas). */
  function desenharSapatas() {
    const camada = s('g', { class: 'mont-sapatas' });
    const proj = estado.projeto;
    for (const sp of proj.elementos.filter((e) => e.modulo === 'concreto.sapata' && e.pilarId)) {
      const pl = proj.elementos.find((e) => e.id === sp.pilarId);
      if (!pl?.posicao || pl.posicao.pavimento !== vista.pav) continue;
      const r = sp.resultado && !sp.resultado.erro ? sp.resultado : null;
      const A = (r?.A ?? sp.geometria?.A ?? 150) / 100, B = (r?.B ?? sp.geometria?.B ?? 150) / 100;
      const [cx, cy] = centroPilar(pl);
      const ang = ((pl.posicao.angulo ?? 0) * Math.PI) / 180;
      const canto = (u, v) => [cx + u * Math.cos(ang) - v * Math.sin(ang), cy + u * Math.sin(ang) + v * Math.cos(ang)];
      const pts = [canto(-A / 2, -B / 2), canto(A / 2, -B / 2), canto(A / 2, B / 2), canto(-A / 2, B / 2)];
      const g = s('g', { class: ['mont-sapata', r ? (r.ok ? 'atende' : 'falha') : 'sem'].join(' '), style: { cursor: 'pointer' } },
        s('polygon', { points: pontos(pts) }));
      const [tx, ty] = tela(canto(A / 2, -B / 2));
      g.append(s('text', { x: tx + 4, y: ty + 12 }, sp.codigo));
      g.addEventListener('dblclick', (ev) => { ev.stopPropagation(); acoes.abrirElemento?.(sp.id); });
      camada.append(g);
    }
    return camada;
  }

  /** Blocos sobre estacas sob os pilares deste pavimento: contorno do bloco e as estacas do arranjo calculado. */
  function desenharBlocos() {
    const camada = s('g', { class: 'mont-blocos' });
    const proj = estado.projeto;
    for (const b of proj.elementos.filter((e) => e.modulo === 'concreto.bloco' && e.pilarId)) {
      const pl = proj.elementos.find((e) => e.id === b.pilarId);
      if (!pl?.posicao || pl.posicao.pavimento !== vista.pav) continue;
      const r = b.resultado && !b.resultado.erro ? b.resultado : null;
      const A = (r?.A ?? b.geometria?.A ?? 160) / 100, B = (r?.B ?? b.geometria?.B ?? 70) / 100;
      const [cx, cy] = centroPilar(pl);
      const ang = ((pl.posicao.angulo ?? 0) * Math.PI) / 180;
      const canto = (u, v) => [cx + u * Math.cos(ang) - v * Math.sin(ang), cy + u * Math.sin(ang) + v * Math.cos(ang)];
      const pts = [canto(-A / 2, -B / 2), canto(A / 2, -B / 2), canto(A / 2, B / 2), canto(-A / 2, B / 2)];
      const g = s('g', { class: ['mont-bloco', r ? (r.ok ? 'atende' : 'falha') : 'sem'].join(' '), style: { cursor: 'pointer' } },
        s('polygon', { points: pontos(pts) }));
      const raio = Math.max(3, ((r?.estaca?.D ?? b.estaca?.D ?? 30) / 200) * vista.esc);
      for (const p of r?.pos ?? []) { const [x, y] = tela(canto(p.x / 100, p.y / 100)); g.append(s('circle', { cx: x, cy: y, r: raio })); }
      const [tx, ty] = tela(canto(A / 2, -B / 2));
      g.append(s('text', { x: tx + 4, y: ty + 12 }, r ? `${b.codigo} · ${r.n}E` : b.codigo));
      g.addEventListener('dblclick', (ev) => { ev.stopPropagation(); acoes.abrirElemento?.(b.id); });
      camada.append(g);
    }
    return camada;
  }

  /** Estacas isoladas: sob o pilar ligado (no pavimento dele) ou na locação informada (no pavimento mais baixo). */
  function desenharEstacas() {
    const camada = s('g', { class: 'mont-estacas' });
    const proj = estado.projeto;
    const maisBaixo = pavimentosOrdenados(proj)[0]?.id;
    for (const e of proj.elementos.filter((x) => x.modulo === 'geotecnia.estaca')) {
      const pl = e.pilarId ? proj.elementos.find((x) => x.id === e.pilarId) : null;
      const pav = pl?.posicao?.pavimento ?? maisBaixo;
      if (pav !== vista.pav) continue;
      const c = pl?.posicao ? centroPilar(pl) : [e.local?.x ?? 0, e.local?.y ?? 0];
      const [x, y] = tela(c);
      const r = Math.max(4, ((e.D ?? 40) / 200) * vista.esc);
      const res = e.resultado && !e.resultado.erro ? e.resultado : null;
      const g = s('g', { class: ['mont-estaca', res ? (res.ok ? 'atende' : 'falha') : 'sem'].join(' '), style: { cursor: 'pointer' } },
        s('circle', { cx: x, cy: y, r: r + (pl ? 6 : 0) }), s('text', { x: x + r + 9, y: y - r - 2 }, e.codigo));
      g.addEventListener('dblclick', (ev) => { ev.stopPropagation(); acoes.abrirElemento?.(e.id); });
      camada.append(g);
    }
    return camada;
  }

  /** Furos de sondagem (locação na planta), para referência das fundações. */
  function desenharFuros() {
    const camada = s('g', { class: 'mont-furos' });
    for (const f of estado.projeto.elementos.filter((e) => e.modulo === 'geotecnia.sondagem' && e.local)) {
      const [x, y] = tela([f.local.x, f.local.y]);
      const g = s('g', { class: 'mont-furo', style: { cursor: 'pointer' } },
        s('circle', { cx: x, cy: y, r: 7 }), s('path', { d: `M${x - 4.5} ${y}h9M${x} ${y - 4.5}v9` }),
        s('text', { x: x + 10, y: y + 4 }, f.codigo));
      g.addEventListener('dblclick', (ev) => { ev.stopPropagation(); acoes.abrirElemento?.(f.id); });
      camada.append(g);
    }
    return camada;
  }

  let camadaEls, marcaIma;
  function desenharPlanta() {
    const r = planta.getBoundingClientRect();
    W = Math.max(300, r.width); H = Math.max(240, r.height);
    if (vista.enquadrar) { enquadrar(); vista.enquadrar = false; }
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    limpar(svg);
    // grade de 1 m (e eixos)
    const [mx0, my1] = mundo(0, 0), [mx1, my0] = mundo(W, H);
    const passo = vista.esc < 14 ? 5 : 1;
    const grade = s('g', { class: 'mont-grade' });
    for (let x = Math.ceil(mx0 / passo) * passo; x <= mx1; x += passo) { const [px] = tela([x, 0]); grade.append(s('line', { x1: px, y1: 0, x2: px, y2: H, class: Math.abs(x) < 1e-9 ? 'eixo' : '' })); }
    for (let y = Math.ceil(my0 / passo) * passo; y <= my1; y += passo) { const [, py] = tela([0, y]); grade.append(s('line', { x1: 0, y1: py, x2: W, y2: py, class: Math.abs(y) < 1e-9 ? 'eixo' : '' })); }
    svg.append(grade);
    const ordem = { laje: 0, reservatorio: 0.4, escada: 0.5, viga: 1, pilar: 2 };
    // pavimento de baixo, esmaecido, como referência para alinhar
    if (referencia.length) {
      const ref = s('g', { class: 'mont-ref' });
      for (const el of [...referencia].sort((a, b) => ordem[tipo(a)] - ordem[tipo(b)])) ref.append(desenharElemento(el, { fantasma: true }));
      svg.append(ref);
    }
    camadaEls = s('g');
    for (const el of [...doPav].sort((a, b) => ordem[tipo(a)] - ordem[tipo(b)])) camadaEls.append(desenharElemento(el));
    for (const el of pilaresAcima) {
      const g = s('g', { class: 'mont-acima' }, s('polygon', { points: pontos(cantosPilar(el)) }));
      camadaEls.append(g);
    }
    svg.append(camadaEls);
    if (modoDoPavimento(estado.projeto, vista.pav) === 'grelha') svg.append(desenharGrelha());
    svg.append(desenharSapatas());
    svg.append(desenharBlocos());
    svg.append(desenharEstacas());
    svg.append(desenharFuros());
    marcaIma = s('circle', { r: 7, class: 'mont-ima', style: { display: 'none' } });
    svg.append(marcaIma);
    // escala
    const metros = vista.esc > 60 ? 1 : vista.esc > 14 ? 5 : 10;
    svg.append(s('g', { class: 'mont-escala' },
      s('line', { x1: 16, y1: H - 18, x2: 16 + metros * vista.esc, y2: H - 18 }),
      s('text', { x: 16, y: H - 24 }, `${metros} m`)));
  }

  /* ------------------------------------------------------------ interação na planta */
  let arrasto = null;
  svg.addEventListener('wheel', (e) => {
    e.preventDefault();
    const r = svg.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * W, py = ((e.clientY - r.top) / r.height) * H;
    const [wx, wy] = mundo(px, py);
    const f = Math.exp(-e.deltaY * 0.0015);
    vista.esc = Math.max(6, Math.min(400, vista.esc * f));
    vista.cx = wx - (px - W / 2) / vista.esc; vista.cy = wy - (H / 2 - py) / vista.esc;
    desenharPlanta();
  }, { passive: false });

  svg.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    const alvo = e.target.closest?.('.mont-el:not(.fantasma)');
    const r = svg.getBoundingClientRect();
    const escala = W / r.width;
    svg.setPointerCapture(e.pointerId);
    if (alvo) {
      const el = estado.elemento(alvo.dataset.id);
      if (vista.sel !== el.id) { vista.sel = el.id; desenharPlanta(); desenharLateral(); }
      const g = camadaEls.querySelector(`[data-id="${el.id}"]`);
      const t = tipo(el);
      const meus = pontosDeEncaixe(el, t);
      const alvos = doPav.filter((x) => x.id !== el.id).concat(referencia).flatMap((x) => pontosDeEncaixe(x, tipo(x)))
        .concat(t === 'pilar' ? pilaresAcima.map(centroPilar) : []);
      arrasto = { tipo: 'el', el, g, x0: e.clientX, y0: e.clientY, escala, meus, alvos, dx: 0, dy: 0, moveu: false };
    } else {
      arrasto = { tipo: 'pan', x0: e.clientX, y0: e.clientY, cx: vista.cx, cy: vista.cy, escala, moveu: false };
    }
  });
  svg.addEventListener('pointermove', (e) => {
    if (!arrasto) return;
    const dpx = (e.clientX - arrasto.x0) * arrasto.escala, dpy = (e.clientY - arrasto.y0) * arrasto.escala;
    if (Math.hypot(dpx, dpy) > 3) arrasto.moveu = true;
    if (!arrasto.moveu) return;
    if (arrasto.tipo === 'pan') {
      vista.cx = arrasto.cx - dpx / vista.esc; vista.cy = arrasto.cy + dpy / vista.esc;
      desenharPlanta();
      return;
    }
    let dx = arred(dpx / vista.esc), dy = arred(-dpy / vista.esc);
    // encaixe magnético: o ponto do elemento mais próximo de um ponto de outro elemento
    let melhor = null;
    const lim = IMA_PX / vista.esc;
    for (const m of arrasto.meus) for (const a of arrasto.alvos) {
      const ddx = a[0] - (m[0] + dpx / vista.esc), ddy = a[1] - (m[1] - dpy / vista.esc);
      const d = Math.hypot(ddx, ddy);
      if (d < lim && (!melhor || d < melhor.d)) melhor = { d, dx: a[0] - m[0], dy: a[1] - m[1], a };
    }
    if (melhor) { dx = melhor.dx; dy = melhor.dy; const [x, y] = tela(melhor.a); Object.assign(marcaIma.style, { display: '' }); marcaIma.setAttribute('cx', x); marcaIma.setAttribute('cy', y); }
    else marcaIma.style.display = 'none';
    arrasto.dx = dx; arrasto.dy = dy;
    arrasto.g.setAttribute('transform', `translate(${dx * vista.esc} ${-dy * vista.esc})`);
  });
  const soltar = () => {
    if (!arrasto) return;
    const a = arrasto;
    arrasto = null;
    if (a.tipo === 'pan') { if (!a.moveu && vista.sel) { vista.sel = null; desenharPlanta(); desenharLateral(); } return; }
    if (!a.moveu || (Math.abs(a.dx) < 1e-9 && Math.abs(a.dy) < 1e-9)) { a.g?.removeAttribute('transform'); marcaIma.style.display = 'none'; return; }
    alterar((proj) => {
      const el = elDoProjeto(proj, a.el.id);
      el.posicao.x = Math.round((el.posicao.x + a.dx) * 1000) / 1000;
      el.posicao.y = Math.round((el.posicao.y + a.dy) * 1000) / 1000;
    }, `Mover ${a.el.codigo}`);
  };
  svg.addEventListener('pointerup', soltar);
  svg.addEventListener('pointercancel', soltar);
  svg.addEventListener('dblclick', (e) => {
    const alvo = e.target.closest?.('.mont-el:not(.fantasma)');
    if (alvo) acoes.abrirElemento(alvo.dataset.id);
  });

  /* ------------------------------------------------------------ ações */
  function posicionar(el, pav = vista.pav) {
    const t = tipo(el);
    vista.sel = el.id;
    vista.novos.delete(el.id);
    alterar((proj) => {
      const e = elDoProjeto(proj, el.id);
      e.posicao = { pavimento: pav, x: arred(vista.cx, 0.5), y: arred(vista.cy, 0.5), angulo: 0 };
      const pd = peDireito(proj, pav);
      if (t === 'pilar' && pd > 0 && e.comprimento != null) e.comprimento = pd;
    }, `Posicionar ${el.codigo}`, { invalidar: tipo(el) === 'pilar', elementoId: el.id });
  }

  function adicionar(ancora) {
    const grupos = modulos.categorias().map((c) => ({ c, mods: modulos.daCategoria(c.id).filter((m) => m.montagem !== false) })).filter((g) => g.mods.length);
    abrirMenu(grupos.flatMap((g, i) => [
      ...(i ? ['-'] : []), { cabecalho: g.c.nome },
      ...g.mods.map((m) => ({ rotulo: m.nome, icone: m.icone, acao: () => {
        const el = estado.criarElemento(m);
        posicionar(el);
      } })),
    ]), { ancora });
  }

  function conectar() {
    const det = detectarLigacoes(estado.projeto, modulos);
    let n = 0;
    alterar((proj) => { n = aplicarLigacoes(proj, det); }, 'Conectar elementos', { invalidar: false });
    notificar(n ? `${n} ligação(ões) criada(s) a partir da planta.` : 'Nenhuma ligação nova: tudo o que coincide na planta já está conectado.', n ? 'ok' : 'info');
    acoes.registrarSaida?.(`Montagem: ${n} ligação(ões) criada(s) pela geometria.`);
  }

  /* ------------------------------------------------------------ lateral */
  const lateral = h('aside', { class: 'mont-lateral' });
  function desenharLateral() {
    limpar(lateral);
    const proj = estado.projeto;
    // pavimentos (de cima para baixo, como num corte)
    const lista = h('div', { class: 'mont-pavs' });
    for (const pv of [...pavimentosOrdenados(proj)].reverse()) {
      const n = proj.elementos.filter((e) => e.posicao?.pavimento === pv.id).length;
      lista.append(h('div', { class: ['mont-pav', pv.id === vista.pav && 'ativo'], onClick: (e) => { if (e.target.closest('input, button')) return; vista.pav = pv.id; vista.enquadrar = true; vista.sel = null; renderizarTudo(); } },
        h('div', { class: 'mont-pav-cab' },
          h('input', { class: 'mont-pav-nome', value: pv.nome, spellcheck: false, onChange: (e) => { const v = e.target.value.trim(); if (v) alterar((pp) => { pavimento(pp, pv.id).nome = v; }, 'Renomear pavimento'); } }),
          h('span', { class: 'mont-pav-n', title: 'Elementos posicionados' }, String(n)),
          ui.botaoIcone({ icone: 'copiar', titulo: 'Duplicar pavimento acima (copia todos os elementos)', aoClicar: () => duplicarPavimento(pv) }),
          ui.botaoIcone({ icone: 'lixeira', titulo: 'Excluir pavimento', aoClicar: () => excluirPavimento(pv) }),
        ),
        h('div', { class: 'mont-pav-dados' },
          ui.campo({ rotulo: 'Cota', valor: pv.cota, unidade: 'm', largura: '110px', min: -50, max: 500, aoMudar: (v) => alterar((pp) => { pavimento(pp, pv.id).cota = v; }, 'Cota do pavimento') }),
          h('span', { class: 'mont-pav-pd' }, `pé-direito ${fmt(peDireito(proj, pv.id))} m`),
        ),
        h('div', { class: 'mont-pav-analise' }, ui.segmentado({
          rotulo: 'Vigas', valor: modoDoPavimento(proj, pv.id), compacto: true,
          opcoes: [
            { valor: 'isolada', texto: 'Isoladas', dica: 'Cada viga como viga contínua sobre apoios rígidos' },
            { valor: 'grelha', texto: 'Grelha', dica: 'Vigas do pavimento juntas (NBR 6118, 14.7.6): viga apoiada em viga e engastamento elástico nos pilares' },
          ],
          aoMudar: (v) => alterar((pp) => {
            pavimento(pp, pv.id).analise = v;
            for (const e of pp.elementos) if (e.posicao?.pavimento === pv.id && e.modulo === 'concreto.viga' && e.resultado) e.resultado.desatualizado = true;
          }, `Análise das vigas: ${v}`),
        })),
      ));
    }
    lateral.append(
      h('div', { class: 'mont-bloco' },
        h('div', { class: 'mont-bloco-cab' }, h('span', null, 'Pavimentos'), ui.botao({ texto: 'Pavimento', icone: 'mais', tipo: 'fantasma', aoClicar: novoPavimento })),
        lista),
    );

    // ordem das listas
    lateral.append(h('div', { class: 'mont-bloco mont-ordem' },
      ui.segmentado({ rotulo: 'Ordenar listas', valor: vista.ordem, compacto: true,
        opcoes: [{ valor: 'alfabetica', texto: 'A–Z', dica: 'Ordem alfabética pelo código (V2 antes de V10)' }, { valor: 'tipo', texto: 'Tipo', dica: 'Lajes, vigas e pilares; dentro de cada tipo, A–Z' }, { valor: 'criacao', texto: 'Criação', dica: 'Na ordem em que foram criados' }],
        aoMudar: (v) => { vista.ordem = v; desenharLateral(); desenharRodape(); } })));

    // elementos deste pavimento
    const nestePav = ordenarElementos(proj.elementos.filter((e) => e.posicao?.pavimento === vista.pav && tipo(e)), tipo);
    lateral.append(h('div', { class: 'mont-bloco' },
      h('div', { class: 'mont-bloco-cab' }, h('span', null, `Neste pavimento · ${nestePav.length}`)),
      nestePav.length
        ? h('div', { class: 'mont-soltos mont-lista' }, nestePav.map((el) => h('div', {
          class: ['mont-solto', 'clicavel', el.id === vista.sel && 'sel'], title: 'Selecionar na planta (duplo clique abre o elemento)',
          onClick: () => { vista.sel = el.id; desenharPlanta(); desenharLateral(); },
          onDblclick: () => acoes.abrirElemento(el.id),
        },
          icone(modulos.obter(el.modulo)?.forma ?? modulos.obter(el.modulo)?.icone ?? 'documento', { tamanho: 14 }),
          h('strong', null, el.codigo), h('span', null, el.nome !== el.codigo ? el.nome : modulos.obter(el.modulo)?.nomeCurto ?? ''),
          h('i', { class: ['mont-ponto', estadoClasse(el)] }))))
        : h('p', { class: 'mont-dica' }, 'Nenhum elemento neste pavimento ainda.'),
    ));

    // elemento selecionado
    const sel = vista.sel && estado.elemento(vista.sel);
    if (sel) {
      const t = tipo(sel);
      const m = modulos.obter(sel.modulo);
      lateral.append(h('div', { class: 'mont-bloco' },
        h('div', { class: 'mont-bloco-cab' }, h('span', null, 'Elemento selecionado')),
        h('div', { class: 'mont-sel-nome' }, icone(m?.forma ?? m?.icone ?? 'documento', { tamanho: 16 }), h('strong', null, sel.codigo), h('span', null, sel.nome !== sel.codigo ? sel.nome : m?.nomeCurto ?? '')),
        ui.selecao({ rotulo: 'Pavimento', valor: sel.posicao.pavimento, largura: '100%', opcoes: [...pavimentosOrdenados(proj)].reverse().map((pv) => ({ valor: pv.id, texto: `${pv.nome} (${fmt(pv.cota)} m)` })),
          aoMudar: (v) => alterar((pp) => { const e = elDoProjeto(pp, sel.id); e.posicao.pavimento = v; const pd = peDireito(pp, v); if (t === 'pilar' && pd > 0) e.comprimento = pd; }, `Mudar ${sel.codigo} de pavimento`, { invalidar: t === 'pilar', elementoId: sel.id }) }),
        h('div', { class: 'mont-sel-campos' },
          ui.campo({ rotulo: t === 'pilar' ? 'x (centro)' : 'x', valor: sel.posicao.x, unidade: 'm', min: -1000, max: 1000, aoMudar: (v) => alterar((pp) => { elDoProjeto(pp, sel.id).posicao.x = v; }, `Mover ${sel.codigo}`) }),
          ui.campo({ rotulo: t === 'pilar' ? 'y (centro)' : 'y', valor: sel.posicao.y, unidade: 'm', min: -1000, max: 1000, aoMudar: (v) => alterar((pp) => { elDoProjeto(pp, sel.id).posicao.y = v; }, `Mover ${sel.codigo}`) }),
          ui.campo({ rotulo: 'Ângulo', valor: sel.posicao.angulo ?? 0, unidade: '°', casas: 1, min: -360, max: 360, aoMudar: (v) => alterar((pp) => { elDoProjeto(pp, sel.id).posicao.angulo = v; }, `Girar ${sel.codigo}`) }),
        ),
        h('div', { class: 'mont-sel-acoes' },
          ui.botao({ texto: 'Girar 90°', icone: 'girar', tipo: 'secundario', aoClicar: () => alterar((pp) => { const e = elDoProjeto(pp, sel.id); e.posicao.angulo = ((e.posicao.angulo ?? 0) + 90) % 360; }, `Girar ${sel.codigo}`) }),
          ui.botao({ texto: 'Abrir', icone: 'direita', tipo: 'secundario', aoClicar: () => acoes.abrirElemento(sel.id) }),
          ui.botao({ texto: 'Código…', icone: 'editar', tipo: 'secundario', aoClicar: () => comandos.executar('elemento.renomear', sel.id) }),
          ui.botao({ texto: 'Retirar da planta', icone: 'fechar', tipo: 'fantasma', aoClicar: () => { alterar((pp) => { delete elDoProjeto(pp, sel.id).posicao; }, `Retirar ${sel.codigo} da planta`); vista.sel = null; } }),
        ),
        h('p', { class: 'mont-dica' }, t === 'laje' ? 'Laje: (x, y) é o canto inferior esquerdo; lx segue o ângulo.'
          : t === 'viga' ? 'Viga: (x, y) é o apoio 1; o eixo segue o ângulo com o comprimento total dos vãos.'
            : 'Pilar: chega à cota do pavimento vindo do nível de baixo; bx segue o ângulo.'),
      ));
    }

    // não posicionados
    const soltos = ordenarElementos(estado.projeto.elementos.filter((e) => tipo(e) && (!e.posicao || !pavimento(estado.projeto, e.posicao.pavimento))), tipo);
    lateral.append(h('div', { class: 'mont-bloco' },
      h('div', { class: 'mont-bloco-cab' }, h('span', null, `Não posicionados · ${soltos.length}`),
        ui.botaoIcone({ icone: 'atualizar', titulo: 'Procurar elementos novos para posicionar', aoClicar: procurarNovos })),
      soltos.length
        ? h('div', { class: 'mont-soltos' }, soltos.map((el) => h('div', { class: ['mont-solto', vista.novos.has(el.id) && 'novo'], title: vista.novos.has(el.id) ? 'Elemento novo' : '' },
          icone(modulos.obter(el.modulo)?.forma ?? modulos.obter(el.modulo)?.icone ?? 'documento', { tamanho: 14 }),
          h('strong', null, el.codigo), h('span', null, el.nome !== el.codigo ? el.nome : ''),
          h('button', { class: 'link', onClick: () => posicionar(el) }, 'Posicionar'))))
        : h('p', { class: 'mont-dica' }, 'Todos os elementos estão na planta.'),
    ));
  }

  /** Relê o projeto e destaca os elementos que ainda não estavam na lista de não posicionados. */
  function procurarNovos() {
    const proj = estado.projeto;
    const agora = proj.elementos.filter((e) => tipo(e) && (!e.posicao || !pavimento(proj, e.posicao.pavimento)));
    vista.novos = new Set(agora.filter((e) => !vista.conhecidos.has(e.id)).map((e) => e.id));
    for (const e of agora) vista.conhecidos.add(e.id);
    const n = vista.novos.size;
    notificar(n
      ? `${n} elemento(s) novo(s) para posicionar: ${agora.filter((e) => vista.novos.has(e.id)).map((e) => e.codigo).join(', ')}.`
      : agora.length ? `Nenhum elemento novo — ${agora.length} ainda aguardam posição.` : 'Nenhum elemento novo: todos estão na planta.', n ? 'ok' : 'info');
    renderizarTudo();
  }

  function novoPavimento() {
    const ord = pavimentosOrdenados(estado.projeto);
    const topo = ord[ord.length - 1];
    const id = novoIdPavimento();
    vista.pav = id; vista.sel = null; vista.enquadrar = true;
    alterar((pp) => { pp.pavimentos.push({ id, nome: `${ord.length + 1}º pavimento`, cota: Math.round(((topo?.cota ?? 0) + 2.8) * 100) / 100 }); }, 'Novo pavimento');
  }

  /** Copia um pavimento para um novo nível no topo, com novos códigos e as ligações internas refeitas. */
  function duplicarPavimento(pv) {
    const proj = estado.projeto;
    const ord = pavimentosOrdenados(proj);
    const topo = ord[ord.length - 1];
    const pd = peDireito(proj, pv.id) || 2.8;
    const novo = { id: novoIdPavimento(), nome: `${ord.length + 1}º pavimento`, cota: Math.round((topo.cota + pd) * 100) / 100 };
    const origem = proj.elementos.filter((e) => e.posicao?.pavimento === pv.id);
    if (!origem.length) return notificar('O pavimento não tem elementos para copiar.');
    let criados = 0;
    vista.pav = novo.id; vista.sel = null; vista.enquadrar = true;
    alterar((pp) => {
      pp.pavimentos.push(novo);
      const mapa = new Map();
      const copias = origem.map((o) => {
        const c = structuredClone(o);
        const prefixo = o.codigo.replace(/\d+$/, '');
        c.id = novoId(prefixo.toLowerCase() || 'el');
        c.codigo = proximoCodigo(pp, prefixo);
        c.nome = o.nome === o.codigo ? c.codigo : o.nome;
        c.posicao = { ...o.posicao, pavimento: novo.id };
        c.resultado = null;
        mapa.set(o.id, c.id);
        pp.elementos.push(c);
        return c;
      });
      for (const c of copias) {
        if (!Array.isArray(c.cargas)) continue;
        c.cargas = c.cargas.filter((cg) => cg.tipo !== 'elemento' || mapa.has(cg.elementoId)).map((cg) => (cg.tipo === 'elemento' ? { ...cg, elementoId: mapa.get(cg.elementoId) } : cg));
      }
      criados = copias.length;
    }, `Duplicar ${pv.nome}`);
    notificar(`${novo.nome} criado com ${criados} elementos. Use “Conectar automaticamente” para ligar os pilares ao nível de baixo.`, 'ok', { duracao: 6000 });
  }

  async function excluirPavimento(pv) {
    const proj = estado.projeto;
    if (proj.pavimentos.length <= 1) return notificar('O projeto precisa de pelo menos um pavimento.');
    const n = proj.elementos.filter((e) => e.posicao?.pavimento === pv.id).length;
    if (n && !(await confirmar({ titulo: `Excluir ${pv.nome}?`, texto: `${n} elemento(s) deste pavimento voltam para "Não posicionados". Os elementos e os cálculos não são apagados.`, confirmarTexto: 'Excluir pavimento', perigo: true }))) return;
    alterar((pp) => {
      pp.pavimentos = pp.pavimentos.filter((x) => x.id !== pv.id);
      for (const e of pp.elementos) if (e.posicao?.pavimento === pv.id) delete e.posicao;
    }, `Excluir ${pv.nome}`);
  }

  /* ------------------------------------------------------------ ligações e avisos */
  const rodape = h('div', { class: 'mont-rodape' });
  function desenharRodape() {
    limpar(rodape);
    const proj = estado.projeto;
    const det = detectarLigacoes(proj, modulos);
    const nesteNivel = (lig) => lig.receptor.posicao?.pavimento === vista.pav || lig.fonte.posicao?.pavimento === vista.pav;
    const existentes = ligacoesExistentes(proj, modulos, det).filter(nesteNivel);
    const exist = (d) => (Array.isArray(d.receptor.cargas) ? d.receptor.cargas : []).some((c) => c.tipo === 'elemento' && c.elementoId === d.fonte.id && c.ligacao === d.ligacao && (d.vao == null || c.vao === d.vao || c.vao === 'todos'));
    const sugeridas = det.filter((d) => nesteNivel(d) && !exist(d));
    const avisos = avisosMontagem(proj, modulos).filter((a) => a.elemento.posicao?.pavimento === vista.pav);
    if (modoDoPavimento(proj, vista.pav) === 'grelha') {
      const gr = grelhaDoPavimento(proj, vista.pav, modulos);
      if (gr.erro) avisos.push({ elemento: {}, texto: `Grelha: ${gr.erro}` });
      else avisos.push(...(gr.avisos ?? []).map((a) => ({ elemento: {}, texto: `Grelha: ${a}` })));
    }

    const ICONE = { ok: 'check', fora: 'alerta', 'sem-posicao': 'info' };
    const DICA = { ok: 'Coincide com a planta', fora: 'Os elementos não se tocam na planta', 'sem-posicao': 'Um dos elementos não está posicionado' };
    const porTexto = (lista) => (vista.ordem === 'criacao' ? lista : vista.ordem === 'tipo'
      ? [...lista].sort((a, b) => (ORDEM_TIPO[tipo(a.fonte)] ?? 9) - (ORDEM_TIPO[tipo(b.fonte)] ?? 9) || natural(a.texto, b.texto))
      : [...lista].sort((a, b) => natural(a.texto, b.texto)));
    sugeridas.splice(0, sugeridas.length, ...porTexto(sugeridas));
    existentes.splice(0, existentes.length, ...porTexto(existentes));
    const linhas = [
      ...sugeridas.map((d) => h('div', { class: 'mont-lig sugerida' }, icone('mais', { tamanho: 13 }), h('span', null, d.texto), h('em', null, 'sugerida pela planta'),
        h('button', { class: 'link', onClick: () => { alterar((pp) => aplicarLigacoes(pp, [d]), 'Conectar'); } }, 'Conectar'))),
      ...existentes.map((l) => h('div', { class: ['mont-lig', l.situacao], title: DICA[l.situacao] }, icone(ICONE[l.situacao], { tamanho: 13 }), h('span', null, l.texto),
        h('em', null, l.situacao === 'ok' ? '' : DICA[l.situacao]),
        ui.botaoIcone({ icone: 'fechar', titulo: 'Remover ligação', aoClicar: () => alterar((pp) => {
          const r = elDoProjeto(pp, l.receptor.id);
          r.cargas = r.cargas.filter((c) => c.id !== l.carga.id);
        }, 'Remover ligação', { invalidar: true, elementoId: l.receptor.id }) }))),
    ];
    rodape.append(
      h('div', { class: 'mont-rodape-cab' },
        h('span', null, `Ligações · ${existentes.length}`), sugeridas.length ? h('span', { class: 'mont-sug' }, `${sugeridas.length} sugerida(s)`) : null,
        h('span', { style: { flex: '1' } }),
        sugeridas.length ? ui.botao({ texto: 'Conectar sugeridas', icone: 'check', tipo: 'secundario', aoClicar: conectar }) : null),
      linhas.length ? h('div', { class: 'mont-ligs' }, linhas) : h('p', { class: 'mont-dica' }, 'Encoste as bordas das lajes nos eixos das vigas e os apoios das vigas nos pilares para que as ligações apareçam aqui.'),
      ...avisos.map((a) => h('div', { class: 'mont-aviso' }, icone('alerta', { tamanho: 13 }), h('span', null, a.texto),
        a.ajustarComprimento ? h('button', { class: 'link', onClick: () => alterar((pp) => { elDoProjeto(pp, a.elemento.id).comprimento = a.ajustarComprimento; }, `Ajustar ${a.elemento.codigo}`, { invalidar: true, elementoId: a.elemento.id }) }, `Usar ${fmt(a.ajustarComprimento)} m`) : null)),
    );
  }

  /* ------------------------------------------------------------ montagem da tela */
  const pavAtual = pavimento(p, vista.pav);
  const barra = h('div', { class: 'mont-barra' },
    h('div', { class: 'mont-titulo' }, h('span', { class: 'rot' }, 'Pavimento'), h('strong', null, pavAtual?.nome ?? '—'), h('span', null, `cota ${fmt(pavAtual?.cota ?? 0)} m`)),
    h('span', { style: { flex: '1' } }),
    ui.botao({ texto: 'Adicionar', icone: 'mais', tipo: 'secundario', aoClicar: (e) => adicionar(e.currentTarget) }),
    ui.botao({ texto: 'Conectar automaticamente', icone: 'check', tipo: 'secundario', aoClicar: conectar }),
    ui.botaoIcone({ icone: 'sapata', titulo: 'Criar sapatas nos pilares da fundação', aoClicar: () => comandos.executar('estrutura.sapatas') }),
    ui.botaoIcone({ icone: 'bloco', titulo: 'Criar blocos sobre estacas nos pilares da fundação', aoClicar: () => comandos.executar('estrutura.blocos') }),
    ui.botaoIcone({ icone: 'viga', titulo: 'Criar nível de baldrame (arranques e vigas baldrame)', aoClicar: () => comandos.executar('estrutura.baldrame') }),
    ui.botaoIcone({ icone: 'busca', titulo: 'Enquadrar o pavimento', aoClicar: () => { vista.enquadrar = true; desenharPlanta(); } }),
    ui.botao({ texto: 'Ver em 3D', icone: 'cubo', tipo: 'primario', aoClicar: () => acoes.abrir3D() }),
  );
  const centro = h('section', { class: 'mont-centro' }, barra, planta,
    h('div', { class: 'mont-legenda' },
      h('span', null, h('i', { class: 'lg-laje' }), 'Laje'), h('span', null, h('i', { class: 'lg-viga' }), 'Viga'), h('span', null, h('i', { class: 'lg-pilar' }), 'Pilar'),
      h('span', null, h('i', { class: 'lg-acima' }), 'Pilar do nível de cima'), h('span', null, h('i', { class: 'lg-livre' }), 'Borda livre'),
      modoDoPavimento(p, vista.pav) === 'grelha' ? h('span', null, h('i', { class: 'lg-no' }), 'Nó da grelha') : null,
      p.elementos.some((e) => e.invertida && e.posicao?.pavimento === vista.pav) ? h('span', null, h('i', { class: 'lg-invertida' }), 'Viga invertida') : null,
      p.elementos.some((e) => e.modulo === 'concreto.sapata') ? h('span', null, h('i', { class: 'lg-sapata' }), 'Sapata') : null,
      p.elementos.some((e) => e.modulo === 'concreto.bloco') ? h('span', null, h('i', { class: 'lg-bloco' }), 'Bloco sobre estacas') : null,
      p.elementos.some((e) => e.modulo === 'geotecnia.sondagem' && e.local) ? h('span', null, h('i', { class: 'lg-furo' }), 'Furo de sondagem') : null,
      modoDoPavimento(p, vista.pav) === 'grelha' ? h('span', null, h('i', { class: 'lg-no-viga' }), 'Viga apoiada em viga') : null,
      h('span', { class: 'mont-ajuda' }, 'Arraste para mover (encaixa nos apoios e cantos) · roda do mouse para aproximar · arraste o fundo para deslocar · duplo clique abre o elemento')),
    rodape);
  const raiz = h('div', { class: 'montagem' }, lateral, centro);
  container.append(raiz);
  container.classList.add('editor-cheio');

  function renderizarTudo() { acoes.redesenhar(); }

  desenharLateral();
  desenharRodape();
  const obs = new ResizeObserver(() => desenharPlanta());
  obs.observe(planta);
  requestAnimationFrame(desenharPlanta);

  return {
    destruir() { obs.disconnect(); container.classList.remove('editor-cheio'); },
    aoAlterar() { return false; },
  };
}
