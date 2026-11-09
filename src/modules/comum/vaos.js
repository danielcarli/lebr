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
 * Editor de vãos e apoios de vigas contínuas, compartilhado pelas vigas
 * de concreto e de madeira: [Apoio 1] [Vão 1] [Apoio 2] … + adicionar/remover vão.
 *
 * O elemento precisa ter `vaos: [{L}]`, `apoios: ['apoio'|'engaste'|'livre']` e `cargas`.
 * Com `secaoPorVao`, cada vão mostra também a largura b, a altura h e se é normal ou invertido (vigas de concreto
 * com seção própria em cada vão — `vaos: [{L, b, h, invertida}]`).
 */
export function editorVaos(api, ctx, mudar, { secaoPorVao = false } = {}) {
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
      const vao = el.vaos[k];
      sequencia.append(h('div', { class: ['vao-trecho', secaoPorVao && 'com-secao', secaoPorVao && vao.invertida && 'invertida'] },
        ui.campo({ rotulo: `Vão ${k + 1}`, valor: vao.L, unidade: 'm', min: 0.2, max: 30, largura: '112px', aoMudar: (v) => mudar((e) => { e.vaos[k].L = v; }) }),
        secaoPorVao ? h('div', { class: 'vao-secao' },
          ui.campo({ rotulo: 'b', valor: vao.b ?? el.secao?.b, unidade: 'cm', casas: 1, min: 10, max: 200, largura: '78px', aoMudar: (v) => mudar((e) => { e.vaos[k].b = v; }, { estrutural: true }) }),
          ui.campo({ rotulo: 'h', valor: vao.h ?? el.secao?.h, unidade: 'cm', casas: 1, min: 15, max: 300, largura: '78px', aoMudar: (v) => mudar((e) => { e.vaos[k].h = v; }, { estrutural: true }) })) : null,
        secaoPorVao ? ui.segmentado({
          valor: (vao.invertida ?? el.invertida) ? 'inv' : 'normal', compacto: true,
          opcoes: [
            { valor: 'normal', texto: 'Normal', dica: 'Topo da viga no piso; a laje se apoia em cima' },
            { valor: 'inv', texto: 'Invertida', dica: 'A viga sobe acima do piso; a laje se apoia na face inferior e fica pendurada (estribos de suspensão, 18.3.6)' },
          ],
          aoMudar: (v) => mudar((e) => { e.vaos[k].invertida = v === 'inv'; }, { estrutural: true }),
        }) : null));
    }
  });

  const acoes = h('div', { class: 'linha-acoes' },
    ui.botao({ texto: 'Adicionar vão', icone: 'mais', aoClicar: () => mudar((e) => {
      const ult = e.apoios.length - 1;
      if (e.apoios[ult] === 'livre') e.apoios[ult] = 'apoio';
      // o vão novo repete o último (comprimento e, na seção por vão, b, h e invertida)
      const { L, b, h, invertida } = e.vaos[e.vaos.length - 1];
      e.vaos.push(Object.fromEntries(Object.entries({ L, b, h, invertida }).filter(([, x]) => x !== undefined)));
      e.apoios.push('apoio');
    }, { estrutural: true }) }),
    n > 1 && ui.botao({ texto: 'Remover último vão', icone: 'lixeira', tipo: 'fantasma', aoClicar: () => mudar((e) => {
      e.vaos.pop(); e.apoios.pop();
      for (const c of e.cargas ?? []) if (c.vao !== 'todos' && Number(c.vao) >= e.vaos.length) c.vao = c.tipo === 'concentrada' ? e.vaos.length - 1 : 'todos';
    }, { estrutural: true }) }),
  );

  return { sequencia, acoes };
}
