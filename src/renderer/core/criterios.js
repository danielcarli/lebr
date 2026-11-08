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
 * Critérios por elemento (roteiro, etapa L7): exceção de fck e de cobrimento num elemento, sobre os parâmetros do
 * projeto. Gravados em `elemento.criterios = { fck?, cobrimento? }` (MPa e cm); vazio = vale o do projeto. Quando a
 * exceção fica abaixo do mínimo da classe de agressividade (NBR 6118, Tabelas 7.1 e 7.2), o elemento ganha um aviso.
 */
import { FCK_MIN, COBRIMENTO_MM } from '../../engine/materiais.js';

/** Módulos de concreto armado que aceitam os critérios, e a linha da Tabela 7.2 de cada um. */
const TIPO_COBRIMENTO = {
  'concreto.viga': 'viga', 'concreto.pilar': 'pilar',
  'concreto.laje.macica': 'laje', 'concreto.laje.trelicada': 'laje', 'concreto.laje.nervurada': 'laje',
  'concreto.escada': 'laje', 'concreto.reservatorio': 'laje',
  'concreto.sapata': 'solo', 'concreto.bloco': 'solo',
};
export const aceitaCriterios = (el) => !!TIPO_COBRIMENTO[el?.modulo];
export const tipoDeCobrimento = (el) => TIPO_COBRIMENTO[el?.modulo] ?? null;

/** Classes de concreto oferecidas na exceção. */
export const CLASSES_FCK = [20, 25, 30, 35, 40, 45, 50];

export function criteriosDoElemento(el) {
  const c = el?.criterios ?? {};
  return {
    fck: Number.isFinite(c.fck) && c.fck > 0 ? c.fck : null,
    cobrimento: Number.isFinite(c.cobrimento) && c.cobrimento > 0 ? c.cobrimento : null,
  };
}

/** Parâmetros do projeto com as exceções do elemento (o mesmo objeto, se não houver exceção). */
export function parametrosDoElemento(parametros, el) {
  if (!aceitaCriterios(el)) return parametros;
  const c = criteriosDoElemento(el);
  if (c.fck == null && c.cobrimento == null) return parametros;
  const p = { ...parametros };
  if (c.fck != null) p.concreto = { ...parametros.concreto, fck: c.fck };
  if (c.cobrimento != null) p.cobrimento = { viga: c.cobrimento, pilar: c.cobrimento, laje: c.cobrimento };
  return p;
}

/** fck e cobrimento que valem no elemento, com a origem ('elemento' ou 'projeto'). */
export function criteriosEfetivos(parametros, el) {
  const c = criteriosDoElemento(el);
  const tipo = tipoDeCobrimento(el);
  const cobProjeto = tipo === 'solo' ? null : parametros.cobrimento?.[tipo];
  return {
    fck: c.fck ?? parametros.concreto?.fck, fckOrigem: c.fck != null ? 'elemento' : 'projeto',
    cobrimento: c.cobrimento ?? cobProjeto, cobrimentoOrigem: c.cobrimento != null ? 'elemento' : 'projeto',
  };
}

/**
 * Avisos das exceções do elemento: fck abaixo do mínimo da Tabela 7.1 e cobrimento abaixo do nominal da Tabela 7.2
 * para a classe de agressividade do projeto.
 */
export function avisosDeCriterios(parametros, el) {
  if (!aceitaCriterios(el)) return [];
  const c = criteriosDoElemento(el);
  const caa = parametros.classeAgressividade ?? 'II';
  const out = [];
  if (c.fck != null && c.fck < FCK_MIN[caa]) out.push(`${el.codigo}: concreto C${c.fck} abaixo do mínimo C${FCK_MIN[caa]} da classe de agressividade ${caa} (NBR 6118, Tabela 7.1).`);
  const tipo = tipoDeCobrimento(el);
  const min = COBRIMENTO_MM[tipo]?.[caa];
  if (c.cobrimento != null && min && c.cobrimento * 10 < min - 1e-9) out.push(`${el.codigo}: cobrimento ${String(c.cobrimento).replace('.', ',')} cm abaixo do nominal ${String(min / 10).replace('.', ',')} cm para ${{ solo: 'elementos em contato com o solo', laje: 'lajes', viga: 'vigas', pilar: 'pilares' }[tipo]} na classe ${caa} (NBR 6118, Tabela 7.2).`);
  return out;
}
