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
/** Módulo de radier: entrada, planta com os pilares e as faixas, punção, lista de ferros e armadura em 3D. */
import { calcularRadier, criarRadier, pilaresDoRadier, COBRIMENTO_SOLO } from './calculo.js';
import { secaoListaDeFerros } from '../comum/detalhamento-ui.js';
import { modeloRadier } from '../comum/armadura3d-fundacoes.js';

const fmt = (v, c = 0) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');

export default function moduloRadier(api) {
  const { h, s } = api.dom;
  const ui = api.ui;
  const { num } = api.formatar;

  /** Planta: contorno, linhas de pilares (faixas), pilares com o contorno C′ de punção e o carregamento por pilar. */
  function planta(r) {
    const W = 560, H = 420, m = 50;
    const esc = Math.min((W - 2 * m) / r.lx, (H - 2 * m) / r.ly);
    const X = (u) => m + u * esc, Y = (v) => H - m - v * esc;
    const f = [s('rect', { x: X(0), y: Y(r.ly), width: r.lx * esc, height: r.ly * esc, class: 'sap-base' })];
    for (const u of r.linhas.x) f.push(s('line', { x1: X(u), y1: Y(0), x2: X(u), y2: Y(r.ly), class: 'rad-linha' }));
    for (const v of r.linhas.y) f.push(s('line', { x1: X(0), y1: Y(v), x2: X(r.lx), y2: Y(v), class: 'rad-linha' }));
    const d = (r.d ?? 25) / 100;
    // o contorno C′ dos pilares de borda e de canto é cortado pela borda do radier
    const clip = `rad-clip-${Math.random().toString(36).slice(2, 8)}`;
    f.push(s('clipPath', { id: clip }, s('rect', { x: X(0), y: Y(r.ly), width: r.lx * esc, height: r.ly * esc })));
    for (const p of r.pilares) {
      const pu = r.puncao.find((x) => x.codigo === p.codigo);
      const rx = p.bx / 200 + 2 * d, ry = p.by / 200 + 2 * d;
      f.push(
        s('rect', { x: X(p.u - rx), y: Y(p.v + ry), width: 2 * rx * esc, height: 2 * ry * esc, rx: 2 * d * esc, class: `rad-puncao ${pu?.ok === false ? 'falha' : ''}`, 'clip-path': `url(#${clip})` }),
        s('rect', { x: X(p.u - p.bx / 200), y: Y(p.v + p.by / 200), width: (p.bx / 100) * esc, height: (p.by / 100) * esc, class: 'sap-pilar' }),
        s('text', { x: p.u > r.lx / 2 ? X(p.u) - 6 : X(p.u) + 6, y: Y(p.v) - (p.by / 200) * esc - 6, class: 'dg-texto', 'text-anchor': p.u > r.lx / 2 ? 'end' : 'start' }, `${p.codigo} · ${fmt(p.Nk)} kN`),
      );
    }
    f.push(
      s('line', { x1: X(0), y1: Y(0) + 20, x2: X(r.lx), y2: Y(0) + 20, class: 'dg-cota' }),
      s('text', { x: X(r.lx / 2), y: Y(0) + 36, class: 'dg-texto', 'text-anchor': 'middle' }, `lx = ${fmt(r.lx, 2)} m`),
      s('line', { x1: X(r.lx) + 20, y1: Y(0), x2: X(r.lx) + 20, y2: Y(r.ly), class: 'dg-cota' }),
      s('text', { x: X(r.lx) + 26, y: Y(r.ly / 2), class: 'dg-texto', transform: `rotate(90 ${X(r.lx) + 26} ${Y(r.ly / 2)})`, 'text-anchor': 'middle' }, `ly = ${fmt(r.ly, 2)} m`),
      s('text', { x: X(0), y: 20, class: 'dg-titulo' }, 'PLANTA DO RADIER'),
      s('text', { x: X(0), y: 36, class: 'sap-rot' }, 'tracejado: linhas de pilares (faixas) · contorno arredondado: C′ de punção a 2d'),
    );
    return s('svg', { class: 'desenho rad-planta', viewBox: `0 0 ${W} ${H}`, width: W, height: H }, ...f);
  }

  return {
    id: 'concreto.radier',
    nome: 'Radier',
    nomeCurto: 'Radier',
    categoria: 'fundacoes',
    novaCategoria: { id: 'fundacoes', nome: 'Fundações', ordem: 4 },
    prefixo: 'R',
    sigla: 'CRD',
    icone: 'laje',
    forma: 'laje',
    material: 'Concreto armado',
    norma: 'NBR 6122:2019 · NBR 6118:2023',
    versao: '0.1.0',
    descricao: 'Radier sob os pilares da fundação pelo método rígido: pressão no solo, faixas como laje invertida, punção, malhas e armadura em 3D.',
    montagem: false,

    criar: criarRadier,
    calcular: (el, ctx) => calcularRadier(el, ctx),
    resumo: (el) => (el.resultado && !el.resultado.erro ? `${num(el.resultado.lx, 2)} × ${num(el.resultado.ly, 2)} m · h = ${num(el.resultado.h, 0)} cm` : 'radier'),

    renderEntrada(raiz, ctx) {
      const el = ctx.elemento;
      const lista = pilaresDoRadier(el, ctx.projeto);
      raiz.append(ui.secao({
        numero: '01', titulo: 'Pilares e cargas', descricao: 'Pilares que chegam à fundação e não têm sapata nem bloco; a carga de cada um vem dos elementos (ou do pórtico)',
        filhos: [
          h('p', { class: 'combinacoes-nota' }, lista.length ? `Sobre o radier: ${lista.map((x) => x.pilar.codigo).join(', ')}.` : 'Nenhum pilar de fundação livre: os pilares já têm sapata ou bloco.'),
          ui.linhaCampos(
            ui.campo({ rotulo: 'Piso g', valor: el.cargas?.g ?? 0, unidade: 'kN/m²', casas: 2, min: 0, largura: '140px', dica: 'Contrapiso e revestimento do térreo sobre o radier', aoMudar: (v) => ctx.alterar((e) => { e.cargas = { ...(e.cargas ?? {}), g: v }; }) }),
            ui.campo({ rotulo: 'Piso q', valor: el.cargas?.q ?? 0, unidade: 'kN/m²', casas: 2, min: 0, largura: '140px', dica: 'Uso do térreo (NBR 6120)', aoMudar: (v) => ctx.alterar((e) => { e.cargas = { ...(e.cargas ?? {}), q: v }; }) }),
          ),
        ],
      }));
      raiz.append(ui.secao({
        numero: '02', titulo: 'Solo', descricao: 'NBR 6122:2019',
        filhos: [ui.linhaCampos(
          ui.campo({ rotulo: 'σadm', valor: el.solo?.tensao ?? 100, unidade: 'kPa', casas: 0, min: 20, max: 1000, largura: '140px', aoMudar: (v) => ctx.alterar((e) => { e.solo = { ...(e.solo ?? {}), tensao: v }; }) }),
          ui.campo({ rotulo: 'Profundidade da base', valor: el.profundidade ?? 0.5, unidade: 'm', casas: 2, min: 0.1, max: 5, largura: '170px', aoMudar: (v) => ctx.alterar((e) => { e.profundidade = v; }) }),
        )],
      }));
      const g = el.geometria ?? {};
      const manual = g.modo === 'manual';
      raiz.append(ui.secao({
        numero: '03', titulo: 'Geometria', descricao: 'Contorno retangular; espessura constante',
        filhos: [
          ui.segmentado({ rotulo: 'Contorno e espessura', valor: manual ? 'manual' : 'automatica', opcoes: [{ valor: 'automatica', texto: 'Automáticos' }, { valor: 'manual', texto: 'Informados' }],
            aoMudar: (v) => ctx.alterar((e) => { const r = e.resultado; e.geometria = { ...(e.geometria ?? {}), modo: v, ...(v === 'manual' && r && !r.erro ? { lx: r.lx, ly: r.ly, h: r.h } : {}) }; if (v === 'manual' && r && !r.erro) e.local = { ...r.local }; }, { estrutural: true }) }),
          manual ? ui.linhaCampos(
            ui.campo({ rotulo: 'Canto x', valor: el.local?.x ?? 0, unidade: 'm', casas: 2, largura: '120px', aoMudar: (v) => ctx.alterar((e) => { e.local = { ...(e.local ?? {}), x: v }; }) }),
            ui.campo({ rotulo: 'Canto y', valor: el.local?.y ?? 0, unidade: 'm', casas: 2, largura: '120px', aoMudar: (v) => ctx.alterar((e) => { e.local = { ...(e.local ?? {}), y: v }; }) }),
            ui.campo({ rotulo: 'lx', valor: g.lx, unidade: 'm', casas: 2, min: 1, max: 200, largura: '110px', aoMudar: (v) => ctx.alterar((e) => { e.geometria.lx = v; }) }),
            ui.campo({ rotulo: 'ly', valor: g.ly, unidade: 'm', casas: 2, min: 1, max: 200, largura: '110px', aoMudar: (v) => ctx.alterar((e) => { e.geometria.ly = v; }) }),
            ui.campo({ rotulo: 'Espessura h', valor: g.h, unidade: 'cm', casas: 0, min: 15, max: 200, largura: '140px', aoMudar: (v) => ctx.alterar((e) => { e.geometria.h = v; }) }),
          ) : ui.linhaCampos(
            ui.campo({ rotulo: 'Balanço além dos pilares', valor: g.balanco ?? 0.5, unidade: 'm', casas: 2, min: 0, max: 5, largura: '200px', aoMudar: (v) => ctx.alterar((e) => { e.geometria = { ...(e.geometria ?? {}), balanco: v }; }) }),
            h('p', { class: 'combinacoes-nota' }, 'Contorno: o retângulo que envolve os pilares mais o balanço. Espessura: a menor, em múltiplos de 5 cm, que atende à punção e à flexão sem armadura dupla.'),
          ),
          ui.linhaCampos(ui.campo({ rotulo: 'Cobrimento', valor: el.cobrimento, unidade: 'cm', casas: 1, min: 2, max: 10, largura: '140px', dica: `Contato com o solo — NBR 6118, Tabela 7.2 (CAA ${ctx.projeto.parametros.classeAgressividade}: ${num(COBRIMENTO_SOLO[ctx.projeto.parametros.classeAgressividade] ?? 3, 1)} cm)`, aoMudar: (v) => ctx.alterar((e) => { e.cobrimento = v; }) })),
        ],
      }));
    },

    renderResultado(raiz, r, ctx) {
      const uso = r.tensoes.med / r.sigmaAdm;
      raiz.append(h('div', { class: 'instrumentos' },
        ui.numeroGrande({ rotulo: 'Radier', valor: `${num(r.lx, 2)} × ${num(r.ly, 2)}`, unidade: 'm', linhas: [`h = ${num(r.h, 0)} cm · ${num(r.volume, 2)} m³`, `${r.pilares.length} pilares`] }),
        ui.arco({ rotulo: 'Tensão no solo', valor: `${num(uso * 100, 0)}%`, fracao: uso, legenda: `σméd ${num(r.tensoes.med, 0)} de ${num(r.sigmaAdm, 0)} kPa` }),
        ui.numeroGrande({ rotulo: 'Carga total', valor: num(r.N, 0), unidade: 'kN', linhas: [`pilares Nd = ${num(r.Nd, 0)} kN`, `σd líquida ${num(r.sigD, 1)} kPa`] }),
        ui.numeroGrande({ rotulo: 'Punção', valor: r.puncao.every((p) => p.ok) ? 'atende' : 'não atende', linhas: [`maior τSd/τRd1 = ${num(Math.max(...r.puncao.map((p) => p.tauSd / p.tauRd1)) * 100, 0)} %`] }),
      ));
      raiz.append(ui.secao({
        numero: '04', titulo: 'Planta', descricao: `Tensões no solo: média ${num(r.tensoes.med, 0)}, máxima ${num(r.tensoes.max, 0)}, mínima ${num(r.tensoes.min, 0)} kPa`,
        filhos: [h('div', { class: 'desenho-caixa centro' }, planta(r))],
      }));
      raiz.append(ui.secao({
        numero: '05', titulo: 'Faixas e punção', descricao: 'Momentos de cálculo por metro e punção em cada pilar',
        filhos: [
          ui.tabela({
            classe: 'els-tabela',
            colunas: [{ titulo: 'Direção' }, { titulo: 'Maior vão (m)', alinhar: 'dir' }, { titulo: 'Balanço (m)', alinhar: 'dir' }, { titulo: 'M inferior', alinhar: 'dir' }, { titulo: 'Malha inferior' }, { titulo: 'M superior', alinhar: 'dir' }, { titulo: 'Malha superior' }],
            linhas: ['x', 'y'].map((k) => [k, num(r.momentos[k].lmax, 2), num(r.momentos[k].bmax, 2), num(r.momentos[k].inferior, 1), r.malhas.inferior[k]?.rotulo ?? '—', num(r.momentos[k].superior, 1), r.malhas.superior[k]?.rotulo ?? '—']),
          }),
          ui.tabela({
            classe: 'els-tabela',
            colunas: [{ titulo: 'Pilar' }, { titulo: 'τSd (MPa)', alinhar: 'dir' }, { titulo: 'τRd1 (MPa)', alinhar: 'dir' }, { titulo: '' }],
            linhas: r.puncao.map((p) => [p.codigo + (p.borda ? ' (borda)' : ''), num(p.tauSd), num(p.tauRd1), ui.selo(p.ok)]),
          }),
        ],
      }));
      if (ctx && r.detalhamento?.posicoes?.length) raiz.append(secaoListaDeFerros(api, ctx, r.detalhamento, {
        titulo: 'Ferragem do radier', descricao: 'Malhas inferior e superior nas duas direções e grampos de borda · lista de ferros editável',
        volume: r.volume,
        modelo3d: (posicoes) => modeloRadier(r, posicoes),
        nota: 'Malhas com pernas nas bordas; barras de mais de 12 m com emendas por traspasse alternadas. Armadura de punção não detalhada: se a punção não atender, aumente h.',
      }));
    },
  };
}
