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
 * Módulo: Escada de concreto armado (NBR 6118:2023 · NBR 6120:2019 · NBR 9050:2020).
 * Lances retos, em L e em U, com patamares; laje armada longitudinalmente; as reações dos apoios vão para as
 * vigas ligadas (pela posição na montagem ou pela carga lançada na viga).
 */
import { calcularEscada, criarEscada, geometriaDa, desnivelDa, vigasDosApoios, ligacoes as ligacoesEscada, cargasTransmitidas } from './calculo.js';
import { TIPOS_ESCADA, USO_ESCADA } from '../../engine/escada.js';
import { ligacoesDaEscada, aplicarLigacoes, pavimentosOrdenados } from '../../renderer/core/montagem.js';
import { secaoArmadura } from '../comum/armadura.js';

const fmt = (v, c = 2) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');
const ehViga = (e) => /(^|\.)viga$/.test(e.modulo);

/**
 * Refaz as ligações dos apoios nos pisos (de baixo e de chegada) pela posição da escada; as dos apoios
 * intermediários (patamar) são lançadas à mão e ficam como estão.
 * @returns {number} ligações criadas
 */
export function religarEscada(esc, projeto) {
  const intermediarios = new Set(['t1-fim', 't2-ini']);
  const nivel = (id) => (esc.tipo === 'reta' || !intermediarios.has(id) ? 'piso' : 'patamar');
  for (const x of projeto.elementos) {
    if (!Array.isArray(x.cargas)) continue;
    const antes = x.cargas.length;
    x.cargas = x.cargas.filter((c) => !(c?.tipo === 'elemento' && c.elementoId === esc.id && nivel(c.ligacao) === 'piso'));
    if (x.cargas.length !== antes && x.resultado) x.resultado.desatualizado = true;
  }
  if (!esc.posicao) return 0;
  const vigas = projeto.elementos.filter((e) => ehViga(e) && e.posicao);
  return aplicarLigacoes(projeto, ligacoesDaEscada(projeto, esc, vigas));
}

