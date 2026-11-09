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
import { confirmar, notificar, dialogo } from '../ui/dialogos.js';
import { estado } from '../core/estado.js';
import { comandos } from '../core/comandos.js';
import { modulos } from '../core/modulos.js';
import { num } from '../core/formatar.js';
import { novoId, proximoCodigo } from '../core/projeto.js';
import { problemasDoProjeto } from '../core/situacao-montagem.js';
import { corrigiveis } from '../core/consistencia.js';
import { vigasEmCadeia, criarVigasEmCadeia, pilarPerto, dadosAtuais, definirDadosAtuais, regioesDoPavimento, criarLajeNaRegiao, pontoNoPoligono, copiarPropriedades, aplicarPropriedades, aplicarDadosAtuais, tipoDeLancamento, aplicarCargaPadrao } from '../core/lancamento.js';
import { CARGAS_USO, cargaUso, rotuloUso } from '../../engine/cargas.js';
import { CLASSES_FCK } from '../core/criterios.js';
import { PONTOS_FIXOS, NOMES_PONTO_FIXO, prumada, aplicarLance } from '../core/pilares.js';
import { repeticoesDe, definirRepeticoes, cotaTopo, filtroDeCopia } from '../core/tipos.js';
import { sugestaoDe, aplicarSugestao } from '../core/predimensionamento.js';
import { segmentosDoFundo, paredesDeSegmentos, camadasProvaveis, planoDeParedes, aplicarParedes, MATERIAIS_PAREDE } from '../core/paredes.js';
import { cruzamentosDoPavimento, definirCruzamento, definirTodosCruzamentos, sugerirCruzamento, textoCruzamento, SEM_TRANSFERENCIA } from '../core/cruzamentos.js';
import {
  pavimentosOrdenados, pavimento, novoIdPavimento, peDireito, tipoDe, cantosLaje, bordasLaje, eixoViga,
  cantosPilar, contornoPilar, centroPilar, secaoViga, pontosDeEncaixe, detectarLigacoes, aplicarLigacoes,
  ligacoesExistentes, avisosMontagem, dimensoesLaje, escadaNaPlanta, limparGeometria, girarElemento, distanciaAoPilar, vigaSobApoio,
} from '../core/montagem.js';
import { grelhaDoPavimento, modoDoPavimento } from '../../modules/comum/grelha.js';
import { secaoDoVao, vaosInvertidos } from '../../engine/viga-secoes.js';
import {
  camadaFundo, pontosDoFundo, blocoFundo, passoMalha, plantaDoDxf, fundoInicial, plantaDe, transformacaoFundo,
} from './montagem-fundo.js';
import * as nucleoEixos from '../core/eixos.js';
import { copiaDoElemento, copiaDoEixo, colarElemento, colarEixo } from '../core/copiar-colar.js';
import { listaEixos, nosDosEixos, cruzamentosDosEixos, eixoPerto, projetarNoEixo, distanciaAoEixo, cotasDosEixos } from '../core/eixos.js';
import { camadaEixos, encaixarEmEixos, blocoEixos, cartaoEixo, eixosLevamElementos, distanciaDuplicar, eixosVisiveis, definirEixosVisiveis, passoDaSeta } from './montagem-eixos.js';

/** Estado da vista (sobrevive aos redesenhos da aba). */
/** Área de transferência da montagem (elemento ou eixo copiado) e quantas vezes já foi colada sem cursor. */
const areaTransf = { item: null, vezes: 0 };
const ponteiro = { dentro: false, p: null };

const vista = { projeto: null, pav: null, cx: 4, cy: 2.5, esc: 60, sel: null, selEixo: null, foco: null, marca: null, modo: null, subModo: null, pincel: null, lateralSobre: false, cadeia: [], cursor: null, enquadrar: true, conhecidos: null, novos: new Set(), ordem: 'alfabetica', moverFundo: false };

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

/* ------------------------------------------------------------ giro dos elementos */
const PREF_GIRO = 'lebr.montagem.passoGiro';
/** Passo do giro (°), lembrado entre as sessões; padrão 90°. */
export function passoGiro() {
  try { const v = Number(localStorage.getItem(PREF_GIRO)); return Number.isFinite(v) && v > 0 ? v : 90; } catch { return 90; }
}
function definirPassoGiro(v) { try { localStorage.setItem(PREF_GIRO, String(v)); } catch { /* sem armazenamento */ } }
const PREF_MOVER = 'lebr.montagem.passoMover';
/** Passo das setas de mover (m), lembrado entre as sessões; padrão 5 cm. */
function passoMover() { try { const v = Number(localStorage.getItem(PREF_MOVER)); return Number.isFinite(v) && v > 0 ? v : 0.05; } catch { return 0.05; } }
function definirPassoMover(v) { try { localStorage.setItem(PREF_MOVER, String(v)); } catch { /* sem armazenamento */ } }
const fmtGiro = (g) => `${String(Math.round(g * 10) / 10).replace('.', ',')}°`;

/* ------------------------------------------------------------ telas menores: o que fica aberto */
const PREF_UI = 'lebr.montagem.ui';
function prefsUi() { try { return JSON.parse(localStorage.getItem(PREF_UI) ?? '{}') ?? {}; } catch { return {}; } }
function definirPrefUi(k, v) { const p = prefsUi(); p[k] = v; try { localStorage.setItem(PREF_UI, JSON.stringify(p)); } catch { /* sem armazenamento */ } }
/** Painéis da montagem abertos: em telas baixas, legenda e lista de ligações começam recolhidas. */
const aberto = (k) => prefsUi()[k] ?? (k === 'cartaoMais' ? false : k === 'lateral' || k === 'caixa' || k === 'cartao' || k === 'ligacoes' ? true : window.innerHeight >= 860);

/** Outro projeto aberto: a vista começa do zero (sem seleção, enquadrando o pavimento). */
function reiniciarVistaSeOutroProjeto(p) {
  const chave = p?.meta?.criadoEm ?? p?.meta?.nome;
  if (vista.projeto !== chave) Object.assign(vista, { projeto: chave, pav: null, sel: null, selEixo: null, foco: null, marca: null, modo: null, subModo: null, pincel: null, cadeia: [], cursor: null, enquadrar: true, conhecidos: null, novos: new Set() });
}

/**
 * Seleciona um elemento (e o seu pavimento) na próxima vez que a montagem for desenhada.
 * @param {{ponto?: number[]}} [op]  com `ponto`, aproxima a planta nesse ponto e o marca (painel de problemas)
 */
