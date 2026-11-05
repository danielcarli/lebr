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
 * Paleta de comandos (Ctrl+Shift+P) e abertura rápida de elementos (Ctrl+P).
 * Digitar ">" no início alterna para comandos, como no VS Code.
 */
import { h, limpar } from './dom.js';
import { icone } from './icones.js';
import { comandos } from '../core/comandos.js';

/** Busca por subsequência; devolve índices casados ou null. */
function casar(consulta, textoAlvo) {
  if (!consulta) return [];
  const q = consulta.toLowerCase(), t = textoAlvo.toLowerCase();
  const idx = [];
  let j = 0;
  for (let i = 0; i < t.length && j < q.length; i++) if (t[i] === q[j]) { idx.push(i); j++; }
  return j === q.length ? idx : null;
}

function realcar(texto, idx) {
  if (!idx?.length) return texto;
  const set = new Set(idx);
  return [...texto].map((c, i) => (set.has(i) ? h('mark', null, c) : c));
}

/**
 * @param {object} op
 * @param {'comandos'|'elementos'} op.modo
 * @param {() => {titulo:string, detalhe?:string, icone?:string, tecla?:string, atual?:boolean, acao:Function}[]} op.fonteElementos
 * @param {string} [op.dica]  texto do campo de busca fora do modo de comandos
 */
export function abrirPaleta({ modo = 'comandos', fonteElementos, dica = 'Buscar elemento pelo código ou nome (digite > para comandos)' }) {
  document.querySelector('.paleta-fundo')?.remove();
  const anterior = document.activeElement;
  const input = h('input', { placeholder: '', spellcheck: false, value: modo === 'comandos' ? '>' : '' });
  const lista = h('div', { class: 'paleta-lista' });
  const caixa = h('div', { class: 'paleta' }, input, lista);
  const fundo = h('div', { class: 'paleta-fundo', onMousedown: (e) => { if (e.target === fundo) fechar(); } }, caixa);
  document.body.append(fundo);

  let itens = [], foco = 0;

  function fontes() {
    const v = input.value;
    if (v.startsWith('>')) {
      input.placeholder = 'Digite o nome de um comando';
      return {
        consulta: v.slice(1).trim(),
        itens: comandos.lista().filter((c) => !c.ocultoNaPaleta && c.habilitado()).map((c) => ({
          titulo: c.titulo, cat: c.categoria, tecla: c.tecla, icone: c.icone, acao: () => comandos.executar(c.id),
        })),
      };
    }
    input.placeholder = dica;
    return { consulta: v.trim(), itens: fonteElementos?.() ?? [] };
  }

  function atualizar() {
    const { consulta, itens: base } = fontes();
    itens = base
      .map((it) => {
        const rotulo = it.cat ? `${it.cat}: ${it.titulo}` : it.titulo;
        return { ...it, rotulo, idx: casar(consulta, rotulo) };
      })
      .filter((it) => it.idx !== null)
      .sort((a, b) => (consulta ? (a.idx[0] ?? 0) - (b.idx[0] ?? 0) : 0));
    // sem busca, começa no item marcado como atual (ex.: a aba ativa na lista de abas)
    foco = consulta ? 0 : Math.max(0, itens.findIndex((it) => it.atual));
    desenhar();
  }

  function desenhar() {
    limpar(lista);
    if (!itens.length) { lista.append(h('div', { class: 'paleta-nada' }, 'Nenhum resultado')); return; }
    itens.forEach((it, i) => {
      lista.append(h('div', {
        class: ['paleta-item', i === foco && 'foco'],
        onMousemove: () => { if (foco !== i) { foco = i; desenhar(); } },
        onMousedown: (e) => { e.preventDefault(); executar(i); },
      },
        icone(it.icone ?? (it.cat ? 'direita' : 'documento'), { tamanho: 15 }),
        h('span', null, realcar(it.rotulo, it.idx)),
        it.detalhe && h('span', { class: 'cat' }, it.detalhe),
        it.tecla && h('kbd', null, comandos.rotuloTecla(it.tecla))));
    });
    lista.children[foco]?.scrollIntoView({ block: 'nearest' });
  }

  function executar(i) {
    const it = itens[i];
    fechar(false);
    it?.acao();
  }

  function fechar(restaurar = true) {
    fundo.remove();
    if (restaurar) anterior?.focus?.();
  }

  input.addEventListener('input', atualizar);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); fechar(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); foco = Math.min(itens.length - 1, foco + 1); desenhar(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); foco = Math.max(0, foco - 1); desenhar(); }
    else if (e.key === 'Enter') { e.preventDefault(); executar(foco); }
    e.stopPropagation();
  });
  input.addEventListener('blur', () => setTimeout(() => { if (document.activeElement !== input) fechar(false); }, 0));
  atualizar();
  input.focus();
  input.setSelectionRange(input.value.length, input.value.length);
}
