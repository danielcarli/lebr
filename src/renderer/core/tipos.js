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
 * Pavimento tipo (roteiro, etapa L9): um pavimento com `repeticoes: n` é um modelo físico só, que vale para n níveis
 * seguidos, separados pelo pé-direito do próprio pavimento. Os elementos são editados e calculados uma vez; para o
 * 3D, o pórtico espacial, os quantitativos e as cargas que descem pelos pilares, `expandirTipos` monta um projeto
 * derivado com os n níveis: as cópias têm id `${id}~k` (k = 2…n) e ficam no pavimento `${pavId}~k`; o nível 1 mantém
 * os ids originais, então o resultado de cada elemento do tipo é o do nível mais baixo (o que mais carrega).
 */
import { pavimentosOrdenados, tipoDe } from './montagem.js';

export const SEP = '~';
export const repeticoesDe = (pv) => Math.max(1, Math.floor(Number(pv?.repeticoes) || 1));
export const temTipos = (projeto) => (projeto?.pavimentos ?? []).some((p) => repeticoesDe(p) > 1);
/** Id do elemento original de uma cópia do tipo (`V101~3` → `V101`). */
export const idOriginal = (id) => String(id ?? '').split(SEP)[0];
/** Número do nível da cópia (1 no original). */
export const nivelDaCopia = (id) => Number(String(id ?? '').split(SEP)[1]) || 1;

/** Pé-direito do tipo: a diferença de cota para o topo do pavimento de baixo (o mesmo de montagem.peDireito). */
function peDireitoBruto(ord, i) {
  if (i <= 0) return ord[0]?.cota ?? 0;
  const ab = ord[i - 1];
  return ord[i].cota - cotaTopoNa(ord, i - 1, ab);
}
function cotaTopoNa(ord, i, pv = ord[i]) {
  const n = repeticoesDe(pv);
  if (n <= 1) return pv.cota;
  return pv.cota + (n - 1) * peDireitoBruto(ord, i);
}

/** Cota do último nível do pavimento (a do próprio pavimento se não for tipo). */
export function cotaTopo(projeto, pavId) {
  const ord = pavimentosOrdenados(projeto);
  const i = ord.findIndex((p) => p.id === pavId);
  return i < 0 ? null : cotaTopoNa(ord, i);
}

/** Quantos níveis o elemento representa (as repetições do pavimento dele). */
export function repeticoesDoElemento(projeto, el) {
  const pv = projeto?.pavimentos?.find((p) => p.id === el?.posicao?.pavimento);
  return repeticoesDe(pv);
}

/**
 * Projeto com os pavimentos tipo desdobrados em níveis (o mesmo objeto, se não houver tipo). As cópias trazem
 * as cargas de ligação apontando para as cópias do mesmo nível; os pilares de cada nível descarregam no nível de
 * baixo, e o que vinha de cima do tipo chega no último nível.
 */