export function selecionarNaMontagem(id, { ponto = null } = {}) {
  const el = estado.elemento(id);
  if (!el) return;
  reiniciarVistaSeOutroProjeto(estado.projeto);
  vista.sel = id;
  if (el.posicao?.pavimento) { vista.pav = el.posicao.pavimento; vista.enquadrar = true; }
  vista.foco = ponto && el.posicao?.pavimento ? ponto : null;
  vista.marca = vista.foco;
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
  reiniciarVistaSeOutroProjeto(p);
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
    // zoom num ponto (problema escolhido no painel): uns 4 m de planta em volta
    if (vista.foco) {
      [vista.cx, vista.cy] = vista.foco;
      vista.esc = Math.max(40, Math.min(220, Math.min(W, H) / 4));
      vista.foco = null;
      return;
    }
    const pts = (doPav.length ? doPav : referencia).flatMap((e) => pontosDeEncaixe(e, tipo(e)).concat(tipo(e) === 'laje' ? cantosLaje(e) : []));
    // sem elementos: enquadra a planta de fundo, se houver
    const pvAtual = pavimento(p, vista.pav), pl = plantaDe(p, pvAtual);
    if (!pts.length && pl) {
      const { aplicar } = transformacaoFundo(pvAtual, pl);
      const L = pl.limites;
      pts.push(aplicar(L.x0, L.y0), aplicar(L.x1, L.y0), aplicar(L.x1, L.y1), aplicar(L.x0, L.y1));
    }
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
      g.append(s('line', { x1: a[0], y1: a[1], x2: z[0], y2: z[1], class: 'mont-viga-alvo' }));
      // vão a vão: a largura e a situação (normal ou invertida) de cada um
      e.vaos.forEach(([s0, s1], k) => {
        const sv = secaoDoVao(el, k), u = e.u;
        const p0 = tela([e.a[0] + u[0] * s0, e.a[1] + u[1] * s0]), p1 = tela([e.a[0] + u[0] * s1, e.a[1] + u[1] * s1]);
        g.append(s('line', { x1: p0[0], y1: p0[1], x2: p1[0], y2: p1[1], class: `mont-viga-eixo${sv.invertida ? ' invertida' : ''}`, 'stroke-width': Math.max(4, (sv.b / 100) * vista.esc) }));
      });
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
      g.append(s('polygon', { points: pontos(contornoPilar(el)), class: 'mont-pilar-secao' }));
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

  /* ------------------------------------------------------------ lançamento gráfico: viga em cadeia (etapa L4) */
  let camadaModo = null;
  /** Ponto do clique com encaixe: centro de pilar, ponto de outro elemento, cruzamento de eixos, Shift ortogonal, malha. */
  function pontoDoLancamento([x, y], ortogonal) {
    const lim = IMA_PX / vista.esc;
    const pl = pilarPerto(estado.projeto, modulos, vista.pav, [x, y], Math.max(1.6 * lim, 0.2)) ?? doPav.find((e) => tipo(e) === 'pilar' && distanciaAoPilar([x, y], e).dentro);
    if (pl) return { p: centroPilar(pl), pilar: pl };
    const alvos = doPav.flatMap((e) => pontosDeEncaixe(e, tipo(e)).concat(tipo(e) === 'laje' ? cantosLaje(e) : [])).concat(comEixos() ? cruzamentosDosEixos(estado.projeto) : []);
    let melhor = null;
    for (const a of alvos) { const d = Math.hypot(a[0] - x, a[1] - y); if (d < lim && (!melhor || d < melhor.d)) melhor = { d, a }; }
    if (melhor) return { p: melhor.a };
    const ult = vista.cadeia[vista.cadeia.length - 1];
    if (ortogonal && ult) return Math.abs(x - ult[0]) >= Math.abs(y - ult[1]) ? { p: [arred(x), ult[1]] } : { p: [ult[0], arred(y)] };
    // perto de um eixo: o ponto encosta nele
    const ex = comEixos() && eixoPerto(estado.projeto, [x, y], lim);
    if (ex) { const q = projetarNoEixo([x, y], ex); return { p: [Math.round(q[0] * 1000) / 1000, Math.round(q[1] * 1000) / 1000] }; }
    const malha = passoMalha() || GRADE;
    return { p: [arred(x, malha), arred(y, malha)] };
  }

  function specsDaCadeia(comCursor = true) {
    const pts = comCursor && vista.cursor ? [...vista.cadeia, vista.cursor] : vista.cadeia;
    if (pts.length < 2) return [];
    const d = dadosAtuais(estado.projeto, 'viga');
    return vigasEmCadeia(estado.projeto, modulos, { pavimento: vista.pav, pontos: pts, secao: d.secao, alinhamento: d.alinhamento, deslocamento: (d.deslocamento ?? 0) / 100 });
  }

  function desenharPrevia() {
    if (!camadaModo) return;
    limpar(camadaModo);
    // fechamentos de bordo do pavimento (linhas tracejadas, sempre visíveis)
    for (const [k, f] of (pavimento(estado.projeto, vista.pav)?.fechamentos ?? []).entries()) {
      const [x1, y1] = tela(f.a), [x2, y2] = tela(f.b);
      camadaModo.append(s('line', { x1, y1, x2, y2, class: 'mont-fechamento', 'data-fechamento': k }, s('title', null, 'Fechamento de bordo (borda livre da laje) — no modo Laje, clique para apagar')));
    }
    if (vista.modo === 'laje') {
      for (const r of regioesDoPavimento(estado.projeto, modulos, vista.pav)) {
        if (r.ocupada) continue;
        const cls = r.retangulo ? 'livre' : 'naoret';
        camadaModo.append(s('polygon', { points: pontos(r.poligono), class: `mont-regiao ${cls}` },
          s('title', null, r.retangulo ? `Clique para lançar a laje (${num(r.retangulo.lx, 2)} × ${num(r.retangulo.ly, 2)} m)` : 'Região fechada, mas não retangular: a laje precisa de quatro lados em ângulo reto')));
        if (r.retangulo) { const [cx, cy] = tela(r.centro); camadaModo.append(s('text', { x: cx, y: cy + 4, 'text-anchor': 'middle', class: 'mont-regiao-rot' }, `${num(r.retangulo.lx, 2)} × ${num(r.retangulo.ly, 2)}`)); }
      }
      if (vista.subModo === 'fechamento') {
        const pts = vista.cursor ? [...vista.cadeia, vista.cursor] : vista.cadeia;
        if (pts.length > 1) camadaModo.append(s('polyline', { points: pontos(pts), class: 'mont-cadeia-linha' }));
        for (const p0 of vista.cadeia) { const [x, y] = tela(p0); camadaModo.append(s('circle', { cx: x, cy: y, r: 4, class: 'mont-cadeia-no' })); }
      }
      return;
    }
    if (vista.modo === 'eixo') {
      const a = vista.cadeia[0], b = vista.cursor;
      if (a && b && Math.hypot(b[0] - a[0], b[1] - a[1]) > 1e-6) {
        const L = Math.hypot(b[0] - a[0], b[1] - a[1]), u = [(b[0] - a[0]) / L, (b[1] - a[1]) / L], far = 2000 / vista.esc;
        const p0 = tela([a[0] - u[0] * far, a[1] - u[1] * far]), p1 = tela([a[0] + u[0] * far, a[1] + u[1] * far]);
        camadaModo.append(s('line', { x1: p0[0], y1: p0[1], x2: p1[0], y2: p1[1], class: 'mont-eixo previa' }));
        const ang = ((Math.atan2(u[1], u[0]) * 180) / Math.PI + 180) % 180;
        const m = tela(b);
        camadaModo.append(s('text', { x: m[0] + 10, y: m[1] - 10, class: 'mont-cadeia-rot' }, `${num(ang, 1)}°`));
      }
      for (const p0 of vista.cadeia) { const [x, y] = tela(p0); camadaModo.append(s('circle', { cx: x, cy: y, r: 4, class: 'mont-cadeia-no' })); }
      return;
    }
    if (vista.modo !== 'cadeia') return;
    const pts = vista.cursor ? [...vista.cadeia, vista.cursor] : vista.cadeia;
    if (pts.length > 1) camadaModo.append(s('polyline', { points: pontos(pts), class: 'mont-cadeia-linha' }));
    for (const sp of specsDaCadeia()) {
      const L = sp.vaos.reduce((t, v) => t + v.L, 0);
      const ang = (sp.posicao.angulo * Math.PI) / 180, u = [Math.cos(ang), Math.sin(ang)];
      const a = [sp.posicao.x, sp.posicao.y], b = [a[0] + u[0] * L, a[1] + u[1] * L];
      camadaModo.append(s('line', { x1: tela(a)[0], y1: tela(a)[1], x2: tela(b)[0], y2: tela(b)[1], class: 'mont-cadeia-viga' }));
      let s0 = 0;
      sp.apoios.forEach((t, k) => {
        const q = tela([a[0] + u[0] * s0, a[1] + u[1] * s0]);
        camadaModo.append(s('rect', { x: q[0] - 4, y: q[1] - 4, width: 8, height: 8, class: `mont-cadeia-apoio ${t}` }));
        s0 += sp.vaos[k]?.L ?? 0;
      });
      const m = tela([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
      camadaModo.append(s('text', { x: m[0] + 6, y: m[1] - 8, class: 'mont-cadeia-rot' }, sp.texto));
    }
    for (const p of vista.cadeia) { const [x, y] = tela(p); camadaModo.append(s('circle', { cx: x, cy: y, r: 4, class: 'mont-cadeia-no' })); }
  }

  /** Eixos à vista (ou o modo Desenhar eixo / Cota ligado): só então desenham e atraem os elementos. */
  function comEixos() { return eixosVisiveis() || vista.modo === 'eixo' || vista.modo === 'cota'; }
  /** Ocultar e reexibir os eixos, as cotas e os nós (Shift+E). */
  function alternarEixosVisiveis() {
    const v = !eixosVisiveis();
    definirEixosVisiveis(v);
    if (!v) vista.selEixo = null;
    renderizarTudo();
    notificar(v ? 'Eixos à vista.' : 'Eixos ocultos — não aparecem nem atraem os elementos. Shift+E mostra de novo.', 'info');
  }
  /** Mover todos os eixos de Δx e Δy. */
  async function moverTodosEixos() {
    let dx = 0, dy = 0;
    const r = await dialogo({
      rotulo: 'Eixos', titulo: 'Mover todos os eixos',
      texto: `Todos os eixos andam o mesmo deslocamento${eixosLevamElementos() ? '; os elementos sobre eles vão junto (desligue “Elementos acompanham os eixos” para mover só os eixos)' : '; os elementos ficam onde estão'}.`,
      corpo: () => [h('div', { class: 'mont-sel-campos' },
        ui.campo({ rotulo: 'Δx', valor: 0, unidade: 'm', casas: 3, min: -10000, max: 10000, aoMudar: (v) => { dx = v; } }),
        ui.campo({ rotulo: 'Δy', valor: 0, unidade: 'm', casas: 3, min: -10000, max: 10000, aoMudar: (v) => { dy = v; } }))],
      botoes: [{ texto: 'Cancelar', tipo: 'fantasma', valor: null }, { texto: 'Mover', tipo: 'primario', valor: () => 'ok', padrao: true }],
      largura: '420px',
    });
    if (r !== 'ok' || (!dx && !dy)) return;
    alterarEixos((pp, op, n) => {
      const novos = {};
      for (const e of n.listaEixos(pp)) novos[e.id] = Math.round((e.d + dx * e.n[0] + dy * e.n[1]) * 1e6) / 1e6;
      return n.moverEixos(pp, novos, op);
    }, `Mover todos os eixos (${num(dx, 2)}; ${num(dy, 2)}) m`);
  }
  /** Setas com um eixo selecionado: anda na perpendicular o passo de mover (Shift: 10 vezes). */
  function moverEixoSel(sx, sy, fator) {
    const ex = listaEixos(estado.projeto).find((x) => x.id === vista.selEixo);
    if (!ex) return false;
    const d = passoDaSeta(ex, sx, sy, passoMover() * fator);
    if (!d) return true;
    alterarEixos((pp, op, n) => n.moverEixo(pp, ex.id, Math.round((ex.d + d) * 1e6) / 1e6, op), `Mover o eixo ${ex.nome}`);
    return true;
  }

  function modoLancamento(modo) {
    vista.modo = vista.modo === modo ? null : modo;
    if ((vista.modo === 'eixo' || vista.modo === 'cota') && !eixosVisiveis()) { definirEixosVisiveis(true); notificar('Eixos à vista de novo.', 'info'); }
    vista.cadeia = []; vista.cursor = null; vista.subModo = null;
    renderizarTudo();
  }

  function concluirCadeia() {
    const specs = specsDaCadeia(false);
    if (!specs.length) { if (vista.cadeia.length) notificar('Clique pelo menos em dois pontos, com um pilar ou uma viga embaixo.', 'info'); return; }
    const mod = modulos.obter('concreto.viga');
    let res;
    const d = dadosAtuais(estado.projeto, 'viga');
    alterar((pp) => {
      res = criarVigasEmCadeia(pp, modulos, mod, specs, { ...d });
      if (d.proximoCodigo) definirDadosAtuais(pp, 'viga', { proximoCodigo: null });
    }, `Viga em cadeia (${specs.length} viga${specs.length > 1 ? 's' : ''})`, { invalidar: false });
    vista.cadeia = []; vista.cursor = null;
    notificar(`${res.vigas.map((v) => v.codigo).join(', ')} lançada(s) com ${d.secao.b} × ${d.secao.h} cm e ${res.ligacoes} ligação(ões).`, 'ok');
    acoes.registrarSaida?.(`Viga em cadeia: ${res.vigas.map((v, k) => `${v.codigo} — ${specs[k].texto}`).join('; ')}.`);
  }

  /** Clique no modo Laje: lança a laje da região clicada, ou marca os pontos do fechamento de bordo. */
  function cliqueDaLaje(pMundo, ortogonal, alvo) {
    if (vista.subModo === 'fechamento') {
      const { p } = pontoDoLancamento(pMundo, ortogonal);
      vista.cadeia.push(p);
      if (vista.cadeia.length === 2) {
        const [a, b] = vista.cadeia;
        vista.cadeia = [];
        if (Math.hypot(a[0] - b[0], a[1] - b[1]) > 0.05) alterar((pp) => { const pv = pavimento(pp, vista.pav); pv.fechamentos = [...(pv.fechamentos ?? []), { a, b }]; }, 'Fechamento de bordo', { invalidar: false });
        return;
      }
      desenharPrevia();
      return;
    }
    const fe = alvo?.closest?.('.mont-fechamento');
    if (fe) {
      const k = Number(fe.dataset.fechamento);
      alterar((pp) => { const pv = pavimento(pp, vista.pav); pv.fechamentos = pv.fechamentos.filter((_, i) => i !== k); if (!pv.fechamentos.length) delete pv.fechamentos; }, 'Apagar fechamento de bordo', { invalidar: false });
      return;
    }
    const r = regioesDoPavimento(estado.projeto, modulos, vista.pav).find((x) => !x.ocupada && pontoNoPoligono(pMundo, x.poligono));
    if (!r) return notificar('Clique dentro de uma região fechada por vigas (ou por fechamentos de bordo).', 'info');
    if (!r.retangulo) return notificar('A região não é retangular: a laje precisa de quatro lados em ângulo reto.', 'info');
    const d = dadosAtuais(estado.projeto, 'laje');
    const mod = modulos.obter(d.modulo) ?? modulos.obter('concreto.laje.macica');
    let res;
    alterar((pp) => {
      res = criarLajeNaRegiao(pp, modulos, mod, vista.pav, r, d);
      if (d.proximoCodigo) definirDadosAtuais(pp, 'laje', { proximoCodigo: null });
    }, 'Laje no contorno', { invalidar: false });
    notificar(`${res.laje.codigo} lançada (${num(r.retangulo.lx, 2)} × ${num(r.retangulo.ly, 2)} m) com ${res.ligacoes} ligação(ões).`, 'ok');
    acoes.registrarSaida?.(`Laje no contorno: ${res.laje.codigo}, ${num(r.retangulo.lx, 2)} × ${num(r.retangulo.ly, 2)} m, bordas ${Object.entries(r.retangulo.bordas).map(([k, v]) => `${k} ${v}`).join(', ')}.`);
  }

  /** Concreto e cargas dos dados atuais (comuns aos modos de lançamento). */
  function camposComuns(tipoD, d, mudar) {
    const fck = d.criterios?.fck ?? 0;
    const campos = [ui.selecao({ rotulo: 'Concreto', valor: fck, largura: '150px', opcoes: [{ valor: 0, texto: `Do projeto (C${estado.projeto.parametros.concreto.fck})` }, ...CLASSES_FCK.map((f) => ({ valor: f, texto: `C${f}` }))],
      aoMudar: (v) => { const c = { ...(d.criterios ?? {}) }; if (v) c.fck = v; else delete c.fck; mudar({ criterios: Object.keys(c).length ? c : null }, 'Concreto do próximo elemento'); } })];
    if (tipoD === 'viga') {
      const copiadas = Array.isArray(d.cargas);
      campos.push(ui.selecao({ rotulo: 'Cargas', valor: copiadas ? 'copiadas' : d.cargas ?? 'padrao', largura: '220px', opcoes: [
        { valor: 'padrao', texto: 'Padrão (parede e sobrecarga)' }, { valor: 'nenhuma', texto: 'Nenhuma' },
        ...(copiadas ? [{ valor: 'copiadas', texto: `Copiadas${d.origem ? ` de ${d.origem}` : ''} (${d.cargas.length})` }] : []),
      ], aoMudar: (v) => { if (v !== 'copiadas') mudar({ cargas: v }, 'Cargas da próxima viga'); } }));
    }
    return campos;
  }

  /** Caixa de um modo sobre a planta; clicar no título recolhe (fica só o título) ou abre. */
  function caixaRecolhivel(cab, ...corpo) {
    const aberta = aberto('caixa');
    cab.classList.add('clicavel');
    cab.title = aberta ? 'Recolher (o modo continua ativo)' : 'Abrir as opções';
    cab.addEventListener('click', (e) => { if (e.target.closest('button')) return; definirPrefUi('caixa', !aberta); renderizarTudo(); });
    cab.prepend(icone(aberta ? 'baixo' : 'direita', { tamanho: 12 }));
    return h('div', { class: ['mont-modo', !aberta && 'recolhida'] }, cab, ...(aberta ? corpo : []));
  }

  function caixaDaLaje() {
    const d = dadosAtuais(estado.projeto, 'laje');
    const mudar = (parcial, texto) => alterar((pp) => definirDadosAtuais(pp, 'laje', parcial), texto, { invalidar: false });
    const tipos = modulos.lista().filter((m) => m.categoria === 'lajes');
    const atual = modulos.obter(d.modulo) ? d.modulo : 'concreto.laje.macica';
    return caixaRecolhivel(
      h('div', { class: 'mont-modo-cab' }, icone('laje', { tamanho: 14 }), h('strong', null, 'Laje no contorno'), h('span', { style: { flex: '1' } }),
        ui.botaoIcone({ icone: 'fechar', titulo: 'Sair do lançamento (Esc)', aoClicar: () => modoLancamento('laje') })),
      h('div', { class: 'mont-modo-campos' },
        ui.selecao({ rotulo: 'Tipo', valor: atual, largura: '170px', opcoes: tipos.map((m) => ({ valor: m.id, texto: m.nomeCurto ?? m.nome })), aoMudar: (v) => mudar({ modulo: v }, 'Tipo da próxima laje') }),
        atual === 'concreto.laje.macica' && !d.hPeloVao ? ui.campo({ rotulo: 'h', valor: d.h, unidade: 'cm', casas: 1, min: 7, max: 40, largura: '92px', aoMudar: (v) => mudar({ h: v }, 'Espessura da próxima laje') }) : null,
        atual === 'concreto.laje.macica' ? ui.segmentado({ rotulo: 'Espessura', valor: d.hPeloVao ? 'vao' : 'fixa', opcoes: [
          { valor: 'fixa', texto: 'Fixa' }, { valor: 'vao', texto: 'Pelo vão', dica: 'máx(Lx/40, 8 cm; 10 cm em balanço)' }], aoMudar: (v) => mudar({ hPeloVao: v === 'vao' }, 'Espessura da próxima laje') }) : null,
        ui.texto({ rotulo: 'Próximo código', valor: d.proximoCodigo ?? '', largura: '110px', aoMudar: (v) => mudar({ proximoCodigo: v.trim() || null }, 'Código da próxima laje') }),
        ...camposComuns('laje', d, mudar),
      ),
      ui.segmentado({ rotulo: 'Clique', valor: vista.subModo === 'fechamento' ? 'fechamento' : 'laje', opcoes: [
        { valor: 'laje', texto: 'Lança a laje', dica: 'Clique dentro de uma região destacada' },
        { valor: 'fechamento', texto: 'Fechamento de bordo', dica: 'Dois cliques desenham uma linha que fecha a região de um balanço; a laje fica com a borda livre ali' },
      ], aoMudar: (v) => { vista.subModo = v === 'fechamento' ? 'fechamento' : null; vista.cadeia = []; renderizarTudo(); } }),
      h('p', { class: 'mont-modo-dica' }, vista.subModo === 'fechamento'
        ? 'Clique nos dois pontos do fechamento (Shift trava em 0°/90°). Clicar num fechamento no modo "Lança a laje" o apaga.'
        : 'As regiões fechadas pelos eixos das vigas aparecem destacadas: clique dentro para lançar a laje, com as bordas ligadas às vigas. Lajes em uma direção correm no menor vão. Esc sai.'),
    );
  }

  /** Conta-gotas: as propriedades do elemento viram os dados atuais do tipo; com `pincel`, entra no modo de aplicar. */
  function contaGotas(el, pincel = false) {
    const copia = copiarPropriedades(el, modulos);
    if (!copia) return notificar('O conta-gotas copia propriedades de vigas, lajes e pilares de concreto.', 'info');
    alterar((pp) => definirDadosAtuais(pp, copia.tipo, copia.dados), `Conta-gotas: ${el.codigo}`, { invalidar: false });
    if (pincel) { vista.modo = 'pincel'; vista.pincel = copia; vista.cadeia = []; vista.cursor = null; renderizarTudo(); }
    else notificar(`Propriedades de ${el.codigo} copiadas: os próximos elementos do tipo saem iguais (Viga em cadeia, Laje no contorno e Adicionar).`, 'ok', { duracao: 5000 });
  }

  function caixaDoPincel() {
    const c = vista.pincel;
    const tipoTxt = { viga: 'vigas', laje: 'lajes', pilar: 'pilares' }[c?.tipo] ?? 'elementos';
    const resumo = c?.tipo === 'viga' ? `${c.dados.secao.b} × ${c.dados.secao.h} cm` : c?.tipo === 'pilar' ? `${c.dados.bx} × ${c.dados.by} cm` : c?.dados.h ? `h = ${c.dados.h} cm` : '';
    return caixaRecolhivel(
      h('div', { class: 'mont-modo-cab' }, icone('copiar', { tamanho: 14 }), h('strong', null, `Pincel de ${c?.dados.origem ?? ''}`), h('span', { style: { flex: '1' } }),
        ui.botaoIcone({ icone: 'fechar', titulo: 'Sair do pincel (Esc)', aoClicar: () => { vista.modo = null; vista.pincel = null; renderizarTudo(); } })),
      h('p', { class: 'mont-modo-dica' }, `Clique nas ${tipoTxt} para aplicar ${resumo}${c?.dados.criterios?.fck ? `, C${c.dados.criterios.fck}` : ''} e as cargas próprias de ${c?.dados.origem}. As ligações de cada elemento ficam como estão. Esc sai.`));
  }

  /** Caixa do modo de lançamento sobre a planta: dados da viga e as teclas. */
  function caixaDoModo() {
    if (vista.modo === 'pincel') return caixaDoPincel();
    if (vista.modo === 'laje') return caixaDaLaje();
    if (vista.modo === 'eixo' || vista.modo === 'cota') {
      const eixo = vista.modo === 'eixo';
      return caixaRecolhivel(
        h('div', { class: 'mont-modo-cab' }, icone(eixo ? 'eixo' : 'cota', { tamanho: 14 }), h('strong', null, eixo ? 'Desenhar eixo' : 'Cota entre eixos'), h('span', { style: { flex: '1' } }),
          ui.botaoIcone({ icone: 'fechar', titulo: 'Sair (Esc)', aoClicar: () => modoLancamento(vista.modo) })),
        h('p', { class: 'mont-dica' }, eixo
          ? 'Clique em dois pontos: o eixo passa por eles e segue por toda a planta. Os pontos encaixam em pilares, cantos, nós e outros eixos; com Shift o eixo fica horizontal ou vertical. Para um eixo paralelo a outro, selecione o eixo e use Duplicar (D). Esc sai.'
          : 'Pressione sobre um eixo e arraste até outro eixo paralelo: a cota fica na planta e o número abre a distância para digitar — o eixo de chegada e os seguintes vão para a nova distância. Esc sai.'));
    }
    if (vista.modo !== 'cadeia') return null;
    const d = dadosAtuais(estado.projeto, 'viga');
    const mudar = (parcial, texto) => alterar((pp) => definirDadosAtuais(pp, 'viga', parcial), texto, { invalidar: false });
    return caixaRecolhivel(
      h('div', { class: 'mont-modo-cab' }, icone('viga', { tamanho: 14 }), h('strong', null, 'Viga em cadeia'), h('span', { style: { flex: '1' } }),
        ui.botaoIcone({ icone: 'fechar', titulo: 'Sair do lançamento (Esc)', aoClicar: () => modoLancamento('cadeia') })),
      h('div', { class: 'mont-modo-campos' },
        ui.campo({ rotulo: 'b', valor: d.secao.b, unidade: 'cm', casas: 1, min: 10, max: 200, largura: '92px', aoMudar: (v) => mudar({ secao: { ...d.secao, b: v } }, 'Largura da próxima viga') }),
        d.hPeloVao ? null : ui.campo({ rotulo: 'h', valor: d.secao.h, unidade: 'cm', casas: 1, min: 15, max: 300, largura: '92px', aoMudar: (v) => mudar({ secao: { ...d.secao, h: v } }, 'Altura da próxima viga') }),
        ui.campo({ rotulo: 'Desloc.', valor: d.deslocamento ?? 0, unidade: 'cm', casas: 1, min: -200, max: 200, largura: '100px', dica: 'Desloca o eixo para a esquerda (+) ou para a direita (−) do sentido do lançamento.', aoMudar: (v) => mudar({ deslocamento: v }, 'Deslocamento da próxima viga') }),
        ui.texto({ rotulo: 'Próximo código', valor: d.proximoCodigo ?? '', largura: '110px', aoMudar: (v) => mudar({ proximoCodigo: v.trim() || null }, 'Código da próxima viga') }),
        ...camposComuns('viga', d, mudar),
      ),
      ui.segmentado({ rotulo: 'Altura', valor: d.hPeloVao ? 'vao' : 'fixa', opcoes: [
        { valor: 'fixa', texto: 'Fixa', dica: 'A altura h acima, em todas as vigas' },
        { valor: 'vao', texto: 'Pelo vão', dica: 'Pré-dimensionamento: L/10 (um vão), L/12 (contínua) ou L/5 (balanço), em múltiplos de 5 cm' },
      ], aoMudar: (v) => mudar({ hPeloVao: v === 'vao' }, 'Altura da próxima viga') }),
      ui.segmentado({ rotulo: 'Alinhamento', valor: d.alinhamento, opcoes: [
        { valor: 'eixo', texto: 'Eixo', dica: 'Eixo da viga no centro dos pilares' },
        { valor: 'esquerda', texto: 'Face esq.', dica: 'Face esquerda da viga (no sentido do lançamento) rente à face do pilar' },
        { valor: 'direita', texto: 'Face dir.', dica: 'Face direita da viga rente à face do pilar' },
      ], aoMudar: (v) => mudar({ alinhamento: v }, 'Alinhamento da próxima viga') }),
      h('p', { class: 'mont-modo-dica' }, 'Clique de pilar em pilar: os pilares atravessados viram apoios. Enter ou duplo clique conclui · Backspace desfaz o ponto · Shift trava em 0°/90° · Esc sai.'),
      vista.cadeia.length ? h('div', { class: 'mont-modo-acoes' }, ui.botao({ texto: 'Concluir', icone: 'check', tipo: 'primario', aoClicar: concluirCadeia }), ui.botao({ texto: 'Desfazer ponto', tipo: 'fantasma', aoClicar: () => { vista.cadeia.pop(); desenharPrevia(); } })) : null,
    );
  }

  /** Cruzamentos de vigas fora de pilar (etapa L3): "?" indefinido; seta da viga apoiada para o apoio; clique muda. */
  function desenharCruzamentos() {
    const camada = s('g', { class: 'mont-cruzamentos' });
    for (const c of cruzamentosDoPavimento(estado.projeto, modulos, vista.pav)) {
      const [x, y] = tela(c.ponto);
      const situacao = c.sem ? 'sem' : c.apoiada ? 'definido' : 'indefinido';
      const rot = c.sem ? 'sem transf.' : c.apoiada ? `${c.apoiada.codigo} → ${c.apoio.codigo}` : '?';
      camada.append(s('g', { class: `mont-cruz ${situacao}`, 'data-chave': c.chave },
        s('title', null, `${textoCruzamento(c)} — clique para definir`),
        s('circle', { cx: x, cy: y, r: 8 }),
        situacao === 'indefinido' ? s('text', { x, y: y + 4, 'text-anchor': 'middle', class: 'mont-cruz-q' }, '?') : null,
        situacao !== 'indefinido' ? s('text', { x: x + 11, y: y + 15, class: 'mont-cruz-rot' }, rot) : null));
    }
    return camada;
  }

  function menuCruzamento(chave, ev) {
    const c = cruzamentosDoPavimento(estado.projeto, modulos, vista.pav).find((x) => x.chave === chave);
    if (!c) return;
    const definir = (valor, texto) => alterar((pp) => definirCruzamento(pp, vista.pav, c.chave, valor), texto, { invalidar: false });
    const marca = (v) => (c.valor === v && !c.implicito ? 'check' : undefined);
    const sug = sugerirCruzamento(c);
    abrirMenu([
      { cabecalho: `Cruzamento ${c.a.codigo} × ${c.b.codigo}` },
      { rotulo: `${c.a.codigo} apoia em ${c.b.codigo}${sug === c.a.id ? ' (sugerido)' : ''}`, icone: marca(c.a.id), acao: () => definir(c.a.id, `${c.a.codigo} apoia em ${c.b.codigo}`) },
      { rotulo: `${c.b.codigo} apoia em ${c.a.codigo}${sug === c.b.id ? ' (sugerido)' : ''}`, icone: marca(c.b.id), acao: () => definir(c.b.id, `${c.b.codigo} apoia em ${c.a.codigo}`) },
      { rotulo: 'Sem transferência (as vigas não se tocam)', icone: marca(SEM_TRANSFERENCIA), acao: () => definir(SEM_TRANSFERENCIA, `${c.a.codigo} × ${c.b.codigo} sem transferência`) },
      '-',
      { rotulo: 'Indefinido', desabilitado: !c.valor || c.implicito, acao: () => definir(null, `${c.a.codigo} × ${c.b.codigo} indefinido`) },
    ], { x: ev.clientX, y: ev.clientY });
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

  /** Radier (contorno do cálculo) sob os pilares deste pavimento e sapatas corridas sob as vigas dele. */
  function desenharFundacoesContinuas() {
    const camada = s('g', { class: 'mont-sapatas' });
    const proj = estado.projeto;
    const grupo = (el, pts, rotulo, ponto) => {
      const r = el.resultado && !el.resultado.erro ? el.resultado : null;
      const g = s('g', { class: ['mont-sapata', r ? (r.ok ? 'atende' : 'falha') : 'sem'].join(' '), style: { cursor: 'pointer' } }, s('polygon', { points: pontos(pts) }));
      const [tx, ty] = tela(ponto);
      g.append(s('text', { x: tx + 4, y: ty + 12 }, rotulo));
      g.addEventListener('dblclick', (ev) => { ev.stopPropagation(); acoes.abrirElemento?.(el.id); });
      camada.append(g);
    };
    for (const ra of proj.elementos.filter((e) => e.modulo === 'concreto.radier')) {
      const r = ra.resultado && !ra.resultado.erro ? ra.resultado : null;
      if (!r) continue;
      const pl = proj.elementos.find((e) => e.id === r.pilares?.[0]?.id);
      if (!pl?.posicao || pl.posicao.pavimento !== vista.pav) continue;
      const { x, y } = r.local;
      grupo(ra, [[x, y], [x + r.lx, y], [x + r.lx, y + r.ly], [x, y + r.ly]], `${ra.codigo} · h ${r.h}`, [x, y + r.ly]);
    }
    for (const sc of proj.elementos.filter((e) => e.modulo === 'concreto.sapataCorrida' && e.vigaId)) {
      const v = proj.elementos.find((e) => e.id === sc.vigaId);
      if (!v?.posicao || v.posicao.pavimento !== vista.pav) continue;
      const r = sc.resultado && !sc.resultado.erro ? sc.resultado : null;
      const B = (r?.B ?? sc.geometria?.B ?? 80) / 100, L = (v.vaos ?? []).reduce((t, x) => t + (x.L || 0), 0);
      const a = ((v.posicao.angulo ?? 0) * Math.PI) / 180, c = Math.cos(a), sn = Math.sin(a);
      const P = (u, w) => [v.posicao.x + u * c - w * sn, v.posicao.y + u * sn + w * c];
      grupo(sc, [P(0, -B / 2), P(L, -B / 2), P(L, B / 2), P(0, B / 2)], sc.codigo, P(L * 0.1, -B / 2));
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
    const malha = passoMalha();
    let passo = malha && malha * vista.esc >= 9 ? malha : vista.esc < 14 ? 5 : 1;
    while (passo * vista.esc < 6) passo *= 5;   // muito afastado: linhas a cada 25 m, 125 m…
    const grade = s('g', { class: ['mont-grade', malha && passo === malha && 'malha'] });
    // linhas presas às coordenadas da planta (múltiplos inteiros do passo): andam e aproximam junto com os elementos;
    // a cada 5 passos, uma linha mais marcada
    // de perto, uma quadrícula fina a cada 1/5 do passo (como o papel milimetrado do tema blueprint)
    const fina = passo * vista.esc >= 50 ? 5 : 1, p0 = passo / fina;
    const classe = (k) => (k === 0 ? 'eixo' : k % (5 * fina) === 0 ? 'maior' : k % fina === 0 ? '' : 'fina');
    for (let k = Math.ceil(mx0 / p0 - 1e-9); k * p0 <= mx1; k++) { const [px] = tela([k * p0, 0]); grade.append(s('line', { x1: px, y1: 0, x2: px, y2: H, class: classe(k) })); }
    for (let k = Math.ceil(my0 / p0 - 1e-9); k * p0 <= my1; k++) { const [, py] = tela([0, k * p0]); grade.append(s('line', { x1: 0, y1: py, x2: W, y2: py, class: classe(k) })); }
    svg.append(grade);
    // planta de arquitetura (DXF) e eixos do projeto
    const fundo = camadaFundo(estado.projeto, pavimento(estado.projeto, vista.pav), tela, vista.esc);
    if (fundo) { if (arrasto?.tipo === 'fundo') fundo.setAttribute('transform', `translate(${arrasto.dx * vista.esc} ${-arrasto.dy * vista.esc})`); svg.append(fundo); }
    const eixos = comEixos() && camadaEixos(estado.projeto, {
      tela, W, H, sel: vista.selEixo,
      previa: arrasto?.tipo === 'eixo' && arrasto.moveu ? { id: arrasto.id, d: arrasto.dNovo } : null,
      cotaPrevia: arrasto?.tipo === 'cota' ? arrasto.previa : null,
    });
    if (eixos) svg.append(eixos);
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
      const g = s('g', { class: 'mont-acima' }, s('polygon', { points: pontos(contornoPilar(el)) }));
      camadaEls.append(g);
    }
    svg.append(camadaEls);
    if (modoDoPavimento(estado.projeto, vista.pav) === 'grelha') svg.append(desenharGrelha());
    svg.append(desenharCruzamentos());
    svg.append(desenharSapatas());
    svg.append(desenharBlocos());
    svg.append(desenharFundacoesContinuas());
    svg.append(desenharEstacas());
    svg.append(desenharFuros());
    camadaModo = s('g', { class: 'mont-modo-previa' });
    svg.append(camadaModo);
    desenharPrevia();
    // ponto do problema escolhido no painel
    if (vista.marca) {
      const [mx, my] = tela(vista.marca);
      svg.append(s('g', { class: 'mont-marca-problema' }, s('circle', { cx: mx, cy: my, r: 16 }), s('circle', { cx: mx, cy: my, r: 3, class: 'centro' })));
    }
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

  svg.addEventListener('click', (e) => {
    const cruz = e.target.closest?.('.mont-cruz');
    if (cruz) { e.stopPropagation(); menuCruzamento(cruz.dataset.chave, e); return; }
    if (vista.modo) return;
    const cota = e.target.closest?.('.mont-cota-txt') && e.target.closest('.mont-cota');
    if (cota?.dataset.cota) { e.stopPropagation(); editarCota(cota.dataset.cota); return; }
    const no = e.target.closest?.('.mont-no');
    if (no) { e.stopPropagation(); menuNo(no.dataset.no, e); }
  });
  svg.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    // gaveta aberta numa tela estreita: o clique na planta fecha a gaveta
    if (vista.lateralSobre) { vista.lateralSobre = false; raiz.classList.remove('lateral-aberta'); }
    if (e.target.closest?.('.mont-cruz')) return; // o menu do cruzamento abre no click
    if (!vista.modo && (e.target.closest?.('.mont-no') || e.target.closest?.('.mont-cota-txt'))) return; // nó e cota: no click
    // ferramenta Cota: arrastar de um eixo até outro paralelo
    if (vista.modo === 'cota') {
      const r0 = svg.getBoundingClientRect(), esc0 = W / r0.width;
      const pm = mundo((e.clientX - r0.left) * esc0, (e.clientY - r0.top) * esc0);
      const ex = eixoPerto(estado.projeto, pm, (IMA_PX * 1.5) / vista.esc);
      if (!ex) { notificar('Comece a cota sobre um eixo e arraste até outro eixo paralelo.', 'info'); return; }
      svg.setPointerCapture(e.pointerId);
      const sAlong = (pm[0] - ex.p[0]) * ex.u[0] + (pm[1] - ex.p[1]) * ex.u[1];
      arrasto = { tipo: 'cota', eixo: ex, s: sAlong, x0: e.clientX, y0: e.clientY, escala: esc0, moveu: false, previa: null, alvo: null };
      return;
    }
    // eixo: selecionar e arrastar na perpendicular
    const gEixo = !vista.modo && e.target.closest?.('[data-eixo]');
    if (gEixo) {
      const ex = listaEixos(estado.projeto).find((x) => x.id === gEixo.dataset.eixo);
      if (ex) {
        const r0 = svg.getBoundingClientRect();
        svg.setPointerCapture(e.pointerId);
        if (vista.selEixo !== ex.id || vista.sel) { vista.selEixo = ex.id; vista.sel = null; desenharPlanta(); desenharLateral(); }
        // pontos dos elementos do pavimento e nós dos outros eixos: o eixo encosta neles ao ser arrastado
        const alvosD = doPav.flatMap((x) => pontosDeEncaixe(x, tipo(x))).concat(nosDosEixos(estado.projeto).filter((n) => !n.eixos.includes(ex.id)).map((n) => n.p)).map((q) => q[0] * ex.n[0] + q[1] * ex.n[1]);
        arrasto = { tipo: 'eixo', id: ex.id, eixo: ex, d0: ex.d, dNovo: ex.d, alvosD, x0: e.clientX, y0: e.clientY, escala: W / r0.width, moveu: false };
        return;
      }
    }
    if (vista.modo === 'pincel') {
      const alvoEl = e.target.closest?.('.mont-el:not(.fantasma)');
      if (alvoEl) {
        const dest = estado.elemento(alvoEl.dataset.id);
        let ok = false;
        alterar((pp) => { ok = aplicarPropriedades(elDoProjeto(pp, dest.id), vista.pincel, modulos); }, `Pincel: ${vista.pincel.dados.origem} → ${dest.codigo}`, { invalidar: true, elementoId: dest.id });
        if (!ok) notificar(`${dest.codigo} não é do mesmo tipo de ${vista.pincel.dados.origem}.`, 'info');
        return;
      }
    }
    if (vista.modo) {
      // no lançamento, clicar marca um ponto e arrastar desloca a planta
      const r0 = svg.getBoundingClientRect();
      svg.setPointerCapture(e.pointerId);
      arrasto = { tipo: 'pan', modo: true, alvo: e.target, shift: e.shiftKey, px: (e.clientX - r0.left) * (W / r0.width), py: (e.clientY - r0.top) * (W / r0.width), x0: e.clientX, y0: e.clientY, cx: vista.cx, cy: vista.cy, escala: W / r0.width, moveu: false };
      return;
    }
    const alvo = e.target.closest?.('.mont-el:not(.fantasma)');
    const r = svg.getBoundingClientRect();
    const escala = W / r.width;
    svg.setPointerCapture(e.pointerId);
    if (alvo) {
      const el = estado.elemento(alvo.dataset.id);
      if (vista.sel !== el.id || vista.selEixo) { vista.sel = el.id; vista.selEixo = null; desenharPlanta(); desenharLateral(); }
      const g = camadaEls.querySelector(`[data-id="${el.id}"]`);
      const t = tipo(el);
      const meus = pontosDeEncaixe(el, t);
      const [vx0, vy1] = mundo(0, 0), [vx1, vy0] = mundo(W, H);
      const alvos = doPav.filter((x) => x.id !== el.id).concat(referencia).flatMap((x) => pontosDeEncaixe(x, tipo(x)))
        .concat(t === 'pilar' ? pilaresAcima.map(centroPilar) : [])
        .concat(comEixos() ? cruzamentosDosEixos(estado.projeto) : [])
        .concat(pontosDoFundo(estado.projeto, pavimento(estado.projeto, vista.pav), [vx0, vy0, vx1, vy1]));
      arrasto = { tipo: 'el', el, g, x0: e.clientX, y0: e.clientY, escala, meus, alvos, dx: 0, dy: 0, moveu: false };
    } else if (vista.moverFundo && plantaDe(estado.projeto, pavimento(estado.projeto, vista.pav))) {
      arrasto = { tipo: 'fundo', x0: e.clientX, y0: e.clientY, escala, dx: 0, dy: 0, moveu: false };
    } else {
      arrasto = { tipo: 'pan', x0: e.clientX, y0: e.clientY, cx: vista.cx, cy: vista.cy, escala, moveu: false };
    }
  });
  svg.addEventListener('pointerleave', () => { ponteiro.dentro = false; });
  svg.addEventListener('pointermove', (e) => {
    {
      const r1 = svg.getBoundingClientRect();
      ponteiro.dentro = true;
      ponteiro.p = mundo((e.clientX - r1.left) * (W / r1.width), (e.clientY - r1.top) * (W / r1.width));
    }
    if (vista.modo && (!arrasto || !arrasto.moveu)) {
      const r0 = svg.getBoundingClientRect();
      const esc0 = W / r0.width;
      vista.cursor = pontoDoLancamento(mundo((e.clientX - r0.left) * esc0, (e.clientY - r0.top) * esc0), e.shiftKey).p;
      desenharPrevia();
    }
    if (!arrasto) return;
    const dpx = (e.clientX - arrasto.x0) * arrasto.escala, dpy = (e.clientY - arrasto.y0) * arrasto.escala;
    if (Math.hypot(dpx, dpy) > 3) arrasto.moveu = true;
    if (!arrasto.moveu) return;
    if (arrasto.tipo === 'pan') {
      vista.cx = arrasto.cx - dpx / vista.esc; vista.cy = arrasto.cy + dpy / vista.esc;
      desenharPlanta();
      return;
    }
    if (arrasto.tipo === 'eixo') {
      const ex = arrasto.eixo;
      let d = arrasto.d0 + (dpx / vista.esc) * ex.n[0] + (-dpy / vista.esc) * ex.n[1];
      const lim = IMA_PX / vista.esc;
      const perto = arrasto.alvosD.reduce((m, q) => (Math.abs(q - d) < lim && (m == null || Math.abs(q - d) < Math.abs(m - d)) ? q : m), null);
      arrasto.dNovo = perto ?? arred(d, passoMalha() || GRADE);
      desenharPlanta();
      return;
    }
    if (arrasto.tipo === 'cota') {
      const r0 = svg.getBoundingClientRect();
      const pm = mundo((e.clientX - r0.left) * arrasto.escala, (e.clientY - r0.top) * arrasto.escala);
      const ex = arrasto.eixo;
      const outro = listaEixos(estado.projeto).filter((x) => x.familia === ex.familia && x.id !== ex.id && distanciaAoEixo(pm, x) < (IMA_PX * 1.5) / vista.esc).sort((a, b) => distanciaAoEixo(pm, a) - distanciaAoEixo(pm, b))[0] ?? null;
      const pa = [ex.p[0] + ex.u[0] * arrasto.s, ex.p[1] + ex.u[1] * arrasto.s];
      const dd = outro ? outro.d - ex.d : (pm[0] - pa[0]) * ex.n[0] + (pm[1] - pa[1]) * ex.n[1];
      const pb = [pa[0] + ex.n[0] * dd, pa[1] + ex.n[1] * dd];
      arrasto.alvo = outro;
      arrasto.previa = { previa: true, pa, pb, dist: Math.abs(dd), eixoA: ex, eixoB: outro ?? ex };
      desenharPlanta();
      return;
    }
    if (arrasto.tipo === 'fundo') {
      arrasto.dx = dpx / vista.esc; arrasto.dy = -dpy / vista.esc;
      svg.querySelector('.mont-fundo')?.setAttribute('transform', `translate(${dpx} ${dpy})`);
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
    else {
      marcaIma.style.display = 'none';
      // sem ponto de encaixe por perto: encosta nos eixos ou, com a malha ligada, leva o ponto de inserção para a malha
      const ei = comEixos() ? encaixarEmEixos(estado.projeto, arrasto.meus, dpx / vista.esc, -dpy / vista.esc, lim) : { eixo: false };
      if (ei.eixo) { dx = arred(ei.dx, 0.001); dy = arred(ei.dy, 0.001); }
      else {
        const malha = passoMalha();
        const pos = arrasto.el.posicao;
        if (malha && pos) { dx = arred(pos.x + dpx / vista.esc, malha) - pos.x; dy = arred(pos.y - dpy / vista.esc, malha) - pos.y; }
      }
    }
    arrasto.dx = dx; arrasto.dy = dy;
    arrasto.g.setAttribute('transform', `translate(${dx * vista.esc} ${-dy * vista.esc})`);
  });
  const soltar = () => {
    if (!arrasto) return;
    const a = arrasto;
    arrasto = null;
    if (a.tipo === 'eixo') {
      if (!a.moveu || Math.abs(a.dNovo - a.d0) < 1e-9) { desenharPlanta(); return; }
      alterarEixos((pp, op, n) => n.moverEixo(pp, a.id, a.dNovo, op), `Mover o eixo ${a.eixo.nome}`);
      return;
    }
    if (a.tipo === 'cota') {
      const alvo = a.alvo;
      if (!alvo) { desenharPlanta(); if (a.moveu) notificar('Solte a cota sobre um eixo paralelo ao de partida.', 'info'); return; }
      let id = null;
      alterar((pp) => { id = nucleoEixos.criarCota(pp, a.eixo.id, alvo.id, a.s); }, `Cota ${a.eixo.nome}–${alvo.nome}`, { invalidar: false });
      if (id) editarCota(id);
      return;
    }
    if (a.tipo === 'pan' && a.modo) {
      if (a.moveu || vista.modo === 'pincel') return;
      if (vista.modo === 'laje') { cliqueDaLaje(mundo(a.px, a.py), a.shift, a.alvo); return; }
      if (vista.modo === 'cota') return;
      if (vista.modo === 'eixo') {
        const { p } = pontoDoLancamento(mundo(a.px, a.py), a.shift);
        if (!vista.cadeia.length) { vista.cadeia = [p]; desenharPrevia(); return; }
        const p0 = vista.cadeia[0];
        vista.cadeia = []; vista.cursor = null;
        let id = null;
        alterar((pp) => { id = nucleoEixos.criarEixoPorDoisPontos(pp, p0, p); }, 'Novo eixo', { invalidar: false });
        if (!id) { notificar('Os dois pontos coincidem: clique em pontos diferentes.', 'info'); desenharPrevia(); return; }
        vista.selEixo = id; vista.sel = null;
        renderizarTudo();
        return;
      }
      const { p } = pontoDoLancamento(mundo(a.px, a.py), a.shift);
      const ult = vista.cadeia[vista.cadeia.length - 1];
      // clicar de novo no último ponto conclui
      if (ult && Math.hypot(ult[0] - p[0], ult[1] - p[1]) < 1e-6 && vista.cadeia.length > 1) { concluirCadeia(); return; }
      vista.cadeia.push(p);
      desenharPrevia();
      if (vista.cadeia.length === 1) desenharLateral();
      return;
    }
    if (a.tipo === 'pan') { if (!a.moveu && (vista.sel || vista.marca || vista.selEixo)) { vista.sel = null; vista.marca = null; vista.selEixo = null; desenharPlanta(); desenharLateral(); } return; }
    if (a.tipo === 'fundo') {
      if (!a.moveu) return;
      alterar((proj) => { const pv = pavimento(proj, vista.pav); pv.fundo.dx = Math.round(((pv.fundo.dx ?? 0) + a.dx) * 1000) / 1000; pv.fundo.dy = Math.round(((pv.fundo.dy ?? 0) + a.dy) * 1000) / 1000; }, 'Mover a planta de fundo');
      return;
    }
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
    if (vista.modo === 'cadeia') { concluirCadeia(); return; }
    const alvo = e.target.closest?.('.mont-el:not(.fantasma)');
    if (alvo) acoes.abrirElemento(alvo.dataset.id);
  });

  /* ------------------------------------------------------------ ações */
  function posicionar(el, pav = vista.pav, ponto = null) {
    const t = tipo(el);
    vista.sel = el.id;
    vista.novos.delete(el.id);
    alterar((proj) => {
      const e = elDoProjeto(proj, el.id);
      e.posicao = { pavimento: pav, x: ponto ? ponto[0] : arred(vista.cx, 0.5), y: ponto ? ponto[1] : arred(vista.cy, 0.5), angulo: 0 };
      const pd = peDireito(proj, pav);
      if (t === 'pilar' && pd > 0 && e.comprimento != null) e.comprimento = pd;
    }, `Posicionar ${el.codigo}`, { invalidar: tipo(el) === 'pilar', elementoId: el.id });
  }

  function adicionar(ancora) {
    const grupos = modulos.categorias().map((c) => ({ c, mods: modulos.daCategoria(c.id).filter((m) => m.montagem !== false) })).filter((g) => g.mods.length);
    abrirMenu(grupos.flatMap((g, i) => [
      ...(i ? ['-'] : []), { cabecalho: g.c.nome },
      ...g.mods.map((m) => ({ rotulo: m.nome, icone: m.icone, acao: () => criarNaPlanta(m) })),
    ]), { ancora });
  }

  /** Cria um elemento do módulo com os dados atuais do tipo e o posiciona (no centro da vista ou num ponto). */
  function criarNaPlanta(m, ponto = null) {
        const el = estado.criarElemento(m);
        // dados atuais do tipo (seção, critérios, cargas e o próximo código) já no elemento novo
        const tl = tipoDeLancamento(el, modulos);
        if (tl) {
          const d = dadosAtuais(estado.projeto, tl);
          if (tl !== 'laje' || !d.modulo || d.modulo === el.modulo) {
            estado.alterar((pp) => {
              const e = elDoProjeto(pp, el.id);
              aplicarDadosAtuais(e, tl, d);
              // pilar posto na planta: a carga de exemplo do módulo ("pavimentos superiores") não vale — o que desce
              // de cima chega pelas ligações
              if (tl === 'pilar' && Array.isArray(e.cargas)) e.cargas = e.cargas.filter((c) => c?.tipo === 'elemento');
              if (d.proximoCodigo && !pp.elementos.some((x) => x.codigo === d.proximoCodigo)) { e.codigo = d.proximoCodigo; if (e.nome === el.codigo) e.nome = d.proximoCodigo; definirDadosAtuais(pp, tl, { proximoCodigo: null }); }
            }, { descricao: `Dados atuais em ${el.codigo}`, estrutural: true, invalidar: false });
          }
        }
        posicionar(estado.elemento(el.id), vista.pav, ponto);
        // laje nova: a carga padrão do pavimento (L13), se não veio cópia do conta-gotas
        if (tl === 'laje' && !Array.isArray(dadosAtuais(estado.projeto, 'laje').cargas) && (typeof dadosAtuais(estado.projeto, 'laje').cargas !== 'object' || dadosAtuais(estado.projeto, 'laje').cargas === null)) {
          estado.alterar((pp) => { aplicarCargaPadrao(pp, elDoProjeto(pp, el.id)); }, { descricao: `Carga padrão em ${el.codigo}`, estrutural: true, invalidar: false });
        }
        return estado.elemento(el.id);
  }

  /* ------------------------------------------------------------ eixos (0.65) */
  /** Edição de eixos com a opção de os elementos acompanharem; os elementos movidos ficam desatualizados. */
  function alterarEixos(fn, descricao) {
    let r = null;
    alterar((pp) => {
      r = fn(pp, { elementos: eixosLevamElementos(), tipoDe: (el) => tipo(el) }, nucleoEixos);
      for (const c of r?.elementos ?? []) { const el = pp.elementos.find((x) => (x.codigo ?? x.id) === c); if (el?.resultado) el.resultado.desatualizado = true; }
    }, descricao, { invalidar: false });
    if (r?.elementos?.length) acoes.registrarSaida?.(`Eixos: ${r.elementos.length} elemento(s) acompanharam (${r.elementos.slice(0, 12).join(', ')}${r.elementos.length > 12 ? '…' : ''}). Use Conectar para refazer as ligações.`);
    return r;
  }
  function novoEixo(tipoE) {
    const fam = listaEixos(estado.projeto).filter((e) => e.tipo === tipoE);
    const ult = fam.at(-1), passo = fam.length > 1 ? fam.at(-1).d - fam.at(-2).d : 4;
    let id = null;
    alterar((pp) => {
      if (ult && tipoE !== 'inclinado') id = nucleoEixos.duplicarEixo(pp, ult.id, passo > 0.05 ? passo : 4);
      else id = nucleoEixos.criarEixo(pp, [arred(vista.cx, 0.5), arred(vista.cy, 0.5)], tipoE === 'vertical' ? 90 : tipoE === 'horizontal' ? 0 : 45);
    }, `Novo eixo ${tipoE}`, { invalidar: false });
    vista.selEixo = id; vista.sel = null;
    renderizarTudo();
  }
  /* ---------------------------------------------------- copiar, colar e duplicar (0.66) */
  /** Deslocamento de uma cópia sem cursor: uns 30 px na escala atual, em múltiplos de 5 cm (mínimo 20 cm). */
  const deslocCopia = () => Math.max(0.2, arred(30 / vista.esc, 0.05));
  /** Ctrl+C: guarda o elemento ou o eixo selecionado. */
  function copiarSel() {
    if (vista.selEixo) {
      const ex = listaEixos(estado.projeto).find((x) => x.id === vista.selEixo);
      if (!ex) return false;
      areaTransf.item = copiaDoEixo(ex); areaTransf.vezes = 0;
      notificar(`Eixo ${ex.nome} copiado — Ctrl+V cola um paralelo no cursor.`, 'info', { duracao: 2500 });
      return true;
    }
    const el = vista.sel && estado.elemento(vista.sel);
    if (!el) return false;
    const c = copiaDoElemento(el);
    if (!c) { notificar(`${el.codigo} acompanha o seu apoio e não é copiado; use os comandos de fundação.`, 'info'); return true; }
    areaTransf.item = c; areaTransf.vezes = 0;
    notificar(`${el.codigo} copiado — Ctrl+V cola com o ponto de inserção no cursor (em qualquer pavimento).`, 'info', { duracao: 2500 });
    return true;
  }
  /**
   * Cola um item: com o cursor sobre a planta, o ponto de inserção (ou o eixo) vai para o cursor, com encaixe; sem
   * cursor, a cópia fica deslocada da anterior. `item` vazio usa a área de transferência.
   */
  function colarItem(item = areaTransf.item, { noCursor = true } = {}) {
    if (!item) { notificar('Nada copiado: selecione um elemento ou eixo e use Ctrl+C.', 'info'); return false; }
    const alvo = noCursor && ponteiro.dentro && ponteiro.p ? pontoDoLancamento(ponteiro.p, false).p : null;
    if (!alvo && item === areaTransf.item) areaTransf.vezes++;
    const k = item === areaTransf.item ? Math.max(1, areaTransf.vezes) : 1;
    if (item.tipo === 'eixo') {
      let id = null;
      alterar((pp) => { id = colarEixo(pp, item, alvo ? { ponto: alvo } : { desloc: k * distanciaDuplicar(vista.esc) }); }, 'Colar eixo', { invalidar: false });
      if (!eixosVisiveis()) definirEixosVisiveis(true);
      vista.selEixo = id; vista.sel = null;
      renderizarTudo();
      return true;
    }
    const pos = item.el.posicao;
    const d = deslocCopia() * k;
    const [dx, dy] = alvo ? [alvo[0] - pos.x, alvo[1] - pos.y] : [d, -d];
    let r = null;
    alterar((pp) => { r = colarElemento(pp, item, { pavimento: vista.pav, dx, dy, peDireito: peDireito(pp, vista.pav) }); }, `Colar ${item.el.codigo}`, { invalidar: tipo(item.el) === 'pilar' });
    vista.sel = r.el.id; vista.selEixo = null;
    renderizarTudo();
    notificar(`${r.el.codigo} criado a partir de ${item.el.codigo}${r.ligacoesRemovidas ? ' — as ligações não vêm junto: use Conectar automaticamente' : ''}.`, 'ok', { duracao: 3500 });
    return true;
  }
  /** Ctrl+D: duplica o selecionado (elemento ou eixo) ao lado, sem mexer no que foi copiado. */
  function duplicarSel() {
    if (vista.selEixo) return duplicarEixoSel(1);
    const el = vista.sel && estado.elemento(vista.sel);
    if (!el) return false;
    const c = copiaDoElemento(el);
    if (!c) { notificar(`${el.codigo} acompanha o seu apoio e não é duplicado aqui.`, 'info'); return true; }
    return colarItem(c, { noCursor: false });
  }

  function duplicarEixoSel(lado = 1) {
    const ex = listaEixos(estado.projeto).find((x) => x.id === vista.selEixo);
    if (!ex) return false;
    let id = null;
    alterar((pp) => { id = nucleoEixos.duplicarEixo(pp, ex.id, lado * distanciaDuplicar(vista.esc)); }, `Duplicar o eixo ${ex.nome}`, { invalidar: false });
    vista.selEixo = id;
    renderizarTudo();
    return true;
  }
  function excluirEixoSel() {
    const ex = listaEixos(estado.projeto).find((x) => x.id === vista.selEixo);
    if (!ex) return false;
    alterar((pp) => nucleoEixos.excluirEixo(pp, ex.id), `Excluir o eixo ${ex.nome}`, { invalidar: false });
    vista.selEixo = null;
    renderizarTudo();
    return true;
  }
  /** Distância de uma cota: digitada num diálogo; o eixo de chegada e os seguintes vão junto. */
  async function editarCota(id) {
    const c = cotasDosEixos(estado.projeto).find((x) => x.id === id);
    if (!c) return;
    let valor = c.dist;
    const r = await dialogo({
      rotulo: 'Cota', titulo: `Distância ${c.eixoA.nome} → ${c.eixoB.nome}`,
      texto: `O eixo ${c.eixoB.nome} vai para essa distância de ${c.eixoA.nome}; os eixos depois dele acompanham${eixosLevamElementos() ? ', e os elementos sobre eles também' : ''}.`,
      corpo: () => [ui.campo({ rotulo: 'Distância', valor, unidade: 'm', casas: 3, min: 0, max: 1000, aoMudar: (v) => { valor = v; } })],
      botoes: [{ texto: 'Excluir a cota', tipo: 'fantasma', valor: 'excluir' }, { texto: 'Cancelar', tipo: 'fantasma', valor: null }, { texto: 'Aplicar', tipo: 'primario', valor: () => 'ok', padrao: true }],
      largura: '420px',
    });
    if (r === 'excluir') { alterar((pp) => nucleoEixos.excluirCota(pp, id), 'Excluir cota', { invalidar: false }); return; }
    if (r !== 'ok' || !(valor >= 0) || Math.abs(valor - c.dist) < 1e-9) { desenharPlanta(); return; }
    alterarEixos((pp, op, n) => n.definirDistancia(pp, c.a, c.b, valor, op), `Distância ${c.eixoA.nome}–${c.eixoB.nome}: ${num(valor, 2)} m`);
  }
  /** Menu de um nó: pilar novo, pôr um pilar ainda não posicionado, levar o elemento selecionado ao nó. */
  function menuNo(id, ev) {
    const n = nosDosEixos(estado.projeto).find((x) => x.id === id);
    if (!n) return;
    const sel = vista.sel ? estado.elemento(vista.sel) : null;
    const temPilar = doPav.some((e) => tipo(e) === 'pilar' && Math.hypot(e.posicao.x - n.p[0], e.posicao.y - n.p[1]) < 0.01);
    const soltos = naoPosicionados.filter((e) => tipo(e) === 'pilar');
    const modPilar = modulos.obter('concreto.pilar');
    abrirMenu([
      { cabecalho: `Nó ${n.nome} · (${fmt(n.p[0])}; ${fmt(n.p[1])}) m` },
      modPilar ? { rotulo: temPilar ? 'Já há um pilar neste nó' : 'Novo pilar neste nó', icone: 'pilar', desabilitado: temPilar, acao: () => criarNaPlanta(modPilar, n.p) } : null,
      ...(soltos.length && !temPilar ? soltos.slice(0, 8).map((e) => ({ rotulo: `Posicionar ${e.codigo} aqui`, icone: 'pilar', acao: () => posicionar(e, vista.pav, n.p) })) : []),
      sel ? { rotulo: `Levar ${sel.codigo} para o nó (ponto de inserção)`, icone: 'direita', acao: () => alterar((pp) => { const e = elDoProjeto(pp, sel.id); e.posicao.x = n.p[0]; e.posicao.y = n.p[1]; }, `Mover ${sel.codigo} para o nó ${n.nome}`) } : null,
      '-',
      { rotulo: 'Pilares em todos os nós sem pilar', icone: 'mais', desabilitado: !modPilar, acao: pilaresNosNos },
    ].filter(Boolean), { x: ev.clientX, y: ev.clientY });
  }
  function pilaresNosNos() {
    const modPilar = modulos.obter('concreto.pilar');
    const livres = nosDosEixos(estado.projeto).filter((n) => !doPav.some((e) => tipo(e) === 'pilar' && Math.hypot(e.posicao.x - n.p[0], e.posicao.y - n.p[1]) < 0.01));
    if (!livres.length) { notificar('Todos os nós deste pavimento já têm pilar.', 'info'); return; }
    for (const n of livres) criarNaPlanta(modPilar, n.p);
    notificar(`${livres.length} pilar(es) criado(s) nos nós dos eixos.`, 'ok');
  }

  function conectar() {
    const det = detectarLigacoes(estado.projeto, modulos);
    let n = 0;
    alterar((proj) => { n = aplicarLigacoes(proj, det); }, 'Conectar elementos', { invalidar: false });
    notificar(n ? `${n} ligação(ões) criada(s) a partir da planta.` : 'Nenhuma ligação nova: tudo o que coincide na planta já está conectado.', n ? 'ok' : 'info');
    acoes.registrarSaida?.(`Montagem: ${n} ligação(ões) criada(s) pela geometria.`);
  }

  /**
   * Com quem o elemento selecionado se liga na montagem: em quem ele apoia (quem recebe as cargas dele), o que ele
   * recebe, e as vigas apoiadas umas nas outras pela geometria (grelha). Clicar num item seleciona o outro elemento.
   */
  function secaoLigacoesDoCartao(sel) {
    const proj = estado.projeto;
    const porId = new Map(proj.elementos.map((e) => [e.id, e]));
    const nomeLig = (fonte, lig) => modulos.obter(fonte.modulo)?.ligacoes?.(fonte)?.find((l) => l.id === lig)?.nome ?? lig;
    const apoiaEm = [], recebe = [];
    for (const r of proj.elementos) {
      for (const c of Array.isArray(r.cargas) ? r.cargas : []) {
        if (c?.tipo !== 'elemento') continue;
        if (c.elementoId === sel.id && r.id !== sel.id) apoiaEm.push({ el: r, texto: `${nomeLig(sel, c.ligacao)} → ${r.codigo}${c.vao != null && c.vao !== 'todos' ? ` (vão ${Number(c.vao) + 1})` : ''}` });
        if (r.id === sel.id && porId.has(c.elementoId)) { const f = porId.get(c.elementoId); recebe.push({ el: f, texto: `${f.codigo} · ${nomeLig(f, c.ligacao)}` }); }
      }
    }
    // vigas apoiadas em vigas pela geometria (a grelha liga as duas)
    if (tipo(sel) === 'viga') {
      // só nos apoios que não caem em pilar (nem têm outra ligação)
      const ligado = (k) => proj.elementos.some((r) => (Array.isArray(r.cargas) ? r.cargas : []).some((c) => c?.tipo === 'elemento' && c.elementoId === sel.id && c.ligacao === `apoio-${k}`));
      eixoViga(sel).apoios.forEach((_, k) => { if (ligado(k)) return; const o = vigaSobApoio(proj, modulos, sel, k); if (o) apoiaEm.push({ el: o, texto: `Apoio ${k + 1} → ${o.codigo} (viga sobre viga)` }); });
      for (const o of proj.elementos) {
        if (o.id === sel.id || tipo(o) !== 'viga' || o.posicao?.pavimento !== sel.posicao.pavimento) continue;
        const ligadoO = (k) => proj.elementos.some((r) => (Array.isArray(r.cargas) ? r.cargas : []).some((c) => c?.tipo === 'elemento' && c.elementoId === o.id && c.ligacao === `apoio-${k}`));
        eixoViga(o).apoios.forEach((_, k) => { if (!ligadoO(k) && vigaSobApoio(proj, modulos, o, k)?.id === sel.id) recebe.push({ el: o, texto: `${o.codigo} · apoio ${k + 1} (viga sobre viga)` }); });
      }
    }
    const fundacao = proj.elementos.find((e) => ['concreto.sapata', 'concreto.bloco'].includes(e.modulo) && e.pilarId === sel.id);
    if (fundacao) apoiaEm.push({ el: fundacao, texto: `Base → ${fundacao.codigo} (fundação)` });
    const selecionar = (outro) => {
      if (outro.posicao?.pavimento && outro.posicao.pavimento !== vista.pav) { vista.pav = outro.posicao.pavimento; vista.enquadrar = true; }
      vista.sel = outro.id;
      if (outro.posicao) renderizarTudo(); else acoes.abrirElemento(outro.id);
    };
    const lista = (itens) => h('div', { class: 'mont-lig-lista' }, itens.map((x) => h('button', { class: 'mont-lig-item', title: x.el.posicao ? `Selecionar ${x.el.codigo} na planta` : `Abrir ${x.el.codigo}`, onClick: () => selecionar(x.el) }, x.texto)));
    return h('div', { class: 'mont-cmd mont-cmd-ligacoes' },
      h('span', { class: 'mont-cmd-rot' }, 'Ligações'),
      h('div', { class: 'mont-lig-grupos' },
        h('div', null, h('span', { class: 'mont-lig-sub' }, `Apoia em · ${apoiaEm.length}`), apoiaEm.length ? lista(apoiaEm) : h('span', { class: 'mont-lig-vazio' }, 'nada — sem apoio ligado')),
        h('div', null, h('span', { class: 'mont-lig-sub' }, `Recebe · ${recebe.length}`), recebe.length ? lista(recebe) : h('span', { class: 'mont-lig-vazio' }, 'nada'))),
    );
  }

  /** Ponto fixo, prumada e lance do pilar selecionado (etapa L10). */
  function cmdPilar(sel) {
    const pf = sel.pontoFixo ?? 'centro';
    const pr = prumada(estado.projeto, modulos, sel);
    const ord = [...pavimentosOrdenados(estado.projeto)].reverse();
    const lance = { de: pr[0]?.pavimento.id ?? sel.posicao.pavimento, ate: pr[pr.length - 1]?.pavimento.id ?? sel.posicao.pavimento };
    return h('div', { class: 'mont-cmd-pilar' },
      h('div', { class: 'mont-cmd' },
        h('span', { class: 'mont-cmd-rot', title: 'Ao mudar a seção, este ponto fica no lugar' }, 'Ponto fixo'),
        h('div', { class: 'mont-pf' }, Object.keys(PONTOS_FIXOS).map((k) => h('button', {
          class: ['mont-pf-b', pf === k && 'ativo'], title: `${NOMES_PONTO_FIXO[k]}${pf === k ? ' (atual)' : ''}`,
          onClick: () => alterar((pp) => { const e = elDoProjeto(pp, sel.id); if (k === 'centro') delete e.pontoFixo; else e.pontoFixo = k; e.posicao.secaoRef = { bx: e.bx, by: e.by }; }, `Ponto fixo de ${sel.codigo}: ${NOMES_PONTO_FIXO[k]}`, { invalidar: false }),
        }))),
      ),
      h('div', { class: 'mont-cmd' },
        h('span', { class: 'mont-cmd-rot', title: 'Pilares no mesmo prumo, do pavimento mais baixo ao mais alto' }, 'Lance'),
        h('div', { class: 'mont-lance' },
          h('span', { class: 'mont-prumada' }, pr.map((x) => `${x.pilar.codigo}`).join(' · ')),
          h('div', { class: 'mont-lance-sel' },
            ui.selecao({ rotulo: 'de', valor: lance.de, largura: '100%', opcoes: ord.map((x) => ({ valor: x.id, texto: x.nome })), aoMudar: (v) => { lance.de = v; } }),
            ui.selecao({ rotulo: 'até', valor: lance.ate, largura: '100%', opcoes: ord.map((x) => ({ valor: x.id, texto: x.nome })), aoMudar: (v) => { lance.ate = v; } }),
            h('button', { class: 'mont-cmd-btn', title: 'Cria os pilares que faltam no prumo entre os dois pavimentos e liga cada um ao de baixo', onClick: () => {
              let r;
              alterar((pp) => { r = aplicarLance(pp, modulos, elDoProjeto(pp, sel.id), lance.de, lance.ate); }, `Lance de ${sel.codigo}`, { invalidar: false });
              notificar(r.criados.length ? `${r.criados.map((e) => e.codigo).join(', ')} criado(s) no prumo de ${sel.codigo}, com ${r.ligacoes} ligação(ões).` : 'O prumo já tem pilar em todos esses pavimentos.', r.criados.length ? 'ok' : 'info');
            } }, 'Aplicar')),
        ),
      ),
    );
  }

  /* ------------------------------------------------------------ elemento selecionado: janela flutuante na planta */
  const cartaoSel = h('div', { class: 'mont-cartao' });
  function desenharCartao() {
    limpar(cartaoSel);
    const proj = estado.projeto;
    const sel = vista.sel && estado.elemento(vista.sel);
    cartaoSel.classList.toggle('visivel', !!sel?.posicao);
    if (!sel?.posicao) return;
    const t = tipo(sel);
    const m = modulos.obter(sel.modulo);
    const abertoC = aberto('cartao');
    cartaoSel.classList.toggle('recolhido', !abertoC);
    const pv = pavimento(proj, sel.posicao.pavimento);
    cartaoSel.append(
      h('div', { class: 'mont-cartao-cab clicavel', title: abertoC ? 'Recolher (fica só o título)' : 'Abrir os dados do elemento', onClick: (e) => { if (e.target.closest('button')) return; definirPrefUi('cartao', !abertoC); desenharCartao(); } },
        icone(abertoC ? 'baixo' : 'direita', { tamanho: 12 }),
        icone(m?.forma ?? m?.icone ?? 'documento', { tamanho: 16 }),
        h('strong', null, sel.codigo), h('span', null, sel.nome !== sel.codigo ? sel.nome : m?.nomeCurto ?? ''),
        h('i', { class: ['mont-ponto', estadoClasse(sel)], title: 'Situação do cálculo' }),
        ui.botaoIcone({ icone: 'direita', titulo: 'Abrir o elemento', aoClicar: () => acoes.abrirElemento(sel.id) }),
        ui.botaoIcone({ icone: 'fechar', titulo: 'Fechar (tira a seleção)', aoClicar: () => { vista.sel = null; desenharPlanta(); desenharLateral(); } })),
      ...(abertoC ? [h('div', { class: 'mont-cartao-corpo' },
        h('div', { class: 'mont-cartao-linha' }, `${m?.nome ?? sel.modulo} · ${pv?.nome ?? ''}`),
        h('div', { class: 'mont-cartao-acoes' },
          ui.botao({ texto: 'Abrir elemento', icone: 'direita', tipo: 'primario', titulo: 'Abre a página do elemento (duplo clique na planta também abre)', aoClicar: () => acoes.abrirElemento(sel.id) }),
          ui.botao({ texto: 'Ver em 3D', icone: 'cubo', tipo: 'fantasma', titulo: 'Abre o 3D com o elemento selecionado e a câmera nele', aoClicar: () => acoes.abrir3D(sel.id) })),
        // comandos de montagem: girar e mover na planta
        h('div', { class: 'mont-cmd' },
          h('span', { class: 'mont-cmd-rot' }, 'Girar'),
          h('div', { class: 'mont-cmd-grupo' },
            h('button', { class: 'mont-cmd-btn', title: 'Girar no sentido horário, em torno do centro (Shift+R)', onClick: () => girarSelecionado(-1) }, icone('girar', { tamanho: 14 }), `−${fmtGiro(passoGiro())}`),
            h('button', { class: 'mont-cmd-btn', title: 'Girar no sentido anti-horário, em torno do centro (R)', onClick: () => girarSelecionado(1) }, icone('girar', { tamanho: 14 }), `+${fmtGiro(passoGiro())}`)),
          h('div', { class: 'mont-cmd-passos', title: 'Passo do giro' }, [90, 45, 30, 15].map((g) => h('button', { class: ['mont-chip', Math.abs(passoGiro() - g) < 1e-9 && 'ativo'], onClick: () => { definirPassoGiro(g); desenharCartao(); } }, `${g}°`)),
            ui.campo({ rotulo: '', valor: passoGiro(), unidade: '°', casas: 1, min: 0.1, max: 360, largura: '78px', aoMudar: (v) => { definirPassoGiro(v); desenharCartao(); } })),
        ),
        h('div', { class: 'mont-cmd' },
          h('span', { class: 'mont-cmd-rot' }, 'Mover'),
          h('div', { class: 'mont-cmd-setas' },
            h('button', { class: 'mont-cmd-btn seta', title: 'Para a esquerda (←; Shift: 10×)', onClick: () => moverSelecionado(-1, 0) }, '←'),
            h('button', { class: 'mont-cmd-btn seta', title: 'Para cima (↑; Shift: 10×)', onClick: () => moverSelecionado(0, 1) }, '↑'),
            h('button', { class: 'mont-cmd-btn seta', title: 'Para baixo (↓; Shift: 10×)', onClick: () => moverSelecionado(0, -1) }, '↓'),
            h('button', { class: 'mont-cmd-btn seta', title: 'Para a direita (→; Shift: 10×)', onClick: () => moverSelecionado(1, 0) }, '→')),
          h('div', { class: 'mont-cmd-passos', title: 'Passo das setas' }, [0.01, 0.05, 0.1, 0.5].map((d) => h('button', { class: ['mont-chip', Math.abs(passoMover() - d) < 1e-9 && 'ativo'], onClick: () => { definirPassoMover(d); desenharCartao(); } }, d < 0.1 ? `${Math.round(d * 100)} cm` : `${String(d).replace('.', ',')} m`))),
        ),
        secaoLigacoesDoCartao(sel),
        t === 'pilar' ? cmdPilar(sel) : null,
        h('div', { class: 'mont-sel-campos tres' },
          ui.campo({ rotulo: t === 'pilar' ? 'x (centro)' : 'x', valor: sel.posicao.x, unidade: 'm', min: -1000, max: 1000, aoMudar: (v) => alterar((pp) => { elDoProjeto(pp, sel.id).posicao.x = v; }, `Mover ${sel.codigo}`) }),
          ui.campo({ rotulo: t === 'pilar' ? 'y (centro)' : 'y', valor: sel.posicao.y, unidade: 'm', min: -1000, max: 1000, aoMudar: (v) => alterar((pp) => { elDoProjeto(pp, sel.id).posicao.y = v; }, `Mover ${sel.codigo}`) }),
          ui.campo({ rotulo: 'Ângulo', valor: sel.posicao.angulo ?? 0, unidade: '°', casas: 1, min: -360, max: 360, aoMudar: (v) => alterar((pp) => { elDoProjeto(pp, sel.id).posicao.angulo = v; }, `Girar ${sel.codigo}`) }),
        ),
        ui.selecao({ rotulo: 'Pavimento', valor: sel.posicao.pavimento, largura: '100%', opcoes: [...pavimentosOrdenados(proj)].reverse().map((x) => ({ valor: x.id, texto: `${x.nome} (${fmt(x.cota)} m)` })),
          aoMudar: (v) => alterar((pp) => { const e = elDoProjeto(pp, sel.id); e.posicao.pavimento = v; const pd = peDireito(pp, v); if (t === 'pilar' && pd > 0) e.comprimento = pd; }, `Mudar ${sel.codigo} de pavimento`, { invalidar: t === 'pilar', elementoId: sel.id }) }),
        h('div', { class: 'mont-sel-acoes' },
          ui.botao({ texto: 'Retirar da planta', icone: 'fechar', tipo: 'fantasma', titulo: 'O elemento volta para "Não posicionados" (não é apagado)', aoClicar: () => { alterar((pp) => { delete elDoProjeto(pp, sel.id).posicao; }, `Retirar ${sel.codigo} da planta`); vista.sel = null; } }),
          ui.botao({ texto: 'Copiar', icone: 'copiar', tipo: 'fantasma', titulo: 'Copiar (Ctrl+C); Ctrl+V cola com o ponto de inserção no cursor', aoClicar: () => copiarSel() }),
          ui.botao({ texto: 'Duplicar', icone: 'copiar', tipo: 'fantasma', titulo: 'Duplicar ao lado (Ctrl+D)', aoClicar: () => duplicarSel() }),
          /laje\.(macica|trelicada|nervurada|alveolar)$/.test(sel.modulo) ? ui.botao({ texto: 'Converter tipo…', icone: 'laje', tipo: 'fantasma', titulo: 'Converter em outro tipo de laje: maciça, treliçada, nervurada ou alveolar', aoClicar: () => comandos.executar('elemento.converterLaje', sel.id) }) : null,
        ),
        // o resto (propriedades) fica recolhido para não ocupar a planta
        h('div', { class: 'mont-cartao-mais' },
          h('button', { class: 'mont-cartao-mais-cab', onClick: () => { definirPrefUi('cartaoMais', !aberto('cartaoMais')); desenharCartao(); } }, icone(aberto('cartaoMais') ? 'baixo' : 'direita', { tamanho: 12 }), 'Propriedades e pré-dimensionamento'),
          ...(aberto('cartaoMais') ? [
            h('div', { class: 'mont-sel-acoes' },
              tipoDeLancamento(sel, modulos) ? ui.botao({ texto: 'Conta-gotas', icone: 'copiar', tipo: 'secundario', titulo: 'Copia seção, critérios e cargas próprias para os próximos elementos do tipo', aoClicar: () => contaGotas(sel) }) : null,
              tipoDeLancamento(sel, modulos) ? ui.botao({ texto: 'Pincel', icone: 'editar', tipo: 'secundario', titulo: 'Copia as propriedades e aplica nos elementos em que clicar', aoClicar: () => contaGotas(sel, true) }) : null,
              ui.botao({ texto: 'Código…', icone: 'editar', tipo: 'secundario', aoClicar: () => comandos.executar('elemento.renomear', sel.id) })),
            (() => {
              const sg = sugestaoDe(proj, modulos, sel);
              if (!sg) return null;
              const igual = (sg.tipo === 'viga' && sel.secao?.h === sg.secao.h) || (sg.tipo === 'laje' && (!sg.h || sel.h === sg.h)) || (sg.tipo === 'pilar' && (!sg.bx || (sel.bx === sg.bx && sel.by === sg.by)));
              return h('div', { class: 'mont-sugestao' }, h('span', { class: 'rot' }, 'Pré-dimensionamento'), h('p', null, sg.texto),
                igual ? h('span', { class: 'mont-sugestao-ok' }, icone('check', { tamanho: 12 }), 'A seção atual já segue a regra.')
                  : ui.botao({ texto: 'Aplicar sugestão', icone: 'check', tipo: 'secundario', aoClicar: () => alterar((pp) => aplicarSugestao(elDoProjeto(pp, sel.id), sg), `Pré-dimensionar ${sel.codigo}`, { invalidar: true, elementoId: sel.id }) }));
            })(),
            h('p', { class: 'mont-dica' }, t === 'laje' ? 'Laje: (x, y) é o canto inferior esquerdo; lx segue o ângulo.'
              : t === 'viga' ? 'Viga: (x, y) é o apoio 1; o eixo segue o ângulo com o comprimento total dos vãos.'
                : 'Pilar: chega à cota do pavimento vindo do nível de baixo; bx segue o ângulo.'),
          ] : []),
        ),
      )] : []),
    );
  }

  /* ------------------------------------------------------------ lateral */
  const lateral = h('aside', { class: 'mont-lateral' });
  function desenharLateral() {
    limpar(lateral);
    const proj = estado.projeto;
    // eixo selecionado: cartão no topo da lateral
    if (vista.selEixo) {
      const cartao = cartaoEixo({
        projeto: proj, id: vista.selEixo, alterarEixos,
        duplicar: (lado) => duplicarEixoSel(lado), excluir: excluirEixoSel, copiar: () => copiarSel(),
        fechar: () => { vista.selEixo = null; desenharPlanta(); desenharLateral(); },
      });
      if (cartao) lateral.append(cartao); else vista.selEixo = null;
    }
    // pavimentos (de cima para baixo, como num corte)
    const lista = h('div', { class: 'mont-pavs' });
    for (const pv of [...pavimentosOrdenados(proj)].reverse()) {
      const n = proj.elementos.filter((e) => e.posicao?.pavimento === pv.id).length;
      lista.append(h('div', { class: ['mont-pav', pv.id === vista.pav && 'ativo'], onClick: (e) => { if (e.target.closest('input, button')) return; vista.pav = pv.id; vista.enquadrar = true; vista.sel = null; vista.marca = null; renderizarTudo(); } },
        h('div', { class: 'mont-pav-cab' },
          h('input', { class: 'mont-pav-nome', value: pv.nome, spellcheck: false, onChange: (e) => { const v = e.target.value.trim(); if (v) alterar((pp) => { pavimento(pp, pv.id).nome = v; }, 'Renomear pavimento'); } }),
          h('span', { class: 'mont-pav-n', title: 'Elementos posicionados' }, String(n)),
          ui.botaoIcone({ icone: 'copiar', titulo: 'Copiar o pavimento: total ou só pilares, vigas ou lajes, para um pavimento novo ou existente', aoClicar: () => duplicarPavimento(pv) }),
          ui.botaoIcone({ icone: 'lixeira', titulo: 'Excluir pavimento', aoClicar: () => excluirPavimento(pv) }),
        ),
        h('div', { class: 'mont-pav-dados' },
          ui.campo({ rotulo: 'Cota', valor: pv.cota, unidade: 'm', largura: '110px', min: -50, max: 500, aoMudar: (v) => alterar((pp) => { pavimento(pp, pv.id).cota = v; }, 'Cota do pavimento') }),
          h('span', { class: 'mont-pav-pd' }, `pé-direito ${fmt(peDireito(proj, pv.id))} m`),
        ),
        // pavimento tipo (etapa L9): um modelo, n níveis
        h('div', { class: 'mont-pav-tipo' },
          ui.campo({ rotulo: 'Repetições', valor: repeticoesDe(pv), unidade: '×', casas: 0, min: 1, max: 200, largura: '96px',
            dica: 'Pavimento tipo: o mesmo modelo vale para este número de níveis seguidos, separados pelo pé-direito. Os pavimentos de cima sobem junto.',
            aoMudar: (v) => alterar((pp) => definirRepeticoes(pp, pv.id, v), `Repetições de ${pv.nome}: ${v}`, { invalidar: false }) }),
          repeticoesDe(pv) > 1 ? h('span', { class: 'mont-pav-pd' }, `tipo × ${repeticoesDe(pv)} · último nível ${fmt(cotaTopo(proj, pv.id))} m`) : null,
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
        // carga padrão das lajes novas do pavimento (etapa L13)
        h('div', { class: 'mont-pav-carga' }, ui.selecao({
          rotulo: 'Uso das lajes novas', valor: pv.cargaPadrao?.uso ?? '', largura: '100%',
          opcoes: [{ valor: '', texto: 'Padrão de cada laje' }, ...CARGAS_USO.map((u) => ({ valor: u.id, texto: `${rotuloUso(u)} (${String(u.q).replace('.', ',')} kN/m²)` }))],
          aoMudar: (v) => alterar((pp) => { const x = pavimento(pp, pv.id); if (v) x.cargaPadrao = { ...(x.cargaPadrao ?? {}), uso: v }; else delete x.cargaPadrao; }, 'Carga padrão do pavimento', { invalidar: false }),
        }), pv.cargaPadrao?.uso ? h('button', { class: 'link', title: 'Aplica o uso às lajes que já estão neste pavimento (cada laje pode mudar depois)', onClick: () => alterar((pp) => {
          for (const e of pp.elementos) if (e.posicao?.pavimento === pv.id && tipo(e) === 'laje' && aplicarCargaPadrao(pp, e) && e.resultado) e.resultado.desatualizado = true;
        }, `Carga padrão nas lajes de ${pv.nome}`, { invalidar: false }) }, 'Aplicar às lajes existentes') : null),
      ));
    }
    lateral.append(
      h('div', { class: 'mont-bloco' },
        h('div', { class: 'mont-bloco-cab' }, h('span', null, 'Pavimentos'), ui.botao({ texto: 'Pavimento', icone: 'mais', tipo: 'fantasma', aoClicar: novoPavimento })),
        lista),
    );

    // eixos de projeto: famílias de paralelos e distâncias
    const pilsPav = proj.elementos.filter((e) => e.posicao?.pavimento === vista.pav && tipo(e) === 'pilar');
    lateral.append(blocoEixos({
      projeto: proj, sel: vista.selEixo, alterarEixos, novoEixo, modo: vista.modo, alternarModo: (m) => modoLancamento(m),
      selecionar: (id) => { vista.selEixo = id; vista.sel = null; desenharPlanta(); desenharLateral(); },
      eixosDosPilares: pilsPav.length ? () => alterar((pp) => { nucleoEixos.eixosPelosPontos(pp, pilsPav.map((e) => [e.posicao.x, e.posicao.y])); }, 'Eixos pelos pilares', { invalidar: false }) : null,
      pilaresNosNos: modulos.obter('concreto.pilar') ? pilaresNosNos : null,
      redesenhar: () => { desenharPlanta(); desenharLateral(); },
      alternarVisiveis: alternarEixosVisiveis, moverTodos: moverTodosEixos,
    }));

    // planta de fundo (DXF) e malha
    lateral.append(blocoFundo({
      projeto: proj, pav: pavimento(proj, vista.pav),
      alterar: (fn, descricao) => alterar((pp) => fn(pp, pavimento(pp, vista.pav)), descricao),
      importar: importarFundo,
      paredes: () => paredesComoCargas(),
      mover: vista.moverFundo, alternarMover: (v) => { vista.moverFundo = v; desenharLateral(); },
      redesenhar: () => { desenharPlanta(); desenharLateral(); },
    }));

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

    desenharCartao();

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

  /** Importa uma planta de arquitetura (DXF) como fundo do pavimento atual. */
  async function importarFundo() {
    let arq = null;
    if (globalThis.lebr?.dxf?.abrir) {
      try { arq = await globalThis.lebr.dxf.abrir(estado.caminho); } catch (err) { notificar(`Não foi possível ler o arquivo: ${err.message}`, 'erro'); return; }
    } else { notificar('Importar DXF só funciona no aplicativo instalado.', 'erro'); return; }
    if (!arq) return;
    aplicarDxf(arq.texto, arq.nome);
  }
  function aplicarDxf(texto, nome) {
    let r;
    try { r = plantaDoDxf(texto, nome); } catch (err) { notificar(`${nome}: ${err.message}`, 'erro', { duracao: 8000 }); return; }
    alterar((pp) => {
      const pv = pavimento(pp, vista.pav);
      const antiga = pv.fundo?.planta;
      pp.plantasFundo = [...(pp.plantasFundo ?? []), r.planta];
      pv.fundo = fundoInicial(r.planta);
      // a planta trocada sai do arquivo se nenhum outro pavimento a usa
      if (antiga && !pp.pavimentos.some((q) => q.fundo?.planta === antiga)) pp.plantasFundo = pp.plantasFundo.filter((x) => x.id !== antiga);
    }, `Planta de fundo: ${nome}`);
    vista.enquadrar = true;
    const ign = Object.entries(r.resumo.ignoradas).map(([k, n]) => `${n} ${k}`).join(', ');
    notificar(`${nome}: ${r.resumo.entidades} linhas e ${r.resumo.textos} textos em ${r.resumo.camadas} camadas · unidade ${r.resumo.unidade}${r.resumo.unidadeLida ? '' : ' (pela extensão do desenho — confira)'}${ign ? ` · ignorados: ${ign}` : ''}${r.resumo.cortado ? ' · desenho grande demais: parte ficou de fora' : ''}.`, 'ok', { duracao: 9000 });
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
  /** Copiar o pavimento (etapa L9): para um pavimento novo no topo ou para um existente, só os tipos escolhidos. */
  async function duplicarPavimento(pv) {
    const proj = estado.projeto;
    const origemTodos = proj.elementos.filter((e) => e.posicao?.pavimento === pv.id);
    if (!origemTodos.length) return notificar('O pavimento não tem elementos para copiar.');
    const conta = (t) => origemTodos.filter(filtroDeCopia(modulos, [t])).length;
    const op = { tipos: new Set(['pilar', 'viga', 'laje', 'outros'].filter((t) => conta(t))), destino: '' };
    const outros = [...pavimentosOrdenados(proj)].reverse().filter((x) => x.id !== pv.id);
    const NOMES = { pilar: 'Pilares', viga: 'Vigas', laje: 'Lajes', outros: 'Escadas, reservatórios e outros' };
    const ok = await dialogo({
      rotulo: 'Montagem', titulo: `Copiar ${pv.nome}`, largura: '520px',
      texto: 'Cópia total ou seletiva. As ligações entre os elementos copiados vêm junto; as com outros pavimentos, não (use Conectar automaticamente depois).',
      corpo: () => [
        h('div', { class: 'predim-lista' }, ['pilar', 'viga', 'laje', 'outros'].filter((t) => conta(t)).map((t) => h('label', { class: 'dialogo-check' },
          h('input', { type: 'checkbox', checked: true, onChange: (e) => { if (e.target.checked) op.tipos.add(t); else op.tipos.delete(t); } }), `${NOMES[t]} (${conta(t)})`))),
        ui.selecao({ rotulo: 'Para', valor: '', largura: '100%', opcoes: [{ valor: '', texto: 'Um pavimento novo, acima do último' }, ...outros.map((x) => ({ valor: x.id, texto: `${x.nome} (${fmt(x.cota)} m)` }))], aoMudar: (v) => { op.destino = v; } }),
      ],
      botoes: [{ texto: 'Cancelar', tipo: 'fantasma', valor: false }, { texto: 'Copiar', tipo: 'primario', valor: true, padrao: true }],
    });
    if (!ok || !op.tipos.size) return;
    const origem = origemTodos.filter(filtroDeCopia(modulos, [...op.tipos]));
    const ord = pavimentosOrdenados(proj);
    const topo = ord[ord.length - 1];
    const pd = peDireito(proj, pv.id) || 2.8;
    const novo = op.destino ? null : { id: novoIdPavimento(), nome: `${ord.length + 1}º pavimento`, cota: Math.round(((cotaTopo(proj, topo.id) ?? topo.cota) + pd) * 100) / 100 };
    const destinoId = op.destino || novo.id;
    let criados = 0;
    vista.pav = destinoId; vista.sel = null; vista.enquadrar = true;
    alterar((pp) => {
      if (novo) pp.pavimentos.push(novo);
      const mapa = new Map();
      const copias = origem.map((o) => {
        const c = structuredClone(o);
        const prefixo = o.codigo.replace(/\d+$/, '');
        c.id = novoId(prefixo.toLowerCase() || 'el');
        c.codigo = proximoCodigo(pp, prefixo);
        c.nome = o.nome === o.codigo ? c.codigo : o.nome;
        c.posicao = { ...o.posicao, pavimento: destinoId };
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
    }, `Copiar ${pv.nome}`);
    const destNome = novo ? novo.nome : pavimento(estado.projeto, destinoId)?.nome;
    notificar(`${criados} elemento(s) copiado(s) para ${destNome}. Use “Conectar automaticamente” para ligar ao nível de baixo.`, 'ok', { duracao: 6000 });
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

  /** Move o elemento selecionado com as setas: passo escolhido no cartão (Shift: dez vezes). */
  function moverSelecionado(sx, sy, fator = 1) {
    const sel = vista.sel && estado.elemento(vista.sel);
    if (!sel?.posicao) return false;
    const d = passoMover() * fator;
    alterar((pp) => { const e = elDoProjeto(pp, sel.id); e.posicao.x = Math.round(((e.posicao.x ?? 0) + sx * d) * 1e4) / 1e4; e.posicao.y = Math.round(((e.posicao.y ?? 0) + sy * d) * 1e4) / 1e4; }, `Mover ${sel.codigo}`);
    return true;
  }

  /** Gira o elemento selecionado de ±passo em torno do próprio centro (atalhos R e Shift+R). */
  function girarSelecionado(sentido) {
    const sel = vista.sel && estado.elemento(vista.sel);
    if (!sel?.posicao) return false;
    const passo = passoGiro() * sentido;
    alterar((pp) => girarElemento(elDoProjeto(pp, sel.id), tipo(sel), passo), `Girar ${sel.codigo} ${fmtGiro(passo)}`);
    return true;
  }

  /** Pré-dimensionamento do pavimento (etapa L8): mostra as mudanças sugeridas e aplica as escolhidas. */
  async function predimensionarPavimento() {
    const proj = estado.projeto;
    const lista = doPav.map((e) => ({ e, s: sugestaoDe(proj, modulos, e) })).filter(({ e, s }) => s && aplicarSugestao(structuredClone(e), s));
    if (!lista.length) return notificar('As seções deste pavimento já seguem as regras de pré-dimensionamento.', 'info');
    const marcados = new Set(lista.map((x) => x.e.id));
    const atual = (e) => (tipo(e) === 'viga' ? `${e.secao?.b} × ${e.secao?.h}` : tipo(e) === 'pilar' ? `${e.bx} × ${e.by}` : `h = ${e.h}`);
    const novo = (s) => (s.tipo === 'viga' ? `${s.secao.b} × ${s.secao.h}` : s.tipo === 'pilar' ? `${s.bx} × ${s.by}` : `h = ${s.h}`);
    const ok = await dialogo({
      rotulo: 'Pré-dimensionamento', titulo: `${lista.length} elemento(s) com sugestão`, largura: '640px',
      texto: 'Regras práticas para o primeiro palpite, antes do cálculo: vigas h = L/10 (um vão), L/12 (contínua) ou L/5 (balanço); lajes maciças máx(Lx/40, 8 cm); pilares pela área de influência (Nk = q·Ai·n; γ = 1,8, 2,2 ou 2,5). O cálculo continua sendo a verificação.',
      corpo: () => [h('div', { class: 'predim-lista' }, lista.map(({ e, s }) => h('label', { class: 'predim-item', title: s.texto },
        h('input', { type: 'checkbox', checked: true, onChange: (ev) => { if (ev.target.checked) marcados.add(e.id); else marcados.delete(e.id); } }),
        h('strong', null, e.codigo), h('span', null, `${atual(e)} → ${novo(s)} cm`), h('em', null, s.texto))))],
      botoes: [{ texto: 'Cancelar', tipo: 'fantasma', valor: false }, { texto: 'Aplicar as marcadas', tipo: 'primario', valor: true, padrao: true }],
    });
    if (!ok || !marcados.size) return;
    let n = 0;
    alterar((pp) => { for (const { e, s } of lista) if (marcados.has(e.id) && aplicarSugestao(elDoProjeto(pp, e.id), s)) n++; }, `Pré-dimensionar ${pavimento(proj, vista.pav)?.nome ?? ''}`, { invalidar: false });
    notificar(`${n} elemento(s) pré-dimensionado(s). Calcule para verificar.`, 'ok');
  }

  /**
   * Paredes da arquitetura como cargas (etapa L12): escolhe a camada, revisa a lista e aplica.
   * `fonte` = { titulo, camadas: [{nome, paredes}], paredesDe(camada) } — o DXF de fundo ou outra origem (IFC).
   */
  async function paredesComoCargas(fonte = fonteDxf()) {
    if (!fonte) return notificar('Importe a planta de arquitetura (DXF) ou um modelo IFC deste pavimento para lançar as paredes como cargas.', 'info');
    if (!fonte.camadas.length) return notificar('Nenhuma camada do desenho tem pares de linhas paralelas de 9 a 25 cm.', 'info');
    const proj = estado.projeto, pav = vista.pav;
    const op = { camada: fonte.camadas[0].nome, material: 'ceramico-vedacao', revestimento: 2, desenho: 'acabada', aberturas: 0, alturas: {}, ignorar: [] };
    let paredes = fonte.paredesDe(op.camada), plano = null;
    const caixa = h('div', { class: 'paredes-dlg' });
    const SVG_NS = 'http://www.w3.org/2000/svg';
    const desenhar = () => {
      plano = planoDeParedes(proj, modulos, pav, paredes, op);
      limpar(caixa);
      const novaCamada = (v) => { op.camada = v; op.alturas = {}; op.ignorar = []; paredes = fonte.paredesDe(v); desenhar(); };
      caixa.append(
        h('div', { class: 'paredes-opcoes' },
          fonte.camadas.length > 1 ? ui.selecao({ rotulo: 'Camada das paredes', valor: op.camada, largura: '220px', opcoes: fonte.camadas.map((c) => ({ valor: c.nome, texto: `${c.nome} (${c.paredes})` })), aoMudar: novaCamada }) : null,
          ui.selecao({ rotulo: 'Alvenaria (NBR 6120, Tabela 2)', valor: op.material, largura: '260px', opcoes: MATERIAIS_PAREDE.map((m) => ({ valor: m.id, texto: m.nome })), aoMudar: (v) => { op.material = v; desenhar(); } }),
          ui.selecao({ rotulo: 'Revestimento', valor: String(op.revestimento), largura: '120px', opcoes: [0, 1, 2].map((v) => ({ valor: String(v), texto: `${v} cm/face` })), aoMudar: (v) => { op.revestimento = Number(v); desenhar(); } }),
          ui.selecao({ rotulo: 'Espessura desenhada', valor: op.desenho, largura: '210px', opcoes: [{ valor: 'acabada', texto: 'Parede acabada (com reboco)' }, { valor: 'bloco', texto: 'Só o bloco' }], aoMudar: (v) => { op.desenho = v; desenhar(); } }),
          ui.campo({ rotulo: 'Aberturas', valor: op.aberturas, unidade: '%', casas: 0, min: 0, max: 90, largura: '100px', aoMudar: (v) => { op.aberturas = v; desenhar(); } })),
        h('p', { class: 'paredes-resumo' },
          `${plano.resumo.paredes} parede(s), ${fmt(plano.resumo.comprimento)} m · ${plano.resumo.cargasViga} carga(s) em vigas`,
          plano.lajes.length ? ` · ${plano.lajes.length} laje(s) com parede sem viga embaixo` : '',
          plano.resumo.semApoio ? h('b', { class: 'paredes-sem' }, ` · ${plano.resumo.semApoio} sem viga nem laje (não entram)`) : '',
          ` · pé-direito do lance ${fmt(plano.peDireito)} m`),
        miniatura(),
        h('div', { class: 'paredes-lista' },
          h('div', { class: 'paredes-item cab' }, h('span'), h('span', null, 'Parede'), h('span', null, 'Desenho → bloco'), h('span', null, 'Altura'), h('span', null, 'kN/m'), h('span', null, 'Vai para')),
          plano.paredes.map((w) => h('label', { class: ['paredes-item', w.ignorada && 'ignorada', !w.trechos.length && 'sem'] },
            h('input', { type: 'checkbox', checked: !w.ignorada, onChange: (e) => { const ig = new Set(op.ignorar); if (e.target.checked) ig.delete(w.indice); else ig.add(w.indice); op.ignorar = [...ig]; desenhar(); } }),
            h('strong', null, `${w.indice + 1} · ${fmt(w.parede.comprimento)} m`),
            h('span', null, `${num(w.parede.espessura * 100, 1)} → ${num(w.bloco, 1)} cm`),
            h('input', { type: 'number', class: 'paredes-alt', step: '0.01', min: '0', value: w.altura, title: 'Altura da parede (m): pé-direito do lance − altura da viga (ou da laje)', onChange: (e) => { const v = Number(String(e.target.value).replace(',', '.')); if (Number.isFinite(v) && v >= 0) op.alturas[w.indice] = v; else delete op.alturas[w.indice]; desenhar(); } }),
            h('span', { class: 'num' }, fmt(w.gPorMetro)),
            h('em', null, w.trechos.length ? w.trechos.map((t) => (t.destino === 'viga'
              ? `${t.codigo} vão ${t.vao + 1}${t.carga.tipo === 'concentrada' ? ` (${fmt(t.comprimento)} m → ${fmt(t.carga.valor)} kN)` : ''}`
              : `${t.codigo} (laje)`)).join(' · ') + (w.semApoio > 0.1 ? ` · ${fmt(w.semApoio)} m sem apoio` : '') : 'sem viga nem laje embaixo')))),
        plano.lajes.length ? h('p', { class: 'paredes-nota' }, `Lajes: ${plano.lajes.map((l) => `${l.codigo} ${fmt(l.peso)} kN ÷ ${fmt(l.area)} m² = ${fmt(l.valor)} kN/m²`).join(' · ')}. Peso ÷ área é a prática usual em laje armada em duas direções; em uma direção, confira a faixa de distribuição.`) : null,
        h('p', { class: 'paredes-nota' }, 'Parede que cobre ao menos metade do vão: carga de parede no vão inteiro. Trecho menor: concentrada com o peso do trecho, no centro dele. Aplicar de novo troca as cargas de parede deste pavimento.'),
      );
    };
    // planta pequena: vigas e lajes do pavimento, paredes coloridas pelo destino
    function miniatura() {
      const els = proj.elementos.filter((e) => e.posicao?.pavimento === pav);
      const pts = [...paredes.flatMap((w) => [w.a, w.b]), ...els.filter((e) => tipo(e) === 'viga').flatMap((v) => { const x = eixoViga(v); return [x.a, x.b]; })];
      if (!pts.length) return null;
      const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
      const x0 = Math.min(...xs) - 0.5, x1 = Math.max(...xs) + 0.5, y0 = Math.min(...ys) - 0.5, y1 = Math.max(...ys) + 0.5;
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('class', 'paredes-mini');
      svg.setAttribute('viewBox', `${x0} ${-y1} ${x1 - x0} ${y1 - y0}`);
      const linha = (a, b, cls, w) => { const l = document.createElementNS(SVG_NS, 'line'); l.setAttribute('x1', a[0]); l.setAttribute('y1', -a[1]); l.setAttribute('x2', b[0]); l.setAttribute('y2', -b[1]); l.setAttribute('class', cls); l.setAttribute('stroke-width', w); svg.append(l); };
      for (const l of els.filter((e) => tipo(e) === 'laje')) { const pg = document.createElementNS(SVG_NS, 'polygon'); pg.setAttribute('points', cantosLaje(l).map(([x, y]) => `${x},${-y}`).join(' ')); pg.setAttribute('class', 'mini-laje'); svg.append(pg); }
      for (const v of els.filter((e) => tipo(e) === 'viga')) { const x = eixoViga(v); linha(x.a, x.b, 'mini-viga', secaoViga(v).b / 100); }
      for (const w of plano.paredes) linha(w.parede.a, w.parede.b, w.ignorada ? 'mini-par ignorada' : !w.trechos.length ? 'mini-par sem' : w.trechos.every((t) => t.destino === 'viga') ? 'mini-par viga' : 'mini-par laje', Math.max(w.parede.espessura, 0.08));
      return svg;
    }
    desenhar();
    const ok = await dialogo({
      rotulo: fonte.titulo, titulo: 'Paredes como cargas', largura: '860px',
      texto: 'Pares de linhas paralelas de 9 a 25 cm viram paredes. Cada uma carrega as vigas paralelas que estão embaixo dela; o que não está sobre viga vai para a laje. Altura = pé-direito do lance − altura da viga (ou da laje). Revise antes de aplicar.',
      corpo: () => [caixa],
      botoes: [{ texto: 'Cancelar', tipo: 'fantasma', valor: false }, { texto: 'Aplicar as cargas', tipo: 'primario', valor: true, padrao: true }],
    });
    if (!ok) return;
    let n = 0;
    alterar((pp) => { n = aplicarParedes(pp, pav, plano); }, `Paredes como cargas · ${pavimento(proj, pav)?.nome ?? ''}`, { invalidar: true });
    notificar(n ? `${n} carga(s) de parede lançada(s). Calcule para atualizar os resultados.` : 'Nenhuma carga lançada: nenhuma parede ficou sobre viga ou laje.', n ? 'ok' : 'info');
  }

  /** Fonte das paredes: o DXF de fundo do pavimento, em metros. */
  function fonteDxf() {
    const proj = estado.projeto, pv = pavimento(proj, vista.pav), planta = plantaDe(proj, pv);
    if (!planta) return null;
    const { aplicar } = transformacaoFundo(pv, planta);
    return { titulo: `Planta ${planta.nome}`, camadas: camadasProvaveis(planta, aplicar), paredesDe: (c) => paredesDeSegmentos(segmentosDoFundo(planta, aplicar, [c])) };
  }

  /** Corrige uma folga só: Limpar geometria com a tolerância daquela folga, restrita àquele apoio. */
  function encostar(f) {
    let feitas = [];
    alterar((pp) => {
      feitas = limparGeometria(pp, modulos, { tol: f.distancia + 1e-6, filtro: (el, k) => el.id === f.elemento.id && k === f.apoio });
      for (const c of feitas) if (c.elemento.resultado) c.elemento.resultado.desatualizado = true;
    }, `Encostar ${f.elemento.codigo}`, { elementoId: f.elemento.id });
    if (!feitas.length) notificar('Não foi possível encostar ao longo do eixo — arraste o elemento até o apoio.', 'info');
  }

  /* ------------------------------------------------------------ ligações e avisos */
  const rodape = h('div', { class: 'mont-rodape' });
  function desenharRodape() {
    limpar(rodape);
    // janela de ligações escondida pelo botão da barra
    rodape.hidden = !aberto('ligacoes');
    if (rodape.hidden) return;
    const abertoRodape = aberto('rodape');
    rodape.classList.toggle('recolhido', !abertoRodape);
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
    const probs = problemasDoProjeto().filter((x) => x.pavimento === vista.pav);
    const nErros = probs.filter((x) => x.gravidade === 'erro').length;
    rodape.append(...[
      h('div', { class: 'mont-rodape-cab clicavel', title: abertoRodape ? 'Recolher a lista de ligações' : 'Mostrar a lista de ligações', onClick: (e) => { if (e.target.closest('button')) return; definirPrefUi('rodape', !abertoRodape); desenharRodape(); } },
        icone(abertoRodape ? 'baixo' : 'direita', { tamanho: 12 }),
        h('span', null, `Ligações · ${existentes.length}`), sugeridas.length ? h('span', { class: 'mont-sug' }, `${sugeridas.length} sugerida(s)`) : null,
        avisos.length && !abertoRodape ? h('span', { class: 'mont-sug' }, `${avisos.length} aviso(s)`) : null,
        h('span', { style: { flex: '1' } }),
        sugeridas.length ? ui.botao({ texto: 'Conectar sugeridas', icone: 'check', tipo: 'secundario', aoClicar: conectar }) : null,
        ui.botaoIcone({ icone: 'fechar', titulo: 'Esconder a janela de ligações (volta pelo botão da barra)', aoClicar: () => { definirPrefUi('ligacoes', false); desenharRodape(); renderizarTudo(); } })),
      probs.length ? h('div', { class: ['mont-problemas', nErros && 'erro'] }, icone('alerta', { tamanho: 13 }),
        h('span', null, nErros ? `${nErros} erro(s) de montagem neste pavimento${(estado.projeto.parametros.montagem?.erros ?? 'perguntar') === 'bloquear' ? ' bloqueiam o cálculo' : ''}${probs.length > nErros ? ` · ${probs.length - nErros} aviso(s)` : ''}.` : `${probs.length} aviso(s) neste pavimento.`),
        corrigiveis(probs) ? h('button', { class: 'botao-resolver', title: 'Corrige o que não depende de decisão do engenheiro (Ctrl+Z desfaz)', onClick: () => comandos.executar('estrutura.resolverProblemas') }, icone('check', { tamanho: 12, traco: 2 }), 'Resolver') : null,
        h('button', { class: 'link', onClick: () => comandos.executar('exibir.problemasMontagem') }, 'Ver os problemas')) : null,
      (() => {
        const indef = cruzamentosDoPavimento(proj, modulos, vista.pav).filter((c) => !c.valor).length;
        return indef ? h('div', { class: 'mont-problemas erro' }, icone('alerta', { tamanho: 13 }),
          h('span', null, `${indef} cruzamento(s) de vigas sem definição — clique no "?" da planta para escolher quem apoia em quem.`),
          h('button', { class: 'link', title: 'A viga mais rígida (b·h³/L³) fica como apoio da outra', onClick: () => alterar((pp) => definirTodosCruzamentos(pp, modulos, vista.pav), 'Definir todos os cruzamentos') }, 'Definir todos')) : null;
      })(),
      !abertoRodape ? null : linhas.length ? h('div', { class: 'mont-ligs' }, linhas) : h('p', { class: 'mont-dica' }, 'Encoste as bordas das lajes nos eixos das vigas e os apoios das vigas nos pilares para que as ligações apareçam aqui.'),
      ...(abertoRodape ? avisos : []).map((a) => h('div', { class: 'mont-aviso' }, icone('alerta', { tamanho: 13 }), h('span', null, a.texto),
        a.folga?.encostar ? h('button', { class: 'link', title: 'Leva este apoio até o elemento ao lado (Limpar geometria só neste ponto)', onClick: () => encostar(a.folga) }, 'Encostar') : null,
        a.ajustarComprimento ? h('button', { class: 'link', onClick: () => alterar((pp) => { elDoProjeto(pp, a.elemento.id).comprimento = a.ajustarComprimento; }, `Ajustar ${a.elemento.codigo}`, { invalidar: true, elementoId: a.elemento.id }) }, `Usar ${fmt(a.ajustarComprimento)} m`) : null)),
    ].filter(Boolean));
  }

  /* ------------------------------------------------------------ montagem da tela */
  const pavAtual = pavimento(p, vista.pav);
  // ações de menos uso: na barra em telas largas; no menu "…" em telas estreitas
  const extras = [
    ...(areaTransf.item ? [{ icone: 'copiar', rotulo: `Colar ${areaTransf.item.tipo === 'eixo' ? `eixo ${areaTransf.item.nome}` : areaTransf.item.el.codigo} (Ctrl+V)`, titulo: 'Colar o que foi copiado', acao: () => colarItem(areaTransf.item, { noCursor: false }) }] : []),
    { icone: 'juntar', rotulo: 'Limpar geometria', titulo: 'Limpar geometria: funde nós próximos e encosta apoios na face dos pilares', acao: () => comandos.executar('estrutura.limparGeometria') },
    { icone: 'quantitativos', rotulo: 'Pré-dimensionar o pavimento', titulo: 'Pré-dimensionar o pavimento: sugere h das vigas e lajes pelo vão e a seção dos pilares pela área de influência', acao: () => predimensionarPavimento() },
    { icone: 'carga', rotulo: 'Paredes da planta de fundo como cargas', titulo: 'Paredes da planta de fundo como cargas nas vigas e lajes deste pavimento (revisão antes de aplicar)', acao: () => paredesComoCargas() },
    { icone: 'editar', rotulo: 'Renumerar o pavimento', titulo: 'Renumerar pilares, vigas e lajes deste pavimento (de cima para baixo, da esquerda para a direita)', acao: () => comandos.executar('estrutura.renumerar', vista.pav) },
    { icone: 'sapata', rotulo: 'Criar sapatas nos pilares', titulo: 'Criar sapatas nos pilares da fundação', acao: () => comandos.executar('estrutura.sapatas') },
    { icone: 'bloco', rotulo: 'Criar blocos sobre estacas', titulo: 'Criar blocos sobre estacas nos pilares da fundação', acao: () => comandos.executar('estrutura.blocos') },
    { icone: 'viga', rotulo: 'Criar nível de baldrame', titulo: 'Criar nível de baldrame (arranques e vigas baldrame)', acao: () => comandos.executar('estrutura.baldrame') },
  ];
  const txt = (b) => { b.classList.add('mont-btn-txt'); return b; };
  const barra = h('div', { class: 'mont-barra' },
    ui.botaoIcone({ icone: 'lateral', titulo: 'Mostrar ou ocultar o painel dos pavimentos e do elemento', classe: 'mont-alterna-lateral', aoClicar: () => alternarLateral() }),
    h('button', { class: 'mont-titulo', title: 'Trocar de pavimento (Page Up / Page Down)', onClick: (e) => menuPavimentos(e.currentTarget) },
      h('span', { class: 'rot' }, 'Pavimento'), h('strong', null, pavAtual?.nome ?? '—'), h('span', { class: 'mont-cota' }, `cota ${fmt(pavAtual?.cota ?? 0)} m`), icone('baixo', { tamanho: 12 })),
    h('span', { style: { flex: '1' } }),
    txt(ui.botao({ texto: 'Adicionar', icone: 'mais', tipo: 'secundario', titulo: 'Adicionar um elemento novo na planta', aoClicar: (e) => adicionar(e.currentTarget) })),
    txt(ui.botao({ texto: 'Viga em cadeia', icone: 'viga', tipo: vista.modo === 'cadeia' ? 'primario' : 'secundario', titulo: 'Lançar vigas clicando de pilar em pilar (V)', aoClicar: () => modoLancamento('cadeia') })),
    txt(ui.botao({ texto: 'Laje no contorno', icone: 'laje', tipo: vista.modo === 'laje' ? 'primario' : 'secundario', titulo: 'Lançar lajes clicando dentro das regiões fechadas pelas vigas (L)', aoClicar: () => modoLancamento('laje') })),
    txt(ui.botao({ texto: 'Eixo', icone: 'eixo', tipo: vista.modo === 'eixo' ? 'primario' : 'secundario', titulo: 'Desenhar um eixo por dois pontos (E) · Cota entre eixos: C', aoClicar: () => modoLancamento('eixo') })),
    ui.botaoIcone({ icone: eixosVisiveis() ? 'olho' : 'olhoFechado', titulo: eixosVisiveis() ? 'Ocultar os eixos (Shift+E)' : 'Mostrar os eixos (Shift+E)', classe: eixosVisiveis() ? 'mont-eixos-ver' : 'mont-eixos-ver oculto', aoClicar: alternarEixosVisiveis }),
    txt(ui.botao({ texto: 'Conectar automaticamente', icone: 'check', tipo: 'secundario', titulo: 'Conectar automaticamente: aplica as ligações que a planta indica', aoClicar: conectar })),
    ...extras.map((x) => ui.botaoIcone({ icone: x.icone, titulo: x.titulo, classe: 'mont-extra', aoClicar: x.acao })),
    ui.botaoIcone({ icone: 'reticencias', titulo: 'Mais ações', classe: 'mont-mais', aoClicar: (e) => abrirMenu(extras.map((x) => ({ rotulo: x.rotulo, icone: x.icone, acao: x.acao })), { ancora: e.currentTarget }) }),
    ui.botaoIcone({ icone: 'busca', titulo: 'Enquadrar o pavimento', aoClicar: () => { vista.enquadrar = true; desenharPlanta(); } }),
    ui.botaoIcone({ icone: 'camadas', titulo: 'Mostrar ou esconder a janela de ligações e avisos', classe: ['mont-alterna-ligacoes', !aberto('ligacoes') && 'desligado'].filter(Boolean).join(' '), aoClicar: () => { definirPrefUi('ligacoes', !aberto('ligacoes')); renderizarTudo(); } }),
    ui.botaoIcone({ icone: 'painel', titulo: 'Ampliar a área de trabalho: esconde o explorador e o painel inferior; de novo, devolve (Ctrl+Shift+F)', aoClicar: () => comandos.executar('exibir.focoPlanta') }),
    txt(ui.botao({ texto: 'Ver em 3D', icone: 'cubo', tipo: 'primario', titulo: 'Ver em 3D', aoClicar: () => acoes.abrir3D() })),
  );

  /** Painel lateral: em telas largas, coluna que some e volta; em telas estreitas, gaveta por cima da planta. */
  function alternarLateral() {
    if (raiz.getBoundingClientRect().width <= 1000) {
      vista.lateralSobre = !vista.lateralSobre;
      raiz.style.setProperty('--topo-gaveta', `${barra.offsetHeight}px`);
      raiz.classList.toggle('lateral-aberta', vista.lateralSobre);
    }
    else { definirPrefUi('lateral', !aberto('lateral')); raiz.classList.toggle('sem-lateral', !aberto('lateral')); }
    requestAnimationFrame(desenharPlanta);
  }

  const irParaPavimento = (id) => { vista.pav = id; vista.enquadrar = true; vista.sel = null; vista.marca = null; renderizarTudo(); };
  function menuPavimentos(ancora) {
    abrirMenu([{ cabecalho: 'Pavimentos' }, ...[...pavimentosOrdenados(estado.projeto)].reverse().map((pv) => ({
      rotulo: `${pv.nome} · ${fmt(pv.cota)} m`, icone: pv.id === vista.pav ? 'check' : undefined, acao: () => irParaPavimento(pv.id),
    }))], { ancora });
  }
  const caixa = caixaDoModo();
  if (caixa) planta.append(caixa);
  planta.append(cartaoSel);
  planta.classList.toggle('lancando', !!vista.modo);
  const centro = h('section', { class: 'mont-centro' }, barra, planta,
    h('div', { class: ['mont-legenda', !aberto('legenda') && 'recolhida'] },
      h('button', { class: 'mont-legenda-alterna', title: aberto('legenda') ? 'Recolher a legenda' : 'Mostrar a legenda', onClick: () => { definirPrefUi('legenda', !aberto('legenda')); renderizarTudo(); } }, icone(aberto('legenda') ? 'baixo' : 'direita', { tamanho: 12 }), 'Legenda'),
      h('span', null, h('i', { class: 'lg-laje' }), 'Laje'), h('span', null, h('i', { class: 'lg-viga' }), 'Viga'), h('span', null, h('i', { class: 'lg-pilar' }), 'Pilar'),
      h('span', null, h('i', { class: 'lg-acima' }), 'Pilar do nível de cima'), h('span', null, h('i', { class: 'lg-livre' }), 'Borda livre'),
      modoDoPavimento(p, vista.pav) === 'grelha' ? h('span', null, h('i', { class: 'lg-no' }), 'Nó da grelha') : null,
      p.elementos.some((e) => vaosInvertidos(e).algum && e.posicao?.pavimento === vista.pav) ? h('span', null, h('i', { class: 'lg-invertida' }), 'Viga invertida') : null,
      p.elementos.some((e) => e.modulo === 'concreto.sapata') ? h('span', null, h('i', { class: 'lg-sapata' }), 'Sapata') : null,
      p.elementos.some((e) => e.modulo === 'concreto.bloco') ? h('span', null, h('i', { class: 'lg-bloco' }), 'Bloco sobre estacas') : null,
      p.elementos.some((e) => e.modulo === 'geotecnia.sondagem' && e.local) ? h('span', null, h('i', { class: 'lg-furo' }), 'Furo de sondagem') : null,
      modoDoPavimento(p, vista.pav) === 'grelha' ? h('span', null, h('i', { class: 'lg-no-viga' }), 'Viga apoiada em viga') : null,
      h('span', { class: 'mont-ajuda' }, 'Arraste para mover (encaixa nos apoios e cantos) · R gira o selecionado (Shift+R ao contrário) · roda do mouse para aproximar · arraste o fundo para deslocar · duplo clique abre o elemento')),
  );
  planta.append(rodape);
  const raiz = h('div', { class: ['montagem', !aberto('lateral') && 'sem-lateral', vista.lateralSobre && 'lateral-aberta'] }, lateral, centro);
  if (vista.lateralSobre) requestAnimationFrame(() => raiz.style.setProperty('--topo-gaveta', `${barra.offsetHeight}px`));
  container.append(raiz);
  container.classList.add('editor-cheio');

  function renderizarTudo() { acoes.redesenhar(); }

  desenharLateral();
  desenharRodape();
  const obs = new ResizeObserver(() => desenharPlanta());
  obs.observe(planta);
  requestAnimationFrame(desenharPlanta);

  // atalhos de teclado da planta: R gira o selecionado (anti-horário), Shift+R no outro sentido
  const teclas = (e) => {
    if (!raiz.isConnected || !raiz.getClientRects().length) return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('.dialogo-fundo, .menu')) return;
    if (vista.modo === 'pincel' && e.key === 'Escape') { e.preventDefault(); vista.modo = null; vista.pincel = null; renderizarTudo(); return; }
    // eixo selecionado: D duplica (Shift+D do outro lado), Delete exclui, Esc tira a seleção
    if (vista.selEixo && !vista.modo) {
      if (e.key === 'd' || e.key === 'D') { if (duplicarEixoSel(e.shiftKey ? -1 : 1)) e.preventDefault(); return; }
      if (e.key === 'Delete' || e.key === 'Backspace') { if (excluirEixoSel()) e.preventDefault(); return; }
      if (e.key === 'Escape') { e.preventDefault(); vista.selEixo = null; desenharPlanta(); desenharLateral(); return; }
      const sEixo = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
      if (sEixo) { if (moverEixoSel(...sEixo, e.shiftKey ? 10 : 1)) e.preventDefault(); return; }
    }
    if (vista.modo) {
      if (e.key === 'Escape') { e.preventDefault(); if (vista.cadeia.length) { vista.cadeia = []; desenharPrevia(); } else modoLancamento(vista.modo); return; }
      if (e.key === 'Enter' && vista.modo === 'cadeia') { e.preventDefault(); concluirCadeia(); return; }
      if (e.key === 'Backspace') { e.preventDefault(); vista.cadeia.pop(); desenharPrevia(); return; }
    }
    if (e.key === 'PageUp' || e.key === 'PageDown') {
      const ord = pavimentosOrdenados(estado.projeto);
      const i = ord.findIndex((x) => x.id === vista.pav) + (e.key === 'PageUp' ? 1 : -1);
      if (ord[i]) { e.preventDefault(); irParaPavimento(ord[i].id); }
      return;
    }
    if (e.key === 'v' || e.key === 'V') { e.preventDefault(); modoLancamento('cadeia'); return; }
    if (e.key === 'l' || e.key === 'L') { e.preventDefault(); modoLancamento('laje'); return; }
    if (e.key === 'E' && e.shiftKey) { e.preventDefault(); alternarEixosVisiveis(); return; }
    if (e.key === 'e' || e.key === 'E') { e.preventDefault(); modoLancamento('eixo'); return; }
    if (e.key === 'c' || e.key === 'C') { e.preventDefault(); modoLancamento('cota'); return; }
    if (e.key === 'r' || e.key === 'R') { if (girarSelecionado(e.shiftKey ? -1 : 1)) e.preventDefault(); return; }
    const setas = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] }[e.key];
    if (setas && !vista.modo && moverSelecionado(...setas, e.shiftKey ? 10 : 1)) e.preventDefault();
  };
  window.addEventListener('keydown', teclas);
  // Ctrl+C, Ctrl+V e Ctrl+D na montagem: em captura, para valerem antes dos atalhos gerais (Ctrl+D duplica o elemento
  // da aba aberta); com o foco num campo, num diálogo ou com texto selecionado, ficam com o sistema
  const teclasCtrl = (e) => {
    if (!raiz.isConnected || !raiz.getClientRects().length) return;
    if (!(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
    const k = { KeyC: 'c', KeyV: 'v', KeyD: 'd' }[e.code];
    if (!k) return;
    if (e.target.closest?.('input, textarea, select, [contenteditable]') || document.querySelector('.dialogo-fundo, .menu')) return;
    const foco = document.activeElement;
    if (!(ponteiro.dentro || !foco || foco === document.body || raiz.contains(foco))) return;
    if (k === 'c' && String(window.getSelection?.() ?? '').trim()) return;
    const feito = k === 'c' ? copiarSel() : k === 'v' ? colarItem() : duplicarSel();
    if (feito) { e.preventDefault(); e.stopImmediatePropagation(); }
  };
  window.addEventListener('keydown', teclasCtrl, true);

  // console e testes: importar uma planta a partir do texto do DXF
  globalThis.__lebrMontagem = { aplicarDxf, vista, specsDaCadeia };
  return {
    destruir() { obs.disconnect(); window.removeEventListener('keydown', teclas); window.removeEventListener('keydown', teclasCtrl, true); container.classList.remove('editor-cheio'); },
    aoAlterar() { return false; },
  };
}
