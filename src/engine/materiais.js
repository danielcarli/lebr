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
 * Propriedades dos materiais — ABNT NBR 6118:2023
 *
 * Convenções de unidades deste arquivo:
 *   tensões e módulos em MPa; deformações em ‰ (por mil) quando indicado.
 *
 * Cada função é pura: recebe parâmetros e devolve um objeto com tudo o que
 * os módulos de cálculo precisam, já com os coeficientes de minoração.
 */

import { coeficientesAcoes, casosPadrao, gerarCombinacoes, casosGlobais } from './combinacoes.js';

/** Coeficiente αE em função do agregado graúdo (NBR 6118, 8.2.8). */
export const ALFA_E = { basalto: 1.2, diabasio: 1.2, granito: 1.0, gnaisse: 1.0, calcario: 0.9, arenito: 0.7 };

/**
 * Concreto (NBR 6118, 8.2 e 17.2.2).
 * @param {number} fck resistência característica à compressão (MPa)
 * @param {object} [op]
 * @param {number} [op.gc=1.4] coeficiente de ponderação γc
 * @param {string} [op.agregado='granito']
 */
export function concreto(fck, { gc = 1.4, agregado = 'granito' } = {}) {
  if (!(fck >= 20 && fck <= 90)) throw new Error(`fck = ${fck} MPa fora do intervalo da norma (C20 a C90).`);
  const grupoI = fck <= 50;

  const fcd = fck / gc;
  // Resistência à tração (8.2.5)
  const fctm = grupoI ? 0.3 * Math.cbrt(fck * fck) : 2.12 * Math.log(1 + 0.11 * fck);
  const fctkInf = 0.7 * fctm;
  const fctkSup = 1.3 * fctm;
  const fctd = fctkInf / gc;

  // Módulo de elasticidade (8.2.8)
  const alfaE = ALFA_E[agregado] ?? 1.0;
  const Eci = grupoI ? alfaE * 5600 * Math.sqrt(fck) : 21500 * alfaE * Math.cbrt(fck / 10 + 1.25);
  const alfaI = Math.min(1, 0.8 + 0.2 * fck / 80);
  const Ecs = alfaI * Eci;

  // Diagrama retangular simplificado (17.2.2) — NBR 6118:2023
  // ηc: coeficiente de fragilidade, introduzido na revisão de 2023.
  const etaC = Math.min(1, Math.cbrt(40 / fck));
  const lambda = grupoI ? 0.8 : 0.8 - (fck - 50) / 400;
  const alfaC = grupoI ? 0.85 : 0.85 * (1 - (fck - 50) / 200);
  const sigmaCd = alfaC * etaC * fcd; // tensão do bloco retangular (MPa)

  // Deformações (8.2.10.1), em ‰
  const ecu = grupoI ? 3.5 : 2.6 + 35 * ((90 - fck) / 100) ** 4;
  const ec2 = grupoI ? 2.0 : 2.0 + 0.085 * (fck - 50) ** 0.53;

  // Limite de ductilidade x/d (14.6.4.3)
  const xiLim = grupoI ? 0.45 : 0.35;

  return { fck, gc, fcd, fctm, fctkInf, fctkSup, fctd, Eci, Ecs, alfaE, alfaI, etaC, lambda, alfaC, sigmaCd, ecu, ec2, xiLim, nu: 0.2 };
}

/**
 * Aço para armadura passiva (NBR 6118, 8.3).
 * @param {number} fyk MPa (CA-25 = 250, CA-50 = 500, CA-60 = 600)
 */
export function aco(fyk = 500, { gs = 1.15, Es = 210000 } = {}) {
  const fyd = fyk / gs;
  return { fyk, gs, fyd, Es, eyd: (fyd / Es) * 1000 /* ‰ */ };
}

/** Cobrimentos nominais (mm) por classe de agressividade — Tabela 7.2 (Δc = 10 mm). */
export const COBRIMENTO_MM = {
  laje:  { I: 20, II: 25, III: 35, IV: 45 },
  viga:  { I: 25, II: 30, III: 40, IV: 50 },
  pilar: { I: 25, II: 30, III: 40, IV: 50 },
  // elementos estruturais em contato com o solo (sapatas, blocos, vigas baldrame) — Tabela 7.2
  solo: { I: 30, II: 30, III: 40, IV: 50 },
};

/** fck mínimo por classe de agressividade — Tabela 7.1. */
export const FCK_MIN = { I: 20, II: 25, III: 30, IV: 40 };

/** Fatores de redução ψ2 (quase permanente) — Tabela 11.2. */
export const PSI2 = { residencial: 0.3, comercial: 0.4, garagem: 0.6 };

/** Peso específico do concreto armado (kN/m³). */
export const GAMA_CONCRETO = 25;

/**
 * Monta, a partir dos parâmetros do projeto, o "contexto de materiais"
 * que todos os módulos de concreto recebem.
 */
export function contextoConcreto(parametros = {}) {
  const c = parametros.concreto ?? {};
  const a = parametros.aco ?? {};
  const k = parametros.coeficientes ?? {};
  const acoes = coeficientesAcoes(parametros);
  return {
    concreto: concreto(c.fck ?? 25, { gc: k.gc ?? 1.4, agregado: c.agregado ?? 'granito' }),
    aco: aco(a.fyk ?? 500, { gs: k.gs ?? 1.15, Es: a.Es ?? 210000 }),
    gg: acoes.gg,
    gq: acoes.gq,
    ggFav: acoes.ggFav,
    psi0: acoes.psi0,
    psi1: acoes.psi1,
    psi2: acoes.psi2,
    // casos G e Q e as combinações ELU/ELS (NBR 6118, 11.7 e 11.8)
    casos: casosPadrao(acoes),
    combinacoes: gerarCombinacoes(casosPadrao(acoes), acoes),
    // casos do edifício (G, Q e vento, quando ativo) para o pórtico espacial e os pilares
    casosGlobais: casosGlobais(parametros),
    combinacoesGlobais: gerarCombinacoes(casosGlobais(parametros), acoes),
    gama: c.pesoEspecifico ?? GAMA_CONCRETO,
    caa: parametros.classeAgressividade ?? 'II',
    dmax: parametros.agregadoDmax ?? 19, // mm (brita 1)
  };
}
