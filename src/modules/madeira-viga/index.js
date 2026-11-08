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
 * Módulo: Viga de madeira (NBR 7190-1:2022)
 */
import { secaoCombinacoes } from '../comum/combinacoes.js';
import { calcularVigaMadeira, cargasTransmitidas, ligacoes, criarVigaMadeira } from './calculo.js';
import { criarDesenhos } from '../concreto-viga/desenho.js';
import { criarDesenhosMadeira } from '../madeira-comum/desenho.js';
import { secaoMaterial, materialDoElemento } from '../madeira-comum/material.js';
import { editorCargas } from '../comum/cargas.js';
import { editorVaos } from '../comum/vaos.js';

export default function moduloVigaMadeira(api) {
  const { h } = api.dom;
  const ui = api.ui;
  const { num } = api.formatar;
  const dViga = criarDesenhos(api.dom);
  const dMad = criarDesenhosMadeira(api.dom);

  return {
    id: 'madeira.viga',
    nome: 'Viga de madeira',
    nomeCurto: 'Viga de madeira',
    categoria: 'vigas',
    prefixo: 'VM',
    sigla: 'MV1',
    icone: 'madeira',
    forma: 'viga', // ícone do tipo de elemento no cabeçalho
    material: 'Madeira',
    norma: 'NBR 7190-1:2022',
    versao: '0.1.0',
    descricao: 'Vigas contínuas de seção retangular: flexão, cisalhamento, estabilidade lateral, apoio e flecha com fluência.',

    criar: criarVigaMadeira,
    calcular: calcularVigaMadeira,
    cargasTransmitidas,
    ligacoes,
    resumo: (el) => `${el.classe} · ${num(el.secao.b, 1)} × ${num(el.secao.h, 1)} cm · ${el.vaos.length} ${el.vaos.length > 1 ? 'vãos' : 'vão'}`,

    renderEntrada(raiz, ctx) {
      const el = ctx.elemento;
      const esquemaSlot = h('div', { class: 'esquema-slot' });
      const secaoSlot = h('div', { class: 'previa-secao' });
      const desenhar = () => {
        esquemaSlot.replaceChildren(dViga.esquema(ctx.elemento));
        secaoSlot.replaceChildren(dMad.secao(ctx.elemento.secao));
      };
      desenhar();
      const mudar = (fn, op = {}) => { ctx.alterar(fn, op); if (!op.estrutural) desenhar(); };
      const { sequencia, acoes } = editorVaos(api, ctx, mudar);

      raiz.append(secaoMaterial(api, ctx, { numero: '01' }));
      raiz.append(ui.secao({
        numero: '02', titulo: 'Seção e vãos',
        filhos: [
          h('div', { class: 'pilar-geo' },
            h('div', { class: 'laje-campos' },
              ui.linhaCampos(
                ui.campo({ rotulo: 'Largura b', valor: el.secao.b, unidade: 'cm', casas: 1, min: 2, max: 60, aoMudar: (v) => mudar((e) => { e.secao.b = v; }) }),
                ui.campo({ rotulo: 'Altura h', valor: el.secao.h, unidade: 'cm', casas: 1, min: 4, max: 200, aoMudar: (v) => mudar((e) => { e.secao.h = v; }) }),
                ui.campo({ rotulo: 'Apoio c', valor: el.apoioC ?? 10, unidade: 'cm', casas: 1, min: 2, max: 60, dica: 'Comprimento de apoio, para a compressão normal ao grão', aoMudar: (v) => ctx.alterar((e) => { e.apoioC = v; }) }),
              ),
              ui.alternar({ rotulo: 'Borda comprimida travada continuamente (piso, forro, terças)', valor: el.travamento?.continuo, aoMudar: (v) => ctx.alterar((e) => { (e.travamento ??= {}).continuo = v; }, { estrutural: true }) }),
              !el.travamento?.continuo && ui.campo({ rotulo: 'Travamento lateral L1', valor: el.travamento?.L1 ?? Math.max(...el.vaos.map((v) => v.L)), unidade: 'm', min: 0.1, max: 30, largura: '170px', dica: 'Distância entre pontos que impedem o giro lateral da borda comprimida', aoMudar: (v) => ctx.alterar((e) => { (e.travamento ??= {}).L1 = v; }) }),
            ),
            secaoSlot,
          ),
          esquemaSlot, sequencia, acoes,
        ],
      }));

      const { lista, botaoAdd } = editorCargas(api, ctx, { tipos: ['distribuida', 'concentrada', 'alvenaria', 'elemento'], ligacao: 'linear' });
      const { m } = materialDoElemento(el, ctx.projeto.parametros);
      raiz.append(ui.secao({
        numero: '03', titulo: 'Cargas', descricao: 'Valores característicos',
        acoes: [botaoAdd],
        filhos: [
          ui.alternar({ rotulo: `Peso próprio (${num((m.peso * el.secao.b * el.secao.h) / 1e4, 3)} kN/m)`, valor: el.pesoProprio, aoMudar: (v) => ctx.alterar((e) => { e.pesoProprio = v; }) }),
          lista,
        ],
      }));
    },

    renderResultado(raiz, res, ctx) {
      const el = ctx.elemento;
      const fMax = res.vaos.reduce((a, v, i) => (v.flecha.ufin / v.flecha.lim > res.vaos[a].flecha.ufin / res.vaos[a].flecha.lim ? i : a), 0);
      raiz.append(h('div', { class: 'instrumentos' },
        ui.arco({ rotulo: 'Flexão', valor: `${num(res.usoFlexao * 100, 0)}%`, fracao: res.usoFlexao, legenda: 'σM,d / fm,d' }),
        ui.arco({ rotulo: 'Cisalhamento', valor: `${num(res.usoCis * 100, 0)}%`, fracao: res.usoCis, legenda: 'τd / fv,d' }),
        ui.medidor({ rotulo: 'Flecha final', valor: `${num(res.vaos[fMax].flecha.ufin, 1)} mm`, fracao: res.flechaRazao, legenda: `limite ${num(res.vaos[fMax].flecha.lim, 1)} mm · com fluência` }),
        ui.numeroGrande({ rotulo: 'Momento de cálculo', valor: num(Math.max(res.MdPos, -res.MdNeg), 2), unidade: 'kN·m', linhas: [`Classe ${res.classe}`, `Vd ${num(res.VdMax, 1)} kN`] }),
      ));
      raiz.append(ui.secao({ numero: '05', titulo: 'Diagramas', descricao: 'Envoltória ELU: máximo (linha contínua) e mínimo (linha tracejada) em cada seção; flecha final', filhos: [h('div', { class: 'desenho-caixa' }, dViga.diagramas(el, res, { tituloFlecha: 'FLECHA FINAL COM FLUÊNCIA (ELS)' }))] }));
      raiz.append(ui.secao({
        numero: '06', titulo: 'Reações de apoio',
        filhos: [ui.tabela({
          colunas: [{ titulo: 'Apoio' }, { titulo: 'Tipo' }, { titulo: 'Rg,k (kN)', alinhar: 'dir' }, { titulo: 'Rq,k (kN)', alinhar: 'dir' }, { titulo: 'Rd (kN)', alinhar: 'dir' }, { titulo: 'Combinação' }],
          linhas: res.apoios.map((a, k) => [`A${k + 1}`, a.tipo, num(a.Rg), num(a.Rq), num(a.Rd), a.comb?.Rd ?? '—']),
        })],
      }));
      if (res.combinacoes) raiz.append(secaoCombinacoes(api, res, {
        governa: [
          res.comb?.MdPos && [res.comb.MdPos, 'Md+ máximo'], res.comb?.MdNeg && [res.comb.MdNeg, 'Md− máximo'], res.comb?.Vd && [res.comb.Vd, 'Vd máximo'],
          ...res.apoios.map((a, k) => a.tipo !== 'livre' && a.comb?.Rd && [a.comb.Rd, `Rd apoio ${k + 1}`]),
        ].filter(Boolean),
        usoEls: 'Flecha final: quase permanente com fluência.',
      }));
    },
  };
}
