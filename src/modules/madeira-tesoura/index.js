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
/** Módulo: Tesoura de madeira (NBR 7190-1:2022) — treliça Howe ou Pratt de duas águas. */
import { calcularTesoura, criarTesoura, cargasTransmitidas, ligacoes } from './calculo.js';
import { TIPOS_TESOURA, GRUPOS_TESOURA } from '../../engine/tesoura.js';
import { secaoMaterial } from '../madeira-comum/material.js';
import { criarDesenhosTelhado } from '../madeira-comum/desenho-telhado.js';
import { vistaArmadura3D } from '../../renderer/ui/armadura3d.js';
import { modeloTesoura } from '../madeira-comum/telhado3d.js';

export default function moduloTesoura(api) {
  const { h } = api.dom;
  const ui = api.ui;
  const { num } = api.formatar;
  const d = criarDesenhosTelhado(api.dom);

  return {
    id: 'madeira.tesoura',
    nome: 'Tesoura de madeira',
    nomeCurto: 'Tesoura',
    categoria: 'telhados',
    novaCategoria: { id: 'telhados', nome: 'Telhados', ordem: 3.6 },
    prefixo: 'TS',
    sigla: 'MTS',
    icone: 'casa',
    forma: 'tesoura',
    material: 'Madeira',
    norma: 'NBR 7190-1:2022',
    versao: '0.1.0',
    descricao: 'Tesoura Howe ou Pratt: esforços nas barras, tração e compressão com flambagem, entalhe do nó de apoio e flecha.',
    montagem: false,

    criar: criarTesoura,
    calcular: calcularTesoura,
    cargasTransmitidas,
    ligacoes,
    resumo: (el) => `${(el.geometria?.tipo ?? 'howe') === 'pratt' ? 'Pratt' : 'Howe'} · ${el.telhadoId ? 'do telhado' : `${num(el.geometria?.vao ?? 0, 2)} m`} · ${el.classe}`,

    renderEntrada(raiz, ctx) {
      const el = ctx.elemento;
      const tel = el.telhadoId ? ctx.projeto.elementos.find((e) => e.id === el.telhadoId) : null;
      raiz.append(secaoMaterial(api, ctx, { numero: '01' }));
      const g = el.geometria;
      raiz.append(ui.secao({
        numero: '02', titulo: 'Geometria', descricao: tel ? `Vão, inclinação, painéis e espaçamento vêm do telhado ${tel.codigo}` : 'Duas águas simétricas, terças nos nós do banzo superior',
        filhos: [
          ui.segmentado({ rotulo: 'Tipo', valor: g.tipo ?? 'howe', opcoes: TIPOS_TESOURA.map((t) => ({ valor: t.valor, texto: t.texto })), aoMudar: (v) => ctx.alterar((e, p) => { e.geometria = { ...e.geometria, tipo: v }; const t = p.elementos.find((x) => x.id === e.telhadoId); if (t) t.tipoTesoura = v; }, { estrutural: true }) }),
          h('p', { class: 'combinacoes-nota' }, TIPOS_TESOURA.find((t) => t.valor === (g.tipo ?? 'howe'))?.descricao ?? ''),
          tel ? ui.linhaCampos(
            ui.botao({ texto: `Abrir ${tel.codigo}`, icone: 'direita', tipo: 'fantasma', aoClicar: () => ctx.abrirElemento(tel.id) }),
            ui.botao({ texto: 'Desligar do telhado', icone: 'fechar', tipo: 'fantasma', aoClicar: () => ctx.alterar((e) => { const t = tel; e.geometria = { ...e.geometria, vao: t.vao, inclinacao: t.inclinacao, paineis: t.paineis }; e.telhadoId = null; }, { estrutural: true }) }),
          ) : ui.linhaCampos(
            ui.campo({ rotulo: 'Vão', valor: g.vao, unidade: 'm', casas: 2, min: 2, max: 30, largura: '120px', aoMudar: (v) => ctx.alterar((e) => { e.geometria.vao = v; }) }),
            ui.campo({ rotulo: 'Inclinação', valor: g.inclinacao, unidade: '%', casas: 1, min: 5, max: 120, largura: '130px', aoMudar: (v) => ctx.alterar((e) => { e.geometria.inclinacao = v; }) }),
            ui.campo({ rotulo: 'Painéis', valor: g.paineis, casas: 0, min: 2, max: 16, largura: '110px', dica: 'Número par', aoMudar: (v) => ctx.alterar((e) => { e.geometria.paineis = Math.max(2, 2 * Math.round(v / 2)); }) }),
            ui.campo({ rotulo: 'Espaçamento', valor: el.espacamento, unidade: 'm', casas: 2, min: 0.5, max: 6, largura: '140px', dica: 'Entre tesouras: largura de influência', aoMudar: (v) => ctx.alterar((e) => { e.espacamento = v; }) }),
          ),
        ],
      }));
      const linhaSecao = (k) => ui.linhaCampos(
        h('span', { class: 'tl-rotulo-peca' }, GRUPOS_TESOURA[k]),
        ui.campo({ rotulo: 'b', valor: el.secoes[k].b, unidade: 'cm', casas: 1, min: 2, max: 40, largura: '110px', dica: 'Espessura (fora do plano da tesoura)', aoMudar: (v) => ctx.alterar((e) => { e.secoes[k] = { ...e.secoes[k], b: v }; }) }),
        ui.campo({ rotulo: 'h', valor: el.secoes[k].h, unidade: 'cm', casas: 1, min: 2, max: 60, largura: '110px', dica: 'Altura (no plano da tesoura)', aoMudar: (v) => ctx.alterar((e) => { e.secoes[k] = { ...e.secoes[k], h: v }; }) }),
      );
      raiz.append(ui.secao({
        numero: '03', titulo: 'Seções', descricao: 'Peças simples; o banzo superior é travado fora do plano pelas terças em cada nó',
        filhos: [...Object.keys(GRUPOS_TESOURA).map(linhaSecao),
          ui.linhaCampos(ui.campo({ rotulo: 'Área líquida nas ligações', valor: el.areaLiquida ?? 85, unidade: '%', casas: 0, min: 40, max: 100, largura: '200px', dica: 'Fração da área bruta que resta nas barras tracionadas depois de furos e entalhes', aoMudar: (v) => ctx.alterar((e) => { e.areaLiquida = v; }) }))],
      }));
      if (!tel) raiz.append(ui.secao({
        numero: '04', titulo: 'Cargas', descricao: 'Características — telhado (telhas, ripas, caibros, terças) por m² de telhado; sobrecarga em projeção horizontal',
        filhos: [ui.linhaCampos(
          ui.campo({ rotulo: 'Telhado', valor: el.cargas.telhado, unidade: 'kN/m²', casas: 2, min: 0, max: 3, largura: '130px', aoMudar: (v) => ctx.alterar((e) => { e.cargas.telhado = v; }) }),
          ui.campo({ rotulo: 'Sobrecarga', valor: el.cargas.sobrecarga, unidade: 'kN/m²', casas: 2, min: 0, max: 3, largura: '140px', aoMudar: (v) => ctx.alterar((e) => { e.cargas.sobrecarga = v; }) }),
          ui.campo({ rotulo: 'Forro', valor: el.cargas.forro, unidade: 'kN/m²', casas: 2, min: 0, max: 3, largura: '120px', aoMudar: (v) => ctx.alterar((e) => { e.cargas.forro = v; }) }),
          ui.campo({ rotulo: 'Sucção do vento', valor: el.cargas.vento, unidade: 'kN/m²', casas: 2, min: 0, max: 5, largura: '150px', aoMudar: (v) => ctx.alterar((e) => { e.cargas.vento = v; }) }),
        )],
      }));
    },

    renderResultado(raiz, r, ctx) {
      const el = ctx.elemento;
      const maxC = Math.max(0, ...r.barras.map((b) => -b.Nc)), maxT = Math.max(0, ...r.barras.map((b) => b.Nt));
      raiz.append(h('div', { class: 'instrumentos' },
        ui.arco({ rotulo: 'Barra mais solicitada', valor: `${num(r.uso * 100, 0)}%`, fracao: r.uso, legenda: r.barras.reduce((a, b) => (b.uso > a.uso ? b : a)).nome }),
        ui.numeroGrande({ rotulo: 'Compressão máxima', valor: num(maxC, 1), unidade: 'kN', linhas: ['Nd de cálculo', `tração máx. ${num(maxT, 1)} kN`] }),
        ui.medidor({ rotulo: 'Flecha final', valor: `${num(r.flecha.ufin, 1)} mm`, fracao: r.flecha.ufin / r.flecha.ulim, legenda: `limite ${num(r.flecha.ulim, 1)} mm · com fluência` }),
        ui.numeroGrande({ rotulo: 'Madeira', valor: num(r.volume, 3), unidade: 'm³', linhas: [`peso ${num(r.peso, 2)} kN`, `${r.paineis} painéis · ${r.telhado ? `telhado ${r.telhado}` : 'cargas informadas'}`] }),
      ));
      raiz.append(ui.secao({ numero: '05', titulo: 'Esforços', descricao: 'Esforço normal de cálculo que governa cada barra; linha vermelha tracejada: barra que não atende',
        filhos: [h('div', { class: 'desenho-caixa' }, d.elevacaoTesoura(r))] }));
      const m3d = modeloTesoura(r, el.secoes);
      raiz.append(ui.secao({ numero: '06', titulo: 'Tesoura em 3D', descricao: 'Peças com as seções do cálculo, coloridas pelo esforço que governa', filhos: [h('div', null, vistaArmadura3D(m3d, { altura: 400 }), h('p', { class: 'combinacoes-nota a3d-legenda' }, m3d.legenda))] }));
      raiz.append(ui.secao({ numero: '07', titulo: 'Barras', descricao: 'NG, NQ e NW característicos; Nt e Nc de cálculo (combinação que governa)',
        filhos: [ui.tabela({
          colunas: [{ titulo: 'Barra' }, { titulo: 'Seção' }, { titulo: 'L (m)', alinhar: 'dir' }, { titulo: 'NG', alinhar: 'dir' }, { titulo: 'NQ', alinhar: 'dir' }, { titulo: 'NW', alinhar: 'dir' }, { titulo: 'Nt,d', alinhar: 'dir' }, { titulo: 'Nc,d', alinhar: 'dir' }, { titulo: 'λ', alinhar: 'dir' }, { titulo: 'Uso', alinhar: 'dir' }],
          linhas: r.barras.map((b) => [b.nome, `${num(b.b, 0)} × ${num(b.h, 0)}`, num(b.L, 2), num(b.NG, 1), num(b.NQ, 1), num(b.NW, 1), b.Nt > 0 ? `${num(b.Nt, 1)} (${b.combT})` : '—', b.Nc < 0 ? `${num(-b.Nc, 1)} (${b.combC})` : '—', b.lambda ?? '—', `${num(b.uso * 100, 0)}%${b.ok ? '' : ' ✗'}`]),
        })] }));
      raiz.append(ui.secao({ numero: '08', titulo: 'Nó de apoio e reações', descricao: 'Entalhe simples da perna na linha; reações por tesoura (kN)',
        filhos: [
          h('div', { class: 'desenho-caixa centro' }, d.noApoio(r, el.secoes)),
          ui.tabela({ colunas: [{ titulo: 'Apoio' }, { titulo: 'Rg,k', alinhar: 'dir' }, { titulo: 'Rq,k', alinhar: 'dir' }, { titulo: 'Rw,k', alinhar: 'dir' }, { titulo: 'Rd (G+Q)', alinhar: 'dir' }, { titulo: 'Rd (G+W)', alinhar: 'dir' }],
            linhas: r.apoios.map((a) => [a.id, num(a.Rg, 2), num(a.Rq, 2), num(a.Rw, 2), num(a.Rd, 2), a.Rd3 == null ? '—' : num(a.Rd3, 2)]) }),
        ] }));
    },
  };
}
