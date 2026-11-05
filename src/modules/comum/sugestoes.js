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
 * Sugestões para um elemento que não atende (0.32): a menor alteração de seção (ou de espessura) que faz todas as
 * verificações do próprio elemento passarem, procurada recalculando o elemento com cada candidato.
 *
 * As alterações são caminhos no elemento ("secao.h", "bx"…) e valores, para que a interface possa aplicá-las. A busca
 * mantém as cargas que chegam de outros elementos como estão; depois de aplicar, o elemento é recalculado de verdade
 * (o peso próprio maior e, na grelha, a rigidez nova entram aí).
 */
import { POSICOES_OTIMIZAVEIS } from './otimizacao.js';
import { bitolaFixa } from '../../engine/barras.js';

const ler = (o, caminho) => caminho.split('.').reduce((x, k) => x?.[k], o);
export function gravar(o, caminho, valor) {
  const ks = caminho.split('.');
  let x = o;
  for (const k of ks.slice(0, -1)) x = x[k] ??= {};
  x[ks.at(-1)] = valor;
}
const copia = (o) => JSON.parse(JSON.stringify(o));
const fx = (v) => String(Math.round(v * 10) / 10).replace('.', ',');

/** Candidatos por módulo: listas de alterações, da mais leve para a mais pesada, em cada "família". */
const BUSCAS = {
  'concreto.viga': (el) => {
    const b = el.secao?.b ?? 20, h = el.secao?.h ?? 40;
    const hs = []; for (let v = h + 5; v <= Math.min(Math.max(2 * h, h + 40), 150); v += 5) hs.push(v);
    const bs = []; for (let v = b + 5; v <= Math.min(b + 30, 80); v += 5) bs.push(v);
    const misto = []; for (const bb of bs.slice(0, 3)) for (const hh of hs) misto.push([bb, hh]);
    return [
      { nome: 'altura', itens: hs.map((v) => ({ alteracoes: [{ caminho: 'secao.h', valor: v }], rotulo: `h = ${fx(v)} cm`, area: b * v })) },
      { nome: 'largura', itens: bs.map((v) => ({ alteracoes: [{ caminho: 'secao.b', valor: v }], rotulo: `b = ${fx(v)} cm`, area: v * h })) },
      { nome: 'seção', itens: misto.sort((p, q) => p[0] * p[1] - q[0] * q[1]).map(([bb, hh]) => ({ alteracoes: [{ caminho: 'secao.b', valor: bb }, { caminho: 'secao.h', valor: hh }], rotulo: `${fx(bb)} × ${fx(hh)} cm`, area: bb * hh })) },
    ];
  },
  'concreto.pilar': (el) => {
    const bx = el.bx ?? 20, by = el.by ?? 20;
    const menor = bx <= by ? 'bx' : 'by', maior = menor === 'bx' ? 'by' : 'bx';
    const vMenor = Math.min(bx, by), vMaior = Math.max(bx, by);
    const um = []; for (let v = vMenor + 5; v <= vMenor + 40; v += 5) um.push(v);
    const outro = []; for (let v = vMaior + 5; v <= vMaior + 40; v += 5) outro.push(v);
    const ambos = []; for (let d = 5; d <= 40; d += 5) ambos.push(d);
    const rot = (x, y) => `${fx(x)} × ${fx(y)} cm`;
    const sec = (k, v) => (k === 'bx' ? [v, by] : [bx, v]);
    return [
      { nome: `dimensão menor (${menor})`, itens: um.map((v) => ({ alteracoes: [{ caminho: menor, valor: v }], rotulo: rot(...sec(menor, v)), area: v * vMaior })) },
      { nome: `dimensão maior (${maior})`, itens: outro.map((v) => ({ alteracoes: [{ caminho: maior, valor: v }], rotulo: rot(...sec(maior, v)), area: v * vMenor })) },
      { nome: 'as duas dimensões', itens: ambos.map((d) => ({ alteracoes: [{ caminho: 'bx', valor: bx + d }, { caminho: 'by', valor: by + d }], rotulo: rot(bx + d, by + d), area: (bx + d) * (by + d) })) },
    ];
  },
  'concreto.laje.macica': (el) => {
    const h = el.h ?? 10;
    const hs = []; for (let v = h + 1; v <= Math.min(h + 15, 35); v += 1) hs.push(v);
    return [{ nome: 'espessura', itens: hs.map((v) => ({ alteracoes: [{ caminho: 'h', valor: v }], rotulo: `h = ${fx(v)} cm`, area: v })) }];
  },
};

export const sugestoesDisponiveis = (modulo) => !!BUSCAS[modulo] || !!POSICOES_OTIMIZAVEIS[modulo];

/**
 * @param {object} el
 * @param {object} projeto
 * @param {(e:object) => object} calcular   calcula o elemento candidato
 * @returns {{opcoes: {rotulo, familia, alteracoes, verificacoes: number}[], avaliadas: number, semSugestao?: string}}
 */
export function sugerirCorrecao(el, projeto, calcular) {
  const opcoes = [];
  let avaliadas = 0;
  const testar = (alteracoes) => {
    const e = copia({ ...el, resultado: undefined });
    for (const a of alteracoes) gravar(e, a.caminho, a.valor);
    avaliadas++;
    let r;
    try { r = calcular(e); } catch { return null; }
    return r && !r.erro && r.ok ? r : null;
  };
  // bitolas escolhidas à mão que não servem: voltar para "Automática"
  const fixas = (POSICOES_OTIMIZAVEIS[el.modulo] ?? []).filter((p) => bitolaFixa(el.armadura?.[p.chave]) != null);
  if (fixas.length) {
    const alteracoes = fixas.map((p) => ({ caminho: `armadura.${p.chave}`, valor: 'auto' }));
    if (testar(alteracoes)) opcoes.push({ familia: 'bitolas', rotulo: `bitolas ${fixas.map((p) => p.rotulo).join(' e ')} em Automática`, alteracoes });
  }
  const buscas = BUSCAS[el.modulo]?.(el) ?? [];
  for (const f of buscas) {
    for (const it of f.itens) {
      if (testar(it.alteracoes)) { opcoes.push({ familia: f.nome, rotulo: it.rotulo, alteracoes: it.alteracoes, area: it.area }); break; }
    }
    // a seção combinada só interessa quando altura e largura sozinhas não resolvem
    if (f.nome === 'largura' && opcoes.some((o) => o.familia === 'altura')) break;
  }
  // as de menor área primeiro (a de bitolas, que não muda a seção, sempre à frente)
  opcoes.sort((a, b) => (a.familia === 'bitolas' ? -1 : b.familia === 'bitolas' ? 1 : (a.area ?? 0) - (b.area ?? 0)));
  const atuais = Object.fromEntries((buscas.flatMap((f) => f.itens[0]?.alteracoes ?? [])).map((a) => [a.caminho, ler(el, a.caminho)]));
  return {
    opcoes: opcoes.slice(0, 3),
    avaliadas,
    atuais,
    semSugestao: opcoes.length ? null : buscas.length
      ? 'Nenhuma seção dentro da faixa procurada faz o elemento atender — a falha não parece ser de seção (confira as cargas, os apoios, as bitolas e os materiais).'
      : 'Este tipo de elemento ainda não tem sugestões automáticas.',
  };
}
