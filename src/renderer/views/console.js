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
 * Console de comandos (aba do painel inferior) — executa JavaScript com a API de
 * core/script.js em escopo: viga(), laje(), pilar(), calcular(), conectar()…
 *
 * O console mantém o próprio DOM entre redesenhos do painel (que acontecem a cada
 * alteração do projeto), para não perder o texto digitado, o histórico e o foco.
 */
import { h, limpar } from '../ui/dom.js';
import { TEXTO_AJUDA } from '../core/script.js';

const CHAVE_HISTORICO = 'lebr.console.historico';
const MAX_HISTORICO = 200;

/**
 * Executa o código com a API visível como variáveis. Direto no escopo de `with`,
 * o eval devolve o valor da última expressão (como um console de navegador).
 * Atribuições sem var/let/const ficam guardadas entre comandos.
 */
// eslint-disable-next-line no-new-func
const executarNoEscopo = new Function('escopo', 'codigo', 'with (escopo) { return eval(codigo); }');

/** Texto legível de um valor de resultado. */
export function formatarValor(v, prof = 0) {
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  if (typeof v === 'string') return prof ? JSON.stringify(v) : v;
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(Math.round(v * 1e6) / 1e6);
  if (typeof v === 'boolean' || typeof v === 'bigint') return String(v);
  if (typeof v === 'function') return `ƒ ${v.name || 'função'}()`;
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  // objetos com texto próprio para o console (ex.: resultado do pórtico)
  if (typeof v === 'object' && typeof v[Symbol.for('lebr.console')] === 'function') return v[Symbol.for('lebr.console')]();
  if (prof > 3) return Array.isArray(v) ? '[…]' : '{…}';
  // resumo de elemento: uma linha
  if (v && typeof v === 'object' && 'codigo' in v && 'situacao' in v && 'tipo' in v) {
    const pos = v.posicao ? ` · ${v.pavimento} (${v.posicao.map((n) => formatarValor(n)).join('; ')})` : ' · sem posição';
    return `${v.codigo} · ${v.tipo}${v.nome && v.nome !== v.codigo ? ` “${v.nome}”` : ''} · ${v.dados}${pos} · ${v.situacao}${v.falhas?.length ? ` — falhas: ${v.falhas.join(', ')}` : ''}`;
  }
  const recuo = '  '.repeat(prof + 1), fim = '  '.repeat(prof);
  if (Array.isArray(v)) {
    if (!v.length) return '[]';
    const itens = v.slice(0, 200).map((x) => formatarValor(x, prof + 1));
    const curto = itens.join(', ');
    if (curto.length < 90 && !curto.includes('\n') && v.every((x) => typeof x !== 'object' || x === null)) return `[${curto}]`;
    if (prof === 0 && v.every((x) => x && typeof x === 'object' && 'situacao' in x)) return itens.join('\n');
    return `[\n${itens.map((x) => recuo + x).join(',\n')}${v.length > 200 ? `,\n${recuo}… mais ${v.length - 200}` : ''}\n${fim}]`;
  }
  const chaves = Object.keys(v);
  if (!chaves.length) return '{}';
  const pares = chaves.slice(0, 80).map((k) => `${/^[A-Za-z_$][\w$]*$/.test(k) ? k : JSON.stringify(k)}: ${formatarValor(v[k], prof + 1)}`);
  const curto = pares.join(', ');
  if (curto.length < 90 && !curto.includes('\n')) return `{ ${curto} }`;
  return `{\n${pares.map((x) => recuo + x).join(',\n')}${chaves.length > 80 ? `,\n${recuo}…` : ''}\n${fim}}`;
}

/**
 * @param {object} p
 * @param {(imprimir:Function, limpar:Function) => object} p.criarApi  fábrica da API de script
 */
