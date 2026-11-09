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
 * Módulo: Laje treliçada (NBR 6118:2023 · NBR 14859)
 */
import { camposCargasLaje } from '../comum/cargas-laje.js';
import { secaoArmadura } from '../comum/armadura.js';
import { calcularLajeTrelicada, cargasTransmitidas, ligacoes, criarLajeTrelicada, cargasTrelicada, trelicaAdotada, TRELICAS, ENCHIMENTOS } from './calculo.js';
import { criarDesenhosLajes } from '../comum/desenho-lajes.js';
import { criarPlantaLaje } from '../comum/planta-laje.js';
import { bordasFaixa, faixaNaPlanta } from '../comum/bordas.js';
import { modeloTrelicada } from '../comum/armadura3d.js';
import { vistaArmadura3D } from '../../renderer/ui/armadura3d.js';

export default function moduloLajeTrelicada(api) {
  const { h } = api.dom;
  const ui = api.ui;
  const { num } = api.formatar;
  const desenho = criarDesenhosLajes(api.dom);
  const pl = criarPlantaLaje(api);

  return {
    id: 'concreto.laje.trelicada',
    nome: 'Laje treliçada',
    nomeCurto: 'Laje treliçada',
    categoria: 'lajes',
    prefixo: 'LT',
    sigla: 'CL2',
    icone: 'laje',
    material: 'Concreto armado',
    norma: 'NBR 6118:2023 · NBR 14859',
    versao: '0.2.0',
    descricao: 'Vigotas treliçadas com lajota cerâmica ou EPS; nervura T, treliça TR, contraflecha; bordas apoiadas, engastadas ou livres (balanço).',

    criar: criarLajeTrelicada,
    calcular: calcularLajeTrelicada,
    cargasTransmitidas,
    ligacoes,
    resumo: (el) => `H${num(el.he + el.hf, 0)} (${num(el.he, 0)}+${num(el.hf, 0)}) · vão ${num(el.L)} m · vigotas em ${el.direcao === 'y' ? 'y' : 'x'}`,

    renderEntrada(raiz, ctx) {
      const el = ctx.elemento;
      const corte = h('div', { class: 'desenho-caixa' });
      const esquema = h('div', { class: 'esquema-slot' });
      const plantaSlot = h('div', { class: 'planta-slot' });
      const mudarBorda = (id, v) => ctx.alterar((e) => { e.bordas = { ...bordasFaixa(e), [id]: v }; delete e.vinculo; }, { estrutural: true });
      const desenhar = () => {
        const e = ctx.elemento;
        const f = faixaNaPlanta(e); // planta (lx × ly, bordas da planta) e referencial das vigotas
        corte.replaceChildren(desenho.corteNervurada({ tipo: 'trelicada', h: e.he + e.hf, hf: e.hf, bw: e.bw, e: e.intereixo, enchimento: e.enchimento, trelica: trelicaAdotada(e) }));
        esquema.replaceChildren(desenho.esquemaFaixa({ L: e.L, bordas: f.local }));
        plantaSlot.replaceChildren(pl.planta({ lx: f.lx, ly: f.ly, bordas: f.plano, codigo: e.codigo, nervuras: f.dir, passo: e.intereixo / 100,
          aoAlternar: (id) => mudarBorda(id, pl.proximo(id, f.plano[id], { umaDirecao: true, direcao: f.dir })) }));
      };
      /** Gira as vigotas 90° mantendo a laje: o vão passa a ser a outra dimensão da planta. */
      const mudarSentido = (dir) => ctx.alterar((e) => {
        if ((e.direcao === 'y' ? 'y' : 'x') === dir) return;
        e.bordas = bordasFaixa(e);
        delete e.vinculo;
        [e.L, e.largura] = [e.largura, e.L];
        e.direcao = dir;
      }, { descricao: 'Sentido das vigotas', estrutural: true });
      const fp = faixaNaPlanta(el);
      desenhar();
      const mudar = (fn, op) => { ctx.alterar(fn, op); desenhar(); };
      const tr = trelicaAdotada(el);

      raiz.append(ui.secao({
        numero: '01', titulo: 'Vão e bordas', descricao: `Vigotas na direção ${fp.dir}, vencendo o vão L · planta ${num(fp.lx)} × ${num(fp.ly)} m · clique numa borda para alternar o vínculo`,
        filhos: [
          h('div', { class: 'laje-geo' },
            h('div', { class: 'laje-campos' },
              ui.segmentado({
                rotulo: 'Sentido das vigotas', valor: fp.dir, compacto: true,
                opcoes: [
                  { valor: 'x', texto: 'Direção x (horizontal)', dica: 'Vigotas apoiadas nas bordas esquerda e direita' },
                  { valor: 'y', texto: 'Direção y (vertical)', dica: 'Vigotas apoiadas nas bordas inferior e superior' },
                ],
                aoMudar: (v) => mudarSentido(v),
              }),
              ui.linhaCampos(
                ui.campo({ rotulo: `Vão L (em ${fp.dir})`, valor: el.L, unidade: 'm', min: 0.5, max: 9, dica: 'Vão vencido pelas vigotas; em balanço, é o comprimento do balanço', aoMudar: (v) => mudar((e) => { e.L = v; }) }),
                ui.campo({ rotulo: `Largura (em ${fp.dir === 'y' ? 'x' : 'y'})`, valor: el.largura, unidade: 'm', min: 0.3, max: 30, dica: 'Dimensão perpendicular às vigotas; usada para contar as vigotas', aoMudar: (v) => mudar((e) => { e.largura = v; }) }),
              ),
              pl.seletores(fp.plano, mudarBorda, { umaDirecao: true, direcao: fp.dir }),
              pl.aviso(fp.plano, { umaDirecao: true, direcao: fp.dir, textoBalanco: 'Laje em balanço: as vigotas ficam engastadas numa borda e livres na outra; a armadura negativa vai na capa.' }),
            ),
            plantaSlot,
          ),
          esquema,
        ],
      }));

      raiz.append(ui.secao({
        numero: '02', titulo: 'Seção', descricao: 'Altura total = enchimento + capa',
        filhos: [
          ui.linhaCampos(
            ui.selecao({ rotulo: 'Enchimento', valor: el.he, largura: '120px', opcoes: [8, 12, 16, 20, 25].map((v) => ({ valor: v, texto: `H${v} (${v} cm)` })), aoMudar: (v) => mudar((e) => { e.he = v; }, { estrutural: true }) }),
            ui.campo({ rotulo: 'Capa hf', valor: el.hf, unidade: 'cm', casas: 1, min: 3, max: 10, aoMudar: (v) => mudar((e) => { e.hf = v; }) }),
            ui.campo({ rotulo: 'Intereixo', valor: el.intereixo, unidade: 'cm', casas: 1, min: 30, max: 80, aoMudar: (v) => mudar((e) => { e.intereixo = v; }) }),
            ui.campo({ rotulo: 'Nervura bw', valor: el.bw, unidade: 'cm', casas: 1, min: 4, max: 20, dica: 'Largura média da nervura moldada', aoMudar: (v) => mudar((e) => { e.bw = v; }) }),
          ),
          ui.linhaCampos(
            ui.selecao({ rotulo: 'Tipo de enchimento', valor: el.enchimento, largura: '170px', opcoes: Object.entries(ENCHIMENTOS).map(([k, v]) => ({ valor: k, texto: v.nome })),
              aoMudar: (v) => mudar((e) => { e.enchimento = v; e.pesoEnchimento = ENCHIMENTOS[v].peso; }, { estrutural: true }) }),
            ui.campo({ rotulo: 'Peso do enchimento', valor: el.pesoEnchimento, unidade: 'kN/m³', min: 0, max: 25, largura: '150px', dica: 'Peso específico aparente do bloco', aoMudar: (v) => mudar((e) => { e.pesoEnchimento = v; }) }),
            ui.selecao({ rotulo: 'Treliça', valor: el.trelica ?? 'auto', largura: '210px', opcoes: [{ valor: 'auto', texto: `Automática (${tr.nome})` }, ...TRELICAS.map((t) => ({ valor: t.nome, texto: t.nome }))], aoMudar: (v) => mudar((e) => { e.trelica = v; }, { estrutural: true }) }),
          ),
          corte,
        ],
      }));

      raiz.append(secaoArmadura(api, ctx, [
        { chave: 'adicional', rotulo: 'Barras adicionais na vigota', uso: 'laje' },
        { chave: 'superior', rotulo: 'Negativa na capa', uso: 'laje' },
      ], { descricao: 'Além da treliça — “Automática” escolhe a de menor consumo (até 2 barras adicionais por vigota)' }));

      const cg = cargasTrelicada(el, ctx);
      const cl = camposCargasLaje(api, ctx);
      raiz.append(ui.secao({
        numero: '03', titulo: 'Cargas', descricao: 'Valores característicos por m²',
        filhos: [
          ui.linhaCampos(cl.uso),
          ui.linhaCampos(
            cl.revestimento,
            ui.campo({ rotulo: 'Outras permanentes', valor: el.cargas.outras, unidade: 'kN/m²', min: 0, largura: '150px', aoMudar: (v) => ctx.alterar((e) => { e.cargas.outras = v; }) }),
            cl.acidental,
            ui.campo({ rotulo: 'Contraflecha', valor: el.contraflecha ?? 0, unidade: 'mm', min: 0, max: 60, largura: '130px', dica: 'Limitada a L/350 (13.3)', aoMudar: (v) => ctx.alterar((e) => { e.contraflecha = v; }) }),
            ui.alternar({ rotulo: `Peso próprio (${num(cg.pp)} kN/m²)`, valor: el.pesoProprio, aoMudar: (v) => ctx.alterar((e) => { e.pesoProprio = v; }, { estrutural: true }) }),
          ),
          ...cl.composicao,
          h('div', { class: 'cargas-resumo' }, h('span', { class: 'rot' }, 'Total característico'), `g = ${num(cg.g)} kN/m² · q = ${num(cg.q)} kN/m²`),
        ],
      }));
    },

    renderResultado(raiz, res, ctx) {
      const fl = res.flecha;
      raiz.append(h('div', { class: 'instrumentos' },
        res.balanco
          ? ui.numeroGrande({ rotulo: 'Momento no engaste', valor: num(res.MdNeg, 2), unidade: 'kN·m', linhas: ['por nervura (balanço)', res.negativa ? `capa: ${res.negativa.rotulo}` : '—'] })
          : ui.numeroGrande({ rotulo: 'Momento por nervura', valor: num(res.MdPos, 2), unidade: 'kN·m', linhas: [res.trelica, res.adicional ? `+ ${res.adicional.rotulo}` : 'sem barra adicional'] }),
        ui.medidor({ rotulo: fl.contraflecha > 0 ? 'Flecha − contraflecha' : 'Flecha total', valor: `${num(fl.final, 1)} mm`, fracao: fl.final / fl.lim, legenda: `limite ${num(fl.lim, 1)} mm` }),
        ui.arco({ rotulo: 'Cortante na nervura', valor: `${num((res.cortante.Vd / res.cortante.VR) * 100, 0)}%`, fracao: res.cortante.Vd / res.cortante.VR, legenda: res.cortante.comoLaje ? 'VSd / VRd1' : 'VSd / VRd2' }),
        ui.numeroGrande({ rotulo: 'Peso próprio', valor: num(res.cargas.pp, 2), unidade: 'kN/m²', linhas: [`H${num(res.h, 0)} · bf ${num(res.bf, 1)} cm`, `${res.nervuras} vigotas`] }),
      ));
      raiz.append(ui.secao({
        numero: '05', titulo: 'Armaduras', descricao: 'Por nervura (vigota) e na capa',
        filhos: [ui.tabela({
          colunas: [{ titulo: 'Posição' }, { titulo: 'Necessária (cm²)', alinhar: 'dir' }, { titulo: 'Adotada' }],
          linhas: [
            ['Positiva por nervura', num(res.AsPos), `${res.trelica} (banzo ${num(res.AsTrel)} cm² CA-60)${res.adicional ? ` + ${res.adicional.rotulo}` : ''} · ${num(res.AsPosEf)} cm² equivalentes`],
            ...(res.negativa ? [['Negativa (capa, sobre o apoio)', `${num(res.negativa.porMetro)} /m`, res.negativa.rotulo]] : []),
            ['Distribuição na capa', '0,90 /m', res.distribuicao],
          ],
        })],
      }));
      // vista 3D: vigotas com a treliça, adicionais, enchimento, capa com a distribuição e as negativas
      const el3d = ctx?.elemento;
      if (el3d) {
        let vista;
        try {
          const modelo = modeloTrelicada(el3d, res, trelicaAdotada(el3d), { cob: ctx.projeto?.parametros?.cobrimento?.laje ?? 2.5 });
          vista = h('div', { class: 'desenho-caixa desenho-3d' },
            h('div', { class: 'desenho-3d-tit' }, `VISTA 3D · VIGOTAS ${res.trelica} E CAPA`),
            vistaArmadura3D(modelo, { altura: 440 }),
            h('p', { class: 'combinacoes-nota a3d-legenda' }, `${modelo.legenda}. Desenhada no sentido das vigotas (x = vão L). Arraste para girar; o botão Concreto mostra ou esconde a capa, as nervuras e o enchimento.`));
        } catch (err) {
          vista = h('p', { class: 'combinacoes-nota' }, `Não foi possível montar a vista 3D: ${err.message}`);
        }
        raiz.append(ui.secao({ numero: '06', titulo: 'Vista 3D', descricao: `Vigotas treliçadas (${res.trelica}), enchimento e capa · armaduras do cálculo`, filhos: [vista] }));
      }
      raiz.append(ui.secao({
        numero: el3d ? '07' : '06', titulo: 'Reações nas vigas', descricao: res.balanco ? 'Por metro de viga · a borda livre e as laterais não recebem carga' : 'Por metro de viga · as bordas laterais não recebem carga',
        filhos: [ui.tabela({
          colunas: [{ titulo: 'Borda' }, { titulo: 'Vínculo' }, { titulo: 'g,k (kN/m)', alinhar: 'dir' }, { titulo: 'q,k (kN/m)', alinhar: 'dir' }, { titulo: 'Cálculo (kN/m)', alinhar: 'dir' }],
          linhas: res.reacoes.map((r) => [r.nome, r.tipo ?? 'apoiada', num(r.g), num(r.q), num(r.d)]),
        })],
      }));
    },
  };
}
