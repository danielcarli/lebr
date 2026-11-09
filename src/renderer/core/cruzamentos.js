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
 * Cruzamentos entre vigas (roteiro, etapa L3). Onde duas vigas se cruzam fora de um pilar, o engenheiro diz quem
 * apoia em quem, como nos programas consolidados:
 *   - "A apoia em B": A recebe uma rótula no cruzamento e descarrega em B, que passa contínua;
 *   - "sem transferência": as vigas se cruzam sem se tocar no modelo (níveis diferentes, por exemplo);
 *   - indefinido: o cálculo não roda (painel de problemas).
 * A escolha fica no pavimento, em `pavimento.cruzamentos[chave]` = id da viga apoiada ou 'sem'; a chave junta os
 * ids das duas vigas em ordem. Quando só uma das vigas tem um apoio declarado no ponto do cruzamento, ela é a apoiada
 * (definição implícita). Encontros em T (uma viga termina na outra) não são cruzamentos: a que termina se apoia.
 */
import { tipoDe, eixoViga, secaoViga, distanciaAoPilar, pavimento, TOLERANCIA } from './montagem.js';
import { secaoDoVao } from '../../engine/viga-secoes.js';

export const SEM_TRANSFERENCIA = 'sem';
export const chaveCruzamento = (a, b) => [a, b].sort().join('|');

/**
 * Cruzamentos de vigas de um pavimento.
 * @returns {{chave:string, a:object, b:object, ponto:number[], sa:number, sb:number, valor:string|null,
 *   implicito:boolean, apoiada:object|null, apoio:object|null, sem:boolean}[]}
 *   valor: id da viga apoiada, 'sem' ou null (indefinido)
 */
export function cruzamentosDoPavimento(projeto, registro, pavId) {
  const pv = pavimento(projeto, pavId);
  if (!pv) return [];
  const doPav = projeto.elementos.filter((e) => e.posicao?.pavimento === pavId);
  const vigas = doPav.filter((e) => tipoDe(e, registro) === 'viga' && Array.isArray(e.vaos) && e.vaos.length)
    .sort((x, y) => String(x.codigo).localeCompare(String(y.codigo), 'pt-BR', { numeric: true }));
  const pilares = doPav.filter((e) => tipoDe(e, registro) === 'pilar');
  const eixos = new Map(vigas.map((v) => [v.id, eixoViga(v)]));
  const out = [];
  for (let i = 0; i < vigas.length; i++) {
    for (let j = i + 1; j < vigas.length; j++) {
      const a = vigas[i], b = vigas[j];
      const A = eixos.get(a.id), B = eixos.get(b.id);
      const den = A.u[0] * B.u[1] - A.u[1] * B.u[0];
      if (Math.abs(den) < 1e-6) continue; // paralelas
      const dx = B.a[0] - A.a[0], dy = B.a[1] - A.a[1];
      const sa = (dx * B.u[1] - dy * B.u[0]) / den;
      const sb = (dx * A.u[1] - dy * A.u[0]) / den;
      // longe das pontas das duas: as pontas são encontros (em T ou em L), não cruzamentos
      const folgaA = Math.max(TOLERANCIA, secaoViga(b).b / 200), folgaB = Math.max(TOLERANCIA, secaoViga(a).b / 200);
      if (sa <= folgaA || sa >= A.L - folgaA || sb <= folgaB || sb >= B.L - folgaB) continue;
      const ponto = [A.a[0] + A.u[0] * sa, A.a[1] + A.u[1] * sa];
      if (pilares.some((p) => distanciaAoPilar(ponto, p).dentro)) continue;
      const chave = chaveCruzamento(a.id, b.id);
      let valor = pv.cruzamentos?.[chave] ?? null;
      if (valor !== SEM_TRANSFERENCIA && valor !== a.id && valor !== b.id) valor = null;
      let implicito = false;
      if (!valor) {
        const apoioEm = (v, s) => { const e = eixos.get(v.id); return (v.apoios ?? []).some((t, k) => t !== 'livre' && Math.abs((e.vaos[k]?.[0] ?? e.L) - s) <= TOLERANCIA); };
        const ta = apoioEm(a, sa), tb = apoioEm(b, sb);
        if (ta !== tb) { valor = ta ? a.id : b.id; implicito = true; }
      }
      const apoiada = valor === a.id ? a : valor === b.id ? b : null;
      out.push({ chave, a, b, ponto, sa, sb, valor, implicito, apoiada, apoio: apoiada ? (apoiada === a ? b : a) : null, sem: valor === SEM_TRANSFERENCIA });
    }
  }
  return out;
}

/** Cruzamentos de todos os pavimentos. */
export const cruzamentosDoProjeto = (projeto, registro) => (projeto?.pavimentos ?? []).flatMap((pv) => cruzamentosDoPavimento(projeto, registro, pv.id).map((c) => ({ ...c, pavimento: pv.id })));

/** Grava a escolha de um cruzamento (null volta a indefinido). Altera o projeto no lugar. */
export function definirCruzamento(projeto, pavId, chave, valor) {
  const pv = pavimento(projeto, pavId);
  if (!pv) return;
  pv.cruzamentos ??= {};
  if (valor == null) delete pv.cruzamentos[chave]; else pv.cruzamentos[chave] = valor;
  if (!Object.keys(pv.cruzamentos).length) delete pv.cruzamentos;
}

/** Rigidez relativa de uma viga no cruzamento: b·h³ / L³ do vão em que ele cai. */
function rigidezNoPonto(v, s) {
  const e = eixoViga(v);
  const k = Math.max(0, e.vaos.findIndex(([x0, x1]) => s >= x0 - 1e-9 && s <= x1 + 1e-9));
  const L = v.vaos[k]?.L ?? e.L;
  const { b, h } = secaoDoVao(v, k);
  return (b * h ** 3) / L ** 3;
}

/**
 * Sugestão para um cruzamento: a viga mais rígida (b·h³/L³ do vão) é o apoio; a outra se apoia nela.
 * @returns {string} id da viga apoiada
 */
export function sugerirCruzamento(c) {
  const ka = rigidezNoPonto(c.a, c.sa), kb = rigidezNoPonto(c.b, c.sb);
  if (Math.abs(ka - kb) > 1e-9 * Math.max(ka, kb)) return ka > kb ? c.b.id : c.a.id;
  // empate: a de menor altura se apoia; persistindo, a de código maior
  const ha = secaoViga(c.a).h, hb = secaoViga(c.b).h;
  if (ha !== hb) return ha > hb ? c.b.id : c.a.id;
  return c.b.id;
}

/**
 * "Definir todos": grava a sugestão em todos os cruzamentos indefinidos (de um pavimento ou do projeto).
 * @returns {number} quantos foram definidos
 */
export function definirTodosCruzamentos(projeto, registro, pavId = null) {
  let n = 0;
  for (const pv of projeto.pavimentos ?? []) {
    if (pavId && pv.id !== pavId) continue;
    for (const c of cruzamentosDoPavimento(projeto, registro, pv.id)) {
      if (c.valor) continue;
      definirCruzamento(projeto, pv.id, c.chave, sugerirCruzamento(c));
      n++;
    }
  }
  return n;
}

/** Texto de um cruzamento. */
export function textoCruzamento(c) {
  if (c.sem) return `${c.a.codigo} × ${c.b.codigo}: sem transferência`;
  if (c.apoiada) return `${c.apoiada.codigo} apoia em ${c.apoio.codigo}${c.implicito ? ' (apoio declarado na viga)' : ''}`;
  return `${c.a.codigo} × ${c.b.codigo}: indefinido`;
}