export function expandirTipos(projeto) {
  if (!temTipos(projeto)) return projeto;

  const ord = pavimentosOrdenados(projeto);
  const pavs = [];
  const copias = new Map(); // pavId → n
  ord.forEach((pv, i) => {
    const n = repeticoesDe(pv);
    pavs.push(n > 1 ? { ...pv, nome: `${pv.nome} (1/${n})`, repeticoes: 1, tipoN: n } : pv);
    if (n <= 1) return;
    const pd = peDireitoBruto(ord, i);
    copias.set(pv.id, n);
    for (let k = 2; k <= n; k++) pavs.push({ ...pv, id: `${pv.id}${SEP}${k}`, nome: `${pv.nome} (${k}/${n})`, cota: Math.round((pv.cota + (k - 1) * pd) * 1e6) / 1e6, repeticoes: 1, origem: pv.id });
  });
  const doTipo = new Map(); // id → n do pavimento
  for (const e of projeto.elementos) if (e.posicao && copias.has(e.posicao.pavimento)) doTipo.set(e.id, copias.get(e.posicao.pavimento));
  const cotaDe = new Map(ord.map((p) => [p.id, p.cota]));
  const acimaDoTipo = (fonteId, pavTipo) => {
    const f = projeto.elementos.find((e) => e.id === fonteId);
    return f?.posicao && (cotaDe.get(f.posicao.pavimento) ?? -Infinity) > cotaDe.get(pavTipo);
  };
  const elementos = [];
  for (const e of projeto.elementos) {
    const n = doTipo.get(e.id);
    if (!n) { elementos.push(e); continue; }
    const pav = e.posicao.pavimento;
    for (let k = 1; k <= n; k++) {
      const sufixo = (id) => (k === 1 ? id : `${id}${SEP}${k}`);
      const cargas = [];
      for (const cg of Array.isArray(e.cargas) ? e.cargas : []) {
        if (cg?.tipo !== 'elemento') { cargas.push(cg); continue; }
        if (doTipo.has(cg.elementoId)) { cargas.push({ ...cg, elementoId: sufixo(cg.elementoId) }); continue; }
        // carga que vem de cima do tipo: chega no último nível; nos de baixo, o pilar recebe o pilar do nível de cima
        if (acimaDoTipo(cg.elementoId, pav)) {
          if (k === n) cargas.push(cg);
          else if (cg.ligacao === 'base') cargas.push({ ...cg, elementoId: `${e.id}${SEP}${k + 1}`, descricao: `${e.codigo} (nível ${k + 1})` });
          continue;
        }
        cargas.push(cg);
      }
      // pilares sem pilar de cima no tipo também recebem o nível de cima (o tipo é um prumo só)
      if (k < n && e.modulo?.endsWith('pilar') && !cargas.some((cg) => cg.elementoId === `${e.id}${SEP}${k + 1}`)) {
        const temCima = (Array.isArray(e.cargas) ? e.cargas : []).some((cg) => cg?.ligacao === 'base' && acimaDoTipo(cg.elementoId, pav));
        if (!temCima) cargas.push({ id: `tipo${k}`, tipo: 'elemento', elementoId: `${e.id}${SEP}${k + 1}`, ligacao: 'base', descricao: `${e.codigo} (nível ${k + 1})` });
      }
      if (k === 1) { elementos.push(Array.isArray(e.cargas) ? { ...e, cargas } : e); continue; }
      elementos.push({ ...e, id: sufixo(e.id), cargas: Array.isArray(e.cargas) ? cargas : e.cargas, posicao: { ...e.posicao, pavimento: `${pav}${SEP}${k}` }, copiaDe: e.id, nivel: k });
    }
  }
  // fundações e quem aponta para elementos do tipo continua no nível 1 (o mais baixo)
  const exp = { ...projeto, pavimentos: pavs, elementos };
  return exp;
}

/** Os pavimentos acima andam junto quando as repetições mudam, para manter o pé-direito deles (altera no lugar). */
export function definirRepeticoes(projeto, pavId, n) {
  const ord = pavimentosOrdenados(projeto);
  const i = ord.findIndex((p) => p.id === pavId);
  if (i < 0) return;
  const pv = ord[i];
  const antes = repeticoesDe(pv);
  const novo = Math.max(1, Math.min(200, Math.floor(n) || 1));
  const pd = peDireitoBruto(ord, i);
  const delta = Math.round((novo - antes) * pd * 1e6) / 1e6;
  if (novo > 1) pv.repeticoes = novo; else delete pv.repeticoes;
  if (delta) for (let j = i + 1; j < ord.length; j++) ord[j].cota = Math.round((ord[j].cota + delta) * 1e6) / 1e6;
}

/** Cópia seletiva de um pavimento: só os tipos escolhidos ('pilar', 'viga', 'laje', 'outros'). */
export function filtroDeCopia(registro, tipos) {
  const sel = new Set(tipos);
  return (el) => {
    const t = tipoDe(el, registro);
    return sel.has(['pilar', 'viga', 'laje'].includes(t) ? t : 'outros');
  };
}
