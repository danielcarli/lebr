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
 * Unidade de exibição das dimensões (Parâmetros do projeto › Unidades): cm ou mm.
 *
 * O cálculo e o arquivo do projeto continuam em centímetros — a escolha muda só o que aparece na tela,
 * no memorial e no PDF:
 *   - campos com unidade "cm" passam a mostrar e receber milímetros (ui.campo);
 *   - colunas de tabela com "(cm)" no título têm os números convertidos (ui.tabela);
 *   - textos com "número cm" (memorial, verificações, desenhos, avisos) viram "número mm", e o espaçamento
 *     das barras "c/ 15" vira "c/ 150", por um observador do documento.
 * Áreas (cm², cm²/m), vãos (m), flechas e aberturas de fissura (mm) não mudam.
 * Elementos marcados com data-unidade-fixa (console, relatório de validação) ficam como estão.
 */

export const UNIDADES_COMPRIMENTO = ['cm', 'mm'];

let unidade = 'cm';
const ouvintes = new Set();

/** Unidade em uso: 'cm' ou 'mm'. */
export const unidadeComprimento = () => unidade;
export const emMilimetros = () => unidade === 'mm';

/** Define a unidade (chamado pelo app ao abrir ou alterar o projeto). Devolve true se mudou. */
export function definirUnidadeComprimento(u) {
  const nova = u === 'mm' ? 'mm' : 'cm';
  if (nova === unidade) return false;
  unidade = nova;
  for (const f of ouvintes) f(unidade);
  return true;
}
export function aoMudarUnidade(f) { ouvintes.add(f); return () => ouvintes.delete(f); }

/* ------------------------------------------------------------------ números em texto */

/** "12,5" → 12.5 ; "−3" → -3. */
const lerBr = (s) => Number(String(s).replace('−', '-').replace(/\./g, '').replace(',', '.'));

/** Converte um número escrito em cm para mm, com uma casa decimal a menos. */
export function cmParaMmTexto(s) {
  const neg = /^[−-]/.test(s);
  const corpo = s.replace(/^[−-]/, '');
  const dec = (corpo.split(',')[1] ?? '').length;
  const v = lerBr(corpo) * 10;
  const casas = Math.max(0, dec - 1);
  let t = v.toFixed(casas).replace('.', ',');
  if (casas > 0) t = t.replace(/,?0+$/, '');
  return (neg ? '−' : '') + t;
}

const NUM = '[−-]?\\d+(?:,\\d+)?';
// "20 × 40 cm" (as duas dimensões), "h = 18 cm", "15cm"; não pega cm², cm³ nem palavras que começam com cm
const RE_PAR = new RegExp(`(${NUM})(\\s?[×x]\\s?)(${NUM})(\\s?)cm(?![²³\\p{L}\\d])`, 'gu');
const RE_CM = new RegExp(`(${NUM})(\\s?)cm(?![²³\\p{L}\\d])`, 'gu');
// espaçamento de barras sem unidade: "ø 8 c/ 15" (não mexe se já vier com cm ou mm)
const RE_ESP = new RegExp(`(c/\\s?)(\\d+(?:,\\d+)?)(?![\\d,])(?!\\s?[cm]m)`, 'gu');

/** Texto com dimensões em cm reescrito em mm. */
export function converterTexto(texto) {
  if (unidade !== 'mm' || !texto || (!texto.includes('cm') && !texto.includes('c/'))) return texto;
  return texto
    .replace(RE_PAR, (_, a, x, b, sp) => `${cmParaMmTexto(a)}${x}${cmParaMmTexto(b)}${sp}mm`)
    .replace(RE_CM, (_, a, sp) => `${cmParaMmTexto(a)}${sp}mm`)
    .replace(RE_ESP, (_, c, a) => `${c}${cmParaMmTexto(a)}`);
}

/** Número de célula de tabela ("6,50") convertido de cm para mm; outros conteúdos ficam iguais. */
export function converterCelula(v) {
  if (unidade !== 'mm') return v;
  if (typeof v === 'number') return v * 10;
  if (typeof v === 'string' && new RegExp(`^${NUM}$`).test(v.trim())) return cmParaMmTexto(v.trim());
  return v;
}

/* ------------------------------------------------------------------ observador do documento */

const fixo = (n) => n.parentElement?.closest?.('[data-unidade-fixa], textarea, input, script, style');

// texto que este observador já escreveu em cada nó (a conversão não pode rodar duas vezes: "c/ 15" → "c/ 150")
const convertidos = new WeakMap();
function converterNo(n) {
  if (n.nodeType !== 3 || convertidos.get(n) === n.nodeValue || fixo(n)) return;
  const t = n.nodeValue;
  const c = converterTexto(t);
  if (c !== t) { convertidos.set(n, c); n.nodeValue = c; }
}

function percorrer(raiz) {
  if (raiz.nodeType === 3) return converterNo(raiz);
  if (raiz.nodeType !== 1 && raiz.nodeType !== 11) return;
  if (raiz.closest?.('[data-unidade-fixa]')) return;
  const it = document.createTreeWalker(raiz, NodeFilter.SHOW_TEXT);
  const nos = [];
  for (let n = it.nextNode(); n; n = it.nextNode()) nos.push(n);
  nos.forEach(converterNo);
}

let observador = null;
/** Liga o observador em `raiz` (o documento): converte tudo que for desenhado enquanto a unidade for mm. */
export function observarUnidades(raiz = document.body) {
  if (observador) return;
  observador = new MutationObserver((lista) => {
    if (unidade !== 'mm') return;
    for (const m of lista) {
      if (m.type === 'characterData') converterNo(m.target);
      else for (const n of m.addedNodes) percorrer(n);
    }
  });
  observador.observe(raiz, { childList: true, subtree: true, characterData: true });
  if (unidade === 'mm') percorrer(raiz);
}
