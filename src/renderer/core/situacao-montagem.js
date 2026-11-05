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
 * Situação de montagem dos elementos (a segunda bolinha do explorador), refeita só quando o modelo muda — um
 * cálculo não mexe nas posições nem nas ligações, então não invalida.
 */
import { estado } from './estado.js';
import { modulos } from './modulos.js';
import { estadoMontagem } from './montagem.js';

let cache = null;
estado.on('alterado', (info) => { if (!info?.calculo) cache = null; });
estado.on('projeto', () => { cache = null; });

/** Mapa id → { estado: 'sem-posicao' | 'ok' | 'erro', problemas } do projeto aberto. */
export function montagemDoProjeto() {
  if (!estado.projeto) return new Map();
  if (!cache || cache.projeto !== estado.projeto) cache = { projeto: estado.projeto, mapa: estadoMontagem(estado.projeto, modulos) };
  return cache.mapa;
}
