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
/** Formatação numérica no padrão brasileiro. */

const cache = new Map();
function nf(casas) {
  if (!cache.has(casas)) cache.set(casas, new Intl.NumberFormat('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas }));
  return cache.get(casas);
}

/** num(3.14159, 2) → "3,14" */
export const num = (v, casas = 2) => (Number.isFinite(v) ? nf(casas).format(v) : '—');

/** Lê número digitado com vírgula ou ponto. Retorna NaN se inválido. */
export function lerNumero(texto) {
  if (typeof texto === 'number') return texto;
  const t = String(texto).trim().replace(/\s/g, '');
  if (!t) return NaN;
  const normal = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  return Number(normal);
}

/** Número com três dígitos à esquerda, como nos arquivos de catálogo: 7 → "007". */
/** Ordem natural de códigos em português: V2 antes de V10, sem diferenciar maiúsculas e acentos. */
export const compararCodigos = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'pt-BR', { numeric: true, sensitivity: 'base' });

/** Código de elemento válido: 1 a 12 caracteres — letras, algarismos, hífen, ponto ou barra. */
export const CODIGO_VALIDO = /^[\p{L}\p{N}][\p{L}\p{N}.\-/]{0,11}$/u;

export const tresDigitos = (n) => String(n).padStart(3, '0');

export const data = (iso) => (iso ? new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

export const dataHora = (iso) => (iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
