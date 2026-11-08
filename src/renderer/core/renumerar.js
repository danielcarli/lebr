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
 * Renumeração (roteiro, etapa L11): pilares, vigas e lajes numerados de cima para baixo e da esquerda para a direita
 * na planta — as vigas horizontais primeiro, depois as verticais, da esquerda para a direita —, como nos programas
 * consolidados. As ligações apontam para os ids dos elementos, então continuam certas; os textos que repetem o código
 * (nome igual ao código, descrição das cargas de ligação, "Baldrame sob V101") são atualizados junto.
 *
 * Esquemas: 'pavimento' — P101, P102… no pavimento de índice 1 (o mais baixo é o 0: P001…), como nos exemplos;
 *           'sequencial' — P1, P2… no projeto inteiro, do pavimento mais baixo para o mais alto.
 */
import { tipoDe, eixoViga, cantosLaje, centroPilar, pavimentosOrdenados } from './montagem.js';

const TIPOS = ['pilar', 'viga', 'laje'];
const prefixoDe = (codigo) => String(codigo ?? '').replace(/\d+$/, '') || '?';
const FAIXA = 0.5; // m — elementos com y a menos disso estão na mesma "linha" da planta

function referencia(el, t) {
  if (t === 'pilar') return { p: centroPilar(el), grupo: 0 };
  if (t === 'laje') { const c = cantosLaje(el); return { p: [c.reduce((s, q) => s + q[0], 0) / 4, c.reduce((s, q) => s + q[1], 0) / 4], grupo: 0 }; }
  const { a, b, u } = eixoViga(el);
  const meio = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  // horizontais (até 45°) antes das verticais
  const horizontal = Math.abs(u[0]) >= Math.abs(u[1]);
  return { p: horizontal ? [Math.min(a[0], b[0]), meio[1]] : [meio[0], Math.max(a[1], b[1])], grupo: horizontal ? 0 : 1 };
}

/** Ordem de leitura da planta: horizontais por linha (de cima para baixo, da esquerda para a direita); verticais por coluna. */
function ordenar(lista, t) {
  const comRef = lista.map((el) => ({ el, ...referencia(el, t) }));
  return comRef.sort((A, B) => {
    if (A.grupo !== B.grupo) return A.grupo - B.grupo;
    if (A.grupo === 1) return Math.abs(A.p[0] - B.p[0]) > FAIXA ? A.p[0] - B.p[0] : B.p[1] - A.p[1];
    return Math.abs(A.p[1] - B.p[1]) > FAIXA ? B.p[1] - A.p[1] : A.p[0] - B.p[0];
  }).map((x) => x.el);
}

/**
 * Plano de renumeração (sem alterar o projeto).
 * @param {{esquema?:'pavimento'|'sequencial', pavimentos?:string[]|null}} op  pavimentos: só esses (padrão: todos)
 * @returns {{elemento:object, de:string, para:string}[]}
 */
export function planoDeRenumeracao(projeto, registro, { esquema = 'pavimento', pavimentos = null } = {}) {
  const ord = pavimentosOrdenados(projeto);
  const alvoPav = (id) => !pavimentos || pavimentos.includes(id);
  const mudancas = [];
  const novos = new Map(); // novo código → elemento
  const contador = new Map(); // prefixo → próximo número (sequencial)
  ord.forEach((pv, i) => {
    const doPav = projeto.elementos.filter((e) => e.posicao?.pavimento === pv.id && TIPOS.includes(tipoDe(e, registro)));
    for (const t of TIPOS) {
      const grupos = new Map();
      for (const e of doPav.filter((x) => tipoDe(x, registro) === t)) {
        const pre = prefixoDe(e.codigo);
        if (!grupos.has(pre)) grupos.set(pre, []);
        grupos.get(pre).push(e);
      }
      for (const [pre, lista] of grupos) {
        const ordenados = ordenar(lista, t);
        ordenados.forEach((e, k) => {
          let para;
          if (esquema === 'sequencial') { const n = (contador.get(pre) ?? 0) + 1; contador.set(pre, n); para = `${pre}${n}`; }
          else para = `${pre}${i}${String(k + 1).padStart(ordenados.length > 99 ? 3 : 2, '0')}`;
          if (!alvoPav(pv.id)) return;
          novos.set(para, e);
          if (para !== e.codigo) mudancas.push({ elemento: e, de: e.codigo, para });
        });
      }
    }
  });
  // elementos fora da renumeração cujo código passaria a repetir: vão para o próximo número livre
  const usados = new Set([...projeto.elementos.filter((e) => !mudancas.some((m) => m.elemento === e) && !novos.has(e.codigo)).map((e) => e.codigo), ...novos.keys()]);
  for (const e of projeto.elementos) {
    if (mudancas.some((m) => m.elemento === e) || novos.get(e.codigo) === e) continue;
    if (!novos.has(e.codigo)) continue;
    const pre = prefixoDe(e.codigo);
    let n = 1;
    while (usados.has(`${pre}${n}`)) n++;
    usados.add(`${pre}${n}`);
    mudancas.push({ elemento: e, de: e.codigo, para: `${pre}${n}` });
  }
  return mudancas;
}

/**
 * Aplica a renumeração (altera o projeto no lugar): códigos, nomes iguais ao código, descrições das cargas de
 * ligação e textos que citam o código ("Baldrame sob V101").
 * @returns {{elemento:object, de:string, para:string}[]}
 */
export function renumerar(projeto, registro, op = {}) {
  const plano = planoDeRenumeracao(projeto, registro, op);
  if (!plano.length) return plano;
  const mapa = new Map(plano.map((m) => [m.de, m.para]));
  const porId = new Map(plano.map((m) => [m.elemento.id, m]));
  // troca de uma vez só, palavra inteira (V1 não vira parte de V10)
  const chaves = [...mapa.keys()].sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const re = new RegExp(`\\b(${chaves.join('|')})\\b`, 'g');
  const trocar = (txt) => (typeof txt === 'string' ? txt.replace(re, (c) => mapa.get(c) ?? c) : txt);
  for (const e of projeto.elementos) {
    const m = porId.get(e.id);
    if (m) e.codigo = m.para;
    if (typeof e.nome === 'string') e.nome = m && e.nome === m.de ? m.para : trocar(e.nome);
    for (const c of Array.isArray(e.cargas) ? e.cargas : []) if (c?.tipo === 'elemento' && typeof c.descricao === 'string') c.descricao = trocar(c.descricao);
  }
  return plano;
}
