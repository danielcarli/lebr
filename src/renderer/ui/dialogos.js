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
 * Diálogos modais e notificações.
 */
import { h } from './dom.js';
import { icone } from './icones.js';
import { botao } from './componentes.js';

/**
 * Diálogo genérico. Retorna uma Promise com o valor passado a `fechar(valor)`.
 * @param {object} p
 * @param {string} p.rotulo   texto pequeno terracota acima do título
 * @param {string} p.titulo
 * @param {(fechar:Function) => Node|Node[]} [p.corpo]
 * @param {{texto:string, tipo?:string, valor?:any, padrao?:boolean}[]} p.botoes
 */
export function dialogo({ rotulo, titulo, texto, corpo, botoes, largura }) {
  return new Promise((resolve) => {
    const anterior = document.activeElement;
    const fechar = (valor) => {
      fundo.remove();
      window.removeEventListener('keydown', teclas, true);
      anterior?.focus?.();
      resolve(valor);
    };
    const conteudo = corpo ? corpo(fechar) : null;
    const padrao = botoes.find((b) => b.padrao);
    const caixa = h('div', { class: 'dialogo', role: 'dialog', 'aria-modal': 'true', style: largura ? { width: largura } : null },
      h('div', { class: 'dialogo-cab' }, rotulo && h('span', { class: 'rot' }, rotulo), h('h2', null, titulo)),
      texto && h('p', null, texto),
      conteudo && h('div', { class: 'dialogo-corpo' }, conteudo),
      h('div', { class: 'dialogo-acoes' }, botoes.map((b) => botao({ texto: b.texto, tipo: b.tipo ?? 'secundario', aoClicar: () => fechar(typeof b.valor === 'function' ? b.valor() : b.valor) }))),
    );
    const fundo = h('div', { class: 'dialogo-fundo', onMousedown: (e) => { if (e.target === fundo) fechar(undefined); } }, caixa);
    const teclas = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); fechar(undefined); }
      if (e.key === 'Enter' && padrao && !e.target.matches('textarea, button')) {
        e.preventDefault(); e.stopPropagation();
        e.target.blur?.(); // dispara o change do campo antes de confirmar
        fechar(typeof padrao.valor === 'function' ? padrao.valor() : padrao.valor);
      }
    };
    window.addEventListener('keydown', teclas, true);
    document.body.append(fundo);
    (caixa.querySelector('input, select') ?? caixa.querySelector('.botao.primario'))?.focus();
  });
}

export function confirmar({ titulo, texto, rotulo = 'Confirmar', confirmarTexto = 'Confirmar', perigo = false }) {
  return dialogo({
    rotulo, titulo, texto,
    botoes: [
      { texto: 'Cancelar', tipo: 'fantasma', valor: false },
      { texto: confirmarTexto, tipo: perigo ? 'escuro' : 'primario', valor: true, padrao: true },
    ],
  });
}

/* ------------------------------------------------------------ notificações */

let pilha = null;

/**
 * @param {'info'|'ok'|'erro'} tipo
 * @param {{duracao?: number, acoes?: {texto: string, aoClicar: () => void}[]}} [op]
 */
export function notificar(textoMsg, tipo = 'info', { duracao = 4200, acoes = [] } = {}) {
  if (!pilha) { pilha = h('div', { class: 'notificacoes', 'aria-live': 'polite' }); document.body.append(pilha); }
  const ic = { info: 'info', ok: 'check', erro: 'alerta' }[tipo] ?? 'info';
  const el = h('div', { class: ['notificacao', tipo] },
    icone(ic, { tamanho: 16, traco: 1.8 }),
    h('div', null, textoMsg,
      acoes.length ? h('div', { class: 'notificacao-acoes' }, acoes.map((a) => h('button', { class: 'link', onClick: () => { el.remove(); a.aoClicar(); } }, a.texto))) : null),
    h('button', { class: 'botao-icone', title: 'Fechar', onClick: () => el.remove() }, icone('fechar', { tamanho: 14 })),
  );
  pilha.append(el);
  if (duracao) setTimeout(() => el.remove(), duracao);
  return el;
}
