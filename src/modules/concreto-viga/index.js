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
 * Módulo: Viga de concreto armado (NBR 6118:2023)
 * Ponto de entrada — liga cálculo, editor e desenhos à API do LEBR.
 */
import { secaoCombinacoes } from '../comum/combinacoes.js';
import { secaoArmadura } from '../comum/armadura.js';
import { calcularViga, cargasTransmitidas, ligacoes, criarViga, montarCasos } from './calculo.js';
import { criarDesenhos } from './desenho.js';
import { editorCargas } from '../comum/cargas.js';
import { editorVaos } from '../comum/vaos.js';
import { secaoListaDeFerros } from '../comum/detalhamento-ui.js';
import { modeloViga } from '../comum/armadura3d.js';
import { mesaDasLajes } from '../comum/mesa-colaborante.js';

export default function moduloViga(api) {
  const { h } = api.dom;
  const ui = api.ui;
  const { num } = api.formatar;
  const desenho = criarDesenhos(api.dom);

  /** Grelha do pavimento × viga isolada: modo do pavimento, comparação e forças entre vigas. */
  function secaoGrelha(res, ctx) {
    const g = res.grelha;
    const el = ctx.elemento;
    const pav = ctx.projeto.pavimentos.find((x) => x.id === el.posicao?.pavimento);
    const mudarModo = (modo) => ctx.alterar((e, proj) => {
      const pv = proj.pavimentos.find((x) => x.id === e.posicao.pavimento);
      if (!pv) return;
      pv.analise = modo;
      // todas as vigas do pavimento (e o que depende delas) ficam desatualizadas
      for (const v of proj.elementos) if (v.posicao?.pavimento === pv.id && v.resultado) v.resultado.desatualizado = true;
    }, { descricao: `Análise das vigas: ${modo}`, estrutural: true });
    const dif = (a, b) => (Math.abs(a) > 0.05 ? `${b - a >= 0 ? '+' : '−'}${num(Math.abs((b - a) / a) * 100, 0)} %` : '—');
    const linhas = [];
    if (g.comparacao) {
      g.comparacao.vaos.forEach((c, v) => linhas.push([`Md+ vão ${v + 1} (kN·m)`, num(c.iso), num(c.grelha), dif(c.iso, c.grelha)]));
      g.comparacao.apoios.forEach((c, k) => {
        if (res.apoios[k].tipo === 'livre') return;
        if (Math.abs(c.isoM) > 0.05 || Math.abs(c.grelhaM) > 0.05) linhas.push([`Md− apoio ${k + 1} (kN·m)`, num(c.isoM), num(c.grelhaM), dif(c.isoM, c.grelhaM)]);
        linhas.push([`Rd apoio ${k + 1} (kN)`, num(c.isoR), num(c.grelhaR), dif(c.isoR, c.grelhaR)]);
      });
    }
    const tipoAp = (t) => (!t ? 'livre' : t.tipo === 'pilar' ? `pilar ${t.pilar}` : t.tipo === 'viga' ? `sobre ${t.vigas.map((id) => ctx.projeto.elementos.find((e) => e.id === id)?.codigo).join(', ')}` : 'apoio sem pilar');
    return ui.secao({
      numero: '06', titulo: 'Grelha do pavimento',
      descricao: `${pav?.nome ?? ''} · ${g.ativa ? 'esforços da grelha usados no dimensionamento' : 'vigas isoladas no dimensionamento; grelha só para comparação'} (NBR 6118, 14.7.6)`,
      filhos: [
        ui.linhaCampos(ui.segmentado({
          rotulo: 'Análise das vigas do pavimento', valor: g.modo,
          opcoes: [
            { valor: 'isolada', texto: 'Vigas isoladas', dica: 'Cada viga como viga contínua sobre apoios rígidos' },
            { valor: 'grelha', texto: 'Grelha', dica: 'Vigas do pavimento juntas: viga apoiada em viga e engastamento elástico nos pilares' },
          ],
          aoMudar: mudarModo,
        })),
        g.erro && !g.comparacao ? h('ul', { class: 'avisos' }, h('li', null, ui.icone('alerta', { tamanho: 14, traco: 1.8 }), `A grelha não pôde ser montada: ${g.erro}`)) : null,
        linhas.length ? ui.tabela({
          classe: 'els-tabela grelha-comparacao',
          colunas: [{ titulo: 'Esforço de cálculo' }, { titulo: 'Viga isolada', alinhar: 'dir' }, { titulo: 'Grelha', alinhar: 'dir' }, { titulo: 'Diferença', alinhar: 'dir' }],
          linhas: linhas.map((l) => ({ celulas: l, classe: '' })).map((l, i) => (g.ativa ? { ...l, celulas: [l.celulas[0], l.celulas[1], h('b', null, l.celulas[2]), l.celulas[3]] } : { ...l, celulas: [l.celulas[0], h('b', null, l.celulas[1]), l.celulas[2], l.celulas[3]] })),
        }) : null,
        g.interacoes?.length ? ui.tabela({
          classe: 'els-tabela',
          colunas: [{ titulo: 'Encontro com' }, { titulo: 'x (m)', alinhar: 'dir' }, { titulo: 'Situação' }, { titulo: 'Fg,k (kN)', alinhar: 'dir' }, { titulo: 'Fq,k (kN)', alinhar: 'dir' }, { titulo: 'Fd (kN)', alinhar: 'dir' }],
          linhas: g.interacoes.map((it) => [it.com.join(', '), num(it.x), it.Rg + it.Rq >= 0 ? `${el.codigo} se apoia em ${it.com.join(', ')}` : `${it.com.join(', ')} descarrega em ${el.codigo}`, num(Math.abs(it.Rg)), num(Math.abs(it.Rq)), h('b', null, num(Math.abs(it.Rd)))]),
        }) : null,
        h('p', { class: 'combinacoes-nota' }, `Apoios na grelha: ${res.apoios.map((a, k) => `A${k + 1} ${tipoAp(g.tipoApoio?.[k])}`).join(' · ')}. Na grelha, uma viga apoiada em outra transmite a reação a ela; os pilares entram com molas de rotação (4·E·I/ℓ por lance), o que cria momentos negativos nos apoios de extremidade; a torção das vigas usa ${num(g.fatorTorcao * 100, 0)} % da rigidez elástica. Flechas seguem pela viga isolada.`),
      ],
    });
  }

  /** Detalhamento: elevação com a armação, lista de ferros editável e resumo do aço por bitola. */
  function secaoDetalhamento(res, ctx) {
    const det = res.detalhamento;
    const el = ctx.elemento;
    const largAuto = det.larguras.map((l, k) => (el.apoios[k] === 'livre' ? null : `A${k + 1} ${num(l, 0)}`)).filter(Boolean).join(' · ');
    const volume = (el.secao.b * el.secao.h * el.vaos.reduce((a, v) => a + v.L, 0)) / 1e4;
    return secaoListaDeFerros(api, ctx, det, {
      descricao: 'Ancoragens, cortes, ganchos e emendas (NBR 6118, 9.4, 9.5 e 18.3) · lista de ferros editável',
      tituloVerificacoes: 'Ancoragem nos apoios extremos',
      volume,
      desenho: (posicoes, destaque) => desenho.elevacao(ctx.elemento, det, posicoes, { destaque }),
      modelo3d: (posicoes) => modeloViga(ctx.elemento, det, posicoes, { cob: ctx.projeto?.parametros?.cobrimento?.viga ?? 3, dmax: ctx.materiais?.dmax ?? 19 }),
      antes: [ui.linhaCampos(ui.texto({
        rotulo: 'Largura dos apoios (cm)', valor: el.detalhamento?.largura ?? '', placeholder: `automática: ${largAuto}`, largura: '320px',
        aoMudar: (v) => {
          const n = Number(String(v).replace(',', '.'));
          ctx.alterar((e) => { e.detalhamento ??= {}; if (n > 0) e.detalhamento.largura = n; else delete e.detalhamento.largura; }, { descricao: `Largura dos apoios de ${el.codigo}` });
          ctx.calcular?.();
        },
      }))],
      nota: 'Comprimentos com ganchos a 90° (+10ø cada) e emendas por traspasse nas barras acima de 12 m (l0t = 1,8·lb,nec). As barras são cortadas aℓ + lb além do ponto em que deixam de ser necessárias (diagrama deslocado, 17.4.2.2 e 18.3.2.3); as de canto correm a viga e seguram os estribos. Edite bitola, quantidade ou comprimento de qualquer posição: o resumo e os quantitativos usam os valores editados, mas não há nova verificação — confira a armadura resultante. Um novo cálculo mantém as edições. O resumo soma as perdas adotadas no projeto (Quantitativos).',
    });
  }

  return {
    id: 'concreto.viga',
    nome: 'Viga de concreto armado',
    nomeCurto: 'Viga',
    categoria: 'vigas',
    prefixo: 'V',
    sigla: 'CV1',
    icone: 'viga',
    material: 'Concreto armado',
    norma: 'NBR 6118:2023',
    versao: '0.1.0',
    descricao: 'Vigas contínuas com apoios, engastes e balanços; flexão, cortante e flechas.',

    criar: criarViga,
    calcular: calcularViga,
    cargasTransmitidas,
    ligacoes,

    resumo: (el) => {
      const total = el.vaos.reduce((a, v) => a + v.L, 0);
      const sec = el.mesa?.tipo === 'T' || el.mesa?.tipo === 'L' ? `Viga ${el.mesa.tipo} ${num(el.secao.b, 0)} × ${num(el.secao.h, 0)} cm (hf ${num(el.mesa.hf, 0)})` : `Seção ${num(el.secao.b, 0)} × ${num(el.secao.h, 0)} cm`;
      return `${el.baldrame ? 'Baldrame · ' : ''}${el.invertida ? 'Invertida · ' : ''}${sec} · ${el.vaos.length} ${el.vaos.length > 1 ? 'vãos' : 'vão'} · ${num(total)} m`;
    },

    /* ------------------------------------------------------------------ entrada */
    renderEntrada(raiz, ctx) {
      const el = ctx.elemento;
      const esquemaSlot = h('div', { class: 'esquema-slot' });
      const desenharEsquema = () => esquemaSlot.replaceChildren(desenho.esquema(ctx.elemento));
      desenharEsquema();
      const mudar = (fn, op = {}) => { ctx.alterar(fn, op); if (!op.estrutural) desenharEsquema(); };

      const { sequencia, acoes } = editorVaos(api, ctx, mudar);

      /** Viga T ou L (NBR 6118, 14.6.2.2): a laje moldada junto com a viga trabalha como mesa colaborante. */
      const camposMesa = () => {
        const tipo = el.mesa?.tipo === 'T' || el.mesa?.tipo === 'L' ? el.mesa.tipo : 'R';
        const doProjeto = ctx.projeto && el.posicao ? mesaDasLajes(ctx.projeto, el) : null;
        const pegar = () => ctx.alterar((e) => { const m = mesaDasLajes(ctx.projeto, e); if (m) { const { lajes, ...resto } = m; e.mesa = resto; } }, { estrutural: true, descricao: `Mesa colaborante de ${el.codigo}` });
        const mudarMesa = (fn) => ctx.alterar((e) => { e.mesa ??= { tipo: 'T', hf: 10, b2a: 300, b2b: 300 }; fn(e.mesa); }, { estrutural: true });
        const lista = [ui.segmentado({
          rotulo: 'Seção transversal', valor: tipo,
          opcoes: [{ valor: 'R', texto: 'Retangular' }, { valor: 'T', texto: 'Viga T' }, { valor: 'L', texto: 'Viga L' }],
          aoMudar: (v) => ctx.alterar((e) => {
            if (v === 'R') { delete e.mesa; return; }
            const auto = ctx.projeto && e.posicao ? mesaDasLajes(ctx.projeto, e) : null;
            const hf = e.mesa?.hf ?? auto?.hf ?? 10;
            e.mesa = v === 'T'
              ? { tipo: 'T', hf, b2a: e.mesa?.b2a ?? auto?.b2a ?? auto?.b2 ?? 300, b2b: e.mesa?.b2b ?? auto?.b2b ?? auto?.b2 ?? 300 }
              : { tipo: 'L', hf, b2: e.mesa?.b2 ?? auto?.b2 ?? auto?.b2a ?? 300, b4: e.mesa?.b4 ?? 0 };
          }, { estrutural: true }),
        })];
        if (tipo === 'R') {
          if (doProjeto) lista.push(h('p', { class: 'mesa-dica' }, `As lajes ligadas (${doProjeto.lajes.join(', ')}) podem trabalhar como mesa: escolha Viga ${doProjeto.tipo} para usar a largura colaborante.`));
          return lista;
        }
        const m = el.mesa;
        lista.push(ui.linhaCampos(
          ui.campo({ rotulo: 'Mesa hf', valor: m.hf, unidade: 'cm', casas: 1, min: 4, max: 60, dica: 'Espessura da laje que trabalha como mesa (nas nervuradas e treliçadas, a capa)', aoMudar: (v) => mudarMesa((x) => { x.hf = v; }) }),
          ...(tipo === 'T' ? [
            ui.campo({ rotulo: 'b2 de um lado', valor: m.b2a, unidade: 'cm', casas: 0, min: 0, max: 5000, dica: 'Distância livre entre a face desta viga e a da nervura (viga) vizinha', aoMudar: (v) => mudarMesa((x) => { x.b2a = v; }) }),
            ui.campo({ rotulo: 'b2 do outro lado', valor: m.b2b ?? m.b2a, unidade: 'cm', casas: 0, min: 0, max: 5000, aoMudar: (v) => mudarMesa((x) => { x.b2b = v; }) }),
          ] : [
            ui.campo({ rotulo: 'b2 (lado da laje)', valor: m.b2, unidade: 'cm', casas: 0, min: 0, max: 5000, dica: 'Distância livre entre a face desta viga e a da viga vizinha, do lado da laje', aoMudar: (v) => mudarMesa((x) => { x.b2 = v; }) }),
            ui.campo({ rotulo: 'b4 (aba em balanço)', valor: m.b4 ?? 0, unidade: 'cm', casas: 0, min: 0, max: 500, dica: 'Aba da mesa do outro lado, em balanço até a borda (0 = sem aba)', aoMudar: (v) => mudarMesa((x) => { x.b4 = v; }) }),
          ]),
        ));
        lista.push(h('p', { class: 'mesa-dica' },
          'Largura colaborante pela NBR 6118, 14.6.2.2: bf = bw + b1 de cada lado, com b1 ≤ 0,5·b2 e ≤ 0,10·a (a = ℓ, 0,75ℓ ou 0,60ℓ pela continuidade do tramo); na aba em balanço, b3 ≤ b4 e ≤ 0,10·a. A mesa só conta onde está comprimida. ',
          doProjeto ? h('button', { class: 'link', onClick: pegar }, `Pegar das lajes ligadas (${doProjeto.lajes.join(', ')})`) : null));
        return lista;
      };

      raiz.append(
        ui.secao({
          numero: '01', titulo: 'Seção e vãos', descricao: el.mesa?.tipo === 'T' ? 'Viga T: alma retangular com a laje como mesa colaborante' : el.mesa?.tipo === 'L' ? 'Viga L: alma retangular com a laje de um lado como mesa colaborante' : 'Seção retangular constante',
          filhos: [
            ui.linhaCampos(
              ui.campo({ rotulo: 'Largura b', valor: el.secao.b, unidade: 'cm', casas: 1, min: 10, max: 200, aoMudar: (v) => mudar((e) => { e.secao.b = v; }) }),
              ui.campo({ rotulo: 'Altura h', valor: el.secao.h, unidade: 'cm', casas: 1, min: 15, max: 300, aoMudar: (v) => mudar((e) => { e.secao.h = v; }) }),
            ),
            ui.alternar({ rotulo: 'Viga baldrame (no nível da fundação, em contato com o solo)', valor: !!el.baldrame, dica: 'Usa o cobrimento de elementos em contato com o solo (NBR 6118, Tabela 7.2) e recebe as paredes do térreo', aoMudar: (v) => ctx.alterar((e) => { e.baldrame = v; }, { estrutural: true }) }),
            ui.alternar({ rotulo: 'Viga invertida (laje apoiada na face inferior)', valor: !!el.invertida, dica: 'A viga sobe acima da laje; as reações das lajes e escadas ficam penduradas e pedem estribos de suspensão (NBR 6118, 18.3.6)', aoMudar: (v) => ctx.alterar((e) => { e.invertida = v; }, { estrutural: true }) }),
            ...camposMesa(),
            esquemaSlot,
            sequencia,
            acoes,
          ],
        }),
        secaoArmadura(api, ctx, [
          { chave: 'inferior', rotulo: 'Barras inferiores (positivas)', uso: 'viga' },
          { chave: 'superior', rotulo: 'Barras superiores (negativas)', uso: 'viga' },
          { chave: 'estribo', rotulo: 'Estribos', uso: 'estribo' },
        ]),
      );

      // cargas
      const { lista, botaoAdd } = editorCargas(api, ctx, { tipos: ['distribuida', 'concentrada', 'alvenaria', 'torcao', 'elemento'], ligacao: 'linear' });
      const pp = (ctx.materiais.gama * el.secao.b * el.secao.h) / 1e4;
      let resumo = null;
      try {
        const { G, Q } = montarCasos(el, ctx.contextoCalculo());
        resumo = el.vaos.map((_, i) => `Vão ${i + 1}: g ${num(G.q[i])} · q ${num(Q.q[i])}${G.t[i] || Q.t[i] ? ` · torção tg ${num(G.t[i])} · tq ${num(Q.t[i])} kN·m/m` : ''}`).join("   ·   ");
      } catch { /* cargas incompletas */ }

      raiz.append(ui.secao({
        numero: '02', titulo: 'Cargas', descricao: 'Valores característicos',
        acoes: [botaoAdd],
        filhos: [
          h('div', { class: 'linha-campos' },
            ui.alternar({ rotulo: `Peso próprio (${num(pp)} kN/m)`, valor: el.pesoProprio, aoMudar: (v) => ctx.alterar((e) => { e.pesoProprio = v; }) })),
          lista,
          resumo && h('div', { class: 'cargas-resumo' }, h('span', { class: 'rot' }, 'Distribuídas por vão (kN/m)'), resumo),
        ],
      }));
    },

    /* ------------------------------------------------------------------ resultado */
    renderResultado(raiz, res, ctx) {
      const el = ctx.elemento;
      const r = res.resumo;
      const vMax = res.vaos.reduce((a, v, i) => (v.Mdpos > res.vaos[a].Mdpos ? i : a), 0);
      const aMin = res.apoios.reduce((a, v, i) => (v.Mdneg < res.apoios[a].Mdneg ? i : a), 0);
      const fMax = res.vaos.reduce((a, v, i) => (v.flecha.ft / v.flecha.lim > res.vaos[a].flecha.ft / res.vaos[a].flecha.lim ? i : a), 0);
      const vCrit = res.vaos[vMax];

      raiz.append(h('div', { class: 'instrumentos' },
        ui.numeroGrande({ rotulo: 'Momento positivo', valor: num(vCrit.Mdpos, 1), unidade: 'kN·m', linhas: [`Vão ${vMax + 1}`, vCrit.positiva?.barras?.rotulo ?? '—'] }),
        ui.faixa({
          rotulo: 'Momentos de cálculo', valor: `${num(r.MdMin, 0)} | ${num(r.MdMax, 0)}`,
          fracaoDegrade: Math.abs(r.MdMin) / (Math.abs(r.MdMin) + r.MdMax || 1) * 0.8 + 0.1,
          rotEsq: `M− ${num(r.MdMin, 1)}${res.apoios[aMin].negativa ? ` · A${aMin + 1}` : ''}`, rotDir: `M+ ${num(r.MdMax, 1)}`,
        }),
        ui.arco({ rotulo: 'Biela comprimida', valor: `${num(r.utilBiela * 100, 0)}%`, fracao: r.utilBiela, legenda: res.vaos.some((v) => v.torcao) ? 'VSd/VRd2 + TSd/TRd2' : 'VSd / VRd2' }),
        ui.medidor({ rotulo: 'Flecha', valor: `${num(res.vaos[fMax].flecha.ft, 1)} mm`, fracao: r.flechaRazao, legenda: `limite ${num(res.vaos[fMax].flecha.lim, 1)} mm · vão ${fMax + 1}` }),
        ui.numeroGrande({ rotulo: 'Cortante máximo', valor: num(r.VdMax, 1), unidade: 'kN', linhas: ['Estribos', res.vaos[0].estribos.rotulo + ' cm'] }),
        (() => {
          // pior abertura de fissuras entre vãos e apoios (ELS-W, combinação frequente)
          const ws = [...res.vaos.map((v) => v.fissuras), ...res.apoios.map((a) => a.fissuras)].filter((w) => w?.fissurada);
          if (!ws.length) return ui.medidor({ rotulo: 'Abertura de fissuras', valor: 'não fissura', fracao: 0, legenda: 'Ms,freq < Mr' });
          const w = ws.reduce((a, b) => (b.wk / b.lim > a.wk / a.lim ? b : a));
          return ui.medidor({ rotulo: 'Abertura de fissuras', valor: `${num(w.wk, 2)} mm`, fracao: w.wk / w.lim, legenda: `limite ${num(w.lim, 1)} mm (Tabela 13.4)` });
        })(),
      ));

      raiz.append(ui.secao({ numero: '04', titulo: 'Diagramas', descricao: res.combinacoes ? 'Envoltória das combinações últimas: em cada seção, o máximo (linha contínua) e o mínimo (linha tracejada)' : 'ELU (γg·G + γq·Q)', filhos: [h('div', { class: 'desenho-caixa' }, desenho.diagramas(el, res))] }));

      // detalhamento
      const linhas = [];
      res.vaos.forEach((v, i) => linhas.push([`Vão ${i + 1}`, 'Positiva', num(v.Mdpos), v.comb?.Mdpos ?? '—', num(v.positiva?.AsCalc), num(v.positiva?.As), v.positiva?.barras?.rotulo ?? '—', `${v.estribos.rotulo} cm`]));
      res.apoios.forEach((a, k) => { if (a.negativa) linhas.push([`Apoio ${k + 1}`, 'Negativa', num(a.Mdneg), a.comb?.Mdneg ?? '—', num(a.negativa.AsCalc), num(a.negativa.As), a.negativa.barras?.rotulo ?? '—', '']); });

      const cob = ctx.projeto.parametros.cobrimento.viga;
      const secoes = res.vaos.map((v, i) => {
        const negs = [res.apoios[i]?.negativa, res.apoios[i + 1]?.negativa].filter(Boolean).sort((a, b) => b.As - a.As)[0];
        return h('figure', { class: 'figura-secao' },
          desenho.secao(el.secao, { inf: v.positiva?.barras, sup: negs?.barras, phiT: v.estribos.phi ?? 5, cob, titulo: `VÃO ${i + 1}`, laje: el.invertida ? 'inferior' : el.baldrame ? null : 'superior', mesa: v.mesa ? { tipo: el.mesa?.tipo, hf: el.mesa?.hf, bf: v.mesa.bf } : null }),
          h('figcaption', null,
            h('span', null, h('i', { class: 'leg-barra' }), `Inferior: ${v.positiva?.barras?.rotulo ?? '—'}`),
            h('span', null, h('i', { class: `leg-barra ${negs ? 'negativa' : 'porta'}` }), `Superior: ${negs?.barras?.rotulo ?? '2 ø 8 (porta-estribo)'}`),
            h('span', null, h('i', { class: 'leg-estribo' }), `Estribos: ${v.estribos.rotulo} cm`)));
      });

      raiz.append(ui.secao({
        numero: '05', titulo: 'Detalhamento', descricao: 'Armaduras longitudinais e transversais',
        filhos: [
          ui.tabela({
            colunas: [{ titulo: 'Posição' }, { titulo: 'Armadura' }, { titulo: 'Md (kN·m)', alinhar: 'dir' }, { titulo: 'Combinação' }, { titulo: 'As,calc (cm²)', alinhar: 'dir' }, { titulo: 'As (cm²)', alinhar: 'dir' }, { titulo: 'Barras' }, { titulo: 'Estribos' }],
            linhas,
          }),
          h('div', { class: 'secoes' }, secoes),
        ],
      }));

      if (res.detalhamento?.posicoes?.length) raiz.append(secaoDetalhamento(res, ctx));

      raiz.append(ui.secao({
        numero: '06', titulo: 'Reações de apoio', descricao: 'Transmitidas a pilares',
        filhos: [ui.tabela({
          colunas: [{ titulo: 'Apoio' }, { titulo: 'Tipo' }, { titulo: 'x (m)', alinhar: 'dir' }, { titulo: 'Rg,k (kN)', alinhar: 'dir' }, { titulo: 'Rq,k (kN)', alinhar: 'dir' }, { titulo: 'Rd (kN)', alinhar: 'dir' }, { titulo: 'Combinação' }],
          linhas: res.apoios.map((a, k) => [`A${k + 1}`, a.tipo, num(a.x), num(a.Rg), num(a.Rq), num(a.Rd), a.comb?.Rd ?? '—']),
        })],
      }));

      if (res.grelha) raiz.append(secaoGrelha(res, ctx));

      if (res.vaos.some((v) => v.torcao)) {
        raiz.append(ui.secao({
          numero: '07', titulo: 'Torção', descricao: 'Treliça espacial com bielas a 45° (17.5) e interação com a cortante (17.7.2)',
          filhos: [
            ui.tabela({
              classe: 'els-tabela',
              colunas: [{ titulo: 'Vão' }, { titulo: 'TSd (kN·m)', alinhar: 'dir' }, { titulo: 'Comb.' }, { titulo: 'TRd2 (kN·m)', alinhar: 'dir' }, { titulo: 'VSd/VRd2 + TSd/TRd2', alinhar: 'dir' }, { titulo: 'A90/s por ramo', alinhar: 'dir' }, { titulo: 'Asw/s cortante', alinhar: 'dir' }, { titulo: 'Asw/s total', alinhar: 'dir' }, { titulo: 'Estribos' }, { titulo: 'Asl torção', alinhar: 'dir' }, { titulo: '' }],
              linhas: res.vaos.map((v, i) => (v.torcao
                ? [`Vão ${i + 1}`, num(v.torcao.Td), v.torcao.comb, num(v.torcao.TRd2), h('b', null, num(v.torcao.interacao)), `${num(v.torcao.A90)} cm²/m`, `${num(v.estribos.aswV)} cm²/m`, h('b', null, `${num(v.estribos.asw)} cm²/m`), `${v.estribos.rotulo} cm`, `${num(v.torcao.Asl)} cm²`, ui.selo(v.torcao.ok)]
                : [`Vão ${i + 1}`, '—', '', '', '', '', `${num(v.estribos.asw)} cm²/m`, `${num(v.estribos.asw)} cm²/m`, `${v.estribos.rotulo} cm`, '', ''])),
            }),
            h('p', { class: 'combinacoes-nota' }, 'Os estribos somam a cortante (dois ramos) e a torção (A90/s em cada ramo); devem ser fechados. A armadura longitudinal de torção (Asl) se distribui no perímetro da seção vazada equivalente, com uma barra em cada canto, e se soma às armaduras de flexão. Os apoios restringem a rotação da viga em torno do próprio eixo.'),
          ],
        }));
      }

      if (res.vaos[0]?.flecha?.fdif !== undefined) {
        const linhaW = (rot, w) => w && [rot, num(w.Ms), w.comb ?? '—', w.fissurada ? num(w.sigma, 1) : '—', w.fissurada ? num(w.Acr, 1) : '—',
          w.fissurada ? num(w.w1, 3) : '—', w.fissurada ? num(w.w2, 3) : '—', w.fissurada ? h('b', null, num(w.wk, 2)) : 'não fissura', `≤ ${num(w.lim, 1)}`, ui.selo(w.ok)];
        raiz.append(ui.secao({
          numero: '07', titulo: 'Estados limites de serviço', descricao: 'Abertura de fissuras (17.3.3, combinação frequente) e flechas (17.3.2, quase permanente)',
          filhos: [
            ui.tabela({
              classe: 'els-tabela',
              colunas: [{ titulo: 'Posição' }, { titulo: 'Ms (kN·m)', alinhar: 'dir' }, { titulo: 'Comb.' }, { titulo: 'σs (MPa)', alinhar: 'dir' }, { titulo: 'Acr (cm²)', alinhar: 'dir' }, { titulo: 'w1 (mm)', alinhar: 'dir' }, { titulo: 'w2 (mm)', alinhar: 'dir' }, { titulo: 'wk (mm)', alinhar: 'dir' }, { titulo: 'Limite', alinhar: 'dir' }, { titulo: '' }],
              linhas: [
                ...res.vaos.map((v, i) => linhaW(`Vão ${i + 1} (positiva)`, v.fissuras)),
                ...res.apoios.map((a, k) => linhaW(`Apoio ${k + 1} (negativa)`, a.fissuras)),
              ].filter(Boolean),
            }),
            h('p', { class: 'combinacoes-nota' }, 'wk é o menor entre w1 = φ/(12,5η1)·σs/Es·3σs/fct,m e w2 = φ/(12,5η1)·σs/Es·(4/ρr + 45), na barra mais solicitada da camada tracionada; σs no estádio II com αe = 15. Barras mais finas e mais numerosas reduzem wk.'),
            ui.tabela({
              classe: 'els-tabela',
              colunas: [{ titulo: 'Vão' }, { titulo: 'Imediata (mm)', alinhar: 'dir' }, { titulo: 'αf', alinhar: 'dir' }, { titulo: 'Diferida (mm)', alinhar: 'dir' }, { titulo: 'Total (mm)', alinhar: 'dir' }, { titulo: 'Limite (mm)', alinhar: 'dir' }, { titulo: 'Acidental (mm)', alinhar: 'dir' }, { titulo: 'Limite (mm)', alinhar: 'dir' }, { titulo: '' }],
              linhas: res.vaos.map((v, i) => [`Vão ${i + 1}`, num(v.flecha.f0, 1), num(v.flecha.alfaF), num(v.flecha.fdif, 1), h('b', null, num(v.flecha.ft, 1)), `l/250 = ${num(v.flecha.lim, 1)}`, num(v.flecha.fQ, 1), `l/350 = ${num(v.flecha.limQ, 1)}`, ui.selo(v.flecha.ok && v.flecha.okQ)]),
            }),
            h('p', { class: 'combinacoes-nota' }, 'Imediata com a inércia equivalente de Branson (17.3.2.1.1); diferida = αf · imediata, com αf da Tabela 17.1 pela idade no carregamento (Parâmetros do projeto). A flecha da carga acidental atende ao limite de vibrações sentidas no piso (Tabela 13.3). Em balanços, l = 2 × comprimento.'),
          ],
        }));
      }

      if (res.combinacoes) raiz.append(secaoCombinacoes(api, res, {
        governa: [
          ...res.vaos.flatMap((v, i) => [v.comb?.Mdpos && [v.comb.Mdpos, `Md+ vão ${i + 1}`], v.comb?.Vd && [v.comb.Vd, `Vd vão ${i + 1}`]]),
          ...res.apoios.flatMap((a, k) => [a.comb?.Mdneg && [a.comb.Mdneg, `Md− apoio ${k + 1}`], a.tipo !== 'livre' && a.comb?.Rd && [a.comb.Rd, `Rd apoio ${k + 1}`]]),
        ].filter(Boolean),
        casos: res.casos && {
          colunas: [...res.vaos.map((_, i) => `M+ vão ${i + 1}`), ...res.apoios.map((a, k) => (a.tipo === 'livre' ? null : `R apoio ${k + 1}`))],
          linhas: res.casos.map((c) => ({ id: c.id, nome: c.nome, valores: [...c.Mvao, ...c.R.map((r, k) => (res.apoios[k].tipo === 'livre' ? null : r))] })),
        },
      }));
    },
  };
}
