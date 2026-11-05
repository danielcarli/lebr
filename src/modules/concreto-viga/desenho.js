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
 * Desenhos SVG da viga: esquema estático, diagramas de esforços e seção transversal.
 * Recebe `s` (criador de SVG) da API para funcionar também em módulos externos.
 */

const fmt = (v, c = 2) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');

export function criarDesenhos({ s }) {
  /** Desenha um apoio na posição x (px) sob a linha da viga em y. */
  function apoio(tipo, x, y, lado) {
    if (tipo === 'apoio') {
      return s('g', { class: 'dg-apoio' },
        s('path', { d: `M${x},${y + 5} l-11,18 h22 z` }),
        s('line', { x1: x - 16, y1: y + 27, x2: x + 16, y2: y + 27 }));
    }
    if (tipo === 'engaste') {
      const dx = lado === 'esq' ? -1 : lado === 'dir' ? 1 : 0;
      if (dx === 0) return s('g', { class: 'dg-apoio' }, s('rect', { x: x - 9, y: y - 16, width: 18, height: 32, class: 'dg-engaste' }));
      const hach = [];
      for (let i = -18; i <= 14; i += 7) hach.push(s('line', { x1: x, y1: y + i, x2: x + 8 * dx, y2: y + i + 7, class: 'dg-hachura' }));
      return s('g', { class: 'dg-apoio' }, s('line', { x1: x, y1: y - 20, x2: x, y2: y + 20, class: 'dg-engaste-linha' }), ...hach);
    }
    return null;
  }

  /** Esquema estático com vãos cotados — usado no editor (atualiza ao vivo). */
  function esquema(el, { largura = 1000 } = {}) {
    const total = el.vaos.reduce((a, v) => a + (v.L > 0 ? v.L : 0), 0) || 1;
    const m = 50, W = largura, H = 118, y = 46;
    const esc = (W - 2 * m) / total;
    const xs = [m];
    el.vaos.forEach((v) => xs.push(xs[xs.length - 1] + Math.max(0, v.L) * esc));
    const filhos = [
      s('line', { x1: xs[0], y1: y, x2: xs[xs.length - 1], y2: y, class: 'dg-viga' }),
    ];
    // carga distribuída simbólica
    for (let x = xs[0]; x <= xs[xs.length - 1] + 0.1; x += 24) filhos.push(s('line', { x1: x, y1: 14, x2: x, y2: y - 6, class: 'dg-seta' }));
    filhos.push(s('line', { x1: xs[0], y1: 14, x2: xs[xs.length - 1], y2: 14, class: 'dg-seta' }));
    el.apoios.forEach((t, k) => {
      const lado = k === 0 ? 'esq' : k === el.apoios.length - 1 ? 'dir' : 'meio';
      const a = apoio(t, xs[k], y, lado);
      if (a) filhos.push(a);
      filhos.push(s('text', { x: xs[k], y: H - 4, class: 'dg-rot', 'text-anchor': 'middle' }, `A${k + 1}`));
    });
    el.vaos.forEach((v, i) => {
      const xa = xs[i], xb = xs[i + 1];
      filhos.push(
        s('line', { x1: xa, y1: H - 26, x2: xb, y2: H - 26, class: 'dg-cota' }),
        s('line', { x1: xa, y1: H - 31, x2: xa, y2: H - 21, class: 'dg-cota' }),
        s('line', { x1: xb, y1: H - 31, x2: xb, y2: H - 21, class: 'dg-cota' }),
        s('text', { x: (xa + xb) / 2, y: H - 31, class: 'dg-texto', 'text-anchor': 'middle' }, `${fmt(v.L)} m`),
      );
    });
    return s('svg', { class: 'desenho esquema', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMidYMid meet' }, ...filhos);
  }

  /** Diagramas de momento fletor, cortante e flecha a partir do resultado. */
  function diagramas(el, res, { tituloFlecha = 'FLECHA IMEDIATA (ELS QUASE PERMANENTE)' } = {}) {
    const { x, Md, Vd, flecha } = res.diagrama;
    // envoltória: Md/Vd são os máximos e MdMin/VdMin os mínimos (resultados até a 0.9 só têm uma curva)
    const MdMin = res.diagrama.MdMin ?? Md, VdMin = res.diagrama.VdMin ?? Vd;
    const total = x[x.length - 1] || 1;
    const W = 1000, m = 50, esc = (W - 2 * m) / total;
    const X = (v) => m + v * esc;
    const filhos = [];
    let y0 = 0;

    const painel = (titulo, valores, altura, { invertido, classe, unidade, casas = 2, valoresMin = null, legenda = null }) => {
      const series = valoresMin && valoresMin.some((v, i) => Math.abs(v - valores[i]) > 1e-6) ? [valores, valoresMin] : [valores];
      const maxAbs = Math.max(1e-9, ...series.flat().map(Math.abs));
      // legenda das linhas, numa linha própria logo abaixo do título
      const itens = typeof legenda === 'function' ? legenda(series.length) : legenda;
      const dy = itens?.length ? 22 : 0;
      const base = y0 + 24 + dy + altura / 2;
      const Y = (v) => base + (invertido ? 1 : -1) * (v / maxAbs) * (altura / 2 - 6);
      filhos.push(s('text', { x: 0, y: y0 + 12, class: 'dg-titulo' }, titulo));
      if (itens?.length) {
        let lx = 0;
        const ly = y0 + 29;
        for (const it of itens) {
          filhos.push(s('line', { x1: lx, y1: ly - 3.5, x2: lx + 26, y2: ly - 3.5, class: `dg-area dg-leg-amostra ${it.classe ?? classe}${it.min ? ' envolvente-min' : ''}` }));
          filhos.push(s('text', { x: lx + 32, y: ly, class: 'dg-leg' }, it.texto));
          lx += 32 + it.texto.length * 4.9 + 30;
        }
      }
      for (const [k, serie] of series.entries()) {
        const d = `M${X(x[0])},${base} ` + x.map((xi, i) => `L${X(xi)},${Y(serie[i])}`).join(' ') + ` L${X(x[x.length - 1])},${base} Z`;
        filhos.push(s('path', { d, class: `dg-area ${classe}${k ? ' envolvente-min' : ''}` }));
      }
      filhos.push(s('line', { x1: X(0), y1: base, x2: X(total), y2: base, class: 'dg-eixo' }));
      // rótulos dos extremos locais relevantes (das duas curvas da envoltória)
      const usados = [];
      for (const serie of series) {
        for (const i of extremos(serie, x)) {
          if (Math.abs(serie[i]) < maxAbs * 0.04) continue;
          const px = X(x[i]);
          const py = Y(serie[i]);
          if (usados.some(([ux, uy]) => Math.abs(ux - px) < 60 && Math.abs(uy - py) < 22)) continue;
          usados.push([px, py]);
          const acima = (invertido ? serie[i] < 0 : serie[i] > 0);
          filhos.push(s('circle', { cx: px, cy: py, r: 3.2, class: `dg-ponto ${classe}` }));
          filhos.push(s('text', { x: px, y: py + (acima ? -8 : 17), class: 'dg-valor', 'text-anchor': 'middle' }, fmt(serie[i], casas)));
        }
      }
      filhos.push(s('text', { x: W, y: y0 + 12, class: 'dg-unid', 'text-anchor': 'end' }, unidade));
      y0 += altura + 34 + dy;
    };

    // viga
    filhos.push(s('line', { x1: X(0), y1: 20, x2: X(total), y2: 20, class: 'dg-viga' }));
    const xs = [0];
    el.vaos.forEach((v) => xs.push(xs[xs.length - 1] + v.L));
    (res.apoios ?? []).forEach((a, k) => {
      const ap = apoio(a.tipo, X(xs[k]), 20, k === 0 ? 'esq' : k === el.apoios.length - 1 ? 'dir' : 'meio');
      if (ap) filhos.push(ap);
    });
    y0 = 62;
    // com duas curvas: contínua = maior valor de cada seção entre as combinações, tracejada = menor valor
    const legEnvoltoria = (sim, extra = ['', '']) => (n) => n > 1 ? [
      { texto: `Contínua: ${sim},máx — máximo entre as combinações${extra[0]}` },
      { texto: `Tracejada: ${sim},mín — mínimo entre as combinações${extra[1]}`, min: true },
    ] : [{ texto: `Contínua: ${sim} de cálculo` }];
    painel('MOMENTO FLETOR DE CÁLCULO — ENVOLTÓRIA ELU', Md, 150, { invertido: true, classe: 'momento', unidade: 'kN·m', valoresMin: MdMin, legenda: legEnvoltoria('MSd', [' (dimensiona os positivos)', ' (dimensiona os negativos)']) });
    painel('FORÇA CORTANTE DE CÁLCULO — ENVOLTÓRIA ELU', Vd, 110, { classe: 'cortante', unidade: 'kN', valoresMin: VdMin, legenda: legEnvoltoria('VSd') });
    if (res.diagrama.Td?.length === x.length) painel('MOMENTO TORÇOR DE CÁLCULO — ENVOLTÓRIA ELU', res.diagrama.Td, 90, { classe: 'torcao', unidade: 'kN·m', legenda: [{ texto: 'Pontilhada: TSd — momento torçor de cálculo' }] });
    if (flecha?.length === x.length) painel(tituloFlecha, flecha.map((v) => v), 64, { invertido: true, classe: 'flecha', unidade: 'mm', legenda: [{ texto: 'Tracejada: linha elástica — deslocamento vertical da viga' }] });

    return s('svg', { class: 'desenho diagramas', viewBox: `0 0 ${W} ${y0}`, preserveAspectRatio: 'xMidYMin meet' }, ...filhos);
  }

  /** Índices de máximos/mínimos locais e extremidades com valor. */
  function extremos(v, x) {
    const out = [];
    for (let i = 0; i < v.length; i++) {
      const a = v[i - 1] ?? -Infinity, b = v[i + 1] ?? -Infinity;
      const a2 = v[i - 1] ?? Infinity, b2 = v[i + 1] ?? Infinity;
      if ((v[i] >= a && v[i] >= b && v[i] > 0) || (v[i] <= a2 && v[i] <= b2 && v[i] < 0)) {
        if (!out.length || Math.abs(x[i] - x[out[out.length - 1]]) > 1e-6) out.push(i);
      }
    }
    return out;
  }

  /**
   * Seção transversal com as barras como pontos (referência ao calendário).
   * @param {{b:number,h:number}} secao  cm
   * @param {{n:number, phi:number, camadas:number}} inf  armadura inferior
   * @param {{n:number, phi:number}} sup  armadura superior
   */
  function secao({ b, h }, { inf, sup, phiT = 5, cob = 3, titulo, laje = null }) {
    const H = 190, esc = Math.min((H - 40) / h, 150 / b);
    const w = b * esc, hh = h * esc, x0 = 30, y0 = 18;
    const o = (cob + phiT / 10) * esc;
    // trecho da laje junto à viga: em cima (viga normal) ou embaixo (viga invertida)
    const hf = Math.min(hh * 0.3, 10 * esc), aba = 22;
    const yLaje = laje === 'inferior' ? y0 + hh - hf : y0;
    const filhos = laje ? [
      s('rect', { x: x0 - aba, y: yLaje, width: aba, height: hf, class: 'sec-laje' }),
      s('rect', { x: x0 + w, y: yLaje, width: aba, height: hf, class: 'sec-laje' }),
      ...(laje === 'inferior' ? [s('text', { x: x0 + w + aba + 6, y: yLaje + hf - 1, class: 'dg-texto' }, 'laje')] : []),
    ] : [];
    filhos.push(
      s('rect', { x: x0, y: y0, width: w, height: hh, class: 'sec-concreto' }),
      s('rect', { x: x0 + cob * esc, y: y0 + cob * esc, width: w - 2 * cob * esc, height: hh - 2 * cob * esc, rx: 4, class: 'sec-estribo' }),
    );
    const linha = (n, phi, y, classe) => {
      const r = Math.max(2.5, (phi / 20) * esc);
      const xa = x0 + o + r, xb = x0 + w - o - r;
      for (let i = 0; i < n; i++) {
        const x = n === 1 ? (xa + xb) / 2 : xa + ((xb - xa) * i) / (n - 1);
        filhos.push(s('circle', { cx: x, cy: y, r, class: classe }));
      }
      return r;
    };
    if (inf) {
      const porCamada = Math.ceil(inf.n / (inf.camadas || 1));
      let restantes = inf.n;
      for (let c = 0; c < (inf.camadas || 1); c++) {
        const n = Math.min(porCamada, restantes);
        restantes -= n;
        const r = Math.max(2.5, (inf.phi / 20) * esc);
        linha(n, inf.phi, y0 + hh - o - r - c * (2 * r + Math.max(2, inf.phi / 10) * esc), 'sec-barra');
      }
    }
    const topo = sup ?? { n: 2, phi: 8, porta: true };
    const rt = Math.max(2.5, (topo.phi / 20) * esc);
    linha(topo.n, topo.phi, y0 + o + rt, topo.porta ? 'sec-barra porta' : 'sec-barra negativa');
    filhos.push(
      s('text', { x: x0 + w / 2, y: y0 + hh + 18, class: 'dg-texto', 'text-anchor': 'middle' }, `${fmt(b, 0)} cm`),
      s('text', { x: x0 - 8, y: y0 + hh / 2, class: 'dg-texto', 'text-anchor': 'middle', transform: `rotate(-90 ${x0 - 8} ${y0 + hh / 2})` }, `${fmt(h, 0)} cm`),
    );
    if (titulo) filhos.push(s('text', { x: x0 + w + 16, y: y0 + 12, class: 'dg-titulo' }, titulo));
    const W = Math.max(x0 + w + 16, 0) + 150;
    return s('svg', { class: 'desenho secao-viga', viewBox: `0 0 ${W} ${H + 10}`, width: W, height: H + 10 }, ...filhos);
  }

  /**
   * Elevação da viga com a armação: as barras dentro da peça e, fora dela, cada posição desenhada à parte
   * (negativas e porta-estribos acima, positivas abaixo), com ganchos, número, quantidade, bitola e comprimento.
   * @param {object} el  viga (vãos e apoios)
   * @param {object} det resultado.detalhamento ({ posicoes, larguras, limites })
   * @param {object[]} posicoes posições já com as edições aplicadas
   */
  function elevacao(el, det, posicoes, { destaque = null } = {}) {
    const L = el.vaos.map((v) => v.L);
    const X = [0];
    for (const l of L) X.push(X[X.length - 1] + l);
    const Lt = X[X.length - 1];
    const larg = det.larguras ?? X.map(() => 20);
    const ini = el.apoios[0] === 'livre' ? 0 : -larg[0] / 200;
    const fim = el.apoios[el.apoios.length - 1] === 'livre' ? Lt : Lt + larg[larg.length - 1] / 200;
    const W = 1000, m = 46, esc = (W - 2 * m) / (fim - ini || 1);
    const PX = (x) => m + (x - ini) * esc;
    const linhaH = 30, hViga = 64, gancho = 9;
    const rotulo = (q) => `${q.N} · ${q.n} ø${fmt(q.phi, 1).replace(',0', '')} · C = ${fmt(q.comprimento, 0)}`;
    const larguraTexto = (t) => t.length * 6.4;

    // empacota as barras em linhas sem sobreposição (barra + texto)
    const empacotar = (lista) => {
      const linhas = [];
      for (const q of lista) {
        const a = PX(q.x0), z = PX(q.x1), c = (a + z) / 2, tw = larguraTexto(rotulo(q)) / 2 + 8;
        const ext = [Math.min(a, c - tw) - 10, Math.max(z, c + tw) + 10];
        let i = linhas.findIndex((ln) => ln.every(([p0, p1]) => ext[1] < p0 || ext[0] > p1));
        if (i < 0) { linhas.push([]); i = linhas.length - 1; }
        linhas[i].push(ext);
        q._linha = i;
      }
      return linhas.length;
    };
    const longas = posicoes.filter((q) => q.tipo !== 'estribo' && Number.isFinite(q.x0));
    const sup = longas.filter((q) => q.face === 'superior').sort((a, b) => (b.x1 - b.x0) - (a.x1 - a.x0));
    const inf = longas.filter((q) => q.face === 'inferior').sort((a, b) => (b.x1 - b.x0) - (a.x1 - a.x0));
    const lat = longas.filter((q) => q.face === 'lateral');
    const nSup = empacotar(sup), nInf = empacotar([...inf, ...lat]);
    const est = posicoes.filter((q) => q.tipo === 'estribo');

    const filhos = [];
    const topoSup = 26;
    const yViga = topoSup + nSup * linhaH + 18;
    const yBase = yViga + hViga;
    // apoios (pilares) cortados acima e abaixo da viga
    el.apoios.forEach((t, k) => {
      if (t === 'livre') return;
      const w = Math.max(6, (larg[k] / 100) * esc), x = PX(X[k]) - w / 2;
      filhos.push(s('rect', { x, y: yBase, width: w, height: 22, class: 'det-apoio' }));
      filhos.push(s('rect', { x, y: yViga - 14, width: w, height: 14, class: 'det-apoio' }));
      filhos.push(s('text', { x: PX(X[k]), y: yBase + 34, class: 'dg-rot', 'text-anchor': 'middle' }, `A${k + 1}`));
    });
    filhos.push(s('rect', { x: PX(ini), y: yViga, width: (fim - ini) * esc, height: hViga, class: 'det-viga' }));
    // estribos dentro da viga
    for (const e of est) {
      for (const t of e.trechos ?? []) {
        const n = Math.max(1, t.qtd);
        for (let i = 0; i < n; i++) {
          const x = PX(t.x0 + ((t.x1 - t.x0) * (n === 1 ? 0.5 : i / (n - 1))));
          filhos.push(s('line', { x1: x, y1: yViga + 5, x2: x, y2: yBase - 5, class: `det-estribo${destaque === e.id ? ' destaque' : ''}` }));
        }
        const xm = PX((t.x0 + t.x1) / 2);
        filhos.push(s('text', { x: xm, y: yViga + hViga / 2 + 4, class: 'det-rot-estribo', 'text-anchor': 'middle' }, `${e.N} · ${t.qtd} ø${fmt(e.phi, 1).replace(',0', '')} c/ ${fmt(t.s, 1).replace(',0', '')}`));
      }
    }
    // barras dentro da viga
    const dentro = (q, y) => s('line', { x1: PX(q.x0), y1: y, x2: PX(q.x1), y2: y, class: `det-barra ${q.tipo === 'porta-estribo' || q.tipo === 'construtiva' ? 'porta' : q.face === 'superior' ? 'negativa' : ''}${destaque === q.id ? ' destaque' : ''}` });
    for (const q of sup) filhos.push(dentro(q, yViga + 5 + Math.min(q._linha, 2) * 2));
    for (const q of inf) filhos.push(dentro(q, yBase - 5 - Math.min(q._linha, 2) * 2));
    // barras extraídas
    const barra = (q, y, para) => {
      const a = PX(q.x0), z = PX(q.x1);
      const cls = `det-barra ${q.tipo === 'porta-estribo' || q.tipo === 'construtiva' ? 'porta' : q.face === 'superior' ? 'negativa' : q.face === 'lateral' ? 'lateral' : ''}${destaque === q.id ? ' destaque' : ''}`;
      let d = `M${a},${y} L${z},${y}`;
      if (q.gancho?.[0]) d = `M${a},${y + para * gancho} L${a},${y} L${z},${y}`;
      if (q.gancho?.[1]) d += ` L${z},${y + para * gancho}`;
      const g = s('g', { class: `det-pos${q.editada ? ' editada' : ''}`, 'data-pos': q.id },
        s('path', { d, class: cls }),
        s('text', { x: (a + z) / 2, y: y - 5, class: 'det-rot', 'text-anchor': 'middle' }, rotulo(q)),
      );
      filhos.push(g);
    };
    for (const q of sup) barra(q, topoSup + (nSup - 1 - q._linha) * linhaH + 14, 1);
    const yInf = yBase + 62;
    for (const q of [...inf, ...lat]) barra(q, yInf + q._linha * linhaH, -1);
    // cotas dos vãos
    const yCota = yInf + nInf * linhaH + 6;
    L.forEach((l, i) => {
      const a = PX(X[i]), z = PX(X[i + 1]);
      filhos.push(
        s('line', { x1: a, y1: yCota, x2: z, y2: yCota, class: 'dg-cota' }),
        s('line', { x1: a, y1: yCota - 5, x2: a, y2: yCota + 5, class: 'dg-cota' }),
        s('line', { x1: z, y1: yCota - 5, x2: z, y2: yCota + 5, class: 'dg-cota' }),
        s('text', { x: (a + z) / 2, y: yCota - 5, class: 'dg-texto', 'text-anchor': 'middle' }, `${fmt(l)} m`),
      );
    });
    filhos.unshift(s('text', { x: 0, y: 12, class: 'dg-titulo' }, `ELEVAÇÃO E ARMAÇÃO — ${el.codigo ?? ''} (${fmt(el.secao.b, 0)} × ${fmt(el.secao.h, 0)} cm)`));
    const H = yCota + 14;
    return s('svg', { class: 'desenho elevacao-viga', viewBox: `0 0 ${W} ${H}`, preserveAspectRatio: 'xMidYMin meet' }, ...filhos);
  }

  return { esquema, diagramas, secao, elevacao };
}
