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
 * Módulo: Pilar / montante de madeira (NBR 7190-1:2022 · NBR 16936:2023)
 */
import { calcularPilarMadeira, cargasTransmitidas, ligacoes, criarPilarMadeira, normalCaracteristica } from './calculo.js';
import { KE_VINCULOS } from '../../engine/madeira.js';
import { criarDesenhosMadeira } from '../madeira-comum/desenho.js';
import { secaoMaterial, materialDoElemento } from '../madeira-comum/material.js';
import { editorCargas } from '../comum/cargas.js';

export default function moduloPilarMadeira(api) {
  const { h } = api.dom;
  const ui = api.ui;
  const { num } = api.formatar;
  const dMad = criarDesenhosMadeira(api.dom);

  return {
    id: 'madeira.pilar',
    nome: 'Pilar de madeira',
    nomeCurto: 'Pilar de madeira',
    categoria: 'pilares',
    prefixo: 'PM',
    sigla: 'MP1',
    icone: 'madeira',
    forma: 'pilar', // ícone do tipo de elemento no cabeçalho
    material: 'Madeira',
    norma: 'NBR 7190-1:2022 · NBR 16936:2023',
    versao: '0.1.0',
    descricao: 'Pilares e montantes retangulares: esbeltez relativa (kc), flexocompressão e montantes travados pelo painel.',

    criar: criarPilarMadeira,
    calcular: calcularPilarMadeira,
    cargasTransmitidas,
    ligacoes,
    resumo: (el) => `${el.classe} · ${num(el.b, 1)} × ${num(el.h, 1)} cm · L ${num(el.comprimento)} m${el.montante ? ' · montante' : ''}`,

    renderEntrada(raiz, ctx) {
      const el = ctx.elemento;
      const previa = h('div', { class: 'previa-secao' });
      const desenhar = () => previa.replaceChildren(dMad.secao({ b: ctx.elemento.b, h: ctx.elemento.h, travadoY: ctx.elemento.montante }));
      desenhar();
      const mudar = (fn, op) => { ctx.alterar(fn, op); desenhar(); };

      raiz.append(secaoMaterial(api, ctx, { numero: '01' }));
      raiz.append(ui.secao({
        numero: '02', titulo: 'Seção e flambagem', descricao: 'b na direção do eixo fraco, h na do eixo forte',
        filhos: [h('div', { class: 'pilar-geo' },
          h('div', { class: 'laje-campos' },
            ui.linhaCampos(
              ui.campo({ rotulo: 'Largura b', valor: el.b, unidade: 'cm', casas: 1, min: 2, max: 100, aoMudar: (v) => mudar((e) => { e.b = v; }) }),
              ui.campo({ rotulo: 'Altura h', valor: el.h, unidade: 'cm', casas: 1, min: 2, max: 100, aoMudar: (v) => mudar((e) => { e.h = v; }) }),
              ui.campo({ rotulo: 'Comprimento L', valor: el.comprimento, unidade: 'm', min: 0.3, max: 20, aoMudar: (v) => mudar((e) => { e.comprimento = v; }) }),
            ),
            ui.linhaCampos(
              ui.selecao({ rotulo: 'Vinculação — eixo x', valor: el.KEx, largura: '330px', opcoes: KE_VINCULOS, aoMudar: (v) => ctx.alterar((e) => { e.KEx = v; }) }),
              ui.selecao({ rotulo: 'Vinculação — eixo y', valor: el.KEy, largura: '330px', opcoes: KE_VINCULOS, aoMudar: (v) => ctx.alterar((e) => { e.KEy = v; }) }),
            ),
            ui.alternar({ rotulo: 'Montante de parede light wood frame (eixo y travado pelo painel)', valor: el.montante, aoMudar: (v) => mudar((e) => { e.montante = v; }, { estrutural: true }) }),
            el.montante && ui.campo({ rotulo: 'Espaçamento do travamento', valor: el.travamentoY, unidade: 'm', min: 0.05, max: 10, largura: '190px', dica: 'Distância entre fixações do painel ou bloqueadores', aoMudar: (v) => ctx.alterar((e) => { e.travamentoY = v; }) }),
          ),
          previa,
        )],
      }));

      const { lista, botaoAdd } = editorCargas(api, ctx, { tipos: ['concentrada', 'elemento'], ligacao: 'pontual', porVao: false });
      const { m } = materialDoElemento(el, ctx.projeto.parametros);
      let total = null;
      try { const n = normalCaracteristica(el, ctx.contextoCalculo(), m); total = `Nk = ${num(n.g)} (g) + ${num(n.q)} (q) = ${num(n.g + n.q)} kN`; } catch { /* cargas incompletas */ }
      raiz.append(ui.secao({
        numero: '03', titulo: 'Cargas', descricao: 'Normais características no topo',
        acoes: [botaoAdd],
        filhos: [
          ui.alternar({ rotulo: `Peso próprio (${num((m.peso * el.b * el.h * el.comprimento) / 1e4, 3)} kN)`, valor: el.pesoProprio, aoMudar: (v) => ctx.alterar((e) => { e.pesoProprio = v; }, { estrutural: true }) }),
          lista,
          total && h('div', { class: 'cargas-resumo' }, h('span', { class: 'rot' }, 'Total'), total),
          ui.linhaCampos(
            ui.campo({ rotulo: 'Momento Mx (g)', valor: el.momentos?.x ?? 0, unidade: 'kN·m', largura: '150px', dica: 'Momento característico permanente em torno de x', aoMudar: (v) => ctx.alterar((e) => { (e.momentos ??= {}).x = v; }) }),
            ui.campo({ rotulo: 'Momento My (g)', valor: el.momentos?.y ?? 0, unidade: 'kN·m', largura: '150px', aoMudar: (v) => ctx.alterar((e) => { (e.momentos ??= {}).y = v; }) }),
          ),
        ],
      }));
    },

    renderResultado(raiz, res, ctx) {
      const el = ctx.elemento;
      raiz.append(h('div', { class: 'instrumentos' },
        ui.numeroGrande({ rotulo: 'Normal de cálculo', valor: num(res.Nd, 1), unidade: 'kN', linhas: [`Nk = ${num(res.Nk.g + res.Nk.q, 1)} kN`, `Nc,Rd = ${num(res.NRd, 1)} kN`] }),
        ui.arco({ rotulo: 'Aproveitamento', valor: `${num(res.interacao * 100, 0)}%`, fracao: res.interacao, legenda: 'interação mais crítica' }),
        ui.mostrador({ rotulo: 'Esbeltez x', valor: num(res.lambdaX, 1), numero: res.lambdaX, maximo: 140, sigla: 'λx' }),
        ui.mostrador({ rotulo: el.montante ? 'Esbeltez y (travado)' : 'Esbeltez y', valor: num(res.lambdaY, 1), numero: res.lambdaY, maximo: 140, sigla: 'λy' }),
      ));
      raiz.append(ui.secao({
        numero: '05', titulo: 'Estabilidade',
        filhos: [ui.tabela({
          colunas: [{ titulo: 'Grandeza' }, { titulo: 'Eixo x', alinhar: 'dir' }, { titulo: 'Eixo y', alinhar: 'dir' }],
          linhas: [
            ['Esbeltez λ', num(res.lambdaX, 1), num(res.lambdaY, 1)],
            ['Esbeltez relativa λrel', num(res.relX, 3), num(res.relY, 3)],
            ['Fator de estabilidade kc', num(res.kcx, 3), num(res.kcy, 3)],
          ],
        })],
      }));
    },
  };
}
