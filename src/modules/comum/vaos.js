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
 * Editor de vãos e apoios de vigas contínuas, compartilhado pelas vigas
 * de concreto e de madeira: [Apoio 1] [Vão 1] [Apoio 2] … + adicionar/remover vão.
 *
 * O elemento precisa ter `vaos: [{L}]`, `apoios: ['apoio'|'engaste'|'livre']` e `cargas`.
 */
export function editorVaos(api, ctx, mudar) {
  const { h } = api.dom;
  const ui = api.ui;
  const el = ctx.elemento;
  const n = el.vaos.length;

  const sequencia = h('div', { class: 'vaos' });
  el.apoios.forEach((tipo, k) => {
    const extremo = k === 0 || k === n;
    sequencia.append(h('div', { class: 'vao-apoio' },
      h('span', { class: 'vao-rot' }, `Apoio ${k + 1}`),
      ui.segmentado({
        valor: tipo, compacto: true,
        opcoes: [
          { valor: 'apoio', texto: 'Apoio', dica: 'Apoio simples (rotação livre)' },
          { valor: 'engaste', texto: 'Engaste', dica: 'Engaste perfeito' },
          ...(extremo ? [{ valor: 'livre', texto: 'Livre', dica: 'Extremidade em balanço' }] : []),
        ],
        aoMudar: (v) => mudar((e) => { e.apoios[k] = v; }, { estrutural: true }),
      })));
    if (k < n) {
      sequencia.append(h('div', { class: 'vao-trecho' },
        ui.campo({ rotulo: `Vão ${k + 1}`, valor: el.vaos[k].L, unidade: 'm', min: 0.2, max: 30, largura: '112px', aoMudar: (v) => mudar((e) => { e.vaos[k].L = v; }) })));
    }
  });

  const acoes = h('div', { class: 'linha-acoes' },
    ui.botao({ texto: 'Adicionar vão', icone: 'mais', aoClicar: () => mudar((e) => {
      const ult = e.apoios.length - 1;
      if (e.apoios[ult] === 'livre') e.apoios[ult] = 'apoio';
      e.vaos.push({ L: e.vaos[e.vaos.length - 1].L });
      e.apoios.push('apoio');
    }, { estrutural: true }) }),
    n > 1 && ui.botao({ texto: 'Remover último vão', icone: 'lixeira', tipo: 'fantasma', aoClicar: () => mudar((e) => {
      e.vaos.pop(); e.apoios.pop();
      for (const c of e.cargas ?? []) if (c.vao !== 'todos' && Number(c.vao) >= e.vaos.length) c.vao = c.tipo === 'concentrada' ? e.vaos.length - 1 : 'todos';
    }, { estrutural: true }) }),
  );

  return { sequencia, acoes };
}
