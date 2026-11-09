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
 * Comandos e atalhos de teclado, no mesmo modelo do VS Code:
 * toda ação da interface (menus, paleta, atalhos, botões) é um comando com id.
 */
import { Emissor } from './eventos.js';

const EH_MAC = window.lebr?.plataforma === 'darwin';

class RegistroComandos extends Emissor {
  #comandos = new Map();

  /**
   * @param {object} c
   * @param {string} c.id            ex.: 'projeto.salvar'
   * @param {string} c.titulo        texto exibido em menus e na paleta
   * @param {string} [c.categoria]   prefixo na paleta (ex.: 'Arquivo')
   * @param {string} [c.tecla]       atalho, ex.: 'Ctrl+Shift+P' (Ctrl vira ⌘ no macOS)
   * @param {Function} c.executar
   * @param {(...args) => boolean} [c.habilitado]  recebe os mesmos argumentos de executar (ex.: o id do elemento)
   * @param {(...args) => void} [c.aoNegar]  chamado quando se tenta executar o comando desabilitado
   * @param {boolean} [c.ocultoNaPaleta]
   */
  registrar(c) {
    this.#comandos.set(c.id, { habilitado: () => true, ...c });
  }

  obter(id) { return this.#comandos.get(id); }
  lista() { return [...this.#comandos.values()]; }

  async executar(id, ...args) {
    const c = this.#comandos.get(id);
    if (!c) return console.warn(`Comando desconhecido: ${id}`);
    // desabilitado: o comando pode explicar o porquê (ex.: cálculo bloqueado por erros de montagem)
    if (!c.habilitado(...args)) { c.aoNegar?.(...args); return; }
    try {
      return await c.executar(...args);
    } catch (err) {
      console.error(err);
      this.emit('erro', { comando: c, erro: err });
    }
  }

  /** Texto do atalho adaptado à plataforma. */
  rotuloTecla(tecla) {
    if (!tecla) return '';
    if (!EH_MAC) return tecla;
    return tecla.replace(/Ctrl\+/g, '⌘').replace(/Shift\+/g, '⇧').replace(/Alt\+/g, '⌥');
  }

  /** Liga o tratamento global de atalhos. */
  ouvirTeclado(alvo = window) {
    alvo.addEventListener('keydown', (e) => {
      const tecla = normalizar(e);
      if (!tecla) return;
      const emCampo = e.target.closest?.('input, textarea, select, [contenteditable="true"]');
      for (const c of this.#comandos.values()) {
        if (!c.tecla || normalizarTexto(c.tecla) !== tecla) continue;
        // em campos de texto, deixa o navegador tratar desfazer/refazer/copiar
        if (emCampo && c.respeitaCampo) continue;
        // atalho de uma tecla só (ex.: I): nunca enquanto se digita, nem com um diálogo ou menu aberto
        if (/^[a-z0-9]$/i.test(c.tecla) && (emCampo || document.querySelector?.('.dialogo-fundo, .menu'))) continue;
        e.preventDefault();
        this.executar(c.id);
        return;
      }
    });
  }
}

function normalizar(e) {
  if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return null;
  const partes = [];
  // no macOS, ⌘ faz o papel de Ctrl; ⌘Tab é do sistema, então Ctrl+Tab usa o Control de verdade
  if (EH_MAC ? (e.metaKey || (e.ctrlKey && e.key === 'Tab')) : e.ctrlKey) partes.push('ctrl');
  if (e.shiftKey) partes.push('shift');
  if (e.altKey) partes.push('alt');
  let k = e.key.toLowerCase();
  if (e.code?.startsWith('Key')) k = e.code.slice(3).toLowerCase();
  if (e.code?.startsWith('Digit')) k = e.code.slice(5);
  if (k === '+') k = '=';
  partes.push(k);
  return partes.join('+');
}

const normalizarTexto = (t) => t.toLowerCase();

export const comandos = new RegistroComandos();
