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
 * API pública entregue às fábricas de módulos (internos e externos).
 * Tudo o que um módulo pode usar do LEBR passa por aqui.
 */
import { h, s, limpar } from '../ui/dom.js';
import { icone } from '../ui/icones.js';
import * as componentes from '../ui/componentes.js';
import { abrirMenu, menuContexto } from '../ui/menus.js';
import * as formatar from './formatar.js';

import * as materiais from '../../engine/materiais.js';
import * as flexao from '../../engine/flexao.js';
import * as cisalhamento from '../../engine/cisalhamento.js';
import * as barras from '../../engine/barras.js';
import * as vigaSolver from '../../engine/viga-solver.js';
import * as placa from '../../engine/placa.js';
import * as flexocompressao from '../../engine/flexocompressao.js';
import * as secaoT from '../../engine/secao-t.js';
import * as madeira from '../../engine/madeira.js';
import * as cargas from '../../engine/cargas.js';
import * as combinacoes from '../../engine/combinacoes.js';

export const VERSAO_API = 1;

export const api = Object.freeze({
  versao: VERSAO_API,
  dom: { h, s, limpar },
  ui: { ...componentes, icone },
  menus: { abrirMenu, menuContexto },
  formatar,
  motor: { materiais, flexao, cisalhamento, barras, vigaSolver, placa, flexocompressao, secaoT, madeira, cargas, combinacoes },
});
