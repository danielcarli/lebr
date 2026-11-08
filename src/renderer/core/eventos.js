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
/** Emissor de eventos mínimo usado pelo núcleo e pela interface. */
export class Emissor {
  #ouvintes = new Map();

  /** @returns {() => void} função para cancelar a inscrição */
  on(evento, fn) {
    if (!this.#ouvintes.has(evento)) this.#ouvintes.set(evento, new Set());
    this.#ouvintes.get(evento).add(fn);
    return () => this.#ouvintes.get(evento)?.delete(fn);
  }

  emit(evento, ...args) {
    for (const fn of this.#ouvintes.get(evento) ?? []) {
      try { fn(...args); } catch (err) { console.error(`[evento ${evento}]`, err); }
    }
  }
}