export function criarConsole({ criarApi }) {
  const linhas = [];
  let historico = (() => { try { return JSON.parse(localStorage.getItem(CHAVE_HISTORICO)) ?? []; } catch { return []; } })();
  let posHist = historico.length;
  let rascunho = '';
  let ocupado = false;

  const saida = h('div', { class: 'console-saida', role: 'log', 'aria-live': 'polite' });
  const entrada = h('textarea', { class: 'console-entrada', rows: 1, spellcheck: false, autocapitalize: 'off', placeholder: 'Digite JavaScript — ajuda() mostra os comandos · Enter executa' });
  const raiz = h('div', { class: 'console', 'data-unidade-fixa': '' }, saida, h('div', { class: 'console-linha' }, h('span', { class: 'console-prompt' }, '›'), entrada));

  function imprimir(texto, tipo = 'resultado') {
    linhas.push({ texto: String(texto), tipo });
    if (linhas.length > 1000) linhas.splice(0, linhas.length - 1000);
    saida.append(h('pre', { class: ['console-msg', tipo] }, String(texto)));
    while (saida.childElementCount > 1000) saida.firstElementChild.remove();
    saida.scrollTop = saida.scrollHeight;
  }
  function limparConsole() { linhas.length = 0; limpar(saida); }

  // console.log dentro do código vai para o painel (e para o console do Electron)
  const consoleProprio = {
    log: (...a) => { imprimir(a.map((x) => formatarValor(x)).join(' '), 'log'); },
    info: (...a) => { imprimir(a.map((x) => formatarValor(x)).join(' '), 'log'); },
    warn: (...a) => { imprimir(a.map((x) => formatarValor(x)).join(' '), 'aviso'); },
    error: (...a) => { imprimir(a.map((x) => formatarValor(x)).join(' '), 'erro'); },
    table: (d) => { imprimir(formatarValor(d), 'log'); },
    clear: () => limparConsole(),
  };
  const api = criarApi(imprimir, limparConsole);
  // copia os descritores (sem ler os valores: `projeto` é um getter que exige projeto aberto)
  const escopo = Object.create(null);
  Object.defineProperties(escopo, Object.getOwnPropertyDescriptors(api));
  Object.assign(escopo, { console: consoleProprio, limpar: limparConsole });
  if (!escopo.ajuda) escopo.ajuda = () => imprimir(TEXTO_AJUDA, 'ajuda');

  async function executar(codigo) {
    const texto = codigo.trim();
    if (!texto || ocupado) return;
    if (historico[historico.length - 1] !== texto) historico.push(texto);
    if (historico.length > MAX_HISTORICO) historico = historico.slice(-MAX_HISTORICO);
    try { localStorage.setItem(CHAVE_HISTORICO, JSON.stringify(historico)); } catch { /* ignora */ }
    posHist = historico.length;
    rascunho = '';
    imprimir(texto, 'entrada');
    ocupado = true;
    try {
      let r = executarNoEscopo(escopo, texto);
      if (r && typeof r.then === 'function') r = await r;
      if (r !== undefined) imprimir(formatarValor(r), 'resultado');
    } catch (err) {
      imprimir(err instanceof Error ? `${err.name === 'Error' ? 'Erro' : err.name}: ${err.message}` : `Erro: ${formatarValor(err)}`, 'erro');
    } finally {
      ocupado = false;
      requestAnimationFrame(() => entrada.focus());
    }
  }

  function ajustarAltura() {
    entrada.style.height = 'auto';
    entrada.style.height = `${Math.min(160, entrada.scrollHeight)}px`;
  }
  entrada.addEventListener('input', ajustarAltura);
  entrada.addEventListener('keydown', (e) => {
    // atalhos globais simples (F5, Delete…) não valem dentro do console; os com Ctrl/Alt
    // (trocar de aba, salvar, paleta…) continuam funcionando
    if (!(e.ctrlKey || e.altKey || e.metaKey)) e.stopPropagation();
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const codigo = entrada.value;
      entrada.value = '';
      ajustarAltura();
      executar(codigo);
      return;
    }
    if (e.key === 'l' && e.ctrlKey) { e.preventDefault(); limparConsole(); return; }
    if (e.key === 'Tab') {
      e.preventDefault();
      const { selectionStart: a, selectionEnd: b } = entrada;
      entrada.setRangeText('  ', a, b, 'end');
      return;
    }
    const naPrimeira = !entrada.value.slice(0, entrada.selectionStart).includes('\n');
    const naUltima = !entrada.value.slice(entrada.selectionEnd).includes('\n');
    if (e.key === 'ArrowUp' && naPrimeira && historico.length) {
      e.preventDefault();
      if (posHist === historico.length) rascunho = entrada.value;
      posHist = Math.max(0, posHist - 1);
      entrada.value = historico[posHist];
      ajustarAltura();
    } else if (e.key === 'ArrowDown' && naUltima && posHist < historico.length) {
      e.preventDefault();
      posHist += 1;
      entrada.value = posHist === historico.length ? rascunho : historico[posHist];
      ajustarAltura();
    }
  });
  raiz.addEventListener('mouseup', () => { if (!window.getSelection()?.toString()) entrada.focus(); });

  imprimir('Console do LEBR — JavaScript com funções para criar a estrutura. Digite ajuda() para ver os comandos.', 'ajuda');

  return {
    /** Coloca o console no corpo do painel (o mesmo DOM a cada redesenho). */
    render(el) {
      const tinhaFoco = document.activeElement === entrada;
      el.classList.add('com-console');
      el.append(raiz);
      saida.scrollTop = saida.scrollHeight;
      if (tinhaFoco || ocupado) requestAnimationFrame(() => entrada.focus());
    },
    focar() { requestAnimationFrame(() => entrada.focus()); },
    executar,
    limpar: limparConsole,
  };
}
