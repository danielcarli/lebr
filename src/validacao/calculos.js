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
 * Funções de cálculo de cada módulo interno, sem a interface. Usado pelo
 * banco de validação, que roda também fora do app (Node).
 */
import * as viga from '../modules/concreto-viga/calculo.js';
import * as macica from '../modules/concreto-laje-macica/calculo.js';
import * as pilar from '../modules/concreto-pilar/calculo.js';
import * as trelicada from '../modules/concreto-laje-trelicada/calculo.js';
import * as nervurada from '../modules/concreto-laje-nervurada/calculo.js';
import * as alveolar from '../modules/concreto-laje-alveolar/calculo.js';
import * as vigaMadeira from '../modules/madeira-viga/calculo.js';
import * as pilarMadeira from '../modules/madeira-pilar/calculo.js';
import * as entrepiso from '../modules/madeira-entrepiso/calculo.js';
import * as sondagem from '../modules/geotecnia-sondagem/calculo.js';
import * as sapata from '../modules/concreto-sapata/calculo.js';
import * as estaca from '../modules/geotecnia-estaca/calculo.js';
import * as bloco from '../modules/concreto-bloco/calculo.js';
import * as escada from '../modules/concreto-escada/calculo.js';
import * as reservatorio from '../modules/concreto-reservatorio/calculo.js';
import * as sapataCorrida from '../modules/concreto-sapata-corrida/calculo.js';
import * as radier from '../modules/concreto-radier/calculo.js';

const mod = (criar, calcular, m, categoria) => ({ criar, calcular, cargasTransmitidas: m.cargasTransmitidas, ligacoes: m.ligacoes, categoria });

export const MODULOS_CALCULO = {
  'concreto.viga': mod(viga.criarViga, viga.calcularViga, viga, 'vigas'),
  'concreto.laje.macica': mod(macica.criarLaje, macica.calcularLaje, macica, 'lajes'),
  'concreto.pilar': mod(pilar.criarPilar, pilar.calcularPilar, pilar, 'pilares'),
  'concreto.laje.trelicada': mod(trelicada.criarLajeTrelicada, trelicada.calcularLajeTrelicada, trelicada, 'lajes'),
  'concreto.laje.nervurada': mod(nervurada.criarLajeNervurada, nervurada.calcularLajeNervurada, nervurada, 'lajes'),
  'concreto.laje.alveolar': mod(alveolar.criarLajeAlveolar, alveolar.calcularLajeAlveolar, alveolar, 'lajes'),
  'madeira.viga': mod(vigaMadeira.criarVigaMadeira, vigaMadeira.calcularVigaMadeira, vigaMadeira, 'vigas'),
  'madeira.pilar': mod(pilarMadeira.criarPilarMadeira, pilarMadeira.calcularPilarMadeira, pilarMadeira, 'pilares'),
  'madeira.entrepiso': mod(entrepiso.criarEntrepiso, entrepiso.calcularEntrepiso, entrepiso, 'lajes'),
  'geotecnia.sondagem': mod(sondagem.criarSondagem, sondagem.calcularSondagem, sondagem, 'sondagens'),
  'concreto.sapata': mod(sapata.criarSapata, sapata.calcularSapata, sapata, 'fundacoes'),
  'geotecnia.estaca': mod(estaca.criarEstaca, estaca.calcularEstaca, estaca, 'fundacoes'),
  'concreto.bloco': mod(bloco.criarBloco, bloco.calcularBloco, bloco, 'fundacoes'),
  'concreto.escada': mod(escada.criarEscada, escada.calcularEscada, escada, 'escadas'),
  'concreto.reservatorio': mod(reservatorio.criarReservatorio, reservatorio.calcularReservatorio, reservatorio, 'reservatorios'),
  'concreto.sapataCorrida': mod(sapataCorrida.criarSapataCorrida, sapataCorrida.calcularSapataCorrida, sapataCorrida, 'fundacoes'),
  'concreto.radier': mod(radier.criarRadier, radier.calcularRadier, radier, 'fundacoes'),
};
