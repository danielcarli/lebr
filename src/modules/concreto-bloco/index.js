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
 * Módulo: Bloco sobre estacas (NBR 6118:2023, 22.7 · NBR 6122).
 * Ligação pilar → bloco → estacas: o bloco recebe a carga do pilar, distribui entre as estacas e é dimensionado
 * pelo método das bielas e tirantes.
 */
import { calcularBloco, criarBloco } from './calculo.js';
import { pilaresDeFundacao, COBRIMENTO_SOLO } from '../concreto-sapata/calculo.js';
import { TIPOS_ESTACA } from '../../engine/estacas.js';
import { secaoListaDeFerros } from '../comum/detalhamento-ui.js';
import { vista3dFundacao } from '../comum/vista3d-fundacao.js';
import { modeloBloco } from '../comum/armadura3d-fundacoes.js';

const fmt = (v, c = 0) => (Number.isFinite(v) ? v.toFixed(c).replace('.', ',') : '—');

export default function moduloBloco(api) {
  const { h, s } = api.dom;
  const ui = api.ui;
  const { num, lerNumero } = api.formatar;

  function planta(r) {
    const W = 380, H = 320, m = 46;
    const esc = Math.min((W - 2 * m) / r.A, (H - 2 * m) / r.B);
    const a = r.A * esc, b = r.B * esc, cx = W / 2, cy = H / 2;
    const f = [s('rect', { x: cx - a / 2, y: cy - b / 2, width: a, height: b, class: 'sap-base' })];
    const D = r.estaca.D * esc;
    // tirantes sobre as estacas
    const P = r.pos.map((p) => [cx + p.x * esc, cy - p.y * esc]);
    if (r.n === 3) for (let i = 0; i < 3; i++) { const [p, q] = [P[i], P[(i + 1) % 3]]; f.push(s('line', { x1: p[0], y1: p[1], x2: q[0], y2: q[1], class: 'sap-barra' })); }
    else if (r.n >= 2) {
      const ys = [...new Set(r.pos.filter((p) => Math.abs(p.x) > 1).map((p) => p.y))], xs = [...new Set(r.pos.filter((p) => Math.abs(p.y) > 1).map((p) => p.x))];
      for (const y of ys) f.push(s('line', { x1: cx - a / 2 + 8, y1: cy - y * esc, x2: cx + a / 2 - 8, y2: cy - y * esc, class: 'sap-barra' }));
      if (r.armadura?.y) for (const x of xs) f.push(s('line', { x1: cx + x * esc, y1: cy - b / 2 + 8, x2: cx + x * esc, y2: cy + b / 2 - 8, class: 'sap-barra y' }));
    }
    P.forEach(([x, y]) => f.push(s('circle', { cx: x, cy: y, r: D / 2, class: 'blo-estaca' })));
    f.push(s('rect', { x: cx - (r.ap * esc) / 2, y: cy - (r.bp * esc) / 2, width: r.ap * esc, height: r.bp * esc, class: 'sap-pilar' }));
    // reação de cada estaca; a estaca central (sob o pilar) tem o valor abaixo do pilar
    P.forEach(([x, y], i) => {
      const sob = Math.hypot(r.pos[i].x, r.pos[i].y) < 1;
      f.push(s('text', { x, y: sob ? cy + Math.max(D / 2, (r.bp * esc) / 2) + 13 : y + 4, 'text-anchor': 'middle', class: 'blo-r' }, fmt(r.Rk[i])));
    });
    f.push(
      s('text', { x: cx - a / 2, y: cy - b / 2 - 10, class: 'dg-titulo' }, `PLANTA · ${r.n} ESTACA${r.n > 1 ? 'S' : ''} (kN)`),
      s('text', { x: cx, y: cy + b / 2 + 22, 'text-anchor': 'middle', class: 'dg-texto' }, `A = ${fmt(r.A)} cm`),
      s('text', { x: cx + a / 2 + 14, y: cy, class: 'dg-texto', transform: `rotate(90 ${cx + a / 2 + 14} ${cy})`, 'text-anchor': 'middle' }, `B = ${fmt(r.B)} cm`));
    return s('svg', { class: 'desenho bloco-planta', viewBox: `0 0 ${W} ${H}`, width: W, height: H }, ...f);
  }

  function corte(r) {
    const W = 420, H = 320, m = 36;
    const extra = 60; // cm de estaca desenhados
    const esc = Math.min((W - 2 * m) / r.A, (H - 80) / (r.h + extra + 40));
    const a = r.A * esc, x0 = (W - a) / 2, yT = 50, yB = yT + r.h * esc;
    const f = [s('rect', { x: (W - r.ap * esc) / 2, y: yT - 36, width: r.ap * esc, height: 36, class: 'sap-pilar' }),
      s('rect', { x: x0, y: yT, width: a, height: r.h * esc, class: 'sap-concreto' })];
    const xs = [...new Set(r.pos.map((p) => p.x))];
    const D = r.estaca.D * esc;
    for (const x of xs) {
      const px = W / 2 + x * esc;
      f.push(s('rect', { x: px - D / 2, y: yB - 10 * esc, width: D, height: (extra + 10) * esc, class: 'blo-estaca' }));
      if (r.n >= 2 && Math.abs(x) > 1) f.push(s('line', { x1: W / 2 + Math.sign(x) * (r.ap / 4) * esc, y1: yT + 4, x2: px, y2: yB - 15 * esc, class: 'blo-biela' }));
    }
    f.push(s('line', { x1: x0 + 6, y1: yB - 15 * esc, x2: x0 + a - 6, y2: yB - 15 * esc, class: 'sap-barra' }),
      s('line', { x1: x0 - 14, y1: yT, x2: x0 - 14, y2: yB, class: 'dg-cota' }), s('text', { x: x0 - 19, y: (yT + yB) / 2 + 4, 'text-anchor': 'end', class: 'dg-texto' }, `h = ${fmt(r.h)}`),
      s('text', { x: 10, y: 16, class: 'dg-titulo' }, r.n >= 2 ? `CORTE · BIELAS A ${fmt(r.bielas.alfaMin, 1)}°` : 'CORTE · BLOCO DE TRANSIÇÃO'));
    return s('svg', { class: 'desenho bloco-corte', viewBox: `0 0 ${W} ${H}`, width: W, height: H }, ...f);
  }

  return {
    id: 'concreto.bloco',
    nome: 'Bloco sobre estacas',
    nomeCurto: 'Bloco',
    categoria: 'fundacoes',
    novaCategoria: { id: 'fundacoes', nome: 'Fundações', ordem: 4 },
    prefixo: 'B',
    sigla: 'CB1',
    icone: 'bloco',
    forma: 'bloco',
    material: 'Concreto armado',
    norma: 'NBR 6118:2023 · NBR 6122',
    versao: '0.1.0',
    descricao: 'Bloco sobre 1 a 6 estacas: distribuição da carga do pilar, bielas e tirantes (Blévot), armadura principal e malha.',
    montagem: false,

    criar: criarBloco,
    calcular: (el, ctx) => calcularBloco(el, ctx),
    resumo: (el) => (el.resultado && !el.resultado.erro ? `${el.resultado.n} estaca(s) · ${num(el.resultado.A, 0)} × ${num(el.resultado.B, 0)} × ${num(el.resultado.h, 0)} cm` : el.pilarId ? 'ligado a pilar' : 'sem pilar'),

    renderEntrada(raiz, ctx) {
      const el = ctx.elemento;
      const fund = pilaresDeFundacao(ctx.projeto);
      const ligada = el.pilarId ? ctx.projeto.elementos.find((e) => e.id === el.pilarId) ?? null : null;
      const est = el.estaca ?? {};
      const furos = ctx.projeto.elementos.filter((e) => e.modulo === 'geotecnia.sondagem');
      const mudarEst = (fn, op) => ctx.alterar((e) => { e.estaca = { ...(e.estaca ?? {}) }; fn(e.estaca); }, op);
      raiz.append(ui.secao({
        numero: '01', titulo: 'Pilar e cargas', descricao: 'Ligação pilar → bloco → estacas',
        filhos: [
          ui.linhaCampos(
            ui.selecao({ rotulo: 'Pilar apoiado', valor: el.pilarId ?? '', largura: '300px', opcoes: [{ valor: '', texto: 'Nenhum — cargas informadas' }, ...fund.map(({ pilar: p }) => ({ valor: p.id, texto: `${p.codigo} · ${num(p.bx, 0)} × ${num(p.by, 0)} cm` }))],
              aoMudar: (v) => ctx.alterar((e) => { e.pilarId = v || null; }, { estrutural: true }) }),
            ligada ? ui.botao({ texto: `Abrir ${ligada.codigo}`, icone: 'direita', tipo: 'fantasma', aoClicar: () => ctx.abrirElemento(ligada.id) }) : null,
          ),
          ligada ? null : ui.linhaCampos(
            ui.campo({ rotulo: 'Pilar ap', valor: el.ap, unidade: 'cm', casas: 1, min: 10, max: 300, largura: '120px', aoMudar: (v) => ctx.alterar((e) => { e.ap = v; }) }),
            ui.campo({ rotulo: 'Pilar bp', valor: el.bp, unidade: 'cm', casas: 1, min: 10, max: 300, largura: '120px', aoMudar: (v) => ctx.alterar((e) => { e.bp = v; }) }),
            ui.campo({ rotulo: 'Nk permanente (g)', valor: el.cargas?.g ?? 0, unidade: 'kN', min: 0, largura: '160px', aoMudar: (v) => ctx.alterar((e) => { e.cargas = { ...(e.cargas ?? {}), g: v }; }) }),
            ui.campo({ rotulo: 'Nk variável (q)', valor: el.cargas?.q ?? 0, unidade: 'kN', min: 0, largura: '150px', aoMudar: (v) => ctx.alterar((e) => { e.cargas = { ...(e.cargas ?? {}), q: v }; }) }),
          ),
          ui.linhaCampos(
            ui.campo({ rotulo: 'Momento Mx adicional', valor: el.momentos?.x ?? 0, unidade: 'kN·m', largura: '180px', aoMudar: (v) => ctx.alterar((e) => { e.momentos = { ...(e.momentos ?? {}), x: v }; }) }),
            ui.campo({ rotulo: 'Momento My adicional', valor: el.momentos?.y ?? 0, unidade: 'kN·m', largura: '180px', aoMudar: (v) => ctx.alterar((e) => { e.momentos = { ...(e.momentos ?? {}), y: v }; }) }),
          ),
        ].filter(Boolean),
      }));
      raiz.append(ui.secao({
        numero: '02', titulo: 'Estacas', descricao: 'Capacidade pelo SPT do furo mais próximo (Aoki-Velloso e Décourt-Quaresma, a menor)',
        filhos: [
          ui.linhaCampos(
            ui.selecao({ rotulo: 'Tipo', valor: est.tipo ?? 'helice', largura: '280px', opcoes: Object.entries(TIPOS_ESTACA).map(([k, v]) => ({ valor: k, texto: v.nome })), aoMudar: (v) => mudarEst((x) => { x.tipo = v; }, { estrutural: true }) }),
            ui.campo({ rotulo: 'Diâmetro', valor: est.D ?? 30, unidade: 'cm', casas: 0, min: 15, max: 120, largura: '130px', aoMudar: (v) => mudarEst((x) => { x.D = v; }) }),
            ui.campo({ rotulo: 'Comprimento L', valor: est.L ?? 8, unidade: 'm', casas: 1, min: 2, max: 60, largura: '150px', aoMudar: (v) => mudarEst((x) => { x.L = v; }) }),
          ),
          ui.linhaCampos(
            ui.selecao({ rotulo: 'Número de estacas', valor: el.n ?? 'auto', largura: '220px', opcoes: [{ valor: 'auto', texto: 'Automático (pela carga)' }, ...[1, 2, 3, 4, 5, 6].map((n) => ({ valor: n, texto: `${n} estaca${n > 1 ? 's' : ''}` }))], aoMudar: (v) => ctx.alterar((e) => { e.n = v; }) }),
            ui.texto({ rotulo: 'Espaçamento (cm)', valor: el.espacamento != null ? num(el.espacamento, 0) : '', largura: '160px', placeholder: '3·D', aoMudar: (v) => ctx.alterar((e) => { const x = lerNumero(v); e.espacamento = Number.isFinite(x) && x > 0 ? x : null; }) }),
            ui.selecao({ rotulo: 'Furo de sondagem', valor: est.sondagemId ?? '', largura: '240px', opcoes: [{ valor: '', texto: furos.length ? 'O mais próximo' : 'Nenhum furo no projeto' }, ...furos.map((x) => ({ valor: x.id, texto: `${x.codigo} · ${x.nome}` }))], aoMudar: (v) => mudarEst((x) => { x.sondagemId = v || null; }) }),
          ),
        ],
      }));
      const g = el.geometria ?? {};
      const manual = g.modo === 'manual';
      raiz.append(ui.secao({
        numero: '03', titulo: 'Geometria', descricao: 'Arranjos usuais; bloco retangular envolvente com 15 cm da face da estaca à borda',
        filhos: [
          ui.segmentado({ rotulo: 'Dimensões', valor: manual ? 'manual' : 'automatica', opcoes: [{ valor: 'automatica', texto: 'Automáticas' }, { valor: 'manual', texto: 'Informadas' }],
            aoMudar: (v) => ctx.alterar((e) => { const r = e.resultado; e.geometria = { ...(e.geometria ?? {}), modo: v, ...(v === 'manual' && r && !r.erro ? { A: r.A, B: r.B, h: r.h } : {}) }; }, { estrutural: true }) }),
          manual ? ui.linhaCampos(
            ui.campo({ rotulo: 'A', valor: g.A, unidade: 'cm', casas: 0, min: 40, max: 1000, largura: '120px', aoMudar: (v) => ctx.alterar((e) => { e.geometria.A = v; }) }),
            ui.campo({ rotulo: 'B', valor: g.B, unidade: 'cm', casas: 0, min: 40, max: 1000, largura: '120px', aoMudar: (v) => ctx.alterar((e) => { e.geometria.B = v; }) }),
            ui.campo({ rotulo: 'Altura h', valor: g.h, unidade: 'cm', casas: 0, min: 30, max: 300, largura: '130px', aoMudar: (v) => ctx.alterar((e) => { e.geometria.h = v; }) }),
          ) : h('p', { class: 'combinacoes-nota' }, 'Altura com as bielas entre 45° e 55° (intervalos de d de Blévot) e suficiente para ancorar as barras do pilar; d = h − 15 cm (estaca embutida 10 cm).'),
          ui.linhaCampos(
            ui.campo({ rotulo: 'Fundo do bloco', valor: el.profundidade, unidade: 'm', casas: 2, min: 0.3, max: 10, largura: '150px', dica: 'Abaixo do terreno; o topo das estacas fica 10 cm acima', aoMudar: (v) => ctx.alterar((e) => { e.profundidade = v; }) }),
            ui.campo({ rotulo: 'Cobrimento', valor: el.cobrimento, unidade: 'cm', casas: 1, min: 2, max: 10, largura: '140px', dica: `Contato com o solo (CAA ${ctx.projeto.parametros.classeAgressividade}: ${num(COBRIMENTO_SOLO[ctx.projeto.parametros.classeAgressividade] ?? 3, 1)} cm)`, aoMudar: (v) => ctx.alterar((e) => { e.cobrimento = v; }) }),
          ),
        ],
      }));
    },

    renderResultado(raiz, r, ctx) {
      const uso = Math.max(...r.Rk) / r.Padm;
      raiz.append(h('div', { class: 'instrumentos' },
        ui.numeroGrande({ rotulo: 'Bloco', valor: `${num(r.A, 0)} × ${num(r.B, 0)} × ${num(r.h, 0)}`, unidade: 'cm', linhas: [`${r.n} estaca${r.n > 1 ? 's' : ''} ${r.estaca.nome.toLowerCase()} ø ${num(r.estaca.D, 0)}`, `espaçamento ${num(r.e, 0)} cm`] }),
        ui.arco({ rotulo: 'Estaca mais carregada', valor: `${num(uso * 100, 0)}%`, fracao: uso, legenda: `${num(Math.max(...r.Rk), 0)} de ${num(r.Padm, 0)} kN` }),
        r.n >= 2 ? ui.numeroGrande({ rotulo: 'Bielas', valor: num(r.bielas.alfaMin, 1), unidade: '°', linhas: [`σ pilar ${num(r.bielas.sigmaPil, 1)} MPa`, `limite ${num(r.bielas.limite, 1)} MPa`] }) : null,
        ui.numeroGrande({ rotulo: 'Carga do pilar', valor: num(r.Nk.g + r.Nk.q, 0), unidade: 'kN', linhas: [r.pilar ? r.pilar.codigo : 'informada', `Nd = ${num(r.Nd, 0)} kN`] }),
      ));
      raiz.append(ui.secao({
        numero: '04', titulo: 'Desenho', descricao: `Reações características nas estacas · furo ${r.estaca.furo?.codigo ?? '—'} · Padm = ${num(r.Padm, 0)} kN (AV ${num(r.estaca.av, 0)}, DQ ${num(r.estaca.dq, 0)})`,
        filhos: [h('div', { class: 'sapata-desenhos' }, h('div', { class: 'desenho-caixa centro' }, planta(r)), h('div', { class: 'desenho-caixa centro' }, corte(r))),
          vista3dFundacao(api, ctx, r, (posicoes) => modeloBloco(r, posicoes), { titulo: `VISTA 3D · BLOCO SOBRE ${r.n} ESTACA${r.n > 1 ? 'S' : ''}` })],
      }));
      const a = r.armadura;
      const linhasArm = a.tipo === 'fendilhamento'
        ? [['Estribos horizontais (fendilhamento)', `Td = ${num(a.Td.x, 1)} / ${num(a.Td.y, 1)} kN`, num(a.As), a.rotulo ?? '—']]
        : [
          ...(a.x ? [[r.n === 3 ? 'Tirantes nos três lados (cada um)' : r.n === 4 ? 'Tirantes nos lados paralelos a A (cada um)' : 'Tirante em x, sobre as estacas (cada faixa)', `${num(r.bielas.lado ?? r.bielas.Tx / a.x.faixas, 1)} kN`, num(a.x.AsFaixa), a.x.rotulo ?? '—']] : []),
          ...(a.y ? [[r.n === 4 ? 'Tirantes nos lados paralelos a B (cada um)' : 'Tirante em y, sobre as estacas (cada faixa)', `${num(r.bielas.lado ?? r.bielas.Ty / a.y.faixas, 1)} kN`, num(a.y.AsFaixa), a.y.rotulo ?? '—']] : []),
          ['Malha de distribuição em x (20 %)', '—', num(a.malha.As), a.malha.x ?? '—'],
          ['Malha de distribuição em y (20 %)', '—', num(a.malha.As), a.malha.y ?? '—'],
          ...(r.suspensao ? [['Armadura de suspensão (total)', '—', num(r.suspensao), 'estribos verticais']] : []),
        ];
      raiz.append(ui.secao({
        numero: '05', titulo: 'Armaduras', descricao: 'NBR 6118, 22.7.4 — barras de face a face com ganchos, ancoradas a partir da face interna das estacas',
        filhos: [ui.tabela({ classe: 'els-tabela', colunas: [{ titulo: 'Armadura' }, { titulo: 'Força', alinhar: 'dir' }, { titulo: 'As (cm²)', alinhar: 'dir' }, { titulo: 'Adotada' }], linhas: linhasArm })],
      }));
      const ae = r.armaduraEstaca;
      if (ae) raiz.append(ui.secao({
        numero: '06', titulo: 'Armadura das estacas', descricao: `NBR 6122:2019, 8.6.3 e Tabela 4 — estaca mais carregada (Rmáx = ${num(ae.Nk, 1)} kN)`,
        filhos: [ui.tabela({ classe: 'els-tabela', colunas: [{ titulo: 'Grandeza' }, { titulo: 'Valor', alinhar: 'dir' }], linhas: [
          ['Concreto (Tabela 4)', `C${ae.fck}, γc = ${num(ae.gc, 1)}`],
          ['Tensão σ = Nk/Ac', `${num(ae.sigma, 2)} MPa ${ae.precisa ? '>' : '≤'} ${num(ae.sigmaLim, 1)} MPa`],
          ['Armadura', ae.precisa ? `As,nec = ${num(ae.AsNec)} cm² (mín. ${num(ae.AsMin)} cm²)` : `só a ligação com o bloco: ${num(ae.AsMin)} cm²`],
          ['Gaiola', `${ae.barras?.rotulo ?? '—'} · estribo ${ae.estribo.rotulo}`],
          ['Comprimento armado', `${num(ae.Larm, 1)} m (mín. ${num(ae.Lmin, 1)} m) + espera de ${num(ae.espera, 0)} cm no bloco`],
        ] })],
      }));
      if (ctx && r.detalhamento?.posicoes?.length) raiz.append(secaoListaDeFerros(api, ctx, r.detalhamento, {
        modelo3d: (posicoes) => modeloBloco(r, posicoes),
        titulo: 'Ferragem do bloco e das estacas', descricao: 'Tirantes, malha de distribuição, armaduras laterais e superior (estacas em linha), suspensão e a gaiola das estacas · lista de ferros editável',
        volume: (r.A * r.B * r.h) / 1e6,
        nota: 'Tirantes e armadura superior com ganchos subindo (ou descendo) pelas faces; malhas e pele com ganchos a 90° (+10ø). A gaiola das estacas conta todas as estacas do bloco. Os arranques do pilar estão no detalhamento do pilar.',
      }));
    },
  };
}
