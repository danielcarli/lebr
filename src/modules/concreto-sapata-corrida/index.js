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
/** Módulo de sapata corrida: entrada, resultado, corte transversal, lista de ferros e armadura em 3D. */
import { calcularSapataCorrida, criarSapataCorrida, COBRIMENTO_SOLO } from './calculo.js';
import { secaoListaDeFerros } from '../comum/detalhamento-ui.js';
import { modeloSapataCorrida } from '../comum/armadura3d-fundacoes.js';

const fmt = (v, c = 0) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');

export default function moduloSapataCorrida(api) {
  const { h, s } = api.dom;
  const ui = api.ui;
  const { num } = api.formatar;

  /** Corte transversal: abas inclinadas, parede, malha e cotas. */
  function corte(r) {
    const W = 420, H = 300, m = 50;
    const esc = Math.min((W - 2 * m) / r.B, (H - 120) / (r.h + 40));
    const B = r.B * esc, hh = r.h * esc, h0 = r.h0 * esc, bw = r.bw * esc, b0 = Math.min(B, (r.bw + 5) * esc);
    const x0 = (W - B) / 2, yb = H - 60;
    const c = (r.cobrimento ?? 5) * esc;
    const f = [
      s('rect', { x: 10, y: yb, width: W - 20, height: 14, class: 'sc-solo' }),
      s('path', { class: 'sap-base', d: `M${x0} ${yb} L${x0 + B} ${yb} L${x0 + B} ${yb - h0} L${(W + b0) / 2} ${yb - hh} L${(W - b0) / 2} ${yb - hh} L${x0} ${yb - h0} Z` }),
      s('rect', { x: (W - bw) / 2, y: yb - hh - 70, width: bw, height: 70, class: 'sap-pilar' }),
      s('path', { class: 'sap-barra', d: `M${x0 + c} ${yb - c - 10 * (r.flexao?.barras?.phi ?? 10) / 10 * esc} L${x0 + c} ${yb - c} L${x0 + B - c} ${yb - c} L${x0 + B - c} ${yb - c - 10 * (r.flexao?.barras?.phi ?? 10) / 10 * esc}` }),
    ];
    const n = Math.min(r.distribuicao?.n ?? 4, 12);
    for (let i = 0; i < n; i++) f.push(s('circle', { cx: x0 + c + 4 + (i * (B - 2 * c - 8)) / Math.max(1, n - 1), cy: yb - c - 4, r: 2.6, class: 'sc-barra-long' }));
    f.push(
      s('line', { x1: x0, y1: yb + 30, x2: x0 + B, y2: yb + 30, class: 'dg-cota' }),
      s('text', { x: W / 2, y: yb + 46, class: 'dg-texto', 'text-anchor': 'middle' }, `B = ${fmt(r.B)} cm`),
      s('line', { x1: x0 + B + 16, y1: yb, x2: x0 + B + 16, y2: yb - hh, class: 'dg-cota' }),
      s('text', { x: x0 + B + 22, y: yb - hh / 2, class: 'dg-texto' }, `h = ${fmt(r.h)}`),
      s('text', { x: x0 + B + 22, y: yb - h0 / 2 + 12, class: 'dg-texto' }, `h0 = ${fmt(r.h0)}`),
      s('text', { x: (W + bw) / 2 + 6, y: yb - hh - 40, class: 'dg-texto' }, `parede ${fmt(r.bw)} cm`),
      s('text', { x: x0, y: 18, class: 'dg-titulo' }, 'CORTE TRANSVERSAL'),
      r.flexao?.barras ? s('text', { x: x0, y: 34, class: 'sap-rot' }, `transversais ${r.flexao.barras.rotulo} · longitudinais ${r.distribuicao.rotulo}`) : '',
    );
    return s('svg', { class: 'desenho', viewBox: `0 0 ${W} ${H}`, width: W, height: H }, ...f);
  }

  return {
    id: 'concreto.sapataCorrida',
    nome: 'Sapata corrida',
    nomeCurto: 'Sapata corrida',
    categoria: 'fundacoes',
    novaCategoria: { id: 'fundacoes', nome: 'Fundações', ordem: 4 },
    prefixo: 'SC',
    sigla: 'CSC',
    icone: 'sapata',
    forma: 'sapata',
    material: 'Concreto armado',
    norma: 'NBR 6122:2019 · NBR 6118:2023',
    versao: '0.1.0',
    descricao: 'Sapata corrida sob parede ou viga baldrame: largura pela tensão admissível, flexão transversal, distribuição, cortante e armadura em 3D.',
    montagem: false,

    criar: criarSapataCorrida,
    calcular: (el, ctx) => calcularSapataCorrida(el, ctx),
    resumo: (el) => (el.resultado && !el.resultado.erro ? `B = ${num(el.resultado.B, 0)} cm · h = ${num(el.resultado.h, 0)} cm · ${num(el.resultado.L, 2)} m` : el.vigaId ? 'sob viga' : 'carga informada'),

    renderEntrada(raiz, ctx) {
      const el = ctx.elemento;
      const vigas = ctx.projeto.elementos.filter((e) => e.modulo === 'concreto.viga' && e.posicao);
      const pav = (id) => ctx.projeto.pavimentos.find((p) => p.id === id);
      const ligada = el.vigaId ? vigas.find((v) => v.id === el.vigaId) ?? null : null;
      const opcoes = [{ valor: '', texto: 'Nenhuma — carga e eixo informados' }, ...vigas.map((v) => ({ valor: v.id, texto: `${v.codigo} · ${num(v.secao?.b ?? 0, 0)} × ${num(v.secao?.h ?? 0, 0)} cm · ${pav(v.posicao.pavimento)?.nome ?? ''}` }))];
      raiz.append(ui.secao({
        numero: '01', titulo: 'Parede ou viga apoiada', descricao: 'Com uma viga ligada, a carga por metro é a soma das reações características dela dividida pelo comprimento, e o eixo segue o da viga',
        filhos: [
          ui.linhaCampos(
            ui.selecao({ rotulo: 'Viga apoiada', valor: el.vigaId ?? '', largura: '360px', opcoes, aoMudar: (v) => ctx.alterar((e) => { e.vigaId = v || null; }, { estrutural: true }) }),
            ligada ? ui.botao({ texto: `Abrir ${ligada.codigo}`, icone: 'direita', tipo: 'fantasma', aoClicar: () => ctx.abrirElemento(ligada.id) }) : null,
          ),
          ligada ? null : ui.linhaCampos(
            ui.campo({ rotulo: 'Comprimento', valor: el.comprimento, unidade: 'm', casas: 2, min: 0.5, max: 200, largura: '140px', aoMudar: (v) => ctx.alterar((e) => { e.comprimento = v; }) }),
            ui.campo({ rotulo: 'Largura da parede bw', valor: el.bw, unidade: 'cm', casas: 0, min: 9, max: 100, largura: '170px', aoMudar: (v) => ctx.alterar((e) => { e.bw = v; }) }),
            ui.campo({ rotulo: 'g', valor: el.cargas?.g ?? 0, unidade: 'kN/m', min: 0, largura: '130px', dica: 'Permanente característica por metro', aoMudar: (v) => ctx.alterar((e) => { e.cargas = { ...(e.cargas ?? {}), g: v }; }) }),
            ui.campo({ rotulo: 'q', valor: el.cargas?.q ?? 0, unidade: 'kN/m', min: 0, largura: '130px', dica: 'Variável característica por metro', aoMudar: (v) => ctx.alterar((e) => { e.cargas = { ...(e.cargas ?? {}), q: v }; }) }),
          ),
          ligada ? null : ui.linhaCampos(
            ui.campo({ rotulo: 'Início x', valor: el.local?.x ?? 0, unidade: 'm', casas: 2, largura: '120px', aoMudar: (v) => ctx.alterar((e) => { e.local = { ...(e.local ?? {}), x: v }; }) }),
            ui.campo({ rotulo: 'Início y', valor: el.local?.y ?? 0, unidade: 'm', casas: 2, largura: '120px', aoMudar: (v) => ctx.alterar((e) => { e.local = { ...(e.local ?? {}), y: v }; }) }),
            ui.campo({ rotulo: 'Ângulo', valor: el.local?.angulo ?? 0, unidade: '°', casas: 1, largura: '110px', aoMudar: (v) => ctx.alterar((e) => { e.local = { ...(e.local ?? {}), angulo: v }; }) }),
          ),
        ].filter(Boolean),
      }));
      raiz.append(ui.secao({
        numero: '02', titulo: 'Solo', descricao: 'NBR 6122:2019 — tensão admissível e profundidade de apoio',
        filhos: [ui.linhaCampos(
          ui.campo({ rotulo: 'Profundidade da base', valor: el.profundidade, unidade: 'm', casas: 2, min: 0.3, max: 10, largura: '170px', dica: 'Abaixo do terreno (cota 0 do projeto)', aoMudar: (v) => ctx.alterar((e) => { e.profundidade = v; }) }),
          ui.campo({ rotulo: 'σadm', valor: el.solo?.tensao ?? 150, unidade: 'kPa', casas: 0, min: 20, max: 2000, largura: '140px', aoMudar: (v) => ctx.alterar((e) => { e.solo = { ...(e.solo ?? {}), tensao: v }; }) }),
          ui.campo({ rotulo: 'Peso específico do solo', valor: el.solo?.gama ?? 18, unidade: 'kN/m³', casas: 1, min: 10, max: 25, largura: '190px', aoMudar: (v) => ctx.alterar((e) => { e.solo = { ...(e.solo ?? {}), gama: v }; }) }),
        )],
      }));
      const g = el.geometria ?? {};
      const manual = g.modo === 'manual';
      raiz.append(ui.secao({
        numero: '03', titulo: 'Geometria', descricao: 'Abas inclinadas do topo (h, junto à parede) à borda (h0)',
        filhos: [
          ui.segmentado({ rotulo: 'Dimensões', valor: manual ? 'manual' : 'automatica', opcoes: [{ valor: 'automatica', texto: 'Automáticas (rígida)' }, { valor: 'manual', texto: 'Informadas' }],
            aoMudar: (v) => ctx.alterar((e) => { const r = e.resultado; e.geometria = { ...(e.geometria ?? {}), modo: v, ...(v === 'manual' && r && !r.erro ? { B: r.B, h: r.h, h0: r.h0 } : {}) }; }, { estrutural: true }) }),
          manual ? ui.linhaCampos(
            ui.campo({ rotulo: 'Largura B', valor: g.B, unidade: 'cm', casas: 0, min: 40, max: 500, largura: '130px', aoMudar: (v) => ctx.alterar((e) => { e.geometria.B = v; }) }),
            ui.campo({ rotulo: 'Altura h', valor: g.h, unidade: 'cm', casas: 0, min: 15, max: 200, largura: '130px', aoMudar: (v) => ctx.alterar((e) => { e.geometria.h = v; }) }),
            ui.campo({ rotulo: 'Borda h0', valor: g.h0, unidade: 'cm', casas: 0, min: 10, max: 200, largura: '130px', aoMudar: (v) => ctx.alterar((e) => { e.geometria.h0 = v; }) }),
          ) : h('p', { class: 'combinacoes-nota' }, 'B pela tensão admissível (com o peso próprio e o solo sobre as abas), em múltiplos de 5 cm e no mínimo 60 cm; altura de sapata rígida, h ≥ (B − bw)/3 e ≥ 25 cm; h0 ≥ h/3 e ≥ 20 cm.'),
          ui.linhaCampos(ui.campo({ rotulo: 'Cobrimento', valor: el.cobrimento, unidade: 'cm', casas: 1, min: 2, max: 10, largura: '140px', dica: `Contato com o solo — NBR 6118, Tabela 7.2 (CAA ${ctx.projeto.parametros.classeAgressividade}: ${num(COBRIMENTO_SOLO[ctx.projeto.parametros.classeAgressividade] ?? 3, 1)} cm)`, aoMudar: (v) => ctx.alterar((e) => { e.cobrimento = v; }) })),
        ],
      }));
    },

    renderResultado(raiz, r, ctx) {
      const uso = r.sigma / r.sigmaAdm;
      raiz.append(h('div', { class: 'instrumentos' },
        ui.numeroGrande({ rotulo: 'Sapata corrida', valor: `B = ${num(r.B, 0)}`, unidade: 'cm', linhas: [`h = ${num(r.h, 0)} cm · h0 = ${num(r.h0, 0)} cm`, `${num(r.L, 2)} m · ${r.rigida ? 'rígida' : 'flexível'}`] }),
        ui.arco({ rotulo: 'Tensão no solo', valor: `${num(uso * 100, 0)}%`, fracao: uso, legenda: `σ ${num(r.sigma, 0)} de ${num(r.sigmaAdm, 0)} kPa` }),
        ui.numeroGrande({ rotulo: 'Carga por metro', valor: num(r.nk.g + r.nk.q, 1), unidade: 'kN/m', linhas: [r.viga ? `viga ${r.viga.codigo}` : 'informada', `nd = ${num(r.nd, 1)} kN/m`] }),
        ui.numeroGrande({ rotulo: 'Armadura', valor: r.flexao.barras?.rotulo ?? '—', linhas: ['transversal', `longitudinal ${r.distribuicao.rotulo}`] }),
      ));
      raiz.append(ui.secao({
        numero: '04', titulo: 'Desenho', descricao: `Volume de concreto ${num(r.volume, 3)} m³ · seção ${num(r.area, 4)} m² · cobrimento ${num(r.cobrimento, 1)} cm`,
        filhos: [h('div', { class: 'desenho-caixa centro' }, corte(r))],
      }));
      raiz.append(ui.secao({
        numero: '05', titulo: 'Solo e estrutura', descricao: 'Por metro de sapata',
        filhos: [ui.tabela({
          classe: 'els-tabela',
          colunas: [{ titulo: 'Grandeza' }, { titulo: 'Valor', alinhar: 'dir' }],
          linhas: [
            ['Carga + peso próprio + solo', `${num(r.nk.g + r.nk.q, 1)} + ${num(r.pp, 1)} + ${num(r.terra, 1)} kN/m`],
            ['Tensão no solo', `${num(r.sigma, 0)} kPa (σadm = ${num(r.sigmaAdm, 0)})`],
            ['Momento transversal M1', `${num(r.flexao.Md, 2)} kN·m/m`],
            ['As transversal (calc. / mín.)', `${num(r.flexao.As)} / ${num(r.flexao.AsMin)} cm²/m → ${r.flexao.barras?.rotulo ?? '—'}`],
            ['Distribuição longitudinal', r.distribuicao.rotulo],
            ...(r.cortante ? [['Cortante (VSd / VRd1)', `${num(r.cortante.Vd, 1)} / ${num(r.cortante.VRd1, 1)} kN/m`]] : []),
          ],
        })],
      }));
      if (ctx && r.detalhamento?.posicoes?.length) raiz.append(secaoListaDeFerros(api, ctx, r.detalhamento, {
        titulo: 'Ferragem da sapata corrida', descricao: 'Barras transversais com gancho e longitudinais de distribuição · lista de ferros editável',
        volume: r.volume,
        modelo3d: (posicoes) => modeloSapataCorrida(r, posicoes),
        nota: 'Transversais com ganchos a 90° (+10ø) de face a face; longitudinais retas sobre elas, com emendas por traspasse quando passam de 12 m.',
      }));
    },
  };
}
