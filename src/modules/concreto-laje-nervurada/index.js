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
 * Módulo: Laje nervurada moldada no local (NBR 6118:2023)
 */
import { camposCargasLaje } from '../comum/cargas-laje.js';
import { secaoArmadura } from '../comum/armadura.js';
import { calcularLajeNervurada, cargasTransmitidas, ligacoes, criarLajeNervurada, cargasNervurada, ENCHIMENTOS_N } from './calculo.js';
import { criarDesenhosLajes } from '../comum/desenho-lajes.js';
import { criarPlantaLaje } from '../comum/planta-laje.js';

export default function moduloLajeNervurada(api) {
  const { h } = api.dom;
  const ui = api.ui;
  const { num } = api.formatar;
  const desenho = criarDesenhosLajes(api.dom);
  const pl = criarPlantaLaje(api);

  return {
    id: 'concreto.laje.nervurada',
    nome: 'Laje nervurada',
    nomeCurto: 'Laje nervurada',
    categoria: 'lajes',
    prefixo: 'LN',
    sigla: 'CL3',
    icone: 'laje',
    material: 'Concreto armado',
    norma: 'NBR 6118:2023',
    versao: '0.2.0',
    descricao: 'Nervuras em uma ou duas direções com cubetas ou blocos; bordas apoiadas, engastadas ou livres (balanço); nervuras T, mesa e cortante (13.2.4.2).',

    criar: criarLajeNervurada,
    calcular: calcularLajeNervurada,
    cargasTransmitidas,
    ligacoes,
    resumo: (el) => `${num(el.lx)} × ${num(el.ly)} m · h = ${num(el.h, 0)} cm · ${el.direcao === 'duas' ? 'duas direções' : 'uma direção'}`,

    renderEntrada(raiz, ctx) {
      const el = ctx.elemento;
      const plantaSlot = h('div', { class: 'planta-slot' });
      const corte = h('div', { class: 'desenho-caixa' });
      const umaDir = () => ctx.elemento.direcao !== 'duas';
      const mudarBorda = (id, v) => ctx.alterar((e) => { e.bordas[id] = v; }, { estrutural: true });
      const alternar = (id) => mudarBorda(id, pl.proximo(id, ctx.elemento.bordas[id], { umaDirecao: umaDir() }));
      const desenhar = () => {
        const e = ctx.elemento;
        plantaSlot.replaceChildren(pl.planta({ lx: e.lx, ly: e.ly, bordas: e.bordas, codigo: e.codigo, nervuras: e.direcao === 'duas' ? 'duas' : 'x', passo: e.intereixo / 100, aoAlternar: alternar }));
        corte.replaceChildren(desenho.corteNervurada({ tipo: 'nervurada', h: e.h, hf: e.hf, bw: e.bw, e: e.intereixo, enchimento: e.enchimento }));
      };
      desenhar();
      const mudar = (fn, op) => { ctx.alterar(fn, op); desenhar(); };

      raiz.append(ui.secao({
        numero: '01', titulo: 'Geometria e vínculos', descricao: 'Clique numa borda para alternar apoiada, engastada e livre',
        filhos: [h('div', { class: 'laje-geo' },
          h('div', { class: 'laje-campos' },
            ui.linhaCampos(
              ui.campo({ rotulo: 'Vão lx', valor: el.lx, unidade: 'm', min: 1, max: 20, aoMudar: (v) => mudar((e) => { e.lx = v; }) }),
              ui.campo({ rotulo: 'Vão ly', valor: el.ly, unidade: 'm', min: 1, max: 20, aoMudar: (v) => mudar((e) => { e.ly = v; }) }),
            ),
            ui.segmentado({ rotulo: 'Nervuras', valor: el.direcao, compacto: true, opcoes: [{ valor: 'duas', texto: 'Duas direções' }, { valor: 'x', texto: 'Uma direção (x)' }], aoMudar: (v) => mudar((e) => { e.direcao = v; }, { estrutural: true }) }),
            pl.seletores(el.bordas, mudarBorda, { umaDirecao: el.direcao !== 'duas' }),
            pl.aviso(el.bordas, {
              umaDirecao: el.direcao !== 'duas',
              textoBalanco: el.direcao !== 'duas'
                ? 'Laje em balanço: nervuras engastadas numa borda e livres na outra; armadura negativa na mesa.'
                : 'Borda livre: as reações nas vigas vêm do modelo de placa; prever nervura de borda.',
            }),
          ),
          plantaSlot,
        )],
      }));

      raiz.append(ui.secao({
        numero: '02', titulo: 'Seção das nervuras',
        filhos: [
          ui.linhaCampos(
            ui.campo({ rotulo: 'Altura total h', valor: el.h, unidade: 'cm', casas: 1, min: 10, max: 80, aoMudar: (v) => mudar((e) => { e.h = v; }) }),
            ui.campo({ rotulo: 'Mesa hf', valor: el.hf, unidade: 'cm', casas: 1, min: 3, max: 15, aoMudar: (v) => mudar((e) => { e.hf = v; }) }),
            ui.campo({ rotulo: 'Nervura bw', valor: el.bw, unidade: 'cm', casas: 1, min: 4, max: 40, dica: 'Largura média', aoMudar: (v) => mudar((e) => { e.bw = v; }) }),
            ui.campo({ rotulo: 'Intereixo', valor: el.intereixo, unidade: 'cm', casas: 1, min: 30, max: 150, aoMudar: (v) => mudar((e) => { e.intereixo = v; }) }),
          ),
          ui.linhaCampos(
            ui.selecao({ rotulo: 'Enchimento', valor: el.enchimento, largura: '220px', opcoes: Object.entries(ENCHIMENTOS_N).map(([k, v]) => ({ valor: k, texto: v.nome })), aoMudar: (v) => mudar((e) => { e.enchimento = v; e.pesoEnchimento = ENCHIMENTOS_N[v].peso; }, { estrutural: true }) }),
            ui.campo({ rotulo: 'Peso do enchimento', valor: el.pesoEnchimento, unidade: 'kN/m³', min: 0, max: 25, largura: '150px', aoMudar: (v) => mudar((e) => { e.pesoEnchimento = v; }) }),
          ),
          corte,
        ],
      }));

      raiz.append(secaoArmadura(api, ctx, [
        { chave: 'nervura', rotulo: 'Barras das nervuras', uso: 'nervura' },
        { chave: 'superior', rotulo: 'Negativa na mesa', uso: 'laje' },
      ], { descricao: 'Bitolas — “Automática” escolhe a de menor consumo (até 4 barras por nervura)' }));

      const cg = cargasNervurada(el, ctx);
      const cl = camposCargasLaje(api, ctx);
      raiz.append(ui.secao({
        numero: '03', titulo: 'Cargas', descricao: 'Valores característicos por m²',
        filhos: [
          ui.linhaCampos(cl.uso),
          ui.linhaCampos(
            cl.revestimento,
            ui.campo({ rotulo: 'Outras permanentes', valor: el.cargas.outras, unidade: 'kN/m²', min: 0, largura: '150px', aoMudar: (v) => ctx.alterar((e) => { e.cargas.outras = v; }) }),
            cl.acidental,
            ui.alternar({ rotulo: `Peso próprio (${num(cg.pp)} kN/m²)`, valor: el.pesoProprio, aoMudar: (v) => ctx.alterar((e) => { e.pesoProprio = v; }, { estrutural: true }) }),
          ),
          ...cl.composicao,
          h('div', { class: 'cargas-resumo' }, h('span', { class: 'rot' }, 'Total característico'), `g = ${num(cg.g)} kN/m² · q = ${num(cg.q)} kN/m²`),
        ],
      }));
    },

    renderResultado(raiz, res) {
      const pos = res.armaduras.filter((a) => !a.negativa);
      const neg = res.armaduras.filter((a) => a.negativa);
      const maxPos = pos.length ? pos.reduce((a, b) => (b.Md > a.Md ? b : a), pos[0]) : null;
      const maxNeg = neg.length ? neg.reduce((a, b) => (b.Md < a.Md ? b : a), neg[0]) : null;
      raiz.append(h('div', { class: 'instrumentos' },
        (res.balanco || !maxPos) && maxNeg
          ? ui.numeroGrande({ rotulo: 'Momento no engaste', valor: num(maxNeg.Md, 2), unidade: 'kN·m', linhas: ['por nervura (balanço)', maxNeg.barras] })
          : ui.numeroGrande({ rotulo: 'Momento por nervura', valor: num(maxPos?.Md ?? 0, 2), unidade: 'kN·m', linhas: [maxPos?.rotulo.replace(' (positiva)', '') ?? '—', maxPos?.barras ?? '—'] }),
        neg.length
          ? ui.faixa({ rotulo: 'Momento negativo', valor: num(Math.min(...neg.map((a) => a.Md)), 2), fracaoDegrade: 0.7, rotEsq: neg[0].barras, rotDir: neg[1]?.barras ?? '' })
          : ui.numeroGrande({ rotulo: 'Peso próprio', valor: num(res.cargas.pp, 2), unidade: 'kN/m²', linhas: [res.duas ? 'Duas direções' : 'Uma direção', 'sem bordas engastadas'] }),
        ui.medidor({ rotulo: res.flecha.bordaLivre ? 'Flecha na borda livre' : 'Flecha total', valor: `${num(res.flecha.ft, 1)} mm`, fracao: res.flecha.ft / res.flecha.lim, legenda: `limite ${res.flecha.bordaLivre ? '2·l/250' : 'l/250'} = ${num(res.flecha.lim, 1)} mm` }),
        ui.arco({ rotulo: 'Cortante na nervura', valor: `${num((res.cortante.Vd / res.cortante.VR) * 100, 0)}%`, fracao: res.cortante.Vd / res.cortante.VR, legenda: res.cortante.criterio.startsWith('VRd1') ? 'VSd / VRd1' : 'VSd / VRd2' }),
      ));
      if (res.mapa) {
        let mi = 0, mj = 0;
        res.mapa.forEach((l, j) => l.forEach((v, i) => { if (v > res.mapa[mj][mi]) { mi = i; mj = j; } }));
        raiz.append(ui.secao({
          numero: '05', titulo: 'Mapa de deslocamentos', descricao: 'Placa equivalente',
          filhos: [h('div', { class: 'mapa-pontos', style: { maxWidth: '420px' } },
            ui.gradePontos({ colunas: res.mapa[0].length, celulas: res.mapa.flatMap((l, j) => l.map((v, i) => ({ nivel: v < 0.08 ? null : v, destaque: i === mi && j === mj }))), classe: 'mapa' }),
            h('span', { class: 'mapa-leg' }, `Flecha imediata máxima ${num(res.flecha.f0, 2)} mm`))],
        }));
      }
      raiz.append(ui.secao({
        numero: '06', titulo: 'Armaduras', descricao: 'Positivas por nervura; negativas por metro na mesa',
        filhos: [ui.tabela({
          colunas: [{ titulo: 'Posição' }, { titulo: 'Md (kN·m/nervura)', alinhar: 'dir' }, { titulo: 'As (cm²)', alinhar: 'dir' }, { titulo: 'Adotada' }],
          linhas: [
            ...res.armaduras.map((a) => [a.rotulo, num(a.Md), a.negativa ? `${num(a.porMetro)} /m` : num(a.As), a.barras]),
            ...(res.mesa ? [['Mesa entre nervuras', num(res.mesa.Md, 3), `${num(res.mesa.As)} /m`, res.mesa.barras]] : []),
          ],
        })],
      }));
      raiz.append(ui.secao({
        numero: '07', titulo: 'Reações nas vigas',
        descricao: res.metodoReacoes === 'placa' ? 'Modelo de placa (média por borda) — bordas livres não transmitem carga' : res.duas ? 'Processo das áreas' : 'Apenas as bordas x recebem as nervuras',
        filhos: [ui.tabela({
          colunas: [{ titulo: 'Borda' }, { titulo: 'Vínculo' }, { titulo: 'g,k (kN/m)', alinhar: 'dir' }, { titulo: 'q,k (kN/m)', alinhar: 'dir' }, { titulo: 'Cálculo (kN/m)', alinhar: 'dir' }],
          linhas: res.reacoes.map((r) => [r.nome, r.tipo, ...(r.tipo === 'livre' ? ['—', '—', '—'] : [num(r.g), num(r.q), num(r.d)])]),
        })],
      }));
    },
  };
}
