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
 * Menus suspensos (barra de menus) e menus de contexto.
 *
 * Item de menu:
 *   { comando: 'projeto.salvar' }                      → título/atalho vêm do registro de comandos
 *   { rotulo, acao: fn, icone, tecla, perigo, desabilitado }
 *   '-'                                                → separador
 *   { cabecalho: 'Texto' }
 */
import { h } from './dom.js';
import { icone } from './icones.js';
import { comandos } from '../core/comandos.js';

let aberto = null;

export function fecharMenus() {
  if (!aberto) return;
  const { el, aoFechar, limpar } = aberto;
  aberto = null;
  limpar();
  el.remove();
  aoFechar?.();
}

function resolver(item) {
  if (!item) return null;
  if (item === '-' || item.cabecalho) return item;
  if (item.comando) {
    const c = comandos.obter(item.comando);
    if (!c) return null;
    return {
      rotulo: item.rotulo ?? c.titulo, tecla: c.tecla, icone: item.icone ?? c.icone, marcado: c.marcado?.(),
      desabilitado: !c.habilitado(), acao: () => comandos.executar(c.id, ...(item.args ?? [])), perigo: item.perigo,
    };
  }
  return { ...item, desabilitado: typeof item.desabilitado === 'function' ? item.desabilitado() : item.desabilitado };
}

/**
 * Abre um menu na posição indicada.
 * @returns {HTMLElement}
 */
export function abrirMenu(itens, { x, y, aoFechar, ancora } = {}) {
  fecharMenus();
  const resolvidos = itens.map(resolver).filter(Boolean);
  const botoes = [];
  const el = h('div', { class: 'menu', role: 'menu' },
    resolvidos.map((it) => {
      if (it === '-') return h('div', { class: 'menu-sep' });
      if (it.cabecalho) return h('div', { class: 'menu-cab' }, it.cabecalho);
      const b = h('button', {
        class: ['menu-item', it.perigo && 'perigo'], role: 'menuitem', disabled: !!it.desabilitado,
        onClick: () => { fecharMenus(); it.acao?.(); },
        onMouseenter: () => focar(botoes.indexOf(b)),
      },
        it.marcado ? icone('check', { tamanho: 15, traco: 2 }) : it.icone ? icone(it.icone, { tamanho: 15 }) : h('span', { style: { width: '15px' } }),
        h('span', null, it.rotulo),
        it.tecla && h('kbd', null, comandos.rotuloTecla(it.tecla)));
      botoes.push(b);
      return b;
    }),
  );
  document.body.append(el);

  // posição, mantendo dentro da janela
  const r = el.getBoundingClientRect();
  let px = x, py = y;
  if (ancora) { const a = ancora.getBoundingClientRect(); px = a.left; py = a.bottom + 2; }
  px = Math.min(px, window.innerWidth - r.width - 6);
  py = Math.min(py, window.innerHeight - r.height - 6);
  Object.assign(el.style, { left: `${Math.max(4, px)}px`, top: `${Math.max(4, py)}px` });

  let foco = -1;
  function focar(i) {
    botoes[foco]?.classList.remove('foco');
    foco = i;
    botoes[foco]?.classList.add('foco');
  }
  const teclas = (e) => {
    const ativos = botoes.map((b, i) => (!b.disabled ? i : -1)).filter((i) => i >= 0);
    if (e.key === 'Escape') { e.preventDefault(); fecharMenus(); }
    else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const pos = ativos.indexOf(foco);
      const prox = e.key === 'ArrowDown' ? ativos[(pos + 1) % ativos.length] : ativos[(pos - 1 + ativos.length) % ativos.length];
      focar(prox ?? ativos[0]);
    } else if (e.key === 'Enter' && foco >= 0) { e.preventDefault(); botoes[foco].click(); }
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') aberto?.navegar?.(e.key === 'ArrowRight' ? 1 : -1);
  };
  const fora = (e) => { if (!el.contains(e.target) && !e.target.closest?.('.menubar-item')) fecharMenus(); };
  const sair = () => fecharMenus();
  window.addEventListener('keydown', teclas, true);
  window.addEventListener('mousedown', fora, true);
  window.addEventListener('blur', sair);
  window.addEventListener('resize', sair);

  aberto = {
    el, aoFechar,
    limpar: () => {
      window.removeEventListener('keydown', teclas, true);
      window.removeEventListener('mousedown', fora, true);
      window.removeEventListener('blur', sair);
      window.removeEventListener('resize', sair);
    },
  };
  return el;
}

/** Menu de contexto no ponto do clique. */
export function menuContexto(e, itens) {
  e.preventDefault();
  e.stopPropagation();
  abrirMenu(itens, { x: e.clientX, y: e.clientY });
}

/**
 * Barra de menus no estilo do VS Code.
 * @param {{rotulo:string, itens:any[] | (() => any[])}[]} definicao
 */
export function criarBarraMenus(definicao) {
  const barra = h('nav', { class: 'menubar', role: 'menubar' });
  let indiceAberto = -1;
  const botoes = definicao.map((m, i) => {
    const b = h('button', {
      class: 'menubar-item', role: 'menuitem',
      onMousedown: (e) => { e.preventDefault(); indiceAberto === i ? fecharMenus() : abrir(i); },
      onMouseenter: () => { if (indiceAberto >= 0 && indiceAberto !== i) abrir(i); },
    }, m.rotulo);
    return b;
  });
  barra.append(...botoes);

  function abrir(i) {
    const m = definicao[i];
    const itens = typeof m.itens === 'function' ? m.itens() : m.itens;
    abrirMenu(itens, { ancora: botoes[i], aoFechar: () => { botoes[i].classList.remove('aberto'); if (indiceAberto === i) indiceAberto = -1; } });
    botoes.forEach((b) => b.classList.remove('aberto'));
    botoes[i].classList.add('aberto');
    indiceAberto = i;
    aberto.navegar = (d) => abrir((i + d + definicao.length) % definicao.length);
  }
  return barra;
}
