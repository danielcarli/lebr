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
 * Módulos internos instalados com o LEBR.
 * Para adicionar um módulo interno, importe a fábrica e inclua-a na lista.
 * Módulos externos são carregados da pasta de módulos do usuário (ver docs/MODULOS.md).
 */
import moduloViga from './concreto-viga/index.js';
import moduloLajeMacica from './concreto-laje-macica/index.js';
import moduloPilar from './concreto-pilar/index.js';
import moduloLajeTrelicada from './concreto-laje-trelicada/index.js';
import moduloLajeNervurada from './concreto-laje-nervurada/index.js';
import moduloLajeAlveolar from './concreto-laje-alveolar/index.js';
import moduloVigaMadeira from './madeira-viga/index.js';
import moduloPilarMadeira from './madeira-pilar/index.js';
import moduloEntrepiso from './madeira-entrepiso/index.js';
import moduloSondagem from './geotecnia-sondagem/index.js';
import moduloSapata from './concreto-sapata/index.js';
import moduloEstaca from './geotecnia-estaca/index.js';
import moduloBloco from './concreto-bloco/index.js';
import moduloEscada from './concreto-escada/index.js';
import moduloReservatorio from './concreto-reservatorio/index.js';
import moduloSapataCorrida from './concreto-sapata-corrida/index.js';
import moduloRadier from './concreto-radier/index.js';

// A ordem define os atalhos Ctrl+Shift+1…9 de "novo elemento".
export const MODULOS_INTERNOS = [
  moduloViga, moduloLajeMacica, moduloPilar, moduloLajeTrelicada, moduloLajeNervurada, moduloLajeAlveolar,
  moduloVigaMadeira, moduloPilarMadeira, moduloEntrepiso, moduloSondagem, moduloSapata, moduloEstaca, moduloBloco, moduloEscada, moduloReservatorio,
  moduloSapataCorrida, moduloRadier,
];

/** Módulos previstos no roteiro do projeto (exibidos como "planejados"). */
export const MODULOS_PLANEJADOS = [
  { nome: 'Ligações de madeira', categoria: 'Madeira', icone: 'madeira', norma: 'NBR 7190-1:2022', descricao: 'Pregos, parafusos e cavilhas (modelos de Johansen).' },
  { nome: 'Madeira lamelada colada cruzada (CLT)', categoria: 'Madeira', icone: 'madeira', norma: 'NBR 7190-1 · 7190-7', descricao: 'Lajes e paredes de MLCC.' },
  { nome: 'Estruturas de aço', categoria: 'Aço', icone: 'aco', norma: 'NBR 8800', descricao: 'Perfis laminados e soldados.' },
];
