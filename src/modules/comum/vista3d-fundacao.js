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
 * Vista 3D de uma fundação na seção Desenho (0.65): concreto transparente, armadura com as edições da lista de ferros
 * e, no bloco, as estacas. O mesmo modelo da ferragem em 3D (armadura3d-fundacoes.js).
 */
import { vistaArmadura3D } from '../../renderer/ui/armadura3d.js';
import { aplicarEdicoes } from '../../engine/detalhamento.js';

/**
 * @param {object} api       API do LEBR (dom)
 * @param {object} ctx       contexto da página (elemento)
 * @param {object} r         resultado do cálculo (com r.detalhamento)
 * @param {(posicoes:object[]) => object} construir  modelo 3D a partir das posições
 * @param {{altura?: number, titulo?: string}} [op]
 */
export function vista3dFundacao(api, ctx, r, construir, { altura = 420, titulo = 'VISTA 3D' } = {}) {
  const { h } = api.dom;
  try {
    const posicoes = aplicarEdicoes(r.detalhamento?.posicoes ?? [], ctx?.elemento?.detalhamento?.edicoes);
    const modelo = construir(posicoes);
    return h('div', { class: 'desenho-caixa desenho-3d' },
      h('div', { class: 'desenho-3d-tit' }, titulo),
      vistaArmadura3D(modelo, { altura }),
      modelo.legenda ? h('p', { class: 'combinacoes-nota a3d-legenda' }, modelo.legenda) : null);
  } catch (err) {
    return h('p', { class: 'combinacoes-nota' }, `Não foi possível montar a vista 3D: ${err.message}`);
  }
}