export default function moduloEscada(api) {
  const { h, s } = api.dom;
  const ui = api.ui;
  const { num, lerNumero } = api.formatar;

  /** Planta da escada (coordenadas locais), com degraus, patamares e apoios. */
  function planta(r) {
    const g = r.geometria;
    const W = 420, H = 380, m = 44;
    const esc = Math.min((W - 2 * m) / g.largura, (H - 2 * m - 10) / g.comprimento);
    const ox = (W - g.largura * esc) / 2, oy = H - m + 4;
    const P = (x, y) => [ox + x * esc, oy - y * esc];
    const f = [];
    const ret = (rr, classe) => { const [a, b] = [P(rr.x0, rr.y1), P(rr.x1, rr.y0)]; return s('rect', { x: a[0], y: a[1], width: b[0] - a[0], height: b[1] - a[1], class: classe }); };
    for (const p of g.patamares) f.push(ret(p, 'esc-patamar'));
    g.lances.forEach((l, i) => {
      f.push(ret(l, 'esc-lance'));
      const n = l.espelhos - 1;
      for (let k = 1; k < n; k++) {
        const fr = k / n;
        if (l.sentido[1] !== 0) { const y = l.y0 + fr * (l.y1 - l.y0); const [a, b] = [P(l.x0, y), P(l.x1, y)]; f.push(s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'esc-degrau' })); }
        else { const x = l.x0 + fr * (l.x1 - l.x0); const [a, b] = [P(x, l.y0), P(x, l.y1)]; f.push(s('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1], class: 'esc-degrau' })); }
      }
      // seta de subida
      const cx = (l.x0 + l.x1) / 2, cy = (l.y0 + l.y1) / 2;
      const [p0, p1] = l.sentido[1] !== 0
        ? [P(cx, l.sentido[1] > 0 ? l.y0 + 0.12 : l.y1 - 0.12), P(cx, l.sentido[1] > 0 ? l.y1 - 0.12 : l.y0 + 0.12)]
        : [P(l.sentido[0] > 0 ? l.x0 + 0.12 : l.x1 - 0.12, cy), P(l.sentido[0] > 0 ? l.x1 - 0.12 : l.x0 + 0.12, cy)];
      f.push(s('line', { x1: p0[0], y1: p0[1], x2: p1[0], y2: p1[1], class: 'esc-seta', 'marker-end': 'url(#esc-ponta)' }),
        s('circle', { cx: p0[0], cy: p0[1], r: 3, class: 'esc-seta-ini' }));
      const [tx, ty] = P(cx, cy);
      f.push(s('text', { x: tx + 8, y: ty, class: 'esc-rot', transform: l.sentido[1] !== 0 ? `rotate(-90 ${tx + 8} ${ty})` : null, 'text-anchor': 'middle' }, `LANCE ${i + 1} · ${l.espelhos} E`));
    });
    for (const p of g.patamares) {
      const [tx, ty] = P((p.x0 + p.x1) / 2, (p.y0 + p.y1) / 2);
      f.push(s('text', { x: tx, y: ty + 4, class: 'esc-rot', 'text-anchor': 'middle' }, p.nivel === 'intermediario' ? 'PATAMAR' : p.nivel === 'superior' ? 'CHEGADA' : 'SAÍDA'));
    }
    // apoios: linha grossa (viga ligada) ou tracejada (apoio externo)
    const recebe = Object.fromEntries(r.tramos.flatMap((t) => t.apoios.map((a) => [a.id, a])));
    for (const a of g.apoios) {
      const [p, q] = [P(...a.seg[0]), P(...a.seg[1])];
      const ap = recebe[a.id];
      const ligada = ap?.vigas?.length;
      f.push(s('line', { x1: p[0], y1: p[1], x2: q[0], y2: q[1], class: `esc-apoio${ligada ? ' ligada' : ''}` }));
      const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
      const vertical = Math.abs(p[0] - q[0]) < 1;
      const dy = a.seg[0][1] < 1e-6 && !vertical ? 16 : -7;
      f.push(s('text', { x: mx + (vertical ? (a.seg[0][0] < 1e-6 ? -8 : 8) : 0), y: my + (vertical ? 4 : dy), class: 'esc-apoio-rot', 'text-anchor': vertical ? (a.seg[0][0] < 1e-6 ? 'end' : 'start') : 'middle' },
        ligada ? ap.vigas.map((v) => v.codigo).join(', ') : 'externo'));
    }
    const [c0, c1] = [P(0, 0), P(g.largura, 0)];
    f.push(s('text', { x: (c0[0] + c1[0]) / 2, y: H - 6, class: 'dg-texto', 'text-anchor': 'middle' }, `${fmt(g.largura)} × ${fmt(g.comprimento)} m`),
      s('text', { x: 10, y: 16, class: 'dg-titulo' }, `PLANTA · ${TIPOS_ESCADA[r.tipo].nome.toUpperCase()}`));
    const defs = s('defs', null, s('marker', { id: 'esc-ponta', viewBox: '0 0 10 10', refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: 'auto-start-reverse' }, s('path', { d: 'M0 0L10 5L0 10z', class: 'esc-ponta' })));
    return s('svg', { class: 'desenho escada-planta', viewBox: `0 0 ${W} ${H}`, width: W, height: H }, defs, ...f);
  }

  /** Corte longitudinal desenvolvido: degraus de cada lance e patamares, nas alturas. */
  function corte(r) {
    const W = 440, H = 300, m = 40;
    const e = r.degraus.e / 100, p = r.degraus.p / 100;
    // perfil: sequência de (comprimento, altura) ao longo do caminhar
    const tr = [];
    let x = 0, z = 0;
    const g = r.geometria;
    const patamarDe = (nivel) => g.patamares.find((pp) => pp.nivel === nivel);
    const pi = patamarDe('inferior'), ps = patamarDe('superior'), pm = patamarDe('intermediario');
    const plano = (c, rot) => { if (c > 1e-6) { tr.push({ tipo: 'plano', x0: x, x1: x + c, z, rot }); x += c; } };
    const lance = (n) => { const pts = [[x, z]]; for (let k = 0; k < n; k++) { z += e; pts.push([x, z]); if (k < n - 1) { x += p; pts.push([x, z]); } } tr.push({ tipo: 'lance', pts }); };
    if (pi) plano(pi.y1 - pi.y0, 'saída');
    lance(r.espelhos[0]);
    if (r.espelhos.length > 1 && pm) {
      plano(r.tipo === 'L' ? r.largura : r.patamar, 'patamar');
      lance(r.espelhos[1]);
    }
    if (ps) plano(r.tipo === 'L' ? ps.x1 - ps.x0 : ps.y1 - ps.y0, 'chegada');
    const Ltot = Math.max(x, 0.5), Ht = z;
    const esc = Math.min((W - 2 * m) / Ltot, (H - 2 * m) / Ht);
    const X = (v) => m + v * esc, Z = (v) => H - m - v * esc;
    const f = [s('line', { x1: X(0) - 20, y1: Z(0), x2: X(0), y2: Z(0), class: 'esc-piso' }), s('line', { x1: X(Ltot), y1: Z(Ht), x2: X(Ltot) + 20, y2: Z(Ht), class: 'esc-piso' })];
    const hEsp = (r.h / 100) * esc;
    for (const t of tr) {
      if (t.tipo === 'plano') {
        f.push(s('rect', { x: X(t.x0), y: Z(t.z), width: (t.x1 - t.x0) * esc, height: Math.max(2, hEsp), class: 'esc-laje' }),
          s('text', { x: (X(t.x0) + X(t.x1)) / 2, y: Z(t.z) - 6, class: 'esc-rot', 'text-anchor': 'middle' }, t.rot));
      } else {
        const pts = t.pts;
        const pa = pts[0], pb = pts[pts.length - 1];
        // degraus e a laje inclinada por baixo
        f.push(s('polygon', { points: `${pts.map(([a, b]) => `${X(a)},${Z(b)}`).join(' ')} ${X(pb[0])},${Z(pb[1] - e) + hEsp} ${X(pa[0])},${Z(pa[1]) + hEsp}`, class: 'esc-laje' }));
      }
    }
    f.push(s('text', { x: X(0) - 22, y: Z(0) + 14, class: 'dg-texto' }, '±0'),
      s('text', { x: X(Ltot) - 4, y: Z(Ht) - 8, class: 'dg-texto', 'text-anchor': 'end' }, `+${fmt(r.H / 100)} m`),
      s('text', { x: 10, y: 16, class: 'dg-titulo' }, `CORTE DESENVOLVIDO · ${r.degraus.n} × ${fmt(r.degraus.e, 1)} / ${fmt(r.degraus.p, 0)} cm`));
    return s('svg', { class: 'desenho escada-corte', viewBox: `0 0 ${W} ${H}`, width: W, height: H }, ...f);
  }

  return {
    id: 'concreto.escada',
    nome: 'Escada',
    nomeCurto: 'Escada',
    categoria: 'escadas',
    novaCategoria: { id: 'escadas', nome: 'Escadas', ordem: 3.5 },
    prefixo: 'ES',
    sigla: 'CE1',
    icone: 'escada',
    forma: 'escada',
    material: 'Concreto armado',
    norma: 'NBR 6118:2023 · NBR 6120:2019',
    versao: '0.1.0',
    descricao: 'Escada de lances retos, em L ou em U, com patamares: laje armada longitudinalmente e reações nas vigas de apoio.',
    montagem: false,

    criar: criarEscada,
    calcular: (el, ctx) => calcularEscada(el, ctx),
    ligacoes: ligacoesEscada,
    cargasTransmitidas,
    resumo: (el) => (el.resultado && !el.resultado.erro ? `${TIPOS_ESCADA[el.resultado.tipo].nome.split(' (')[0]} · ${el.resultado.degraus.n} degraus · h = ${num(el.resultado.h, 0)} cm` : TIPOS_ESCADA[el.tipo]?.nome ?? 'Escada'),

    renderEntrada(raiz, ctx) {
      const el = ctx.elemento;
      // toda mudança refaz as ligações nos pisos (a geometria muda as linhas de apoio)
      const mudar = (fn, op = {}) => ctx.alterar((e, proj) => { fn(e, proj); religarEscada(e, proj); }, { estrutural: true, ...op });
      const H = desnivelDa(el, ctx.projeto);
      let g = null;
      try { g = geometriaDa(el, ctx.projeto); } catch { /* sem desnível */ }
      const tipo = el.tipo ?? 'U';
      raiz.append(ui.secao({
        numero: '01', titulo: 'Geometria', descricao: g ? `${g.dg.n} espelhos de ${num(g.dg.e, 1)} cm · piso ${num(g.dg.p, 0)} cm · 2e + p = ${num(g.dg.blondel, 1)} cm · α = ${num(g.cargas.alfa, 1)}°` : 'Informe o desnível ou o pavimento de chegada',
        filhos: [
          ui.segmentado({ rotulo: 'Tipo', valor: tipo, opcoes: Object.entries(TIPOS_ESCADA).map(([k, v]) => ({ valor: k, texto: v.nome.split(' (')[0] })), aoMudar: (v) => mudar((e) => { e.tipo = v; }) }),
          ui.linhaCampos(
            ui.texto({ rotulo: 'Desnível (cm)', valor: Number(el.desnivel) > 0 ? num(el.desnivel, 1) : '', largura: '150px', placeholder: H ? `${num(H, 0)} (do pavimento)` : 'informe', aoMudar: (v) => mudar((e) => { const x = lerNumero(v); e.desnivel = Number.isFinite(x) && x > 0 ? x : null; }) }),
            ui.campo({ rotulo: 'Espelho alvo', valor: el.espelhoAlvo, unidade: 'cm', casas: 1, min: 12, max: 22, largura: '140px', dica: 'O número de espelhos é o desnível dividido por este valor, arredondado', aoMudar: (v) => mudar((e) => { e.espelhoAlvo = v; }) }),
            ui.campo({ rotulo: 'Piso', valor: el.piso, unidade: 'cm', casas: 1, min: 20, max: 40, largura: '120px', aoMudar: (v) => mudar((e) => { e.piso = v; }) }),
            ui.campo({ rotulo: 'Largura do lance', valor: el.largura, unidade: 'm', casas: 2, min: 0.5, max: 3, largura: '150px', aoMudar: (v) => mudar((e) => { e.largura = v; }) }),
          ),
          ui.linhaCampos(
            tipo === 'U' ? ui.campo({ rotulo: 'Patamar intermediário', valor: el.patamar, unidade: 'm', casas: 2, min: 0.6, max: 4, largura: '170px', dica: 'Profundidade, no sentido dos lances', aoMudar: (v) => mudar((e) => { e.patamar = v; }) }) : null,
            tipo === 'U' ? ui.campo({ rotulo: 'Vão entre lances', valor: el.vaoCentral, unidade: 'm', casas: 2, min: 0, max: 2, largura: '150px', aoMudar: (v) => mudar((e) => { e.vaoCentral = v; }) }) : null,
            ui.campo({ rotulo: 'Patamar de saída', valor: el.patamarInferior ?? 0, unidade: 'm', casas: 2, min: 0, max: 4, largura: '150px', dica: 'Trecho plano antes do primeiro degrau, dentro da escada', aoMudar: (v) => mudar((e) => { e.patamarInferior = v; }) }),
            ui.campo({ rotulo: 'Patamar de chegada', valor: el.patamarSuperior ?? 0, unidade: 'm', casas: 2, min: 0, max: 4, largura: '160px', dica: 'Trecho plano depois do último degrau, dentro da escada', aoMudar: (v) => mudar((e) => { e.patamarSuperior = v; }) }),
          ),
        ],
      }));
      raiz.append(ui.secao({
        numero: '02', titulo: 'Laje e cargas', descricao: 'Laje armada longitudinalmente; cargas na projeção horizontal (NBR 6120)',
        filhos: [ui.linhaCampos(
          ui.campo({ rotulo: 'Espessura h', valor: el.h, unidade: 'cm', casas: 1, min: 8, max: 30, largura: '130px', dica: 'Perpendicular ao lance, sem os degraus', aoMudar: (v) => mudar((e) => { e.h = v; }) }),
          ui.campo({ rotulo: 'Revestimento', valor: el.revestimento, unidade: 'kN/m²', casas: 2, min: 0, max: 5, largura: '150px', dica: 'Piso e forro (NBR 6120, Tabela 1)', aoMudar: (v) => mudar((e) => { e.revestimento = v; }) }),
          ui.campo({ rotulo: 'Guarda-corpo', valor: el.guardaCorpo ?? 0, unidade: 'kN/m', casas: 2, min: 0, max: 10, largura: '140px', dica: 'Peso por metro, na borda de cada lance', aoMudar: (v) => mudar((e) => { e.guardaCorpo = v; }) }),
          ui.selecao({ rotulo: 'Uso', valor: el.uso ?? 'privativa', largura: '280px', opcoes: Object.entries(USO_ESCADA).map(([k, v]) => ({ valor: k, texto: `${v.nome} · ${num(v.q, 1)} kN/m²` })), aoMudar: (v) => mudar((e) => { e.uso = v; }) }),
        )],
      }));
      const pavs = pavimentosOrdenados(ctx.projeto);
      const pos = el.posicao;
      const ligs = vigasDosApoios(el, ctx.projeto);
      const nomes = Object.fromEntries(ligacoesEscada(el).map((l) => [l.id, l.nome]));
      raiz.append(ui.secao({
        numero: '03', titulo: 'Posição e apoios', descricao: 'Canto do início do primeiro lance; as linhas de apoio sobre vigas dos pisos de baixo e de chegada são ligadas automaticamente',
        filhos: [
          ui.linhaCampos(
            ui.selecao({ rotulo: 'Pavimento de chegada', valor: pos?.pavimento ?? '', largura: '220px', opcoes: [{ valor: '', texto: 'Sem posição na montagem' }, ...pavs.map((p) => ({ valor: p.id, texto: `${p.nome} · ${num(p.cota)} m` }))],
              aoMudar: (v) => mudar((e) => { e.posicao = v ? { x: 0, y: 0, angulo: 0, ...(e.posicao ?? {}), pavimento: v } : null; }) }),
            pos ? ui.campo({ rotulo: 'x', valor: pos.x, unidade: 'm', casas: 2, largura: '110px', aoMudar: (v) => mudar((e) => { e.posicao.x = v; }) }) : null,
            pos ? ui.campo({ rotulo: 'y', valor: pos.y, unidade: 'm', casas: 2, largura: '110px', aoMudar: (v) => mudar((e) => { e.posicao.y = v; }) }) : null,
            pos ? ui.selecao({ rotulo: 'Ângulo', valor: pos.angulo ?? 0, largura: '110px', opcoes: [0, 90, 180, 270].map((a) => ({ valor: a, texto: `${a}°` })), aoMudar: (v) => mudar((e) => { e.posicao.angulo = Number(v); }) }) : null,
          ),
          ui.tabela({
            classe: 'els-tabela',
            colunas: [{ titulo: 'Apoio' }, { titulo: 'Viga' }],
            linhas: ligacoesEscada(el).map((l) => [nomes[l.id], (ligs[l.id] ?? []).map((v) => `${v.codigo} (vão ${Number(v.vao) + 1}${v.posicao != null ? `, x = ${num(v.posicao)} m` : ''})`).join(', ') || 'externo — sem viga ligada']),
          }),
          h('p', { class: 'combinacoes-nota' }, 'Para apoiar o patamar numa viga, lance a reação na própria viga: Cargas › Reação de laje ou escada, escolhendo esta escada e o apoio.'),
        ],
      }));
      raiz.append(secaoArmadura(api, ctx, [{ chave: 'inferior', rotulo: 'Armadura principal (no lance)', uso: 'laje' }]));
    },

    renderResultado(raiz, r) {
      const pior = r.tramos.reduce((a, t) => (t.flecha.ft / t.flecha.lim > a.flecha.ft / a.flecha.lim ? t : a), r.tramos[0]);
      raiz.append(h('div', { class: 'instrumentos' },
        ui.numeroGrande({ rotulo: 'Degraus', valor: `${r.degraus.n}`, unidade: `× ${num(r.degraus.e, 1)} cm`, linhas: [`piso ${num(r.degraus.p, 0)} cm · α = ${num(r.degraus.alfa, 1)}°`, `2e + p = ${num(r.degraus.blondel, 1)} cm`] }),
        ui.numeroGrande({ rotulo: 'Laje', valor: num(r.h, 0), unidade: 'cm', linhas: [`hm = ${num(r.cargas.lance.hm, 1)} cm no lance`, `g = ${num(r.cargas.lance.g)} · q = ${num(r.cargas.lance.q, 1)} kN/m²`] }),
        ui.arco({ rotulo: 'Flecha (pior tramo)', valor: `${num((pior.flecha.ft / pior.flecha.lim) * 100, 0)}%`, fracao: pior.flecha.ft / pior.flecha.lim, legenda: `${num(pior.flecha.ft, 1)} de ${num(pior.flecha.lim, 1)} mm` }),
        ui.numeroGrande({ rotulo: 'Desnível', valor: num(r.H / 100, 2), unidade: 'm', linhas: [`${r.espelhos.map((n) => `${n}`).join(' + ')} espelhos`, `largura ${num(r.largura)} m`] }),
      ));
      raiz.append(ui.secao({
        numero: '04', titulo: 'Desenho', descricao: 'Apoios em traço cheio: ligados a vigas; tracejados: apoio externo (alvenaria, viga de patamar, terreno)',
        filhos: [h('div', { class: 'sapata-desenhos' }, h('div', { class: 'desenho-caixa centro' }, planta(r)), h('div', { class: 'desenho-caixa centro' }, corte(r)))],
      }));
      raiz.append(ui.secao({
        numero: '05', titulo: 'Tramos', descricao: 'Lajes biapoiadas na direção do lance, por metro de largura',
        filhos: [ui.tabela({
          classe: 'els-tabela',
          colunas: [{ titulo: 'Tramo' }, { titulo: 'Vão (m)', alinhar: 'dir' }, { titulo: 'Md (kN·m/m)', alinhar: 'dir' }, { titulo: 'VSd / VRd1 (kN/m)', alinhar: 'dir' }, { titulo: 'Principal' }, { titulo: 'Distribuição' }, { titulo: 'Negativa nos apoios' }, { titulo: 'Flecha (mm)', alinhar: 'dir' }],
          linhas: r.tramos.map((t) => [t.nome, num(t.L), num(t.Md), `${num(t.Vd)} / ${num(t.VRd1)}`, t.barras ? `${t.barras.rotulo} (${num(t.barras.AsEf)} cm²/m)` : '—', t.dist ?? '—', t.neg ?? '—', `${num(t.flecha.ft, 1)} ≤ ${num(t.flecha.lim, 1)}`]),
        })],
      }));
      raiz.append(ui.secao({
        numero: '06', titulo: 'Reações nos apoios', descricao: 'Características, por metro de largura do lance; nas vigas entram como resultante na posição do apoio',
        filhos: [ui.tabela({
          classe: 'els-tabela',
          colunas: [{ titulo: 'Apoio' }, { titulo: 'g (kN/m)', alinhar: 'dir' }, { titulo: 'q (kN/m)', alinhar: 'dir' }, { titulo: 'Resultante (kN)', alinhar: 'dir' }, { titulo: 'Recebe' }],
          linhas: r.tramos.flatMap((t) => t.apoios.map((a) => [a.nome, num(a.g), num(a.q), `${num((a.g + a.q) * r.largura, 1)}`, a.vigas.length ? a.vigas.map((v) => v.codigo).join(', ') : 'externo'])),
        })],
      }));
    },
  };
}
