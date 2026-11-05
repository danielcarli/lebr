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
 * Seção "Combinações de ações" dos resultados (vigas e pilares): as combinações usadas,
 * onde cada uma governa e, opcionalmente, os esforços característicos por caso.
 */
const TIPO = { ELU: 'Última normal', QP: 'Quase permanente', FREQ: 'Frequente', RARA: 'Rara' };

/**
 * @param {object} api
 * @param {{combinacoes:{id:string,tipo:string,nome:string,expressao:string}[]}} res
 * @param {object} op
 * @param {[string, string][]} op.governa  pares [id da combinação, grandeza]
 * @param {{colunas:(string|null)[], linhas:{id:string,nome:string,valores:(number|null)[]}[]}} [op.casos]
 * @param {string} [op.usoEls]  qual combinação de serviço o elemento usa
 */
export function secaoCombinacoes(api, res, { governa = [], casos = null, usoEls = 'Flechas: quase permanente (QP).' } = {}) {
  const { h } = api.dom;
  const ui = api.ui;
  const { num } = api.formatar;
  const onde = (id) => governa.filter(([c]) => c === id).map(([, g]) => g);
  const filhos = [
    ui.tabela({
      classe: 'combinacoes-tabela',
      colunas: [{ titulo: 'Combinação' }, { titulo: 'Tipo' }, { titulo: 'Expressão' }, { titulo: 'Governa' }],
      linhas: res.combinacoes.map((c) => {
        const g = onde(c.id);
        return { classe: g.length ? 'governa' : '', celulas: [h('b', null, c.id), TIPO[c.tipo] ?? c.tipo, h('span', { class: 'mono' }, c.expressao), g.join(' · ') || (c.tipo === 'ELU' ? '—' : '')] };
      }),
    }),
    h('p', { class: 'combinacoes-nota' }, `G = ações permanentes (peso próprio e demais), Q = variável de uso. Os esforços de cálculo são a envoltória das combinações últimas. ${usoEls}`),
  ];
  if (casos) {
    const idx = casos.colunas.map((c, i) => (c ? i : null)).filter((i) => i != null);
    filhos.push(h('h3', { class: 'combinacoes-sub' }, 'Esforços característicos por caso'), ui.tabela({
      classe: 'combinacoes-casos',
      colunas: [{ titulo: 'Caso' }, ...idx.map((i) => ({ titulo: casos.colunas[i], alinhar: 'dir' }))],
      linhas: casos.linhas.map((l) => [h('span', null, h('b', null, l.id), ` ${l.nome}`), ...idx.map((i) => num(l.valores[i]))]),
    }));
  }
  return ui.secao({ numero: '07', titulo: 'Combinações de ações', descricao: 'NBR 8681 · NBR 6118, 11.7 e 11.8', filhos });
}
