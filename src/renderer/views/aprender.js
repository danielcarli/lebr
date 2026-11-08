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
 * Ajuda › Aprender cálculo estrutural: lições com controles, gráficos animados (cada um com "para que serve" e "como
 * ler") e, nas lições de viga, laje e pilar, o cálculo, a lista de ferros e a armadura em 3D dos módulos de verdade.
 * O texto está em aprender-licoes.js; as contas fechadas em engine/didatico.js.
 */
import { h, s, limpar } from '../ui/dom.js';
import { icone } from '../ui/icones.js';
import * as ui from '../ui/componentes.js';
import { comandos } from '../core/comandos.js';
import { vistaArmadura3D } from '../ui/armadura3d.js';
import { LICOES } from './aprender-licoes.js';
import { esforcosViga, flechaElastica, flexaoSecao, momentoLimite, esbeltezPilar, direcoesLaje, suave, TIPOS_VIGA } from '../../engine/didatico.js';
import { vigaDidatica, lajeDidatica, pilarDidatico, resumoLista } from '../../modules/comum/didatico-elementos.js';

const fmt = (v, c = 2) => (Number.isFinite(v) ? v.toLocaleString('pt-BR', { minimumFractionDigits: c, maximumFractionDigits: c }) : '—');
const phi = (v) => String(v).replace('.', ',');

/* ------------------------------------------------------------------ apoio */

/** Animações com requestAnimationFrame; respeita "reduzir movimento" do sistema. */
function criarAnimador() {
  let id = 0, ativo = null;
  const reduzir = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
  return {
    rodar(dur, quadro, fim) {
      const meu = ++id;
      if (ativo) cancelAnimationFrame(ativo);
      if (reduzir()) { quadro(1); fim?.(); return; }
      const t0 = performance.now();
      const passo = (agora) => {
        if (meu !== id) return;
        const t = Math.min(1, (agora - t0) / dur);
        quadro(t);
        if (t < 1) ativo = requestAnimationFrame(passo); else { ativo = null; fim?.(); }
      };
      ativo = requestAnimationFrame(passo);
    },
    parar() { id++; if (ativo) cancelAnimationFrame(ativo); ativo = null; },
  };
}

/** Controle deslizante com o valor ao lado; aoMudar é chamado enquanto arrasta. */
function deslizante({ rotulo, min, max, passo = 1, valor, unidade = '', casas = 0, aoMudar }) {
  const saida = h('output', { class: 'apr-valor' }, `${fmt(valor, casas)} ${unidade}`.trim());
  const input = h('input', {
    type: 'range', min, max, step: passo, value: valor, class: 'apr-range', 'aria-label': rotulo,
    onInput: (e) => { const v = Number(e.target.value); saida.textContent = `${fmt(v, casas)} ${unidade}`.trim(); aoMudar(v); },
  });
  return h('label', { class: 'apr-desl' }, h('span', { class: 'apr-desl-rot' }, rotulo, saida), input);
}

/** Bloco de um gráfico: título, o desenho e as duas caixas "para que serve" e "como ler". */
function blocoGrafico(g, ...conteudo) {
  return h('figure', { class: 'apr-grafico', dataset: { grafico: g.id } },
    h('figcaption', { class: 'apr-graf-tit' }, g.titulo),
    h('div', { class: 'apr-graf-corpo' },
      h('div', { class: 'apr-graf-desenho' }, conteudo),
      h('div', { class: 'apr-graf-texto' },
        h('div', { class: 'apr-explica serve' }, h('strong', null, icone('info', { tamanho: 13, traco: 2 }), 'Para que serve'), h('p', null, g.paraQueServe)),
        h('div', { class: 'apr-explica ler' }, h('strong', null, icone('busca', { tamanho: 13, traco: 2 }), 'Como ler'), h('p', null, g.comoLer)))),
  );
}
const grafico = (licao, id) => licao.graficos.find((g) => g.id === id);

/** Seta vertical (para baixo) desenhada em SVG. */
function setaBaixo(x, y0, y1, cls = 'apr-seta') {
  return s('g', { class: cls }, s('line', { x1: x, y1: y0, x2: x, y2: y1 - 5 }), s('path', { d: `M${x - 4} ${y1 - 7} L${x} ${y1} L${x + 4} ${y1 - 7} Z` }));
}
function setaCima(x, y0, y1, cls = 'apr-seta') {
  return s('g', { class: cls }, s('line', { x1: x, y1: y0, x2: x, y2: y1 + 5 }), s('path', { d: `M${x - 4} ${y1 + 7} L${x} ${y1} L${x + 4} ${y1 + 7} Z` }));
}
const polilinha = (pts) => pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');

/* ------------------------------------------------------------------ lição 1: caminho das cargas */

function licaoCaminho(licao, ctx) {
  const W = 680, H = 400;
  const chao = 318, pav = [208, 98];
  const px = [130, 550];
  // exemplo numérico: laje 5 × 4 m, 8 kN/m², dois pavimentos iguais
  const area = 20, carga = 8, Pl = area * carga;
  const etapas = [
    { cls: 'laje', txt: `Laje: ${carga} kN/m² × ${area} m² = ${Pl} kN em cada pavimento.` },
    { cls: 'viga', txt: `Vigas: recebem a reação da laje (${Pl} kN) e levam até os pilares — ${Pl / 2} kN em cada ponta, por pavimento.` },
    { cls: 'pilar', txt: `Pilares: somam os pavimentos de cima. No térreo, cada um destes dois pórticos leva ${Pl / 2} kN × 2 pavimentos = ${Pl} kN (mais o peso próprio).` },
    { cls: 'fundacao', txt: `Fundação: a sapata espalha ${Pl} kN no solo; com 0,2 MPa (200 kN/m²), ela precisa de pelo menos ${fmt(Pl / 200, 2)} m².` },
    { cls: 'solo', txt: 'Solo: recebe a carga numa área grande o bastante para não romper nem recalcar demais.' },
  ];
  const pecas = [];
  // solo
  pecas.push(s('g', { class: 'apr-cm solo' },
    s('rect', { x: 20, y: chao + 36, width: W - 40, height: 40, class: 'apr-solo' }),
    ...Array.from({ length: 26 }, (_, i) => s('line', { x1: 26 + i * 25, y1: chao + 76, x2: 46 + i * 25, y2: chao + 40, class: 'apr-hachura' }))));
  // sapatas
  for (const x of px) pecas.push(s('path', { class: 'apr-cm fundacao apr-peca', d: `M${x - 46} ${chao + 36} L${x + 46} ${chao + 36} L${x + 46} ${chao + 22} L${x + 12} ${chao + 10} L${x - 12} ${chao + 10} L${x - 46} ${chao + 22} Z` }));
  // pilares
  for (const x of px) pecas.push(s('rect', { class: 'apr-cm pilar apr-peca', x: x - 10, y: pav[1] - 20, width: 20, height: chao + 10 - (pav[1] - 20) }));
  // vigas e lajes
  for (const y of pav) {
    pecas.push(s('rect', { class: 'apr-cm viga apr-peca', x: px[0] - 10, y: y - 20, width: px[1] - px[0] + 20, height: 26 }));
    pecas.push(s('rect', { class: 'apr-cm laje apr-peca', x: px[0] - 30, y: y - 30, width: px[1] - px[0] + 60, height: 10 }));
  }
  // cargas na laje
  const cargas = [];
  for (const y of pav) for (let i = 0; i < 12; i++) cargas.push(setaBaixo(px[0] + 10 + i * 35, y - 62, y - 33, 'apr-seta apr-cm laje'));
  // fluxo: viga → pilares (horizontal), pilar → baixo, sapata → solo
  const fluxo = [];
  for (const y of pav) {
    fluxo.push(s('path', { class: 'apr-fluxo apr-cm viga', d: `M${(px[0] + px[1]) / 2 - 10} ${y - 7} L${px[0] + 18} ${y - 7}`, 'marker-end': 'url(#apr-ponta)' }));
    fluxo.push(s('path', { class: 'apr-fluxo apr-cm viga', d: `M${(px[0] + px[1]) / 2 + 10} ${y - 7} L${px[1] - 18} ${y - 7}`, 'marker-end': 'url(#apr-ponta)' }));
  }
  for (const x of px) fluxo.push(s('path', { class: 'apr-fluxo apr-cm pilar', d: `M${x} ${pav[1]} L${x} ${chao - 6}`, 'marker-end': 'url(#apr-ponta)' }));
  for (const x of px) for (const dx of [-36, 0, 36]) fluxo.push(s('path', { class: 'apr-fluxo apr-cm fundacao', d: `M${x + dx * 0.4} ${chao + 30} L${x + dx} ${chao + 64}`, 'marker-end': 'url(#apr-ponta)' }));
  const rotulos = [
    s('text', { x: px[1] + 44, y: pav[1] - 24, class: 'apr-rot apr-cm laje' }, 'laje'),
    s('text', { x: px[1] + 22, y: pav[1] + 2, class: 'apr-rot apr-cm viga' }, 'viga'),
    s('text', { x: px[1] + 18, y: (pav[0] + chao) / 2, class: 'apr-rot apr-cm pilar' }, 'pilar'),
    s('text', { x: px[1] + 52, y: chao + 26, class: 'apr-rot apr-cm fundacao' }, 'sapata'),
    s('text', { x: W - 30, y: chao + 62, class: 'apr-rot apr-cm solo', 'text-anchor': 'end' }, 'solo'),
  ];
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'apr-svg apr-caminho' },
    s('defs', null, s('marker', { id: 'apr-ponta', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse' }, s('path', { d: 'M0 0 L10 5 L0 10 Z', class: 'apr-ponta' }))),
    ...pecas, ...cargas, ...fluxo, ...rotulos);
  const legenda = h('p', { class: 'apr-legenda-etapa' });
  const pontos = h('div', { class: 'apr-etapas' });
  let etapa = -1, timer = null;
  const mostrar = (k) => {
    etapa = k;
    svg.dataset.etapa = String(k);
    svg.classList.toggle('todas', k < 0);
    for (const e of svg.querySelectorAll('.apr-cm')) {
      const i = etapas.findIndex((x) => e.classList.contains(x.cls));
      e.classList.toggle('aceso', i === k);
      e.classList.toggle('passou', k >= 0 && i < k);
    }
    legenda.textContent = k < 0 ? 'Aperte Animar para seguir a carga da laje até o solo, ou escolha uma etapa.' : `${k + 1}. ${etapas[k].txt}`;
    pontos.querySelectorAll('button').forEach((b, i) => b.classList.toggle('ativo', i === k));
  };
  etapas.forEach((e, i) => pontos.append(h('button', { type: 'button', class: 'apr-etapa', onClick: () => { parar(); mostrar(i); } }, `${i + 1}. ${e.cls === 'fundacao' ? 'fundação' : e.cls}`)));
  const parar = () => { if (timer) clearInterval(timer); timer = null; };
  const animar = () => {
    parar(); mostrar(0);
    timer = setInterval(() => { if (!svg.isConnected) return parar(); if (etapa >= etapas.length - 1) { parar(); return; } mostrar(etapa + 1); }, 2200);
  };
  ctx.limpezas.push(parar);
  mostrar(-1);
  requestAnimationFrame(() => animar());
  return [
    blocoGrafico(grafico(licao, 'caminho'),
      h('div', { class: 'apr-controles' }, ui.botao({ texto: 'Animar', icone: 'calcular', tipo: 'primario', aoClicar: animar }), pontos),
      svg, legenda),
    h('div', { class: 'apr-ver-3d' },
      h('p', null, 'Para ver o mesmo caminho num edifício de verdade, abra um exemplo e a vista 3D: cada laje, viga, pilar e fundação aparece com o seu cálculo.'),
      h('div', { class: 'apr-botoes' },
        ui.botao({ texto: 'Abrir o exemplo térreo com baldrame', icone: 'sapata', aoClicar: () => comandos.executar('projeto.abrirExemploTerreo') }),
        ui.botao({ texto: 'Abrir o exemplo do sobrado', icone: 'casa', aoClicar: () => comandos.executar('projeto.abrirExemploSobrado') }),
        ui.botao({ texto: 'Abrir o exemplo de 3 pavimentos', icone: 'cubo', aoClicar: () => comandos.executar('projeto.abrirExemplo3') }),
        ui.botao({ texto: 'Ver o projeto aberto em 3D', icone: 'cubo', tipo: 'fantasma', aoClicar: () => comandos.executar('estrutura.3d') }))),
  ];
}

/* ------------------------------------------------------------------ lição 2: esforços na viga */

function licaoEsforcos(licao, ctx) {
  const st = { tipo: 'biapoiada', L: 6, q: 15 };
  const anim = criarAnimador(); ctx.limpezas.push(() => anim.parar());
  const W = 720, X0 = 70, X1 = 650;
  const paineis = {
    carregamento: s('svg', { viewBox: `0 0 ${W} 150`, class: 'apr-svg' }),
    dec: s('svg', { viewBox: `0 0 ${W} 150`, class: 'apr-svg' }),
    dmf: s('svg', { viewBox: `0 0 ${W} 170`, class: 'apr-svg' }),
    deformada: s('svg', { viewBox: `0 0 ${W} 156`, class: 'apr-svg' }),
  };
  const leitura = h('div', { class: 'apr-leitura' }, 'Passe o mouse sobre um dos diagramas para ler V e M numa seção.');
  const ficha = h('div');
  let r = esforcosViga(st.tipo, st.L, st.q);
  let t = 1;

  const X = (x) => X0 + (x / st.L) * (X1 - X0);
  function vinculos(y) {
    const g = [];
    const apoio = (x) => g.push(s('path', { class: 'apr-vinculo', d: `M${x} ${y} L${x - 10} ${y + 16} L${x + 10} ${y + 16} Z` }), s('line', { class: 'apr-vinculo', x1: x - 14, y1: y + 20, x2: x + 14, y2: y + 20 }));
    const engaste = (x, lado) => { g.push(s('line', { class: 'apr-vinculo grosso', x1: x, y1: y - 22, x2: x, y2: y + 22 })); for (let k = -20; k <= 16; k += 8) g.push(s('line', { class: 'apr-vinculo', x1: x, y1: y + k, x2: x + lado * 9, y2: y + k + 8 })); };
    if (st.tipo === 'biapoiada') { apoio(X(0)); apoio(X(st.L)); }
    else if (st.tipo === 'biengastada') { engaste(X(0), -1); engaste(X(st.L), 1); }
    else engaste(X(0), -1);
    return g;
  }
  function desenharCarregamento() {
    const yv = 92, k = suave(Math.min(1, t * 1.6));
    const setas = [];
    const n = Math.max(6, Math.round(st.L * 2.5));
    for (let i = 0; i <= n; i++) {
      const x = X((st.L * i) / n);
      setas.push(setaBaixo(x, 30 + (1 - k) * -30, yv - 9, 'apr-seta carga'));
    }
    const reac = st.tipo === 'balanco' ? [] : r.reacoes.map((re) => s('text', { x: X(re.x), y: 144, class: 'apr-num', 'text-anchor': 'middle' }, `R = ${fmt(re.R * t, 1)} kN`));
    if (st.tipo !== 'biapoiada') for (const re of r.reacoes) reac.push(s('text', { x: X(re.x) + (re.x === 0 ? 18 : -18), y: 124, class: 'apr-num neg', 'text-anchor': re.x === 0 ? 'start' : 'end' }, `M = ${fmt(re.M * t, 1)} kN·m`));
    if (st.tipo === 'balanco') reac.push(s('text', { x: X(0), y: 144, class: 'apr-num', 'text-anchor': 'middle' }, `R = ${fmt(r.reacoes[0].R * t, 1)} kN`));
    limpar(paineis.carregamento).append(
      s('line', { x1: X(0), y1: 30 + (1 - k) * -30, x2: X(st.L), y2: 30 + (1 - k) * -30, class: 'apr-seta carga linha', opacity: k }),
      s('text', { x: X(st.L / 2), y: 20, class: 'apr-num carga', 'text-anchor': 'middle', opacity: k }, `q = ${fmt(st.q, 1)} kN/m`),
      ...setas.map((g) => { g.setAttribute('opacity', k); return g; }),
      s('rect', { x: X(0), y: yv - 7, width: X(st.L) - X(0), height: 14, class: 'apr-barra' }),
      ...vinculos(yv + 7),
      s('text', { x: X(st.L / 2), y: 124, class: 'apr-cota', 'text-anchor': 'middle' }, `L = ${fmt(st.L, 2)} m`),
      ...reac,
    );
  }
  function eixoDiagrama(svg, ymid, nome) {
    svg.append(s('line', { x1: X(0), y1: ymid, x2: X(st.L), y2: ymid, class: 'apr-eixo' }), s('text', { x: 14, y: ymid + 4, class: 'apr-rot' }, nome));
  }
  function desenharDec() {
    const svg = limpar(paineis.dec), ym = 75, esc = 55 / Math.max(1e-9, r.Vmax);
    eixoDiagrama(svg, ym, 'V');
    const pts = r.x.map((x, i) => [X(x), ym - r.V[i] * esc * t]);
    svg.append(s('path', { class: 'apr-area dec', d: `${polilinha([[X(0), ym], ...pts, [X(st.L), ym]])} Z` }), s('path', { class: 'apr-linha dec', d: polilinha(pts) }));
    const i0 = 0, i1 = r.x.length - 1;
    svg.append(s('text', { x: pts[i0][0] + 6, y: pts[i0][1] + (r.V[i0] >= 0 ? -6 : 14), class: 'apr-num' }, `${fmt(r.V[i0] * t, 1)} kN`));
    if (st.tipo !== 'balanco') svg.append(s('text', { x: pts[i1][0] - 6, y: pts[i1][1] + (r.V[i1] >= 0 ? -6 : 14), class: 'apr-num', 'text-anchor': 'end' }, `${fmt(r.V[i1] * t, 1)} kN`));
  }
  function desenharDmf() {
    const svg = limpar(paineis.dmf), Mabs = Math.max(Math.abs(r.Mmax), Math.abs(r.Mmin), 1e-9);
    const temPos = r.Mmax > 1e-9, temNeg = r.Mmin < -1e-9;
    const ym = temPos && temNeg ? 72 : temPos ? 30 : 140, esc = (temPos && temNeg ? 62 : 110) / Mabs;
    eixoDiagrama(svg, ym, 'M');
    // positivo para baixo (lado tracionado)
    const pts = r.x.map((x, i) => [X(x), ym + r.M[i] * esc * t]);
    svg.append(s('path', { class: 'apr-area dmf', d: `${polilinha([[X(0), ym], ...pts, [X(st.L), ym]])} Z` }), s('path', { class: 'apr-linha dmf', d: polilinha(pts) }));
    if (temPos) {
      const i = r.M.indexOf(r.Mmax);
      svg.append(s('text', { x: pts[i][0], y: pts[i][1] + 16, class: 'apr-num', 'text-anchor': 'middle' }, `+${fmt(r.Mmax * t, 1)} kN·m`));
    }
    if (temNeg) {
      const i = r.M.indexOf(r.Mmin);
      svg.append(s('text', { x: pts[i][0] + (i === 0 ? 8 : -8), y: pts[i][1] - 6, class: 'apr-num neg', 'text-anchor': i === 0 ? 'start' : 'end' }, `${fmt(r.Mmin * t, 1)} kN·m`));
    }
    svg.append(s('text', { x: X(st.L) + 8, y: ym + (temPos ? 30 : -24), class: 'apr-dica' }, temPos ? 'tração embaixo' : ''), s('text', { x: X(st.L) + 8, y: ym - 24, class: 'apr-dica' }, temNeg ? 'tração em cima' : ''));
  }
  function desenharDeformada() {
    const svg = limpar(paineis.deformada), ym = 40;
    const f = flechaElastica(st.tipo, st.L, st.q, 20, 50, 24150);
    const amp = 64 * t;
    svg.append(s('line', { x1: X(0), y1: ym, x2: X(st.L), y2: ym, class: 'apr-eixo tracejado' }));
    const pts = r.x.map((x, i) => [X(x), ym + r.forma[i] * amp]);
    svg.append(s('path', { class: 'apr-linha deformada', d: polilinha(pts) }), ...vinculos(ym).map((g) => { g.setAttribute('opacity', 0.45); return g; }));
    const i = r.forma.indexOf(Math.max(...r.forma));
    svg.append(s('text', { x: pts[i][0] + (st.tipo === 'balanco' ? -8 : 0), y: pts[i][1] + 18, class: 'apr-num', 'text-anchor': st.tipo === 'balanco' ? 'end' : 'middle' }, `f = ${fmt(f * t, 2)} cm`),
      s('text', { x: X(0), y: 150, class: 'apr-dica' }, `Flecha elástica de uma seção 20 × 50 cm em C25 (Ecs ≈ 24 GPa), sem fissuração nem fluência · L/250 = ${fmt((st.L * 100) / 250, 2)} cm`));
  }
  function desenharTudo() { desenharCarregamento(); desenharDec(); desenharDmf(); desenharDeformada(); }
  function atualizarFicha() {
    limpar(ficha).append(ui.ficha([
      { rotulo: 'Reações', valor: r.reacoes.map((x) => fmt(x.R, 1)).join(' · '), sub: 'kN' },
      { rotulo: 'Cortante máximo', valor: fmt(r.Vmax, 1), sub: 'kN' },
      { rotulo: 'Momento positivo', valor: fmt(r.Mmax, 1), sub: st.tipo === 'biapoiada' ? 'kN·m = qL²/8' : st.tipo === 'biengastada' ? 'kN·m = qL²/24' : 'kN·m' },
      { rotulo: 'Momento negativo', valor: fmt(r.Mmin, 1), sub: st.tipo === 'balanco' ? 'kN·m = −qL²/2' : st.tipo === 'biengastada' ? 'kN·m = −qL²/12' : 'kN·m' },
    ], { colunas: 4 }));
  }
  const animar = () => anim.rodar(1600, (k) => { t = suave(k); desenharTudo(); });
  const recalcular = (animarJunto = false) => {
    r = esforcosViga(st.tipo, st.L, st.q);
    atualizarFicha();
    if (animarJunto) animar(); else { t = 1; desenharTudo(); }
  };
  // leitura com o mouse
  const cursor = (svg, e) => {
    const p = svg.getBoundingClientRect();
    const xs = ((e.clientX - p.left) / p.width) * W;
    const x = Math.min(st.L, Math.max(0, ((xs - X0) / (X1 - X0)) * st.L));
    const v = r.em(x);
    for (const sv of Object.values(paineis)) {
      sv.querySelector('.apr-cursor')?.remove();
      const hh = Number(sv.getAttribute('viewBox').split(' ')[3]);
      sv.append(s('line', { class: 'apr-cursor', x1: X(x), y1: 0, x2: X(x), y2: hh }));
    }
    leitura.innerHTML = '';
    leitura.append(h('b', null, `x = ${fmt(x, 2)} m`), `  ·  V = ${fmt(v.V, 1)} kN  ·  M = ${fmt(v.M, 1)} kN·m`);
  };
  for (const sv of Object.values(paineis)) {
    sv.addEventListener('pointermove', (e) => cursor(sv, e));
    sv.addEventListener('pointerleave', () => { for (const x of Object.values(paineis)) x.querySelector('.apr-cursor')?.remove(); });
  }
  const sliders = h('div', { class: 'apr-desls' });
  const montarSliders = () => {
    limpar(sliders).append(
      deslizante({ rotulo: 'Vão L', min: st.tipo === 'balanco' ? 0.5 : 1, max: st.tipo === 'balanco' ? 4 : 10, passo: 0.25, valor: st.L, unidade: 'm', casas: 2, aoMudar: (v) => { st.L = v; recalcular(); } }),
      deslizante({ rotulo: 'Carga q', min: 2, max: 50, passo: 1, valor: st.q, unidade: 'kN/m', casas: 0, aoMudar: (v) => { st.q = v; recalcular(); } }));
  };
  const tipos = h('div');
  const montarTipos = () => limpar(tipos).append(ui.segmentado({
    rotulo: 'Tipo de viga', valor: st.tipo, opcoes: Object.entries(TIPOS_VIGA).map(([valor, texto]) => ({ valor, texto })),
    aoMudar: (v) => { st.tipo = v; if (v === 'balanco') st.L = Math.min(st.L, 3); montarTipos(); montarSliders(); recalcular(true); },
  }));
  montarTipos(); montarSliders(); atualizarFicha(); t = 0; desenharTudo();
  requestAnimationFrame(animar);
  return [
    h('div', { class: 'apr-controles' }, tipos, sliders, ui.botao({ texto: 'Animar', icone: 'calcular', tipo: 'primario', aoClicar: animar })),
    ficha, leitura,
    blocoGrafico(grafico(licao, 'carregamento'), paineis.carregamento),
    blocoGrafico(grafico(licao, 'dec'), paineis.dec),
    blocoGrafico(grafico(licao, 'dmf'), paineis.dmf),
    blocoGrafico(grafico(licao, 'deformada'), paineis.deformada),
  ];
}

/* ------------------------------------------------------------------ lição 3: flexão na seção */

function licaoFlexao(licao, ctx) {
  const st = { b: 20, h: 50, fck: 25, Md: 120 };
  const anim = criarAnimador(); ctx.limpezas.push(() => anim.parar());
  const svgDef = s('svg', { viewBox: '0 0 560 340', class: 'apr-svg apr-secao estreito' });
  const svgTen = s('svg', { viewBox: '0 0 560 340', class: 'apr-svg apr-secao estreito' });
  const regua = s('svg', { viewBox: '0 0 560 110', class: 'apr-svg estreito' });
  const ficha = h('div');
  const aviso = h('p', { class: 'apr-aviso' });
  let Mmax = 1;

  /** A seção desenhada em escala, com a zona comprimida e a linha neutra estendida até a direita. */
  function secao(r, geo) {
    const { k, top, bx, bw, hh, dpx, xn } = geo;
    const g = [
      s('text', { x: bx + bw / 2, y: 22, class: 'apr-rot', 'text-anchor': 'middle' }, 'seção'),
      s('rect', { x: bx, y: top, width: bw, height: hh, class: 'apr-concreto' }),
    ];
    if (r.ok) g.push(s('rect', { x: bx, y: top, width: bw, height: xn, class: 'apr-comprimido' }));
    const nb = Math.max(2, Math.min(5, Math.round(st.b / 6)));
    for (let i = 0; i < nb; i++) g.push(s('circle', { cx: bx + 9 + (i * (bw - 18)) / (nb - 1), cy: top + dpx, r: 5, class: 'apr-aco' }));
    if (r.ok) g.push(s('line', { x1: bx - 10, y1: top + xn, x2: 540, y2: top + xn, class: 'apr-ln' }), s('text', { x: bx - 14, y: top + xn + 5, class: 'apr-num', 'text-anchor': 'end' }, `x = ${fmt(r.x, 1)}`));
    g.push(s('text', { x: bx + bw / 2, y: top + hh + 24, class: 'apr-cota', 'text-anchor': 'middle' }, `${st.b} × ${st.h} cm`), s('text', { x: bx + bw / 2, y: top + hh + 42, class: 'apr-cota', 'text-anchor': 'middle' }, `d = ${fmt(r.d, 0)} cm`));
    void k;
    return g;
  }
  const marcador = () => s('defs', null, s('marker', { id: 'apr-ponta-f', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto' }, s('path', { d: 'M0 0 L10 5 L0 10 Z', class: 'apr-ponta' })));

  function desenhar(M) {
    const r = flexaoSecao({ b: st.b, h: st.h, fck: st.fck, Md: M });
    const k = 250 / Math.max(st.h, st.b * 1.2);
    const geo = { k, top: 40, bx: 86, bw: st.b * k, hh: st.h * k, dpx: (r.d ?? st.h - 4) * k };
    geo.xn = r.ok ? r.x * k : geo.hh;
    const { top, hh, dpx, xn } = geo;
    const yS = top + dpx;
    // deformações: encurtamento à esquerda do eixo, alongamento à direita
    const ex = 330, kc = 22, ks = 9;            // px por ‰
    const gd = [...secao(r, geo),
      s('text', { x: ex, y: 22, class: 'apr-rot', 'text-anchor': 'middle' }, 'deformações (‰)'),
      s('line', { x1: ex, y1: top, x2: ex, y2: top + hh, class: 'apr-eixo' })];
    if (r.ok && M > 0) {
      const ec = r.epsC, es = r.epsS;
      gd.push(
        s('path', { class: 'apr-area def-c', d: `M${ex} ${top} L${ex - ec * kc} ${top} L${ex} ${top + xn} Z` }),
        s('path', { class: 'apr-area def-s', d: `M${ex} ${top + xn} L${ex + es * ks} ${yS} L${ex} ${yS} Z` }),
        s('line', { x1: ex - ec * kc, y1: top, x2: ex + es * ks, y2: yS, class: 'apr-linha def' }),
        s('text', { x: ex - ec * kc - 6, y: top + 14, class: 'apr-num', 'text-anchor': 'end' }, `εc = ${fmt(ec, 2)}`),
        s('text', { x: ex + es * ks + 6, y: yS + 5, class: 'apr-num' }, `εs = ${fmt(es, 2)}`),
        s('line', { x1: ex + r.eyd * ks, y1: yS - 12, x2: ex + r.eyd * ks, y2: yS + 12, class: 'apr-ref' }),
        s('text', { x: ex + r.eyd * ks, y: yS + 30, class: 'apr-dica', 'text-anchor': 'middle' }, `εyd = ${fmt(r.eyd, 2)}`));
    }
    limpar(svgDef).append(...gd);
    // tensões e forças
    const tx = 300;
    const gt = [marcador(), ...secao(r, geo),
      s('text', { x: tx + 40, y: 22, class: 'apr-rot', 'text-anchor': 'middle' }, 'tensões e forças'),
      s('line', { x1: tx, y1: top, x2: tx, y2: top + hh, class: 'apr-eixo' })];
    if (r.ok && M > 0) {
      const y08 = 0.8 * xn, larg = 54;
      const yRc = top + y08 / 2;
      gt.push(
        s('rect', { x: tx - larg, y: top, width: larg, height: y08, class: 'apr-bloco' }),
        s('text', { x: tx - larg - 6, y: top + 14, class: 'apr-dica', 'text-anchor': 'end' }, '0,85·fcd'),
        s('text', { x: tx - larg - 6, y: top + y08, class: 'apr-dica', 'text-anchor': 'end' }, '0,8·x'),
        s('line', { x1: tx + 90, y1: yRc, x2: tx + 6, y2: yRc, class: 'apr-forca', 'marker-end': 'url(#apr-ponta-f)' }),
        s('text', { x: tx + 96, y: yRc + 5, class: 'apr-num' }, `Rc = ${fmt(r.Rc, 0)} kN`),
        s('line', { x1: tx + 6, y1: yS, x2: tx + 90, y2: yS, class: 'apr-forca aco', 'marker-end': 'url(#apr-ponta-f)' }),
        s('text', { x: tx + 96, y: yS + 5, class: 'apr-num' }, `Rs = ${fmt(r.Rs, 0)} kN`),
        s('line', { x1: tx + 70, y1: yRc + 10, x2: tx + 70, y2: yS - 10, class: 'apr-cota-l' }),
        s('text', { x: tx + 78, y: (yRc + yS) / 2 + 5, class: 'apr-num' }, `z = ${fmt(r.z, 1)} cm`),
        s('text', { x: tx - 20, y: top + hh + 42, class: 'apr-dica' }, `Md = Rc · z = ${fmt((r.Rc * r.z) / 100, 1)} kN·m`));
    }
    limpar(svgTen).append(...gt);
    // régua dos domínios
    const R0 = 30, R1 = 530, Xr = (v) => R0 + Math.min(1, v) * (R1 - R0);
    const xi = r.ok ? r.xi : 1;
    const xi34 = r.xi34;
    limpar(regua).append(
      s('rect', { x: Xr(0), y: 30, width: Xr(r.xi23) - Xr(0), height: 20, class: 'apr-faixa d2' }),
      s('rect', { x: Xr(r.xi23), y: 30, width: Xr(0.45) - Xr(r.xi23), height: 20, class: 'apr-faixa d3' }),
      s('rect', { x: Xr(0.45), y: 30, width: Xr(xi34) - Xr(0.45), height: 20, class: 'apr-faixa d3b' }),
      s('rect', { x: Xr(xi34), y: 30, width: Xr(1) - Xr(xi34), height: 20, class: 'apr-faixa d4' }),
      s('text', { x: (Xr(0) + Xr(r.xi23)) / 2, y: 22, class: 'apr-dica', 'text-anchor': 'middle' }, 'domínio 2'),
      s('text', { x: (Xr(r.xi23) + Xr(xi34)) / 2, y: 22, class: 'apr-dica', 'text-anchor': 'middle' }, 'domínio 3'),
      s('text', { x: (Xr(xi34) + Xr(1)) / 2, y: 22, class: 'apr-dica', 'text-anchor': 'middle' }, 'domínio 4'),
      ...[[0, '0'], [r.xi23, '0,26'], [0.45, '0,45'], [xi34, fmt(xi34, 2)], [1, '1']].map(([v, txt]) => s('line', { x1: Xr(v), y1: 50, x2: Xr(v), y2: 56, class: 'apr-eixo' })),
      ...[[0, '0'], [r.xi23, '0,26'], [0.45, '0,45'], [xi34, fmt(xi34, 2)], [1, '1']].map(([v, txt]) => s('text', { x: Xr(v), y: 70, class: 'apr-dica', 'text-anchor': 'middle' }, txt)),
      s('path', { d: `M${Xr(xi) - 8} 22 L${Xr(xi) + 8} 22 L${Xr(xi)} 32 Z`, class: 'apr-marcador-p' }),
      s('line', { x1: Xr(xi), y1: 30, x2: Xr(xi), y2: 50, class: 'apr-marcador' }),
      s('text', { x: Math.min(R1 - 40, Math.max(R0 + 40, Xr(xi))), y: 98, class: 'apr-num', 'text-anchor': 'middle' }, r.ok ? `x/d = ${fmt(xi, 3)} · domínio ${r.dominio}` : 'fora da régua: seção insuficiente'),
    );
    aviso.textContent = !r.ok ? r.motivo : !r.ductil ? `x/d = ${fmt(r.xi, 3)} > 0,45: a seção não tem a ductilidade que a norma pede (14.6.4.3). Aumente h, use armadura dupla ou concreto mais forte.` : '';
    aviso.hidden = !aviso.textContent;
    return r;
  }
  function atualizarFicha(r) {
    limpar(ficha).append(ui.ficha([
      { rotulo: 'Md', valor: fmt(st.Md, 1), sub: 'kN·m' },
      { rotulo: 'Linha neutra', valor: r.ok ? `${fmt(r.x, 1)} cm` : '—', sub: r.ok ? `x/d = ${fmt(r.xi, 3)}` : '' },
      { rotulo: 'Domínio', valor: r.ok ? String(r.dominio) : '—', sub: r.ok ? (r.ductil ? 'dúctil' : 'acima de 0,45') : '' },
      { rotulo: 'Aço necessário', valor: r.ok ? `${fmt(r.As, 2)} cm²` : '—', sub: r.ok ? `≈ ${Math.ceil(r.As / 1.227)} ø 12,5` : '' },
    ], { colunas: 4 }));
  }
  const animar = () => anim.rodar(2200, (k) => { const M = st.Md * suave(k); desenhar(M); }, () => atualizarFicha(desenhar(st.Md)));
  const mdBox = h('div');
  const montarMd = () => {
    Mmax = Math.max(20, Math.round(momentoLimite({ b: st.b, h: st.h, fck: st.fck }) * 1.5));
    st.Md = Math.min(st.Md, Mmax);
    limpar(mdBox).append(deslizante({ rotulo: 'Momento de cálculo Md', min: 0, max: Mmax, passo: 1, valor: st.Md, unidade: 'kN·m', aoMudar: (v) => { st.Md = v; atualizarFicha(desenhar(v)); } }));
  };
  const mudarSecao = (k) => (v) => { st[k] = v; montarMd(); atualizarFicha(desenhar(st.Md)); };
  montarMd(); atualizarFicha(desenhar(0));
  requestAnimationFrame(animar);
  return [
    h('div', { class: 'apr-controles' },
      h('div', { class: 'apr-desls' },
        deslizante({ rotulo: 'Largura b', min: 12, max: 40, valor: st.b, unidade: 'cm', aoMudar: mudarSecao('b') }),
        deslizante({ rotulo: 'Altura h', min: 25, max: 90, valor: st.h, unidade: 'cm', aoMudar: mudarSecao('h') }),
        deslizante({ rotulo: 'fck', min: 20, max: 50, passo: 5, valor: st.fck, unidade: 'MPa', aoMudar: mudarSecao('fck') })),
      h('div', { class: 'apr-desls' }, mdBox),
      ui.botao({ texto: 'Animar', icone: 'calcular', tipo: 'primario', aoClicar: animar })),
    ficha, aviso,
    blocoGrafico(grafico(licao, 'deformacoes'), svgDef),
    blocoGrafico(grafico(licao, 'tensoes'), svgTen),
    blocoGrafico(grafico(licao, 'dominios'), regua),
  ];
}

/* ------------------------------------------------------------------ 3D e lista de ferros (lições 4 a 6) */

function painelArmadura(g, calc, ctx) {
  const caixa = h('div', { class: 'apr-3d' });
  const montar = () => {
    limpar(caixa);
    if (!calc.modelo) { caixa.append(h('p', { class: 'apr-aviso' }, calc.res?.erro ?? 'Sem armadura para mostrar com estes dados.')); return; }
    caixa.append(vistaArmadura3D(calc.modelo, { altura: 380 }), calc.modelo.legenda ? h('p', { class: 'combinacoes-nota' }, calc.modelo.legenda) : '');
  };
  montar();
  return blocoGrafico(g, caixa);
}
function tabelaLista(g, posicoes) {
  const { linhas, massa } = resumoLista(posicoes);
  const tipo = { positiva: 'positiva', negativa: 'negativa', 'porta-estribo': 'porta-estribo', estribo: 'estribo', construtiva: 'construtiva', 'distribuição': 'distribuição', longitudinal: 'longitudinal' };
  return blocoGrafico(g,
    ui.tabela({
      colunas: [{ titulo: 'Pos.' }, { titulo: 'Tipo' }, { titulo: 'Quant.', alinhar: 'dir' }, { titulo: 'ø (mm)', alinhar: 'dir' }, { titulo: 'C (cm)', alinhar: 'dir' }, { titulo: 'Massa (kg)', alinhar: 'dir' }],
      linhas: linhas.map((l) => [l.N, tipo[l.tipo] ?? l.tipo, String(l.n), phi(l.phi), fmt(l.comprimento, 0), fmt(l.massa, 1)]),
    }),
    h('p', { class: 'combinacoes-nota' }, `Total: ${fmt(massa, 1)} kg de aço (sem perdas).`));
}
function estadoCalculo(res) {
  if (res.erro) return ui.selo(false, res.erro);
  const falhas = (res.verificacoes ?? []).filter((v) => !v.ok);
  return h('div', { class: 'apr-estado' }, ui.selo(!falhas.length, falhas.length ? `Não atende: ${falhas.map((v) => v.nome).join(', ')}` : 'Atende a todas as verificações'));
}
/** Agenda o recálculo enquanto o controle é arrastado (o 3D é refeito só quando o arrasto para). */
function adiador(ms, fn) {
  let t = null;
  return () => { clearTimeout(t); t = setTimeout(fn, ms); };
}

/* ------------------------------------------------------------------ lição 4: viga completa */

function licaoViga(licao, ctx) {
  const st = { tipo: 'biapoiada', L: 5, g: 12, q: 5, b: 20, h: 50, fck: 25 };
  const anim = criarAnimador(); ctx.limpezas.push(() => anim.parar());
  const area = h('div', { class: 'apr-resultado' });
  const env = s('svg', { viewBox: '0 0 720 300', class: 'apr-svg' });

  function desenharEnvoltoria(d, t) {
    const X0 = 70, X1 = 650, L = d.x.at(-1) || 1, X = (x) => X0 + (x / L) * (X1 - X0);
    const Mabs = Math.max(...d.Md.map(Math.abs), ...d.MdMin.map(Math.abs), 1e-9);
    const Vabs = Math.max(...d.Vd.map(Math.abs), ...d.VdMin.map(Math.abs), 1e-9);
    const ymM = 80, ymV = 225;
    const n = Math.max(2, Math.round(d.x.length * t));
    const linha = (arr, ym, esc, sinal) => polilinha(d.x.slice(0, n).map((x, i) => [X(x), ym + sinal * arr[i] * esc]));
    limpar(env).append(
      s('line', { x1: X0, y1: ymM, x2: X1, y2: ymM, class: 'apr-eixo' }), s('text', { x: 14, y: ymM + 4, class: 'apr-rot' }, 'Md'),
      s('line', { x1: X0, y1: ymV, x2: X1, y2: ymV, class: 'apr-eixo' }), s('text', { x: 14, y: ymV + 4, class: 'apr-rot' }, 'Vd'),
      s('path', { class: 'apr-linha dmf', d: linha(d.Md, ymM, 60 / Mabs, 1) }),
      s('path', { class: 'apr-linha dmf fraca', d: linha(d.MdMin, ymM, 60 / Mabs, 1) }),
      s('path', { class: 'apr-linha dec', d: linha(d.Vd, ymV, 55 / Vabs, -1) }),
      s('path', { class: 'apr-linha dec fraca', d: linha(d.VdMin, ymV, 55 / Vabs, -1) }),
      Math.min(...d.MdMin) < -0.05 ? s('text', { x: X1 + 6, y: ymM - 52, class: 'apr-dica' }, `${fmt(Math.min(...d.MdMin), 1)} kN·m`) : '',
      Math.max(...d.Md) > 0.05 ? s('text', { x: X1 + 6, y: ymM + 60, class: 'apr-dica' }, `${fmt(Math.max(...d.Md), 1)} kN·m`) : '',
      s('text', { x: X1 + 6, y: ymV - 50, class: 'apr-dica' }, `${fmt(Vabs, 1)} kN`),
    );
  }
  function calcularEDesenhar(animarJunto) {
    const c = vigaDidatica(st);
    const r = c.res;
    limpar(area);
    if (r.erro) { area.append(estadoCalculo(r)); return; }
    const v = r.vaos[0];
    const est = r.vaos[0]?.estribos ?? null;
    area.append(
      estadoCalculo(r),
      ui.ficha([
        { rotulo: 'Md máximo', valor: fmt(r.resumo.MdMax, 1), sub: 'kN·m' },
        { rotulo: 'Md mínimo', valor: fmt(r.resumo.MdMin, 1), sub: 'kN·m' },
        { rotulo: 'Vd máximo', valor: fmt(r.resumo.VdMax, 1), sub: 'kN' },
        { rotulo: 'Flecha / limite', valor: `${fmt(r.resumo.flechaRazao * 100, 0)} %`, sub: v?.flecha ? `${fmt(v.flecha.ft, 2)} de ${fmt(v.flecha.lim, 2)} cm` : '' },
      ], { colunas: 4 }),
      blocoGrafico(grafico(licao, 'envoltoria'), env),
      painelArmadura(grafico(licao, 'armadura3d'), c, ctx),
      tabelaLista(grafico(licao, 'lista'), c.posicoes),
      h('details', { class: 'apr-detalhes' }, h('summary', null, 'Verificações do módulo de vigas'), ui.tabelaVerificacoes(r.verificacoes ?? [])),
    );
    void est;
    if (animarJunto) anim.rodar(1400, (k) => desenharEnvoltoria(r.diagrama, suave(k))); else desenharEnvoltoria(r.diagrama, 1);
  }
  const agendar = adiador(350, () => calcularEDesenhar(false));
  const muda = (k) => (v) => { st[k] = v; agendar(); };
  const tipos = h('div');
  const montarTipos = () => limpar(tipos).append(ui.segmentado({
    rotulo: 'Tipo de viga', valor: st.tipo, opcoes: Object.entries(TIPOS_VIGA).map(([valor, texto]) => ({ valor, texto })),
    aoMudar: (v) => { st.tipo = v; if (v === 'balanco') st.L = Math.min(st.L, 2.5); montarTipos(); montarSliders(); calcularEDesenhar(true); },
  }));
  const sliders = h('div', { class: 'apr-desls' });
  const montarSliders = () => limpar(sliders).append(
    deslizante({ rotulo: 'Vão L', min: st.tipo === 'balanco' ? 0.5 : 2, max: st.tipo === 'balanco' ? 3.5 : 9, passo: 0.25, valor: st.L, unidade: 'm', casas: 2, aoMudar: muda('L') }),
    deslizante({ rotulo: 'Permanente g (sem o peso próprio)', min: 0, max: 40, valor: st.g, unidade: 'kN/m', aoMudar: muda('g') }),
    deslizante({ rotulo: 'Acidental q', min: 0, max: 30, valor: st.q, unidade: 'kN/m', aoMudar: muda('q') }),
    deslizante({ rotulo: 'Largura b', min: 12, max: 40, valor: st.b, unidade: 'cm', aoMudar: muda('b') }),
    deslizante({ rotulo: 'Altura h', min: 25, max: 100, passo: 5, valor: st.h, unidade: 'cm', aoMudar: muda('h') }),
    deslizante({ rotulo: 'fck', min: 20, max: 50, passo: 5, valor: st.fck, unidade: 'MPa', aoMudar: muda('fck') }));
  montarTipos(); montarSliders(); calcularEDesenhar(true);
  return [
    h('div', { class: 'apr-controles' }, tipos, sliders, ui.botao({ texto: 'Animar', icone: 'calcular', tipo: 'primario', aoClicar: () => calcularEDesenhar(true) })),
    area,
  ];
}

/* ------------------------------------------------------------------ lição 5: laje */

function licaoLaje(licao, ctx) {
  const st = { lx: 4, ly: 5, h: 10, q: 1.5, bordas: 'apoiada' };
  const BORDAS = {
    apoiada: { texto: 'Quatro bordas apoiadas', b: { x0: 'apoiada', x1: 'apoiada', y0: 'apoiada', y1: 'apoiada' } },
    umaEng: { texto: 'Uma borda engastada', b: { x0: 'apoiada', x1: 'engastada', y0: 'apoiada', y1: 'apoiada' } },
    duasEng: { texto: 'Duas bordas engastadas', b: { x0: 'apoiada', x1: 'engastada', y0: 'apoiada', y1: 'engastada' } },
  };
  const anim = criarAnimador(); ctx.limpezas.push(() => anim.parar());
  const area = h('div', { class: 'apr-resultado' });
  const faixas = s('svg', { viewBox: '0 0 720 300', class: 'apr-svg' });
  const momentos = s('svg', { viewBox: '0 0 720 230', class: 'apr-svg' });

  function desenharFaixas(t) {
    const dl = direcoesLaje(st.lx, st.ly);
    const k = 200 / Math.max(st.lx, st.ly);
    const w = st.lx * k, hh = st.ly * k, x0 = 60, y0 = 40 + (220 - hh) / 2;
    const fx = dl.kCurto, curtaX = st.lx <= st.ly;
    const pX = curtaX ? fx : 1 - fx;           // parcela na direção x
    const larg = 26;
    const g = [
      s('rect', { x: x0, y: y0, width: w, height: hh, class: 'apr-laje-planta' }),
      s('rect', { x: x0, y: y0 + hh / 2 - larg / 2, width: w, height: larg, class: 'apr-faixa-x', opacity: 0.25 + 0.75 * pX * t }),
      s('rect', { x: x0 + w / 2 - larg / 2, y: y0, width: larg, height: hh, class: 'apr-faixa-y', opacity: 0.25 + 0.75 * (1 - pX) * t }),
      s('text', { x: x0 + w / 2, y: y0 + hh + 20, class: 'apr-cota', 'text-anchor': 'middle' }, `lx = ${fmt(st.lx, 2)} m`),
      s('text', { x: x0 - 10, y: y0 + hh / 2, class: 'apr-cota', 'text-anchor': 'middle', transform: `rotate(-90 ${x0 - 10} ${y0 + hh / 2})` }, `ly = ${fmt(st.ly, 2)} m`),
    ];
    // barras de porcentagem
    const bx = 360, bw = 300;
    const barra = (y, frac, cls, rot) => [
      s('text', { x: bx, y: y - 8, class: 'apr-rot' }, rot),
      s('rect', { x: bx, y, width: bw, height: 22, class: 'apr-fundo-barra' }),
      s('rect', { x: bx, y, width: bw * frac * t, height: 22, class: cls }),
      s('text', { x: bx + bw * frac * t + 6, y: y + 16, class: 'apr-num' }, `${fmt(frac * 100 * t, 0)} %`),
    ];
    g.push(...barra(90, pX, 'apr-faixa-x', 'carga levada na direção x'), ...barra(160, 1 - pX, 'apr-faixa-y', 'carga levada na direção y'));
    g.push(s('text', { x: bx, y: 230, class: 'apr-num' }, `λ = ly/lx = ${fmt(Math.max(st.lx, st.ly) / Math.min(st.lx, st.ly), 2)} → ${dl.umaDirecao ? 'armada em uma direção' : 'armada nas duas direções'}`));
    limpar(faixas).append(...g);
  }
  function desenharMomentos(m, t) {
    const itens = [['Mx', m.Mx, 'pos'], ['My', m.My, 'pos'], ["M'x", -m.Mxn, 'neg'], ["M'y", -m.Myn, 'neg']];
    const Mabs = Math.max(...itens.map((x) => Math.abs(x[1])), 1e-9);
    const ym = 115, larg = 70;
    const g = [s('line', { x1: 60, y1: ym, x2: 660, y2: ym, class: 'apr-eixo' })];
    itens.forEach(([nome, v, cls], i) => {
      const x = 110 + i * 140, alt = (Math.abs(v) / Mabs) * 80 * t;
      const y = v >= 0 ? ym : ym - alt;
      g.push(s('rect', { x: x - larg / 2, y, width: larg, height: alt, class: `apr-barra-m ${cls}` }),
        s('text', { x, y: v >= 0 ? ym + alt + 16 : ym - alt - 6, class: 'apr-num', 'text-anchor': 'middle' }, `${fmt(Math.abs(v) * t, 2)}`),
        s('text', { x, y: v >= 0 ? ym - 8 : ym + 18, class: 'apr-rot', 'text-anchor': 'middle' }, nome));
    });
    g.push(s('text', { x: 660, y: 220, class: 'apr-dica', 'text-anchor': 'end' }, 'kN·m/m, de cálculo · M\' = 0 nas bordas apoiadas'));
    limpar(momentos).append(...g);
  }
  function calcularEDesenhar(animarJunto) {
    const c = lajeDidatica({ lx: st.lx, ly: st.ly, h: st.h, q: st.q, bordas: BORDAS[st.bordas].b });
    const r = c.res;
    limpar(area);
    area.append(estadoCalculo(r));
    if (r.erro) return;
    area.append(
      ui.ficha([
        { rotulo: 'λ = ly/lx', valor: fmt(r.lambda, 2), sub: r.umaDirecao ? 'uma direção' : 'duas direções' },
        { rotulo: 'Carga de cálculo', valor: fmt(r.cargas.pd, 2), sub: 'kN/m²' },
        { rotulo: 'Mx · My', valor: `${fmt(r.momentos.Mx, 2)} · ${fmt(r.momentos.My, 2)}`, sub: 'kN·m/m' },
        { rotulo: 'Flecha / limite', valor: `${fmt(r.flecha.ft, 2)} / ${fmt(r.flecha.lim, 2)}`, sub: 'mm' },
      ], { colunas: 4 }),
      blocoGrafico(grafico(licao, 'faixas'), faixas),
      blocoGrafico(grafico(licao, 'momentos'), momentos),
      painelArmadura(grafico(licao, 'armadura3d'), c, ctx),
      tabelaLista({ id: 'lista', titulo: 'Lista de ferros', paraQueServe: grafico(LICOES.find((l) => l.id === 'viga'), 'lista').paraQueServe, comoLer: 'Uma linha por posição; nas malhas, a quantidade sai do espaçamento ao longo do outro vão.' }, c.posicoes),
    );
    if (animarJunto) anim.rodar(1500, (k) => { desenharFaixas(suave(k)); desenharMomentos(r.momentos, suave(k)); });
    else { desenharFaixas(1); desenharMomentos(r.momentos, 1); }
  }
  const agendar = adiador(350, () => calcularEDesenhar(false));
  const muda = (k) => (v) => { st[k] = v; desenharFaixas(1); agendar(); };
  const bordas = h('div');
  const montarBordas = () => limpar(bordas).append(ui.segmentado({
    rotulo: 'Bordas', valor: st.bordas, opcoes: Object.entries(BORDAS).map(([valor, x]) => ({ valor, texto: x.texto })),
    aoMudar: (v) => { st.bordas = v; montarBordas(); calcularEDesenhar(true); },
  }));
  montarBordas(); calcularEDesenhar(true);
  return [
    h('div', { class: 'apr-controles' }, bordas,
      h('div', { class: 'apr-desls' },
        deslizante({ rotulo: 'Vão lx', min: 2, max: 8, passo: 0.25, valor: st.lx, unidade: 'm', casas: 2, aoMudar: muda('lx') }),
        deslizante({ rotulo: 'Vão ly', min: 2, max: 10, passo: 0.25, valor: st.ly, unidade: 'm', casas: 2, aoMudar: muda('ly') }),
        deslizante({ rotulo: 'Espessura h', min: 8, max: 20, valor: st.h, unidade: 'cm', aoMudar: muda('h') }),
        deslizante({ rotulo: 'Carga de uso q', min: 1, max: 5, passo: 0.5, valor: st.q, unidade: 'kN/m²', casas: 1, aoMudar: muda('q') })),
      ui.botao({ texto: 'Animar', icone: 'calcular', tipo: 'primario', aoClicar: () => calcularEDesenhar(true) })),
    area,
  ];
}

/* ------------------------------------------------------------------ lição 6: pilar */

function licaoPilar(licao, ctx) {
  const st = { comprimento: 3, bx: 20, by: 30, Nk: 600 };
  const anim = criarAnimador(); ctx.limpezas.push(() => anim.parar());
  const area = h('div', { class: 'apr-resultado' });
  const regua = s('svg', { viewBox: '0 0 720 110', class: 'apr-svg' });
  const flamb = s('svg', { viewBox: '0 0 720 340', class: 'apr-svg' });
  const envol = s('svg', { viewBox: '0 0 720 340', class: 'apr-svg' });

  function desenharRegua(lam, lam1) {
    const R0 = 40, R1 = 680, X = (l) => R0 + (Math.min(l, 220) / 220) * (R1 - R0);
    limpar(regua).append(
      s('rect', { x: X(0), y: 34, width: X(lam1) - X(0), height: 18, class: 'apr-faixa d2' }),
      s('rect', { x: X(lam1), y: 34, width: X(90) - X(lam1), height: 18, class: 'apr-faixa d3' }),
      s('rect', { x: X(90), y: 34, width: X(140) - X(90), height: 18, class: 'apr-faixa d3b' }),
      s('rect', { x: X(140), y: 34, width: X(200) - X(140), height: 18, class: 'apr-faixa d4' }),
      s('rect', { x: X(200), y: 34, width: X(220) - X(200), height: 18, class: 'apr-faixa proibido' }),
      ...[[lam1 / 2, 'curto'], [(lam1 + 90) / 2, 'médio'], [115, 'esbelto'], [170, 'muito esbelto'], [210, '> 200']].map(([v, t]) => s('text', { x: X(v), y: 26, class: 'apr-dica', 'text-anchor': 'middle' }, t)),
      ...[[0, '0'], [lam1, `λ1 = ${fmt(lam1, 0)}`], [90, '90'], [140, '140'], [200, '200']].map(([v, t]) => s('text', { x: X(v), y: 70, class: 'apr-dica', 'text-anchor': 'middle' }, t)),
      s('line', { x1: X(lam), y1: 28, x2: X(lam), y2: 58, class: 'apr-marcador' }),
      s('text', { x: X(lam), y: 96, class: 'apr-num', 'text-anchor': 'middle' }, `λ = ${fmt(lam, 1)}`),
    );
  }
  function desenharFlambagem(t, e) {
    // pilar em elevação com a meia senoide; amplitude ∝ N/(Ncr − N)
    const Nd = 1.4 * st.Nk * t;
    const amp = Math.min(70, 18 * (Nd / Math.max(1, e.Ncr - Nd)) * (e.lambda / 35));
    const H = 260, y0 = 50, xm = 200;
    const pts = Array.from({ length: 41 }, (_, i) => { const y = y0 + (H * i) / 40; return [xm + amp * Math.sin((Math.PI * i) / 40), y]; });
    const larg = Math.max(8, Math.min(40, Math.min(st.bx, st.by) * 0.9));
    limpar(flamb).append(
      s('path', { d: `${polilinha(pts.map(([x, y]) => [x - larg / 2, y]))} ${polilinha(pts.map(([x, y]) => [x + larg / 2, y]).reverse()).replace('M', 'L')} Z`, class: 'apr-pilar' }),
      s('line', { x1: xm, y1: y0 - 6, x2: xm, y2: y0 + H + 6, class: 'apr-eixo tracejado' }),
      setaBaixo(xm, y0 - 46, y0 - 2, 'apr-seta carga'),
      s('text', { x: xm + 10, y: y0 - 26, class: 'apr-num' }, `Nd = ${fmt(Nd, 0)} kN`),
      s('path', { d: `M${xm - 12} ${y0} L${xm + 12} ${y0} L${xm} ${y0 - 10} Z`, class: 'apr-vinculo' }),
      s('path', { d: `M${xm - 12} ${y0 + H + 10} L${xm + 12} ${y0 + H + 10} L${xm} ${y0 + H} Z`, class: 'apr-vinculo' }),
      s('text', { x: xm + amp + larg / 2 + 10, y: y0 + H / 2, class: 'apr-num' }, `e2 ${amp > 1 ? '↑' : ''}`),
      s('text', { x: 360, y: 90, class: 'apr-num' }, `le = ${fmt(st.comprimento, 2)} m · seção ${st.bx} × ${st.by} cm`),
      s('text', { x: 360, y: 116, class: 'apr-num' }, `Ncr (Euler) ≈ ${fmt(e.Ncr, 0)} kN`),
      s('text', { x: 360, y: 142, class: 'apr-num' }, `Nd / Ncr = ${fmt(Nd / e.Ncr, 2)}`),
      s('text', { x: 360, y: 180, class: 'apr-dica' }, 'Curvatura exagerada para ver.'),
      s('text', { x: 360, y: 198, class: 'apr-dica' }, 'Quanto mais perto Nd chega de Ncr,'),
      s('text', { x: 360, y: 216, class: 'apr-dica' }, 'mais o pilar se curva — e a própria'),
      s('text', { x: 360, y: 234, class: 'apr-dica' }, 'curvatura gera momento (N · e2).'),
    );
  }
  function desenharEnvoltoria(r, t) {
    const curva = r.armadura?.curva ?? [];
    if (!curva.length) { limpar(envol); return; }
    const M = Math.max(...curva.map((p) => Math.max(Math.abs(p.x), Math.abs(p.y))), Math.abs(r.dirX.Md), Math.abs(r.dirY.Md), 1e-9);
    const pts0 = curva;
    const c = [200, 170], k = 140 / M;
    const pts = pts0.map((p) => [c[0] + p.x * k, c[1] - p.y * k]);
    limpar(envol).append(
      s('line', { x1: c[0] - 160, y1: c[1], x2: c[0] + 160, y2: c[1], class: 'apr-eixo' }),
      s('line', { x1: c[0], y1: c[1] - 160, x2: c[0], y2: c[1] + 160, class: 'apr-eixo' }),
      s('text', { x: c[0] + 162, y: c[1] + 4, class: 'apr-rot' }, 'Mx'), s('text', { x: c[0] + 4, y: c[1] - 150, class: 'apr-rot' }, 'My'),
      s('path', { d: `${polilinha(pts)} Z`, class: 'apr-area envol' }),
      s('path', { d: `${polilinha(pts)} Z`, class: 'apr-linha envol' }),
      // uma situação de cálculo por direção: o momento total (1ª + 2ª ordem) naquela direção
      s('circle', { cx: c[0] + r.dirX.Md * k * t, cy: c[1], r: 6, class: 'apr-ponto' }),
      s('text', { x: c[0] + r.dirX.Md * k * t + 8, y: c[1] - 8, class: 'apr-num' }, 'x'),
      s('circle', { cx: c[0], cy: c[1] - r.dirY.Md * k * t, r: 6, class: 'apr-ponto' }),
      s('text', { x: c[0] + 8, y: c[1] - r.dirY.Md * k * t - 8, class: 'apr-num' }, 'y'),
      s('text', { x: 400, y: 100, class: 'apr-num' }, `Md,x = ${fmt(r.dirX.Md, 1)} kN·m (com a 2ª ordem em x)`),
      s('text', { x: 400, y: 126, class: 'apr-num' }, `Md,y = ${fmt(r.dirY.Md, 1)} kN·m (com a 2ª ordem em y)`),
      s('text', { x: 400, y: 152, class: 'apr-num' }, `uso máximo da seção: ${fmt((r.armadura.obliqua?.usoMax ?? 0) * 100, 0)} %`),
      s('text', { x: 400, y: 190, class: 'apr-dica' }, `Armadura: ${r.armadura.rotulo} · estribos ${r.armadura.estribo?.rotulo ?? ''}`),
      s('text', { x: 400, y: 210, class: 'apr-dica' }, `Curva para Nd = ${fmt(r.Nd, 0)} kN`),
    );
  }
  function calcularEDesenhar(animarJunto) {
    const c = pilarDidatico(st);
    const r = c.res;
    limpar(area);
    area.append(estadoCalculo(r));
    if (r.erro) return;
    const fraco = Math.min(st.bx, st.by), forte = Math.max(st.bx, st.by);
    const e = esbeltezPilar({ h: fraco, b: forte, le: st.comprimento });
    const lam = Math.max(r.dirX.lambda, r.dirY.lambda);
    const lam1 = r.dirX.lambda >= r.dirY.lambda ? r.dirX.lambda1 : r.dirY.lambda1;
    area.append(
      ui.ficha([
        { rotulo: 'Nd', valor: fmt(r.Nd, 0), sub: 'kN (com peso próprio e γn)' },
        { rotulo: 'λx · λy', valor: `${fmt(r.dirX.lambda, 1)} · ${fmt(r.dirY.lambda, 1)}`, sub: `λ1 = ${fmt(lam1, 0)}` },
        { rotulo: '2ª ordem', valor: r.dirX.segundaOrdem || r.dirY.segundaOrdem ? 'sim' : 'não', sub: r.dirX.metodo ?? '' },
        { rotulo: 'Armadura', valor: r.armadura?.rotulo ?? '—', sub: r.armadura?.estribo?.rotulo ?? '' },
      ], { colunas: 4 }),
      blocoGrafico(grafico(licao, 'esbeltez'), regua),
      blocoGrafico(grafico(licao, 'flambagem'), flamb),
      blocoGrafico(grafico(licao, 'envoltoria'), envol),
      painelArmadura(grafico(licao, 'armadura3d'), c, ctx),
      tabelaLista({ id: 'lista', titulo: 'Lista de ferros', paraQueServe: grafico(LICOES.find((l) => l.id === 'viga'), 'lista').paraQueServe, comoLer: 'Barras longitudinais (N1) e estribos; o comprimento das longitudinais inclui a espera para o lance de cima.' }, c.posicoes),
    );
    desenharRegua(lam, lam1);
    if (animarJunto) anim.rodar(2000, (k) => { desenharFlambagem(suave(k), e); desenharEnvoltoria(r, suave(k)); });
    else { desenharFlambagem(1, e); desenharEnvoltoria(r, 1); }
  }
  const agendar = adiador(350, () => calcularEDesenhar(false));
  const muda = (k) => (v) => { st[k] = v; agendar(); };
  calcularEDesenhar(true);
  return [
    h('div', { class: 'apr-controles' },
      h('div', { class: 'apr-desls' },
        deslizante({ rotulo: 'Comprimento (le)', min: 2, max: 8, passo: 0.1, valor: st.comprimento, unidade: 'm', casas: 1, aoMudar: muda('comprimento') }),
        deslizante({ rotulo: 'Lado bx', min: 15, max: 60, passo: 5, valor: st.bx, unidade: 'cm', aoMudar: muda('bx') }),
        deslizante({ rotulo: 'Lado by', min: 15, max: 60, passo: 5, valor: st.by, unidade: 'cm', aoMudar: muda('by') }),
        deslizante({ rotulo: 'Carga Nk', min: 100, max: 3000, passo: 50, valor: st.Nk, unidade: 'kN', aoMudar: muda('Nk') })),
      ui.botao({ texto: 'Animar', icone: 'calcular', tipo: 'primario', aoClicar: () => calcularEDesenhar(true) })),
    area,
  ];
}

const RENDER = { caminho: licaoCaminho, esforcos: licaoEsforcos, flexao: licaoFlexao, viga: licaoViga, laje: licaoLaje, pilar: licaoPilar };

/* ------------------------------------------------------------------ aba */

let licaoPedida = null;
/** Lição a mostrar na próxima vez que a aba for desenhada (menu Aprender → lição). */
export function pedirLicao(id) { if (LICOES.some((l) => l.id === id)) licaoPedida = id; }

export function abaAprender() {
  let atual = LICOES[0].id;
  let limpezas = [];
  return {
    id: 'aprender',
    icone: 'aprender',
    titulo: () => 'Aprender',
    dica: () => 'Aprender cálculo estrutural: lições animadas',
    render(container) {
      const indice = h('nav', { class: 'apr-indice', 'aria-label': 'Lições' });
      const corpo = h('div', { class: 'apr-corpo' });
      const pagina = h('div', { class: 'pagina aprender' },
        ui.cabecalhoObjeto({
          rotulo: 'Ajuda', numero: 'EDU', simbolo: 'aprender', etiquetas: ['LEBR', 'Ensino', 'Concreto armado'],
          linha1: 'Aprender cálculo estrutural', linha2: `${LICOES.length} lições com animações, gráficos explicados e armadura em 3D`,
          titulo: 'Aprender', subtitulo: 'Do caminho das cargas à armadura: mexa nos valores e veja a estrutura responder', compacto: true,
        }),
        h('p', { class: 'apr-intro' }, 'Cada lição tem um objetivo, controles para mudar os dados, gráficos animados — cada um com "para que serve" e "como ler" — e, nas lições de viga, laje e pilar, o cálculo feito pelos mesmos módulos da página de edição, com a lista de ferros e a armadura em 3D. Os valores são para estudo: ', h('b', null, 'não use as lições para projetar'), '.'),
        h('div', { class: 'apr-layout' }, indice, corpo));
      container.append(pagina);

      const abrir = (id) => {
        for (const f of limpezas) { try { f(); } catch { /* nada */ } }
        limpezas = [];
        atual = id;
        const k = LICOES.findIndex((l) => l.id === id);
        const l = LICOES[k];
        for (const b of indice.querySelectorAll('button')) b.classList.toggle('ativo', b.dataset.id === id);
        const ctx = { limpezas };
        let conteudo;
        try { conteudo = RENDER[id](l, ctx); } catch (err) { console.error(err); conteudo = h('p', { class: 'apr-aviso' }, `Não foi possível montar a lição: ${err.message}`); }
        limpar(corpo).append(
          h('header', { class: 'apr-cab' },
            h('span', { class: 'apr-num-licao' }, l.numero),
            h('div', null, h('h2', null, l.titulo), h('p', { class: 'apr-objetivo' }, h('b', null, 'Objetivo: '), l.objetivo))),
          h('div', { class: 'apr-duas' },
            h('ol', { class: 'apr-passos' }, l.passos.map((p) => h('li', null, p))),
            h('dl', { class: 'apr-conceitos' }, l.conceitos.flatMap(([t, d]) => [h('dt', null, t), h('dd', null, d)]))),
          ...[conteudo].flat(),
          h('aside', { class: 'apr-pergunta' }, h('strong', null, icone('info', { tamanho: 14, traco: 2 }), 'Para pensar'), h('p', null, l.pergunta)),
          h('div', { class: 'apr-nav' },
            k > 0 ? ui.botao({ texto: `← ${LICOES[k - 1].titulo}`, tipo: 'fantasma', aoClicar: () => abrir(LICOES[k - 1].id) }) : h('span'),
            k < LICOES.length - 1 ? ui.botao({ texto: `${LICOES[k + 1].titulo} →`, tipo: 'secundario', aoClicar: () => abrir(LICOES[k + 1].id) }) : h('span')),
        );
        corpo.closest('.pagina')?.parentElement?.scrollTo?.({ top: 0, behavior: 'smooth' });
      };
      if (licaoPedida) { atual = licaoPedida; licaoPedida = null; }
      for (const l of LICOES) {
        indice.append(h('button', { type: 'button', class: 'apr-item', dataset: { id: l.id }, onClick: () => abrir(l.id) },
          h('span', { class: 'apr-item-num' }, l.numero),
          h('span', { class: 'apr-item-txt' }, h('strong', null, l.titulo), h('small', null, l.resumo))));
      }
      abrir(atual);
    },
    fechar() { for (const f of limpezas) { try { f(); } catch { /* nada */ } } limpezas = []; },
  };
}
